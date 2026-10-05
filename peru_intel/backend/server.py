"""Servidor local (stdlib): API v1, SSE, proxy del mapa base y la interfaz web.

Seguridad local:
- escucha en 127.0.0.1 por defecto;
- CSP 'self' (el navegador solo habla con este servidor; las claves de terceros nunca salen del backend);
- las peticiones POST exigen JSON y, si traen cabecera Origin, que coincida con este servidor (anti-CSRF);
- cuerpo máximo 64 KB; rutas de archivos estáticos confinadas a apps/web.
"""
from __future__ import annotations

import gzip
import json
import mimetypes
import re
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from .. import config
from ..live import bus
from ..map import basemaps, ofm_proxy
from ..weather import overlays as wx_overlays
from ..sources import registry
from . import api

CSP = ("default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; "
       "script-src 'self'; worker-src 'self' blob:; connect-src 'self'; font-src 'self'; "
       "frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
MAX_BODY = 64 * 1024
MAX_AUDIO = 8 * 1024 * 1024
_CSP_CACHE = {"t": 0.0, "v": CSP}


def csp() -> str:
    """CSP 'self'; si el usuario habilitó la voz Realtime, se añade SOLO ese origen a connect-src (WebRTC/SDP)."""
    if time.time() - _CSP_CACHE["t"] > 5:
        from ..ai import voice
        extra = " ".join(voice.connect_origins())
        _CSP_CACHE.update(t=time.time(), v=CSP.replace("connect-src 'self'", f"connect-src 'self' {extra}".rstrip()))
    return _CSP_CACHE["v"]
TILE_RX = re.compile(r"^/api/v1/intel/traffic/tiles/(\d{1,2})/(\d{1,7})/(\d{1,7})\.png$")
WX_TILE_RX = re.compile(r"^/api/v1/intel/weather/tiles/(gibs|senamhi)/([a-z0-9_]{1,24})/(\d{1,2})/(\d{1,7})/(\d{1,7})\.(png|jpg)$")
SNAP_RX = re.compile(r"^/api/v1/intel/vision/snap/([0-9a-f]{6,16})/(\d{1,2})\.jpg$")
BASE_TILE_RX = re.compile(r"^/tiles/base/([a-z0-9]{1,12})/(\d{1,2})/(\d{1,7})/(\d{1,7})$")


class Handler(BaseHTTPRequestHandler):
    server_version = "MapaPeruAnalitico/0.1"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # silencio salvo errores
        if config.setting("debug"):
            super().log_message(fmt, *args)

    # ── salida ────────────────────────────────────────────────────────────
    def _send(self, status: int, body: bytes, ctype: str, cache: str = "no-store", compress: bool = True):
        if compress and len(body) > 1400 and "gzip" in (self.headers.get("Accept-Encoding") or "") and \
                not ctype.startswith(("image/", "application/x-protobuf", "font/")):
            body = gzip.compress(body, 5)
            self.send_response(status)
            self.send_header("Content-Encoding", "gzip")
        else:
            self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.send_header("Content-Security-Policy", csp())
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, data, cache: str = "no-store"):
        self._send(status, json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"),
                   "application/json; charset=utf-8", cache)

    # ── entrada ───────────────────────────────────────────────────────────
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path
        try:
            if path == "/api/v1/stream":
                return self._sse()
            m = TILE_RX.match(path)
            if m:
                data = api.TRAFFIC.tile(*map(int, m.groups()))
                return self._send(200, data, "image/png", "max-age=60") if data else self._send(204, b"", "image/png")
            m = WX_TILE_RX.match(path)
            if m:
                r = wx_overlays.tile(m[1], m[2], int(m[3]), int(m[4]), int(m[5]))
                if r is None:
                    return self._send(404, b"", "text/plain")
                return self._send(200 if r[0] else 204, r[0], r[1], "max-age=900")
            m = SNAP_RX.match(path)
            if m:
                data, ctype = api.vision_snapshot(m[1], int(m[2]))
                return self._send(200, data, ctype, "no-store")
            m = BASE_TILE_RX.match(path)
            if m:
                r = basemaps.tile(m[1], int(m[2]), int(m[3]), int(m[4]))
                return self._send(200, r[0], r[1], "max-age=2592000") if r else self._send(404, b"", "text/plain")
            if path.startswith("/api/"):
                return self._json(200, api.route_get(path, parse_qs(url.query)))
            if path.startswith("/geo/") and path.endswith(".geojson"):
                data = api.boundaries(path[5:-8])
                return self._send(200, data, "application/geo+json", "max-age=86400") if data else self._json(404, {"error": "no existe"})
            if path.startswith("/ofm/"):
                host = self.headers.get("Host") or f"127.0.0.1:{self.server.server_port}"
                if not re.fullmatch(r"[A-Za-z0-9.\-\[\]:]+", host):  # evita inyectar texto arbitrario en el estilo
                    host = f"127.0.0.1:{self.server.server_port}"
                r = ofm_proxy.get(unquote(path[5:]), origin=f"http://{host}")
                if not r:
                    return self._send(404, b"", "text/plain")
                cache = "max-age=31536000, immutable" if path.endswith((".pbf", ".png")) else "no-cache"
                return self._send(200, r[0], r[1], cache)
            return self._static(path)
        except api.ApiError as e:
            self._json(e.status, {"error": str(e)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def do_POST(self):
        try:
            origin = self.headers.get("Origin")
            host = self.headers.get("Host")
            if origin and urlparse(origin).netloc != host:
                return self._json(403, {"error": "origen no permitido"})
            path = urlparse(self.path).path
            if path == "/api/v1/ai/voice/stt":  # audio binario del micrófono
                ctype = (self.headers.get("Content-Type") or "").split(";")[0]
                if not ctype.startswith("audio/"):
                    return self._json(415, {"error": "se requiere audio/*"})
                n = int(self.headers.get("Content-Length") or 0)
                if n <= 0 or n > MAX_AUDIO:
                    return self._json(413, {"error": "audio vacío o mayor a 8 MB"})
                from ..ai import gateway, voice
                try:
                    return self._json(200, voice.stt(self.rfile.read(n), ctype))
                except gateway.GatewayError as e:
                    return self._json(409, {"error": f"{e.code}: {e}"})
            if path == "/api/v1/ai/voice/tts":
                n = int(self.headers.get("Content-Length") or 0)
                if n > MAX_BODY or "application/json" not in (self.headers.get("Content-Type") or ""):
                    return self._json(400, {"error": "JSON {text}"})
                from ..ai import gateway, voice
                body = json.loads(self.rfile.read(n) or b"{}")
                try:
                    audio, meta = voice.tts(str(body.get("text") or ""))
                except gateway.GatewayError as e:
                    return self._json(409, {"error": f"{e.code}: {e}"})
                if audio is None:
                    return self._json(200, meta)
                return self._send(200, audio, "audio/mpeg", "no-store", compress=False)
            if "application/json" not in (self.headers.get("Content-Type") or ""):
                return self._json(415, {"error": "se requiere JSON"})
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                return self._json(413, {"error": "cuerpo demasiado grande"})
            body = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(body, dict):
                return self._json(400, {"error": "se esperaba un objeto JSON"})
            self._json(200, api.route_post(urlparse(self.path).path, body))
        except api.ApiError as e:
            self._json(e.status, {"error": str(e)})
        except ValueError as e:
            self._json(400, {"error": f"JSON inválido: {e}"})
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self._json(500, {"error": f"{type(e).__name__}: {e}"})

    def _static(self, path: str):
        if path in ("", "/"):
            path = "/index.html"
        target = (config.WEB / path.lstrip("/")).resolve()
        if config.WEB.resolve() not in target.parents or not target.is_file():
            return self._send(404, "No encontrado".encode(), "text/plain; charset=utf-8")
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        cache = "no-cache" if target.suffix in (".html", ".js", ".css") else "max-age=604800"
        self._send(200, target.read_bytes(), ctype, cache)

    def _sse(self):
        q = bus.subscribe()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            self.wfile.write(b"retry: 5000\n\n")
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=20)
                except Exception:  # noqa: BLE001 — latido para mantener viva la conexión
                    msg = ": ping\n\n"
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError, OSError):
            pass
        finally:
            bus.unsubscribe(q)
            self.close_connection = True


def run(host: str = "127.0.0.1", port: int = 8360, live: bool = True, open_browser: bool = False) -> None:
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("font/woff2", ".woff2")
    mimetypes.add_type("application/geo+json", ".geojson")
    config.ensure_dirs()
    registry.sync()
    if live:
        from ..live import load_all
        load_all()
    def _warm():
        time.sleep(120)  # después del arranque: no compite con la primera carga del mapa
        try:
            from ..analytics import patterns
            patterns.warmup()
        except Exception:  # noqa: BLE001 — opcional
            pass
    threading.Thread(target=_warm, name="warmup", daemon=True).start()
    srv = ThreadingHTTPServer((host, port), Handler)
    srv.daemon_threads = True
    url = f"http://{host}:{port}/"
    print(f"Mapa Perú Analítico en {url}  (Ctrl+C para detener)", flush=True)
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        print("Detenido.")
    finally:
        srv.server_close()
        time.sleep(0.1)

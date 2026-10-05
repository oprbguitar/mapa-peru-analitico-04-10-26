"""Cliente de grabadores/cámaras en la red local: prueba de conexión, canales, foto (snapshot) y URL RTSP.

Dahua (XVR/NVR/IPC, p. ej. DH-XVR5108HS-X):
  HTTP CGI con autenticación Digest      /cgi-bin/magicBox.cgi?action=getDeviceType
                                          /cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle
                                          /cgi-bin/snapshot.cgi?channel=N            (N empieza en 1)
  RTSP                                    rtsp://usuario:clave@IP:554/cam/realmonitor?channel=N&subtype=0|1
                                          subtype=0 principal (H.265/H.264), 1 secundario (más liviano)
Hikvision (ISAPI):                        /ISAPI/Streaming/channels/N01/picture · rtsp://…/Streaming/Channels/N01
ONVIF / RTSP genérico:                    solo la URL RTSP que indique el usuario (`rtsp_path`).

El video en vivo dentro del navegador necesita un puente RTSP→web (go2rtc). Sin él, el visor usa fotos
del grabador cada ~1 s, que es suficiente para ubicar y verificar cada canal.
"""
from __future__ import annotations

import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from .. import config

TIMEOUT = 6
_SNAP_CACHE: dict[tuple, tuple[float, bytes]] = {}
_SNAP_LOCK = threading.Lock()
SNAP_TTL = 0.8


def _opener(cam: dict) -> urllib.request.OpenerDirector:
    mgr = urllib.request.HTTPPasswordMgrWithDefaultRealm()
    mgr.add_password(None, f"http://{cam['host']}:{cam['http_port']}/", cam["username"], cam.get("password") or "")
    # sin proxies del sistema: el equipo está en la red local
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPDigestAuthHandler(mgr),
                                       urllib.request.HTTPBasicAuthHandler(mgr))


def _get(cam: dict, path: str, timeout: float = TIMEOUT) -> tuple[int, bytes, str]:
    url = f"http://{cam['host']}:{cam['http_port']}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": config.USER_AGENT})
    try:
        with _opener(cam).open(req, timeout=timeout) as r:  # noqa: S310 — host validado (red local)
            return r.status, r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        return e.code, b"", ""


def tcp_open(host: str, port: int, timeout: float = 2.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def parse_kv(text: str) -> dict:
    out = {}
    for line in text.splitlines():
        k, sep, v = line.partition("=")
        if sep:
            out[k.strip()] = v.strip()
    return out


def parse_channel_titles(text: str) -> list[dict]:
    """table.ChannelTitle[0].Name=CAM 1  →  [{'ch': 1, 'name': 'CAM 1'}]"""
    out = []
    for m in re.finditer(r"ChannelTitle\[(\d+)\]\.Name=(.*)", text):
        out.append({"ch": int(m[1]) + 1, "name": m[2].strip()[:60] or f"Canal {int(m[1]) + 1}"})
    return out


def probe(cam: dict) -> dict:
    """Diagnóstico paso a paso, en lenguaje claro. No devuelve credenciales."""
    steps = []
    http_ok = tcp_open(cam["host"], cam["http_port"])
    steps.append({"step": f"Puerto web {cam['http_port']}", "ok": http_ok,
                  "hint": None if http_ok else "Revisa la IP, que la PC y el grabador estén en la misma red y el puerto HTTP (Menú → Red → Puerto)."})
    rtsp_ok = tcp_open(cam["host"], cam["rtsp_port"])
    steps.append({"step": f"Puerto RTSP {cam['rtsp_port']}", "ok": rtsp_ok,
                  "hint": None if rtsp_ok else "Activa RTSP en el grabador (Red → Puerto → RTSP, por defecto 554)."})
    info: dict = {"channels": []}
    if http_ok and cam["vendor"] == "dahua":
        st, body, _ = _get(cam, "/cgi-bin/magicBox.cgi?action=getDeviceType")
        auth_ok = st == 200
        steps.append({"step": "Usuario y contraseña (CGI Dahua)", "ok": auth_ok,
                      "hint": None if auth_ok else ("Credenciales rechazadas (401). Usa un usuario con permiso de vista en vivo."
                                                    if st == 401 else f"El equipo respondió HTTP {st}. Activa CGI: Red → Servicios de plataforma / CGI.")})
        if auth_ok:
            info["model"] = parse_kv(body.decode("utf-8", "replace")).get("type")
            st2, b2, _ = _get(cam, "/cgi-bin/configManager.cgi?action=getConfig&name=ChannelTitle")
            if st2 == 200:
                info["channels"] = parse_channel_titles(b2.decode("utf-8", "replace"))
            st3, b3, _ = _get(cam, "/cgi-bin/magicBox.cgi?action=getSoftwareVersion")
            if st3 == 200:
                info["firmware"] = parse_kv(b3.decode("utf-8", "replace")).get("version")
            steps.append({"step": "Lectura de canales", "ok": bool(info["channels"]),
                          "hint": None if info["channels"] else "No se leyeron los nombres; se usarán Canal 1…8."})
    elif http_ok and cam["vendor"] == "hikvision":
        st, body, _ = _get(cam, "/ISAPI/System/deviceInfo")
        steps.append({"step": "Usuario y contraseña (ISAPI)", "ok": st == 200, "hint": None if st == 200 else f"HTTP {st}"})
        m = re.search(r"<model>([^<]+)</model>", body.decode("utf-8", "replace"))
        info["model"] = m[1] if m else None
    ok = all(s["ok"] for s in steps if not s["step"].startswith("Lectura"))
    return {"ok": ok, "steps": steps, "device": info, "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S")}


def rtsp_url(cam: dict, ch: int, sub: bool = True, masked: bool = True) -> str:
    user = urllib.parse.quote(cam["username"], safe="")
    pwd = "••••••" if masked else urllib.parse.quote(cam.get("password") or "", safe="")
    base = f"rtsp://{user}:{pwd}@{cam['host']}:{cam['rtsp_port']}"
    if cam["vendor"] == "dahua":
        return f"{base}/cam/realmonitor?channel={ch}&subtype={1 if sub else 0}"
    if cam["vendor"] == "hikvision":
        return f"{base}/Streaming/Channels/{ch}0{2 if sub else 1}"
    path = (cam.get("rtsp_path") or "/").replace("{ch}", str(ch))
    return base + (path if path.startswith("/") else "/" + path)


def snapshot(cam: dict, ch: int) -> tuple[bytes, str]:
    """JPEG del canal. Primero go2rtc (si está corriendo y tiene el flujo), si no, el CGI del grabador."""
    key = (cam["id"], ch)
    with _SNAP_LOCK:
        hit = _SNAP_CACHE.get(key)
        if hit and time.time() - hit[0] < SNAP_TTL:
            return hit[1], "image/jpeg"
    data = _go2rtc_frame(cam, ch)
    if data is None:
        if cam["vendor"] == "dahua":
            st, data, ctype = _get(cam, f"/cgi-bin/snapshot.cgi?channel={ch}", timeout=8)
        elif cam["vendor"] == "hikvision":
            st, data, ctype = _get(cam, f"/ISAPI/Streaming/channels/{ch}01/picture", timeout=8)
        else:
            raise RuntimeError("Este tipo de equipo necesita go2rtc para mostrar imagen (solo RTSP).")
        if st != 200 or not data:
            raise RuntimeError(f"El grabador no entregó imagen (HTTP {st}).")
    with _SNAP_LOCK:
        _SNAP_CACHE[key] = (time.time(), data)
    return data, "image/jpeg"


def go2rtc_base() -> str:
    return (config.setting("go2rtc_url") or "http://127.0.0.1:1984").rstrip("/")


def stream_name(cam: dict, ch: int) -> str:
    return f"pi_{cam['id']}_{ch}"


def _go2rtc_frame(cam: dict, ch: int) -> bytes | None:
    base = go2rtc_base()
    host = urllib.parse.urlparse(base).hostname or ""
    if host not in ("127.0.0.1", "localhost", "::1"):
        return None
    try:
        req = urllib.request.Request(f"{base}/api/frame.jpeg?src={stream_name(cam, ch)}")
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=4) as r:  # noqa: S310
            data = r.read()
            return data if data[:2] == b"\xff\xd8" else None
    except (urllib.error.URLError, OSError, ValueError):
        return None


def go2rtc_status() -> dict:
    base = go2rtc_base()
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(f"{base}/api", timeout=2) as r:  # noqa: S310
            return {"running": r.status == 200, "url": base}
    except (urllib.error.URLError, OSError, ValueError):
        return {"running": False, "url": base}


def go2rtc_yaml(cams: list[dict]) -> str:
    """Configuración de go2rtc con el flujo secundario de cada canal habilitado (contiene credenciales)."""
    lines = ["# Generado por Mapa Perú Analítico · vision-edge. Contiene credenciales: no lo compartas.",
             "api:", "  listen: \"127.0.0.1:1984\"", "rtsp:", "  listen: \"127.0.0.1:8554\"", "streams:"]
    for c in cams:
        for ch in c["channels"]:
            if ch["enabled"]:
                lines.append(f"  {stream_name(c, ch['ch'])}: {rtsp_url(c, ch['ch'], sub=True, masked=False)}")
    return "\n".join(lines) + "\n"

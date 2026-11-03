"""Fuentes en vivo adicionales tomadas de GOdEyes (server/providers/radio, space/launch-library; MIT):
radios del Perú con ubicación (radio-browser.info) y próximos lanzamientos espaciales (Launch Library 2).

Cada respuesta declara su frescura: `stale=True` y `age_s` cuando el proveedor falla y se sirve la última copia
guardada en disco (respaldo), para que la interfaz nunca presente un dato viejo como si fuera en vivo.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

from .. import config

UA = "MapaPeruAnalitico/0.5 (https://github.com/oprbguitar/mapa-peru-analitico-04-10-26)"
_LOCK = threading.Lock()
_MEM: dict[str, tuple[float, dict]] = {}


def _cache_dir() -> Path:
    d = Path(getattr(config, "DATA", Path("data"))) / "live" / "feeds"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _get_json(url: str, timeout: int = 20) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 — URLs fijas de este módulo
        body = r.read(12 * 1024 * 1024 + 1)
    if len(body) > 12 * 1024 * 1024:
        raise RuntimeError("Respuesta demasiado grande")
    return json.loads(body)


def cached(name: str, ttl: int, fetch) -> dict:
    """Memoria (ttl) → proveedor → copia en disco marcada como desactualizada si el proveedor falla."""
    now = time.time()
    with _LOCK:
        hit = _MEM.get(name)
        if hit and now - hit[0] < ttl:
            return hit[1] | {"stale": False, "age_s": round(now - hit[0])}
    disk = _cache_dir() / f"{name}.json"
    try:
        value = fetch()
        with _LOCK:
            _MEM[name] = (now, value)
        disk.write_text(json.dumps({"at": now, "value": value}, ensure_ascii=False), encoding="utf-8")
        return value | {"stale": False, "age_s": 0}
    except Exception as exc:  # noqa: BLE001 — proveedores externos
        if disk.exists():
            saved = json.loads(disk.read_text(encoding="utf-8"))
            return saved["value"] | {"stale": True, "age_s": round(now - saved["at"]),
                                     "fallback": f"Proveedor sin respuesta ({type(exc).__name__}); se muestra la última copia guardada."}
        return {"available": False, "reason": f"Proveedor sin respuesta ({type(exc).__name__}) y sin copia guardada.", "items": []}


# ── radios del Perú ──────────────────────────────────────────────────────────
RADIO_SERVERS = ("https://de1.api.radio-browser.info", "https://nl1.api.radio-browser.info", "https://de2.api.radio-browser.info")


def _radios() -> dict:
    params = urllib.parse.urlencode({"countrycode": "PE", "has_geo_info": "true", "hidebroken": "true", "order": "clickcount",
                                     "reverse": "true", "limit": 600})
    last = None
    for base in RADIO_SERVERS:
        try:
            rows = _get_json(f"{base}/json/stations/search?{params}")
            break
        except Exception as exc:  # noqa: BLE001
            last = exc
    else:
        raise RuntimeError(str(last))
    items = []
    for r in rows:
        try:
            lat, lon = float(r.get("geo_lat")), float(r.get("geo_long"))
        except (TypeError, ValueError):
            continue
        stream = r.get("url_resolved") or r.get("url") or ""
        if not (-18.6 <= lat <= 0.4 and -81.6 <= lon <= -68.4) or not stream.startswith("https://"):
            continue  # solo transmisiones HTTPS: el navegador bloquea audio inseguro dentro de la página
        items.append({"id": r.get("stationuuid"), "name": (r.get("name") or "").strip()[:80], "lat": lat, "lon": lon,
                      "tags": (r.get("tags") or "")[:80], "codec": r.get("codec"), "bitrate": r.get("bitrate"),
                      "stream": stream, "homepage": r.get("homepage"), "votes": r.get("votes"), "state": r.get("state")})
    return {"available": True, "items": items, "provenance": [{
        "source_id": "radio_browser", "name": "Directorio comunitario de emisoras", "institution": "radio-browser.info",
        "url": "https://www.radio-browser.info/", "kind": "vivo_tercero", "official": False, "license": "Datos abiertos (ODbL según el proyecto)",
        "geographic_level": "punto declarado por la comunidad", "downloaded": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "notes": "Ubicación y estado declarados por la comunidad; no es el registro oficial del MTC."}]}


def radios() -> dict:
    return cached("radios_pe", 6 * 3600, _radios)


# ── lanzamientos espaciales ─────────────────────────────────────────────────
LL2 = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20&mode=normal"


def _launches() -> dict:
    data = _get_json(LL2)
    items = []
    for r in data.get("results", []):
        pad = r.get("pad") or {}
        try:
            lat, lon = float(pad.get("latitude")), float(pad.get("longitude"))
        except (TypeError, ValueError):
            continue
        items.append({"id": r.get("id"), "name": r.get("name"), "net": r.get("net"), "status": (r.get("status") or {}).get("abbrev"),
                      "status_name": (r.get("status") or {}).get("name"), "provider": (r.get("launch_service_provider") or {}).get("name"),
                      "pad": pad.get("name"), "location": (pad.get("location") or {}).get("name"), "lat": lat, "lon": lon,
                      "mission": ((r.get("mission") or {}).get("description") or "")[:240], "orbit": ((r.get("mission") or {}).get("orbit") or {}).get("abbrev")})
    return {"available": True, "items": items, "provenance": [{
        "source_id": "launch_library_2", "name": "Próximos lanzamientos orbitales", "institution": "The Space Devs · Launch Library 2",
        "url": "https://thespacedevs.com/llapi", "kind": "vivo_tercero", "official": False, "license": "Uso libre con atribución (tasa limitada)",
        "geographic_level": "plataforma de lanzamiento", "downloaded": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "notes": "Fechas NET (no antes de); cambian con frecuencia. Sin clave: ~15 consultas por hora."}]}


def launches() -> dict:
    return cached("launches", 30 * 60, _launches)

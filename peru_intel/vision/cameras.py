"""Registro local de cámaras / grabadores (vision-edge).

- Se guarda en data/cameras.local.json (ignorado por git). La contraseña NUNCA vuelve al navegador.
- Solo se aceptan equipos de la red local (IP privada, loopback o nombre .local/.lan) para que el servidor no pueda
  usarse como puente hacia Internet. Para un DDNS público hay que habilitarlo a propósito: `vision_allow_public=true`.
- Cada canal se ubica en el mapa (lat/lon) y se le asigna el UBIGEO del distrito para agregarlo por territorio.
"""
from __future__ import annotations

import ipaddress
import json
import os
import re
import socket
import threading
import time
import uuid

from .. import config
from ..map import territory

PATH = config.DATA / "cameras.local.json"
VENDORS = ("dahua", "hikvision", "onvif", "rtsp")
_LOCK = threading.Lock()
_HOST_RX = re.compile(r"^[A-Za-z0-9.\-]{1,253}$")


class CameraError(ValueError):
    pass


def _read() -> list[dict]:
    try:
        return json.loads(PATH.read_text(encoding="utf-8")).get("cameras", [])
    except (OSError, ValueError):
        return []


def _write(cams: list[dict]) -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps({"cameras": cams}, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, PATH)


def host_allowed(host: str) -> bool:
    if not host or not _HOST_RX.match(host):
        return False
    if config.setting("vision_allow_public", "false").lower() == "true":
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        if host.endswith((".local", ".lan", ".home", ".internal")):
            return True
        try:  # nombre: se resuelve y se exige que apunte a la red local
            ip = ipaddress.ip_address(socket.gethostbyname(host))
        except (OSError, ValueError):
            return False
    return ip.is_private or ip.is_loopback or ip.is_link_local


def _port(v, default: int) -> int:
    try:
        p = int(v if v not in (None, "") else default)
    except (TypeError, ValueError):
        raise CameraError("puerto inválido")
    if not 1 <= p <= 65535:
        raise CameraError("puerto fuera de rango")
    return p


def _channels(raw, n_default: int) -> list[dict]:
    out = []
    items = raw if isinstance(raw, list) and raw else [{"ch": i} for i in range(1, n_default + 1)]
    for c in items[:64]:
        try:
            ch = int(c.get("ch"))
        except (TypeError, ValueError, AttributeError):
            continue
        if not 1 <= ch <= 64:
            continue
        lat, lon = c.get("lat"), c.get("lon")
        try:
            lat = float(lat) if lat not in (None, "") else None
            lon = float(lon) if lon not in (None, "") else None
        except (TypeError, ValueError):
            lat = lon = None
        if lat is not None and not (-90 <= lat <= 90 and -180 <= lon <= 180):
            lat = lon = None
        dist = territory.district_at(lat, lon) if lat is not None else None
        out.append({"ch": ch, "name": str(c.get("name") or f"Canal {ch}")[:60], "enabled": c.get("enabled", True) is not False,
                    "lat": lat, "lon": lon, "ubigeo": dist.get("u") if dist else None, "distrito": dist.get("n") if dist else None})
    return out


def normalize(body: dict, existing: dict | None = None) -> dict:
    vendor = str(body.get("vendor") or (existing or {}).get("vendor") or "dahua").lower()
    if vendor not in VENDORS:
        raise CameraError("fabricante no soportado")
    host = str(body.get("host") or (existing or {}).get("host") or "").strip()
    if not host_allowed(host):
        raise CameraError("La dirección debe ser de tu red local (p. ej. 192.168.1.108). Para DDNS público activa "
                          "vision_allow_public en config.local.json, sabiendo que expones el equipo.")
    pwd = body.get("password")
    cam = {
        "id": (existing or {}).get("id") or uuid.uuid4().hex[:10],
        "name": str(body.get("name") or (existing or {}).get("name") or "Mi grabador")[:60],
        "vendor": vendor, "model": str(body.get("model") or (existing or {}).get("model") or "")[:60],
        "host": host,
        "http_port": _port(body.get("http_port", (existing or {}).get("http_port")), 80),
        "rtsp_port": _port(body.get("rtsp_port", (existing or {}).get("rtsp_port")), 554),
        "username": str(body.get("username") or (existing or {}).get("username") or "admin")[:64],
        # contraseña: si no viene, se conserva la anterior (el navegador nunca la recibe)
        "password": str(pwd)[:128] if pwd not in (None, "") else (existing or {}).get("password", ""),
        "rtsp_path": str(body.get("rtsp_path") or (existing or {}).get("rtsp_path") or "")[:200],
        "channels": _channels(body.get("channels") if "channels" in body else (existing or {}).get("channels"),
                              int(body.get("n_channels") or 8)),
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    return cam


def public(cam: dict) -> dict:
    out = {k: v for k, v in cam.items() if k != "password"}
    out["has_password"] = bool(cam.get("password"))
    return out


def list_public() -> list[dict]:
    return [public(c) for c in _read()]


def get(cam_id: str) -> dict | None:
    return next((c for c in _read() if c["id"] == cam_id), None)


def upsert(body: dict) -> dict:
    with _LOCK:
        cams = _read()
        existing = next((c for c in cams if c["id"] == body.get("id")), None) if body.get("id") else None
        cam = normalize(body, existing)
        cams = [c for c in cams if c["id"] != cam["id"]] + [cam]
        _write(cams)
    return public(cam)


def remove(cam_id: str) -> bool:
    with _LOCK:
        cams = _read()
        keep = [c for c in cams if c["id"] != cam_id]
        _write(keep)
    return len(keep) != len(cams)


def as_features() -> list[dict]:
    """Canales ubicados en el mapa (sin credenciales)."""
    out = []
    for c in _read():
        for ch in c["channels"]:
            if ch["enabled"] and ch["lat"] is not None:
                out.append({"cam": c["id"], "cam_name": c["name"], "vendor": c["vendor"], "ch": ch["ch"], "name": ch["name"],
                            "lat": ch["lat"], "lon": ch["lon"], "ubigeo": ch["ubigeo"], "distrito": ch["distrito"]})
    return out

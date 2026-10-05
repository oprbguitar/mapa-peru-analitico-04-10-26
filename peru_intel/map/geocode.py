"""Geocodificación para «ubica…»: primero territorio oficial (UBIGEO, offline); después Nominatim (OSM, en línea) con caché.

Nominatim exige User-Agent identificable y máximo 1 solicitud por segundo: se respeta con el rate limit del harvester.
"""
from __future__ import annotations

import json
import time
import unicodedata
import urllib.parse

from .. import config
from ..sources.harvester import http_get
from .ruc360_adapter import ADAPTER
from . import territory

CACHE = config.LIVE / "geocode_cache.json"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


def _cache() -> dict:
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def geocode(q: str) -> list[dict]:
    q = (q or "").strip()[:160]
    if len(q) < 2:
        return []
    out = []
    terr = ADAPTER.resolve_ubigeo(q) or []
    n = _norm(q)
    exact = [t for t in terr if _norm(t["nombre"]) == n or n.endswith(_norm(t["nombre"]))]
    for t in (exact or terr)[:5]:
        r = territory.lookup(t["ubigeo"])
        if r:
            out.append({"kind": "territorio", "name": t["nombre"], "detail": f"{t['nivel']} · {t['departamento']}", "ubigeo": t["ubigeo"],
                        "lat": r["lat"], "lon": r["lon"], "bbox": r.get("bbox"), "source": "UBIGEO INEI"})
    if exact:
        return out
    cache = _cache()
    key = n
    if key in cache and time.time() - cache[key]["t"] < 30 * 86400:
        return out + cache[key]["r"]
    try:
        url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
            {"q": q, "format": "jsonv2", "countrycodes": "pe", "limit": 5, "accept-language": "es"})
        res = json.loads(http_get(url, timeout=12, retries=1, min_interval=1.1))
    except Exception:  # noqa: BLE001 — sin red: solo resultados territoriales
        return out
    places = []
    for x in res:
        lat, lon = float(x["lat"]), float(x["lon"])
        d = territory.district_at(lat, lon)
        bb = x.get("boundingbox")
        places.append({"kind": "lugar", "name": x.get("name") or x["display_name"].split(",")[0], "detail": x["display_name"][:160],
                       "lat": lat, "lon": lon, "ubigeo": d.get("u") if d else None,
                       "bbox": [float(bb[2]), float(bb[0]), float(bb[3]), float(bb[1])] if bb else None, "source": "Nominatim · OSM"})
    cache[key] = {"t": time.time(), "r": places}
    try:
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(dict(list(cache.items())[-2000:]), ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return out + places

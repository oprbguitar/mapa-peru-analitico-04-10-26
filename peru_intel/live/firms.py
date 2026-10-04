"""FirmsProvider — focos de calor VIIRS (NASA FIRMS, MAP_KEY gratuita, BYOK).

Un foco de calor satelital NO es un incendio confirmado: es un píxel con anomalía térmica.
Se descargan 7 días; el mapa filtra 24 h / 48 h / 7 d por fecha de adquisición.
"""
from __future__ import annotations

import csv
import io
import urllib.parse
from datetime import datetime, timezone

from .. import config
from ..sources.harvester import http_get
from .worker import Worker

SOURCE = "VIIRS_SNPP_NRT"
AREA = "-81.6,-18.6,-68.4,0.2"  # w,s,e,n


def fetch() -> dict:
    key = config.setting("firms_key")
    if not key:
        raise RuntimeError("Falta la MAP_KEY de NASA FIRMS")
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{urllib.parse.quote(key)}/{SOURCE}/{AREA}/7"
    text = http_get(url, timeout=60, retries=2).decode("utf-8", "ignore")
    if text.lower().startswith("invalid"):
        raise RuntimeError(text.strip()[:120])
    items = []
    for r in csv.DictReader(io.StringIO(text)):
        try:
            t = datetime.strptime(f"{r['acq_date']} {int(r['acq_time']):04d}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
            items.append({"lat": float(r["latitude"]), "lon": float(r["longitude"]), "time": t.timestamp(),
                          "frp": float(r.get("frp") or 0), "confidence": r.get("confidence"),
                          "daynight": r.get("daynight"), "satellite": r.get("satellite")})
        except (KeyError, ValueError):
            continue
    return {"items": items, "product": SOURCE, "attribution": "NASA FIRMS (VIIRS S-NPP NRT)",
            "note": "Foco de calor satelital ≠ incendio confirmado."}


WORKER = Worker("fires", "nasa_firms", interval=3600, fetch=fetch, idle_after=3600, requires="firms_key")

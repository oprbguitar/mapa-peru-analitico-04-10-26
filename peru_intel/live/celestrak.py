"""Satélites: elementos orbitales de CelesTrak (GP/TLE). Las posiciones se calculan en el navegador con
satellite.js; aquí solo se guardan los elementos y su fecha (nunca posiciones cada 2 s en BD)."""
from __future__ import annotations

import json
import time

from .. import config
from ..sources.harvester import http_get

GROUPS = {
    "gps-ops": "GPS",
    "starlink": "Starlink",
    "resource": "Observación de la Tierra",
    "weather": "Meteorológicos",
    "stations": "Estaciones espaciales (ISS, Tiangong)",
    "geo": "Geoestacionarios",
}
TTL = 6 * 3600
LIMIT = {"starlink": 1500}


def _cache(group: str):
    return config.LIVE / "celestrak" / f"{group}.json"


def group(name: str) -> dict:
    if name not in GROUPS:
        raise ValueError(f"grupo desconocido: {name}")
    path = _cache(name)
    try:
        c = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - c["fetched"] < TTL:
            return c | {"stale": False}
    except (OSError, ValueError, KeyError):
        c = None
    try:
        txt = http_get(f"https://celestrak.org/NORAD/elements/gp.php?GROUP={name}&FORMAT=tle", timeout=25, retries=2).decode(
            "utf-8", "ignore")
    except Exception as e:  # noqa: BLE001 — sin red: lo último guardado
        if c:
            return c | {"stale": True, "error": str(e)}
        raise
    ln = [x.rstrip() for x in txt.splitlines() if x.strip()]
    sats = [{"name": ln[i].strip(), "l1": ln[i + 1], "l2": ln[i + 2]} for i in range(0, len(ln) - 2, 3)
            if ln[i + 1].startswith("1 ") and ln[i + 2].startswith("2 ")]
    out = {"group": name, "label": GROUPS[name], "fetched": time.time(), "satellites": sats[: LIMIT.get(name, 800)],
           "total": len(sats), "attribution": "CelesTrak (NORAD GP)"}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out), encoding="utf-8")
    return out | {"stale": False}

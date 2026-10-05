"""Rejilla meteorológica del Perú para la animación del clima (lluvia, calor, nubes, viento).

Open-Meteo (modelo) en una rejilla de 1,5° (~165 km) sobre el Perú: condiciones ACTUALES por celda. La interfaz anima
cada fenómeno donde el modelo lo indica; el usuario elige qué fenómeno ver (o «automático» = todos). Es un modelo,
no una observación: se declara como «proyección».
"""
from __future__ import annotations

import json
import time

from ..map import territory
from ..sources.harvester import http_get
from ..live.worker import Worker

LATS = [round(-18.0 + 1.5 * i, 2) for i in range(13)]   # -18 … 0
LONS = [round(-81.0 + 1.5 * j, 2) for j in range(9)]    # -81 … -69
VARS = "temperature_2m,apparent_temperature,precipitation,rain,showers,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code,is_day"


def classify(c: dict) -> list[str]:
    """Fenómenos visibles en la celda (reglas fijas y documentadas)."""
    out = []
    code = c.get("weather_code") or 0
    precip = c.get("precip_mm") or 0
    if code >= 95:
        out.append("tormenta")
    if precip >= 0.1 or 51 <= code <= 67 or 80 <= code <= 82:
        out.append("lluvia")
    if 71 <= code <= 77 or 85 <= code <= 86:
        out.append("nieve")
    if code in (45, 48):
        out.append("niebla")
    if (c.get("temp_c") or 0) >= 28:
        out.append("calor")
    if (c.get("temp_c") if c.get("temp_c") is not None else 99) <= 2:
        out.append("helada")
    if (c.get("cloud_pct") or 0) >= 70:
        out.append("nubes")
    if (c.get("wind_kmh") or 0) >= 30:
        out.append("viento")
    if not out and (c.get("cloud_pct") or 0) < 30 and c.get("is_day"):
        out.append("despejado")
    return out


def fetch() -> dict:
    pts = [(la, lo) for la in LATS for lo in LONS if territory.district_at(la, lo) or (la > -5 and lo < -79)]
    if not pts:
        pts = [(la, lo) for la in LATS for lo in LONS]
    cells = []
    for k in range(0, len(pts), 60):
        chunk = pts[k:k + 60]
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={','.join(str(p[0]) for p in chunk)}"
               f"&longitude={','.join(str(p[1]) for p in chunk)}&current={VARS}&timezone=America%2FLima")
        res = json.loads(http_get(url, timeout=40, retries=2, min_interval=1.5))
        if isinstance(res, dict):
            res = [res]
        for (la, lo), r in zip(chunk, res):
            c = r.get("current") or {}
            cell = {"lat": la, "lon": lo, "temp_c": c.get("temperature_2m"), "feels_c": c.get("apparent_temperature"),
                    "precip_mm": c.get("precipitation"), "cloud_pct": c.get("cloud_cover"), "wind_kmh": c.get("wind_speed_10m"),
                    "wind_dir": c.get("wind_direction_10m"), "weather_code": c.get("weather_code"), "is_day": c.get("is_day"),
                    "time": c.get("time")}
            cell["fx"] = classify(cell)
            cells.append(cell)
    return {"cells": cells, "grid_deg": 1.5, "model": "Open-Meteo (best match)", "fetched": time.strftime("%Y-%m-%dT%H:%M:%S")}


GRID = Worker("wxgrid", "openmeteo", interval=3600, fetch=fetch, idle_after=3600)

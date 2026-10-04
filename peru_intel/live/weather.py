"""Clima: observación SENAMHI y modelos NOAA GFS / ECMWF IFS, siempre separados.

  OBSERVADO   SENAMHI — estaciones automáticas (requiere configurar la URL/archivo del dataset: `senamhi_csv_url`).
  MODELO      NOAA GFS     (vía Open-Meteo, sin clave)
  MODELO      ECMWF IFS    (vía Open-Meteo, sin clave)

Las tres cifras nunca se mezclan: cada punto lleva su procedencia. Los modelos se consultan en la
capital de cada departamento (punto interior del distrito capital según el paquete territorial).
"""
from __future__ import annotations

import csv
import io
import json

from .. import config
from ..map import territory
from ..map.names import DEPARTMENTS, norm
from ..sources.harvester import http_get
from .worker import Worker

CAPITALS = {"01": "010101", "02": "020101", "03": "030101", "04": "040101", "05": "050101", "06": "060101",
            "07": "070101", "08": "080101", "09": "090101", "10": "100101", "11": "110101", "12": "120101",
            "13": "130101", "14": "140101", "15": "150101", "16": "160101", "17": "170101", "18": "180101",
            "19": "190101", "20": "200101", "21": "210101", "22": "220101", "23": "230101", "24": "240101",
            "25": "250101"}
MODELS = {"gfs": ("gfs_seamless", "NOAA GFS", "modelo_gfs"), "ecmwf": ("ecmwf_ifs025", "ECMWF IFS", "modelo_ecmwf")}


def _points() -> list[dict]:
    pts = []
    for dep, ub in CAPITALS.items():
        r = territory.lookup(ub)
        if r:
            pts.append({"dep": dep, "departamento": DEPARTMENTS[dep], "lugar": r["nombre"], "lat": r["lat"], "lon": r["lon"]})
    return pts


def fetch_models() -> dict:
    pts = _points()
    if not pts:
        raise RuntimeError("Falta el paquete territorial (python -m peru_intel build-territory)")
    lat = ",".join(str(p["lat"]) for p in pts)
    lon = ",".join(str(p["lon"]) for p in pts)
    out = {}
    for key, (model, label, sid) in MODELS.items():
        url = ("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
               "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
               "&hourly=temperature_2m,precipitation&forecast_days=2&timezone=America%2FLima&models=" + model)
        res = json.loads(http_get(url, timeout=30, retries=2))
        res = res if isinstance(res, list) else [res]
        rows = []
        for p, r in zip(pts, res):
            cur = r.get("current", {})
            hourly = r.get("hourly", {})
            prec = [v for v in (hourly.get("precipitation") or [])[:24] if v is not None]
            rows.append(p | {"temp_c": cur.get("temperature_2m"), "rh_pct": cur.get("relative_humidity_2m"),
                             "precip_mm": cur.get("precipitation"), "wind_kmh": cur.get("wind_speed_10m"),
                             "precip_next24_mm": round(sum(prec), 1) if prec else None, "time": cur.get("time")})
        out[key] = {"model": label, "source_id": sid, "kind": "proyeccion", "via": "Open-Meteo (CC BY 4.0)", "items": rows}
    return {"models": out, "items": out["gfs"]["items"]}


def fetch_senamhi() -> dict:
    """Observaciones SENAMHI desde un CSV configurado (URL o ruta local).

    Columnas reconocidas (insensible a mayúsculas/tildes): estacion, fecha/hora, temperatura, humedad,
    precipitacion, latitud, longitud, altitud, departamento, provincia, distrito, ubigeo.
    """
    src = config.setting("senamhi_csv_url")
    if not src:
        raise RuntimeError("SENAMHI sin configurar: indica la URL o ruta del CSV de estaciones automáticas")
    raw = http_get(src, timeout=60) if src.startswith("http") else open(src, "rb").read()
    text = raw.decode("utf-8-sig", "ignore")
    reader = csv.DictReader(io.StringIO(text), delimiter=";" if text.count(";") > text.count(",") else ",")
    cols = {norm(c).lower(): c for c in reader.fieldnames or []}
    pick = lambda *names: next((cols[n] for n in names if n in cols), None)  # noqa: E731
    c_est, c_lat, c_lon = pick("estacion", "nombre estacion", "nom estacion"), pick("latitud", "lat"), pick("longitud", "lon")
    c_t, c_h, c_p = pick("temperatura", "temp", "temperatura c"), pick("humedad", "humedad relativa"), pick("precipitacion", "precip")
    c_f, c_ub = pick("fecha", "fecha hora", "fechahora"), pick("ubigeo")
    if not (c_est and c_lat and c_lon):
        raise ValueError(f"CSV SENAMHI sin columnas de estación/latitud/longitud: {list(cols)[:12]}")
    latest: dict[str, dict] = {}
    for r in reader:
        try:
            row = {"station": r[c_est], "lat": float(r[c_lat]), "lon": float(r[c_lon]),
                   "temp_c": float(r[c_t]) if c_t and r.get(c_t) not in (None, "") else None,
                   "rh_pct": float(r[c_h]) if c_h and r.get(c_h) not in (None, "") else None,
                   "precip_mm": float(r[c_p]) if c_p and r.get(c_p) not in (None, "") else None,
                   "time": r.get(c_f) if c_f else None, "ubigeo": r.get(c_ub) if c_ub else None}
        except (ValueError, KeyError):
            continue
        prev = latest.get(row["station"])
        if not prev or (row["time"] or "") >= (prev["time"] or ""):
            latest[row["station"]] = row
    return {"items": list(latest.values()), "kind": "oficial", "source": "SENAMHI"}


MODELS_WORKER = Worker("weather_models", "modelo_gfs", interval=3600, fetch=fetch_models, idle_after=3600)
SENAMHI_WORKER = Worker("weather_obs", "senamhi_estaciones", interval=3600, fetch=fetch_senamhi, idle_after=3600,
                        requires="senamhi_csv_url")

"""Rutas estratégicas: trazar A → B y comparar alternativas con criterios explícitos para decidir.

Ruteo: OSRM (servidor configurable `osrm_url`; por defecto el de demostración, en línea). Sin red, se dibuja la línea recta
y se declara («sin ruteo vial»). Para operar sin Internet: OSRM o Valhalla propio con el extracto OSM del Perú.

Para cada alternativa se calcula (todo CALCULADO y desglosado, sin puntaje opaco):
  distancia y duración (OSRM) · km por distritos foco de denuncias (Gi* 95 %) · emergencias viales MTC a ≤ 2 km ·
  emergencias INDECI de los distritos atravesados (12 meses) · sedes de apoyo a ≤ 1 km (comisarías, salud, bomberos) ·
  celdas con lluvia o tormenta según el modelo meteorológico.
La recomendación es la alternativa con menos «alertas» a igualdad aproximada de tiempo (±15 %), y se explica por qué.
"""
from __future__ import annotations

import json
import math
import urllib.parse

from .. import config
from ..map import geocode, territory
from ..sources import registry
from ..sources.harvester import http_get
from ..storage import warehouse
from . import context, patterns


def candidates(spec) -> list[dict]:
    if isinstance(spec, dict) and "lat" in spec:
        return [{"lat": float(spec["lat"]), "lon": float(spec["lon"]), "name": spec.get("name") or "punto"}]
    res = geocode.geocode(str(spec))
    if not res:
        raise ValueError(f"No encontré «{spec}».")
    return [{"lat": r["lat"], "lon": r["lon"], "name": f"{r['name']} ({r['detail']})"} for r in res[:6]]


def resolve_pair(a, b) -> tuple[dict, dict]:
    """Homónimos («Miraflores» hay varios): se elige el par de candidatos más cercano entre sí."""
    ca, cb = candidates(a), candidates(b)
    return min(((x, y) for x in ca for y in cb), key=lambda p: context.km(p[0]["lat"], p[0]["lon"], p[1]["lat"], p[1]["lon"]))


def _osrm(a: dict, b: dict) -> list[dict]:
    base = (config.setting("osrm_url") or "https://router.project-osrm.org").rstrip("/")
    url = f"{base}/route/v1/driving/{a['lon']},{a['lat']};{b['lon']},{b['lat']}?" + urllib.parse.urlencode(
        {"overview": "full", "geometries": "geojson", "alternatives": "true", "steps": "false"})
    d = json.loads(http_get(url, timeout=25, retries=1, min_interval=1.0))
    if d.get("code") != "Ok":
        raise RuntimeError(d.get("message") or d.get("code"))
    return [{"distance_km": round(r["distance"] / 1000, 1), "duration_min": round(r["duration"] / 60), "coords": r["geometry"]["coordinates"],
             "engine": "OSRM", "kind": "calculado"} for r in d["routes"][:3]]


def _densify(coords: list[list[float]], step_km: float = 1.0) -> list[tuple[float, float, float]]:
    """Remuestreo uniforme: un punto cada step_km exactos a lo largo de la línea → (lat, lon, km acumulado)."""
    out, acc, nxt = [], 0.0, 0.0
    for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
        seg = context.km(y0, x0, y1, x1)
        while seg > 0 and nxt <= acc + seg:
            t = (nxt - acc) / seg
            out.append((y0 + (y1 - y0) * t, x0 + (x1 - x0) * t, nxt))
            nxt += step_km
        acc += seg
    if coords:
        out.append((coords[-1][1], coords[-1][0], acc))
    return out


def analyze(route: dict, hot: dict[str, str]) -> dict:
    step = max(1.0, route["distance_km"] / 400)  # como máximo ~400 muestras
    pts = _densify(route["coords"], step)
    districts: dict[str, dict] = {}
    for lat, lon, _k in pts:
        d = territory.district_at(lat, lon)
        if d:
            e = districts.setdefault(d["u"], {"ubigeo": d["u"], "nombre": d["n"], "provincia": d.get("p"), "km": 0.0, "band": hot.get(d["u"])})
            e["km"] = round(e["km"] + step, 1)
    lats = [p[0] for p in pts]
    lons = [p[1] for p in pts]
    pad = 0.03
    vias = []
    if warehouse.has("mtc_vias"):
        cand = warehouse.query("""SELECT id, fecha, evento, ruta, tramo, estado, lat, lon FROM mtc_vias WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?""",
                               [min(lats) - pad, max(lats) + pad, min(lons) - pad, max(lons) + pad])
        for c in cand:
            dmin = min(context.km(c["lat"], c["lon"], la, lo) for la, lo, _ in pts[::3])
            if dmin <= 2:
                vias.append(c | {"km_from_route": round(dmin, 1), "fecha": str(c["fecha"]),
                                 "active": "INTERRUMP" in (c["estado"] or "").upper() or "RESTRING" in (c["estado"] or "").upper()})
    support = {"comisaria": 0, "salud": 0, "hospital": 0, "bomberos": 0}
    seen = set()
    for la, lo, _ in pts:
        for p in context.points_near(la, lo, 1.0, set(support)):
            key = (p["cat"], p["lat"], p["lon"])
            if p["cat"] in support and key not in seen:
                seen.add(key)
                support[p["cat"]] += 1
    indeci = 0
    if warehouse.has("indeci_emergencias") and districts:
        ids = list(districts)
        last = warehouse.query("SELECT max(fecha) f FROM indeci_emergencias")[0]["f"]
        indeci = warehouse.query(f"""SELECT count(*) n FROM indeci_emergencias WHERE ubigeo IN ({','.join('?' for _ in ids)})
                                     AND fecha >= CAST(? AS DATE) - INTERVAL 365 DAY""", [*ids, last])[0]["n"]
    rain = 0
    from ..live.worker import WORKERS
    g = WORKERS.get("wxgrid")
    if g and g.data:
        for c in g.data["cells"]:
            if any(f in c.get("fx", []) for f in ("lluvia", "tormenta")) and \
                    min(context.km(c["lat"], c["lon"], la, lo) for la, lo, _ in pts[::10]) <= 80:
                rain += 1
    hot_km = min(route["distance_km"], round(sum(d["km"] for d in districts.values() if (d["band"] or "").startswith("foco")), 1))
    alerts = []
    if hot_km:
        alerts.append(f"{hot_km} km por distritos foco de denuncias")
    if any(v["active"] for v in vias):
        alerts.append(f"{sum(v['active'] for v in vias)} emergencias viales activas a ≤ 2 km")
    if rain:
        alerts.append(f"lluvia o tormenta en {rain} celdas del trayecto (modelo)")
    return route | {"coords": route["coords"], "districts": sorted(districts.values(), key=lambda d: -d["km"]),
                    "vias": sorted(vias, key=lambda v: (not v["active"], v["km_from_route"]))[:10], "support_1km": support,
                    "indeci_12m": indeci, "rain_cells": rain, "hot_km": hot_km, "alerts": alerts}


def plan(origin, dest) -> dict:
    a, b = resolve_pair(origin, dest)
    online = True
    try:
        routes = _osrm(a, b)
    except Exception as e:  # noqa: BLE001 — sin red: línea recta declarada
        online = False
        dist = context.km(a["lat"], a["lon"], b["lat"], b["lon"])
        routes = [{"distance_km": round(dist, 1), "duration_min": None, "coords": [[a["lon"], a["lat"]], [b["lon"], b["lat"]]],
                   "engine": f"línea recta (sin ruteo vial: {type(e).__name__})", "kind": "estimacion"}]
    hz = patterns.hotspots(None, None, None)
    hot = {r["ubigeo"]: r["band"] for r in hz["rows"]}
    out = [analyze(r, hot) for r in routes]
    for i, r in enumerate(out):
        r["id"] = chr(65 + i)
    best = out[0]
    if len(out) > 1 and out[0]["duration_min"]:
        fast = min(r["duration_min"] for r in out)
        ok = [r for r in out if r["duration_min"] <= fast * 1.15]
        best = min(ok, key=lambda r: (len(r["alerts"]), r["hot_km"], -sum(r["support_1km"].values()), r["duration_min"]))
    why = (f"Ruta {best['id']}: " + ("; ".join(best["alerts"]) if best["alerts"] else "sin alertas en los criterios evaluados") +
           f"; {sum(best['support_1km'].values())} sedes de apoyo a ≤ 1 km.")
    return {"origin": a, "dest": b, "online": online, "routes": out, "recommended": best["id"], "why": why,
            "criteria": ["tiempo (±15 % del más rápido)", "menos alertas", "menos km en distritos foco", "más sedes de apoyo"],
            "caveat": "Comparación de criterios públicos y agregados; no es una evaluación de seguridad personal ni garantiza el estado actual de la vía.",
            "provenance": registry.provenance("osrm", "mininter_sidpol", "mtc_emergencias_viales", "indeci_sinpad", "renipress",
                                              "osm_instituciones", "openmeteo"), "kind": "calculado"}


_ = math

"""Eventos naturales — NASA EONET v3 (sin clave).

EONET cura eventos publicados por terceros (GDACS, Smithsonian GVP, InciWeb…): incendios forestales,
volcanes, inundaciones, tormentas. Se consulta el recuadro del Perú, últimos `WINDOW_DAYS` días, abiertos y
cerrados. El recuadro incluye zonas fronterizas de Ecuador, Colombia, Brasil, Bolivia y Chile: el título se
conserva tal como lo publica EONET y no se reasigna país ni territorio.

Cada evento conserva la fuente original que lo reportó (no es un dato oficial peruano) y la fecha de su
última geometría. Para polígonos (p. ej. áreas de inundación GDACS) se entrega además un punto
representativo calculado (promedio de vértices del anillo exterior) solo para ubicar el símbolo.
"""
from __future__ import annotations

import json
import urllib.parse
from datetime import datetime

from ..sources.harvester import http_get
from .worker import Worker

BBOX = (-84.0, 2.0, -66.5, -20.5)  # oeste, norte, este, sur (orden que pide EONET)
WINDOW_DAYS = 90
CATEGORIES = {"wildfires": "Incendio forestal", "volcanoes": "Volcán", "floods": "Inundación",
              "severeStorms": "Tormenta severa", "landslides": "Deslizamiento", "drought": "Sequía",
              "dustHaze": "Polvo y bruma", "snow": "Nieve", "tempExtremes": "Temperatura extrema",
              "seaLakeIce": "Hielo marino o lacustre", "earthquakes": "Sismo", "manmade": "Origen humano",
              "waterColor": "Color del agua"}
URL = "https://eonet.gsfc.nasa.gov/api/v3/events?" + urllib.parse.urlencode(
    {"status": "all", "days": WINDOW_DAYS, "bbox": ",".join(str(v) for v in BBOX)})


def _ts(value: str) -> float | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (AttributeError, ValueError):
        return None


def _anchor(geom: dict) -> tuple[float, float] | None:
    """Punto donde dibujar el símbolo: el propio punto o el promedio de vértices del anillo exterior."""
    c = geom.get("coordinates")
    try:
        if geom.get("type") == "Point":
            return float(c[0]), float(c[1])
        if geom.get("type") == "Polygon":
            ring = c[0]
            return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
    except (TypeError, IndexError, ValueError, ZeroDivisionError):
        return None
    return None


def normalize(payload: dict) -> list[dict]:
    w, n, e, s = BBOX
    out = []
    for ev in payload.get("events") or []:
        geoms = [g for g in ev.get("geometry") or [] if _ts(g.get("date")) is not None]
        if not geoms:
            continue
        last = max(geoms, key=lambda g: _ts(g["date"]))
        pt = _anchor(last)
        if not pt or not (w <= pt[0] <= e and s <= pt[1] <= n):
            continue
        cat = (ev.get("categories") or [{}])[0].get("id") or "otros"
        src = (ev.get("sources") or [{}])[0]
        out.append({
            "id": ev.get("id"), "title": ev.get("title"), "category": cat,
            "category_label": CATEGORIES.get(cat, cat), "lon": round(pt[0], 5), "lat": round(pt[1], 5),
            "geometry_type": last.get("type"), "anchor": "punto publicado" if last.get("type") == "Point" else "promedio de vértices (calculado)",
            "time": _ts(last["date"]), "date": last["date"], "observations": len(geoms),
            "closed": ev.get("closed"), "open": not ev.get("closed"),
            "magnitude": last.get("magnitudeValue"), "magnitude_unit": last.get("magnitudeUnit"),
            "reported_by": src.get("id"), "report_url": src.get("url"), "link": ev.get("link"),
        })
    return sorted(out, key=lambda x: -(x["time"] or 0))


def fetch() -> dict:
    items = normalize(json.loads(http_get(URL, timeout=30, retries=2)))
    return {"items": items, "window_days": WINDOW_DAYS, "bbox": BBOX, "query": URL,
            "attribution": "NASA EONET · fuentes originales indicadas en cada evento"}


WORKER = Worker("eonet", "nasa_eonet", interval=3600, fetch=fetch, idle_after=3600)

"""Aeropuertos, puertos y muelles, bases militares y navales, y mercados de abastos: ubicación aproximada (OpenStreetMap).

Sirven como **apoyos** del simulador de operativos conjuntos (de dónde sale un helicóptero, una lancha, un camión de
víveres o una unidad de las Fuerzas Armadas). No existe un dataset abierto oficial con coordenadas de todas estas
instalaciones; OpenStreetMap es cartografía colaborativa: la ubicación es APROXIMADA y puede faltar o sobrar alguna.
Se descartan puntos fuera del Perú (punto-en-polígono distrital INEI) y duplicados cercanos.

Salida: data/normalized/infraestructura.json
"""
from __future__ import annotations

import json
import re
import urllib.parse
from pathlib import Path

from .. import config
from ..map import territory
from ..sources import harvester, registry

OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = "(-18.4,-81.4,-0.03,-68.6)"
QUERY = f"""[out:json][timeout:240];
(
 nwr["aeroway"="aerodrome"]{BBOX};
 nwr["aeroway"="heliport"]{BBOX};
 nwr["industrial"="port"]{BBOX};
 nwr["landuse"="port"]{BBOX};
 nwr["harbour"="yes"]["name"]{BBOX};
 nwr["man_made"="pier"]["name"~"[Mm]uelle|[Pp]uerto|[Ee]mbarcadero"]{BBOX};
 nwr["military"~"base|naval_base|airfield|barracks"]{BBOX};
 nwr["landuse"="military"]["name"]{BBOX};
 nwr["amenity"="marketplace"]{BBOX};
);
out center tags;"""

CATEGORIES = {
    "aeropuerto": "Aeropuerto / aeródromo / helipuerto",
    "puerto": "Puerto, terminal o muelle",
    "base_militar": "Instalación del Ejército o la Fuerza Aérea",
    "base_naval": "Instalación de la Marina de Guerra",
    "mercado": "Mercado de abastos",
}
_NAVAL = re.compile(r"naval|marina de guerra|capitan[ií]a|guardacostas|dicapi|base nav", re.I)
_AIR_FORCE = re.compile(r"fap\b|fuerza a[eé]rea|grupo a[eé]reo|ala a[eé]rea", re.I)


def classify(tags: dict) -> str | None:
    name = (tags.get("name") or "").strip()
    mil = tags.get("military") or ""
    if mil or tags.get("landuse") == "military":
        if mil == "naval_base" or _NAVAL.search(name):
            return "base_naval"
        return "base_militar"
    if tags.get("aeroway") in ("aerodrome", "heliport"):
        if _AIR_FORCE.search(name):
            return "base_militar"
        return "aeropuerto"
    if tags.get("industrial") == "port" or tags.get("landuse") == "port" or tags.get("harbour") == "yes" or tags.get("man_made") == "pier":
        return "base_naval" if _NAVAL.search(name) else "puerto"
    if tags.get("amenity") == "marketplace":
        return "mercado"
    return None


DEFAULT_NAME = {"aeropuerto": "Aeródromo (sin nombre en OSM)", "puerto": "Muelle / puerto (sin nombre en OSM)",
                "base_militar": "Instalación militar (sin nombre en OSM)", "base_naval": "Instalación naval (sin nombre en OSM)",
                "mercado": "Mercado (sin nombre en OSM)"}


def normalize(elements: list[dict], locate=territory.district_at) -> list[dict]:
    out, seen = [], set()
    for e in elements:
        tags = e.get("tags") or {}
        cat = classify(tags)
        if not cat:
            continue
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None or lon is None:
            continue
        dist = locate(lat, lon)
        if not dist:
            continue
        key = (cat, round(lat, 3), round(lon, 3))
        if key in seen:
            continue
        seen.add(key)
        detail = " · ".join(x for x in (tags.get("iata") and f"IATA {tags['iata']}", tags.get("icao") and f"OACI {tags['icao']}",
                                        tags.get("operator")) if x) or None
        out.append({
            "id": f"{e['type'][0]}{e['id']}", "cat": cat, "name": tags.get("name") or DEFAULT_NAME[cat],
            "lat": round(lat, 6), "lon": round(lon, 6), "ubigeo": dist.get("u"), "distrito": dist.get("n"),
            "provincia": dist.get("p"), "departamento": dist.get("d"), "detail": detail,
        })
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    src = (folder / "infraestructura-osm.json") if folder else None
    if src and src.exists():
        snap = harvester.import_local("osm_infraestructura", src, "infraestructura-osm.json")
    elif download or not harvester.latest("osm_infraestructura", "infraestructura-osm.json"):
        url = OVERPASS + "?data=" + urllib.parse.quote(QUERY)
        snap = harvester.fetch("osm_infraestructura", url, "infraestructura-osm.json", timeout=300, retries=2, min_interval=5)
    else:
        p = harvester.latest("osm_infraestructura", "infraestructura-osm.json")
        snap = harvester.Snapshot("osm_infraestructura", p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False)
    elements = json.loads(snap.path.read_text(encoding="utf-8")).get("elements", [])
    items = normalize(elements)
    counts = {c: sum(1 for i in items if i["cat"] == c) for c in CATEGORIES}
    out = config.NORMALIZED / "infraestructura.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"categories": CATEGORIES, "counts": counts, "items": items}, ensure_ascii=False), encoding="utf-8")
    registry.record_snapshot("osm_infraestructura", snap, normalized_path="data/normalized/infraestructura.json",
                             transform="Overpass (aeroway, puertos/muelles, military, marketplace) → clasificación por etiquetas → "
                                       "punto-en-polígono distrital INEI; se descartan puntos fuera del Perú y duplicados a ~100 m.")
    return " · ".join(f"{n} {c}" for c, n in counts.items())

"""Comisarías, serenazgo, Ministerio Público y Poder Judicial: ubicaciones aproximadas (OpenStreetMap).

No existe un dataset abierto oficial con coordenadas de todas las comisarías, sedes de serenazgo, fiscalías y
juzgados del país. Se usa OpenStreetMap (Overpass API), que es cartografía colaborativa: la ubicación es
APROXIMADA, puede faltar una sede o haber una cerrada. La interfaz lo declara («en vivo de tercero · OSM»).

Cada punto se asigna a su distrito por punto-en-polígono (paquete territorial INEI) y se descartan los que caen
fuera del Perú (la consulta usa un rectángulo que incluye zonas de países vecinos).

Salida: data/normalized/instituciones.json
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
NAMES = "Serenazgo|SERENAZGO|Fiscal|FISCAL|Ministerio P|MINISTERIO P|Medicina Legal|Juzgado|JUZGADO|Poder Judicial|Corte Superior|Justicia"
QUERY = f"""[out:json][timeout:180];
(
 nwr["amenity"="police"]{BBOX};
 nwr["amenity"="courthouse"]{BBOX};
 nwr["office"]["name"~"{NAMES}"]{BBOX};
 nwr["amenity"]["name"~"Serenazgo|SERENAZGO|Fiscal|FISCAL|Ministerio P|Medicina Legal"]{BBOX};
 nwr["building"]["name"~"Serenazgo|SERENAZGO|Fiscal|Juzgado"]{BBOX};
);
out center tags;"""

CATEGORIES = {
    "comisaria": "Comisaría / dependencia PNP",
    "serenazgo": "Serenazgo municipal",
    "fiscalia": "Ministerio Público (fiscalía, medicina legal)",
    "judicial": "Poder Judicial (juzgado, corte)",
}
_NOT_PUBLIC = re.compile(r"escuela|colegio|i\.?e\.?\b|local fiscal|repuestos|s\.a\.|sac\b|tributari|aduan", re.I)


def classify(tags: dict) -> str | None:
    """Categoría institucional a partir de las etiquetas OSM (None = no es una sede pública de interés)."""
    name = (tags.get("name") or tags.get("official_name") or "").strip()
    low = name.lower()
    op = (tags.get("operator") or "").lower()
    if _NOT_PUBLIC.search(low):
        return None
    if "serenazgo" in low or "serenazgo" in op:
        return "serenazgo"
    if "fiscal" in low or "ministerio p" in low or "medicina legal" in low:
        return "fiscalia"
    if tags.get("amenity") == "courthouse" or re.search(r"juzgado|poder judicial|corte superior|m[oó]dulo b[aá]sico de justicia|juez de paz", low):
        return "judicial"
    if tags.get("amenity") == "police":
        return "serenazgo" if "municipal" in op else "comisaria"
    return None


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
        if not dist:  # fuera del Perú
            continue
        key = (cat, round(lat, 4), round(lon, 4))
        if key in seen:
            continue
        seen.add(key)
        addr = " ".join(x for x in (tags.get("addr:street"), tags.get("addr:housenumber")) if x)
        out.append({
            "id": f"{e['type'][0]}{e['id']}", "cat": cat,
            "name": tags.get("name") or {"comisaria": "Dependencia policial (sin nombre en OSM)", "serenazgo": "Serenazgo",
                                         "fiscalia": "Sede fiscal", "judicial": "Sede judicial"}[cat],
            "lat": round(lat, 6), "lon": round(lon, 6), "ubigeo": dist.get("u"),
            "distrito": dist.get("n"), "provincia": dist.get("p"), "departamento": dist.get("d"),
            "address": addr or tags.get("addr:full") or None, "phone": tags.get("phone") or tags.get("contact:phone") or None,
            "operator": tags.get("operator") or None,
        })
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    src = (folder / "instituciones-osm.json") if folder else None
    if src and src.exists():
        snap = harvester.import_local("osm_instituciones", src, "instituciones-osm.json")
    elif download or not harvester.latest("osm_instituciones", "instituciones-osm.json"):
        url = OVERPASS + "?data=" + urllib.parse.quote(QUERY)
        snap = harvester.fetch("osm_instituciones", url, "instituciones-osm.json", timeout=240, retries=2, min_interval=5)
    else:
        p = harvester.latest("osm_instituciones", "instituciones-osm.json")
        snap = harvester.Snapshot("osm_instituciones", p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False)
    elements = json.loads(snap.path.read_text(encoding="utf-8")).get("elements", [])
    items = normalize(elements)
    counts = {c: sum(1 for i in items if i["cat"] == c) for c in CATEGORIES}
    out = config.NORMALIZED / "instituciones.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"categories": CATEGORIES, "counts": counts, "items": items}, ensure_ascii=False), encoding="utf-8")
    registry.record_snapshot("osm_instituciones", snap, normalized_path="data/normalized/instituciones.json",
                             transform="Overpass (police, courthouse y nombres institucionales) → clasificación por etiquetas → "
                                       "punto-en-polígono distrital INEI; se descartan puntos fuera del Perú y duplicados.")
    return " · ".join(f"{n} {c}" for c, n in counts.items())

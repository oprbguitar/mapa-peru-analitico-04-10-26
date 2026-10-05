"""Servicios del territorio: salud (RENIPRESS · SUSALUD, oficial) y educación/bomberos (OpenStreetMap, aproximado).

RENIPRESS   CSV mensual de datos abiertos: cada IPRESS con categoría, institución, UBIGEO, estado y coordenadas (NORTE=lat,
            ESTE=lon). Solo establecimientos ACTIVOS con coordenadas válidas.
OSM         colegios (amenity=school), universidades/institutos (university, college) y bomberos (fire_station). El padrón
            oficial de MINEDU (ESCALE) y SUNEDU pueden reemplazar a OSM cuando se integren: OSM se marca como aproximado.

Salida: data/parquet/servicios.parquet (cat, nombre, lat, lon, ubigeo, detalle, fuente, kind)
"""
from __future__ import annotations

import csv
import io
import json
import urllib.parse
from pathlib import Path

from ..map import territory
from ..sources import harvester, registry
from ..storage import warehouse

RENIPRESS_URL = "https://www.datosabiertos.gob.pe/sites/default/files/RENIPRESS_30-09-2026.csv"
OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = "(-18.4,-81.4,-0.03,-68.6)"
QUERY = f"""[out:json][timeout:240];
(
 nwr["amenity"="school"]{BBOX};
 nwr["amenity"="university"]{BBOX};
 nwr["amenity"="college"]{BBOX};
 nwr["amenity"="fire_station"]{BBOX};
);
out center tags;"""
OSM_CAT = {"school": "colegio", "university": "universidad", "college": "instituto", "fire_station": "bomberos"}


def portal_fetch(source_id: str, url: str, fname: str):
    """datosabiertos.gob.pe rechaza clientes automáticos (HTTP 418). No se suplanta un navegador: se pide descarga manual."""
    import urllib.error
    try:
        return harvester.fetch(source_id, url, fname, timeout=300, headers={"Referer": "https://www.datosabiertos.gob.pe/"})
    except urllib.error.HTTPError as e:
        if e.code in (403, 418):
            raise RuntimeError(f"El portal bloquea descargas automáticas (HTTP {e.code}). Descarga {url} con el navegador, "
                               f"guárdalo como «{fname}» en una carpeta y ejecuta: python -m peru_intel ingest <fuente> --dir <carpeta>")
        raise


def renipress_rows(text: str) -> list[dict]:
    out = []
    for r in csv.DictReader(io.StringIO(text), delimiter=";"):
        if (r.get("ESTADO") or "").upper() != "ACTIVO":
            continue
        try:
            lat, lon = float(r["NORTE"]), float(r["ESTE"])
        except (TypeError, ValueError, KeyError):
            continue
        if not (-18.6 <= lat <= 0.2 and -81.6 <= lon <= -68.4):
            continue
        cat = (r.get("CATEGORIA") or "").strip()
        hosp = cat.startswith(("II", "III")) or "HOSPITAL" in (r.get("CLASIFICACION") or "")
        out.append({"cat": "hospital" if hosp else "salud", "nombre": (r.get("NOMBRE") or "").strip().title(), "lat": round(lat, 6),
                    "lon": round(lon, 6), "ubigeo": (r.get("UBIGEO") or "")[:6] or None,
                    "detalle": f"{cat or 's/c'} · {(r.get('CLASIFICACION') or '').title()} · {(r.get('INSTITUCION') or '').title()}",
                    "telefono": r.get("TELEFONO") or None, "fuente": "RENIPRESS", "kind": "oficial"})
    return out


def osm_rows(elements: list[dict]) -> list[dict]:
    out = []
    for e in elements:
        tags = e.get("tags") or {}
        cat = OSM_CAT.get(tags.get("amenity"))
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lon = e.get("lon") or (e.get("center") or {}).get("lon")
        if not cat or lat is None:
            continue
        d = territory.district_at(lat, lon)
        if not d:
            continue
        name = tags.get("name") or {"colegio": "Institución educativa", "universidad": "Universidad", "instituto": "Instituto",
                                    "bomberos": "Compañía de bomberos"}[cat]
        out.append({"cat": cat, "nombre": name[:120], "lat": round(lat, 6), "lon": round(lon, 6), "ubigeo": d.get("u"),
                    "detalle": " · ".join(x for x in (tags.get("operator"), tags.get("isced:level"), tags.get("addr:street")) if x) or None,
                    "telefono": tags.get("phone"), "fuente": "OpenStreetMap", "kind": "vivo_tercero"})
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    rows, msgs = [], []
    fname = "renipress.csv"
    local = folder / fname if folder else None
    if local and local.exists():
        snap = harvester.import_local("renipress", local, fname)
    elif download or not harvester.latest("renipress", fname):
        snap = portal_fetch("renipress", RENIPRESS_URL, fname)
    else:
        p = harvester.latest("renipress", fname)
        snap = harvester.Snapshot("renipress", p, harvester.sha256_file(p), p.stat().st_size, RENIPRESS_URL, True, None, False)
    r1 = renipress_rows(snap.path.read_text(encoding="utf-8-sig", errors="replace"))
    registry.record_snapshot("renipress", snap, normalized_path="data/parquet/servicios.parquet",
                             transform="Solo IPRESS ACTIVAS con coordenadas válidas; categoría II/III o «hospital» → hospital.")
    rows += r1
    msgs.append(f"{len(r1)} establecimientos de salud")
    fname = "servicios-osm.json"
    try:
        if download or not harvester.latest("osm_servicios", fname):
            snap2 = harvester.fetch("osm_servicios", OVERPASS + "?data=" + urllib.parse.quote(QUERY), fname, timeout=300, retries=2, min_interval=5)
        else:
            p = harvester.latest("osm_servicios", fname)
            snap2 = harvester.Snapshot("osm_servicios", p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False)
        r2 = osm_rows(json.loads(snap2.path.read_text(encoding="utf-8")).get("elements", []))
        registry.record_snapshot("osm_servicios", snap2, normalized_path="data/parquet/servicios.parquet",
                                 transform="Overpass (school, university, college, fire_station) → punto-en-polígono distrital.")
        rows += r2
        for c in ("colegio", "universidad", "instituto", "bomberos"):
            msgs.append(f"{sum(1 for r in r2 if r['cat'] == c)} {c}")
    except Exception as e:  # noqa: BLE001 — Overpass caído no anula RENIPRESS
        msgs.append(f"OSM: {e}")
    warehouse.write_rows("servicios", rows)
    return " · ".join(msgs)

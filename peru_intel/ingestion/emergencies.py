"""Emergencias y daños (INDECI · SINPAD) y emergencias en la Red Vial Nacional (MTC).

INDECI   GeoSINPAD ArcGIS REST (MapServer EMERGENCIAS_SINPAD, capa 0): cada emergencia registrada con fecha, UBIGEO,
         peligro, afectados, damnificados, fallecidos, viviendas y vías. Se descargan páginas de 2 000 desde 2015.
MTC      CSV de datos abiertos «Emergencias en la Red Vial Nacional» (MTC-COES): ruta, tramo, tipo de peligro,
         estado de transitabilidad y coordenadas.

Salidas: data/parquet/indeci_emergencias.parquet · data/parquet/mtc_vias.parquet
"""
from __future__ import annotations

import csv
import io
import json
import time
import urllib.parse
from pathlib import Path

from .. import config
from ..sources import harvester, registry
from ..storage import warehouse

INDECI = "https://geosinpad.indeci.gob.pe/indeci/rest/services/Emergencias/EMERGENCIAS_SINPAD/MapServer/0/query"
FIELDS = ("IDE_SINPAD,FECHA,ANHO,COD_UBIGEO,DEPARTAMENTO,PROVINCIA,DISTRITO,FENOMENO,DES_GRUPAL_FENOMENO,SAFECTA,SDAMNI,SFALLE,"
          "SLESI,SDESA,SDESTRUVIVI,SAFECTAVIVI,SCARRE_AFECTA,SCARRE_DESTRU,SPUENTE_AFECTA,SPUENTE_DESTRU")
MTC_URL = ("https://www.datosabiertos.gob.pe/sites/default/files/"
           "3.%20Reporte%20Emergencias%2001.01%20al%2020.08.2026%20COES-MTC.csv")


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def indeci_rows(features: list[dict]) -> list[dict]:
    out = []
    for f in features:
        a, g = f.get("attributes") or {}, f.get("geometry") or {}
        if not a.get("FECHA"):
            continue
        out.append({
            "id": int(a["IDE_SINPAD"]) if a.get("IDE_SINPAD") else None,
            "fecha": time.strftime("%Y-%m-%d", time.gmtime(a["FECHA"] / 1000)),
            "anio": int(time.gmtime(a["FECHA"] / 1000).tm_year), "mes": int(time.gmtime(a["FECHA"] / 1000).tm_mon),
            "ubigeo": str(a.get("COD_UBIGEO") or "")[:6] or None, "departamento": a.get("DEPARTAMENTO"),
            "provincia": a.get("PROVINCIA"), "distrito": a.get("DISTRITO"),
            "fenomeno": (a.get("FENOMENO") or "").strip().upper() or None, "grupo": (a.get("DES_GRUPAL_FENOMENO") or "").strip() or None,
            "afectados": _num(a.get("SAFECTA")), "damnificados": _num(a.get("SDAMNI")), "fallecidos": _num(a.get("SFALLE")),
            "lesionados": _num(a.get("SLESI")), "desaparecidos": _num(a.get("SDESA")),
            "viv_destruidas": _num(a.get("SDESTRUVIVI")), "viv_afectadas": _num(a.get("SAFECTAVIVI")),
            "carretera_km_afectada": _num(a.get("SCARRE_AFECTA")) + _num(a.get("SCARRE_DESTRU")),
            "puentes": _num(a.get("SPUENTE_AFECTA")) + _num(a.get("SPUENTE_DESTRU")),
            "lat": round(g["y"], 6) if g.get("y") is not None else None, "lon": round(g["x"], 6) if g.get("x") is not None else None,
        })
    return out


def ingest_indeci(download: bool = False, folder: Path | None = None, since: int = 2015) -> str:
    fname = "emergencias_sinpad.json"
    if not download and harvester.latest("indeci_sinpad", fname):
        p = harvester.latest("indeci_sinpad", fname)
        snap = harvester.Snapshot("indeci_sinpad", p, harvester.sha256_file(p), p.stat().st_size, INDECI, True, None, False)
    else:
        feats, offset = [], 0
        while True:
            q = {"where": f"ANHO >= '{since}'", "outFields": FIELDS, "outSR": "4326", "f": "json", "orderByFields": "OBJECTID",
                 "resultOffset": offset, "resultRecordCount": 2000}
            d = json.loads(harvester.http_get(INDECI + "?" + urllib.parse.urlencode(q), timeout=120, retries=3, min_interval=0.5))
            batch = d.get("features") or []
            feats += batch
            if not batch or not d.get("exceededTransferLimit"):
                break
            offset += len(batch)
        tmp = config.RAW / ".indeci.part"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps({"features": feats}), encoding="utf-8")
        snap = harvester._store("indeci_sinpad", tmp, fname, INDECI)
    rows = indeci_rows(json.loads(snap.path.read_text(encoding="utf-8"))["features"])
    out = warehouse.write_rows("indeci_emergencias", rows)
    registry.record_snapshot("indeci_sinpad", snap, normalized_path=str(out), coverage_start=min(r["fecha"] for r in rows)[:7],
                             coverage_end=max(r["fecha"] for r in rows)[:7],
                             transform="ArcGIS REST paginado (ANHO ≥ 2015) → fecha local, UBIGEO, peligro, daños humanos, viviendas y vías.")
    return f"{len(rows)} emergencias ({min(r['anio'] for r in rows)}–{max(r['anio'] for r in rows)})"


def mtc_rows(text: str) -> list[dict]:
    rows = []
    for r in csv.DictReader(io.StringIO(text), delimiter=";"):
        try:
            lat, lon = float(r["LATITUD"]), float(r["LONGITUD"])
        except (TypeError, ValueError, KeyError):
            continue
        d, m, y = (r.get("FECHA_OCURRENCIA") or "01/01/1900").split("/")
        cierre = r.get("FECHA_CIERRE") or ""
        rows.append({"id": r.get("CODIGO_REPORTE"), "fecha": f"{y}-{m}-{d}", "clase": r.get("CLASE_FENOMENO"), "fenomeno": r.get("FENOMENO"),
                     "evento": r.get("EVENTO"), "departamento": r.get("DEPARTEMENTO"), "provincia": r.get("PROVINCIA"),
                     "distrito": r.get("DISTRITO"), "ruta": r.get("RED_AFECTADA"), "tramo": r.get("TRAMO_AFECADO"),
                     "sector": (r.get("SECTOR_AFECTADO") or "").strip(" -"), "hechos": (r.get("HECHOS") or "")[:400],
                     "estado_inicial": r.get("ESTADO_INICIAL"), "estado": r.get("ESTADO_ACTUAL"),
                     "cierre": "-".join(reversed(cierre.split("/"))) if cierre else None, "lat": round(lat, 6), "lon": round(lon, 6),
                     "corte": r.get("FECHA_CORTE")})
    return rows


def ingest_mtc(download: bool = False, folder: Path | None = None) -> str:
    fname = "emergencias_rvn_mtc.csv"
    local = folder / fname if folder else None
    if local and local.exists():
        snap = harvester.import_local("mtc_emergencias_viales", local, fname)
    elif download or not harvester.latest("mtc_emergencias_viales", fname):
        from .services import portal_fetch
        snap = portal_fetch("mtc_emergencias_viales", MTC_URL, fname)
    else:
        p = harvester.latest("mtc_emergencias_viales", fname)
        snap = harvester.Snapshot("mtc_emergencias_viales", p, harvester.sha256_file(p), p.stat().st_size, MTC_URL, True, None, False)
    rows = mtc_rows(snap.path.read_bytes().decode("latin-1"))
    out = warehouse.write_rows("mtc_vias", rows)
    registry.record_snapshot("mtc_emergencias_viales", snap, normalized_path=str(out),
                             coverage_start=min(r["fecha"] for r in rows)[:7], coverage_end=max(r["fecha"] for r in rows)[:7],
                             transform="CSV latin-1 ; → fechas ISO, estado de transitabilidad y coordenadas.")
    return f"{len(rows)} emergencias viales"


def ingest(download: bool = False, folder: Path | None = None) -> str:
    msgs = []
    for name, fn in (("INDECI", ingest_indeci), ("MTC", ingest_mtc)):
        try:
            msgs.append(f"{name}: {fn(download, folder)}")
        except Exception as e:  # noqa: BLE001 — una fuente caída no anula la otra
            msgs.append(f"{name}: ERROR {e}")
    return " · ".join(msgs)

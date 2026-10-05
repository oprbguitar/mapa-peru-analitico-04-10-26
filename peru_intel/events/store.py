"""Event Store: un esquema común para todo lo que «ocurre» en el territorio.

    event_id · event_type · subtype · source_id · ts_start · ts_end · lat · lon · ubigeo · h3_r7 · value · unit · severity · kind

Fuentes actuales:  SIDPOL (denuncias mensuales por distrito y modalidad, sin coordenadas: lat/lon nulos)
                   INDECI (emergencias puntuales) · MTC (emergencias viales puntuales)
Cada fila conserva su `source_id`: el motor de patrones nunca mezcla un dato sin saber de dónde viene.
H3 (resolución 7, ~5 km²) es la visión analítica; UBIGEO, la administrativa.
"""
from __future__ import annotations

import json
from pathlib import Path

import duckdb

from .. import config
from ..sources import registry
from ..storage import warehouse

try:
    import h3
except ImportError:  # sin la librería: el store funciona, sin celda H3
    h3 = None

H3_RES = 7


def cell(lat: float | None, lon: float | None, res: int = H3_RES) -> str | None:
    if h3 is None or lat is None or lon is None:
        return None
    try:
        return h3.latlng_to_cell(lat, lon, res)
    except Exception:  # noqa: BLE001
        return None


def _severity_indeci(r: dict) -> float:
    return round(r["fallecidos"] * 10 + r["desaparecidos"] * 8 + r["lesionados"] * 2 + r["damnificados"] * 0.5
                 + r["viv_destruidas"] * 1 + r["afectados"] * 0.05, 2)


def build(download: bool = False, folder: Path | None = None) -> str:
    pts = []
    if warehouse.has("indeci_emergencias"):
        for r in warehouse.query("SELECT * FROM indeci_emergencias WHERE lat IS NOT NULL"):
            pts.append({"event_id": f"indeci:{r['id']}", "event_type": "emergencia", "subtype": r["fenomeno"], "source_id": "indeci_sinpad",
                        "ts_start": r["fecha"], "ts_end": None, "lat": r["lat"], "lon": r["lon"], "ubigeo": r["ubigeo"],
                        "h3_r7": cell(r["lat"], r["lon"]), "value": r["afectados"], "unit": "personas afectadas",
                        "severity": _severity_indeci(r), "kind": "oficial"})
    if warehouse.has("mtc_vias"):
        for r in warehouse.query("SELECT * FROM mtc_vias"):
            from ..map import territory
            d = territory.district_at(r["lat"], r["lon"])
            interrupted = "INTERRUMP" in (r["estado"] or "").upper()
            pts.append({"event_id": f"mtc:{r['id']}", "event_type": "via_afectada", "subtype": r["evento"], "source_id": "mtc_emergencias_viales",
                        "ts_start": r["fecha"], "ts_end": r["cierre"], "lat": r["lat"], "lon": r["lon"], "ubigeo": d.get("u") if d else None,
                        "h3_r7": cell(r["lat"], r["lon"]), "value": 1.0, "unit": "emergencia vial", "severity": 5.0 if interrupted else 2.0,
                        "kind": "oficial"})
    tmp = config.NORMALIZED / "_eventos_puntos.jsonl"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp, "w", encoding="utf-8") as f:
        for r in pts:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
    con = duckdb.connect(":memory:")
    src = str(tmp).replace("\\", "/").replace("'", "''")
    sid = str(warehouse.parquet_path("sidpol_denuncias")).replace("\\", "/").replace("'", "''")
    parts = []
    if pts:
        parts.append(f"""SELECT event_id, event_type, subtype, source_id, CAST(ts_start AS DATE) ts_start, CAST(ts_end AS DATE) ts_end,
                         CAST(lat AS DOUBLE) lat, CAST(lon AS DOUBLE) lon, ubigeo, h3_r7, CAST("value" AS DOUBLE) AS "value", unit,
                         CAST(severity AS DOUBLE) severity, kind
                         FROM read_json_auto('{src}', format='newline_delimited', sample_size=-1)""")
    if warehouse.has("sidpol_denuncias"):
        parts.append(f"""SELECT 'sidpol:' || ubigeo || ':' || anio || '-' || mes || ':' || modalidad, 'denuncia', modalidad, 'mininter_sidpol',
                         make_date(anio, mes, 1), last_day(make_date(anio, mes, 1)), NULL::DOUBLE, NULL::DOUBLE, ubigeo, NULL,
                         CAST(cantidad AS DOUBLE), 'denuncias', NULL::DOUBLE, 'oficial'
                         FROM read_parquet('{sid}')""")
    if not parts:
        return "sin fuentes para el Event Store"
    out = warehouse.write_parquet("eventos", " UNION ALL ".join(parts), con)
    con.close()
    tmp.unlink(missing_ok=True)
    n = warehouse.query("SELECT event_type, count(*) n FROM eventos GROUP BY 1 ORDER BY 1")
    registry.record("eventos_unificados", status="ok", normalized_path=str(out.relative_to(config.DATA)).replace("\\", "/"),
                    transform="Unión SIDPOL + INDECI + MTC con esquema común y celda H3 r7 (h3 " + (h3.__version__ if h3 else "no instalado") + ").")
    return " · ".join(f"{r['n']} {r['event_type']}" for r in n)


def monthly(event_type: str, ubigeo_prefix: str | None = None, subtype: str | None = None) -> list[dict]:
    """Serie mensual (conteo o suma) de un tipo de evento para un territorio (prefijo UBIGEO)."""
    if not warehouse.has("eventos"):
        return []
    agg = 'sum("value")' if event_type == "denuncia" else "count(*)"
    where, params = ["event_type = ?"], [event_type]
    if ubigeo_prefix:
        where.append("starts_with(ubigeo, ?)")
        params.append(ubigeo_prefix)
    if subtype:
        where.append("subtype = ?")
        params.append(subtype)
    return warehouse.query(f"""SELECT year(ts_start) anio, month(ts_start) mes, {agg} v FROM eventos WHERE {' AND '.join(where)}
                               GROUP BY 1, 2 ORDER BY 1, 2""", params)

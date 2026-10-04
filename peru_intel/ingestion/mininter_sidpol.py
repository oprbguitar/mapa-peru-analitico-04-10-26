"""MininterSidpolAdapter — Denuncias policiales registradas a nivel nacional (SIDPOL).

Original: CSV mensual por UBIGEO del hecho y modalidad (2018-01 → último mes publicado).
Normalizado: data/parquet/sidpol_denuncias.parquet

    anio, mes, ubigeo (6), dep (2), prov (4), modalidad, cantidad,
    dpto_fuente, prov_fuente, dist_fuente

No se reparte ninguna cifra entre territorios: cada fila conserva el UBIGEO publicado.
"""
from __future__ import annotations

from pathlib import Path

import duckdb

from .. import config
from ..sources import harvester, registry
from ..sources.catalog import BY_ID
from ..storage import warehouse
from . import sql_path

SOURCE = "mininter_sidpol"
FILENAME = "denuncias-policiales.csv"
LOCAL_NAMES = ("denuncias-policiales-2018-2026-jul.csv", "DATASET_Denuncias_Policiales_Ene 2018 a Julio 2026.csv")


def _local(folder: Path | None) -> Path | None:
    dirs = [folder] if folder else []
    oce = config.oce_dir()
    if oce:
        dirs.append(oce / "data" / "fuentes" / "sidpol")
    for d in dirs:
        for n in LOCAL_NAMES:
            if d and (d / n).exists():
                return d / n
        if d and d.is_dir():
            found = sorted(d.glob("*enuncias*olicial*.csv"))
            if found:
                return found[-1]
    return None


def ingest(download: bool = False, folder: Path | None = None) -> str:
    if download:
        snap = harvester.fetch(SOURCE, BY_ID[SOURCE]["download"], FILENAME, timeout=300,
                               headers={"Referer": "https://www.datosabiertos.gob.pe/"})
    else:
        src = _local(folder) or harvester.latest(SOURCE, FILENAME)
        if not src:
            raise FileNotFoundError("Sin archivo SIDPOL local. Usa --download o --dir <carpeta>.")
        snap = harvester.import_local(SOURCE, src, FILENAME) if config.RAW not in src.parents else \
            harvester.Snapshot(SOURCE, src, harvester.sha256_file(src), src.stat().st_size, None, True, None, False)
    con = duckdb.connect()
    con.execute(f"CREATE TABLE s AS SELECT * FROM read_csv('{sql_path(snap.path)}', header=true, all_varchar=true)")
    cols = {c.lower(): c for c in (r[0] for r in con.execute("DESCRIBE s").fetchall())}
    need = ["anio", "mes", "ubigeo_hecho", "p_modalidades", "cantidad"]
    missing = [c for c in need if c not in cols]
    if missing:
        raise ValueError(f"SIDPOL cambió de esquema: faltan {missing}. Revisar diccionario de datos.")
    c = lambda k: f'"{cols[k]}"'  # noqa: E731
    rel = f"""
        SELECT CAST({c('anio')} AS INTEGER) AS anio,
               CAST({c('mes')} AS INTEGER) AS mes,
               lpad(trim({c('ubigeo_hecho')}), 6, '0') AS ubigeo,
               substr(lpad(trim({c('ubigeo_hecho')}), 6, '0'), 1, 2) AS dep,
               substr(lpad(trim({c('ubigeo_hecho')}), 6, '0'), 1, 4) AS prov,
               trim({c('p_modalidades')}) AS modalidad,
               CAST({c('cantidad')} AS INTEGER) AS cantidad,
               {c('dpto_hecho_new') if 'dpto_hecho_new' in cols else 'NULL'} AS dpto_fuente,
               {c('prov_hecho') if 'prov_hecho' in cols else 'NULL'} AS prov_fuente,
               {c('dist_hecho') if 'dist_hecho' in cols else 'NULL'} AS dist_fuente
        FROM s WHERE {c('cantidad')} IS NOT NULL
    """
    out = warehouse.write_parquet("sidpol_denuncias", rel, con)
    stats = con.execute(f"SELECT min(anio), max(anio), count(*), sum(cantidad) FROM ({rel})").fetchone()
    last_month = con.execute(f"SELECT max(mes) FROM ({rel}) WHERE anio = {stats[1]}").fetchone()[0]
    registry.record_snapshot(SOURCE, snap,
                    normalized_path="data/parquet/sidpol_denuncias.parquet",
                    coverage_start=f"{stats[0]}-01", coverage_end=f"{stats[1]}-{last_month:02d}",
                    transform="UBIGEO completado a 6 dígitos; departamento y provincia = prefijos del UBIGEO del hecho. "
                              "Sin imputación ni reparto entre territorios.")
    return f"{stats[2]:,} filas · {stats[3]:,} denuncias · {stats[0]}–{stats[1]}-{last_month:02d} → {out.name}"

"""DuckDB sobre Parquet: consultas analíticas locales sin levantar un servidor de base de datos.

Cada tabla analítica es un archivo `data/parquet/<tabla>.parquet`. DuckDB los expone como
vistas al abrir la conexión, así que reemplazar un Parquet (escritura atómica) basta para
publicar una nueva versión normalizada.
"""
from __future__ import annotations

import os
import threading
from pathlib import Path

import duckdb

from .. import config

_LOCK = threading.Lock()
_CON: duckdb.DuckDBPyConnection | None = None
_SEEN: dict[str, float] = {}


def parquet_path(table: str) -> Path:
    return config.PARQUET / f"{table}.parquet"


def has(table: str) -> bool:
    return parquet_path(table).exists()


def _refresh_views(con: duckdb.DuckDBPyConnection) -> None:
    config.PARQUET.mkdir(parents=True, exist_ok=True)
    for p in config.PARQUET.glob("*.parquet"):
        mtime = p.stat().st_mtime
        if _SEEN.get(p.stem) == mtime:
            continue
        path = str(p).replace("\\", "/").replace("'", "''")
        con.execute(f'CREATE OR REPLACE VIEW "{p.stem}" AS SELECT * FROM read_parquet(\'{path}\')')
        _SEEN[p.stem] = mtime


def query(sql: str, params: list | tuple | None = None) -> list[dict]:
    """Ejecuta SQL de solo lectura sobre las vistas Parquet y devuelve filas como dicts."""
    global _CON
    with _LOCK:
        if _CON is None:
            _CON = duckdb.connect(":memory:")
        _refresh_views(_CON)
        cur = _CON.execute(sql, params or [])
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def write_parquet(table: str, relation_sql: str, con: duckdb.DuckDBPyConnection) -> Path:
    """Materializa `relation_sql` (ejecutado en `con`) como Parquet con reemplazo atómico."""
    out = parquet_path(table)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(".parquet.tmp")
    tmp_s = str(tmp).replace("\\", "/").replace("'", "''")
    con.execute(f"COPY ({relation_sql}) TO '{tmp_s}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    os.replace(tmp, out)
    _SEEN.pop(table, None)
    return out


def write_rows(table: str, rows: list[dict]) -> Path:
    """Escribe una lista de dicts (mismas claves) como Parquet, vía un JSON temporal leído por DuckDB."""
    import json
    if not rows:
        raise ValueError(f"{table}: sin filas para escribir")
    tmp_json = config.NORMALIZED / f"_{table}.jsonl"
    tmp_json.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp_json, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
    con = duckdb.connect(":memory:")
    src = str(tmp_json).replace("\\", "/").replace("'", "''")
    try:
        out = write_parquet(table, f"SELECT * FROM read_json_auto('{src}', format='newline_delimited', sample_size=-1)", con)
    finally:
        con.close()
        tmp_json.unlink(missing_ok=True)
    return out

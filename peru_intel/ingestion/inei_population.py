"""IneiPopulationAdapter — denominadores de población para calcular tasas.

Fuente por defecto: columna POBLACION_PROYECTADA del dataset de indicadores MININTER (proyecciones INEI
por año y UBIGEO, regional/provincial/distrital). Es una ESTIMACIÓN, no un conteo censal.

Reemplazo opcional: si existe data/raw/inei/poblacion.csv con columnas
    nivel,ubigeo,anio,poblacion
(nivel = departamento|provincia|distrito; ubigeo de 2/4/6 dígitos) esas cifras tienen prioridad.

Salida: data/parquet/poblacion.parquet  (nivel, ubigeo, anio, poblacion, origen)
"""
from __future__ import annotations

import duckdb

from .. import config
from ..sources import registry
from ..storage import warehouse
from . import sql_path


def from_indicators(con: duckdb.DuckDBPyConnection) -> int:
    """`con` debe tener la tabla `ind` normalizada por mininter_indicators."""
    con.execute("""
        CREATE OR REPLACE TABLE pop AS
        WITH base AS (
            SELECT nivel, ubigeo, lima_parte, anio, max(poblacion) AS poblacion
            FROM ind WHERE poblacion IS NOT NULL AND poblacion > 0
            GROUP BY ALL
        )
        SELECT nivel, ubigeo, anio, sum(poblacion) AS poblacion,
               CASE WHEN count(lima_parte) > 0 THEN 'MININTER/INEI (Lima Metropolitana + Región Lima)'
                    ELSE 'MININTER/INEI' END AS origen
        FROM base GROUP BY nivel, ubigeo, anio
    """)
    override = config.RAW / "inei" / "poblacion.csv"
    if override.exists():
        con.execute(f"""CREATE OR REPLACE TABLE pop AS
            WITH o AS (SELECT nivel, ubigeo, CAST(anio AS INTEGER) anio, CAST(poblacion AS BIGINT) poblacion,
                              'INEI (archivo directo)' AS origen
                       FROM read_csv('{sql_path(override)}', header=true, all_varchar=true))
            SELECT * FROM o
            UNION ALL SELECT p.* FROM pop p ANTI JOIN o USING (nivel, ubigeo, anio)""")
    warehouse.write_parquet("poblacion", "SELECT * FROM pop ORDER BY nivel, ubigeo, anio", con)
    stats = con.execute("SELECT count(*), min(anio), max(anio) FROM pop").fetchone()
    registry.record("inei_poblacion", status="ok", last_downloaded=registry.sqlite_store.now_iso(),
                    normalized_path="data/parquet/poblacion.parquet",
                    coverage_start=str(stats[1]), coverage_end=str(stats[2]),
                    transform="Valor único por UBIGEO y año; departamento 15 (Lima) = Lima Metropolitana + Región Lima."
                              + (" Prioridad al archivo INEI directo." if override.exists() else ""))
    return stats[0]

"""Cobertura móvil reportada por empresas operadoras a OSIPTEL, a nivel de centro poblado."""
from __future__ import annotations

from pathlib import Path

import duckdb

from .. import config
from ..sources import harvester, registry
from ..storage import warehouse

SOURCE_ID = "osiptel_cobertura_movil"
FILENAME = "cobertura-movil-osiptel.csv"
URL = ("https://www.datosabiertos.gob.pe/sites/default/files/"
       "Porcentaje%20de%20cobertura%20movil%20por%20centro%20poblado%20empresa%20operadora%20y%20tecnolog%C3%ADa.csv")
OPERATORS = {"bitel": "Bitel", "claro": "Claro", "entel": "Entel", "integratel": "Integratel"}
TECHNOLOGIES = ("2g", "3g", "4g", "5g")
SCOPES = {"cg": "cg", "cgcar": "cgcar"}
SUPPORTED_TECHNOLOGIES = {"bitel": ("3g", "4g", "5g"), "claro": TECHNOLOGIES,
                         "entel": TECHNOLOGIES, "integratel": TECHNOLOGIES}


def source_columns() -> dict[str, str]:
    """Map stable API identifiers to the dataset's normalized CSV headers."""
    return {f"{operator}_{tech}_{scope}": f"{operator}_{tech}_{scope}"
            for operator, technologies in SUPPORTED_TECHNOLOGIES.items()
            for tech in technologies for scope in SCOPES}


def ingest(download: bool = False, folder: Path | None = None) -> str:
    local = folder / FILENAME if folder else None
    if local and local.exists():
        snap = harvester.import_local(SOURCE_ID, local, FILENAME)
    elif download or not harvester.latest(SOURCE_ID, FILENAME):
        try:
            snap = harvester.fetch(SOURCE_ID, URL, FILENAME, timeout=90, retries=1)
        except Exception as exc:  # portal puede exigir la descarga manual desde el navegador
            raise RuntimeError(f"No se pudo descargar OSIPTEL automáticamente ({exc}). Descarga el CSV oficial y ejecuta "
                               "python -m peru_intel ingest telecom --dir <carpeta-con-cobertura-movil-osiptel.csv>") from exc
    else:
        path = harvester.latest(SOURCE_ID, FILENAME)
        snap = harvester.Snapshot(SOURCE_ID, path, harvester.sha256_file(path), path.stat().st_size, URL, True, None, False)

    raw_path = str(snap.path).replace("\\", "/").replace("'", "''")
    con = duckdb.connect(":memory:")
    try:
        con.execute(f"""CREATE TEMP VIEW source_data AS
            SELECT * FROM read_csv_auto('{raw_path}', delim=';', header=true, all_varchar=true,
                                        normalize_names=true, sample_size=-1, encoding='latin-1')""")
        headers = {r[0] for r in con.execute("DESCRIBE source_data").fetchall()}
        required = {"ubigeo", "departamento", "provincia", "distrito", "centropoblado", "clasificacion", "latitud", "longitud"}
        required.update(source_columns().values())
        missing = required - headers
        if missing:
            raise ValueError("Esquema OSIPTEL no reconocido; faltan columnas: " + ", ".join(sorted(missing)))

        select = [
            'CAST(ubigeo AS VARCHAR) AS ubigeo', 'departamento', 'provincia', 'distrito',
            'centropoblado AS centro_poblado', 'clasificacion',
            'TRY_CAST(latitud AS DOUBLE) AS lat', 'TRY_CAST(longitud AS DOUBLE) AS lon',
        ]
        for name, col in source_columns().items():
            # Values in the source are percentages such as "87.5%"; retain the number 87.5.
            select.append(f"TRY_CAST(NULLIF(REPLACE(TRIM({col}), '%', ''), '') AS DOUBLE) AS {name}")
        relation = ("SELECT " + ", ".join(select) + " FROM source_data "
                    "WHERE TRY_CAST(latitud AS DOUBLE) BETWEEN -18.6 AND 0.2 "
                    "AND TRY_CAST(longitud AS DOUBLE) BETWEEN -81.6 AND -68.4 "
                    "AND LENGTH(TRIM(ubigeo)) = 10")
        out = warehouse.write_parquet("osiptel_cobertura_movil", relation, con)
        rows = con.execute(f"SELECT COUNT(*) FROM ({relation})").fetchone()[0]
    finally:
        con.close()

    registry.record_snapshot(
        SOURCE_ID, snap, normalized_path="data/parquet/osiptel_cobertura_movil.parquet",
        coverage_end="2025", transform="Se conserva una fila por centro poblado/UBIGEO; porcentajes reportados se normalizan a 0–100; no se geocodifica ni se reubican estaciones base.",
    )
    registry.record(SOURCE_ID, origin=URL)
    return f"{rows:,} centros poblados · {out.stat().st_size:,} bytes Parquet · corte 2025"

"""DevidaAdapter — cultivos de coca, erradicación y decomisos por departamento (DEVIDA, PNDA).

Portado de OCE/FEDTID scripts/build-observatory-data.mjs (sección DEVIDA). Capa separada «Drogas / TID»:
no se mezcla con la criminalidad general.

Salida: data/parquet/devida.parquet  (indicador, etiqueta, unidad, dep, anio, valor)   dep='PE' = total nacional
"""
from __future__ import annotations

from pathlib import Path

import duckdb

from .. import config
from ..map.names import department_code
from ..sources import harvester, registry
from ..storage import warehouse

SOURCE = "devida"
PORTAL = "https://www.datosabiertos.gob.pe"
FILES = f"{PORTAL}/sites/default/files"
INDICATORS = [
    ("coca_ha", "Cultivos de coca", "ha", "cultivos-coca-departamento-2018-2023.xlsx",
     "-Cultivos%20de%20coca%20seg%C3%BAn%20departamento%20%28ha%29%20%282018%20-%202023%29.xlsx"),
    ("erradicacion_ha", "Erradicación de coca", "ha", "erradicacion-departamento-2019-2023.xlsx",
     "-Superficie%20erradicada%20de%20cultivos%20il%C3%ADcitos%20de%20coca%20seg%C3%BAn%20departamento%20%20ha%20%20%202019%20-%202023.xlsx"),
    ("cocaina_kg", "Cocaína decomisada", "kg", "cocaina-decomisada-2019-2023.xlsx",
     "-Volumen%20de%20Coca%C3%ADna%20decomisada%20seg%C3%BAn%20departamento%20%28Kg%29%2C%202019%20-%202023.xlsx"),
    ("pbc_kg", "PBC decomisada", "kg", "pbc-decomisada-2019-2023.xlsx",
     "-Volumen%20de%20PBC%20decomisada%20seg%C3%BAn%20departamento%20%28Kg%29%2C%202019%20-%202023.xlsx"),
    ("iqpf_kg", "Insumos químicos fiscalizados decomisados", "kg", "iqpf-decomisados-2019-2023.xlsx",
     "-Volumen%20de%20Insumos%20Qu%C3%ADmicos%20Fiscalizados%20decomisados%20seg%C3%BAn%20departamento%20%28Kg%29%2C%202019%20-%202023.xlsx"),
    ("iqnf_kg", "Insumos químicos no fiscalizados decomisados", "kg", "iqnf-decomisados-2019-2023.xlsx",
     "-Volumen%20de%20Insumos%20Qu%C3%ADmicos%20No%20Fiscalizados%20decomisados%20seg%C3%BAn%20departamento%20%28Kg%29%2C%202019%20-%202023.xlsx"),
]


def _read(path: Path) -> list[tuple[str, int, float]]:
    import openpyxl  # dependencia opcional; requirements.txt la incluye

    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [r for r in ws.iter_rows(values_only=True)]
    header = rows[0]
    years = [(i, int(y)) for i, y in enumerate(header) if isinstance(y, (int, float)) and 1990 < y < 2100]
    out = []
    for r in rows[1:]:
        label = str(r[0] or "").strip()
        if not label:
            continue
        low = label.lower()
        dep = "PE" if low.startswith(("total", "nacional")) else department_code(label)
        if not dep:
            raise ValueError(f"{path.name}: departamento no reconocido «{label}»")
        for i, y in years:
            v = r[i]
            out.append((dep, y, round(float(v), 2) if isinstance(v, (int, float)) else 0.0))
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    src_dir = folder or (config.oce_dir() / "data" / "fuentes" / "devida" if config.oce_dir() else None)
    rows = []
    shas = []
    for ind, label, unit, local, remote in INDICATORS:
        if download:
            snap = harvester.fetch(SOURCE, f"{FILES}/{remote}", local, timeout=120)
        elif src_dir and (src_dir / local).exists():
            snap = harvester.import_local(SOURCE, src_dir / local)
        else:
            p = harvester.latest(SOURCE, local)
            if not p:
                raise FileNotFoundError(f"Falta {local}. Usa --download o --dir <carpeta>.")
            snap = harvester.Snapshot(SOURCE, p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False)
        shas.append(snap.sha256[:16])
        rows += [(ind, label, unit, dep, y, v) for dep, y, v in _read(snap.path)]
    con = duckdb.connect()
    con.execute("CREATE TABLE d(indicador VARCHAR, etiqueta VARCHAR, unidad VARCHAR, dep VARCHAR, anio INTEGER, valor DOUBLE)")
    con.executemany("INSERT INTO d VALUES (?,?,?,?,?,?)", rows)
    warehouse.write_parquet("devida", "SELECT * FROM d ORDER BY indicador, dep, anio", con)
    st = con.execute("SELECT min(anio), max(anio), count(*) FROM d").fetchone()
    registry.record(SOURCE, status="ok", last_downloaded=registry.sqlite_store.now_iso(), checksum=",".join(shas),
                    origin="portal PNDA" if download else "copia local (OCE/FEDTID data/fuentes/devida)",
                    normalized_path="data/parquet/devida.parquet", coverage_start=str(st[0]), coverage_end=str(st[1]),
                    transform="Cifras tal como las publica DEVIDA; los archivos de coca solo listan departamentos con cultivo.")
    return f"{st[2]:,} valores · {len(INDICATORS)} indicadores · {st[0]}–{st[1]}"

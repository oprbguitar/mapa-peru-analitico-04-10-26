"""MininterIndicatorsAdapter — Indicadores y tendencias para planes de acción de seguridad ciudadana.

Original: ZIP con CSV acumulados por mes (2009 → último mes) + diccionario XLSX.
Normalizado:
  data/parquet/mininter_indicadores.parquet   indicador, ambito, nivel, ubigeo, lima_parte, fuente, anio,
                                              valor (preliminar), valor_final, poblacion, clasif
  data/parquet/mininter_tendencias.parquet    nivel, ubigeo, lima_parte, indicador, tendencia
  data/parquet/indicadores_catalogo.parquet   codigo, nombre, unidad, ambitos
  data/parquet/poblacion.parquet              (ver inei_population.py)

Lima: el dataset regional separa «Lima Metropolitana» (1501) y «Región Lima» (1599). Se conservan
ambas (`lima_parte` = LM | RL) y el departamento 15 solo se forma cuando se puede sumar sin sesgo
(conteos y población). Para tasas y porcentajes se marca como dato calculado.
"""
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

import duckdb

from .. import config
from ..sources import harvester, registry
from ..sources.catalog import BY_ID
from ..storage import warehouse
from . import inei_population, sql_path

SOURCE = "mininter_indicadores"
TREND_SOURCE = "mininter_tendencias"
MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"]


def _month_rank(name: str) -> tuple[int, int]:
    low = name.lower()
    year = max((int(y) for y in re.findall(r"20\d\d", low)), default=0)
    month = max((i for i, m in enumerate(MONTHS) if re.search(rf"\b{m}", low) or (m == "set" and "sep" in low)), default=-1)
    return year, month


def _latest_csv(zip_path: Path) -> tuple[str, bytes]:
    z = zipfile.ZipFile(zip_path)
    names = [n for n in z.namelist() if n.lower().endswith(".csv")]
    if not names:
        raise ValueError(f"{zip_path.name}: el ZIP no contiene CSV")
    best = max(names, key=_month_rank)
    return best, z.read(best)


def _catalog(dic_path: Path | None) -> list[dict]:
    """Nombres de indicadores desde el diccionario oficial (columna Categoría de INDICADOR)."""
    if not dic_path:
        return []
    try:
        import openpyxl
    except ImportError:
        return []
    wb = openpyxl.load_workbook(dic_path, read_only=True)
    text = ""
    for row in wb.worksheets[0].iter_rows(values_only=True):
        if row and row[0] == "INDICADOR":
            text = str(next((c for c in reversed(row) if c), ""))
    out = []
    for m in re.finditer(r"(?m)^\s*(\d+)\.\s+(.+?)\s*$", text):
        code, label = int(m.group(1)), m.group(2).strip().rstrip(".")
        low = label.lower()
        unit = ("por 100 mil hab." if "100 mil" in low else "por mil hab." if "por cada mil" in low else
                "%" if low.startswith("porcentaje") else "número")
        amb = re.findall(r"\(([^)]*ámbito[^)]*)\)", label)
        out.append({"codigo": code, "nombre": label, "unidad": unit, "ambitos": "; ".join(amb)})
    return out


def _ubigeo_sql(col_amb: str, col_ub: str) -> str:
    return f"""CASE {col_amb}
        WHEN 0 THEN 'PE'
        WHEN 1 THEN CASE WHEN {col_ub} IN (1501, 1599) THEN '15' ELSE lpad(CAST({col_ub} AS VARCHAR), 2, '0') END
        WHEN 2 THEN substr(lpad(CAST({col_ub} AS VARCHAR), 6, '0'), 1, 4)
        ELSE lpad(CAST({col_ub} AS VARCHAR), 6, '0') END"""


def _nivel_sql(col_amb: str) -> str:
    return f"CASE {col_amb} WHEN 0 THEN 'pais' WHEN 1 THEN 'departamento' WHEN 2 THEN 'provincia' ELSE 'distrito' END"


def _lima_sql(col_amb: str, col_ub: str) -> str:
    return f"CASE WHEN {col_amb} = 1 AND {col_ub} = 1501 THEN 'LM' WHEN {col_amb} = 1 AND {col_ub} = 1599 THEN 'RL' END"


def ingest(download: bool = False, folder: Path | None = None) -> str:
    meta = BY_ID[SOURCE]
    if download:
        snap = harvester.fetch(SOURCE, meta["download"], "indicadores.zip", timeout=300,
                               headers={"Referer": "https://www.datosabiertos.gob.pe/"})
        dic = harvester.fetch(SOURCE, meta["dictionary"], "diccionario-indicadores.xlsx", timeout=120)
        tsnap = harvester.fetch(TREND_SOURCE, BY_ID[TREND_SOURCE]["download"], "tendencias.zip", timeout=120)
    else:
        def pick(source, pattern, name):
            if folder and list(folder.glob(pattern)):
                return harvester.import_local(source, sorted(folder.glob(pattern))[-1], name)
            p = harvester.latest(source, name)
            return harvester.Snapshot(source, p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False) if p else None
        snap = pick(SOURCE, "*Ind*Plan*.zip", "indicadores.zip")
        dic = pick(SOURCE, "*DICCIONAR*Ind*.xlsx", "diccionario-indicadores.xlsx")
        tsnap = pick(TREND_SOURCE, "*Ten*Plan*.zip", "tendencias.zip")
        if not snap:
            raise FileNotFoundError("Sin ZIP de indicadores. Usa --download o --dir <carpeta>.")

    csv_name, data = _latest_csv(snap.path)
    tmp = config.NORMALIZED / "_mininter_indicadores.csv"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_bytes(data.lstrip(b"\xef\xbb\xbf"))
    con = duckdb.connect()
    con.execute(f"""CREATE TABLE i AS SELECT CAST(INDICADOR AS INTEGER) AS indicador, CAST(AMBITO AS INTEGER) AS ambito,
                    CAST(UBIGEO_DASH AS INTEGER) AS ub, FUENTE AS fuente, CAST(ANIO AS INTEGER) AS anio,
                    TRY_CAST(VALORES AS DOUBLE) AS valor, TRY_CAST(VALORES_2 AS DOUBLE) AS valor_final,
                    TRY_CAST(POBLACION_PROYECTADA AS BIGINT) AS poblacion, TRY_CAST(CLASIF AS INTEGER) AS clasif
                    FROM read_csv('{sql_path(tmp)}', header=true, all_varchar=true)""")
    rel = f"""SELECT indicador, ambito, {_nivel_sql('ambito')} AS nivel, {_ubigeo_sql('ambito', 'ub')} AS ubigeo,
                     {_lima_sql('ambito', 'ub')} AS lima_parte, fuente, anio, valor, valor_final, poblacion, clasif
              FROM i"""
    warehouse.write_parquet("mininter_indicadores", rel, con)
    con.execute(f"CREATE TABLE ind AS {rel}")
    pop_rows = inei_population.from_indicators(con)
    cat = _catalog(dic.path if dic else None)
    if cat:
        con.execute("CREATE TABLE cat(codigo INTEGER, nombre VARCHAR, unidad VARCHAR, ambitos VARCHAR)")
        con.executemany("INSERT INTO cat VALUES (?,?,?,?)", [(c["codigo"], c["nombre"], c["unidad"], c["ambitos"]) for c in cat])
        warehouse.write_parquet("indicadores_catalogo", "SELECT * FROM cat ORDER BY codigo", con)
    stats = con.execute("SELECT min(anio), max(anio), count(*), count(DISTINCT indicador) FROM ind").fetchone()
    registry.record_snapshot(SOURCE, snap, normalized_path="data/parquet/mininter_indicadores.parquet",
                             coverage_start=str(stats[0]), coverage_end=str(stats[1]), file_used=csv_name,
                             transform="Se usa el CSV acumulado más reciente del ZIP. UBIGEO_DASH → UBIGEO de 2/4/6 dígitos "
                                       "según ámbito; Lima Metropolitana (1501) y Región Lima (1599) se conservan por separado.")
    msg = f"{stats[2]:,} filas · {stats[3]} indicadores · {stats[0]}–{stats[1]} ({csv_name.split('/')[-1]}) · población {pop_rows:,} filas"
    if tsnap:
        tname, tdata = _latest_csv(tsnap.path)
        ttmp = config.NORMALIZED / "_mininter_tendencias.csv"
        ttmp.write_bytes(tdata.lstrip(b"\xef\xbb\xbf"))
        con.execute(f"""CREATE TABLE t AS SELECT CAST(AMBITO AS INTEGER) AS ambito, CAST(UBIGEO_DASH AS INTEGER) AS ub,
                        CAST(INDICADORES_DASH AS INTEGER) AS indicador, TENDENCIA AS tendencia
                        FROM read_csv('{sql_path(ttmp)}', header=true, all_varchar=true)""")
        warehouse.write_parquet("mininter_tendencias", f"""SELECT {_nivel_sql('ambito')} AS nivel, {_ubigeo_sql('ambito', 'ub')} AS ubigeo,
                                {_lima_sql('ambito', 'ub')} AS lima_parte, indicador, tendencia FROM t""", con)
        registry.record_snapshot(TREND_SOURCE, tsnap, normalized_path="data/parquet/mininter_tendencias.parquet", file_used=tname)
        ttmp.unlink(missing_ok=True)
        msg += f" · tendencias {con.execute('SELECT count(*) FROM t').fetchone()[0]:,}"
    tmp.unlink(missing_ok=True)
    return msg

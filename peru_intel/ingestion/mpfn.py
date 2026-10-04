"""MpfnAdapter — [MPFN] Delitos denunciados (Observatorio de Criminalidad del Ministerio Público).

Portado y generalizado desde OCE/FEDTID scripts/build-observatory-data.mjs: allí solo se extraía la familia
TID; aquí se conservan TODOS los delitos y se marca la familia TID (arts. 296–303 del Código Penal).

Granularidad real: distrito fiscal. El UBIGEO es el de la SEDE (ubigeo_pjfs), no el del hecho. En el mapa
se agrega al departamento de la sede y la interfaz lo declara.

Salida: data/parquet/mpfn_delitos.parquet
    anio, periodo, parcial, distrito_fiscal, dep, ubigeo_sede, generico, subgenerico, articulo,
    des_articulo, cantidad, tid, tid_categoria
"""
from __future__ import annotations

from pathlib import Path

import duckdb

from .. import config
from ..map.names import department_code, norm
from ..sources import harvester, registry
from ..storage import warehouse
from . import sql_path

SOURCE = "mpfn_delitos"
FILES = "https://www.datosabiertos.gob.pe/sites/default/files"
REMOTE = [
    ("delitos-denunciados-2020.csv", "delitos%20denunciados%202020.csv"),
    ("delitos-denunciados-2021.csv", "delitos%20denunciados%202021.csv"),
    ("delitos-denunciados-2022.csv", "delitos%20denunciados%202022.csv"),
    ("delitos-denunciados-2023.csv", "delitos-denunciados-2023_0.csv"),
    ("delitos-denunciados-2024.csv", "delitos-denunciados-2024.csv"),
    ("delitos-denunciados-2025.csv", "BD-delitos-denunciados-2025-12.csv"),
    ("delitos-denunciados-2026-ene-jul.csv", "BD-delitos-denunciados-2026-07.csv"),
]
TID = [  # misma clasificación que OCE/FEDTID
    ("promocion", "Promoción o favorecimiento", ["296"]),
    ("agravadas", "Formas agravadas", ["297"]),
    ("micro", "Microcomercialización o microproducción", ["298"]),
    ("insumos", "Insumos químicos y productos fiscalizados", ["296-B"]),
    ("cultivo", "Cultivo de amapola o marihuana y resiembra", ["296-A", "296-C"]),
    ("otros", "Otras figuras TID", ["299", "300", "301", "302", "303"]),
]
# Departamento de la sede de distritos fiscales cuyo nombre no es un departamento (respaldo si dpto_pjfs falla)
FISCAL_DEP = {"LIMA CENTRO": "15", "LIMA ESTE": "15", "LIMA NORTE": "15", "LIMA NOROESTE": "15", "LIMA SUR": "15",
              "HUAURA": "15", "CANETE": "15", "SANTA": "02", "SELVA CENTRAL": "12", "SULLANA": "20", "CALLAO": "07",
              "VENTANILLA": "07", "DEL SANTA": "02", "PUENTE PIEDRA VENTANILLA": "07"}


def _local_dir(folder: Path | None) -> Path | None:
    for d in ([folder] if folder else []) + ([config.oce_dir() / "data" / "fuentes" / "mpfn"] if config.oce_dir() else []):
        if d and d.is_dir() and list(d.glob("delitos-denunciados-*.csv")):
            return d
    return None


def ingest(download: bool = False, folder: Path | None = None) -> str:
    snaps = []
    if download:
        for local, remote in REMOTE:
            snaps.append(harvester.fetch(SOURCE, f"{FILES}/{remote}", local, timeout=180,
                                         headers={"Referer": "https://www.datosabiertos.gob.pe/"}))
    else:
        d = _local_dir(folder)
        if d:
            snaps = [harvester.import_local(SOURCE, p) for p in sorted(d.glob("delitos-denunciados-*.csv"))]
        else:
            for local, _ in REMOTE:
                p = harvester.latest(SOURCE, local)
                if p:
                    snaps.append(harvester.Snapshot(SOURCE, p, harvester.sha256_file(p), p.stat().st_size, None, True, None, False))
        if not snaps:
            raise FileNotFoundError("Sin CSV MPFN locales. Usa --download o --dir <carpeta>.")
    con = duckdb.connect()
    files = ", ".join(f"'{sql_path(s.path)}'" for s in snaps)
    con.execute(f"""CREATE TABLE m AS SELECT * FROM read_csv([{files}], header=true, all_varchar=true,
                    union_by_name=true, normalize_names=true, filename=true)""")
    cols = {r[0] for r in con.execute("DESCRIBE m").fetchall()}
    for need in ("anio_denuncia", "distrito_fiscal", "generico", "articulo", "cantidad"):
        if need not in cols:
            raise ValueError(f"MPFN cambió de esquema: falta {need}")
    # departamento de la sede: dpto_pjfs → nombre del distrito fiscal → tabla de respaldo
    fiscal = con.execute("SELECT DISTINCT distrito_fiscal, dpto_pjfs FROM m").fetchall()
    mapping = []
    unknown = set()
    for df, dp in fiscal:
        code = department_code(dp) or department_code(df) or FISCAL_DEP.get(norm(df))
        if not code:
            unknown.add(df)
        mapping.append((df, dp, code))
    if unknown:
        raise ValueError(f"MPFN: distritos fiscales sin departamento: {sorted(x for x in unknown if x)}")
    con.execute("CREATE TABLE fmap(distrito_fiscal VARCHAR, dpto_pjfs VARCHAR, dep VARCHAR)")
    con.executemany("INSERT INTO fmap VALUES (?,?,?)", mapping)
    con.execute("CREATE TABLE tid(articulo VARCHAR, cat VARCHAR)")
    con.executemany("INSERT INTO tid VALUES (?,?)", [(a, cid) for cid, _l, arts in TID for a in arts])
    rel = """
        SELECT CAST(m.anio_denuncia AS INTEGER) AS anio, trim(m.periodo_denuncia) AS periodo,
               NOT regexp_matches(upper(coalesce(m.periodo_denuncia, '')), 'ENERO\\s*-\\s*DICIEMBRE') AS parcial,
               trim(m.distrito_fiscal) AS distrito_fiscal, f.dep,
               lpad(regexp_replace(coalesce(m.ubigeo_pjfs, ''), '[^0-9]', '', 'g'), 6, '0') AS ubigeo_sede,
               trim(m.generico) AS generico, trim(m.subgenerico) AS subgenerico, trim(m.articulo) AS articulo,
               trim(m.des_articulo) AS des_articulo, TRY_CAST(m.cantidad AS INTEGER) AS cantidad,
               (t.cat IS NOT NULL OR (trim(m.articulo) = 'S/Art' AND upper(m.des_articulo) LIKE '%TRAFICO ILICITO DE DROGAS%')) AS tid,
               coalesce(t.cat, CASE WHEN trim(m.articulo) = 'S/Art' AND upper(m.des_articulo) LIKE '%TRAFICO ILICITO DE DROGAS%'
                                    THEN 'otros' END) AS tid_categoria
        FROM m
        JOIN fmap f ON f.distrito_fiscal IS NOT DISTINCT FROM m.distrito_fiscal AND f.dpto_pjfs IS NOT DISTINCT FROM m.dpto_pjfs
        LEFT JOIN tid t ON t.articulo = trim(m.articulo)
        WHERE TRY_CAST(m.cantidad AS INTEGER) IS NOT NULL
    """
    warehouse.write_parquet("mpfn_delitos", rel, con)
    st = con.execute(f"SELECT min(anio), max(anio), sum(cantidad), sum(cantidad) FILTER (WHERE tid), "
                     f"count(DISTINCT distrito_fiscal) FROM ({rel})").fetchone()
    registry.record(SOURCE, status="ok", last_downloaded=registry.sqlite_store.now_iso(),
                    checksum=",".join(s.sha256[:16] for s in snaps),
                    raw_path=str(snaps[-1].path.parent.relative_to(config.DATA)).replace("\\", "/"),
                    origin=snaps[0].url or "copia local (OCE/FEDTID data/fuentes/mpfn)",
                    normalized_path="data/parquet/mpfn_delitos.parquet",
                    coverage_start=str(st[0]), coverage_end=str(st[1]),
                    transform="Todos los delitos denunciados (tipo de caso «denuncia», especialidad penal). Departamento = "
                              "sede del distrito fiscal. Familia TID = arts. 296–303 CP (clasificación OCE/FEDTID).")
    return f"{st[2]:,} denuncias ({st[3]:,} TID) · {st[4]} distritos fiscales · {st[0]}–{st[1]}"

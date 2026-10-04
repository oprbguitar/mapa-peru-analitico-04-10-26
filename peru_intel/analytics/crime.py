"""Seguridad y criminalidad: métricas por territorio con procedencia explícita.

Toda cifra sale de SQL sobre los Parquet normalizados. Para cada territorio se entregan siempre:
  absoluto  (dato oficial)          p. ej. 12 451 denuncias
  tasa      (dato calculado)        conteo / población proyectada × 100 000
  cambio    (dato calculado)        vs. los mismos meses del año anterior

Regla: nunca se reparte una cifra entre territorios. Si una fuente solo llega a departamento,
no se ofrece a nivel de provincia o distrito.
"""
from __future__ import annotations

from functools import lru_cache

from ..map import territory
from ..map.names import DEPARTMENTS
from ..sources import registry
from ..storage import warehouse

LEVEL_COL = {"departamento": "dep", "provincia": "prov", "distrito": "ubigeo"}
LEVELS = tuple(LEVEL_COL)
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"]

# Unidad por nivel cuando el diccionario MININTER mezcla definiciones según el ámbito
UNIT_OVERRIDES = {
    1: {"departamento": "por 100 mil hab.", "provincia": "número", "distrito": "número"},
    30: {"departamento": "por 100 mil hab.", "provincia": "por 100 mil hab.", "distrito": "por mil hab."},
    **{c: {"departamento": "%", "provincia": "número", "distrito": "número"} for c in range(203, 210)},
    # 2–6: el diccionario los define como tasa por mil (provincia/distrito); a nivel regional el valor publicado es un conteo
    **{c: {"departamento": "número"} for c in range(2, 7)},
}

# Familias del módulo «Seguridad y Criminalidad» → qué indicadores las alimentan
FAMILIES = [
    {"id": "denuncias", "label": "Denuncias", "dataset": "sidpol"},
    {"id": "tasa", "label": "Tasa delictiva", "dataset": "sidpol", "measure": "rate"},
    {"id": "victimizacion", "label": "Victimización", "dataset": "indicador", "codes": [10, 11, 12, 13, 14, 15, 16]},
    {"id": "violencia", "label": "Homicidios y violencia", "dataset": "indicador", "codes": [30, 31, 3, 4, 5, 20, 21, 22]},
    {"id": "operaciones", "label": "Capacidad policial y serenazgo", "dataset": "indicador",
     "codes": [201, 202, 205, 101, 102, 103, 107, 111, 113, 210]},
    {"id": "organizada", "label": "Criminalidad organizada", "dataset": "indicador", "codes": [7, 8, 1],
     "note": "Aproximación con extorsión, secuestro y pandillaje; no existe un indicador oficial único de crimen organizado."},
    {"id": "fiscal", "label": "Delitos denunciados (Fiscalía)", "dataset": "mpfn"},
    {"id": "tid", "label": "Drogas / TID", "dataset": "devida"},
    {"id": "tendencias", "label": "Tendencias", "dataset": "tendencias"},
    {"id": "indice", "label": "Índice compuesto", "dataset": "indice"},
]


def _ph(n: int) -> str:
    return ",".join("?" for _ in range(n))


@lru_cache(maxsize=1)
def sidpol_extent() -> dict:
    if not warehouse.has("sidpol_denuncias"):
        return {}
    r = warehouse.query("SELECT min(anio) a0, max(anio) a1 FROM sidpol_denuncias")[0]
    last = warehouse.query("SELECT max(mes) m FROM sidpol_denuncias WHERE anio = ?", [r["a1"]])[0]["m"]
    mods = [x["modalidad"] for x in warehouse.query(
        "SELECT modalidad, sum(cantidad) c FROM sidpol_denuncias GROUP BY 1 ORDER BY 2 DESC")]
    return {"first_year": r["a0"], "last_year": r["a1"], "last_month": last, "modalities": mods,
            "last_full_year": r["a1"] if last == 12 else r["a1"] - 1}


def clear_cache() -> None:
    sidpol_extent.cache_clear()


def period_label(year: int, m0: int, m1: int) -> str:
    if m0 == 1 and m1 == 12:
        return str(year)
    return f"{MESES[m0 - 1].capitalize()}–{MESES[m1 - 1]} {year}" if m0 != m1 else f"{MESES[m0 - 1].capitalize()} {year}"


def _name(level: str, code: str) -> str:
    if level == "departamento":
        return DEPARTMENTS.get(code, code)
    r = territory.lookup(code)
    return r["nombre"] if r else code


def resolve_period(year: int | None, months: str | None) -> tuple[int, int, int]:
    ext = sidpol_extent()
    y = int(year or ext["last_full_year"])
    last = ext["last_month"] if y == ext["last_year"] else 12
    if months:
        a, _, b = months.partition("-")
        m0, m1 = int(a), int(b or a)
    else:
        m0, m1 = 1, last
    m1 = min(m1, last)
    m0 = max(1, min(m0, m1))
    return y, m0, m1


def sidpol_choropleth(level: str = "departamento", year: int | None = None, months: str | None = None,
                      modalidad: str | None = None, compare_year: int | None = None) -> dict:
    if level not in LEVEL_COL:
        raise ValueError(f"nivel inválido: {level}")
    ext = sidpol_extent()
    if not ext:
        return {"available": False, "reason": "SIDPOL no ingerido. Ejecuta: python -m peru_intel ingest sidpol"}
    y, m0, m1 = resolve_period(year, months)
    cy = int(compare_year) if compare_year and ext["first_year"] <= int(compare_year) < y else y - 1
    col = LEVEL_COL[level]
    mods = [m for m in (modalidad or "").split(",") if m]
    mod_sql = f" AND modalidad IN ({_ph(len(mods))})" if mods else ""
    rows = warehouse.query(f"""
        WITH cur AS (SELECT {col} AS u, sum(cantidad) c FROM sidpol_denuncias
                     WHERE anio = ? AND mes BETWEEN ? AND ? {mod_sql} GROUP BY 1),
             prev AS (SELECT {col} AS u, sum(cantidad) c FROM sidpol_denuncias
                      WHERE anio = ? AND mes BETWEEN ? AND ? {mod_sql} GROUP BY 1),
             pop AS (SELECT ubigeo AS u, poblacion FROM poblacion WHERE nivel = ? AND anio = ?)
        SELECT cur.u AS ubigeo, cur.c AS count, prev.c AS prev_count, pop.poblacion AS population
        FROM cur LEFT JOIN prev USING (u) LEFT JOIN pop USING (u) ORDER BY cur.c DESC
    """, [y, m0, m1, *mods, cy, m0, m1, *mods, level, y])
    out = []
    for r in rows:
        rate = r["count"] / r["population"] * 100_000 if r["population"] else None
        change = ((r["count"] - r["prev_count"]) / r["prev_count"] * 100) if r["prev_count"] else None
        out.append({"ubigeo": r["ubigeo"], "nombre": _name(level, r["ubigeo"]), "count": int(r["count"]),
                    "prev_count": int(r["prev_count"]) if r["prev_count"] is not None else None,
                    "population": int(r["population"]) if r["population"] else None,
                    "rate": round(rate, 1) if rate is not None else None,
                    "change_pct": round(change, 1) if change is not None else None})
    total = sum(r["count"] for r in out)
    prev_total = sum(r["prev_count"] or 0 for r in out)
    partial = not (m0 == 1 and m1 == 12)
    return {
        "available": True, "dataset": "sidpol", "level": level,
        "title": "Denuncias policiales" + (f" · {', '.join(mods)}" if mods else " · todas las modalidades"),
        "period": {"year": y, "months": [m0, m1], "label": period_label(y, m0, m1), "partial": partial},
        "comparison": {"year": cy, "months": [m0, m1], "label": period_label(cy, m0, m1)},
        "measures": {
            "count": {"label": "Denuncias", "unit": "denuncias", "kind": "oficial"},
            "rate": {"label": "Tasa", "unit": "por 100 mil hab." + (" en el período" if partial else ""), "kind": "calculado"},
            "change_pct": {"label": "Cambio", "unit": f"% vs {period_label(cy, m0, m1)}", "kind": "calculado"},
            "population": {"label": "Población", "unit": "hab. (proyección)", "kind": "estimacion"},
        },
        "default_measure": "rate",
        "total": total, "prev_total": prev_total, "rows": out, "modalities": ext["modalities"],
        "years": list(range(ext["first_year"], ext["last_year"] + 1)), "last_month": ext["last_month"],
        "provenance": registry.provenance("mininter_sidpol", "inei_poblacion"),
        "method": "Tasa = denuncias del período / población proyectada del año × 100 000. Cambio = variación % frente a los "
                  "mismos meses del año de comparación (por defecto, el anterior). Sin reparto entre territorios.",
    }


def indicator_meta(code: int) -> dict:
    rows = warehouse.query("SELECT * FROM indicadores_catalogo WHERE codigo = ?", [code]) if warehouse.has("indicadores_catalogo") else []
    return rows[0] if rows else {"codigo": code, "nombre": f"Indicador {code}", "unidad": "", "ambitos": ""}


def indicator_unit(code: int, level: str) -> str:
    return UNIT_OVERRIDES.get(code, {}).get(level) or indicator_meta(code)["unidad"]


def indicator_levels(code: int) -> list[str]:
    return [r["nivel"] for r in warehouse.query(
        "SELECT DISTINCT nivel FROM mininter_indicadores WHERE indicador = ? AND nivel <> 'pais'", [code])]


def _lima_combined(code: int, year: int, unit: str) -> tuple[float | None, bool]:
    """Lima (15) a partir de Lima Metropolitana + Región Lima. Conteos se suman; tasas/porcentajes se ponderan por población."""
    parts = warehouse.query("""SELECT lima_parte, coalesce(valor_final, valor) v, poblacion FROM mininter_indicadores
                               WHERE indicador = ? AND anio = ? AND nivel = 'departamento' AND ubigeo = '15'""", [code, year])
    if not parts:
        return None, False
    if len(parts) == 1:
        return parts[0]["v"], False
    if unit == "número":
        return sum(p["v"] or 0 for p in parts), True
    w = sum(p["poblacion"] or 0 for p in parts)
    if not w:
        return None, True
    return sum((p["v"] or 0) * (p["poblacion"] or 0) for p in parts) / w, True


def indicator_choropleth(code: int, level: str = "departamento", year: int | None = None) -> dict:
    if not warehouse.has("mininter_indicadores"):
        return {"available": False, "reason": "Indicadores MININTER no ingeridos (python -m peru_intel ingest indicadores --download)."}
    levels = indicator_levels(code)
    if level not in levels:
        return {"available": False, "reason": f"El indicador {code} no se publica a nivel {level}. Niveles: {', '.join(levels) or '—'}.",
                "levels": levels}
    years = [r["anio"] for r in warehouse.query(
        "SELECT DISTINCT anio FROM mininter_indicadores WHERE indicador = ? AND nivel = ? ORDER BY 1", [code, level])]
    y = int(year) if year and int(year) in years else years[-1]
    unit = indicator_unit(code, level)
    rows = warehouse.query("""
        SELECT ubigeo, coalesce(valor_final, valor) AS value, valor AS preliminary, poblacion AS population, fuente
        FROM mininter_indicadores WHERE indicador = ? AND nivel = ? AND anio = ? AND lima_parte IS NULL
    """, [code, level, y])
    prev = {r["ubigeo"]: r["v"] for r in warehouse.query("""
        SELECT ubigeo, coalesce(valor_final, valor) v FROM mininter_indicadores
        WHERE indicador = ? AND nivel = ? AND anio = ? AND lima_parte IS NULL""", [code, level, y - 1])}
    out = []
    for r in rows:
        p = prev.get(r["ubigeo"])
        out.append({"ubigeo": r["ubigeo"], "nombre": _name(level, r["ubigeo"]), "value": r["value"],
                    "population": int(r["population"]) if r["population"] else None, "fuente": r["fuente"],
                    "change_pct": round((r["value"] - p) / p * 100, 1) if p and r["value"] is not None else None,
                    "calculated": False})
    if level == "departamento":
        v, calc = _lima_combined(code, y, unit)
        vp, _ = _lima_combined(code, y - 1, unit)
        if v is not None:
            out.append({"ubigeo": "15", "nombre": "Lima", "value": round(v, 4), "population": None, "fuente": rows[0]["fuente"] if rows else None,
                        "change_pct": round((v - vp) / vp * 100, 1) if vp else None, "calculated": calc,
                        "note": "Lima Metropolitana + Región Lima " + ("(suma)" if unit == "número" else "(ponderado por población)") if calc else None})
    meta = indicator_meta(code)
    return {
        "available": True, "dataset": "indicador", "code": code, "level": level, "title": meta["nombre"],
        "period": {"year": y, "label": str(y), "partial": False}, "years": years, "levels": levels,
        "measures": {"value": {"label": "Valor", "unit": unit, "kind": "oficial"},
                     "change_pct": {"label": "Cambio", "unit": f"% vs {y - 1}", "kind": "calculado"}},
        "default_measure": "value", "rows": out,
        "provenance": registry.provenance("mininter_indicadores"),
        "method": "Valor final publicado (VALORES_2) y, si falta, el preliminar (VALORES).",
    }


def mpfn_choropleth(year: int | None = None, tid_only: bool = False, generico: str | None = None) -> dict:
    if not warehouse.has("mpfn_delitos"):
        return {"available": False, "reason": "MPFN no ingerido (python -m peru_intel ingest mpfn)."}
    years = [r["anio"] for r in warehouse.query("SELECT DISTINCT anio FROM mpfn_delitos ORDER BY 1")]
    partial = {r["anio"]: r["periodo"] for r in warehouse.query("SELECT DISTINCT anio, periodo FROM mpfn_delitos WHERE parcial")}
    y = int(year) if year and int(year) in years else max(a for a in years if a not in partial)
    flt = " AND tid" if tid_only else ""
    params: list = []
    if generico:
        flt += " AND generico = ?"
        params.append(generico)
    rows = warehouse.query(f"""
        WITH cur AS (SELECT dep u, sum(cantidad) c FROM mpfn_delitos WHERE anio = ? {flt} GROUP BY 1),
             prev AS (SELECT dep u, sum(cantidad) c FROM mpfn_delitos WHERE anio = ? {flt} GROUP BY 1),
             pop AS (SELECT ubigeo u, poblacion FROM poblacion WHERE nivel = 'departamento' AND anio = ?)
        SELECT cur.u ubigeo, cur.c count, prev.c prev_count, pop.poblacion population
        FROM cur LEFT JOIN prev USING (u) LEFT JOIN pop USING (u)""", [y, *params, y - 1, *params, y])
    out = []
    for r in rows:
        comparable = y not in partial and (y - 1) not in partial
        out.append({"ubigeo": r["ubigeo"], "nombre": DEPARTMENTS.get(r["ubigeo"], r["ubigeo"]), "count": int(r["count"]),
                    "population": int(r["population"]) if r["population"] else None,
                    "rate": round(r["count"] / r["population"] * 100_000, 1) if r["population"] else None,
                    "change_pct": round((r["count"] - r["prev_count"]) / r["prev_count"] * 100, 1)
                    if r["prev_count"] and comparable else None})
    genericos = [r["generico"] for r in warehouse.query(
        "SELECT generico, sum(cantidad) c FROM mpfn_delitos GROUP BY 1 ORDER BY 2 DESC LIMIT 25")]
    return {
        "available": True, "dataset": "mpfn", "level": "departamento",
        "title": "Delitos denunciados ante el Ministerio Público" + (" · TID" if tid_only else f" · {generico}" if generico else ""),
        "period": {"year": y, "label": partial.get(y, str(y)) + (f" {y}" if y in partial else ""), "partial": y in partial},
        "years": years, "genericos": genericos,
        "measures": {"count": {"label": "Denuncias", "unit": "denuncias", "kind": "oficial"},
                     "rate": {"label": "Tasa", "unit": "por 100 mil hab.", "kind": "calculado"},
                     "change_pct": {"label": "Cambio", "unit": f"% vs {y - 1}", "kind": "calculado"}},
        "default_measure": "rate", "rows": out,
        "granularity_note": "Agregado por departamento de la SEDE del distrito fiscal (no del lugar del hecho). "
                            "Los distritos fiscales no coinciden exactamente con los departamentos.",
        "provenance": registry.provenance("mpfn_delitos", "inei_poblacion"),
    }


def devida_choropleth(indicador: str = "coca_ha", year: int | None = None) -> dict:
    if not warehouse.has("devida"):
        return {"available": False, "reason": "DEVIDA no ingerido (python -m peru_intel ingest devida)."}
    inds = warehouse.query("SELECT DISTINCT indicador, etiqueta, unidad FROM devida ORDER BY 1")
    meta = next((i for i in inds if i["indicador"] == indicador), inds[0])
    years = [r["anio"] for r in warehouse.query("SELECT DISTINCT anio FROM devida WHERE indicador = ? ORDER BY 1", [meta["indicador"]])]
    y = int(year) if year and int(year) in years else years[-1]
    rows = warehouse.query("""SELECT c.dep AS ubigeo, c.valor AS "value", p.valor AS prev FROM devida c
                              LEFT JOIN devida p ON p.indicador = c.indicador AND p.dep = c.dep AND p.anio = c.anio - 1
                              WHERE c.indicador = ? AND c.anio = ? AND c.dep <> 'PE'""", [meta["indicador"], y])
    nat = warehouse.query("SELECT valor FROM devida WHERE indicador = ? AND anio = ? AND dep = 'PE'", [meta["indicador"], y])
    return {
        "available": True, "dataset": "devida", "level": "departamento", "title": meta["etiqueta"], "indicador": meta["indicador"],
        "indicators": inds, "period": {"year": y, "label": str(y), "partial": False}, "years": years,
        "measures": {"value": {"label": meta["etiqueta"], "unit": meta["unidad"], "kind": "oficial"},
                     "change_pct": {"label": "Cambio", "unit": f"% vs {y - 1}", "kind": "calculado"}},
        "default_measure": "value", "national": nat[0]["valor"] if nat else None,
        "rows": [{"ubigeo": r["ubigeo"], "nombre": DEPARTMENTS.get(r["ubigeo"], r["ubigeo"]), "value": r["value"],
                  "change_pct": round((r["value"] - r["prev"]) / r["prev"] * 100, 1) if r["prev"] else None} for r in rows],
        "note": "Capa separada de la criminalidad general. Comparar no implica causalidad.",
        "provenance": registry.provenance("devida"),
    }


def monthly_series(ubigeo: str | None = None, modalidad: str | None = None) -> list[dict]:
    """Serie mensual SIDPOL para el país (None), departamento (2), provincia (4) o distrito (6)."""
    where, params = [], []
    if ubigeo:
        col = {2: "dep", 4: "prov", 6: "ubigeo"}[len(ubigeo)]
        where.append(f"{col} = ?")
        params.append(ubigeo)
    if modalidad:
        where.append("modalidad = ?")
        params.append(modalidad)
    w = ("WHERE " + " AND ".join(where)) if where else ""
    return warehouse.query(f"SELECT anio, mes, sum(cantidad) AS value FROM sidpol_denuncias {w} GROUP BY 1, 2 ORDER BY 1, 2", params)


def region_profile(ubigeo: str, year: int | None = None, months: str | None = None) -> dict:
    """Ficha completa de un territorio: lo que alimenta el panel lateral y a los agentes de IA."""
    level = {2: "departamento", 4: "provincia", 6: "distrito"}.get(len(ubigeo))
    if not level:
        raise ValueError("UBIGEO de 2, 4 o 6 dígitos")
    ext = sidpol_extent()
    y, m0, m1 = resolve_period(year, months)
    col = LEVEL_COL[level]
    by_mod = warehouse.query(f"""
        SELECT modalidad, sum(cantidad) FILTER (WHERE anio = ?) c, sum(cantidad) FILTER (WHERE anio = ?) p
        FROM sidpol_denuncias WHERE {col} = ? AND mes BETWEEN ? AND ? GROUP BY 1 ORDER BY 2 DESC NULLS LAST""",
                             [y, y - 1, ubigeo, m0, m1])
    pop = warehouse.query("SELECT poblacion FROM poblacion WHERE nivel = ? AND ubigeo = ? AND anio = ?", [level, ubigeo, y])
    population = int(pop[0]["poblacion"]) if pop else None
    total = sum(r["c"] or 0 for r in by_mod)
    prev = sum(r["p"] or 0 for r in by_mod)
    latest_year = ext["last_year"]
    ytd = warehouse.query(f"SELECT sum(cantidad) c FROM sidpol_denuncias WHERE {col} = ? AND anio = ?", [ubigeo, latest_year])[0]["c"]
    ytd_prev = warehouse.query(f"SELECT sum(cantidad) c FROM sidpol_denuncias WHERE {col} = ? AND anio = ? AND mes <= ?",
                               [ubigeo, latest_year - 1, ext["last_month"]])[0]["c"]
    indicators = []
    if warehouse.has("mininter_indicadores"):
        for code in (10, 30, 7, 8, 9, 2, 201, 202, 107):
            if level not in indicator_levels(code) or (code == 2 and level == "departamento"):
                continue  # a nivel regional el indicador 2 es un conteo con etiqueta de tasa: se omite para no confundir
            unit = indicator_unit(code, level)
            last = warehouse.query("""SELECT anio, coalesce(valor_final, valor) v FROM mininter_indicadores
                                      WHERE indicador = ? AND nivel = ? AND ubigeo = ? AND lima_parte IS NULL
                                      ORDER BY anio DESC LIMIT 1""", [code, level, ubigeo])
            calc = False
            if not last and level == "departamento" and ubigeo == "15":
                yrs = warehouse.query("SELECT max(anio) a FROM mininter_indicadores WHERE indicador = ? AND ubigeo = '15'", [code])
                if yrs and yrs[0]["a"]:
                    v, calc = _lima_combined(code, yrs[0]["a"], unit)
                    last = [{"anio": yrs[0]["a"], "v": v}] if v is not None else []
            if last and last[0]["v"] is not None:
                indicators.append({"code": code, "label": indicator_meta(code)["nombre"], "unit": unit, "year": last[0]["anio"],
                                   "value": round(last[0]["v"], 3), "kind": "calculado" if calc else "oficial"})
    trends = []
    if warehouse.has("mininter_tendencias"):
        trends = warehouse.query("""SELECT t.indicador AS code, c.nombre AS "label", t.tendencia FROM mininter_tendencias t
                                    LEFT JOIN indicadores_catalogo c ON c.codigo = t.indicador
                                    WHERE t.nivel = ? AND t.ubigeo = ? AND t.lima_parte IS NULL ORDER BY 1""", [level, ubigeo])
    mpfn = None
    if level == "departamento" and warehouse.has("mpfn_delitos"):
        mp = mpfn_choropleth()
        mpfn = next((r | {"year": mp["period"]["year"]} for r in mp["rows"] if r["ubigeo"] == ubigeo), None)
    devida = []
    if level == "departamento" and warehouse.has("devida"):
        devida = warehouse.query("""SELECT indicador, etiqueta, unidad, anio, valor FROM devida d
                                    WHERE dep = ? AND anio = (SELECT max(anio) FROM devida d2 WHERE d2.indicador = d.indicador)
                                    ORDER BY indicador""", [ubigeo])
    terr = territory.lookup(ubigeo)
    return {
        "ubigeo": ubigeo, "level": level, "nombre": _name(level, ubigeo),
        "departamento": terr["departamento"] if terr else DEPARTMENTS.get(ubigeo[:2]),
        "centroid": [terr["lat"], terr["lon"]] if terr else None, "bbox": terr["bbox"] if terr else None,
        "sidpol": {
            "period": period_label(y, m0, m1), "comparison": period_label(y - 1, m0, m1),
            "total": total, "prev": prev, "population": population,
            "rate": round(total / population * 100_000, 1) if population else None,
            "change_pct": round((total - prev) / prev * 100, 1) if prev else None,
            "by_modality": [{"modalidad": r["modalidad"], "count": int(r["c"] or 0),
                             "share_pct": round((r["c"] or 0) / total * 100, 1) if total else None,
                             "change_pct": round(((r["c"] or 0) - r["p"]) / r["p"] * 100, 1) if r["p"] else None} for r in by_mod],
            "ytd": {"label": period_label(latest_year, 1, ext["last_month"]), "count": int(ytd or 0),
                    "prev_label": period_label(latest_year - 1, 1, ext["last_month"]), "prev": int(ytd_prev or 0),
                    "change_pct": round((ytd - ytd_prev) / ytd_prev * 100, 1) if ytd and ytd_prev else None},
        },
        "series": monthly_series(ubigeo),
        "indicators": indicators, "trends": trends, "mpfn": mpfn, "devida": devida,
        "provenance": registry.provenance("mininter_sidpol", "inei_poblacion", "mininter_indicadores", "mininter_tendencias",
                                          *(["mpfn_delitos", "devida"] if level == "departamento" else [])),
    }

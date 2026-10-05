"""Observatorio de denuncias por territorio (SIDPOL · MININTER, Observatorio Nacional de Seguridad Ciudadana).

Para un departamento, provincia o distrito entrega, año por año:
  - denuncias por modalidad (oficial) y su porcentaje dentro del total del territorio (calculado);
  - variación frente al año anterior con los MISMOS meses (si el último año está incompleto se compara ene–mes);
  - «sesgo»: qué modalidades ganaron o perdieron peso entre los dos últimos años completos (calculado);
  - posición frente a los territorios vecinos del mismo nivel (calculado, tasa por 100 mil);
  - proyección del año en curso = acumulado oficial + meses restantes proyectados (proyección declarada).

Nunca se reparte una cifra dentro del distrito: SIDPOL no publica la ubicación del hecho por debajo del UBIGEO.
"""
from __future__ import annotations

from ..sources import registry
from ..storage import warehouse
from . import crime, forecast

LEVEL = {2: "departamento", 4: "provincia", 6: "distrito"}


def _peers_where(ubigeo: str) -> tuple[str, str, list]:
    """Territorios comparables: distritos de la misma provincia, provincias del mismo departamento o departamentos."""
    n = len(ubigeo)
    if n == 6:
        return "ubigeo", "prov = ?", [ubigeo[:4]]
    if n == 4:
        return "prov", "dep = ?", [ubigeo[:2]]
    return "dep", "1 = 1", []


def observatory(ubigeo: str, modalidad: str | None = None) -> dict:
    level = LEVEL.get(len(ubigeo))
    if not level or not ubigeo.isdigit():
        raise ValueError("UBIGEO de 2, 4 o 6 dígitos")
    ext = crime.sidpol_extent()
    if not ext:
        return {"available": False, "reason": "SIDPOL no ingerido."}
    col = crime.LEVEL_COL[level]
    last_y, last_m, full_y = ext["last_year"], ext["last_month"], ext["last_full_year"]
    rows = warehouse.query(f"""
        SELECT anio, modalidad, sum(cantidad) c, sum(cantidad) FILTER (WHERE mes <= ?) c_ytd
        FROM sidpol_denuncias WHERE {col} = ? GROUP BY 1, 2 ORDER BY 1, 2""", [last_m, ubigeo])
    pops = {r["anio"]: r["poblacion"] for r in warehouse.query(
        "SELECT anio, poblacion FROM poblacion WHERE nivel = ? AND ubigeo = ?", [level, ubigeo])}
    years = list(range(ext["first_year"], last_y + 1))
    mods = ext["modalities"]
    table = {y: {m: 0 for m in mods} for y in years}
    ytd = {y: {m: 0 for m in mods} for y in years}
    for r in rows:
        table[r["anio"]][r["modalidad"]] = int(r["c"] or 0)
        ytd[r["anio"]][r["modalidad"]] = int(r["c_ytd"] or 0)

    focus = [modalidad] if modalidad else mods
    by_year = []
    for y in years:
        total = sum(table[y].values())
        sel = sum(table[y][m] for m in focus)
        partial = y == last_y and last_m < 12
        prev = y - 1
        if prev in table:
            # comparación justa: si el año está incompleto, mismos meses del anterior
            base = sum(ytd[prev][m] for m in focus) if partial else sum(table[prev][m] for m in focus)
            change = round((sel - base) / base * 100, 1) if base else None
        else:
            change = None
        pop = pops.get(y) or pops.get(max(pops)) if pops else None
        by_year.append({
            "year": y, "partial": partial, "months": last_m if partial else 12, "count": sel, "total": total,
            "share_pct": round(sel / total * 100, 1) if total and modalidad else None,
            "rate": round(sel / pop * 100_000, 1) if pop and not partial else None,
            "change_pct": change, "trend": None if change is None else ("sube" if change > 2 else "baja" if change < -2 else "estable"),
            "by_modality": [{"modalidad": m, "count": table[y][m],
                             "share_pct": round(table[y][m] / total * 100, 1) if total else None} for m in mods],
        })

    # sesgo: cambio del peso de cada modalidad entre los dos últimos años completos
    shift = []
    if full_y - 1 in table:
        t1, t0 = sum(table[full_y].values()), sum(table[full_y - 1].values())
        for m in mods:
            s1 = table[full_y][m] / t1 * 100 if t1 else 0
            s0 = table[full_y - 1][m] / t0 * 100 if t0 else 0
            c0, c1 = table[full_y - 1][m], table[full_y][m]
            shift.append({"modalidad": m, "share_prev": round(s0, 1), "share": round(s1, 1), "pp": round(s1 - s0, 1),
                          "change_pct": round((c1 - c0) / c0 * 100, 1) if c0 else None})
        shift.sort(key=lambda r: -abs(r["pp"]))

    # vecinos del mismo nivel (tasa del último año completo para la modalidad elegida)
    pcol, where, params = _peers_where(ubigeo)
    mod_sql, mod_p = ("AND modalidad = ?", [modalidad]) if modalidad else ("", [])
    peers = warehouse.query(f"""
        WITH c AS (SELECT {pcol} u, sum(cantidad) n FROM sidpol_denuncias WHERE anio = ? AND {where} {mod_sql} GROUP BY 1),
             p AS (SELECT ubigeo u, poblacion FROM poblacion WHERE nivel = ? AND anio = ?)
        SELECT c.u, c.n, p.poblacion FROM c LEFT JOIN p USING (u)""", [full_y, *params, *mod_p, level, full_y])
    ranked = sorted(({"ubigeo": r["u"], "nombre": crime._name(level, r["u"]), "count": int(r["n"]),
                      "rate": round(r["n"] / r["poblacion"] * 100_000, 1) if r["poblacion"] else None} for r in peers),
                    key=lambda r: -(r["rate"] or -1))
    pos = next((i + 1 for i, r in enumerate(ranked) if r["ubigeo"] == ubigeo), None)

    # proyección del año en curso: acumulado oficial + meses restantes (modelo declarado)
    fc = forecast.forecast(ubigeo, modalidad, horizon=12 - last_m) if last_m < 12 else {"available": False}
    projection = None
    if fc.get("available"):
        done = by_year[-1]["count"]
        rest = [f for f in fc["forecast"] if f["period"].startswith(str(last_y))]
        projection = {"year": last_y, "observed": done, "observed_months": last_m,
                      "point": done + sum(f["point"] for f in rest), "lo95": done + sum(f["lo95"] for f in rest),
                      "hi95": done + sum(f["hi95"] for f in rest), "method": fc["method"],
                      "vs_prev_full": None, "kind": "proyeccion"}
        prev_full = next((b["count"] for b in by_year if b["year"] == last_y - 1), None)
        if prev_full:
            projection["vs_prev_full"] = round((projection["point"] - prev_full) / prev_full * 100, 1)

    return {
        "available": True, "ubigeo": ubigeo, "level": level, "nombre": crime._name(level, ubigeo),
        "modalidad": modalidad or "todas", "modalities": mods, "years": by_year,
        "shift": {"from": full_y - 1, "to": full_y, "items": shift, "kind": "calculado",
                  "note": "pp = puntos porcentuales de cambio en el peso de la modalidad dentro del total de denuncias."},
        "peers": {"level": level, "year": full_y, "position": pos, "of": len(ranked), "top": ranked[:8],
                  "scope": {6: "distritos de la misma provincia", 4: "provincias del mismo departamento", 2: "departamentos"}[len(ubigeo)]},
        "projection": projection, "forecast": fc if fc.get("available") else None,
        "caveat": "Denuncias registradas por la PNP, no delitos ocurridos. SIDPOL ubica el hecho a nivel de distrito: "
                  "no hay datos públicos para señalar calles o manzanas dentro del distrito.",
        "provenance": registry.provenance("mininter_sidpol", "inei_poblacion"),
    }

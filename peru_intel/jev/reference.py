"""jev-ref: evaluador de referencia con reglas explícitas y hechos numerados (cada cifra sale del resultado evaluado).

No pondera en secreto: la puntuación es la métrica principal del motor tal cual (0–100) y todo lo demás son reglas
legibles sobre incertidumbre, calidad de datos y saturación. Umbrales declarados en THRESHOLDS.
"""
from __future__ import annotations

from datetime import datetime, timezone

ENGINE = "jev-ref-0.1"
THRESHOLDS = {"spread_low": 10.0, "spread_high": 25.0, "precision_low": 2.0, "precision_high": 5.0, "min_iterations": 300,
              "min_replications": 20, "stale_days": 180, "critical_score": 50.0, "saturation_pct": 80.0}
LEVELS = ["baja", "media", "alta"]


def _primary(run: dict) -> dict:
    """Métrica principal del escenario evaluado (hipótesis B o el operativo), con su rango del 90 %."""
    p = run.get("params", {})
    eng = p.get("engine")
    r = run.get("results", {})
    if eng == "operations":
        q = r["within_target_pct"]
        return {"name": f"llamadas atendidas a tiempo (≤ {p['ops']['target_min']} min)", "unit": "%", "q": q,
                "n": p.get("replications"), "n_kind": "réplicas", "min_n": THRESHOLDS["min_replications"]}
    if eng == "queue":
        q = r["B"]["within_30_pct"]
        return {"name": "llamadas atendidas en ≤ 30 min (hipótesis)", "unit": "%", "q": q, "base": r["A"]["within_30_pct"],
                "n": p.get("replications"), "n_kind": "réplicas", "min_n": THRESHOLDS["min_replications"]}
    q = r["B"]["coverage_pct"]["15"]
    return {"name": "área a ≤ 15 min del servicio (hipótesis)", "unit": "%", "q": q, "base": r["A"]["coverage_pct"]["15"],
            "n": p.get("iterations"), "n_kind": "iteraciones", "min_n": THRESHOLDS["min_iterations"]}


def _age_days(iso: str | None) -> float | None:
    if not iso:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            return (datetime.now(timezone.utc) - datetime.strptime(iso, fmt)).total_seconds() / 86400
        except ValueError:
            continue
    return None


def evaluate(run: dict) -> dict:
    p = run.get("params", {})
    eng = p.get("engine", "accessibility")
    m = _primary(run)
    q = m["q"]
    facts, actions = [], []

    def fact(text, value=None, field=None):
        facts.append({"n": len(facts) + 1, "text": text, "value": value, "field": field})
        return len(facts)

    if q.get("p50") is None:
        fact("El motor no produjo la métrica principal (sin llamadas atendidas o sin servicio).", None, "results")
        return {"engine": ENGINE, "run_id": run.get("run_id"), "subject": m["name"], "score": None,
                "uncertainty": {"level": "alta", "precision": None}, "variability": {"level": "alta", "spread": None}, "data_quality": {"level": "insuficiente", "issues": []},
                "decision": "mas_datos", "actions": [{"action": "mas_datos", "why": [1]}], "facts": facts}

    score = round(float(q["p50"]), 1)
    f_score = fact(f"{m['name'].capitalize()}: mediana {score:g} {m['unit']}", score, "results")
    # VARIABILIDAD: cuánto cambia el resultado entre repeticiones (cada una es un «día posible»); es del escenario,
    # no se reduce repitiendo. INCERTIDUMBRE: precisión de la mediana estimada, ±1,96·σ/√n con σ ≈ rango 90 % / 3,29.
    spread = round(float(q["p95"]) - float(q["p5"]), 1)
    n = m.get("n") or 0
    precision = round(1.96 * spread / (3.29 * max(n, 1) ** 0.5), 1)
    var_level = 0 if spread < THRESHOLDS["spread_low"] else 1 if spread < THRESHOLDS["spread_high"] else 2
    f_spread = fact(f"Variabilidad entre repeticiones: {q['p5']:g}–{q['p95']:g} {m['unit']} (rango del 90 %: {spread:g} puntos)", spread, "results")
    f_prec = fact(f"Precisión de la mediana con {n} {m['n_kind']}: ±{precision:g} puntos (mínimo recomendado {m['min_n']} {m['n_kind']})", precision, "params")
    level = 0 if precision < THRESHOLDS["precision_low"] else 1 if precision < THRESHOLDS["precision_high"] else 2
    if n < m["min_n"]:
        level = min(2, level + 1)
        actions.append({"action": "mas_iteraciones", "why": [f_prec], "detail": f"Sube a ≥ {m['min_n']} {m['n_kind']}."})
    elif level == 2:
        need = int(min(4 * n, (1.96 * spread / (3.29 * THRESHOLDS["precision_high"])) ** 2) + 1)
        actions.append({"action": "mas_iteraciones", "why": [f_prec], "detail": f"La mediana aún es imprecisa: prueba con ~{need} {m['n_kind']}."})
    if var_level == 2 and float(q["p5"]) < THRESHOLDS["critical_score"]:
        actions.append({"action": "revision_humana", "why": [f_spread],
                        "detail": f"En los días malos (p5) baja a {q['p5']:g} {m['unit']}: planifica para ese caso, no solo para la mediana."})
    if "base" in m and m["base"].get("p50") is not None:
        fact(f"Situación base (A): {m['base']['p50']:g} {m['unit']}; cambio por la hipótesis {score - m['base']['p50']:+.1f} puntos",
             round(score - m["base"]["p50"], 1), "results.A")

    # calidad de datos: fuentes, antigüedad y avisos del propio motor
    issues = []
    for s in run.get("provenance") or []:
        age = _age_days(s.get("downloaded"))
        if not s.get("official"):
            issues.append(fact(f"Fuente {s['name']} es colaborativa o de tercero: puede estar incompleta", None, "provenance"))
        if age is not None and age > THRESHOLDS["stale_days"]:
            issues.append(fact(f"Fuente {s['name']} descargada hace {age:.0f} días", round(age), "provenance"))
    for w in run.get("warnings") or []:
        if any(k in w for k in ("Nadie atiende", "colaborativa", "Faltan", "falta")):
            issues.append(fact(f"Aviso del motor: {w}", None, "warnings"))
    if issues:
        actions.append({"action": "mas_datos", "why": issues, "detail": "Completa unidades o fuentes antes de concluir."})

    # carga y contraste con otros modelos
    if eng == "operations":
        sat = run.get("saturated") or []
        if sat:
            f = fact(f"{len(sat)} unidad(es) ocupada(s) ≥ {THRESHOLDS['saturation_pct']:g} % del tiempo", len(sat), "units")
            actions.append({"action": "otro_modelo", "why": [f], "detail": "Duplica el escenario y prueba más unidades o redistribúyelas; compara A/B."})
        crossing = run["results"].get("crossing_tramos_pct", {}).get("p50")
        if crossing and crossing > 25:
            f = fact(f"{crossing:g} % de los trayectos cruza tramos cortados (rodeo supuesto, sin red vial)", crossing, "results")
            actions.append({"action": "otro_modelo", "why": [f], "detail": "El rodeo es un supuesto: conviene contrastarlo con rutas reales (motor S5, planificado)."})
    elif eng == "accessibility" and "base" in m and m["base"].get("p50") is not None and score - m["base"]["p50"] < -10:
        f = fact("La hipótesis reduce más de 10 puntos el área cubierta", round(score - m["base"]["p50"], 1), "results")
        actions.append({"action": "otro_modelo", "why": [f], "detail": "Contrasta con «Capacidad» (S3): la saturación de sedes puede agravar el efecto."})
    if score < THRESHOLDS["critical_score"]:
        actions.append({"action": "revision_humana", "why": [f_score], "detail": "Resultado crítico: lo revisa una persona responsable antes de usarlo."})

    order = ["revision_humana", "mas_datos", "mas_iteraciones", "otro_modelo"]
    decision = next((a for a in order if any(x["action"] == a for x in actions)), "aceptable_para_exploracion")
    return {"engine": ENGINE, "run_id": run.get("run_id"), "subject": m["name"], "score": score,
            "uncertainty": {"level": LEVELS[level], "precision": precision},
            "variability": {"level": LEVELS[var_level], "spread": spread},
            "data_quality": {"level": "con reservas" if issues else "suficiente para explorar", "issues": issues},
            "decision": decision, "actions": actions, "facts": facts}


def compare(runs: list[dict]) -> dict:
    """Ordena escenarios por la mediana de su métrica principal y marca EMPATES TÉCNICOS cuando los rangos se solapan."""
    rows = []
    for r in runs:
        m = _primary(r)
        rows.append({"run_id": r.get("run_id"), "label": r.get("label") or r.get("run_id"), "subject": m["name"],
                     "p5": m["q"].get("p5"), "p50": m["q"].get("p50"), "p95": m["q"].get("p95")})
    valid = sorted([x for x in rows if x["p50"] is not None], key=lambda x: -x["p50"])
    facts = [{"n": i + 1, "text": f"{x['label']}: {x['p50']:g} % (rango {x['p5']:g}–{x['p95']:g})", "value": x["p50"], "field": "results"}
             for i, x in enumerate(valid)]
    ties = []
    if valid:
        best = valid[0]
        ties = [x["run_id"] for x in valid[1:] if x["p95"] is not None and best["p5"] is not None and x["p95"] >= best["p5"]]
    subjects = {x["subject"] for x in rows}
    decision = "revision_humana" if ties or len(subjects) > 1 or not valid else "aceptable_para_exploracion"
    note = ("Los escenarios miden cosas distintas: no se ordenan entre sí." if len(subjects) > 1
            else "Empate técnico: los rangos se solapan; decide una persona con otros criterios." if ties
            else "El mejor indicador no se solapa con los demás; aun así la decisión es de la persona responsable.")
    return {"engine": ENGINE, "ranking": [x["run_id"] for x in valid], "rows": rows, "ties": ties, "decision": decision,
            "note": note, "facts": facts}

"""Informes y reproducción del desarrollo de escenarios (plan maestro §10).

El servidor arma el MODELO del informe (datos, no texto libre): versiones con qué cambió en cada una, métricas por
versión, supuestos, fuentes con fecha de descarga, avisos, evaluación JEV y limitaciones. El resumen ejecutivo se
construye con reglas a partir de esas cifras (no lo redacta una IA). El navegador lo convierte en un documento
imprimible (HTML/PDF) con una captura del mapa.
"""
from __future__ import annotations

from datetime import datetime, timezone

from . import jev
from .simulation import runs as sim_runs
from .simulation import scenarios as sim_scen

LIMITS_TEXT = [
    "Estimaciones exploratorias: distancias en línea recta con factor de rodeo, sin red vial calibrada.",
    "Las llamadas del operativo son sintéticas (tasa declarada) y no provienen de denuncias ni de personas.",
    "La puntuación JEV es la métrica principal del motor: no es una probabilidad de ocurrencia.",
    "Los escenarios no están calibrados con eventos reales; sirven para comparar alternativas, no para predecir.",
]


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _spec_summary(spec: dict) -> dict:
    h = spec.get("hypothesis") or {}
    return {"area": spec.get("area"), "units": len(spec.get("units") or []), "tramos": len(spec.get("tramos") or []),
            "kinds": sorted({u.get("kind") for u in spec.get("units") or []}), "preset": spec.get("preset"),
            "hypothesis": {k: h.get(k) for k in ("rain", "congestion_pct", "out_of_service_pct", "detour_pct") if k in h},
            "ops": spec.get("ops") or {}, "perimeter": len(spec.get("perimeter") or []),
            "notes": [{k: n.get(k) for k in ("cat", "text", "lat", "lon")} for n in spec.get("notes") or []]}


def diff_specs(a: dict, b: dict) -> list[str]:
    """Qué cambió entre dos versiones, en frases cortas y verificables."""
    out = []
    sa, sb = _spec_summary(a), _spec_summary(b)
    if sa["units"] != sb["units"]:
        out.append(f"Unidades: {sa['units']} → {sb['units']}")
    else:
        ua = {(u.get("id"), u.get("lat"), u.get("lon")) for u in a.get("units") or []}
        ub = {(u.get("id"), u.get("lat"), u.get("lon")) for u in b.get("units") or []}
        moved = len({x[0] for x in ua ^ ub})
        if moved:
            out.append(f"{moved} unidad(es) reubicada(s)")
    if sa["tramos"] != sb["tramos"]:
        out.append(f"Tramos cortados: {sa['tramos']} → {sb['tramos']}")
    if sa["perimeter"] != sb["perimeter"]:
        out.append("Perímetro dibujado" if sb["perimeter"] and not sa["perimeter"] else "Perímetro quitado" if not sb["perimeter"] else "Perímetro modificado")
    if len(sa["notes"]) != len(sb["notes"]):
        out.append(f"Notas: {len(sa['notes'])} → {len(sb['notes'])}")
    if sa["preset"] != sb["preset"]:
        out.append(f"Escenario «¿qué pasa si…?»: {sa['preset'] or '—'} → {sb['preset'] or '—'}")
    for k, v in sb["hypothesis"].items():
        if sa["hypothesis"].get(k) != v:
            out.append(f"{k}: {sa['hypothesis'].get(k)} → {v}")
    for k, v in sb["ops"].items():
        if sa["ops"].get(k) != v:
            out.append(f"{k}: {sa['ops'].get(k)} → {v}")
    aa, ab = sa["area"] or {}, sb["area"] or {}
    if aa.get("radius_km") != ab.get("radius_km"):
        out.append(f"Radio: {aa.get('radius_km')} → {ab.get('radius_km')} km")
    if (aa.get("lat"), aa.get("lon")) != (ab.get("lat"), ab.get("lon")):
        out.append("Zona desplazada")
    return out or ["Sin cambios en la especificación (nueva ejecución o nota)"]


def _executive(rec: dict | None, ev: dict | None) -> list[str]:
    if not rec:
        return ["Este escenario aún no tiene una ejecución terminada: no hay cifras que resumir."]
    p, r = rec["params"], rec["results"]
    lines = []
    if p.get("engine") == "operations":
        q = r["within_target_pct"]
        lines.append(f"Con {len(p['units'])} unidad(es) y {len(p['tramos'])} tramo(s) cortado(s), el {q['p50']:g} % de las llamadas hipotéticas "
                     f"se atiende en ≤ {p['ops']['target_min']} min (rango del 90 %: {q['p5']:g}–{q['p95']:g} %).")
        rp = r["response_p50_min"]["p50"]
        if rp is not None:
            lines.append(f"La respuesta típica es de {rp:g} min; {len(rec.get('saturated') or [])} unidad(es) quedan ocupadas ≥ 80 % del tiempo.")
    elif p.get("engine") == "queue":
        a, b = r["A"]["within_30_pct"]["p50"], r["B"]["within_30_pct"]["p50"]
        lines.append(f"Llamadas atendidas en ≤ 30 min: {a}% hoy frente a {b}% con la hipótesis.")
    else:
        a, b = r["A"]["coverage_pct"]["15"]["p50"], r["B"]["coverage_pct"]["15"]["p50"]
        lines.append(f"Área a ≤ 15 min del servicio: {a:g} % hoy frente a {b:g} % con la hipótesis ({b - a:+.1f} puntos).")
    if ev:
        lines.append(f"JEV ({ev['engine']}): {ev['decision_label']}; incertidumbre {ev['uncertainty']['level']}, variabilidad {ev.get('variability', {}).get('level', '—')}.")
    return lines


def run_report(run_id: str) -> dict:
    rec = sim_runs.get_run(run_id)
    if not rec or rec.get("state") != "finalizado":
        raise ValueError("ejecución no encontrada o sin terminar")
    ev = jev.evaluate(rec)
    return {"kind": "ejecucion", "generated_at": _now(), "title": f"Simulación {run_id}", "run": _run_block(rec), "jev": ev,
            "executive": _executive(rec, ev), "limitations": LIMITS_TEXT}


def _run_block(rec: dict) -> dict:
    keep = ("run_id", "params", "results", "assumptions", "warnings", "provenance", "validity", "kind", "created_at", "saturated", "units", "sample")
    return {k: rec.get(k) for k in keep if k in rec}


def scenario_report(sid: str) -> dict:
    s = sim_scen.get(sid)
    versions, prev = [], None
    for v in s["versions"]:
        versions.append({"v": v["v"], "at": v["at"], "by": v.get("by"), "note": v.get("note"), "run_id": v.get("run_id"),
                         "metrics": v.get("metrics"), "summary": _spec_summary(v["spec"]),
                         "changes": diff_specs(prev["spec"], v["spec"]) if prev else ["Versión inicial"]})
        prev = v
    last = s["versions"][-1]
    rec = sim_runs.get_run(last["run_id"]) if last.get("run_id") else None
    rec = rec if rec and rec.get("state") == "finalizado" else None
    ev = jev.evaluate(rec) if rec else None
    parent = None
    if s.get("parent"):
        try:
            ps = sim_scen.get(s["parent"]["id"])
            parent = {"id": ps["id"], "name": ps["name"], "version": s["parent"]["version"], "metrics": ps["versions"][-1].get("metrics")}
        except ValueError:
            parent = s["parent"]
    return {"kind": "escenario", "generated_at": _now(), "title": f"Escenario «{s['name']}»", "scenario": {"id": s["id"], "name": s["name"],
            "created_at": s["created_at"], "parent": parent}, "versions": versions, "run": _run_block(rec) if rec else None, "jev": ev,
            "executive": _executive(rec, ev), "limitations": LIMITS_TEXT}


def compare_report(ids: list[str]) -> dict:
    rows, recs = [], []
    for sid in ids[:12]:
        try:
            s = sim_scen.get(sid)
        except ValueError:
            continue
        last = s["versions"][-1]
        rec = sim_runs.get_run(last["run_id"]) if last.get("run_id") else None
        rows.append({"id": s["id"], "name": s["name"], "version": last["v"], "at": last["at"], "metrics": last.get("metrics"),
                     "summary": _spec_summary(last["spec"])})
        if rec and rec.get("state") == "finalizado":
            recs.append(rec | {"label": s["name"]})
    cmp = jev.compare(recs) if len(recs) >= 2 else None
    exec_lines = []
    ranked = [r for r in rows if (r["metrics"] or {}).get("within_target_pct") is not None]
    if ranked:
        best = max(ranked, key=lambda r: r["metrics"]["within_target_pct"])
        exec_lines.append(f"Mayor proporción a tiempo: «{best['name']}» ({best['metrics']['within_target_pct']:g} %).")
    if cmp:
        exec_lines.append(f"JEV: {cmp['note']}")
    exec_lines.append("La elección corresponde a la persona responsable, considerando costos, capacidad real y criterios no modelados.")
    return {"kind": "comparacion", "generated_at": _now(), "title": "Comparación de escenarios", "rows": rows, "jev": cmp,
            "executive": exec_lines, "limitations": LIMITS_TEXT}

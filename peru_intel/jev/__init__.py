"""JEV — evaluador probabilístico y supervisor de evidencias (plan maestro §9.1), desacoplado del motor que calcula.

Separación: (a) el motor de simulación calcula; (b) JEV revisa, contrasta y decide si hace falta más evidencia;
(c) el asistente lingüístico explica; (d) la persona decide.

Contrato (estable, versión 1):
  evaluate(run) → {engine, contract, score, score_kind, probability, uncertainty, data_quality, decision, actions, facts}
  compare(runs) → {engine, contract, ranking, ties, decision, facts}
`score` es una PUNTUACIÓN INTERNA (0–100), nunca una probabilidad: `probability` es siempre None salvo que un modelo
calibrado y evaluado con datos históricos la aporte. El JEV original de otros proyectos no se ha auditado: mientras
tanto rige `jev-ref` (reglas transparentes) y un adaptador HTTP opcional (`jev_url`) que debe cumplir este contrato.
"""
from __future__ import annotations

import json
import urllib.request

from .. import config
from . import reference

CONTRACT_VERSION = 1
DECISIONS = {
    "aceptable_para_exploracion": "Aceptable para explorar (no para decidir sola)",
    "mas_iteraciones": "Repetir con más iteraciones o réplicas",
    "mas_datos": "Pedir o actualizar datos antes de concluir",
    "otro_modelo": "Contrastar con otro modelo",
    "revision_humana": "Derivar a revisión humana",
}
SCORE_KIND = "puntuacion_interna_jev"


def contract() -> dict:
    return {"contract": CONTRACT_VERSION, "engine": engine_name(), "decisions": DECISIONS, "score_kind": SCORE_KIND,
            "probability": "Siempre null: JEV no emite probabilidades sin un modelo calibrado y evaluado.",
            "original_jev": "Pendiente de auditoría (código, pruebas y propiedad intelectual); no se ha portado.",
            "external": bool(config.setting("jev_url"))}


def engine_name() -> str:
    return "jev-externo" if config.setting("jev_url") else reference.ENGINE


def _external(kind: str, payload: dict) -> dict | None:
    """Adaptador opcional: POST {kind, payload} a jev_url; solo se acepta si respeta el contrato."""
    url = config.setting("jev_url")
    if not url:
        return None
    try:
        req = urllib.request.Request(url, data=json.dumps({"kind": kind, "contract": CONTRACT_VERSION, "payload": payload}).encode(),
                                     headers={"Content-Type": "application/json",
                                              **({"Authorization": "Bearer " + config.setting("jev_api_key")} if config.setting("jev_api_key") else {})},
                                     method="POST")
        with urllib.request.urlopen(req, timeout=8) as r:
            out = json.loads(r.read().decode("utf-8"))
        if out.get("contract") != CONTRACT_VERSION or out.get("decision") not in DECISIONS:
            return None
        out["probability"] = out.get("probability") if out.get("probability_calibrated") else None
        return out | {"engine": "jev-externo"}
    except (OSError, ValueError):
        return None


def evaluate(run: dict) -> dict:
    out = _external("evaluate", run)
    if out:
        return out
    res = reference.evaluate(run)
    res |= {"contract": CONTRACT_VERSION, "decision_label": DECISIONS[res["decision"]], "score_kind": SCORE_KIND, "probability": None}
    if config.setting("jev_url"):
        res["fallback"] = "El JEV externo no respondió o no cumplió el contrato: se usó jev-ref."
    return res


def compare(runs: list[dict]) -> dict:
    out = _external("compare", {"runs": runs})
    if out:
        return out
    res = reference.compare(runs)
    return res | {"contract": CONTRACT_VERSION, "decision_label": DECISIONS[res["decision"]], "score_kind": SCORE_KIND, "probability": None}

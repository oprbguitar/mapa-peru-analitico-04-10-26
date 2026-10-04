"""Verifier: cada cifra, fecha y cita del texto debe tener soporte en los hechos del DataAgent.

Resultado por oración: VERIFICADO | NO VERIFICADO (con motivo). Determinista: no usa un LLM para verificar.
"""
from __future__ import annotations

import re

NUM = re.compile(r"(?<![\w\[])[-−]?\d{1,3}(?:[   .]\d{3})+(?:,\d+)?|(?<![\w\[])[-−]?\d+(?:[.,]\d+)?")
CITE = re.compile(r"\[(F\d+)\]")
CAUSAL = re.compile(r"\b(causa(?:do|da|n)?|provoca(?:do|da|n)?|se debe a|debido a|origina(?:do|da)?|culpa de)\b", re.I)
PERIOD = re.compile(r"\b(?:19|20)\d{2}(?:-\d{2})?\b")


def _candidates(tok: str) -> set[float]:
    t = tok.replace("−", "-").replace(" ", " ").replace(" ", " ")
    out = set()
    a = t.replace(" ", "").replace(".", "").replace(",", ".")          # 12.451,5 → 12451.5 (es-PE)
    b = t.replace(" ", "").replace(",", "")                            # 12,451.5 → 12451.5
    c = t.replace(" ", "").replace(",", ".")                           # 27,25 → 27.25
    for s in (a, b, c):
        try:
            out.add(float(s))
        except ValueError:
            pass
    return out


def _matches(vals: set[float], fact_values: list[float]) -> bool:
    for v in vals:
        for f in fact_values:
            if f == 0 and abs(v) < 1e-9:
                return True
            if f and (abs(v - f) <= max(0.051, abs(f) * 0.006) or abs(abs(v) - abs(f)) <= max(0.051, abs(f) * 0.006)):
                return True
    return False


def verify(text: str, facts: list[dict]) -> dict:
    ids = {f["id"]: f for f in facts}
    values = [float(f["value"]) for f in facts if isinstance(f["value"], (int, float))]
    periods = " ".join(str(f["period"]) for f in facts)
    # números que forman parte de unidades y etiquetas declaradas («por 100 mil», «de 25 departamentos», «95 %»)
    for f in facts:
        for tok in NUM.findall(f"{f['unit']} {f['label']}"):
            values.extend(_candidates(tok))
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text or "") if s.strip()]
    report = []
    unverified = 0
    for s in sentences:
        problems = []
        for cid in CITE.findall(s):
            if cid not in ids:
                problems.append(f"cita inexistente [{cid}]")
        clean = CITE.sub(" ", s)
        for m in NUM.finditer(clean):
            tok = m.group(0)
            if PERIOD.fullmatch(tok) and tok[:4] in periods:
                continue
            if re.fullmatch(r"\d", tok):  # dígitos sueltos (viñetas, «3 a 5») no se consideran cifras
                continue
            if not _matches(_candidates(tok), values):
                problems.append(f"cifra sin soporte: {tok}")
        if CAUSAL.search(clean):
            problems.append("afirma causalidad sin evidencia")
        status = "NO VERIFICADO" if problems else "VERIFICADO"
        unverified += bool(problems)
        report.append({"sentence": s, "status": status, "problems": problems})
    total = len(report)
    if not total:
        return {"status": "SIN TEXTO", "sentences": [], "unverified": 0, "total": 0}
    return {"status": "VERIFICADO" if not unverified else "NO VERIFICADO" if unverified == total else "PARCIAL",
            "sentences": report, "unverified": unverified, "total": total}

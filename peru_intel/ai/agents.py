"""Tres agentes lógicos: DataAgent → GeoAnalyst → Verifier.

DataAgent   obtiene datos SOLO mediante herramientas deterministas (SQL sobre Parquet, índice, proyección).
            Cada dato sale numerado como hecho [F1], [F2]… con valor, unidad, período, fuente y naturaleza.
GeoAnalyst  redacta comparaciones y explicaciones a partir de esos hechos (LLM local por defecto). Si no
            hay modelo disponible, produce un resumen determinista (sin IA) y lo declara.
Verifier    revisa cada cifra, fecha y cita del texto contra los hechos; lo que no encuentra se marca
            NO VERIFICADO. También señala lenguaje causal sin evidencia.

Ámbito: territorios y series agregadas. Nunca personas (sin predicción individual ni rankings de personas).
"""
from __future__ import annotations

import re

from ..analytics import crime, forecast, index
from . import router, verifier


def _fmt(v, nd=1) -> str:
    if v is None:
        return "—"
    if isinstance(v, int) or (isinstance(v, float) and v.is_integer() and abs(v) >= 100):
        return f"{int(v):,}".replace(",", " ")
    return f"{v:,.{nd}f}".replace(",", " ").replace(".", ",")


class DataAgent:
    def collect(self, ubigeo: str) -> dict:
        prof = crime.region_profile(ubigeo)
        facts: list[dict] = []

        def add(label, value, unit, period, source, kind):
            if value is None:
                return
            facts.append({"id": f"F{len(facts) + 1}", "label": label, "value": value, "unit": unit,
                          "period": period, "source": source, "kind": kind})

        s = prof["sidpol"]
        add("Denuncias policiales (todas las modalidades)", s["total"], "denuncias", s["period"], "mininter_sidpol", "oficial")
        add("Tasa de denuncias", s["rate"], "por 100 mil hab.", s["period"], "mininter_sidpol + inei_poblacion", "calculado")
        add("Variación de denuncias", s["change_pct"], f"% vs {s['comparison']}", s["period"], "mininter_sidpol", "calculado")
        add("Población proyectada", s["population"], "hab.", s["period"], "inei_poblacion", "estimacion")
        add("Denuncias en el año en curso", s["ytd"]["count"], "denuncias", s["ytd"]["label"], "mininter_sidpol", "oficial")
        add("Variación del año en curso", s["ytd"]["change_pct"], f"% vs {s['ytd']['prev_label']}", s["ytd"]["label"],
            "mininter_sidpol", "calculado")
        for m in s["by_modality"][:5]:
            add(f"Denuncias por {m['modalidad'].lower()}", m["count"], "denuncias", s["period"], "mininter_sidpol", "oficial")
            add(f"Variación de {m['modalidad'].lower()}", m["change_pct"], f"% vs {s['comparison']}", s["period"],
                "mininter_sidpol", "calculado")
        for i in prof["indicators"]:
            add(i["label"].split(" (")[0], i["value"], i["unit"], str(i["year"]), "mininter_indicadores", i["kind"])
        if prof.get("mpfn"):
            mp = prof["mpfn"]
            add("Delitos denunciados ante el Ministerio Público (sede fiscal)", mp["count"], "denuncias", str(mp["year"]),
                "mpfn_delitos", "oficial")
        for d in prof.get("devida") or []:
            add(d["etiqueta"], d["valor"], d["unidad"], str(d["anio"]), "devida", "oficial")
        if prof["level"] == "departamento":
            ix = index.for_region(ubigeo)
            if ix and ix["score"] is not None:
                add("Índice Situacional Perú v1 (no oficial)", ix["score"], "puntos (0–100)", "último disponible",
                    "indice_situacional_v1", "calculado")
                add("Posición en el índice", ix.get("rank"), "de 25 departamentos", "último disponible",
                    "indice_situacional_v1", "calculado")
                for c in ix["components"]:
                    add(f"Aporte de «{c['label']}» al índice", c["share_pct"], "% del puntaje", c["period"],
                        "indice_situacional_v1", "calculado")
        fc = forecast.forecast(ubigeo)
        if fc.get("available"):
            for f in fc["forecast"][:3]:
                add(f"Proyección de denuncias {f['period']}", f["point"], "denuncias", f["period"], fc["method"], "proyeccion")
                add(f"Límite inferior 95 % {f['period']}", f["lo95"], "denuncias", f["period"], fc["method"], "proyeccion")
                add(f"Límite superior 95 % {f['period']}", f["hi95"], "denuncias", f["period"], fc["method"], "proyeccion")
            add("Anomalía del último mes (z)", fc["anomaly"]["z"], "desviaciones", fc["anomaly"]["period"], "cálculo propio",
                "calculado")
        return {"profile": prof, "facts": facts, "forecast": fc}


SYSTEM = """Eres GeoAnalyst, analista territorial del Perú. Respondes en español de Perú, claro y sobrio.
Reglas estrictas:
1. Usa SOLO los hechos numerados que te doy. Cada cifra que escribas debe ir seguida de su cita, por ejemplo: 352 778 denuncias [F1].
2. No inventes cifras, fechas ni fuentes. Si algo no está en los hechos, di que no hay dato.
3. No afirmes causalidad ("causa", "provoca", "se debe a"). Puedes decir "coincide temporalmente con".
4. Distingue datos oficiales, cálculos, estimaciones y proyecciones.
5. Nunca hables de personas concretas ni de probabilidades individuales; solo territorios y agregados.
6. Máximo 220 palabras, en 3 a 5 viñetas y una línea final de cautela."""


class GeoAnalyst:
    def analyze(self, ubigeo: str, question: str, packet: dict) -> dict:
        prov, reason = router.choose("aggregate", "analisis")
        router.log("analisis", prov.id if prov else None, reason, ubigeo)
        facts_txt = "\n".join(f"[{f['id']}] {f['label']}: {f['value']} {f['unit']} · período {f['period']} · "
                              f"fuente {f['source']} · {f['kind']}" for f in packet["facts"])
        prof = packet["profile"]
        if prov is None:
            return {"text": self._deterministic(prof, packet["facts"]), "engine": "resumen determinista (sin IA)",
                    "route_reason": reason, "kind": "calculado"}
        msgs = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"Territorio: {prof['nombre']} ({prof['level']}, UBIGEO {prof['ubigeo']}).\n"
                                            f"Pregunta: {question or '¿Cómo está la situación de seguridad y qué se espera?'}\n\n"
                                            f"HECHOS:\n{facts_txt}"}]
        try:
            text = prov.chat(msgs)
            if not text.strip():
                raise ValueError("respuesta vacía del modelo")
        except Exception as e:  # noqa: BLE001
            return {"text": self._deterministic(prof, packet["facts"]), "engine": "resumen determinista (fallo del modelo)",
                    "route_reason": f"{reason} · error: {e}", "kind": "calculado"}
        return {"text": text.strip(), "engine": f"{prov.id}:{prov.model()}", "route_reason": reason, "kind": "ia"}

    @staticmethod
    def _deterministic(prof: dict, facts: list[dict]) -> str:
        f = {x["label"]: x for x in facts}
        s = prof["sidpol"]
        lines = []
        a = f.get("Denuncias policiales (todas las modalidades)")
        if a:
            lines.append(f"- En {s['period']} se registraron {_fmt(a['value'])} denuncias policiales [{a['id']}].")
        r = f.get("Tasa de denuncias")
        if r:
            lines.append(f"- Equivale a {_fmt(r['value'])} por 100 mil habitantes [{r['id']}] (dato calculado con población proyectada).")
        c = f.get("Variación de denuncias")
        if c:
            lines.append(f"- Variación frente a {s['comparison']}: {_fmt(c['value'])} % [{c['id']}].")
        y = f.get("Variación del año en curso")
        if y:
            lines.append(f"- En {s['ytd']['label']} la variación interanual es {_fmt(y['value'])} % [{y['id']}].")
        ix = f.get("Índice Situacional Perú v1 (no oficial)")
        if ix:
            lines.append(f"- Índice Situacional v1 (no oficial): {_fmt(ix['value'])} puntos [{ix['id']}].")
        p = next((x for x in facts if x["label"].startswith("Proyección de denuncias")), None)
        if p:
            lo = next((x for x in facts if x["label"].startswith("Límite inferior 95 %")), None)
            hi = next((x for x in facts if x["label"].startswith("Límite superior 95 %")), None)
            lines.append(f"- Proyección {p['period']}: {_fmt(p['value'])} denuncias [{p['id']}], intervalo 95 % "
                         f"{_fmt(lo['value'])}–{_fmt(hi['value'])} [{lo['id']}][{hi['id']}].")
        lines.append("Cautela: denuncias registradas no equivalen a delitos ocurridos; las variaciones pueden reflejar cambios de registro.")
        return "\n".join(lines)


def ask(ubigeo: str, question: str = "") -> dict:
    if re.search(r"\b(qui[eé]n|persona|individuo|nombre de|sospechoso)\b", question or "", re.I):
        return {"refused": True, "text": "Este sistema analiza territorios y series agregadas. No evalúa ni predice "
                                         "conductas de personas."}
    packet = DataAgent().collect(ubigeo)
    answer = GeoAnalyst().analyze(ubigeo, question, packet)
    check = verifier.verify(answer["text"], packet["facts"])
    return {"ubigeo": ubigeo, "nombre": packet["profile"]["nombre"], "question": question, "answer": answer,
            "verification": check, "facts": packet["facts"]}

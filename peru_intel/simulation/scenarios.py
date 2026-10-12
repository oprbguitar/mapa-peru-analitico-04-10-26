"""Escenarios guardables (plan maestro §6–§7): base, duplicados y versiones con trazabilidad.

Cada escenario vive en data/simulation/scenarios/<id>.json. Guardar nunca sobrescribe: añade una versión con fecha,
autor, especificación (zona, unidades, tramos, hipótesis, supuestos) y el run_id de su última ejecución.
Duplicar crea un escenario nuevo que recuerda de cuál partió; el original no cambia.

Ciclo de vida (plan maestro §7.3): borrador → configurado → validado_para_simular → finalizado → revisado → archivado.
«configurado» y «finalizado» se alcanzan solos (al tener zona y unidades; al guardar una ejecución terminada);
validar, revisar y archivar son decisiones de coordinación y quedan en el historial. Un borrador nunca se presenta
como recomendación validada. Exportar/importar usa JSON con huella SHA-256 del contenido.
"""
from __future__ import annotations

import hashlib
import json
import re
import secrets
from datetime import datetime, timezone

from .. import config
from .accessibility import SimError

MAX_VERSIONS = 50
STATES = {"borrador": "Borrador", "configurado": "Configurado", "validado_para_simular": "Validado para simular",
          "finalizado": "Finalizado", "revisado": "Revisado", "archivado": "Archivado"}
# transiciones manuales permitidas (las automáticas las aplica save())
MANUAL = {"validado_para_simular": {"configurado", "finalizado"}, "revisado": {"finalizado"},
          "archivado": set(STATES) - {"archivado"}, "borrador": {"archivado"}}
REVIEW_STATES = {"validado_para_simular", "revisado", "archivado", "borrador"}
NAME = re.compile(r"^[\w\sáéíóúñÁÉÍÓÚÑüÜ.,:()/+-]{1,60}$")


def _dir():
    d = config.DATA / "simulation" / "scenarios"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _path(sid: str):
    if not re.fullmatch(r"esc-[0-9a-f]{8}", sid or ""):
        raise SimError("escenario no válido")
    return _dir() / f"{sid}.json"


def _clean_name(name) -> str:
    name = str(name or "").strip()
    if not NAME.match(name):
        raise SimError("nombre del escenario: 1 a 60 letras, números o signos simples")
    return name


def _summary(s: dict) -> dict:
    v = s["versions"][-1]
    return {"id": s["id"], "name": s["name"], "parent": s.get("parent"), "created_at": s["created_at"], "updated_at": v["at"],
            "version": v["v"], "engine": v["spec"].get("engine"), "run_id": v.get("run_id"), "metrics": v.get("metrics"),
            "state": s.get("state", "borrador"), "imported_from": s.get("imported_from")}


def _auto_state(s: dict, v: dict) -> str:
    """Estado tras guardar: finalizado con ejecución; configurado con zona y unidades; si no, borrador."""
    spec = v["spec"]
    if s.get("state") == "archivado":
        return "archivado"
    if v.get("run_id") and v.get("metrics"):
        return "finalizado"
    if spec.get("area") and (spec.get("units") or spec.get("engine") != "operations"):
        return "validado_para_simular" if s.get("state") == "validado_para_simular" else "configurado"
    return "borrador"


def _move(s: dict, to: str, by: str, note: str = "") -> None:
    frm = s.get("state", "borrador")
    if frm == to:
        return
    s["state"] = to
    s.setdefault("states", []).append({"at": _now(), "by": by, "from": frm, "to": to, "note": note[:300]})


def save(body: dict, by: str = "usuario-local") -> dict:
    spec = body.get("spec")
    if not isinstance(spec, dict) or not spec.get("engine"):
        raise SimError("falta la especificación del escenario")
    if len(json.dumps(spec)) > 200_000:
        raise SimError("escenario demasiado grande")
    sid = body.get("id")
    if sid:
        path = _path(sid)
        if not path.exists():
            raise SimError("escenario no encontrado")
        s = json.loads(path.read_text(encoding="utf-8"))
        if body.get("name"):
            s["name"] = _clean_name(body["name"])
    else:
        s = {"id": f"esc-{secrets.token_hex(4)}", "name": _clean_name(body.get("name") or "Escenario"), "created_at": _now(),
             "parent": None, "versions": [], "state": "borrador", "states": []}
        path = _path(s["id"])
    s["versions"].append({"v": len(s["versions"]) + 1, "at": _now(), "by": by, "spec": spec,
                          "run_id": body.get("run_id"), "metrics": body.get("metrics"), "note": str(body.get("note") or "")[:200]})
    s["versions"] = s["versions"][-MAX_VERSIONS:]
    _move(s, _auto_state(s, s["versions"][-1]), by, "automático al guardar")
    path.write_text(json.dumps(s, ensure_ascii=False), encoding="utf-8")
    return s


def set_state(sid: str, to: str, by: str, note: str = "") -> dict:
    if to not in MANUAL:
        raise SimError("estado no válido para cambio manual")
    s = get(sid)
    frm = s.get("state", "borrador")
    if frm not in MANUAL[to]:
        raise SimError(f"No se puede pasar de «{STATES.get(frm, frm)}» a «{STATES[to]}»")
    if to == "revisado" and len(note.strip()) < 5:
        raise SimError("La revisión requiere una nota (mínimo 5 caracteres)")
    if to == "validado_para_simular":
        spec = s["versions"][-1]["spec"]
        if not spec.get("area") or (spec.get("engine") == "operations" and not spec.get("units")):
            raise SimError("Para validar: zona y al menos una unidad")
    _move(s, to, by, note)
    _path(sid).write_text(json.dumps(s, ensure_ascii=False), encoding="utf-8")
    return s


def _digest(s: dict) -> str:
    core = {k: s[k] for k in ("name", "created_at", "versions")}
    return hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def export(sid: str) -> dict:
    s = get(sid)
    return {"format": "mapa-peru-escenario", "format_version": 1, "exported_at": _now(), "sha256": _digest(s), "scenario": s}


def import_(payload: dict, by: str) -> dict:
    if not isinstance(payload, dict) or payload.get("format") != "mapa-peru-escenario":
        raise SimError("archivo no reconocido: se espera un escenario exportado por Mapa Perú Analítico")
    s = payload.get("scenario")
    if not isinstance(s, dict) or not isinstance(s.get("versions"), list) or not s["versions"]:
        raise SimError("escenario sin versiones")
    if payload.get("sha256") != _digest(s):
        raise SimError("la huella SHA-256 no coincide: el archivo fue modificado o está incompleto")
    if len(json.dumps(s)) > 2_000_000 or len(s["versions"]) > MAX_VERSIONS:
        raise SimError("escenario demasiado grande")
    for v in s["versions"]:
        if not isinstance(v.get("spec"), dict) or not v["spec"].get("engine"):
            raise SimError("versión sin especificación válida")
    new = {"id": f"esc-{secrets.token_hex(4)}", "name": _clean_name(f"{s.get('name', 'Escenario')} (importado)"[:60]),
           "created_at": _now(), "parent": None, "imported_from": {"id": s.get("id"), "sha256": payload["sha256"], "at": _now(), "by": by},
           "versions": [{**v, "run_id": None} for v in s["versions"]], "state": "borrador",
           "states": [{"at": _now(), "by": by, "from": None, "to": "borrador", "note": "importado: las ejecuciones se repiten en esta PC"}]}
    _move(new, _auto_state(new | {"state": "borrador"}, new["versions"][-1] | {"run_id": None}), by, "automático al importar")
    _path(new["id"]).write_text(json.dumps(new, ensure_ascii=False), encoding="utf-8")
    return new


def duplicate(sid: str, name: str | None = None, by: str = "usuario-local") -> dict:
    src = get(sid)
    last = src["versions"][-1]
    copy = {"id": f"esc-{secrets.token_hex(4)}", "name": _clean_name(name or f"{src['name']} (copia)")[:60], "created_at": _now(),
            "parent": {"id": src["id"], "version": last["v"]},
            "versions": [{"v": 1, "at": _now(), "by": by, "spec": last["spec"], "run_id": last.get("run_id"),
                          "metrics": last.get("metrics"), "note": f"Duplicado de {src['name']} v{last['v']}"}], "state": "borrador"}
    _move(copy, _auto_state(copy, copy["versions"][0]), by, "automático al duplicar")
    _path(copy["id"]).write_text(json.dumps(copy, ensure_ascii=False), encoding="utf-8")
    return copy


def get(sid: str) -> dict:
    path = _path(sid)
    if not path.exists():
        raise SimError("escenario no encontrado")
    return json.loads(path.read_text(encoding="utf-8"))


def list_all(limit: int = 50) -> list[dict]:
    files = sorted(_dir().glob("esc-*.json"), key=lambda f: f.stat().st_mtime, reverse=True)[:limit]
    out = []
    for f in files:
        try:
            out.append(_summary(json.loads(f.read_text(encoding="utf-8"))))
        except (OSError, ValueError, KeyError, IndexError):
            continue
    return out

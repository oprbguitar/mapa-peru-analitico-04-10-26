"""Escenarios guardables (plan maestro §6–§7): base, duplicados y versiones con trazabilidad.

Cada escenario vive en data/simulation/scenarios/<id>.json. Guardar nunca sobrescribe: añade una versión con fecha,
autor, especificación (zona, unidades, tramos, hipótesis, supuestos) y el run_id de su última ejecución.
Duplicar crea un escenario nuevo que recuerda de cuál partió; el original no cambia.
"""
from __future__ import annotations

import json
import re
import secrets
from datetime import datetime, timezone

from .. import config
from .accessibility import SimError

MAX_VERSIONS = 50
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
            "version": v["v"], "engine": v["spec"].get("engine"), "run_id": v.get("run_id"), "metrics": v.get("metrics")}


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
             "parent": None, "versions": []}
        path = _path(s["id"])
    s["versions"].append({"v": len(s["versions"]) + 1, "at": _now(), "by": by, "spec": spec,
                          "run_id": body.get("run_id"), "metrics": body.get("metrics"), "note": str(body.get("note") or "")[:200]})
    s["versions"] = s["versions"][-MAX_VERSIONS:]
    path.write_text(json.dumps(s, ensure_ascii=False), encoding="utf-8")
    return s


def duplicate(sid: str, name: str | None = None, by: str = "usuario-local") -> dict:
    src = get(sid)
    last = src["versions"][-1]
    copy = {"id": f"esc-{secrets.token_hex(4)}", "name": _clean_name(name or f"{src['name']} (copia)")[:60], "created_at": _now(),
            "parent": {"id": src["id"], "version": last["v"]},
            "versions": [{"v": 1, "at": _now(), "by": by, "spec": last["spec"], "run_id": last.get("run_id"),
                          "metrics": last.get("metrics"), "note": f"Duplicado de {src['name']} v{last['v']}"}]}
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

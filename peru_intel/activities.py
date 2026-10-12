"""Actividades asignadas (plan maestro §8): un coordinador asigna, el participante ve y actualiza solo las suyas.

Cada actividad puede vincularse a un escenario; cada cambio de estado queda en su historial (fecha, autor, nota) y en la
auditoría, y avisa al asignado o a la coordinación.
"""
from __future__ import annotations

import json
import secrets
import threading
from datetime import date, datetime, timezone

from . import config, notify, users
from .storage import sqlite_store

STATES = {"pendiente": "Pendiente", "en_curso": "En curso", "hecha": "Hecha", "bloqueada": "Bloqueada"}
_lock = threading.Lock()


def _path():
    d = config.DATA / "users"
    d.mkdir(parents=True, exist_ok=True)
    return d / "activities.json"


def _load() -> list[dict]:
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create(body: dict) -> dict:
    me = users.require("activities.manage")
    title = str(body.get("title") or "").strip()
    if not 3 <= len(title) <= 120:
        raise users.AuthError(400, "Título: 3 a 120 caracteres")
    assignee = str(body.get("assignee") or me["id"])
    known = {u["id"]: u for u in ([users.PERSONAL] if me.get("personal") else users.directory())}
    if assignee not in known:
        raise users.AuthError(400, "La persona asignada no existe")
    due = body.get("due")
    if due:
        try:
            date.fromisoformat(str(due))
        except ValueError:
            raise users.AuthError(400, "Fecha límite: AAAA-MM-DD")
    a = {"id": f"act-{secrets.token_hex(4)}", "title": title, "detail": str(body.get("detail") or "")[:500],
         "assignee": assignee, "assignee_name": known[assignee]["name"], "scenario_id": body.get("scenario_id"),
         "due": due, "status": "pendiente", "created_by": me["name"], "created_at": _now(),
         "history": [{"at": _now(), "by": me["name"], "status": "pendiente", "note": "Asignada"}]}
    with _lock:
        _path().write_text(json.dumps(_load() + [a], ensure_ascii=False, indent=1), encoding="utf-8")
    sqlite_store.audit(me["name"], "actividad.crear", {"id": a["id"], "assignee": assignee, "scenario": a["scenario_id"]})
    notify.emit("actividad", f"Nueva actividad: {title}", f"Asignada por {me['name']}" + (f" · vence {due}" if due else ""),
                ref=a["id"], source="actividades", audience=f"user:{assignee}")
    return a


def listing() -> list[dict]:
    me = users.require("activities.own")
    items = _load()
    if not users.can(me, "activities.manage"):
        items = [a for a in items if a["assignee"] == me["id"]]
    return sorted(items, key=lambda a: (a["status"] == "hecha", a.get("due") or "9999", a["created_at"]))


def set_status(aid: str, status: str, note: str = "") -> dict:
    me = users.require("activities.own")
    if status not in STATES:
        raise users.AuthError(400, "Estado no válido")
    with _lock:
        items = _load()
        a = next((x for x in items if x["id"] == aid), None)
        if not a:
            raise users.AuthError(404, "Actividad no encontrada")
        if a["assignee"] != me["id"] and not users.can(me, "activities.manage"):
            raise users.AuthError(403, "Solo puedes actualizar tus actividades")
        a["status"] = status
        a["history"].append({"at": _now(), "by": me["name"], "status": status, "note": str(note or "")[:200]})
        _path().write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    sqlite_store.audit(me["name"], "actividad.estado", {"id": aid, "status": status})
    notify.emit("actividad", f"«{a['title']}»: {STATES[status]}", f"Actualizada por {me['name']}" + (f" · {note}" if note else ""),
                ref=aid, source="actividades", audience="rol:coordinador")
    return a

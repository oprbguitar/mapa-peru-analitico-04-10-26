"""Centro de notificaciones local (plan maestro §9): avisos diferenciados por naturaleza, con trazabilidad.

Tipos: observado (dato real nuevo) · tecnico (proveedor caído, dato antiguo) · predictivo (inferencia: SIEMPRE con su
incertidumbre y los hechos que la sustentan) · actividad (escenarios, tareas). Se guardan en
data/notifications/events.jsonl (append-only); «leído» es un estado aparte, por destinatario.
"""
from __future__ import annotations

import json
import secrets
import threading
from datetime import datetime, timezone

from . import config

TYPES = {"observado": "Evento observado", "tecnico": "Advertencia técnica", "predictivo": "Resultado predictivo", "actividad": "Actividad"}
_lock = threading.Lock()
MAX_READ = 2000


def _dir():
    d = config.DATA / "notifications"
    d.mkdir(parents=True, exist_ok=True)
    return d


def emit(kind: str, title: str, detail: str = "", *, ref: str | None = None, source: str = "sistema",
         uncertainty: str | None = None, facts: list | None = None, audience: str = "todos", dedupe: str | None = None) -> dict | None:
    if kind not in TYPES:
        raise ValueError(f"tipo de notificación no válido: {kind}")
    if kind == "predictivo" and not uncertainty:
        raise ValueError("un aviso predictivo debe declarar su incertidumbre")
    ev = {"id": f"n-{secrets.token_hex(5)}", "at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "type": kind,
          "title": str(title)[:140], "detail": str(detail)[:600], "ref": ref, "source": source, "audience": audience,
          "uncertainty": uncertainty, "facts": (facts or [])[:8], "dedupe": dedupe}
    with _lock:
        path = _dir() / "events.jsonl"
        if dedupe and path.exists():
            # no repetir el mismo aviso técnico mientras siga vigente (p. ej., un proveedor caído)
            for line in path.read_text(encoding="utf-8").splitlines()[-200:]:
                try:
                    if json.loads(line).get("dedupe") == dedupe:
                        return None
                except ValueError:
                    continue
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    return ev


def _read_ids(user: str) -> set[str]:
    p = _dir() / f"read-{user}.json"
    try:
        return set(json.loads(p.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return set()


def listing(user: str = "local", audiences: tuple[str, ...] = ("todos",), kind: str | None = None, limit: int = 50) -> dict:
    path = _dir() / "events.jsonl"
    events = []
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            try:
                ev = json.loads(line)
            except ValueError:
                continue
            if ev.get("audience", "todos") in audiences and (not kind or ev["type"] == kind):
                events.append(ev)
    read = _read_ids(user)
    events = events[-limit:][::-1]
    for ev in events:
        ev["read"] = ev["id"] in read
    return {"items": events, "unread": sum(1 for e in events if not e["read"]), "types": TYPES}


def mark_read(user: str, ids: list[str] | None, all_visible: list[str] | None = None) -> int:
    with _lock:
        read = _read_ids(user)
        new = set(ids or all_visible or [])
        read |= {i for i in new if isinstance(i, str) and i.startswith("n-")}
        (_dir() / f"read-{user}.json").write_text(json.dumps(sorted(read)[-MAX_READ:]), encoding="utf-8")
    return len(new)

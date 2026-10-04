"""Bus de eventos local (pub/sub en memoria) → Server-Sent Events hacia el mapa.

El navegador no consulta a los proveedores: escucha /api/v1/stream y, cuando una capa cambia,
pide su instantánea al backend.
"""
from __future__ import annotations

import json
import queue
import threading
import time

_SUBS: set[queue.Queue] = set()
_LOCK = threading.Lock()


def subscribe() -> queue.Queue:
    q: queue.Queue = queue.Queue(maxsize=200)
    with _LOCK:
        _SUBS.add(q)
    return q


def unsubscribe(q: queue.Queue) -> None:
    with _LOCK:
        _SUBS.discard(q)


def publish(event: str, data: dict) -> None:
    msg = f"event: {event}\ndata: {json.dumps(data | {'ts': time.time()}, ensure_ascii=False)}\n\n"
    with _LOCK:
        subs = list(_SUBS)
    for q in subs:
        try:
            q.put_nowait(msg)
        except queue.Full:  # cliente lento: se descarta su evento, no se bloquea a los demás
            pass


def subscribers() -> int:
    with _LOCK:
        return len(_SUBS)

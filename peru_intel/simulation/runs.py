"""Registro de ejecuciones: cada corrida conserva run_id, parámetros, semilla, versión del motor y procedencia.

Idempotente: los mismos parámetros (incluida la semilla) devuelven la ejecución ya registrada, sin recalcular.
Se guarda en data/simulation/runs/<run_id>.json (fuera de data/raw; nunca se publica en la nube).
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone

from .. import config
from . import accessibility

_lock = threading.Lock()  # una simulación a la vez: el visor sigue respondiendo y la CPU no se satura
STATES = ("en_ejecucion", "finalizado", "fallido")


def _dir():
    d = config.DATA / "simulation" / "runs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _summary(rec: dict) -> dict:
    p = rec.get("params") or {}
    r = (rec.get("results") or {})
    return {"run_id": rec["run_id"], "state": rec["state"], "created_at": rec["created_at"], "service": p.get("service"),
            "area": p.get("area"), "seed": p.get("seed"), "iterations": p.get("iterations"), "hypothesis": p.get("hypothesis"),
            "diff": r.get("diff"), "label": rec.get("label")}


def run_accessibility(body: dict) -> dict:
    params = accessibility.normalize(body)
    h = accessibility.params_hash(params)
    run_id = f"acc-{h}"
    path = _dir() / f"{run_id}.json"
    if path.exists():
        rec = json.loads(path.read_text(encoding="utf-8"))
        if rec.get("state") == "finalizado":
            return rec | {"reused": True}
    if not _lock.acquire(timeout=0.5):
        raise accessibility.SimError("Ya hay una simulación en curso; espera a que termine")
    try:
        started = time.time()
        rec = {"run_id": run_id, "state": "en_ejecucion", "label": str(body.get("label") or "")[:80],
               "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        try:
            out = accessibility.run(body)
        except Exception as e:
            rec |= {"state": "fallido", "error": str(e), "params": params}
            path.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            raise
        rec |= out | {"state": "finalizado", "wall_s": round(time.time() - started, 3)}
        path.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        return rec | {"reused": False}
    finally:
        _lock.release()


def list_runs(limit: int = 20) -> list[dict]:
    files = sorted(_dir().glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)[:limit]
    out = []
    for f in files:
        try:
            out.append(_summary(json.loads(f.read_text(encoding="utf-8"))))
        except (OSError, ValueError, KeyError):
            continue
    return out


def get_run(run_id: str) -> dict | None:
    if not run_id.replace("-", "").isalnum():
        return None
    path = _dir() / f"{run_id}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None

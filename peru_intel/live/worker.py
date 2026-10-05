"""Workers de ingesta en vivo: uno por proveedor, cada uno en su hilo, con backoff y caché en disco.

Bajo demanda: un worker solo consulta a su proveedor mientras alguien haya pedido la capa en los
últimos `idle_after` segundos (respeta cuotas de terceros). Si un proveedor falla, conserva su última
instantánea marcada como «desactualizada» y los demás siguen funcionando.
"""
from __future__ import annotations

import json
import threading
import time
import traceback
from typing import Callable

from .. import config
from ..sources import registry
from . import bus

WORKERS: dict[str, "Worker"] = {}


class Worker:
    def __init__(self, name: str, source_id: str, interval: float, fetch: Callable[[], dict | list],
                 idle_after: float = 600, requires: str | None = None, stale_after: float | None = None):
        self.name, self.source_id, self.interval, self.fetch = name, source_id, interval, fetch
        self.idle_after, self.requires = idle_after, requires
        self.stale_after = stale_after or interval * 4
        self.data: dict | list | None = None
        self.updated: float = 0.0
        self.error: str = ""
        self.failures = 0
        self.last_demand = 0.0
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._cache = config.LIVE / f"{name}.json"
        self._load_cache()
        WORKERS[name] = self

    # ── estado ────────────────────────────────────────────────────────────
    def configured(self) -> bool:
        return not self.requires or bool(config.setting(self.requires))

    def status(self) -> dict:
        age = time.time() - self.updated if self.updated else None
        if not self.configured():
            st = "sin_configurar"
        elif self.error and not self.data:
            st = "error"
        elif age is None:
            st = "esperando"
        elif age > self.stale_after:
            st = "desactualizado"
        else:
            st = "ok"
        return {"layer": self.name, "source_id": self.source_id, "status": st, "error": self.error or None,
                "updated": self.updated or None, "age_s": round(age) if age is not None else None,
                "count": self._count(), "requires": self.requires, "active": self.active()}

    def _count(self) -> int | None:
        d = self.data
        if isinstance(d, dict):
            for k in ("items", "features", "satellites", "stations", "cells"):
                if isinstance(d.get(k), list):
                    return len(d[k])
        return len(d) if isinstance(d, list) else None

    def active(self) -> bool:
        return time.time() - self.last_demand < self.idle_after

    # ── ciclo ─────────────────────────────────────────────────────────────
    def demand(self) -> dict:
        """Marca interés en la capa, arranca el hilo si hace falta y devuelve la instantánea actual."""
        self.last_demand = time.time()
        if self.configured():
            self.start()
            if not self.updated or time.time() - self.updated > self.interval:
                self._wake.set()
        return self.snapshot()

    def snapshot(self) -> dict:
        return {"status": self.status(), "data": self.data}

    def start(self) -> None:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return
            self._thread = threading.Thread(target=self._run, name=f"live-{self.name}", daemon=True)
            self._thread.start()

    def _run(self) -> None:
        while True:
            if not self.active():
                self._wake.wait(timeout=30)
                self._wake.clear()
                continue
            self.tick()
            delay = self.interval if not self.failures else min(self.interval * (2 ** self.failures), 1800)
            self._wake.wait(timeout=delay)
            self._wake.clear()

    def tick(self) -> None:
        try:
            data = self.fetch()
            self.data, self.updated, self.error, self.failures = data, time.time(), "", 0
            self._save_cache()
            registry.set_live_status(self.source_id, "ok")
        except Exception as e:  # noqa: BLE001 — se aísla el fallo del proveedor
            self.failures += 1
            self.error = f"{type(e).__name__}: {e}"[:300]
            registry.set_live_status(self.source_id, "error", notes=None)
            if config.setting("debug"):
                traceback.print_exc()
        bus.publish("layer", self.status())

    # ── caché en disco (arranque sin red) ─────────────────────────────────
    def _save_cache(self) -> None:
        try:
            config.LIVE.mkdir(parents=True, exist_ok=True)
            tmp = self._cache.with_suffix(".tmp")
            tmp.write_text(json.dumps({"updated": self.updated, "data": self.data}, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self._cache)
        except OSError:
            pass

    def _load_cache(self) -> None:
        try:
            c = json.loads(self._cache.read_text(encoding="utf-8"))
            self.data, self.updated = c.get("data"), float(c.get("updated") or 0)
        except (OSError, ValueError):
            pass


def all_status() -> list[dict]:
    return [w.status() for w in WORKERS.values()]

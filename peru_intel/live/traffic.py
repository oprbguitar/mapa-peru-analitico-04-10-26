"""TrafficProvider — interfaz neutral; TomTomProvider es la primera implementación (BYOK, opcional).

TomTom → proxy del backend (la clave nunca llega al navegador) → caché corta → MapLibre.
La UI no conoce a TomTom: pide /api/v1/intel/traffic/tiles/{z}/{x}/{y}.png y /api/v1/intel/traffic/point.
Se conservan los valores numéricos que entrega la fuente (velocidad actual, de flujo libre, confianza,
cierre de vía) además del color.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.parse

from .. import config
from ..sources import registry
from ..sources.harvester import http_get


class TrafficProvider:
    name = "base"
    source_id = ""

    def configured(self) -> bool:
        return False

    def tile(self, z: int, x: int, y: int) -> bytes | None:
        raise NotImplementedError

    def point(self, lat: float, lon: float) -> dict:
        raise NotImplementedError


class TomTomProvider(TrafficProvider):
    name = "tomtom"
    source_id = "tomtom_traffic"
    TILE_TTL = 120

    def __init__(self):
        self._cache: dict[tuple, tuple[float, bytes]] = {}
        self._lock = threading.Lock()

    def key(self) -> str:
        return config.setting("tomtom_key")

    def configured(self) -> bool:
        return bool(self.key())

    def tile(self, z: int, x: int, y: int) -> bytes | None:
        if not self.configured() or not (0 <= z <= 22):
            return None
        k = (z, x, y)
        with self._lock:
            hit = self._cache.get(k)
            if hit and time.time() - hit[0] < self.TILE_TTL:
                return hit[1]
        url = (f"https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png"
               f"?key={urllib.parse.quote(self.key())}&tileSize=256")
        data = http_get(url, timeout=15, retries=1, min_interval=0.02)
        with self._lock:
            if len(self._cache) > 3000:
                self._cache.clear()
            self._cache[k] = (time.time(), data)
        registry.set_live_status(self.source_id, "ok")
        return data

    def point(self, lat: float, lon: float) -> dict:
        if not self.configured():
            raise RuntimeError("Falta la clave de TomTom")
        url = (f"https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point={lat:.5f},{lon:.5f}"
               f"&unit=KMPH&key={urllib.parse.quote(self.key())}")
        d = json.loads(http_get(url, timeout=15, retries=1)).get("flowSegmentData", {})
        cur, free = d.get("currentSpeed"), d.get("freeFlowSpeed")
        ratio = (cur / free) if cur and free else None
        return {"current_speed": cur, "free_flow_speed": free, "current_travel_time": d.get("currentTravelTime"),
                "free_flow_travel_time": d.get("freeFlowTravelTime"), "confidence": d.get("confidence"),
                "road_closure": d.get("roadClosure"), "frc": d.get("frc"), "timestamp": time.time(),
                "level": None if ratio is None else "fluido" if ratio >= .85 else "medio" if ratio >= .65 else
                "lento" if ratio >= .4 else "congestionado", "provider": "TomTom"}


PROVIDER: TrafficProvider = TomTomProvider()

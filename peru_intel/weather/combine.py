"""Combinación de proveedores meteorológicos para un punto.

    MAPA (clic en cualquier punto del mundo)
        │
        ├─ Open-Meteo (principal) ─┐
        ├─ MET Norway (respaldo) ──┤  en paralelo, cada uno con su caché y su cuota diaria
        ├─ WeatherAPI / Visual Crossing / OpenWeather / Tomorrow.io (si hay clave)
        │                          │
        └─ ¿Está en Perú? ── sí ──► SENAMHI: estación más cercana + capas oficiales IDESEP sugeridas

Resultado:
  primary    el primer proveedor del orden que respondió (se muestra como «principal»)
  results    TODOS los proveedores, cada uno con su naturaleza (modelo / tercero / oficial) — nunca se mezclan
  consensus  CALCULADO: mediana, mínimo, máximo y n por variable numérica (indica cuánto discrepan las fuentes)
"""
from __future__ import annotations

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from statistics import median

from .. import config
from ..map import territory
from .providers import DEFAULT_ORDER, PROVIDERS

CACHE_TTL = 600          # 10 min por punto redondeado
GRID = 0.05              # ~5 km: dos clics cercanos comparten consulta
NUMERIC = ("temp_c", "feels_c", "rh_pct", "precip_mm", "pressure_hpa", "cloud_pct", "wind_kmh", "gust_kmh", "visibility_km", "uv")
PERU_BOX = (-18.6, -81.6, 0.2, -68.4)

_LOCK = threading.Lock()
_CACHE: dict[tuple, tuple[float, dict]] = {}
_POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="wx")


# ── cuotas diarias (persisten en data/live/weather_quota.json) ──────────────
def _quota_path():
    return config.LIVE / "weather_quota.json"


def _quota_load() -> dict:
    try:
        q = json.loads(_quota_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        q = {}
    today = time.strftime("%Y-%m-%d")
    return q if q.get("date") == today else {"date": today, "used": {}}


def quota_take(pid: str, limit: int) -> bool:
    with _LOCK:
        q = _quota_load()
        used = q["used"].get(pid, 0)
        if used >= limit:
            return False
        q["used"][pid] = used + 1
        config.LIVE.mkdir(parents=True, exist_ok=True)
        tmp = _quota_path().with_suffix(".tmp")
        tmp.write_text(json.dumps(q), encoding="utf-8")
        tmp.replace(_quota_path())
        return True


def quota_status() -> dict:
    with _LOCK:
        return _quota_load()


def order() -> list[str]:
    raw = config.setting("weather_order")
    ids = [x.strip() for x in raw.split(",") if x.strip() in PROVIDERS] if raw else []
    return ids or DEFAULT_ORDER


def in_peru(lat: float, lon: float) -> bool:
    s, w, n, e = PERU_BOX
    return s <= lat <= n and w <= lon <= e


def _one(pid: str, lat: float, lon: float) -> dict:
    p = PROVIDERS[pid]
    base = {"provider": pid, "label": p.label, "kind": p.kind, "source_id": p.source_id, "attribution": p.attribution}
    if not p.configured():
        return base | {"status": "sin_configurar", "requires": p.key_setting}
    key = (pid, round(lat / GRID) * GRID, round(lon / GRID) * GRID)
    with _LOCK:
        hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1] | {"cached": True}
    if not quota_take(pid, p.daily_quota):
        return base | {"status": "cuota_agotada", "error": f"Se alcanzó el tope diario de {p.daily_quota} consultas"}
    t0 = time.time()
    try:
        data = p.fetch(lat, lon)
        out = base | {"status": "ok", "data": data, "latency_ms": round((time.time() - t0) * 1000), "fetched": time.time()}
    except Exception as e:  # noqa: BLE001 — un proveedor caído no afecta a los demás
        out = base | {"status": "error", "error": f"{type(e).__name__}: {e}"[:200]}
    if out["status"] == "ok":
        with _LOCK:
            if len(_CACHE) > 5000:
                _CACHE.clear()
            _CACHE[key] = (time.time(), out)
    return out


def consensus(results: list[dict]) -> dict:
    ok = [r["data"] for r in results if r.get("status") == "ok"]
    out = {}
    for f in NUMERIC:
        vals = [d[f] for d in ok if isinstance(d.get(f), (int, float))]
        if vals:
            out[f] = {"median": round(median(vals), 1), "min": min(vals), "max": max(vals), "spread": round(max(vals) - min(vals), 1),
                      "n": len(vals)}
    return out


def point(lat: float, lon: float, providers: list[str] | None = None) -> dict:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("coordenadas fuera de rango")
    ids = [p for p in (providers or order()) if p in PROVIDERS]
    peru = in_peru(lat, lon)
    if peru and "senamhi" not in ids:
        ids.append("senamhi")
    results = list(_POOL.map(lambda pid: _one(pid, lat, lon), ids))
    primary = next((r for r in results if r["status"] == "ok" and r["provider"] != "senamhi"), None)
    place = territory.district_at(lat, lon) if peru else None
    return {
        "lat": round(lat, 4), "lon": round(lon, 4), "in_peru": peru,
        "place": {"ubigeo": place["u"], "distrito": place["n"], "provincia": place.get("p"), "departamento": place["d"]} if place else None,
        "primary": primary, "results": results, "consensus": consensus(results),
        "order": ids,
        "note": "Cada proveedor se muestra por separado. «Consenso» es un cálculo propio (mediana y dispersión entre fuentes), "
                "no un dato de ningún proveedor. Los modelos no son observaciones.",
    }

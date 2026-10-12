"""S4 · Agentes sintéticos: evacuación civil hacia puntos seguros, con congestión emergente (plan maestro §8, S4).

Pregunta: si las personas de una zona debieran ir a los puntos seguros marcados, ¿cuánto tardaría la evacuación,
qué puntos se saturan y dónde se forma congestión? ¿Cómo cambia con tramos cortados o con más puntos seguros?

Modelo (ESTIMACIÓN exploratoria, agentes SINTÉTICOS):
  · agentes repartidos al azar y de forma uniforme en el ÁREA (perímetro dibujado o círculo). No representan ni
    infieren personas identificables, ni se reparten cifras de población por celda (regla 3 del proyecto).
  · destino: el punto seguro más cercano cuyo trayecto recto no cruza un tramo cortado; si todos lo cruzan,
    el más cercano con un rodeo declarado por tramo cruzado.
  · velocidad: a pie o en vehículo (declarada), con variación individual; congestión por densidad en celdas de
    250 m: v = v_libre ÷ (1 + 0,15·(densidad/capacidad)^4) (función BPR).
  · paso de 30 s, hasta 120 min; réplicas con semilla para intervalos; réplica 0 guarda posiciones para reproducir.
"""
from __future__ import annotations

import math
import time

import numpy as np

from . import ENGINE_VERSION
from . import accessibility as acc
from . import operations as ops

SimError = acc.SimError
MODES = {"pie": {"label": "A pie", "speed_kmh": 4.5, "cell_capacity": 400},
         "vehiculo": {"label": "En vehículo", "speed_kmh": 25.0, "cell_capacity": 60}}
LIMITS = {"agents": 5000, "points": 12, "replications": 20, "horizon_min": 120, "seconds": 20.0, "replay_agents": 400}
DEFAULTS = {"agents": 1500, "mode": "pie", "replications": 5, "horizon_min": 90, "cell_m": 250, "detour_per_tramo_pct": 60}
DT_S = 30


def normalize(body: dict) -> dict:
    common = ops.normalize({k: v for k, v in body.items() if k in ("area", "base", "hypothesis", "seed", "tramos", "perimeter", "notes")}
                           | {"units": [{"id": "x", "kind": "patrulla", "lat": (body.get("area") or {}).get("lat", -12), "lon": (body.get("area") or {}).get("lon", -77)}]})
    c = acc._clamp
    pts = body.get("safe_points") or []
    if not 1 <= len(pts) <= LIMITS["points"]:
        raise SimError(f"Marca entre 1 y {LIMITS['points']} puntos seguros")
    safe = []
    for i, q in enumerate(pts):
        lon, lat = ops._point([q.get("lon"), q.get("lat")], f"punto seguro {i + 1}")
        safe.append({"id": str(q.get("id") or f"s{i + 1}")[:24], "lon": lon, "lat": lat,
                     "capacity": int(c(q.get("capacity", 0) or 0, 0, 100000, "capacidad del punto"))})
    ag = body.get("agents") or {}
    mode = str(ag.get("mode") or DEFAULTS["mode"])
    if mode not in MODES:
        raise SimError("modo: pie o vehiculo")
    return {"engine": "agents", "engine_version": ENGINE_VERSION, "area": common["area"], "base": common["base"],
            "hypothesis": common["hypothesis"], "tramos": common["tramos"], "perimeter": common["perimeter"], "notes": common["notes"],
            "safe_points": sorted(safe, key=lambda s: s["id"]),
            "agents": {"n": int(c(ag.get("n", DEFAULTS["agents"]), 10, LIMITS["agents"], "agentes")), "mode": mode,
                       "horizon_min": int(c(ag.get("horizon_min", DEFAULTS["horizon_min"]), 10, LIMITS["horizon_min"], "horizonte")),
                       "detour_per_tramo_pct": c(ag.get("detour_per_tramo_pct", DEFAULTS["detour_per_tramo_pct"]), 0, 300, "rodeo por tramo")},
            "replications": int(c(body.get("replications", DEFAULTS["replications"]), 1, LIMITS["replications"], "réplicas")),
            "seed": common["seed"]}


def _targets(p, lat, lon):
    """Destino de cada agente y factor de rodeo (por tramos cruzados en el trayecto recto)."""
    safe = p["safe_points"]
    slat = np.array([s["lat"] for s in safe])
    slon = np.array([s["lon"] for s in safe])
    d = acc._km(lat[:, None], lon[:, None], slat[None, :], slon[None, :])   # agentes × puntos
    n = len(lat)
    target = np.empty(n, dtype=int)
    factor = np.ones(n)
    order = np.argsort(d, axis=1)
    lat0 = p["area"]["lat"]
    for i in range(n):
        best = None
        for j in order[i]:
            crossed = ops.tramos_crossed((lon[i], lat[i]), (slon[j], slat[j]), p["tramos"], lat0) if p["tramos"] else 0
            if crossed == 0:
                best = (j, 1.0)
                break
            if best is None:
                best = (j, 1 + crossed * p["agents"]["detour_per_tramo_pct"] / 100)
        target[i], factor[i] = best
    return target, factor, slat, slon


def replicate(p: dict, rng, keep: bool, deadline: float) -> dict:
    a = p["agents"]
    n = a["n"]
    lat, lon = ops._positions(rng, p, n)
    target, factor, slat, slon = _targets(p, lat, lon)
    h = p["hypothesis"]
    v_free = MODES[a["mode"]]["speed_kmh"] * acc.RAIN[h["rain"]] * (1 - h["congestion_pct"] / 100)
    v_ind = v_free * rng.lognormal(-0.02, 0.2, n)           # variación individual de velocidad
    remaining = acc._km(lat, lon, slat[target], slon[target]) * p["base"]["circuity"] * factor   # km por recorrer
    total = remaining.copy()
    arrived = np.full(n, np.nan)
    cell_km = DEFAULTS["cell_m"] / 1000
    kx = 111.32 * math.cos(math.radians(p["area"]["lat"]))
    cap = MODES[a["mode"]]["cell_capacity"]
    steps = int(a["horizon_min"] * 60 / DT_S)
    frames, max_density = [], {}
    show = np.arange(min(n, LIMITS["replay_agents"]))
    for k in range(steps):
        if time.monotonic() > deadline:
            raise SimError(f"Límite de {LIMITS['seconds']:.0f} s alcanzado; reduce agentes o réplicas")
        moving = np.isnan(arrived)
        if not moving.any():
            break
        frac = np.where(total > 0, 1 - remaining / np.where(total > 0, total, 1), 1)   # avance relativo del trayecto
        cur_lat = lat + (slat[target] - lat) * frac
        cur_lon = lon + (slon[target] - lon) * frac
        cx = np.floor(cur_lon * kx / cell_km).astype(np.int64)
        cy = np.floor(cur_lat * 111.32 / cell_km).astype(np.int64)
        cells_xy = np.stack([cx[moving], cy[moving]], axis=1)
        uniq, inv, counts = np.unique(cells_xy, axis=0, return_inverse=True, return_counts=True)
        density = np.zeros(n)
        density[moving] = counts[np.ravel(inv)]
        for (ux, uy), cnt in zip(uniq[counts > cap * 0.5], counts[counts > cap * 0.5]):   # celdas cargadas, para el mapa
            key = (int(ux), int(uy))
            max_density[key] = max(max_density.get(key, 0), int(cnt))
        speed = v_ind / (1 + 0.15 * (density / cap) ** 4)
        remaining = np.where(moving, remaining - speed * DT_S / 3600, remaining)
        done = moving & (remaining <= 0)
        arrived[done] = (k + 1) * DT_S / 60
        remaining = np.maximum(remaining, 0)
        if keep and k % 2 == 0:   # un cuadro por minuto
            frames.append([[round(float(cur_lon[i]), 5), round(float(cur_lat[i]), 5), int(not np.isnan(arrived[i]))] for i in show])
    out = {"evacuated_pct": {str(m): float((arrived <= m).sum() / n * 100) for m in (10, 30, 60)},
           "t50_min": float(np.nanpercentile(arrived, 50)) if (~np.isnan(arrived)).sum() >= n / 2 else None,
           "t90_min": float(np.nanpercentile(arrived, 90)) if (~np.isnan(arrived)).sum() >= n * 0.9 else None,
           "not_arrived": int(np.isnan(arrived).sum()),
           "load": [int((target == j).sum()) for j in range(len(slat))],
           "detour_pct": float((factor > 1).sum() / n * 100)}
    if keep:
        cells = []
        for (ux, uy), cnt in sorted(max_density.items(), key=lambda x: -x[1])[:150]:
            cells.append({"lon": round((ux + 0.5) * cell_km / kx, 5), "lat": round((uy + 0.5) * cell_km / 111.32, 5), "max": cnt,
                          "ratio": round(cnt / cap, 2)})
        out["replay"] = {"frames": frames, "dt_min": 1, "cells": cells, "cell_m": DEFAULTS["cell_m"]}
        out["curve"] = [round(float((arrived <= m).sum() / n * 100), 1) for m in range(0, a["horizon_min"] + 1, 5)]
    return out


def run(body: dict) -> dict:
    p = normalize(body)
    t0 = time.monotonic()
    rng = np.random.default_rng(p["seed"])
    reps = [replicate(p, rng, r == 0, t0 + LIMITS["seconds"]) for r in range(p["replications"])]
    q = ops._q
    first = reps[0]
    caps = [s["capacity"] for s in p["safe_points"]]
    load = [float(np.median([r["load"][j] for r in reps])) for j in range(len(caps))]
    over = [p["safe_points"][j]["id"] for j, c in enumerate(caps) if c and load[j] > c]
    warnings = []
    if over:
        warnings.append(f"{len(over)} punto(s) seguro(s) reciben más agentes que su capacidad declarada.")
    if first["not_arrived"]:
        warnings.append(f"{first['not_arrived']} agente(s) no llegan dentro de {p['agents']['horizon_min']} min (réplica 0).")
    m = MODES[p["agents"]["mode"]]
    return {
        "params": p, "kind": "estimacion", "validity": "exploratorio · agentes sintéticos",
        "results": {"evacuated_pct": {k: q(r["evacuated_pct"][k] for r in reps) for k in ("10", "30", "60")},
                    "t50_min": q(r["t50_min"] for r in reps), "t90_min": q(r["t90_min"] for r in reps),
                    "not_arrived": q(r["not_arrived"] for r in reps), "detour_pct": q(r["detour_pct"] for r in reps)},
        "safe_points": [s | {"load_p50": load[j], "over_capacity": s["id"] in over} for j, s in enumerate(p["safe_points"])],
        "replay": first["replay"], "curve": first["curve"],
        "sample": {"replications": p["replications"], "agents": p["agents"]["n"]},
        "assumptions": [
            f"{p['agents']['n']} agentes SINTÉTICOS repartidos al azar en {'el perímetro dibujado' if p['perimeter'] else 'el área de la zona'}; "
            "no representan personas reales ni la población publicada (que no se reparte por celdas).",
            f"Movimiento {m['label'].lower()} a {m['speed_kmh']:g} km/h libres (± variación individual), en línea recta × rodeo {p['base']['circuity']:g}.",
            f"Congestión: celdas de {DEFAULTS['cell_m']} m con capacidad {m['cell_capacity']} agentes; v = v_libre ÷ (1 + 0,15·(densidad/capacidad)^4).",
            f"Cada tramo cortado cruzado suma {p['agents']['detour_per_tramo_pct']:g} % de rodeo; se prefiere un punto seguro sin cruzar tramos.",
            "Sin red vial ni comportamiento individual: sirve para comparar distribuciones de puntos seguros, no para planes operativos.",
        ],
        "warnings": warnings, "provenance": [], "elapsed_s": round(time.monotonic() - t0, 3),
    }

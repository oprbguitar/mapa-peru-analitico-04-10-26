"""S3 · Capacidad con eventos discretos (SimPy): llamadas → asignación → traslado → atención → liberación.

Pregunta: con una demanda SUPUESTA de llamadas por hora y una capacidad SUPUESTA por sede (camas o unidades), ¿cuánto se
espera, qué sedes se saturan y qué parte de las llamadas empieza a ser atendida en ≤ 30 min? ¿Cómo cambia con la hipótesis B?

Modelo (ESTIMACIÓN exploratoria; cada supuesto se devuelve con el resultado):
  · llegadas: proceso de Poisson con tasa λ declarada por el usuario. NUNCA se deriva repartiendo cifras distritales;
    las llamadas caen uniformemente en el ÁREA del círculo (no en la población).
  · asignación: cola única FIFO; cada llamada va a la sede operativa más cercana que tenga una unidad libre.
  · traslado: el mismo modelo de `accessibility` (distancia geodésica × rodeo ÷ velocidad + retardo de despacho).
  · atención: exponencial de media configurable; la unidad queda ocupada desde la asignación (traslado + atención).
  · liberación: al terminar la atención (no se modela el regreso a la base).
A y B usan los MISMOS números aleatorios (llegadas por adelgazamiento, ubicaciones, atenciones, velocidades, retardos y
disponibilidad de sedes): la diferencia mide la hipótesis, no el azar.
"""
from __future__ import annotations

import math
import time
from collections import deque

import numpy as np

from ..sources import registry
from . import ENGINE_VERSION
from . import accessibility as acc

try:  # dependencia opcional: requirements-simulation.txt
    import simpy
except ImportError:  # pragma: no cover - depende del entorno
    simpy = None

SimError = acc.SimError
WITHIN_MIN = 30
BOTTLENECK_UTIL = 0.8
LIMITS = {"rate_per_h": 120.0, "horizon_h": 72, "replications": 200, "capacity": 50, "sites": 25,
          "expected_calls": 100_000, "seconds": 20.0}
DEFAULTS = {"rate_per_h": 6.0, "capacity": 2, "service_min": 45.0, "horizon_h": 24, "replications": 30, "seed": 2026}


class SimUnavailable(SimError):
    """Falta la dependencia opcional SimPy: la API responde 503 con la instrucción de instalación."""


def available() -> bool:
    return simpy is not None


def normalize(body: dict) -> dict:
    """Reusa la validación de área, servicio, base e hipótesis de `accessibility` y añade la demanda y la capacidad."""
    common = acc.normalize({k: v for k, v in body.items() if k in ("area", "service", "base", "hypothesis", "seed")})
    c = acc._clamp
    q = body.get("queue") or {}
    hyp = body.get("hypothesis") or {}
    over = q.get("capacity_by_id") or {}
    if not isinstance(over, dict):
        raise SimError("capacidad por sede: objeto {id: unidades}")
    p = {
        "engine": "queue", "engine_version": ENGINE_VERSION,
        "area": common["area"], "service": common["service"], "base": common["base"],
        "hypothesis": common["hypothesis"] | {"demand_pct": c(hyp.get("demand_pct", 0), -50, 200, "cambio de demanda")},
        "queue": {"rate_per_h": c(q.get("rate_per_h", DEFAULTS["rate_per_h"]), 0.1, LIMITS["rate_per_h"], "llamadas por hora"),
                  "capacity": int(c(q.get("capacity", DEFAULTS["capacity"]), 1, LIMITS["capacity"], "unidades por sede")),
                  "capacity_by_id": {str(k): int(c(v, 0, LIMITS["capacity"], "unidades por sede"))
                                     for k, v in sorted(over.items())[:LIMITS["sites"]]},
                  "service_min": c(q.get("service_min", DEFAULTS["service_min"]), 1, 720, "atención media"),
                  "horizon_h": int(c(q.get("horizon_h", DEFAULTS["horizon_h"]), 1, LIMITS["horizon_h"], "horizonte")),
                  "max_sites": int(c(q.get("max_sites", LIMITS["sites"]), 1, LIMITS["sites"], "sedes"))},
        "replications": int(c(body.get("replications", DEFAULTS["replications"]), 1, LIMITS["replications"], "réplicas")),
        "seed": common["seed"],
    }
    lam_max = p["queue"]["rate_per_h"] * max(1.0, 1 + p["hypothesis"]["demand_pct"] / 100)
    if lam_max * p["queue"]["horizon_h"] * p["replications"] > LIMITS["expected_calls"]:
        raise SimError(f"Demasiadas llamadas esperadas (> {LIMITS['expected_calls']:,}); reduce tasa, horizonte o réplicas".replace(",", " "))
    return p


# ── núcleo SimPy (independiente de datos: se prueba con un caso M/M/1) ──────────────────────────────────────────────
def simulate(arrivals: np.ndarray, service: np.ndarray, travel: np.ndarray, capacity: list[int], horizon: float) -> dict:
    """Una réplica. `arrivals` (min, crecientes), `service` (min) y `travel` (llamadas × sedes, min; inf = sede fuera).

    Devuelve por llamada la espera en cola y la respuesta (espera + traslado), y por sede el tiempo ocupado dentro del
    horizonte, llamadas atendidas y derivadas (su sede operativa más cercana estaba llena). Las llamadas llegan solo
    dentro del horizonte; el sistema se vacía hasta 2× el horizonte y lo que siga en cola se informa como sin asignar.
    """
    if simpy is None:
        raise SimUnavailable("Falta SimPy para el motor de capacidad: pip install -r requirements-simulation.txt")
    env = simpy.Environment()
    n_sites = len(capacity)
    free = list(capacity)
    busy_time = np.zeros(n_sites)
    served = np.zeros(n_sites, dtype=int)
    diverted = np.zeros(n_sites, dtype=int)
    n = len(arrivals)
    wait = np.full(n, np.nan)
    resp = np.full(n, np.nan)
    order = np.argsort(travel, axis=1, kind="stable")
    waiting: deque = deque()
    active: dict[int, tuple[int, float]] = {}

    def dispatch():
        while waiting:
            i, ev = waiting[0]
            for s in order[i]:
                if not np.isfinite(travel[i, s]):
                    break
                if free[s] > 0:
                    free[s] -= 1
                    waiting.popleft()
                    ev.succeed(int(s))
                    break
            else:
                return
            if not ev.triggered:
                return  # la primera en cola no tiene sede libre (o no tiene ninguna operativa): FIFO estricto

    def call(i):
        yield env.timeout(arrivals[i] - env.now)
        if not np.isfinite(travel[i]).any():
            return  # ninguna sede operativa: sin asignar
        ev = env.event()
        waiting.append((i, ev))
        dispatch()
        s = yield ev
        start = env.now
        wait[i] = start - arrivals[i]
        resp[i] = wait[i] + travel[i, s]
        nearest = next(int(k) for k in order[i] if np.isfinite(travel[i, k]))
        if s != nearest:
            diverted[nearest] += 1
        served[s] += 1
        active[i] = (s, start)
        yield env.timeout(travel[i, s] + service[i])
        del active[i]
        busy_time[s] += max(0.0, min(env.now, horizon) - min(start, horizon))
        free[s] += 1
        dispatch()

    for i in range(n):
        env.process(call(i))
    env.run(until=2 * horizon)
    for s, start in active.values():  # unidades aún ocupadas al cortar: cuentan hasta el fin del horizonte
        busy_time[s] += max(0.0, horizon - min(start, horizon))
    return {"wait": wait, "response": resp, "busy": busy_time, "served": served, "diverted": diverted,
            "unassigned": int(np.isnan(wait).sum())}


# ── escenario sobre datos reales ────────────────────────────────────────────────────────────────────────────────────
def _replication_draws(rng: np.random.Generator, p: dict, lam_max: float, n_sites: int) -> dict:
    """Números aleatorios comunes a A y B para una réplica (llegadas al ritmo máximo, adelgazadas por escenario)."""
    q, b = p["queue"], p["base"]
    horizon = q["horizon_h"] * 60
    n = rng.poisson(lam_max / 60 * horizon)
    lo, mode, hi = b["delay_min"]
    r = p["area"]["radius_km"] * np.sqrt(rng.random(n))
    th = rng.random(n) * 2 * math.pi
    return {"t": np.sort(rng.random(n) * horizon), "thin": rng.random(n),
            "dy": r * np.sin(th), "dx": r * np.cos(th),
            "service": rng.exponential(q["service_min"], n),
            "speed": rng.lognormal(-b["speed_sigma"] ** 2 / 2, b["speed_sigma"], n) if b["speed_sigma"] > 0 else np.ones(n),
            "delay": rng.triangular(lo, mode, hi, n) if lo < hi else np.full(n, lo),
            "avail": rng.random(n_sites)}


def _scenario(d: dict, p: dict, sites: list[dict], capacity: list[int], lam_max: float, hypothesis: bool) -> dict:
    b, h, q = p["base"], p["hypothesis"], p["queue"]
    speed, circuity, avail_p = b["speed_kmh"], b["circuity"], b["availability"]
    lam = q["rate_per_h"]
    closed = np.zeros(len(sites), dtype=bool)
    if hypothesis:
        speed *= acc.RAIN[h["rain"]] * (1 - h["congestion_pct"] / 100)
        circuity *= 1 + h["detour_pct"] / 100
        avail_p *= 1 - h["out_of_service_pct"] / 100
        lam *= 1 + h["demand_pct"] / 100
        closed = np.isin([s["id"] for s in sites], h["closed_ids"])
    keep = d["thin"] < lam / lam_max
    lat0, lon0 = p["area"]["lat"], p["area"]["lon"]
    clat = lat0 + d["dy"][keep] / 111.32
    clon = lon0 + d["dx"][keep] / (111.32 * math.cos(math.radians(lat0)))
    km = acc._km(clat[:, None], clon[:, None], np.array([s["lat"] for s in sites])[None, :], np.array([s["lon"] for s in sites])[None, :])
    travel = km * circuity / (speed * d["speed"][keep, None]) * 60 + d["delay"][keep, None]
    operating = (d["avail"] < avail_p) & ~closed & (np.array(capacity) > 0)
    travel[:, ~operating] = np.inf
    out = simulate(d["t"][keep], d["service"][keep], travel, capacity, q["horizon_h"] * 60)
    return out | {"operating": operating}


def _metrics(rep: dict, horizon: float, capacity: list[int]) -> dict:
    w, r = rep["wait"], rep["response"]
    n = len(w)
    ok = ~np.isnan(w)
    pc = lambda a, k: float(np.percentile(a, k)) if len(a) else math.nan
    util = np.where(rep["operating"] & (np.array(capacity) > 0), rep["busy"] / (horizon * np.maximum(capacity, 1)), np.nan)
    return {"calls": n, "wait_p50": pc(w[ok], 50), "wait_p90": pc(w[ok], 90), "wait_mean": float(w[ok].mean()) if ok.any() else math.nan,
            "response_p50": pc(r[ok], 50), "response_p90": pc(r[ok], 90),
            "within_30": float((r[ok] <= WITHIN_MIN).sum() / n * 100) if n else math.nan,
            "unassigned": rep["unassigned"], "util": util, "served": rep["served"], "diverted": rep["diverted"]}


def _q(a) -> dict:
    a = np.asarray(a, dtype=float)
    a = a[~np.isnan(a)]
    if not len(a):
        return {"p5": None, "p50": None, "p95": None}
    return {k: round(float(np.percentile(a, v)), 1) for k, v in (("p5", 5), ("p50", 50), ("p95", 95))}


def _summary(reps: list[dict], sites: list[dict], capacity: list[int]) -> dict:
    util = np.array([m["util"] for m in reps])  # réplicas × sedes
    per_site = []
    for j, s in enumerate(sites):
        col = util[:, j]
        u = None if np.isnan(col).all() else round(float(np.nanmedian(col)) * 100, 1)
        per_site.append({"id": s["id"], "name": s["name"], "capacity": capacity[j], "utilization_pct": u,
                         "served": round(float(np.mean([m["served"][j] for m in reps])), 1),
                         "diverted": round(float(np.mean([m["diverted"][j] for m in reps])), 1)})
    bott = sorted((x for x in per_site if x["utilization_pct"] is not None and x["utilization_pct"] >= BOTTLENECK_UTIL * 100),
                  key=lambda x: -x["utilization_pct"])
    return {"wait_p50_min": _q([m["wait_p50"] for m in reps]), "wait_p90_min": _q([m["wait_p90"] for m in reps]),
            "wait_mean_min": _q([m["wait_mean"] for m in reps]),
            "response_p50_min": _q([m["response_p50"] for m in reps]), "response_p90_min": _q([m["response_p90"] for m in reps]),
            "within_30_pct": _q([m["within_30"] for m in reps]), "calls": _q([m["calls"] for m in reps]),
            "unassigned": _q([m["unassigned"] for m in reps]),
            "sites": per_site, "bottlenecks": [{"id": x["id"], "name": x["name"], "utilization_pct": x["utilization_pct"]} for x in bott]}


def run(body: dict) -> dict:
    p = normalize(body)
    if simpy is None:
        raise SimUnavailable("Falta SimPy para el motor de capacidad: pip install -r requirements-simulation.txt")
    t0 = time.monotonic()
    a, q = p["area"], p["queue"]
    facilities = acc.load_facilities(p["service"], a["lat"], a["lon"], a["radius_km"])
    if not facilities:
        raise SimError(f"No hay {acc.SERVICES[p['service']]['label'].lower()} registrados a menos de {a['radius_km'] + 15} km")
    sites = facilities[:q["max_sites"]]
    capacity = [q["capacity_by_id"].get(s["id"], q["capacity"]) for s in sites]
    lam_max = q["rate_per_h"] * max(1.0, 1 + p["hypothesis"]["demand_pct"] / 100)
    horizon = q["horizon_h"] * 60
    rngs = [np.random.default_rng(s) for s in np.random.SeedSequence(p["seed"]).spawn(p["replications"])]
    ma, mb = [], []
    for rng in rngs:
        if time.monotonic() - t0 > LIMITS["seconds"]:
            raise SimError(f"Límite de {LIMITS['seconds']:.0f} s alcanzado; reduce réplicas, horizonte o tasa")
        d = _replication_draws(rng, p, lam_max, len(sites))
        ma.append(_metrics(_scenario(d, p, sites, capacity, lam_max, False), horizon, capacity))
        mb.append(_metrics(_scenario(d, p, sites, capacity, lam_max, True), horizon, capacity))
    sa, sb = _summary(ma, sites, capacity), _summary(mb, sites, capacity)
    d30 = np.array([y["within_30"] - x["within_30"] for x, y in zip(ma, mb)], dtype=float)
    d30 = d30[~np.isnan(d30)]
    diff = {k: (None if sa[k]["p50"] is None or sb[k]["p50"] is None else round(sb[k]["p50"] - sa[k]["p50"], 1))
            for k in ("wait_p50_min", "wait_p90_min", "response_p50_min", "within_30_pct")}
    diff["within_30_interval"] = [round(float(np.percentile(d30, 5)), 1), round(float(np.percentile(d30, 95)), 1)] if len(d30) else None
    return {
        "params": p, "params_hash": acc.params_hash(p), "kind": "estimacion", "validity": "exploratorio",
        "results": {"A": sa, "B": sb, "diff": diff},
        "facilities": [s | {"capacity": c} for s, c in zip(sites, capacity)],
        "sample": {"replications": p["replications"], "sites": len(sites), "horizon_h": q["horizon_h"]},
        "assumptions": _assumptions(p, len(sites)),
        "warnings": _warnings(p, facilities, sites, sa, sb),
        "provenance": registry.provenance(*acc.SERVICES[p["service"]]["sources"]),
        "elapsed_s": round(time.monotonic() - t0, 3),
    }


def _assumptions(p: dict, n_sites: int) -> list[str]:
    q, b, h = p["queue"], p["base"], p["hypothesis"]
    return [
        f"Llegadas de Poisson a {q['rate_per_h']:g} llamadas/h en A (supuesto del usuario; no se deriva repartiendo cifras distritales).",
        "Cada llamada cae en un punto uniforme del ÁREA del círculo, no según población (la población solo se publica por distrito).",
        f"{q['capacity']} unidad(es) por sede salvo ajuste por sede (supuesto, no inventario oficial de camas o vehículos).",
        f"Atención exponencial de media {q['service_min']:g} min; la unidad queda ocupada durante traslado + atención; no se modela el regreso.",
        f"Traslado: distancia geodésica × rodeo {b['circuity']} ÷ {b['speed_kmh']:g} km/h (lognormal σ={b['speed_sigma']:g} por llamada) "
        f"+ retardo triangular {b['delay_min'][0]:g}/{b['delay_min'][1]:g}/{b['delay_min'][2]:g} min.",
        f"Cola única FIFO; asignación a la sede operativa más cercana con unidad libre. Se usan las {n_sites} sedes más cercanas al centro.",
        f"Horizonte de {q['horizon_h']} h desde el sistema vacío (sin calentamiento); llamadas pendientes se vacían hasta 2× el horizonte.",
        f"Cada sede opera con probabilidad {b['availability']:g} por réplica en A; B cambia demanda {h['demand_pct']:+g} %, lluvia, congestión, "
        "sedes fuera y rodeo con los mismos números aleatorios.",
        f"«Cuello de botella»: utilización mediana ≥ {BOTTLENECK_UTIL * 100:.0f} %. «≤ {WITHIN_MIN} min»: espera + traslado sobre todas las llamadas.",
    ]


def _warnings(p, facilities, sites, sa, sb) -> list[str]:
    w = []
    if len(facilities) > len(sites):
        w.append(f"Se modelan las {len(sites)} sedes más cercanas de {len(facilities)} encontradas.")
    if p["replications"] < 20:
        w.append("Menos de 20 réplicas: los intervalos son poco estables.")
    for k, s in (("A", sa), ("B", sb)):
        if (s["unassigned"]["p50"] or 0) > 0:
            w.append(f"En {k} quedan llamadas sin asignar al cortar: la demanda supera la capacidad (sistema saturado).")
    if p["service"] in ("bomberos", "comisaria"):
        w.append("Fuente colaborativa (OpenStreetMap): puede faltar parte de las sedes reales.")
    return w

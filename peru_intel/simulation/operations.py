"""Operativo simulado (ejercicio de mesa): unidades HIPOTÉTICAS marcadas en el mapa atienden llamadas HIPOTÉTICAS.

Pregunta: con estas unidades, en estas posiciones y con estos tramos cortados, ¿cuánto tardaría la respuesta, qué parte
llega dentro del objetivo y qué unidades se saturan? Sirve para ensayar distribución de recursos y contingencias.

Límites éticos y de método (plan maestro §7.5, AGENTS.md):
  · Las llamadas son sintéticas: proceso de Poisson con tasa DECLARADA y ubicación uniforme en el ÁREA de la zona.
    No se derivan de denuncias ni de personas, no se reparten cifras distritales y no predicen hechos reales.
  · No genera órdenes, rutas de persecución ni objetivos humanos; mide tiempos y cargas de recursos abstractos.

Modelo (ESTIMACIÓN exploratoria, supuestos devueltos con el resultado):
  · tipos de llamada (seguridad, médica, incendio) con mezcla declarada; cada tipo lo atienden ciertas clases de unidad.
  · despacho: la unidad libre compatible más rápida; si no hay, la llamada espera en cola FIFO de su tipo.
  · traslado: distancia geodésica × rodeo ÷ velocidad (× lluvia y congestión) + retardo; si la recta cruza un tramo
    cortado, se suma un rodeo extra declarado por cada tramo cruzado (sin red vial: no busca el desvío real).
  · en escena: exponencial de media declarada; luego la unidad regresa a su base (ocupada durante el regreso).
Réplica 0 produce la cronología para reproducir en el mapa; las demás réplicas dan los intervalos de las métricas.
"""
from __future__ import annotations

import heapq
import math
import time
from collections import deque

import numpy as np

from . import ENGINE_VERSION
from . import accessibility as acc

SimError = acc.SimError
KINDS = {"patrulla": "Patrullero", "serenazgo": "Serenazgo", "ambulancia": "Ambulancia", "bomberos": "Bomberos"}
CALLS = {"seguridad": ("patrulla", "serenazgo"), "medica": ("ambulancia",), "incendio": ("bomberos",)}
CALL_LABEL = {"seguridad": "Seguridad", "medica": "Emergencia médica", "incendio": "Incendio / rescate"}
LIMITS = {"units": 40, "tramos": 30, "tramo_points": 50, "rate_per_h": 60.0, "horizon_h": 24, "replications": 60,
          "expected_calls": 60_000, "seconds": 15.0, "timeline_calls": 1500}
DEFAULTS = {"rate_per_h": 2.0, "horizon_h": 8, "service_min": 25.0, "target_min": 15, "replications": 20,
            "detour_per_tramo_pct": 60, "mix": {"seguridad": 0.5, "medica": 0.35, "incendio": 0.15}}


def _point(p, name):
    try:
        lon, lat = float(p[0]), float(p[1])
    except (TypeError, ValueError, IndexError):
        raise SimError(f"{name}: coordenadas [lon, lat]")
    if not (-81.6 <= lon <= -68.4 and -18.6 <= lat <= 0.2):
        raise SimError(f"{name}: fuera del Perú")
    return [round(lon, 5), round(lat, 5)]


def normalize(body: dict) -> dict:
    common = acc.normalize({k: v for k, v in body.items() if k in ("area", "base", "hypothesis", "seed")} | {"service": "hospital"})
    c = acc._clamp
    units = body.get("units") or []
    if not isinstance(units, list) or not units:
        raise SimError("Marca al menos una unidad en el mapa")
    if len(units) > LIMITS["units"]:
        raise SimError(f"Máximo {LIMITS['units']} unidades")
    norm_units = []
    for i, u in enumerate(units):
        kind = str(u.get("kind") or "")
        if kind not in KINDS:
            raise SimError(f"tipo de unidad no válido: {kind}")
        lon, lat = _point([u.get("lon"), u.get("lat")], f"unidad {i + 1}")
        norm_units.append({"id": str(u.get("id") or f"u{i + 1}")[:24], "kind": kind, "lon": lon, "lat": lat})
    tramos = body.get("tramos") or []
    if len(tramos) > LIMITS["tramos"]:
        raise SimError(f"Máximo {LIMITS['tramos']} tramos")
    norm_tramos = []
    for i, t in enumerate(tramos):
        pts = t.get("coords") or []
        if not 2 <= len(pts) <= LIMITS["tramo_points"]:
            raise SimError(f"tramo {i + 1}: entre 2 y {LIMITS['tramo_points']} puntos")
        norm_tramos.append({"id": str(t.get("id") or f"t{i + 1}")[:24], "coords": [_point(p, f"tramo {i + 1}") for p in pts]})
    ops = body.get("ops") or {}
    mix_in = ops.get("mix") or DEFAULTS["mix"]
    mix = {k: c(mix_in.get(k, 0), 0, 1, f"mezcla {k}") for k in CALLS}
    total = sum(mix.values())
    if total <= 0:
        raise SimError("La mezcla de llamadas debe sumar más de 0")
    mix = {k: round(v / total, 4) for k, v in mix.items()}
    p = {
        "engine": "operations", "engine_version": ENGINE_VERSION,
        "area": common["area"], "base": common["base"], "hypothesis": common["hypothesis"],
        "units": sorted(norm_units, key=lambda u: u["id"]), "tramos": sorted(norm_tramos, key=lambda t: t["id"]),
        "ops": {"rate_per_h": c(ops.get("rate_per_h", DEFAULTS["rate_per_h"]), 0.1, LIMITS["rate_per_h"], "llamadas por hora"),
                "horizon_h": int(c(ops.get("horizon_h", DEFAULTS["horizon_h"]), 1, LIMITS["horizon_h"], "horizonte")),
                "service_min": c(ops.get("service_min", DEFAULTS["service_min"]), 1, 240, "tiempo en escena"),
                "target_min": int(c(ops.get("target_min", DEFAULTS["target_min"]), 1, 120, "objetivo de respuesta")),
                "detour_per_tramo_pct": c(ops.get("detour_per_tramo_pct", DEFAULTS["detour_per_tramo_pct"]), 0, 300, "rodeo por tramo"),
                "mix": mix},
        "replications": int(c(body.get("replications", DEFAULTS["replications"]), 1, LIMITS["replications"], "réplicas")),
        "seed": common["seed"],
    }
    expected = p["ops"]["rate_per_h"] * p["ops"]["horizon_h"] * p["replications"]
    if expected > LIMITS["expected_calls"]:
        raise SimError("Demasiadas llamadas esperadas; reduce tasa, horizonte o réplicas")
    return p


# ── geometría ───────────────────────────────────────────────────────────────
def _xy(lon, lat, lat0):
    """Proyección local en km (equirrectangular), suficiente a escala de una zona de ≤ 30 km."""
    return lon * 111.32 * math.cos(math.radians(lat0)), lat * 111.32


def _crosses(a, b, c, d) -> bool:
    """¿Se cruzan los segmentos ab y cd? (sin contar contactos en los extremos colineales)."""
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return (o1 > 0) != (o2 > 0) and (o3 > 0) != (o4 > 0) and 0 not in (o1, o2, o3, o4)


def tramos_crossed(a_lonlat, b_lonlat, tramos, lat0) -> int:
    a, b = _xy(*a_lonlat, lat0), _xy(*b_lonlat, lat0)
    n = 0
    for t in tramos:
        pts = [_xy(*p, lat0) for p in t["coords"]]
        if any(_crosses(a, b, pts[i], pts[i + 1]) for i in range(len(pts) - 1)):
            n += 1
    return n


# ── una réplica ─────────────────────────────────────────────────────────────
def _calls(rng, p):
    a = p["area"]
    o = p["ops"]
    horizon = o["horizon_h"] * 60
    n = rng.poisson(o["rate_per_h"] / 60 * horizon)
    t = np.sort(rng.uniform(0, horizon, n))
    r = a["radius_km"] * np.sqrt(rng.random(n))
    th = rng.uniform(0, 2 * math.pi, n)
    lat = a["lat"] + r * np.sin(th) / 111.32
    lon = a["lon"] + r * np.cos(th) / (111.32 * math.cos(math.radians(a["lat"])))
    kinds = list(CALLS)
    typ = rng.choice(len(kinds), size=n, p=[o["mix"][k] for k in kinds])
    service = rng.exponential(o["service_min"], n)
    speed = rng.lognormal(-p["base"]["speed_sigma"] ** 2 / 2, p["base"]["speed_sigma"], n) if p["base"]["speed_sigma"] > 0 else np.ones(n)
    lo, mode, hi = p["base"]["delay_min"]
    delay = rng.triangular(lo, mode, hi, n) if lo < hi else np.full(n, lo)
    return [{"i": i, "t": float(t[i]), "lat": float(lat[i]), "lon": float(lon[i]), "type": kinds[typ[i]],
             "service": float(service[i]), "speed": float(speed[i]), "delay": float(delay[i])} for i in range(n)]


def _travel_min(p, unit_pos, call, speed_kmh, circuity):
    a = p["area"]
    d = float(acc._km(unit_pos[1], unit_pos[0], call["lat"], call["lon"]))
    crossed = tramos_crossed(unit_pos, (call["lon"], call["lat"]), p["tramos"], a["lat"]) if p["tramos"] else 0
    factor = 1 + crossed * p["ops"]["detour_per_tramo_pct"] / 100
    return d * circuity * factor / (speed_kmh * call["speed"]) * 60, crossed


def replicate(p: dict, rng, keep_timeline: bool) -> dict:
    h = p["hypothesis"]
    speed_kmh = p["base"]["speed_kmh"] * acc.RAIN[h["rain"]] * (1 - h["congestion_pct"] / 100)
    circuity = p["base"]["circuity"] * (1 + h["detour_pct"] / 100)
    horizon = p["ops"]["horizon_h"] * 60
    units = p["units"]
    free_at = [0.0] * len(units)               # minuto en que cada unidad vuelve a estar libre en su base
    busy_min = [0.0] * len(units)
    served = [0] * len(units)
    queues = {k: deque() for k in CALLS}
    calls = _calls(rng, p)
    out_calls, trips = [], []
    # eventos: (tiempo, orden, tipo, dato). Llegadas y liberaciones de unidades.
    ev = [(c["t"], 1, "call", c["i"]) for c in calls]
    heapq.heapify(ev)
    seq = len(ev)

    def dispatch(now, c):
        nonlocal seq
        best = None
        for j, u in enumerate(units):
            if u["kind"] not in CALLS[c["type"]] or free_at[j] > now + 1e-9:
                continue
            tt, crossed = _travel_min(p, (u["lon"], u["lat"]), c, speed_kmh, circuity)
            if best is None or tt < best[1]:
                best = (j, tt, crossed)
        if best is None:
            return False
        j, tt, crossed = best
        arrive = now + c["delay"] + tt
        clear = arrive + c["service"]
        back = clear + tt                     # regreso a la base por el mismo trayecto
        free_at[j] = back
        busy_min[j] += min(back, horizon) - min(now, horizon)
        served[j] += 1
        rec = {"id": c["i"], "t": round(c["t"], 2), "type": c["type"], "lat": round(c["lat"], 5), "lon": round(c["lon"], 5),
               "unit": units[j]["id"], "dispatch": round(now, 2), "arrive": round(arrive, 2), "clear": round(clear, 2),
               "response": round(arrive - c["t"], 2), "wait": round(now - c["t"], 2), "tramos": crossed}
        out_calls.append(rec)
        if keep_timeline:
            trips.append({"unit": units[j]["id"], "t0": round(now + c["delay"], 2), "t1": round(arrive, 2), "from": [units[j]["lon"], units[j]["lat"]],
                          "to": [rec["lon"], rec["lat"]], "call": c["i"]})
            trips.append({"unit": units[j]["id"], "t0": round(clear, 2), "t1": round(back, 2), "from": [rec["lon"], rec["lat"]],
                          "to": [units[j]["lon"], units[j]["lat"]], "call": c["i"]})
        heapq.heappush(ev, (back, 0, "free", j))
        seq += 1
        return True

    while ev:
        now, _, kind, x = heapq.heappop(ev)
        if now > horizon and kind == "call":
            break
        if kind == "call":
            c = calls[x]
            if queues[c["type"]] or not dispatch(now, c):
                queues[c["type"]].append(c)
        else:  # una unidad quedó libre: atiende la cola compatible más antigua
            u = units[x]
            waiting = [q for k, q in queues.items() if q and u["kind"] in CALLS[k]]
            if waiting:
                q = min(waiting, key=lambda q: q[0]["t"])
                c = q.popleft()
                if not dispatch(now, c):
                    q.appendleft(c)
    unattended = [c for q in queues.values() for c in q]
    resp = np.array([c["response"] for c in out_calls]) if out_calls else np.array([])
    target = p["ops"]["target_min"]
    m = {"calls": len(calls), "attended": len(out_calls), "unattended": len(unattended),
         "response_p50_min": float(np.percentile(resp, 50)) if resp.size else None,
         "response_p90_min": float(np.percentile(resp, 90)) if resp.size else None,
         "within_target_pct": float((resp <= target).sum() / len(calls) * 100) if calls else None,
         "crossing_tramos_pct": float(sum(1 for c in out_calls if c["tramos"]) / len(out_calls) * 100) if out_calls else 0.0,
         "utilization": [round(min(1.0, b / horizon) * 100, 1) for b in busy_min], "served": served,
         "by_type": {k: sum(1 for c in calls if c["type"] == k) for k in CALLS}}
    if keep_timeline:
        m["timeline"] = {"calls": out_calls[:LIMITS["timeline_calls"]],
                         "unattended": [{"id": c["i"], "t": round(c["t"], 2), "type": c["type"], "lat": round(c["lat"], 5),
                                         "lon": round(c["lon"], 5)} for c in unattended[:LIMITS["timeline_calls"]]],
                         "trips": trips[: LIMITS["timeline_calls"] * 2], "truncated": len(out_calls) > LIMITS["timeline_calls"]}
    return m


def _q(values) -> dict:
    v = np.array([x for x in values if x is not None], dtype=float)
    if not v.size:
        return {"p5": None, "p50": None, "p95": None}
    return {k: round(float(np.percentile(v, q)), 1) for k, q in (("p5", 5), ("p50", 50), ("p95", 95))}


def run(body: dict) -> dict:
    p = normalize(body)
    t0 = time.monotonic()
    rng = np.random.default_rng(p["seed"])
    reps = []
    for r in range(p["replications"]):
        if time.monotonic() - t0 > LIMITS["seconds"]:
            raise SimError(f"Límite de {LIMITS['seconds']:.0f} s alcanzado; reduce réplicas, horizonte o tasa")
        reps.append(replicate(p, rng, keep_timeline=(r == 0)))
    first = reps[0]
    util = np.array([x["utilization"] for x in reps])
    units = [u | {"label": KINDS[u["kind"]], "utilization_pct": round(float(np.median(util[:, j])), 1),
                  "served_p50": float(np.median([x["served"][j] for x in reps]))} for j, u in enumerate(p["units"])]
    target = p["ops"]["target_min"]
    summary = {"response_p50_min": _q(x["response_p50_min"] for x in reps), "response_p90_min": _q(x["response_p90_min"] for x in reps),
               "within_target_pct": _q(x["within_target_pct"] for x in reps), "unattended": _q(x["unattended"] for x in reps),
               "calls": _q(x["calls"] for x in reps), "crossing_tramos_pct": _q(x["crossing_tramos_pct"] for x in reps)}
    saturated = [u["id"] for u in units if u["utilization_pct"] >= 80]
    warnings = []
    for k, kinds in CALLS.items():
        if p["ops"]["mix"][k] > 0 and not any(u["kind"] in kinds for u in p["units"]):
            warnings.append(f"Nadie atiende «{CALL_LABEL[k]}»: falta una unidad de tipo {' o '.join(KINDS[x].lower() for x in kinds)}.")
    if saturated:
        warnings.append(f"{len(saturated)} unidad(es) ocupada(s) ≥ 80 % del tiempo: el operativo está al límite.")
    if first["timeline"]["truncated"]:
        warnings.append(f"La reproducción muestra las primeras {LIMITS['timeline_calls']} llamadas.")
    return {
        "params": p, "kind": "estimacion", "validity": "exploratorio · ejercicio de mesa",
        "results": summary, "units": units, "saturated": saturated, "timeline": first["timeline"],
        "replay": {"horizon_min": p["ops"]["horizon_h"] * 60, "replication": 0, "calls": first["calls"]},
        "sample": {"replications": p["replications"], "units": len(units), "tramos": len(p["tramos"])},
        "assumptions": [
            f"Llamadas hipotéticas: Poisson de {p['ops']['rate_per_h']:g}/h durante {p['ops']['horizon_h']} h, ubicadas al azar en el área "
            f"(mezcla: {', '.join(f'{CALL_LABEL[k]} {v * 100:.0f} %' for k, v in p['ops']['mix'].items())}). No provienen de denuncias ni personas.",
            "Seguridad la atienden patrulleros o serenazgo; emergencias médicas, ambulancias; incendios y rescates, bomberos.",
            f"Traslado: distancia geodésica × rodeo {p['base']['circuity']:g} ÷ {p['base']['speed_kmh']:g} km/h (con lluvia y congestión de la hipótesis) "
            f"+ retardo {'/'.join(f'{x:g}' for x in p['base']['delay_min'])} min.",
            f"Cada tramo cortado que cruza la línea recta suma {p['ops']['detour_per_tramo_pct']:g} % de rodeo (no se calcula el desvío vial real).",
            f"En escena: exponencial de media {p['ops']['service_min']:g} min; después la unidad regresa a su base.",
            f"Objetivo de respuesta: {target} min desde la llamada. Las llamadas no atendidas al cierre cuentan como fuera de objetivo.",
            "Ejercicio de mesa: no genera órdenes operativas ni se refiere a personas o hechos reales.",
        ],
        "warnings": warnings, "provenance": [],
        "elapsed_s": round(time.monotonic() - t0, 3),
    }

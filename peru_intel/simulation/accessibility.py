"""Accesibilidad a servicios: escenario base (A) frente a hipótesis (B) con Monte Carlo reproducible.

Pregunta: dentro de un área de estudio, ¿qué parte del área queda a 15, 30 o 45 minutos del servicio más cercano
disponible, y cómo cambia con lluvia, congestión, cortes de vía o servicios fuera de operación?

Modelo (ESTIMACIÓN exploratoria, sin red vial calibrada; cada supuesto se devuelve con el resultado):
  tiempo = distancia geodésica × factor de rodeo ÷ velocidad × 60 + retardo de despacho
  · velocidad: base × factor global por iteración (lognormal, estado de la red ese momento) × hipótesis
  · disponibilidad: cada servicio opera con probabilidad p (y menos en B si hay servicios fuera)
  · retardo: triangular(mín, moda, máx) por iteración
A y B usan los MISMOS números aleatorios (números aleatorios comunes): la diferencia mide la hipótesis, no el azar.

Puntos de muestreo: rejilla geométrica regular dentro del círculo. Los porcentajes son de ÁREA muestreada, no de
población: la población solo se publica por distrito y nunca se reparte a celdas (regla 3 del proyecto).
"""
from __future__ import annotations

import hashlib
import json
import math
import time
import warnings

import numpy as np

from .. import config
from ..sources import registry
from ..storage import warehouse
from . import ENGINE_VERSION

SERVICES = {
    "hospital": {"label": "Hospitales", "table": "servicios", "cat": "hospital", "sources": ("renipress",)},
    "salud": {"label": "Establecimientos de salud", "table": "servicios", "cat": "salud", "sources": ("renipress",)},
    "bomberos": {"label": "Compañías de bomberos", "table": "servicios", "cat": "bomberos", "sources": ("osm_servicios",)},
    "comisaria": {"label": "Comisarías", "table": None, "cat": "comisaria", "sources": ("osm_instituciones",)},
}
RAIN = {"ninguna": 1.0, "moderada": 0.8, "intensa": 0.6}
THRESHOLDS = (15, 30, 45)
LIMITS = {"iterations": 2000, "points": 900, "facilities": 400, "seconds": 20.0, "radius_km": (5, 10, 20, 30)}
DEFAULTS = {"speed_kmh": 30.0, "speed_sigma": 0.25, "circuity": 1.4, "availability": 0.97,
            "delay_min": (2.0, 5.0, 12.0), "iterations": 500, "seed": 2026}


class SimError(ValueError):
    pass


def _clamp(v, lo, hi, name):
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise SimError(f"{name} debe ser numérico")
    if not lo <= v <= hi:
        raise SimError(f"{name} fuera de rango ({lo}–{hi})")
    return v


def normalize(body: dict) -> dict:
    """Valida y completa los parámetros. Lo que entra aquí es exactamente lo que se registra en la ejecución."""
    area = body.get("area") or {}
    lat = _clamp(area.get("lat"), -18.6, 0.2, "latitud")
    lon = _clamp(area.get("lon"), -81.6, -68.4, "longitud")
    radius = int(_clamp(area.get("radius_km", 10), 1, 30, "radio"))
    if radius not in LIMITS["radius_km"]:
        raise SimError("radio permitido: 5, 10, 20 o 30 km")
    service = str(body.get("service") or "hospital")
    if service not in SERVICES:
        raise SimError(f"servicio no disponible: {service}")
    base = body.get("base") or {}
    hyp = body.get("hypothesis") or {}
    rain = str(hyp.get("rain") or "ninguna")
    if rain not in RAIN:
        raise SimError("lluvia: ninguna, moderada o intensa")
    d = DEFAULTS
    delay = base.get("delay_min") or d["delay_min"]
    if len(delay) != 3:
        raise SimError("retardo: [mínimo, moda, máximo]")
    lo, mode, hi = (_clamp(x, 0, 120, "retardo") for x in delay)
    if not lo <= mode <= hi:
        raise SimError("retardo: se requiere mínimo ≤ moda ≤ máximo (iguales = retardo fijo)")
    return {
        "engine": "accessibility", "engine_version": ENGINE_VERSION,
        "area": {"lat": round(lat, 5), "lon": round(lon, 5), "radius_km": radius},
        "service": service,
        "base": {"speed_kmh": _clamp(base.get("speed_kmh", d["speed_kmh"]), 5, 90, "velocidad"),
                 "speed_sigma": _clamp(base.get("speed_sigma", d["speed_sigma"]), 0, 1, "variabilidad"),
                 "circuity": _clamp(base.get("circuity", d["circuity"]), 1, 3, "rodeo"),
                 "availability": _clamp(base.get("availability", d["availability"]), 0.5, 1, "disponibilidad"),
                 "delay_min": [lo, mode, hi]},
        "hypothesis": {"rain": rain,
                       "congestion_pct": _clamp(hyp.get("congestion_pct", 0), 0, 80, "congestión"),
                       "out_of_service_pct": _clamp(hyp.get("out_of_service_pct", 0), 0, 90, "servicios fuera"),
                       "detour_pct": _clamp(hyp.get("detour_pct", 0), 0, 100, "rodeo por cortes"),
                       "closed_ids": sorted(str(x) for x in (hyp.get("closed_ids") or []))[:200]},
        "iterations": int(_clamp(body.get("iterations", d["iterations"]), 1, LIMITS["iterations"], "iteraciones")),
        "seed": int(_clamp(body.get("seed", d["seed"]), 0, 2**31 - 1, "semilla")),
    }


def params_hash(p: dict) -> str:
    return hashlib.sha256(json.dumps(p, sort_keys=True).encode()).hexdigest()[:12]


def _km(lat0, lon0, lat, lon):
    r = math.pi / 180
    a = 0.5 - np.cos((lat - lat0) * r) / 2 + np.cos(lat0 * r) * np.cos(lat * r) * (1 - np.cos((lon - lon0) * r)) / 2
    return 12742 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def sample_points(lat: float, lon: float, radius_km: float, max_points: int = LIMITS["points"]) -> np.ndarray:
    """Rejilla regular dentro del círculo; el espaciado se ajusta para no exceder `max_points`."""
    step = radius_km * math.sqrt(math.pi / max_points) * 1.02
    n = int(radius_km // step) + 1
    off = np.arange(-n, n + 1) * step
    dx, dy = np.meshgrid(off, off)
    keep = dx ** 2 + dy ** 2 <= radius_km ** 2
    dlat = dy[keep] / 111.32
    dlon = dx[keep] / (111.32 * math.cos(math.radians(lat)))
    pts = np.column_stack([lat + dlat, lon + dlon])
    return pts[:max_points]


def load_facilities(service: str, lat: float, lon: float, radius_km: float) -> list[dict]:
    """Servicios dentro del radio + 15 km (el más cercano puede estar fuera del área), los más próximos primero."""
    s = SERVICES[service]
    reach = radius_km + 15
    dlat, dlon = reach / 111.32, reach / (111.32 * math.cos(math.radians(lat)))
    if s["table"]:
        if not warehouse.has(s["table"]):
            raise SimError(f"Faltan datos de {s['label'].lower()} (python -m peru_intel ingest servicios)")
        rows = warehouse.query(f"SELECT nombre AS name, lat, lon FROM {s['table']} WHERE cat = ? AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
                               [s["cat"], lat - dlat, lat + dlat, lon - dlon, lon + dlon])
    else:
        path = config.DATA / "normalized" / "instituciones.json"
        if not path.exists():
            raise SimError("Faltan comisarías (python -m peru_intel ingest instituciones --download)")
        items = json.loads(path.read_text(encoding="utf-8"))["items"]
        rows = [{"name": i["name"], "lat": i["lat"], "lon": i["lon"], "id": i["id"]} for i in items
                if i["cat"] == s["cat"] and abs(i["lat"] - lat) <= dlat and abs(i["lon"] - lon) <= dlon]
    out = []
    for i, r in enumerate(rows):
        if r.get("lat") is None or r.get("lon") is None:
            continue
        fid = str(r.get("id") or f"{service}-{r['lat']:.5f},{r['lon']:.5f}")
        out.append({"id": fid, "name": r.get("name") or s["label"], "lat": float(r["lat"]), "lon": float(r["lon"])})
    if not out:
        return []
    d = _km(lat, lon, np.array([f["lat"] for f in out]), np.array([f["lon"] for f in out]))
    order = np.argsort(d)[:LIMITS["facilities"]]
    return [out[i] | {"km_to_center": round(float(d[i]), 2)} for i in order if d[i] <= reach]


def _draws(p: dict, n_fac: int) -> dict:
    """Números aleatorios comunes a A y B. Misma semilla → mismos resultados (reproducible)."""
    rng = np.random.default_rng(p["seed"])
    it = p["iterations"]
    lo, mode, hi = p["base"]["delay_min"]
    return {"speed": rng.lognormal(-p["base"]["speed_sigma"] ** 2 / 2, p["base"]["speed_sigma"], it) if p["base"]["speed_sigma"] > 0 else np.ones(it),
            "avail": rng.random((it, n_fac)),
            "delay": rng.triangular(lo, mode, hi, it) if lo < hi else np.full(it, lo)}


def _scenario(dist: np.ndarray, draws: dict, p: dict, fac_ids: list[str], hypothesis: bool, deadline: float) -> dict:
    b, h = p["base"], p["hypothesis"]
    speed = b["speed_kmh"]
    circuity = b["circuity"]
    avail_p = b["availability"]
    closed = np.zeros(len(fac_ids), dtype=bool)
    if hypothesis:
        speed *= RAIN[h["rain"]] * (1 - h["congestion_pct"] / 100)
        circuity *= 1 + h["detour_pct"] / 100
        avail_p *= 1 - h["out_of_service_pct"] / 100
        closed = np.isin(np.array(fac_ids), h["closed_ids"]) if h["closed_ids"] else closed
    it = p["iterations"]
    times = np.empty((it, dist.shape[0]), dtype=np.float32)
    base_min = dist * circuity / speed * 60  # puntos × servicios
    # cada punto solo compara con sus K servicios más cercanos (orden fijo); si ninguno opera, cálculo exacto
    k = min(base_min.shape[1], 80)
    near = np.argsort(base_min, axis=1)[:, :k]
    near_min = np.take_along_axis(base_min, near, axis=1)
    rows = np.arange(base_min.shape[0])
    for start in range(0, it, 100):
        if time.monotonic() > deadline:
            raise SimError(f"Límite de {LIMITS['seconds']:.0f} s alcanzado; reduce iteraciones o radio")
        sl = slice(start, min(start + 100, it))
        ok = (draws["avail"][sl] < avail_p) & ~closed            # iteraciones × servicios
        ok_near = ok[:, near]                                     # iteraciones × puntos × K
        first = ok_near.argmax(axis=2)
        found = ok_near.any(axis=2)
        t = near_min[rows[None, :], first]
        for j, i in zip(*np.nonzero(~found)):                    # raro: todos los K cercanos fuera de servicio
            m = ok[j]
            t[j, i] = base_min[i, m].min() if m.any() else np.inf
        times[sl] = t / draws["speed"][sl, None] + draws["delay"][sl, None]
    return {"times": times}


def _summary(times: np.ndarray) -> dict:
    finite = np.where(np.isfinite(times), times, np.nan)
    med = np.nanmedian(finite, axis=1)
    cov = {t: (times <= t).mean(axis=1) * 100 for t in THRESHOLDS}
    q = lambda a: {"p5": round(float(np.nanpercentile(a, 5)), 1), "p50": round(float(np.nanpercentile(a, 50)), 1),
                   "p95": round(float(np.nanpercentile(a, 95)), 1)}
    c30 = cov[30]
    se = [float(np.std(c30[: i + 1]) / math.sqrt(i + 1)) for i in range(len(c30))]
    return {"median_min": q(med), "coverage_pct": {str(t): q(v) for t, v in cov.items()},
            "no_service_iterations": int(np.isinf(times).all(axis=1).sum()),
            "convergence": {"metric": "cobertura ≤30 min", "standard_error_pct": round(se[-1], 2),
                            "trace": [round(float(np.mean(c30[: i + 1])), 2) for i in range(0, len(c30), max(1, len(c30) // 40))]}}


def run(body: dict) -> dict:
    with warnings.catch_warnings():  # puntos sin ningún servicio operativo dan NaN: se informan, no se ocultan
        warnings.simplefilter("ignore", RuntimeWarning)
        return _run(body)


def _run(body: dict) -> dict:
    p = normalize(body)
    t0 = time.monotonic()
    a = p["area"]
    facilities = load_facilities(p["service"], a["lat"], a["lon"], a["radius_km"])
    if not facilities:
        raise SimError(f"No hay {SERVICES[p['service']]['label'].lower()} registrados a menos de {a['radius_km'] + 15} km")
    pts = sample_points(a["lat"], a["lon"], a["radius_km"])
    flat, flon = np.array([f["lat"] for f in facilities]), np.array([f["lon"] for f in facilities])
    dist = _km(pts[:, :1], pts[:, 1:2], flat[None, :], flon[None, :])
    draws = _draws(p, len(facilities))
    deadline = t0 + LIMITS["seconds"]
    ids = [f["id"] for f in facilities]
    A = _scenario(dist, draws, p, ids, False, deadline)["times"]
    B = _scenario(dist, draws, p, ids, True, deadline)["times"]
    sa, sb = _summary(A), _summary(B)
    pa = np.nanmedian(np.where(np.isfinite(A), A, np.nan), axis=0)
    pb = np.nanmedian(np.where(np.isfinite(B), B, np.nan), axis=0)
    diff = {"median_min": round(sb["median_min"]["p50"] - sa["median_min"]["p50"], 1),
            "coverage_pct": {k: round(sb["coverage_pct"][k]["p50"] - sa["coverage_pct"][k]["p50"], 1) for k in sa["coverage_pct"]}}
    # diferencia por iteración (números comunes): intervalo de la diferencia, más estrecho que restar intervalos
    d30 = (B <= 30).mean(axis=1) * 100 - (A <= 30).mean(axis=1) * 100
    diff["coverage_30_interval"] = [round(float(np.percentile(d30, 5)), 1), round(float(np.percentile(d30, 95)), 1)]
    spacing = round(a["radius_km"] * math.sqrt(math.pi / LIMITS["points"]) * 1.02, 2)
    return {
        "params": p, "params_hash": params_hash(p),
        "kind": "estimacion",
        "validity": "exploratorio",
        "results": {"A": sa, "B": sb, "diff": diff},
        "points": [{"lat": round(float(y), 5), "lon": round(float(x), 5),
                    "a": None if math.isnan(u) else round(float(u), 1), "b": None if math.isnan(v) else round(float(v), 1)}
                   for (y, x), u, v in zip(pts, pa, pb)],
        "facilities": facilities,
        "sample": {"points": len(pts), "spacing_km": spacing, "facilities": len(facilities), "iterations": p["iterations"]},
        "assumptions": [
            f"Distancia geodésica × rodeo {p['base']['circuity']} (sin red vial: no considera ríos, pendientes ni sentidos de vía).",
            f"Velocidad base {p['base']['speed_kmh']:g} km/h con variabilidad lognormal σ={p['base']['speed_sigma']:g} por iteración.",
            f"Retardo de despacho triangular {p['base']['delay_min'][0]:g}/{p['base']['delay_min'][1]:g}/{p['base']['delay_min'][2]:g} min.",
            f"Cada servicio opera con probabilidad {p['base']['availability']:g} en A (supuesto, no dato oficial).",
            "Se considera el servicio más cercano disponible; no se modela su capacidad ni la demanda simultánea (motor S3, planificado).",
            "Porcentajes de ÁREA muestreada, no de población: la población solo se publica por distrito y no se reparte.",
        ],
        "warnings": _warnings(p, facilities, sa),
        "provenance": registry.provenance(*SERVICES[p["service"]]["sources"]),
        "elapsed_s": round(time.monotonic() - t0, 3),
    }


def _warnings(p, facilities, sa) -> list[str]:
    w = []
    if len(facilities) >= LIMITS["facilities"]:
        w.append(f"Se usaron los {LIMITS['facilities']} servicios más cercanos al centro.")
    if p["iterations"] < 200:
        w.append("Menos de 200 iteraciones: los intervalos son poco estables.")
    if sa["convergence"]["standard_error_pct"] > 1:
        w.append("La cobertura aún no converge (error estándar > 1 punto): aumenta las iteraciones.")
    if p["service"] in ("bomberos", "comisaria"):
        w.append("Fuente colaborativa (OpenStreetMap): puede faltar parte de las sedes reales.")
    return w

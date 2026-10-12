"""Operativos conjuntos: varios operativos HIPOTÉTICOS en paralelo, en una o varias regiones, con apoyos reales cercanos.

Qué hace (ejercicio de mesa, sin personas ni predicción):
- `facilities()`: sedes y apoyos cerca de un punto o dentro de un recuadro, de fuentes con procedencia —
  comisarías/serenazgo/fiscalía/judicial (OSM), hospitales y establecimientos de salud (RENIPRESS, oficial), bomberos (OSM),
  aeropuertos, puertos, bases militares/navales y mercados (OSM).
- `plan()`: para cada recurso (vehículo, personal, aeronave, lancha…) elige su sede de salida (la más cercana compatible o la
  que fije el usuario), traza la ruta (OSRM por carretera; aire y agua en línea recta) y estima tiempos con factores
  DECLARADOS: perfil horario de tráfico (o TomTom si hay clave), lluvia, complejidad de la incidencia y fallas (Monte Carlo
  con semilla). El costo usa SOLO el tarifario que ingresa el usuario (o el de ejemplo, marcado como tal).

Todo resultado es «estimación»: no reemplaza un plan operativo, no usa información reservada y no presenta tarifas oficiales.
"""
from __future__ import annotations

import json
import math
import threading
import urllib.parse

import numpy as np

from .. import config
from ..sources import registry
from ..sources.harvester import http_get
from . import accessibility as acc

R_KM = 6371.0088
MAX_OPS, MAX_RES, MAX_OSRM = 12, 80, 30

# ── catálogo de recursos (supuestos editables por recurso en la interfaz) ───────────────────────────────────────────
# mode: tierra (ruta OSRM), pie (ruta OSRM a velocidad de caminata), aire y agua (línea recta × rodeo propio)
# factor: multiplica la duración OSRM (tierra) · speed: km/h (pie/aire/agua) · prep: alistamiento (min) · crew: personas por unidad
KINDS = {
    "patrullero": {"label": "Patrullero PNP", "mode": "tierra", "origin": ["comisaria"], "crew": 3, "prep": 5, "factor": 0.85, "budget": "policia"},
    "motorizado": {"label": "Motorizado PNP", "mode": "tierra", "origin": ["comisaria"], "crew": 2, "prep": 3, "factor": 0.75, "budget": "policia"},
    "unidad_especial": {"label": "Unidad especial PNP", "mode": "tierra", "origin": ["comisaria"], "crew": 8, "prep": 20, "factor": 0.9, "budget": "policia"},
    "agentes": {"label": "Agentes a pie", "mode": "pie", "origin": ["comisaria"], "crew": 4, "prep": 5, "speed": 4.5, "budget": "policia"},
    "dron": {"label": "Dron de vigilancia", "mode": "aire", "origin": ["comisaria", "serenazgo"], "crew": 1, "prep": 6, "speed": 45, "budget": "policia"},
    "serenazgo": {"label": "Serenazgo", "mode": "tierra", "origin": ["serenazgo"], "crew": 2, "prep": 5, "factor": 0.95, "budget": "municipal"},
    "ambulancia": {"label": "Ambulancia", "mode": "tierra", "origin": ["hospital", "salud"], "crew": 3, "prep": 4, "factor": 0.8, "budget": "salud"},
    "bomberos": {"label": "Bomberos", "mode": "tierra", "origin": ["bomberos"], "crew": 6, "prep": 3, "factor": 0.85, "budget": "bomberos"},
    "fiscal": {"label": "Fiscal y peritos", "mode": "tierra", "origin": ["fiscalia"], "crew": 3, "prep": 15, "factor": 1.0, "budget": "fiscal"},
    "ejercito": {"label": "Ejército (camión de tropa)", "mode": "tierra", "origin": ["base_militar"], "crew": 12, "prep": 30, "factor": 1.1, "budget": "ffaa"},
    "marina": {"label": "Marina (lancha)", "mode": "agua", "origin": ["base_naval", "puerto"], "crew": 6, "prep": 20, "speed": 35, "budget": "ffaa"},
    "helicoptero": {"label": "Helicóptero", "mode": "aire", "origin": ["aeropuerto", "base_militar", "base_naval"], "crew": 4, "prep": 25, "speed": 200, "budget": "ffaa"},
    "logistica": {"label": "Camión logístico (víveres)", "mode": "tierra", "origin": ["mercado"], "crew": 2, "prep": 30, "factor": 1.15, "budget": "logistica"},
    "externo": {"label": "Colaboración externa", "mode": "tierra", "origin": [], "crew": 2, "prep": 30, "factor": 1.0, "budget": "externo"},
}
BUDGETS = {"policia": "Policía (PNP)", "municipal": "Serenazgo / municipalidad", "salud": "Salud", "bomberos": "Bomberos",
           "fiscal": "Ministerio Público (fiscal)", "ffaa": "Fuerzas Armadas", "logistica": "Logística y abastecimiento",
           "externo": "Colaboración externa"}
# incidencia: minutos en sitio y complejidad de acceso (multiplica el traslado) — supuestos, editables por operativo
INCIDENTS = {
    "intervencion": {"label": "Intervención / captura", "onsite": 90, "complexity": 1.0},
    "control": {"label": "Puesto de control / interdicción", "onsite": 240, "complexity": 1.0},
    "rescate": {"label": "Búsqueda y rescate", "onsite": 150, "complexity": 1.2},
    "incendio": {"label": "Incendio", "onsite": 120, "complexity": 1.0},
    "desastre": {"label": "Desastre (huaico, inundación, sismo)", "onsite": 360, "complexity": 1.4},
    "evacuacion": {"label": "Evacuación médica", "onsite": 45, "complexity": 1.0},
    "humanitaria": {"label": "Ayuda humanitaria / distribución", "onsite": 180, "complexity": 1.2},
    "orden_publico": {"label": "Orden público / evento masivo", "onsite": 300, "complexity": 1.1},
}
# perfil horario (multiplica la duración de flujo libre de OSRM). Supuesto genérico de ciudad grande, NO es una medición.
TRAFFIC_LABORAL = [1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.4, 1.8, 1.8, 1.5, 1.35, 1.35, 1.4, 1.4, 1.35, 1.35, 1.45, 1.8, 1.9, 1.7, 1.4, 1.2, 1.1, 1.0]
TRAFFIC_FINDE = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.35, 1.35, 1.3, 1.3, 1.3, 1.3, 1.35, 1.35, 1.3, 1.2, 1.15, 1.1, 1.0]
STRAIGHT_CIRCUITY = {"tierra": 1.4, "pie": 1.3, "agua": 1.25, "aire": 1.05}
# radio máximo para elegir la sede de salida automáticamente (línea recta, km): más allá se pide fijar el origen
AUTO_MAX_KM = {"tierra": 150, "pie": 15, "agua": 400, "aire": 600}
ROAD_DETOUR_MAX = 4.0   # ruta OSRM más de 4 veces la línea recta = no hay conexión vial razonable (p. ej. Iquitos)
# tarifario de EJEMPLO: valores ilustrativos para ver el desglose; no son tarifas oficiales ni precios de mercado verificados
EXAMPLE_TARIFF = {
    "patrullero": {"km": 1.2, "hora": 25, "persona_hora": 18, "fijo": 0}, "motorizado": {"km": 0.4, "hora": 10, "persona_hora": 18, "fijo": 0},
    "unidad_especial": {"km": 1.8, "hora": 40, "persona_hora": 22, "fijo": 150}, "agentes": {"km": 0, "hora": 0, "persona_hora": 18, "fijo": 0},
    "dron": {"km": 0, "hora": 35, "persona_hora": 20, "fijo": 40}, "serenazgo": {"km": 1.0, "hora": 20, "persona_hora": 12, "fijo": 0},
    "ambulancia": {"km": 1.5, "hora": 45, "persona_hora": 25, "fijo": 80}, "bomberos": {"km": 2.5, "hora": 60, "persona_hora": 0, "fijo": 120},
    "fiscal": {"km": 1.0, "hora": 20, "persona_hora": 45, "fijo": 0}, "ejercito": {"km": 3.0, "hora": 60, "persona_hora": 15, "fijo": 200},
    "marina": {"km": 12, "hora": 180, "persona_hora": 18, "fijo": 300}, "helicoptero": {"km": 0, "hora": 4500, "persona_hora": 40, "fijo": 800},
    "logistica": {"km": 2.2, "hora": 35, "persona_hora": 12, "fijo": 100}, "externo": {"km": 1.0, "hora": 20, "persona_hora": 15, "fijo": 0},
}
DEFAULTS = {"start_hour": 10, "day": "laboral", "rain": "ninguna", "congestion": None, "p_fail": 0.05, "fail_delay": 25,
            "sigma": 0.25, "return": True, "runs": 400, "seed": 7, "routing": "osrm", "use_tomtom": True}


class PlanError(ValueError):
    pass


def km(a_lat, a_lon, b_lat, b_lon) -> float:
    r = math.pi / 180
    h = math.sin((b_lat - a_lat) * r / 2) ** 2 + math.cos(a_lat * r) * math.cos(b_lat * r) * math.sin((b_lon - a_lon) * r / 2) ** 2
    return 2 * R_KM * math.asin(min(1.0, math.sqrt(h)))


# ── apoyos (sedes) ───────────────────────────────────────────────────────────────────────────────────────────────────
FAC_SOURCES = {"comisaria": "osm_instituciones", "serenazgo": "osm_instituciones", "fiscalia": "osm_instituciones",
               "judicial": "osm_instituciones", "hospital": "renipress", "salud": "renipress", "bomberos": "osm_servicios",
               "aeropuerto": "osm_infraestructura", "puerto": "osm_infraestructura", "base_militar": "osm_infraestructura",
               "base_naval": "osm_infraestructura", "mercado": "osm_infraestructura"}
FAC_LABEL = {"comisaria": "Comisaría", "serenazgo": "Serenazgo", "fiscalia": "Fiscalía", "judicial": "Poder Judicial",
             "hospital": "Hospital", "salud": "Centro de salud", "bomberos": "Bomberos", "aeropuerto": "Aeropuerto",
             "puerto": "Puerto / muelle", "base_militar": "Base militar", "base_naval": "Base naval", "mercado": "Mercado"}
_fac_cache: dict[str, list[dict]] = {}
_fac_lock = threading.Lock()


def _load_json(name: str) -> list[dict]:
    try:
        return json.loads((config.NORMALIZED / name).read_text(encoding="utf-8")).get("items", [])
    except (OSError, ValueError):
        return []


def all_facilities() -> list[dict]:
    with _fac_lock:
        if "all" in _fac_cache:
            return _fac_cache["all"]
        out = []
        for i in _load_json("instituciones.json"):
            out.append({"id": i["id"], "cat": i["cat"], "name": i["name"], "lat": i["lat"], "lon": i["lon"], "distrito": i.get("distrito"),
                        "kind": "vivo_tercero"})
        for i in _load_json("infraestructura.json"):
            out.append({"id": i["id"], "cat": i["cat"], "name": i["name"], "lat": i["lat"], "lon": i["lon"], "distrito": i.get("distrito"),
                        "detail": i.get("detail"), "kind": "vivo_tercero"})
        try:
            from ..storage import warehouse
            if warehouse.has("servicios"):
                rows = warehouse.query("SELECT cat, nombre, lat, lon, detalle, kind FROM servicios WHERE cat IN ('hospital','salud','bomberos') "
                                       "AND lat IS NOT NULL AND lon IS NOT NULL")
                for n, r in enumerate(rows):
                    out.append({"id": f"s{n}", "cat": r["cat"], "name": r["nombre"], "lat": float(r["lat"]), "lon": float(r["lon"]),
                                "detail": r.get("detalle"), "kind": r.get("kind") or "vivo_tercero"})
        except Exception:  # noqa: BLE001 — sin almacén se ofrecen las demás sedes
            pass
        _fac_cache["all"] = [f for f in out if isinstance(f["lat"], (int, float)) and isinstance(f["lon"], (int, float))]
        return _fac_cache["all"]


def _provenance(cats) -> list[dict]:
    return registry.provenance(*sorted({FAC_SOURCES[c] for c in cats if c in FAC_SOURCES}))


def facilities(bbox: tuple | None = None, cats: list[str] | None = None, limit: int = 4000) -> dict:
    cats = [c for c in (cats or FAC_LABEL) if c in FAC_LABEL]
    items = [f for f in all_facilities() if f["cat"] in cats]
    if bbox:
        w, s, e, n = bbox
        items = [f for f in items if w <= f["lon"] <= e and s <= f["lat"] <= n]
    return {"items": items[:limit], "truncated": len(items) > limit, "labels": FAC_LABEL, "provenance": _provenance(cats)}


def nearest(lat: float, lon: float, cats: list[str] | None = None, per_cat: int = 3, max_km: float = 400) -> dict:
    cats = [c for c in (cats or FAC_LABEL) if c in FAC_LABEL]
    out = {}
    for c in cats:
        rows = sorted(((km(lat, lon, f["lat"], f["lon"]), f) for f in all_facilities() if f["cat"] == c), key=lambda x: x[0])
        out[c] = [f | {"km": round(d, 2)} for d, f in rows[:per_cat] if d <= max_km]
    return {"point": [lon, lat], "by_cat": out, "labels": FAC_LABEL, "provenance": _provenance(cats),
            "note": "Distancia en línea recta. Ubicaciones aproximadas (OpenStreetMap) salvo salud (RENIPRESS)."}


# ── rutas ────────────────────────────────────────────────────────────────────────────────────────────────────────────
_route_cache: dict[tuple, dict] = {}


def _osrm(a: tuple, b: tuple) -> dict | None:
    k = (round(a[0], 4), round(a[1], 4), round(b[0], 4), round(b[1], 4))
    if k in _route_cache:
        return _route_cache[k]
    base = (config.setting("osrm_url") or "https://router.project-osrm.org").rstrip("/")
    url = f"{base}/route/v1/driving/{a[1]},{a[0]};{b[1]},{b[0]}?" + urllib.parse.urlencode({"overview": "simplified", "geometries": "geojson"})
    try:
        d = json.loads(http_get(url, timeout=20, retries=1, min_interval=1.0))
    except Exception:  # noqa: BLE001 — sin ruteo se usa línea recta declarada
        return None
    if d.get("code") != "Ok" or not d.get("routes"):
        return None
    r = d["routes"][0]
    out = {"km": r["distance"] / 1000, "min": r["duration"] / 60, "coords": [[round(x, 5), round(y, 5)] for x, y in r["geometry"]["coordinates"]]}
    _route_cache[k] = out
    return out


def _straight(a, b, mode):
    d = km(a[0], a[1], b[0], b[1])
    n = max(2, min(40, int(d / 2) + 2))
    coords = [[round(a[1] + (b[1] - a[1]) * t, 5), round(a[0] + (b[0] - a[0]) * t, 5)] for t in np.linspace(0, 1, n)]
    return {"km": d * STRAIGHT_CIRCUITY[mode], "min": None, "coords": coords, "straight_km": d}


# ── plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
def _num(v, default, lo, hi):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, x)) if math.isfinite(x) else default


def _hyp(body: dict) -> dict:
    h = {**DEFAULTS, **{k: v for k, v in (body.get("hypothesis") or {}).items() if v is not None}}
    h["start_hour"] = int(_num(h["start_hour"], 10, 0, 23))
    h["day"] = h["day"] if h["day"] in ("laboral", "finde") else "laboral"
    h["rain"] = h["rain"] if h["rain"] in acc.RAIN else "ninguna"
    h["p_fail"] = _num(h["p_fail"], 0.05, 0, 0.5)
    h["fail_delay"] = _num(h["fail_delay"], 25, 0, 240)
    h["sigma"] = _num(h["sigma"], 0.25, 0, 0.8)
    h["runs"] = int(_num(h["runs"], 400, 50, 2000))
    h["seed"] = int(_num(h["seed"], 7, 0, 10 ** 6))
    h["congestion"] = None if h.get("congestion") in (None, "") else _num(h["congestion"], 1.0, 0.5, 4.0)
    h["return"] = bool(h["return"])
    return h


def _traffic(h: dict, minute: float) -> float:
    if h["congestion"] is not None:
        return h["congestion"]
    prof = TRAFFIC_LABORAL if h["day"] == "laboral" else TRAFFIC_FINDE
    return prof[int(h["start_hour"] + minute / 60) % 24]


def _tomtom(lat, lon) -> dict | None:
    try:
        from ..live.traffic import PROVIDER
        if not PROVIDER.configured():
            return None
        p = PROVIDER.point(lat, lon)
        if p.get("current_speed") and p.get("free_flow_speed"):
            return {"factor": max(1.0, p["free_flow_speed"] / p["current_speed"]), "level": p.get("level"),
                    "current_speed": p["current_speed"], "free_flow_speed": p["free_flow_speed"]}
    except Exception:  # noqa: BLE001
        return None
    return None


def _origin(res: dict, op: dict, used_osrm: list) -> tuple[dict | None, str | None]:
    if isinstance(res.get("origin"), dict) and isinstance(res["origin"].get("lat"), (int, float)):
        o = res["origin"]
        return {"id": o.get("id") or "manual", "name": o.get("name") or "Origen fijado por el usuario", "cat": o.get("cat") or "manual",
                "lat": float(o["lat"]), "lon": float(o["lon"]), "kind": o.get("kind") or "usuario"}, None
    cats = KINDS[res["kind"]]["origin"]
    if not cats:
        return None, "Fija el origen en el mapa (colaboración externa)."
    # preferencia por orden de la lista (hospital antes que posta, aeropuerto antes que base): distancia ponderada
    # (×2,5 + 5 km para la 2.ª categoría; ×4 + 10 km para la 3.ª): una posta solo gana si el hospital está lejos
    weight = {c: ((1.0, 0), (2.5, 5), (4.0, 10))[min(i, 2)] for i, c in enumerate(cats)}
    best = min(((km(op["lat"], op["lon"], f["lat"], f["lon"]), f) for f in all_facilities() if f["cat"] in cats),
               key=lambda x: x[0] * weight[x[1]["cat"]][0] + weight[x[1]["cat"]][1], default=None)
    lim = AUTO_MAX_KM[KINDS[res["kind"]]["mode"]]
    if not best or best[0] > lim:
        return None, f"Sin {', '.join(FAC_LABEL[c] for c in cats)} a menos de {lim} km: fija el origen en el mapa o usa otro recurso."
    return best[1], None


def plan(body: dict) -> dict:
    ops = body.get("operations") or []
    if not isinstance(ops, list) or not ops:
        raise PlanError("Agrega al menos un operativo")
    if len(ops) > MAX_OPS:
        raise PlanError(f"Máximo {MAX_OPS} operativos por plan")
    h = _hyp(body)
    tariff_in = body.get("tariff") or {}
    tariff_origin = body.get("tariff_origin") if body.get("tariff_origin") in ("ejemplo", "usuario") else "usuario"
    rng = np.random.default_rng(h["seed"])
    osrm_calls = [0]
    out_ops, units, events, warnings = [], [], [], []
    tomtom_used = False
    n_res = 0
    for oi, op in enumerate(ops):
        try:
            lat, lon = float(op["lat"]), float(op["lon"])
        except (KeyError, TypeError, ValueError):
            raise PlanError(f"Operativo {oi + 1}: ubicación inválida")
        inc = INCIDENTS.get(op.get("incident")) or INCIDENTS["intervencion"]
        onsite = _num(op.get("onsite"), inc["onsite"], 5, 24 * 60)
        complexity = _num(op.get("complexity"), inc["complexity"], 0.8, 3.0)
        start = _num(op.get("start"), 0, 0, 24 * 60)
        tt = _tomtom(lat, lon) if h["use_tomtom"] and h["congestion"] is None else None
        tomtom_used = tomtom_used or bool(tt)
        opx = {"id": str(op.get("id") or f"op{oi + 1}"), "lat": lat, "lon": lon}
        op_units = []
        for ri, res in enumerate(op.get("resources") or []):
            kind = res.get("kind")
            if kind not in KINDS:
                continue
            n_res += 1
            if n_res > MAX_RES:
                raise PlanError(f"Máximo {MAX_RES} recursos por plan")
            K = KINDS[kind]
            qty = int(_num(res.get("qty"), 1, 1, 50))
            crew = int(_num(res.get("crew"), K["crew"], 0, 200))
            prep = _num(res.get("prep"), K["prep"], 0, 600)
            delay = _num(res.get("delay"), 0, 0, 24 * 60)
            o, why = _origin(res, opx, osrm_calls)
            uid = f"{opx['id']}-{ri + 1}"
            if not o:
                warnings.append({"op": opx["id"], "unit": uid, "msg": why})
                continue
            a, b = (o["lat"], o["lon"]), (lat, lon)
            route, engine = None, "línea recta × rodeo"
            if K["mode"] in ("tierra", "pie") and h["routing"] == "osrm" and km(*a, *b) > 0.05:
                if osrm_calls[0] < MAX_OSRM:
                    osrm_calls[0] += 1
                    route = _osrm(a, b)
                    engine = "OSRM" if route else "línea recta × rodeo (OSRM no respondió)"
                    if route and route["km"] > ROAD_DETOUR_MAX * max(1.0, km(*a, *b)):
                        warnings.append({"op": opx["id"], "unit": uid, "msg": f"Sin conexión vial razonable desde {o['name']} "
                                         f"({route['km']:.0f} km por carretera): usa un recurso aéreo o fluvial, o fija otro origen."})
                        continue
                else:
                    engine = f"línea recta × rodeo (tope de {MAX_OSRM} rutas OSRM por plan)"
            if not route:
                route = _straight(a, b, K["mode"])
            dist = route["km"]
            depart = start + delay
            # minutos base de traslado (sin variabilidad)
            if K["mode"] == "tierra":
                base_free = route["min"] if route.get("min") is not None else dist / acc.DEFAULTS["speed_kmh"] * 60
                traffic = tt["factor"] if tt else _traffic(h, depart + prep)
                travel = base_free * K["factor"] * float(res.get("factor") or 1) * traffic / acc.RAIN[h["rain"]] * complexity
            else:
                speed = _num(res.get("speed"), K["speed"], 1, 900)
                traffic = 1.0
                wx = acc.RAIN[h["rain"]] if K["mode"] in ("pie", "agua") else (1.0 if h["rain"] == "ninguna" else 0.85 if h["rain"] == "moderada" else 0.6)
                travel = dist / speed * 60 / wx * (complexity if K["mode"] == "pie" else 1.0)
            # Monte Carlo: variabilidad lognormal del traslado + falla con demora de reemplazo
            mult = rng.lognormal(-h["sigma"] ** 2 / 2, h["sigma"], h["runs"]) if h["sigma"] > 0 else np.ones(h["runs"])
            fails = rng.random(h["runs"]) < h["p_fail"]
            arr = depart + prep + travel * mult + fails * h["fail_delay"]
            p50, p90 = float(np.percentile(arr, 50)), float(np.percentile(arr, 90))
            # ensayo mostrado en la animación: el escenario central, con una falla si el usuario la pidió para ese recurso
            failed = bool(res.get("force_fail"))
            arrive = depart + prep + travel + (h["fail_delay"] if failed else 0)
            leave = arrive + onsite
            back = leave + (travel if h["return"] else 0)
            km_total = dist * (2 if h["return"] else 1)
            hours = (back - depart) / 60
            # aeronaves y drones: la hora se cobra solo en vuelo (ida y vuelta); los demás vehículos, toda la misión
            veh_hours = travel * (2 if h["return"] else 1) / 60 if K["mode"] == "aire" else hours
            rate = tariff_in.get(kind) or {}
            cost = {"personal": qty * crew * hours * _num(rate.get("persona_hora"), 0, 0, 1e6),
                    "vehiculo": qty * (km_total * _num(rate.get("km"), 0, 0, 1e6) + veh_hours * _num(rate.get("hora"), 0, 0, 1e7)),
                    "fijo": qty * _num(rate.get("fijo"), 0, 0, 1e7)}
            has_rate = any(_num(rate.get(k), 0, 0, 1e7) > 0 for k in ("persona_hora", "km", "hora", "fijo"))
            u = {"id": uid, "op": opx["id"], "kind": kind, "label": res.get("label") or K["label"], "qty": qty, "crew": crew,
                 "mode": K["mode"], "budget": K["budget"], "origin": {k: o.get(k) for k in ("id", "name", "cat", "lat", "lon", "kind")},
                 "coords": route["coords"], "km": round(dist, 2), "engine": engine,
                 "t": {"depart": round(depart, 1), "ready": round(depart + prep, 1), "arrive": round(arrive, 1), "leave": round(leave, 1),
                       "back": round(back, 1)},
                 "travel_min": round(travel, 1), "traffic_factor": round(traffic, 2), "failed": failed,
                 "arrive_p50": round(p50, 1), "arrive_p90": round(p90, 1), "fail_share": round(float(fails.mean()), 3),
                 "km_total": round(km_total, 1), "hours": round(hours, 2), "veh_hours": round(veh_hours, 2), "person_hours": round(qty * crew * hours, 1),
                 "cost": {k: round(v, 2) for k, v in cost.items()}, "cost_total": round(sum(cost.values()), 2), "has_rate": has_rate}
            op_units.append(u)
            units.append(u)
            events += [{"t": u["t"]["depart"], "unit": uid, "op": opx["id"], "type": "salida", "text": f"{u['label']} sale de {o['name']}"},
                       {"t": u["t"]["arrive"], "unit": uid, "op": opx["id"], "type": "llegada",
                        "text": f"{u['label']} llega al operativo" + (" (con falla y reemplazo)" if failed else "")},
                       {"t": u["t"]["leave"], "unit": uid, "op": opx["id"], "type": "cierre", "text": f"{u['label']} termina en el sitio"}]
            if failed:
                events.append({"t": round(depart + prep + travel / 2, 1), "unit": uid, "op": opx["id"], "type": "falla",
                               "text": f"{u['label']}: falla en ruta, +{h['fail_delay']:g} min de reemplazo (supuesto)"})
        arrivals = [u["t"]["arrive"] for u in op_units]
        out_ops.append({"id": opx["id"], "start": start, "onsite": onsite, "complexity": complexity,
                        "incident": op.get("incident") if op.get("incident") in INCIDENTS else "intervencion",
                        "traffic": tt and {"provider": "TomTom", **tt},
                        "first_arrival": round(min(arrivals), 1) if arrivals else None,
                        "all_arrived": round(max(arrivals), 1) if arrivals else None,
                        "all_arrived_p90": round(max(u["arrive_p90"] for u in op_units), 1) if op_units else None,
                        "end": round(max(u["t"]["back"] for u in op_units), 1) if op_units else None,
                        "units": len(op_units), "personnel": sum(u["qty"] * u["crew"] for u in op_units),
                        "cost_total": round(sum(u["cost_total"] for u in op_units), 2)})
    if not units:
        raise PlanError("Ningún recurso tiene origen: agrega recursos o fija su origen en el mapa")
    by_budget = {b: round(sum(u["cost_total"] for u in units if u["budget"] == b), 2) for b in BUDGETS}
    by_type = {t: round(sum(u["cost"][t] for u in units), 2) for t in ("personal", "vehiculo", "fijo")}
    any_rate = any(u["has_rate"] for u in units)
    sources = {"osm_instituciones", "osm_infraestructura", "renipress", "osm_servicios"}
    if any(u["engine"] == "OSRM" for u in units):
        sources.add("osrm")
    if tomtom_used:
        sources.add("tomtom_traffic")
    return {
        "hypothesis": h, "operations": out_ops, "units": sorted(units, key=lambda u: u["t"]["depart"]),
        "events": sorted(events, key=lambda e: e["t"]), "warnings": warnings,
        "totals": {"operations": len(out_ops), "units": sum(u["qty"] for u in units), "personnel": sum(u["qty"] * u["crew"] for u in units),
                   "km": round(sum(u["qty"] * u["km_total"] for u in units), 1), "person_hours": round(sum(u["person_hours"] for u in units), 1),
                   "first_arrival": min(u["t"]["arrive"] for u in units), "end": max(u["t"]["back"] for u in units),
                   "cost": round(sum(u["cost_total"] for u in units), 2) if any_rate else None,
                   "cost_by_budget": by_budget if any_rate else None, "cost_by_type": by_type if any_rate else None,
                   "currency": "PEN", "tariff_origin": tariff_origin if any_rate else None},
        "kinds": KINDS, "budgets": BUDGETS, "incidents": INCIDENTS,
        "kind": "estimacion",
        "method": (f"Traslado por tierra = duración OSRM de flujo libre × factor del recurso × tráfico "
                   f"({'TomTom en el destino' if tomtom_used else 'perfil horario supuesto' if h['congestion'] is None else 'factor fijado por el usuario'}) "
                   f"÷ lluvia ({h['rain']}) × complejidad de la incidencia; aire y agua en línea recta a la velocidad del recurso. "
                   f"Variabilidad lognormal σ={h['sigma']:g} y falla con probabilidad {h['p_fail']:.0%} (+{h['fail_delay']:g} min), "
                   f"{h['runs']} corridas con semilla {h['seed']} → P50/P90. Costo = tarifario "
                   f"{'de EJEMPLO (no oficial)' if tariff_origin == 'ejemplo' else 'ingresado por el usuario'} × km, horas de vehículo (en aeronaves solo horas de vuelo) y personas-hora."),
        "disclaimer": "Ejercicio de mesa con recursos hipotéticos. No es un plan operativo ni usa información reservada; "
                      "las sedes son ubicaciones aproximadas y los tiempos y costos son estimaciones con supuestos visibles.",
        "provenance": registry.provenance(*sorted(sources)),
    }


def catalog() -> dict:
    return {"kinds": KINDS, "budgets": BUDGETS, "incidents": INCIDENTS, "facility_labels": FAC_LABEL, "defaults": DEFAULTS,
            "traffic_profile": {"laboral": TRAFFIC_LABORAL, "finde": TRAFFIC_FINDE, "kind": "supuesto"},
            "example_tariff": EXAMPLE_TARIFF, "example_tariff_note": "Valores ilustrativos para ver el desglose. No son tarifas oficiales.",
            "counts": {c: sum(1 for f in all_facilities() if f["cat"] == c) for c in FAC_LABEL},
            "limits": {"operations": MAX_OPS, "resources": MAX_RES, "osrm_routes": MAX_OSRM}}

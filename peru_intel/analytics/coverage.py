"""Cobertura de comisarías y respuesta a un incidente (planificación exploratoria, sin personas ni predicción).

- `comisaria(id)`: área de atención por cercanía (celda de Voronoi: puntos más cerca de esta comisaría que de cualquier
  otra), radio de inflexión (mitad de la distancia a la comisaría vecina), sedes de serenazgo y otras entidades dentro
  del área, y cifras OFICIALES del distrito tal como se publican (nunca se reparten entre comisarías).
- `nearest(lat, lon)`: sedes más cercanas a un punto por tipo, con tiempo estimado = distancia en línea recta × rodeo
  ÷ velocidad (mismos supuestos declarados que el simulador de accesibilidad).

Las sedes vienen de OpenStreetMap (ubicación aproximada); la cobertura real depende de la red vial y del despliegue.
"""
from __future__ import annotations

import json
import math

from .. import config
from ..simulation import accessibility as sim_access

R_KM = 6371.0088
DUP_KM = 0.15
CATS = ("comisaria", "serenazgo", "fiscalia", "judicial")
INDICATORS = {201: "Comisarías básicas", 202: "Personal policial", 205: "Vehículos policiales operativos",
              102: "Personal de serenazgo", 103: "Vehículos de serenazgo operativos"}


class CoverageError(ValueError):
    pass


def _items() -> list[dict]:
    try:
        data = json.loads((config.NORMALIZED / "instituciones.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise CoverageError("Faltan las sedes (python -m peru_intel ingest instituciones --download)") from e
    return [i for i in data.get("items", []) if isinstance(i.get("lat"), (int, float)) and isinstance(i.get("lon"), (int, float))]


def km(a_lat, a_lon, b_lat, b_lon) -> float:
    r = math.pi / 180
    h = math.sin((b_lat - a_lat) * r / 2) ** 2 + math.cos(a_lat * r) * math.cos(b_lat * r) * math.sin((b_lon - a_lon) * r / 2) ** 2
    return 2 * R_KM * math.asin(min(1.0, math.sqrt(h)))


def _xy(lat0, lon0, lat, lon):
    """Plano local (km) centrado en la sede: suficiente para áreas urbanas de decenas de km."""
    return ((lon - lon0) * 111.32 * math.cos(math.radians(lat0)), (lat - lat0) * 110.574)


def _ll(lat0, lon0, x, y):
    return (lat0 + y / 110.574, lon0 + x / (111.32 * math.cos(math.radians(lat0))))


def _clip(poly, nx, ny, c):
    """Sutherland–Hodgman: conserva la parte del polígono con nx·x + ny·y ≤ c."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        dp, dq = nx * p[0] + ny * p[1] - c, nx * q[0] + ny * q[1] - c
        if dp <= 0:
            out.append(p)
        if (dp <= 0) != (dq <= 0):
            t = dp / (dp - dq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def _inside(poly, x, y):
    hit = False
    for i, (ax, ay) in enumerate(poly):
        bx, by = poly[i - 1]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def _official(ubigeo: str) -> dict:
    """Cifras oficiales del distrito (último año publicado), sin transformar; vacío si no se descargaron."""
    out = {"ubigeo": ubigeo, "indicators": [], "denuncias": None}
    try:
        from ..storage import warehouse
        if warehouse.has("mininter_indicadores"):
            rows = warehouse.query(
                "SELECT indicador, anio, valor FROM mininter_indicadores WHERE nivel = 'distrito' AND ubigeo = ? AND indicador IN "
                f"({','.join(map(str, INDICATORS))}) QUALIFY row_number() OVER (PARTITION BY indicador ORDER BY anio DESC) = 1", [ubigeo])
            out["indicators"] = [{"code": r["indicador"], "label": INDICATORS[r["indicador"]], "year": r["anio"], "value": r["valor"]} for r in rows]
        if warehouse.has("sidpol_denuncias"):
            r = warehouse.query("SELECT anio, sum(cantidad) n, count(DISTINCT mes) meses FROM sidpol_denuncias WHERE ubigeo = ? "
                                "GROUP BY anio ORDER BY anio DESC LIMIT 2", [ubigeo])
            full = next((x for x in r if x["meses"] == 12), None)
            if full:
                out["denuncias"] = {"year": full["anio"], "total": int(full["n"]), "per_day": round(full["n"] / 365, 1)}
    except Exception:  # noqa: BLE001 — sin almacén: se informa vacío, nunca se inventa
        pass
    try:
        from ..sources import registry
        out["provenance"] = registry.provenance("mininter_indicadores", "mininter_sidpol")
    except Exception:  # noqa: BLE001
        out["provenance"] = []
    return out


def comisaria(sid: str, max_km: float = 25.0) -> dict:
    items = _items()
    me = next((i for i in items if i.get("id") == sid and i.get("cat") == "comisaria"), None)
    if not me:
        raise CoverageError("Comisaría no encontrada.")
    lat0, lon0 = me["lat"], me["lon"]
    # OSM a veces repite la misma sede (nodo y edificio): a menos de DUP_KM se considera la misma comisaría
    others = sorted(((km(lat0, lon0, i["lat"], i["lon"]), i) for i in items if i["cat"] == "comisaria" and i["id"] != sid),
                    key=lambda t: t[0])
    duplicates = [o for d, o in others if d < DUP_KM]
    others = [(d, o) for d, o in others if d >= DUP_KM]
    near = [t for t in others if t[0] <= max_km][:40]
    # celda de Voronoi recortada a un cuadrado (sin vecinas cerca, el área queda limitada por max_km)
    half = min(max_km, (near[-1][0] if near else max_km))
    poly = [(-half, -half), (half, -half), (half, half), (-half, half)]
    for d, o in near:
        x, y = _xy(lat0, lon0, o["lat"], o["lon"])
        poly = _clip(poly, x, y, (x * x + y * y) / 2)
        if len(poly) < 3:
            break
    area = abs(sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))) / 2 if len(poly) >= 3 else 0
    ring = [list(reversed(_ll(lat0, lon0, x, y))) for x, y in poly]
    if ring:
        ring.append(ring[0])
    inside = {c: [] for c in CATS}
    for i in items:
        if i["id"] == sid or i["cat"] not in CATS or i in duplicates:
            continue
        if abs(i["lat"] - lat0) > 0.4 or abs(i["lon"] - lon0) > 0.4:
            continue
        x, y = _xy(lat0, lon0, i["lat"], i["lon"])
        if len(poly) >= 3 and _inside(poly, x, y):
            inside[i["cat"]].append({"id": i["id"], "name": i.get("name"), "lat": i["lat"], "lon": i["lon"],
                                     "km": round(km(lat0, lon0, i["lat"], i["lon"]), 2)})
    reach = max((math.hypot(x, y) for x, y in poly), default=0)
    neighbors = [{"id": o["id"], "name": o.get("name"), "lat": o["lat"], "lon": o["lon"], "km": round(d, 2),
                  "inflexion_km": round(d / 2, 2)} for d, o in others[:6]]
    return {
        "sede": {k: me.get(k) for k in ("id", "name", "lat", "lon", "ubigeo", "distrito", "provincia", "departamento")},
        "area": {"type": "Polygon", "coordinates": [ring]} if ring else None,
        "area_km2": round(area, 2), "reach_km": round(reach, 2),
        "inflexion_km": neighbors[0]["inflexion_km"] if neighbors else None,
        "mean_inflexion_km": round(sum(n["inflexion_km"] for n in neighbors[:3]) / len(neighbors[:3]), 2) if neighbors else None,
        "neighbors": neighbors, "duplicates": len(duplicates), "inside": inside, "inside_counts": {c: len(v) for c, v in inside.items()},
        "district": _official(me.get("ubigeo") or ""),
        "method": ("Área de atención por cercanía (Voronoi) en un plano local, limitada a %g km; radio de inflexión = mitad de la "
                   "distancia a la comisaría vecina. Ubicaciones OSM aproximadas; no considera red vial ni jurisdicción oficial." % max_km),
        "kind": "calculado",
        "provenance": [{"institution": "OpenStreetMap / colaboradores", "nature": "vivo_tercero", "geographic_level": "punto",
                        "transform": "Sedes etiquetadas police/townhall; cálculo geométrico propio."}],
    }


def nearest(lat: float, lon: float, per_cat: int = 3, speed_kmh: float | None = None, circuity: float | None = None) -> dict:
    lat, lon = float(lat), float(lon)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise CoverageError("Coordenadas inválidas.")
    d = sim_access.DEFAULTS
    speed = max(5.0, min(90.0, float(speed_kmh or d["speed_kmh"])))
    circ = max(1.0, min(3.0, float(circuity or d["circuity"])))
    per_cat = max(1, min(8, int(per_cat)))
    out = {}
    items = _items()
    for c in CATS:
        rows = sorted(((km(lat, lon, i["lat"], i["lon"]), i) for i in items if i["cat"] == c), key=lambda t: t[0])[:per_cat]
        out[c] = [{"id": i["id"], "name": i.get("name"), "lat": i["lat"], "lon": i["lon"], "km": round(dd, 2),
                   "eta_min": round(dd * circ / speed * 60, 1)} for dd, i in rows]
    return {"point": [lon, lat], "by_cat": out, "assumptions": {"speed_kmh": speed, "circuity": circ},
            "method": "Tiempo = distancia en línea recta × rodeo ÷ velocidad (supuestos del simulador; sin tráfico real).",
            "kind": "estimacion"}

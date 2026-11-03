"""Cauces (ríos, quebradas, canales) cartografiados en OpenStreetMap para el área visible.

OSM dibuja cada `waterway` en el sentido del flujo, así que el primer vértice es aguas arriba y el último aguas abajo.
Con esa convención se clasifica el destino de cada cauce: tributa a otro cauce del área, llega al mar (a menos de
1,5 km de la línea de costa OSM) o termina fuera de la vista. No se modela caudal, crecida ni velocidad.
"""
from __future__ import annotations

import math
import threading
import time
from functools import lru_cache

from .telecom import _request_payload

KINDS = {"river": "Río", "stream": "Quebrada", "canal": "Canal", "drain": "Dren", "wadi": "Quebrada seca"}
MAX_AREA = 0.5  # grados² ≈ 60 × 60 km; más amplio satura Overpass y no se lee en pantalla
_LOCK = threading.Lock()


def _near(a: tuple[float, float], pts: list[tuple[float, float]], km: float) -> bool:
    lat0 = math.radians(a[1])
    for b in pts:
        dx = (b[0] - a[0]) * 111.32 * math.cos(lat0)
        dy = (b[1] - a[1]) * 110.57
        if dx * dx + dy * dy <= km * km:
            return True
    return False


@lru_cache(maxsize=32)
def _fetch(key: tuple[float, float, float, float], _bucket: int) -> tuple[dict, str]:
    west, south, east, north = key
    bbox = f"{south},{west},{north},{east}"
    query = f"""[out:json][timeout:25];
(way["waterway"~"^(river|stream|canal|drain|wadi)$"]({bbox}););
out body geom 4000;
(way["natural"="coastline"]({bbox}););
out geom 400;"""
    payload = _request_payload(query)
    ways, coast = [], []
    for el in payload.get("elements", []):
        geom = [(round(p["lon"], 5), round(p["lat"], 5)) for p in el.get("geometry") or []]
        if len(geom) < 2:
            continue
        tags = el.get("tags") or {}
        if tags.get("natural") == "coastline":
            coast.extend(geom[::2])
        else:
            ways.append((el, tags, geom))
    node_owner: dict[int, list[int]] = {}
    for i, (el, _t, _g) in enumerate(ways):
        for n in el.get("nodes") or []:
            node_owner.setdefault(n, []).append(i)
    features = []
    for i, (el, tags, geom) in enumerate(ways):
        last = (el.get("nodes") or [None])[-1]
        joins = [j for j in node_owner.get(last, []) if j != i]
        if joins:
            target = ways[joins[0]][1]
            dest = "rio" if target.get("waterway") == "river" else "cauce"
            dest_name = target.get("name")
        elif coast and _near(geom[-1], coast, 1.5):
            dest, dest_name = "mar", "Océano Pacífico" if geom[-1][0] < -75 else None
        else:
            dest, dest_name = "fuera", None
        kind = tags.get("waterway")
        features.append({"type": "Feature", "id": el["id"], "geometry": {"type": "LineString", "coordinates": geom},
                         "properties": {"id": el["id"], "k": kind, "kl": KINDS.get(kind, kind), "name": tags.get("name") or tags.get("name:es"),
                                        "int": tags.get("intermittent") == "yes" or kind == "wadi", "dest": dest, "dest_name": dest_name,
                                        "url": f"https://www.openstreetmap.org/way/{el['id']}"}})
    return {"type": "FeatureCollection", "features": features}, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def within_view(bounds: tuple[float, float, float, float]) -> dict:
    west, south, east, north = bounds
    if not (-81.6 <= west < east <= -68.4 and -18.6 <= south < north <= 0.4):
        raise ValueError("bbox fuera del Perú o con límites inválidos")
    provenance = [{"source_id": "osm_waterways", "name": "Cauces cartografiados (waterway)", "institution": "OpenStreetMap Contributors",
                   "url": "https://wiki.openstreetmap.org/wiki/Key:waterway", "kind": "vivo_tercero", "official": False,
                   "geographic_level": "cauces en el área visible", "license": "ODbL 1.0 · © OpenStreetMap contributors",
                   "notes": "Mapa comunitario incompleto. El sentido de dibujo OSM indica el flujo aguas abajo; no es un modelo hidrológico."}]
    if (east - west) * (north - south) > MAX_AREA:
        return {"available": False, "zoom_in": True, "reason": "Acerca el mapa (≈ nivel de provincia) para trazar quebradas y ríos.", "provenance": provenance}
    key = tuple(round(x, 2) for x in bounds)  # rejilla de ~1 km: mover un poco el mapa reutiliza la consulta
    try:
        with _LOCK:
            fc, fetched = _fetch(key, int(time.time() // 3600))
    except Exception as exc:  # noqa: BLE001 — Overpass es externo
        status = getattr(exc, "code", None)
        return {"available": False, "reason": f"Overpass no respondió{f' (HTTP {status})' if status else ''}. Intenta en un momento.",
                "provenance": provenance}
    provenance[0]["downloaded"] = fetched
    dests = {}
    for f in fc["features"]:
        dests[f["properties"]["dest"]] = dests.get(f["properties"]["dest"], 0) + 1
    return {"available": True, "geojson": fc, "retrieved_at": fetched, "count": len(fc["features"]), "by_destination": dests,
            "truncated": len(fc["features"]) >= 4000, "provenance": provenance,
            "method": "Destino calculado por conectividad de nodos OSM y cercanía (≤ 1,5 km) a la línea de costa OSM."}

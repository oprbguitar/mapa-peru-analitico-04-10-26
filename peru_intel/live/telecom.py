"""Elementos de telecomunicaciones mapeados en OpenStreetMap, consultados por área."""
from __future__ import annotations

import json
import math
import time
import threading
import urllib.parse
import urllib.error
import urllib.request
from functools import lru_cache

OVERPASS = "https://overpass-api.de/api/interpreter"
# Current public instance formerly named kumi; maintained in OSM's API inventory.
OVERPASS_FALLBACK = "https://overpass.private.coffee/api/interpreter"
CATEGORIES = {"mobile": "Antena móvil registrada", "antenna": "Antena de telecomunicaciones", "tower": "Torre de comunicación"}
_FETCH_LOCK = threading.Lock()


def _categories(tags: dict) -> list[str]:
    predicates = {
        "mobile": tags.get("communication:mobile_phone") == "yes" or tags.get("telecom") == "mobile_phone",
        "antenna": tags.get("telecom") == "antenna" or tags.get("man_made") == "antenna",
        "tower": tags.get("tower:type") == "communication" or tags.get("mast:type") == "communication"
                 or tags.get("telecom") in {"mast", "tower"},
    }
    return [category for category, present in predicates.items() if present]


def _request_payload(query: str) -> dict:
    for endpoint in (OVERPASS, OVERPASS_FALLBACK):
        request = urllib.request.Request(
            endpoint, data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
            headers={"User-Agent": "MapaPeruAnalitico/0.4 (https://github.com/oprbguitar/mapa-peru-analitico-04-10-26)",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(request, timeout=24) as response:
                payload = json.loads(response.read())
            if payload.get("remark"):
                raise RuntimeError("Overpass devolvió una respuesta incompleta")
            return payload
        except (urllib.error.URLError, TimeoutError, RuntimeError):
            if endpoint == OVERPASS_FALLBACK:
                raise
    raise RuntimeError("Overpass no disponible")


def _distance_km(lat: float, lon: float, ref_lat: float, ref_lon: float) -> float:
    """Great-circle proximity to map center, not a propagation or signal model."""
    p1, p2 = math.radians(lat), math.radians(ref_lat)
    delta_p, delta_l = p2 - p1, math.radians(ref_lon - lon)
    a = math.sin(delta_p / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(delta_l / 2) ** 2
    return round(6371.0088 * 2 * math.asin(min(1, math.sqrt(a))), 3)


@lru_cache(maxsize=48)
def _fetch(bbox_key: tuple[float, float, float, float], _bucket: int) -> tuple[list[dict], str]:
    west, south, east, north = bbox_key
    bbox = f"{south},{west},{north},{east}"
    query = f"""[out:json][timeout:20];
(
 nwr[\"communication:mobile_phone\"=\"yes\"]({bbox});
 nwr[\"telecom\"=\"antenna\"]({bbox});
 nwr[\"tower:type\"=\"communication\"]({bbox});
 nwr[\"mast:type\"=\"communication\"]({bbox});
 nwr[\"telecom\"~\"^(mast|tower|mobile_phone)$\"]({bbox});
 nwr[\"man_made\"=\"antenna\"]({bbox});
);
out meta center 2501;"""
    payload = _request_payload(query)
    items = []
    seen = set()
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        tags = element.get("tags") or {}
        categories = _categories(tags)
        if not categories:
            continue
        category = categories[0]
        center = element.get("center") or {}
        lat, lon = element.get("lat", center.get("lat")), element.get("lon", center.get("lon"))
        if lat is None or lon is None or not (-18.6 <= float(lat) <= 0.2 and -81.6 <= float(lon) <= -68.4):
            continue
        items.append({"cat": category, "categorias": categories, "lat": float(lat), "lon": float(lon), "nombre": tags.get("name") or CATEGORIES[category],
                      "operador": tags.get("operator") or tags.get("operator:brand"), "altura": tags.get("height"),
                      "tecnologias": tags.get("communication:mobile_phone:technology") or tags.get("telecom:technology"),
                      "osm_timestamp": element.get("timestamp"),
                      "osm_type": key[0], "osm_id": key[1], "url": f"https://www.openstreetmap.org/{key[0]}/{key[1]}"})
    return items, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def within_view(bounds: tuple[float, float, float, float], categories: list[str]) -> dict:
    west, south, east, north = bounds
    if not (-81.6 <= west < east <= -68.4 and -18.6 <= south < north <= 0.2):
        raise ValueError("bbox fuera del Perú o con límites inválidos")
    if (east - west) * (north - south) > 8:
        return {"available": False, "reason": "Acerca el mapa para consultar infraestructura OSM en el área visible."}
    unknown = set(categories) - CATEGORIES.keys()
    if unknown:
        raise ValueError("categorías telecom no válidas")
    key = tuple(round(x, 3) for x in bounds)
    try:
        # Serialize upstream cache fills: simultaneous checkbox/move events must not flood Overpass.
        with _FETCH_LOCK:
            items, fetched_at = _fetch(key, int(time.time() // 300))
    except Exception as exc:  # noqa: BLE001 — Overpass es externo y puede estar saturado
        status = getattr(exc, "code", None)
        reason = f"Overpass no respondió{f' (HTTP {status})' if status else ''}. Intenta de nuevo en un momento."
        return {"available": False, "reason": reason,
                "provenance": [{"source_id": "osm_telecom", "name": "OpenStreetMap Contributors",
                                "url": "https://www.openstreetmap.org/copyright", "kind": "vivo_tercero",
                                "official": False, "license": "ODbL 1.0 · © OpenStreetMap contributors"}]}
    selected = [item | {"distancia_centro_vista_km": _distance_km(item["lat"], item["lon"], (south + north) / 2, (west + east) / 2)}
                for item in items if west <= item["lon"] <= east and south <= item["lat"] <= north
                and (not categories or set(item.get("categorias", [item["cat"]])).intersection(categories))]
    return {"available": True, "items": selected, "retrieved_at": fetched_at,
            "truncated": len(items) >= 2501,
            "proximity_reference": {"lat": (south + north) / 2, "lon": (west + east) / 2, "kind": "calculado", "method": "Haversine · WGS84 · radio medio 6371.0088 km"},
            "provenance": [{"source_id": "osm_telecom", "name": "Infraestructura de telecomunicaciones cartografiada",
                            "institution": "OpenStreetMap Contributors", "url": "https://www.openstreetmap.org/copyright",
                            "kind": "vivo_tercero", "official": False, "geographic_level": "objetos cartografiados en el área visible",
                            "downloaded": fetched_at, "license": "ODbL 1.0 · © OpenStreetMap contributors",
                            "notes": "Mapa comunitario incompleto; no es un inventario oficial ni representa necesariamente estaciones operativas."}],
            "disclaimer": "Registro comunitario OSM: puede estar incompleto. La ausencia de objetos no demuestra una zona sin cobertura. La proximidad es geométrica y no estima intensidad de señal ni estado operativo."}

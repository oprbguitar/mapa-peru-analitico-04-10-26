"""Elementos de telecomunicaciones mapeados en OpenStreetMap, consultados por área."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from functools import lru_cache

OVERPASS = "https://overpass-api.de/api/interpreter"
CATEGORIES = {"mobile": "Antena móvil registrada", "antenna": "Antena de telecomunicaciones", "tower": "Torre de comunicación"}


@lru_cache(maxsize=48)
def _fetch(bbox_key: tuple[float, float, float, float], _bucket: int) -> tuple[list[dict], str]:
    west, south, east, north = bbox_key
    bbox = f"{south},{west},{north},{east}"
    query = f"""[out:json][timeout:20];
(
 nwr[\"communication:mobile_phone\"=\"yes\"]({bbox});
 nwr[\"telecom\"=\"antenna\"]({bbox});
 nwr[\"tower:type\"=\"communication\"]({bbox});
);
out center tags 2500;"""
    request = urllib.request.Request(
        OVERPASS, data=urllib.parse.urlencode({"data": query}).encode("utf-8"),
        headers={"User-Agent": "MapaPeruAnalitico/0.3 (https://github.com/oprbguitar/mapa-peru-analitico-04-10-26)",
                 "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=28) as response:
        payload = json.loads(response.read())
    items = []
    seen = set()
    for element in payload.get("elements", []):
        key = (element.get("type"), element.get("id"))
        if key in seen:
            continue
        seen.add(key)
        tags = element.get("tags") or {}
        category = ("mobile" if tags.get("communication:mobile_phone") == "yes" else
                    "antenna" if tags.get("telecom") == "antenna" else "tower")
        center = element.get("center") or {}
        lat, lon = element.get("lat", center.get("lat")), element.get("lon", center.get("lon"))
        if lat is None or lon is None or not (-18.6 <= float(lat) <= 0.2 and -81.6 <= float(lon) <= -68.4):
            continue
        items.append({"cat": category, "lat": float(lat), "lon": float(lon), "nombre": tags.get("name") or CATEGORIES[category],
                      "operador": tags.get("operator"), "altura": tags.get("height"),
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
        items, fetched_at = _fetch(key, int(time.time() // 300))
    except Exception as exc:  # noqa: BLE001 — Overpass es externo y puede estar saturado
        status = getattr(exc, "code", None)
        reason = f"Overpass no respondió{f' (HTTP {status})' if status else ''}. Intenta de nuevo en un momento."
        return {"available": False, "reason": reason,
                "provenance": [{"source_id": "osm_telecom", "name": "OpenStreetMap Contributors",
                                "url": "https://www.openstreetmap.org/copyright", "kind": "vivo_tercero",
                                "official": False, "license": "ODbL 1.0 · © OpenStreetMap contributors"}]}
    selected = [item for item in items if not categories or item["cat"] in categories]
    return {"available": True, "items": selected, "retrieved_at": fetched_at,
            "provenance": [{"source_id": "osm_telecom", "name": "Infraestructura de telecomunicaciones cartografiada",
                            "institution": "OpenStreetMap Contributors", "url": "https://www.openstreetmap.org/copyright",
                            "kind": "vivo_tercero", "official": False, "geographic_level": "objetos cartografiados en el área visible",
                            "downloaded": fetched_at, "license": "ODbL 1.0 · © OpenStreetMap contributors",
                            "notes": "Mapa comunitario incompleto; no es un inventario oficial ni representa necesariamente estaciones operativas."}],
            "disclaimer": "Registro comunitario OSM: puede estar incompleto. La posición y las etiquetas no acreditan una estación oficial ni activa."}

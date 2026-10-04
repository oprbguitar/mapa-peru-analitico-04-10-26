"""Mapas base realistas y relieve 3D — portado de RUC360 portal/mapa_pro.py (capas) y mapa-vivo.js (terreno).

/tiles/base/<capa>/<z>/<x>/<y> sirve el mosaico desde data/tiles/<capa>, si no desde la caché de RUC360
(data/teselas, solo lectura) y si no lo baja una vez y lo guarda. Sin internet se usa lo guardado.

  satelite   Esri World Imagery (hasta z19)                   © Esri, Maxar, Earthstar Geographics
  etiquetas  Esri límites y lugares (modo híbrido)            © Esri
  sentinel   Sentinel-2 cloudless 2024 (10 m)                 © EOX, Copernicus — CC BY-NC-SA 4.0 (no comercial)
  topo       OpenTopoMap (relieve y curvas)                   © OpenTopoMap (CC BY-SA), © OSM
  dem        Terrain Tiles Terrarium (elevación para 3D)      © Mapzen/AWS (SRTM, GMTED, ETOPO1)
  ign100/50/25  Carta Nacional del IGN Perú (escaneada)       © Instituto Geográfico Nacional
"""
from __future__ import annotations

import os
import urllib.parse
from pathlib import Path

from .. import config
from ..sources.harvester import http_get

_IGN = "https://portalgeo.idep.gob.pe/geoportal/rest/services/MAPA_BASE/"
LAYERS = {
    "satelite": {"url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "ext": "jpg", "max": 19,
                 "label": "Satélite", "attribution": "© Esri, Maxar, Earthstar Geographics"},
    "etiquetas": {"url": "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
                  "ext": "png", "max": 19, "label": "Etiquetas", "attribution": "© Esri"},
    "sentinel": {"url": "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg", "ext": "jpg", "max": 15,
                 "label": "Sentinel-2 2024", "attribution": "Sentinel-2 cloudless 2024 © EOX IT Services (CC BY-NC-SA 4.0), datos Copernicus"},
    "topo": {"url": "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "ext": "png", "max": 17, "label": "Topográfico",
             "attribution": "© OpenTopoMap (CC BY-SA), © colaboradores de OpenStreetMap"},
    "dem": {"url": "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", "ext": "png", "max": 15,
            "label": "Relieve (elevación)", "attribution": "Terrain Tiles © Mapzen/AWS (SRTM, GMTED, ETOPO1)"},
    "ign100": {"url": _IGN + urllib.parse.quote("PERÚ_RASTER_100KACTUALIZADO1") + "/MapServer/tile/{z}/{y}/{x}", "ext": "img", "max": 16,
               "label": "Carta Nacional 1:100 000 (IGN)", "attribution": "© Instituto Geográfico Nacional del Perú"},
}


def _ruc_cache() -> Path | None:
    d = config.ruc360_dir()
    p = d / "data" / "teselas" if d else None
    return p if p and p.is_dir() else None


def _ctype(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"\x89PNG":
        return "image/png"
    return "application/octet-stream"


def tile(layer: str, z: int, x: int, y: int) -> tuple[bytes, str] | None:
    spec = LAYERS.get(layer)
    if not spec or not (0 <= z <= spec["max"]) or not (0 <= x < 2 ** z and 0 <= y < 2 ** z):
        return None
    rel = Path(layer, str(z), str(x), f"{y}.{spec['ext']}")
    for base in (config.DATA / "tiles", _ruc_cache()):
        if base:
            p = base / rel
            try:
                if p.stat().st_size > 100:
                    data = p.read_bytes()
                    return data, _ctype(data)
            except OSError:
                pass
    try:
        data = http_get(spec["url"].format(z=z, x=x, y=y), timeout=15, retries=1, min_interval=0.02,
                        headers={"Referer": "https://www.openstreetmap.org/"})
    except Exception:  # noqa: BLE001
        return None
    if len(data) < 100:  # mosaico vacío del servidor
        return None
    dest = config.DATA / "tiles" / rel
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, dest)
    except OSError:
        pass
    return data, _ctype(data)


def catalog() -> list[dict]:
    return [{"id": k, "label": v["label"], "maxzoom": v["max"], "attribution": v["attribution"],
             "tiles": f"/tiles/base/{k}/{{z}}/{{x}}/{{y}}"} for k, v in LAYERS.items()]

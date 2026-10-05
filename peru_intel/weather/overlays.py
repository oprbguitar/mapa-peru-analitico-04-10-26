"""Capas meteorológicas raster sobre el mapa: NASA GIBS (mundo) y SENAMHI · IDESEP (oficial Perú).

Pasan por el backend (/api/v1/intel/weather/tiles/<fuente>/<capa>/<z>/<x>/<y>.png):
- la CSP del navegador sigue en 'self';
- cada tesela queda en data/live/tiles/ (GIBS es inmutable por fecha; SENAMHI se renueva cada hora);
- sin internet se sirve lo guardado.

Nombres de capa verificados el 2026-10-04 con GetCapabilities (GIBS WMTS EPSG:3857 y GeoServer IDESEP).
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import re
import threading
import time
import urllib.parse

from .. import config
from ..sources.harvester import http_get

GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
GIBS_CAPS = f"{GIBS_BASE}/1.0.0/WMTSCapabilities.xml"
IDESEP = "https://idesep.senamhi.gob.pe/geoserver"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"]

GIBS = [  # id, capa GIBS, nivel máximo, formato, etiqueta, grupo
    ("truecolor", "VIIRS_SNPP_CorrectedReflectance_TrueColor", 9, "jpg", "Satélite color real (VIIRS, diario)", "Satélite"),
    ("clouds", "MODIS_Terra_Cloud_Fraction_Day", 6, "png", "Fracción de nubes (MODIS)", "Nubes"),
    ("cloudtop", "MODIS_Terra_Cloud_Top_Temp_Day", 6, "png", "Temperatura de tope de nubes (MODIS)", "Nubes"),
    ("precip", "IMERG_Precipitation_Rate", 6, "png", "Tasa de precipitación (GPM IMERG)", "Precipitación"),
    ("aerosol", "MODIS_Combined_Value_Added_AOD", 6, "png", "Aerosoles · espesor óptico (MODIS)", "Aerosoles"),
    ("lst", "MODIS_Terra_Land_Surface_Temp_Day", 7, "png", "Temperatura de superficie terrestre (día)", "Temperatura"),
    ("sst", "GHRSST_L4_MUR_Sea_Surface_Temperature", 7, "png", "Temperatura del mar (GHRSST MUR)", "Temperatura"),
    ("ssta", "GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies", 7, "png", "Anomalía de temperatura del mar (El Niño)", "Temperatura"),
]


def _senamhi_layers() -> list[tuple]:
    m = dt.date.today().month
    mm = f"{m:03d}"
    return [  # id, workspace, capa WMS, etiqueta, grupo, ttl (s)
        ("aviso24h", "g_prono_pp_24h", "view_aviso24h", "Aviso de lluvias intensas · 24 h", "Avisos", 1800),
        ("quebradas", "g_acti_quebrada", "view_av_activ_qdra", "Aviso de activación de quebradas", "Avisos", 1800),
        ("uv48", "g_03_04", "03_04_001_03_001_513_0000_00_00", "Índice UV · pronóstico 48 h", "Pronóstico", 3600),
        ("prob_pp", "g_03_02", "03_02_001_03_000_512_0000_00_00", "Probabilidad de ocurrencia de lluvias (pronóstico climático)", "Pronóstico", 21600),
        ("prob_tmax", "g_03_02", "03_02_003_03_000_512_0000_00_00", "Probabilidad de ocurrencia de Tmáx (pronóstico climático)", "Pronóstico", 21600),
        ("anom_pp1", "g_04_02", "04_02_005_03_002_512_0000_00_00", "Anomalía de precipitación · 1.ª década", "Monitoreo", 21600),
        ("anom_pp2", "g_04_02", "04_02_006_03_002_512_0000_00_00", "Anomalía de precipitación · 2.ª década", "Monitoreo", 21600),
        ("anom_tmax2", "g_04_05", "04_05_006_03_002_512_0000_00_00", "Anomalía de temperatura máxima · 2.ª década", "Monitoreo", 21600),
        ("anom_tmin2", "g_04_04", "04_04_006_03_002_512_0000_00_00", "Anomalía de temperatura mínima · 2.ª década", "Monitoreo", 21600),
        ("humedad2", "g_04_07", "04_07_002_03_001_531_0000_00_00", "Índice de humedad · 2.ª década", "Monitoreo", 21600),
        ("fwi", "g_09_03", "09_03_999_03_001_513_0000_00_00", "Índice meteorológico de incendios (FWI) actual", "Incendios", 3600),
        ("clim_tmax", "g_05_04", f"05_04_{mm}_03_001_512_0000_00_00", f"Temperatura máxima climatológica · {MESES[m - 1]}", "Climatología", 604800),
        ("clim_tmin", "g_05_03", f"05_03_{mm}_03_001_512_0000_00_00", f"Temperatura mínima climatológica · {MESES[m - 1]}", "Climatología", 604800),
    ]


_DATES: dict[str, str] = {}
_DATES_AT = 0.0
_LOCK = threading.Lock()


def gibs_dates() -> dict[str, str]:
    """Fecha más reciente publicada por capa (GetCapabilities, caché 6 h; sin red, la última conocida o ayer UTC)."""
    global _DATES_AT
    cache = config.LIVE / "gibs_dates.json"
    with _LOCK:
        if _DATES and time.time() - _DATES_AT < 21600:
            return dict(_DATES)
        try:
            xml = http_get(GIBS_CAPS, timeout=40, retries=1).decode("utf-8", "ignore")
            for _id, layer, *_ in GIBS:
                m = re.search(rf"<ows:Identifier>{layer}</ows:Identifier>.*?<Default>([0-9-]+)</Default>", xml, re.S)
                if m:
                    _DATES[layer] = m.group(1)
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(_DATES), encoding="utf-8")
        except Exception:  # noqa: BLE001
            try:
                _DATES.update(json.loads(cache.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass
        yesterday = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).strftime("%Y-%m-%d")
        for _id, layer, *_ in GIBS:
            # el «último día» de GIBS suele estar a medio cubrir: se usa como máximo el último día UTC completo
            _DATES[layer] = min(_DATES.get(layer, yesterday), yesterday)
        _DATES_AT = time.time()
        return dict(_DATES)


def catalog() -> dict:
    dates = gibs_dates()
    return {
        "gibs": [{"id": i, "label": lab, "group": g, "layer": layer, "maxzoom": lv, "date": dates.get(layer), "format": f,
                  "tiles": f"/api/v1/intel/weather/tiles/gibs/{i}/{{z}}/{{x}}/{{y}}.{f}", "kind": "vivo_tercero",
                  "attribution": "NASA EOSDIS GIBS"} for i, layer, lv, f, lab, g in GIBS],
        "senamhi": [{"id": i, "label": lab, "group": g, "workspace": ws, "layer": layer, "maxzoom": 12,
                     "tiles": f"/api/v1/intel/weather/tiles/senamhi/{i}/{{z}}/{{x}}/{{y}}.png", "kind": "oficial",
                     "bounds": [-81.6, -18.6, -68.4, 0.2], "attribution": "SENAMHI · IDESEP",
                     "service": f"{IDESEP}/{ws}/wms"} for i, ws, layer, lab, g, _ttl in _senamhi_layers()],
        "note": "GIBS: productos satelitales casi en tiempo real (~3 h). SENAMHI: geoservicios oficiales WMS del IDESEP.",
    }


def _bbox3857(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    r = 20037508.342789244
    size = 2 * r / (2 ** z)
    return -r + x * size, r - (y + 1) * size, -r + (x + 1) * size, r - y * size


def _tile_lonlat_bounds(z, x, y):
    n = 2 ** z
    lon0, lon1 = x / n * 360 - 180, (x + 1) / n * 360 - 180
    lat = lambda yy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))  # noqa: E731
    return lon0, lat(y + 1), lon1, lat(y)


def tile(src: str, lid: str, z: int, x: int, y: int) -> tuple[bytes, str] | None:
    if not (0 <= z <= 14 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        return None
    if src == "gibs":
        spec = next((g for g in GIBS if g[0] == lid), None)
        if not spec or z > spec[2]:
            return None
        _id, layer, lv, fmt, *_ = spec
        date = gibs_dates()[layer]
        path = config.LIVE / "tiles" / "gibs" / layer / date / str(z) / str(x) / f"{y}.{fmt}"
        url = f"{GIBS_BASE}/{layer}/default/{date}/GoogleMapsCompatible_Level{lv}/{z}/{y}/{x}.{fmt}"
        ttl = None  # inmutable para una fecha
        ctype = "image/jpeg" if fmt == "jpg" else "image/png"
    elif src == "senamhi":
        spec = next((s for s in _senamhi_layers() if s[0] == lid), None)
        if not spec:
            return None
        w, s, e, n = _tile_lonlat_bounds(z, x, y)
        if e < -82 or w > -68 or n < -19 or s > 0.5:  # fuera del Perú: no se consulta
            return b"", "image/png"
        _id, ws, layer, _lab, _g, ttl = spec
        b = _bbox3857(z, x, y)
        q = urllib.parse.urlencode({"service": "WMS", "version": "1.1.1", "request": "GetMap", "layers": layer, "styles": "",
                                    "srs": "EPSG:3857", "bbox": ",".join(f"{v:.2f}" for v in b), "width": 256, "height": 256,
                                    "format": "image/png", "transparent": "true"})
        url = f"{IDESEP}/{ws}/wms?{q}"
        path = config.LIVE / "tiles" / "senamhi" / layer / str(z) / str(x) / f"{y}.png"
        ctype = "image/png"
    else:
        return None
    try:
        fresh = ttl is None or time.time() - path.stat().st_mtime < ttl
        if fresh and path.stat().st_size > 0:
            return path.read_bytes(), ctype
    except OSError:
        pass
    try:
        data = http_get(url, timeout=25, retries=1, min_interval=0.05)
        if data[:1] == b"<":  # XML de error del servidor WMS/WMTS
            raise ValueError(data[:200].decode("utf-8", "ignore"))
    except Exception:  # noqa: BLE001 — sin red o fuera de cobertura: lo guardado, si existe
        try:
            return path.read_bytes(), ctype
        except OSError:
            return None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)
    except OSError:
        pass
    return data, ctype

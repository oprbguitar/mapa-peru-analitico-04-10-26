"""Dated NOAA infrared observations, inspired by GOdEyes weather provider.
No synthetic cloud mask: imagery includes cloud AND surface temperatures.
"""
from datetime import datetime, timezone, timedelta
import math
import re
import threading
import time
import urllib.parse
import xml.etree.ElementTree as ET
from ..sources.harvester import http_get, fetch

BASE = 'https://nowcoast.noaa.gov/geoserver/observations/satellite/ows'
LAYER = 'global_longwave_imagery_mosaic'
CAPABILITIES = BASE + '?service=WMS&request=GetCapabilities&version=1.3.0'
_lock = threading.Lock()
_cache = None
_cached_at = 0

def parse_capabilities(xml, now=None):
    now = now or datetime.now(timezone.utc)
    if len(xml) > 512 * 1024 or re.search(r'<!DOCTYPE|<!ENTITY', xml, re.I):
        raise ValueError('Metadatos satelitales no válidos')
    root = ET.fromstring(xml)
    for layer in root.iter():
        if layer.tag.split('}')[-1] != 'Layer': continue
        children = list(layer)
        if not any(c.tag.split('}')[-1] == 'Name' and c.text == LAYER for c in children): continue
        dims = [c for c in children if c.tag.split('}')[-1] == 'Dimension' and c.get('name') == 'time']
        if len(dims) != 1: raise ValueError('Fecha de observación no publicada')
        values = (dims[0].text or '').strip().split(',')
        if len(values) > 512: raise ValueError('Demasiadas observaciones')
        recent = []
        for value in values:
            value = value.strip()
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z', value):
                raise ValueError('Fecha explícita requerida; no se expanden intervalos')
            stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if stamp > now + timedelta(minutes=5): raise ValueError('Fecha futura no válida')
            if now - stamp <= timedelta(hours=24): recent.append(value)
        default = dims[0].get('default', '').replace('.000Z', 'Z')
        if default not in [v.strip().replace('.000Z', 'Z') for v in values]: raise ValueError('Fecha predeterminada no verificada')
        if not recent: raise ValueError('Observaciones satelitales vencidas')
        return sorted(set(recent))[-26:]
    raise ValueError('Capa satelital no publicada')

def manifest():
    global _cache, _cached_at
    with _lock:
        if _cache is not None and time.monotonic() - _cached_at < 600: return dict(_cache)
        snapshot = fetch('noaa_clouds', CAPABILITIES, 'capabilities.xml', timeout=15, retries=1)
        times = parse_capabilities(snapshot.path.read_text(encoding='utf-8'))
        downloaded = datetime.now(timezone.utc).isoformat()
        value = {'time': times[-1], 'times': times, 'model': 'NOAA nowCOAST · infrarrojo observado',
                 'resolution_m': 3000, 'layer': LAYER,
                 'description': 'Nubes y temperaturas de superficie en infrarrojo; no es una máscara exclusiva de nubes. Actualización horaria; latencia de origen aproximada de 2–3 horas.',
                 'provenance': {'publisher': 'NOAA/NWS nowCOAST', 'source_url': CAPABILITIES,
                    'nature': 'en vivo de tercero', 'acquisition_time': times[-1], 'downloaded_at': downloaded,
                    'raw_sha256': snapshot.sha256, 'geographic_level': 'raster global', 'transformation': 'WMS georreferenciado EPSG:3857; sin simulación'}}
        _cache, _cached_at = value, time.monotonic()
        return dict(value)

def tile_url(z, x, y, observation):
    if any(type(n) is not int for n in (z,x,y)) or not 0 <= z <= 11 or not 0 <= x < 2**z or not 0 <= y < 2**z:
        raise ValueError('Tesela no válida')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z', observation): raise ValueError('Fecha no válida')
    extent = math.pi * 6378137
    step = 2 * extent / 2**z
    bbox = [x*step-extent, extent-(y+1)*step, (x+1)*step-extent, extent-y*step]
    return BASE + '?' + urllib.parse.urlencode({'SERVICE':'WMS','VERSION':'1.3.0','REQUEST':'GetMap','LAYERS':LAYER,
        'STYLES':'reflectance','FORMAT':'image/png','TRANSPARENT':'true','CRS':'EPSG:3857','BBOX':','.join(map(str,bbox)),
        'WIDTH':256,'HEIGHT':256,'TIME':observation})

def tile(z, x, y, observation=None):
    metadata = manifest()
    observation = observation or metadata['time']
    if observation not in metadata['times']: raise ValueError('Fecha no publicada por NOAA')
    payload = http_get(tile_url(z,x,y,observation), timeout=20, retries=1)
    if len(payload) > 2*1024*1024 or not payload.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('Imagen satelital no válida')
    return payload

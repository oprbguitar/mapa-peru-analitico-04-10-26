"""Public Earth Search STAC; dates are acquisition metadata, never basemap dates."""
from __future__ import annotations

import json
import math
import re
import hashlib
import threading
import time
import copy
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from functools import lru_cache

STAC = 'https://earth-search.aws.element84.com/v1'
COLLECTION = 'sentinel-2-l2a'
ASSET_HOST = 'sentinel-cogs.s3.us-west-2.amazonaws.com'
_snapshot_lock = threading.Lock()
_raster_slots = threading.BoundedSemaphore(2)
_tile_slots = threading.BoundedSemaphore(1)
_item_lock = threading.Lock()
_catalog_cache = {}
CATALOG_CACHE_SECONDS = 120
CATALOG_CACHE_ENTRIES = 128


def _json(url, payload=None):
    from ..sources.harvester import fetch
    if payload:
        values = {key: json.dumps(value, separators=(',', ':')) if isinstance(value, (dict, list)) and key not in ('collections', 'bbox')
                  else ','.join(map(str, value)) if isinstance(value, list) else value for key, value in payload.items()}
        if 'sortby' in payload:
            values['sortby'] = ','.join(('-' if row['direction'] == 'desc' else '+') + row['field'] for row in payload['sortby'])
        url += '?' + urllib.parse.urlencode(values)
    filename = 'stac-' + hashlib.sha256(url.encode()).hexdigest()[:20] + '.json'
    # SourceHarvester temporary names are process-scoped; serialize snapshots.
    with _snapshot_lock:
        cached = _catalog_cache.get(url)
        if cached and time.monotonic() - cached[0] < CATALOG_CACHE_SECONDS:
            return copy.deepcopy(cached[1])
        snapshot = fetch('earth_search_sentinel2', url, filename, timeout=35, retries=1)
        result = json.loads(snapshot.path.read_bytes())
        result['_source_snapshot'] = {'downloaded_at': datetime.now(timezone.utc).isoformat(), 'sha256': snapshot.sha256}
        if len(_catalog_cache) >= CATALOG_CACHE_ENTRIES:
            oldest = min(_catalog_cache, key=lambda key: _catalog_cache[key][0])
            del _catalog_cache[oldest]
        _catalog_cache[url] = (time.monotonic(), result)
        return copy.deepcopy(result)


def validate_aoi(bbox=None, geometry=None):
    if isinstance(geometry, str):
        geometry = json.loads(geometry)
    if geometry is not None:
        if geometry.get('type') != 'Polygon' or len(geometry.get('coordinates', [])) != 1:
            raise ValueError('Selecciona un polígono simple, sin huecos.')
        ring = geometry['coordinates'][0]
        if not 4 <= len(ring) <= 101 or ring[0] != ring[-1]:
            raise ValueError('El polígono debe estar cerrado y tener entre 3 y 100 vértices.')
        points = [[float(p[0]), float(p[1])] for p in ring if len(p) == 2]
        if len(points) != len(ring) or not all(math.isfinite(v) for p in points for v in p):
            raise ValueError('Coordenadas inválidas.')
        bbox = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]
    else:
        bbox = [float(v) for v in bbox.split(',')] if isinstance(bbox, str) else list(bbox or [])
    if len(bbox) != 4 or not all(math.isfinite(float(v)) for v in bbox):
        raise ValueError('El área requiere oeste, sur, este y norte válidos.')
    w, s, e, n = map(float, bbox)
    if not (-81.6 <= w < e <= -68.4 and -18.6 <= s < n <= 0.2):
        raise ValueError('Selecciona un área dentro del ámbito del Perú.')
    if (e - w) * (n - s) > 4:
        raise ValueError('Reduce el área a un máximo de 4 grados cuadrados.')
    return [w, s, e, n], geometry


def visual_asset(item):
    asset = item.get('assets', {}).get('visual') or {}
    href = asset.get('href', '')
    parsed = urllib.parse.urlsplit(href)
    if parsed.scheme != 'https' or parsed.netloc != ASSET_HOST or not parsed.path.endswith('.tif'):
        raise ValueError('El catálogo no contiene una imagen RGB pública autorizada.')
    return href


def search_imagery(bbox=None, geometry=None, start=None, end=None, cloud=100, limit=24):
    extent, polygon = validate_aoi(bbox, geometry)
    cloud = float(cloud)
    if not math.isfinite(cloud) or not 0 <= cloud <= 100:
        raise ValueError('Nubosidad debe estar entre 0 y 100 %.')
    begin = date.fromisoformat(start or '2015-01-01')
    finish = date.fromisoformat(end or date.today().isoformat())
    if begin > finish:
        raise ValueError('La fecha inicial debe ser anterior a la final.')
    payload = {'collections': [COLLECTION], 'limit': min(50, max(1, int(limit))),
               'datetime': f'{begin}T00:00:00Z/{finish}T23:59:59Z',
               'query': {'eo:cloud_cover': {'lte': cloud}},
               'sortby': [{'field': 'properties.datetime', 'direction': 'desc'}]}
    payload.update({'intersects': polygon} if polygon else {'bbox': extent})
    data = _json(f'{STAC}/search', payload)
    items = []
    for item in data.get('features', []):
        props = item.get('properties', {})
        if not props.get('datetime'):
            continue
        try:
            visual_asset(item)
        except ValueError:
            continue
        items.append({'id': item['id'], 'acquired_at': props['datetime'], 'cloud_percent': props.get('eo:cloud_cover'),
                      'resolution_m': item['assets']['visual'].get('gsd', props.get('gsd')),
                      'bbox': item['bbox'], 'geometry': item.get('geometry'),
                      'tile_url': f'/api/v1/imagery/tiles/{urllib.parse.quote(item["id"], safe="")}/{{z}}/{{x}}/{{y}}.png',
                      'stac_url': f'{STAC}/collections/{COLLECTION}/items/{item["id"]}'})
    return {'available': True, 'items': items, 'bbox': extent, 'geometry': polygon,
            'truncated': len(items) >= payload['limit'], 'provenance': {
                'publisher': 'Copernicus Sentinel-2 / Element 84 Earth Search', 'url': f'{STAC}/collections/{COLLECTION}',
                'kind': 'vivo_tercero', 'downloaded_at': data.get('_source_snapshot', {}).get('downloaded_at', datetime.now(timezone.utc).isoformat()),
                'sha256': data.get('_source_snapshot', {}).get('sha256'),
                'transformation': 'Metadatos STAC sin interpolar; nubosidad de escena completa, no del recorte.',
                'license': 'Copernicus Sentinel data: free, full and open access'}}


def resolve_item(item_id):
    with _item_lock:
        return _resolve_item_cached(item_id)


@lru_cache(maxsize=128)
def _resolve_item_cached(item_id):
    if not re.fullmatch(r'S2[ABC]_\d{2}[A-Z]{3}_\d{8}_\d+_L2A', item_id):
        raise ValueError('Identificador de adquisición inválido.')
    item = _json(f'{STAC}/collections/{COLLECTION}/items/{item_id}')
    visual_asset(item)
    return item


resolve_item.cache_clear = _resolve_item_cached.cache_clear


def _rasterio():
    try:
        import rasterio
        return rasterio
    except ImportError as exc:
        raise RuntimeError('Exportación/render RGB requiere requirements-imagery.txt (rasterio).') from exc


def crop_geotiff(item_id, bbox=None, geometry=None):
    extent, polygon = validate_aoi(bbox, geometry)
    w, s, e, n = extent
    if (e - w) * (n - s) > 0.08:
        raise ValueError('Para descargar a 10 m reduce el área a 0,08 grados cuadrados (~1000 km²).')
    polygon = polygon or {'type': 'Polygon', 'coordinates': [[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
    item = resolve_item(item_id)
    rio = _rasterio()
    from rasterio.mask import mask
    from rasterio.warp import transform_geom
    with _raster_slots, rio.Env(GDAL_HTTP_TIMEOUT='35', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_CACHEMAX=32_000_000):
        with rio.open(visual_asset(item)) as source:
            transformed = transform_geom('EPSG:4326', source.crs, polygon)
            from rasterio.features import geometry_window
            window = geometry_window(source, [transformed])
            if window.width * window.height * source.count > 40_000_000:
                raise ValueError('Recorte demasiado grande; reduce el área.')
            image, transform = mask(source, [transformed], crop=True)
            if image.size > 40_000_000:
                raise ValueError('Recorte demasiado grande; reduce el área.')
            profile = {**source.profile, 'height': image.shape[1], 'width': image.shape[2], 'transform': transform, 'compress': 'deflate'}
            with rio.io.MemoryFile() as output:
                with output.open(**profile) as target:
                    target.write(image)
                    target.update_tags(acquisition_datetime=item['properties']['datetime'], source_stac=f'{STAC}/collections/{COLLECTION}/items/{item_id}', crop_geometry=json.dumps(polygon), source='Copernicus Sentinel-2')
                return output.read()


def render_tile(item_id, z, x, y):
    z, x, y = int(z), int(x), int(y)
    if not 0 <= z <= 18 or not (0 <= x < 2**z and 0 <= y < 2**z):
        raise ValueError('Tesela inválida.')
    item = resolve_item(item_id)
    from .. import config
    from pathlib import Path
    import os
    cache = config.DATA / 'cache' / 'imagery' / item_id / str(z) / str(x) / f'{y}.png'
    if cache.exists():
        return cache.read_bytes()
    rio = _rasterio()
    from rasterio.warp import reproject, Resampling, transform_bounds
    from rasterio.windows import from_bounds as window_from_bounds, Window, intersect
    from rasterio.transform import from_bounds
    import numpy as np
    half = 20037508.342789244
    size = half * 2 / 2**z
    transform = from_bounds(-half+x*size, half-(y+1)*size, -half+(x+1)*size, half-y*size, 256, 256)
    pixels = np.zeros((4, 256, 256), dtype='uint8')
    # Keep one raster slot free for interactive exports, even while many map tiles wait.
    with _tile_slots, _raster_slots, rio.Env(GDAL_HTTP_TIMEOUT='30', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_CACHEMAX=32_000_000):
        if cache.exists():
            return cache.read_bytes()
        with rio.open(visual_asset(item)) as source:
            # Read only the intersecting window at display resolution. A small
            # out_shape explicitly selects COG overviews, avoiding full-resolution
            # remote reads at low zoom. The georeferenced export remains native.
            tile_bounds = (-half+x*size, half-(y+1)*size, -half+(x+1)*size, half-y*size)
            bounds = transform_bounds('EPSG:3857', source.crs, *tile_bounds)
            window = window_from_bounds(*bounds, transform=source.transform)
            raster_window = Window(0, 0, source.width, source.height)
            if intersect(window, raster_window):
                clipped = window.intersection(raster_window)
                col, row = math.floor(clipped.col_off), math.floor(clipped.row_off)
                window = Window(col, row, math.ceil(clipped.col_off + clipped.width) - col,
                                math.ceil(clipped.row_off + clipped.height) - row)
                scale = max(1, max(window.width, window.height) / 512)
                width, height = max(1, math.ceil(window.width / scale)), max(1, math.ceil(window.height / scale))
                rgb = source.read(indexes=[1, 2, 3], window=window, out_shape=(3, height, width), resampling=Resampling.bilinear)
                src_transform = source.window_transform(window) * rio.Affine.scale(window.width / width, window.height / height)
                reproject(rgb, pixels[:3], src_transform=src_transform, src_crs=source.crs,
                          dst_transform=transform, dst_crs='EPSG:3857', src_nodata=0, dst_nodata=0,
                          resampling=Resampling.bilinear, warp_mem_limit=32)
    pixels[3] = np.where(np.any(pixels[:3] != 0, axis=0), 255, 0)
    with rio.io.MemoryFile() as output:
        with output.open(driver='PNG', height=256, width=256, count=4, dtype='uint8') as target:
            target.write(pixels)
        content = output.read()
    cache.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache.with_name(f'.{y}-{threading.get_ident()}.part')
    temporary.write_bytes(content)
    os.replace(temporary, cache)
    return content

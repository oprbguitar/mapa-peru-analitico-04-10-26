"""Mapillary metadata and bounded image proxy. Credentials remain server-side."""
from __future__ import annotations

import json
import math
import os
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from .. import config
from ..sources.harvester import http_get


def _bbox(value):
    try:
        values = tuple(float(v) for v in str(value).split(','))
    except ValueError as exc:
        raise ValueError('Área Mapillary inválida.') from exc
    if len(values) != 4 or not all(math.isfinite(v) for v in values):
        raise ValueError('Área Mapillary inválida.')
    w, s, e, n = values
    if not (-180 <= w < e <= 180 and -90 <= s < n <= 90):
        raise ValueError('Área Mapillary inválida.')
    if e - w > .25 or n - s > .25:
        raise ValueError('Acérquese al mapa: máximo 0.25 grados por lado para imágenes de calle.')
    return values


def _graph(path, fields, extra=None):
    token = config.setting('mapillary_token')
    if not token:
        raise ValueError('Configure la clave Mapillary en Claves.')
    query = urllib.parse.urlencode({'fields': fields, **(extra or {})})
    # Never send token in URL: upstream errors may include request URLs.
    return json.loads(http_get(f'https://graph.mapillary.com/{path}?{query}',
        headers={'Authorization': f'OAuth {token}'}, timeout=15, retries=1))


def search(bbox):
    bounds = _bbox(bbox)
    if not config.setting('mapillary_token'):
        return {'status': 'key_required', 'items': [], 'note': 'Configure la clave Mapillary en Claves.'}
    result = _graph('images', 'id,captured_at,computed_geometry,is_pano',
                    {'bbox': ','.join(map(str, bounds)), 'limit': 100})
    items = []
    for row in result.get('data', []):
        image_id = str(row.get('id', ''))
        coordinates = (row.get('computed_geometry') or {}).get('coordinates')
        if not re.fullmatch(r'\d{1,30}', image_id) or not isinstance(coordinates, list) or len(coordinates) != 2:
            continue
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in coordinates):
            continue
        lon, lat = coordinates
        if not bounds[0] <= lon <= bounds[2] or not bounds[1] <= lat <= bounds[3]:
            continue
        captured = row.get('captured_at')
        try:
            at = datetime.fromtimestamp(float(captured) / 1000, timezone.utc).isoformat()
        except (ValueError, TypeError, OverflowError, OSError):
            at = None
        items.append({'id': image_id, 'lon': lon, 'lat': lat, 'captured_at': at,
                      'is_pano': bool(row.get('is_pano')), 'thumbnail': f'/api/v1/street/image/{image_id}',
                      'url': f'https://www.mapillary.com/app/?pKey={image_id}&focus=photo'})
    return {'status': 'ok', 'items': items, 'truncated': bool(result.get('paging', {}).get('next')),
            'note': 'Fotografías comunitarias históricas; la ausencia de fotos no acredita ausencia de vías.',
            'provenance': {'institution': 'Mapillary / colaboradores', 'nature': 'vivo_tercero',
                           'url': 'https://www.mapillary.com/', 'geographic_level': 'punto',
                           'downloaded_at': datetime.now(timezone.utc).isoformat(),
                           'transform': 'Consulta bbox; máximo 100 fotos; captured_at milisegundos UTC.',
                           'license': 'Mapillary attribution required'}}


def thumbnail(image_id, big=False):
    if not re.fullmatch(r'\d{1,30}', str(image_id)):
        raise ValueError('Identificador Mapillary inválido.')
    field = 'thumb_2048_url' if big else 'thumb_1024_url'
    metadata = _graph(str(image_id), field)
    url = str(metadata.get(field, ''))
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError('Miniatura Mapillary inválida.')
    if not any(host.endswith('.' + suffix) for suffix in ('fbcdn.net', 'mapillary.com')):
        raise ValueError('Origen de miniatura Mapillary no permitido.')
    # Fixed CDN host allowlist; no caller-controlled URL; redirects rejected by transport.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError('Redirección de miniatura Mapillary no permitida.')
    request = urllib.request.Request(url, headers={'User-Agent': config.USER_AGENT})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
        data = response.read(5_000_001)
    if len(data) > 5_000_000:
        raise ValueError('La miniatura Mapillary excede el tamaño permitido.')
    if data.startswith(b'\xff\xd8\xff'):
        return data, 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return data, 'image/png'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return data, 'image/webp'
    raise ValueError('La miniatura Mapillary no contiene una imagen válida.')


# ── Cobertura por teselas vectoriales y búsqueda por clic ───────────────────
# La búsqueda por recuadro de la Graph API falla con «reduce the amount of data» incluso en áreas pequeñas
# de ciudades densas (Lima): la cobertura se pinta con las teselas oficiales y las fotos se piden en ~60 m.
TILE_URL = 'https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}'
TILE_TTL = 7 * 86400
FIELDS = 'id,captured_at,computed_geometry,is_pano,sequence,compass_angle'


def coverage_tile(z, x, y):
    """Tesela vectorial de cobertura (secuencias). Token en el servidor; caché en disco 7 días."""
    if not (0 <= z <= 14 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        raise ValueError('Tesela fuera de rango.')
    token = config.setting('mapillary_token')
    if not token:
        raise ValueError('Configure la clave Mapillary en Claves.')
    path = config.LIVE / 'tiles' / 'mapillary' / str(z) / str(x) / f'{y}.pbf'
    try:
        if time.time() - path.stat().st_mtime < TILE_TTL:
            return path.read_bytes()
    except OSError:
        pass
    url = TILE_URL.format(z=z, x=x, y=y) + '?' + urllib.parse.urlencode({'access_token': token})
    try:
        data = http_get(url, timeout=40, retries=1)
    except Exception:  # noqa: BLE001 — sin red: lo guardado; el error nunca expone la URL con el token
        try:
            return path.read_bytes()
        except OSError:
            raise RuntimeError('Mapillary no respondió.') from None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + '.tmp')
        tmp.write_bytes(data)
        os.replace(tmp, path)
    except OSError:
        pass
    return data


def _row(row):
    image_id = str(row.get('id', ''))
    coordinates = (row.get('computed_geometry') or {}).get('coordinates')
    if not re.fullmatch(r'\d{1,30}', image_id) or not isinstance(coordinates, list) or len(coordinates) != 2:
        return None
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in coordinates):
        return None
    try:
        at = datetime.fromtimestamp(float(row.get('captured_at')) / 1000, timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        at = None
    seq = str(row.get('sequence') or '')
    compass = row.get('compass_angle')
    return {'id': image_id, 'lon': coordinates[0], 'lat': coordinates[1], 'captured_at': at, 'is_pano': bool(row.get('is_pano')),
            'sequence': seq if re.fullmatch(r'[A-Za-z0-9_-]{1,64}', seq) else '',
            'compass': compass if isinstance(compass, (int, float)) and math.isfinite(compass) else None,
            'thumbnail': f'/api/v1/street/image/{image_id}' + ('?size=2048' if row.get('is_pano') else ''),
            'url': f'https://www.mapillary.com/app/?pKey={image_id}&focus=photo'}


def near(lon, lat, pano='', since=''):
    """Foto más cercana a un clic (radio ~60 m), con filtros 360°/plana y fecha mínima."""
    lon, lat = float(lon), float(lat)
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise ValueError('Coordenadas inválidas.')
    if not config.setting('mapillary_token'):
        return {'status': 'key_required', 'item': None, 'note': 'Configure la clave Mapillary en Claves.'}
    d = 0.00055
    extra = {'bbox': f'{lon - d:.6f},{lat - d:.6f},{lon + d:.6f},{lat + d:.6f}', 'limit': 60}
    if pano in ('true', 'false'):
        extra['is_pano'] = pano
    if since and re.fullmatch(r'\d{4}-\d{2}-\d{2}', since):
        extra['start_captured_at'] = since + 'T00:00:00Z'
    rows = [r for r in map(_row, _graph('images', FIELDS, extra).get('data', [])) if r]
    k = math.cos(math.radians(lat))
    rows.sort(key=lambda r: ((r['lon'] - lon) * k) ** 2 + (r['lat'] - lat) ** 2)
    return {'status': 'ok', 'item': rows[0] if rows else None, 'count': len(rows),
            'note': '' if rows else 'Sin fotos a ~60 m de este punto con los filtros elegidos.',
            'provenance': {'institution': 'Mapillary / colaboradores', 'nature': 'vivo_tercero', 'url': 'https://www.mapillary.com/',
                           'geographic_level': 'punto', 'downloaded_at': datetime.now(timezone.utc).isoformat(),
                           'license': 'CC BY-SA 4.0 · atribución Mapillary'}}


def image(image_id):
    if not re.fullmatch(r'\d{1,30}', str(image_id)):
        raise ValueError('Identificador Mapillary inválido.')
    row = _row(_graph(str(image_id), FIELDS))
    if not row:
        raise ValueError('La foto no tiene posición publicada.')
    return row


def sequence(seq_id):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', str(seq_id)):
        raise ValueError('Secuencia Mapillary inválida.')
    ids = [str(r.get('id')) for r in _graph('image_ids', 'id', {'sequence_id': seq_id}).get('data', [])]
    return {'sequence': seq_id, 'ids': [i for i in ids if re.fullmatch(r'\d{1,30}', i)][:3000]}

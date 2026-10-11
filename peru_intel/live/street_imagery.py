"""Mapillary metadata and bounded image proxy. Credentials remain server-side."""
from __future__ import annotations

import json
import math
import re
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


def thumbnail(image_id):
    if not re.fullmatch(r'\d{1,30}', str(image_id)):
        raise ValueError('Identificador Mapillary inválido.')
    metadata = _graph(str(image_id), 'thumb_1024_url')
    url = str(metadata.get('thumb_1024_url', ''))
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

"""Bounded replay of actual locally received ADS-B positions, never synthetic history."""
from __future__ import annotations

import math
import re
import time
from datetime import datetime, timezone

from ..storage import sqlite_store

MAX_WINDOW = 7 * 86400
GAP_SECONDS = 300


def _window(start=None, end=None):
    end = time.time() if end in (None, '') else float(end)
    start = end - 6 * 3600 if start in (None, '') else float(start)
    if not all(math.isfinite(v) for v in (start, end)) or start < 0 or end <= start:
        raise ValueError('Fechas inválidas: use segundos Unix y un intervalo creciente.')
    if end - start > MAX_WINDOW:
        raise ValueError('El intervalo máximo es de siete días.')
    return int(start), int(end)


def _iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


def list_tracks(start=None, end=None):
    start, end = _window(start, end)
    rows = sqlite_store.connect().execute(
        'SELECT hex, MIN(t) AS start, MAX(t) AS end, COUNT(*) AS count '
        'FROM aircraft_tracks WHERE t >= ? AND t <= ? GROUP BY hex ORDER BY MAX(t) DESC LIMIT 200',
        (start, end)).fetchall()
    return {'items': [dict(row) for row in rows], 'start': start, 'end': end,
            'note': 'Solo trayectorias recibidas por este servidor; retención de siete días.'}


def history(hexa, start=None, end=None):
    if not isinstance(hexa, str) or not re.fullmatch(r'[0-9a-fA-F]{6}', hexa):
        raise ValueError('ICAO inválido: se requieren seis caracteres hexadecimales.')
    start, end = _window(start, end)
    rows = sqlite_store.connect().execute(
        'SELECT t, lat, lon, alt FROM aircraft_tracks WHERE hex = ? AND t >= ? AND t <= ? '
        'ORDER BY t LIMIT 10000', (hexa.lower(), start, end)).fetchall()
    points = []
    previous = None
    for row in rows:
        lat, lon, alt = row['lat'], row['lon'], row['alt']
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon)):
            continue
        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            continue
        # Legacy collector conflates unknown altitude with on-ground 0: do not claim either.
        altitude = alt * .3048 if isinstance(alt, (int, float)) and math.isfinite(alt) and alt > 0 else None
        points.append({'t': row['t'], 'received_at': _iso(row['t']), 'lat': lat, 'lon': lon,
                       'altitude_ft': alt if altitude is not None else None,
                       'altitude_m': round(altitude, 2) if altitude is not None else None,
                       'gap_before': previous is not None and row['t'] - previous > GAP_SECONDS})
        previous = row['t']
    return {'hex': hexa.lower(), 'points': points, 'available': len(points) >= 2,
            'start': start, 'end': end, 'gap_seconds': GAP_SECONDS,
            'note': ('Posiciones históricas recibidas localmente; interpolación visual entre muestras, '
                     'sin unir vacíos mayores a cinco minutos. Altitud barométrica; no altura exacta sobre terreno.')
                    if len(points) >= 2 else 'El servidor no dispone de dos posiciones en ese intervalo.',
            'provenance': {'nature': 'vivo_tercero', 'institution': 'Redes ADS-B comunitarias',
                           'sources': ['adsb.lol', 'airplanes.live', 'adsb.fi'],
                           'timestamp_semantics': 'received_at', 'geographic_level': 'punto',
                           'period_start': _iso(start), 'period_end': _iso(end),
                           'downloaded_at': points[-1]['received_at'] if points else None,
                           'transform': 'SQLite local; pies × 0.3048 a metros; muestreo 5 km/120 s.',
                           'limitations': 'El almacenamiento legado no conserva la red ni tiempo de adquisición por punto. '
                                           'Cero significa suelo o desconocido y se entrega como null.'}}

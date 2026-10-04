"""AircraftProvider — ADS-B comunitario (adsb.lol), patrón portado de RUC360 portal/capas_vivas.py.

adsb.lol limita el radio por consulta (250 nm), así que se cubren los corredores aéreos del Perú con
seis círculos. Histórico reducido en SQLite (`aircraft_tracks`): una posición por aeronave solo si se movió
más de ~5 km o pasaron 120 s desde la última guardada; retención de 7 días.
"""
from __future__ import annotations

import json
import time
import urllib.parse

from ..sources.harvester import http_get
from ..storage import sqlite_store
from .worker import Worker

CIRCLES = [(-12.0, -77.1), (-6.5, -79.5), (-3.8, -73.3), (-9.0, -74.5), (-13.5, -71.9), (-16.4, -71.5)]
BBOX = (-20.1, -83.1, 1.7, -66.9)  # Perú + 1.5° de margen
_LAST_SAVED: dict[str, tuple[float, float, float]] = {}
RETENTION_S = 7 * 86400


def _in_bbox(lat, lon) -> bool:
    s, w, n, e = BBOX
    return s <= lat <= n and w <= lon <= e


def _persist(items: list[dict]) -> None:
    now = time.time()
    rows = []
    for a in items:
        prev = _LAST_SAVED.get(a["hex"])
        if prev and now - prev[0] < 120 and abs(prev[1] - a["lat"]) + abs(prev[2] - a["lon"]) < 0.05:
            continue
        _LAST_SAVED[a["hex"]] = (now, a["lat"], a["lon"])
        rows.append((a["hex"], int(now), a["lat"], a["lon"], a.get("alt")))
    if rows:
        with sqlite_store.tx() as con:
            con.executemany("INSERT OR IGNORE INTO aircraft_tracks(hex, t, lat, lon, alt) VALUES (?,?,?,?,?)", rows)
            con.execute("DELETE FROM aircraft_tracks WHERE t < ?", (int(now - RETENTION_S),))


def fetch() -> dict:
    seen: dict[str, dict] = {}
    errors = 0
    for lat, lon in CIRCLES:
        try:
            d = json.loads(http_get(f"https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/250", timeout=12, retries=1,
                                    min_interval=1.2))
        except Exception:  # noqa: BLE001 — un círculo caído no anula los demás
            errors += 1
            continue
        for a in d.get("ac") or []:
            if a.get("lat") is None or not _in_bbox(a["lat"], a["lon"]):
                continue
            alt = a.get("alt_baro")
            seen[a["hex"]] = {
                "hex": a["hex"], "callsign": (a.get("flight") or "").strip(), "reg": a.get("r") or "",
                "type": a.get("t") or "", "lat": a["lat"], "lon": a["lon"],
                "alt": alt if isinstance(alt, (int, float)) else 0, "ground": alt == "ground",
                "speed": round(a.get("gs") or 0), "track": a.get("track") or a.get("true_heading") or 0,
                "squawk": a.get("squawk") or "", "military": bool((a.get("dbFlags") or 0) & 1),
            }
    if errors == len(CIRCLES):
        raise ConnectionError("adsb.lol no respondió en ningún círculo")
    items = sorted(seen.values(), key=lambda v: v["callsign"] or "~")
    _persist(items)
    return {"items": items, "partial": errors > 0, "attribution": "adsb.lol (ODbL)",
            "note": "Aeronaves que transmiten ADS-B ahora sobre Perú. Cobertura comunitaria: puede haber vacíos."}


def track(hexa: str, hours: float = 6) -> list[dict]:
    con = sqlite_store.connect()
    rows = con.execute("SELECT t, lat, lon, alt FROM aircraft_tracks WHERE hex = ? AND t > ? ORDER BY t",
                       (hexa, int(time.time() - hours * 3600))).fetchall()
    return [dict(r) for r in rows]


def details(callsign: str, hexa: str) -> dict:
    """Ruta (origen → destino) y aeronave según adsbdb.com, con caché de 1 h."""
    key = f"{callsign}:{hexa}"
    hit = _DETAILS.get(key)
    if hit and time.time() - hit[0] < 3600:
        return hit[1]
    out: dict = {"callsign": callsign, "hex": hexa}
    if callsign:
        try:
            fr = json.loads(http_get("https://api.adsbdb.com/v0/callsign/" + urllib.parse.quote(callsign), timeout=10,
                                     retries=1))["response"]["flightroute"]
            o, d = fr.get("origin") or {}, fr.get("destination") or {}
            out["airline"] = (fr.get("airline") or {}).get("name")
            out["origin"] = {"iata": o.get("iata_code"), "name": o.get("name"), "city": o.get("municipality"), "country": o.get("country_name")}
            out["destination"] = {"iata": d.get("iata_code"), "name": d.get("name"), "city": d.get("municipality"), "country": d.get("country_name")}
        except Exception:  # noqa: BLE001
            out["route_note"] = "Ruta no publicada para este indicativo."
    if hexa:
        try:
            ac = json.loads(http_get("https://api.adsbdb.com/v0/aircraft/" + urllib.parse.quote(hexa), timeout=10,
                                     retries=1))["response"]["aircraft"]
            out["aircraft"] = {"model": f"{ac.get('manufacturer') or ''} {ac.get('type') or ''}".strip(),
                               "registration": ac.get("registration"), "owner": ac.get("registered_owner")}
        except Exception:  # noqa: BLE001
            pass
    _DETAILS[key] = (time.time(), out)
    return out


_DETAILS: dict[str, tuple[float, dict]] = {}
WORKER = Worker("flights", "adsb_lol", interval=15, fetch=fetch, idle_after=300)

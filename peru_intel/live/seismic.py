"""SeismicProvider — IGP/CENSIS (primaria Perú) + USGS (secundaria global).

IGP: https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/<año> (lista anual de sismos reportados).
USGS: feed GeoJSON del último mes, filtrado al Perú. Un evento USGS que coincide con uno IGP (±3 min y
<80 km) se descarta para no duplicar; los demás se muestran marcados como fuente secundaria.
"""
from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone

from ..sources.harvester import http_get
from .worker import Worker

BBOX = (-20.5, -84.0, 2.0, -66.5)
WINDOW_DAYS = 30


def _km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def _igp(year: int) -> list[dict]:
    rows = json.loads(http_get(f"https://ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/{year}", timeout=25, retries=2))
    out = []
    for r in rows:
        try:
            date = r["fecha_utc"][:10]
            hour = r["hora_utc"][11:19]
            t = datetime.fromisoformat(f"{date}T{hour}+00:00").timestamp()
            out.append({"id": f"igp-{r['codigo']}", "time": t, "lat": float(r["latitud"]), "lon": float(r["longitud"]),
                        "mag": float(r["magnitud"]), "depth_km": float(r["profundidad"]), "place": r.get("referencia"),
                        "intensity": r.get("intensidad"), "report": r.get("reporte_acelerometrico_pdf"), "source": "IGP"})
        except (KeyError, ValueError, TypeError):
            continue
    return out


def _usgs() -> list[dict]:
    d = json.loads(http_get("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson", timeout=30, retries=2))
    s, w, n, e = BBOX
    out = []
    for f in d.get("features", []):
        lon, lat, depth = f["geometry"]["coordinates"][:3]
        if not (s <= lat <= n and w <= lon <= e):
            continue
        p = f["properties"]
        out.append({"id": f"usgs-{f['id']}", "time": p["time"] / 1000, "lat": lat, "lon": lon, "mag": p.get("mag"),
                    "depth_km": depth, "place": p.get("place"), "url": p.get("url"), "source": "USGS"})
    return out


def fetch() -> dict:
    now = time.time()
    year = datetime.now(timezone.utc).year
    errors = []
    igp: list[dict] = []
    try:
        igp = _igp(year)
        if datetime.now(timezone.utc).timetuple().tm_yday <= WINDOW_DAYS:
            igp += _igp(year - 1)
    except Exception as e:  # noqa: BLE001
        errors.append(f"IGP: {e}")
    usgs: list[dict] = []
    try:
        usgs = _usgs()
    except Exception as e:  # noqa: BLE001
        errors.append(f"USGS: {e}")
    if not igp and not usgs:
        raise ConnectionError("; ".join(errors) or "sin datos")
    cutoff = now - WINDOW_DAYS * 86400
    igp = [q for q in igp if q["time"] >= cutoff]
    extra = [u for u in usgs if u["time"] >= cutoff and not any(
        abs(u["time"] - q["time"]) < 180 and _km((u["lat"], u["lon"]), (q["lat"], q["lon"])) < 80 for q in igp)]
    items = sorted(igp + extra, key=lambda q: -q["time"])
    return {"items": items, "window_days": WINDOW_DAYS, "errors": errors,
            "attribution": "IGP · CENSIS (primaria) · USGS (secundaria)"}


WORKER = Worker("seismic", "igp_sismos", interval=300, fetch=fetch, idle_after=1800)

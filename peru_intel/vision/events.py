"""Ingesta de eventos del nodo edge (contrato plugins/vision-edge/event.schema.json).

Al sistema solo llegan conteos y clases agregables por territorio. Nunca embeddings ni rostros.
Las placas se descartan salvo que `vision_allow_plates=true` (exige base legal, Ley N.° 29733).
"""
from __future__ import annotations

import time

from .. import config
from ..storage import sqlite_store

CLASSES = ("person", "vehicle", "plate", "count")


def _ensure() -> None:
    with sqlite_store.tx() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS vision_events(
            event_id TEXT PRIMARY KEY, camera_id TEXT, ts TEXT, received REAL, class TEXT, count INTEGER,
            confidence REAL, lat REAL, lon REAL, ubigeo TEXT, node TEXT, model TEXT, plate TEXT)""")


def validate(e: dict) -> dict:
    req = ("event_id", "camera_id", "ts", "class", "location", "source")
    missing = [k for k in req if k not in e]
    if missing:
        raise ValueError(f"faltan campos: {', '.join(missing)}")
    if e["class"] not in CLASSES:
        raise ValueError("class inválida")
    loc, src = e["location"], e["source"]
    if not isinstance(loc, dict) or not isinstance(src, dict):
        raise ValueError("location y source deben ser objetos")
    lat, lon = float(loc["lat"]), float(loc["lon"])
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("coordenadas fuera de rango")
    count = int(e.get("count", 1))
    conf = e.get("confidence")
    if conf is not None and not 0 <= float(conf) <= 1:
        raise ValueError("confidence fuera de 0–1")
    plate = e.get("plate") if config.setting("vision_allow_plates", "false").lower() == "true" else None
    return {"event_id": str(e["event_id"])[:64], "camera_id": str(e["camera_id"])[:64], "ts": str(e["ts"])[:40],
            "class": e["class"], "count": max(0, count), "confidence": float(conf) if conf is not None else None,
            "lat": lat, "lon": lon, "ubigeo": str(loc.get("ubigeo") or "")[:6] or None,
            "node": str(src.get("node"))[:64], "model": str(src.get("model"))[:64], "plate": str(plate)[:16] if plate else None}


def ingest(body: dict) -> dict:
    token = config.setting("vision_token")
    if token and body.get("token") != token:
        raise PermissionError("token del nodo edge inválido")
    items = body.get("events") if isinstance(body.get("events"), list) else [body]
    _ensure()
    ok, errors = 0, []
    rows = []
    for i, e in enumerate(items[:500]):
        try:
            v = validate(e)
            rows.append((v["event_id"], v["camera_id"], v["ts"], time.time(), v["class"], v["count"], v["confidence"],
                         v["lat"], v["lon"], v["ubigeo"], v["node"], v["model"], v["plate"]))
            ok += 1
        except (ValueError, KeyError, TypeError) as ex:
            errors.append({"index": i, "error": str(ex)})
    if rows:
        with sqlite_store.tx() as con:
            con.executemany("INSERT OR IGNORE INTO vision_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return {"accepted": ok, "rejected": len(errors), "errors": errors[:20]}


def summary(minutes: int = 60) -> dict:
    _ensure()
    since = time.time() - minutes * 60
    rows = sqlite_store.connect().execute(
        "SELECT camera_id, class, sum(count) n, avg(lat) lat, avg(lon) lon, max(ubigeo) ubigeo FROM vision_events "
        "WHERE received >= ? GROUP BY 1, 2 ORDER BY 3 DESC", (since,)).fetchall()
    return {"minutes": minutes, "items": [dict(r) for r in rows], "kind": "vivo_tercero",
            "note": "Conteos agregados del nodo edge propio. Sin identificación de personas."}

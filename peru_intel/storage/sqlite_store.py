"""SQLite (WAL) para lo operativo: registro de fuentes, descargas, auditoría, alertas y eventos pequeños.

Las series masivas (criminalidad, clima, tráfico histórico) van a Parquet/DuckDB, no aquí.
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from .. import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS source_registry (
    source_id        TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    institution      TEXT NOT NULL,
    url              TEXT,
    adapter          TEXT,
    official         INTEGER NOT NULL DEFAULT 0,
    kind             TEXT NOT NULL,          -- oficial | vivo_tercero | calculado | estimacion | proyeccion | ia
    type             TEXT,                   -- csv | xlsx | api | websocket | tiles | json
    license          TEXT,
    update_frequency TEXT,
    geographic_level TEXT,
    coverage_start   TEXT,
    coverage_end     TEXT,
    last_checked     TEXT,
    last_downloaded  TEXT,
    checksum         TEXT,
    status           TEXT NOT NULL DEFAULT 'sin_descargar',
    raw_path         TEXT,
    normalized_path  TEXT,
    notes            TEXT,
    requires_key     TEXT
);
CREATE TABLE IF NOT EXISTS download_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id   TEXT NOT NULL,
    url         TEXT,
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    http_status INTEGER,
    bytes       INTEGER,
    sha256      TEXT,
    raw_path    TEXT,
    schema_hash TEXT,
    schema_changed INTEGER DEFAULT 0,
    error       TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    at      TEXT NOT NULL,
    actor   TEXT NOT NULL,
    action  TEXT NOT NULL,
    detail  TEXT
);
CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    at         TEXT NOT NULL,
    layer      TEXT NOT NULL,
    severity   TEXT NOT NULL,
    title      TEXT NOT NULL,
    payload    TEXT
);
CREATE TABLE IF NOT EXISTS aircraft_tracks (
    hex   TEXT NOT NULL,
    t     INTEGER NOT NULL,
    lat   REAL NOT NULL,
    lon   REAL NOT NULL,
    alt   REAL,
    PRIMARY KEY (hex, t)
);
CREATE INDEX IF NOT EXISTS ix_tracks_t ON aircraft_tracks(t);
"""

_LOCK = threading.Lock()
_LOCAL = threading.local()


def db_path() -> Path:
    return config.CATALOG / "catalog.sqlite"


def connect() -> sqlite3.Connection:
    con = getattr(_LOCAL, "con", None)
    if con is None:
        config.CATALOG.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(db_path(), timeout=15, check_same_thread=False)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA synchronous=NORMAL")
        with _LOCK:
            con.executescript(SCHEMA)
        _LOCAL.con = con
    return con


@contextmanager
def tx():
    con = connect()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def audit(actor: str, action: str, detail: dict | str | None = None) -> None:
    with tx() as con:
        con.execute("INSERT INTO audit_log(at, actor, action, detail) VALUES (?,?,?,?)",
                    (now_iso(), actor, action, json.dumps(detail, ensure_ascii=False) if isinstance(detail, dict) else detail))

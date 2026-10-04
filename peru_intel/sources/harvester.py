"""SourceHarvester: obtención trazable de archivos de fuentes.

Orden de preferencia (se declara en cada adaptador, no se improvisa):
  1. API oficial  2. CSV/XLSX/JSON oficial  3. WFS/WMS/ArcGIS REST  4. HTML oficial  5. scraping

Garantías:
- rate limit por host y User-Agent identificable;
- reintentos con backoff exponencial;
- snapshot del original en data/raw/<fuente>/<AAAA-MM-DD>/ — nunca se sobrescribe;
- SHA-256 de cada archivo y registro en download_log;
- detección de cambio de esquema (cabecera CSV) respecto de la descarga anterior.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from .. import config
from ..storage import sqlite_store

_HOST_LOCK = threading.Lock()
_HOST_LAST: dict[str, float] = {}


@dataclass
class Snapshot:
    source_id: str
    path: Path
    sha256: str
    bytes: int
    url: str | None
    reused: bool
    schema_hash: str | None
    schema_changed: bool


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _throttle(host: str, min_interval: float) -> None:
    with _HOST_LOCK:
        wait = _HOST_LAST.get(host, 0) + min_interval - time.time()
        if wait > 0:
            time.sleep(wait)
        _HOST_LAST[host] = time.time()


def http_get(url: str, *, timeout: float = 60, headers: dict | None = None, retries: int = 3,
             min_interval: float = 1.0, backoff: float = 2.0) -> bytes:
    """GET con rate limit por host, reintentos y backoff. Lanza la última excepción si agota intentos."""
    host = urllib.parse.urlparse(url).netloc
    last: Exception | None = None
    for attempt in range(retries):
        _throttle(host, min_interval)
        req = urllib.request.Request(url, headers={"User-Agent": config.USER_AGENT, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (URLs del catálogo)
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (400, 401, 403, 404):  # no mejora reintentando
                raise
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last = e
        time.sleep(backoff ** attempt)
    assert last is not None
    raise last


def _schema_hash(path: Path) -> str | None:
    if path.suffix.lower() not in (".csv", ".txt"):
        return None
    with open(path, "rb") as f:
        header = f.readline().lstrip(b"\xef\xbb\xbf").strip().lower()
    return hashlib.sha256(header).hexdigest()[:16]


def _previous_schema(source_id: str, filename: str) -> str | None:
    con = sqlite_store.connect()
    row = con.execute("SELECT schema_hash FROM download_log WHERE source_id=? AND raw_path LIKE ? AND schema_hash IS NOT NULL "
                      "ORDER BY id DESC LIMIT 1", (source_id, f"%{filename}")).fetchone()
    return row[0] if row else None


def _target(source_id: str, filename: str) -> Path:
    day = time.strftime("%Y-%m-%d")
    folder = config.RAW / source_id / day
    folder.mkdir(parents=True, exist_ok=True)
    return folder / filename


def _store(source_id: str, tmp: Path, filename: str, url: str | None) -> Snapshot:
    digest = sha256_file(tmp)
    # ¿ya existe un snapshot idéntico (cualquier fecha)? se reutiliza en lugar de duplicar
    for existing in sorted((config.RAW / source_id).glob(f"*/{filename}"), reverse=True):
        if existing.stat().st_size == tmp.stat().st_size and sha256_file(existing) == digest:
            tmp.unlink(missing_ok=True)
            return Snapshot(source_id, existing, digest, existing.stat().st_size, url, True, _schema_hash(existing), False)
    dest = _target(source_id, filename)
    if dest.exists():  # mismo día, contenido distinto: nunca sobrescribir
        dest = dest.with_name(f"{dest.stem}-{time.strftime('%H%M%S')}{dest.suffix}")
    os.replace(tmp, dest)
    schema = _schema_hash(dest)
    prev = _previous_schema(source_id, filename)
    changed = bool(prev and schema and prev != schema)
    with sqlite_store.tx() as con:
        con.execute("INSERT INTO download_log(source_id, url, started_at, finished_at, http_status, bytes, sha256, raw_path, "
                    "schema_hash, schema_changed) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (source_id, url, sqlite_store.now_iso(), sqlite_store.now_iso(), 200 if url else None,
                     dest.stat().st_size, digest, str(dest.relative_to(config.DATA)), schema, int(changed)))
    meta = dest.with_suffix(dest.suffix + ".meta.json")
    meta.write_text(json.dumps({"source_id": source_id, "url": url, "sha256": digest, "bytes": dest.stat().st_size,
                                "retrieved_at": sqlite_store.now_iso(), "schema_hash": schema,
                                "schema_changed": changed}, ensure_ascii=False, indent=2), encoding="utf-8")
    return Snapshot(source_id, dest, digest, dest.stat().st_size, url, False, schema, changed)


def fetch(source_id: str, url: str, filename: str, **kw) -> Snapshot:
    """Descarga `url` como snapshot inmutable de `source_id`."""
    data = http_get(url, **kw)
    if not data:
        raise ValueError(f"{source_id}: respuesta vacía de {url}")
    config.RAW.mkdir(parents=True, exist_ok=True)
    tmp = config.RAW / f".{source_id}.{os.getpid()}.part"
    tmp.write_bytes(data)
    return _store(source_id, tmp, filename, url)


def import_local(source_id: str, path: Path, filename: str | None = None) -> Snapshot:
    """Copia un archivo ya descargado (p. ej. de OCE/FEDTID) al almacén raw con su checksum."""
    config.RAW.mkdir(parents=True, exist_ok=True)
    tmp = config.RAW / f".{source_id}.{os.getpid()}.part"
    shutil.copyfile(path, tmp)
    return _store(source_id, tmp, filename or path.name, None)


def latest(source_id: str, filename: str) -> Path | None:
    """Snapshot más reciente de un archivo (o None)."""
    found = sorted((config.RAW / source_id).glob(f"*/{Path(filename).stem}*{Path(filename).suffix}"))
    found = [p for p in found if not p.name.endswith(".meta.json")]
    return found[-1] if found else None

"""Registro maestro de fuentes.

Dos capas:
- `data/catalog/manifest.json` (versionado en git): procedencia durable de cada dato
  normalizado — cuándo se descargó, checksum del original, período cubierto, ruta normalizada.
- `source_registry` en SQLite: vista operativa (estado de proveedores en vivo, últimas
  comprobaciones). Se reconstruye desde el catálogo + manifiesto al arrancar.

Con esto la interfaz responde «¿de dónde salió este dato?» sin documentación externa.
"""
from __future__ import annotations

import json
import os
import threading

from .. import config
from ..storage import sqlite_store
from .catalog import BY_ID, SOURCES

_LOCK = threading.Lock()
FIELDS = ("source_id", "name", "institution", "url", "adapter", "official", "kind", "type", "license",
          "update_frequency", "geographic_level", "coverage_start", "coverage_end", "last_checked",
          "last_downloaded", "checksum", "status", "raw_path", "normalized_path", "notes", "requires_key")


def manifest_path():
    return config.CATALOG / "manifest.json"


def read_manifest() -> dict:
    try:
        return json.loads(manifest_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def record(source_id: str, **values) -> dict:
    """Actualiza la procedencia durable de una fuente (escritura atómica)."""
    with _LOCK:
        m = read_manifest()
        entry = m.get(source_id, {})
        entry.update({k: v for k, v in values.items() if v is not None})
        m[source_id] = entry
        p = manifest_path()
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(json.dumps(m, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(tmp, p)
    sync()
    return entry


def sync() -> None:
    """Vuelca catálogo + manifiesto al source_registry de SQLite."""
    manifest = read_manifest()
    with sqlite_store.tx() as con:
        for s in SOURCES:
            row = {k: s.get(k) for k in FIELDS}
            row.update({k: v for k, v in manifest.get(s["source_id"], {}).items() if k in FIELDS})
            if row.get("status") is None:
                row["status"] = "sin_descargar" if s["kind"] in ("oficial", "estimacion") else "bajo_demanda"
            cols = ",".join(FIELDS)
            marks = ",".join("?" for _ in FIELDS)
            con.execute(f"INSERT OR REPLACE INTO source_registry({cols}) VALUES ({marks})", [row.get(k) for k in FIELDS])


def set_live_status(source_id: str, status: str, last_checked: str | None = None, notes: str | None = None) -> None:
    """Estado de proveedores en vivo: solo en SQLite (no ensucia el manifiesto versionado)."""
    with sqlite_store.tx() as con:
        con.execute("UPDATE source_registry SET status=?, last_checked=COALESCE(?, last_checked), "
                    "notes=COALESCE(?, notes) WHERE source_id=?",
                    (status, last_checked or sqlite_store.now_iso(), notes, source_id))


def all_sources() -> list[dict]:
    con = sqlite_store.connect()
    rows = [dict(r) for r in con.execute("SELECT * FROM source_registry ORDER BY kind, institution, name")]
    if not rows:
        sync()
        rows = [dict(r) for r in con.execute("SELECT * FROM source_registry ORDER BY kind, institution, name")]
    for r in rows:
        meta = BY_ID.get(r["source_id"], {})
        if meta.get("requires_key"):
            r["configured"] = bool(config.setting(meta["requires_key"]))
    return rows


def get(source_id: str) -> dict | None:
    return next((s for s in all_sources() if s["source_id"] == source_id), None)


def provenance(*source_ids: str) -> list[dict]:
    """Bloque compacto de procedencia que acompaña a cada respuesta de la API."""
    out = []
    manifest = read_manifest()
    for sid in source_ids:
        meta = BY_ID.get(sid)
        if not meta:
            continue
        m = manifest.get(sid, {})
        out.append({
            "source_id": sid, "name": meta["name"], "institution": meta["institution"], "url": meta["url"],
            "kind": meta["kind"], "official": bool(meta["official"]), "geographic_level": meta.get("geographic_level"),
            "coverage_start": m.get("coverage_start") or meta.get("coverage_start"),
            "coverage_end": m.get("coverage_end") or meta.get("coverage_end"),
            "downloaded": m.get("last_downloaded"), "checksum": m.get("checksum"),
            "transform": m.get("transform"), "notes": meta.get("notes"),
        })
    return out


def record_snapshot(source_id: str, snap, **values) -> dict:
    """Procedencia estándar de un snapshot raw + su salida normalizada."""
    origin = snap.url or "copia local (archivo ya descargado del portal oficial por OCE/FEDTID u otro proyecto propio)"
    return record(source_id, status="ok", last_downloaded=sqlite_store.now_iso(), checksum=snap.sha256,
                  raw_path=str(snap.path.relative_to(config.DATA)).replace("\\", "/"), origin=origin,
                  schema_changed=bool(snap.schema_changed), **values)

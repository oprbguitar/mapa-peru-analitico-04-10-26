"""Rutas y ajustes. Todo se puede cambiar por variable de entorno o en data/config.local.json."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("PI_DATA_DIR", ROOT / "data"))
RAW = DATA / "raw"                 # nunca se modifica: snapshots fechados de cada fuente
NORMALIZED = DATA / "normalized"   # tablas intermedias legibles (CSV/JSON)
PARQUET = DATA / "parquet"         # tablas analíticas (DuckDB lee directamente)
PERU = DATA / "peru"               # paquete territorial (límites, UBIGEO, metadata)
LIVE = DATA / "live"               # cachés de proveedores en vivo
CATALOG = DATA / "catalog"         # SQLite: registro de fuentes, auditoría, configuración
OFM_CACHE = DATA / "ofm"           # teselas OpenFreeMap vistas (funcionan sin internet)
WEB = ROOT / "apps" / "web"
CONFIG_DIR = ROOT / "config"

USER_AGENT = "MapaPeruAnalitico/0.1 (+https://github.com/oprbguitar/mapa-peru-analitico-04-10-26; uso local)"

# Peru: s, w, n, e
PERU_BBOX = (-18.6, -81.6, 0.2, -68.4)

_LOCAL = DATA / "config.local.json"


def local_settings() -> dict:
    """Ajustes locales (claves BYOK, rutas de RUC360/OCE). Archivo ignorado por git."""
    try:
        return json.loads(_LOCAL.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_local_settings(values: dict) -> None:
    current = local_settings()
    current.update({k: v for k, v in values.items() if v is not None})
    _LOCAL.parent.mkdir(parents=True, exist_ok=True)
    tmp = _LOCAL.with_suffix(".tmp")
    tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _LOCAL)


def setting(name: str, default: str = "") -> str:
    """Primero la variable de entorno (PI_<NAME>), luego config.local.json."""
    env = os.environ.get("PI_" + name.upper())
    if env:
        return env
    return str(local_settings().get(name.lower(), default) or default)


def ruc360_dir() -> Path | None:
    """Carpeta local de RUC360 (Analisis de empresas). Solo se lee; nunca se escribe."""
    for cand in (setting("ruc360_dir"), str(ROOT.parent / "Analisis de empresas")):
        if cand and Path(cand, "portal").is_dir():
            return Path(cand)
    return None


def oce_dir() -> Path | None:
    """Carpeta local de OCE/FEDTID (ocefedtid). Solo se lee."""
    for cand in (setting("oce_dir"), str(ROOT.parent / "ocefedtid")):
        if cand and Path(cand, "data", "fuentes").is_dir():
            return Path(cand)
    return None


def ensure_dirs() -> None:
    for d in (RAW, NORMALIZED, PARQUET, PERU, LIVE, CATALOG, OFM_CACHE):
        d.mkdir(parents=True, exist_ok=True)

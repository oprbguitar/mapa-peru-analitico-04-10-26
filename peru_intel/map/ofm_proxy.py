"""Mapa base OpenFreeMap con caché en disco — portado de RUC360 portal/mapa_zona.py.

Todo recurso del mapa base (estilo, TileJSON, teselas vectoriales, fuentes, sprites, relieve Natural Earth)
pasa por /ofm/<ruta>: queda guardado en data/ofm y la zona ya vista funciona sin internet.

Orden de búsqueda: data/ofm (propio) → caché de RUC360 (solo lectura, si existe la carpeta) → red.
`python -m peru_intel export-ofm` copia la caché de RUC360 a data/ofm para no depender de esa carpeta.

No se descargan zonas enteras por adelantado (política de uso de OpenFreeMap/OSM): se guarda lo que se mira.
"""
from __future__ import annotations

import gzip
import http.client
import os
import re
import shutil
import threading
import time
from pathlib import Path

from .. import config

HOST = "tiles.openfreemap.org"
_RX = re.compile(r"(styles/[a-z0-9_-]+|planet|planet/[0-9_a-z]+/\d{1,2}/\d{1,7}/\d{1,7}\.pbf|"
                 r"fonts/[A-Za-z0-9 ,_-]+/\d{1,5}-\d{1,5}\.pbf|sprites/[a-z0-9_/]+(?:@2x)?\.(?:json|png)|"
                 r"natural_earth/ne2sr/\d{1,2}/\d{1,4}/\d{1,4}\.png)")
_TLS = threading.local()


def _ruc360_cache() -> Path | None:
    d = config.ruc360_dir()
    return d / "data" / "ofm" if d and (d / "data" / "ofm").is_dir() else None


def _local(base: Path, ruta: str) -> Path:
    p = base.joinpath(*ruta.split("/"))
    return p if "." in ruta.rsplit("/", 1)[-1] else p.with_name(p.name + ".json")


def _fetch(ruta: str) -> bytes:
    for attempt in (0, 1):
        c = getattr(_TLS, "c", None)
        if c is None or attempt:
            c = _TLS.c = http.client.HTTPSConnection(HOST, timeout=12)
        try:
            c.request("GET", "/" + ruta.replace(" ", "%20"), headers={"User-Agent": config.USER_AGENT, "Accept-Encoding": "gzip"})
            r = c.getresponse()
            data = r.read()
            if r.status != 200:
                raise OSError(f"OpenFreeMap {r.status}")
            return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data
        except (OSError, http.client.HTTPException):
            _TLS.c = None
            if attempt:
                raise
    return b""


def _rewrite(data: bytes, ruta: str, origin: str = "") -> bytes:
    """Estilos y TileJSON apuntan a <origen>/ofm/ (mismo origen, CSP 'self', caché local).
    MapLibre exige URLs absolutas para sprites y glifos, por eso se usa el origen de la petición."""
    if ruta.endswith((".pbf", ".png")):
        return data
    return data.replace(f"https://{HOST}/".encode(), f"{origin}/ofm/".encode())


def get(ruta: str, origin: str = "") -> tuple[bytes, str] | None:
    if not _RX.fullmatch(ruta) or ".." in ruta:
        return None
    ctype = ("application/x-protobuf" if ruta.endswith(".pbf") else "image/png" if ruta.endswith(".png")
             else "application/json; charset=utf-8")
    immutable = ruta.endswith((".pbf", ".png"))  # teselas versionadas en la URL
    own = _local(config.OFM_CACHE, ruta)
    try:
        if own.stat().st_size > 0 and (immutable or own.stat().st_mtime > time.time() - 86400):
            return _rewrite(own.read_bytes(), ruta, origin), ctype
    except OSError:
        pass
    ruc = _ruc360_cache()
    if ruc and immutable:
        p = _local(ruc, ruta)
        if p.exists() and p.stat().st_size > 0:
            return p.read_bytes(), ctype
    try:
        data = _fetch(ruta)
    except Exception:  # noqa: BLE001 — sin red: lo guardado, aunque sea viejo
        for base in (config.OFM_CACHE, ruc):
            if base:
                p = _local(base, ruta)
                if p.exists():
                    return _rewrite(p.read_bytes(), ruta, origin), ctype
        return None
    if data:
        try:
            own.parent.mkdir(parents=True, exist_ok=True)
            tmp = own.with_name(own.name + ".tmp")
            tmp.write_bytes(data)
            os.replace(tmp, own)
        except OSError:
            pass
    return _rewrite(data, ruta, origin), ctype


def export_from_ruc360() -> str:
    """Copia (sin sobrescribir) la caché OpenFreeMap de RUC360 a data/ofm."""
    src = _ruc360_cache()
    if not src:
        return "No encontré la caché de RUC360 (data/ofm). Configura ruc360_dir."
    n = 0
    for p in src.rglob("*"):
        if p.is_file():
            dest = config.OFM_CACHE / p.relative_to(src)
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, dest)
                n += 1
    return f"{n} archivos copiados de {src} a {config.OFM_CACHE}"

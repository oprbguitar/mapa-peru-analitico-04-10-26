"""Adaptadores de fuentes oficiales: obtienen el original (snapshot inmutable), lo normalizan a Parquet
y registran la procedencia en data/catalog/manifest.json."""
from __future__ import annotations

from pathlib import Path
from typing import Iterator


def run_ingest(source: str, download: bool = False, folder: Path | None = None) -> Iterator[str]:
    from ..climate import enso
    from . import devida, institutions, mininter_indicators, mininter_sidpol, mpfn, ports

    steps = {
        "sidpol": mininter_sidpol.ingest,
        "indicadores": mininter_indicators.ingest,
        "mpfn": mpfn.ingest,
        "devida": devida.ingest,
        "ports": ports.ingest,
        "instituciones": institutions.ingest,
        "enso": enso.ingest,
    }
    names = list(steps) if source == "all" else [source]
    for name in names:
        try:
            yield f"[{name}] " + steps[name](download=download, folder=folder)
        except Exception as e:  # noqa: BLE001 — una fuente caída no detiene a las demás
            yield f"[{name}] ERROR: {e}"


def sql_path(p: Path) -> str:
    return str(p).replace("\\", "/").replace("'", "''")

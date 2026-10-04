"""Puertos (APN + NGA World Port Index) y centros de datos (OSM).

Puertos: salida ya normalizada por OCE/FEDTID scripts/build-international-data.mjs (international.json →
apn.ports): une la carga APN (t y TEU por año) con la posición y el UN/LOCODE del World Port Index.
Centros de datos: archivo OSM (telecom=data_center) que mantiene RUC360.

Salidas: data/normalized/puertos.json · data/normalized/datacenters.json
"""
from __future__ import annotations

import json
from pathlib import Path

from .. import config
from ..sources import harvester, registry


def _find(folder: Path | None, rel_oce: str, rel_ruc: str | None = None) -> Path | None:
    cands = []
    if folder:
        cands.append(folder / Path(rel_oce).name)
    if config.oce_dir():
        cands.append(config.oce_dir() / rel_oce)
    if rel_ruc and config.ruc360_dir():
        cands.append(config.ruc360_dir() / rel_ruc)
    return next((c for c in cands if c.exists()), None)


def ingest(download: bool = False, folder: Path | None = None) -> str:
    msgs = []
    intl = _find(folder, "src/features/territory-lab/data/international.json")
    if intl:
        snap = harvester.import_local("apn_wpi_puertos", intl, "international.json")
        data = json.loads(snap.path.read_text(encoding="utf-8"))
        ports = []
        for p in data.get("apn", {}).get("ports", []):
            if p.get("lat") is None:
                continue
            ports.append({k: p.get(k) for k in ("name", "scope", "locode", "wpiName", "lat", "lon", "harborSize", "department",
                                                "teuAnnual", "tmAnnual", "terminals")})
        out = config.NORMALIZED / "puertos.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"lastMonth": data["apn"].get("lastMonth"), "sources": {k: v for k, v in data.get("sources", {}).items()
                                                                                         if k in ("apnTeu", "apnTm", "wpi")},
                                   "ports": ports}, ensure_ascii=False), encoding="utf-8")
        registry.record_snapshot("apn_wpi_puertos", snap, normalized_path="data/normalized/puertos.json",
                                 coverage_end=data["apn"].get("lastMonth"),
                                 transform="Subconjunto apn.ports de OCE/FEDTID (APN carga/TEU + WPI posición y UN/LOCODE).")
        msgs.append(f"{len(ports)} puertos")
    else:
        msgs.append("puertos: no encontré international.json de OCE/FEDTID (se conserva la versión anterior)")
    dc = _find(folder, "datacenters-pe.json", "portal/static/datos/datacenters-pe.json")
    if dc:
        snap = harvester.import_local("osm_datacenters", dc, "datacenters-pe.json")
        (config.NORMALIZED / "datacenters.json").write_bytes(snap.path.read_bytes())
        dcs = json.loads(snap.path.read_text(encoding="utf-8"))
        n = len(dcs if isinstance(dcs, list) else dcs.get("features", []))
        registry.record_snapshot("osm_datacenters", snap, normalized_path="data/normalized/datacenters.json")
        msgs.append(f"{n} centros de datos")
    return " · ".join(msgs)

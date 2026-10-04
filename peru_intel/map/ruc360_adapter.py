"""Ruc360MapAdapter — el mapa territorial de RUC360 como fuente de desarrollo, NO como dependencia.

RUC360 (Analisis de empresas / repo datos01082026) aporta: MapLibre + OpenFreeMap con caché en disco,
límites y UBIGEO, y un motor territorial (territorio.db: vías, urbanizaciones, manzanas, lotes, catastro).
Este adaptador expone esas capacidades con una interfaz estable. Todo lo indispensable ya está exportado
en data/peru y data/ofm, así que el sistema arranca con RUC360 apagado o ausente.

Interfaz:
    load_base_map()        estilo MapLibre (OpenFreeMap vía /ofm/, caché local)
    load_departments()     GeoJSON departamental
    load_provinces()       GeoJSON provincial
    load_districts()       GeoJSON distrital
    load_roads()           capas viales disponibles en el estilo vectorial
    load_territory(...)    motor territorial de RUC360 (solo si existe territorio.db y se configuró)
    load_cadastre(...)     catastro de RUC360 (ídem)
    resolve_ubigeo(texto)  UBIGEO a partir de un nombre
    resolve_coordinates(lat, lon)  distrito/provincia/departamento de un punto
    get_available_layers() inventario con disponibilidad real
"""
from __future__ import annotations

import json
import sqlite3

from .. import config
from . import territory
from .names import norm

BASE_STYLE = "/ofm/styles/liberty"
ROAD_LAYERS = ["highway_motorway", "highway_trunk", "highway_primary", "highway_secondary", "highway_minor", "road_label"]


class Ruc360MapAdapter:
    def __init__(self):
        self.ruc_dir = config.ruc360_dir()

    # ── mapa base ──────────────────────────────────────────────────────────
    def load_base_map(self) -> dict:
        return {"style": BASE_STYLE, "provider": "OpenFreeMap (OSM)", "cache": str(config.OFM_CACHE),
                "ruc360_cache_readonly": bool(self.ruc_dir and (self.ruc_dir / "data" / "ofm").is_dir())}

    def _boundary(self, level: str) -> dict:
        return json.loads((territory.BOUNDARIES / f"{level}.geojson").read_text(encoding="utf-8"))

    def load_departments(self) -> dict:
        return self._boundary("departamentos")

    def load_provinces(self) -> dict:
        return self._boundary("provincias")

    def load_districts(self) -> dict:
        return self._boundary("distritos")

    def load_roads(self) -> dict:
        return {"in_style": ROAD_LAYERS, "source": "OpenFreeMap openmaptiles (transportation)",
                "routing": "OSRM (pendiente de fase de rutas)"}

    # ── motor territorial RUC360 (opcional) ────────────────────────────────
    def _territorio_db(self):
        if not self.ruc_dir:
            return None
        p = self.ruc_dir / "data" / "territorio.db"
        return p if p.exists() else None

    def load_territory(self, ubigeo: str) -> dict:
        db = self._territorio_db()
        if not db:
            return {"available": False, "reason": "territorio.db de RUC360 no está disponible en esta PC."}
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        return {"available": True, "ubigeo": ubigeo, "tables": tables, "note": "Lectura en solo-lectura; no se copia a este repo."}

    def load_cadastre(self, ubigeo: str) -> dict:
        t = self.load_territory(ubigeo)
        return t if not t.get("available") else t | {"layer": "catastro (ver portal/territorio.py de RUC360)"}

    # ── resolución ─────────────────────────────────────────────────────────
    def resolve_ubigeo(self, text: str, level: str | None = None) -> list[dict]:
        key = norm(text)
        hits = [r for r in territory.index() if norm(r["nombre"]) == key and (not level or r["nivel"] == level)]
        if not hits:
            hits = [r for r in territory.index() if key and key in norm(r["nombre"]) and (not level or r["nivel"] == level)]
        return hits[:20]

    def resolve_coordinates(self, lat: float, lon: float) -> dict | None:
        d = territory.district_at(lat, lon)
        if not d:
            return None
        return {"distrito": {"ubigeo": d["u"], "nombre": d["n"]}, "provincia": {"ubigeo": d["u"][:4], "nombre": d.get("p")},
                "departamento": {"ubigeo": d["u"][:2], "nombre": d["d"]}}

    def get_available_layers(self) -> list[dict]:
        meta = {}
        try:
            meta = json.loads((config.PERU / "metadata.json").read_text(encoding="utf-8"))
        except OSError:
            pass
        counts = meta.get("counts", {})
        return [
            {"id": "base", "label": "Mapa base vectorial", "available": True},
            {"id": "departamentos", "label": "Departamentos", "available": bool(counts.get("departamentos")), "count": counts.get("departamentos")},
            {"id": "provincias", "label": "Provincias", "available": bool(counts.get("provincias")), "count": counts.get("provincias")},
            {"id": "distritos", "label": "Distritos", "available": bool(counts.get("distritos")), "count": counts.get("distritos")},
            {"id": "vias", "label": "Vías (OSM)", "available": True},
            {"id": "territorio", "label": "Motor territorial RUC360", "available": bool(self._territorio_db())},
        ]


ADAPTER = Ruc360MapAdapter()

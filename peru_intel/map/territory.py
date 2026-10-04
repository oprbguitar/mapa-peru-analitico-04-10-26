"""Paquete territorial del Perú (data/peru/).

Se genera UNA vez desde la cartografía que ya usan OCE/FEDTID y RUC360 y después el sistema
funciona con RUC360 apagado:

    data/peru/
    ├── boundaries/departamentos.geojson
    ├── boundaries/provincias.geojson      (disueltas aquí desde los distritos)
    ├── boundaries/distritos.geojson
    ├── ubigeo.json                        (nivel, código, nombre, padres, punto de etiqueta)
    └── metadata.json                      (origen, checksums, fecha, cobertura)

Uso: python -m peru_intel build-territory [--from <ruta a carpeta con peru_*_simple.geojson>]
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from .. import config
from ..sources import harvester, registry
from .names import DEPARTMENTS, title

BOUNDARIES = config.PERU / "boundaries"
LEVELS = ("departamentos", "provincias", "distritos")
LEVEL_NAME = {"departamentos": "departamento", "provincias": "provincia", "distritos": "distrito"}


def _round(obj, nd=4):
    if isinstance(obj, list):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [_round(x, nd) for x in obj]
    return obj


def _find_inputs(src: Path | None) -> tuple[Path, Path]:
    candidates = []
    if src:
        candidates.append(src)
    oce = config.oce_dir()
    if oce:
        candidates.append(oce / "data" / "fuentes")
    for c in candidates:
        d, p = c / "peru_departamental_simple.geojson", c / "peru_distrital_simple.geojson"
        if d.exists() and p.exists():
            return d, p
    raise FileNotFoundError("No encontré peru_departamental_simple.geojson y peru_distrital_simple.geojson. "
                            "Indica la carpeta con --from (OCE/FEDTID: data/fuentes).")


def build(src: Path | None = None) -> dict:
    import duckdb

    dep_src, dist_src = _find_inputs(src)
    snaps = [harvester.import_local("limites_inei", dep_src), harvester.import_local("limites_inei", dist_src)]
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    q = lambda p: str(p).replace("\\", "/").replace("'", "''")  # noqa: E731
    con.execute(f"CREATE TABLE dist AS SELECT IDDIST AS u, IDPROV AS p, NOMBDIST AS n, NOMBPROV AS np, NOMBDEP AS nd, "
                f"ST_MakeValid(geom) AS g FROM st_read('{q(snaps[1].path)}')")
    con.execute(f"CREATE TABLE dep AS SELECT lpad(CAST(FIRST_IDDP AS VARCHAR), 2, '0') AS u, NOMBDEP AS n, "
                f"ST_MakeValid(geom) AS g FROM st_read('{q(snaps[0].path)}')")
    con.execute("CREATE TABLE prov AS SELECT p AS u, any_value(np) AS n, any_value(nd) AS nd, "
                "ST_SimplifyPreserveTopology(ST_Union_Agg(g), 0.002) AS g FROM dist GROUP BY p")
    BOUNDARIES.mkdir(parents=True, exist_ok=True)
    out_index = []
    counts = {}
    specs = {
        "departamentos": ("SELECT u, n, NULL AS np, n AS nd, g FROM dep", 2),
        "provincias": ("SELECT u, n, n AS np, nd, g FROM prov", 4),
        "distritos": ("SELECT u, n, np, nd, g FROM dist", 6),
    }
    for level, (sql, _digits) in specs.items():
        rows = con.execute(f"SELECT u, n, np, nd, ST_AsGeoJSON(g), ST_Y(ST_PointOnSurface(g)), ST_X(ST_PointOnSurface(g)), "
                           f"ST_XMin(g), ST_YMin(g), ST_XMax(g), ST_YMax(g) FROM ({sql}) WHERE g IS NOT NULL AND NOT ST_IsEmpty(g) "
                           f"ORDER BY u").fetchall()
        skipped = con.execute(f"SELECT count(*) FROM ({sql}) WHERE g IS NULL OR ST_IsEmpty(g)").fetchone()[0]
        feats = []
        for u, n, np_, nd, gj, lat, lon, x0, y0, x1, y1 in rows:
            dep_code = u[:2]
            name = DEPARTMENTS.get(u, title(n)) if level == "departamentos" else title(n)
            props = {"u": u, "n": name, "d": DEPARTMENTS.get(dep_code, title(nd)), "c": [round(lat, 4), round(lon, 4)]}
            if level == "distritos":
                props["p"] = title(np_)
            geom = json.loads(gj)
            geom["coordinates"] = _round(geom["coordinates"])
            feats.append({"type": "Feature", "id": int(u), "properties": props, "geometry": geom})
            out_index.append({"nivel": LEVEL_NAME[level], "ubigeo": u, "nombre": name,
                              "departamento": props["d"], "provincia": props.get("p") if level == "distritos" else (name if level == "provincias" else None),
                              "lat": props["c"][0], "lon": props["c"][1],
                              "bbox": [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)]})
        fc = {"type": "FeatureCollection", "features": feats}
        (BOUNDARIES / f"{level}.geojson").write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        counts[level] = len(feats)
        if skipped:
            counts[level + "_sin_geometria"] = skipped
    (config.PERU / "ubigeo.json").write_text(json.dumps(out_index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    meta = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "builder": "peru_intel.map.territory",
        "inputs": [{"file": s.path.name, "sha256": s.sha256, "raw_path": str(s.path.relative_to(config.DATA)).replace("\\", "/")}
                   for s in snaps],
        "origin": "Cartografía simplificada INEI usada por OCE/FEDTID (data/fuentes) y RUC360 (data/geo).",
        "transform": "Coordenadas redondeadas a 4 decimales (~11 m). Provincias = unión de distritos por IDPROV, "
                     "simplificada (tolerancia 0.002°).",
        "counts": counts,
        "coverage_note": "La cartografía tiene 1 834 distritos; los creados después de esa versión no tienen polígono propio.",
    }
    (config.PERU / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    registry.record("limites_inei", status="ok", last_downloaded=meta["generated_at"], checksum=snaps[1].sha256,
                    raw_path=meta["inputs"][1]["raw_path"], normalized_path="data/peru/boundaries/",
                    transform=meta["transform"])
    return meta


_INDEX: list[dict] | None = None
_DIST_GEOMS: list[tuple[list, dict, list]] | None = None


def index() -> list[dict]:
    global _INDEX
    if _INDEX is None:
        try:
            _INDEX = json.loads((config.PERU / "ubigeo.json").read_text(encoding="utf-8"))
        except OSError:
            _INDEX = []
    return _INDEX


def lookup(ubigeo: str) -> dict | None:
    return next((r for r in index() if r["ubigeo"] == ubigeo), None)


def _point_in_ring(x, y, ring) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def district_at(lat: float, lon: float) -> dict | None:
    """UBIGEO distrital que contiene el punto (punto-en-polígono con prefiltro por bbox)."""
    global _DIST_GEOMS
    if _DIST_GEOMS is None:
        _DIST_GEOMS = []
        try:
            fc = json.loads((BOUNDARIES / "distritos.geojson").read_text(encoding="utf-8"))
        except OSError:
            return None
        for f in fc["features"]:
            g = f["geometry"]
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            xs = [p[0] for poly in polys for p in poly[0]]
            ys = [p[1] for poly in polys for p in poly[0]]
            _DIST_GEOMS.append(([min(xs), min(ys), max(xs), max(ys)], f["properties"], polys))
    for bbox, props, polys in _DIST_GEOMS:
        if not (bbox[0] <= lon <= bbox[2] and bbox[1] <= lat <= bbox[3]):
            continue
        for poly in polys:
            if _point_in_ring(lon, lat, poly[0]) and not any(_point_in_ring(lon, lat, h) for h in poly[1:]):
                return props
    return None

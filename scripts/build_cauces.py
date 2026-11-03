"""Red nacional de cauces para «Niño costero 2026-2027»: HydroRIVERS v1.0 (HydroSHEDS) recortado al Perú.

HydroRIVERS dibuja cada tramo en el sentido del flujo (primer vértice aguas arriba) y enlaza con NEXT_DOWN hasta la
desembocadura. Con eso se clasifica la vertiente de cada tramo (Pacífico, Amazonas/Atlántico, Titicaca) y se calcula
la distancia al mar. Cada tramo se cruza con el distrito que contiene su punto medio para leer los niveles de riesgo
publicados por CENEPRED (no se reparte ninguna cifra).

Entrada:  data/raw/hydrosheds/HydroRIVERS_v10_sa_shp/HydroRIVERS_v10_sa.shp (CC BY 4.0)
Salida:   apps/web/data/nino2627/cauces.geojson
Requiere haber corrido antes scripts/build_nino_costero.py (usa distritos.geojson y criticos.geojson).
"""
from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SHP = ROOT / "data" / "raw" / "hydrosheds" / "HydroRIVERS_v10_sa_shp" / "HydroRIVERS_v10_sa.shp"
OUT = ROOT / "apps" / "web" / "data" / "nino2627"
WEST, EAST, NORTH, SOUTH = -81.6, -68.4, 0.4, -18.6
# umbral de área de drenaje por vertiente: en el Pacífico se conservan quebradas pequeñas (huaicos), en la Amazonía solo ejes
MIN_UPLAND = {"P": 20, "A": 4000, "T": 300}
GRID = 0.01  # ~1,1 km para la búsqueda de distrito


def read_dbf_cols(path: Path, cols: list[str]) -> dict[str, np.ndarray]:
    b = path.read_bytes()
    n, hl, rl = struct.unpack("<IHH", b[4:12])
    fields, o, pos = {}, 32, 1
    while b[o] != 0x0D:
        name, ln = b[o:o + 11].split(b"\0")[0].decode(), b[o + 16]
        fields[name] = (pos, ln)
        pos += ln
        o += 32
    raw = np.frombuffer(b, dtype=np.uint8, offset=hl, count=n * rl).reshape(n, rl)
    out = {}
    for c in cols:
        p, ln = fields[c]
        out[c] = np.array([float(x) if x.strip() else 0 for x in raw[:, p:p + ln].view(f"S{ln}").ravel().tolist()])
    return out


def district_grid():
    geo = json.loads((OUT / "distritos.geojson").read_text(encoding="utf-8"))
    w, h = round((EAST - WEST) / GRID), round((NORTH - SOUTH) / GRID)
    img = Image.new("I", (w, h), 0)
    draw = ImageDraw.Draw(img)
    props = {0: None}
    for i, f in enumerate(geo["features"], start=1):
        props[i] = f["properties"]
        polys = f["geometry"]["coordinates"] if f["geometry"]["type"] == "MultiPolygon" else [f["geometry"]["coordinates"]]
        for poly in polys:
            ring = [((x - WEST) / GRID, (NORTH - y) / GRID) for x, y in poly[0]]
            if len(ring) > 2:
                draw.polygon(ring, fill=i)
    return np.array(img), props


def main() -> None:
    dbf = read_dbf_cols(SHP.with_suffix(".dbf"), ["HYRIV_ID", "NEXT_DOWN", "MAIN_RIV", "UPLAND_SKM", "DIS_AV_CMS", "ORD_STRA", "DIST_DN_KM", "ENDORHEIC"])
    data = np.memmap(SHP, dtype=np.uint8, mode="r")
    shx = np.frombuffer(SHP.with_suffix(".shx").read_bytes()[100:], dtype=">i4").reshape(-1, 2)
    n = len(shx)
    # 1) vertiente por río principal: posición de la desembocadura del tramo final (NEXT_DOWN = 0)
    ends: dict[int, tuple[float, float]] = {}
    geoms: dict[int, np.ndarray] = {}
    for i in range(n):
        off = int(shx[i, 0]) * 2 + 8
        box = struct.unpack("<4d", bytes(data[off + 4: off + 36]))
        last = int(dbf["NEXT_DOWN"][i]) == 0
        inside = box[2] >= WEST and box[0] <= EAST and box[3] >= SOUTH and box[1] <= NORTH
        if not inside and not last:
            continue
        npts = struct.unpack("<i", bytes(data[off + 40: off + 44]))[0]
        pts = np.frombuffer(bytes(data[off + 48: off + 48 + 16 * npts]), dtype="<f8").reshape(-1, 2)
        if last:
            ends[int(dbf["MAIN_RIV"][i])] = (float(pts[-1, 0]), float(pts[-1, 1]))
        if inside:
            geoms[i] = pts
    grid, dprops = district_grid()
    crit = json.loads((OUT / "criticos.geojson").read_text(encoding="utf-8"))["features"]
    cpts = np.array([f["geometry"]["coordinates"] if f["geometry"]["type"] == "Point" else f["geometry"]["coordinates"][0]
                     for f in crit if f["properties"]["t"] in ("pi", "pm")])
    cgrid: dict[tuple[int, int], int] = {}
    for x, y in cpts:
        cgrid[(int((x - WEST) / 0.02), int((NORTH - y) / 0.02))] = 1
    feats, stats = [], {"P": 0, "A": 0, "T": 0}
    for i, pts in geoms.items():
        main = int(dbf["MAIN_RIV"][i])
        out = ends.get(main)
        if dbf["ENDORHEIC"][i] or not out:
            v = "T"
        else:
            # la Amazonía desemboca en el Atlántico (lon > -60); el resto de salidas al mar están en la costa del Pacífico
            v = "A" if out[0] > -68 else "P"
        up = float(dbf["UPLAND_SKM"][i])
        if up < MIN_UPLAND[v]:
            continue
        mid = pts[len(pts) // 2]
        gx, gy = int((mid[0] - WEST) / GRID), int((NORTH - mid[1]) / GRID)
        if not (0 <= gx < grid.shape[1] and 0 <= gy < grid.shape[0]):
            continue
        p = dprops.get(int(grid[gy, gx]))
        if p is None:  # fuera del Perú (Ecuador, Brasil, Bolivia, Chile)
            continue
        near = any(cgrid.get((int((x - WEST) / 0.02) + dx, int((NORTH - y) / 0.02) + dy)) for x, y in (pts[0], mid, pts[-1]) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        # HydroRIVERS tiene ~500 m de resolución: 3 decimales (~110 m) y un vértice de cada dos bastan para dibujarlo
        keep = pts if len(pts) < 5 else np.vstack([pts[:-1:2], pts[-1:]])
        coords = []
        for x, y in keep:
            c = [round(float(x), 3), round(float(y), 3)]
            if not coords or c != coords[-1]:
                coords.append(c)
        if len(coords) < 2:
            continue
        feats.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": {
            "v": v, "up": round(up), "q": round(float(dbf["DIS_AV_CMS"][i]), 1), "o": int(dbf["ORD_STRA"][i]),
            "dn": round(float(dbf["DIST_DN_KM"][i])), "end": 1 if int(dbf["NEXT_DOWN"][i]) == 0 else 0, "u": p["u"],
            "ri": p.get("i_ver27", 0), "rm": p.get("m_ver27", 0), "bi": p.get("i_base", 0), "bm": p.get("m_base", 0),
            "c": 1 if near else 0}})
        stats[v] += 1
    (OUT / "cauces.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
    meta_path = OUT / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    meta["cauces"] = {"segments": len(feats), "by_slope": stats, "min_upland_km2": MIN_UPLAND,
                      "source": "HydroRIVERS v1.0 (Lehner & Grill 2013, HydroSHEDS) · CC BY 4.0",
                      "url": "https://www.hydrosheds.org/products/hydrorivers"}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(feats), stats, f"{(OUT / 'cauces.geojson').stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

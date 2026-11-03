"""Construye las capas estáticas «Niño costero 2026-2027» a partir de fuentes oficiales descargadas.

Entradas (inmutables, fuera de Git):
  data/raw/cenepred/escenario_trimestral/{100,101}_tabla.zip  ← SIGRID/CENEPRED, escenarios por pronóstico trimestral
  Data Niño 2026/  ← entrega local CENEPRED del Plan Multisectorial ante Lluvias (PMLL) 2024-2026 (shape + tablas)

Salidas (apps/web/data/nino2627/, versionadas):
  distritos.geojson  riesgo por distrito: OND 2026, verano 2027 y base PMLL (solo niveles publicados, sin repartir cifras)
  criticos.geojson   puntos/tramos críticos ANA (inicio → fin publicados) y zonas críticas INGEMMET
  susc-inund.png / susc-mm.png  susceptibilidad PMLL rasterizada en Web Mercator (~300 m por píxel)
  meta.json          procedencia, SHA-256 de los originales, conteos calculados

Uso:  python scripts/build_nino_costero.py [--skip-raster]
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import struct
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "cenepred" / "escenario_trimestral"
LOCAL = ROOT / "Data Niño 2026"
OUT = ROOT / "apps" / "web" / "data" / "nino2627"
LEVEL = {"muy alto": 4, "alto": 3, "medio": 2, "bajo": 1}
SCENARIOS = {  # id SIGRID → período publicado
    "ond26": {"id": 101, "label": "Octubre–diciembre 2026", "start": "2026-10", "end": "2026-12", "made": "2026-09"},
    "ver27": {"id": 100, "label": "Verano 2027 (enero–marzo)", "start": "2027-01", "end": "2027-03", "made": "2026-09"},
}
# Perú con margen; el raster se dibuja en Web Mercator para que la capa image de MapLibre no se deforme
WEST, EAST, NORTH, SOUTH = -81.6, -68.4, 0.4, -18.6
RASTER_W = 4400


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def level(v) -> int:
    return LEVEL.get(str(v or "").strip().lower(), 0)


def utm_to_lonlat(e: float, n: float, zone: int, south: bool = True) -> tuple[float, float]:
    """UTM WGS84 → geográficas (serie de Krüger, precisión submétrica)."""
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    x = e - 500000.0
    y = n - (10000000.0 if south else 0.0)
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p1 = (mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
          + (151 * e1 ** 3 / 96) * math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * math.sin(8 * mu))
    n1 = a / math.sqrt(1 - e2 * math.sin(p1) ** 2)
    t1 = math.tan(p1) ** 2
    c1 = ep2 * math.cos(p1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(p1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = p1 - (n1 * math.tan(p1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24
                                          + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ep2 - 3 * c1 ** 2) * d ** 6 / 720)
    lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(p1)
    return round(math.degrees(lon) + (zone * 6 - 183), 5), round(math.degrees(lat), 5)


def sheet_rows(book, name):
    ws = book[name]
    rows = ws.iter_rows(values_only=True)
    head = [str(h).strip() if h is not None else "" for h in next(rows)]
    for r in rows:
        if any(v is not None for v in r):
            yield dict(zip(head, r))


def open_zip_book(zip_path: Path, prefix: str):
    with zipfile.ZipFile(zip_path) as z:
        name = next(n for n in z.namelist() if Path(n).name.startswith(prefix))
        return openpyxl.load_workbook(io.BytesIO(z.read(name)), read_only=True, data_only=True), Path(name).name


def read_dbf(path: Path) -> list[dict]:
    b = path.read_bytes()
    n, hl, rl = struct.unpack("<IHH", b[4:12])
    fields, o = [], 32
    while b[o] != 0x0D:
        fields.append((b[o:o + 11].split(b"\0")[0].decode(), b[o + 16]))
        o += 32
    out = []
    for i in range(n):
        rec, p, row = b[hl + i * rl: hl + (i + 1) * rl], 1, {}
        for name, ln in fields:
            row[name] = rec[p:p + ln].decode("latin-1").strip()
            p += ln
        out.append(row)
    return out


def districts(sources: list) -> dict:
    risk: dict[str, dict] = {}
    for key, sc in SCENARIOS.items():
        path = RAW / f"{sc['id']}_tabla.zip"
        for kind, prefix, sheet, ucol, ncol in (("i", "Dist_Riesgo_Inundacion", "BD_ERInund", "ubigeo", "n_riesg_in"),
                                                ("m", "Dist_Riesgo_MMasa", "BD_ERMMasa", "UBIGEO", "n_riesg_mm")):
            book, fname = open_zip_book(path, prefix)
            for r in sheet_rows(book, sheet):
                u = str(r.get(ucol) or "").zfill(6)
                d = risk.setdefault(u, {})
                d[f"{kind}_{key}"] = level(r.get(ncol))
                d.setdefault("pob", r.get("t_pob"))
                if kind == "i":
                    d[f"pi_{key}"] = r.get("pob_sinu")
                else:
                    d[f"pm_{key}"] = r.get("pob_smm")
            sources.append({"file": fname, "zip": path.name, "sha256": sha256(path)})
    for kind, fname, col in (("i", "Riesgo_Inundacion_Distritos.dbf", "NRiesgo_In"), ("m", "Riesgo_MMasa_Distritos.dbf", "NRiesgo_MM")):
        p = LOCAL / "Shape" / fname
        for r in read_dbf(p):
            risk.setdefault(r["UBIGEO"].zfill(6), {})[f"{kind}_base"] = level(r.get(col))
        sources.append({"file": f"Data Niño 2026/Shape/{fname}", "sha256": sha256(p)})
    geo = json.loads((ROOT / "data" / "peru" / "boundaries" / "distritos.geojson").read_text(encoding="utf-8"))
    feats = []
    for f in geo["features"]:
        u = f["properties"]["u"]
        r = risk.get(u)
        if not r:
            continue
        props = {"u": u, "n": f["properties"].get("n"), "p": f["properties"].get("p"), "d": f["properties"].get("d")}
        props.update({k: (round(v) if isinstance(v, float) else v) for k, v in r.items() if v is not None})
        feats.append({"type": "Feature", "id": int(u), "properties": props, "geometry": f["geometry"]})
    return {"type": "FeatureCollection", "features": feats}


def criticals(sources: list) -> dict:
    path = RAW / "100_tabla.zip"
    book, fname = open_zip_book(path, "PuntosCriticos")
    feats = []
    for sheet, kind in (("Puntos Criticos Inundacion", "pi"), ("Puntos Criticos MMasa", "pm")):
        for r in sheet_rows(book, sheet):
            try:
                zone = int(r.get("zona") or 18)
                ei, ni = float(r.get("coord_este_i") or 0), float(r.get("coord_norte_i") or 0)
                ef, nf = float(r.get("coord_este_f") or 0), float(r.get("coord_norte_f") or 0)
            except (TypeError, ValueError):
                continue
            if not ei or not ni:
                continue
            a = utm_to_lonlat(ei, ni, zone)
            if not (WEST <= a[0] <= EAST and SOUTH <= a[1] <= NORTH):
                continue
            geom = {"type": "Point", "coordinates": a}
            if ef and nf:
                b = utm_to_lonlat(ef, nf, zone)
                # un tramo publicado de más de 25 km suele ser un error de digitación: se conserva solo el inicio
                if WEST <= b[0] <= EAST and SOUTH <= b[1] <= NORTH and math.dist(a, b) < 0.23:
                    geom = {"type": "LineString", "coordinates": [a, b]}
            fecha = r.get("fecha_doc")
            feats.append({"type": "Feature", "properties": {
                "t": kind, "rio": r.get("nom_rio_q"), "cuenca": r.get("nom_cuenca"), "sector": r.get("nom_sector"),
                "u": str(r.get("ubi_dist") or "").zfill(6), "dist": r.get("nom_dist"), "dep": r.get("nom_dpto"),
                "pel": r.get("tip_peligr"), "lv": level(r.get("n_peligro")), "medida": str(r.get("medid_prev") or "")[:240],
                "expuesto": str(r.get("descrip") or "")[:240], "anio": r.get("periodo"),
                "fecha": fecha.date().isoformat() if hasattr(fecha, "date") else None,
                "fuente": r.get("fuente_log") or "ANA", "url": r.get("url1") or r.get("url")}, "geometry": geom})
    for r in sheet_rows(book, "Zonas Criticas MMasa"):
        try:
            lon, lat = round(float(r["X_GEO"]), 5), round(float(r["Y_GEO"]), 5)
        except (TypeError, ValueError, KeyError):
            continue
        if not (WEST <= lon <= EAST and SOUTH <= lat <= NORTH):
            continue
        feats.append({"type": "Feature", "properties": {
            "t": "zc", "rio": r.get("PARAJE"), "u": str(r.get("UBIGEO") or "").zfill(6), "dist": r.get("DISTRITO"), "dep": r.get("REGION"),
            "pel": r.get("PELIGROS_G"), "lv": 0, "expuesto": r.get("ELEMENTO"), "fuente": "INGEMMET",
            "boletin": r.get("BOLETIN"), "url": r.get("URL_BOLETI")}, "geometry": {"type": "Point", "coordinates": [lon, lat]}})
    sources.append({"file": fname, "zip": path.name, "sha256": sha256(path)})
    return {"type": "FeatureCollection", "features": feats}


def merc_y(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def rasterize(shp: Path, out_png: Path, level_of, sources: list) -> dict:
    """Polígonos UTM 18S → PNG paletado en Web Mercator. Valor de píxel = nivel publicado (2 medio, 3 alto, 4 muy alto)."""
    import numpy as np
    from PIL import Image, ImageDraw

    x0, x1 = math.radians(WEST), math.radians(EAST)
    y0, y1 = merc_y(NORTH), merc_y(SOUTH)
    w = RASTER_W
    h = round(w * (y0 - y1) / (x1 - x0))
    sx, sy = w / (x1 - x0), h / (y0 - y1)
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)

    def project(pts: "np.ndarray") -> list:
        # inversa UTM vectorizada (zona 18S), luego a píxel Mercator
        x = pts[:, 0] - 500000.0
        m = (pts[:, 1] - 10000000.0) / k0
        mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
        e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
        p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * np.sin(2 * mu) + (21 * e1 ** 2 / 16) * np.sin(4 * mu) + (151 * e1 ** 3 / 96) * np.sin(6 * mu)
        s = np.sin(p1)
        n1 = a / np.sqrt(1 - e2 * s ** 2)
        t1 = np.tan(p1) ** 2
        c1 = e2 / (1 - e2) * np.cos(p1) ** 2
        r1 = a * (1 - e2) / (1 - e2 * s ** 2) ** 1.5
        d = x / (n1 * k0)
        lat = p1 - (n1 * np.tan(p1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1) * d ** 4 / 24)
        lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6) / np.cos(p1) + math.radians(-75.0)
        px = (lon - x0) * sx
        py = (y0 - np.log(np.tan(np.pi / 4 + lat / 2))) * sy
        return list(zip(px.tolist(), py.tolist()))

    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    dbf = read_dbf(shp.with_suffix(".dbf"))
    data = np.memmap(shp, dtype=np.uint8, mode="r")
    shx = np.memmap(shp.with_suffix(".shx"), dtype=np.uint8, mode="r")
    n = (len(shx) - 100) // 8
    order = sorted(range(n), key=lambda i: level_of(dbf[i]))  # el nivel mayor se dibuja al final
    for count, i in enumerate(order):
        lv = level_of(dbf[i])
        if lv < 2:
            continue
        off = struct.unpack(">i", bytes(shx[100 + i * 8: 104 + i * 8]))[0] * 2 + 8
        if struct.unpack("<i", bytes(data[off:off + 4]))[0] != 5:
            continue
        nparts, npts = struct.unpack("<2i", bytes(data[off + 36: off + 44]))
        parts = np.frombuffer(bytes(data[off + 44: off + 44 + 4 * nparts]), dtype="<i4").tolist() + [npts]
        pts = np.frombuffer(bytes(data[off + 44 + 4 * nparts: off + 44 + 4 * nparts + 16 * npts]), dtype="<f8").reshape(-1, 2)
        for j in range(nparts):
            ring = pts[parts[j]:parts[j + 1]]
            if len(ring) < 4:
                continue
            # anillo exterior (horario en shapefile) se pinta; los huecos interiores grandes se vacían
            area = float(np.sum(ring[:-1, 0] * ring[1:, 1] - ring[1:, 0] * ring[:-1, 1])) / 2
            xy = project(ring)
            if area > 0 and abs(area) > 4e6:
                draw.polygon(xy, fill=0)
            elif area <= 0:
                draw.polygon(xy, fill=lv)
        if count % 200000 == 0 and count:
            print(f"  {shp.name}: {count}/{n}", flush=True)
    pal = [0, 0, 0, 0, 0, 0, 242, 177, 52, 232, 98, 44, 194, 24, 91] + [0] * (256 * 3 - 15)
    img.putpalette(pal)
    img.save(out_png, optimize=True, transparency=bytes([0, 0, 150, 175, 200]))
    sources.append({"file": f"Data Niño 2026/Shape/{shp.name}", "sha256": sha256(shp)})
    return {"file": out_png.name, "coordinates": [[WEST, NORTH], [EAST, NORTH], [EAST, SOUTH], [WEST, SOUTH]],
            "pixel_m": round(2 * math.pi * 6378137 / (2 * math.pi) * (x1 - x0) / w), "width": w, "height": h}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sources: list = []
    dist = districts(sources)
    (OUT / "distritos.geojson").write_text(json.dumps(dist, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    crit = criticals(sources)
    (OUT / "criticos.geojson").write_text(json.dumps(crit, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
    counts = {}
    for key in ["ond26", "ver27", "base"]:
        for k in "im":
            c = [f["properties"].get(f"{k}_{key}", 0) for f in dist["features"]]
            counts[f"{k}_{key}"] = {"muy_alto": c.count(4), "alto": c.count(3), "medio": c.count(2), "bajo": c.count(1)}
    changed = sum(1 for f in dist["features"] if f["properties"].get("i_ver27", 0) > f["properties"].get("i_base", 0)
                  or f["properties"].get("m_ver27", 0) > f["properties"].get("m_base", 0))
    rasters = {}
    if "--skip-raster" not in sys.argv:
        rasters["inund"] = rasterize(LOCAL / "Shape" / "susc_inund_pp.shp", OUT / "susc-inund.png",
                                     lambda r: int(r["peso"]) - 1 if str(r.get("peso")).isdigit() else 0, sources)
        rasters["mm"] = rasterize(LOCAL / "Shape" / "susc_mmasa_pp.shp", OUT / "susc-mm.png",
                                  lambda r: int(r["V_SMMPP"]) - 1 if str(r.get("V_SMMPP")).isdigit() else 0, sources)
    elif (OUT / "meta.json").exists():
        rasters = json.loads((OUT / "meta.json").read_text(encoding="utf-8")).get("rasters", {})
    meta = {"built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "scenarios": SCENARIOS, "counts": counts,
            "raised_vs_base": changed, "critical_features": len(crit["features"]), "rasters": rasters, "inputs": sources}
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in meta.items() if k != "inputs"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

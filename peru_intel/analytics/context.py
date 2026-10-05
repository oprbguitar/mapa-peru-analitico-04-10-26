"""Informador 360: clic en cualquier punto del Perú → ficha viva del lugar, con la naturaleza de cada dato.

Secciones (cada una con su fuente; si falta, se dice):
  territorio     distrito/provincia/departamento (INEI), UBIGEO, celda H3 r7
  población      proyección oficial del distrito (INEI vía MININTER) — no se interpola a la cuadra
  seguridad      observatorio SIDPOL del distrito: último año, tendencia, modalidad principal, foco o no
  servicios      comisarías, serenazgo, fiscalías, juzgados, salud, colegios, bomberos: cuántos y el más cercano
  emergencias    INDECI en el distrito (12 meses, por tipo) y vías nacionales afectadas a ≤ 25 km (MTC)
  peligros       INGEMMET (en línea, ≤ 5 km, caché) — zonas críticas e inventario de peligros
  ambiente       sismos ≤ 150 km (30 días), focos de calor ≤ 25 km, clima de la celda más cercana
  El Niño        estado ENFEN vigente si el punto está en la costa o sierra occidental norte/centro
  señales        GDELT (opcional, en línea): titulares recientes — SEÑAL MEDIÁTICA NO VERIFICADA
"""
from __future__ import annotations

import json
import math
import time
import urllib.parse
from functools import lru_cache

from .. import config
from ..events import store
from ..map import territory
from ..sources import registry
from ..sources.harvester import http_get
from ..storage import warehouse
from . import crime

INGEMMET = "https://geocatmin.ingemmet.gob.pe/arcgis/rest/services/SERV_PELIGROS_GEOLOGICOS/MapServer"
_CACHE: dict[tuple, tuple[float, object]] = {}


def km(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))


def _cached(key: tuple, ttl: float, fn):
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _CACHE[key] = (time.time(), val)
    return val


@lru_cache(maxsize=1)
def _institutions() -> list[dict]:
    try:
        return json.loads((config.NORMALIZED / "instituciones.json").read_text(encoding="utf-8"))["items"]
    except (OSError, ValueError, KeyError):
        return []


CELL = 0.05  # ~5,5 km: índice espacial en memoria


@lru_cache(maxsize=1)
def _grid() -> dict[tuple[int, int], list[dict]]:
    pts = [{"cat": i["cat"], "nombre": i["name"], "lat": i["lat"], "lon": i["lon"], "detalle": i.get("address"),
            "fuente": "OpenStreetMap", "kind": "vivo_tercero"} for i in _institutions()]
    if warehouse.has("servicios"):
        pts += warehouse.query("SELECT cat, nombre, lat, lon, detalle, fuente, kind FROM servicios")
    grid: dict[tuple[int, int], list[dict]] = {}
    for p in pts:
        grid.setdefault((int(p["lat"] // CELL), int(p["lon"] // CELL)), []).append(p)
    return grid


def clear_cache() -> None:
    _institutions.cache_clear()
    _grid.cache_clear()


def points_near(lat: float, lon: float, radius_km: float, cats: set[str] | None = None) -> list[dict]:
    """Sedes y servicios dentro del radio (índice de celdas), ordenados por distancia."""
    g = _grid()
    r = int(radius_km / (111 * CELL * max(0.2, math.cos(math.radians(lat))))) + 1
    ci, cj = int(lat // CELL), int(lon // CELL)
    out = []
    for i in range(ci - r, ci + r + 1):
        for j in range(cj - r, cj + r + 1):
            for p in g.get((i, j), ()):
                if cats and p["cat"] not in cats:
                    continue
                d = km(lat, lon, p["lat"], p["lon"])
                if d <= radius_km:
                    out.append(p | {"km": round(d, 2)})
    return sorted(out, key=lambda o: o["km"])


SERVICE_LABEL = {"comisaria": "Comisarías", "serenazgo": "Serenazgo", "fiscalia": "Ministerio Público", "judicial": "Poder Judicial",
                 "hospital": "Hospitales", "salud": "Centros y puestos de salud", "colegio": "Colegios", "universidad": "Universidades",
                 "instituto": "Institutos", "bomberos": "Bomberos"}


def services(lat: float, lon: float) -> dict:
    near5 = points_near(lat, lon, 5)
    rows = []
    for cat, label in SERVICE_LABEL.items():
        c = [p for p in near5 if p["cat"] == cat]
        within1 = sum(1 for p in c if p["km"] <= 1)
        nearest = c[0] if c else None
        if not nearest:  # buscar más lejos solo el más cercano (25 km)
            far = [p for p in points_near(lat, lon, 25) if p["cat"] == cat]
            nearest = far[0] if far else None
        rows.append({"cat": cat, "label": label, "n_1km": within1, "n_5km": len(c),
                     "nearest": {k: nearest[k] for k in ("nombre", "km", "lat", "lon", "fuente", "kind")} if nearest else None})
    return {"rows": rows, "kind": "mixto",
            "note": "Salud: RENIPRESS (oficial). Sedes de seguridad, colegios y bomberos: OpenStreetMap (ubicación aproximada)."}


def security(ub: str) -> dict | None:
    ext = crime.sidpol_extent()
    if not ext or not ub:
        return None
    y = ext["last_full_year"]
    rows = warehouse.query("""SELECT anio, modalidad, sum(cantidad) c FROM sidpol_denuncias WHERE ubigeo = ? AND anio IN (?, ?)
                              GROUP BY 1, 2""", [ub, y, y - 1])
    cur = {r["modalidad"]: int(r["c"]) for r in rows if r["anio"] == y}
    prev = {r["modalidad"]: int(r["c"]) for r in rows if r["anio"] == y - 1}
    tot, ptot = sum(cur.values()), sum(prev.values())
    pop = warehouse.query("SELECT poblacion FROM poblacion WHERE nivel='distrito' AND ubigeo=? AND anio=?", [ub, y])
    p = pop[0]["poblacion"] if pop else None
    top = max(cur, key=cur.get) if cur else None
    rates = warehouse.query("""WITH c AS (SELECT ubigeo u, sum(cantidad) n FROM sidpol_denuncias WHERE anio = ? AND prov = ? GROUP BY 1),
                               p AS (SELECT ubigeo u, poblacion FROM poblacion WHERE nivel='distrito' AND anio = ?)
                               SELECT c.u, c.n / p.poblacion * 100000 r FROM c JOIN p USING (u)""", [y, ub[:4], y])
    ranked = sorted((r for r in rates if r["r"]), key=lambda r: -r["r"])
    pos = next((i + 1 for i, r in enumerate(ranked) if r["u"] == ub), None)
    return {"year": y, "count": tot, "rate": round(tot / p * 100000, 1) if p else None,
            "change_pct": round((tot - ptot) / ptot * 100, 1) if ptot else None, "top_modality": top,
            "top_share_pct": round(cur[top] / tot * 100, 1) if top and tot else None,
            "position": pos, "of": len(ranked), "hot": bool(pos and ranked and pos <= max(1, math.ceil(len(ranked) * 0.1))),
            "population": int(p) if p else None, "kind": "oficial + calculado"}


def emergencies(ub: str, lat: float, lon: float) -> dict:
    out = {"indeci": None, "vias": [], "kind": "oficial"}
    if warehouse.has("indeci_emergencias") and ub:
        last = warehouse.query("SELECT max(fecha) f FROM indeci_emergencias")[0]["f"]
        rows = warehouse.query("""SELECT fenomeno, count(*) n, sum(afectados) af, sum(damnificados) dam, sum(fallecidos) fall
                                  FROM indeci_emergencias WHERE ubigeo = ? AND fecha >= CAST(? AS DATE) - INTERVAL 365 DAY
                                  GROUP BY 1 ORDER BY 2 DESC""", [ub, last])
        hist = warehouse.query("SELECT anio, count(*) n FROM indeci_emergencias WHERE ubigeo = ? GROUP BY 1 ORDER BY 1", [ub])
        out["indeci"] = {"window_end": str(last), "by_type": rows[:6], "total": sum(r["n"] for r in rows), "by_year": hist}
    if warehouse.has("mtc_vias"):
        d = 25 / 111
        cand = warehouse.query("""SELECT id, fecha, evento, ruta, tramo, estado, lat, lon FROM mtc_vias
                                  WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? ORDER BY fecha DESC""", [lat - d, lat + d, lon - d, lon + d])
        for c in cand:
            c["km"] = round(km(lat, lon, c["lat"], c["lon"]), 1)
            c["fecha"] = str(c["fecha"])
        out["vias"] = sorted((c for c in cand if c["km"] <= 25), key=lambda c: c["km"])[:6]
    return out


def hazards(lat: float, lon: float, radius_m: int = 5000) -> dict:
    def fetch():
        res = {"zonas_criticas": [], "inventario": 0}
        for layer in (2, 0):
            q = {"geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": 4326, "distance": radius_m,
                 "units": "esriSRUnit_Meter", "outFields": "*", "returnGeometry": "true", "outSR": 4326, "f": "json"}
            d = json.loads(http_get(f"{INGEMMET}/{layer}/query?" + urllib.parse.urlencode(q), timeout=20, retries=1, min_interval=0.5))
            feats = d.get("features") or []
            if layer == 2:
                for f in feats[:8]:
                    a, g = f["attributes"], f.get("geometry") or {}
                    res["zonas_criticas"].append({"peligro": a.get("PELIGROS_G"), "paraje": a.get("PARAJE"), "boletin": a.get("BOLETIN"),
                                                  "km": round(km(lat, lon, g.get("y", lat), g.get("x", lon)), 2),
                                                  "lat": g.get("y"), "lon": g.get("x")})
                res["zonas_criticas"].sort(key=lambda z: z["km"])
            else:
                res["inventario"] = len(feats)
        return res
    try:
        return _cached(("ingemmet", round(lat, 3), round(lon, 3)), 7 * 86400, fetch) | {"kind": "oficial", "radius_km": radius_m / 1000}
    except Exception as e:  # noqa: BLE001 — sin red o servicio caído
        return {"error": f"INGEMMET no disponible ({type(e).__name__}). Sin conexión, esta sección queda vacía.", "kind": "oficial"}


def environment(lat: float, lon: float) -> dict:
    from ..live.worker import WORKERS
    out = {}
    sz = WORKERS.get("seismic")
    if sz and sz.data:
        now = time.time()
        q = [x for x in sz.data.get("items", []) if now - x["time"] <= 30 * 86400]
        near = sorted(({**x, "km": round(km(lat, lon, x["lat"], x["lon"]))} for x in q), key=lambda x: x["km"])
        near = [x for x in near if x["km"] <= 150]
        out["sismos"] = {"n": len(near), "max_mag": max((x["mag"] for x in near), default=None),
                         "nearest": {k: near[0][k] for k in ("mag", "km", "place", "time")} if near else None, "kind": "oficial"}
    fi = WORKERS.get("fires")
    if fi and fi.data:
        near = [x for x in fi.data.get("items", []) if km(lat, lon, x["lat"], x["lon"]) <= 25]
        out["focos"] = {"n": len(near), "kind": "vivo_tercero"}
    g = WORKERS.get("wxgrid")
    if g and g.data:
        c = min(g.data["cells"], key=lambda c: km(lat, lon, c["lat"], c["lon"]))
        out["clima"] = {k: c.get(k) for k in ("temp_c", "precip_mm", "cloud_pct", "wind_kmh", "fx", "time")} | \
            {"km_celda": round(km(lat, lon, c["lat"], c["lon"])), "kind": "proyeccion"}
    return out


NINO_DEPS = {"24", "20", "14", "13", "02", "06", "15", "11", "01"}  # costa y vertiente occidental norte/centro


def enso_note(dep: str | None) -> dict | None:
    if dep not in NINO_DEPS:
        return None
    try:
        from ..climate import enso
        cur = enso.curated()["current"]
        return {"status": cur["status"], "headline": cur["headline"], "comunicado": cur["comunicado"], "url": cur["url"], "kind": "oficial"}
    except Exception:  # noqa: BLE001
        return None


def media(name: str) -> dict:
    def fetch():
        q = {"query": f'"{name}" sourcecountry:PE', "mode": "artlist", "format": "json", "maxrecords": 8, "timespan": "3d", "sort": "datedesc"}
        raw = http_get("https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(q), timeout=15, retries=1, min_interval=5)
        arts = json.loads(raw or b"{}").get("articles") or []
        return [{"title": a.get("title"), "url": a.get("url"), "domain": a.get("domain"), "seen": a.get("seendate")} for a in arts]
    try:
        items = _cached(("gdelt", name), 1800, fetch)
    except Exception as e:  # noqa: BLE001
        return {"items": [], "error": f"GDELT no disponible ({type(e).__name__})", "kind": "vivo_tercero"}
    return {"items": items, "kind": "vivo_tercero", "label": "SEÑAL MEDIÁTICA NO VERIFICADA"}


def point(lat: float, lon: float, with_online: bool = True) -> dict:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("coordenadas fuera de rango")
    d = territory.district_at(lat, lon)
    ub = d.get("u") if d else None
    terr = territory.lookup(ub) if ub else None
    out = {
        "point": {"lat": round(lat, 6), "lon": round(lon, 6)},
        "territory": {"ubigeo": ub, "distrito": d.get("n") if d else None, "provincia": d.get("p") if d else None,
                      "departamento": d.get("d") if d else None, "h3_r7": store.cell(lat, lon), "in_peru": bool(d),
                      "bbox": terr.get("bbox") if terr else None},
        "security": security(ub) if ub else None,
        "services": services(lat, lon),
        "emergencies": emergencies(ub, lat, lon),
        "environment": environment(lat, lon),
        "enso": enso_note(ub[:2] if ub else None),
    }
    if with_online and d:
        out["hazards"] = hazards(lat, lon)
    out["provenance"] = registry.provenance("limites_inei", "mininter_sidpol", "inei_poblacion", "osm_instituciones", "renipress",
                                            "osm_servicios", "indeci_sinpad", "mtc_emergencias_viales", "ingemmet_peligros",
                                            "igp_sismos", "openmeteo", "enfen_comunicados")
    out["summary"] = summary_text(out)
    return out


def _d(v: float, nd: int = 1) -> str:
    return f"{v:.{nd}f}".replace(".", ",")


def summary_text(c: dict) -> str:
    """Informe hablado (determinista, sin IA): lo que el asistente de voz lee en voz alta."""
    t = c["territory"]
    if not t["in_peru"]:
        return "El punto está fuera del Perú; solo hay datos de clima y ambiente."
    parts = [f"Estás en {t['distrito']}, provincia de {t['provincia']}, {t['departamento']}."]
    s = c.get("security")
    if s and s["count"]:
        ch = s["change_pct"]
        parts.append(f"En {s['year']} se registraron {s['count']:,} denuncias".replace(",", " ") +
                     (f", {_d(abs(ch))} por ciento {'más' if ch > 0 else 'menos'} que el año anterior" if ch is not None else "") +
                     (f"; la modalidad principal fue {s['top_modality'].lower()} con {s['top_share_pct']:.0f} por ciento" if s["top_modality"] else "") + ".")
        if s["hot"]:
            parts.append(f"Es uno de los distritos con tasa más alta de su provincia (puesto {s['position']} de {s['of']}).")
    sv = {r["cat"]: r for r in c["services"]["rows"]}
    near = [f"{r['label'].lower()} a {_d(r['nearest']['km'])} km" for k, r in sv.items()
            if k in ("comisaria", "hospital", "salud", "bomberos") and r["nearest"]]
    if near:
        parts.append("Lo más cercano: " + ", ".join(near[:4]) + ".")
    e = c["emergencies"]
    if e.get("indeci") and e["indeci"]["total"]:
        top = e["indeci"]["by_type"][0]
        parts.append(f"INDECI registró {e['indeci']['total']} emergencias en el distrito en los últimos 12 meses de datos; la más frecuente: {top['fenomeno'].lower()}.")
    vias = [v for v in e.get("vias", []) if "INTERRUMP" in (v.get("estado") or "").upper()]
    if vias:
        parts.append(f"Hay {len(vias)} tramos de la red vial nacional interrumpidos a menos de 25 km.")
    hz = c.get("hazards") or {}
    if hz.get("zonas_criticas"):
        z = hz["zonas_criticas"][0]
        parts.append(f"INGEMMET marca una zona crítica a {_d(z['km'])} km: {z['peligro'].lower()}.")
    if c.get("enso"):
        parts.append(f"ENFEN mantiene la {c['enso']['status'][0].lower() + c['enso']['status'][1:]}: {c['enso']['headline'][0].lower() + c['enso']['headline'][1:]}.")
    env = c.get("environment") or {}
    if env.get("clima") and env["clima"].get("temp_c") is not None:
        parts.append(f"Ahora: {env['clima']['temp_c']:.0f} grados según el modelo.")
    return " ".join(parts)

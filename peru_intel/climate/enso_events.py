"""Registros de quebradas activadas, ríos desbordados, inundaciones, lluvias y deslizamientos dentro de cada
período de El Niño, para verlos todos a la vez en el mapa.

Fuentes (sin mezclar cifras): SINPAD/INDECI desde 2015 (coordenada del registro) y DesInventar 1970–2015
(fichas de prensa y reportes, ubicadas en el centroide del territorio PUBLICADO: distrito, provincia o
departamento). Cada punto es un registro; no se reparte ninguna cifra entre territorios.
"""
from __future__ import annotations

import calendar
import time

from ..map import territory
from ..sources import registry
from ..storage import warehouse
from . import enso

TYPES = {"huaico": "Huaico / quebrada activada", "rio": "Desborde de río", "inundacion": "Inundación",
         "lluvia": "Lluvias intensas", "deslizamiento": "Deslizamiento / erosión", "marejada": "Marejada"}

SINPAD_SQL = """CASE
  WHEN regexp_matches(fenomeno, 'HUAICO|ALUVI|FLUJOS DE BARRO') THEN 'huaico'
  WHEN regexp_matches(fenomeno, 'DESBORDE DE RIO|DEFENSA RIBERE|EROSION FLUVIAL') THEN 'rio'
  WHEN regexp_matches(fenomeno, 'INUNDACI') THEN 'inundacion'
  WHEN regexp_matches(fenomeno, 'LLUVIA|PRECIPITACION|TEMPORALES') THEN 'lluvia'
  WHEN regexp_matches(fenomeno, 'DESLIZAMIENTO|^EROSION|^DERRUMBE( CERROS| DE ROCAS)?$') THEN 'deslizamiento'
  WHEN regexp_matches(fenomeno, 'MAREJADA|OLEAJE') THEN 'marejada' END"""
DI_TYPE = {"Aluvión (Huayco)": "huaico", "Avenida torrencial": "huaico", "Inundación": "inundacion", "Lluvias": "lluvia",
           "Deslizamiento": "deslizamiento", "Marejada": "marejada"}


def _range(st: dict) -> tuple[str, str]:
    end = st.get("end") or time.strftime("%Y-%m")
    y, m = int(end[:4]), int(end[5:7])
    return st["start"][:7] + "-01", f"{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}"


def period_events(story_id: str) -> dict:
    st = next((s for s in enso.curated()["storylines"] if s["id"] == story_id), None)
    if not st:
        raise ValueError("historia desconocida")
    a, b = _range(st)
    pts, srcs = [], []
    if warehouse.has("indeci_emergencias") and b >= "2015-01-01":
        rows = warehouse.query(f"""SELECT * FROM (SELECT {SINPAD_SQL} t, fecha, fenomeno, departamento, provincia, distrito, lat, lon, ubigeo,
                                     damnificados, afectados, fallecidos FROM indeci_emergencias
                                   WHERE fecha BETWEEN CAST(? AS DATE) AND CAST(? AS DATE) AND lat IS NOT NULL) WHERE t IS NOT NULL""", [a, b])
        for r in rows:
            pts.append([round(r["lon"], 4), round(r["lat"], 4), r["t"], str(r["fecha"]), r["fenomeno"].capitalize(),
                        ", ".join(x for x in (r["distrito"], r["provincia"], r["departamento"]) if x), int(r["damnificados"] or 0),
                        int(r["afectados"] or 0), int(r["fallecidos"] or 0), "SINPAD", None, "punto", r["ubigeo"]])
        srcs.append("indeci_sinpad")
    if warehouse.has("desinventar_eventos") and a <= "2015-12-31":
        geo = {t["ubigeo"]: t for t in territory.index() if t.get("lat") is not None}
        rows = warehouse.query("""SELECT fecha, evento, ubigeo, nivel, departamento, provincia, distrito, lugar, fuente, descripcion,
                                         damnificados, afectados, muertos FROM desinventar_eventos
                                  WHERE fecha BETWEEN ? AND ? AND evento IN ?""", [a, b, list(DI_TYPE)])
        for r in rows:
            t = geo.get(r["ubigeo"] or "")
            if not t:
                continue
            place = ", ".join(x for x in (r["lugar"], r["distrito"], r["provincia"], r["departamento"]) if x)
            pts.append([t["lon"], t["lat"], DI_TYPE[r["evento"]], str(r["fecha"]), r["evento"], place, r["damnificados"],
                        r["afectados"], r["muertos"], "DesInventar", r["fuente"], r["nivel"], r["ubigeo"]])
        srcs.append("desinventar_per")
    pts.sort(key=lambda p: p[3])
    counts = {k: sum(1 for p in pts if p[2] == k) for k in TYPES}
    return {"story": story_id, "from": a, "to": b, "types": TYPES, "counts": counts, "total": len(pts),
            "fields": ["lon", "lat", "tipo", "fecha", "fenomeno", "lugar", "damnificados", "afectados", "fallecidos", "registro", "fuente", "ubicacion", "ubigeo"],
            "events": pts,
            "method": "Un punto por registro. SINPAD: coordenada del registro. DesInventar: centroide del territorio publicado "
                      "(distrito, provincia o departamento; ver «ubicacion»). Sin redistribuir cifras.",
            "coverage_note": "SINPAD cubre desde 2015 y DesInventar de 1970 a 2015; un período en curso llega hasta el último corte del SINPAD.",
            "provenance": registry.provenance(*srcs) if srcs else []}


_CMP: dict = {}


def compare(tipo: str) -> dict:
    """Por cada Niño: cuántos registros del tipo y los lugares con más registros (conteo de registros, no de daños)."""
    if tipo not in TYPES:
        raise ValueError("tipo desconocido")
    if tipo not in _CMP:
        out = []
        for st in enso.curated()["storylines"]:
            d = period_events(st["id"])
            places: dict[str, list] = {}
            for e in d["events"]:
                if e[2] == tipo:
                    parts = [s.replace("DIST. ", "").replace("PROV. ", "").replace("DEPA. ", "").strip().title() for s in (e[5] or "").split(",")]
                    k = parts[0] + " · " + ", ".join(x for x in parts[1:] if x)
                    p = places.setdefault(k, [0, e[0], e[1]])
                    p[0] += 1
            top = sorted(places.items(), key=lambda kv: -kv[1][0])[:8]
            out.append({"id": st["id"], "title": st["title"], "total": d["counts"][tipo],
                        "top": [{"lugar": k, "n": v[0], "lon": v[1], "lat": v[2]} for k, v in top]})
        _CMP[tipo] = {"tipo": tipo, "label": TYPES[tipo], "events": out, "kind": "calculado",
                      "method": "Conteo de registros SINPAD/DesInventar del tipo dentro de cada período oficial (ICEN), agrupados por lugar publicado.",
                      "provenance": registry.provenance("indeci_sinpad", "desinventar_per")}
    return _CMP[tipo]

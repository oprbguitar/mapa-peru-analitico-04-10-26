"""Consola de conexiones (plan maestro §3): una ficha por servicio, solo para la administración.

Cada ficha: finalidad, dirección (sin secretos), autenticación («configurada / sin clave», nunca el valor), quién la usa,
frecuencia, límites, estado operativo, última sincronización y respaldo local cuando falla. También declara qué motor
calcula, qué componente interpreta (JEV) y quién explica, y qué fuentes usa cada simulación.
"""
from __future__ import annotations

import time
import urllib.parse
import urllib.request

from . import config, jev, simulation
from .live.worker import WORKERS
from .sources import registry
from .sources.catalog import SOURCES

CATEGORIES = {"meteorologia": "Meteorología", "geoespacial": "Geoespacial y mapas base", "trafico": "Tráfico y vías",
              "transporte": "Transporte en vivo", "riesgo": "Riesgo y emergencias", "seguridad": "Seguridad ciudadana",
              "servicios": "Servicios e instituciones", "camaras": "Cámaras y visión", "ia": "Modelos e IA", "interno": "Derivados internos"}
RULES = [
    ("camaras", ("vision", "go2rtc", "mapillary")),
    ("transporte", ("adsb", "airplanes", "ais", "celestrak", "puertos")),
    ("trafico", ("tomtom", "mtc_", "osrm")),
    ("meteorologia", ("senamhi", "gfs", "ecmwf", "meteo", "metno", "weather", "visualcrossing", "tomorrow", "noaa", "gibs")),
    ("riesgo", ("sismo", "eonet", "firms", "indeci", "desinventar", "ingemmet", "igp_", "enfen", "gdelt", "eventos")),
    ("seguridad", ("mininter", "mpfn", "devida", "indice_")),
    ("servicios", ("renipress", "osm_servicios", "osm_instituciones", "osiptel", "osm_telecom", "datacenters")),
    ("geoespacial", ("limites", "openfreemap", "esri", "eox", "topo", "terrain", "ign_", "nominatim", "earth_search", "inei")),
]
# qué simulación usa qué fuente (para mostrar al administrador; las reglas de reparto no cambian)
SIM_SOURCES = {
    "Tiempo de llegada (S1+S2+S9)": ["renipress", "osm_servicios", "osm_instituciones"],
    "Capacidad (S3)": ["renipress", "osm_servicios", "osm_instituciones"],
    "Operativo (ejercicio de mesa)": [],
}
EXTRA = [  # conexiones propias que no son fuentes de datos del catálogo
    {"id": "ollama", "name": "Ollama (modelos locales)", "category": "ia", "purpose": "Explicar resultados con un modelo local",
     "setting_url": "ollama_url", "secret": None},
    {"id": "external_ai", "name": "API de IA externa", "category": "ia", "purpose": "Explicar resultados con un proveedor externo autorizado",
     "setting_url": "external_base_url", "secret": "external_api_key"},
    {"id": "jev_external", "name": "JEV externo", "category": "ia", "purpose": "Evaluar resultados con el JEV original cuando se audite (contrato v1)",
     "setting_url": "jev_url", "secret": None},
    {"id": "go2rtc", "name": "go2rtc (video en vivo)", "category": "camaras", "purpose": "Puente RTSP → WebRTC para cámaras",
     "setting_url": "go2rtc_url", "secret": None},
]


def _category(sid: str, kind: str) -> str:
    if kind == "derivado":
        return "interno"
    return next((c for c, keys in RULES if any(k in sid for k in keys)), "servicios")


def _host(url: str | None) -> str | None:
    if not url:
        return None
    p = urllib.parse.urlparse(url)
    return f"{p.scheme}://{p.netloc}" if p.netloc else None   # nunca la ruta ni la consulta: pueden llevar claves


def cards() -> dict:
    manifest = registry.read_manifest()
    by_source = {w.source_id: w for w in WORKERS.values()}
    used_by = {}
    for sim, ids in SIM_SOURCES.items():
        for sid in ids:
            used_by.setdefault(sid, []).append(sim)
    out = []
    for s in SOURCES:
        sid = s["source_id"]
        m = manifest.get(sid, {})
        w = by_source.get(sid)
        st = w.status() if w else None
        key = s.get("requires_key")
        status = st["status"] if st else ("descargado" if m.get("last_downloaded") else "sin_descargar" if s.get("download") else "a_demanda")
        if key and not config.setting(key):
            status = "sin_configurar"
        out.append({
            "id": sid, "name": s["name"], "institution": s["institution"], "category": _category(sid, s.get("type", "")),
            "purpose": s.get("notes") or f"{s.get('type', 'fuente')} · nivel {s.get('geographic_level') or '—'}",
            "address": _host(s.get("download") or s.get("url")), "kind": s.get("kind"), "official": bool(s.get("official")),
            "auth": {"required": bool(key), "configured": bool(config.setting(key)) if key else None, "setting": key},
            "frequency": s.get("update_frequency"), "license": s.get("license"),
            "limits": {"refresh_s": w.interval, "stale_after_s": w.stale_after} if w else None,
            "status": status, "error": st.get("error") if st else None,
            "last_sync": (time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(st["updated"])) if st and st.get("updated") else m.get("last_downloaded")),
            "fallback": "Muestra la última copia local con su antigüedad" if w else "Datos locales ya descargados" if m.get("last_downloaded") else None,
            "used_by": used_by.get(sid, []) + (["Capa en vivo del mapa"] if w else []),
            "live": bool(w), "active": bool(st and st.get("active")),
        })
    for e in EXTRA:
        url = config.setting(e["setting_url"])
        out.append({"id": e["id"], "name": e["name"], "institution": "Configuración local", "category": e["category"], "purpose": e["purpose"],
                    "address": _host(url), "kind": "configuracion", "official": False,
                    "auth": {"required": bool(e["secret"]), "configured": bool(config.setting(e["secret"])) if e["secret"] else None, "setting": e["secret"]},
                    "frequency": "a demanda", "license": None, "limits": None,
                    "status": "configurado" if url else "sin_configurar", "error": None, "last_sync": None,
                    "fallback": "jev-ref (reglas locales)" if e["id"] == "jev_external" else "Las funciones esenciales siguen sin este servicio",
                    "used_by": [], "live": False, "active": bool(url), "setting_url": e["setting_url"]})
    counts = {}
    for c in out:
        counts[c["status"]] = counts.get(c["status"], 0) + 1
    return {"cards": out, "categories": CATEGORIES, "counts": counts, "components": components(), "simulations": SIM_SOURCES}


def components() -> dict:
    """Quién hace qué: el motor calcula, JEV interpreta, el asistente explica y la persona decide."""
    return {
        "calculo": {"label": "Motor de cálculo", "value": "Motores de simulación locales (S1, S2, S3, S9, operativo)",
                    "where": "solo esta PC" if simulation.is_local() else "no disponible en la nube"},
        "interpretacion": {"label": "Interpretación (JEV)", "value": jev.engine_name(), "setting": "jev_url",
                           "note": "Vacío = jev-ref (reglas locales). Con URL, se usa el JEV externo si cumple el contrato v1."},
        "explicacion": {"label": "Explicación en lenguaje natural", "value": "Asistente de IA según la consola «IA» (modo, proveedor, presupuesto)",
                        "note": "Explica hechos numerados y pasa por el verificador; no calcula cifras."},
        "decision": {"label": "Decisión", "value": "Persona responsable", "note": "Ningún componente toma decisiones operativas."},
    }


def test(cid: str) -> dict:
    """Prueba una conexión: refresca la capa en vivo o consulta la dirección pública (HEAD, 6 s). Nunca envía claves."""
    w = next((x for x in WORKERS.values() if x.source_id == cid), None)
    t0 = time.monotonic()
    if w:
        w.demand()
        st = w.status()
        return {"id": cid, "ok": st["status"] in ("ok", "esperando"), "status": st["status"], "error": st.get("error"),
                "ms": round((time.monotonic() - t0) * 1000)}
    card = next((c for c in cards()["cards"] if c["id"] == cid), None)
    if not card:
        raise ValueError("conexión no encontrada")
    url = card["address"]
    if not url:
        return {"id": cid, "ok": False, "status": "sin_direccion", "error": "Sin dirección configurada", "ms": 0}
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "MapaPeruAnalitico/consola"})
        with urllib.request.urlopen(req, timeout=6) as r:
            code = r.status
        return {"id": cid, "ok": code < 500, "status": f"HTTP {code}", "error": None, "ms": round((time.monotonic() - t0) * 1000)}
    except Exception as e:  # noqa: BLE001 - se informa cualquier fallo de red como dato
        code = getattr(e, "code", None)
        ok = bool(code and code < 500)   # 401/403/405 = el servicio responde aunque exija autenticación o no acepte HEAD
        return {"id": cid, "ok": ok, "status": f"HTTP {code}" if code else "sin respuesta", "error": None if ok else str(e)[:160],
                "ms": round((time.monotonic() - t0) * 1000)}

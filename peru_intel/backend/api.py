"""API v1 — contratos estables (solo lectura salvo /settings y /ai/ask).

Route 360 (u otro sistema) podrá consultar /api/v1/intel/*; este sistema nunca escribe en Route 360.
Cada respuesta con cifras incluye `provenance` (quién lo publicó, período, nivel, transformación, descarga).
"""
from __future__ import annotations

import json
import time

from .. import config
from ..ai import agents, router
from ..analytics import crime, forecast, index, observatory
from ..climate import enso
from ..vision import cameras as vcams
from ..vision import device as vdev
from ..vision import discovery as vdisc
from ..vision import events as vevents
from ..live import adsb, celestrak, firms, seismic, weather
from ..live import ais as ais_live
from ..live.traffic import PROVIDER as TRAFFIC
from ..live.worker import WORKERS, all_status
from ..map import basemaps, territory
from ..weather import combine as wx_combine
from ..weather import overlays as wx_overlays
from ..weather import providers as wx_providers
from ..map.ruc360_adapter import ADAPTER
from ..sources import registry
from ..storage import sqlite_store


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _one(q: dict, k: str, default=None):
    v = q.get(k)
    return (v[0] if isinstance(v, list) else v) if v else default


def _int(q, k, default=None):
    v = _one(q, k)
    try:
        return int(v) if v not in (None, "") else default
    except ValueError:
        raise ApiError(400, f"{k} debe ser entero")


def _live(name: str) -> dict:
    w = WORKERS[name]
    snap = w.demand()
    meta = registry.provenance(w.source_id)
    return snap | {"provenance": meta}


# ── rutas GET ───────────────────────────────────────────────────────────────
def route_get(path: str, q: dict):
    parts = [p for p in path.split("/") if p]
    # /api/v1/...
    if parts[:2] != ["api", "v1"]:
        raise ApiError(404, "ruta no encontrada")
    p = parts[2:]
    if p == ["health"]:
        return {"ok": True, "time": time.time(), "version": __import__("peru_intel").__version__}
    if p == ["meta", "sources"]:
        registry.sync()
        return {"sources": registry.all_sources(), "kinds": KINDS}
    if p == ["meta", "status"]:
        return {"live": all_status(), "ai": router.status(), "traffic": {"configured": TRAFFIC.configured()},
                "layers": ADAPTER.get_available_layers(), "data": _data_status()}
    if p == ["meta", "settings"]:
        return _settings_public()
    if p == ["map", "base"]:
        return ADAPTER.load_base_map()
    if p[:2] == ["map", "resolve"]:
        lat, lon = float(_one(q, "lat")), float(_one(q, "lon"))
        return ADAPTER.resolve_coordinates(lat, lon) or {"found": False}
    if p == ["map", "basemaps"]:
        return {"layers": basemaps.catalog(), "provenance": registry.provenance("esri_imagery", "eox_sentinel", "opentopomap",
                                                                               "terrain_tiles", "ign_carta")}
    if p[:2] == ["map", "search"]:
        return {"results": ADAPTER.resolve_ubigeo(_one(q, "q", ""))}
    if p[:1] != ["intel"]:
        raise ApiError(404, "ruta no encontrada")
    p = p[1:]
    if p == ["crime", "families"]:
        return {"families": crime.FAMILIES, "sidpol": crime.sidpol_extent(), "indicators": _indicator_list()}
    if p == ["crime", "choropleth"]:
        ds = _one(q, "dataset", "sidpol")
        level = _one(q, "level", "departamento")
        if ds == "sidpol":
            return crime.sidpol_choropleth(level, _int(q, "year"), _one(q, "months"), _one(q, "modalidad"),
                                          _int(q, "compare"))
        if ds == "indicador":
            return crime.indicator_choropleth(_int(q, "code", 10), level, _int(q, "year"))
        if ds == "mpfn":
            return crime.mpfn_choropleth(_int(q, "year"), _one(q, "tid") == "1", _one(q, "generico"))
        if ds == "devida":
            return crime.devida_choropleth(_one(q, "indicador", "coca_ha"), _int(q, "year"))
        if ds == "indice":
            return _index_choropleth()
        raise ApiError(400, "dataset desconocido")
    if len(p) == 3 and p[0] == "regions" and p[2] == "crime":
        return crime.region_profile(p[1], _int(q, "year"), _one(q, "months")) | {"index": index.for_region(p[1]) if len(p[1]) == 2 else None}
    if len(p) == 3 and p[0] == "regions" and p[2] == "forecast":
        return forecast.forecast(p[1] if p[1] != "PE" else None, _one(q, "modalidad"))
    if p == ["index"]:
        return index.compute()
    if p == ["history"]:
        return {"series": crime.monthly_series(_one(q, "ubigeo"), _one(q, "modalidad")),
                "provenance": registry.provenance("mininter_sidpol")}
    if len(p) == 2 and p[0] == "observatory":
        try:
            return observatory.observatory(p[1], _one(q, "modalidad"))
        except ValueError as e:
            raise ApiError(400, str(e))
    if p == ["institutions"]:
        return _institutions(_one(q, "cat"), _one(q, "ubigeo"))
    if p == ["enso"]:
        return enso.overview()
    if p == ["ocean"]:
        return _live("ocean") | {"provenance": registry.provenance("openmeteo_marine", "noaa_cpc_semanal")}
    if p == ["weather", "grid"]:
        return _live("wxgrid") | {"provenance": registry.provenance("openmeteo")}
    if p[:1] == ["vision"]:
        return _vision_get(p[1:], q)
    if p == ["flights"]:
        return _live("flights") | {"provenance": registry.provenance("adsb_lol", "airplanes_live", "adsb_fi")}
    if len(p) == 2 and p[0] == "flights":
        return {"details": adsb.details(_one(q, "callsign", ""), p[1]), "track": adsb.track(p[1])}
    if p == ["vessels"]:
        return _live("vessels")
    if p == ["ports"]:
        return _static("puertos.json", "apn_wpi_puertos") | {"vessels": _port_vessels()}
    if p == ["datacenters"]:
        return _static("datacenters.json", "osm_datacenters")
    if p == ["satellites"]:
        g = _one(q, "group", "stations")
        try:
            return celestrak.group(g) | {"groups": celestrak.GROUPS, "provenance": registry.provenance("celestrak")}
        except ValueError as e:
            raise ApiError(400, str(e))
    if p == ["seismic"]:
        return _live("seismic") | {"provenance": registry.provenance("igp_sismos", "usgs_sismos")}
    if p == ["fires"]:
        return _live("fires")
    if p == ["weather"]:
        models = _live("weather_models")
        obs = _live("weather_obs")
        return {"observed": obs, "models": models,
                "provenance": registry.provenance("senamhi_estaciones", "modelo_gfs", "modelo_ecmwf")}
    if p == ["weather", "point"]:
        try:
            lat, lon = float(_one(q, "lat")), float(_one(q, "lon"))
        except (TypeError, ValueError):
            raise ApiError(400, "lat y lon numéricos")
        prov = [x for x in (_one(q, "providers") or "").split(",") if x] or None
        try:
            return wx_combine.point(lat, lon, prov)
        except ValueError as e:
            raise ApiError(400, str(e))
    if p == ["weather", "providers"]:
        return {"providers": [wx_providers.PROVIDERS[i].describe() for i in wx_providers.PROVIDERS],
                "order": wx_combine.order(), "quota": wx_combine.quota_status()}
    if p == ["weather", "layers"]:
        return wx_overlays.catalog() | {"provenance": registry.provenance("nasa_gibs", "senamhi_idesep")}
    if p == ["traffic"]:
        return {"configured": TRAFFIC.configured(), "provider": TRAFFIC.name, "tiles": "/api/v1/intel/traffic/tiles/{z}/{x}/{y}.png",
                "legend": [["fluido", ">= 85 % de la velocidad libre"], ["medio", "65–85 %"], ["lento", "40–65 %"], ["congestionado", "< 40 %"]],
                "provenance": registry.provenance("tomtom_traffic")}
    if p == ["traffic", "point"]:
        try:
            return TRAFFIC.point(float(_one(q, "lat")), float(_one(q, "lon")))
        except RuntimeError as e:
            raise ApiError(409, str(e))
    if p == ["events"]:
        return {"live": all_status(), "alerts": [dict(r) for r in sqlite_store.connect().execute(
            "SELECT * FROM alerts ORDER BY id DESC LIMIT 100")]}
    if p == ["ai", "status"]:
        return router.status()
    raise ApiError(404, "ruta no encontrada")


def route_post(path: str, body: dict):
    p = [x for x in path.split("/") if x][2:]
    if p == ["intel", "ai", "ask"]:
        ub = str(body.get("ubigeo") or "")
        if len(ub) not in (2, 4, 6) or not ub.isdigit():
            raise ApiError(400, "ubigeo inválido")
        return agents.ask(ub, str(body.get("question") or "")[:500])
    if p == ["intel", "ai", "enso"]:
        return agents.ask_enso(str(body.get("question") or "")[:500])
    if p[:2] == ["intel", "vision"]:
        return _vision_post(p[2:], body)
    if p == ["meta", "settings"]:
        allowed = {"aisstream_key", "tomtom_key", "firms_key", "senamhi_csv_url", "ollama_url", "ollama_model",
                   "external_base_url", "external_api_key", "external_model", "ai_allow_external",
                   "weatherapi_key", "visualcrossing_key", "openweather_key", "tomorrow_key", "weather_order", "go2rtc_url"}
        vals = {k: str(v).strip() for k, v in body.items() if k in allowed and v is not None}
        if not vals:
            raise ApiError(400, "sin ajustes válidos")
        config.save_local_settings(vals)
        sqlite_store.audit("usuario-local", "settings", {"keys": sorted(vals)})
        return _settings_public()
    raise ApiError(404, "ruta no encontrada")


# ── auxiliares ──────────────────────────────────────────────────────────────
KINDS = {
    "oficial": "Dato oficial",
    "vivo_tercero": "Dato en vivo de tercero",
    "calculado": "Dato calculado",
    "estimacion": "Estimación",
    "proyeccion": "Proyección",
    "ia": "Interpretación IA",
}


def _settings_public() -> dict:
    keys = ["aisstream_key", "tomtom_key", "firms_key", "senamhi_csv_url", "external_api_key",
            "weatherapi_key", "visualcrossing_key", "openweather_key", "tomorrow_key"]
    plain = ["ollama_url", "ollama_model", "external_base_url", "external_model", "ai_allow_external", "weather_order", "go2rtc_url"]
    return {"secrets": {k: bool(config.setting(k)) for k in keys}, "values": {k: config.setting(k) for k in plain},
            "stored_in": "data/config.local.json (ignorado por git; nunca se envía al navegador)"}


def _data_status() -> dict:
    from ..storage import warehouse
    return {t: warehouse.has(t) for t in ("sidpol_denuncias", "mininter_indicadores", "poblacion", "mpfn_delitos", "devida")}


def _indicator_list() -> list[dict]:
    from ..storage import warehouse
    if not warehouse.has("indicadores_catalogo"):
        return []
    levels = {r["indicador"]: r["niveles"] for r in warehouse.query(
        "SELECT indicador, list(DISTINCT nivel) niveles FROM mininter_indicadores WHERE nivel <> 'pais' GROUP BY 1")}
    return [r | {"levels": sorted(levels.get(r["codigo"], []), key=crime.LEVELS.index)}
            for r in warehouse.query("SELECT * FROM indicadores_catalogo ORDER BY codigo")]


def _index_choropleth() -> dict:
    ix = index.compute()
    return {"available": True, "dataset": "indice", "level": "departamento", "title": ix["name"] + " (no oficial)",
            "period": {"label": ", ".join(f"{k}: {v}" for k, v in ix["periods"].items()), "partial": False},
            "measures": {"score": {"label": "Puntaje", "unit": "0–100", "kind": "calculado"}},
            "default_measure": "score", "rows": [{"ubigeo": r["ubigeo"], "nombre": r["nombre"], "score": r["score"],
                                                   "rank": r.get("rank"), "coverage": r["coverage"]} for r in ix["regions"]],
            "disclaimer": ix["disclaimer"], "variables": ix["variables"], "spec_sha256": ix["spec_sha256"],
            "provenance": registry.provenance("indice_situacional_v1", "mininter_sidpol", "mininter_indicadores", "inei_poblacion")}


def _static(name: str, source_id: str) -> dict:
    try:
        data = json.loads((config.NORMALIZED / name).read_text(encoding="utf-8"))
    except OSError:
        return {"available": False, "reason": f"Falta data/normalized/{name} (python -m peru_intel ingest ports)"}
    if isinstance(data, list):
        data = {"items": data}
    return data | {"available": True, "provenance": registry.provenance(source_id)}


def _port_vessels() -> dict:
    """Barcos AIS cerca de cada puerto (si la capa AIS está activa): aproximándose / saliendo / cercanos."""
    w = WORKERS["vessels"]
    if not w.configured() or not w.data:
        return {"available": False, "reason": "AIS sin clave o sin datos recientes"}
    try:
        ports = json.loads((config.NORMALIZED / "puertos.json").read_text(encoding="utf-8"))["ports"]
    except (OSError, ValueError, KeyError):
        return {"available": False}
    out = {}
    for port in ports:
        near = [v for v in w.data.get("items", []) if abs(v["lat"] - port["lat"]) < 0.5 and abs(v["lon"] - port["lon"]) < 0.5]
        dest_match = [v for v in w.data.get("items", []) if port.get("locode") and port["locode"] in (v.get("destination") or "").upper()]
        out[port["locode"] or port["name"]] = {"near": len(near), "declared_destination": len(dest_match)}
    return {"available": True, "by_port": out}


def _institutions(cat: str | None, ubigeo: str | None) -> dict:
    data = _static("instituciones.json", "osm_instituciones")
    if not data.get("available"):
        data["reason"] = "Falta data/normalized/instituciones.json (python -m peru_intel ingest instituciones --download)"
        return data
    cats = [c for c in (cat or "").split(",") if c]
    items = [i for i in data["items"] if (not cats or i["cat"] in cats) and (not ubigeo or (i["ubigeo"] or "").startswith(ubigeo))]
    counts = {c: sum(1 for i in items if i["cat"] == c) for c in data["categories"]}
    return data | {"items": items, "counts": counts}


VISION_GUIDE = {
    "dahua": {
        "title": "Dahua DH-XVR5108HS-X (8 canales, H.265/H.264, RTSP, ONVIF, CGI)",
        "steps": [
            "Conecta el XVR al mismo router que esta PC (cable de red al puerto Ethernet).",
            "En el XVR: Menú principal → Red → TCP/IP. Anota la IP (p. ej. 192.168.1.108) o ponla fija.",
            "Red → Puerto: HTTP 80 y RTSP 554 (valores de fábrica). Activa ONVIF y CGI en «Servicios de plataforma» si tu firmware lo muestra.",
            "Crea un usuario solo de vista en vivo (Sistema → Cuenta) para no usar «admin» en este mapa.",
            "Aquí: «Buscar en mi red» o escribe la IP, usuario y contraseña → «Probar conexión».",
            "Ubica cada canal en el mapa con «Ubicar» y haz clic donde está la cámara.",
            "Video fluido (opcional): instala go2rtc, pulsa «Generar go2rtc.yaml» y ejecútalo; el visor lo usará solo.",
        ],
        "rtsp": "rtsp://usuario:clave@IP:554/cam/realmonitor?channel=1&subtype=1  (subtype=0 principal, 1 secundario)",
        "snapshot": "http://IP/cgi-bin/snapshot.cgi?channel=1 (Digest)",
        "vlc": "Prueba rápida: VLC → Medio → Abrir ubicación de red → pega la URL RTSP con tu clave.",
    },
    "privacy": "Ley N.° 29733: coloca avisos de videovigilancia, no captes espacios privados de terceros y no compartas grabaciones. "
               "Este sistema no hace reconocimiento facial ni identifica personas.",
    "go2rtc": "https://github.com/AlexxIT/go2rtc/releases",
}


def _vision_get(p: list[str], q: dict) -> dict:
    if p == ["cameras"]:
        cams = vcams.list_public()
        for c in cams:
            full = vcams.get(c["id"])
            c["rtsp"] = [{"ch": ch["ch"], "main": vdev.rtsp_url(full, ch["ch"], sub=False), "sub": vdev.rtsp_url(full, ch["ch"])}
                         for ch in c["channels"]]
        return {"cameras": cams, "features": vcams.as_features(), "guide": VISION_GUIDE, "go2rtc": vdev.go2rtc_status(),
                "provenance": registry.provenance("vision_edge")}
    if p == ["discover"]:
        return {"devices": vdisc.discover()}
    if p == ["events"]:
        return vevents.summary(_int(q, "minutes", 60))
    raise ApiError(404, "ruta no encontrada")


def _vision_post(p: list[str], body: dict) -> dict:
    try:
        if p == ["cameras"]:
            cam = vcams.upsert(body)
            sqlite_store.audit("usuario-local", "vision.camera.upsert", {"id": cam["id"], "host": cam["host"]})
            return {"camera": cam}
        if p == ["cameras", "delete"]:
            ok = vcams.remove(str(body.get("id") or ""))
            sqlite_store.audit("usuario-local", "vision.camera.delete", {"id": body.get("id")})
            return {"deleted": ok}
        if p == ["probe"]:
            existing = vcams.get(str(body.get("id"))) if body.get("id") else None
            cam = vcams.normalize(body, existing)
            res = vdev.probe(cam)
            dev = res["device"]
            if existing and res["ok"] and (dev.get("channels") or dev.get("model")):  # guarda modelo y nombres de canal leídos
                titles = {c["ch"]: c["name"] for c in dev.get("channels") or []}
                chans = [ch | ({"name": titles[ch["ch"]]} if ch["ch"] in titles and ch["name"].startswith("Canal") else {})
                         for ch in existing["channels"]]
                vcams.upsert({"id": existing["id"], "model": dev.get("model") or existing.get("model"), "channels": chans})
            return res
        if p == ["go2rtc"]:
            cams = [vcams.get(c["id"]) for c in vcams.list_public()]
            out = config.DATA / "vision" / "go2rtc.yaml"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(vdev.go2rtc_yaml(cams), encoding="utf-8")
            return {"path": str(out), "streams": sum(1 for c in cams for ch in c["channels"] if ch["enabled"]),
                    "run": f'go2rtc.exe -config "{out}"', "note": "El archivo contiene tus credenciales; queda solo en esta PC."}
        if p == ["events"]:
            return vevents.ingest(body)
    except vcams.CameraError as e:
        raise ApiError(400, str(e))
    except PermissionError as e:
        raise ApiError(403, str(e))
    raise ApiError(404, "ruta no encontrada")


def vision_snapshot(cam_id: str, ch: int) -> tuple[bytes, str]:
    cam = vcams.get(cam_id)
    if not cam or not any(c["ch"] == ch for c in cam["channels"]):
        raise ApiError(404, "cámara o canal no registrado")
    try:
        return vdev.snapshot(cam, ch)
    except (RuntimeError, OSError) as e:
        raise ApiError(502, str(e))


def boundaries(level: str) -> bytes | None:
    if level not in territory.LEVELS:
        return None
    p = territory.BOUNDARIES / f"{level}.geojson"
    return p.read_bytes() if p.exists() else None


# referencias para que el linter no marque imports usados solo por los workers
_ = (firms, seismic, weather, ais_live)

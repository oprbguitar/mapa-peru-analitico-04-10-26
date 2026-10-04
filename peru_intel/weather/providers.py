"""Proveedores meteorológicos por punto (cualquier coordenada del mundo).

Cada proveedor devuelve el MISMO esquema normalizado, para poder compararlos lado a lado sin mezclarlos:

    temp_c, feels_c, rh_pct, precip_mm, pressure_hpa, cloud_pct, wind_kmh, gust_kmh, wind_deg,
    visibility_km, uv, condition, observed_at, model

Orden por defecto (configurable con `weather_order`):
  1 Open-Meteo      sin clave · 10 000 llamadas/día (uso no comercial) · modelo (best match / ECMWF / GFS)
  2 MET Norway      sin clave · exige User-Agent identificable · CC BY 4.0 · pronóstico (primer paso)
  3 WeatherAPI.com  clave · 100 000/mes · observación + modelos
  4 Visual Crossing clave · 1 000 registros/día
  5 OpenWeather     clave · 1 000/día (Current Weather 2.5)
  6 Tomorrow.io     clave · plan gratuito
  SENAMHI           estación oficial más cercana (solo Perú, si se configuró el CSV de estaciones)

Las funciones `parse_*` son puras (sin red) y tienen pruebas con respuestas de ejemplo.
"""
from __future__ import annotations

import json
import math
import urllib.parse

from .. import config
from ..sources.harvester import http_get

WMO = {0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado", 45: "Niebla", 48: "Niebla con escarcha",
       51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna intensa", 56: "Llovizna helada", 57: "Llovizna helada intensa",
       61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia intensa", 66: "Lluvia helada", 67: "Lluvia helada intensa",
       71: "Nevada ligera", 73: "Nevada", 75: "Nevada intensa", 77: "Granizo fino", 80: "Chubascos ligeros", 81: "Chubascos",
       82: "Chubascos violentos", 85: "Chubascos de nieve", 86: "Chubascos de nieve intensos", 95: "Tormenta",
       96: "Tormenta con granizo", 99: "Tormenta con granizo intenso"}
METNO = {"clearsky": "Despejado", "fair": "Mayormente despejado", "partlycloudy": "Parcialmente nublado", "cloudy": "Nublado",
         "fog": "Niebla", "lightrain": "Lluvia ligera", "rain": "Lluvia", "heavyrain": "Lluvia intensa",
         "lightrainshowers": "Chubascos ligeros", "rainshowers": "Chubascos", "heavyrainshowers": "Chubascos intensos",
         "lightsnow": "Nevada ligera", "snow": "Nevada", "heavysnow": "Nevada intensa", "sleet": "Aguanieve",
         "rainandthunder": "Lluvia con tormenta", "heavyrainandthunder": "Lluvia intensa con tormenta",
         "lightrainshowersandthunder": "Chubascos con tormenta"}
TOMORROW = {1000: "Despejado", 1100: "Mayormente despejado", 1101: "Parcialmente nublado", 1102: "Mayormente nublado",
            1001: "Nublado", 2000: "Niebla", 2100: "Niebla ligera", 4000: "Llovizna", 4001: "Lluvia", 4200: "Lluvia ligera",
            4201: "Lluvia intensa", 5000: "Nieve", 5001: "Ráfagas de nieve", 5100: "Nieve ligera", 5101: "Nieve intensa",
            6000: "Llovizna helada", 6001: "Lluvia helada", 7000: "Granizo", 8000: "Tormenta"}

FIELDS = ("temp_c", "feels_c", "rh_pct", "precip_mm", "pressure_hpa", "cloud_pct", "wind_kmh", "gust_kmh", "wind_deg",
          "visibility_km", "uv", "condition", "observed_at", "model")


def _r(v, nd=1):
    return None if v is None else round(float(v), nd)


def _ms_to_kmh(v):
    return None if v is None else round(float(v) * 3.6, 1)


def _norm(**kw) -> dict:
    return {k: kw.get(k) for k in FIELDS}


# ── parsers puros ───────────────────────────────────────────────────────────
def parse_openmeteo(d: dict) -> dict:
    c = d.get("current", {})
    vis = c.get("visibility")
    return _norm(temp_c=_r(c.get("temperature_2m")), feels_c=_r(c.get("apparent_temperature")), rh_pct=_r(c.get("relative_humidity_2m"), 0),
                 precip_mm=_r(c.get("precipitation")), pressure_hpa=_r(c.get("pressure_msl"), 0), cloud_pct=_r(c.get("cloud_cover"), 0),
                 wind_kmh=_r(c.get("wind_speed_10m")), gust_kmh=_r(c.get("wind_gusts_10m")), wind_deg=_r(c.get("wind_direction_10m"), 0),
                 visibility_km=_r(vis / 1000) if vis is not None else None, uv=_r(c.get("uv_index")),
                 condition=WMO.get(c.get("weather_code")), observed_at=c.get("time"), model="best match (Open-Meteo)")


def parse_metno(d: dict) -> dict:
    ts = (d.get("properties", {}).get("timeseries") or [{}])[0]
    det = ts.get("data", {}).get("instant", {}).get("details", {})
    nxt = ts.get("data", {}).get("next_1_hours", {})
    sym = (nxt.get("summary", {}).get("symbol_code") or "").split("_")[0]
    return _norm(temp_c=_r(det.get("air_temperature")), rh_pct=_r(det.get("relative_humidity"), 0),
                 precip_mm=_r(nxt.get("details", {}).get("precipitation_amount")), pressure_hpa=_r(det.get("air_pressure_at_sea_level"), 0),
                 cloud_pct=_r(det.get("cloud_area_fraction"), 0), wind_kmh=_ms_to_kmh(det.get("wind_speed")),
                 gust_kmh=_ms_to_kmh(det.get("wind_speed_of_gust")), wind_deg=_r(det.get("wind_from_direction"), 0),
                 uv=_r(det.get("ultraviolet_index_clear_sky")), condition=METNO.get(sym, sym or None), observed_at=ts.get("time"),
                 model="Locationforecast 2.0 (MET Norway)")


def parse_weatherapi(d: dict) -> dict:
    c = d.get("current", {})
    return _norm(temp_c=_r(c.get("temp_c")), feels_c=_r(c.get("feelslike_c")), rh_pct=_r(c.get("humidity"), 0), precip_mm=_r(c.get("precip_mm")),
                 pressure_hpa=_r(c.get("pressure_mb"), 0), cloud_pct=_r(c.get("cloud"), 0), wind_kmh=_r(c.get("wind_kph")),
                 gust_kmh=_r(c.get("gust_kph")), wind_deg=_r(c.get("wind_degree"), 0), visibility_km=_r(c.get("vis_km")), uv=_r(c.get("uv")),
                 condition=(c.get("condition") or {}).get("text"), observed_at=c.get("last_updated"), model="WeatherAPI.com (mezcla obs.+modelos)")


def parse_visualcrossing(d: dict) -> dict:
    c = d.get("currentConditions", {})
    return _norm(temp_c=_r(c.get("temp")), feels_c=_r(c.get("feelslike")), rh_pct=_r(c.get("humidity"), 0), precip_mm=_r(c.get("precip")),
                 pressure_hpa=_r(c.get("pressure"), 0), cloud_pct=_r(c.get("cloudcover"), 0), wind_kmh=_r(c.get("windspeed")),
                 gust_kmh=_r(c.get("windgust")), wind_deg=_r(c.get("winddir"), 0), visibility_km=_r(c.get("visibility")), uv=_r(c.get("uvindex")),
                 condition=c.get("conditions"), observed_at=c.get("datetime"), model="Visual Crossing Timeline")


def parse_openweather(d: dict) -> dict:
    m, w = d.get("main", {}), d.get("wind", {})
    rain = (d.get("rain") or {}).get("1h")
    vis = d.get("visibility")
    return _norm(temp_c=_r(m.get("temp")), feels_c=_r(m.get("feels_like")), rh_pct=_r(m.get("humidity"), 0), precip_mm=_r(rain),
                 pressure_hpa=_r(m.get("pressure"), 0), cloud_pct=_r((d.get("clouds") or {}).get("all"), 0), wind_kmh=_ms_to_kmh(w.get("speed")),
                 gust_kmh=_ms_to_kmh(w.get("gust")), wind_deg=_r(w.get("deg"), 0), visibility_km=_r(vis / 1000) if vis is not None else None,
                 condition=((d.get("weather") or [{}])[0]).get("description"), observed_at=d.get("dt"), model="OpenWeather Current 2.5")


def parse_tomorrow(d: dict) -> dict:
    v = d.get("data", {}).get("values", {})
    return _norm(temp_c=_r(v.get("temperature")), feels_c=_r(v.get("temperatureApparent")), rh_pct=_r(v.get("humidity"), 0),
                 precip_mm=_r(v.get("precipitationIntensity")), pressure_hpa=_r(v.get("pressureSeaLevel"), 0), cloud_pct=_r(v.get("cloudCover"), 0),
                 wind_kmh=_ms_to_kmh(v.get("windSpeed")), gust_kmh=_ms_to_kmh(v.get("windGust")), wind_deg=_r(v.get("windDirection"), 0),
                 visibility_km=_r(v.get("visibility")), uv=_r(v.get("uvIndex")), condition=TOMORROW.get(v.get("weatherCode")),
                 observed_at=d.get("data", {}).get("time"), model="Tomorrow.io realtime")


# ── proveedores ─────────────────────────────────────────────────────────────
class Provider:
    id = ""
    label = ""
    source_id = ""
    kind = "vivo_tercero"
    key_setting: str | None = None
    daily_quota = 1000
    attribution = ""

    def configured(self) -> bool:
        return not self.key_setting or bool(config.setting(self.key_setting))

    def key(self) -> str:
        return config.setting(self.key_setting) if self.key_setting else ""

    def fetch(self, lat: float, lon: float) -> dict:
        raise NotImplementedError

    def describe(self) -> dict:
        return {"id": self.id, "label": self.label, "kind": self.kind, "requires": self.key_setting, "configured": self.configured(),
                "daily_quota": self.daily_quota, "attribution": self.attribution, "source_id": self.source_id}


def _get_json(url: str, **kw) -> dict:
    return json.loads(http_get(url, timeout=15, retries=1, min_interval=0.2, **kw))


class OpenMeteo(Provider):
    id, label, source_id, kind = "openmeteo", "Open-Meteo", "openmeteo", "proyeccion"
    daily_quota, attribution = 9000, "Open-Meteo.com (CC BY 4.0)"
    CURRENT = ("temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,pressure_msl,cloud_cover,wind_speed_10m,"
               "wind_gusts_10m,wind_direction_10m,visibility,uv_index,weather_code")

    def fetch(self, lat, lon):
        d = _get_json(f"https://api.open-meteo.com/v1/forecast?latitude={lat:.4f}&longitude={lon:.4f}&current={self.CURRENT}"
                      "&hourly=temperature_2m,precipitation_probability,precipitation&forecast_hours=24&timezone=auto")
        out = parse_openmeteo(d)
        h = d.get("hourly", {})
        out["next24"] = [{"time": t, "temp_c": tc, "precip_mm": p, "precip_prob": pp} for t, tc, p, pp in
                         zip(h.get("time", []), h.get("temperature_2m", []), h.get("precipitation", []), h.get("precipitation_probability", []))]
        out["elevation_m"] = d.get("elevation")
        return out


class MetNorway(Provider):
    id, label, source_id, kind = "metno", "MET Norway", "metno", "proyeccion"
    daily_quota, attribution = 5000, "MET Norway (CC BY 4.0)"

    def fetch(self, lat, lon):
        # términos de MET: coordenadas con máx. 4 decimales y User-Agent identificable (config.USER_AGENT)
        return parse_metno(_get_json(f"https://api.met.no/weatherapi/locationforecast/2.0/compact?lat={lat:.4f}&lon={lon:.4f}"))


class WeatherApi(Provider):
    id, label, source_id = "weatherapi", "WeatherAPI.com", "weatherapi"
    key_setting, daily_quota, attribution = "weatherapi_key", 3000, "WeatherAPI.com"

    def fetch(self, lat, lon):
        q = urllib.parse.urlencode({"key": self.key(), "q": f"{lat:.4f},{lon:.4f}", "lang": "es"})
        return parse_weatherapi(_get_json(f"https://api.weatherapi.com/v1/current.json?{q}"))


class VisualCrossing(Provider):
    id, label, source_id = "visualcrossing", "Visual Crossing", "visualcrossing"
    key_setting, daily_quota, attribution = "visualcrossing_key", 900, "Visual Crossing Weather"

    def fetch(self, lat, lon):
        q = urllib.parse.urlencode({"key": self.key(), "unitGroup": "metric", "include": "current", "lang": "es", "contentType": "json"})
        return parse_visualcrossing(_get_json(
            f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{lat:.4f},{lon:.4f}?{q}"))


class OpenWeather(Provider):
    id, label, source_id = "openweather", "OpenWeather", "openweather"
    key_setting, daily_quota, attribution = "openweather_key", 900, "OpenWeather"

    def fetch(self, lat, lon):
        q = urllib.parse.urlencode({"lat": f"{lat:.4f}", "lon": f"{lon:.4f}", "appid": self.key(), "units": "metric", "lang": "es"})
        return parse_openweather(_get_json(f"https://api.openweathermap.org/data/2.5/weather?{q}"))


class TomorrowIo(Provider):
    id, label, source_id = "tomorrow", "Tomorrow.io", "tomorrowio"
    key_setting, daily_quota, attribution = "tomorrow_key", 450, "Tomorrow.io"

    def fetch(self, lat, lon):
        q = urllib.parse.urlencode({"location": f"{lat:.4f},{lon:.4f}", "units": "metric", "apikey": self.key()})
        return parse_tomorrow(_get_json(f"https://api.tomorrow.io/v4/weather/realtime?{q}"))


class SenamhiNearest(Provider):
    """Estación SENAMHI más cercana (dato observado oficial), desde el worker de estaciones configurado."""
    id, label, source_id, kind = "senamhi", "SENAMHI (estación)", "senamhi_estaciones", "oficial"
    key_setting, daily_quota, attribution = "senamhi_csv_url", 100000, "SENAMHI"
    MAX_KM = 60

    def fetch(self, lat, lon):
        from ..live.weather import SENAMHI_WORKER
        snap = SENAMHI_WORKER.demand()
        items = (snap.get("data") or {}).get("items") or []
        if not items:
            raise RuntimeError("sin observaciones SENAMHI cargadas todavía")
        best = min(items, key=lambda s: _km(lat, lon, s["lat"], s["lon"]))
        dist = _km(lat, lon, best["lat"], best["lon"])
        if dist > self.MAX_KM:
            raise RuntimeError(f"la estación más cercana está a {dist:.0f} km (límite {self.MAX_KM} km)")
        out = _norm(temp_c=best.get("temp_c"), rh_pct=best.get("rh_pct"), precip_mm=best.get("precip_mm"),
                    observed_at=best.get("time"), model=f"Estación {best['station']}")
        out["station_km"] = round(dist, 1)
        return out


def _km(la1, lo1, la2, lo2):
    p = math.pi / 180
    a = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


PROVIDERS: dict[str, Provider] = {p.id: p for p in (OpenMeteo(), MetNorway(), WeatherApi(), VisualCrossing(), OpenWeather(),
                                                     TomorrowIo(), SenamhiNearest())}
DEFAULT_ORDER = ["openmeteo", "metno", "weatherapi", "visualcrossing", "openweather", "tomorrow"]

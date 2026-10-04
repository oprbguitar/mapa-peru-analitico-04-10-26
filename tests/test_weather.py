"""Normalización de proveedores meteorológicos y combinación (sin red).

Open-Meteo y MET Norway: estructura tomada de respuestas reales (2026-10-04).
WeatherAPI, Visual Crossing, OpenWeather y Tomorrow.io: estructura según su documentación pública
(no se probaron con clave en esta sesión).
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from peru_intel.weather import combine, overlays, providers as p  # noqa: E402


class ParseTest(unittest.TestCase):
    def test_openmeteo(self):
        d = p.parse_openmeteo({"current": {"time": "2026-10-04T15:45", "temperature_2m": 21.5, "apparent_temperature": 15.9,
                                           "relative_humidity_2m": 12, "precipitation": 0.0, "pressure_msl": 1009.2, "cloud_cover": 13,
                                           "wind_speed_10m": 16.7, "wind_gusts_10m": 49.0, "wind_direction_10m": 187,
                                           "visibility": 44900, "uv_index": 3.6, "weather_code": 0}})
        self.assertEqual(d["temp_c"], 21.5)
        self.assertEqual(d["visibility_km"], 44.9)
        self.assertEqual(d["condition"], "Despejado")

    def test_metno_converts_ms_to_kmh(self):
        d = p.parse_metno({"properties": {"timeseries": [{"time": "2026-10-04T15:00:00Z", "data": {
            "instant": {"details": {"air_temperature": 22.4, "relative_humidity": 10, "wind_speed": 4.3, "air_pressure_at_sea_level": 1009,
                                    "cloud_area_fraction": 25, "wind_from_direction": 190}},
            "next_1_hours": {"summary": {"symbol_code": "partlycloudy_day"}, "details": {"precipitation_amount": 0.0}}}}]}})
        self.assertEqual(d["wind_kmh"], 15.5)
        self.assertEqual(d["condition"], "Parcialmente nublado")
        self.assertEqual(d["precip_mm"], 0.0)

    def test_weatherapi(self):
        d = p.parse_weatherapi({"current": {"last_updated": "2026-10-04 15:30", "temp_c": 20.0, "feelslike_c": 19.0, "humidity": 40,
                                            "precip_mm": 0.1, "pressure_mb": 1012, "cloud": 50, "wind_kph": 10.1, "gust_kph": 20.2,
                                            "wind_degree": 90, "vis_km": 10, "uv": 5, "condition": {"text": "Parcialmente nublado"}}})
        self.assertEqual((d["temp_c"], d["wind_kmh"], d["condition"]), (20.0, 10.1, "Parcialmente nublado"))

    def test_openweather_units(self):
        d = p.parse_openweather({"dt": 1791200000, "main": {"temp": 18.2, "feels_like": 17.5, "humidity": 70, "pressure": 1013},
                                 "wind": {"speed": 5, "deg": 200, "gust": 10}, "clouds": {"all": 75}, "visibility": 8000,
                                 "rain": {"1h": 0.4}, "weather": [{"description": "lluvia ligera"}]})
        self.assertEqual((d["wind_kmh"], d["gust_kmh"], d["visibility_km"], d["precip_mm"]), (18.0, 36.0, 8.0, 0.4))

    def test_visualcrossing_and_tomorrow(self):
        v = p.parse_visualcrossing({"currentConditions": {"datetime": "15:00:00", "temp": 25, "humidity": 60, "windspeed": 12,
                                                          "conditions": "Despejado"}})
        self.assertEqual((v["temp_c"], v["wind_kmh"]), (25.0, 12.0))
        t = p.parse_tomorrow({"data": {"time": "2026-10-04T15:00:00Z", "values": {"temperature": 19.4, "windSpeed": 2.5,
                                                                                 "weatherCode": 1001, "visibility": 16}}})
        self.assertEqual((t["temp_c"], t["wind_kmh"], t["condition"]), (19.4, 9.0, "Nublado"))


class CombineTest(unittest.TestCase):
    def test_consensus_uses_only_ok_results(self):
        res = [{"status": "ok", "data": {"temp_c": 20.0, "wind_kmh": 10.0}},
               {"status": "ok", "data": {"temp_c": 22.0, "wind_kmh": None}},
               {"status": "error", "data": {"temp_c": 99.0}}]
        c = combine.consensus(res)
        self.assertEqual(c["temp_c"], {"median": 21.0, "min": 20.0, "max": 22.0, "spread": 2.0, "n": 2})
        self.assertEqual(c["wind_kmh"]["n"], 1)

    def test_in_peru(self):
        self.assertTrue(combine.in_peru(-12.05, -77.04))
        self.assertFalse(combine.in_peru(35.68, 139.69))

    def test_out_of_range_rejected(self):
        with self.assertRaises(ValueError):
            combine.point(95, 0)


class OverlayTest(unittest.TestCase):
    def test_senamhi_tile_outside_peru_is_empty_without_request(self):
        r = overlays.tile("senamhi", "aviso24h", 5, 28, 12)  # Japón
        self.assertEqual(r, (b"", "image/png"))

    def test_unknown_layer_rejected(self):
        self.assertIsNone(overlays.tile("gibs", "no_existe", 3, 1, 1))
        self.assertIsNone(overlays.tile("otro", "x", 3, 1, 1))

    def test_bbox_web_mercator(self):
        x0, y0, x1, y1 = overlays._bbox3857(0, 0, 0)
        self.assertAlmostEqual(x0, -20037508.34, places=1)
        self.assertAlmostEqual(y1, 20037508.34, places=1)


if __name__ == "__main__":
    unittest.main()

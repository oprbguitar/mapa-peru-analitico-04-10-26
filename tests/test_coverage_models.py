"""Cobertura de comisarías, conexiones de modelos y paletas NASA (sin red)."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel import config
from peru_intel.ai import model_keys
from peru_intel.analytics import coverage
from peru_intel.weather import overlays

ITEMS = {"categories": {}, "counts": {}, "items": [
    {"id": "c1", "cat": "comisaria", "name": "Centro", "lat": -12.05, "lon": -77.05, "ubigeo": "150101"},
    {"id": "c1b", "cat": "comisaria", "name": "Centro (duplicado OSM)", "lat": -12.0501, "lon": -77.0501, "ubigeo": "150101"},
    {"id": "c2", "cat": "comisaria", "name": "Este", "lat": -12.05, "lon": -77.01, "ubigeo": "150101"},
    {"id": "c3", "cat": "comisaria", "name": "Norte", "lat": -12.01, "lon": -77.05, "ubigeo": "150101"},
    {"id": "s1", "cat": "serenazgo", "name": "Base", "lat": -12.052, "lon": -77.052, "ubigeo": "150101"},
    {"id": "s2", "cat": "serenazgo", "name": "Lejos", "lat": -12.05, "lon": -77.0105, "ubigeo": "150101"},
]}

CMAP_XML = """<ColorMaps><ColorMap title="No Data"><Entries><ColorMapEntry rgb="0,0,0" transparent="true" nodata="true" ref="0"/></Entries></ColorMap>
  <ColorMap title="Sea Surface Temperature Anomaly" units="°C"><Entries>
  <ColorMapEntry rgb="107,0,219" transparent="false" sourceValue="[-INF,-3.0)" value="[-INF,-3.0)" ref="1"/>
  <ColorMapEntry rgb="194,202,184" transparent="false" sourceValue="[-0.1,0.0)" value="[-0.1,0.0)" ref="2"/>
  <ColorMapEntry rgb="128,0,0" transparent="false" sourceValue="[3.0,+INF)" value="[3.0,+INF)" ref="3"/></Entries></ColorMap></ColorMaps>"""


class CoverageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        (Path(self.tmp.name) / "instituciones.json").write_text(json.dumps(ITEMS), encoding="utf-8")
        self.p = patch.object(config, "NORMALIZED", Path(self.tmp.name))
        self.p.start()

    def tearDown(self):
        self.p.stop()
        self.tmp.cleanup()

    def test_voronoi_area_inflexion_and_entities_inside(self):
        r = coverage.comisaria("c1")
        # vecina más cercana: Este o Norte (~4,4 km) → inflexión a la mitad; el duplicado a ~15 m no cuenta
        self.assertAlmostEqual(r["inflexion_km"], r["neighbors"][0]["km"] / 2, places=2)
        self.assertGreater(r["inflexion_km"], 1.5)
        self.assertEqual(r["duplicates"], 1)
        self.assertEqual(r["inside_counts"]["serenazgo"], 1)   # «Lejos» queda en el área de Este
        self.assertEqual(r["inside"]["serenazgo"][0]["id"], "s1")
        self.assertGreater(r["area_km2"], 0)
        ring = r["area"]["coordinates"][0]
        self.assertEqual(ring[0], ring[-1])

    def test_nearest_eta_uses_declared_assumptions(self):
        n = coverage.nearest(-12.05, -77.05, per_cat=2, speed_kmh=30, circuity=1.5)
        self.assertEqual(n["by_cat"]["comisaria"][0]["id"], "c1")
        s = n["by_cat"]["serenazgo"][0]
        self.assertAlmostEqual(s["eta_min"], round(s["km"] * 1.5 / 30 * 60, 1), places=1)
        with self.assertRaises(coverage.CoverageError):
            coverage.comisaria("nope")


class ModelKeysTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = patch.object(config, "_LOCAL", Path(self.tmp.name) / "config.local.json")
        self.p.start()

    def tearDown(self):
        self.p.stop()
        self.tmp.cleanup()

    def test_keys_never_public_and_activation_sets_settings(self):
        out = model_keys.upsert({"provider": "jev", "base_url": "http://127.0.0.1:9900/jev", "api_key": "secreto-123"})
        self.assertNotIn("secreto-123", json.dumps(out))
        cid = out["connections"][0]["id"]
        self.assertTrue(out["connections"][0]["has_key"])
        model_keys.activate(cid)
        self.assertEqual(config.setting("jev_url"), "http://127.0.0.1:9900/jev")
        self.assertEqual(config.setting("jev_api_key"), "secreto-123")
        ai = model_keys.upsert({"provider": "anthropic", "api_key": "k"})
        aid = [c for c in ai["connections"] if c["provider"] == "anthropic"][0]["id"]
        model_keys.activate(aid)
        self.assertEqual(config.setting("external_model"), "claude-sonnet-5-5")
        self.assertIn("x-api-key", model_keys.auth_headers("anthropic", "k"))
        model_keys.remove(cid)
        self.assertEqual(config.setting("jev_url"), "")

    def test_rejects_bad_urls_and_unknown_providers(self):
        with self.assertRaises(model_keys.ModelKeyError):
            model_keys.upsert({"provider": "otro", "base_url": "javascript:alert(1)", "model": "x"})
        with self.assertRaises(model_keys.ModelKeyError):
            model_keys.upsert({"provider": "nada"})


class ColormapTest(unittest.TestCase):
    def test_parses_official_palette(self):
        overlays._CMAP.clear()
        with patch.object(overlays, "http_get", return_value=CMAP_XML.encode()), tempfile.TemporaryDirectory() as d, \
                patch.object(config, "LIVE", Path(d)):
            cm = overlays.colormap("ssta")
        self.assertEqual(cm["units"], "°C")
        self.assertEqual(cm["entries"][0], {"rgb": [107, 0, 219], "from": None, "to": -3.0})
        self.assertEqual(cm["entries"][1]["from"], -0.1)
        self.assertIsNone(cm["entries"][2]["to"])
        self.assertIsNone(overlays.colormap("otra"))
        overlays._CMAP.clear()


if __name__ == "__main__":
    unittest.main()

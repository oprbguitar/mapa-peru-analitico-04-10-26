"""Niño costero 2026-2027: capas estáticas generadas y clasificación de cauces OSM."""
import importlib.util
import json
import unittest
from pathlib import Path
from unittest import mock

from peru_intel.live import waterways

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "apps" / "web" / "data" / "nino2627"


def _build_module():
    spec = importlib.util.spec_from_file_location("build_nino_costero", ROOT / "scripts" / "build_nino_costero.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class UtmTest(unittest.TestCase):
    def test_lima_utm18s(self):
        # Plaza Mayor de Lima (-12.0464, -77.0300) = 279 011 E, 8 667 498 N en UTM 18S
        lon, lat = _build_module().utm_to_lonlat(279011.4, 8667498.2, 18)
        self.assertAlmostEqual(lon, -77.0300, delta=0.0001)
        self.assertAlmostEqual(lat, -12.0464, delta=0.0001)

    def test_levels(self):
        m = _build_module()
        self.assertEqual([m.level(x) for x in ("Muy Alto", "alto", "Medio", "Bajo", None)], [4, 3, 2, 1, 0])


@unittest.skipUnless((DATA / "meta.json").exists(), "capas no generadas")
class LayersTest(unittest.TestCase):
    def test_districts_only_published_levels(self):
        fc = json.loads((DATA / "distritos.geojson").read_text(encoding="utf-8"))
        self.assertGreater(len(fc["features"]), 1800)
        for f in fc["features"][:200]:
            for k in ("i_ver27", "m_ver27", "i_ond26", "m_ond26"):
                self.assertIn(f["properties"].get(k, 0), (0, 1, 2, 3, 4))

    def test_criticals_inside_peru(self):
        fc = json.loads((DATA / "criticos.geojson").read_text(encoding="utf-8"))
        for f in fc["features"]:
            pts = [f["geometry"]["coordinates"]] if f["geometry"]["type"] == "Point" else f["geometry"]["coordinates"]
            for lon, lat in pts:
                self.assertTrue(-81.6 <= lon <= -68.4 and -18.6 <= lat <= 0.4)

    def test_cauces_have_slope_and_source(self):
        meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
        self.assertIn("HydroRIVERS", meta["cauces"]["source"])
        fc = json.loads((DATA / "cauces.geojson").read_text(encoding="utf-8"))
        self.assertTrue({f["properties"]["v"] for f in fc["features"]} <= {"P", "A", "T"})


class WaterwaysTest(unittest.TestCase):
    def setUp(self):
        waterways._fetch.cache_clear()

    def test_rejects_wide_view(self):
        r = waterways.within_view((-80.0, -9.0, -78.0, -7.0))
        self.assertFalse(r["available"])
        self.assertTrue(r["zoom_in"])

    def test_destination_by_osm_direction(self):
        payload = {"elements": [
            {"type": "way", "id": 1, "nodes": [10, 11, 12], "tags": {"waterway": "stream", "name": "Qda. A"},
             "geometry": [{"lon": -76.90, "lat": -11.90}, {"lon": -76.95, "lat": -11.95}, {"lon": -77.00, "lat": -12.00}]},
            {"type": "way", "id": 2, "nodes": [12, 13], "tags": {"waterway": "river", "name": "Río B"},
             "geometry": [{"lon": -77.00, "lat": -12.00}, {"lon": -77.10, "lat": -12.05}]},
            {"type": "way", "id": 3, "tags": {"natural": "coastline"},
             "geometry": [{"lon": -77.105, "lat": -12.05}, {"lon": -77.11, "lat": -12.10}, {"lon": -77.12, "lat": -12.15}]},
        ]}
        with mock.patch.object(waterways, "_request_payload", return_value=payload):
            r = waterways.within_view((-77.2, -12.2, -76.85, -11.85))
        by_id = {f["id"]: f["properties"] for f in r["geojson"]["features"]}
        self.assertEqual(by_id[1]["dest"], "rio")
        self.assertEqual(by_id[1]["dest_name"], "Río B")
        self.assertEqual(by_id[2]["dest"], "mar")
        self.assertEqual(r["provenance"][0]["kind"], "vivo_tercero")


if __name__ == "__main__":
    unittest.main()

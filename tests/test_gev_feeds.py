"""Mejoras traídas de GOdEyes: clave de nubes, respaldo marcado como desactualizado y emisoras HTTPS."""
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np
from PIL import Image

from peru_intel.live import feeds
from peru_intel.weather import clouds


def _png(values):
    arr = np.zeros((1, len(values), 4), dtype=np.uint8)
    for i, v in enumerate(values):
        arr[0, i] = (v, v, v, 255)
    buf = io.BytesIO()
    Image.fromarray(arr, "RGBA").save(buf, "PNG")
    return buf.getvalue()


class CloudKeyTest(unittest.TestCase):
    def test_warm_is_transparent_and_cold_cloud_is_white(self):
        out = np.asarray(Image.open(io.BytesIO(clouds.cloud_key(_png([60, 255])))))
        self.assertEqual(out[0, 0, 3], 0)            # superficie cálida: transparente
        self.assertGreater(out[0, 1, 3], 200)       # tope frío: casi opaco
        self.assertGreaterEqual(out[0, 1, :3].min(), 228)  # velo blanco


class FreshnessTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = mock.patch.object(feeds, "_cache_dir", return_value=Path(self.tmp.name))
        self.patch.start()
        feeds._MEM.clear()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()
        feeds._MEM.clear()

    def test_fallback_is_flagged_stale(self):
        fresh = feeds.cached("demo", 60, lambda: {"available": True, "items": [1]})
        self.assertFalse(fresh["stale"])
        feeds._MEM.clear()
        def boom():
            raise TimeoutError()
        old = feeds.cached("demo", 60, boom)
        self.assertTrue(old["stale"])
        self.assertEqual(old["items"], [1])
        self.assertIn("última copia", old["fallback"])

    def test_no_copy_means_unavailable(self):
        def boom():
            raise TimeoutError()
        r = feeds.cached("nada", 60, boom)
        self.assertFalse(r["available"])

    def test_radios_keep_only_https_inside_peru(self):
        rows = [{"stationuuid": "a", "name": "Radio A", "geo_lat": -12.05, "geo_long": -77.04, "url_resolved": "https://a.pe/live"},
                {"stationuuid": "b", "name": "Radio B", "geo_lat": -12.05, "geo_long": -77.04, "url_resolved": "http://b.pe/live"},
                {"stationuuid": "c", "name": "Radio C", "geo_lat": 40.0, "geo_long": -3.0, "url_resolved": "https://c.es/live"}]
        with mock.patch.object(feeds, "_get_json", return_value=rows):
            r = feeds._radios()
        self.assertEqual([x["id"] for x in r["items"]], ["a"])
        self.assertEqual(r["provenance"][0]["kind"], "vivo_tercero")


if __name__ == "__main__":
    unittest.main()

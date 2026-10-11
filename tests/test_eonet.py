import json
import unittest
from unittest.mock import patch

from peru_intel.backend import api
from peru_intel.live import eonet

PAYLOAD = {"events": [
    {"id": "EONET_17166", "title": "Sabancaya Volcano, Peru", "closed": None, "link": "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_17166",
     "categories": [{"id": "volcanoes"}], "sources": [{"id": "SIVolcano", "url": "https://volcano.si.edu/volcano.cfm?vn=354006"}],
     "geometry": [{"date": "2025-12-29T00:00:00Z", "type": "Point", "coordinates": [-71.857, -15.787],
                   "magnitudeValue": None, "magnitudeUnit": None}]},
    {"id": "EONET_24158", "title": "Flood in Peru 1104145", "closed": "2026-09-06T00:00:00Z", "link": "x",
     "categories": [{"id": "floods"}], "sources": [{"id": "GDACS", "url": "https://www.gdacs.org/"}],
     "geometry": [{"date": "2026-09-04T20:00:00Z", "type": "Polygon",
                   "coordinates": [[[-75.0, -10.0], [-74.0, -10.0], [-74.0, -11.0], [-75.0, -11.0]]]}]},
    {"id": "EONET_FAR", "title": "Wildfire far away", "closed": None, "categories": [{"id": "wildfires"}], "sources": [],
     "geometry": [{"date": "2026-10-01T00:00:00Z", "type": "Point", "coordinates": [-50.0, -10.0]}]},
    {"id": "EONET_TRACK", "title": "Wildfire in Peru 1", "closed": None, "categories": [{"id": "wildfires"}], "sources": [{"id": "GDACS"}],
     "geometry": [{"date": "2026-10-01T00:00:00Z", "type": "Point", "coordinates": [-70.0, -12.0]},
                  {"date": "2026-10-05T00:00:00Z", "type": "Point", "coordinates": [-70.5, -12.5]}]},
]}


class EonetTest(unittest.TestCase):
    def test_normalize_keeps_source_and_marks_calculated_anchor(self):
        items = {x["id"]: x for x in eonet.normalize(PAYLOAD)}
        self.assertNotIn("EONET_FAR", items, "fuera del recuadro del Perú")
        volcano = items["EONET_17166"]
        self.assertEqual((volcano["lon"], volcano["lat"]), (-71.857, -15.787))
        self.assertTrue(volcano["open"])
        self.assertEqual(volcano["reported_by"], "SIVolcano")
        self.assertEqual(volcano["anchor"], "punto publicado")
        flood = items["EONET_24158"]
        self.assertFalse(flood["open"])
        self.assertEqual((flood["lon"], flood["lat"]), (-74.5, -10.5))
        self.assertIn("calculado", flood["anchor"])
        track = items["EONET_TRACK"]
        self.assertEqual((track["lon"], track["lat"], track["observations"]), (-70.5, -12.5, 2))

    def test_items_sorted_newest_first(self):
        times = [x["time"] for x in eonet.normalize(PAYLOAD)]
        self.assertEqual(times, sorted(times, reverse=True))

    def test_api_returns_snapshot_with_provenance(self):
        with patch.object(eonet, "http_get", return_value=json.dumps(PAYLOAD).encode()), \
                patch.object(eonet.WORKER, "_save_cache"), patch("peru_intel.live.worker.registry.set_live_status"):
            eonet.WORKER.tick()
        with patch.object(eonet.WORKER, "start"):
            res = api.route_get("/api/v1/intel/eonet", {})
        self.assertEqual(res["status"]["status"], "ok")
        self.assertEqual(len(res["data"]["items"]), 3)
        prov = res["provenance"][0]
        self.assertEqual(prov["source_id"], "nasa_eonet")
        self.assertEqual(prov["kind"], "vivo_tercero")
        self.assertFalse(prov["official"])

    def test_query_is_peru_bbox_without_key(self):
        self.assertIn("bbox=-84.0%2C2.0%2C-66.5%2C-20.5", eonet.URL)
        self.assertNotIn("key", eonet.URL.lower())


if __name__ == "__main__":
    unittest.main()

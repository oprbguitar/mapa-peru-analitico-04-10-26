import sys
import json
import urllib.error
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from peru_intel.analytics import connectivity
from peru_intel.ingestion.telecom import source_columns
from peru_intel.live import telecom


BOUNDS = (-77.2, -12.2, -76.8, -11.8)


class ConnectivityCoverageTest(unittest.TestCase):
    @patch("peru_intel.analytics.connectivity.registry.provenance", return_value=[])
    @patch("peru_intel.analytics.connectivity.warehouse.query", return_value=[{"cobertura": 0}])
    @patch("peru_intel.analytics.connectivity.warehouse.has", return_value=True)
    def test_uncovered_requires_explicit_zero_for_every_selected_operator(self, has, query, provenance):
        result = connectivity.coverage("all", "4g", "cg", BOUNDS, status="uncovered")
        sql = query.call_args.args[0]
        for operator in connectivity.OPERATORS:
            self.assertIn(f"{operator}_4g_cg = 0", sql)
        self.assertEqual(result["items"][0]["estado_cobertura"], "cero_declarado")
        self.assertIn("no acredita", result["disclaimer"])

    def test_rejects_invalid_coverage_status_and_limit(self):
        with self.assertRaises(ValueError):
            connectivity.coverage("all", "4g", "cg", BOUNDS, status="inventado")
        with self.assertRaises(ValueError):
            connectivity.coverage("all", "4g", "cg", BOUNDS, limit=-1)

    @patch("peru_intel.analytics.connectivity.registry.provenance", return_value=[{"source_id": "osiptel_cobertura_movil"}])
    @patch("peru_intel.analytics.connectivity.warehouse.query", return_value=[{"ubigeo": "1501010001", "cobertura": 92.5}])
    @patch("peru_intel.analytics.connectivity.warehouse.has", return_value=True)
    def test_filters_one_operator_technology_and_scope(self, has, query, provenance):
        result = connectivity.coverage("claro", "4g", "cgcar", BOUNDS)
        self.assertTrue(result["available"])
        self.assertEqual(result["filters"]["operadora"], "Claro")
        self.assertIn("claro_4g_cgcar", query.call_args.args[0])
        self.assertEqual(query.call_args.args[1], [-77.2, -76.8, -12.2, -11.8, 4001])
        provenance.assert_called_once_with("osiptel_cobertura_movil")

    @patch("peru_intel.analytics.connectivity.warehouse.has", return_value=True)
    @patch("peru_intel.analytics.connectivity.registry.provenance", return_value=[])
    @patch("peru_intel.analytics.connectivity.warehouse.query", return_value=[])
    def test_all_operators_uses_only_available_technology_fields(self, query, provenance, has):
        connectivity.coverage("all", "2g", "cg", BOUNDS)
        sql = query.call_args.args[0]
        self.assertIn("claro_2g_cg", sql)
        self.assertIn("entel_2g_cg", sql)
        self.assertIn("integratel_2g_cg", sql)
        self.assertNotIn("bitel_2g_cg", sql)

    def test_rejects_unsupported_operator_technology(self):
        with self.assertRaisesRegex(ValueError, "no publica"):
            connectivity.coverage("bitel", "2g", "cg", BOUNDS)

    def test_rejects_invalid_geographic_bounds(self):
        with self.assertRaisesRegex(ValueError, "bbox"):
            connectivity.coverage("all", "4g", "cg", (-90, -12, -89, -11))

    def test_uses_actual_osiptel_column_names(self):
        columns = source_columns()
        self.assertIn("bitel_3g_cgcar", columns)
        self.assertNotIn("bitel_2g_cg", columns)


class OpenStreetMapTelecomTest(unittest.TestCase):
    def test_retries_current_public_mirror_after_primary_unavailable(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"elements":[]}'
        with patch("peru_intel.live.telecom.urllib.request.urlopen", side_effect=[urllib.error.URLError("busy"), Response()]) as request:
            self.assertEqual(telecom._request_payload("query"), {"elements": []})
        self.assertEqual(request.call_count, 2)
        self.assertEqual(request.call_args.args[0].full_url, telecom.OVERPASS_FALLBACK)

    def test_fetch_retains_multiple_categories_technology_and_osm_revision(self):
        payload = {"elements": [{"type": "node", "id": 1, "lat": -12, "lon": -77,
                    "timestamp": "2026-09-01T01:00:00Z", "tags": {"telecom": "mast",
                    "communication:mobile_phone": "yes", "communication:mobile_phone:technology": "LTE;5G",
                    "operator": "Operador publicado", "height": "20"}}]}
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(payload).encode()
        telecom._fetch.cache_clear()
        with patch("peru_intel.live.telecom.urllib.request.urlopen", return_value=Response()) as request:
            rows, timestamp = telecom._fetch(BOUNDS, 987654)
        self.assertEqual(rows[0]["categorias"], ["mobile", "tower"])
        self.assertEqual(rows[0]["tecnologias"], "LTE;5G")
        self.assertEqual(rows[0]["osm_timestamp"], "2026-09-01T01:00:00Z")
        self.assertIn(b"mast", request.call_args.args[0].data)
        telecom._fetch.cache_clear()

    def test_partial_overpass_response_is_not_reported_as_complete(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"remark":"runtime error: Query timed out","elements":[]}'
        telecom._fetch.cache_clear()
        with patch("peru_intel.live.telecom.urllib.request.urlopen", return_value=Response()):
            result = telecom.within_view(BOUNDS, ["tower"])
        self.assertFalse(result["available"])
        telecom._fetch.cache_clear()

    def test_multiple_tags_match_any_selected_category_and_include_proximity(self):
        rows = [{"cat": "mobile", "categorias": ["mobile", "tower"], "lat": -12, "lon": -77}]
        with patch("peru_intel.live.telecom._fetch", return_value=(rows, "2026-10-08T00:00:00Z")):
            result = telecom.within_view(BOUNDS, ["tower"])
        self.assertEqual(len(result["items"]), 1)
        self.assertAlmostEqual(result["items"][0]["distancia_centro_vista_km"], 0, places=2)
        self.assertIn("no demuestra", result["disclaimer"])

    def test_rejects_national_overpass_request_until_zoomed(self):
        result = telecom.within_view((-81, -18, -69, -1), ["mobile"])
        self.assertFalse(result["available"])
        self.assertIn("Acerca", result["reason"])

    def test_filters_to_selected_osm_categories_and_returns_attribution(self):
        rows = [
            {"cat": "mobile", "lat": -12.0, "lon": -77.0},
            {"cat": "tower", "lat": -12.1, "lon": -77.1},
        ]
        with patch("peru_intel.live.telecom._fetch", return_value=(rows, "2026-10-08T00:00:00Z")):
            result = telecom.within_view(BOUNDS, ["mobile"])
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["cat"], "mobile")
        self.assertIn("ODbL", result["provenance"][0]["license"])

    def test_rejects_unknown_osm_category(self):
        with self.assertRaisesRegex(ValueError, "categorías"):
            telecom.within_view(BOUNDS, ["inventada"])

    def test_reports_overpass_unavailable_without_failing_api(self):
        with patch("peru_intel.live.telecom._fetch", side_effect=TimeoutError()):
            result = telecom.within_view(BOUNDS, ["tower"])
        self.assertFalse(result["available"])
        self.assertIn("Overpass no respondió", result["reason"])


if __name__ == "__main__":
    unittest.main()

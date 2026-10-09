import unittest
from unittest.mock import patch

from peru_intel.analytics import connectivity
from peru_intel.ingestion.telecom import source_columns
from peru_intel.live import telecom


BOUNDS = (-77.2, -12.2, -76.8, -11.8)


class ConnectivityCoverageTest(unittest.TestCase):
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

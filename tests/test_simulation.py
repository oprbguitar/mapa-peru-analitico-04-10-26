import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel import config, simulation
from peru_intel.backend import api
from peru_intel.simulation import accessibility as acc
from peru_intel.simulation import runs

CENTER = {"lat": -12.0, "lon": -77.0, "radius_km": 5}
ONE = [{"id": "h1", "name": "Hospital fijo", "lat": -12.0, "lon": -77.0, "km_to_center": 0.0}]
TWO = ONE + [{"id": "h2", "name": "Hospital norte", "lat": -11.97, "lon": -77.0, "km_to_center": 3.3}]
EXACT = {"speed_kmh": 30, "speed_sigma": 0, "circuity": 1.0, "availability": 1.0, "delay_min": [4, 4, 4]}


def body(**kw):
    return {"area": CENTER, "service": "hospital", "base": EXACT, "iterations": 50, "seed": 7} | kw


class AccessibilityTest(unittest.TestCase):
    def test_known_case_matches_closed_form(self):
        """Sin azar: tiempo = distancia ÷ 30 km/h × 60 + 4 min, punto por punto."""
        with patch.object(acc, "load_facilities", return_value=ONE):
            r = acc.run(body())
        for pt in r["points"]:
            d = acc._km(-12.0, -77.0, pt["lat"], pt["lon"])
            self.assertAlmostEqual(pt["a"], round(float(d) / 30 * 60 + 4, 1), delta=0.11)
        # el borde del círculo de 5 km queda a 14 min: todo el área ≤ 15 min
        self.assertEqual(r["results"]["A"]["coverage_pct"]["15"]["p50"], 100.0)
        self.assertEqual(r["kind"], "estimacion")

    def test_hypothesis_only_worsens_and_reports_paired_difference(self):
        with patch.object(acc, "load_facilities", return_value=TWO):
            r = acc.run(body(base=EXACT | {"speed_sigma": 0.3, "availability": 0.9, "delay_min": [2, 5, 12]}, iterations=300,
                             hypothesis={"rain": "intensa", "congestion_pct": 30, "out_of_service_pct": 20}))
        a, b = r["results"]["A"], r["results"]["B"]
        self.assertGreater(b["median_min"]["p50"], a["median_min"]["p50"])
        self.assertLess(r["results"]["diff"]["coverage_pct"]["15"], 0)
        lo, hi = r["results"]["diff"]["coverage_30_interval"]
        self.assertLessEqual(lo, hi)

    def test_same_seed_is_reproducible_and_seed_changes_draws(self):
        b = body(base=EXACT | {"speed_sigma": 0.3, "delay_min": [2, 5, 12]}, iterations=100)
        with patch.object(acc, "load_facilities", return_value=TWO):
            r1, r2 = acc.run(b), acc.run(b)
            r3 = acc.run(b | {"seed": 8})
        self.assertEqual(r1["results"], r2["results"])
        self.assertNotEqual(r1["results"]["A"]["median_min"], r3["results"]["A"]["median_min"])

    def test_closing_the_only_facility_leaves_no_service(self):
        with patch.object(acc, "load_facilities", return_value=ONE):
            r = acc.run(body(hypothesis={"closed_ids": ["h1"]}))
        self.assertEqual(r["results"]["B"]["coverage_pct"]["45"]["p50"], 0.0)
        self.assertEqual(r["results"]["B"]["no_service_iterations"], 50)
        self.assertIsNone(r["points"][0]["b"])

    def test_sample_is_area_not_population(self):
        pts = acc.sample_points(-12.0, -77.0, 10)
        self.assertLessEqual(len(pts), acc.LIMITS["points"])
        far = max(float(acc._km(-12.0, -77.0, y, x)) for y, x in pts)
        self.assertLessEqual(far, 10.0 + 1e-6)
        with patch.object(acc, "load_facilities", return_value=ONE):
            r = acc.run(body())
        self.assertTrue(any("no de población" in a for a in r["assumptions"]))

    def test_validation_rejects_out_of_range(self):
        for bad in ({"area": CENTER | {"radius_km": 7}}, {"area": CENTER | {"lat": 10}}, {"service": "x"},
                    {"iterations": 99999}, {"hypothesis": {"rain": "diluvio"}}, {"base": EXACT | {"delay_min": [9, 4, 2]}}):
            with self.assertRaises(acc.SimError):
                acc.normalize(body(**bad))


class SimApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(config, "DATA", Path(self.tmp.name))
        self.data.start()

    def tearDown(self):
        self.data.stop()
        self.tmp.cleanup()

    def test_runs_are_registered_and_idempotent(self):
        with patch.object(acc, "load_facilities", return_value=ONE), patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PI_PUBLIC_ACCESS_PASSWORD", None)
            os.environ.pop("RENDER", None)
            first = api.route_post("/api/v1/sim/accessibility/run", body())
            again = api.route_post("/api/v1/sim/accessibility/run", body())
            listed = api.route_get("/api/v1/sim/runs", {})
            got = api.route_get(f"/api/v1/sim/runs/{first['run_id']}", {})
        self.assertFalse(first["reused"])
        self.assertTrue(again["reused"])
        self.assertEqual(first["state"], "finalizado")
        self.assertEqual(listed["runs"][0]["run_id"], first["run_id"])
        self.assertEqual(got["params"]["seed"], 7)

    def test_cloud_deploy_refuses_simulation_but_lists_engines(self):
        with patch.dict(os.environ, {"RENDER": "true"}):
            self.assertFalse(simulation.is_local())
            eng = api.route_get("/api/v1/sim/engines", {})
            self.assertFalse(eng["local"])
            with self.assertRaises(api.ApiError) as e:
                api.route_post("/api/v1/sim/accessibility/run", body())
        self.assertEqual(e.exception.status, 403)

    def test_bad_params_are_400(self):
        os.environ.pop("RENDER", None)
        os.environ.pop("PI_PUBLIC_ACCESS_PASSWORD", None)
        with self.assertRaises(api.ApiError) as e:
            api.route_post("/api/v1/sim/accessibility/run", body(service="nada"))
        self.assertEqual(e.exception.status, 400)


if __name__ == "__main__":
    unittest.main()

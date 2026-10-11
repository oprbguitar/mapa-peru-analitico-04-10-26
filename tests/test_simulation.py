import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel import config, simulation
from peru_intel.backend import api
from peru_intel.simulation import accessibility as acc
from peru_intel.simulation import queue as que
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

    def test_free_radius_is_rounded_to_half_km(self):
        self.assertEqual(acc.normalize(body(area=CENTER | {"radius_km": 7.26}))["area"]["radius_km"], 7.5)

    def test_validation_rejects_out_of_range(self):
        for bad in ({"area": CENTER | {"radius_km": 31}}, {"area": CENTER | {"radius_km": 0.5}}, {"area": CENTER | {"lat": 10}}, {"service": "x"},
                    {"iterations": 99999}, {"hypothesis": {"rain": "diluvio"}}, {"base": EXACT | {"delay_min": [9, 4, 2]}}):
            with self.assertRaises(acc.SimError):
                acc.normalize(body(**bad))


def qbody(**kw):
    return body(queue={"rate_per_h": 6, "capacity": 1, "service_min": 20, "horizon_h": 12}, replications=10) | kw


@unittest.skipUnless(que.available(), "SimPy no instalado (requirements-simulation.txt)")
class QueueTest(unittest.TestCase):
    def test_mm1_matches_closed_form(self):
        """M/M/1 sin traslado: λ=3/h, μ=5/h → ρ=0,6; Wq=ρ/(μ−λ)=18 min; P(Wq=0)=0,4; p90 de Wq = ln 6 ÷ 2 h ≈ 53,75 min."""
        import numpy as np
        rng = np.random.default_rng(11)
        lam, mu, horizon = 3 / 60, 5 / 60, 200_000.0
        arr = np.cumsum(rng.exponential(1 / lam, int(lam * horizon * 1.2)))
        arr = arr[arr < horizon]
        out = que.simulate(arr, rng.exponential(1 / mu, len(arr)), np.zeros((len(arr), 1)), [1], horizon)
        w = out["wait"]
        self.assertAlmostEqual(float(np.nanmean(w)), 18.0, delta=1.5)
        self.assertAlmostEqual(float((w == 0).mean()), 0.4, delta=0.02)
        self.assertAlmostEqual(float(np.nanpercentile(w, 90)), math.log(6) / 2 * 60, delta=4)
        self.assertAlmostEqual(out["busy"][0] / horizon, 0.6, delta=0.02)
        self.assertEqual(out["unassigned"], 0)

    def test_fifo_assigns_nearest_free_site_and_counts_diversions(self):
        import numpy as np
        # dos llamadas simultáneas cerca de la sede 0 (capacidad 1): la segunda se deriva a la sede 1
        out = que.simulate(np.array([0.0, 0.0]), np.array([10.0, 10.0]), np.array([[1.0, 5.0], [1.0, 5.0]]), [1, 1], 60)
        self.assertEqual(list(out["served"]), [1, 1])
        self.assertEqual(list(out["diverted"]), [1, 0])
        self.assertEqual(list(out["response"]), [1.0, 5.0])
        # sede cerrada (inf) y sin alternativa: la llamada queda sin asignar
        out = que.simulate(np.array([0.0]), np.array([10.0]), np.array([[np.inf]]), [1], 60)
        self.assertEqual(out["unassigned"], 1)

    def test_run_is_reproducible_and_hypothesis_worsens(self):
        b = qbody(hypothesis={"rain": "intensa", "congestion_pct": 30, "demand_pct": 100})
        with patch.object(acc, "load_facilities", return_value=TWO):
            r1, r2 = que.run(b), que.run(b)
            r3 = que.run(b | {"seed": 8})
        self.assertEqual(r1["results"], r2["results"])
        self.assertNotEqual(r1["results"]["A"]["wait_p90_min"], r3["results"]["A"]["wait_p90_min"])
        a, bb = r1["results"]["A"], r1["results"]["B"]
        self.assertGreaterEqual(bb["wait_p90_min"]["p50"], a["wait_p90_min"]["p50"])
        self.assertLess(r1["results"]["diff"]["within_30_pct"], 0)
        self.assertEqual((r1["kind"], r1["validity"]), ("estimacion", "exploratorio"))
        self.assertTrue(any("Poisson" in x and "no se deriva" in x for x in r1["assumptions"]))
        self.assertEqual(len(a["sites"]), 2)

    def test_overload_marks_bottleneck(self):
        with patch.object(acc, "load_facilities", return_value=ONE):
            r = que.run(qbody(queue={"rate_per_h": 10, "capacity": 1, "service_min": 30, "horizon_h": 12}))
        self.assertEqual(r["results"]["A"]["bottlenecks"][0]["id"], "h1")
        self.assertGreater(r["results"]["A"]["sites"][0]["utilization_pct"], 90)

    def test_validation(self):
        for bad in ({"queue": {"rate_per_h": 0}}, {"queue": {"capacity": 0}}, {"replications": 999},
                    {"hypothesis": {"demand_pct": 500}}, {"queue": {"rate_per_h": 120, "horizon_h": 72}, "replications": 200}):
            with self.assertRaises(acc.SimError):
                que.normalize(qbody(**bad))


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

    @unittest.skipUnless(que.available(), "SimPy no instalado")
    def test_queue_run_is_registered(self):
        os.environ.pop("RENDER", None)
        os.environ.pop("PI_PUBLIC_ACCESS_PASSWORD", None)
        with patch.object(acc, "load_facilities", return_value=TWO):
            first = api.route_post("/api/v1/sim/queue/run", qbody())
            again = api.route_post("/api/v1/sim/queue/run", qbody())
        self.assertTrue(first["run_id"].startswith("cap-"))
        self.assertTrue(again["reused"])
        self.assertEqual(api.route_get("/api/v1/sim/runs", {})["runs"][0]["engine"], "queue")

    def test_queue_without_simpy_is_503_and_cloud_is_403(self):
        os.environ.pop("RENDER", None)
        os.environ.pop("PI_PUBLIC_ACCESS_PASSWORD", None)
        with patch.object(que, "simpy", None):
            self.assertFalse(api.route_get("/api/v1/sim/engines", {})["queue"]["available"])
            with self.assertRaises(api.ApiError) as e:
                api.route_post("/api/v1/sim/queue/run", qbody())
        self.assertEqual(e.exception.status, 503)
        self.assertIn("requirements-simulation.txt", str(e.exception))
        with patch.dict(os.environ, {"RENDER": "true"}), self.assertRaises(api.ApiError) as e:
            api.route_post("/api/v1/sim/queue/run", qbody())
        self.assertEqual(e.exception.status, 403)

    def test_bad_params_are_400(self):
        os.environ.pop("RENDER", None)
        os.environ.pop("PI_PUBLIC_ACCESS_PASSWORD", None)
        with self.assertRaises(api.ApiError) as e:
            api.route_post("/api/v1/sim/accessibility/run", body(service="nada"))
        self.assertEqual(e.exception.status, 400)


if __name__ == "__main__":
    unittest.main()

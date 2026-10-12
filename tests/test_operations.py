import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from peru_intel.storage import sqlite_store
from peru_intel import config
from peru_intel.backend import api
from peru_intel.simulation import operations as ops
from peru_intel.simulation import scenarios

AREA = {"lat": -12.0, "lon": -77.0, "radius_km": 5}
EXACT = {"speed_kmh": 30, "speed_sigma": 0, "circuity": 1.0, "availability": 1.0, "delay_min": [0, 0, 0]}
UNIT = {"id": "p1", "kind": "patrulla", "lat": -12.0, "lon": -77.0}


def body(**kw):
    return {"area": AREA, "base": EXACT, "units": [UNIT], "ops": {"rate_per_h": 2, "horizon_h": 4, "service_min": 10,
            "mix": {"seguridad": 1, "medica": 0, "incendio": 0}}, "replications": 5, "seed": 3} | kw


class OperationsTest(unittest.TestCase):
    def test_travel_time_matches_closed_form_and_tramo_detour(self):
        p = ops.normalize(body())
        call = {"lat": -12.0, "lon": -76.95, "speed": 1.0}
        d = float(np.squeeze(ops.acc._km(-12.0, -77.0, -12.0, -76.95)))
        tt, crossed = ops._travel_min(p, (-77.0, -12.0), call, 30, 1.0)
        self.assertAlmostEqual(tt, d / 30 * 60, places=6)
        self.assertEqual(crossed, 0)
        p2 = ops.normalize(body(tramos=[{"id": "t1", "coords": [[-76.97, -12.02], [-76.97, -11.98]]}]))
        tt2, crossed2 = ops._travel_min(p2, (-77.0, -12.0), call, 30, 1.0)
        self.assertEqual(crossed2, 1)
        self.assertAlmostEqual(tt2, tt * 1.6, places=6)  # rodeo por tramo por defecto: 60 %

    def test_segment_crossing(self):
        self.assertTrue(ops._crosses((0, 0), (2, 2), (0, 2), (2, 0)))
        self.assertFalse(ops._crosses((0, 0), (1, 1), (2, 0), (3, 1)))

    def test_single_unit_serves_fifo_and_records_timeline(self):
        r = ops.run(body())
        calls = r["timeline"]["calls"]
        self.assertTrue(calls)
        for c in calls:
            self.assertEqual(c["unit"], "p1")
            self.assertGreaterEqual(c["dispatch"], c["t"])
            self.assertAlmostEqual(c["response"], c["arrive"] - c["t"], places=1)
        starts = [c["dispatch"] for c in calls]
        self.assertEqual(starts, sorted(starts), "una sola unidad: despacho en orden FIFO")
        self.assertEqual(len(r["timeline"]["trips"]), 2 * len(calls), "ida y regreso por llamada")
        self.assertEqual(r["kind"], "estimacion")

    def test_reproducible_and_seed_sensitive(self):
        a, b, c = ops.run(body()), ops.run(body()), ops.run(body(seed=4))
        self.assertEqual(a["results"], b["results"])
        self.assertNotEqual(a["timeline"]["calls"], c["timeline"]["calls"])

    def test_missing_unit_type_is_warned(self):
        r = ops.run(body(ops={"rate_per_h": 2, "horizon_h": 2, "mix": {"seguridad": 0.5, "medica": 0.5, "incendio": 0}}))
        self.assertTrue(any("Emergencia médica" in w for w in r["warnings"]))
        self.assertGreater(r["results"]["unattended"]["p50"], 0)

    def test_validation(self):
        for bad in ({"units": []}, {"units": [UNIT | {"kind": "tanque"}]}, {"units": [UNIT | {"lat": 10}]},
                    {"tramos": [{"coords": [[-77, -12]]}]}, {"ops": {"rate_per_h": 999}}):
            with self.assertRaises(ops.SimError):
                ops.normalize(body(**bad))
        self.assertTrue(any("No provienen de denuncias" in a for a in ops.run(body())["assumptions"]))


class ScenarioTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(config, "DATA", Path(self.tmp.name))
        self.data.start()
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)   # la auditoría de pruebas no toca el catálogo real
        self.audit.start()
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)

    def tearDown(self):
        self.data.stop()
        self.audit.stop()
        self.tmp.cleanup()

    def test_versions_duplicate_and_api(self):
        spec = {"engine": "operations", "units": [UNIT]}
        s = api.route_post("/api/v1/sim/scenarios", {"name": "Base", "spec": spec, "run_id": "ops-1"})
        s2 = api.route_post("/api/v1/sim/scenarios", {"id": s["id"], "spec": spec | {"units": []}, "note": "sin unidades"})
        self.assertEqual([v["v"] for v in s2["versions"]], [1, 2], "guardar añade versión, no sobrescribe")
        d = api.route_post(f"/api/v1/sim/scenarios/{s['id']}/duplicate", {"name": "Con congestión"})
        self.assertEqual(d["parent"], {"id": s["id"], "version": 2})
        self.assertEqual(scenarios.get(s["id"])["versions"][-1]["spec"]["units"], [], "el original no cambia")
        listed = api.route_get("/api/v1/sim/scenarios", {})["scenarios"]
        self.assertEqual({x["name"] for x in listed}, {"Base", "Con congestión"})
        with self.assertRaises(api.ApiError):
            api.route_get("/api/v1/sim/scenarios/../../x", {})
        with self.assertRaises(api.ApiError):
            api.route_post("/api/v1/sim/scenarios", {"name": "<script>", "spec": spec})

    def test_operations_api_is_local_only(self):
        with patch.dict(os.environ, {"RENDER": "true"}):
            with self.assertRaises(api.ApiError) as e:
                api.route_post("/api/v1/sim/operations/run", body())
        self.assertEqual(e.exception.status, 403)


if __name__ == "__main__":
    unittest.main()

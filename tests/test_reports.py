import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel import config, reports, users
from peru_intel.backend import api
from peru_intel.simulation import scenarios
from peru_intel.storage import sqlite_store

AREA = {"lat": -12.0, "lon": -77.0, "radius_km": 5}
EXACT = {"speed_kmh": 30, "speed_sigma": 0, "circuity": 1.0, "availability": 1.0, "delay_min": [2, 2, 2]}


def ops_body(units, tramos=()):
    return {"area": AREA, "base": EXACT, "units": units, "tramos": list(tramos), "replications": 5, "seed": 1,
            "ops": {"rate_per_h": 2, "horizon_h": 2, "mix": {"seguridad": 1, "medica": 0, "incendio": 0}}}


P1 = {"id": "p1", "kind": "patrulla", "lat": -12.0, "lon": -77.0}
P2 = {"id": "p2", "kind": "patrulla", "lat": -12.02, "lon": -77.01}


class ReportsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(config, "DATA", Path(self.tmp.name))
        self.data.start()
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)
        self.audit.start()
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)
        users.current.set(users.PERSONAL)

    def tearDown(self):
        self.data.stop()
        self.audit.stop()
        self.tmp.cleanup()

    def save(self, sid, units, tramos=(), note=""):
        r = api.route_post("/api/v1/sim/operations/run", ops_body(units, tramos))
        spec = {"engine": "operations", "area": AREA, "units": units, "tramos": list(tramos), "preset": "lluvia", "hypothesis": {"rain": "intensa"}}
        m = {"within_target_pct": r["results"]["within_target_pct"]["p50"], "units": len(units)}
        return api.route_post("/api/v1/sim/scenarios", {"id": sid, "name": "Base", "spec": spec, "run_id": r["run_id"], "metrics": m, "note": note}), r

    def test_scenario_report_tracks_versions_and_changes(self):
        s, _ = self.save(None, [P1])
        self.save(s["id"], [P1, P2], [{"id": "t1", "coords": [[-77.02, -12.03], [-77.02, -11.97]]}], note="refuerzo")
        rep = api.route_get(f"/api/v1/reports/scenario/{s['id']}", {})
        self.assertEqual([v["v"] for v in rep["versions"]], [1, 2])
        self.assertEqual(rep["versions"][0]["changes"], ["Versión inicial"])
        self.assertIn("Unidades: 1 → 2", rep["versions"][1]["changes"])
        self.assertIn("Tramos cortados: 0 → 1", rep["versions"][1]["changes"])
        self.assertTrue(rep["executive"][0].startswith("Con 2 unidad(es)"))
        self.assertIsNone(rep["jev"]["probability"])
        self.assertTrue(any("no es una probabilidad" in x for x in rep["limitations"]))
        self.assertIn("assumptions", rep["run"])

    def test_compare_and_run_reports(self):
        a, ra = self.save(None, [P1])
        d = api.route_post(f"/api/v1/sim/scenarios/{a['id']}/duplicate", {"name": "Reforzado"})
        self.save(d["id"], [P1, P2])
        cmp = api.route_get("/api/v1/reports/compare", {"ids": [f"{a['id']},{d['id']}"]})
        self.assertEqual(len(cmp["rows"]), 2)
        self.assertIsNotNone(cmp["jev"])
        self.assertTrue(any("persona responsable" in x for x in cmp["executive"]))
        run = api.route_get(f"/api/v1/reports/run/{ra['run_id']}", {})
        self.assertEqual(run["kind"], "ejecucion")
        with self.assertRaises(api.ApiError):
            api.route_get("/api/v1/reports/run/no-existe", {})

    def test_diff_detects_moves_and_parameters(self):
        a = {"units": [P1], "ops": {"rate_per_h": 2}, "area": AREA}
        b = {"units": [P1 | {"lat": -12.05}], "ops": {"rate_per_h": 4}, "area": AREA | {"radius_km": 8}}
        ch = reports.diff_specs(a, b)
        self.assertIn("1 unidad(es) reubicada(s)", ch)
        self.assertIn("rate_per_h: 2 → 4", ch)
        self.assertIn("Radio: 5 → 8 km", ch)
        ch2 = reports.diff_specs({"units": [P1]}, {"units": [P1], "perimeter": [[0, 0], [1, 0], [1, 1]], "notes": [{"cat": "riesgo", "text": "x"}]})
        self.assertIn("Perímetro dibujado", ch2)
        self.assertIn("Notas: 0 → 1", ch2)


if __name__ == "__main__":
    unittest.main()

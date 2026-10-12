import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel.storage import sqlite_store
from peru_intel import config, jev, notify
from peru_intel.backend import api
from peru_intel.jev import reference


def q(p5, p50, p95):
    return {"p5": p5, "p50": p50, "p95": p95}


def ops_run(p50=80, width=6, reps=40, saturated=(), crossing=5, rid="ops-1", warnings=()):
    return {"run_id": rid, "state": "finalizado", "params": {"engine": "operations", "ops": {"target_min": 15}, "replications": reps},
            "results": {"within_target_pct": q(p50 - width / 2, p50, p50 + width / 2), "crossing_tramos_pct": q(0, crossing, crossing)},
            "saturated": list(saturated), "warnings": list(warnings), "provenance": []}


def acc_run(a=95, b=70, width=8, iters=500):
    return {"run_id": "acc-1", "state": "finalizado", "params": {"engine": "accessibility", "iterations": iters},
            "results": {"A": {"coverage_pct": {"15": q(a - 2, a, a + 2)}}, "B": {"coverage_pct": {"15": q(b - width / 2, b, b + width / 2)}}},
            "warnings": [], "provenance": [{"name": "OpenStreetMap", "official": False, "downloaded": "2025-01-01T00:00:00+0000"}]}


class JevTest(unittest.TestCase):
    def test_score_is_metric_and_never_probability(self):
        out = jev.evaluate(ops_run())
        self.assertEqual(out["score"], 80)
        self.assertIsNone(out["probability"])
        self.assertEqual(out["score_kind"], "puntuacion_interna_jev")
        self.assertEqual(out["decision"], "aceptable_para_exploracion")
        self.assertTrue(all(isinstance(f["n"], int) for f in out["facts"]))

    def test_wide_interval_or_few_reps_asks_more_iterations(self):
        imprecise = jev.evaluate(ops_run(width=20, reps=20))   # ±1,96·20/(3,29·√20) ≈ 2,7 → media: no pide más
        self.assertEqual(imprecise["uncertainty"]["level"], "media")
        self.assertNotIn("mas_iteraciones", {a["action"] for a in imprecise["actions"]})
        very = jev.evaluate(ops_run(width=24, reps=20, p50=70))   # variabilidad media, precisión ±3,2
        self.assertEqual(very["variability"]["level"], "media")
        few = jev.evaluate(ops_run(reps=5))
        self.assertEqual(few["decision"], "mas_iteraciones")
        self.assertEqual(few["uncertainty"]["level"], "media", "pocas réplicas suben un nivel la incertidumbre")

    def test_high_variability_is_scenario_property_not_more_iterations(self):
        out = jev.evaluate(ops_run(p50=62, width=40, reps=200))   # ±1,7 (baja) pero rango 40 y p5 = 42 % < 50 %
        self.assertEqual(out["uncertainty"]["level"], "baja")
        self.assertEqual(out["variability"]["level"], "alta")
        acts = {a["action"] for a in out["actions"]}
        self.assertNotIn("mas_iteraciones", acts)
        self.assertIn("revision_humana", acts, "días malos por debajo del umbral crítico")
        good = jev.evaluate(ops_run(p50=90, width=30, reps=200))   # variable pero los días malos siguen en 75 %
        self.assertEqual(good["decision"], "aceptable_para_exploracion")
        imprecise = jev.evaluate(ops_run(width=40, reps=20))   # ±5,3 → alta → sí pide más réplicas
        self.assertIn("mas_iteraciones", {a["action"] for a in imprecise["actions"]})

    def test_critical_result_goes_to_human_review(self):
        self.assertEqual(jev.evaluate(ops_run(p50=30))["decision"], "revision_humana")

    def test_saturation_and_missing_units_trigger_actions(self):
        out = jev.evaluate(ops_run(saturated=["p1"], warnings=["Nadie atiende «Incendio / rescate»: falta una unidad de tipo bomberos."]))
        acts = {a["action"] for a in out["actions"]}
        self.assertEqual(acts, {"otro_modelo", "mas_datos"})
        self.assertEqual(out["decision"], "mas_datos")

    def test_accessibility_stale_collaborative_source_and_big_drop(self):
        out = jev.evaluate(acc_run())
        acts = {a["action"] for a in out["actions"]}
        self.assertIn("mas_datos", acts)
        self.assertIn("otro_modelo", acts)
        self.assertTrue(any("descargada hace" in f["text"] for f in out["facts"]))

    def test_compare_flags_technical_ties(self):
        a, b, c = ops_run(80, 10, rid="a"), ops_run(77, 10, rid="b"), ops_run(40, 4, rid="c")
        out = jev.compare([a, b, c])
        self.assertEqual(out["ranking"], ["a", "b", "c"])
        self.assertEqual(out["ties"], ["b"])
        self.assertEqual(out["decision"], "revision_humana")
        clear = jev.compare([ops_run(90, 4, rid="x"), ops_run(50, 4, rid="y")])
        self.assertEqual(clear["ties"], [])

    def test_external_adapter_must_respect_contract(self):
        with patch.object(config, "setting", lambda k, d="": "http://127.0.0.1:9/jev" if k == "jev_url" else d):
            out = jev.evaluate(ops_run())
        self.assertEqual(out["engine"], reference.ENGINE)
        self.assertIn("fallback", out)


class NotifyTest(unittest.TestCase):
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

    def test_types_predictive_requires_uncertainty_and_dedupe(self):
        with self.assertRaises(ValueError):
            notify.emit("predictivo", "x")
        with self.assertRaises(ValueError):
            notify.emit("rumor", "x")
        self.assertIsNotNone(notify.emit("tecnico", "Capa caída", dedupe="tec:a"))
        self.assertIsNone(notify.emit("tecnico", "Capa caída", dedupe="tec:a"), "no repite el mismo aviso")
        notify.emit("predictivo", "JEV", uncertainty="alta", facts=[{"n": 1, "text": "x"}])
        out = api.route_get("/api/v1/notifications", {})
        self.assertEqual(out["unread"], 2)
        self.assertEqual(out["items"][0]["type"], "predictivo")
        self.assertEqual(len(api.route_get("/api/v1/notifications", {"type": ["tecnico"]})["items"]), 1)
        api.route_post("/api/v1/notifications/read", {"all": True})
        self.assertEqual(api.route_get("/api/v1/notifications", {})["unread"], 0)

    def test_scenario_save_emits_activity(self):
        api.route_post("/api/v1/sim/scenarios", {"name": "Base", "spec": {"engine": "operations"}})
        items = api.route_get("/api/v1/notifications", {})["items"]
        self.assertEqual(items[0]["type"], "actividad")
        self.assertIn("Base", items[0]["title"])


if __name__ == "__main__":
    unittest.main()

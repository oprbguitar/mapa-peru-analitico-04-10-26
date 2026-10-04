"""Pruebas de núcleo (sin red). Ejecutar: python -m unittest discover -s tests -v"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from peru_intel import config  # noqa: E402
from peru_intel.ai import verifier  # noqa: E402
from peru_intel.util import miniyaml  # noqa: E402
from peru_intel.storage import warehouse  # noqa: E402

HAS_DATA = warehouse.has("sidpol_denuncias") and warehouse.has("poblacion")


class MiniYamlTest(unittest.TestCase):
    def test_nested_and_lists(self):
        doc = miniyaml.loads("""
a: 1
b:
  c: hola  # comentario
  d: 0.25
items:
  - id: x
    w: 0.5
  - id: y
    w: 0.5
flag: false
""")
        self.assertEqual(doc["a"], 1)
        self.assertEqual(doc["b"], {"c": "hola", "d": 0.25})
        self.assertEqual([i["id"] for i in doc["items"]], ["x", "y"])
        self.assertIs(doc["flag"], False)

    def test_index_spec_weights_sum_to_one(self):
        spec = miniyaml.load(ROOT / "config" / "crime_index_v1.yaml")
        self.assertFalse(spec["official"])
        self.assertAlmostEqual(sum(v["weight"] for v in spec["variables"]), 1.0)


class VerifierTest(unittest.TestCase):
    FACTS = [
        {"id": "F1", "label": "Denuncias", "value": 352778, "unit": "denuncias", "period": "2025"},
        {"id": "F2", "label": "Tasa", "value": 3077.8, "unit": "por 100 mil hab.", "period": "2025"},
        {"id": "F3", "label": "Cambio", "value": -11.1, "unit": "%", "period": "2025"},
    ]

    def test_supported_numbers_pass_in_both_formats(self):
        r = verifier.verify("En 2025 hubo 352 778 denuncias [F1], 3 077,8 por 100 mil [F2] y una caída de 11.1 % [F3].", self.FACTS)
        self.assertEqual(r["status"], "VERIFICADO", r)

    def test_invented_number_is_flagged(self):
        r = verifier.verify("Se registraron 400 000 denuncias [F1].", self.FACTS)
        self.assertEqual(r["status"], "NO VERIFICADO")

    def test_unknown_citation_and_causality_flagged(self):
        r = verifier.verify("La caída se debe a la policía [F9].", self.FACTS)
        probs = r["sentences"][0]["problems"]
        self.assertTrue(any("cita inexistente" in p for p in probs))
        self.assertTrue(any("causalidad" in p for p in probs))

    def test_empty_text_is_not_verified(self):
        self.assertEqual(verifier.verify("", self.FACTS)["status"], "SIN TEXTO")


class HarvesterTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = (config.DATA, config.RAW, config.CATALOG)
        config.DATA = Path(self.tmp.name)
        config.RAW = config.DATA / "raw"
        config.CATALOG = config.DATA / "catalog"
        from peru_intel.storage import sqlite_store
        sqlite_store._LOCAL.__dict__.clear()

    def tearDown(self):
        from peru_intel.storage import sqlite_store
        con = getattr(sqlite_store._LOCAL, "con", None)
        if con:
            con.close()
        sqlite_store._LOCAL.__dict__.clear()
        config.DATA, config.RAW, config.CATALOG = self.old
        self.tmp.cleanup()

    def test_snapshots_are_immutable_and_deduplicated(self):
        from peru_intel.sources import harvester
        src = Path(self.tmp.name) / "in.csv"
        src.write_text("a,b\n1,2\n", encoding="utf-8")
        s1 = harvester.import_local("prueba", src, "datos.csv")
        s2 = harvester.import_local("prueba", src, "datos.csv")
        self.assertEqual(s1.sha256, s2.sha256)
        self.assertTrue(s2.reused, "un archivo idéntico no debe duplicarse")
        src.write_text("a,b,c\n1,2,3\n", encoding="utf-8")
        s3 = harvester.import_local("prueba", src, "datos.csv")
        self.assertNotEqual(s3.path, s1.path, "contenido distinto nunca sobrescribe el snapshot anterior")
        self.assertTrue(s1.path.exists())
        self.assertTrue(s3.schema_changed, "cambio de cabecera CSV debe detectarse")


@unittest.skipUnless(HAS_DATA, "requiere data/parquet (python -m peru_intel ingest all)")
class CrimeMetricsTest(unittest.TestCase):
    def test_no_redistribution_district_sum_equals_department(self):
        from peru_intel.analytics import crime
        dep = {r["ubigeo"]: r["count"] for r in crime.sidpol_choropleth("departamento", 2025, "1-12")["rows"]}
        dist = crime.sidpol_choropleth("distrito", 2025, "1-12")["rows"]
        total_cusco = sum(r["count"] for r in dist if r["ubigeo"].startswith("08"))
        self.assertEqual(total_cusco, dep["08"])

    def test_rate_formula(self):
        from peru_intel.analytics import crime
        row = next(r for r in crime.sidpol_choropleth("departamento", 2025, "1-12")["rows"] if r["ubigeo"] == "15")
        self.assertAlmostEqual(row["rate"], round(row["count"] / row["population"] * 100000, 1))

    def test_regional_only_indicator_not_offered_at_district(self):
        from peru_intel.analytics import crime
        r = crime.indicator_choropleth(10, "distrito")
        self.assertFalse(r["available"])

    def test_index_is_reproducible_and_bounded(self):
        from peru_intel.analytics import index
        a = index.compute()
        index.clear_cache()
        b = index.compute()
        self.assertEqual(a["spec_sha256"], b["spec_sha256"])
        self.assertEqual([r["score"] for r in a["regions"]], [r["score"] for r in b["regions"]])
        for r in a["regions"]:
            if r["score"] is not None:
                self.assertTrue(0 <= r["score"] <= 100)
                self.assertAlmostEqual(sum(c["points"] for c in r["components"]), r["score"], delta=0.1)


@unittest.skipUnless((config.PERU / "boundaries" / "distritos.geojson").exists(), "requiere data/peru")
class TerritoryTest(unittest.TestCase):
    def test_point_in_lima_district(self):
        from peru_intel.map import territory
        d = territory.district_at(-12.0464, -77.0428)  # Plaza Mayor de Lima
        self.assertIsNotNone(d)
        self.assertEqual(d["u"][:4], "1501")


class ApiSecurityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from http.server import ThreadingHTTPServer
        from peru_intel.backend.server import Handler
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.port = cls.srv.server_port
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def _req(self, path, data=None, headers=None):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=data, headers=headers or {},
                                     method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_cross_origin_post_rejected(self):
        code, _ = self._req("/api/v1/meta/settings", b"{}", {"Content-Type": "application/json", "Origin": "http://evil.example"})
        self.assertEqual(code, 403)

    def test_post_requires_json(self):
        code, _ = self._req("/api/v1/meta/settings", b"a=1", {"Content-Type": "application/x-www-form-urlencoded"})
        self.assertEqual(code, 415)

    def test_static_path_traversal_blocked(self):
        code, _ = self._req("/../peru_intel/config.py")
        self.assertEqual(code, 404)
        code, _ = self._req("/%2e%2e/data/config.local.json")
        self.assertEqual(code, 404)

    def test_settings_never_return_secrets(self):
        code, body = self._req("/api/v1/meta/settings")
        self.assertEqual(code, 200)
        data = json.loads(body)
        self.assertTrue(all(isinstance(v, bool) for v in data["secrets"].values()))

    def test_health(self):
        code, body = self._req("/api/v1/health")
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(body)["ok"])


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    unittest.main()

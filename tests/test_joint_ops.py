"""Operativos conjuntos: apoyos con procedencia, plan multirregión sin red, tiempos coherentes y costos solo con tarifas."""
import unittest
from unittest import mock

from peru_intel.ingestion import infrastructure
from peru_intel.simulation import joint_ops as j

FAC = [
    {"id": "c1", "cat": "comisaria", "name": "Comisaría A", "lat": -12.05, "lon": -77.04, "kind": "vivo_tercero"},
    {"id": "h1", "cat": "hospital", "name": "Hospital B", "lat": -12.06, "lon": -77.03, "kind": "oficial"},
    {"id": "s1", "cat": "salud", "name": "Posta C", "lat": -12.046, "lon": -77.031, "kind": "oficial"},
    {"id": "a1", "cat": "aeropuerto", "name": "Aeropuerto D", "lat": -12.02, "lon": -77.11, "kind": "vivo_tercero"},
    {"id": "n1", "cat": "base_naval", "name": "Base naval E", "lat": -3.73, "lon": -73.24, "kind": "vivo_tercero"},
    {"id": "c2", "cat": "comisaria", "name": "Comisaría Iquitos", "lat": -3.75, "lon": -73.25, "kind": "vivo_tercero"},
]


def body(**hyp):
    return {"operations": [
        {"id": "op1", "lat": -12.046, "lon": -77.03, "incident": "intervencion",
         "resources": [{"kind": "patrullero", "qty": 2}, {"kind": "ambulancia"}, {"kind": "helicoptero"}, {"kind": "externo"}]},
        {"id": "op2", "lat": -3.74, "lon": -73.25, "incident": "rescate", "start": 30,
         "resources": [{"kind": "marina"}, {"kind": "patrullero", "force_fail": True}]},
    ], "hypothesis": {"routing": "recta", "use_tomtom": False, **hyp}}


@mock.patch.object(j, "all_facilities", lambda: FAC)
class JointOpsTest(unittest.TestCase):
    def test_plan_multirregion_sin_red(self):
        r = j.plan(body())
        self.assertEqual(r["kind"], "estimacion")
        self.assertEqual({o["id"] for o in r["operations"]}, {"op1", "op2"})
        ids = {u["id"]: u for u in r["units"]}
        self.assertNotIn("op1-4", ids)                       # colaboración externa sin origen → aviso, no se inventa
        self.assertTrue(any(w["unit"] == "op1-4" for w in r["warnings"]))
        self.assertEqual(ids["op1-2"]["origin"]["id"], "h1")   # hospital preferido a la posta cercana
        self.assertEqual(ids["op1-3"]["mode"], "aire")
        for u in r["units"]:
            t = u["t"]
            self.assertLessEqual(t["depart"], t["ready"])
            self.assertLessEqual(t["ready"], t["arrive"])
            self.assertLessEqual(t["arrive"], t["leave"])
            self.assertLessEqual(t["leave"], t["back"])
            self.assertLessEqual(u["arrive_p50"], u["arrive_p90"])
            self.assertTrue(u["engine"].startswith("línea recta"))
        self.assertGreaterEqual(ids["op2-1"]["t"]["depart"], 30)   # inicio del operativo 2 respetado

    def test_falla_ensayada_agrega_demora(self):
        r = j.plan(body(fail_delay=40))
        u = next(x for x in r["units"] if x["id"] == "op2-2")
        self.assertTrue(u["failed"])
        self.assertAlmostEqual(u["t"]["arrive"] - u["t"]["ready"], u["travel_min"] + 40, delta=0.2)
        self.assertTrue(any(e["type"] == "falla" for e in r["events"]))

    def test_costo_solo_con_tarifas(self):
        r = j.plan(body())
        self.assertIsNone(r["totals"]["cost"])
        b = body()
        b["tariff"] = {"patrullero": {"km": 1, "persona_hora": 10}}
        r2 = j.plan(b)
        self.assertGreater(r2["totals"]["cost"], 0)
        self.assertEqual(r2["totals"]["cost_by_budget"]["salud"], 0)
        self.assertEqual(r2["totals"]["tariff_origin"], "usuario")
        pat = [u for u in r2["units"] if u["kind"] == "patrullero"]
        self.assertAlmostEqual(sum(u["cost_total"] for u in pat), r2["totals"]["cost_by_budget"]["policia"], places=1)

    def test_aeronave_cobra_solo_horas_de_vuelo(self):
        b = body()
        b["tariff"] = {"helicoptero": {"hora": 100}}
        u = next(x for x in j.plan(b)["units"] if x["kind"] == "helicoptero")
        self.assertLess(u["veh_hours"], u["hours"])
        self.assertAlmostEqual(u["cost"]["vehiculo"], 100 * u["veh_hours"], delta=1.5)

    def test_limites_y_errores(self):
        with self.assertRaises(j.PlanError):
            j.plan({"operations": []})
        with self.assertRaises(j.PlanError):
            j.plan({"operations": [{"id": "x", "lat": "a", "lon": 0}]})

    def test_semilla_reproducible(self):
        a, b = j.plan(body(seed=11)), j.plan(body(seed=11))
        self.assertEqual([u["arrive_p90"] for u in a["units"]], [u["arrive_p90"] for u in b["units"]])

    def test_cercanos_por_categoria(self):
        n = j.nearest(-12.046, -77.03, ["comisaria", "hospital"], 2)
        self.assertEqual(n["by_cat"]["comisaria"][0]["id"], "c1")
        self.assertIn("km", n["by_cat"]["hospital"][0])


class InfraestructuraTest(unittest.TestCase):
    def test_clasificacion(self):
        self.assertEqual(infrastructure.classify({"aeroway": "aerodrome", "name": "Aeropuerto X"}), "aeropuerto")
        self.assertEqual(infrastructure.classify({"aeroway": "aerodrome", "name": "Base Aérea FAP"}), "base_militar")
        self.assertEqual(infrastructure.classify({"military": "naval_base"}), "base_naval")
        self.assertEqual(infrastructure.classify({"landuse": "military", "name": "Capitanía de Puerto"}), "base_naval")
        self.assertEqual(infrastructure.classify({"industrial": "port"}), "puerto")
        self.assertEqual(infrastructure.classify({"amenity": "marketplace"}), "mercado")
        self.assertIsNone(infrastructure.classify({"amenity": "cafe"}))

    def test_normaliza_fuera_del_peru(self):
        els = [{"type": "node", "id": 1, "lat": -12.0, "lon": -77.0, "tags": {"amenity": "marketplace", "name": "M"}},
               {"type": "node", "id": 2, "lat": 4.6, "lon": -74.0, "tags": {"amenity": "marketplace"}}]
        out = infrastructure.normalize(els, locate=lambda lat, lon: {"u": "150101", "n": "Lima"} if lat < 0 else None)
        self.assertEqual([i["id"] for i in out], ["n1"])


if __name__ == "__main__":
    unittest.main()

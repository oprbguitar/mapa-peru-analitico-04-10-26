import unittest

import numpy as np

from peru_intel.simulation import agents as ag

AREA = {"lat": -12.0, "lon": -77.0, "radius_km": 2}
EXACT = {"speed_kmh": 30, "speed_sigma": 0, "circuity": 1.0, "availability": 1.0, "delay_min": [0, 0, 0]}


def body(**kw):
    return {"area": AREA, "base": EXACT, "safe_points": [{"id": "s1", "lat": -12.0, "lon": -77.0}],
            "agents": {"n": 300, "mode": "pie", "horizon_min": 60}, "replications": 2, "seed": 5} | kw


class AgentsTest(unittest.TestCase):
    def test_walk_time_bounded_by_distance(self):
        r = ag.run(body())
        # radio 2 km a 4,5 km/h ≈ 27 min para el más lejano (± variación individual): casi todos llegan antes de 60 min
        self.assertGreater(r["results"]["evacuated_pct"]["60"]["p50"], 95)
        self.assertLess(r["results"]["evacuated_pct"]["10"]["p50"], 60)
        self.assertEqual(r["curve"][0], 0.0)
        self.assertTrue(all(b >= a for a, b in zip(r["curve"], r["curve"][1:])), "curva acumulada no decreciente")
        self.assertEqual(r["kind"], "estimacion")
        self.assertTrue(any("SINTÉTICOS" in a for a in r["assumptions"]))

    def test_congestion_slows_vehicles_near_destination(self):
        free = ag.run(body(agents={"n": 40, "mode": "vehiculo", "horizon_min": 30}))
        jam = ag.run(body(agents={"n": 3000, "mode": "vehiculo", "horizon_min": 30}))
        self.assertGreaterEqual(jam["results"]["t90_min"]["p50"] or 99, free["results"]["t90_min"]["p50"])
        self.assertTrue(jam["replay"]["cells"], "celdas congestionadas para el mapa")

    def test_avoids_blocked_point_and_reports_capacity(self):
        pts = [{"id": "norte", "lat": -11.985, "lon": -77.0, "capacity": 50}, {"id": "sur", "lat": -12.015, "lon": -77.0}]
        wall = [{"id": "t1", "coords": [[-77.03, -11.995], [-76.97, -11.995]]}]   # separa el punto norte del centro
        r = ag.run(body(safe_points=pts, tramos=wall, agents={"n": 400, "mode": "pie", "horizon_min": 60}))
        load = {s["id"]: s["load_p50"] for s in r["safe_points"]}
        self.assertGreater(load["sur"], load["norte"], "se prefiere el punto sin cruzar el tramo")
        self.assertTrue(next(s for s in r["safe_points"] if s["id"] == "norte")["over_capacity"] or load["norte"] <= 50)

    def test_perimeter_and_validation(self):
        poly = [[-77.01, -12.01], [-76.99, -12.01], [-76.99, -11.99]]
        r = ag.run(body(perimeter=poly, replications=1))
        first = np.array([[x[0], x[1]] for x in r["replay"]["frames"][0]])
        from peru_intel.simulation import operations as ops
        self.assertTrue(all(ops.inside(x, y, poly) for x, y in first), "los agentes empiezan dentro del perímetro")
        for bad in ({"safe_points": []}, {"agents": {"mode": "avion"}}, {"agents": {"n": 999999}}):
            with self.assertRaises(ag.SimError):
                ag.normalize(body(**bad))


if __name__ == "__main__":
    unittest.main()

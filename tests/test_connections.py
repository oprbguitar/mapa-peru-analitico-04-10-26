import json
import os
import unittest
from unittest.mock import patch

from peru_intel import config, connections, users
from peru_intel.backend import api
from peru_intel.storage import sqlite_store

SECRET = "sk-super-secreta-123"


def fake_setting(k, d=""):
    return {"tomtom_key": SECRET, "jev_url": "http://127.0.0.1:9900/jev?token=abc"}.get(k, d)


class ConnectionsTest(unittest.TestCase):
    def setUp(self):
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)
        users.current.set(users.PERSONAL)
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)
        self.audit.start()

    def tearDown(self):
        self.audit.stop()
        users.current.set(users.PERSONAL)

    def test_cards_never_expose_secrets_or_url_paths(self):
        with patch.object(config, "setting", fake_setting):
            out = api.route_get("/api/v1/admin/connections", {})
        blob = json.dumps(out, ensure_ascii=False)
        self.assertNotIn(SECRET, blob)
        self.assertNotIn("token=abc", blob, "la dirección no lleva ruta ni consulta")
        tomtom = next(c for c in out["cards"] if c["id"] == "tomtom_traffic")
        self.assertEqual(tomtom["auth"], {"required": True, "configured": True, "setting": "tomtom_key"})
        jevc = next(c for c in out["cards"] if c["id"] == "jev_external")
        self.assertEqual(jevc["address"], "http://127.0.0.1:9900")
        self.assertEqual(out["components"]["interpretacion"]["value"], "jev-externo")

    def test_every_card_has_the_required_fields(self):
        out = connections.cards()
        self.assertGreater(len(out["cards"]), 50)
        for c in out["cards"]:
            for k in ("id", "name", "category", "purpose", "address", "auth", "frequency", "status", "last_sync", "fallback", "used_by"):
                self.assertIn(k, c)
            self.assertIn(c["category"], out["categories"])
        self.assertIn("renipress", out["simulations"]["Tiempo de llegada (S1+S2+S9)"])

    def test_host_strips_path_and_query(self):
        self.assertEqual(connections._host("https://api.x.com/v1/q?key=SECRETO"), "https://api.x.com")
        self.assertIsNone(connections._host(""))

    def test_admin_only(self):
        with patch.object(users, "_load", return_value=[{"id": "u-1", "name": "Beto", "role": "coordinador"}]):
            users.current.set({"id": "u-1", "name": "Beto", "role": "coordinador"})
            with self.assertRaises(users.AuthError) as e:
                api.route_get("/api/v1/admin/connections", {})
        self.assertEqual(e.exception.status, 403)
        with patch.dict(os.environ, {"RENDER": "true"}):
            users.current.set(users.PERSONAL)
            with self.assertRaises(api.ApiError):
                api.route_get("/api/v1/admin/connections", {})

    def test_probe_unknown_is_404_and_offline_is_reported(self):
        with self.assertRaises(api.ApiError) as e:
            api.route_post("/api/v1/admin/connections/no-existe/test", {})
        self.assertEqual(e.exception.status, 404)
        with patch.object(config, "setting", lambda k, d="": "http://127.0.0.1:9/x" if k == "go2rtc_url" else d), \
             patch("peru_intel.notify.emit") as emit:
            r = api.route_post("/api/v1/admin/connections/go2rtc/test", {})
        self.assertFalse(r["ok"])
        self.assertEqual(emit.call_args[0][0], "tecnico", "un fallo de conexión avisa a la administración")


if __name__ == "__main__":
    unittest.main()

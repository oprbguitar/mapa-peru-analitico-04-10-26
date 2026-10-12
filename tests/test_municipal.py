import base64
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from peru_intel import config, municipal, users
from peru_intel.backend import api
from peru_intel.storage import sqlite_store

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * 64).decode()
REAL_DATA = config.DATA


class MunicipalTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.brand = patch.object(municipal, "_dir", lambda: Path(self.tmp.name))   # la marca va a una carpeta temporal
        self.brand.start()
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)
        self.audit.start()
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)
        users.current.set(users.PERSONAL)

    def tearDown(self):
        self.brand.stop()
        self.audit.stop()
        self.tmp.cleanup()

    def test_configure_with_logo_and_validation(self):
        self.assertFalse(api.route_get("/api/v1/municipal", {})["configured"])
        cfg = api.route_post("/api/v1/municipal", {"name": "Municipalidad Distrital de Miraflores", "ubigeo": "150122",
                                                   "responsable": "Gerencia de Seguridad", "logo": f"data:image/png;base64,{PNG}"})
        self.assertTrue(cfg["configured"])
        self.assertTrue(cfg["has_logo"])
        self.assertEqual(cfg["territory"]["nombre"], "Miraflores")
        self.assertEqual(municipal.logo()[1], "image/png")
        for bad in ({"name": "X", "ubigeo": "150122"}, {"name": "Muni Test", "ubigeo": "99"},
                    {"name": "Muni Test", "ubigeo": "150122", "logo": "data:image/png;base64," + base64.b64encode(b"GIF89a....").decode()},
                    {"name": "Muni Test", "ubigeo": "150122", "email": "no-es-correo"}):
            with self.assertRaises(api.ApiError):
                api.route_post("/api/v1/municipal", bad)

    def test_profile_only_published_figures_with_sources(self):
        prof = api.route_get("/api/v1/municipal/profile", {"ubigeo": ["150122"]})
        self.assertEqual(prof["territory"]["nombre"], "Miraflores")
        self.assertTrue(prof["facts"])
        srcs = {p["source_id"] for p in prof["provenance"]}
        for f in prof["facts"]:
            self.assertIn(f["source"], srcs, f"cada cifra tiene su fuente: {f['label']}")

    def test_kit_never_invents_prices(self):
        with self.assertRaises(api.ApiError):
            api.route_get("/api/v1/municipal/kit", {})
        api.route_post("/api/v1/municipal", {"name": "Municipalidad Distrital de Miraflores", "ubigeo": "150122"})
        kit = api.route_get("/api/v1/municipal/kit", {})
        inv = next(p for p in kit["proposal"] if p["item"] == "Inversión")
        self.assertIn("A definir", inv["value"])
        self.assertNotRegex(str(kit), r"S/\s?\d|US\$\s?\d", "sin precios en el kit")
        self.assertGreaterEqual(len(kit["capabilities"]), 8)

    def test_only_settings_role_configures_and_local_only(self):
        with patch.object(users, "_load", return_value=[{"id": "u-2", "name": "Beto", "role": "coordinador"}]):
            users.current.set({"id": "u-2", "name": "Beto", "role": "coordinador"})
            with self.assertRaises(users.AuthError):
                api.route_post("/api/v1/municipal", {"name": "Municipalidad X", "ubigeo": "150122"})
        users.current.set(users.PERSONAL)
        with patch.dict(os.environ, {"RENDER": "true"}):
            self.assertFalse(api.route_get("/api/v1/municipal", {})["configured"])


if __name__ == "__main__":
    unittest.main()

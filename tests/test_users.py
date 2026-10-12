import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch

from peru_intel.storage import sqlite_store
from peru_intel import activities, config, users
from peru_intel.backend import api


class UsersTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(config, "DATA", Path(self.tmp.name))
        self.data.start()
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)   # la auditoría de pruebas no toca el catálogo real
        self.audit.start()
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)
        users._sessions.clear()
        users._fails.clear()
        users.current.set(users.PERSONAL)

    def tearDown(self):
        users.current.set(users.PERSONAL)
        self.data.stop()
        self.audit.stop()
        self.tmp.cleanup()

    def as_user(self, u):
        users.current.set(next(x for x in users._load() if x["id"] == u["id"]))

    def test_personal_mode_then_first_admin(self):
        self.assertFalse(users.enabled())
        self.assertIs(users.resolve(None), users.PERSONAL)
        with self.assertRaises(users.AuthError):
            users.create("Ana", "coordinador", "1234")   # el primero debe ser administrador
        admin = users.create("Ana", "admin", "1234")
        self.assertTrue(users.enabled())
        self.assertIsNone(users.resolve(None), "con usuarios, sin sesión no hay acceso")
        stored = users._load()[0]
        self.assertNotIn("1234", json.dumps(stored), "el PIN nunca se guarda en claro")
        token, u = users.login("ana", "1234")
        self.assertEqual(users.resolve(f"x=1; pi_session={token}")["id"], admin["id"])

    def test_login_throttle_and_roles(self):
        admin = users.create("Ana", "admin", "1234")
        self.as_user(admin)
        coord = users.create("Beto", "coordinador", "5555")
        part = users.create("Cira", "participante", "7777")
        for _ in range(users.MAX_FAILS):
            with self.assertRaises(users.AuthError):
                users.login("Cira", "0000")
        with self.assertRaises(users.AuthError) as e:
            users.login("Cira", "7777")
        self.assertEqual(e.exception.status, 429)
        self.as_user(part)
        with self.assertRaises(users.AuthError) as e:
            api.route_post("/api/v1/sim/accessibility/run", {})
        self.assertEqual(e.exception.status, 403, "un participante no simula")
        with self.assertRaises(users.AuthError):
            api.route_post("/api/v1/meta/settings", {"ollama_model": "x"})
        self.as_user(coord)
        with self.assertRaises(users.AuthError):
            users.listing()   # solo administración gestiona usuarios
        self.as_user(admin)
        with self.assertRaises(users.AuthError):
            users.set_role(admin["id"], "participante")   # debe quedar un administrador

    def test_activities_scope_history_and_notifications(self):
        admin = users.create("Ana", "admin", "1234")
        self.as_user(admin)
        coord = users.create("Beto", "coordinador", "5555")
        p1 = users.create("Cira", "participante", "7777")
        p2 = users.create("Dani", "participante", "8888")
        self.as_user(coord)
        a = api.route_post("/api/v1/activities", {"title": "Revisar cobertura norte", "assignee": p1["id"], "scenario_id": "esc-12345678", "due": "2026-10-20"})
        api.route_post("/api/v1/activities", {"title": "Otra tarea", "assignee": p2["id"]})
        self.as_user(p1)
        mine = api.route_get("/api/v1/activities", {})["items"]
        self.assertEqual([x["id"] for x in mine], [a["id"]], "el participante solo ve lo suyo")
        api.route_post(f"/api/v1/activities/{a['id']}/status", {"status": "en_curso", "note": "empezando"})
        notes = api.route_get("/api/v1/notifications", {})["items"]
        self.assertTrue(any("Nueva actividad" in n["title"] for n in notes), "aviso dirigido al asignado")
        self.as_user(p2)
        with self.assertRaises(users.AuthError):
            api.route_post(f"/api/v1/activities/{a['id']}/status", {"status": "hecha"})
        self.assertFalse(any("Revisar cobertura" in n["title"] for n in api.route_get("/api/v1/notifications", {})["items"]))
        self.as_user(coord)
        hist = next(x for x in api.route_get("/api/v1/activities", {})["items"] if x["id"] == a["id"])["history"]
        self.assertEqual([h["status"] for h in hist], ["pendiente", "en_curso"])
        self.assertTrue(any("En curso" in n["title"] for n in api.route_get("/api/v1/notifications", {})["items"]))


class SessionHttpTest(unittest.TestCase):
    """El servidor real: sin sesión la API responde 401; con cookie de sesión, 200; el cierre la invalida."""

    def setUp(self):
        from http.server import ThreadingHTTPServer
        from peru_intel.backend.server import Handler
        self.tmp = tempfile.TemporaryDirectory()
        self.data = patch.object(config, "DATA", Path(self.tmp.name))
        self.data.start()
        self.audit = patch.object(sqlite_store, "audit", lambda *a, **k: None)   # la auditoría de pruebas no toca el catálogo real
        self.audit.start()
        for k in ("RENDER", "PI_PUBLIC_ACCESS_PASSWORD"):
            os.environ.pop(k, None)
        users.current.set(users.PERSONAL)
        users.create("Ana", "admin", "1234")
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_port}"

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        self.data.stop()
        self.audit.stop()
        self.tmp.cleanup()

    def req(self, path, body=None, cookie=None):
        r = urllib.request.Request(self.base + path, data=json.dumps(body).encode() if body is not None else None,
                                   headers={"Content-Type": "application/json", **({"Cookie": cookie} if cookie else {})})
        try:
            with urllib.request.urlopen(r, timeout=10) as res:
                return res.status, json.loads(res.read() or b"{}"), res.headers.get("Set-Cookie")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}"), None

    def test_session_cookie_gates_api(self):
        self.assertEqual(self.req("/api/v1/sim/engines")[0], 401)
        self.assertEqual(self.req("/api/v1/health")[0], 200)
        self.assertEqual(self.req("/api/v1/auth/login", {"name": "Ana", "pin": "9999"})[0], 401)
        status, body, set_cookie = self.req("/api/v1/auth/login", {"name": "Ana", "pin": "1234"})
        self.assertEqual(status, 200)
        self.assertIn("HttpOnly", set_cookie)
        self.assertIn("SameSite=Strict", set_cookie)
        cookie = set_cookie.split(";")[0]
        self.assertEqual(self.req("/api/v1/auth/me", cookie=cookie)[1]["user"]["name"], "Ana")
        self.assertEqual(self.req("/api/v1/sim/engines", cookie=cookie)[0], 200)
        self.req("/api/v1/auth/logout", {}, cookie=cookie)
        self.assertEqual(self.req("/api/v1/sim/engines", cookie=cookie)[0], 401)


if __name__ == "__main__":
    unittest.main()

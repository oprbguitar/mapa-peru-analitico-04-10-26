"""Pruebas v0.3 (sin red): AI Gateway, voz, cámaras, El Niño, fuentes nuevas, patrones, rutas y descubrimiento.

Ejecutar: python -m unittest discover -s tests -v
"""
from __future__ import annotations

import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from peru_intel.ai import gateway, voice  # noqa: E402
from peru_intel.climate import enso  # noqa: E402
from peru_intel.ingestion import emergencies, institutions, services  # noqa: E402
from peru_intel.storage import sqlite_store  # noqa: E402
from peru_intel.vision import cameras, device, discovery, events  # noqa: E402


class GatewayTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self._path = gateway.PATH
        gateway.PATH = Path(self.tmp.name) / "ai_gateway.json"
        gateway._CIRCUITS.clear()
        self.created: list[str] = []

    def tearDown(self):
        gateway.PATH = self._path
        for k in ("PI_AI_KEY_OPENAI",):
            os.environ.pop(k, None)
        if self.created:
            with sqlite_store.tx() as con:
                con.executemany("DELETE FROM ai_ledger WHERE id = ?", [(i,) for i in self.created])
        self.tmp.cleanup()

    def _doc(self, **patch):
        doc = gateway._default_doc()
        doc["migrated_legacy"] = True
        doc.update(patch)
        gateway.save(doc)
        return doc

    def test_kill_switch_and_off(self):
        self._doc(kill_switch=True)
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.route("analisis_territorial")
        self.assertEqual(e.exception.code, "AI_DISABLED")
        doc = self._doc()
        doc["features"]["analisis_territorial"]["mode"] = "OFF"
        gateway.save(doc)
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.route("analisis_territorial")
        self.assertEqual(e.exception.code, "AI_DISABLED")

    def test_invalid_mode_is_rejected_not_coerced(self):
        doc = self._doc()
        doc["features"]["analisis_territorial"]["mode"] = "REMOTE LOCAL"
        gateway.save(doc)
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.route("analisis_territorial")
        self.assertEqual(e.exception.code, "INVALID_MODE")

    def test_auto_never_enables_paid_provider(self):
        doc = self._doc()
        for p in doc["providers"]:
            p["enabled"] = p["id"] == "openai"
            if p["id"] == "openai":
                p["status"] = "APPROVED"
        gateway.save(doc)
        os.environ["PI_AI_KEY_OPENAI"] = "sk-prueba"
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.route("analisis_territorial")
        reasons = {d["provider"]: d["reason"] for d in e.exception.detail["discarded"]}
        self.assertIn("AUTO no habilita gasto", reasons["openai"])

    def test_privacy_intersection(self):
        doc = self._doc()
        doc["features"]["analisis_territorial"]["data_class"] = "RESTRICTED"
        for p in doc["providers"]:
            p["enabled"] = p["id"] == "openai"
            p["status"] = "APPROVED"
        doc["allow_paid"] = True
        doc["budget"].update(daily_usd=5, monthly_usd=50)
        gateway.save(doc)
        os.environ["PI_AI_KEY_OPENAI"] = "sk-prueba"
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.route("analisis_territorial")
        reasons = {d["provider"]: d["reason"] for d in e.exception.detail["discarded"]}
        self.assertIn("RESTRICTED no permitida", reasons["openai"])

    def test_budget_reservation_is_atomic(self):
        doc = self._doc(allow_paid=True)
        doc["budget"].update(per_request_usd=1, daily_usd=gateway.spend_summary()["day"]["settled_usd"]
                             + gateway.spend_summary()["day"]["pending_usd"] + 1.5, monthly_usd=10_000)
        gateway.save(doc)
        p = next(x for x in doc["providers"] if x["id"] == "openai")
        ok, denied = [], []

        def go():
            try:
                ok.append(gateway.reserve("analisis_territorial", p, 1.0))
            except gateway.GatewayError:
                denied.append(1)
        threads = [threading.Thread(target=go) for _ in range(4)]
        [t.start() for t in threads]
        [t.join() for t in threads]
        self.created += [x for x in ok if x]
        self.assertEqual(len(ok), 1, "solo una reserva cabe en el saldo")
        self.assertEqual(len(denied), 3)

    def test_circuit_breaker(self):
        for _ in range(3):
            gateway.record_result("x", False, "caído")
        self.assertEqual(gateway.circuit("x")["state"], "OPEN")
        gateway.record_result("x", True)
        self.assertEqual(gateway.circuit("x")["state"], "CLOSED")

    def test_admin_validates_modes(self):
        self._doc()
        with self.assertRaises(gateway.GatewayError) as e:
            gateway.admin("feature", {"id": "voz_tts", "mode": "TURBO"})
        self.assertEqual(e.exception.code, "INVALID_MODE")
        r = gateway.admin("feature", {"id": "voz_tts", "mode": "LOCAL"})
        self.assertEqual(r["feature"]["mode"], "LOCAL")


class VoiceTest(unittest.TestCase):
    def test_parser(self):
        a = voice.validate(voice.parse("Ubica El Agustino y infórmame"))
        self.assertEqual([x["name"] for x in a], ["ubicar", "informar"])
        self.assertEqual(a[0]["arguments"]["lugar"], "el agustino")
        a = voice.validate(voice.parse("Ubica Miraflores y enciende las comisarías"))
        self.assertEqual(a[1], {"name": "capa", "arguments": {"nombre": "comisarias", "encender": True}})
        a = voice.validate(voice.parse("traza una ruta de Miraflores a Chosica"))
        self.assertEqual(a[0]["arguments"], {"origen": "miraflores", "destino": "chosica"})
        self.assertEqual(voice.validate(voice.parse("muéstrame denuncias de hurto del año 2024"))[0]["name"], "tema")

    def test_validate_drops_invented_tools(self):
        out = voice.validate([{"name": "borrar_todo", "arguments": {}}, {"name": "capa", "arguments": {"nombre": "misiles"}}])
        self.assertEqual(out, [])

    def test_refuses_people(self):
        r = voice.command("¿quién es el sospechoso del robo?")
        self.assertEqual(r["actions"], [])
        self.assertIn("personas", r["reply"])


class CameraTest(unittest.TestCase):
    def test_only_local_network(self):
        self.assertTrue(cameras.host_allowed("192.168.1.108"))
        self.assertTrue(cameras.host_allowed("10.0.0.5"))
        self.assertFalse(cameras.host_allowed("8.8.8.8"))
        self.assertFalse(cameras.host_allowed("http://evil"))

    def test_password_never_public(self):
        cam = cameras.normalize({"host": "192.168.1.108", "password": "secreta", "n_channels": 8})
        self.assertEqual(len(cam["channels"]), 8)
        pub = cameras.public(cam)
        self.assertNotIn("password", pub)
        self.assertTrue(pub["has_password"])
        self.assertIn("••••••", device.rtsp_url(cam, 3))
        self.assertIn("channel=3&subtype=1", device.rtsp_url(cam, 3))
        self.assertIn("secreta", device.rtsp_url(cam, 3, masked=False))

    def test_dahua_parsers(self):
        self.assertEqual(device.parse_channel_titles("table.ChannelTitle[0].Name=Puerta\ntable.ChannelTitle[1].Name=Patio\n"),
                         [{"ch": 1, "name": "Puerta"}, {"ch": 2, "name": "Patio"}])
        self.assertEqual(device.parse_kv("type=DH-XVR5108HS-X\n")["type"], "DH-XVR5108HS-X")

    def test_event_contract(self):
        ok = events.validate({"event_id": "e1", "camera_id": "c1", "ts": "2026-10-04T10:00:00Z", "class": "vehicle",
                              "location": {"lat": -12.0, "lon": -77.0}, "source": {"node": "n", "model": "yolo"}, "plate": "ABC-123"})
        self.assertIsNone(ok["plate"], "las placas se descartan sin autorización explícita")
        with self.assertRaises(ValueError):
            events.validate({"event_id": "e", "camera_id": "c", "ts": "t", "class": "face", "location": {}, "source": {}})

    def test_onvif_reply(self):
        xml = "<d:XAddrs>http://192.168.1.108/onvif/device_service</d:XAddrs><d:Scopes>onvif://www.onvif.org/name/Dahua " \
              "onvif://www.onvif.org/hardware/DH-XVR5108HS-X</d:Scopes>"
        r = discovery.parse_reply(xml, "192.168.1.108")
        self.assertEqual(r["hardware"], "DH-XVR5108HS-X")
        self.assertEqual(r["vendor_guess"], "dahua")


class SourcesTest(unittest.TestCase):
    def test_enso_parsers(self):
        self.assertEqual(enso.parse_icen("% yy mm ICEN\n2026   7   3.38\n")[0], {"y": 2026, "m": 7, "v": 3.38})
        w = enso.parse_cpc_weekly(" 23SEP2026     25.4 4.7     28.8 3.9     29.7 3.1     29.8 1.1\n 30SEP2026     25.0-0.3     28.8 3.9     29.7 3.1     29.8 1.1")
        self.assertEqual(w[0]["anom12"], 4.7)
        self.assertEqual(w[1]["anom12"], -0.3)
        ev = enso.parse_events("<b>El Ni&ntilde;o Costero</b> 1997 4 1998 8 17 Extraordinario <b>La Ni&ntilde;a Costera</b> 2024 5 2024 7 3 D&eacute;bil ICEN")
        self.assertEqual(ev["nino"][0]["magnitude"], "Extraordinario")
        self.assertEqual(ev["nina"][0]["start"], "2024-05")

    def test_institution_classifier(self):
        self.assertEqual(institutions.classify({"amenity": "police", "name": "Comisaría PNP Santa Teresa"}), "comisaria")
        self.assertEqual(institutions.classify({"amenity": "police", "name": "Serenazgo de La Perla"}), "serenazgo")
        self.assertEqual(institutions.classify({"office": "government", "name": "Fiscalía Provincial Penal"}), "fiscalia")
        self.assertIsNone(institutions.classify({"amenity": "school", "name": "Escuela Fiscal Mixta"}))

    def test_mtc_and_renipress(self):
        mtc = "ID_EMERGENCIA;CODIGO_REPORTE;FECHA_OCURRENCIA;EVENTO;ESTADO_ACTUAL;LATITUD;LONGITUD;FECHA_CIERRE\n" \
              "1;VIALES-1;16/08/2026;Huaico;INTERRUMPIDO;-16.28;-73.44;\n"
        r = emergencies.mtc_rows(mtc)[0]
        self.assertEqual((r["fecha"], r["estado"]), ("2026-08-16", "INTERRUMPIDO"))
        ren = "NOMBRE;CLASIFICACION;INSTITUCION;CATEGORIA;UBIGEO;ESTADO;NORTE;ESTE;TELEFONO\n" \
              "HOSPITAL X;HOSPITALES;MINSA;III-1;150111;ACTIVO;-12.04;-76.99;\nPOSTA Y;PUESTOS;MINSA;I-1;150111;INACTIVO;-12.04;-76.99;\n"
        rows = services.renipress_rows(ren)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["cat"], "hospital")

    def test_indeci_rows(self):
        f = [{"attributes": {"IDE_SINPAD": 1, "FECHA": 1778544000000, "COD_UBIGEO": "150111", "FENOMENO": "huaico",
                             "SAFECTA": 10, "SFALLE": 1}, "geometry": {"x": -77.0, "y": -12.0}}]
        r = emergencies.indeci_rows(f)[0]
        self.assertEqual((r["fecha"], r["fenomeno"], r["fallecidos"]), ("2026-05-12", "HUAICO", 1.0))


class AnalyticsTest(unittest.TestCase):
    def test_densify_uniform(self):
        from peru_intel.analytics import routes
        pts = routes._densify([[-77.0, -12.0], [-77.0, -12.1], [-77.0, -12.2]], 1.0)
        self.assertGreaterEqual(len(pts), 22)
        self.assertAlmostEqual(pts[-1][2], 22.2, delta=0.2)

    def test_gi_star_detects_cluster(self):
        from peru_intel.analytics import patterns
        ids, _ = patterns._centroids()
        if len(ids) < 50:
            self.skipTest("sin paquete territorial")
        vals = {u: 10.0 for u in ids}
        lima = [u for u in ids if u.startswith("1501")]
        for u in lima:
            vals[u] = 100.0
        z = patterns.gi_star(vals)
        self.assertGreater(z[lima[0]], 1.96)


if __name__ == "__main__":
    unittest.main()

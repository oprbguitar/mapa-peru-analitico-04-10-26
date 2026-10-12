import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from peru_intel import config
from peru_intel.vision import cameras as vcams
from peru_intel.vision import live

CAM = {"id": "xvr1", "name": "XVR", "host": "192.168.1.108", "channels": [{"ch": 1, "enabled": True, "lat": -12.0, "lon": -77.0},
                                                                          {"ch": 2, "enabled": False, "lat": None, "lon": None}]}
OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n"
ANSWER = "v=0\r\no=go2rtc 1 1 IN IP4 127.0.0.1\r\ns=-\r\n"


class FakeGo2rtc(BaseHTTPRequestHandler):
    raw = False
    seen = []

    def log_message(self, *a):
        pass

    def do_GET(self):
        body = b"{}" if self.path == "/api" else json.dumps({"pi_xvr1_1": {"producers": [{}], "consumers": []}}).encode()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        FakeGo2rtc.seen.append((self.path, json.loads(self.rfile.read(n))))
        if "src=pi_xvr1_1" not in self.path:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(ANSWER.encode() if FakeGo2rtc.raw else json.dumps({"type": "answer", "sdp": ANSWER}).encode())


class VisionLiveTest(unittest.TestCase):
    def setUp(self):
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), FakeGo2rtc)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{self.srv.server_port}"
        self.p = [patch.object(config, "setting", lambda k, d="": url if k == "go2rtc_url" else d),
                  patch.object(vcams, "get", lambda i: CAM if i == "xvr1" else None),
                  patch.object(vcams, "list_public", lambda: [{"id": "xvr1"}])]
        for x in self.p:
            x.start()
        FakeGo2rtc.raw = False
        FakeGo2rtc.seen = []

    def tearDown(self):
        for x in self.p:
            x.stop()
        self.srv.shutdown()
        self.srv.server_close()

    def test_offer_is_relayed_and_answer_returned(self):
        out = live.webrtc_answer("xvr1", 1, OFFER)
        self.assertEqual(out["sdp"], ANSWER)
        path, body = FakeGo2rtc.seen[0]
        self.assertIn("src=pi_xvr1_1", path)
        self.assertEqual(body, {"type": "offer", "sdp": OFFER})
        FakeGo2rtc.raw = True
        self.assertEqual(live.webrtc_answer("xvr1", 1, OFFER)["sdp"], ANSWER, "acepta respuesta en texto plano")

    def test_rejects_bad_input(self):
        for cam, ch, sdp in (("xvr1", 2, OFFER), ("otro", 1, OFFER), ("xvr1", 1, "hola"), ("xvr1", 1, "v=0" + "x" * 70000)):
            with self.assertRaises(live.LiveError):
                live.webrtc_answer(cam, ch, sdp)

    def test_remote_go2rtc_not_allowed(self):
        with patch.object(config, "setting", lambda k, d="": "http://203.0.113.9:1984" if k == "go2rtc_url" else d):
            with self.assertRaises(live.LiveError):
                live.webrtc_answer("xvr1", 1, OFFER)

    def test_selftest_with_signal(self):
        out = live.selftest()
        states = {s["key"]: s["state"] for s in out["steps"]}
        self.assertEqual(states["go2rtc"], "ok")
        self.assertEqual(states["flujos"], "ok")
        self.assertEqual(states["senal"], "ok")
        self.assertEqual(states["webrtc"], "pendiente", "solo se confirma al abrir el canal en el navegador")
        self.assertTrue(out["ready_for_live"])


if __name__ == "__main__":
    unittest.main()

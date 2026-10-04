"""Embarcaciones AIS (aisstream.io, BYOK) — cliente WebSocket sin dependencias portado de RUC360 capas_vivas.py.

aisstream no admite CORS y exige clave privada: el backend mantiene UNA conexión y el mapa lee
instantáneas. Se vigila el Pacífico sudeste (la costa peruana tiene pocas antenas terrestres) y cada
barco se clasifica por el destino que declara.
"""
from __future__ import annotations

import base64
import json
import os
import socket
import ssl
import struct
import threading
import time

from .. import config
from .worker import Worker

PORTS_PE = ("CALLAO", "PECLL", "PAITA", "PEPAI", "MATARANI", "PEMRI", "ILO", "PEILQ", "CHIMBOTE", "PECHM", "SALAVERRY",
            "PESVY", "PISCO", "PEPIO", "GENERAL SAN MARTIN", "CHANCAY", "PECHY", "BAYOVAR", "PEBAR", "SUPE", "HUACHO",
            "TALARA", "PETYL", "IQUITOS", "PEIQT", "PUCALLPA", "CONCHAN", "HUARMEY")
SHIP_TYPES = [(range(70, 80), "Carga"), (range(80, 90), "Tanquero"), (range(60, 70), "Pasajeros"), (range(30, 31), "Pesquero"),
              (range(31, 33), "Remolcador"), (range(35, 36), "Militar"), (range(36, 38), "Recreo"), (range(50, 60), "Servicio")]
PERU = (-18.6, -81.6, 0.2, -68.4)


class _Stream:
    def __init__(self):
        self.ships: dict[int, dict] = {}
        self.lock = threading.Lock()
        self.thread: threading.Thread | None = None
        self.error = ""
        self.last_demand = 0.0

    def ensure(self) -> None:
        self.last_demand = time.time()
        if not config.setting("aisstream_key"):
            raise RuntimeError("Falta la clave de aisstream.io (configúrala en Fuentes → claves).")
        if not self.thread or not self.thread.is_alive():
            self.thread = threading.Thread(target=self._loop, daemon=True, name="ais-stream")
            self.thread.start()

    def _loop(self) -> None:
        backoff = 5
        while time.time() - self.last_demand < 600:
            try:
                self._session()
                backoff = 5
            except Exception as e:  # noqa: BLE001
                self.error = f"AIS: {e}"[:200]
                time.sleep(backoff)
                backoff = min(backoff * 2, 300)

    def _session(self) -> None:
        host = "stream.aisstream.io"
        raw = socket.create_connection((host, 443), timeout=30)
        s = ssl.create_default_context().wrap_socket(raw, server_hostname=host)
        key = base64.b64encode(os.urandom(16)).decode()
        s.sendall((f"GET /v0/stream HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                   f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: {config.USER_AGENT}\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            x = s.recv(1024)
            if not x:
                raise ConnectionError("sin respuesta del servidor AIS")
            head += x
        if b" 101 " not in head.split(b"\r\n")[0]:
            raise ConnectionError("el servidor AIS rechazó la conexión")
        buf = head.split(b"\r\n\r\n", 1)[1]
        self._send(s, 1, json.dumps({"APIKey": config.setting("aisstream_key"),
                                     "BoundingBoxes": [[[-35.0, -95.0], [10.0, -68.0]]],
                                     "FilterMessageTypes": ["PositionReport", "ShipStaticData", "StandardClassBPositionReport"]}).encode())
        self.error = ""
        s.settimeout(60)
        frag = b""
        while time.time() - self.last_demand < 600:
            op, data, buf = self._read(s, buf)
            if op == 8:
                raise ConnectionError("el servidor AIS cerró la sesión")
            if op == 9:
                self._send(s, 10, data)
                continue
            if op in (0, 1, 2):
                frag += data
                try:
                    self._message(json.loads(frag))
                    frag = b""
                except ValueError:
                    if len(frag) > 2_000_000:
                        frag = b""
        s.close()

    @staticmethod
    def _send(s, op, data):
        m = os.urandom(4)
        n = len(data)
        head = bytes([0x80 | op]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536
                                     else bytes([0x80 | 127]) + struct.pack(">Q", n))
        s.sendall(head + m + bytes(b ^ m[i % 4] for i, b in enumerate(data)))

    @staticmethod
    def _read(s, buf):
        def need(k):
            nonlocal buf
            while len(buf) < k:
                x = s.recv(65536)
                if not x:
                    raise ConnectionError("conexión AIS cortada")
                buf += x
        need(2)
        op, ln = buf[0] & 0x0F, buf[1] & 0x7F
        i = 2
        if ln == 126:
            need(4)
            ln, i = struct.unpack(">H", buf[2:4])[0], 4
        elif ln == 127:
            need(10)
            ln, i = struct.unpack(">Q", buf[2:10])[0], 10
        need(i + ln)
        return op, buf[i:i + ln], buf[i + ln:]

    def _message(self, m: dict) -> None:
        meta = m.get("MetaData") or {}
        mmsi = meta.get("MMSI")
        if not mmsi:
            return
        with self.lock:
            b = self.ships.setdefault(mmsi, {"mmsi": mmsi})
            b["name"] = (meta.get("ShipName") or b.get("name") or "").strip()
            b["lat"], b["lon"] = meta.get("latitude", b.get("lat")), meta.get("longitude", b.get("lon"))
            b["t"] = time.time()
            msg = m.get("Message") or {}
            pr = msg.get("PositionReport") or msg.get("StandardClassBPositionReport")
            if pr:
                b["speed"] = pr.get("Sog")
                b["heading"] = pr.get("TrueHeading") if pr.get("TrueHeading") not in (None, 511) else pr.get("Cog")
            sd = msg.get("ShipStaticData")
            if sd:
                b["destination"] = (sd.get("Destination") or "").strip()
                b["imo"] = sd.get("ImoNumber") or None
                b["type_n"] = sd.get("Type")
                dim = sd.get("Dimension") or {}
                if dim:
                    b["length"] = (dim.get("A") or 0) + (dim.get("B") or 0)

    def rows(self) -> list[dict]:
        cutoff = time.time() - 1800
        with self.lock:
            for k in [k for k, v in self.ships.items() if v.get("t", 0) < cutoff]:
                del self.ships[k]
            rows = [dict(v) for v in self.ships.values() if v.get("lat") is not None]
        s, w, n, e = PERU
        for b in rows:
            t = b.get("type_n") or 0
            b["type"] = next((txt for r, txt in SHIP_TYPES if t in r), "Otro" if t else "Sin dato")
            dest = (b.get("destination") or "").upper()
            in_pe = s - 0.5 <= b["lat"] <= n + 0.5 and w - 0.5 <= b["lon"] <= e + 0.5
            b["direction"] = ("Llega a Perú" if any(p in dest for p in PORTS_PE) else
                              "Sale del Perú" if dest and in_pe else "En aguas peruanas" if in_pe else "Pacífico sudeste")
            b["age_s"] = round(time.time() - b.pop("t", time.time()))
        return rows


STREAM = _Stream()


def fetch() -> dict:
    STREAM.ensure()
    if STREAM.error and not STREAM.ships:
        raise ConnectionError(STREAM.error)
    return {"items": STREAM.rows(), "attribution": "aisstream.io",
            "note": "AIS terrestre comunitario. Se clasifica por el destino declarado por cada barco."}


WORKER = Worker("vessels", "aisstream", interval=20, fetch=fetch, idle_after=600, requires="aisstream_key")

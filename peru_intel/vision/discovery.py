"""Descubrimiento ONVIF (WS-Discovery) en la red local: encuentra grabadores y cámaras que respondan al sondeo.

Los Dahua XVR/NVR responden si ONVIF está activo (Red → ONVIF / Servicios de plataforma). Solo multicast local
(239.255.255.250:3702, TTL 1): no sale de la red.
"""
from __future__ import annotations

import re
import socket
import time
import uuid

PROBE = """<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:{mid}</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>"""


def parse_reply(xml: str, ip: str) -> dict:
    xaddrs = re.search(r"XAddrs>([^<]+)<", xml)
    scopes = re.search(r"Scopes>([^<]+)<", xml)
    sc = (scopes[1] if scopes else "").split()
    pick = lambda key: next((s.rsplit("/", 1)[-1] for s in sc if f"/{key}/" in s), None)  # noqa: E731
    from urllib.parse import unquote
    name, hw = pick("name"), pick("hardware")
    return {"ip": ip, "xaddrs": (xaddrs[1].split() if xaddrs else []), "name": unquote(name) if name else None,
            "hardware": unquote(hw) if hw else None,
            "vendor_guess": "dahua" if re.search(r"dahua|dh-|xvr|nvr", xml, re.I) else "onvif"}


def discover(timeout: float = 2.5) -> list[dict]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
    sock.settimeout(0.4)
    found: dict[str, dict] = {}
    try:
        sock.sendto(PROBE.format(mid=uuid.uuid4()).encode(), ("239.255.255.250", 3702))
        end = time.time() + timeout
        while time.time() < end:
            try:
                data, (ip, _) = sock.recvfrom(65535)
            except socket.timeout:
                continue
            found[ip] = parse_reply(data.decode("utf-8", "replace"), ip)
    except OSError as e:
        return [{"error": f"No se pudo sondear la red: {e}"}]
    finally:
        sock.close()
    return sorted(found.values(), key=lambda d: d["ip"])

"""Búsqueda de grabadores y cámaras en la red local (solo tu red; nada sale a Internet).

1. ONVIF WS-Discovery: sondeo multicast 239.255.255.250:3702 (TTL 1) por CADA interfaz IPv4 del equipo (en Windows con
   VPN o Hyper-V el multicast puede salir por la interfaz equivocada).
2. Barrido de tu subred /24 (solo direcciones privadas): puertos 37777 (servicio propio Dahua), 554 (RTSP) y 80 (web).
   Un equipo con 37777 abierto es casi seguro un Dahua; con 554, un grabador o cámara RTSP.
"""
from __future__ import annotations

import ipaddress
import re
import socket
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import unquote

PROBE = """<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:{mid}</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
<w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>"""
PORTS = (37777, 554, 80)


def parse_reply(xml: str, ip: str) -> dict:
    xaddrs = re.search(r"XAddrs>([^<]+)<", xml)
    scopes = re.search(r"Scopes>([^<]+)<", xml)
    sc = (scopes[1] if scopes else "").split()
    pick = lambda key: next((s.rsplit("/", 1)[-1] for s in sc if f"/{key}/" in s), None)  # noqa: E731
    name, hw = pick("name"), pick("hardware")
    return {"ip": ip, "xaddrs": (xaddrs[1].split() if xaddrs else []), "name": unquote(name) if name else None,
            "hardware": unquote(hw) if hw else None, "how": "ONVIF",
            "vendor_guess": "dahua" if re.search(r"dahua|dh-|xvr|nvr", xml, re.I) else "onvif"}


def local_ipv4() -> list[str]:
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    try:  # interfaz de salida por defecto (no envía paquetes)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return sorted(ip for ip in ips if ipaddress.ip_address(ip).is_private and not ip.startswith("127."))


def onvif(timeout: float = 2.5) -> dict[str, dict]:
    found: dict[str, dict] = {}
    socks = []
    for ip in local_ipv4() or ["0.0.0.0"]:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
            if ip != "0.0.0.0":
                s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(ip))
                s.bind((ip, 0))
            s.settimeout(0.2)
            s.sendto(PROBE.format(mid=uuid.uuid4()).encode(), ("239.255.255.250", 3702))
            socks.append(s)
        except OSError:
            continue
    end = time.time() + timeout
    while time.time() < end and socks:
        for s in socks:
            try:
                data, (ip, _) = s.recvfrom(65535)
                found[ip] = parse_reply(data.decode("utf-8", "replace"), ip)
            except (socket.timeout, OSError):
                continue
    for s in socks:
        s.close()
    return found


def _check(ip: str) -> dict | None:
    open_ports = []
    for p in PORTS:
        try:
            with socket.create_connection((ip, p), timeout=0.35):
                open_ports.append(p)
        except OSError:
            pass
    if 37777 in open_ports or 554 in open_ports:
        return {"ip": ip, "ports": open_ports, "how": "barrido de puertos",
                "vendor_guess": "dahua" if 37777 in open_ports else "rtsp",
                "hardware": "Probable Dahua (puerto 37777)" if 37777 in open_ports else "Grabador o cámara RTSP"}
    return None


def scan_subnets(max_hosts: int = 254) -> list[dict]:
    targets = []
    for ip in local_ipv4():
        net = ipaddress.ip_network(f"{ip}/24", strict=False)
        targets += [str(h) for h in list(net.hosts())[:max_hosts] if str(h) != ip]
    if not targets:
        return []
    with ThreadPoolExecutor(max_workers=96) as pool:
        return [r for r in pool.map(_check, targets) if r]


def discover(timeout: float = 2.5) -> list[dict]:
    try:
        found = onvif(timeout)
    except OSError as e:
        found = {}
        err = f"ONVIF: {e}"
    else:
        err = None
    for r in scan_subnets():
        if r["ip"] in found:
            found[r["ip"]]["ports"] = r["ports"]
        else:
            found[r["ip"]] = r
    out = sorted(found.values(), key=lambda d: tuple(int(x) for x in d["ip"].split(".")))
    return out + ([{"error": err}] if err else [])

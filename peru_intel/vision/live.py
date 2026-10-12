"""Video continuo (plan maestro §7): WebRTC a través de go2rtc, con la foto (~1 s) como respaldo.

El navegador no habla directo con go2rtc (la política de seguridad del visor solo permite conexiones al propio
servidor): la oferta SDP pasa por aquí y se reenvía a go2rtc local, que devuelve la respuesta. El video viaja luego
por WebRTC entre go2rtc y el navegador. Sin go2rtc, el visor usa las fotos del grabador.

`selftest()` arma la lista de verificación para la prueba con el equipo real: qué está listo y qué falta.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from . import cameras as vcams
from . import device as vdev

MAX_SDP = 64_000


class LiveError(ValueError):
    pass


def _opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _base_allowed() -> str:
    base = vdev.go2rtc_base()
    host = urllib.parse.urlparse(base).hostname or ""
    if host not in ("127.0.0.1", "localhost", "::1") and not vcams.host_allowed(host):
        raise LiveError("go2rtc debe estar en esta PC o en la red local")
    return base


def streams() -> dict:
    """Flujos que go2rtc tiene configurados y si alguno tiene productores activos."""
    base = _base_allowed()
    try:
        with _opener().open(f"{base}/api/streams", timeout=3) as r:  # noqa: S310 - go2rtc local validado
            data = json.loads(r.read().decode("utf-8") or "{}")
    except (urllib.error.URLError, OSError, ValueError):
        return {"running": False, "streams": {}}
    return {"running": True, "streams": {k: {"producers": len((v or {}).get("producers") or []),
                                             "consumers": len((v or {}).get("consumers") or [])} for k, v in data.items()}}


def webrtc_answer(cam_id: str, ch: int, offer_sdp: str) -> dict:
    """Reenvía la oferta SDP del navegador a go2rtc y devuelve la respuesta. No toca credenciales."""
    cam = vcams.get(cam_id)
    if not cam or not any(c["ch"] == ch and c["enabled"] for c in cam["channels"]):
        raise LiveError("canal no encontrado o deshabilitado")
    if not isinstance(offer_sdp, str) or not offer_sdp.startswith("v=0") or len(offer_sdp) > MAX_SDP:
        raise LiveError("oferta SDP no válida")
    base = _base_allowed()
    name = vdev.stream_name(cam, ch)
    body = json.dumps({"type": "offer", "sdp": offer_sdp}).encode()
    req = urllib.request.Request(f"{base}/api/webrtc?src={urllib.parse.quote(name)}", data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with _opener().open(req, timeout=8) as r:  # noqa: S310 - go2rtc local validado
            raw = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise LiveError(f"go2rtc respondió {e.code}: ¿el flujo «{name}» está en go2rtc.yaml?") from e
    except (urllib.error.URLError, OSError) as e:
        raise LiveError("go2rtc no responde: ejecútalo con el go2rtc.yaml generado") from e
    try:
        ans = json.loads(raw)
        sdp = ans.get("sdp") if isinstance(ans, dict) else None
    except ValueError:
        sdp = raw if raw.startswith("v=0") else None   # algunas versiones devuelven el SDP en texto plano
    if not sdp:
        raise LiveError("go2rtc no devolvió una respuesta SDP")
    return {"type": "answer", "sdp": sdp, "stream": name}


def selftest() -> dict:
    """Lista de verificación para la prueba con el equipo real (cada paso: ok / pendiente / falla, con la acción)."""
    cams = [vcams.get(c["id"]) for c in vcams.list_public()]
    cams = [c for c in cams if c]
    enabled = [(c, ch) for c in cams for ch in c["channels"] if ch["enabled"]]
    located = [(c, ch) for c, ch in enabled if ch.get("lat") is not None]
    st = vdev.go2rtc_status()
    live = streams() if st["running"] else {"running": False, "streams": {}}
    names = {vdev.stream_name(c, ch["ch"]) for c, ch in enabled}
    configured = names & set(live["streams"])
    producing = {n for n in configured if live["streams"][n]["producers"]}
    step = lambda key, label, state, detail, action="": {"key": key, "label": label, "state": state, "detail": detail, "action": action}  # noqa: E731
    steps = [
        step("grabador", "Grabador o cámara registrada", "ok" if cams else "pendiente",
             f"{len(cams)} equipo(s)" if cams else "Aún no hay equipos", "Cámaras → Buscar en mi red o escribe la IP del XVR"),
        step("canales", "Canales habilitados", "ok" if enabled else "pendiente", f"{len(enabled)} canal(es)", "Marca los canales a usar y guarda"),
        step("ubicados", "Canales ubicados en el mapa", "ok" if enabled and len(located) == len(enabled) else "pendiente",
             f"{len(located)} de {len(enabled)}", "«Ubicar» en cada canal y clic en el mapa"),
        step("go2rtc", "go2rtc en ejecución", "ok" if st["running"] else "pendiente", st["url"],
             "Descarga go2rtc, pulsa «Generar go2rtc.yaml» y ejecútalo"),
        step("flujos", "Flujos cargados en go2rtc", "ok" if names and configured == names else "pendiente" if not st["running"] else "falla",
             f"{len(configured)} de {len(names)} en go2rtc", "Vuelve a generar go2rtc.yaml y reinicia go2rtc"),
        step("senal", "Señal del grabador llegando a go2rtc", "ok" if producing else "pendiente",
             f"{len(producing)} flujo(s) con señal", "Abre un canal en el visor: go2rtc se conecta al pedirlo"),
        step("webrtc", "Video WebRTC en el navegador", "pendiente", "Se verifica al abrir un canal (el visor marca «EN VIVO · WebRTC»)",
             "Abre un canal: si cae a «FOTO», revisa el paso anterior"),
    ]
    return {"steps": steps, "ready_for_live": bool(producing), "go2rtc": st,
            "note": "Sin equipo conectado puedes probar el visor con la señal simulada (rotulada «SIMULADO»)."}

"""Asistente de voz: «ubica», «infórmame», «enciende», «traza una ruta»… (patrón GOdEyes, adaptado).

Tres caminos, todos por el AI Gateway:
  1. Órdenes de texto/voz → intérprete DETERMINISTA en español (rápido, sin modelo, funciona offline) y, si no entiende,
     un modelo con herramientas (función «voz_comandos»: Ollama local primero; de pago solo si está aprobado y con presupuesto).
  2. Voz a texto («voz_stt»): Whisper local, dictado del navegador o un proveedor de pago.
     Texto a voz («voz_tts»): Kokoro local, voz del navegador, OpenAI o ElevenLabs.
  3. Voz a voz en tiempo real («voz_realtime», OpenAI Realtime por WebRTC): el servidor emite una credencial efímera; la
     clave nunca llega al navegador. Las herramientas son las mismas que en (1).

La IA no calcula cifras: las acciones mueven el mapa y los informes los arma el motor de contexto con datos citados.
"""
from __future__ import annotations

import json
import re
import unicodedata
import urllib.error
import urllib.request

from .. import config
from . import gateway

TOOLS_SPEC = [
    ("ubicar", "Mueve el mapa a un lugar del Perú (distrito, provincia, departamento, calle o lugar) y lo selecciona.",
     {"lugar": {"type": "string", "description": "Nombre del lugar, p. ej. «El Agustino» o «Plaza de Armas de Cusco»"}}, ["lugar"]),
    ("informar", "Lee un informe del lugar seleccionado: seguridad, servicios cercanos, emergencias, clima y El Niño.",
     {"tema": {"type": "string", "enum": ["todo", "seguridad", "servicios", "emergencias", "clima", "ninio"]}}, []),
    ("capa", "Enciende o apaga una capa del mapa.",
     {"nombre": {"type": "string", "enum": ["comisarias", "serenazgo", "fiscalias", "judicial", "salud", "emergencias", "vias",
                                            "vuelos", "barcos", "sismos", "clima", "corrientes", "camaras", "satelites", "focos"]},
      "encender": {"type": "boolean"}}, ["nombre"]),
    ("tema", "Cambia el tema del mapa de denuncias (modalidad).",
     {"modalidad": {"type": "string", "enum": ["todas", "Hurto", "Robo", "Estafa", "Extorsión", "Secuestro",
                                               "Violencia contra la mujer e integrantes", "Otros"]}}, ["modalidad"]),
    ("anio", "Muestra el mapa de un año (2018 en adelante).", {"anio": {"type": "integer", "minimum": 2018, "maximum": 2030}}, ["anio"]),
    ("abrir", "Abre un módulo.", {"modulo": {"type": "string", "enum": ["ninio", "camaras", "patrones", "rutas", "admin", "fuentes"]}}, ["modulo"]),
    ("historia_ninio", "Reproduce la historia de un evento El Niño.",
     {"evento": {"type": "string", "enum": ["1982-83", "1997-98", "2017", "2023-24", "2026-27"]}}, ["evento"]),
    ("ruta", "Traza una ruta entre dos lugares y analiza riesgos del trayecto.",
     {"origen": {"type": "string"}, "destino": {"type": "string"}}, ["origen", "destino"]),
    ("vista", "Cambia la vista.", {"modo": {"type": "string", "enum": ["amplia", "normal", "3d", "plano", "noche", "dia", "satelite"]}}, ["modo"]),
]


def tools_openai() -> list[dict]:
    return [{"type": "function", "function": {"name": n, "description": d,
                                              "parameters": {"type": "object", "properties": props, "required": req}}}
            for n, d, props, req in TOOLS_SPEC]


def tools_realtime() -> list[dict]:
    return [{"type": "function", "name": n, "description": d, "parameters": {"type": "object", "properties": props, "required": req}}
            for n, d, props, req in TOOLS_SPEC]


INSTRUCTIONS = """Eres el asistente de voz de «Mapa Perú Analítico». Hablas español de Perú, breve y claro.
Tu trabajo: ubicar lugares en el mapa, encender capas, abrir módulos y leer informes del lugar seleccionado.
Usa siempre las herramientas para actuar. Para informar, llama a «informar» y lee lo que devuelva sin inventar cifras.
Nunca hables de personas concretas ni hagas predicciones sobre individuos; solo territorios y datos agregados.
Si algo no está en los datos, dilo."""


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip(" .¿?¡!")


LAYERS = {"comisaria": "comisarias", "policia": "comisarias", "serenazgo": "serenazgo", "fiscal": "fiscalias", "juzgado": "judicial",
          "judicial": "judicial", "salud": "salud", "hospital": "salud", "posta": "salud", "emergencia": "emergencias",
          "huaico": "emergencias", "via": "vias", "carretera": "vias", "vuelo": "vuelos", "avion": "vuelos", "barco": "barcos",
          "embarcacion": "barcos", "sismo": "sismos", "temblor": "sismos", "clima": "clima", "lluvia": "clima", "corriente": "corrientes",
          "camara": "camaras", "satelite": "satelites", "foco": "focos"}
MODS = {"hurto": "Hurto", "robo": "Robo", "estafa": "Estafa", "extorsion": "Extorsión", "secuestro": "Secuestro",
        "violencia": "Violencia contra la mujer e integrantes", "todas": "todas"}
MODULES = {"nino": "ninio", "ninio": "ninio", "camara": "camaras", "patron": "patrones", "ruta": "rutas", "administra": "admin",
           "configuracion": "admin", "fuente": "fuentes"}


def parse(text: str) -> list[dict]:
    """Intérprete determinista de órdenes frecuentes (español). Devuelve acciones o [] si no entiende."""
    t = _norm(text)
    acts: list[dict] = []
    m = re.search(r"\b(?:ruta|trayecto|como llego|ir)\b.*?\bde(?:sde)?\s+(.+?)\s+(?:a|hasta|hacia)\s+(.+)$", t)
    if m:
        return [{"name": "ruta", "arguments": {"origen": m[1], "destino": m[2]}}]
    m = re.search(r"\b(?:ubica(?:me)?|llevame a|vamos a|ir a|muestrame|busca|ve a|anda a|localiza)\s+(?:en )?(.+)$", t)
    if m and not re.search(r"capa|modulo|denuncia|modalidad|\bano\b|\banio\b|historia", m[1]):
        lugar = re.split(r"\s+y\s+(?:inform|dime|cuentame|que)", m[1])[0]
        acts.append({"name": "ubicar", "arguments": {"lugar": lugar}})
    if re.search(r"\binform\w*|\bdime\b|\bcuentame\b|\bresumen\b|\bque pasa\b|\bcomo esta\b|\breporte\b", t):
        tema = next((v for k, v in (("segur", "seguridad"), ("denuncia", "seguridad"), ("servicio", "servicios"),
                                    ("emergenc", "emergencias"), ("clima", "clima"), ("nino", "ninio")) if k in t), "todo")
        acts.append({"name": "informar", "arguments": {"tema": tema}})
    m = re.search(r"\b(enciende|activa|muestra|prende|apaga|desactiva|oculta|quita)\b\s+(?:la |las |los |el )?(?:capa (?:de )?)?(\w+)", t)
    if m:
        name = next((v for k, v in LAYERS.items() if m[2].startswith(k)), None)
        if name:
            acts.append({"name": "capa", "arguments": {"nombre": name, "encender": m[1] in ("enciende", "activa", "muestra", "prende")}})
    m = re.search(r"\b(?:modalidad|tema|denuncias de|mapa de)\s+(\w+)", t)
    if m and m[1] in MODS:
        acts.append({"name": "tema", "arguments": {"modalidad": MODS[m[1]]}})
    m = re.search(r"\b(?:ano|anio|del)\s+(20[12]\d)\b", t)
    if m:
        acts.append({"name": "anio", "arguments": {"anio": int(m[1])}})
    m = re.search(r"\babre\s+(?:el |la )?(?:modulo (?:de )?)?(?:el |la |las |los )?(\w+)", t)
    if m:
        mod = next((v for k, v in MODULES.items() if m[1].startswith(k)), None)
        if mod:
            acts.append({"name": "abrir", "arguments": {"modulo": mod}})
    m = re.search(r"\bhistoria (?:del? )?(?:nino )?(?:de )?(1982|1983|1997|1998|2017|2023|2026)", t)
    if m:
        ev = {"1982": "1982-83", "1983": "1982-83", "1997": "1997-98", "1998": "1997-98", "2017": "2017", "2023": "2023-24", "2026": "2026-27"}[m[1]]
        acts.append({"name": "historia_ninio", "arguments": {"evento": ev}})
    for k, v in (("vista amplia", "amplia"), ("pantalla completa", "amplia"), ("vista normal", "normal"), ("3d", "3d"),
                 ("modo noche", "noche"), ("modo dia", "dia"), ("satelite", "satelite")):
        if k in t and not any(a["name"] == "capa" for a in acts):
            acts.append({"name": "vista", "arguments": {"modo": v}})
            break
    return acts


def validate(actions: list[dict]) -> list[dict]:
    """Valida nombre y argumentos contra el esquema (defensa ante salidas inventadas)."""
    spec = {n: (props, req) for n, _, props, req in TOOLS_SPEC}
    ok = []
    for a in actions[:6]:
        if a.get("name") not in spec:
            continue
        props, req = spec[a["name"]]
        args = {k: v for k, v in (a.get("arguments") or {}).items() if k in props}
        if any(r not in args for r in req):
            continue
        for k, v in list(args.items()):
            sch = props[k]
            if "enum" in sch and v not in sch["enum"]:
                args.pop(k)
            elif sch.get("type") == "string":
                args[k] = str(v)[:120]
            elif sch.get("type") == "integer":
                try:
                    args[k] = int(v)
                except (TypeError, ValueError):
                    args.pop(k)
        if all(r in args for r in req):
            ok.append({"name": a["name"], "arguments": args})
    return ok


def command(text: str, context: dict | None = None) -> dict:
    text = (text or "").strip()[:400]
    if not text:
        raise gateway.GatewayError("INVALID_REQUEST", "orden vacía")
    if re.search(r"\b(qui[eé]n es|persona|sospechoso|nombre de|dni|rastrea a)\b", text, re.I):
        return {"actions": [], "reply": "Solo analizo territorios y datos agregados; no busco ni evalúo personas.", "engine": "política"}
    acts = validate(parse(text))
    if acts:
        return {"actions": acts, "reply": "", "engine": "intérprete local (sin IA)"}
    sel = (context or {}).get("selection")
    msgs = [{"role": "system", "content": INSTRUCTIONS},
            {"role": "user", "content": f"Selección actual: {json.dumps(sel, ensure_ascii=False) if sel else 'ninguna'}.\nOrden: {text}"}]
    try:
        out = gateway.run_chat("voz_comandos", msgs, tools=tools_openai(), max_tokens=300)
    except gateway.GatewayError as e:
        return {"actions": [], "reply": "No entendí la orden y no hay un modelo disponible para interpretarla.",
                "engine": f"{e.code}", "error": e.as_dict()}
    acts = validate(out["tool_calls"])
    return {"actions": acts, "reply": out["text"].strip()[:600] if not acts else "", "engine": f"{out['provider_name']} · {out['model']}",
            "cost_usd": out["cost_usd"]}


def _multipart(fields: dict, file_field: str, filename: str, data: bytes, mime: str) -> tuple[bytes, str]:
    boundary = "----pi" + __import__("uuid").uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\n"
                 f"Content-Type: {mime}\r\n\r\n".encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def stt(audio: bytes, mime: str) -> dict:
    r = gateway.route("voz_stt", estimate_usd=0.003)
    p = r["provider"]
    if p["adapter"] == "browser":
        gateway.log_route(r, "voz_stt", "browser")
        return {"engine": "browser", "provider": p["id"], "text": None, "note": "El navegador transcribe en el cliente."}
    model = p.get("stt_model") or p.get("model") or "whisper-1"
    body, ctype = _multipart({"model": model, "language": "es", "response_format": "json"}, "file", "voz.webm", audio, mime)
    req = urllib.request.Request(p["base_url"].rstrip("/") + "/audio/transcriptions", data=body, method="POST",
                                 headers={"Content-Type": ctype, **gateway.auth_headers(p)})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            text = json.loads(resp.read()).get("text", "")
    except (OSError, ValueError, urllib.error.URLError) as e:
        gateway.record_result(p["id"], False, str(e))
        gateway.settle(r["reservation"], p, state="RECONCILIATION_PENDING", note=type(e).__name__)
        gateway.log_route(r, "voz_stt", "error", type(e).__name__)
        raise gateway.GatewayError("PROVIDER_UNAVAILABLE", f"{p['name']}: {e}", retryable=True)
    gateway.record_result(p["id"], True)
    secs = max(1.0, len(audio) / 16000)  # estimación conservadora (~128 kbps)
    gateway.settle(r["reservation"], p, audio_s=secs)
    gateway.log_route(r, "voz_stt", "ok")
    return {"engine": p["name"], "provider": p["id"], "text": text.strip(), "local": p["mode"] == "LOCAL"}


def tts(text: str) -> tuple[bytes | None, dict]:
    text = (text or "").strip()[:1200]
    r = gateway.route("voz_tts", estimate_usd=0.003)
    p = r["provider"]
    meta = {"engine": p["name"], "provider": p["id"], "local": p["mode"] == "LOCAL"}
    if p["adapter"] == "browser":
        gateway.log_route(r, "voz_tts", "browser")
        return None, meta | {"browser": True}
    try:
        if p["id"] == "elevenlabs":
            if not p.get("voice"):
                raise gateway.GatewayError("INVALID_REQUEST", "Configura el voice_id de ElevenLabs.")
            req = urllib.request.Request(f"{p['base_url'].rstrip('/')}/text-to-speech/{p['voice']}", method="POST",
                                         data=json.dumps({"text": text, "model_id": p.get("model") or "eleven_multilingual_v2"}).encode(),
                                         headers={"Content-Type": "application/json", "Accept": "audio/mpeg", **gateway.auth_headers(p)})
        else:
            body = {"model": p.get("tts_model") or p.get("model"), "input": text, "voice": p.get("voice") or "alloy", "response_format": "mp3"}
            if p["id"] == "openai":
                body["instructions"] = "Habla en español de Perú, tono sobrio de analista."
            req = urllib.request.Request(p["base_url"].rstrip("/") + "/audio/speech", data=json.dumps(body).encode(), method="POST",
                                         headers={"Content-Type": "application/json", **gateway.auth_headers(p)})
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if p["mode"] == "LOCAL" else urllib.request.build_opener()
        with opener.open(req, timeout=60) as resp:  # noqa: S310
            audio = resp.read()
    except (OSError, ValueError, urllib.error.URLError) as e:
        gateway.record_result(p["id"], False, str(e))
        gateway.settle(r["reservation"], p, state="RECONCILIATION_PENDING", note=type(e).__name__)
        gateway.log_route(r, "voz_tts", "error", type(e).__name__)
        raise gateway.GatewayError("PROVIDER_UNAVAILABLE", f"{p['name']}: {e}", retryable=True)
    gateway.record_result(p["id"], True)
    gateway.settle(r["reservation"], p, audio_s=len(text) / 15)  # ~15 caracteres por segundo hablado
    gateway.log_route(r, "voz_tts", "ok")
    return audio, meta


def realtime_session() -> dict:
    """Credencial efímera para OpenAI Realtime (WebRTC). El presupuesto se reserva por sesión (tope configurable)."""
    doc = gateway.load()
    p = gateway.provider("openai-realtime", doc)
    cap = float((p or {}).get("session_cap_usd") or 0.5)
    r = gateway.route("voz_realtime", estimate_usd=cap)
    p = r["provider"]
    model = p.get("model_mini") if p.get("tier") == "mini" and p.get("model_mini") else p["model"]
    session = {"session": {"type": "realtime", "model": model, "instructions": INSTRUCTIONS,
                           "audio": {"input": {"turn_detection": {"type": "semantic_vad", "eagerness": "low",
                                                                  "create_response": True, "interrupt_response": True}},
                                     "output": {"voice": p.get("voice") or "marin"}},
                           "tools": tools_realtime(), "tool_choice": "auto"}}
    try:
        res = gateway.http_json(p["base_url"].rstrip("/") + "/realtime/client_secrets", session, headers=gateway.auth_headers(p), timeout=30)
    except urllib.error.HTTPError as e:
        gateway.record_result(p["id"], False, f"HTTP {e.code}")
        gateway.settle(r["reservation"], p, state="CANCELLED", note=f"HTTP {e.code}")
        gateway.log_route(r, "voz_realtime", "error", f"HTTP {e.code}")
        raise gateway.GatewayError("PROVIDER_UNAVAILABLE", f"OpenAI Realtime respondió HTTP {e.code}")
    gateway.record_result(p["id"], True)
    gateway.log_route(r, "voz_realtime", "ok")
    return {"value": res.get("value"), "expires_at": res.get("expires_at"), "model": model, "reservation": r["reservation"],
            "calls_url": p["base_url"].rstrip("/") + "/realtime/calls", "session_cap_usd": cap}


def realtime_settle(reservation: str, usage: dict) -> dict:
    p = gateway.provider("openai-realtime")
    usd = gateway.settle(reservation, p, tokens_in=int(usage.get("input_tokens") or 0), tokens_out=int(usage.get("output_tokens") or 0))
    return {"settled_usd": round(usd, 4)}


def connect_origins() -> list[str]:
    """Orígenes extra para la CSP (connect-src) cuando la voz Realtime está habilitada."""
    try:
        doc = gateway.load()
    except Exception:  # noqa: BLE001
        return []
    f = doc["features"].get("voz_realtime") or {}
    p = gateway.provider("openai-realtime", doc)
    if f.get("enabled") and p and p.get("enabled") and not doc.get("kill_switch"):
        from urllib.parse import urlparse
        u = urlparse(p["base_url"])
        return [f"{u.scheme}://{u.netloc}"]
    return []


_ = config

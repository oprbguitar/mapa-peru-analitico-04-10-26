"""AI Gateway (manual EOS «AI Integration Port y AI Gateway», dev-funcy-agents-03-10-26).

La lógica de negocio pide una FUNCIÓN (p. ej. «analisis_territorial», «voz_comandos»); el gateway decide la ruta por
INTERSECCIÓN de políticas, nunca por compensación:

    función habilitada ∩ capacidad ∩ clase de dato ∩ modo/destino ∩ estado aprobado ∩ salud (circuito) ∩ presupuesto

Modos exactos: OFF · LOCAL · LOCAL_REMOTE · CLOUD_API · PRIVATE_CLOUD · HYBRID · AUTO. AUTO es estrategia, no destino:
nunca amplía permisos ni habilita gasto por iniciativa propia (un proveedor de pago solo entra si está aprobado,
habilitado, con clave y con presupuesto reservado). Valor desconocido → INVALID_MODE.

Cuatro estados separados: puerto presente · proveedor habilitado · modelo cargado · función habilitada.
Presupuesto: reserva atómica RESERVED → DISPATCHED → SETTLED (o CANCELLED / RECONCILIATION_PENDING) en SQLite.
Circuitos por proveedor: CLOSED → OPEN (3 fallas seguidas, 60 s) → HALF_OPEN (una prueba).
Toda acción administrativa queda en audit_log con antes/después saneados.

Configuración no secreta: data/ai_gateway.json (local, ignorado por git). Claves: data/config.local.json
(`ai_key_<proveedor>`), nunca vuelven al navegador.
"""
from __future__ import annotations

import copy
import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid

from .. import config
from ..storage import sqlite_store

POLICY_VERSION = "pi-ai-policy-2026-10-04"
MODES = ("OFF", "LOCAL", "LOCAL_REMOTE", "CLOUD_API", "PRIVATE_CLOUD", "HYBRID", "AUTO")
CAPABILITIES = ("TEXT", "AGENT_TOOLS", "EMBEDDINGS", "SPEECH_TO_TEXT", "TEXT_TO_SPEECH", "VOICE_AGENT", "VISION",
                "DOCUMENT_ANALYSIS", "CLASSIFICATION")
DATA_CLASSES = ("PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED")
STATUSES = ("DISCOVERED", "QUARANTINED", "EVALUATING", "APPROVED", "DEPRECATED", "REMOVED")
ADAPTERS = ("ollama", "openai_compatible", "openai_realtime", "browser")
ERRORS = ("AI_DISABLED", "INVALID_REQUEST", "INVALID_MODE", "CAPABILITY_UNSUPPORTED", "PRIVACY_DENIED", "RESOURCE_DENIED",
          "BUDGET_DENIED", "DEADLINE_EXCEEDED", "PROVIDER_UNAVAILABLE", "OUTPUT_INVALID", "CANCELLED", "TOOL_DENIED")
PATH = config.DATA / "ai_gateway.json"
_LOCK = threading.RLock()


class GatewayError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False, detail: dict | None = None):
        super().__init__(message)
        self.code, self.retryable, self.detail = code, retryable, detail or {}

    def as_dict(self) -> dict:
        return {"code": self.code, "message": str(self), "retryable": self.retryable, **({"detail": self.detail} if self.detail else {})}


# ── catálogo por defecto: plantillas; solo Ollama local nace aprobado y habilitado ──────────────
def _p(pid, name, adapter, mode, base, caps, model="", enabled=False, status="QUARANTINED", classes=("PUBLIC",),
       cost=None, voice=None, notes="", key_hint="", extra=None):
    return {"id": pid, "name": name, "adapter": adapter, "mode": mode, "base_url": base, "capabilities": list(caps),
            "model": model, "enabled": enabled, "status": status, "allowed_data_classes": list(classes),
            "cost": cost or {"usd_per_1m_input": 0, "usd_per_1m_output": 0, "usd_per_minute_audio": 0},
            "voice": voice, "notes": notes, "key_hint": key_hint, "last_verified": None, **(extra or {})}


DEFAULT_PROVIDERS = [
    _p("ollama-local", "Ollama (este equipo)", "ollama", "LOCAL", "http://127.0.0.1:11434", ["TEXT", "AGENT_TOOLS", "EMBEDDINGS"],
       enabled=True, status="APPROVED", classes=DATA_CLASSES,
       notes="Modelos locales: los datos no salen del equipo. Recomendado: qwen3 / llama3.x con herramientas."),
    _p("lmstudio-local", "LM Studio / llama.cpp (este equipo)", "openai_compatible", "LOCAL", "http://127.0.0.1:1234/v1",
       ["TEXT", "AGENT_TOOLS"], classes=DATA_CLASSES, notes="Servidor local compatible OpenAI."),
    _p("whisper-local", "Whisper local (speaches / faster-whisper-server)", "openai_compatible", "LOCAL", "http://127.0.0.1:8000/v1",
       ["SPEECH_TO_TEXT"], model="Systran/faster-whisper-small", classes=DATA_CLASSES,
       notes="Voz a texto sin Internet. docker run -p 8000:8000 ghcr.io/speaches-ai/speaches:latest-cpu"),
    _p("kokoro-local", "Kokoro TTS local (Kokoro-FastAPI)", "openai_compatible", "LOCAL", "http://127.0.0.1:8880/v1",
       ["TEXT_TO_SPEECH"], model="kokoro", voice="ef_dora", classes=DATA_CLASSES,
       notes="Texto a voz sin Internet (voz en español ef_dora). docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu"),
    _p("browser-tts", "Voz del navegador (speechSynthesis)", "browser", "LOCAL", "", ["TEXT_TO_SPEECH"],
       enabled=True, status="APPROVED", classes=DATA_CLASSES, notes="Voces instaladas en Windows/navegador. Sin costo, sin red."),
    _p("browser-stt", "Dictado del navegador (Web Speech)", "browser", "CLOUD_API", "", ["SPEECH_TO_TEXT"],
       enabled=True, status="APPROVED", classes=("PUBLIC",),
       notes="Chrome/Edge envían el audio al servicio de voz del navegador: solo comandos públicos (clase PUBLIC)."),
    _p("openai", "OpenAI (texto, transcripción y voz)", "openai_compatible", "CLOUD_API", "https://api.openai.com/v1",
       ["TEXT", "AGENT_TOOLS", "SPEECH_TO_TEXT", "TEXT_TO_SPEECH"], model="gpt-5-mini", voice="marin",
       cost={"usd_per_1m_input": 0.25, "usd_per_1m_output": 2.0, "usd_per_minute_audio": 0.015},
       key_hint="platform.openai.com → API keys", extra={"stt_model": "gpt-4o-mini-transcribe", "tts_model": "gpt-4o-mini-tts"}),
    _p("openai-realtime", "OpenAI Realtime (voz a voz, como GOdEyes)", "openai_realtime", "CLOUD_API", "https://api.openai.com/v1",
       ["VOICE_AGENT"], model="gpt-realtime-2", voice="marin",
       cost={"usd_per_1m_input": 32, "usd_per_1m_output": 64, "usd_per_minute_audio": 0.30},
       key_hint="Misma clave que OpenAI", extra={"model_mini": "gpt-realtime-2.1-mini", "tier": "mini", "session_cap_usd": 0.5}),
    _p("openrouter", "OpenRouter (multi-modelo)", "openai_compatible", "CLOUD_API", "https://openrouter.ai/api/v1",
       ["TEXT", "AGENT_TOOLS"], model="qwen/qwen3-30b-a3b", cost={"usd_per_1m_input": 0.1, "usd_per_1m_output": 0.4, "usd_per_minute_audio": 0}),
    _p("groq", "Groq (texto y Whisper rápido)", "openai_compatible", "CLOUD_API", "https://api.groq.com/openai/v1",
       ["TEXT", "AGENT_TOOLS", "SPEECH_TO_TEXT"], model="llama-3.3-70b-versatile",
       cost={"usd_per_1m_input": 0.59, "usd_per_1m_output": 0.79, "usd_per_minute_audio": 0.002}, extra={"stt_model": "whisper-large-v3-turbo"}),
    _p("deepseek", "DeepSeek", "openai_compatible", "CLOUD_API", "https://api.deepseek.com/v1", ["TEXT", "AGENT_TOOLS"],
       model="deepseek-chat", cost={"usd_per_1m_input": 0.27, "usd_per_1m_output": 1.1, "usd_per_minute_audio": 0}),
    _p("gemini", "Google Gemini (endpoint compatible)", "openai_compatible", "CLOUD_API",
       "https://generativelanguage.googleapis.com/v1beta/openai", ["TEXT", "AGENT_TOOLS"], model="gemini-2.5-flash",
       cost={"usd_per_1m_input": 0.3, "usd_per_1m_output": 2.5, "usd_per_minute_audio": 0}),
    _p("elevenlabs", "ElevenLabs (voz de alta calidad)", "openai_compatible", "CLOUD_API", "https://api.elevenlabs.io/v1",
       ["TEXT_TO_SPEECH"], model="eleven_multilingual_v2", voice="", cost={"usd_per_1m_input": 0, "usd_per_1m_output": 0, "usd_per_minute_audio": 0.18},
       notes="Adaptador TTS propio (no OpenAI): /text-to-speech/{voice_id}. Requiere voice_id."),
]

# Funciones del producto → capacidad + clase de dato + modo + orden de proveedores (fallbacks aprobados)
DEFAULT_FEATURES = {
    "analisis_territorial": {"label": "Análisis territorial (ficha)", "capability": "TEXT", "data_class": "PUBLIC", "mode": "AUTO",
                             "enabled": True, "order": ["ollama-local", "lmstudio-local", "openai", "openrouter", "deepseek", "gemini", "groq"]},
    "explicar_ninio": {"label": "Explicación de El Niño", "capability": "TEXT", "data_class": "PUBLIC", "mode": "AUTO", "enabled": True,
                       "order": ["ollama-local", "lmstudio-local", "openai", "openrouter", "deepseek", "gemini", "groq"]},
    "explicar_patrones": {"label": "Explicación de patrones y rutas", "capability": "TEXT", "data_class": "PUBLIC", "mode": "AUTO",
                          "enabled": True, "order": ["ollama-local", "lmstudio-local", "openai", "openrouter", "deepseek", "gemini", "groq"]},
    "voz_comandos": {"label": "Asistente: entender órdenes («ubica…», «infórmame…»)", "capability": "AGENT_TOOLS", "data_class": "PUBLIC",
                     "mode": "AUTO", "enabled": True, "order": ["ollama-local", "lmstudio-local", "openai", "groq", "openrouter", "deepseek", "gemini"]},
    "voz_stt": {"label": "Asistente: voz a texto", "capability": "SPEECH_TO_TEXT", "data_class": "PUBLIC", "mode": "AUTO", "enabled": True,
                "order": ["whisper-local", "browser-stt", "groq", "openai"]},
    "voz_tts": {"label": "Asistente: texto a voz", "capability": "TEXT_TO_SPEECH", "data_class": "PUBLIC", "mode": "AUTO", "enabled": True,
                "order": ["kokoro-local", "browser-tts", "openai", "elevenlabs"]},
    "voz_realtime": {"label": "Asistente de voz en tiempo real (voz a voz)", "capability": "VOICE_AGENT", "data_class": "PUBLIC",
                     "mode": "CLOUD_API", "enabled": False, "order": ["openai-realtime"]},
    "vision_camaras": {"label": "Visión de cámaras propias (descripción de escenas)", "capability": "VISION", "data_class": "CONFIDENTIAL",
                       "mode": "LOCAL", "enabled": False, "order": ["ollama-local"]},
}
DEFAULT_BUDGET = {"currency": "USD", "per_request_usd": 0.05, "daily_usd": 0.0, "monthly_usd": 0.0,
                  "tariff_source": "precios públicos de cada proveedor (ver notas); verificar antes de usar", "tariff_date": "2026-10-04"}


def _default_doc() -> dict:
    return {"version": 1, "policy_version": POLICY_VERSION, "kill_switch": False, "allow_paid": False,
            "providers": copy.deepcopy(DEFAULT_PROVIDERS), "features": copy.deepcopy(DEFAULT_FEATURES),
            "budget": dict(DEFAULT_BUDGET)}


def _migrate_legacy(doc: dict) -> dict:
    """Traslada los ajustes previos (ollama_url, external_*) al registro, una sola vez."""
    if doc.get("migrated_legacy"):
        return doc
    prov = {p["id"]: p for p in doc["providers"]}
    if config.setting("ollama_url"):
        prov["ollama-local"]["base_url"] = config.setting("ollama_url").rstrip("/")
    if config.setting("ollama_model"):
        prov["ollama-local"]["model"] = config.setting("ollama_model")
    if config.setting("external_base_url") and "externo" not in prov:
        doc["providers"].append(_p("externo", "API externa (migrada)", "openai_compatible", "CLOUD_API",
                                   config.setting("external_base_url").rstrip("/"), ["TEXT", "AGENT_TOOLS"],
                                   model=config.setting("external_model"),
                                   enabled=config.setting("ai_allow_external", "false").lower() == "true",
                                   status="EVALUATING", notes="Migrada desde los ajustes anteriores."))
        if config.setting("external_api_key") and not config.setting("ai_key_externo"):
            config.save_local_settings({"ai_key_externo": config.setting("external_api_key")})
        for f in doc["features"].values():
            if f["capability"] in ("TEXT", "AGENT_TOOLS"):
                f["order"].append("externo")
    doc["migrated_legacy"] = True
    return doc


def load() -> dict:
    with _LOCK:
        try:
            doc = json.loads(PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            doc = _default_doc()
        # completar plantillas/funciones nuevas sin pisar lo configurado
        have = {p["id"] for p in doc["providers"]}
        doc["providers"] += [copy.deepcopy(p) for p in DEFAULT_PROVIDERS if p["id"] not in have]
        for k, v in DEFAULT_FEATURES.items():
            doc["features"].setdefault(k, copy.deepcopy(v))
        doc.setdefault("budget", dict(DEFAULT_BUDGET))
        doc = _migrate_legacy(doc)
        return doc


def save(doc: dict) -> None:
    with _LOCK:
        PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = PATH.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, PATH)


def provider(pid: str, doc: dict | None = None) -> dict | None:
    return next((p for p in (doc or load())["providers"] if p["id"] == pid), None)


def api_key(pid: str) -> str:
    return config.setting(f"ai_key_{pid.replace('-', '_')}")


def needs_key(p: dict) -> bool:
    return p["adapter"] in ("openai_compatible", "openai_realtime") and p["mode"] in ("CLOUD_API", "PRIVATE_CLOUD")


def is_paid(p: dict) -> bool:
    c = p.get("cost") or {}
    return any((c.get(k) or 0) > 0 for k in ("usd_per_1m_input", "usd_per_1m_output", "usd_per_minute_audio"))


# ── circuitos ───────────────────────────────────────────────────────────────
_CIRCUITS: dict[str, dict] = {}


def circuit(pid: str) -> dict:
    c = _CIRCUITS.setdefault(pid, {"state": "CLOSED", "failures": 0, "opened_at": 0.0, "last_error": None})
    if c["state"] == "OPEN" and time.time() - c["opened_at"] > 60:
        c["state"] = "HALF_OPEN"
    return c


def record_result(pid: str, ok: bool, error: str | None = None) -> None:
    c = circuit(pid)
    if ok:
        c.update(state="CLOSED", failures=0, last_error=None)
    else:
        c["failures"] += 1
        c["last_error"] = (error or "")[:200]
        if c["state"] == "HALF_OPEN" or c["failures"] >= 3:
            c.update(state="OPEN", opened_at=time.time())


# ── presupuesto ─────────────────────────────────────────────────────────────
def _ensure_ledger() -> None:
    with sqlite_store.tx() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS ai_ledger(id TEXT PRIMARY KEY, at REAL, day TEXT, month TEXT, feature TEXT,
            provider TEXT, model TEXT, state TEXT, reserved_usd REAL, settled_usd REAL, tokens_in INTEGER, tokens_out INTEGER,
            audio_s REAL, note TEXT)""")


def spend_summary() -> dict:
    _ensure_ledger()
    day, month = time.strftime("%Y-%m-%d"), time.strftime("%Y-%m")
    con = sqlite_store.connect()
    q = lambda where, args: con.execute(  # noqa: E731
        f"SELECT coalesce(sum(CASE WHEN state='SETTLED' THEN settled_usd ELSE 0 END),0) settled, "
        f"coalesce(sum(CASE WHEN state IN ('RESERVED','DISPATCHED','RECONCILIATION_PENDING') THEN reserved_usd ELSE 0 END),0) pending "
        f"FROM ai_ledger WHERE {where}", args).fetchone()
    d, m = q("day = ?", (day,)), q("month = ?", (month,))
    recent = [dict(r) for r in con.execute("SELECT id, at, feature, provider, model, state, reserved_usd, settled_usd, tokens_in, "
                                           "tokens_out, note FROM ai_ledger ORDER BY at DESC LIMIT 15")]
    return {"day": {"settled_usd": round(d[0], 4), "pending_usd": round(d[1], 4)},
            "month": {"settled_usd": round(m[0], 4), "pending_usd": round(m[1], 4)}, "recent": recent}


def reserve(feature: str, p: dict, estimate_usd: float) -> str | None:
    """Reserva atómica. Devuelve id de reserva (o None si el proveedor no cobra). Lanza BUDGET_DENIED."""
    if not is_paid(p):
        return None
    doc = load()
    b = doc["budget"]
    if not doc.get("allow_paid"):
        raise GatewayError("BUDGET_DENIED", "Los proveedores de pago están deshabilitados (Administrador → Presupuesto).")
    if estimate_usd > (b.get("per_request_usd") or 0):
        raise GatewayError("BUDGET_DENIED", f"El costo estimado (US$ {estimate_usd:.4f}) supera el tope por solicitud.")
    with _LOCK:
        s = spend_summary()
        if s["day"]["settled_usd"] + s["day"]["pending_usd"] + estimate_usd > (b.get("daily_usd") or 0):
            raise GatewayError("BUDGET_DENIED", "Presupuesto diario agotado o no definido.")
        if s["month"]["settled_usd"] + s["month"]["pending_usd"] + estimate_usd > (b.get("monthly_usd") or 0):
            raise GatewayError("BUDGET_DENIED", "Presupuesto mensual agotado o no definido.")
        rid = uuid.uuid4().hex[:16]
        with sqlite_store.tx() as con:
            con.execute("INSERT INTO ai_ledger VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (rid, time.time(), time.strftime("%Y-%m-%d"), time.strftime("%Y-%m"), feature, p["id"], p.get("model"),
                         "RESERVED", estimate_usd, 0, 0, 0, 0, None))
        return rid


def settle(rid: str | None, p: dict, tokens_in: int = 0, tokens_out: int = 0, audio_s: float = 0, state: str = "SETTLED",
           note: str | None = None) -> float:
    if not rid:
        return 0.0
    c = p.get("cost") or {}
    usd = tokens_in / 1e6 * (c.get("usd_per_1m_input") or 0) + tokens_out / 1e6 * (c.get("usd_per_1m_output") or 0) + \
        audio_s / 60 * (c.get("usd_per_minute_audio") or 0)
    with sqlite_store.tx() as con:
        con.execute("UPDATE ai_ledger SET state=?, settled_usd=?, tokens_in=?, tokens_out=?, audio_s=?, note=? WHERE id=?",
                    (state, round(usd, 6) if state == "SETTLED" else 0, tokens_in, tokens_out, audio_s, note, rid))
    return usd


# ── admisión (intersección) ─────────────────────────────────────────────────
def _mode_allows(feature_mode: str, p: dict) -> bool:
    if feature_mode == "OFF":
        return False
    if feature_mode in ("AUTO", "HYBRID"):
        return True
    return p["mode"] == feature_mode


def route(feature: str, estimate_usd: float = 0.002) -> dict:
    """Devuelve {provider, reservation, discarded[], requested_mode, effective_mode} o lanza GatewayError."""
    doc = load()
    f = doc["features"].get(feature)
    if not f:
        raise GatewayError("INVALID_REQUEST", f"función desconocida: {feature}")
    if f.get("mode") not in MODES:
        raise GatewayError("INVALID_MODE", f"modo inválido: {f.get('mode')}")
    if doc.get("kill_switch"):
        raise GatewayError("AI_DISABLED", "IA detenida por el interruptor general (Administrador).")
    if not f.get("enabled") or f["mode"] == "OFF":
        raise GatewayError("AI_DISABLED", f"La función «{f['label']}» está apagada.")
    discarded = []
    order = f.get("order") or []
    candidates = [provider(pid, doc) for pid in order if provider(pid, doc)]
    for p in candidates:
        why = None
        if not p["enabled"]:
            why = "proveedor deshabilitado"
        elif p["status"] != "APPROVED":
            why = f"estado {p['status']} (requiere APPROVED)"
        elif f["capability"] not in p["capabilities"]:
            why = f"no ofrece {f['capability']}"
        elif f["data_class"] not in p["allowed_data_classes"]:
            why = f"clase {f['data_class']} no permitida"
        elif not _mode_allows(f["mode"], p):
            why = f"modo {p['mode']} fuera de {f['mode']}"
        elif needs_key(p) and not api_key(p["id"]):
            why = "sin clave"
        elif circuit(p["id"])["state"] == "OPEN":
            why = "circuito abierto (fallas recientes)"
        elif is_paid(p) and f["mode"] == "AUTO" and not doc.get("allow_paid"):
            why = "de pago: AUTO no habilita gasto"
        if why:
            discarded.append({"provider": p["id"], "reason": why})
            continue
        try:
            rid = reserve(feature, p, estimate_usd)
        except GatewayError as e:
            discarded.append({"provider": p["id"], "reason": e.code})
            continue
        return {"provider": p, "reservation": rid, "discarded": discarded, "requested_mode": f["mode"],
                "effective_mode": p["mode"], "policy_version": doc["policy_version"], "feature": feature}
    raise GatewayError("PROVIDER_UNAVAILABLE", f"Ninguna ruta admitida para «{f['label']}».", detail={"discarded": discarded})


def log_route(r: dict | None, feature: str, outcome: str, error: str | None = None) -> None:
    sqlite_store.audit("ai-gateway", "route", {"feature": feature, "provider": r["provider"]["id"] if r else None,
                                               "requested": r["requested_mode"] if r else None,
                                               "effective": r["effective_mode"] if r else None,
                                               "discarded": r["discarded"] if r else None, "outcome": outcome, "error": error,
                                               "policy": POLICY_VERSION})


# ── transporte ──────────────────────────────────────────────────────────────
def http_json(url: str, body: dict | None = None, headers: dict | None = None, timeout: float = 120, method: str | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"),
                                 headers={"Content-Type": "application/json", "User-Agent": config.USER_AGENT, **(headers or {})})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({})) if "127.0.0.1" in url or "localhost" in url \
        else urllib.request.build_opener()
    with opener.open(req, timeout=timeout) as r:  # noqa: S310 — endpoint registrado por el administrador
        raw = r.read()
        return json.loads(raw) if raw else {}


def auth_headers(p: dict) -> dict:
    k = api_key(p["id"])
    if not k:
        return {}
    if p["id"] == "elevenlabs":
        return {"xi-api-key": k}
    return {"Authorization": f"Bearer {k}"}


def ollama_model(p: dict) -> str:
    try:
        tags = [m["name"] for m in http_json(p["base_url"].rstrip("/") + "/api/tags", timeout=3).get("models", [])]
    except (OSError, ValueError, urllib.error.URLError):
        return ""
    if p.get("model") and p["model"] in tags:
        return p["model"]
    return tags[0] if tags else ""


def chat(p: dict, messages: list[dict], tools: list[dict] | None = None, max_tokens: int = 900, temperature: float = 0.2,
         timeout: float = 240) -> dict:
    """Llamada de chat normalizada → {text, tool_calls[], tokens_in, tokens_out, model}."""
    if p["adapter"] == "ollama":
        model = ollama_model(p)
        if not model:
            raise GatewayError("PROVIDER_UNAVAILABLE", "Ollama no responde o no tiene modelos instalados.", retryable=True)
        body = {"model": model, "messages": messages, "stream": False, "think": False,
                "options": {"temperature": temperature, "num_predict": max_tokens}}
        if tools:
            body["tools"] = tools
        r = http_json(p["base_url"].rstrip("/") + "/api/chat", body, timeout=timeout)
        msg = r.get("message") or {}
        calls = [{"name": c["function"]["name"], "arguments": c["function"].get("arguments") or {}} for c in msg.get("tool_calls") or []]
        return {"text": msg.get("content") or "", "tool_calls": calls, "tokens_in": r.get("prompt_eval_count") or 0,
                "tokens_out": r.get("eval_count") or 0, "model": model}
    if p["adapter"] == "openai_compatible":
        body = {"model": p["model"], "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        r = http_json(p["base_url"].rstrip("/") + "/chat/completions", body, headers=auth_headers(p), timeout=timeout)
        msg = r["choices"][0]["message"]
        calls = []
        for c in msg.get("tool_calls") or []:
            try:
                args = json.loads(c["function"].get("arguments") or "{}")
            except ValueError:
                raise GatewayError("OUTPUT_INVALID", "El modelo devolvió argumentos de herramienta inválidos.")
            calls.append({"name": c["function"]["name"], "arguments": args})
        u = r.get("usage") or {}
        return {"text": msg.get("content") or "", "tool_calls": calls, "tokens_in": u.get("prompt_tokens") or 0,
                "tokens_out": u.get("completion_tokens") or 0, "model": p["model"]}
    raise GatewayError("CAPABILITY_UNSUPPORTED", f"El adaptador {p['adapter']} no hace chat.")


def run_chat(feature: str, messages: list[dict], tools: list[dict] | None = None, max_tokens: int = 900) -> dict:
    """Puerto de chat: ruta + presupuesto + circuito + liquidación + auditoría."""
    r = route(feature, estimate_usd=0.004)
    p = r["provider"]
    try:
        out = chat(p, messages, tools=tools, max_tokens=max_tokens)
    except GatewayError as e:
        record_result(p["id"], False, str(e))
        settle(r["reservation"], p, state="CANCELLED", note=e.code)
        log_route(r, feature, "error", e.code)
        raise
    except Exception as e:  # noqa: BLE001
        record_result(p["id"], False, str(e))
        settle(r["reservation"], p, state="RECONCILIATION_PENDING", note=f"{type(e).__name__}")
        log_route(r, feature, "error", type(e).__name__)
        raise GatewayError("PROVIDER_UNAVAILABLE", f"{p['name']}: {e}", retryable=True)
    record_result(p["id"], True)
    cost = settle(r["reservation"], p, out["tokens_in"], out["tokens_out"])
    log_route(r, feature, "ok")
    return out | {"provider": p["id"], "provider_name": p["name"], "local": p["mode"] == "LOCAL", "cost_usd": round(cost, 6),
                  "route": {k: r[k] for k in ("requested_mode", "effective_mode", "discarded", "policy_version")}}


# ── recursos del equipo (admisión de carga local) ───────────────────────────
def resources() -> dict:
    out: dict = {"measured_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "method": "ctypes/os + Ollama /api/ps"}
    try:
        if os.name == "nt":
            import ctypes

            class MS(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong), ("ullTotalPhys", ctypes.c_ulonglong),
                            ("ullAvailPhys", ctypes.c_ulonglong), ("ullTotalPageFile", ctypes.c_ulonglong),
                            ("ullAvailPageFile", ctypes.c_ulonglong), ("ullTotalVirtual", ctypes.c_ulonglong),
                            ("ullAvailVirtual", ctypes.c_ulonglong), ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MS()
            m.dwLength = ctypes.sizeof(MS)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            out["ram_total_gb"], out["ram_free_gb"] = round(m.ullTotalPhys / 2**30, 1), round(m.ullAvailPhys / 2**30, 1)
        else:
            pages, avail, size = os.sysconf("SC_PHYS_PAGES"), os.sysconf("SC_AVPHYS_PAGES"), os.sysconf("SC_PAGE_SIZE")
            out["ram_total_gb"], out["ram_free_gb"] = round(pages * size / 2**30, 1), round(avail * size / 2**30, 1)
    except (OSError, ValueError, AttributeError):
        out["ram_total_gb"] = out["ram_free_gb"] = None
    out["cpus"] = os.cpu_count()
    return out


def ollama_state(p: dict) -> dict:
    base = p["base_url"].rstrip("/")
    try:
        tags = http_json(base + "/api/tags", timeout=3).get("models", [])
        ps = http_json(base + "/api/ps", timeout=3).get("models", [])
    except (OSError, ValueError, urllib.error.URLError):
        return {"running": False, "installed": [], "loaded": []}
    return {"running": True,
            "installed": [{"name": m["name"], "size_gb": round((m.get("size") or 0) / 2**30, 2),
                           "family": (m.get("details") or {}).get("family"), "params": (m.get("details") or {}).get("parameter_size"),
                           "quant": (m.get("details") or {}).get("quantization_level")} for m in tags],
            "loaded": [{"name": m["name"], "size_gb": round((m.get("size") or 0) / 2**30, 2),
                        "vram_gb": round((m.get("size_vram") or 0) / 2**30, 2), "expires_at": m.get("expires_at")} for m in ps]}


def health(p: dict) -> dict:
    """Prueba de transporte (no acredita calidad): mide latencia de la operación más barata."""
    t0 = time.time()
    try:
        if p["adapter"] == "ollama":
            ok = bool(ollama_model(p))
            detail = "con modelos instalados" if ok else "sin respuesta o sin modelos"
        elif p["adapter"] == "browser":
            ok, detail = True, "se ejecuta en el navegador"
        elif needs_key(p) and not api_key(p["id"]):
            ok, detail = False, "sin clave"
        elif p["id"] == "elevenlabs":
            http_json(p["base_url"].rstrip("/") + "/voices", headers=auth_headers(p), timeout=15)
            ok, detail = True, "voces disponibles"
        else:
            r = http_json(p["base_url"].rstrip("/") + "/models", headers=auth_headers(p), timeout=15)
            n = len(r.get("data") or [])
            ok, detail = True, f"{n} modelos listados"
    except urllib.error.HTTPError as e:
        ok, detail = False, f"HTTP {e.code}"
    except (OSError, ValueError, urllib.error.URLError) as e:
        ok, detail = False, f"{type(e).__name__}"
    ms = round((time.time() - t0) * 1000)
    record_result(p["id"], ok, None if ok else detail)
    return {"ok": ok, "detail": detail, "latency_ms": ms, "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S")}


# ── vista pública y acciones administrativas ────────────────────────────────
def public_view() -> dict:
    doc = load()
    provs = []
    for p in doc["providers"]:
        provs.append(p | {"has_key": bool(api_key(p["id"])), "needs_key": needs_key(p), "paid": is_paid(p),
                          "circuit": {k: v for k, v in circuit(p["id"]).items() if k != "opened_at"}})
    feats = {}
    for k, f in doc["features"].items():
        try:
            r = route(k, estimate_usd=0) if f.get("enabled") else None
            eff = {"provider": r["provider"]["id"], "mode": r["effective_mode"], "discarded": r["discarded"]} if r else None
            if r and r["reservation"]:
                settle(r["reservation"], r["provider"], state="CANCELLED", note="simulación de ruta")
            err = None
        except GatewayError as e:
            eff, err = None, e.as_dict()
        feats[k] = f | {"effective": eff, "error": err}
    return {"policy_version": doc["policy_version"], "kill_switch": doc["kill_switch"], "allow_paid": doc.get("allow_paid", False),
            "providers": provs, "features": feats, "budget": doc["budget"], "spend": spend_summary(), "resources": resources(),
            "modes": MODES, "capabilities": CAPABILITIES, "data_classes": DATA_CLASSES, "statuses": STATUSES,
            "admin_pin_required": bool(config.setting("admin_pin")), "stored_in": "data/ai_gateway.json · claves en data/config.local.json"}


def _sanitize(p: dict | None) -> dict | None:
    return {k: v for k, v in (p or {}).items() if k not in ("notes",)} if p else None


def admin(action: str, body: dict) -> dict:
    """Acciones: kill · allow_paid · provider · key · feature · budget · test · load · unload · pull · reset."""
    pin = config.setting("admin_pin")
    if pin and str(body.get("pin") or "") != pin:
        raise GatewayError("TOOL_DENIED", "PIN de administrador incorrecto.")
    doc = load()
    before, result = None, {}
    if action == "kill":
        before = doc["kill_switch"]
        doc["kill_switch"] = bool(body.get("on"))
    elif action == "allow_paid":
        before = doc.get("allow_paid")
        doc["allow_paid"] = bool(body.get("on"))
    elif action == "provider":
        p = provider(str(body.get("id")), doc)
        if not p:
            if body.get("create"):
                p = _p(str(body["id"])[:40], str(body.get("name") or body["id"])[:60], body.get("adapter", "openai_compatible"),
                       body.get("mode", "CLOUD_API"), str(body.get("base_url") or ""), body.get("capabilities") or ["TEXT"], status="DISCOVERED")
                doc["providers"].append(p)
            else:
                raise GatewayError("INVALID_REQUEST", "proveedor desconocido")
        before = _sanitize(copy.deepcopy(p))
        for k in ("name", "base_url", "model", "voice", "notes", "stt_model", "tts_model", "model_mini", "tier"):
            if k in body:
                p[k] = str(body[k])[:300]
        if "session_cap_usd" in body:
            p["session_cap_usd"] = max(0.0, float(body["session_cap_usd"]))
        if "enabled" in body:
            p["enabled"] = bool(body["enabled"])
        if "status" in body:
            if body["status"] not in STATUSES:
                raise GatewayError("INVALID_REQUEST", "estado inválido")
            p["status"] = body["status"]
        if "mode" in body:
            if body["mode"] not in MODES or body["mode"] in ("OFF", "AUTO", "HYBRID"):
                raise GatewayError("INVALID_MODE", "un proveedor declara su destino: LOCAL, LOCAL_REMOTE, CLOUD_API o PRIVATE_CLOUD")
            p["mode"] = body["mode"]
        if "capabilities" in body:
            p["capabilities"] = [c for c in body["capabilities"] if c in CAPABILITIES]
        if "allowed_data_classes" in body:
            p["allowed_data_classes"] = [c for c in body["allowed_data_classes"] if c in DATA_CLASSES]
        if "cost" in body and isinstance(body["cost"], dict):
            p["cost"] = {k: max(0.0, float(body["cost"].get(k, p["cost"].get(k, 0)) or 0))
                         for k in ("usd_per_1m_input", "usd_per_1m_output", "usd_per_minute_audio")}
        result = {"provider": _sanitize(p)}
    elif action == "key":
        pid = str(body.get("id") or "")
        if not provider(pid, doc):
            raise GatewayError("INVALID_REQUEST", "proveedor desconocido")
        before = bool(api_key(pid))
        config.save_local_settings({f"ai_key_{pid.replace('-', '_')}": str(body.get("key") or "").strip()})
        result = {"has_key": bool(api_key(pid))}
    elif action == "feature":
        f = doc["features"].get(str(body.get("id")))
        if not f:
            raise GatewayError("INVALID_REQUEST", "función desconocida")
        before = copy.deepcopy(f)
        if "mode" in body:
            if body["mode"] not in MODES:
                raise GatewayError("INVALID_MODE", f"modo inválido: {body['mode']}")
            f["mode"] = body["mode"]
        if "enabled" in body:
            f["enabled"] = bool(body["enabled"])
        if "data_class" in body:
            # endurecer es libre; relajar la clase queda auditado como cambio de privacidad
            if body["data_class"] not in DATA_CLASSES:
                raise GatewayError("INVALID_REQUEST", "clase inválida")
            f["data_class"] = body["data_class"]
        if "order" in body:
            ids = {p["id"] for p in doc["providers"]}
            f["order"] = [x for x in body["order"] if x in ids]
        result = {"feature": f}
    elif action == "budget":
        before = dict(doc["budget"])
        for k in ("per_request_usd", "daily_usd", "monthly_usd"):
            if k in body:
                doc["budget"][k] = max(0.0, float(body[k]))
        result = {"budget": doc["budget"]}
    elif action == "test":
        p = provider(str(body.get("id")), doc)
        if not p:
            raise GatewayError("INVALID_REQUEST", "proveedor desconocido")
        result = health(p)
        p["last_verified"] = result["checked_at"] if result["ok"] else p.get("last_verified")
        if result["ok"] and p["status"] in ("DISCOVERED", "QUARANTINED"):
            p["status"] = "EVALUATING"
    elif action in ("load", "unload"):
        p = provider(str(body.get("id") or "ollama-local"), doc)
        if not p or p["adapter"] != "ollama":
            raise GatewayError("CAPABILITY_UNSUPPORTED", "Cargar/descargar solo aplica a Ollama.")
        model = str(body.get("model") or ollama_model(p))
        if action == "load":
            res = resources()
            size = next((m["size_gb"] for m in ollama_state(p)["installed"] if m["name"] == model), None)
            if size and res.get("ram_free_gb") is not None and size * 1.25 > res["ram_free_gb"] + 0.5:
                raise GatewayError("RESOURCE_DENIED", f"El modelo necesita ~{size * 1.25:.1f} GB y hay {res['ram_free_gb']} GB libres.")
        http_json(p["base_url"].rstrip("/") + "/api/generate", {"model": model, "keep_alive": "10m" if action == "load" else 0,
                                                                "prompt": ""}, timeout=300)
        result = {"model": model, "state": ollama_state(p)}
    elif action == "pull":
        p = provider(str(body.get("id") or "ollama-local"), doc)
        model = str(body.get("model") or "").strip()
        if not p or p["adapter"] != "ollama" or not model:
            raise GatewayError("INVALID_REQUEST", "Indica el modelo de Ollama a descargar.")
        if not body.get("confirm"):
            raise GatewayError("INVALID_REQUEST", "La descarga requiere confirmación explícita (ocupa disco y red).")
        http_json(p["base_url"].rstrip("/") + "/api/pull", {"model": model, "stream": False}, timeout=3600)
        result = {"model": model, "state": ollama_state(p), "status": "EVALUATING: pruébalo antes de usarlo en producción"}
    elif action == "reset":
        before = "config"
        doc = _default_doc()
    else:
        raise GatewayError("INVALID_REQUEST", f"acción desconocida: {action}")
    save(doc)
    sqlite_store.audit("usuario-local", f"ai.admin.{action}", {"before": before, "after": result if action != "key" else result,
                                                               "policy": POLICY_VERSION})
    return {"ok": True, "action": action, **result}

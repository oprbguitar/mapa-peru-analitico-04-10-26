"""Conexiones de modelos e intérpretes guardadas por la persona (BYOK): JEV, asistentes compatibles con OpenAI, Anthropic…

Se guardan en data/config.local.json («model_connections»), nunca en git ni en el navegador: la API pública solo
informa si cada conexión tiene clave. Al «usar» una conexión se copian sus valores a los ajustes que ya leen los
proveedores (external_* para el asistente, jev_url/jev_api_key para JEV), así el resto del sistema no cambia.
"""
from __future__ import annotations

import json
import re
import secrets
import urllib.error
import urllib.request

from .. import config

# id: (etiqueta, rol, base_url sugerida, modelo sugerido)
PRESETS = {
    "jev": ("JEV externo (evaluador)", "jev", "http://127.0.0.1:9900/jev", ""),
    "anthropic": ("Anthropic Claude", "ai", "https://api.anthropic.com/v1", "claude-sonnet-5-5"),
    "openai": ("OpenAI", "ai", "https://api.openai.com/v1", "gpt-4.1-mini"),
    "gemini": ("Google Gemini", "ai", "https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.5-flash"),
    "deepseek": ("DeepSeek", "ai", "https://api.deepseek.com/v1", "deepseek-chat"),
    "groq": ("Groq", "ai", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "openrouter": ("OpenRouter", "ai", "https://openrouter.ai/api/v1", "openrouter/auto"),
    "mistral": ("Mistral", "ai", "https://api.mistral.ai/v1", "mistral-small-latest"),
    "otro": ("Otro compatible con OpenAI", "ai", "", ""),
}
ROLES = {"ai": "Asistente IA", "jev": "Evaluador JEV"}
_KEY = "model_connections"


class ModelKeyError(ValueError):
    pass


def _all() -> list[dict]:
    rows = config.local_settings().get(_KEY)
    return rows if isinstance(rows, list) else []


def _save(rows: list[dict]) -> None:
    config.save_local_settings({_KEY: rows})


def _active() -> dict:
    s = config.local_settings()
    return {"ai": s.get("model_active_ai") or "", "jev": s.get("model_active_jev") or ""}


def public() -> dict:
    """Lo que puede ver el navegador: sin claves, solo si existen."""
    return {"presets": {k: {"label": v[0], "role": v[1], "base_url": v[2], "model": v[3]} for k, v in PRESETS.items()},
            "roles": ROLES, "active": _active(),
            "connections": [{k: r.get(k, "") for k in ("id", "provider", "label", "role", "base_url", "model")} |
                            {"has_key": bool(r.get("api_key"))} for r in _all()],
            "note": "Las claves se guardan en data/config.local.json de este equipo y nunca vuelven al navegador."}


def _clean_url(url: str) -> str:
    url = str(url or "").strip()
    if url and not re.fullmatch(r"https?://[^\s\"'<>]{3,300}", url):
        raise ModelKeyError("La dirección debe empezar por http:// o https://")
    return url.rstrip("/")


def upsert(body: dict) -> dict:
    provider = str(body.get("provider") or "otro")
    if provider not in PRESETS:
        raise ModelKeyError("Proveedor desconocido.")
    label, role, base, model = PRESETS[provider]
    rows = _all()
    cid = str(body.get("id") or "")
    row = next((r for r in rows if r.get("id") == cid), None) if cid else None
    if row is None:
        row = {"id": f"{provider}-{secrets.token_hex(3)}", "provider": provider}
        rows.append(row)
    row["label"] = str(body.get("label") or row.get("label") or label).strip()[:60]
    row["role"] = role
    row["base_url"] = _clean_url(body.get("base_url") or row.get("base_url") or base)
    row["model"] = str(body.get("model") if body.get("model") is not None else row.get("model", model)).strip()[:120] or model
    key = str(body.get("api_key") or "").strip()
    if key:
        row["api_key"] = key[:400]
    if not row["base_url"]:
        raise ModelKeyError("Falta la dirección (URL base) de la API.")
    if role == "ai" and not row["model"]:
        raise ModelKeyError("Indica el modelo a usar.")
    _save(rows)
    if _active()[role] == row["id"]:
        activate(row["id"])  # mantiene sincronizados los ajustes en uso
    return public()


def remove(cid: str) -> dict:
    rows = [r for r in _all() if r.get("id") != cid]
    _save(rows)
    act = _active()
    if act["ai"] == cid:
        config.save_local_settings({"model_active_ai": "", "external_base_url": "", "external_api_key": "", "external_model": "", "external_provider": ""})
    if act["jev"] == cid:
        config.save_local_settings({"model_active_jev": "", "jev_url": "", "jev_api_key": ""})
    return public()


def activate(cid: str) -> dict:
    row = next((r for r in _all() if r.get("id") == cid), None)
    if not row:
        raise ModelKeyError("Conexión no encontrada.")
    if row["role"] == "jev":
        config.save_local_settings({"model_active_jev": cid, "jev_url": row["base_url"], "jev_api_key": row.get("api_key", "")})
    else:
        config.save_local_settings({"model_active_ai": cid, "external_base_url": row["base_url"],
                                    "external_api_key": row.get("api_key", ""), "external_model": row["model"],
                                    "external_provider": row["provider"]})
    return public()


def deactivate(role: str) -> dict:
    if role == "jev":
        config.save_local_settings({"model_active_jev": "", "jev_url": "", "jev_api_key": ""})
    elif role == "ai":
        config.save_local_settings({"model_active_ai": "", "external_base_url": "", "external_api_key": "", "external_model": "", "external_provider": ""})
    return public()


def auth_headers(provider: str, key: str) -> dict:
    if not key:
        return {}
    if provider == "anthropic":  # capa compatible con OpenAI de Anthropic: acepta ambas cabeceras
        return {"Authorization": "Bearer " + key, "x-api-key": key, "anthropic-version": "2023-06-01"}
    return {"Authorization": "Bearer " + key}


def test(cid: str) -> dict:
    """Prueba mínima: lista de modelos (compatibles con OpenAI) o alcance del servicio JEV. No envía datos del mapa."""
    row = next((r for r in _all() if r.get("id") == cid), None)
    if not row:
        raise ModelKeyError("Conexión no encontrada.")
    url = row["base_url"] if row["role"] == "jev" else row["base_url"] + "/models"
    req = urllib.request.Request(url, headers={"User-Agent": config.USER_AGENT, **auth_headers(row["provider"], row.get("api_key", ""))})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:  # noqa: S310 (endpoint elegido por la persona)
            body = r.read(400_000)
        ok = True
        detail = f"HTTP {r.status}"
        try:
            ids = [m.get("id") for m in json.loads(body).get("data", [])][:200]
            if ids:
                detail += f" · {len(ids)} modelos" + ("" if row["role"] == "jev" or row["model"] in ids else f" · «{row['model']}» no aparece en la lista")
        except (ValueError, AttributeError):
            pass
    except urllib.error.HTTPError as e:
        ok = e.code == 405 and row["role"] == "jev"  # JEV solo acepta POST: responde, luego existe
        detail = f"HTTP {e.code}" + (" · la clave no es válida" if e.code in (401, 403) else "")
    except (OSError, ValueError) as e:
        ok, detail = False, f"Sin respuesta: {str(e)[:120]}"
    return {"id": cid, "ok": ok, "detail": detail}

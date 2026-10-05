"""Enrutador de IA híbrida.

Regla por defecto: los datos sensibles se quedan en local (Ollama). Una API externa solo se usa si:
  - el usuario la habilitó (`ai_allow_external = true`), y
  - el paquete de datos es agregado/anónimo (`sensitivity == "aggregate"`).
Los datos de este sistema son estadísticas territoriales agregadas; aun así la decisión queda registrada.

Perfiles (como en RUC360): consulta · análisis · redacción. Hoy las tres etapas usan el mismo motor
elegido; el perfil queda en el registro para poder separarlas más adelante.
"""
from __future__ import annotations

from .. import config
from ..storage import sqlite_store
from .providers import PROVIDERS, Provider

PROFILES = {"consulta": "obtiene datos con herramientas", "analisis": "compara y explica", "redaccion": "redacta la respuesta"}


def choose(sensitivity: str = "aggregate", profile: str = "analisis") -> tuple[Provider | None, str]:
    local = PROVIDERS["ollama"]
    ext = PROVIDERS["external"]
    allow_ext = config.setting("ai_allow_external", "false").lower() == "true"
    if local.available():
        return local, "local (Ollama): opción por defecto"
    if allow_ext and sensitivity == "aggregate" and ext.available():
        return ext, "API externa autorizada: datos agregados y anónimos"
    if ext.available() and not allow_ext:
        return None, "Hay una API externa configurada pero no autorizada (ai_allow_external=false)."
    return None, "Sin modelo disponible: instala Ollama y un modelo, o configura una API compatible."


def log(profile: str, provider: str | None, reason: str, ubigeo: str | None) -> None:
    sqlite_store.audit("ai-router", "route", {"profile": profile, "provider": provider, "reason": reason, "ubigeo": ubigeo})


def status() -> dict:
    """Resumen para la barra de estado; la configuración completa vive en el AI Gateway (/admin/engineering/ai)."""
    from . import gateway
    doc = gateway.load()
    return {"kill_switch": doc["kill_switch"], "allow_paid": doc.get("allow_paid", False),
            "providers": [{"id": p["id"], "local": p["mode"] == "LOCAL", "enabled": p["enabled"], "status": p["status"]}
                          for p in doc["providers"] if p["enabled"]],
            "profiles": PROFILES, "admin": "/api/v1/admin/engineering/ai"}

"""Proveedores de modelos (patrón extraído de RUC360 portal/ia_modelos.py, sin importar RUC360).

  ollama            local, por defecto (http://127.0.0.1:11434)
  openai_compatible cualquier API con el protocolo de chat de OpenAI: OpenAI, OpenRouter, DeepSeek, Qwen,
                    GLM, NVIDIA, Gemini (endpoint compatible)… base_url + api_key + modelo

Ajustes (data/config.local.json o variables PI_*):
  ollama_url, ollama_model, external_base_url, external_api_key, external_model, ai_allow_external (true/false)
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

from .. import config


def _post(url: str, body: dict, headers: dict | None = None, timeout: float = 120) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "User-Agent": config.USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:  # noqa: S310 (endpoint configurado por el usuario)
        return json.loads(r.read())


def _get(url: str, timeout: float = 3) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": config.USER_AGENT}), timeout=timeout) as r:  # noqa: S310
        return json.loads(r.read())


class Provider:
    id = "base"
    local = True

    def available(self) -> bool:
        return False

    def model(self) -> str:
        return ""

    def chat(self, messages: list[dict], max_tokens: int = 900, temperature: float = 0.2) -> str:
        raise NotImplementedError

    def describe(self) -> dict:
        return {"id": self.id, "local": self.local, "available": self.available(), "model": self.model()}


class Ollama(Provider):
    id = "ollama"
    local = True

    def url(self) -> str:
        return config.setting("ollama_url", "http://127.0.0.1:11434").rstrip("/")

    def installed(self) -> list[str]:
        try:
            return [m["name"] for m in _get(self.url() + "/api/tags").get("models", [])]
        except (OSError, ValueError, urllib.error.URLError):
            return []

    def model(self) -> str:
        wanted = config.setting("ollama_model")
        inst = self.installed()
        if wanted and wanted in inst:
            return wanted
        return inst[0] if inst else ""

    def available(self) -> bool:
        return bool(self.model())

    def chat(self, messages, max_tokens=900, temperature=0.2) -> str:
        r = _post(self.url() + "/api/chat", {"model": self.model(), "messages": messages, "stream": False,
                                             "think": False,  # modelos con razonamiento: solo la respuesta
                                             "options": {"temperature": temperature, "num_predict": max_tokens}}, timeout=300)
        return r.get("message", {}).get("content", "")


class OpenAICompatible(Provider):
    id = "external"
    local = False

    def model(self) -> str:
        return config.setting("external_model")

    def available(self) -> bool:
        return bool(config.setting("external_base_url") and config.setting("external_api_key") and self.model())

    def chat(self, messages, max_tokens=900, temperature=0.2) -> str:
        base = config.setting("external_base_url").rstrip("/")
        r = _post(base + "/chat/completions", {"model": self.model(), "messages": messages, "max_tokens": max_tokens,
                                               "temperature": temperature},
                  headers={"Authorization": "Bearer " + config.setting("external_api_key")}, timeout=180)
        return r["choices"][0]["message"]["content"]


PROVIDERS: dict[str, Provider] = {"ollama": Ollama(), "external": OpenAICompatible()}

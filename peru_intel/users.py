"""Usuarios, roles y sesiones locales (plan maestro §8). Solo en la instalación local.

Sin usuarios creados rige el «uso personal» (un administrador implícito): nada cambia para quien trabaja solo.
Al crear el primer administrador, el sistema exige iniciar sesión. PIN con scrypt y sal; sesión por cookie HttpOnly
SameSite=Strict (la gestiona el servidor); intentos limitados por nombre; cada cambio queda en la auditoría.
Roles: administrador (todo) · coordinador (simulación, escenarios, actividades) · participante (sus actividades y avisos).
"""
from __future__ import annotations

import contextvars
import hashlib
import hmac
import json
import re
import secrets
import threading
import time
from datetime import datetime, timezone

from . import config
from .storage import sqlite_store

ROLES = {"admin": "Administrador", "coordinador": "Coordinador", "participante": "Participante"}
PERMS = {
    "admin": {"*"},
    "coordinador": {"sim", "scenarios", "activities.manage", "activities.own", "notifications", "jev"},
    "participante": {"activities.own", "notifications"},
}
PERSONAL = {"id": "local", "name": "Uso personal", "role": "admin", "personal": True}
SESSION_TTL = 12 * 3600
MAX_FAILS, FAIL_WINDOW = 5, 300
NAME = re.compile(r"^[\wáéíóúñÁÉÍÓÚÑüÜ .'-]{2,40}$")
PIN = re.compile(r"^\d{4,12}$")

current: contextvars.ContextVar[dict | None] = contextvars.ContextVar("pi_user", default=PERSONAL)
_lock = threading.Lock()
_sessions: dict[str, tuple[str, float]] = {}
_fails: dict[str, tuple[int, float]] = {}


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _path():
    d = config.DATA / "users"
    d.mkdir(parents=True, exist_ok=True)
    return d / "users.json"


def _load() -> list[dict]:
    try:
        return json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def _save(users: list[dict]) -> None:
    _path().write_text(json.dumps(users, ensure_ascii=False, indent=1), encoding="utf-8")


def _hash(pin: str, salt: bytes) -> str:
    return hashlib.scrypt(pin.encode(), salt=salt, n=2 ** 14, r=8, p=1, dklen=32).hex()


def public(u: dict | None) -> dict | None:
    return None if u is None else {k: u[k] for k in ("id", "name", "role") if k in u} | {"personal": bool(u.get("personal"))}


def enabled() -> bool:
    return bool(_load())


def can(user: dict | None, perm: str) -> bool:
    if user is None:
        return False
    allowed = PERMS.get(user.get("role"), set())
    return "*" in allowed or perm in allowed


def require(perm: str) -> dict:
    u = current.get()
    if u is None:
        raise AuthError(401, "Inicia sesión para continuar")
    if not can(u, perm):
        raise AuthError(403, f"Tu rol ({ROLES.get(u['role'], u['role'])}) no permite esta acción")
    return u


def actor() -> str:
    u = current.get()
    return u["name"] if u else "anónimo"


def resolve(cookie_header: str | None) -> dict | None:
    """Usuario de la petición: uso personal si no hay usuarios; si los hay, el de la sesión o None."""
    users = _load()
    if not users:
        return PERSONAL
    token = None
    for part in (cookie_header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == "pi_session":
            token = v
    with _lock:
        s = _sessions.get(token or "")
        if not s or s[1] < time.time():
            _sessions.pop(token or "", None)
            return None
        uid = s[0]
    return next((u for u in users if u["id"] == uid), None)


def create(name: str, role: str, pin: str) -> dict:
    users = _load()
    first = not users
    if not first:
        require("users")
    name = str(name or "").strip()
    if not NAME.match(name):
        raise AuthError(400, "Nombre: 2 a 40 letras")
    if role not in ROLES:
        raise AuthError(400, "Rol no válido")
    if first and role != "admin":
        raise AuthError(400, "El primer usuario debe ser administrador")
    if not PIN.match(str(pin or "")):
        raise AuthError(400, "PIN: 4 a 12 dígitos")
    if any(u["name"].lower() == name.lower() for u in users):
        raise AuthError(409, "Ya existe un usuario con ese nombre")
    salt = secrets.token_bytes(16)
    u = {"id": f"u-{secrets.token_hex(4)}", "name": name, "role": role, "salt": salt.hex(), "pin": _hash(str(pin), salt),
         "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    with _lock:
        _save(users + [u])
    sqlite_store.audit(actor() if not first else name, "usuario.crear", {"id": u["id"], "name": name, "role": role})
    return public(u)


def login(name: str, pin: str) -> tuple[str, dict]:
    key = str(name or "").strip().lower()
    now = time.time()
    with _lock:
        n, t0 = _fails.get(key, (0, now))
        if n >= MAX_FAILS and now - t0 < FAIL_WINDOW:
            raise AuthError(429, "Demasiados intentos: espera unos minutos")
    u = next((x for x in _load() if x["name"].lower() == key), None)
    ok = bool(u) and hmac.compare_digest(_hash(str(pin or ""), bytes.fromhex(u["salt"])), u["pin"])
    with _lock:
        if not ok:
            n, t0 = _fails.get(key, (0, now))
            _fails[key] = (n + 1, t0 if now - t0 < FAIL_WINDOW else now)
            raise AuthError(401, "Nombre o PIN incorrectos")
        _fails.pop(key, None)
        token = secrets.token_urlsafe(32)
        _sessions[token] = (u["id"], now + SESSION_TTL)
    sqlite_store.audit(u["name"], "sesion.iniciar", {"id": u["id"]})
    return token, public(u)


def logout(cookie_header: str | None) -> None:
    for part in (cookie_header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == "pi_session":
            with _lock:
                _sessions.pop(v, None)


def listing() -> list[dict]:
    require("users")
    return [public(u) | {"created_at": u.get("created_at")} for u in _load()]


def directory() -> list[dict]:
    """Nombres y roles (sin datos sensibles) para asignar actividades."""
    require("activities.manage")
    return [public(u) for u in _load()]


def set_role(uid: str, role: str) -> dict:
    require("users")
    if role not in ROLES:
        raise AuthError(400, "Rol no válido")
    with _lock:
        users = _load()
        u = next((x for x in users if x["id"] == uid), None)
        if not u:
            raise AuthError(404, "Usuario no encontrado")
        if u["role"] == "admin" and role != "admin" and sum(1 for x in users if x["role"] == "admin") == 1:
            raise AuthError(409, "Debe quedar al menos un administrador")
        u["role"] = role
        _save(users)
    sqlite_store.audit(actor(), "usuario.rol", {"id": uid, "role": role})
    return public(u)


def remove(uid: str) -> None:
    require("users")
    with _lock:
        users = _load()
        u = next((x for x in users if x["id"] == uid), None)
        if not u:
            raise AuthError(404, "Usuario no encontrado")
        if u["role"] == "admin" and sum(1 for x in users if x["role"] == "admin") == 1:
            raise AuthError(409, "Debe quedar al menos un administrador")
        _save([x for x in users if x["id"] != uid])
        for t, (sid, _) in list(_sessions.items()):
            if sid == uid:
                _sessions.pop(t, None)
    sqlite_store.audit(actor(), "usuario.eliminar", {"id": uid})


def audiences(user: dict | None) -> tuple[str, ...]:
    """Destinatarios de avisos que ve un usuario: todos, su rol y él mismo (el uso personal ve todo)."""
    if user is None:
        return ()
    if user.get("personal"):
        return ("todos", "rol:admin", "rol:coordinador", "rol:participante", "user:local")
    extra = ("rol:coordinador",) if user["role"] == "admin" else ()   # la administración también supervisa
    return ("todos", f"rol:{user['role']}", f"user:{user['id']}", *extra)

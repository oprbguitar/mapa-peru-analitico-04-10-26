"""Edición municipal (producto para municipalidades, plan maestro fase 8 «Municipio 360»).

- Configuración de marca: nombre de la municipalidad, distrito (ubigeo), responsable y logo (PNG/JPEG ≤ 300 KB).
  Con ella el visor arranca en el distrito, el simulador propone su zona y los informes llevan el encabezado municipal.
- Perfil del distrito: SOLO cifras publicadas con su procedencia (población, denuncias SIDPOL, servicios, comisarías).
- Kit de presentación: capacidades realmente implementadas, requisitos, privacidad y una propuesta con alcance, plazo e
  inversión «a definir»: nunca se inventan precios, métricas de impacto ni testimonios.
"""
from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone

from . import config
from .map import territory
from .sources import registry
from .storage import warehouse

NAME = re.compile(r"^[\wáéíóúñÁÉÍÓÚÑüÜ .,'()-]{3,90}$")
EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,120}\.[a-z]{2,10}$", re.I)
MAX_LOGO = 300_000

CAPABILITIES = [
    ("Mapa territorial con procedencia", "Denuncias SIDPOL, indicadores MININTER, población INEI, servicios RENIPRESS y capas en vivo; cada cifra con fuente, fecha y nivel."),
    ("Simulador «¿qué pasaría si…?»", "Tiempo de llegada a hospitales, centros de salud, bomberos y comisarías ante lluvia, hora punta, huaicos o sedes cerradas."),
    ("Capacidad y colas (S3)", "Llamadas, espera y saturación de sedes con demanda declarada."),
    ("Operativo de mesa", "Unidades de serenazgo, patrulleros, ambulancias y bomberos sobre el mapa, tramos cortados, perímetro y tiempo virtual."),
    ("Evacuación (S4)", "Agentes sintéticos hacia puntos seguros con congestión y capacidad por punto."),
    ("Evaluación JEV", "Incertidumbre, variabilidad y decisión (explorar, más datos, revisión humana) con hechos numerados; nunca probabilidades inventadas."),
    ("Escenarios A/B/C", "Versiones, estados (borrador → revisado), comparación, exportación con huella y actividades asignadas por rol."),
    ("Informes imprimibles", "Resumen ejecutivo, mapa, supuestos, fuentes y limitaciones; recorrido 3D grabado en video para presentaciones."),
    ("Cámaras propias (opcional)", "Grabadores Dahua/ONVIF georreferenciados, video en vivo con go2rtc, sin reconocimiento facial."),
]
REQUIREMENTS = [
    "Instalación local en una PC de la municipalidad: los datos y simulaciones no salen del equipo.",
    "Equipo de referencia probado: Ryzen 7 1700, 16 GB RAM, GTX 1070, Windows; funciona con menos (las simulaciones tardan más).",
    "Conexión a Internet opcional: solo para capas en vivo, mapas base nuevos y actualización de fuentes públicas.",
    "Usuarios con roles (administración, coordinación, participantes) y auditoría de cambios.",
]
PRIVACY = ("Sin reconocimiento facial ni identificación de personas; sin predicción ni ranking de personas. Solo territorios y "
           "agregados (Ley N.° 29733). Las simulaciones son ejercicios de planificación, no órdenes operativas.")


class MunicipalError(ValueError):
    pass


def _dir():
    return config.DATA / "branding"   # se crea solo al guardar: consultar no deja carpetas vacías


def get_config() -> dict:
    try:
        cfg = json.loads((_dir() / "municipal.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"configured": False}
    cfg["configured"] = True
    cfg["has_logo"] = any((_dir() / f"logo.{e}").exists() for e in ("png", "jpg"))
    return cfg


def logo() -> tuple[bytes, str] | None:
    for ext, mime in (("png", "image/png"), ("jpg", "image/jpeg")):
        p = _dir() / f"logo.{ext}"
        if p.exists():
            return p.read_bytes(), mime
    return None


def save_config(body: dict, by: str) -> dict:
    name = str(body.get("name") or "").strip()
    if not NAME.match(name):
        raise MunicipalError("Nombre de la municipalidad: 3 a 90 caracteres")
    ub = str(body.get("ubigeo") or "")
    if len(ub) not in (4, 6) or not ub.isdigit():
        raise MunicipalError("Elige el distrito o la provincia (ubigeo de 4 o 6 dígitos)")
    t = territory.lookup(ub)
    if not t:
        raise MunicipalError("Ubigeo no encontrado en el paquete territorial")
    email = str(body.get("email") or "").strip()
    if email and not EMAIL.match(email):
        raise MunicipalError("Correo no válido")
    cfg = {"name": name, "ubigeo": ub, "territory": {k: t.get(k) for k in ("nivel", "nombre", "provincia", "departamento", "bbox", "lat", "lon") if k in t},
           "responsable": str(body.get("responsable") or "")[:80], "cargo": str(body.get("cargo") or "")[:80], "email": email,
           "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "updated_by": by}
    data_url = body.get("logo")
    if data_url:
        m = re.match(r"^data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)$", str(data_url))
        if not m:
            raise MunicipalError("Logo: PNG o JPEG")
        raw = base64.b64decode(m[2])
        if len(raw) > MAX_LOGO:
            raise MunicipalError("Logo: máximo 300 KB")
        if not (raw[:8] == b"\x89PNG\r\n\x1a\n" or raw[:3] == b"\xff\xd8\xff"):
            raise MunicipalError("El archivo no es una imagen PNG o JPEG válida")
        _dir().mkdir(parents=True, exist_ok=True)
        for e in ("png", "jpg"):
            (_dir() / f"logo.{e}").unlink(missing_ok=True)
        (_dir() / f"logo.{'png' if m[1] == 'png' else 'jpg'}").write_bytes(raw)
    _dir().mkdir(parents=True, exist_ok=True)
    (_dir() / "municipal.json").write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding="utf-8")
    return get_config()


def profile(ub: str, crime: dict | None = None) -> dict:
    """Cifras publicadas del territorio, cada una con su fuente (no se calcula ni estima nada nuevo aquí)."""
    t = territory.lookup(ub)
    if not t:
        raise MunicipalError("Ubigeo no encontrado")
    facts = []
    if warehouse.has("poblacion"):
        rows = warehouse.query("SELECT anio, poblacion, origen FROM poblacion WHERE ubigeo = ? ORDER BY anio DESC LIMIT 1", [ub])
        if rows:
            facts.append({"label": f"Población {rows[0]['anio']}", "value": round(rows[0]["poblacion"]), "unit": "habitantes",
                          "note": f"origen {rows[0]['origen']}", "source": "inei_poblacion"})
    if crime and crime.get("sidpol"):
        s = crime["sidpol"]
        facts.append({"label": f"Denuncias SIDPOL {s['period']}", "value": s["total"], "unit": "denuncias",
                      "note": f"{s['comparison']}: {s['prev']} ({s['change_pct']:+.1f} %)", "source": "mininter_sidpol"})
    if warehouse.has("servicios"):
        cnt = {r["cat"]: r["n"] for r in warehouse.query("SELECT cat, count(*) n FROM servicios WHERE ubigeo LIKE ? GROUP BY cat", [f"{ub}%"])}
        for cat, label, src in (("hospital", "Hospitales", "renipress"), ("salud", "Establecimientos de salud", "renipress"),
                                ("bomberos", "Compañías de bomberos (OSM)", "osm_servicios")):
            if cat in cnt:
                facts.append({"label": label, "value": cnt[cat], "unit": "registros", "note": "", "source": src})
    p = config.DATA / "normalized" / "instituciones.json"
    if p.exists():
        items = json.loads(p.read_text(encoding="utf-8"))["items"]
        for cat, label in (("comisaria", "Comisarías (OSM)"), ("serenazgo", "Sedes de serenazgo (OSM)")):
            n = sum(1 for i in items if i["cat"] == cat and (i.get("ubigeo") or "").startswith(ub))
            facts.append({"label": label, "value": n, "unit": "registros", "note": "colaborativo: puede estar incompleto", "source": "osm_instituciones"})
    srcs = sorted({f["source"] for f in facts})
    return {"ubigeo": ub, "territory": {k: t.get(k) for k in ("nivel", "nombre", "provincia", "departamento", "bbox", "lat", "lon") if k in t},
            "facts": facts, "provenance": registry.provenance(*srcs)}


def kit(crime: dict | None) -> dict:
    cfg = get_config()
    if not cfg.get("configured"):
        raise MunicipalError("Primero configura la edición municipal")
    return {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "municipality": cfg,
            "profile": profile(cfg["ubigeo"], crime), "capabilities": [{"title": a, "detail": b} for a, b in CAPABILITIES],
            "requirements": REQUIREMENTS, "privacy": PRIVACY,
            "proposal": [{"item": "Alcance", "value": "A definir con la municipalidad (módulos, usuarios, capacitación)."},
                         {"item": "Plazo de implementación", "value": "A definir según alcance."},
                         {"item": "Inversión", "value": "A definir: no se publican precios en este documento."},
                         {"item": "Soporte y actualizaciones", "value": "A definir."}]}

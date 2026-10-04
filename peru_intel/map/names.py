"""Nombres oficiales y normalización de texto territorial (portado de OCE/FEDTID scripts/lib/territory-utils.mjs)."""
from __future__ import annotations

import re
import unicodedata

DEPARTMENTS = {
    "01": "Amazonas", "02": "Áncash", "03": "Apurímac", "04": "Arequipa", "05": "Ayacucho", "06": "Cajamarca",
    "07": "Callao", "08": "Cusco", "09": "Huancavelica", "10": "Huánuco", "11": "Ica", "12": "Junín",
    "13": "La Libertad", "14": "Lambayeque", "15": "Lima", "16": "Loreto", "17": "Madre de Dios", "18": "Moquegua",
    "19": "Pasco", "20": "Piura", "21": "Puno", "22": "San Martín", "23": "Tacna", "24": "Tumbes", "25": "Ucayali",
}


def norm(value) -> str:
    """Mayúsculas sin tildes ni signos, espacios simples (clave de comparación)."""
    s = unicodedata.normalize("NFD", str(value or ""))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn").upper()
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_DEP_BY_KEY = {norm(v): k for k, v in DEPARTMENTS.items()}


def department_code(value) -> str | None:
    """Código de 2 dígitos a partir de un nombre de departamento como lo escriben las fuentes."""
    key = norm(value)
    key = re.sub(r"^PROV(INCIA)? CONST(ITUCIONAL)? DEL ", "", key)
    key = re.sub(r"^REGION ", "", key)
    if key.startswith("LIMA"):  # «LIMA METROPOLITANA», «LIMA REGION»: ambas suman al departamento
        return "15"
    return _DEP_BY_KEY.get(key)


_SMALL = {"De", "Del", "La", "Las", "Los", "Y", "El"}


def title(value) -> str:
    words = str(value or "").lower().split()
    out = []
    for i, w in enumerate(words):
        t = "-".join(p[:1].upper() + p[1:] for p in w.split("-"))
        out.append(t.lower() if i and t in _SMALL else t)
    return " ".join(out)


def pad_ubigeo(value) -> str | None:
    s = re.sub(r"\D", "", str(value or ""))
    if not s:
        return None
    return s.zfill(6) if len(s) > 4 else s.zfill(4) if len(s) > 2 else s.zfill(2)

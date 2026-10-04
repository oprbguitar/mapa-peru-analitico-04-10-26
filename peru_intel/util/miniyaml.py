"""Lector YAML mínimo (sin dependencias) para archivos de metodología.

Soporta: mapas anidados por indentación, listas de mapas o escalares con «- », comentarios «#»,
enteros, decimales, booleanos y cadenas. Suficiente para config/*.yaml; no es un YAML completo.
"""
from __future__ import annotations

import re


def _scalar(v: str):
    v = v.strip()
    if v == "" or v in ("~", "null"):
        return None
    if (v[0] == v[-1]) and v[0] in "\"'" and len(v) > 1:
        return v[1:-1]
    if v in ("true", "false"):
        return v == "true"
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    if re.fullmatch(r"-?\d+\.\d*", v):
        return float(v)
    return v


def _lines(text: str):
    for raw in text.splitlines():
        line = re.sub(r"(^|\s)#.*$", "", raw).rstrip()
        if line.strip():
            yield len(line) - len(line.lstrip(" ")), line.strip()


def loads(text: str):
    items = list(_lines(text))
    pos = 0

    def block(indent: int):
        nonlocal pos
        if pos >= len(items):
            return None
        if items[pos][1].startswith("- "):
            out = []
            while pos < len(items) and items[pos][0] == indent and items[pos][1].startswith("- "):
                rest = items[pos][1][2:]
                if ":" in rest and not rest.startswith(("'", '"')):
                    # mapa dentro del elemento: re-indentamos la primera clave
                    items[pos] = (indent + 2, rest)
                    out.append(block(indent + 2))
                else:
                    pos += 1
                    out.append(_scalar(rest))
            return out
        out = {}
        while pos < len(items) and items[pos][0] == indent and not items[pos][1].startswith("- "):
            key, _, val = items[pos][1].partition(":")
            pos += 1
            if val.strip():
                out[key.strip()] = _scalar(val)
            elif pos < len(items) and items[pos][0] > indent:
                out[key.strip()] = block(items[pos][0])
            else:
                out[key.strip()] = None
        return out

    return block(items[0][0]) if items else None


def load(path) -> dict:
    with open(path, encoding="utf-8") as f:
        return loads(f.read())

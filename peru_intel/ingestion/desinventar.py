"""Inventario histórico de desastres del Perú (DesInventar · Corporación OSSO / LA RED), 1970–2015.

Cada ficha es un evento reportado (huaico, inundación, lluvias, deslizamiento…) a nivel de distrito, con fecha,
daños y la fuente hemerográfica de la que se tomó (p. ej. «ElC 18.03.98» = diario El Comercio). Cubre los
Niños de 1982-83 y 1997-98, anteriores al SINPAD.

Salida: data/parquet/desinventar_eventos.parquet
"""
from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path

from ..sources import harvester, registry
from ..storage import warehouse

URL = "https://www.desinventar.net/DesInventar/download/DI_export_per.zip"
NUM = ("muertos", "desaparece", "heridos", "afectados", "damnificados", "evacuados", "vivdest", "vivafec")
_TR = re.compile(r"<TR>(.*?)</TR>", re.S)
_FIELD = re.compile(r"<([a-z_0-9]+)>(.*?)</\1>", re.S)


def _int(v) -> int:
    try:
        return max(0, int(float(v or 0)))
    except ValueError:
        return 0


def rows_from_xml(text: str) -> list[dict]:
    a, b = text.find("<fichas>"), text.find("</fichas>")
    out = []
    for tr in _TR.finditer(text, a, b):
        f = dict(_FIELD.findall(tr.group(1)))
        y = _int(f.get("fechano"))
        if not y or not f.get("evento"):
            continue
        m, d = min(12, max(1, _int(f.get("fechames")) or 1)), min(28, max(1, _int(f.get("fechadia")) or 1))
        ub = (f.get("level2") or f.get("level1") or f.get("level0") or "").strip()
        out.append({
            "serial": f.get("serial"), "fecha": f"{y:04d}-{m:02d}-{d:02d}", "anio": y, "mes": m,
            "dia_conocido": bool(_int(f.get("fechadia"))),
            "ubigeo": ub or None, "nivel": {6: "distrito", 4: "provincia", 2: "departamento"}.get(len(ub)),
            "departamento": f.get("name0") or None, "provincia": f.get("name1") or None, "distrito": f.get("name2") or None,
            "evento": f["evento"].strip(), "lugar": (f.get("lugar") or "").strip()[:200] or None,
            "causa": (f.get("causa") or "").strip() or None, "descripcion": (f.get("descausa") or "").strip()[:300] or None,
            "fuente": (f.get("fuentes") or "").strip()[:200] or None,
            **{k: _int(f.get(k)) for k in NUM},
        })
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    fname = "DI_export_per.zip"
    local = folder / fname if folder else None
    if local and local.exists():
        snap = harvester.import_local("desinventar_per", local, fname)
    elif not download and harvester.latest("desinventar_per", fname):
        p = harvester.latest("desinventar_per", fname)
        snap = harvester.Snapshot("desinventar_per", p, harvester.sha256_file(p), p.stat().st_size, URL, True, None, False)
    else:
        snap = harvester.fetch("desinventar_per", URL, fname)
    with zipfile.ZipFile(snap.path) as z:
        name = next(n for n in z.namelist() if n.lower().endswith(".xml"))
        text = io.TextIOWrapper(z.open(name), encoding="utf-8", errors="replace").read()
    rows = rows_from_xml(text)
    out = warehouse.write_rows("desinventar_eventos", rows)
    registry.record_snapshot("desinventar_per", snap, normalized_path=str(out), coverage_start=str(min(r["anio"] for r in rows)),
                             coverage_end=str(max(r["anio"] for r in rows)),
                             transform="XML DesInventar → una fila por ficha: fecha, UBIGEO publicado (distrito/provincia/departamento), "
                                       "tipo de evento, daños y fuente hemerográfica. Sin redistribuir cifras entre territorios.")
    return f"{len(rows)} fichas ({min(r['anio'] for r in rows)}–{max(r['anio'] for r in rows)})"

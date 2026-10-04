"""Índice Situacional Perú v1 — cálculo determinista desde config/crime_index_v1.yaml.

La IA nunca decide la puntuación: aquí se calcula con SQL + aritmética y cada región lleva su desglose
(«¿por qué tiene este valor?»): valor bruto de cada variable, normalización, peso y aporte en puntos.
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache

from .. import config
from ..map.names import DEPARTMENTS
from ..sources import registry
from ..storage import warehouse
from ..util import miniyaml
from . import crime

SPEC_PATH = config.CONFIG_DIR / "crime_index_v1.yaml"


def spec() -> dict:
    return miniyaml.load(SPEC_PATH)


def _sidpol_rates(year: int, modalities: list[str] | None = None) -> dict[str, float]:
    r = crime.sidpol_choropleth("departamento", year, "1-12", ",".join(modalities) if modalities else None)
    return {x["ubigeo"]: x["rate"] for x in r["rows"] if x["rate"] is not None}


def _sidpol_change(year: int) -> dict[str, float]:
    r = crime.sidpol_choropleth("departamento", year, "1-12")
    return {x["ubigeo"]: x["change_pct"] for x in r["rows"] if x["change_pct"] is not None}


def _indicator(code: int) -> tuple[dict[str, float], int | None]:
    r = crime.indicator_choropleth(code, "departamento")
    if not r.get("available"):
        return {}, None
    return {x["ubigeo"]: x["value"] for x in r["rows"] if x["value"] is not None}, r["period"]["year"]


@lru_cache(maxsize=4)
def _compute(spec_hash: str) -> dict:
    s = spec()
    ext = crime.sidpol_extent()
    year = ext["last_full_year"]
    raw: dict[str, dict[str, float]] = {}
    periods: dict[str, str] = {}
    for v in s["variables"]:
        vid = v["id"]
        if vid == "denuncias_tasa":
            raw[vid], periods[vid] = _sidpol_rates(year), str(year)
        elif vid == "violencia_tasa":
            raw[vid], periods[vid] = _sidpol_rates(year, str(v["modalities"]).split("|")), str(year)
        elif vid == "tendencia":
            raw[vid], periods[vid] = _sidpol_change(year), f"{year} vs {year - 1}"
        elif v.get("indicator"):
            vals, y = _indicator(int(v["indicator"]))
            raw[vid], periods[vid] = vals, str(y) if y else "—"
        else:
            raw[vid], periods[vid] = {}, "—"
    norm: dict[str, dict[str, float]] = {}
    for v in s["variables"]:
        vals = raw[v["id"]]
        if not vals:
            norm[v["id"]] = {}
            continue
        lo, hi = min(vals.values()), max(vals.values())
        span = (hi - lo) or 1.0
        sign = 1 if v.get("direction", "higher_is_worse") == "higher_is_worse" else -1
        norm[v["id"]] = {u: ((x - lo) / span * 100 if sign > 0 else (hi - x) / span * 100) for u, x in vals.items()}
    min_cov = float(s["missing_data_policy"]["min_coverage"])
    total_w = sum(float(v["weight"]) for v in s["variables"])
    regions = []
    for code, name in DEPARTMENTS.items():
        avail = [v for v in s["variables"] if code in norm[v["id"]]]
        cov = sum(float(v["weight"]) for v in avail) / total_w
        comps = []
        score = None
        if avail and cov >= min_cov:
            wsum = sum(float(v["weight"]) for v in avail)
            score = 0.0
            for v in avail:
                w_eff = float(v["weight"]) / wsum
                pts = norm[v["id"]][code] * w_eff
                score += pts
                comps.append({"id": v["id"], "label": v["label"], "raw": round(raw[v["id"]][code], 3),
                              "normalized": round(norm[v["id"]][code], 1), "weight": float(v["weight"]),
                              "effective_weight": round(w_eff, 4), "points": round(pts, 2), "period": periods[v["id"]]})
            for c in comps:
                c["share_pct"] = round(c["points"] / score * 100, 1) if score else 0.0
            score = round(score, 1)
        missing = [v["label"] for v in s["variables"] if v not in avail]
        regions.append({"ubigeo": code, "nombre": name, "score": score, "coverage": round(cov, 3),
                        "components": comps, "missing": missing})
    ranked = sorted([r for r in regions if r["score"] is not None], key=lambda r: -r["score"])
    for i, r in enumerate(ranked, 1):
        r["rank"] = i
    return {
        "id": s["id"], "name": s["name"], "version": s["version"], "official": False, "level": s["level"],
        "scale": s["scale"], "normalization": s["normalization"], "missing_data_policy": s["missing_data_policy"],
        "variables": [{k: v[k] for k in ("id", "label", "description", "source", "weight")} for v in s["variables"]],
        "periods": periods, "spec_sha256": spec_hash, "spec_path": "config/crime_index_v1.yaml",
        "regions": regions,
        "disclaimer": "Índice propio y experimental. No es un índice oficial. Compara regiones entre sí (min-máx): "
                      "un valor alto indica posición relativa desfavorable, no un nivel absoluto de inseguridad.",
    }


def compute() -> dict:
    h = hashlib.sha256(SPEC_PATH.read_bytes()).hexdigest()
    data = _compute(h)
    registry.record("indice_situacional_v1", status="ok", last_downloaded=None, checksum=h,
                    normalized_path="(calculado al vuelo)", transform=json.dumps(data["periods"], ensure_ascii=False))
    return data


def for_region(ubigeo: str) -> dict | None:
    data = compute()
    r = next((x for x in data["regions"] if x["ubigeo"] == ubigeo), None)
    if r is None:
        return None
    return r | {k: data[k] for k in ("name", "version", "official", "scale", "disclaimer", "spec_path", "spec_sha256")}


def clear_cache() -> None:
    _compute.cache_clear()

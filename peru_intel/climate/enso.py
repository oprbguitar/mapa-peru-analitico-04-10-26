"""El Niño / La Niña y océano frente al Perú.

Fuentes (todas con procedencia en la API):
  ICEN mensual 1950–hoy           IGP · ENFEN (oficial)        met.igp.gob.pe/datos/ICEN.txt
  Lista de eventos costeros        IGP · ENFEN (oficial)        met.igp.gob.pe/datos/lista_eventos_ICEN.html
  TSM y anomalía mensual Niño 1+2  NOAA CPC (oficial, EE. UU.)  sstoi.indices (desde 1982)
  TSM y anomalía semanal           NOAA CPC                     wksst9120.for
  Estado y pronóstico vigente      ENFEN (curado y versionado)  config/enso_eventos.json
  Corrientes y TSM en vivo         Open-Meteo Marine (modelo)   rejilla 1,5° frente a la costa

Reglas: la magnitud y las fechas de cada evento salen del ICEN, no de texto libre; la comparación del momento
actual con eventos pasados es un CÁLCULO (no un pronóstico); el pronóstico es el oficial del ENFEN.
"""
from __future__ import annotations

import html
import json
import re
import time
from pathlib import Path

from .. import config
from ..live.worker import Worker
from ..sources import harvester, registry

URLS = {
    "igp_icen": ("http://met.igp.gob.pe/datos/ICEN.txt", "ICEN.txt"),
    "igp_eventos": ("http://met.igp.gob.pe/datos/lista_eventos_ICEN.html", "lista_eventos_ICEN.html"),
    "noaa_cpc_mensual": ("https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices", "sstoi.indices"),
    "noaa_cpc_semanal": ("https://www.cpc.ncep.noaa.gov/data/indices/wksst9120.for", "wksst9120.for"),
}
CURATED = config.CONFIG_DIR / "enso_eventos.json"
OUT = config.NORMALIZED / "enso.json"
MONTHS = {m: i + 1 for i, m in enumerate(["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


# ── parsers (puros, probados sin red) ───────────────────────────────────────
def parse_icen(text: str) -> list[dict]:
    out = []
    for line in text.splitlines():
        parts = line.split()
        if len(parts) == 3 and parts[0].isdigit() and not line.lstrip().startswith("%"):
            try:
                out.append({"y": int(parts[0]), "m": int(parts[1]), "v": float(parts[2])})
            except ValueError:
                continue
    return out


def parse_events(page: str) -> dict:
    """Tablas «El Niño Costero» y «La Niña Costera» de la lista oficial del IGP."""
    text = re.sub(r"<[^>]+>", " ", html.unescape(page))
    text = re.sub(r"\s+", " ", text)
    out = {"nino": [], "nina": []}
    i_nino = text.find("El Niño Costero")
    i_nina = text.find("La Niña Costera", i_nino + 1)
    i_end = text.find("ICEN", i_nina + 20) if i_nina > 0 else -1
    blocks = {"nino": text[i_nino:i_nina] if i_nino >= 0 else "", "nina": text[i_nina:i_end if i_end > 0 else None] if i_nina > 0 else ""}
    row = re.compile(r"(19\d{2}|20\d{2}) (\d{1,2}) (19\d{2}|20\d{2}) (\d{1,2}) (\d{1,2}) (Débil|Moderado|Fuerte|Extraordinario|Muy fuerte)")
    for k, blk in blocks.items():
        for m in row.finditer(blk):
            out[k].append({"start": f"{m[1]}-{int(m[2]):02d}", "end": f"{m[3]}-{int(m[4]):02d}", "months": int(m[5]), "magnitude": m[6]})
    return out


def parse_cpc_monthly(text: str) -> list[dict]:
    out = []
    for line in text.splitlines()[1:]:
        p = line.split()
        if len(p) >= 10 and p[0].isdigit():
            out.append({"y": int(p[0]), "m": int(p[1]), "sst12": float(p[2]), "anom12": float(p[3]),
                        "sst34": float(p[8]), "anom34": float(p[9])})
    return out


def parse_cpc_weekly(text: str) -> list[dict]:
    out = []
    pair = r"\s+(\d+\.\d)\s*(-?\d+\.\d)"
    rx = re.compile(r"^\s*(\d{2})([A-Z]{3})(\d{4})" + pair * 4)
    for line in text.splitlines():
        m = rx.match(line)
        if m and m[2] in MONTHS:
            out.append({"date": f"{m[3]}-{MONTHS[m[2]]:02d}-{m[1]}", "sst12": float(m[4]), "anom12": float(m[5]),
                        "sst3": float(m[6]), "anom3": float(m[7]), "sst34": float(m[8]), "anom34": float(m[9]),
                        "sst4": float(m[10]), "anom4": float(m[11])})
    return out


def ingest(download: bool = False, folder: Path | None = None) -> str:
    texts, msgs = {}, []
    for sid, (url, fname) in URLS.items():
        local = folder / fname if folder else None
        try:
            if local and local.exists():
                snap = harvester.import_local(sid, local, fname)
            elif download or not harvester.latest(sid, fname):
                snap = harvester.fetch(sid, url, fname, timeout=60, retries=2)
            else:
                p = harvester.latest(sid, fname)
                snap = harvester.Snapshot(sid, p, harvester.sha256_file(p), p.stat().st_size, url, True, None, False)
            texts[sid] = snap.path.read_text(encoding="utf-8", errors="replace")
            registry.record_snapshot(sid, snap, normalized_path="data/normalized/enso.json")
        except Exception as e:  # noqa: BLE001 — una fuente caída no anula las demás
            msgs.append(f"{sid}: {e}")
    prev = _load_normalized()
    data = {
        "icen": parse_icen(texts["igp_icen"]) if "igp_icen" in texts else prev.get("icen", []),
        "events": parse_events(texts["igp_eventos"]) if "igp_eventos" in texts else prev.get("events", {"nino": [], "nina": []}),
        "cpc_monthly": parse_cpc_monthly(texts["noaa_cpc_mensual"]) if "noaa_cpc_mensual" in texts else prev.get("cpc_monthly", []),
        "cpc_weekly": parse_cpc_weekly(texts["noaa_cpc_semanal"])[-60:] if "noaa_cpc_semanal" in texts else prev.get("cpc_weekly", []),
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    msgs.insert(0, f"ICEN {len(data['icen'])} meses · {len(data['events']['nino'])} Niños y {len(data['events']['nina'])} Niñas costeros · "
                   f"CPC {len(data['cpc_monthly'])} meses / {len(data['cpc_weekly'])} semanas")
    return " · ".join(msgs)


def _load_normalized() -> dict:
    try:
        return json.loads(OUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def curated() -> dict:
    return json.loads(CURATED.read_text(encoding="utf-8"))


def _icen_at(icen: list[dict], ym: str) -> float | None:
    y, m = int(ym[:4]), int(ym[5:7])
    return next((r["v"] for r in icen if r["y"] == y and r["m"] == m), None)


def _sst_at(cpc: list[dict], ym: str) -> dict | None:
    y, m = int(ym[:4]), int(ym[5:7])
    return next(({"sst": r["sst12"], "anom": r["anom12"]} for r in cpc if r["y"] == y and r["m"] == m), None)


def _peak(icen: list[dict], start: str, end: str | None) -> dict | None:
    s = (int(start[:4]), int(start[5:7]))
    e = (int(end[:4]), int(end[5:7])) if end else (9999, 12)
    rows = [r for r in icen if s <= (r["y"], r["m"]) <= e]
    if not rows:
        return None
    top = max(rows, key=lambda r: r["v"])
    return {"value": top["v"], "period": f"{top['y']}-{top['m']:02d}"}


def overview() -> dict:
    """Todo lo que necesita el observatorio de El Niño en una respuesta."""
    norm = _load_normalized()
    cur = curated()
    if not norm:
        return {"available": False, "reason": "Datos ENSO no ingeridos. Ejecuta: python -m peru_intel ingest enso --download",
                "current": cur["current"], "storylines": cur["storylines"]}
    icen, cpc = norm["icen"], norm["cpc_monthly"]
    stories = []
    for st in cur["storylines"]:
        chapters = []
        for ch in st["chapters"]:
            ym = ch["date"][:7]
            chapters.append(ch | {"icen": _icen_at(icen, ym), "sst": _sst_at(cpc, ym)})
        ev = next((e for e in norm["events"]["nino"] if e["start"] == st["start"]), None)
        stories.append(st | {"chapters": chapters, "peak": _peak(icen, st["start"], st["end"]),
                             "official": ev, "duration_months": ev["months"] if ev else None})
    latest_icen = icen[-1] if icen else None
    weekly = norm["cpc_weekly"][-1] if norm["cpc_weekly"] else None
    comparison = []
    if latest_icen:
        for st in stories:
            if st["peak"] and st["id"] != "2026-27":
                comparison.append({"id": st["id"], "title": st["title"], "peak": st["peak"]["value"], "peak_period": st["peak"]["period"],
                                   "ratio": round(latest_icen["v"] / st["peak"]["value"], 2) if st["peak"]["value"] else None})
    return {
        "available": True, "current": cur["current"], "storylines": stories,
        "icen": icen, "events": norm["events"], "cpc_weekly": norm["cpc_weekly"][-26:], "cpc_monthly": cpc[-36:],
        "latest": {"icen": latest_icen, "weekly": weekly},
        "comparison": {"items": comparison, "kind": "calculado",
                       "method": "ICEN más reciente ÷ ICEN máximo de cada evento. Es una comparación de magnitud, no un pronóstico."},
        "thresholds": {"Débil": 0.4, "Moderado": 1.0, "Fuerte": 1.7, "Extraordinario": 3.0},
        "provenance": registry.provenance("igp_icen", "igp_eventos", "noaa_cpc_mensual", "noaa_cpc_semanal", "enfen_comunicados"),
        "built_at": norm.get("built_at"),
    }


def facts() -> list[dict]:
    """Hechos numerados para la IA (DataAgent): solo cifras publicadas o calculadas aquí."""
    ov = overview()
    out: list[dict] = []

    def add(label, value, unit, period, source, kind):
        if value is not None:
            out.append({"id": f"F{len(out) + 1}", "label": label, "value": value, "unit": unit, "period": period,
                        "source": source, "kind": kind})
    if not ov.get("available"):
        return out
    li, wk = ov["latest"]["icen"], ov["latest"]["weekly"]
    if li:
        add("Índice Costero El Niño (ICEN)", li["v"], "°C de anomalía", f"{li['y']}-{li['m']:02d}", "igp_icen", "oficial")
    if wk:
        add("Anomalía semanal de la temperatura del mar en Niño 1+2", wk["anom12"], "°C", wk["date"], "noaa_cpc_semanal", "oficial")
        add("Temperatura del mar en Niño 1+2", wk["sst12"], "°C", wk["date"], "noaa_cpc_semanal", "oficial")
        add("Anomalía semanal en Niño 3.4", wk["anom34"], "°C", wk["date"], "noaa_cpc_semanal", "oficial")
    for s in ov["storylines"]:
        if s["peak"]:
            add(f"ICEN máximo del evento {s['title']}", s["peak"]["value"], "°C de anomalía", s["peak"]["period"], "igp_icen", "oficial")
        if s.get("duration_months"):
            add(f"Duración del evento {s['title']}", s["duration_months"], "meses", s["start"], "igp_eventos", "oficial")
    for c in ov["comparison"]["items"]:
        add(f"ICEN actual respecto del máximo de {c['title']}", c["ratio"], "veces", c["peak_period"], "cálculo propio", "calculado")
    return out


# ── océano en vivo: corrientes y TSM (Open-Meteo Marine, modelo) ─────────────
GRID_LAT = [round(-19.5 + 1.5 * i, 2) for i in range(15)]      # -19.5 … 1.5
GRID_LON = [round(-92.0 + 1.5 * j, 2) for j in range(13)]      # -92 … -74
MARINE = "https://marine-api.open-meteo.com/v1/marine"


def fetch_ocean() -> dict:
    from ..sources.harvester import http_get
    pts = [(la, lo) for la in GRID_LAT for lo in GRID_LON]
    cells = []
    for k in range(0, len(pts), 60):
        chunk = pts[k:k + 60]
        url = (f"{MARINE}?latitude={','.join(str(p[0]) for p in chunk)}&longitude={','.join(str(p[1]) for p in chunk)}"
               "&current=sea_surface_temperature,ocean_current_velocity,ocean_current_direction"
               "&hourly=sea_surface_temperature&past_days=7&forecast_days=1&timezone=UTC")
        res = json.loads(http_get(url, timeout=40, retries=2, min_interval=1.5))
        if isinstance(res, dict):
            res = [res]
        for (la, lo), r in zip(chunk, res):
            c = r.get("current") or {}
            sst = c.get("sea_surface_temperature")
            if sst is None:  # tierra
                continue
            hourly = [v for v in (r.get("hourly") or {}).get("sea_surface_temperature") or [] if v is not None]
            week_ago = hourly[0] if hourly else None
            cells.append({"lat": la, "lon": lo, "sst": sst, "speed_kmh": c.get("ocean_current_velocity"),
                          "dir_deg": c.get("ocean_current_direction"),
                          "sst_7d_ago": week_ago, "delta_7d": round(sst - week_ago, 2) if week_ago is not None else None})
    if not cells:
        raise RuntimeError("Open-Meteo Marine no devolvió celdas de mar")
    return {"cells": cells, "grid_deg": 1.5, "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "note": "Valores de modelo (TSM y corriente superficial). Dirección = hacia dónde fluye el agua."}


OCEAN = Worker("ocean", "openmeteo_marine", interval=3 * 3600, fetch=fetch_ocean, idle_after=3 * 3600)

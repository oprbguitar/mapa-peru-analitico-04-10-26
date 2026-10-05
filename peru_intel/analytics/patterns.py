"""Motor de patrones: Hotspots · Cambios estructurales · Correlaciones desfasadas · Secuencias · Anomalías · Proyecciones.

Todo es CÁLCULO reproducible sobre datos oficiales; nada de esto afirma causalidad. Métodos:
  hotspots     Getis-Ord Gi* sobre la tasa distrital (8 vecinos más cercanos por centroide, pesos binarios) y su evolución
               (nuevo · persistente · intensificado · se disipa) comparando con 3 años antes.
  cambios      segmentación binaria de la media sobre la serie mensual sin estacionalidad (penalización BIC, ≥ 6 meses).
  lead/lag     correlación cruzada de diferencias estacionales (x_t − x_{t−12}) entre dos series, desfases −6…+6 meses.
  secuencias   pares A → B de emergencias en el mismo distrito dentro de 14 días; «lift» = observado / esperado por azar.
  anomalías    último mes frente al mismo mes de años anteriores (z); solo territorios con base ≥ 20.
  proyección   competencia de modelos con backtesting de origen móvil (3 cortes × 6 meses): el de menor MAE gana.
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np

from ..events import store
from ..map import territory
from ..sources import registry
from ..storage import warehouse
from . import crime, forecast


# ── hotspots ────────────────────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _centroids() -> tuple[list[str], np.ndarray]:
    rows = [r for r in territory.index() if len(r["ubigeo"]) == 6 and r.get("lat") is not None]
    return [r["ubigeo"] for r in rows], np.array([[r["lat"], r["lon"] * math.cos(math.radians(r["lat"]))] for r in rows])


def _rates(year: int, modalidad: str | None) -> dict[str, float]:
    mod = "AND modalidad = ?" if modalidad else ""
    rows = warehouse.query(f"""WITH c AS (SELECT ubigeo u, sum(cantidad) n FROM sidpol_denuncias WHERE anio = ? {mod} GROUP BY 1),
                               p AS (SELECT ubigeo u, poblacion FROM poblacion WHERE nivel = 'distrito' AND anio = ?)
                               SELECT c.u, c.n / p.poblacion * 100000 r FROM c JOIN p USING (u) WHERE p.poblacion >= 1000""",
                           [year, *([modalidad] if modalidad else []), year])
    return {r["u"]: float(r["r"]) for r in rows}


def gi_star(values: dict[str, float], k: int = 8) -> dict[str, float]:
    ids, xy = _centroids()
    keep = [i for i, u in enumerate(ids) if u in values]
    if len(keep) < k + 2:
        return {}
    sub_ids = [ids[i] for i in keep]
    pts = xy[keep]
    x = np.array([values[u] for u in sub_ids])
    n = len(x)
    d2 = ((pts[:, None, :] - pts[None, :, :]) ** 2).sum(-1)
    nn = np.argsort(d2, axis=1)[:, : k + 1]  # incluye el propio distrito (Gi*)
    xbar, s = x.mean(), x.std()
    if s == 0:
        return {}
    wsum = k + 1
    denom = s * math.sqrt((n * wsum - wsum ** 2) / (n - 1))
    z = (x[nn].sum(1) - xbar * wsum) / denom
    return dict(zip(sub_ids, z.round(2).tolist()))


def _band(z: float | None) -> str:
    if z is None:
        return "sin dato"
    return "foco 99 %" if z >= 2.58 else "foco 95 %" if z >= 1.96 else "frío 95 %" if z <= -1.96 else "no significativo"


@lru_cache(maxsize=64)
def hotspots(modalidad: str | None = None, year: int | None = None, scope: str | None = None) -> dict:
    ext = crime.sidpol_extent()
    y = year or ext["last_full_year"]
    y0 = max(ext["first_year"], y - 3)
    z1, z0 = gi_star(_rates(y, modalidad)), gi_star(_rates(y0, modalidad))
    rows = []
    for u, z in z1.items():
        if scope and not u.startswith(scope):
            continue
        b = z0.get(u)
        hot, was = z >= 1.96, (b or 0) >= 1.96
        trend = ("persistente" if was else "nuevo") if hot else ("se disipa" if was else None)
        if hot and was and b is not None and z - b >= 1:
            trend = "intensificado"
        rows.append({"ubigeo": u, "nombre": crime._name("distrito", u), "z": z, "z_prev": b, "band": _band(z), "trend": trend})
    rows.sort(key=lambda r: -r["z"])
    counts = {t: sum(1 for r in rows if r["trend"] == t) for t in ("nuevo", "persistente", "intensificado", "se disipa")}
    return {"available": True, "year": y, "compare_year": y0, "modalidad": modalidad or "todas", "rows": rows, "counts": counts,
            "method": "Getis-Ord Gi* (k=8 vecinos por centroide, binario, incluye el propio distrito) sobre la tasa por 100 mil hab. "
                      "|z| ≥ 1,96 → 95 %; ≥ 2,58 → 99 %. Evolución frente a " + str(y0) + ".",
            "kind": "calculado", "provenance": registry.provenance("mininter_sidpol", "inei_poblacion", "limites_inei")}


# ── series ──────────────────────────────────────────────────────────────────
def _series(kind: str, ubigeo: str | None, sub: str | None = None) -> list[dict]:
    """kind: denuncia | emergencia | via_afectada → [{anio, mes, value}] mensual denso."""
    if kind == "denuncia":
        rows = crime.monthly_series(ubigeo, sub)
        return forecast._dense(rows)
    raw = store.monthly(kind, ubigeo, sub)
    have = {(r["anio"], r["mes"]): float(r["v"]) for r in raw}
    if not have:
        return []
    (y, m), (y1, m1) = min(have), max(have)
    out = []
    while (y, m) <= (y1, m1):
        out.append({"anio": y, "mes": m, "value": have.get((y, m), 0.0)})
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _deseason(v: np.ndarray, months: list[int]) -> np.ndarray:
    prof = {m: v[[i for i, mm in enumerate(months) if mm == m]].mean() for m in set(months)}
    return v - np.array([prof[m] for m in months])


def change_points(ubigeo: str | None, modalidad: str | None = None, max_points: int = 3, min_seg: int = 6) -> dict:
    s = _series("denuncia", ubigeo, modalidad)
    if len(s) < 30:
        return {"available": False, "reason": "Serie demasiado corta."}
    v = np.array([r["value"] for r in s], float)
    d = _deseason(v, [r["mes"] for r in s])
    var = max(np.var(d), 1e-9)
    pen = 2 * math.log(len(d)) * var

    def cost(a, b):
        seg = d[a:b]
        return float(((seg - seg.mean()) ** 2).sum())

    cps, segs = [], [(0, len(d))]
    for _ in range(max_points):
        best = None
        for (a, b) in segs:
            base = cost(a, b)
            for t in range(a + min_seg, b - min_seg + 1):
                gain = base - cost(a, t) - cost(t, b)
                if gain > pen and (best is None or gain > best[0]):
                    best = (gain, t, (a, b))
        if not best:
            break
        _, t, (a, b) = best
        cps.append(t)
        segs.remove((a, b))
        segs += [(a, t), (t, b)]
    cps.sort()
    bounds = [0, *cps, len(v)]
    segments = [{"from": f"{s[a]['anio']}-{s[a]['mes']:02d}", "to": f"{s[b - 1]['anio']}-{s[b - 1]['mes']:02d}",
                 "mean": round(float(v[a:b].mean()), 1)} for a, b in zip(bounds, bounds[1:])]
    changes = [{"at": f"{s[t]['anio']}-{s[t]['mes']:02d}", "before": segments[i]["mean"], "after": segments[i + 1]["mean"],
                "change_pct": round((segments[i + 1]["mean"] - segments[i]["mean"]) / segments[i]["mean"] * 100, 1) if segments[i]["mean"] else None}
               for i, t in enumerate(cps)]
    return {"available": True, "scope": ubigeo or "PE", "modalidad": modalidad or "todas", "changes": changes, "segments": segments,
            "series": [{"p": f"{r['anio']}-{r['mes']:02d}", "v": r["value"]} for r in s],
            "method": "Segmentación binaria de la media (serie sin perfil estacional), penalización BIC, segmentos ≥ 6 meses.",
            "kind": "calculado"}


def lead_lag(ubigeo: str | None, a: str = "emergencia", b: str = "denuncia", sub_a: str | None = None, sub_b: str | None = None) -> dict:
    sa, sb = _series(a, ubigeo, sub_a), _series(b, ubigeo, sub_b)
    ma = {(r["anio"], r["mes"]): r["value"] for r in sa}
    mb = {(r["anio"], r["mes"]): r["value"] for r in sb}
    keys = sorted(set(ma) & set(mb))
    if len(keys) < 36:
        return {"available": False, "reason": "Menos de 36 meses en común entre ambas series."}
    xa = np.array([ma[k] for k in keys], float)
    xb = np.array([mb[k] for k in keys], float)
    da, db = xa[12:] - xa[:-12], xb[12:] - xb[:-12]
    out = []
    for lag in range(-6, 7):
        if lag >= 0:
            u, w = da[: len(da) - lag], db[lag:]
        else:
            u, w = da[-lag:], db[: len(db) + lag]
        if len(u) < 18 or u.std() == 0 or w.std() == 0:
            continue
        r = float(np.corrcoef(u, w)[0, 1])
        out.append({"lag": lag, "r": round(r, 3), "n": len(u), "significant": abs(r) > 2 / math.sqrt(len(u))})
    best = max(out, key=lambda x: abs(x["r"])) if out else None
    text = None
    if best:
        who = f"«{sub_a or a}»" , f"«{sub_b or b}»"
        text = (f"{who[0]} se adelanta {best['lag']} meses a {who[1]}" if best["lag"] > 0 else
                f"{who[1]} se adelanta {-best['lag']} meses a {who[0]}" if best["lag"] < 0 else f"{who[0]} y {who[1]} varían a la vez") + \
            f" (r = {best['r']:.2f}, n = {best['n']}{', significativo' if best['significant'] else ', no significativo'})."
    return {"available": True, "a": sub_a or a, "b": sub_b or b, "scope": ubigeo or "PE", "lags": out, "best": best, "text": text,
            "method": "Correlación cruzada de diferencias estacionales; |r| > 2/√n como umbral aproximado. Correlación ≠ causalidad.",
            "kind": "calculado"}


@lru_cache(maxsize=64)
def sequences(scope: str | None = None, window_days: int = 14, min_count: int = 5) -> dict:
    if not warehouse.has("eventos"):
        return {"available": False, "reason": "Event Store vacío (python -m peru_intel ingest eventos)."}
    sc = "AND starts_with(ubigeo, ?)" if scope else ""
    params = [scope] if scope else []
    rows = warehouse.query(f"""
        WITH e AS (SELECT ubigeo, subtype t, ts_start d FROM eventos WHERE event_type IN ('emergencia', 'via_afectada')
                   AND ubigeo IS NOT NULL AND subtype IS NOT NULL {sc}),
             span AS (SELECT ubigeo, greatest(date_diff('day', min(d), max(d)), 365) ndays FROM e GROUP BY 1),
             freq AS (SELECT ubigeo, t, count(*) n FROM e GROUP BY 1, 2),
             pairs AS (SELECT a.t ta, b.t tb, a.ubigeo, count(*) n FROM e a JOIN e b ON a.ubigeo = b.ubigeo AND b.d > a.d
                       AND b.d <= a.d + INTERVAL {int(window_days)} DAY AND a.t <> b.t GROUP BY 1, 2, 3),
             expct AS (SELECT p.ta, p.tb, p.ubigeo, p.n, fa.n * fb.n * {int(window_days)} / s.ndays AS ex
                       FROM pairs p JOIN freq fa ON fa.ubigeo = p.ubigeo AND fa.t = p.ta
                       JOIN freq fb ON fb.ubigeo = p.ubigeo AND fb.t = p.tb JOIN span s ON s.ubigeo = p.ubigeo)
        SELECT ta, tb, sum(n) obs, sum(ex) expected, count(DISTINCT ubigeo) districts
        FROM expct GROUP BY 1, 2 HAVING sum(n) >= ? ORDER BY sum(n) / greatest(sum(ex), 0.5) DESC LIMIT 12""", [*params, min_count])
    out = [{"a": r["ta"], "b": r["tb"], "observed": int(r["obs"]), "expected": round(float(r["expected"]), 1),
            "lift": round(float(r["obs"]) / max(float(r["expected"]), 0.5), 2), "districts": int(r["districts"])} for r in rows]
    return {"available": True, "scope": scope or "PE", "window_days": window_days, "pairs": out,
            "method": f"Pares A → B en el mismo distrito con B dentro de {window_days} días. Esperado = nA·nB·{window_days}/días observados "
                      "por distrito. lift > 1: ocurre más que por azar. No implica causalidad.",
            "kind": "calculado", "provenance": registry.provenance("indeci_sinpad", "mtc_emergencias_viales", "eventos_unificados")}


def anomalies(level: str = "distrito", modalidad: str | None = None, limit: int = 15, scope: str | None = None) -> dict:
    ext = crime.sidpol_extent()
    col = crime.LEVEL_COL[level]
    y, m = ext["last_year"], ext["last_month"]
    mod = "AND modalidad = ?" if modalidad else ""
    sc = f"AND starts_with({col}, ?)" if scope else ""
    rows = warehouse.query(f"""WITH s AS (SELECT {col} u, anio, sum(cantidad) n FROM sidpol_denuncias WHERE mes = ? {mod} {sc} GROUP BY 1, 2),
                               h AS (SELECT u, avg(n) mu, stddev_samp(n) sd, count(*) k FROM s WHERE anio < ? GROUP BY 1)
                               SELECT s.u, s.n, h.mu, h.sd, h.k FROM s JOIN h USING (u) WHERE s.anio = ? AND h.mu >= 20 AND h.k >= 4""",
                           [m, *([modalidad] if modalidad else []), *([scope] if scope else []), y, y])
    out = []
    for r in rows:
        sd = r["sd"] or 0
        if sd <= 0:
            continue
        z = (r["n"] - r["mu"]) / sd
        out.append({"ubigeo": r["u"], "nombre": crime._name(level, r["u"]), "value": int(r["n"]), "expected": round(r["mu"], 1),
                    "z": round(z, 2), "direction": "alza" if z > 0 else "baja"})
    out.sort(key=lambda r: -abs(r["z"]))
    return {"available": True, "period": f"{y}-{m:02d}", "level": level, "rows": out[:limit],
            "method": "z = (valor del mes − media del mismo mes en años previos) / desviación estándar; base ≥ 20 denuncias.",
            "kind": "calculado"}


# ── proyección con competencia de modelos ───────────────────────────────────
def _models():
    try:
        from statsforecast.models import AutoETS, AutoTheta
        return {"AutoETS": lambda: AutoETS(season_length=12), "AutoTheta": lambda: AutoTheta(season_length=12)}
    except ImportError:
        return {}


def _fit_predict(name: str, y: np.ndarray, h: int, level: int | None = None):
    if name == "Naive estacional":
        return np.array([y[len(y) - 12 + (k % 12)] for k in range(h)]), None
    if name == "Media móvil 12":
        return np.repeat(y[-12:].mean(), h), None
    m = _models()[name]()
    res = m.forecast(y=y, h=h, level=[level] if level else None)
    lo = hi = None
    if level:
        lo, hi = res.get(f"lo-{level}"), res.get(f"hi-{level}")
    return np.asarray(res["mean"]), (lo, hi)


def warmup() -> None:
    """Compila una vez los modelos (numba) en segundo plano para que la primera consulta sea rápida."""
    y = np.abs(np.sin(np.arange(60))) * 100 + 50
    for name in _models():
        try:
            _fit_predict(name, y, 3, level=95)
        except Exception:  # noqa: BLE001
            pass


@lru_cache(maxsize=256)
def compete(ubigeo: str | None = None, modalidad: str | None = None, h: int = 6, folds: int = 3) -> dict:
    s = _series("denuncia", ubigeo, modalidad)
    if len(s) < 48:
        return {"available": False, "reason": "Se necesitan 48 meses para comparar modelos."}
    y = np.array([r["value"] for r in s], float)
    names = ["Naive estacional", "Media móvil 12", *_models()]
    scores = []
    for name in names:
        errs = []
        try:
            for f in range(folds, 0, -1):
                cut = len(y) - f * h
                pred, _ = _fit_predict(name, y[:cut], h)
                errs.append(np.abs(pred - y[cut:cut + h]).mean())
        except Exception as e:  # noqa: BLE001 — un modelo que no converge queda fuera, declarado
            scores.append({"model": name, "mae": None, "error": type(e).__name__})
            continue
        scores.append({"model": name, "mae": round(float(np.mean(errs)), 1),
                       "mape_pct": round(float(np.mean(errs) / max(y[-folds * h:].mean(), 1) * 100), 1)})
    valid = [x for x in scores if x["mae"] is not None]
    best = min(valid, key=lambda x: x["mae"])
    pred, band = _fit_predict(best["model"], y, h, level=95 if best["model"] in _models() else None)
    if band is None or band[0] is None:  # intervalo empírico con los errores del backtest
        q = best["mae"] * 1.96 * 1.25
        band = (pred - q, pred + q)
    last = s[-1]
    months = forecast._next_months(last["anio"], last["mes"], h)
    return {"available": True, "scope": ubigeo or "PE", "modalidad": modalidad or "todas", "scores": sorted(valid, key=lambda x: x["mae"]) +
            [x for x in scores if x["mae"] is None], "best": best["model"],
            "forecast": [{"period": f"{yy}-{mm:02d}", "point": max(0, round(float(p))), "lo95": max(0, round(float(lo))), "hi95": round(float(hi))}
                         for (yy, mm), p, lo, hi in zip(months, pred, band[0], band[1])],
            "history": [{"period": f"{r['anio']}-{r['mes']:02d}", "value": int(r["value"])} for r in s[-36:]],
            "method": f"Backtesting de origen móvil: {folds} cortes × {h} meses; gana el menor MAE. Modelos univariados; "
                      "las variables externas (clima, emergencias) se muestran como correlaciones, no entran a la cifra.",
            "kind": "proyeccion"}

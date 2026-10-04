"""Proyección y anomalías sobre series agregadas (nunca sobre personas).

Motor preferido: Nixtla StatsForecast (AutoETS estacional, intervalos 80/95 %), si está instalado
(`pip install statsforecast`). Si no lo está, se usa un método estadístico de respaldo declarado:
naive estacional (mismo mes del año anterior) con intervalos empíricos a partir de los errores
históricos del propio método. La salida siempre dice qué método se usó.

El LLM solo explica el resultado; no produce la cifra.
"""
from __future__ import annotations

import math
from statistics import mean, pstdev

from . import crime

HORIZON = 6


def _quantile(xs: list[float], q: float) -> float:
    s = sorted(xs)
    if not s:
        return 0.0
    k = (len(s) - 1) * q
    f, c = math.floor(k), math.ceil(k)
    return s[f] if f == c else s[f] + (s[c] - s[f]) * (k - f)


def _next_months(year: int, month: int, n: int) -> list[tuple[int, int]]:
    out = []
    for _ in range(n):
        month += 1
        if month > 12:
            year, month = year + 1, 1
        out.append((year, month))
    return out


def _statsforecast(values: list[float], h: int):
    try:
        import pandas as pd
        from statsforecast import StatsForecast
        from statsforecast.models import AutoETS
    except ImportError:
        return None
    df = pd.DataFrame({"unique_id": "s", "ds": pd.date_range("2000-01-01", periods=len(values), freq="MS"), "y": values})
    sf = StatsForecast(models=[AutoETS(season_length=12)], freq="MS")
    fc = sf.forecast(df=df, h=h, level=[80, 95])
    return [{"point": float(r["AutoETS"]), "lo80": float(r["AutoETS-lo-80"]), "hi80": float(r["AutoETS-hi-80"]),
             "lo95": float(r["AutoETS-lo-95"]), "hi95": float(r["AutoETS-hi-95"])} for _, r in fc.iterrows()]


def _seasonal_naive(values: list[float], h: int):
    errors = [values[i] - values[i - 12] for i in range(12, len(values))]
    abs_e = [abs(e) for e in errors]
    q80, q95 = _quantile(abs_e, 0.80), _quantile(abs_e, 0.95)
    out = []
    for k in range(h):
        base = values[len(values) - 12 + (k % 12)]
        out.append({"point": base, "lo80": max(0.0, base - q80), "hi80": base + q80,
                    "lo95": max(0.0, base - q95), "hi95": base + q95})
    return out


def forecast(ubigeo: str | None = None, modalidad: str | None = None, horizon: int = HORIZON) -> dict:
    series = crime.monthly_series(ubigeo, modalidad)
    if len(series) < 36:
        return {"available": False, "reason": "Serie demasiado corta (se necesitan 36 meses)."}
    values = [float(r["value"]) for r in series]
    method = "StatsForecast AutoETS (estacional 12)"
    fc = _statsforecast(values, horizon)
    if fc is None:
        method = "Naive estacional con intervalos empíricos (respaldo; StatsForecast no instalado)"
        fc = _seasonal_naive(values, horizon)
    last_y, last_m = series[-1]["anio"], series[-1]["mes"]
    months = _next_months(last_y, last_m, horizon)
    # anomalía del último mes: error del naive estacional frente a su distribución histórica
    errors = [values[i] - values[i - 12] for i in range(12, len(values) - 1)]
    last_err = values[-1] - values[-13]
    sd = pstdev(errors) or 1.0
    z = (last_err - mean(errors)) / sd
    return {
        "available": True, "kind": "proyeccion", "method": method, "horizon": horizon,
        "scope": {"ubigeo": ubigeo or "PE", "modalidad": modalidad or "todas"},
        "history": [{"period": f"{r['anio']}-{r['mes']:02d}", "value": int(r["value"])} for r in series],
        "forecast": [{"period": f"{y}-{m:02d}", **{k: round(v) for k, v in f.items()}} for (y, m), f in zip(months, fc)],
        "anomaly": {"period": f"{last_y}-{last_m:02d}", "z": round(z, 2), "flag": abs(z) >= 2,
                    "note": "z del error interanual del último mes frente a su historia; |z| ≥ 2 se marca como inusual."},
        "caveat": "Proyección estadística de denuncias registradas, no de delitos ocurridos. Los intervalos expresan "
                  "incertidumbre del modelo; cambios de registro o de política pueden romper el patrón.",
    }

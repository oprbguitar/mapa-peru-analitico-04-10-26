"""Consultas de conectividad con su granularidad y procedencia explícitas."""
from __future__ import annotations

from ..storage import warehouse
from ..sources import registry

OPERATORS = {"bitel": "Bitel", "claro": "Claro", "entel": "Entel", "integratel": "Integratel"}
TECHNOLOGIES = {"2g": "2G", "3g": "3G", "4g": "4G", "5g": "5G"}
SCOPE_COLUMNS = {"cg": "cg", "cgcar": "cgcar"}
SCOPES = {"cg": "CG", "cgcar": "CG+CAR"}
SUPPORTED_TECHNOLOGIES = {"bitel": ("3g", "4g", "5g"), "claro": tuple(TECHNOLOGIES),
                         "entel": tuple(TECHNOLOGIES), "integratel": tuple(TECHNOLOGIES)}


def coverage(operator: str, technology: str, scope: str, bounds: tuple[float, float, float, float], *, limit: int = 4000) -> dict:
    """Returns declared coverage points only for settlement centers in a requested map extent."""
    op, tech, metric = operator.lower(), technology.lower(), scope.lower()
    if op != "all" and op not in OPERATORS:
        raise ValueError("operadora debe ser all, Bitel, Claro, Entel o Integratel")
    if tech not in TECHNOLOGIES:
        raise ValueError("tecnología debe ser 2G, 3G, 4G o 5G")
    operators = ({name: label for name, label in OPERATORS.items() if tech in SUPPORTED_TECHNOLOGIES[name]}
                 if op == "all" else {op: OPERATORS[op]})
    if any(tech not in SUPPORTED_TECHNOLOGIES[name] for name in operators):
        raise ValueError("OSIPTEL no publica esta combinación de tecnología y operadora")
    if metric not in SCOPES:
        raise ValueError("medida debe ser CG o CG+CAR")
    west, south, east, north = bounds
    if not (-81.6 <= west < east <= -68.4 and -18.6 <= south < north <= 0.2):
        raise ValueError("bbox fuera del Perú o con límites inválidos")
    if not warehouse.has("osiptel_cobertura_movil"):
        return {"available": False, "reason": "No hay snapshot OSIPTEL cargado.",
                "provenance": registry.provenance("osiptel_cobertura_movil")}

    suffix = SCOPE_COLUMNS[metric]
    if op == "all":
        columns = [f"{name}_{tech}_{suffix}" for name in OPERATORS if tech in SUPPORTED_TECHNOLOGIES[name]]
        expr = "GREATEST(" + ", ".join(columns) + ")"
        selected_operator = "Mayor valor entre las operadoras"
    else:
        expr = f"{op}_{tech}_{suffix}"
        selected_operator = OPERATORS[op]
    rows = warehouse.query(
        f"""SELECT ubigeo, departamento, provincia, distrito, centro_poblado, clasificacion,
                   lat, lon, {expr} AS cobertura
            FROM osiptel_cobertura_movil
            WHERE lon BETWEEN ? AND ? AND lat BETWEEN ? AND ? AND {expr} > 0
            ORDER BY ubigeo LIMIT ?""",
        [west, east, south, north, limit + 1],
    )
    if len(rows) > limit:
        return {"available": False, "reason": f"Hay más de {limit:,} localidades en esta vista. Acerca el mapa para mostrar el área completa.",
                "provenance": registry.provenance("osiptel_cobertura_movil")}
    return {
        "available": True,
        "items": [row | {"operadora": selected_operator, "tecnologia": TECHNOLOGIES[tech], "medida": SCOPES[metric]}
                  for row in rows[:limit]],
        "truncated": len(rows) > limit,
        "filters": {"operadora": selected_operator, "tecnologia": TECHNOLOGIES[tech], "medida": SCOPES[metric]},
        "provenance": registry.provenance("osiptel_cobertura_movil"),
        "disclaimer": "Punto = centro poblado con cobertura móvil declarada por una operadora; no representa la ubicación de una antena ni calidad medida.",
    }

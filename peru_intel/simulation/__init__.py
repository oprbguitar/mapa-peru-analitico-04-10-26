"""Laboratorio de simulación (plan maestro, fase 4). Solo se ejecuta en la instalación local.

Motores disponibles: S1 (qué pasaría si, determinista), S2 (Monte Carlo con semilla) y S9 (contingencias),
combinados en `accessibility`; S3 (eventos discretos con SimPy, opcional) en `queue`. El resto de la familia S3–S12 figura en `ENGINES` como planificado.
"""
from __future__ import annotations

import os

ENGINE_VERSION = "sim-0.2.0"


def is_local() -> bool:
    """El despliegue público (Render, con contraseña de acceso) solo sirve el visor ligero."""
    return not (os.environ.get("PI_PUBLIC_ACCESS_PASSWORD") or os.environ.get("RENDER"))


def sim_allowed() -> bool:
    """El laboratorio también corre en línea (con límites ligeros) salvo que PI_SIM_PUBLIC=0 lo desactive."""
    return is_local() or os.environ.get("PI_SIM_PUBLIC", "1") != "0"


# En línea (Render Free, 1 núcleo compartido): techos menores para que una simulación no degrade el visor.
# Son ≥ los valores por defecto de la interfaz, así una corrida normal funciona igual; solo se recortan los extremos.
PUBLIC_LIMITS = {
    "accessibility": {"iterations": 500, "points": 600, "facilities": 250, "seconds": 8.0},
    "agents": {"agents": 2000, "replications": 5, "seconds": 8.0, "replay_agents": 250},
    "operations": {"units": 25, "replications": 20, "horizon_h": 12, "expected_calls": 15_000, "seconds": 8.0, "timeline_calls": 800},
    "queue": {"replications": 30, "horizon_h": 24, "expected_calls": 20_000, "seconds": 8.0},
}


def apply_public_limits() -> None:
    """Reduce los techos de cada motor cuando no es la instalación local (idempotente)."""
    if is_local():
        return
    import importlib
    for mod, lim in PUBLIC_LIMITS.items():
        try:
            m = importlib.import_module(f"{__name__}.{mod}")
        except ImportError:  # SimPy opcional
            continue
        for k, v in lim.items():
            if k in m.LIMITS and isinstance(m.LIMITS[k], (int, float)):
                m.LIMITS[k] = min(m.LIMITS[k], v)


ENGINES = [
    {"id": "S1", "name": "Qué pasaría si (determinista)", "status": "disponible", "in": "accessibility"},
    {"id": "S2", "name": "Monte Carlo y sensibilidad", "status": "disponible", "in": "accessibility"},
    {"id": "S3", "name": "Eventos discretos (colas y capacidad)", "status": "disponible", "in": "queue", "requires": "simpy"},
    {"id": "S4", "name": "Agentes sintéticos (evacuación a puntos seguros)", "status": "disponible", "in": "agents"},
    {"id": "S5", "name": "Movilidad y transporte (OSRM/SUMO)", "status": "planificado"},
    {"id": "S6", "name": "Redes de infraestructura y cascadas", "status": "planificado"},
    {"id": "S7", "name": "Optimización multiobjetivo", "status": "planificado"},
    {"id": "S8", "name": "Causales y contrafactuales", "status": "planificado"},
    {"id": "S9", "name": "Contingencias (lluvia, cortes, servicios fuera)", "status": "disponible", "in": "accessibility"},
    {"id": "S10", "name": "Inversión y mercado", "status": "planificado"},
    {"id": "S11", "name": "Entrenamiento y juegos serios", "status": "planificado"},
    {"id": "S12", "name": "3D especializadas", "status": "planificado"},
]

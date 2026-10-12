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

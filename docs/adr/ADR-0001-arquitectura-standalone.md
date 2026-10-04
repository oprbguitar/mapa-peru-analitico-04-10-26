# ADR-0001 — Plataforma standalone, local-first, sin dependencia operativa de RUC360 ni Route 360

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

```yaml
adr_id: ADR-0001
title: Arquitectura standalone local-first (Python stdlib + DuckDB · MapLibre sin build)
status: PROPOSED   # requiere aceptación del responsable; redactarla no la aprueba
owner: Pierre R. Boss (oprbguitar)
prepared_by: Claude Code (eos-architect, sesión 2026-10-04)
decision_date: PENDIENTE
evaluated_revision: primer commit de mapa-peru-analitico-04-10-26
environment: Windows 11, Python 3.12, Node 24 (solo para pruebas E2E y EOS)
affected_components: [peru_intel, apps/web, data]
```

## Contexto comprobado

- Se necesita una plataforma de inteligencia territorial del Perú que reúna criminalidad, movilidad, ambiente,
  infraestructura y espacio, con procedencia verificable, que funcione en una PC sin servidores externos.
- Ya existen piezas propias: RUC360 (Python stdlib, MapLibre + OpenFreeMap con caché, capas vivas portadas de
  God's Eye View, enrutador IA multiproveedor) y OCE/FEDTID (pipelines Node de DEVIDA, MPFN, SIDPOL, APN, WPI).
- Regla de dependencia: Route 360 podrá consultar a este sistema; este sistema nunca depende de Route 360.

## Alternativas comparables

| Opción | Ventaja | Costo | Riesgo | Reversibilidad |
|---|---|---|---|---|
| A. Ampliar RUC360 | Reúso total | Acopla dos productos con ciclos distintos | RUC360 caído = mapa caído | Baja |
| B. **Python stdlib + DuckDB/Parquet, frontend ES modules + MapLibre vendorizado (elegida)** | Mismo lenguaje que RUC360 (port directo de mapa_zona.py y capas_vivas.py), cero build, 2 dependencias | Sin framework de UI | UI más artesanal | Alta: la API v1 es el contrato |
| C. Node/TypeScript + Vite + React (como OCE) | Ecosistema rico | Build, cientos de dependencias, reescribir los módulos Python | Superficie de supply chain | Media |
| D. PostgreSQL + PostGIS desde el día 1 | Multiusuario | Servicio a instalar y operar | Sobredimensionado para local | Media |

## Decisión propuesta

Opción B. Dependencias obligatorias: `duckdb`, `openpyxl`. Opcional: `statsforecast`.
Servidor `ThreadingHTTPServer` en 127.0.0.1, API `/api/v1/*`, SSE para eventos en vivo, frontend estático.

## Consecuencias

- RUC360 y OCE se usan como **fuentes de desarrollo**: sus salidas se importan (con checksum) a `data/`,
  y el sistema arranca con ambos apagados o ausentes.
- PostgreSQL/PostGIS queda como evolución si se centraliza multiusuario (ver ADR-0002).
- Los proveedores en vivo son workers independientes: la caída de uno no afecta a los demás.

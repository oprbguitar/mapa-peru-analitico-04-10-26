# ADR-0002 — Almacenamiento: raw inmutable · Parquet/DuckDB analítico · SQLite WAL operativo

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

```yaml
adr_id: ADR-0002
title: Data lake local mínimo con tres capas
status: PROPOSED
owner: Pierre R. Boss (oprbguitar)
prepared_by: Claude Code (eos-architect)
decision_date: PENDIENTE
affected_components: [peru_intel.storage, peru_intel.sources, data/]
```

## Contexto

SIDPOL ya suma 369 100 filas (7,36 M denuncias) y MPFN 7,28 M denuncias en filas agregadas; el clima, el
tráfico y los vuelos crecerán más. Meter todo en SQLite degrada las agregaciones; un servidor PostgreSQL
contradice el arranque local con doble clic.

## Decisión propuesta

| Capa | Tecnología | Contenido | En git |
|---|---|---|---|
| `data/raw/<fuente>/<AAAA-MM-DD>/` | archivos originales + `.meta.json` | CSV/XLSX/ZIP tal como se descargaron; nunca se modifican ni sobrescriben | No (reproducible; SHA-256 en el manifiesto) |
| `data/parquet/*.parquet` | DuckDB lee y escribe | tablas normalizadas para análisis | Sí (≈ 2,7 MB) |
| `data/catalog/manifest.json` | JSON | procedencia durable por fuente | Sí |
| `data/catalog/catalog.sqlite` | SQLite WAL | registro operativo de fuentes, descargas, auditoría, alertas, trazas de aeronaves | No |
| `data/peru/` | GeoJSON + JSON | paquete territorial | Sí (≈ 1,5 MB) |

## Consecuencias

- Consultas de millones de filas sin servidor. Escritura atómica de Parquet (`.tmp` + `os.replace`).
- Migración futura a PostgreSQL/PostGIS: las vistas Parquet se cargan con `COPY` sin cambiar la API.
- `data/raw` fuera de git evita subir 40 MB de originales; el manifiesto conserva hash, fecha y URL.

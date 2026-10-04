# API v1 — contratos estables

Base: `http://127.0.0.1:8360`. JSON UTF-8. Toda respuesta con cifras incluye `provenance`:
`source_id, name, institution, url, kind, official, geographic_level, coverage_start, coverage_end, downloaded, checksum, transform`.

`kind` ∈ `oficial | vivo_tercero | calculado | estimacion | proyeccion | ia`.

Regla de integración: **Route 360 → (GET) → esta API**. Esta plataforma nunca escribe en Route 360.

## Meta

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/health` | Vida del servicio |
| GET | `/api/v1/meta/sources` | Registro maestro de fuentes (estado, cobertura, checksum, licencia) |
| GET | `/api/v1/meta/status` | Estado de proveedores en vivo, IA, capas territoriales y tablas |
| GET/POST | `/api/v1/meta/settings` | Claves BYOK y modelos (POST solo mismo origen; GET nunca devuelve secretos) |
| GET | `/api/v1/stream` | Server-Sent Events (`event: layer`) |

## Mapa

| Ruta | Descripción |
|---|---|
| `/geo/{departamentos\|provincias\|distritos}.geojson` | Límites (`u` = UBIGEO, `n` nombre, `d` departamento, `p` provincia, `c` [lat, lon]) |
| `/ofm/...` | Mapa base OpenFreeMap con caché local |
| `/api/v1/map/base` | Estilo y estado de la caché |
| `/api/v1/map/search?q=` | UBIGEO por nombre |
| `/api/v1/map/resolve?lat=&lon=` | Distrito, provincia y departamento de un punto |

## Seguridad y criminalidad

| Ruta | Parámetros | Notas |
|---|---|---|
| `/api/v1/intel/crime/families` | — | Familias, extensión SIDPOL, catálogo de indicadores con niveles disponibles |
| `/api/v1/intel/crime/choropleth` | `dataset=sidpol` · `level` · `year` · `months=1-7` · `modalidad` · `compare` | Absoluto, tasa por 100 mil, cambio % (mismos meses del año de comparación) |
| | `dataset=indicador` · `code` · `level` · `year` | 27 indicadores MININTER; error explícito si el nivel no existe |
| | `dataset=mpfn` · `year` · `tid=1` · `generico` | Departamento de la sede fiscal |
| | `dataset=devida` · `indicador` · `year` | Coca, erradicación, decomisos |
| | `dataset=indice` | Índice Situacional v1 (no oficial) |
| `/api/v1/intel/regions/{ubigeo}/crime` | `year`, `months` | Ficha completa + índice (si es departamento) |
| `/api/v1/intel/regions/{ubigeo\|PE}/forecast` | `modalidad` | Proyección 6 meses + anomalía |
| `/api/v1/intel/index` | — | Índice con desglose por región y SHA-256 de la metodología |
| `/api/v1/intel/history` | `ubigeo`, `modalidad` | Serie mensual SIDPOL |
| POST `/api/v1/intel/ai/ask` | `{ubigeo, question}` | DataAgent → GeoAnalyst → Verifier |

## En vivo e infraestructura

| Ruta | Fuente |
|---|---|
| `/api/v1/intel/flights` · `/flights/{hex}?callsign=` | adsb.lol + adsbdb, traza reducida 6 h |
| `/api/v1/intel/vessels` | aisstream.io (BYOK) |
| `/api/v1/intel/ports` | APN + WPI (+ barcos AIS cercanos) |
| `/api/v1/intel/datacenters` | OSM |
| `/api/v1/intel/satellites?group=` | CelesTrak (posiciones se calculan en el cliente) |
| `/api/v1/intel/seismic` | IGP (primaria) + USGS |
| `/api/v1/intel/fires` | NASA FIRMS VIIRS (BYOK) |
| `/api/v1/intel/weather` | `observed` SENAMHI · `models` GFS y ECMWF (Open-Meteo) — nunca mezclados |
| `/api/v1/intel/traffic` · `/traffic/tiles/{z}/{x}/{y}.png` · `/traffic/point?lat=&lon=` | TrafficProvider (TomTom BYOK) |
| `/api/v1/intel/events` | Estado de workers y alertas |

Las capas en vivo devuelven `{status: {status, updated, age_s, error, count}, data, provenance}`.
`status.status` ∈ `ok | esperando | desactualizado | error | sin_configurar`.

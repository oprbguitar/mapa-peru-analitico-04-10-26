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
| `/api/v1/map/basemaps` | Mapas base realistas y relieve |
| `/tiles/base/{satelite\|etiquetas\|sentinel\|topo\|dem\|ign100}/{z}/{x}/{y}` | Teselas con caché propia y de RUC360 (solo lectura) |
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
| `/api/v1/intel/weather` | `observed` SENAMHI · `models` GFS y ECMWF (Open-Meteo) en capitales — nunca mezclados |
| `/api/v1/intel/weather/point?lat=&lon=&providers=` | Clima combinado en cualquier punto del mundo: `primary`, `results` por proveedor, `consensus` (calculado) |
| `/api/v1/intel/weather/providers` | Proveedores, si están configurados, cuota diaria y consumo de hoy |
| `/api/v1/intel/weather/layers` | Catálogo de capas NASA GIBS (con fecha) y SENAMHI · IDESEP |
| `/api/v1/intel/weather/tiles/{gibs\|senamhi}/{capa}/{z}/{x}/{y}.{png\|jpg}` | Teselas meteorológicas con caché |
| `/api/v1/intel/traffic` · `/traffic/tiles/{z}/{x}/{y}.png` · `/traffic/point?lat=&lon=` | TrafficProvider (TomTom BYOK) |
| `/api/v1/intel/events` | Estado de workers y alertas |

Las capas en vivo devuelven `{status: {status, updated, age_s, error, count}, data, provenance}`.
`status.status` ∈ `ok | esperando | desactualizado | error | sin_configurar`.
Las respuestas OSIPTEL incluyen año, checksum, licencia y transformación. OSM incluye atribución ODbL y advierte que el registro no equivale a un inventario oficial ni confirma que una instalación esté operativa.

## v0.3

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/map/geocode?q=` | Territorio oficial (offline) y lugares Nominatim (en línea, caché) |
| GET | `/api/v1/intel/context?lat=&lon=` | Informador 360 del punto (`online=0` evita consultas en línea) |
| GET | `/api/v1/intel/context/media?q=` | Titulares GDELT — señal no verificada |
| GET | `/api/v1/intel/observatory/{ubigeo}?modalidad=` | Observatorio de denuncias del territorio |
| GET | `/api/v1/intel/patterns/{hotspots, sequences, leadlag, changes, anomalies, forecast}?scope=&modalidad=` | Motor de patrones |
| GET | `/api/v1/intel/routes?from=&to=` o `?alat=&alon=&blat=&blon=` | Rutas estratégicas comparadas |
| GET | `/api/v1/intel/layers/{services, emergencies, roads}` | Servicios (bbox, cat), INDECI (days) y MTC |
| GET | `/api/v1/intel/layers/mobile-coverage?bbox=&operator=&technology=&scope=` | OSIPTEL 2025, centros poblados con cobertura móvil declarada; `operator=all|bitel|claro|entel|integratel`, `technology=2g|3g|4g|5g`, `scope=cg|cgcar`. Máximo 4 000 puntos por vista; si se excede, solicita acercar el mapa y no devuelve una muestra sesgada. |
| GET | `/api/v1/intel/layers/telecom?bbox=&cat=` | Objetos de antena/torre etiquetados en OSM dentro del área visible; `cat=mobile,antenna,tower`, consulta acotada a 8 grados² y caché en memoria por 5 min. |
| GET | `/api/v1/intel/institutions?cat=&ubigeo=` | Sedes de seguridad y justicia (OSM) |
| GET | `/api/v1/intel/enso`, `/api/v1/intel/ocean`, `/api/v1/intel/weather/grid` | El Niño, corrientes y rejilla meteorológica |
| POST | `/api/v1/intel/ai/enso`, `/api/v1/intel/ai/explain` | IA verificada sobre hechos numerados |
| GET | `/api/v1/admin/engineering/ai` | Vista del AI Gateway (sin secretos) |
| POST | `/api/v1/admin/engineering/ai/{kill, allow_paid, provider, key, feature, budget, test, load, unload, pull, reset}` | Acciones auditadas (PIN si `admin_pin`) |
| POST | `/api/v1/ai/voice/command`, `/ai/voice/tts` (JSON), `/ai/voice/stt` (audio/*) | Asistente de voz |
| POST | `/api/v1/ai/voice/realtime`, `/ai/voice/realtime/settle` | Credencial efímera OpenAI Realtime y liquidación |
| GET/POST | `/api/v1/intel/vision/{cameras, discover, events, probe, go2rtc, cameras/delete}` | Vision Edge |
| GET | `/api/v1/intel/vision/snap/{cam}/{canal}.jpg` | Foto del canal (solo equipos de la red local) |

Errores del gateway: `AI_DISABLED · INVALID_REQUEST · INVALID_MODE · CAPABILITY_UNSUPPORTED · PRIVACY_DENIED · RESOURCE_DENIED ·
BUDGET_DENIED · DEADLINE_EXCEEDED · PROVIDER_UNAVAILABLE · OUTPUT_INVALID · CANCELLED · TOOL_DENIED`.

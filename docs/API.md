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

### Capas territoriales fechadas (0.5.0)

| GET | Parámetros | Respuesta y límites |
|---|---|---|
| `/api/v1/imagery/search` | `bbox=w,s,e,n` o `geometry` Polygon JSON, `start/end=AAAA-MM-DD`, `cloud=0..100`, `limit=1..50` | Adquisiciones Sentinel-2, fecha UTC, resolución publicada, nube de escena, enlaces STAC; área ≤4 grados² |
| `/api/v1/imagery/tiles/{id}/{z}/{x}/{y}.png` | ID de adquisición STAC | PNG RGB reproyectado EPSG:3857; caché inmutable por escena |
| `/api/v1/imagery/crop` | `id`, `bbox` o `geometry` | Binario GeoTIFF con CRS, transformación y etiquetas de adquisición/fuente; área ≤0,08 grados², ≤40 M valores de banda |
| `/api/v1/flights/history` | `start/end` segundos Unix | Hasta 200 aeronaves recibidas localmente; intervalo ≤7 días |
| `/api/v1/flights/history/{icao}` | ICAO hexadecimal 6 caracteres, `start/end` | Hasta 10 000 muestras: `received_at`, altitud barométrica convertida, `gap_before`; no archivo global |
| `/api/v1/street/images` | `bbox=w,s,e,n` | Hasta 100 fotos Mapillary con `captured_at`; área ≤0,25° por lado; `key_required` sin clave |
| `/api/v1/street/image/{id}` | ID numérico Mapillary | Miniatura proxy ≤5 MB; CDN permitido, sin redirecciones ni secreto en URL |
| `/api/v1/intel/weather/clouds` | — | Hora/historial publicado NOAA GetCapabilities, resolución aproximada y procedencia |
| `/api/v1/intel/weather/clouds/tiles/{z}/{x}/{y}.png` | `time` publicado | Mosaico infrarrojo georreferenciado; no máscara exclusiva de nubes |

`/api/v1/intel/layers/mobile-coverage` admite `status=covered|uncovered|all` además de los filtros existentes.
`uncovered` exige ceros explícitos; faltantes no prueban ausencia. `/layers/telecom` conserva atribución OSM,
tecnologías/operador solo cuando constan, revisión OSM y proximidad geométrica al centro de la vista.
POST `/meta/settings` admite `mapillary_token`; GET solo informa si está configurado. En Render usa `PI_MAPILLARY_TOKEN` secreto para persistirlo.
Rutas nuevas siguen autenticación/CSP existentes. Fallos de proveedor: 502 genérico; parámetros inválidos: 400.

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
| `/api/v1/intel/eonet` | NASA EONET · eventos naturales curados (90 días, recuadro Perú, sin clave, no oficial) |
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

## Operativos conjuntos (en línea y local)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/intel/ops/catalog` | Tipos de recurso (modo, sede de salida, personas, alistamiento, velocidad o factor), incidencias, instituciones de costo, perfil horario de tráfico (supuesto), tarifario de **ejemplo** (no oficial), conteo de apoyos y límites. |
| GET | `/api/v1/intel/ops/facilities?bbox=o,s,e,n&cat=&limit=` | Apoyos dentro del recuadro: comisaría, serenazgo, fiscalía, judicial (OSM), hospital y salud (RENIPRESS), bomberos (OSM), aeropuerto, puerto, base_militar, base_naval, mercado (OSM). Con `provenance`. |
| GET | `/api/v1/intel/ops/nearest?lat=&lon=&cat=&n=3&max_km=400` | Apoyos más cercanos por categoría con distancia en línea recta. |
| POST | `/api/v1/intel/ops/plan` | `{operations:[{id,lat,lon,incident,start?,onsite?,complexity?,resources:[{kind,qty?,crew?,prep?,delay?,force_fail?,origin?{lat,lon,name}}]}], hypothesis?{start_hour,day,rain,congestion?,p_fail,fail_delay,sigma,return,runs,seed,routing:osrm\|recta,use_tomtom}, tariff?{kind:{km,hora,persona_hora,fijo}}, tariff_origin?}` → por recurso: sede de salida, ruta, tiempos (sale, listo, llega, termina, vuelve), P50/P90, km, horas y costo; por operativo: primera llegada y llegada de todos; totales, costo por institución y por tipo, eventos, avisos, `method`, `kind: estimacion` y `provenance`. Máx. 12 operativos, 80 recursos y 30 rutas OSRM por plan. 400 si faltan datos. |

## Simulación (solo instalación local)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/sim/engines` | Catálogo S1–S12 con estado, servicios, valores por defecto, límites, `local` (false en la nube) y `queue.available` (SimPy instalado). |
| POST | `/api/v1/sim/accessibility/run` | `{area:{lat,lon,radius_km}, service, base?, hypothesis?, iterations?, seed?}` → resultados A/B, puntos, supuestos, `provenance`, `run_id`. 403 en la nube, 400 si los parámetros están fuera de rango. |
| POST | `/api/v1/sim/queue/run` | S3 (SimPy, opcional). `{area, service, base?, hypothesis?{…, demand_pct}, queue?{rate_per_h, capacity, capacity_by_id?, service_min, horizon_h, max_sites?}, replications?, seed?}` → espera p50/p90, respuesta, % atendidas ≤ 30 min, utilización y derivadas por sede, cuellos de botella (A/B y B − A), supuestos, `provenance`, `run_id` `cap-…`. 403 en la nube, 400 fuera de rango, 503 si falta SimPy. |
| POST | `/api/v1/sim/operations/run` | Operativo simulado: `{area, units:[{id,kind,lat,lon}], tramos:[{id,coords}], hypothesis?, base?, ops?:{rate_per_h,horizon_h,service_min,target_min,detour_per_tramo_pct,mix}, replications?, seed?}` → métricas, ocupación por unidad y `timeline` reproducible. |
| GET · POST | `/api/v1/sim/scenarios` | Lista · guarda (nuevo o nueva versión con `id`) `{name, spec, run_id?, metrics?, note?}`. |
| GET | `/api/v1/sim/scenarios/<esc-id>` | Escenario con todas sus versiones. |
| POST | `/api/v1/sim/scenarios/<esc-id>/duplicate` | Copia independiente `{name?}` que recuerda su origen. |
| GET | `/api/v1/sim/runs?limit=` | Últimas ejecuciones registradas (`engine`: `accessibility` o `queue`). |
| GET | `/api/v1/sim/runs/<run_id>` | Ejecución completa (parámetros, semilla, versión del motor, resultados). |

## JEV, avisos, usuarios y actividades (solo instalación local salvo `auth/me`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/jev/contract` | Contrato v1, decisiones posibles y motor activo (`jev-ref-0.1` o externo). |
| POST | `/api/v1/jev/evaluate` | `{run_id}` → puntuación interna (no probabilidad), incertidumbre, variabilidad, calidad de datos, decisión, acciones y hechos. |
| POST | `/api/v1/jev/compare` | `{run_ids}` o `{scenario_ids}` → ranking, empates técnicos y nota; la decisión es humana. |
| GET | `/api/v1/notifications?type=&limit=` | Avisos visibles para el usuario (todos, su rol, él mismo) y no leídos. |
| POST | `/api/v1/notifications/read` | `{ids}` o `{all: true}`. |
| GET | `/api/v1/auth/me` | `{enabled, user, roles, perms, local}`. |
| POST | `/api/v1/auth/login` · `/api/v1/auth/logout` | `{name, pin}` → cookie `pi_session` (HttpOnly, SameSite=Strict). |
| GET · POST | `/api/v1/users` | Lista (administración) · crea `{name, role, pin}` (el primero debe ser administrador). |
| POST | `/api/v1/users/<id>/role` · `/remove` | Cambia rol · quita (siempre queda un administrador). |
| GET | `/api/v1/users/directory` | Nombres y roles para asignar actividades (coordinación). |
| GET · POST | `/api/v1/activities` | Lista (propias para participantes) · crea `{title, assignee, scenario_id?, due?, detail?}`. |
| POST | `/api/v1/activities/<id>/status` | `{status: pendiente|en_curso|hecha|bloqueada, note?}`. |

Con usuarios activados, toda la API salvo `/api/v1/health` y `/api/v1/auth/*` responde 401 sin sesión.

## Consola de conexiones (administración, solo local)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/admin/connections` | Fichas (finalidad, dirección sin ruta, autenticación sin valores, frecuencia, estado, última sincronización, respaldo, uso), componentes y fuentes por simulación. |
| POST | `/api/v1/admin/connections/<id>/test` | Prueba la conexión (capa en vivo o HEAD 6 s). Auditada; un fallo emite aviso técnico. |

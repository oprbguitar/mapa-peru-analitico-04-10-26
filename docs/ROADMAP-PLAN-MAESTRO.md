# Hoja de ruta derivada del plan maestro local — 11 de octubre de 2026

Fuente: `MAPA_PERU_ANALITICO_PLAN_MAESTRO_LOCAL_2026-10-11.md` (índice, §2.5 inventario de fase cero, §6 OAR,
§13 capas avanzadas y §19 fases). Commit evaluado: `b03f45e` (rama `main`).
Este documento **no reemplaza** a `docs/ROADMAP.md` (estado verificado de lo que ya existe); ordena lo que viene.

## 1. Regla de reparto: pesado en local, visor ligero en la web

El plan maestro pide desarrollo y ejecución locales. La decisión vigente del responsable (11/10/2026) mantiene
además un **visor web ligero** en Render (`srv-db437cvlk1mc73elcds0`, Free, almacenamiento efímero). El reparto:

| Va al visor web (Render) | Solo local (PC del responsable) |
|---|---|
| Mapa, capas en vivo de terceros sin clave, fichas con procedencia, comparador A/B de escenas ya publicadas, histórico de vuelos breve | Usuarios y permisos reales, proyectos y escenarios persistentes, OAR, simulación (S1–S12), JEV, intérprete de imágenes, visión artificial y cámaras RTSP/WebRTC, drones y fotogrametría, IA local (Ollama), receptores SDR |
| Todo lo que sea lectura, pequeño y cacheable | Todo lo que reserve CPU/GPU/RAM, guarde datos de usuarios o toque la red local |

Criterio para decidir dónde vive algo nuevo: si necesita **reserva de recursos** (§6.3), **datos de una
persona u organización**, o **acceso a la red local**, es solo local. Si es una consulta acotada a un
proveedor público con caché y procedencia, puede ir al visor web.

## 2. Fases priorizadas por costo e impacto

Costo: S (horas) · M (días) · L (semanas) · XL (meses). Impacto: qué desbloquea para el producto.
El orden respeta las dependencias de §19 (0 → 1 → 2 → 3 → 4 antes de 5–9) y adelanta solo piezas S que no
comprometen esa secuencia.

| # | Fase / pieza | Costo | Impacto | Dónde | Estado al 11/10/2026 |
|---|---|---|---|---|---|
| 0a | Capas sin clave para Perú desde GOdEyes (eventos naturales EONET) | S | Medio: riesgo territorial visible sin configurar nada | Web + local | ✅ entregada hoy (ver §4) |
| 0b | Inventario de fase cero (§2.5): matriz funcionalidad · código · dependencia · fuente · estado probado · limitación · cambio · riesgo · prioridad | M | Alto: evita duplicar módulos | Local | 🟡 base en `docs/ROADMAP.md` y §3; falta línea base CPU/RAM/GPU en el equipo de referencia |
| 0c | Línea base de rendimiento en Windows (Ryzen 7 1700, 16 GB, GTX 1070) | S | Alto: condición previa del OAR | Local | ⬜ |
| 1 | Inicio, cuentas, roles, proyectos; integrar el PIN de `admin.js` como segundo control | L | Muy alto: convierte el visor en aplicación de organización | **Solo local** | 🟡 11/10: usuarios con roles (admin/coordinador/participante), sesión, actividades con historial, avisos por destinatario y auditoría; faltan proyectos múltiples y unificar con el PIN de `admin.js` |
| 2 | Catálogo de módulos + OAR (colas acotadas, *leases*, cancelación, checkpoints, telemetría) | L | Muy alto: permite crecer sin congelar el mapa | **Solo local** | ⬜ (los `Worker` bajo demanda de `peru_intel/live/worker.py` son el germen: demanda, backoff, caché) |
| 3 | Modo Estrategia 360: escenarios, dibujo, ramas A/B/C, guardado, import/export | L | Muy alto: pasa de visor a herramienta | Local (exportar escenario como archivo para verlo en web) | 🟡 11/10: zona circular, unidades, tramos cortados, tiempo virtual, escenarios con versiones/duplicado/comparación; faltan polígonos libres, rutas, notas/evidencias, import/export y estados del escenario |
| 4 | Laboratorio de simulación (what-if, Monte Carlo, SimPy) + JEV desacoplado | L | Muy alto: demostración de «jugar con los datos» | **Solo local** | 🟡 S1+S2+S9 (accesibilidad A/B) y S3 (capacidad con SimPy) entregados el 11/10; JEV pendiente |
| 5 | Cámaras continuas (go2rtc → WebRTC/MSE) con JPEG como respaldo | M | Alto si hay grabador disponible | **Solo local** | 🟡 registro y mosaico JPEG existen (`vision.js`, `vision/device.py`) |
| 6 | Imágenes: auditar Sentinel-2 A/B, intérprete local por teselas | M–L | Alto | Consulta en web · interpretación **solo local** | 🟡 comparador A/B verificado |
| 7 | Agentes, movilidad (SUMO), sensores, drones | XL | Medio | **Solo local** | 🟡 12/10: agentes sintéticos de evacuación con congestión (S4); faltan red vial (SUMO/OSRM), sensores y drones |
| 8 | Productos piloto (Municipio 360 + Market Simulator o Crisis Room) | XL | Comercial | Local; demo exportable | ⬜ |
| 9 | Empaquetado Windows, respaldos, actualizaciones firmadas | M | Alto para entrega | **Solo local** | 🟡 `INICIAR-MAPA.bat` y contenedor |

### OAR (§6) en una línea por obligación

Perfiles Esencial / Equilibrado / Intensivo detectados en el arranque (no supuestos); prioridades 0–4; colas
con límite y *backpressure*; concurrencia por clase (una carga GPU a la vez); cancelación efectiva; puntos de
control con semilla; idempotencia; caché por capas (RAM → SSD → HDD); procesamiento progresivo; descarte de
frames viejos; reinicio controlado de workers; modo seguro que mantiene el visor; telemetría local. Tecnología
mínima: `psutil`, procesos trabajadores, cola SQLite, sin Redis ni Docker obligatorio. **Nada del OAR se
despliega en Render**: allí solo corre el visor.

## 3. Inventario resumido de capas en vivo (para la matriz de fase cero)

| Funcionalidad | Código | Fuente | Clave | Estado probado | Limitación |
|---|---|---|---|---|---|
| Vuelos ADS-B | `live/adsb.py`, `flight_history.py` | adsb.lol / airplanes.live / adsb.fi | No | ✅ | Cobertura de receptores comunitarios |
| Embarcaciones AIS | `live/ais.py` | aisstream.io | **Sí** | 🟡 | Sin clave no hay datos |
| Satélites | `live/celestrak.py` + satellite.js | CelesTrak | No | ✅ | Posición calculada, no imagen nueva |
| Sismos | `live/seismic.py` | IGP (primaria) + USGS | No | ✅ | — |
| Focos de calor | `live/firms.py` | NASA FIRMS | **Sí** | 🟡 | Anomalía térmica ≠ incendio |
| Eventos naturales | `live/eonet.py` | NASA EONET | No | ✅ nuevo | Curado por terceros, incluye zonas fronterizas |
| Nubes observadas | `weather/clouds.py` | NOAA | No | ✅ | Latencia del proveedor |
| Tráfico | `live/traffic.py` | TomTom | **Sí** | 🟡 | — |
| Cámaras | `vision/*` | Dahua/ONVIF/RTSP | Credenciales locales | 🟡 | JPEG periódico, no video (§2.2) |

## 4. GOdEyes frente a Mapa: huecos útiles para el Perú

Comparación de `GOdEyes/server/providers` con `peru_intel/live`, `peru_intel/weather` y `apps/web/js`.

| Proveedor GOdEyes | ¿Mapa ya lo tiene? | Utilidad para Perú | Clave | Costo | Decisión |
|---|---|---|---|---|---|
| `aircraft/*` (adsb.lol, OpenSky, enriquecimiento, tracks) | Sí (`adsb.py`, histórico) | — | — | — | Solo adoptar enriquecimiento de tipo si falta |
| `space/celestrak` | Sí | — | — | — | — |
| `space/launch-library` | No | Baja (lanzamientos no ocurren en Perú) | No | S | Descartar |
| `vessels/ais-live` + `ais-store` | Sí (`ais.py`, aisstream) | Alta: costa, Callao, Paita, pesca | **Sí** | — | Mantener; documentar cómo obtener la clave gratuita |
| `firms` | Sí | — | Sí | — | — |
| `wind/*` (GFS/IFS GRIB decodificado) | Parcial: rejilla Open-Meteo y viento puntual | Alta para incendios, drones y costa | No | **M** (decodificar GRIB o rejilla Open-Meteo con partículas) | Siguiente candidata web: rejilla de viento **modelo** (proyección) sobre la rejilla `wxgrid` ya existente |
| `firePerimeters` (NIFC WFIGS) | No | **Nula**: solo EE. UU. | No | — | Descartar; en Perú usar EONET (puntos GDACS) + FIRMS |
| `cyclones` (NHC) | No | Nula: Atlántico y Pacífico norte | No | — | Descartar |
| `weather` (nowCOAST NOAA) | Equivalente: GIBS + SENAMHI IDESEP | Baja (centrado en EE. UU.) | No | — | Descartar |
| `traffic` (TomTom) | Sí | — | Sí | — | — |
| `transit`, `transitHistory`, `gbfs` | No | Baja: no hay GTFS-RT ni bicicletas públicas abiertas verificadas en Lima | No | M | Esperar fuente peruana publicada (§13.4) |
| `local-receivers` (dump1090/readsb `aircraft.json`) | No | Media: receptor RTL-SDR propio | No | S–M | **Solo local** (red privada); fase 7 |
| `radio` (Radio Browser) | No | Baja | No | S | Opcional, sin prioridad |
| `military-installations` (Overpass) | No | Sensible | No | S | No adoptar sin decisión explícita (§18) |
| `mapillary` | Sí | — | Sí | — | — |
| `overpass`, `places` | Sí (`telecom.py`, servicios OSM) | — | — | — | — |
| `regional` (briefing, noticias, efectos) | Parcial (Informador 360) | Media | Varía | M | Evaluar noticias con procedencia en fase posterior |
| `cctv` (cámaras públicas) | No; Mapa usa cámaras propias | Baja: casi no hay cámaras públicas abiertas en Perú | — | — | Descartar |
| — (no está en GOdEyes) NASA EONET | **Agregado hoy** | Alta: volcanes del sur (Sabancaya), inundaciones, incendios GDACS | No | S | ✅ |
| — tsunamis PTWC / DHN | No | Alta (costa) | No | S–M | Candidata siguiente (estado ⬜ en `ROADMAP.md`) |

## 5. Entregado el 11/10/2026

- **Capa «Eventos naturales (90 días)»** en Capas → Emergencias y riesgos. Apagada por defecto; no se consulta
  al arrancar. Endpoint `GET /api/v1/intel/eonet` con `provenance` (`nasa_eonet`, naturaleza `vivo_tercero`,
  no oficial). Cada evento conserva quién lo reportó (GDACS, Smithsonian GVP…), fecha de su última geometría,
  abierto/cerrado, y si el punto es publicado o calculado (promedio de vértices de un polígono).
- **Corrección móvil**: en 360 px la pestaña «Capas» abría la hoja fuera de pantalla porque el inicio limpio
  la marcaba replegada; en móvil ahora manda la hoja elegida en la barra inferior.
- Pruebas: `tests/test_eonet.py` (unitaria) y `tests/e2e/natural-events.mjs` (1280 y 360 px).

- **Laboratorio de simulación (fase 4, adelantada a pedido del usuario)** — modo **Simular**, visible solo en local.
  Accesibilidad a hospitales, establecimientos de salud, bomberos o comisarías en un área de 5/10/20/30 km.
  Escenario A (base) frente a B (lluvia, congestión, servicios fuera, rodeo por cortes, cierre manual de sedes),
  Monte Carlo con semilla y números aleatorios comunes, percentiles 5–50–95, convergencia, supuestos y validez
  («exploratorio», naturaleza `estimacion`). Cada corrida queda en `data/simulation/runs/<run_id>.json` (idempotente).
  En Render la API responde 403 y la pestaña no aparece. Pruebas: `tests/test_simulation.py` (incluye un caso
  con solución cerrada) y `tests/e2e/simulation-lab.mjs` (1280 y 360 px).
- **S3 · Capacidad (eventos discretos, SimPy opcional)** — pestaña «Capacidad» dentro de Simular. Llamadas de Poisson
  a una tasa declarada (supuesto, nunca repartida de cifras distritales) → sede operativa más cercana con unidad libre
  → traslado (modelo de accesibilidad) → atención → liberación. Espera p50/p90, % atendidas ≤ 30 min, utilización por
  sede y cuellos de botella, A/B con la misma hipótesis (+ cambio de demanda) y números aleatorios comunes. Registro
  `cap-<hash>`, `POST /api/v1/sim/queue/run` (503 sin SimPy, 403 en la nube). Validado con M/M/1 de solución cerrada.

## 6. Siguiente paso recomendado

1. Simulación, siguiente pieza: guardar y comparar escenarios (fase 3) y ajustar capacidad por sede desde el mapa
   (la API ya acepta `capacity_by_id`); después S7 (optimización de ubicación) sobre el motor S3.
2. Fase 0c (línea base de rendimiento) y 0b (completar la matriz) — local, costo S–M.
3. Fase 1 (cuentas y permisos) — solo local; es la dependencia de todo lo demás del plan.
4. En paralelo, piezas S para el visor: tsunamis PTWC y rejilla de viento modelo.

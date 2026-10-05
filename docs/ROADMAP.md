# Hoja de ruta por fases — estado real al 2026-10-04

Leyenda: ✅ hecho y verificado · 🟡 parcial / requiere configuración · ⬜ pendiente

| Fase | Contenido | Estado | Evidencia / lo que falta |
|---|---|---|---|
| 0 · EOS y auditoría | EOS 4.1.0 instalado (`--host all`), ADOPT, AUDIT, ADR 0001–0004 | ✅ | `docs/eos/`, `docs/adr/` (ADR en estado PROPUESTO hasta tu aceptación) |
| 1 · Mapa standalone | Proxy OFM con caché, paquete territorial, `Ruc360MapAdapter`, offline | ✅ | Falta auditar la carpeta 3SL (no encontrada) y PMTiles |
| 2 · Catálogo de fuentes | `source_registry`, raw inmutable, manifiesto, DuckDB/Parquet, SourceHarvester | ✅ | Pruebas de inmutabilidad y cambio de esquema |
| 3 · Seguridad ciudadana | SIDPOL, indicadores MININTER, población, MPFN, DEVIDA, choropleth por escalas, histórico, índice v1 | ✅ | Percepción de inseguridad: no está en los datasets abiertos usados |
| 4 · Capas RUC360/God's Eye | Vuelos ✅ · satélites ✅ · puertos ✅ · centros de datos ✅ · barcos AIS 🟡 | 🟡 | AIS requiere clave aisstream.io |
| 5 · Tráfico | `TrafficProvider` + `TomTomProvider` | 🟡 | Requiere clave TomTom |
| 6 · Ambiente | IGP+USGS ✅ · GFS/ECMWF ✅ · **clima combinado por punto** ✅ (Open-Meteo + MET Norway sin clave; WeatherAPI, Visual Crossing, OpenWeather, Tomorrow.io 🟡 con clave) · **SENAMHI IDESEP WMS** ✅ · **NASA GIBS** ✅ · FIRMS 🟡 · estaciones SENAMHI 🟡 (CSV) · tsunami ⬜ | 🟡 | Proveedores con clave sin probar con claves reales |
| 6b · Vista realista | Satélite híbrido, Sentinel-2, topográfico, IGN, relieve 3D Terrarium + sombreado + cielo | ✅ | Reutiliza en solo lectura la caché de RUC360 (`data/teselas`) |
| 6c · Interfaz HUD | Estilo táctico inspirado en God's Eye View, noche/día | ✅ | `DESIGN.md` v0.2 |
| 7 · IA | Router local/externo, DataAgent, GeoAnalyst, Verifier | ✅ | Probado con Ollama `qwen3.5:9b` (7/7 oraciones verificadas) |
| 8 · Predicción | StatsForecast AutoETS + anomalías; respaldo naive estacional | ✅ | `requirements-forecast.txt` |
| 9 · Cámaras | Vision Edge: registro, prueba Dahua, búsqueda en red, visor/mosaico, go2rtc, ingesta de eventos | ✅ | Probar con el XVR conectado; nodo de detección fuera del repo |
| 10 · API Route 360 | `/api/v1/intel/*` solo lectura | ✅ (contrato) | Autenticación para acceso en red pendiente |

| 11 · Decisión | Informador 360, observatorio, patrones (Gi*, secuencias, lead/lag, cambios, anomalías, competencia de modelos), rutas estratégicas, Event Store H3 | ✅ | v0.3 |
| 12 · Fuentes de riesgo | INDECI SINPAD, MTC vías, INGEMMET (en línea), RENIPRESS, colegios/bomberos OSM, GDELT (no verificado) | ✅ | datosabiertos exige descarga manual (HTTP 418) |
| 13 · El Niño | ENFEN, ICEN, NOAA CPC, historias animadas, corrientes | ✅ | Actualizar `config/enso_eventos.json` cada comunicado |
| 14 · AI Gateway y voz | Modos EOS, intersección, presupuesto, circuitos, administrador; asistente local/pago y Realtime | ✅ | Probar proveedores de pago con claves reales |
| 15 · Contenedor | Dockerfile, compose con perfiles, exportación a .tar | 🟡 | Construir y probar con Docker Desktop encendido |
| 16 · Siguiente | WorldPop/GHSL/VIIRS, COES, OSIPTEL, CDC-MINSA, Overture, SatNOGS/SDR, Valhalla offline | ⬜ | Priorizar con el usuario |

## Siguientes pasos sugeridos

1. Aceptar o ajustar los ADR (cambiar `status: PROPOSED` → `ACCEPTED`).
2. Cargar claves BYOK en «Claves» y validar AIS, TomTom y FIRMS (hallazgo A-07).
3. Migrar el almacenamiento de claves a DPAPI (hallazgo A-01).
4. Entregar la carpeta 3SL para auditar la cartografía detallada.
5. Programar `ingest all --download` mensual (SIDPOL e indicadores se actualizan cada mes).
6. Empaquetar `data/peru` + teselas como PMTiles para la versión web.

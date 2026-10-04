# Mapa Perú Analítico

Plataforma **standalone, local-first** de inteligencia geoespacial y situacional del Perú: seguridad ciudadana,
movilidad, ambiente, infraestructura y espacio en un solo mapa, con la **procedencia de cada cifra** a la vista.

```text
RUC360 ──(exporta territorio y patrones)──► Mapa Perú Analítico ◄──(GET /api/v1/intel)── Route 360
OCE/FEDTID ──(pipelines oficiales)──────────┘        │
EOS ──(gobierno de desarrollo y auditoría)───────────┘        Mapa Perú Analítico ──X──► Route 360
```

## Arranque rápido

**Doble clic en `INICIAR-MAPA.bat`** → abre `http://127.0.0.1:8360/`.

O manualmente:

```bash
python -m pip install -r requirements.txt
python -m peru_intel serve --open
```

Los datos oficiales normalizados ya vienen en el repositorio (`data/parquet`, `data/peru`); el mapa funciona sin
descargar nada. Para actualizar: `python -m peru_intel ingest all --download`.

## Qué incluye

- **Seguridad y criminalidad**: denuncias SIDPOL por departamento, provincia y distrito (2018-01 → 2026-07),
  27 indicadores MININTER (victimización, homicidios, extorsión, capacidad policial…), delitos ante el Ministerio
  Público, drogas/TID (DEVIDA) y un **índice compuesto no oficial** reproducible. Siempre absoluto · tasa · cambio.
- **Tiempo como dimensión**: AHORA · 24 H · 7 D · 30 D · 1 AÑO · 5 AÑOS sobre una espina con la serie nacional.
- **En vivo**: vuelos, embarcaciones (AIS), satélites, sismos (IGP + USGS), focos de calor (FIRMS), clima
  (SENAMHI observado vs. GFS/ECMWF modelo), tráfico (TomTom), puertos y centros de datos.
- **Clima combinado en cualquier punto del mundo**: Open-Meteo, MET Norway, WeatherAPI, Visual Crossing,
  OpenWeather y Tomorrow.io lado a lado, con consenso calculado; capas oficiales SENAMHI (IDESEP) y satelitales NASA GIBS.
- **Vista realista y 3D**: satélite, Sentinel-2, topográfico, Carta Nacional IGN y relieve 3D con cielo atmosférico.
- **Interfaz HUD** de estilo táctico (referencia God's Eye View), noche/día.
- **IA verificada**: DataAgent → GeoAnalyst (Ollama local) → Verifier, que marca NO VERIFICADO toda cifra sin soporte.
- **Proyección**: StatsForecast AutoETS con intervalos 80/95 % y detección de anomalías.
- **API v1** de solo lectura para Route 360.

## Estructura

```text
apps/web/            interfaz (MapLibre, módulos ES sin build)
peru_intel/
  backend/           servidor HTTP, API v1, SSE
  map/               Ruc360MapAdapter, proxy OpenFreeMap, paquete territorial
  sources/           catálogo, registro de fuentes, SourceHarvester
  ingestion/         MININTER (SIDPOL, indicadores), INEI población, MPFN, DEVIDA, puertos
  live/              workers: ADS-B, AIS, CelesTrak, IGP/USGS, FIRMS, clima, tráfico
  weather/           clima combinado por punto, consenso, capas SENAMHI WMS y NASA GIBS
  analytics/         criminalidad, índice, proyección
  ai/                proveedores, router, agentes, verificador
  storage/           SQLite WAL + DuckDB/Parquet
plugins/vision-edge/ contrato opcional de cámaras
config/              crime_index_v1.yaml
data/                peru/ · parquet/ · normalized/ · catalog/ (raw/ fuera de git)
docs/                API, ROADMAP, ADR, informes EOS
tests/               unittest + E2E Playwright
.eos/ .claude/ .agents/   EOS 4.1.0 (agentes y skills)
```

## Documentación

- [DOCUMENTACION.md](DOCUMENTACION.md) — qué se hizo, tecnologías, uso, instrucciones y contexto.
- [docs/API.md](docs/API.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/adr/](docs/adr/) · [docs/eos/](docs/eos/)
- [DESIGN.md](DESIGN.md) — dirección visual y sistema de tokens.

## Fuentes y licencias

Datos oficiales del Estado peruano (PNDA: MININTER, MPFN, DEVIDA, INEI, APN, IGP), NGA WPI, USGS, NASA FIRMS,
CelesTrak, OpenStreetMap/OpenFreeMap (ODbL), adsb.lol (ODbL), Open-Meteo (CC BY 4.0), aisstream.io y TomTom
(términos propios, BYOK). Cada fuente conserva su licencia; ver **Fuentes** dentro de la aplicación.
MapLibre GL JS (BSD-3) y satellite.js (MIT) se distribuyen con sus licencias en `apps/web/vendor/`.

Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo asistido por IA.

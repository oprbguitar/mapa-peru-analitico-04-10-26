# EOS · MODE=ADOPT — inventario de código y datos heredados

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**
Fecha: 2026-10-04 · Alcance: lectura (arqueología). Ningún repositorio de origen fue modificado.

## Fuentes examinadas

| Origen | Ubicación | Qué se encontró | Qué se extrajo | Qué NO se trajo |
|---|---|---|---|---|
| **EOS 4.1.0** | `oprbguitar/dev-funcy-agents-03-10-26` | 13 subagentes, 6 skills de modo, plantillas, CLI `eos.mjs` | Instalado con `install-agents.mjs --host all` en `.eos/`, `.claude/`, `.agents/`, `AGENTS.md`, `CLAUDE.md` | — |
| **RUC360** | repo `datos01082026` + carpeta local `Analisis de empresas` | `mapa_zona.py` (proxy OFM + caché), `capas_vivas.py` (adsb.lol, adsbdb, AISStream por WebSocket sin dependencias, CelesTrak, data centers OSM), `ia_modelos.py` (Ollama + APIs compatibles OpenAI, perfiles consulta/análisis/redacción), vendor MapLibre 5.24 CSP, satellite.js, fuentes Space Grotesk/Noto Sans/Space Mono, caché `data/ofm` (136 MB) | Patrón del proxy OFM (`peru_intel/map/ofm_proxy.py`), cliente AIS y sondeo ADS-B (`peru_intel/live/`), patrón de proveedores IA (`peru_intel/ai/`), vendor y fuentes, `datacenters-pe.json` | Base SUNAT/empresas, autenticación y permisos de RUC360, Cesium/Google 3D, `territorio.db` (solo lectura opcional vía adaptador) |
| **Carpeta 3SL** | — | **No encontrada** en `Analisis de empresas` ni en el repo RUC360 | — | Pendiente: auditar cuando se entregue |
| **OCE/FEDTID** | repo `15072026-ocev1` + carpeta local `ocefedtid` | `build-observatory-data.mjs` (DEVIDA, MPFN, SIDPOL), `build-international-data.mjs` (APN, WPI, UNODC, CBP, EUDA), `territory-utils.mjs`; CSV MPFN 2020–2026 y SIDPOL 2018–2026 ya descargados; GeoJSON departamental y distrital | MPFN y DEVIDA portados a Python y **generalizados** (todos los delitos, no solo TID); SIDPOL completo (todas las modalidades, no solo extorsión/secuestro); normalización de nombres; puertos APN+WPI desde `international.json` | UNODC/CBP/EUDA (contexto internacional de drogas: fuera del alcance territorial de la fase 3), funcionalidad SIGA/personal |
| **God's Eye View** | carpeta local `GOdEyes` (MIT) | proveedores `adsb-lol`, `opensky`, `ais-live`, `celestrak`, `firms`, `traffic` (TomTom), terremotos USGS, modelos GFS/ECMWF | Endpoints y patrones (BBOX AIS, FIRMS area API, TomTom flow tiles, feed USGS) reimplementados; nada copiado literalmente | Cesium 3D, cámaras CCTV públicas, voz, escenas |

## Fuentes oficiales nuevas verificadas en esta sesión

- **MININTER · Indicadores y tendencias para planes de acción de seguridad ciudadana** (ZIP julio 2026):
  27 indicadores 2009–2026 por región/provincia/distrito, e incluye `POBLACION_PROYECTADA` → resolvió los
  denominadores de población sin datos inventados.
- **IGP** `ultimosismo.igp.gob.pe/api/ultimo-sismo/ajaxb/<año>`: JSON de sismos reportados (verificado).
- **SENAMHI**: no se encontró una URL estable y pública del dataset horario de estaciones; el adaptador
  queda listo y declara «sin configurar».

## Baseline capturado

- `python -m peru_intel ingest all`: SIDPOL 369 100 filas · 7 359 931 denuncias (2018-01 → 2026-07);
  MININTER 116 599 filas · 27 indicadores; población 24 823 filas; MPFN 7 281 968 denuncias (97 203 TID);
  DEVIDA 654 valores; 14 puertos; 16 centros de datos.
- Territorio: 25 departamentos, 195 provincias, 1 826 distritos con polígono (8 sin geometría en la fuente).

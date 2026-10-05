# Documentación — Mapa Perú Analítico

Plataforma **standalone y local-first** de inteligencia geoespacial y situacional del Perú. Reúne en un solo
mapa seguridad ciudadana, movilidad, ambiente, infraestructura y espacio, con la procedencia de cada cifra a
la vista. Versión 0.3.0 · 4 de octubre de 2026.

---

## 1. Qué se hizo

| Bloque | Resultado |
|---|---|
| Gobierno de desarrollo | EOS 4.1.0 instalado desde `dev-funcy-agents-03-10-26` (13 subagentes, 6 skills de modo). Informes ADOPT y AUDIT en `docs/eos/`, ADR 0001–0004 en `docs/adr/`. |
| Territorio | Paquete `data/peru/` con 25 departamentos, 195 provincias (unidas desde distritos) y 1 826 distritos, generado desde la cartografía INEI que ya usan OCE/FEDTID y RUC360. |
| Mapa base | MapLibre GL 5.24 (vendorizado de RUC360) + OpenFreeMap a través de un proxy con caché en disco portado de RUC360. Lo ya visto funciona sin internet. |
| Fuentes oficiales | SIDPOL (MININTER), indicadores y tendencias de seguridad ciudadana (MININTER), población proyectada (INEI vía MININTER), delitos denunciados (MPFN), cultivos/erradicación/decomisos (DEVIDA), puertos (APN + NGA WPI). |
| Registro de fuentes | `source_registry` (SQLite) + `data/catalog/manifest.json` (versionado): institución, URL, licencia, nivel, cobertura, fecha de descarga, SHA-256, transformación. |
| Seguridad y criminalidad | Choropleth por departamento → provincia → distrito, solo donde la fuente tiene esa granularidad. Siempre: absoluto, tasa por 100 mil y cambio %. |
| Índice compuesto | «Índice Situacional Perú v1» (no oficial), reproducible desde `config/crime_index_v1.yaml`, con desglose «¿por qué tiene este valor?». |
| Proyección | StatsForecast AutoETS (intervalos 80/95 %) + detección de anomalías; respaldo naive estacional declarado. |
| IA | DataAgent → GeoAnalyst → Verifier. Ollama local por defecto; API externa solo autorizada y con datos agregados. |
| En vivo | Vuelos (adsb.lol), embarcaciones (AIS, BYOK), satélites (CelesTrak + satellite.js), sismos (IGP + USGS), focos de calor (NASA FIRMS, BYOK), clima (SENAMHI observado + GFS/ECMWF modelo), tráfico (TomTom, BYOK), puertos, centros de datos. |
| Clima combinado | Clic en cualquier punto del mundo: Open-Meteo (principal) y MET Norway sin clave; WeatherAPI, Visual Crossing, OpenWeather y Tomorrow.io con clave opcional. Cada proveedor se muestra por separado, más un «consenso» calculado (mediana y dispersión). En Perú se suma la estación SENAMHI más cercana (si se configuró) y se sugieren capas oficiales. |
| Capas meteorológicas | SENAMHI · IDESEP (WMS oficiales: aviso de lluvias 24 h, activación de quebradas, UV 48 h, probabilidad de lluvia/Tmáx, anomalías, índice de humedad, FWI de incendios, climatología del mes) y NASA GIBS (color real VIIRS, nubes, IMERG, aerosoles, temperatura de superficie y del mar). |
| Vista realista y 3D | Mapa base nocturno, calles, satélite híbrido (Esri), Sentinel-2 2024, topográfico, Carta Nacional IGN; relieve 3D con Terrain Tiles (Terrarium), sombreado, exageración vertical y cielo atmosférico. Patrón y caché tomados de RUC360. |
| Interfaz HUD | Estilo táctico inspirado en God's Eye View: mapa a pantalla completa, paneles flotantes translúcidos con escuadras cian, modo noche/día. |
| API | `/api/v1/*` estable y de solo lectura para Route 360 (ver `docs/API.md`). |
| Autoarranque | `INICIAR-MAPA.bat` (doble clic). |

## 2. Tecnologías

- **Backend:** Python 3.11+ (biblioteca estándar: `http.server`, `sqlite3`, `ssl/socket` para AIS), **DuckDB** (Parquet, spatial para disolver provincias), **openpyxl** (XLSX de DEVIDA y diccionarios). Opcional: **StatsForecast** + pandas.
- **Frontend:** HTML + CSS con tokens + módulos ES sin build. **MapLibre GL JS 5.24** (build CSP), **satellite.js**. Fuentes Space Grotesk, Noto Sans, Space Mono (locales).
- **Datos:** `data/raw` (originales inmutables, fuera de git) · `data/parquet` (normalizados) · `data/peru` (territorio) · `data/catalog` (procedencia).
- **IA:** Ollama (local) o cualquier API compatible con OpenAI.
- **Pruebas:** `unittest` (17 pruebas) y Playwright headless (15 comprobaciones E2E, 4 anchos).

## 3. Cómo se usa

### Arranque con doble clic

1. Doble clic en **`INICIAR-MAPA.bat`**.
2. La primera vez instala `duckdb` y `openpyxl`. Si no hay datos normalizados, los descarga de los portales oficiales.
3. Se abre el navegador en `http://127.0.0.1:8360/`. Cierra la ventana negra para detener el servidor.

### Arranque manual

```bash
python -m pip install -r requirements.txt
python -m pip install -r requirements-forecast.txt   # opcional
python -m peru_intel serve --open
```

### En la interfaz

- **Capas (izquierda):** familias Seguridad, Movilidad, Ambiente, Infraestructura y Espacio. En Seguridad se elige
  UNA capa temática (denuncias, victimización, homicidios y violencia, criminalidad organizada, capacidad policial,
  Fiscalía, drogas/TID, índice compuesto). Las capas en vivo se encienden con casillas; «sin clave» indica que falta
  configurar el proveedor.
- **Nivel:** Departamento / Provincia / Distrito. Un nivel aparece deshabilitado cuando la fuente no lo publica:
  nunca se reparte una cifra regional entre distritos.
- **Leyenda:** cambia la medida — Denuncias (absoluto, oficial), Tasa (calculada), Cambio (calculado).
- **Línea de tiempo (abajo):** AHORA = año en curso; 24 H / 7 D / 30 D = último mes publicado para la estadística y
  ventana de sismos y focos de calor; 1 AÑO = último año completo; 5 AÑOS = último año completo comparado con
  5 años antes. Clic en un año de la serie para verlo.
- **Ficha (derecha):** clic en un territorio o búsqueda por nombre. Muestra tríada, modalidades, índice con
  «¿Por qué tiene este valor?», serie y proyección, indicadores MININTER, Fiscalía, DEVIDA y **Fuentes de esta ficha**.
- **Vista y relieve (familia del riel) y botones 3D · Relieve · N sobre el mapa:** cambia el mapa base, activa el
  relieve 3D (arrastra con clic derecho o Ctrl para inclinar y girar), el sombreado, la exageración vertical y la
  opacidad de la capa temática. «N» devuelve el norte arriba.
- **Clima en un punto (Ambiente):** activa la casilla y haz clic en cualquier lugar del mundo. La ficha muestra el
  proveedor principal, la tabla de todos los proveedores, el consenso calculado y las próximas 24 h. «sin clave» o
  «cuota agotada» indican por qué un proveedor no respondió.
- **Capas meteorológicas (Ambiente):** elige una capa SENAMHI (oficial) o NASA GIBS (satélite) y su opacidad.
- **Analizar con IA:** redacta un análisis citando hechos numerados; cada oración se marca VERIFICADO o NO VERIFICADO.
- **Fuentes:** registro maestro con naturaleza del dato, cobertura, fecha de descarga y checksum.
- **Claves:** BYOK de aisstream.io, TomTom, NASA FIRMS, CSV de SENAMHI y modelos de IA. Se guardan solo en
  `data/config.local.json` y nunca vuelven al navegador.

### Línea de comandos

```bash
python -m peru_intel sources                      # estado del registro de fuentes
python -m peru_intel ingest all --download        # actualizar todas las fuentes oficiales
python -m peru_intel ingest sidpol --dir <carpeta> # usar archivos ya descargados
python -m peru_intel index                        # recalcular e imprimir el índice
python -m peru_intel build-territory --from <dir> # regenerar data/peru
python -m peru_intel export-ofm                   # copiar la caché de mapas de RUC360
```

## 4. Instrucciones específicas

### Actualizar datos oficiales (mensual)

SIDPOL y los indicadores MININTER se publican cada mes. Cuando el portal cambie el nombre del archivo, actualiza
la URL en `peru_intel/sources/catalog.py` (`download`) y ejecuta `python -m peru_intel ingest sidpol --download`.
Si el esquema cambia, el adaptador se detiene con un mensaje y `download_log.schema_changed` queda en 1.

### Población (tasas)

Por defecto se usa `POBLACION_PROYECTADA` del dataset de indicadores MININTER (proyección INEI). Para usar un
archivo INEI directo, colócalo en `data/raw/inei/poblacion.csv` con columnas `nivel,ubigeo,anio,poblacion`
(`nivel` = departamento | provincia | distrito) y ejecuta `python -m peru_intel ingest indicadores`.

### SENAMHI

No hay una URL pública estable verificada del dataset horario de estaciones automáticas. En **Claves → CSV de
estaciones SENAMHI** indica una URL o ruta local; el adaptador reconoce columnas estación, fecha, temperatura,
humedad, precipitación, latitud, longitud, altitud, departamento, provincia, distrito y UBIGEO.

### Clima: orden de proveedores y cuotas

`weather_order` (en «Claves») define el orden; el primero que responde es el «principal». Cuotas diarias aplicadas en
el backend (`data/live/weather_quota.json`): Open-Meteo 9 000, MET Norway 5 000, WeatherAPI 3 000, Visual Crossing 900,
OpenWeather 900, Tomorrow.io 450. Caché de 10 min por punto (rejilla de ~5 km). Open-Meteo es gratuito solo para uso no
comercial: para uso comercial cambia el orden a `metno,...` o contrata su plan comercial.

### Índice Situacional Perú v1

`config/crime_index_v1.yaml`: denuncias por 100 mil (30 %), robo + extorsión + secuestro por 100 mil (20 %),
victimización ENAPRES (20 %), homicidios por 100 mil (15 %), variación interanual de denuncias (15 %).
Normalización mín–máx entre departamentos (0–100, mayor = posición relativa más desfavorable). Faltantes:
se reponderan las variables disponibles; si cubren < 60 % del peso, no hay puntaje. Cambiar cualquier valor
exige crear `crime_index_v2.yaml` para que las puntuaciones antiguas sigan siendo reproducibles.

### Integración con Route 360

Route 360 consulta `GET /api/v1/intel/...` (ver `docs/API.md`). Para exponer la API en la red local hará falta
autenticación (pendiente); por ahora el servidor escucha solo en 127.0.0.1.

### Pruebas

```bash
python -m unittest discover -s tests -v
PLAYWRIGHT_MODULE=<ruta a playwright> node tests/e2e/smoke.mjs output/e2e
node "C:\Users\oprbg\Documents\Claude\AI-Design-Harness\bin\design-lint.mjs" .
```

## 5. Contexto de desarrollo

- **Principio rector:** no reconstruir lo que ya existe. RUC360 aportó el mapa (proxy OFM, MapLibre, capas vivas,
  patrón IA); OCE/FEDTID aportó los pipelines oficiales (portados a Python y generalizados); God's Eye View aportó
  patrones de proveedores (sin copiar código); EOS gobierna cómo se construye y audita.
- **Dos reglas desde el primer commit:** (1) ningún número aparece sin poder responder quién lo publicó, de qué
  fecha y período es, a qué nivel geográfico, cómo se transformó y cuándo se descargó; (2) la interfaz distingue
  siempre dato oficial, dato en vivo de tercero, calculado, estimación, proyección e interpretación IA.
- **Límites éticos:** sin predicción ni ranking de personas; solo territorios y series agregadas.
- **Pendientes y riesgos:** ver `docs/ROADMAP.md` y `docs/eos/AUDIT-inicial.md` (claves en texto plano local,
  licencias de terceros antes de uso comercial, proveedores BYOK sin probar con claves reales, carpeta 3SL no encontrada).
- **Dirección visual:** `DESIGN.md` (espina temporal · pizarra + cian · Space Grotesk/Noto Sans/Space Mono · bloque).

---

## v0.3 — decisión, voz, patrones y contenedor (4 de octubre de 2026)

| Bloque | Resultado |
|---|---|
| Modos de trabajo | Barra superior **Mapa · Patrones · Rutas · El Niño**. Paneles replegables («, », ▾) y **vista amplia** (⛶ o tecla F; `[` y `]` repliegan capas y ficha). |
| Informador 360 | Clic en cualquier punto → ficha viva: territorio + H3, seguridad del distrito, servicios cercanos (≤ 1 y 5 km), emergencias INDECI y vías MTC, peligros INGEMMET (≤ 5 km), ambiente, estado ENFEN y titulares GDELT (señal no verificada). Botón **Escuchar**. |
| Observatorio de denuncias | Por territorio: año por año (▲ rojo sube · ▼ azul baja), % por modalidad, «¿hacia dónde se sesgó?», posición frente a vecinos y **proyección del año**. Al elegir una modalidad, el mapa se colorea con su **% del total**. **▶ Años** recorre 2018 → hoy en el mapa. |
| Colores | Paletas elegibles en la leyenda: **Espectral (azul → rojo, por defecto)**, Calor, Viridis (daltonismo) y Cian. **Focos**: contorno rojo discontinuo animado en el 10 % de territorios con valor más alto. Al acercarse (zoom ≥ 10) el coloreado se atenúa para leer calles. |
| Sedes y servicios | Comisarías (1 383), serenazgo (96), Ministerio Público (133) y Poder Judicial (244) desde OSM (aproximado); 19 970 establecimientos de salud RENIPRESS (oficial); 47 098 colegios, 1 135 universidades/institutos y 226 bomberos (OSM). |
| Emergencias | INDECI SINPAD 2015–2026 (149 765 con coordenadas) y emergencias en la Red Vial Nacional (MTC, 1 362). |
| Patrones | **Hotspots** Gi* con evolución (nuevo · persistente · intensificado · se disipa), **Secuencias** A → B en 14 días con lift, **Correlaciones** desfasadas, **Cambios** estructurales, **Anomalías** y **Proyección** con competencia de modelos (backtesting). Botón «Explicar con IA» verificado. |
| Rutas estratégicas | A → B (texto o clic en el mapa) con OSRM; tabla de decisión por criterios explícitos (tiempo, km en focos, vías afectadas, emergencias, sedes de apoyo, lluvia) y recomendación explicada. |
| Event Store | `data/parquet/eventos.parquet`: SIDPOL + INDECI + MTC en un esquema común con celda **H3 r7**. |
| El Niño | Estado ENFEN (Comunicado N.° 17-2026), ICEN 1950–hoy con eventos oficiales, NOAA CPC, comparación de magnitud, **historias animadas** (1982-83, 1997-98, 2017, 2023-24, 2026-27) con trazos ilustrativos y fuentes, y **corrientes animadas** (Open-Meteo Marine). |
| Clima animado | Sol que brilla con calor, lluvia, tormentas, nubes, viento, niebla y frío sobre una rejilla de modelo; el usuario elige qué fenómeno ver. |
| Vuelos | Tres redes ADS-B unidas (adsb.lol, airplanes.live, adsb.fi). |
| Cámaras (Vision Edge) | Botón **Cámaras**: búsqueda en la red (ONVIF + barrido de puertos 37777/554/80), prueba paso a paso del **Dahua DH-XVR5108HS-X** (CGI Digest), nombres de canal, ubicación de cada canal en el mapa, visor y mosaico (foto ~1 s o go2rtc), URLs RTSP y `go2rtc.yaml`. Contraseñas solo en el servidor. |
| AI Gateway | Según el manual EOS *AI Integration Port* (dev-funcy-agents): modos OFF · LOCAL · LOCAL_REMOTE · CLOUD_API · PRIVATE_CLOUD · HYBRID · AUTO; admisión por **intersección**; presupuesto con **reserva atómica**; circuitos; recursos; kill switch; auditoría. Administrador en **IA** (`/admin/engineering/ai`). |
| Asistente de voz | **🎙 Asistente** (Alt+V): «Ubica El Agustino y infórmame», «enciende las comisarías», «traza una ruta de Miraflores a Chosica», «reproduce la historia del Niño de 1998». Intérprete local sin modelo + modelo con herramientas; voz a texto y texto a voz locales (Whisper/Kokoro, navegador) o de pago (OpenAI, Groq, ElevenLabs); **voz a voz en tiempo real** (OpenAI Realtime, patrón GOdEyes). |
| Contenedor | `Dockerfile`, `docker-compose.yml` (perfiles `voz` y `camaras`), `INICIAR-CONTENEDOR.bat` y `scripts/exportar-contenedor.ps1` → un solo `.tar` para usar sin Internet. |

### Uso rápido v0.3

- **Clic en el mapa** = Informador 360 del punto. **Buscar** acepta distritos, lugares y direcciones (Nominatim con caché).
- **Patrones**: elige la vista (chips); el mapa muestra el z de Gi*. Acota a una provincia desde el Informador («Patrones aquí»).
- **Rutas**: escribe origen y destino o «Marcar en el mapa»; «Explicar la decisión con IA» redacta sobre la tabla y verifica cada cifra.
- **El Niño**: clic en una banda roja del ICEN o en una historia; «Corrientes del mar ahora» anima el océano.
- **Cámaras**: 1) «Buscar en mi red» o escribe la IP del XVR; 2) usuario y contraseña; 3) «Probar conexión»; 4) «Guardar»;
  5) «Ubicar» cada canal y haz clic en el mapa; 6) «Ver» o «Mosaico». Video fluido: «Generar go2rtc.yaml» y ejecuta go2rtc.
- **IA**: pestaña *Funciones* (modo y orden de proveedores por función), *Proveedores* (URL, modelo, voz, clave, probar),
  *Modelos locales* (cargar/descargar de memoria/descargar con Ollama), *Voz* (prueba y recetas locales), *Estado* (kill switch, pago, presupuesto).
  Los proveedores de pago **no se usan** hasta: habilitarlos + estado APPROVED + clave + «Permitir proveedores de pago» + presupuesto diario y mensual.

### Fuentes nuevas e instrucciones

```bash
python -m peru_intel ingest emergencias --download   # INDECI (ArcGIS) + MTC
python -m peru_intel ingest servicios --download     # RENIPRESS + colegios/bomberos OSM
python -m peru_intel ingest instituciones --download # comisarías, serenazgo, fiscalías, juzgados (OSM)
python -m peru_intel ingest enso --download          # ICEN, eventos, NOAA CPC
python -m peru_intel ingest eventos                  # reconstruye el Event Store
```

**datosabiertos.gob.pe bloquea descargas automáticas (HTTP 418).** No se suplanta un navegador: descarga el CSV con el
navegador (RENIPRESS, MTC), guárdalo con el nombre que indica el mensaje y ejecuta `ingest <fuente> --dir <carpeta>`.

**El Niño:** el estado ENFEN vive en `config/enso_eventos.json` (curado, con enlaces). Actualízalo con cada comunicado
quincenal (próximo: 15 oct 2026) y ejecuta `ingest enso --download` para el ICEN y NOAA.

**Contenedor:** con Docker Desktop abierto, doble clic en `INICIAR-CONTENEDOR.bat` (`voz` o `todo` como argumento para
servicios locales). Para otra PC sin Internet: `scripts/exportar-contenedor.ps1` → `mapa-peru-analitico-0.3.tar`.
Dentro del contenedor, Ollama del anfitrión se alcanza en `host.docker.internal:11434`; la búsqueda ONVIF por multicast
no atraviesa la red de Docker: escribe la IP del XVR a mano.

**Ajustes nuevos** (`data/config.local.json` o variables `PI_*`): `admin_pin` (exige PIN en el administrador de IA),
`osrm_url` (OSRM/Valhalla propio para rutas sin Internet), `go2rtc_url`, `vision_allow_public` (no recomendado),
`vision_allow_plates` (exige base legal), `vision_token` (token del nodo edge), `ai_key_<proveedor>` (lo escribe el administrador).

### Límites declarados

- SIDPOL ubica la denuncia por distrito: el mapa no sombrea calles dentro del distrito; los focos son territoriales.
- Sedes OSM son aproximadas; RENIPRESS es oficial. Colegios: reemplazables por el padrón ESCALE cuando se integre.
- La comparación de El Niño actual con eventos pasados es un cálculo de magnitud, no un pronóstico; el pronóstico es del ENFEN.
- Las proyecciones son univariadas con backtesting; las variables externas aparecen como correlaciones, no entran a la cifra.
- Siguiente fase: WorldPop/GHSL/VIIRS, COES, OSIPTEL, CDC-MINSA, Overture, SatNOGS/SDR y Valhalla offline.

## Registros de El Niño por período (v0.3.2)

`GET /api/v1/intel/enso/events/{historia}` devuelve todos los huaicos/quebradas activadas, desbordes de río,
inundaciones, lluvias intensas, deslizamientos y marejadas registrados entre el inicio y el fin oficial (ICEN) del evento.

- **SINPAD · INDECI** (2015 →): coordenada del registro. Antes de 2018 el SINPAD no distingue «desborde de río» de «inundación».
- **DesInventar · OSSO/LA RED** (1970–2015): fichas tomadas de prensa (columna `fuente`, p. ej. «ElC 18.03.98» = El Comercio),
  ubicadas en el centroide del territorio publicado (distrito, provincia o departamento). Ingesta: `python -m peru_intel ingest desinventar --download`.
- La caja de la historia es lateral, translúcida y plegable (▾); los tipos se filtran con los botones de color y cada punto abre su detalle.

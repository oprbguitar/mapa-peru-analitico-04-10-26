# Documentación — Mapa Perú Analítico

Plataforma **standalone y local-first** de inteligencia geoespacial y situacional del Perú. Reúne en un solo
mapa seguridad ciudadana, movilidad, ambiente, infraestructura y espacio, con la procedencia de cada cifra a
la vista. Versión 0.1.0 · 4 de octubre de 2026.

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

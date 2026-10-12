# Documentación — Mapa Perú Analítico

## Informes (§10) y cámaras en vivo (§7) · 12 de octubre de 2026

**Informes** (`peru_intel/reports.py`, `apps/web/js/reports.js`): botón **Informe** en la barra del operativo (informe del
escenario con su desarrollo por versiones), **Informe imprimible** en «Ver cifras» (una ejecución) e **Informe comparativo**
en «Comparar escenarios». Documento HTML autónomo en pestaña nueva (Ctrl+S guarda, Ctrl+P → PDF) con captura del mapa,
resumen ejecutivo construido con reglas a partir de las cifras (sin IA), resultados con rangos, unidades, supuestos,
fuentes con fecha de descarga, evaluación JEV y limitaciones. «Desarrollo del escenario» lista cada versión con sus cambios
exactos y **Abrir esta versión** la recupera en el mapa. Limitación: los marcadores HTML (letras de las unidades) no salen
en la captura; sí la zona, tramos, llamadas y mosaicos. API: `GET /api/v1/reports/run/<run_id>`,
`/api/v1/reports/scenario/<esc-id>`, `/api/v1/reports/compare?ids=a,b`.

**Cámaras en vivo** (`peru_intel/vision/live.py`, `apps/web/js/cam-player.js`): por canal, WebRTC vía go2rtc (la oferta
SDP pasa por el servidor, que la reenvía a go2rtc local o de la red; el navegador no se conecta directo a otro puerto) y
fotos (~1 s) como respaldo automático con el motivo visible. Cada celda muestra modo (EN VIVO · WebRTC / FOTO / SIMULADO),
retraso aproximado (búfer de jitter + mitad del RTT), última imagen y cortes. Ventana flotante movible y mosaico.
**Lista de verificación** en Cámaras (grabador, canales, ubicación, go2rtc, flujos, señal, WebRTC) y **señal simulada**
para probar el visor sin equipo. Prueba con el equipo real: **pendiente**, pasos en [docs/PRUEBA-CAMARAS.md](docs/PRUEBA-CAMARAS.md).
API: `GET /api/v1/intel/vision/selftest`, `GET /api/v1/intel/vision/streams`, `POST /api/v1/intel/vision/webrtc {cam, ch, sdp}`.
Pruebas: `tests/test_vision_live.py` (contra un go2rtc simulado) y `tests/e2e/cameras-live.mjs` (no abre canales reales).

## Consola de conexiones (§3) · 11 de octubre de 2026

Herramientas (⋯) → **Conexiones** (solo administración, solo local). Una ficha por cada una de las 60 fuentes del catálogo
y por las conexiones propias (Ollama, IA externa, JEV externo, go2rtc): finalidad, dirección (solo `esquema://host`, nunca
ruta ni consulta), autenticación («configurada / falta clave», jamás el valor), frecuencia y refresco, última
sincronización, estado (en línea, desactualizado, error, sin configurar, datos locales, a demanda), respaldo si falla y
qué la usa. **Probar** refresca la capa en vivo o hace un HEAD de 6 s a la dirección pública; un fallo deja un aviso
técnico para la administración y la prueba queda en la auditoría. **Quién hace qué**: motor de cálculo (local),
interpretación (JEV: `jev-ref` o URL externa, editable aquí), explicación (consola «IA») y decisión (persona).
**Fuentes por simulación**: qué datos usa cada motor. Las claves se siguen editando en **Claves** (`data/config.local.json`).
Código: `peru_intel/connections.py`, `apps/web/js/connections.js`. API: `GET /api/v1/admin/connections`,
`POST /api/v1/admin/connections/<id>/test`. Pruebas: `tests/test_connections.py` (ningún secreto ni ruta en la
respuesta, solo administración, fallo avisado) y `tests/e2e/connections.mjs` (solo lectura).

## JEV, avisos y usuarios con roles · 11 de octubre de 2026

**JEV (§2 / §9.1)** — `peru_intel/jev/`. Evaluador desacoplado del motor: recibe una ejecución y devuelve una
**puntuación interna** (la métrica principal tal cual, 0–100; `probability` siempre `null`), **incertidumbre** (precisión
de la mediana ±1,96·σ/√n), **variabilidad** entre repeticiones, **calidad de datos** (fuentes colaborativas, antigüedad,
avisos del motor) y una **decisión**: aceptable para explorar · más iteraciones · más datos · otro modelo · revisión
humana, con hechos numerados. `compare` ordena escenarios y marca **empates técnicos** (rangos solapados).
No se encontró el JEV original en las carpetas del usuario: rige `jev-ref-0.1` (reglas en `reference.py`) y un adaptador
HTTP opcional (`jev_url`) que debe cumplir el contrato; si falla, vuelve a `jev-ref` y lo declara.
En el mapa: línea «JEV · ±precisión · variabilidad · decisión» en el marcador, con **Aplicar** cuando pide más repeticiones.

**Avisos (§9)** — `peru_intel/notify.py`, campana 🔔. Tipos: observado · técnico (capas en vivo con error o vencidas,
sin repetir) · predictivo (de JEV, siempre con incertidumbre y hechos) · actividad (escenarios, tareas). Destinatarios:
todos, un rol o una persona; «leído» por usuario. `data/notifications/` (no se versiona).

**Usuarios, roles y actividades (§8)** — `peru_intel/users.py`, `peru_intel/activities.py`, botón de cuenta.
Sin usuarios rige el **uso personal** (nada cambia). «Activar usuarios» crea el primer administrador y desde ahí se pide
iniciar sesión (PIN con scrypt; cookie HttpOnly SameSite=Strict; 5 intentos/5 min). Roles: administrador (todo),
coordinador (simular, escenarios, asignar actividades), participante (sus actividades y avisos; sin Simular ni claves).
El servidor aplica los permisos; la interfaz solo oculta. Actividades con escenario vinculado, fecha límite, estados
(pendiente, en curso, hecha, bloqueada) e historial; cada cambio queda en la auditoría (`audit_log`) y avisa.
Todo esto es solo local: en la nube no se ofrece. `data/users/` no se versiona ni se copia a la imagen.

API: `GET /api/v1/jev/contract`, `POST /api/v1/jev/evaluate {run_id}`, `POST /api/v1/jev/compare {run_ids|scenario_ids}`,
`GET /api/v1/notifications?type=`, `POST /api/v1/notifications/read {ids|all}`, `GET /api/v1/auth/me`,
`POST /api/v1/auth/login|logout`, `GET|POST /api/v1/users`, `POST /api/v1/users/<id>/role|remove`,
`GET /api/v1/users/directory`, `GET|POST /api/v1/activities`, `POST /api/v1/activities/<id>/status`.
Pruebas: `tests/test_jev_notify.py`, `tests/test_users.py` (incluye el servidor HTTP real con cookie) y
`tests/e2e/users-roles.mjs` (**solo contra un servidor aislado**: `PI_DATA_DIR=<carpeta vacía> python -m peru_intel serve --port 8362`).

## Operativo simulado y escenarios A/B/C · 11 de octubre de 2026

Tercer motor del simulador (**Operativo**), pasos 10–13 de [docs/GUIA-SIMULADOR.md](docs/GUIA-SIMULADOR.md):

- **Marcar en el mapa:** unidades hipotéticas (patrullero, serenazgo, ambulancia, bomberos) arrastrables y **tramos
  cortados** dibujados punto a punto. Máximo 40 unidades y 30 tramos.
- **Motor** (`peru_intel/simulation/operations.py`): llamadas sintéticas Poisson (tasa y mezcla declaradas; seguridad →
  patrullero/serenazgo, médica → ambulancia, incendio → bomberos), despacho a la unidad libre compatible más rápida, cola
  FIFO por tipo, traslado geodésico × rodeo ÷ velocidad (lluvia, congestión) + retardo, **+60 % por tramo cortado
  cruzado** (sin red vial), tiempo en escena exponencial y regreso a la base. Réplica 0 = cronología reproducible;
  20 réplicas = intervalos. Salidas: % a tiempo, respuesta p50/p90, sin atender, ocupación por unidad, saturadas (≥ 80 %).
- **Tiempo virtual** en el mapa (`apps/web/js/sim-ops.js`): reproducir, pausar, ⏮, −15/+15 min, línea de tiempo, ×10/×30/×120.
- **Escenarios** (`peru_intel/simulation/scenarios.py`, `data/simulation/scenarios/`): guardar crea versiones (fecha,
  autor, especificación, run_id, métricas); duplicar crea una copia independiente con su origen; comparar lista todos.
- API local: `POST /api/v1/sim/operations/run`, `GET|POST /api/v1/sim/scenarios`, `GET /api/v1/sim/scenarios/<id>`,
  `POST /api/v1/sim/scenarios/<id>/duplicate` (403 en la nube).
- Ética: ejercicio de mesa; no usa denuncias ni personas, no reparte cifras, no genera órdenes ni rutas sobre personas reales.
- Pruebas: `tests/test_operations.py` (tiempo exacto, cruce de tramos, FIFO, reproducibilidad, avisos, versiones,
  duplicado, 403) y `tests/e2e/simulation-ops.mjs` (1440 y 360 px; borra los escenarios que crea).

## Simulador sobre el mapa (rediseño interactivo) · 11 de octubre de 2026

Guía con capturas: **[docs/GUIA-SIMULADOR.md](docs/GUIA-SIMULADOR.md)**. Resumen:

- **Simular** ya no abre un formulario lateral: todo sucede en el mapa. Un **clic** coloca la zona (radio inicial según
  el zoom) y simula al instante; el **asa del borde** cambia el radio (1–30 km, pasos de 0,5) y el **centro** la mueve.
- **Fichas de escenario** flotantes (lluvia intensa, hora punta, huaico, sedes cerradas, más llamadas, todo junto)
  y servicio/motor en la barra superior; cada cambio recalcula solo (respuestas viejas se descartan).
- Resultado en un **marcador** sobre la zona (hoy → hipótesis, animado) y un **mosaico** de tiempos: cortina
  arrastrable **hoy ⟷ hipótesis** o vista **qué cambia** (mejora / igual / empeora / sin servicio).
- La **lluvia del escenario** se dibuja dentro de la zona (hipotética, rotulada; rayado fijo con movimiento reducido).
- Las **sedes** aparecen solas; tocar una la cierra/reabre en la hipótesis. En **Capacidad** se colorean por ocupación.
- **Ver cifras** abre el panel con tablas, supuestos, fuentes, ajustes finos e historial (`sim-data.js`).
- Código: `simulation.js` (coordinación y controles), `sim-zone.js`, `sim-rain.js`, `sim-swipe.js`, `sim-data.js`.
  El radio libre se valida en `accessibility.normalize` y se redondea a 0,5 km (registro idempotente).
- Pruebas: `tests/e2e/simulation-lab.mjs` (1280 y 360 px: clic, escenario, cortina, radio por teclado, capacidad, cifras,
  limpieza al salir, lienzo de lluvia vacío sin lluvia). Capturas de la guía: `scripts/capturas_guia_simulador.mjs`.
- Estrategia del producto (EOS 4.2.0): `docs/ESTRATEGIA-SIMULACION.md`.

## Laboratorio de simulación · pestaña «Capacidad» (S3, eventos discretos) · 11 de octubre de 2026

Dentro de **Simular** hay dos pestañas: **Accesibilidad** (la ya existente) y **Capacidad** (nueva). Capacidad usa la
misma área, servicio e hipótesis B (lluvia, congestión, sedes fuera, rodeo, cierre manual de sedes) y añade:

- **Llamadas por hora en A** (tasa de Poisson): es un **supuesto del usuario**; nunca se deriva repartiendo cifras
  distritales. Las llamadas caen uniformemente en el área del círculo (no según población).
- **Unidades o camas por sede** (igual para todas; la API acepta `capacity_by_id` por sede) y **atención media** (exponencial).
- **Cambio de demanda** en B (−50 % a +200 %), horizonte (8–72 h), réplicas (10–100) y semilla.

Flujo modelado con SimPy: llegada → cola única FIFO → asignación a la sede operativa **más cercana con unidad libre**
→ traslado (mismo modelo de `accessibility`: distancia geodésica × rodeo ÷ velocidad + retardo) → atención → liberación.
La unidad queda ocupada durante traslado + atención; no se modela el regreso. A y B comparten los números aleatorios
(llegadas por adelgazamiento, ubicaciones, atenciones, velocidades, retardos y disponibilidad de sedes).

Salidas (mediana y percentiles 5–95 entre réplicas, naturaleza `estimacion`, validez «exploratorio»): espera p50/p90,
respuesta (espera + traslado) p50/p90, % de llamadas atendidas en ≤ 30 min con intervalo pareado B − A, utilización
mediana por sede, llamadas derivadas (su sede más cercana estaba llena), sedes cuello de botella (utilización ≥ 80 %) y
llamadas sin asignar si el sistema se satura. El mapa colorea las sedes por utilización (A o B). Se modelan las 25 sedes
más cercanas al centro; límite de 20 s y 100 000 llamadas esperadas por corrida.

Dependencia **opcional**: `pip install -r requirements-simulation.txt` (SimPy 4). Sin ella la pestaña lo explica, el
catálogo marca S3 «requiere SimPy» y la API responde 503; Accesibilidad sigue funcionando. La imagen Docker la incluye.
Validación: caso M/M/1 con solución cerrada (λ = 3/h, μ = 5/h → Wq = 18 min, P(Wq = 0) = 0,4, p90 ≈ 53,75 min, ρ = 0,6).
API local: `POST /api/v1/sim/queue/run`; las corridas se registran como `cap-<hash>` junto a las de accesibilidad (`acc-<hash>`).
Código: `peru_intel/simulation/queue.py`. Pruebas: `tests/test_simulation.py` (`QueueTest`) y `tests/e2e/simulation-lab.mjs`.

## Laboratorio de simulación (solo local) · 11 de octubre de 2026

Modo **Simular** (aparece solo al ejecutar en la PC con `INICIAR-MAPA.bat`; en la nube no se muestra y la API responde 403).

> Sustituido por el simulador sobre el mapa (sección anterior); se conserva como registro del primer diseño.

1. Fija el centro del área (**Marcar en el mapa** o **Centro de la vista**) y elige el radio (5, 10, 20 o 30 km).
2. Elige el servicio: hospitales o establecimientos de salud (RENIPRESS, oficial), bomberos o comisarías (OpenStreetMap).
3. Define la hipótesis B: lluvia, congestión, porcentaje de servicios fuera de operación y rodeo por cortes de vía.
   Tras una corrida, haz clic en una sede del mapa para cerrarla en B y vuelve a simular.
4. **Simular A y B** devuelve tiempo mediano y área a ≤ 15/30/45 min con percentiles 5–95, la diferencia B − A y su
   intervalo, y colorea el mapa (A, B o cambio). **Repetir con otra semilla** comprueba la estabilidad.

Modelo: distancia geodésica × rodeo ÷ velocidad + retardo de despacho; velocidad, disponibilidad y retardo inciertos
(Monte Carlo, semilla reproducible, mismos números aleatorios en A y B). Es una **estimación exploratoria**: sin red
vial calibrada ni capacidad de las sedes. Los porcentajes son de área, no de población (no se reparten cifras distritales).
API local: `GET /api/v1/sim/engines`, `POST /api/v1/sim/accessibility/run`, `GET /api/v1/sim/runs[/<run_id>]`.
Registro: `data/simulation/runs/` (no se versiona). Código: `peru_intel/simulation/`, `apps/web/js/simulation.js`.

## Inicio limpio y comparador simplificado · 11 de octubre de 2026

- El mapa se prepara sin esperar estadísticas: denuncias, historial y límites territoriales detallados se cargan al activar una capa.
- El inicio no marca denuncias. Capas, Ficha y Tiempo comienzan plegados en el primer uso de esta interfaz; luego recuerdan su estado.
  Las acciones secundarias están en **Herramientas (⋯)**. El indicador de proveedores solo muestra capas activadas.
- El navegador solicita ubicación; si se permite, centra la vista allí. Si se deniega, mantiene Perú.
  El giro suave se detiene al interactuar, pausa en pestañas ocultas y respeta movimiento reducido.
- En **Satélite**, selecciona una zona y pulsa **Buscar imágenes**. Se muestra automáticamente la adquisición más reciente;
  elige otra fecha en B para comparar. Filtros, polígono y descarga están en **Fechas, filtros y descarga**.
  Una selección excesiva pide acercar el mapa; no se presenta como ausencia de imágenes.
- Al elegir un territorio en el buscador, el mapa vuela al instante; la ficha se completa después.
- Salir de **Satélite** devuelve el mapa limpio (sin escenas ni área) y restaura la base anterior; entrar activa la base satelital.
- Marcar la zona lanza la búsqueda sola. Con la vista nacional, se busca en un recuadro central de ~0,3° y se acerca el mapa.
- Nube (Render): el contenedor empaqueta `apps/web/js` en un solo módulo minificado con esbuild (≈225 KB frente a 344 KB
  y ~25 peticiones). En local se sirve el código fuente legible; el repositorio no se ofusca para no perder mantenibilidad.
- El catálogo conserva su fecha y huella de procedencia en una caché de 120 segundos. Las teselas leen únicamente la ventana
  necesaria y sus niveles reducidos; la descarga GeoTIFF conserva la resolución original.

Comprobación local: mapa preparado en 0,56–1,07 segundos a 360/768/1280/1600 px con caché de mapa base existente;
no es una promesa para redes lentas ni tiempo de descarga completo de las imágenes satelitales. Consulta real STAC de Lima:
22 adquisiciones en aproximadamente 1,4 segundos, repetida en 16 ms. Tesela fría de proveedor: 7,11 segundos.

## Actualización 0.5.0 · 11 de octubre de 2026

La vista territorial incorpora los modos **Satélite**, **Vuelos 3D** y **Calle**, y mantiene las capas de antenas y cobertura en Infraestructura.

### Satélite reciente e histórico

1. Abre **Satélite** y acerca el mapa al área de interés en el Perú.
2. Dibuja un rectángulo con dos clics o un polígono con tres o más vértices y «Cerrar polígono».
   En móvil el dibujo abre la pestaña Mapa; vuelve a Ficha para cerrar el polígono. «Área visible» usa el rectángulo de la vista.
3. Consulta las adquisiciones más recientes o filtra Desde/Hasta y nubosidad máxima. Cada resultado muestra fecha/hora UTC,
   resolución publicada y nubosidad de **la escena completa**, no del área seleccionada.
4. Selecciona una escena **A** y otra **B**. El deslizador cambia la opacidad de B sobre A; ambas fechas permanecen visibles.
   También puedes buscar otro período conservando A. Es comparación visual: no cuantifica ni atribuye causas de deforestación,
   expansión urbana, minería o inundaciones automáticamente.
5. **GeoTIFF A/B** descarga RGB georreferenciado con CRS, transformación, fecha de adquisición, enlace STAC y polígono en sus etiquetas.
   Una escena puede cubrir solo parte del área; no se presenta como un mosaico completo. Consulta hasta 4 grados cuadrados;
   exportación hasta 0,08 grados cuadrados y 40 millones de valores de banda. Reduce el área si se supera el límite.

Fuente: Copernicus Sentinel-2 L2A, catálogo público Element 84 Earth Search y COG RGB públicos de AWS.
El mapa base «Sentinel-2 2024» sigue siendo un mosaico separado: no sirve para acreditar una adquisición reciente.
El backend genera teselas PNG y recortes con Rasterio/GDAL; máximo dos operaciones raster simultáneas, caché de teselas en
`data/cache/imagery`, metadatos originales mediante SourceHarvester en `data/raw` (inmutables y fuera de Git).
El lanzador nativo comprueba Rasterio y lo instala junto con las dependencias del núcleo si falta; la imagen de producción también lo incluye.

### Antenas y telecomunicaciones

Activa **Antenas móviles**, **Antenas de telecomunicaciones** o **Torres de comunicación** en Infraestructura.
Desde una vista nacional se acerca automáticamente al centro para consultar OSM sin pedir todo el país.
La capa se actualiza al mover el mapa y se restaura al cambiar el mapa base. Una falla de Overpass conserva la consulta anterior y lo indica.
Cada objeto muestra operador, tecnología y altura solo cuando constan; revisión OSM, hora de consulta y distancia geométrica
al centro de la vista. OSM es comunitario e incompleto: no acredita cobertura ni intensidad de señal.

La cobertura OSIPTEL mantiene su corte 2025 y sus puntos por centro poblado. El filtro **Cero declarado** exige cero explícito
para los campos seleccionados; los valores faltantes nunca se convierten en cero. No encontrar un objeto OSM tampoco demuestra una zona sin cobertura.
La estimación de señal real requerirá mediciones, parámetros de radio, relieve y otros datos adicionales.

### Vuelos 3D y fotografías de calle

- **Vuelos 3D:** elige un intervalo UTC de hasta siete días, busca vuelos guardados y selecciona una aeronave. Usa Reproducir/Pausar,
  velocidad o el deslizador temporal. Son posiciones recibidas por **este servidor** al activar Vuelos en las capas en vivo;
  no es un archivo universal de vuelos anteriores. Hay muestreo por desplazamiento o cada 120 segundos y retención de siete días.
  Los vacíos de más de cinco minutos no se unen. La altitud es barométrica en pies convertida a metros; no es altura exacta sobre terreno.
  Altitud cero heredada es ambigua y se muestra como desconocida. El desplazamiento entre muestras se rotula interpolación visual.
- **Calle:** configura el token de una aplicación Mapillary en **Claves**, acerca la vista (máximo 0,25 grados por lado) y busca imágenes.
  Selecciona un punto o fotografía para ver su fecha de captura UTC y atribución. La clave permanece en el backend y todas las fotos pasan
  por un proxy limitado; no sale al navegador. Sin clave o sin cobertura, se muestra el estado explícito. No se incluye una clave preconfigurada.

### Nubes observadas

**Nubes satelitales reales** reemplaza el simulador meteorológico. Usa el mosaico global infrarrojo NOAA nowCOAST que también utiliza
GOdEyes. Solo acepta horas publicadas en GetCapabilities y muestra la hora en la capa; no infiere una adquisición desde la fecha del sistema.
Incluye nubes **y temperatura de superficie**: no es una máscara exclusiva de nubes ni una imagen óptica color real. Resolución aproximada 3 km,
actualización de origen horaria y latencia aproximada de 2–3 h. Si el proveedor falla, no se sustituye por partículas simuladas.

### Verificación y operación

Pruebas de esta ampliación: 107 pruebas Python aprobadas, cobertura del 90 % en los módulos Python nuevos/modificados de estas capas;
no representa cobertura total del proyecto. Pruebas de interfaz a 360/768/1280/1600 px, antenas conservadas al cambiar base y reproducción 3D
con fixtures de prueba. Consulta real: adquisiciones del 6 y 3 de octubre de 2026, GeoTIFF EPSG:32718 de 111×113 píxeles con etiquetas verificadas.
Navegador real: capa NOAA del 11 de octubre a las 16:00 UTC y trayectoria ADS-B `e80481` de ocho posiciones comprobadas sin errores JavaScript.
NOAA y OSM también se verifican con consultas de proveedor. Fotos Mapillary reales quedan pendientes de una clave configurada.
Overpass devolvió inicialmente 13 objetos reales; consultas posteriores presentaron 500/504 en los servidores públicos.
La restauración/dibujo se prueba con fixtures independientes de esa disponibilidad y el estado de falla se muestra en la capa.
`pip-audit` sobre dependencias núcleo e imágenes: sin vulnerabilidades conocidas en la consulta realizada.

Render Free conserva el código desplegado pero su filesystem es efímero: reinicios/despliegues pueden eliminar históricos ADS-B, ajustes BYOK,
metadatos descargados y cachés. Para conservar claves Mapillary en ese servicio usa la variable secreta `PI_MAPILLARY_TOKEN` en Render;
el diálogo Claves guarda un archivo local efímero en esa modalidad. No se modificó la autenticación pública existente.

Contratos y evidencia adicional: [API](docs/API.md) y [plan de integración](docs/eos/PLAN-territorial-2026-10-11.md).

Plataforma **standalone y local-first** de inteligencia geoespacial y situacional del Perú. Reúne en un solo
mapa seguridad ciudadana, movilidad, ambiente, infraestructura y espacio, con la procedencia de cada cifra a
la vista. Versión 0.4.0 · 8 de octubre de 2026.

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
| En vivo | Vuelos (adsb.lol), embarcaciones (AIS, BYOK), satélites (CelesTrak + satellite.js), sismos (IGP + USGS), focos de calor (NASA FIRMS, BYOK), eventos naturales (NASA EONET, sin clave, apagada por defecto), clima (SENAMHI observado + GFS/ECMWF modelo), tráfico (TomTom, BYOK), puertos, centros de datos. |
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
2. Ejecuta Python directamente, sin Docker ni WSL. Solo instala dependencias si faltan (`duckdb`, `openpyxl`, `h3`, `numpy`); no importa StatsForecast ni descarga fuentes durante el arranque.
3. Se abre el navegador en `http://127.0.0.1:8360/`. Cierra la ventana negra para detener el servidor.
   La comprobación inicial espera hasta cinco segundos para reconocer correctamente un puerto libre en Windows.

Si faltan datos, el mapa arranca igualmente e informa cómo cargarlos con `python -m peru_intel ingest all --download`.
Las actualizaciones se ejecutan explícitamente, fuera del inicio habitual. El lanzador comprueba la identidad
del servidor antes de reutilizar el puerto. No inicia servicios de voz, cámaras ni modelos automáticamente.

El precalentamiento de modelos de Patrones queda desactivado: se calculan al solicitar esa función. Para habilitarlo
explícitamente usa `PI_WARM_PATTERNS=1` antes de arrancar. StatsForecast sigue siendo opcional.
Los servicios externos de voz y go2rtc requieren una instalación nativa aparte si se desean esas capacidades;
el mapa, la API, los datos locales y las fotos de cámaras no requieren Docker. Docker queda como alternativa opcional.
Los datos y claves de un volumen Docker no se copian automáticamente: el inicio nativo utiliza la carpeta `data/` del proyecto.

Verificación del 8 de octubre de 2026: Python 3.12.10 en Windows, servidor nativo en puerto de prueba 8361:
salud disponible en 1,33 s; GET `/` en 0,651 s; estado API en 0,019 s. Son medidas locales de una ejecución,
no tiempos garantizados de renderizado ni de descarga de teselas externas. 55 pruebas Python aprobadas.
Comprobación de carga en Chromium a 360/768/1280/1600 px: sin desbordamiento horizontal ni errores JavaScript;
25 polígonos departamentales dibujados a 1280 px. El smoke E2E completo queda pendiente: su selector `#ai-run`
agotó el tiempo de espera al navegar a Cusco. Se observaron desconexiones de clientes al cerrar las páginas de prueba.

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
- **Infraestructura → Telecomunicaciones:** cobertura móvil declarada por OSIPTEL (corte 2025), filtrable por operadora,
  tecnología y medida (`CG` / `CG+CAR`). Los puntos representan centros poblados y los porcentajes son declaraciones de
  operadoras. Antenas y torres OSM se consultan para el área visible y se distinguen como cartografía comunitaria ODbL,
  incompleta y no oficial. Cada punto muestra su procedencia y límite de interpretación.
- **Otras capas ya disponibles:** puertos y centros de datos en Infraestructura; salud, hospitales, educación y bomberos
  en Servicios; emergencias INDECI, vías afectadas MTC, ambiente y población en sus familias actuales.
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
python -m peru_intel ingest telecom --dir <carpeta> # CSV oficial cobertura-movil-osiptel.csv
python -m peru_intel index                        # recalcular e imprimir el índice
python -m peru_intel build-territory --from <dir> # regenerar data/peru
python -m peru_intel export-ofm                   # copiar la caché de mapas de RUC360
```

## 4. Instrucciones específicas

### Publicación protegida en Render

El contenedor puede exponerse detrás de autenticación HTTP Basic configurando `PI_PUBLIC_ACCESS_PASSWORD` como
variable secreta del servicio. Configura también `PI_PUBLIC_SCHEME=https` cuando el proveedor termine TLS antes de
la aplicación, para que los estilos del mapa generen recursos del mismo origen seguro. Render asigna `PORT` al
contenedor; el punto de entrada y la comprobación de salud usan ese valor. Usa una contraseña larga y
única; no la guardes en Git ni en `data/config.local.json`.
Si la variable no existe, el servidor conserva el modo local sin autenticación. `/api/v1/health` queda disponible
para la comprobación de salud del proveedor. En Render Free el sistema de archivos es efímero: los ajustes hechos
desde la interfaz y las cachés locales se pierden al reiniciar, suspender o volver a desplegar el servicio.

### Actualizar datos oficiales (mensual)

SIDPOL y los indicadores MININTER se publican cada mes. Cuando el portal cambie el nombre del archivo, actualiza
la URL en `peru_intel/sources/catalog.py` (`download`) y ejecuta `python -m peru_intel ingest sidpol --download`.
Si el esquema cambia, el adaptador se detiene con un mensaje y `download_log.schema_changed` queda en 1.

La cobertura OSIPTEL corresponde al dataset anual con cobertura 2025 (metadatos publicados el 2026-05-12; última
actualización reportada 2025-05-31). Descarga el CSV desde la ficha oficial enlazada en «Infraestructura →
Telecomunicaciones», guárdalo como `cobertura-movil-osiptel.csv` y ejecuta `ingest telecom`. El portal puede bloquear
descargas automáticas con HTTP 418; se importa la descarga manual, se conserva el original bajo `data/raw/`
(ignorado por Git) y se actualizan Parquet y manifiesto. OpenStreetMap se consulta por ventana visible; OpenCellID y
scraping de Checa tu Señal no están conectados.

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
- En el modo El Niño el mapa no cambia de modo al hacer clic. Los botones Departamento/Provincia/Distrito colorean el
  **conteo de registros visibles** (nunca denuncias), solo con registros publicados a ese nivel o más fino.
- Panel lateral: lugares con más registros de los tipos visibles y `GET /api/v1/intel/enso/compare/{tipo}` (conteo por Niño
  y lugares más activos). SINPAD no nombra la quebrada: el lugar es el distrito publicado.

## Análisis solar (v0.3.3)

Riel → Ambiente → **Análisis solar**. Con el mapa a nivel de casa (zoom ≥ 16) un clic fija el punto y `apps/web/js/sun.js`
calcula en el navegador (fórmulas de SunCalc, ~0,1°, sin API ni red): salida, puesta y sus azimuts, mediodía solar y altura
máxima, posición y sombra a la hora elegida (slider + altura del objeto), trayectoria del día, de los solsticios (21 dic verano,
21 jun invierno) y del equinoccio dibujadas alrededor del punto (más lejos = Sol más bajo), y horas de sol directo por fachada
(8 orientaciones; verano dic–feb, invierno jun–ago, año) con recomendación de ventanas. Hora del Perú (UTC−5).
No considera edificios vecinos, relieve ni nubosidad (naturaleza: calculado).

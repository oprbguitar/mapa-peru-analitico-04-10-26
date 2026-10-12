# Guía — Operativos conjuntos

Ejercicio de mesa para planificar **varios operativos a la vez** (en una o varias regiones), ver qué apoyos reales hay cerca,
animar cómo llegarían los recursos y estimar tiempos y costos. Los recursos son hipotéticos; los tiempos y costos son
estimaciones con supuestos visibles. No usa información reservada.

## 1. Crear el plan

1. Barra superior → **Operativos**.
2. **＋ Operativo en el mapa** y clic donde ocurre. Se crea con la plantilla de *Intervención*. Repite para cada operativo
   (Lima, Cusco, Piura… a la vez). El número se puede **arrastrar** para moverlo.
3. O pulsa **Ejemplo**: agrega 4 operativos simultáneos en Lima, Callao, Iquitos y Piura (rotulados «ejemplo»).
4. **Retirar ejemplo** quita solo esos; **Limpiar todo** vacía el plan; ✕ en un operativo lo quita.

## 2. Configurar cada operativo (pestaña Operativos)

- **Incidencia** (intervención, control, rescate, incendio, desastre, evacuación médica, ayuda humanitaria, orden público),
  **prioridad**, **inicio** (minutos desde T+0), **minutos en sitio** y **complejidad** (multiplica el traslado).
- **Recursos**: elige el tipo y la cantidad → **Agregar**, o **Plantilla**. Por fila: personas por unidad, demora de salida,
  **fijar origen** (clic en el mapa o sobre una sede), **automático** (sede compatible más cercana) y **ensayar falla**.
- Si un recurso no tiene sede compatible cerca o no hay conexión vial razonable (p. ej. Iquitos por carretera), aparece un
  aviso: usa un recurso aéreo o fluvial o fija el origen.

## 3. Apoyos

Pestaña **Apoyos**: activa en el mapa comisarías, serenazgo, fiscalías, Poder Judicial, hospitales, centros de salud,
bomberos, aeropuertos, puertos, bases militares, bases navales y mercados. Se listan los 3 más cercanos de cada tipo al
operativo seleccionado; **Conectar** los enlaza al operativo (línea punteada). También puedes hacer clic en un punto del mapa.

**◎ Radar de comisarías**: cada comisaría a la vista muestra su radio de inflexión; un clic en el mapa (o ◎ en la lista) abre
la más cercana con su área de atención, radios, vecinas y sedes dentro. En el modo **Mapa** está en el botón **◎ Comisarías**.

## 4. Calcular y reproducir

- **Calcular** traza las rutas y estima. Después, cualquier cambio recalcula solo.
- **▶** reproduce (barra espaciadora); ← → mueven 5 min; velocidad ×1 a ×20 minutos por segundo; la barra de tiempo y el
  cronograma permiten saltar a cualquier minuto.
- **Visor 1** — tablero en vivo: unidades por fase, personal en sitio, km, costo acumulado, llegadas por operativo y costo por
  institución. **Visor 2** — cronograma (alistamiento, traslado, en sitio, retorno, falla y marca P90) y bitácora.

## 5. Hipótesis y costos

Hora y día (perfil de tráfico supuesto), lluvia, factor de tráfico fijo, probabilidad y demora por falla, variabilidad,
semilla, retorno a base y rutas OSRM o línea recta. El **tarifario** (S/ por km, por hora, por persona-hora y fijo) lo ingresas
tú; **Cargar ejemplo** trae valores ilustrativos marcados como EJEMPLO. Sin tarifas no se muestran costos.

## 6. Guardar y descargar

- **● Grabar video**: reproduce desde T+0 hasta el final y guarda un MP4/WebM (720p o 1080p) con HUD táctico.
- **PNG**: imagen del cuadro actual. **CSV**: desglose por recurso con método y fuentes. **JSON**: el plan completo.
- **Guardados**: guarda en este navegador, abre planes guardados o un archivo `.json`.

## Método (resumen)

Tierra: duración OSRM de flujo libre × factor del recurso × tráfico ÷ lluvia × complejidad. Aire y agua: línea recta × rodeo a la
velocidad del recurso. Alistamiento por tipo. Monte Carlo (lognormal σ y falla con su demora) con semilla → P50/P90. El
escenario animado es el central (sin variabilidad) más las fallas que ensayes. Costo = qty × (km × tarifa km + horas × tarifa
hora + fijo) + personas × horas × tarifa persona-hora; aeronaves solo horas de vuelo.

## Abrir y cerrar el mapa

`INICIAR-MAPA.bat` abre el mapa en `http://127.0.0.1:8360/` (un solo puerto). Para cerrarlo y que no quede cargando de fondo:
**⏻ Cerrar mapa** en el menú ⋯, `CERRAR-MAPA.bat`, o volver a abrir `INICIAR-MAPA.bat` y elegir **[C] Cerrar**.

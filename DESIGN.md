# DESIGN.md — Mapa Perú Analítico

## 1. Intención
- **Modo de superficie:** explore (mapa analítico) con componentes de operate (capas en vivo, claves).
- **Usuario principal:** analista territorial / planificador de seguridad ciudadana (Pierre y su equipo).
- **Tarea principal:** comparar territorios del Perú en el tiempo y entender por qué un territorio tiene su valor.
- **Decisiones que el usuario toma aquí:** dónde poner atención (territorios y períodos), qué fuente creer, qué pedir a la IA.
- **Densidad objetivo:** media-alta.

## 2. Dirección visual

**v0.3 (vigente) — HUD v0.2 + decisión.** design-pick (`Mapa Peru Analitico v0.3`, modo explore) propuso «command bar + tabla
maestra · petróleo + coral · motion seco». Se conserva la carcasa HUD que fijó el usuario y se adopta del selector:
**barra de modos** (Mapa · Patrones · Rutas · El Niño) como command bar, **tablas de decisión** en la ficha (rutas, patrones,
servicios), **coral** (`--hot`, `--enso-warm`) solo para focos y alerta, y motion seco en UI (la animación queda para datos:
clima, corrientes, focos, historias).
Tres direcciones consideradas: (a) tablero denso separado del mapa — descartado, rompe la lectura territorial;
(b) **modos sobre el mismo mapa con ficha contextual** — elegida; (c) narrativa scrollytelling a pantalla completa — solo
para las historias de El Niño (tarjeta inferior con capítulos).

**Desviación de color pedida por el usuario:** el coloreado ya no es solo cian. La paleta por defecto es **espectral
(azul → verde → amarillo → rojo)**, con Calor, Viridis (apta para daltonismo) y Cian elegibles en la leyenda. Se declara en
la leyenda «cuantiles · posición relativa»: es magnitud relativa, **no un semáforo oficial de riesgo**.

**v0.2 (vigente) — HUD táctico, a pedido del usuario, con referencia visual en God's Eye View (`GOdEyes`).**
Desviación declarada del selector: la referencia la fijó el usuario; se conservó del selector la espina temporal, la
tipografía y la rampa cian, y se adaptó lo que el harness prohíbe (sin Inter; vidrio solo con función).

- Arquetipo de layout: **mapa a pantalla completa con paneles HUD flotantes** + **espina temporal** inferior que gobierna el período.
- Tipografía: display **Space Grotesk** / cuerpo **Noto Sans** / mono **Space Mono** en mayúsculas espaciadas para rótulos HUD
  (God's Eye usa Inter + JetBrains Mono; Inter está prohibido por el harness).
- Paleta: **noche casi negra** `#05080C`, paneles `rgba(8,14,22,.80)`, acento **cian HUD `#00D4FF`** solo para selección,
  estado activo y marcos; resplandor únicamente en lo activo/en vivo. Variante «día» con `[data-theme="light"]`.
- Geometría: radio 4 px, **escuadras de esquina** cian (2 px) como marco HUD, sombras profundas solo para separar del mapa.
- Vidrio: translúcido + desenfoque **con función** — leer el panel sin perder el territorio de fondo. `prefers-reduced-transparency` lo vuelve opaco.
- Motion: pulso en indicadores en vivo, escalonado 40 ms en la ficha, cámara 3D con `easeTo`; `prefers-reduced-motion` lo anula.
- Mapa: base nocturna OpenFreeMap «dark» por defecto; satélite híbrido, Sentinel-2, topográfico e IGN; relieve 3D + cielo atmosférico.

**v0.1 (histórico) — salida de design-pick:** espina temporal · pizarra + cian · Space Grotesk/Noto Sans/Space Mono · bloque 0 px · escalonado.
- **Por qué encaja:** el dato de seguridad es temporal y territorial; la espina hace explícito el período (parcial o completo) y evita comparar meses distintos. El cian secuencial es neutro: no presenta una paleta decorativa como semáforo de riesgo regulado.
- **Cambios a propósito vs. proyecto anterior (RUC360 Territorio v18: plex · arena-índigo · rail-workspace):** otra familia tipográfica, paleta fría pizarra-cian, geometría de bloque sin radios y la espina temporal como estructura principal en lugar del rail.

## 3. Tokens
Ver `apps/web/css/tokens.css` (color, rampas secuencial/divergente, naturaleza del dato, tipografía, espacio 4–64, forma, motion). Noche por defecto; «día» con pasos propios bajo `[data-theme="light"]` (no inversión). Paleta categórica de naturaleza del
dato validada en ambos modos con `validate_palette.js` (PASS).

## 4. Componentes y variantes
| Componente | Variantes | Estados cubiertos |
|---|---|---|
| Opción de capa (`.opt`) | radio temático, casilla en vivo, deshabilitada | hover, checked (regla izquierda de acento), disabled, focus-visible |
| Selector de nivel | departamento/provincia/distrito | checked, disabled con motivo (no se reparten cifras), hover, focus |
| Presets de tiempo | AHORA, 24 H, 7 D, 30 D, 1 AÑO, 5 AÑOS | checked, hover, flechas de teclado |
| Leyenda | secuencial (cuantiles 7 clases) · divergente (cortes fijos ±5/15/30 %) | medida seleccionada |
| Distintivo de naturaleza (`.kind`) | oficial ■ · en vivo ◆ · calculado ▲ · estimación ◇ · proyección ▷ · IA ✱ | siempre glifo + texto |
| Ficha | nacional / territorio / clima en un punto | carga (spinner), vacío, error |
| Herramientas de vista | 3D · Relieve · Norte | pressed (resplandor), hover, focus |
| Panel HUD (`.hud.hud-frame`) | barra, riel, ficha, espina | escuadras de esquina; opaco con transparencia reducida |
| Tabla de proveedores de clima | ok · sin clave · cuota agotada · error · consenso | estado en texto, no solo color |
| Caja IA | — | busy (`aria-busy`), oraciones VERIFICADO / NO VERIFICADO |

## 5. Datos y gráficos
- **Choropleth** (no heatmap de puntos) por escalas; cuantiles para magnitud, divergente para cambio %.
- **Espina temporal**: área + línea con selección del período y del año de comparación; tooltip por mes.
- **Serie + proyección** en la ficha: línea sólida (oficial), discontinua (proyección) y banda 95 %.
- Barras horizontales para modalidades y para el aporte de cada variable al índice.
- Identidad nunca solo por color: glifos en la naturaleza del dato, texto en estados, ▲▼ en cambios.
- Paleta categórica de naturaleza del dato validada con `dataviz/validate_palette.js` (claro y oscuro: PASS).

## 6. Responsive
| Breakpoint | Cambio estructural |
|---|---|
| 360 | Mapa completo; riel y ficha como hojas flotantes con barra de pestañas (Capas · Mapa · Ficha); presets en una fila de 6 |
| 768 | Riel flotante + mapa; ficha deslizante |
| 1280 | Riel 264–296 · mapa · ficha 340–384 flotantes |
| 1600 | Riel 320, ficha 420 |

## 7. Accesibilidad
- Contraste de texto con tinta sobre superficie ≥ 12:1; textos secundarios `--ink-soft` ≥ 7:1.
- Foco visible 2 px cian con offset en todos los controles; enlace «saltar a la ficha».
- `prefers-reduced-motion` y `forced-colors` contemplados.
- Landmarks: header, nav (capas), main (mapa), aside (ficha), footer (tiempo); un solo h1.

## 8. Anti-patrones prohibidos en este proyecto
- Fila de KPIs decorativos sin relación con el período; métricas sin fuente.
- Presentar la rampa espectral como nivel oficial de riesgo (siempre «cuantiles · posición relativa»); degradados morado-azul; glass sin función; cards anidadas.
- Animación decorativa: todo lo que se mueve representa un dato (lluvia, calor, corrientes, focos) y respeta `prefers-reduced-motion`.
- Repartir una cifra regional entre distritos.

## 8b. Componentes v0.3
| Componente | Estados |
|---|---|
| Barra de modos (`.modes`) | seleccionado, hover, active, focus |
| Paneles replegables + pestañas de borde (`.edge-tab`) | abierto/replegado, vista amplia, teclas `[` `]` F Esc |
| Chips (`.chip`) | pressed (glow), hover, active, focus |
| Columnas por año (`.year-col`) | sube/baja/estable, parcial (rayado), proyección (rombo), seleccionado |
| Asistente (`.assistant`) | idle, listening (pulso rojo), busy, error |
| Historia (`.story`) | reproduciendo/pausa, capítulo actual, progreso |
| Visor de cámaras | ok, sin imagen, pausado, mosaico |

## 9. Auditoría
- `design-lint`: **0 / 20 — APROBADO** (v0.3, 30 archivos).
- E2E Playwright (`tests/e2e/smoke.mjs`): 19/19 a 1280, 1600, 768 y 360 px — incluye clima por punto, capas SENAMHI/GIBS,
  satélite + relieve 3D y cambio noche/día conservando capas.

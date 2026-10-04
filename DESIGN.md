# DESIGN.md — Mapa Perú Analítico

## 1. Intención
- **Modo de superficie:** explore (mapa analítico) con componentes de operate (capas en vivo, claves).
- **Usuario principal:** analista territorial / planificador de seguridad ciudadana (Pierre y su equipo).
- **Tarea principal:** comparar territorios del Perú en el tiempo y entender por qué un territorio tiene su valor.
- **Decisiones que el usuario toma aquí:** dónde poner atención (territorios y períodos), qué fuente creer, qué pedir a la IA.
- **Densidad objetivo:** media-alta.

## 2. Dirección visual (salida de design-pick)
- Arquetipo de layout: **línea de tiempo como espina dorsal** — la espina temporal inferior (serie nacional SIDPOL 2018–2026) gobierna el período de todas las capas; el mapa y la ficha cuelgan de ella.
- Tipografía: display **Space Grotesk** / cuerpo **Noto Sans** / mono **Space Mono** (cifras tabulares).
- Familia de paleta: **pizarra + cian** (tinta `#12181F`, superficie `#F5F8FA`, acento `#0CA678` solo para acción/selección, apoyo `#1098AD` para magnitud).
- Geometría: **bloque**, radio 0, reglas de 3 px como separadores estructurales, sin sombras.
- Motion: **escalonado** 40 ms en filas y barras de la ficha; `prefers-reduced-motion` lo anula.
- **Por qué encaja:** el dato de seguridad es temporal y territorial; la espina hace explícito el período (parcial o completo) y evita comparar meses distintos. El cian secuencial es neutro: no presenta una paleta decorativa como semáforo de riesgo regulado.
- **Cambios a propósito vs. proyecto anterior (RUC360 Territorio v18: plex · arena-índigo · rail-workspace):** otra familia tipográfica, paleta fría pizarra-cian, geometría de bloque sin radios y la espina temporal como estructura principal en lugar del rail.

## 3. Tokens
Ver `apps/web/css/tokens.css` (color, rampas secuencial/divergente, naturaleza del dato, tipografía, espacio 4–64, forma, motion). Modo oscuro definido con pasos propios (no inversión), bajo `prefers-color-scheme` y `[data-theme="dark"]`.

## 4. Componentes y variantes
| Componente | Variantes | Estados cubiertos |
|---|---|---|
| Opción de capa (`.opt`) | radio temático, casilla en vivo, deshabilitada | hover, checked (regla izquierda de acento), disabled, focus-visible |
| Selector de nivel | departamento/provincia/distrito | checked, disabled con motivo (no se reparten cifras), hover, focus |
| Presets de tiempo | AHORA, 24 H, 7 D, 30 D, 1 AÑO, 5 AÑOS | checked, hover, flechas de teclado |
| Leyenda | secuencial (cuantiles 7 clases) · divergente (cortes fijos ±5/15/30 %) | medida seleccionada |
| Distintivo de naturaleza (`.kind`) | oficial ■ · en vivo ◆ · calculado ▲ · estimación ◇ · proyección ▷ · IA ✱ | siempre glifo + texto |
| Ficha | nacional / territorio | carga (spinner), vacío, error |
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
| 360 | Una columna; riel y ficha como hojas completas con barra de pestañas (Capas · Mapa · Ficha); presets en una fila de 6 |
| 768 | Riel + mapa; ficha como panel deslizante |
| 1280 | Riel · mapa · ficha (296/1fr/392) |
| 1600 | Riel 320, ficha 440 |

## 7. Accesibilidad
- Contraste de texto con tinta sobre superficie ≥ 12:1; textos secundarios `--ink-soft` ≥ 7:1.
- Foco visible 2 px cian con offset en todos los controles; enlace «saltar a la ficha».
- `prefers-reduced-motion` y `forced-colors` contemplados.
- Landmarks: header, nav (capas), main (mapa), aside (ficha), footer (tiempo); un solo h1.

## 8. Anti-patrones prohibidos en este proyecto
- Fila de KPIs decorativos sin relación con el período; métricas sin fuente.
- Rojo «peligro» como rampa de criminalidad; degradados morado-azul; glass; cards anidadas.
- Repartir una cifra regional entre distritos.

## 9. Auditoría
- `design-lint`: **0 / 20 — APROBADO**.
- E2E Playwright (`tests/e2e/smoke.mjs`): 15/15 a 1280, 1600 (oscuro), 768 y 360 px, sin desbordamiento ni errores de JS.

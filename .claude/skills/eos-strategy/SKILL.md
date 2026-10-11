---
name: eos-strategy
description: Alinear el resultado de producto con la estrategia y capacidad operativa antes de iniciar o ampliar desarrollo; revisar marketing, personas, gestión y economía cuando sean pertinentes.
---

# EOS STRATEGY — estrategia de producto y operación

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Propósito

Aplica esta capa antes de desarrollar un producto, una capacidad nueva o un cambio que altere usuarios, propuesta de valor, mercado, operación o forma de entrega. Se integra con INIT para producto nuevo y con ADOPT para software existente; no reemplaza esas skills ni crea una autoridad ejecutiva autónoma.

El resultado es una estrategia breve y comprobable que conecta la necesidad del usuario con el valor esperado, la decisión de producto, el plan técnico y la capacidad real de operarlo. Una persona fundadora puede ser la única responsable. No inventes equipo, presupuesto, demanda, validación de mercado ni aprobación del propietario.

## Dos fases conectadas

### Fase 1 — CEO/manager: estrategia y dirección

1. Filtra la tarea por prioridad: ¿qué objetivo, usuario, dinero, riesgo, reputación o fecha puede afectar? ¿Qué decisión necesita al responsable ahora, qué puede resolverse y reportarse después, y qué se debe aparcar?
2. Resume el problema, quién lo experimenta, su solución actual y por qué atenderlo ahora.
3. Separa usuario, comprador, pagador y operador cuando no sean la misma persona.
4. Fija el resultado esperado y una señal observable para decidir si el producto o cambio aporta valor. Si falta una línea base, declárala pendiente.
5. Delimita una primera entrega útil y explícita qué queda fuera.
6. Perfila mercado y jurisdicción a partir de evidencia o de lo dicho por el responsable. Perú puede ser el contexto inicial si el usuario lo indica; no lo conviertas en supuesto universal. Para alcance internacional, pregunta qué países y segmento se priorizan y deja obligaciones locales sin confirmar como pendientes.
7. Evalúa las áreas de la tabla como `EN ALCANCE`, `EVALUADA`, `DIFERIDA`, `NO APLICA` o `PENDIENTE`. Evalúalas todas en la admisión, pero profundiza solo en las que puedan cambiar el resultado.

| Área | Pregunta estratégica | Evidencia o salida mínima |
|---|---|---|
| Producto y dirección | ¿Qué problema y resultado justifican el trabajo? ¿Qué se prioriza y qué se descarta? | Objetivo, hipótesis, alcance inicial y criterio de éxito |
| Marketing y crecimiento | ¿A quién hay que llegar, qué propuesta entenderá y por qué canal se validará o distribuirá? | Segmento, mensaje/valor, canal candidato y métrica; o razón para diferir |
| Personas y capacidad (HR) | ¿Quién hará producto, ingeniería, soporte y operación? ¿La persona responsable tiene tiempo y habilidades suficientes? | Dueño real por función, brecha de capacidad y opción: simplificar, aprender, automatizar o proponer apoyo |
| Gestión y operación | ¿Quién decide, prioriza, acepta, mantiene y responde si algo falla? ¿Con qué cadencia se revisa? | Responsable, checkpoints, ruta de soporte y condición de escalamiento |
| Economía | ¿Qué costos, ingresos o límites de presupuesto afectan la decisión? | Supuestos identificados y cifra solo si existe fuente o cálculo reproducible |
| País, regulación y confianza | ¿Dónde operará, qué datos tratará y qué obligaciones podrían aplicar? | Países, clases de datos y revisión normativa asignada; no declarar cumplimiento sin evidencia |

### Fase 2 — Producto/ingeniería: construir, integrar y aprender

1. Ejecuta INIT, ADOPT o el modo que corresponda; inspecciona el repositorio y el estado real antes de cambiarlo.
2. Traduce las decisiones de la fase 1 a perfil, capacidades, arquitectura, tareas, pruebas y documentación existentes en EOS.
3. Vincula cada incremento a una necesidad, hipótesis o reducción de riesgo. Mantén desacopladas las funciones estratégicas que se hayan diferido.
4. Implementa solo dentro del alcance autorizado, con pruebas y revisión proporcionales. Marketing no implica publicar; una estrategia de personas no implica contratar; una recomendación ejecutiva no aprueba gasto, compromisos ni cambios externos.
5. Prepara la entrega con evidencia técnica y un plan operativo que nombre a la persona responsable real.
6. Cierra con una revisión de operación e integración: qué proceso ahora existe, qué SOP/checklist quedó actualizado, qué dependencia o punto único de fallo persiste y cuál es el siguiente experimento o prioridad.

## Entrevista de admisión obligatoria

Al comienzo de cada nuevo producto, capacidad o cambio estratégicamente relevante, ejecuta esta comprobación antes de diseñar o programar. Revisa el prompt, repositorio, perfil, ADR y documentación existentes primero. Marca cada respuesta como `DICHO`, `VERIFICADO`, `INFERIDO` o `PENDIENTE`; nunca preguntes de nuevo algo que ya está claro.

1. ¿Qué problema concreto resolvemos, para quién y cómo lo resuelve hoy?
2. ¿Quién usará, comprará, pagará y operará la solución; en qué país o mercado?
3. ¿Qué resultado demostrará que valió la pena y cómo lo mediremos?
4. ¿Cuál es la primera entrega útil y qué queda expresamente fuera?
5. ¿Qué evidencia existe sobre la alternativa, diferenciación, demanda o canal de llegada? ¿Marketing está en alcance ahora?
6. ¿Quién se hará cargo de construir, decidir, mantener y atender el producto? Si es una operación de una sola persona, ¿qué límite de tiempo, habilidades o capacidad cambia el diseño? ¿Hay una brecha real de personas/HR?
7. ¿Qué presupuesto, fechas, datos, integraciones, permisos, obligaciones o condiciones de lanzamiento pueden alterar la solución?

Entrega primero un resumen corto con respuestas ya conocidas. Luego formula solo las preguntas pendientes cuya respuesta cambiaría alcance, arquitectura, riesgo, costo o criterio de aceptación; agrúpalas en un máximo de cinco preguntas por turno y deja que el responsable responda antes de avanzar por una decisión dependiente. Para incógnitas secundarias, registra dueño y próximo paso y continúa el trabajo independiente. No bloquees un parche acotado por preguntas de estrategia empresarial que no lo afectan.

La estrategia del producto es recurrente, no un formulario de una sola vez. Revalida la misma ficha al pasar de estrategia a backlog, antes de una release que altere el alcance, cuando una medición o feedback contradiga la hipótesis, cuando cambie el mercado/país/datos/equipo y durante la revisión posterior al lanzamiento. Reabre solo los campos afectados; conserva decisiones vigentes y su evidencia. En cada checkpoint el lente de coordinación resume la prioridad única, dueño, bloqueo, dependencia y decisión que sí requiere al responsable; no simula empleados debatiendo entre sí.

## Registro mínimo y puertas de avance

Conserva el resultado en `PROJECT-PROFILE`, `TASK-PACKET`, ADR o la ubicación existente del proyecto; no crees copias de estrategia por cada tarea. Para cada decisión material registra: pregunta, respuesta, estado de evidencia, responsable, fecha/contexto, decisión, hipótesis, criterio observable, estado de cada área y condición para revisar.

- **Estrategia → ingeniería:** problema, usuario, alcance y aceptación están suficientemente definidos para la siguiente tarea; dudas restantes están etiquetadas y no bloquean esa tarea.
- **Ingeniería → entrega:** los criterios técnicos pasan con evidencia real y existe un dueño para soporte y operación; marketing, HR y economía muestran su estado y cualquier dependencia de lanzamiento.
- **Entrega → aprendizaje:** contrasta el resultado observado con la hipótesis, registra feedback/costo real disponible y decide continuar, ajustar, diferir o retirar. No inventes conversión, ingresos ni satisfacción.

Si dos opciones de negocio siguen siendo materialmente distintas, presenta alternativas con evidencia, costo, riesgo y reversibilidad y solicita la decisión del responsable. Puedes recomendar una opción; no asumir que eres CEO del negocio ni hablar en nombre de una persona, empresa o equipo.

## Transferencia y límites

La recomendación estratégica distingue hechos, estimaciones, hipótesis y preguntas abiertas. Los agentes especialistas aportan análisis y entregables dentro de sus competencias; el responsable humano conserva decisiones de producto, contratación, cumplimiento, gasto y compromisos públicos. No transmitas datos sensibles a agentes o servicios no aprobados.

No copies roles, prompts ni entregables completos de frameworks externos. Toma patrones generales —entrevista de alineación, especialización por función, entregables verificables, criterios de éxito, coordinación y equipos activados por fase— y exprésalos mediante contratos, estados y autorizaciones EOS. Las fuentes de inspiración revisadas el 2026-10-09 son [grill-with-docs](https://github.com/mattpocock/skills/blob/main/skills/engineering/grill-with-docs/SKILL.md) y [TDD](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) del repositorio [mattpocock/skills](https://github.com/mattpocock/skills); y [Business Strategist](https://github.com/msitarzewski/agency-agents/blob/main/specialized/business-strategist.md), [Chief of Staff](https://github.com/msitarzewski/agency-agents/blob/main/specialized/specialized-chief-of-staff.md), [Operations Manager](https://github.com/msitarzewski/agency-agents/blob/main/specialized/operations-manager.md) y su [catálogo de agentes](https://github.com/msitarzewski/agency-agents) del repositorio `agency-agents`. Son repositorios evolutivos; esta skill no instala sus agentes ni garantiza que sus contenidos sigan iguales.

**Firma editorial:** Pierre R. Boss · oprbguitar.

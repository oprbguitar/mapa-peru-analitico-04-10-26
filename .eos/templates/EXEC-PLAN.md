# Plan ejecutable — trabajo largo verificable

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Usa esta plantilla cuando una tarea tenga varios hitos, varios participantes o pueda exceder una sesión. El plan es un documento vivo: un agente que lo retome debe poder continuar leyendo solo este archivo y el repositorio. Las reglas están en [ENGINEERING-QUALITY](../docs/manuals/ENGINEERING-QUALITY.md), sección 36, y en [AGENT-ORCHESTRATION](../docs/manuals/AGENT-ORCHESTRATION.md), sección 19. No crees un plan formal para correcciones pequeñas.

## Identificación

```yaml
plan_id: PENDIENTE
titulo: PENDIENTE
responsable: PENDIENTE
orquestador: PENDIENTE
modo_eos: INIT | ADOPT | AUDIT | MIGRATE | RELEASE | INCIDENT
creado: AAAA-MM-DD
revision_base: PENDIENTE
autorizaciones_externas: [PENDIENTE]
```

## Propósito observable

Describe en dos o tres frases qué podrá hacer el usuario cuando el plan termine y cómo se comprobará. Evita describir actividades; describe resultados.

## Contexto y orientación

Explica el estado actual del repositorio relevante para la tarea con rutas completas, términos del dominio definidos y decisiones vigentes que condicionan el trabajo. Escribe para un lector sin acceso a la conversación original.

## Hitos

| Id | Resultado verificable | Responsable | Archivos | Verificación (comando → salida esperada) | Depende de |
|---|---|---|---|---|---|
| H1 | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | — |

Cada hito termina en comportamiento observable. Los hitos paralelos tienen archivos disjuntos o aislamiento declarado.

## Acciones que requieren autorización

| Acción | Destino | Efecto | Autorización registrada |
|---|---|---|---|
| PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

## Riesgos y reversión

| Riesgo | Consecuencia | Señal temprana | Mitigación | Reversión ensayada |
|---|---|---|---|---|
| PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | sí / no |

## Progreso

Actualiza esta lista al cerrar cada paso, con marca temporal y evidencia breve. No la reconstruyas de memoria.

- [ ] AAAA-MM-DD HH:MM — H1 — PENDIENTE — evidencia: PENDIENTE

## Decisiones

Registra cada decisión con fecha, alternativa descartada y razón, para que nadie la reabra sin nueva evidencia.

- AAAA-MM-DD — decisión — alternativa descartada — razón

## Descubrimientos inesperados

Anota comportamientos que contradicen supuestos, con la evidencia observada.

- AAAA-MM-DD — descubrimiento — evidencia — efecto en el plan

## Aceptación final

- Verificación completa sobre la revisión final: comando → resultado.
- Criterios del propósito observable comprobados.
- Participantes reales y sus tareas.
- Pendientes con responsable.

## Retrospectiva

Resultado frente al propósito, lecciones y cambios propuestos a instrucciones, validadores o evaluaciones.

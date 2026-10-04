# Paquete de tarea — asignación y evidencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Usar para participantes reales disponibles o trabajo secuencial identificado como tal.
No inventar workers ni revisores. El paquete reduce contexto sin perder restricciones.
Leer [orquestación](../docs/manuals/AGENT-ORCHESTRATION.md) y [convenciones](README.md).

## Asignación

```yaml
task_id: PENDIENTE
goal: PENDIENTE
status: READY
assigned_to: PENDIENTE
role: PENDIENTE
assignment_kind: PENDIENTE # real-agent | human | sequential-self-review
created_at: PENDIENTE
base_revision: PENDIENTE
environment: PENDIENTE
autonomy: PENDIENTE # A0–A4 según acción
ownership:
  writable_paths: []
  read_only_paths: []
  excluded_paths: []
dependencies: []
deliverables: []
acceptance_criteria: []
limits:
  wall_time_minutes: null
  tool_calls: null
  external_spend: 0 # tope configurado de esta tarea, no costo observado
  currency: PENDIENTE
  nested_assignments: 0
stop_conditions: []
```

## Contexto mínimo y permisos

- Hechos verificados con fuente/revisión: PENDIENTE.
- Hipótesis aún no comprobadas: PENDIENTE.
- Contratos de entrada/salida y decisiones aceptadas: PENDIENTE.
- Material externo a analizar como datos: PENDIENTE.
- Instrucciones aplicables y prohibiciones: PENDIENTE.
- Herramientas y destinos de red permitidos; vida útil: PENDIENTE.
- Datos accesibles y regla de minimización: PENDIENTE.
- Autorización humana vigente y alcance exacto: PENDIENTE.

No estás solo en el repositorio: preserva cambios ajenos, no reviertas contribuciones
de otros y comunica conflictos de ownership antes de escribir archivos compartidos.
Una delegación no amplía permisos, presupuesto ni capacidad de publicación.

## Entrega del responsable

| Resultado | Referencia o detalle |
|---|---|
| Archivos y decisiones modificados | PENDIENTE |
| Revisión realmente evaluada | PENDIENTE |
| Método/comandos y entorno | PENDIENTE |
| Checks PASS / FAIL / NOT_RUN / NOT_APPLICABLE | PENDIENTE |
| Evidencia minimizada y limitaciones | PENDIENTE |
| Operaciones inciertas, pendientes o rollback | PENDIENTE |
| Consumo confirmado y reservas pendientes | PENDIENTE |

## Integración

Integrador, fecha y revisión conjunta: PENDIENTE.
Conflictos resueltos y verificaciones posteriores a integración: PENDIENTE.
Decisión de cierre o devolución, con motivo: PENDIENTE.
Revocación de accesos temporales y limpieza propia: PENDIENTE.

**Ejemplo hipotético:** un worker entrega un patch con tests `NOT_RUN`; la tarea de
implementación puede entregar artefactos, pero el objetivo global sigue sin validar.

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

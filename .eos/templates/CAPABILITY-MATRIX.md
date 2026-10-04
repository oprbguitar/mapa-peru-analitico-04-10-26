# Matriz de capacidades — presencia, activación y evidencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Inventariar capacidades según el [perfil](PROJECT-PROFILE.md).
Presencia en el estándar no significa activación.
Separar necesidad, implementación y verificación.

## Contexto de evaluación

```yaml
matrix_id: PENDIENTE
project: PENDIENTE
owner: PENDIENTE
prepared_by: PENDIENTE
evaluated_at: PENDIENTE
revision: PENDIENTE
environment: PENDIENTE
criticality: PENDIENTE
policy_version: PENDIENTE
profile_ref: PENDIENTE
```

## Estados precisos

Registra además el ciclo canónico EOS: `PRESENT`, `ASSESSED`,
`DORMANT`, `PLANNED`, `IMPLEMENTED`, `VERIFIED`, `OPERATING`,
`DEGRADED` o `RETIRED`, según la [constitución](../EOS_MASTER_SYSTEM_INSTRUCTION.md).
Los ejes siguientes descomponen esa descripción; no la sustituyen.
Una capacidad `ACTIVE` con evidencia faltante aún no acredita `OPERATING`.

| Eje | Estados y significado |
|---|---|
| Aplicabilidad | REQUIRED, OPTIONAL, NOT_APPLICABLE, UNDETERMINED |
| Implementación | ABSENT, DOCUMENTED, IMPLEMENTED_INACTIVE, ACTIVE |
| Evidencia | VERIFIED, PARTIAL, MISSING, NOT_APPLICABLE |

`DOCUMENTED`: contrato/diseño. `ACTIVE`: ejecución habilitada.
`VERIFIED` requiere método y alcance.
Justificar `NOT_APPLICABLE` para capacidad y prueba.

## Inventario por completar

| Capacidad | Aplicabilidad | Implementación | Evidencia | Dueño | Referencia |
|---|---|---|---|---|---|
| Arquitectura y contratos | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Calidad y pruebas | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Seguridad y privacidad | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| UX y accesibilidad | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Datos y restauración | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Integraciones externas | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Puerto IA | REQUIRED | DOCUMENTED | MISSING | PENDIENTE | PENDIENTE |
| Ejecución de IA | OPTIONAL | ABSENT | MISSING | PENDIENTE | OFF |
| Observabilidad y operación | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Documentación y transferencia | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Compliance y legal/IP | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |
| Recursos, costo y evolución | UNDETERMINED | ABSENT | MISSING | PENDIENTE | PENDIENTE |

Los estados iniciales son placeholders.
Agregar filas según contexto.

## Detalle de cada fila pertinente

- Entrada, salida y contrato: PENDIENTE.
- Ciclo canónico EOS y motivo: PENDIENTE.
- Método y aceptación: PENDIENTE.
- Resultado y límites: PENDIENTE.
- Riesgo y prioridad: PENDIENTE.
- Dependencias, plan y dueño: PENDIENTE.
- Autorización de cambio: PENDIENTE.
- Revisión e invalidación de evidencia: PENDIENTE.

**Ejemplo hipotético:** startup con IA OFF verificado.
La prueba no acredita generación, OCR ni embeddings.

No promediar estados para ocultar bloqueos críticos.
Verificar capacidades requeridas y justificar no aplicabilidad.

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

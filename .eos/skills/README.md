# Skills operativas de Pierre R. Boss

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Propósito y activación

Estas skills convierten EOS en secuencias de trabajo transportables.
Son procedimientos documentales y no crean servicios, agentes ni permisos.
El host decide qué herramientas existen y cómo invocarlas.
Su instalación global queda fuera del alcance salvo solicitud expresa.

Empieza leyendo [EOS-CORE](../EOS-CORE.md) (la [constitución](../EOS_MASTER_SYSTEM_INSTRUCTION.md) solo por secciones),
el [AGENTS.md](../AGENTS.md) y el [README general](../README.md).
Escoge un modo principal y carga solo manuales necesarios.
Combinar modos exige explicar la transición y conservar límites previos.

## Selección del procedimiento

| Situación | Skill | Entrega central |
|---|---|---|
| Producto nuevo | [INIT](eos-init/SKILL.md) | Perfil e implementación autorizada |
| Sistema existente | [ADOPT](eos-adopt/SKILL.md) | Baseline y mejora sin regresión |
| Revisión solicitada | [AUDIT](eos-audit/SKILL.md) | Hallazgos sin cambiar el destino |
| Cambio de plataforma | [MIGRATE](eos-migrate/SKILL.md) | Equivalencia y transición |
| Entrega de versión | [RELEASE](eos-release/SKILL.md) | Artefacto exacto y verificación |
| Servicio afectado | [INCIDENT](eos-incident/SKILL.md) | Contención y recuperación acotadas |

## Entradas mínimas

- Objetivo del usuario y resultado esperado.
- Repositorio, entorno y estado actual.
- Archivos permitidos y cambios ajenos.
- Datos, sensibilidad y criticidad.
- Recursos, presupuesto y restricciones.
- Autorizaciones externas ya concedidas.
- Pruebas disponibles y evidencia requerida.

Completa [PROJECT-PROFILE](../templates/PROJECT-PROFILE.md)
y [TASK-PACKET](../templates/TASK-PACKET.md) cuando corresponda.
Usa registros existentes; evita duplicar información por formalidad.
Las cifras desconocidas quedan pendientes con responsable.

## Roles y alcance

Selecciona planificación, arquitectura, calidad, seguridad y operación
según el riesgo concreto.
Invoca únicamente agentes realmente disponibles.
Si un rol no existe, ejecuta su revisión secuencialmente
y declara que no hubo evaluación independiente.
Delegar implica ownership, contexto, entregables y límites.
Conserva cambios de otros colaboradores.

A0/A1 permiten inspección y verificaciones apropiadas.
A2 prepara cambios reversibles dentro del encargo.
A3 requiere autorización aplicable para operaciones de impacto alto.
A4 prohíbe fabricar evidencia, exponer secretos y borrar producción autónomamente.
Una autorización explícita previa sigue vigente dentro de su alcance.
No pedir otra aprobación por rutina ni ampliar permisos por inferencia.

## Secuencia compartida

1. Identifica modo, objetivo y frontera de confianza.
2. Inspecciona instrucciones locales y estado Git.
3. Entrega a cada rol una tarea verificable.
4. Define pruebas, límites y condiciones de interrupción.
5. Produce el resultado autorizado de la skill seleccionada.
6. Revisa evidencia, privacidad y consistencia documental.
7. Ejecuta acciones externas únicamente con autorización explícita aplicable.
8. Cierra con resultado, archivos, pruebas, riesgos y pendientes.

## Artefactos y aceptación

Usa [ADR](../templates/ADR.md) para decisiones,
[FINDING](../templates/FINDING.md) para hallazgos
y [EXCEPTION](../templates/EXCEPTION.md) para desviaciones justificadas.
Una plantilla vacía no acredita ejecución.
Referencias y hashes deben corresponder al resultado final real.

Aceptar una tarea exige evidencia proporcional al tipo de cambio.
Una auditoría mantiene el destino intacto.
Una implementación demuestra comportamiento y regresión.
Una release identifica commit, artefacto y entorno verificados.
Un incidente demuestra recuperación y controles de salida.

## Agentes que ejecutan las skills

Cada skill puede ejecutarla el orquestador directamente o repartirla entre los [agentes EOS](../agents/README.md).
INIT y MIGRATE suelen activar planner, architect, tdd-guide, implementer y revisores.
ADOPT empieza con migration-archaeologist y tdd-guide; AUDIT usa solo revisores en lectura.
RELEASE usa qa-verifier y release-manager; INCIDENT usa incident-commander.
En Claude Code estas skills se cargan desde el plugin `eos-agents`; en Codex se instalan en `.agents/skills/`.

## Fallos y continuidad

Continúa las tareas independientes cuando falte una entrada secundaria.
Detén la operación dependiente si faltan permisos, integridad o recuperación.
Informa qué está bloqueado y qué evidencia lo resolvería.
No conviertas un fallo de herramienta en resultado aprobado.
El procedimiento sirve al objetivo del usuario; no sustituye su autoridad.

**Firma editorial:** Pierre R. Boss · oprbguitar.

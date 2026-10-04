---
name: eos-init
description: Crear un producto con perfil, capacidades justificadas, arquitectura y evidencia proporcional al alcance autorizado.
---

# EOS INIT

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Trigger

Usa esta skill al iniciar software nuevo o una capacidad nueva aislada.
Un repositorio existente normalmente requiere ADOPT antes de cambios mayores.
Lee [EOS-CORE](../../EOS-CORE.md); abre la [constitución](../../EOS_MASTER_SYSTEM_INSTRUCTION.md) solo en las secciones que indique
y las instrucciones locales del destino.

## Entradas

- Problema, usuarios y tareas prioritarias.
- Criticidad, países y datos tratados.
- Plataforma, operación offline y restricciones.
- Recursos disponibles y presupuesto.
- Alcance de implementación y publicación.
- Identidad existente y criterios de aceptación.

## Alcance y roles

Inspección y diseño pueden avanzar sin desplegar.
Implementa solo cuando forme parte del encargo.
Si el usuario pide únicamente arquitectura, conserva esa fase documental.
Planificación, arquitectura, pruebas y seguridad necesitan responsables.
Usa agentes disponibles; si faltan, asume roles secuencialmente
y declara el límite de independencia.
No inventes equipos ni permisos.

## Pasos ordenados

1. Comprueba entorno, instrucciones y archivos existentes.
   Conserva trabajo ajeno y detecta dependencias reales.

2. Completa [PROJECT-PROFILE](../../templates/PROJECT-PROFILE.md).
   Registra hipótesis y datos pendientes sin inventar métricas.

3. Completa [CAPABILITY-MATRIX](../../templates/CAPABILITY-MATRIX.md).
   Mantén capacidades especializadas dormidas hasta justificar activación.
   Pagos, sincronización y almacenamiento avanzado son condicionales.

4. Define límites y arquitectura mínima mantenible.
   Registra decisiones en [ADR](../../templates/ADR.md).
   Evalúa alternativas con evidencia; no impongas Docker ni microservicios.

5. Conserva AI Integration Port conceptualmente disponible.
   Sigue [AI-GATEWAY](../../docs/manuals/AI-GATEWAY.md).
   IA dormida no descarga modelos, abre cuentas ni inicia gasto.
   Evalúa RAM, VRAM, privacidad y licencias antes de activarla.

6. Crea [TASK-PACKET](../../templates/TASK-PACKET.md).
   Asigna archivos, pruebas, dependencias y operaciones autorizadas.
   Para frontend aplica la dirección visual exigida por el destino.

7. Escribe pruebas de comportamiento antes de implementación pertinente.
   Construye incrementos pequeños; valida entradas y errores.
   Revisa calidad y seguridad después de cambios.

8. Verifica flujos críticos, configuración y recursos reales.
   Usa [ENGINEERING-QUALITY](../../docs/manuals/ENGINEERING-QUALITY.md).
   Documenta uso y operación en la estructura existente.

## Artefactos

- Perfil y matriz con estados honestos.
- Decisiones, paquete de tarea y código autorizado.
- Pruebas ejecutadas y resultados reproducibles.
- Documentación de arranque y pendientes.
- Evaluación normativa cuando el dominio lo requiera.

## Aceptación

Demuestra el flujo principal y casos negativos relevantes.
Comprueba acceso, validación y privacidad según criticidad.
La cobertura exigida por el destino acompaña pruebas útiles.
Declara capacidades propuestas que todavía no están implementadas.
Otro operador debe poder iniciar el producto siguiendo instrucciones.

## Fallos y autorización

Detén activación si faltan recursos, procedencia o permiso esencial.
Continúa diseño y pruebas independientes con supuestos etiquetados.
Publicar, contratar servicios o desplegar requiere autorización explícita.
Honra permisos ya concedidos dentro de su alcance.
No instales herramientas globales ni servicios por comodidad.

**Firma editorial:** Pierre R. Boss · oprbguitar.

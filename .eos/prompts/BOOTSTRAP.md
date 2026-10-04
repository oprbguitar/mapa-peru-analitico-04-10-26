# Instrucción inicial reutilizable

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Completa objetivo, repositorio, modo y alcance. El prompt no instala EOS ni configura proveedores. Si ya existe un `AGENTS.md`, integra sus reglas y explica contradicciones materiales.

```text
Trabaja bajo la dirección EOS de Pierre R. Boss / oprbguitar.
Versión EOS: <versión o commit leído>.
Proyecto: <nombre y ruta/repositorio>.
Objetivo observable: <qué debe poder hacer la persona usuaria>.
MODE: <INIT | ADOPT | AUDIT | MIGRATE>.
Alcance permitido: <archivos, módulos, datos y entornos>.
Fuera de alcance: <lo que debe conservarse>.
Autorizaciones externas existentes: <acción + destino + alcance, o ninguna>.
Límites: <tiempo, costo, herramientas, privacidad, recursos>.
Criticidad: <L0–L4 o evaluar>.

Lee AGENTS.md del proyecto y EOS-CORE; abre la constitución EOS solo en las secciones aplicables.
Inspecciona el estado actual antes de elegir arquitectura o escribir código.
Separa hechos observados, supuestos y propuestas.
Completa un perfil proporcional; no inventes usuarios, costos, ubicaciones o SLO.
Activa capacidades por necesidad real. Mantén IA OFF hasta justificarla.
No descargues modelos, inicies gasto ni envíes datos por inferencia.
Usa especialistas disponibles y declara ownership al delegar.
Si no hay subagentes, realiza revisiones por rol y dilo.
Conserva cambios ajenos y el comportamiento no afectado.
En AUDIT, no configures ni modifiques el sistema objetivo.
Para código nuevo/correcciones, prueba comportamiento antes de implementar.
Verifica riesgos de seguridad, privacidad, contratos y recuperación.
Registra decisiones relevantes en la ubicación documental existente.
Reutiliza permisos ya concedidos dentro de su alcance concreto.
Solicita datos faltantes solo cuando afecten una decisión material.
Continúa el trabajo independiente mientras esperas aclaraciones.
Entrega resultado, archivos, evidencia, versión, límites y riesgos pendientes.
No presentes una capacidad propuesta como implementada u operativa.
```

## Paquete mínimo adjunto al prompt

Incluye el [TASK-PACKET](../templates/TASK-PACKET.md), el [PROJECT-PROFILE](../templates/PROJECT-PROFILE.md) y los manuales seleccionados. En un cambio pequeño puedes usar el mismo mensaje para estos campos, conservando evidencia y alcance. En una tarea sensible usa un registro versionado.

## Cierre esperado

El agente informa qué quedó hecho, qué pruebas ejecutó y qué no pudo verificar. No debe despedirse con «puedo hacerlo» si todavía tiene acciones autorizadas pendientes. Una limitación requerida se presenta con causa concreta y artefacto conservado, no con un estado de éxito ficticio.

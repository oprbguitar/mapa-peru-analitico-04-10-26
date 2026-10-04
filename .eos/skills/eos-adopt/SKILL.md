---
name: eos-adopt
description: Adoptar software existente mediante arqueología, baseline y mejoras acotadas que preserven datos y comportamiento.
---

# EOS ADOPT

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Trigger

Usa esta skill para entender y mantener un sistema existente.
También sirve antes de corregir un fallo en software desconocido.
Lee [EOS-CORE](../../EOS-CORE.md); abre la [constitución](../../EOS_MASTER_SYSTEM_INSTRUCTION.md) solo en las secciones que indique.
La regla central es comprender y preservar antes de reemplazar.

## Entradas

- Repositorio y entorno operativo.
- Problema observado y alcance autorizado.
- Datos, configuraciones y fuentes privadas.
- Pruebas, historial y decisiones existentes.
- Restricciones de operación y equipo receptor.
- Permisos externos concedidos.

## Alcance y roles

La arqueología inicial es de lectura.
Adoptar no autoriza automáticamente reescritura o migración.
El encargo determina qué correcciones pueden prepararse.
Asigna exploración, arquitectura, caracterización y revisión.
Invoca agentes reales disponibles con ownership explícito.
Si faltan, revisa secuencialmente y declara independencia limitada.

## Pasos ordenados

1. Revisa instrucciones, estado Git y archivos ignorados relevantes.
   Conserva cambios locales y datos fuera del control de versiones.
   No uses reset, clean ni stash automático.

2. Reconstruye arranque, módulos y dependencias.
   Identifica fuentes de verdad, flujos y efectos externos.
   Diferencia implementación, documentación histórica y supuestos.

3. Completa [PROJECT-PROFILE](../../templates/PROJECT-PROFILE.md).
   Registra tecnología desplegada, recursos y criticidad reales.
   Marca vacíos sin rellenarlos con una arquitectura idealizada.

4. Captura baseline de funciones, pruebas y rendimiento relevante.
   Reproduce el fallo antes de modificar.
   No repitas acciones financieras o comunicaciones en producción.

5. Registra brechas en [FINDING](../../templates/FINDING.md).
   Ordena por impacto, evidencia y dependencia.
   No conviertas preferencias tecnológicas en defectos.

6. Define [TASK-PACKET](../../templates/TASK-PACKET.md).
   Limita archivos y cambios al objetivo del usuario.
   Registra decisiones nuevas en [ADR](../../templates/ADR.md).

7. Añade caracterización y pruebas negativas relevantes.
   Corrige progresivamente en rama cuando corresponda.
   Mantén interfaces y datos hasta justificar cambios incompatibles.

8. Revisa regresión, seguridad y documentación.
   Sigue [ENGINEERING-QUALITY](../../docs/manuals/ENGINEERING-QUALITY.md)
   y [UPDATES-RELIABILITY](../../docs/manuals/UPDATES-RELIABILITY.md).
   Separa resultados comprobados de operación pendiente.

## Artefactos

- Mapa del sistema y línea base reproducible.
- Perfil, hallazgos y decisiones.
- Pruebas de caracterización y corrección autorizada.
- Instrucciones reales de uso y recuperación.
- Pendientes con propietario y siguiente paso.

## Aceptación

El comportamiento anterior sigue funcionando donde debía preservarse.
El fallo autorizado tiene prueba y resultado verificable.
No hay cambios ajenos, secretos publicados ni datos reemplazados.
Los accesos y contratos afectados tienen revisión pertinente.
Otro operador puede reproducir la baseline y el cambio.

## Fallos y autorización

Si no puedes reproducir, conserva evidencia y reduce incertidumbre.
Continúa documentación o pruebas independientes sin declarar corrección.
Detén cambios que excedan alcance o amenacen datos desconocidos.
Publicar, migrar producción y cambiar recursos externos necesitan
autorización explícita aplicable; honra la ya concedida.
No instalar herramientas globales ni alterar políticas para adoptar.

**Firma editorial:** Pierre R. Boss · oprbguitar.

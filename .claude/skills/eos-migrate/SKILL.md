---
name: eos-migrate
description: Cambiar tecnología, proveedor o esquema mediante equivalencia, coexistencia controlada y recuperación verificable.
---

# EOS MIGRATE

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Trigger

Usa esta skill para migrar plataforma, lenguaje, base o proveedor.
Lee [EOS-CORE](../../../.eos/EOS-CORE.md); abre la [constitución](../../../.eos/EOS_MASTER_SYSTEM_INSTRUCTION.md) solo en las secciones que indique.
Una preferencia tecnológica no basta para justificar la migración.
Requiere problema, evidencia y criterio de éxito.

## Entradas

- Baseline y arquitectura existentes.
- Motivo medido y alternativas.
- Volumen, sensibilidad y calidad de datos.
- Efectos externos y contratos.
- Compatibilidad, downtime y presupuesto tolerados.
- Autorización de pruebas y transición real.

## Alcance y roles

Preparar migración no autoriza ejecutarla en producción.
Asigna arquitectura, datos, equivalencia, seguridad y operación.
Invoca especialistas disponibles con archivos y responsabilidades claros.
Si faltan, realiza revisiones secuenciales y declara esa limitación.
Protege trabajo ajeno, originales y configuración local.

## Pasos ordenados

1. Ejecuta arqueología y baseline de ADOPT.
   Identifica fuentes de verdad, contratos y dependencias ocultas.

2. Formula hipótesis y [ADR](../../../.eos/templates/ADR.md).
   Compara mejora esperada con costo, riesgo y salida.
   Incluye alternativa de optimizar sin migrar.

3. Completa [TASK-PACKET](../../../.eos/templates/TASK-PACKET.md).
   Define ownership, secuencia, checkpoints y pruebas.
   Clasifica operaciones reversibles e irreversibles.

4. Define equivalencia funcional y de datos.
   Comparte corpus representativo permitido y reglas de comparación.
   Documenta diferencias intencionales y tolerancias justificadas.

5. Construye transición expand-contract.
   Sigue [UPDATES-RELIABILITY](../../../.eos/docs/manuals/UPDATES-RELIABILITY.md).
   Mantén compatibilidad durante convivencia definida.

6. Ejecuta shadow aislado cuando resulte útil.
   Bloquea cobros, correos, notificaciones y escrituras reales.
   No envíes tráfico sensible a destinos no aprobados.
   Compara resultados sin duplicar efectos del sistema original.

7. Ensaya migración y restore en entorno separado.
   Usa [STORAGE-DATA](../../../.eos/docs/manuals/STORAGE-DATA.md).
   Mide duración, espacio, consistencia y errores.

8. Prepara corte, observación y retorno.
   Reconciliar efectos externos precede cualquier restauración antigua.
   Para dinero aplica [PAYMENTS](../../../.eos/docs/manuals/PAYMENTS.md).
   La reversión de código no borra asientos históricos.

9. Ejecuta transición solo con autorización aplicable.
   Verifica versión, flujos y datos del destino real.
   Retira sistema anterior después de cumplir salida definida.

## Artefactos

- Baseline, ADR y plan de equivalencia.
- Scripts o adaptadores autorizados.
- Evidencia de shadow y migración ensayada.
- Runbook de corte y recuperación.
- [HANDOFF-CHECKLIST](../../../.eos/templates/HANDOFF-CHECKLIST.md).

## Aceptación

Las invariantes y funciones críticas se conservan o cambian con aprobación.
Las diferencias tienen explicación y evidencia.
No hubo efectos externos duplicados ni datos privados filtrados.
La recuperación se probó con versión y esquema compatibles.
Otro operador puede ejecutar los pasos documentados.

## Fallos y autorización

Detén corte ante divergencia, capacidad insuficiente o restore fallido.
Continúa análisis y ensayos independientes sin mover producción.
No uses resets, limpieza destructiva o apagado ajeno como atajo.
Cambios externos necesitan autorización explícita; reutiliza la vigente
dentro de su alcance, sin concederte permisos adicionales.

**Firma editorial:** Pierre R. Boss · oprbguitar.

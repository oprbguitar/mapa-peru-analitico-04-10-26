---
name: eos-incident
description: Responder a incidentes con contención proporcional, autorizaciones acotadas, recuperación comprobada y postmortem.
---

# EOS INCIDENT

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## Trigger

Usa esta skill ante degradación, abuso, exposición o pérdida de servicio.
Lee [EOS-CORE](../../EOS-CORE.md); abre la [constitución](../../EOS_MASTER_SYSTEM_INSTRUCTION.md) solo en las secciones que indique
y [INCIDENT-RESPONSE](../../docs/manuals/INCIDENT-RESPONSE.md).
La urgencia no crea permisos extraordinarios.

## Entradas

- Señal inicial y hora conocida.
- Servicio, entorno y usuarios afectados.
- Evidencia disponible y sensibilidad.
- Runbooks y políticas de respuesta existentes.
- Autorizaciones, límites y responsables.
- Recuperación prevista, RPO y RTO aplicables.

## Alcance y roles

Asigna coordinación, investigación, seguridad y recuperación.
Usa agentes disponibles con accesos mínimos.
Si faltan especialistas, declara revisión propia y escala límites.
Las acciones preautorizadas siguen su política y condiciones.
No inventes poderes de emergencia ni aprobación de terceros.
Comunicaciones externas requieren autorización específica aplicable.

## Pasos ordenados

1. Valida señal y registra baseline del incidente.
   Diferencia hecho, sospecha y falso positivo.
   Completa [INCIDENT-RECORD](../../templates/INCIDENT-RECORD.md).

2. Identifica impacto, criticidad y objetivo inmediato.
   Preserva evidencia sin copiar datos sensibles innecesarios.
   Registra cronología, actor, acción y resultado.

3. Comprueba alcance autorizado y políticas vigentes.
   Define responsable, presupuesto y operaciones permitidas.
   Detén acciones fuera de ese marco.

4. Contén mediante medidas proporcionales y reversibles.
   Limita tráfico, sesiones o componentes afectados según evidencia.
   Evita bloquear a todos los usuarios por una única IP.
   Cada control temporal necesita TTL, propietario y revisión.

5. Verifica eficacia y efectos sobre usuarios legítimos.
   Registra estado anterior y condición de salida.
   TTL no significa reabrir a ciegas una amenaza persistente.
   Al vencer, revisa riesgo y retira o extiende mediante política.

6. Investiga causa y ruta de recuperación.
   Sigue [SECURITY-FABRIC](../../docs/manuals/SECURITY-FABRIC.md).
   No borres evidencia ni modifiques asientos para aparentar solución.

7. Recupera funciones esenciales con procedimiento aprobado.
   Consulta [STORAGE-DATA](../../docs/manuals/STORAGE-DATA.md)
   y [UPDATES-RELIABILITY](../../docs/manuals/UPDATES-RELIABILITY.md).
   Reconcilia efectos externos antes de restauraciones antiguas.

8. Verifica servicio, identidad, datos y controles.
   Observa durante ventana definida y conserva pendientes.
   No cierres por desaparición momentánea de una alerta.

9. Produce postmortem y acciones preventivas.
   Distingue causa, factores contribuyentes y límites conocidos.
   Asigna propietario, fecha y prueba de eficacia.

## Artefactos

- Registro del incidente y cronología.
- Evidencia sanitizada y controles temporales.
- Recuperación, verificación y riesgos residuales.
- Acciones y pruebas de prevención.
- Comunicación autorizada cuando corresponda.

## Aceptación

El servicio esencial funciona según criterios medibles.
Las medidas temporales tienen revisión y salida controlada.
No hay reapertura automática sin evaluar riesgo persistente.
Los datos y efectos financieros conservan trazabilidad.
El cierre declara pérdidas, incertidumbre y obligaciones pendientes.

## Fallos y autorización

Continúa investigación independiente si una herramienta falla.
Detén acciones destructivas, no íntegramente autorizadas o sin recuperación.
Honra permisos explícitos previos dentro de su alcance.
Escala operaciones nuevas con evidencia y consecuencias concretas.
No ocultes incidentes ni fabriques resultados para cerrar el registro.

**Firma editorial:** Pierre R. Boss · oprbguitar.

# Incident Response: contener, recuperar y aprender con evidencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**
**Edición:** 3.0.0 · 2026-10-03 · **Idioma:** español de Perú · **Naturaleza:** instrucciones personales de ingeniería, runbooks y contratos de respuesta.

Este manual desarrolla [la constitución maestra](../../EOS_MASTER_SYSTEM_INSTRUCTION.md), secciones 3, 15–28, 32, 40–42, 60–61 y 64. Procede de **SRC-01**, especialmente los bloques históricos 203–219 y 221–222. La configuración preventiva corresponde a [Security Fabric](SECURITY-FABRIC.md). Los números históricos no reemplazan la numeración vigente de la constitución.

**Estado verificable:** aquí se especifica cómo debería funcionar una respuesta. No se afirma que exista un centro operativo, detección desplegada, automatización, personal de guardia o restauración probada. Cada proyecto debe completar contactos, permisos, capacidades, tiempos y evidencias antes de presentar estos runbooks como operativos. Los ejemplos son ejercicios de diseño y no incidentes reales.

## 1. Mi mandato durante un incidente

Quiero recuperar el servicio sin perder la verdad de lo ocurrido. La primera obligación es reducir daño con decisiones acotadas; la segunda, preservar evidencia y explicar lo que sabemos. No acepto un cierre basado en «parece normal», ocultar una afectación ni borrar registros para limpiar el problema.

Un incidente combina disponibilidad, integridad, confidencialidad y confianza. Se puede restablecer una página mientras las credenciales siguen comprometidas. También se puede detener un ataque bloqueando a todos los usuarios. Ninguno de esos resultados satisface recuperación completa.

El operador nombra un responsable, delimita recursos y registra acciones. La IA ayuda a correlacionar y redactar, pero no se transforma en autoridad ilimitada. Toda decisión conserva motivo, autorización, resultado esperado y condición de reversión. Si falta capacidad, se declara y se solicita el recurso concreto; no se inventa una defensa funcionando.

## 2. Preparación y entradas obligatorias

Antes del incidente se necesita un inventario con dueños, servicios esenciales, dependencias, ambientes, accesos administrativos y rutas de escalamiento. La ficha incluye objetivos de recuperación acordados, backups, restauración, observabilidad, herramientas realmente disponibles y política de comunicación. Los contactos operativos se guardan en un canal controlado; no se publican teléfonos privados ni secretos en Git.

La entrada de un caso contiene alerta, fuente, período, ambiente, síntomas, usuarios potencialmente afectados y calidad de la señal. El operador contrasta al menos disponibilidad y métricas técnicas cuando sea posible. Alertas duplicadas se correlacionan con el mismo incidente; no crean autorizaciones repetidas ni multiplican contenciones.

La salida mínima comprende registro del incidente, clasificación, decisión de estado, evidencia restringida, acciones ejecutadas, validación de recuperación, incertidumbres y tareas de prevención. Un caso descartado conserva la razón y la evidencia que contradijo la hipótesis. No se convierte en «ataque confirmado» únicamente porque una herramienta usó ese rótulo.

## 3. Responsabilidades y coordinación

| Responsabilidad | Decisión y salida |
|---|---|
| Responsable del incidente | Prioridades, alcance, estado y continuidad del registro |
| Operador técnico | Ejecutar pasos permitidos y comprobar resultados |
| Security Auditor | Correlacionar evidencias, revisar contención y acceso |
| Propietario del servicio | Identificar flujos esenciales y validar recuperación |
| Responsable de datos | Determinar clases de información y preservar restricciones |
| Responsable de comunicación | Preparar mensajes verificados y obtener autorización requerida |

Una persona puede asumir varias responsabilidades en un proyecto pequeño, pero las decisiones no desaparecen. Los relevos entregan situación, acciones activas, vencimientos y siguiente decisión. Las herramientas de colaboración deben estar disponibles sin depender del servicio afectado.

Cada operador anuncia el recurso que modifica. Se evita que dos personas reviertan mutuamente reglas o roten una misma credencial sin coordinación. El responsable limita cambios paralelos cuando impiden atribuir efectos, manteniendo tareas independientes como análisis y validación.

## 4. Severidad, confianza y modos

Severidad mide impacto; confianza mide certeza. Un servicio crítico caído puede ser un incidente severo con causa todavía desconocida. Un intento inequívoco rechazado puede tener confianza alta y escaso impacto. Ambas dimensiones quedan separadas de la respuesta.

Este runbook usa cuatro estados canónicos: `normal`, `elevated`, `under_attack` y `lockdown`. El valor `HIGH` listado en la sección 27 de la constitución se interpreta como subnivel de `elevated` y se conserva en `legacy_label` si existe una interfaz previa. Esta correspondencia documental no migra software por sí sola.

| Estado | Evidencia de entrada | Respuesta permitida | Evidencia de salida |
|---|---|---|---|
| `normal` | Sin degradación atribuible activa | Controles basales y observación | Anomalía validada para elevar |
| `elevated` | Desviación o alerta que necesita investigación | Más observación y medidas reversibles acotadas | Hipótesis descartada o abuso confirmado |
| `under_attack` | Abuso corroborado o compromiso confirmado con alcance identificable | Contención del vector dentro de autorización | Ataque reducido y verificación de recuperación |
| `lockdown` | Compromiso grave o contención anterior insuficiente | Aislar alcance crítico y mantener servicios esenciales seguros | Integridad, identidad y restauración verificadas |

Una transición directa a lockdown puede justificarse por compromiso confirmado. No se requiere esperar una secuencia artificial mientras continúa el daño. La evidencia y autoridad siguen siendo obligatorias.

## 5. Transiciones con contrato verificable

Cada cambio de estado produce `transition_id`, estado anterior, estado nuevo, evidencia, ambiente, alcance, actor, regla, autorización, TTL, acciones y recuperación prevista. La operación es idempotente: repetir una alerta no instala varias reglas equivalentes.

`normal → elevated` utiliza desviación contra baseline o alerta verificable y registra explicaciones alternativas. `elevated → under_attack` requiere señales que sustenten abuso, no solamente incremento de tráfico. `under_attack → lockdown` identifica qué daño continúa y por qué una medida menos restrictiva no basta. Toda reducción de estado depende de pruebas de servicio y seguridad.

La política se evalúa con versión concreta y reloj confiable. Si falta evidencia o autoridad, se realiza observación permitida y se prepara la decisión pendiente. Un modelo no modifica estados mediante lenguaje libre; propone una transición estructurada que un motor autorizado valida.

**Aceptación:** alerta incompleta no causa un bloqueo global; evento repetido no duplica cambios; dos actualizaciones concurrentes no pierden estado; una transición rechazada deja razón auditable; renovar un TTL requiere nueva decisión, evitando renovación infinita silenciosa.

## 6. Autorización existente y respuesta automática

La sección 3 de la constitución distingue cambios seguros, cambios en rama y operaciones sensibles. La autorización directa del usuario puede existir antes del incidente. Se verifica acción, entorno, recurso, período y límites; si cubre el paso concreto, no se pide lo mismo otra vez. Una aprobación para publicar documentación no autoriza cambiar un firewall, revocar usuarios ni enviar datos a terceros.

Una política aprobada puede delegar contención automática con condiciones precisas. Esa delegación se registra como autoridad efectiva; «emergencia» o «alta confianza» no crea permiso por sí sola. Sin cobertura, el operador prepara el cambio revisable y mantiene acciones ya permitidas.

El motor automático tiene lista cerrada de acciones, alcance máximo, duración, presupuesto, límite de repeticiones y kill switch. No borra datos, no elimina auditoría, no modifica pagos ni desactiva autenticación para mejorar disponibilidad. Una regla de desafío por endpoint no se convierte en bloqueo de país completo.

Las comunicaciones externas, cambios de credenciales, despliegues y aislamiento severo se realizan con autorización aplicable. Se registra evidencia de esa autorización sin copiar conversaciones privadas completas. Si falta, la solicitud deberá explicar la operación concreta y su impacto; el resto del análisis continúa.

## 7. TTL, reversión y vencimiento seguro

Toda contención temporal guarda configuración anterior, identificador del cambio, inicio, expiración y procedimiento de rollback. Los bloqueos de tráfico tienen límites que evitan castigar indefinidamente a usuarios legítimos. Expirar una medida no significa declarar resuelto el caso.

El vencimiento depende del tipo de control. Una regla temporal de rate limiting puede volver a la política base aprobada; el aislamiento de un componente comprometido no se levanta automáticamente solo porque pasó tiempo. En ese caso el TTL exige revisión y escalamiento, manteniendo el estado seguro previamente autorizado hasta que se verifique recuperación. Esa distinción se define antes de activar la medida.

**Ejemplo ilustrativo**, sujeto a aprobación y calibración:

```yaml
example_only: true
response_policy:
  observation_review_minutes: 10
  temporary_endpoint_rule_minutes: 15
  maximum_automatic_renewals: 1
  traffic_rule_expiry: restore_approved_baseline
  compromised_workload_expiry: require_recovery_review
  maximum_scope: one_service_one_environment
```

Si el controlador deja de funcionar, un watchdog independiente observa medidas vencidas. La prueba simula esa pérdida y comprueba que no se habilita un recurso inseguro ni queda un bloqueo temporal sin revisión.

## 8. Registro y preservación de evidencia

El expediente contiene cronología con zona horaria, deployment, fuentes, hechos, hipótesis, decisiones y efectos. Se registra UTC para correlación y se presenta hora de Perú cuando ayude al operador. Desfase de relojes y lag del colector se documentan antes de reconstruir una secuencia.

Los artefactos se preservan con identificador, hash, origen, momento, recolector, acceso y ubicación restringida. Un hash permite detectar cambios; no prueba por sí mismo autenticidad ni integridad completa del sistema. Se conserva la herramienta y método de obtención. La contención urgente puede preceder a una captura si el daño continúa; se explica lo que pudo perderse.

No se vuelcan contraseñas, bearer tokens, cookies o claves en tickets, capturas públicas o postmortems. Se utilizan referencias no reutilizables y material redactado. La evidencia sensible requiere acceso mínimo, almacenamiento cifrado y retención definida. OWASP documenta restricciones de datos y protección de logs. [Referencia primaria](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

**Aceptación:** un operador sin permisos no accede al expediente; una muestra no contiene secretos; se detecta alteración del artefacto; un fallo de ingestión queda visible y no borra el historial previo.

## 9. Playbook DDoS y abuso de recursos

**Disparadores:** saturación, incremento anormal de rutas costosas, errores o alertas de edge. **Entrada:** volumen, latencia, consumo, baseline, evento comercial conocido y cobertura upstream. **Salida:** vector acotado, control aplicado, impacto legítimo medido y recuperación.

1. Confirmar ambiente y revisar si existe campaña, despliegue fallido o proveedor caído. Comparar conversiones válidas y operaciones terminadas con solicitudes recibidas.
2. Identificar si el problema es enlace, conexiones o trabajo de aplicación. Un ataque volumétrico requiere proveedor upstream; no se intenta absorberlo sumando servidores indefinidamente.
3. Verificar protección del origen y ausencia de bypass antes de confiar en reglas de borde. Conservar el acceso operativo independiente.
4. Activar únicamente controles preautorizados para el vector: rate limiting, desafío o filtro específico. Registrar identificador, TTL y cohorte afectada.
5. Aumentar caché solo para contenido que pueda compartirse de manera segura. No cachear respuestas privadas ni ignorar parámetros funcionales sin prueba.
6. Medir errores, usuarios válidos, colas y costo. Escalar demanda legítima dentro del presupuesto aprobado.
7. Retirar gradualmente medidas temporales cuando cumplan salida; observar recurrencia y conservar evidencia.

Cloudflare recomienda origen protegido y caché dentro de una estrategia de defensa; no garantiza que cualquier configuración cubra todos los servicios. [Referencia primaria](https://developers.cloudflare.com/ddos-protection/best-practices/proactive-defense/).

**Aceptación del ejercicio:** campaña legítima conserva navegación; el abuso sintético limitado consume menos origen; el presupuesto no se desborda; una regla no afecta inesperadamente APIs automáticas; la reversión restaura la configuración base.

## 10. Playbook ataque de cuentas y sesiones

**Disparadores:** fallos distribuidos, recuperación anómala, sesión revocada reutilizada o acción sensible inesperada. **Entrada:** eventos seudonimizados, dimensiones de cuota, método de autenticación y historial pertinente. **Salida:** cuentas afectadas delimitadas, acceso legítimo protegido y credenciales revisadas.

1. Diferenciar intento rechazado, acceso sospechoso y compromiso confirmado. No usar geolocalización o VPN como prueba concluyente.
2. Verificar que existan buckets independientes por cuenta y por fuente confiable. Si se detecta bypass, corregir la frontera mediante cambio autorizado.
3. Aplicar demoras, desafío o step-up acotados. No permitir que fallos provocados bloqueen permanentemente a la víctima.
4. Ante compromiso confirmado, revocar sesiones y mecanismos relevantes bajo autorización; verificar también refresh tokens y persistencia de acceso.
5. Proteger recuperación: validación adicional, enlaces de uso único, expiración y rechazo de repetición. No enviar secretos por canales inseguros.
6. Revisar cambios de permisos, integraciones, exports y acciones de negocio realizados durante el período afectado.
7. Validar acceso del titular por un camino confiable y monitorear recurrencia; documentar qué sesiones permanecen válidas y por qué.

OWASP trata renovación y revocación de sesión como parte de su ciclo; la implementación debe demostrar su efecto real. [Referencia primaria](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

**Aceptación:** un token revocado falla en la API; la recuperación no revela existencia de cuentas; el titular no queda sin salida; el registro no conserva contraseñas intentadas ni sus huellas.

## 11. Playbook código malicioso y suministro

**Disparadores:** binario inesperado, dependencia comprometida, escritura no autorizada o actividad de red corroborada. **Entrada:** versión, procedencia, runtime, rutas afectadas y exposición. **Salida:** ejecución contenida, alcance investigado y reconstrucción confiable.

1. Delimitar componente y detener ejecución dañina con el mecanismo autorizado. Evitar propagar artefactos o trabajar desde un host que pueda capturar credenciales nuevas.
2. Preservar logs y metadatos relevantes. No ejecutar un archivo sospechoso para «ver qué hace» en la máquina operativa.
3. Identificar entrada probable: paquete, imagen, CI, extensión, archivo cargado o credencial. Separar hechos de hipótesis.
4. Buscar otros ambientes que compartan componente o identidad. Suspender distribución del artefacto comprometido con alcance concreto.
5. Rotar credenciales afectadas desde un entorno confiable, coordinar consumidores y comprobar revocación. No rotar indiscriminadamente sin conocer dependencias.
6. Reconstruir desde fuentes verificadas, pipeline limpio y dependencias revisadas. Un reinicio o antivirus sin alertas no acredita erradicación.
7. Probar integridad, permisos, salidas de red y flujos esenciales antes del retorno gradual.

La revisión de suministro incluye artefactos y pipeline, conforme a riesgos descritos por OWASP. [Referencia primaria](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html).

**Aceptación:** la versión comprometida no se redepliega; secretos anteriores dejan de funcionar; el artefacto restaurado tiene procedencia verificable; el rollback no reintroduce la causa.

## 12. Playbook agente comprometido

**Disparadores:** llamada fuera de scope, instrucciones externas obedecidas, destino no autorizado o modificación inesperada. **Entrada:** identidad, tarea, permisos, llamadas, diff y destinos. **Salida:** ejecución detenida, permisos revocados, efectos inspeccionados y tarea reanudable de forma segura.

1. Detener agente y workers asociados; cancelar colas y reintentos. Conservar task ID y momento efectivo de detención.
2. Revocar herramientas, credenciales y delegaciones relacionadas. El kill switch debe operar fuera de la conversación del agente.
3. Restringir egress autorizado para contención. Verificar llamadas en curso y transferencias terminadas; una cancelación no recupera información enviada.
4. Revisar archivos, publicaciones, cambios de configuración y datos afectados. Comparar contra versión conocida; preservar trabajo legítimo de otros colaboradores.
5. Identificar la frontera vulnerada: inyección indirecta, permisos excesivos, validador defectuoso o token reutilizado. No limitar la solución a añadir una frase al prompt.
6. Restaurar cambios concretos y renovar identidad cuando corresponda. Revalidar permisos con llamadas negativas antes de reanudar.
7. Reiniciar con tarea delimitada y observar. No darle nuevamente acceso total para completar más rápido.

OWASP recomienda validar llamadas y limitar privilegios en agentes con herramientas. [Referencia primaria](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

**Aceptación:** el agente detenido no ejecuta una llamada adicional ni reinicia por cola; el documento hostil no cambia su autoridad; la función esencial conserva el fallback previsto.

## 13. Restauración y retorno al servicio

La restauración comienza con un punto conocido, no necesariamente el backup más reciente. Se evalúa si contiene corrupción, datos maliciosos o credenciales comprometidas. El entorno de prueba permanece separado y conserva restricciones de datos. Se prueba integridad lógica, acceso, autorización y operaciones esenciales.

El responsable registra RTO observado y pérdida real comparados con objetivos acordados, sin inventar cifras. Para escrituras posteriores al backup se define conciliación y riesgo de duplicados. Operaciones económicas o datos de producción no se editan arbitrariamente para «cuadrar» resultados.

El retorno es gradual: componente, cohorte y flujo. Se revisan alarmas, métricas de negocio y seguridad junto con el rollback preparado. Si reaparece el vector, se contiene de nuevo bajo la misma política vigente o una autorización ampliada; no se ignora porque el servicio ya volvió.

**Criterio de recuperación:** disponibilidad aceptable, vector contenido, permisos y sesiones coherentes, datos revisados, reglas temporales gestionadas y monitoreo activo. Las incertidumbres restantes tienen responsable y plazo. Restaurar servicio y cerrar investigación son decisiones distintas.

## 14. Comunicación y cierre responsable

El mensaje de estado explica qué servicio está afectado, desde cuándo, qué se conoce y qué acción necesita el usuario. No acusa personas ni publica hipótesis como hechos. No promete una hora de recuperación sin sustento. Se indica próxima revisión cuando esté acordada.

El análisis de obligaciones de notificación depende de datos, contrato y jurisdicción. Se deriva al responsable competente; este manual no inventa plazos legales ni certifica cumplimiento. Preparar un borrador no equivale a enviarlo: la transmisión externa requiere autorización aplicable y destinatarios verificados.

El cierre incluye servicios recuperados, exposición evaluada, evidencia preservada, contenciones pendientes y tareas abiertas. Un incidente puede cerrarse operativamente con investigación adicional en curso si ese alcance se explica. No se declara «sin filtración» solo por falta de una alerta; se informa qué se revisó y qué quedó sin visibilidad.

## 15. Postmortem, auditabilidad y ejercicios

El postmortem registra impacto, cronología, causa respaldada, factores contribuyentes, detección, respuesta, recuperación y acciones. Evita culpar sin análisis. Cada acción preventiva tiene propietario, plazo, prioridad y prueba de terminación; «mejorar seguridad» no es una tarea verificable.

El ledger conserva quién decidió, qué cambió, por qué, con qué autorización y resultado. Rollbacks también son eventos. Configuraciones temporales pendientes se revisan hasta retirarlas o convertirlas en políticas permanentes mediante cambio explícito. La lección se incorpora a pruebas y runbooks, no se duplica indiscriminadamente en documentos.

Los ejercicios usan datos sintéticos y entornos autorizados. Se ensayan pérdida del controlador, alerta duplicada, fallo del colector, falso positivo, token revocado, restauración y kill switch. Se mide tiempo observado y se declara qué no se probó. Una sesión de mesa valida decisiones; no acredita automáticamente que un firewall o backup funcione.

## 16. Referencias y puerta de operación

Las referencias primarias enlazadas de Cloudflare y OWASP se consultaron el **2026-10-03**. Respaldan controles concretos; los contratos, roles, modos y valores ilustrativos son diseño operativo de EOS. Antes de implementar se comprueba disponibilidad del proveedor y comportamiento del stack elegido.

Este manual está listo para adaptación cuando el proyecto complete dueños, permisos, contactos restringidos, inventario, alcance de automatización, evidencias de restauración y pruebas. Hasta entonces se presenta como runbook diseñado. Ninguna firma documental equivale a certificación de seguridad o firma criptográfica.

Referencias principales para el operador, consulta **2026-10-03**:

- [Cloudflare: Proactive DDoS defense](https://developers.cloudflare.com/ddos-protection/best-practices/proactive-defense/).
- [OWASP: Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [OWASP: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [OWASP: Software Supply Chain Security](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html).
- [OWASP: LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

---

# Parte II — Especificación 3.0.0 de respuesta a incidentes

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

La Parte I conserva los dieciséis contratos previos. Esta Parte II los desarrolla con cláusulas INC estables, playbooks adicionales, estados, fallos y aceptación. Ninguna cláusula declara que exista guardia, detección, automatización o capacidad de respuesta operativa en un proyecto concreto.

## 17. Taxonomía de incidentes

INC-1701. Un incidente es un evento que afecta o puede afectar disponibilidad, integridad, confidencialidad, dinero o confianza de los usuarios.
INC-1702. Los incidentes de disponibilidad incluyen caídas, degradación severa, saturación de recursos y fallas de dependencias críticas.
INC-1703. Los incidentes de integridad incluyen corrupción de datos, cálculos erróneos publicados y cambios no autorizados.
INC-1704. Los incidentes de confidencialidad incluyen exposición de datos, accesos indebidos y fuga de secretos.
INC-1705. Los incidentes financieros incluyen cobros duplicados, cobros no autorizados y conciliaciones con diferencias materiales.
INC-1706. Los incidentes de agentes incluyen herramientas usadas fuera de alcance, gasto desbocado e instrucciones inyectadas ejecutadas.
INC-1707. Los incidentes de suministro incluyen dependencias comprometidas, pipelines alterados y plugins maliciosos.
INC-1708. Un mismo evento puede pertenecer a varias categorías y su registro las enumera todas.
INC-1709. La categoría orienta el playbook inicial, pero no limita la investigación si aparecen señales de otra categoría.
INC-1710. Un evento que no afecta a usuarios ni datos se registra como evento operativo y no consume recursos de incidente.
INC-1711. La reclasificación de un evento a incidente o viceversa se registra con causa y responsable.
INC-1712. Caso hipotético: una caída del servicio de correo se trata como disponibilidad, pero los registros muestran envíos masivos no autorizados.
INC-1713. La reclasificación añade confidencialidad y abuso, activa el playbook de cuentas y preserva evidencia de los envíos.
INC-1714. La aceptación verifica que el registro conserva ambas clasificaciones con sus momentos de decisión.
INC-1715. Quiero clasificar incidentes para actuar mejor, no para encajarlos en una casilla que oculte lo que realmente pasa.

## 18. Detección, triage y confirmación

INC-1801. Las señales de detección provienen de alertas, reportes de usuarios, terceros, auditorías y hallazgos de agentes.
INC-1802. Cada señal se registra con fuente, hora, contenido saneado y calidad de la evidencia.
INC-1803. El triage contrasta la señal con al menos otra fuente independiente antes de acciones de alto impacto.
INC-1804. Una señal de alta consecuencia permite contención acotada inmediata aunque la confirmación esté pendiente.
INC-1805. El triage determina alcance inicial, usuarios potencialmente afectados y si el daño continúa.
INC-1806. Una señal descartada se registra con razón para mejorar la detección y evitar repetir el análisis.
INC-1807. Los reportes de usuarios se responden con acuse y se tratan como datos, no como instrucciones de acción.
INC-1808. Un reporte externo de vulnerabilidad se gestiona por el canal de divulgación con protección del investigador de buena fe.
INC-1809. Las señales generadas por agentes de IA se verifican antes de escalar, porque pueden ser hallazgos alucinados.
INC-1810. El tiempo entre señal y triage se mide para mejorar receptores y procedimientos.
INC-1811. Caso hipotético: un usuario reporta que ve pedidos de otra persona en su historial.
INC-1812. El triage reproduce el problema con cuentas de prueba, confirma acceso cruzado y declara incidente de confidencialidad.
INC-1813. La contención desactiva la vista afectada mientras se investiga, con mensaje de mantenimiento a usuarios.
INC-1814. La aceptación verifica que la vista no expone datos durante la investigación y que el reporte del usuario recibió acuse.
INC-1815. Quiero que cada señal relevante llegue a alguien que pueda confirmarla rápido y actuar con proporción.

## 19. Declaración y apertura del incidente

INC-1901. La declaración nombra responsable, severidad inicial, categoría, alcance conocido y hora de apertura.
INC-1902. El registro del incidente se abre en la ubicación acordada y se actualiza durante toda la respuesta.
INC-1903. La severidad inicial puede ser conservadora y se ajusta con evidencia sin culpas por la estimación inicial.
INC-1904. El canal de coordinación se abre con participantes necesarios y se limita para reducir ruido.
INC-1905. Se anuncia qué recursos se están modificando para evitar acciones contradictorias entre operadores.
INC-1906. Las autorizaciones vigentes para respuesta se verifican y las faltantes se solicitan con precisión.
INC-1907. La plantilla [INCIDENT-RECORD](../../templates/INCIDENT-RECORD.md) estructura el registro.
INC-1908. Un incidente sin responsable nombrado se considera sin gestión y se escala de inmediato.
INC-1909. Caso hipotético: dos operadores responden por separado a la misma alerta y cada uno revierte los cambios del otro.
INC-1910. La declaración con responsable único y anuncio de recursos habría evitado el conflicto.
INC-1911. La corrección del proceso exige declarar antes de modificar recursos productivos durante una alerta.
INC-1912. Quiero que cada incidente tenga un responsable desde el primer minuto y un registro desde la primera acción.

## 20. Roles durante la respuesta

INC-2001. El responsable del incidente decide prioridades, aprueba acciones y mantiene el registro, sin ejecutar todo personalmente.
INC-2002. El operador técnico ejecuta acciones aprobadas y reporta resultados con evidencia.
INC-2003. El investigador analiza registros y artefactos para determinar causa, alcance y cronología.
INC-2004. El responsable de comunicación prepara mensajes internos y externos con hechos verificados.
INC-2005. El escriba registra decisiones, acciones y horas cuando el responsable no puede hacerlo.
INC-2006. El propietario del servicio valida flujos esenciales y criterios de recuperación.
INC-2007. En equipos pequeños una persona cubre varios roles y lo declara; las decisiones de cada rol siguen existiendo.
INC-2008. Los relevos de rol entregan situación, acciones activas, vencimientos, riesgos y próximo paso.
INC-2009. Los agentes de IA pueden asistir como investigadores o escribas con lectura, nunca como responsables del incidente.
INC-2010. Caso hipotético: el responsable del incidente se agota tras diez horas y nadie releva el rol.
INC-2011. Las decisiones se deterioran y un cambio apresurado prolonga la caída.
INC-2012. La política exige relevos planificados con entrega escrita en incidentes prolongados.
INC-2013. Quiero roles claros que permitan a cada persona hacer bien una cosa durante la presión de un incidente.

## 21. Comunicación interna y cadencia de actualizaciones

INC-2101. Las actualizaciones internas siguen una cadencia definida por severidad, incluso cuando no hay novedades.
INC-2102. Cada actualización indica estado, impacto, acciones en curso, próximos pasos y hora de la siguiente actualización.
INC-2103. Las actualizaciones distinguen hechos confirmados de hipótesis.
INC-2104. Las decisiones importantes se comunican con su razón para que otros no las reviertan por desconocimiento.
INC-2105. Los canales de coordinación no contienen secretos ni datos personales completos.
INC-2106. Los interesados no técnicos reciben resúmenes comprensibles sin jerga.
INC-2107. Caso hipotético: la gerencia no recibe actualizaciones durante dos horas y decide comunicar a clientes con información errónea.
INC-2108. La cadencia definida habría mantenido informada a la gerencia y evitado el mensaje incorrecto.
INC-2109. La corrección asigna responsable de comunicación interna con cadencia por severidad.
INC-2110. Quiero que nadie tenga que adivinar el estado de un incidente mientras ocurre.

## 22. Contención proporcional por tipo

INC-2201. La contención reduce el daño en curso con la acción menos destructiva y más reversible disponible.
INC-2202. Para disponibilidad, la contención limita tráfico abusivo, escala recursos autorizados o activa modos degradados.
INC-2203. Para confidencialidad, la contención revoca accesos, desactiva funciones expuestas y rota credenciales afectadas.
INC-2204. Para integridad, la contención detiene procesos que corrompen datos y aísla los registros afectados.
INC-2205. Para incidentes financieros, la contención suspende nuevos cobros o devoluciones del flujo afectado.
INC-2206. Para agentes, la contención retira herramientas de escritura y detiene ejecuciones en curso.
INC-2207. Para suministro, la contención fija versiones conocidas, detiene pipelines y aísla artefactos sospechosos.
INC-2208. Cada acción de contención registra actor, hora, alcance, TTL cuando aplica y procedimiento de reversión.
INC-2209. La contención preserva evidencia salvo que preservarla prolongue un daño grave, y esa decisión se registra.
INC-2210. La contención no se convierte en solución permanente sin revisión posterior.
INC-2211. Caso hipotético: un bloqueo amplio de direcciones detiene un ataque pero bloquea también a clientes corporativos.
INC-2212. El TTL y el monitoreo de efectos detectan el bloqueo de usuarios legítimos y se reemplaza por una regla más precisa.
INC-2213. Quiero detener el daño sin causar uno nuevo a quienes no tienen culpa.

## 23. Erradicación de la causa

INC-2301. La erradicación elimina la causa del incidente, no solo sus síntomas.
INC-2302. La causa se identifica con evidencia: registros, artefactos, reproducción o análisis de código.
INC-2303. La corrección se prueba en entorno de prueba con un caso que reproduce el incidente.
INC-2304. Las credenciales comprometidas se rotan y se verifica que las antiguas ya no funcionan.
INC-2305. Los artefactos maliciosos se eliminan de todos los lugares donde se propagaron.
INC-2306. Los sistemas comprometidos se reconstruyen desde fuentes confiables en lugar de limpiarse manualmente.
INC-2307. La erradicación incompleta se declara con lo pendiente y su riesgo.
INC-2308. Caso hipotético: se elimina una cuenta de administrador creada por un atacante, pero no la clave de API que también creó.
INC-2309. El atacante regresa por la clave y la investigación completa revela ambos accesos.
INC-2310. La corrección exige inventariar todos los accesos creados durante la ventana de compromiso.
INC-2311. Quiero eliminar la causa completa, no solo la parte visible.

## 24. Recuperación y verificación del servicio

INC-2401. La recuperación restablece el servicio con criterios observables definidos por el propietario del servicio.
INC-2402. Los criterios incluyen flujos esenciales funcionando, métricas dentro de objetivos y ausencia de señales del incidente.
INC-2403. La recuperación se realiza por etapas cuando el riesgo de recaída es significativo.
INC-2404. Las medidas temporales de contención se retiran solo cuando la causa está erradicada y verificada.
INC-2405. La recuperación de datos sigue el manual de almacenamiento con restauración aislada y validación.
INC-2406. El monitoreo reforzado se mantiene durante un período posterior a la recuperación.
INC-2407. La declaración de recuperación registra criterios cumplidos, hora y responsable que la aprueba.
INC-2408. La expiración de un TTL no equivale a recuperación; se verifican criterios antes de declarar.
INC-2409. Caso hipotético: el servicio se declara recuperado al responder la página principal, pero los pagos siguen fallando.
INC-2410. El criterio de recuperación incluía flujo de pago y la verificación detecta el fallo antes del cierre.
INC-2411. Quiero declarar recuperado lo que funciona para los usuarios, no lo que parece funcionar en un panel.

## 25. Evidencia y análisis forense

INC-2501. La evidencia se preserva antes de acciones que puedan destruirla: registros, imágenes de disco, memoria cuando aplique y configuraciones.
INC-2502. La evidencia se almacena con acceso restringido, hash de integridad y cadena de custodia registrada.
INC-2503. La evidencia minimiza datos personales y no incluye secretos completos.
INC-2504. El análisis se realiza sobre copias para no alterar los originales.
INC-2505. Las conclusiones forenses distinguen hechos demostrados de hipótesis con su nivel de confianza.
INC-2506. La retención de evidencia se define por necesidad de investigación y obligaciones aplicables.
INC-2507. La evidencia que pueda tener uso legal se trata con procedimientos acordados con asesoría competente.
INC-2508. Caso hipotético: un operador reinicia un servidor comprometido antes de capturar su estado y se pierde evidencia de procesos.
INC-2509. La política exige captura previa cuando el daño no exige reinicio inmediato, con procedimiento documentado.
INC-2510. Quiero entender exactamente qué pasó, con evidencia que nadie pueda poner en duda.

## 26. Cronología del incidente

INC-2601. La cronología registra cada evento relevante con hora, fuente, descripción y autor de la entrada.
INC-2602. Las horas se registran en una zona horaria declarada y se convierten de forma consistente.
INC-2603. La cronología incluye eventos anteriores a la detección cuando la investigación los descubre.
INC-2604. Las decisiones se registran con alternativas consideradas y razón de la elección.
INC-2605. La cronología se construye durante la respuesta y se completa después con la investigación.
INC-2606. La cronología final permite medir tiempo de detección, contención, erradicación y recuperación.
INC-2607. Caso hipotético: la cronología muestra que el compromiso comenzó cinco días antes de la detección.
INC-2608. El punto de restauración y el alcance de la investigación se ajustan a esa fecha.
INC-2609. Quiero una cronología que cuente la historia completa, incluso la parte que ocurrió antes de enterarme.

## 27. Playbook de exposición de datos

INC-2701. Confirmar qué datos se expusieron, a quién, durante cuánto tiempo y por qué vía.
INC-2702. Contener cerrando la vía de exposición y revocando accesos indebidos.
INC-2703. Preservar registros de acceso que permitan delimitar quién accedió a qué.
INC-2704. Clasificar los datos expuestos y estimar el número de titulares afectados con evidencia.
INC-2705. Evaluar con revisión competente las obligaciones de notificación aplicables por jurisdicción y contrato.
INC-2706. Preparar comunicaciones a titulares con hechos, riesgos, medidas tomadas y recomendaciones.
INC-2707. Enviar comunicaciones solo con autorización del responsable.
INC-2708. Corregir la causa y añadir prueba que detecte su regresión.
INC-2709. Revisar si los datos expuestos aparecen en otros lugares y actuar en consecuencia.
INC-2710. Caso hipotético: un bucket de exportaciones queda público durante tres días por un cambio de configuración.
INC-2711. Los registros de acceso muestran descargas desde dos direcciones externas en ese período.
INC-2712. El responsable decide notificaciones con base en la evaluación competente y la evidencia de acceso.
INC-2713. La aceptación verifica que el bucket es privado y que una prueba de configuración detecta exposición futura.
INC-2714. Quiero responder a una exposición con la verdad, rapidez y respeto por las personas afectadas.

## 28. Playbook de ransomware

INC-2801. Aislar los sistemas afectados de la red sin apagarlos cuando la captura de evidencia sea posible.
INC-2802. Identificar el alcance: sistemas cifrados, cuentas usadas y copias de seguridad afectadas.
INC-2803. Verificar la integridad de copias inmutables o desconectadas.
INC-2804. Rotar credenciales antes de restaurar para impedir el regreso del atacante.
INC-2805. Reconstruir sistemas desde fuentes confiables y restaurar datos desde el último punto limpio verificado.
INC-2806. Evaluar exfiltración de datos además del cifrado, porque muchos ataques combinan ambos.
INC-2807. La decisión sobre pagos de rescate no la toma un agente ni un operador; corresponde a la dirección con asesoría competente.
INC-2808. Coordinar comunicaciones y posibles notificaciones con revisión competente.
INC-2809. Caso hipotético: el ransomware cifra el servidor de archivos y su réplica, pero la copia inmutable permanece intacta.
INC-2810. La restauración desde la copia inmutable tras rotación de credenciales recupera el servicio en el plazo ensayado.
INC-2811. Quiero que el ransomware sea un incidente grave pero recuperable, no el fin de mi negocio.

## 29. Playbook de caída de proveedor

INC-2901. Confirmar la caída con el estado publicado del proveedor y con pruebas propias.
INC-2902. Activar el modo degradado documentado que conserva funciones esenciales.
INC-2903. Comunicar a usuarios el impacto y las funciones disponibles.
INC-2904. Evaluar el uso de un proveedor alternativo solo si está aprobado y no crea efectos duplicados.
INC-2905. No reintentar masivamente contra el proveedor caído para no agravar la situación ni consumir cuotas.
INC-2906. Registrar operaciones pendientes para procesarlas tras la recuperación con idempotencia.
INC-2907. Tras la recuperación, reconciliar operaciones afectadas durante la caída.
INC-2908. Caso hipotético: el proveedor de correo cae y la aplicación encola notificaciones sin límite hasta agotar memoria.
INC-2909. La corrección limita la cola, persiste pendientes y alerta cuando la cola crece.
INC-2910. Quiero que la caída de un tercero me afecte lo menos posible y que nada se pierda al volver.

## 30. Playbook de despliegue defectuoso

INC-3001. Identificar el despliegue reciente relacionado con el inicio de los síntomas.
INC-3002. Revertir al artefacto anterior verificado si la reversión es segura para los datos.
INC-3003. Si la reversión no es segura por migraciones aplicadas, preparar reparación hacia adelante.
INC-3004. Verificar recuperación con los criterios del servicio.
INC-3005. Analizar por qué las pruebas y el canary no detectaron el defecto.
INC-3006. Añadir la prueba faltante antes de volver a desplegar la corrección.
INC-3007. Caso hipotético: un despliegue rompe el inicio de sesión de usuarios con contraseñas antiguas.
INC-3008. La reversión restaura el acceso y la prueba nueva cubre derivaciones antiguas antes del redespliegue.
INC-3009. Quiero revertir rápido y aprender por qué el defecto llegó a producción.

## 31. Playbook de corrupción de datos

INC-3101. Detener los procesos que siguen corrompiendo datos.
INC-3102. Identificar el alcance: registros, campos, período y causa.
INC-3103. Preservar el estado actual antes de corregir, para poder comparar.
INC-3104. Restaurar valores correctos desde backup aislado o recalcular desde fuentes confiables.
INC-3105. Conservar cambios legítimos posteriores a la corrupción.
INC-3106. Verificar la corrección con invariantes y muestras.
INC-3107. Evaluar impacto en reportes, facturas o comunicaciones generadas con datos corruptos.
INC-3108. Caso hipotético: un cálculo erróneo de descuentos afecta facturas emitidas durante una semana.
INC-3109. Se corrigen datos, se emiten notas de corrección con autorización y se comunica a clientes afectados.
INC-3110. Quiero reparar datos dañados sin destruir los que estaban bien.

## 32. Playbook de cobro duplicado

INC-3201. Suspender nuevos cobros del flujo afectado sin detener la conciliación.
INC-3202. Identificar cobros duplicados con evidencia del proveedor y de los registros propios.
INC-3203. Preservar ambos cobros en el registro; no borrar el duplicado.
INC-3204. Preparar devoluciones autorizadas por el responsable financiero.
INC-3205. Comunicar a clientes afectados con hechos y plazo esperado de devolución.
INC-3206. Corregir la causa, típicamente idempotencia o reintentos, y probar con resultados inciertos simulados.
INC-3207. El [manual de pagos](PAYMENTS.md) desarrolla reconciliación y devoluciones.
INC-3208. Caso hipotético: un timeout del proveedor provoca reintentos que cobran dos veces a cuarenta clientes.
INC-3209. La reconciliación identifica los cuarenta casos y las devoluciones se ejecutan con autorización.
INC-3210. Quiero que ningún cliente pague dos veces por mi error y que, si ocurre, lo sepa y recupere su dinero pronto.

## 33. Playbook de gasto desbocado de IA

INC-3301. Activar el kill switch o reducir límites del caso de uso afectado.
INC-3302. Identificar la causa: bucle de agente, abuso de usuarios, error de configuración o ataque.
INC-3303. Preservar registros de invocaciones sin contenido sensible innecesario.
INC-3304. Estimar el gasto con datos del gateway y confirmarlo con facturación del proveedor.
INC-3305. Corregir límites por tarea, por usuario y por período.
INC-3306. Reactivar el caso de uso de forma gradual con monitoreo reforzado.
INC-3307. Caso hipotético: un agente de investigación entra en bucle y consume el presupuesto mensual en una noche.
INC-3308. El límite por tarea no existía; la corrección lo añade y la prueba reproduce el bucle con corte controlado.
INC-3309. Quiero que un error de un agente cueste minutos de presupuesto, no meses.

## 34. Playbook de inyección de instrucciones ejecutada

INC-3401. Detener el agente afectado y retirar sus herramientas de escritura y salida.
INC-3402. Identificar el contenido que contenía la instrucción y su origen.
INC-3403. Determinar qué herramientas invocó el agente por efecto de la instrucción y con qué resultados.
INC-3404. Revertir o compensar efectos producidos, como mensajes enviados o archivos modificados.
INC-3405. Revisar si la instrucción quedó persistida en memoria o en checkpoints y eliminarla.
INC-3406. Reducir herramientas del agente y añadir guardrails o separación de roles según el [AI Gateway](AI-GATEWAY.md).
INC-3407. Añadir el caso a las evaluaciones adversariales.
INC-3408. Caso hipotético: un agente de soporte lee un ticket con instrucciones ocultas y envía un resumen de conversaciones a una dirección externa.
INC-3409. La investigación identifica el ticket, el envío y los datos incluidos; se evalúan notificaciones aplicables.
INC-3410. La corrección retira la herramienta de envío del agente lector y separa la redacción de respuestas en otro agente con aprobación humana.
INC-3411. Quiero que un texto malicioso nunca más pueda hablar a través de mis agentes.

## 35. Playbook de secreto expuesto

INC-3501. Revocar o rotar el secreto de inmediato, antes de limpiar el lugar donde se expuso.
INC-3502. Determinar desde cuándo estuvo expuesto y dónde: repositorio, log, chat, artefacto o captura.
INC-3503. Revisar los accesos realizados con el secreto durante la ventana de exposición.
INC-3504. Limpiar la exposición según capacidades de la plataforma, con autorización si implica reescribir historia.
INC-3505. Corregir la causa y añadir escaneo de secretos en el punto donde falló.
INC-3506. Caso hipotético: una clave de API productiva se publica en un repositorio y es usada desde otro país en minutos.
INC-3507. La rotación inmediata corta el acceso; la revisión de uso identifica recursos creados por el atacante y se eliminan.
INC-3508. Quiero que un secreto expuesto deje de servir antes de que alguien termine de copiarlo.

## 36. Playbook de certificado o dominio expirado

INC-3601. Confirmar la expiración y su impacto en usuarios e integraciones.
INC-3602. Renovar o restaurar con el proveedor, verificando titularidad y acceso a la cuenta.
INC-3603. Verificar la cadena completa y la configuración tras la renovación.
INC-3604. Añadir alerta anticipada de expiración con receptor efectivo.
INC-3605. Caso hipotético: el certificado expira un sábado porque la alerta llegaba al correo de una persona que ya no trabaja en el equipo.
INC-3606. La corrección asigna un receptor de equipo y verifica el inventario de certificados con fechas.
INC-3607. Quiero que ningún vencimiento predecible se convierta en incidente.

## 37. Playbook de disco lleno o recurso agotado

INC-3701. Confirmar el recurso agotado con medición directa.
INC-3702. Detener procesos no esenciales que consumen el recurso.
INC-3703. Liberar recursos con acciones seguras sin eliminar datos de usuarios.
INC-3704. Ampliar con autorización cuando implica costo.
INC-3705. Verificar escrituras críticas y reserva restablecida.
INC-3706. El [manual de almacenamiento](STORAGE-DATA.md) desarrolla el runbook detallado.
INC-3707. Quiero salir de un recurso agotado sin perder nada que importe.

## 38. Playbook de cuenta administrativa comprometida

INC-3801. Suspender la cuenta y revocar sus sesiones, tokens y claves.
INC-3802. Revisar acciones realizadas con la cuenta durante la ventana sospechosa.
INC-3803. Revertir cambios no autorizados de permisos, configuraciones y datos.
INC-3804. Identificar el vector de compromiso: phishing, reutilización de contraseña o dispositivo comprometido.
INC-3805. Restablecer la cuenta con autenticación fuerte tras verificar la identidad del titular.
INC-3806. Revisar si otras cuentas comparten el mismo vector.
INC-3807. Caso hipotético: un administrador cae en un correo de phishing y el atacante crea usuarios con privilegios.
INC-3808. La revisión de auditoría identifica los usuarios creados y se eliminan junto con sus accesos.
INC-3809. Quiero que una cuenta comprometida tenga el menor alcance posible y una limpieza completa.

## 39. Playbook de abuso masivo de cuentas

INC-3901. Detectar patrones de prueba de credenciales, creación masiva o uso automatizado.
INC-3902. Aplicar limitación progresiva por identidad, origen y comportamiento.
INC-3903. Proteger cuentas afectadas con restablecimiento y notificación a sus titulares.
INC-3904. Preservar a usuarios legítimos con rutas de recuperación ante falsos positivos.
INC-3905. Revisar si las credenciales probadas provienen de filtraciones externas para recomendar cambios a usuarios.
INC-3906. Caso hipotético: miles de intentos de inicio de sesión distribuidos en muchas direcciones comprometen cincuenta cuentas.
INC-3907. Se restablecen las cincuenta cuentas, se notifica a titulares y se añade verificación adicional ante riesgo.
INC-3908. Quiero proteger a mis usuarios de contraseñas robadas en otros sitios.

## 40. Comunicación externa y notificaciones

INC-4001. Las comunicaciones externas se basan en hechos verificados y evitan especulación sobre causas no confirmadas.
INC-4002. Las comunicaciones explican impacto, acciones tomadas, recomendaciones y canal de contacto.
INC-4003. Las notificaciones a autoridades o titulares se evalúan con revisión competente según obligaciones aplicables.
INC-4004. Los plazos de notificación se registran desde la fuente oficial vigente con fecha de consulta.
INC-4005. Las comunicaciones se envían solo con autorización del responsable.
INC-4006. Las páginas de estado se actualizan con cadencia y sin minimizar el impacto.
INC-4007. Los agentes de IA preparan borradores; no envían comunicaciones externas.
INC-4008. Caso hipotético: un mensaje a clientes afirma que no hubo acceso a datos antes de terminar la investigación.
INC-4009. La investigación posterior encuentra acceso y el mensaje debe corregirse, dañando la confianza.
INC-4010. La política exige comunicar lo confirmado y lo que sigue en investigación, sin afirmaciones prematuras.
INC-4011. Quiero comunicar con la verdad aunque sea incómoda, porque la confianza se pierde más con correcciones.

## 41. Coordinación con terceros

INC-4101. Los proveedores involucrados se contactan por canales oficiales con información mínima necesaria.
INC-4102. Las solicitudes a terceros se registran con hora, contenido y respuesta.
INC-4103. Los contratos se revisan para conocer obligaciones de notificación mutua.
INC-4104. Los datos compartidos con terceros durante la respuesta se minimizan y se registran.
INC-4105. Caso hipotético: un proveedor de infraestructura detecta tráfico malicioso desde un servidor del producto y lo suspende.
INC-4106. La coordinación por el canal oficial permite demostrar la limpieza y restablecer el servicio.
INC-4107. Quiero tener los contactos y acuerdos listos antes de necesitarlos.

## 42. Falsos positivos y protección de usuarios legítimos

INC-4201. Toda respuesta automática considera el costo de bloquear a usuarios legítimos.
INC-4202. Las medidas tienen TTL, monitoreo de efectos y procedimiento de excepción.
INC-4203. Los usuarios bloqueados por error tienen un canal de recuperación claro y atendido.
INC-4204. Los falsos positivos se registran y se usan para ajustar reglas.
INC-4205. Caso hipotético: una regla de detección bloquea a todos los usuarios de una empresa que comparte una dirección de salida.
INC-4206. El monitoreo de efectos detecta el pico de bloqueos y la regla se ajusta para considerar identidad además de origen.
INC-4207. Quiero defenderme sin castigar a quienes confían en mi sistema.

## 43. Automatización de la respuesta

INC-4301. Una respuesta automática se aprueba previamente con condición de activación, acción exacta, alcance, TTL, monitoreo de efectos y reversión.
INC-4302. Las automatizaciones de alto impacto, como bloqueos amplios o apagados de servicios, requieren confirmación humana salvo excepción documentada.
INC-4303. Las automatizaciones se prueban en entornos de prueba con escenarios de activación correcta y de falso positivo.
INC-4304. Cada ejecución automática se registra con la señal que la activó y el resultado observado.
INC-4305. Una automatización que se activa con frecuencia sin incidentes reales se revisa porque erosiona la confianza en las alertas.
INC-4306. Las automatizaciones tienen un interruptor de desactivación documentado y probado.
INC-4307. Los agentes de IA no crean automatizaciones de respuesta en caliente durante un incidente sin aprobación.
INC-4308. Caso hipotético: una automatización escala recursos ante tráfico alto y multiplica el costo durante un ataque de volumen.
INC-4309. El límite de escalado y la alerta de costo detienen el crecimiento y el responsable decide la mitigación adecuada.
INC-4310. La corrección añade tope de escalado y clasificación del tráfico antes de escalar.
INC-4311. Quiero automatizaciones que actúen rápido dentro de límites que yo fijé con calma.

## 44. Agentes de IA durante incidentes

INC-4401. Los agentes pueden correlacionar registros, resumir cronologías, redactar borradores y proponer hipótesis con evidencia.
INC-4402. Los agentes operan con lectura sobre sistemas productivos durante el incidente salvo autorización específica.
INC-4403. Las hipótesis de los agentes se verifican antes de actuar sobre ellas.
INC-4404. Los agentes no envían comunicaciones externas ni ejecutan contención de alto impacto por iniciativa propia.
INC-4405. El contenido analizado por agentes durante un incidente puede ser adversarial y se trata como dato.
INC-4406. Los registros enviados a agentes remotos se minimizan y su destino se aprueba.
INC-4407. El agente eos-incident-commander coordina el registro y propone pasos; el responsable humano decide.
INC-4408. Caso hipotético: un agente sugiere que la causa es un despliegue reciente basándose en correlación temporal.
INC-4409. La verificación muestra que el despliegue no tocó el componente afectado y la investigación sigue otra línea.
INC-4410. El registro conserva la hipótesis descartada con su razón.
INC-4411. Quiero agentes que me ayuden a pensar más rápido durante un incidente sin decidir por mí.

## 45. Postmortem detallado

INC-4501. El postmortem se realiza para todo incidente de severidad media o superior y para incidentes menores con lecciones relevantes.
INC-4502. El documento incluye resumen, impacto, cronología, causa raíz y factores contribuyentes, detección, respuesta y acciones.
INC-4503. El análisis es sin culpas: busca condiciones del sistema que permitieron el error, no personas a quienes señalar.
INC-4504. La causa raíz se profundiza preguntando por qué hasta llegar a condiciones controlables.
INC-4505. Los factores contribuyentes incluyen detección tardía, documentación insuficiente y controles ausentes.
INC-4506. Cada acción preventiva tiene responsable, plazo y criterio de verificación.
INC-4507. Las acciones se priorizan por reducción de riesgo y no por facilidad.
INC-4508. El postmortem se revisa con los participantes y se publica internamente con datos sensibles redactados.
INC-4509. El seguimiento de acciones se revisa hasta su cierre verificado.
INC-4510. Caso hipotético: el postmortem concluye que un operador cometió un error y propone capacitación como única acción.
INC-4511. La revisión sin culpas identifica que el sistema permitía ejecutar el comando sin confirmación ni prueba previa.
INC-4512. La acción preventiva añade confirmación y modo de simulación al comando.
INC-4513. Quiero postmortems que cambien el sistema, no que busquen culpables.

## 46. Métricas de respuesta

INC-4601. Tiempo hasta detección: desde el inicio del incidente hasta la primera señal registrada.
INC-4602. Tiempo hasta reconocimiento: desde la señal hasta que un responsable la asume.
INC-4603. Tiempo hasta contención: desde la declaración hasta detener el daño en curso.
INC-4604. Tiempo hasta recuperación: desde la declaración hasta cumplir criterios de recuperación.
INC-4605. Porcentaje de acciones preventivas cerradas en plazo.
INC-4606. Recurrencia de incidentes con la misma causa raíz.
INC-4607. Las métricas se calculan con horas de la cronología, no con estimaciones.
INC-4608. Las métricas no se optimizan reclasificando incidentes ni cerrando acciones sin verificación.
INC-4609. Quiero métricas que muestren si respondo mejor cada vez.

## 47. Ejercicios y simulacros

INC-4701. Los playbooks se ejercitan periódicamente con escenarios realistas en entornos de prueba o como ejercicios de mesa.
INC-4702. Los ejercicios incluyen roles, comunicación, decisiones bajo incertidumbre y verificación de recuperación.
INC-4703. Los ejercicios técnicos ejecutan restauraciones, rotaciones y reversiones reales en entornos aislados.
INC-4704. Cada ejercicio produce hallazgos y mejoras a playbooks, herramientas o formación.
INC-4705. Los ejercicios no afectan sistemas productivos sin autorización y plan de interrupción.
INC-4706. Caso hipotético: un ejercicio de mesa de exposición de datos revela que nadie sabe quién aprueba notificaciones.
INC-4707. La mejora asigna esa responsabilidad y la registra en el playbook.
INC-4708. Quiero equivocarme en los ensayos para acertar en los incidentes reales.

## 48. Guardias y sostenibilidad

INC-4801. La guardia define horarios, receptores, escalamiento, compensación y descanso.
INC-4802. Las alertas que llegan a la guardia son accionables; las informativas se revisan en horario normal.
INC-4803. La carga de alertas se mide y se reduce cuando genera fatiga.
INC-4804. Los equipos pequeños declaran honestamente su cobertura real y no prometen atención continua que no pueden cumplir.
INC-4805. La documentación de guardia incluye accesos necesarios, runbooks y contactos.
INC-4806. Caso hipotético: una persona sola recibe todas las alertas día y noche durante meses.
INC-4807. La revisión reduce alertas no accionables, define horario de cobertura y comunica a clientes el nivel real de soporte.
INC-4808. Quiero una respuesta sostenible que no agote a quienes la sostienen.

## 49. Severidad detallada

INC-4901. SEV1: interrupción total de funciones esenciales, exposición confirmada de datos sensibles o pérdida financiera en curso.
INC-4902. SEV2: degradación significativa, exposición limitada o riesgo alto de escalar a SEV1.
INC-4903. SEV3: impacto parcial con alternativa disponible para usuarios.
INC-4904. SEV4: impacto menor sin efecto material en usuarios.
INC-4905. Cada nivel define cadencia de actualización, roles requeridos y obligación de postmortem.
INC-4906. La severidad se ajusta con evidencia durante la respuesta y cada cambio se registra.
INC-4907. Las definiciones concretas se adaptan al perfil del producto y se documentan antes de necesitarlas.
INC-4908. Caso hipotético: un incidente se clasifica SEV3 por afectar solo a un tenant, pero ese tenant representa la mitad de los ingresos.
INC-4909. El perfil del producto incluye impacto comercial y la severidad se eleva a SEV2.
INC-4910. Quiero severidades que reflejen el impacto real, no solo el técnico.

## 50. Preparación previa de la organización

INC-5001. El inventario de servicios con dueños y dependencias está actualizado antes de cualquier incidente.
INC-5002. Los accesos de emergencia están definidos, probados y auditados.
INC-5003. Los contactos de proveedores, asesoría y autoridades relevantes están registrados.
INC-5004. Las plantillas de comunicación están preparadas y revisadas.
INC-5005. Los backups y su restauración están verificados según calendario.
INC-5006. Los playbooks prioritarios están escritos y ejercitados.
INC-5007. La preparación se revisa periódicamente y tras cada incidente.
INC-5008. Quiero que el día del incidente sea de ejecución, no de improvisación.

## 51. Playbook de vulnerabilidad crítica publicada

INC-5101. Determinar si el producto usa el componente vulnerable y en qué versión, con el inventario de dependencias.
INC-5102. Evaluar si el código vulnerable es alcanzable en el perfil real del producto.
INC-5103. Aplicar mitigación temporal cuando la corrección no puede desplegarse de inmediato.
INC-5104. Desplegar la versión corregida tras pruebas proporcionales a la urgencia.
INC-5105. Revisar registros del período expuesto buscando señales de explotación.
INC-5106. Documentar la decisión cuando el componente no es alcanzable y la actualización se programa sin urgencia.
INC-5107. Caso hipotético: se publica una vulnerabilidad de ejecución remota en una biblioteca de registro usada por el producto.
INC-5108. El inventario confirma uso, la mitigación desactiva la función vulnerable y la actualización se despliega el mismo día.
INC-5109. La revisión de registros no encuentra explotación y el resultado se documenta con su alcance.
INC-5110. Quiero responder a vulnerabilidades públicas con datos, no con pánico ni con indiferencia.

## 52. Playbook de pipeline o dependencia comprometida

INC-5201. Detener el pipeline afectado y suspender publicaciones.
INC-5202. Identificar artefactos producidos durante la ventana de compromiso.
INC-5203. Verificar artefactos desplegados contra hashes de builds confiables.
INC-5204. Reconstruir artefactos desde fuentes verificadas en entorno limpio.
INC-5205. Rotar secretos accesibles por el pipeline.
INC-5206. Revisar cambios en workflows, acciones de terceros y configuraciones durante la ventana.
INC-5207. Caso hipotético: una acción de CI de terceros se actualiza con código que exfiltra variables de entorno.
INC-5208. Las acciones fijadas por commit no reciben la actualización maliciosa; los proyectos que usaban etiquetas móviles se ven afectados.
INC-5209. La política de fijar acciones por commit queda validada y se revisan proyectos con etiquetas móviles.
INC-5210. Quiero saber que lo que despliego es lo que construí desde código que revisé.

## 53. Playbook de plugin, skill o servidor MCP malicioso

INC-5301. Deshabilitar el plugin, skill o servidor MCP en todos los hosts donde esté instalado.
INC-5302. Revisar qué acciones ejecutó, qué archivos leyó y qué datos envió durante su uso.
INC-5303. Rotar credenciales a las que tuvo acceso.
INC-5304. Revertir cambios realizados por sus hooks o herramientas.
INC-5305. Notificar a otros proyectos que usan el mismo componente.
INC-5306. Añadir el caso a la revisión de suministro de [Security Fabric](SECURITY-FABRIC.md), sección SF-45.
INC-5307. Caso hipotético: un servidor MCP de terceros comienza a devolver resultados con instrucciones para leer archivos de configuración.
INC-5308. Los agentes con herramientas mínimas no pueden leer fuera del repositorio y reportan las instrucciones.
INC-5309. El servidor se deshabilita y se revisa si algún agente con más permisos lo utilizó.
INC-5310. Quiero que mis agentes resistan a sus propias herramientas cuando estas se vuelven hostiles.

## 54. Playbook de error de agente de código

INC-5401. Detener la sesión del agente y preservar su registro de acciones.
INC-5402. Identificar archivos, ramas o recursos afectados.
INC-5403. Restaurar el estado previo desde control de versiones o backups sin perder trabajo legítimo de otros.
INC-5404. Verificar si el agente publicó cambios en remotos y revertirlos con autorización.
INC-5405. Analizar por qué el agente pudo ejecutar la acción: permisos, instrucciones o contenido adversarial.
INC-5406. Ajustar permisos, instrucciones o validadores para impedir la repetición.
INC-5407. Caso hipotético: un agente ejecuta una limpieza que elimina archivos sin seguimiento con trabajo de otro colaborador.
INC-5408. El trabajo se recupera parcialmente del editor del colaborador y la política prohíbe limpieza de archivos ajenos.
INC-5409. El host añade confirmación obligatoria para comandos destructivos.
INC-5410. Quiero que el error de un agente sea reversible y que no se repita.

## 55. Gestión de la incertidumbre durante la respuesta

INC-5501. Las decisiones se toman con la mejor evidencia disponible y se declaran explícitamente sus supuestos.
INC-5502. Las hipótesis se registran con su nivel de confianza y la evidencia que las confirmaría o descartaría.
INC-5503. Las acciones reversibles se prefieren cuando la incertidumbre es alta.
INC-5504. Las afirmaciones públicas esperan confirmación o se formulan como investigación en curso.
INC-5505. La incertidumbre residual al cierre se documenta con su impacto.
INC-5506. Caso hipotético: no puede determinarse si un atacante accedió a una tabla porque los registros de esa base no estaban activos.
INC-5507. El cierre declara la incertidumbre, se activan los registros y la evaluación de notificación considera el peor caso razonable.
INC-5508. Quiero decidir con honestidad sobre lo que sé y lo que no sé.

## 56. Cierre formal del incidente

INC-5601. El incidente se cierra cuando el servicio está recuperado, la causa erradicada o mitigada y las acciones preventivas asignadas.
INC-5602. El cierre registra hora, responsable, estado de acciones y fecha del postmortem.
INC-5603. Las medidas temporales activas tienen fecha de retiro o se convierten en controles revisados.
INC-5604. La evidencia se archiva con retención y acceso definidos.
INC-5605. Las comunicaciones finales se envían con autorización.
INC-5606. El cierre no ocurre con contención sin revisar ni con causa desconocida sin declarar.
INC-5607. Quiero cerrar incidentes cuando de verdad terminaron, no cuando dejamos de mirarlos.

## 57. Relación con otros módulos

INC-5701. [SECURITY-FABRIC](SECURITY-FABRIC.md) define controles preventivos y detección.
INC-5702. [STORAGE-DATA](STORAGE-DATA.md) define backups, restauración y runbooks de capacidad.
INC-5703. [PAYMENTS](PAYMENTS.md) define reconciliación y devoluciones.
INC-5704. [AI-GATEWAY](AI-GATEWAY.md) define kill switch, guardrails y presupuestos.
INC-5705. [UPDATES-RELIABILITY](UPDATES-RELIABILITY.md) define reversión de releases.
INC-5706. [AGENT-ORCHESTRATION](AGENT-ORCHESTRATION.md) define el rol del comandante de incidentes y la coordinación de agentes.
INC-5707. [COMPLIANCE-IP-PRODUCT](COMPLIANCE-IP-PRODUCT.md) orienta la evaluación de obligaciones de notificación.
INC-5708. Este módulo coordina la respuesta y referencia esos contratos sin duplicarlos.

## 58. Límites de esta edición

INC-5801. Este manual no implementa detección, guardias ni automatizaciones en ningún proyecto.
INC-5802. Los casos son ejercicios de diseño y no incidentes reales.
INC-5803. Los plazos de notificación dependen de jurisdicción y contrato y requieren verificación vigente.
INC-5804. Los límites se revisan en cada edición.

## 59. Cierre de la Parte II

INC-5901. La respuesta a incidentes protege usuarios, datos, dinero y confianza con decisiones acotadas y evidencia preservada.
INC-5902. Cada proyecto completa contactos, permisos, capacidades y tiempos antes de declarar operativos estos playbooks.
INC-5903. Pierre R. Boss (oprbguitar) dirige este estándar y decide sobre su evolución.
INC-5904. Quiero recuperar el servicio sin perder la verdad de lo ocurrido.

## Anexo A. Caso trabajado SEV1: caída total del servicio de pedidos

INC-A001. Hora cero hipotética: las alertas de error de escritura en la base de pedidos se disparan a las 20:05, hora de Lima.
INC-A002. A las 20:07 la persona de guardia reconoce la alerta y confirma con una prueba manual que no se pueden crear pedidos.
INC-A003. A las 20:09 declara SEV1, asume como responsable del incidente y abre el registro con síntomas y alcance.
INC-A004. A las 20:10 anuncia en el canal que nadie modifique la base ni despliegue sin coordinación.
INC-A005. A las 20:12 la medición muestra el volumen de la base al cien por ciento por registros de depuración.
INC-A006. A las 20:14 se desactiva el nivel de depuración mediante configuración, con registro de la acción.
INC-A007. A las 20:16 se rotan los registros antiguos a almacenamiento separado siguiendo el runbook de disco lleno.
INC-A008. A las 20:19 la escritura vuelve a funcionar en prueba manual y las métricas de errores descienden.
INC-A009. A las 20:20 se comunica internamente que el servicio se está recuperando y que sigue la verificación.
INC-A010. A las 20:25 se verifican los flujos esenciales: crear pedido, pagar y consultar historial.
INC-A011. A las 20:30 se revisan pedidos fallidos durante la caída y se identifica que los clientes recibieron error sin cobro.
INC-A012. A las 20:35 se prepara mensaje para la página de estado y se publica con autorización del responsable de producto.
INC-A013. A las 20:50 tras quince minutos estables se declara recuperado con criterios cumplidos.
INC-A014. Al día siguiente la investigación encuentra que un despliegue de la tarde activó depuración por un valor por defecto.
INC-A015. La cronología completa registra el despliegue a las 16:40 como evento previo a la detección.
INC-A016. El postmortem identifica tres factores: valor por defecto peligroso, logs en el mismo volumen y alerta de capacidad sin tendencia.
INC-A017. Las acciones preventivas separan volúmenes, validan configuración en arranque y añaden alerta por crecimiento acelerado.
INC-A018. Cada acción tiene responsable, plazo y prueba de verificación.
INC-A019. Tiempo hasta detección: tres horas y veinticinco minutos desde la causa; dos minutos desde el síntoma.
INC-A020. Tiempo hasta recuperación: cuarenta y cinco minutos desde la declaración.
INC-A021. El caso es un ejercicio de diseño y sus horas son ilustrativas.

## Anexo B. Caso trabajado: exposición de datos por enlace compartido

INC-B001. Un cliente reporta que un enlace de descarga de facturas abre documentos de otros clientes.
INC-B002. El triage reproduce con cuentas de prueba: los enlaces firmados no verificaban tenant en una ruta nueva.
INC-B003. Se declara SEV2 de confidencialidad y se desactiva la ruta nueva con mensaje de mantenimiento.
INC-B004. Se preservan registros de acceso a la ruta desde su despliegue hace cuatro días.
INC-B005. El análisis identifica treinta descargas cruzadas entre doce tenants.
INC-B006. La evaluación competente determina las notificaciones aplicables a los titulares y clientes afectados.
INC-B007. La corrección añade verificación de tenant y prueba de acceso cruzado en la matriz de autorización.
INC-B008. La revisión de seguridad verifica la corrección antes de reactivar la ruta.
INC-B009. Las comunicaciones a clientes afectados se envían con autorización y describen hechos y medidas.
INC-B010. El postmortem identifica que la ruta nueva no se añadió a la matriz de pruebas de autorización.
INC-B011. La acción preventiva bloquea revisiones de endpoints nuevos sin caso de autorización.
INC-B012. El caso es ilustrativo.

## Anexo C. Caso trabajado: agente con herramienta de publicación

INC-C001. Un agente de documentación con permisos amplios publica en la rama principal un cambio no revisado.
INC-C002. El cambio incluye un archivo de configuración local con una ruta personal y un token de prueba.
INC-C003. Se detiene la sesión del agente y se preserva su registro.
INC-C004. Se revoca el token aunque sea de prueba, porque su alcance no estaba documentado.
INC-C005. Se revierte el commit con autorización del responsable del repositorio.
INC-C006. La investigación muestra que el agente tenía permisos de push heredados de la configuración del host.
INC-C007. La corrección restringe herramientas del agente de documentación y activa protección de la rama principal.
INC-C008. La revisión previa al push se añade como control obligatorio en las instrucciones del repositorio.
INC-C009. El caso es ilustrativo.

## Anexo D. Primeros minutos de un incidente

INC-D001. Minuto 1: reconocer la señal y confirmar con una segunda fuente si es posible.
INC-D002. Minuto 3: declarar incidente con responsable, severidad inicial y registro abierto.
INC-D003. Minuto 5: anunciar recursos bajo control y pedir que nadie modifique sin coordinación.
INC-D004. Minuto 10: identificar si el daño continúa y aplicar contención acotada.
INC-D005. Minuto 15: primera actualización interna con estado, impacto y próximos pasos.
INC-D006. Minuto 30: evaluar si se necesitan más roles, proveedores o asesoría.
INC-D007. Minuto 60: revisar severidad, comunicación externa y plan de recuperación.
INC-D008. Los tiempos son referencias y se adaptan a la severidad y al equipo disponible.
INC-D009. Cada paso se registra en la cronología aunque se haga de forma abreviada.

## Anexo E. Mensajes internos tipo

INC-E001. Declaración: incidente declarado, severidad, síntomas, responsable y canal.
INC-E002. Actualización: estado, impacto, acciones en curso, próximos pasos y hora de la siguiente actualización.
INC-E003. Cambio de severidad: nueva severidad con razón y evidencia.
INC-E004. Recuperación: criterios cumplidos, monitoreo reforzado y próximos pasos de investigación.
INC-E005. Cierre: resumen, acciones preventivas asignadas y fecha del postmortem.
INC-E006. Los mensajes distinguen hechos confirmados de hipótesis y no contienen secretos.

## Anexo F. Mensaje externo tipo

INC-F001. Qué ocurrió en términos comprensibles, sin especular sobre causas no confirmadas.
INC-F002. Cuándo comenzó y si continúa.
INC-F003. A quién afecta y cómo.
INC-F004. Qué medidas se tomaron.
INC-F005. Qué deben hacer los usuarios, si deben hacer algo.
INC-F006. Cuándo habrá nueva información y por qué canal.
INC-F007. El mensaje no pide credenciales ni incluye enlaces sospechosos.
INC-F008. El mensaje se envía solo con autorización del responsable.

## Anexo G. Preguntas guía del postmortem

INC-G001. ¿Qué impacto tuvieron los usuarios, durante cuánto tiempo y en qué funciones?
INC-G002. ¿Cuándo empezó realmente el problema y cuándo lo detectamos?
INC-G003. ¿Qué señal nos alertó y cuál debió alertarnos antes?
INC-G004. ¿Qué decisiones tomamos, con qué información y cuáles cambiaríamos?
INC-G005. ¿Qué condición del sistema permitió el error?
INC-G006. ¿Qué factores retrasaron la contención o la recuperación?
INC-G007. ¿Qué funcionó bien y debe conservarse?
INC-G008. ¿Qué acciones reducirían más el riesgo de repetición?
INC-G009. ¿Qué documentación, prueba o validador debe cambiar?
INC-G010. ¿Quién es responsable de cada acción y cuándo se verificará?

## Anexo H. Lista de cierre del incidente

INC-H001. Servicio recuperado con criterios verificados.
INC-H002. Causa erradicada o mitigación vigente con plan.
INC-H003. Medidas temporales retiradas o convertidas en controles revisados.
INC-H004. Evidencia archivada con acceso y retención.
INC-H005. Comunicaciones finales enviadas con autorización.
INC-H006. Acciones preventivas asignadas con responsable y plazo.
INC-H007. Postmortem programado o completado.
INC-H008. Cronología completa en el registro.

## Anexo I. Preguntas de triage

INC-I001. ¿La señal está confirmada por una segunda fuente?
INC-I002. ¿El daño continúa en este momento?
INC-I003. ¿Qué usuarios, datos o dinero están en riesgo?
INC-I004. ¿Hay un cambio reciente que coincida con el inicio?
INC-I005. ¿Qué acción reversible reduciría el daño ahora?
INC-I006. ¿Quién debe saberlo en los próximos quince minutos?
INC-I007. ¿Qué evidencia podría perderse si actuamos sin preservarla?

## Anexo J. Campos mínimos del registro de incidente

INC-J001. Identificador, título breve y categoría.
INC-J002. Severidad inicial y cambios con hora y razón.
INC-J003. Responsable y roles asignados con relevos.
INC-J004. Síntomas, alcance y usuarios afectados estimados con evidencia.
INC-J005. Cronología con hora, fuente, evento y autor.
INC-J006. Acciones con actor, hora, alcance, TTL y reversión.
INC-J007. Hipótesis con confianza y resultado de su verificación.
INC-J008. Comunicaciones internas y externas con hora y aprobación.
INC-J009. Criterios de recuperación y verificación.
INC-J010. Causa, factores contribuyentes y acciones preventivas.

## Anexo K. Contactos a preparar antes del incidente

INC-K001. Responsables de cada servicio y sus suplentes.
INC-K002. Soporte técnico de proveedores críticos por canal oficial.
INC-K003. Asesoría competente para evaluación de obligaciones.
INC-K004. Responsable de comunicación con clientes.
INC-K005. Responsable financiero para incidentes de pagos.
INC-K006. Contactos se verifican periódicamente y se actualizan tras cambios de personal.

## Anexo L. Categoría y playbook inicial

INC-L001. Tráfico abusivo o saturación: playbook de DDoS y abuso de recursos.
INC-L002. Cuentas comprometidas o pruebas de credenciales: playbooks de cuentas y abuso masivo.
INC-L003. Código o dependencia maliciosa: playbooks de suministro y pipeline.
INC-L004. Agente con comportamiento anómalo: playbooks de agente comprometido, inyección y error de agente.
INC-L005. Exposición de datos: playbook de exposición.
INC-L006. Cifrado o borrado masivo: playbook de ransomware.
INC-L007. Falla de tercero: playbook de caída de proveedor.
INC-L008. Regresión tras despliegue: playbook de despliegue defectuoso.
INC-L009. Datos incorrectos: playbook de corrupción.
INC-L010. Cobros incorrectos: playbook de cobro duplicado.
INC-L011. Gasto anómalo de IA: playbook de gasto desbocado.
INC-L012. Credencial publicada: playbook de secreto expuesto.
INC-L013. Vencimientos: playbook de certificado o dominio.
INC-L014. Recursos agotados: playbook de disco lleno.
INC-L015. La categoría orienta el inicio; la investigación decide los playbooks adicionales.

## Anexo M. Ejemplos de TTL para medidas temporales

INC-M001. Bloqueo de una dirección abusiva hipotético: una hora con renovación si persiste la señal.
INC-M002. Limitación reforzada de inicio de sesión hipotética: veinticuatro horas con revisión de falsos positivos.
INC-M003. Desactivación de una función expuesta hipotética: hasta verificar la corrección, con revisión diaria.
INC-M004. Suspensión de cobros de un flujo hipotética: hasta reconciliar, con revisión cada pocas horas.
INC-M005. Los valores reales se fijan por proyecto según riesgo y efecto en usuarios legítimos.
INC-M006. Ningún TTL se renueva automáticamente sin revisión de su efecto.

## Anexo N. Ejemplos de criterios de recuperación

INC-N001. Flujos esenciales completados en prueba manual y monitoreo sintético.
INC-N002. Tasa de errores bajo el umbral del objetivo durante el período de estabilidad.
INC-N003. Latencia dentro del objetivo para los percentiles relevantes.
INC-N004. Ausencia de señales del incidente durante el período de observación.
INC-N005. Datos verificados con invariantes cuando el incidente afectó integridad.
INC-N006. Credenciales comprometidas rotadas y verificadas como inválidas.
INC-N007. Los criterios se definen por el propietario del servicio antes de necesitarlos.

## Anexo O. Errores frecuentes en la respuesta

INC-O001. Actuar sin declarar incidente y sin responsable.
INC-O002. Destruir evidencia al reiniciar o limpiar antes de capturar.
INC-O003. Comunicar causas no confirmadas como hechos.
INC-O004. Dejar medidas temporales activas indefinidamente.
INC-O005. Declarar recuperación por expiración de un TTL.
INC-O006. Erradicar solo el acceso visible del atacante.
INC-O007. Postmortems que culpan a personas en lugar de mejorar el sistema.
INC-O008. Acciones preventivas sin responsable ni verificación.
INC-O009. Cada error tiene una cláusula preventiva en este manual.

## Anexo P. Señales de madurez de la respuesta

INC-P001. Los incidentes se declaran en minutos desde la señal confirmada.
INC-P002. Las actualizaciones internas siguen la cadencia sin recordatorios.
INC-P003. Las acciones preventivas se cierran en plazo y se verifican.
INC-P004. La recurrencia de causas raíz disminuye.
INC-P005. Los ejercicios se realizan según calendario y producen mejoras.
INC-P006. Los usuarios legítimos afectados por medidas defensivas se recuperan rápido.
INC-P007. Las señales se evalúan con datos y no con autoevaluación.

## Anexo Q. Glosario

INC-Q001. Contención: acción que detiene o limita el daño en curso.
INC-Q002. Erradicación: eliminación de la causa del incidente.
INC-Q003. Recuperación: restablecimiento del servicio con criterios verificados.
INC-Q004. TTL: tiempo de vida de una medida temporal antes de revisarse o expirar.
INC-Q005. Postmortem: análisis sin culpas posterior al incidente con acciones preventivas.
INC-Q006. Cronología: registro ordenado de eventos y decisiones del incidente.
INC-Q007. Falso positivo: señal o medida que afecta a algo legítimo como si fuera amenaza.
INC-Q008. Severidad: clasificación del impacto que determina cadencia, roles y obligaciones.

## Anexo R. Preguntas frecuentes

INC-R001. ¿Debo declarar incidente si no estoy seguro? Sí, con severidad conservadora; reclasificar es barato.
INC-R002. ¿Puedo reiniciar un servidor comprometido? Primero captura evidencia salvo que el daño exija reiniciar ya.
INC-R003. ¿Quién decide notificar a clientes? El responsable con evaluación competente y evidencia.
INC-R004. ¿Puede un agente ejecutar la contención? Solo con autorización específica y dentro de sus herramientas.
INC-R005. ¿Cuándo hago postmortem? En incidentes de severidad media o superior y cuando haya lecciones relevantes.
INC-R006. ¿Qué hago si el responsable no responde? Sigue el escalamiento documentado y registra los intentos.

## Anexo S. Ejemplos de ejercicios

INC-S001. Ejercicio de mesa de exposición de datos con roles de responsable, comunicación y asesoría.
INC-S002. Ejercicio técnico de restauración desde copia inmutable en entorno aislado.
INC-S003. Ejercicio técnico de rotación de credenciales de base de datos sin interrupción.
INC-S004. Ejercicio de reversión de despliegue con migración aplicada.
INC-S005. Ejercicio de agente con instrucción inyectada en un ticket de prueba.
INC-S006. Ejercicio de caída de proveedor con activación de modo degradado.
INC-S007. Cada ejercicio registra participantes, escenario, decisiones, hallazgos y mejoras.
INC-S008. Los ejercicios no afectan producción sin autorización y plan de interrupción.

## Anexo T. Respuesta en un equipo de una sola persona

INC-T001. La misma persona asume todos los roles y lo declara en el registro.
INC-T002. El registro se mantiene breve pero continuo, aunque sea con notas de hora y acción.
INC-T003. Las acciones reversibles se priorizan porque no hay segunda revisión inmediata.
INC-T004. Los agentes de IA pueden actuar como escribas o investigadores de lectura para reducir carga.
INC-T005. La comunicación externa se prepara con plantillas para no redactar bajo presión.
INC-T006. El postmortem se realiza aunque sea breve, con acciones verificables.
INC-T007. La cobertura real se comunica honestamente a clientes.

## Anexo U. Decisiones difíciles

INC-U001. Apagar un servicio para contener una exposición puede afectar a todos los usuarios; se decide por gravedad de la exposición y alternativas.
INC-U002. Preservar evidencia puede prolongar el daño; se decide por magnitud del daño en curso.
INC-U003. Comunicar temprano con incertidumbre puede generar alarma; esperar puede incumplir obligaciones o confianza.
INC-U004. Revertir puede perder datos nuevos; reparar hacia adelante puede prolongar la exposición.
INC-U005. Cada decisión difícil se registra con alternativas, razón y responsable.
INC-U006. Las decisiones difíciles se revisan en el postmortem sin culpas, para mejorar criterios.

## Anexo V. Mantenimiento del módulo

INC-V001. El módulo se revisa en cada edición mayor con evidencia de incidentes y ejercicios reales.
INC-V002. Los playbooks se actualizan tras cada incidente que revele un paso faltante.
INC-V003. Las cláusulas sin consecuencia demostrada se retiran sin reutilizar identificadores.
INC-V004. Los contactos y plazos se verifican periódicamente.
INC-V005. La revisión se registra en el changelog.
INC-V006. La responsabilidad editorial corresponde a Pierre R. Boss (oprbguitar).

## Anexo W. Declaración final

INC-W001. Este manual describe cómo quiero responder a incidentes; no declara capacidad operativa existente.
INC-W002. Cada proyecto aporta contactos, permisos, ejercicios y evidencias propias.
INC-W003. Firma editorial: Pierre R. Boss (oprbguitar), con desarrollo documental asistido por IA.

## Anexo X. Playbooks complementarios

### X1. Secuestro de DNS o dominio

INC-X101. Confirmar que los registros DNS apuntan a destinos no autorizados mediante consultas desde varias redes.
INC-X102. Acceder a la cuenta del registrador con autenticación fuerte y restaurar registros correctos.
INC-X103. Rotar credenciales de la cuenta del registrador y revisar sus accesos recientes.
INC-X104. Activar bloqueo de transferencia y protecciones que ofrezca el registrador.
INC-X105. Evaluar si usuarios enviaron credenciales al destino falso y forzar restablecimiento si corresponde.
INC-X106. Revisar certificados emitidos para el dominio durante la ventana y solicitar revocación de los no autorizados.
INC-X107. Comunicar a usuarios con instrucciones claras de verificación.
INC-X108. Caso hipotético: un atacante cambia los servidores de nombres tras comprometer el correo del titular del dominio.
INC-X109. La recuperación requiere verificación de identidad con el registrador y la acción preventiva activa autenticación fuerte y bloqueo de cambios.
INC-X110. Quiero que mi dirección en internet sea tan difícil de robar como mis datos.

### X2. Suplantación de la marca ante usuarios

INC-X201. Recopilar evidencia de los mensajes o sitios que suplantan al producto sin interactuar con enlaces maliciosos.
INC-X202. Alertar a usuarios por canales oficiales con indicaciones para reconocer comunicaciones legítimas.
INC-X203. Reportar el sitio fraudulento a los proveedores de alojamiento y registradores mediante sus canales oficiales.
INC-X204. Revisar si hubo cuentas comprometidas por el engaño y protegerlas.
INC-X205. Reforzar autenticación de correo del dominio cuando falten controles.
INC-X206. Las acciones legales se evalúan con asesoría competente.
INC-X207. Quiero que mis usuarios sepan distinguir mi voz de la de quien me imita.

### X3. Exportación indebida por un usuario interno

INC-X301. Confirmar la exportación con registros de acceso y volumen.
INC-X302. Suspender accesos del usuario de forma proporcional mientras se investiga.
INC-X303. Preservar evidencia con cadena de custodia.
INC-X304. Coordinar con recursos humanos y asesoría competente antes de acciones disciplinarias o legales.
INC-X305. Evaluar obligaciones de notificación según los datos involucrados.
INC-X306. Revisar controles de exportación para limitar volumen y requerir aprobación por encima de umbrales.
INC-X307. Quiero confiar en mi equipo con controles que hagan visible cualquier abuso de esa confianza.

### X4. Extracción automatizada de contenido

INC-X401. Identificar patrones de acceso automatizado por volumen, frecuencia y rutas.
INC-X402. Aplicar limitación por identidad y comportamiento, evitando bloquear a usuarios legítimos.
INC-X403. Revisar si el contenido extraído incluye datos personales o información protegida.
INC-X404. Ajustar autenticación o paginación de rutas que facilitan la extracción masiva.
INC-X405. Las acciones contra terceros se evalúan con asesoría competente.
INC-X406. Quiero proteger mi contenido sin cerrar la puerta a quienes lo usan legítimamente.

### X5. Abuso de API por un socio integrado

INC-X501. Confirmar el patrón anómalo con registros del cliente de API del socio.
INC-X502. Reducir límites de la clave del socio de forma temporal y notificar por el canal acordado.
INC-X503. Revisar si el abuso proviene de un error de integración o de un compromiso de la clave.
INC-X504. Rotar la clave si hay indicios de compromiso.
INC-X505. Acordar corrección con el socio y restablecer límites tras verificar.
INC-X506. Quiero tratar a mis socios con confianza verificable y límites claros.

### X6. Webhook de pago falsificado

INC-X601. Confirmar que los eventos recibidos no superan la verificación de firma o no corresponden a operaciones reales del proveedor.
INC-X602. Verificar que ningún estado económico cambió por eventos no autenticados.
INC-X603. Si algún estado cambió, revertir con reconciliación contra la consulta directa al proveedor.
INC-X604. Revisar la verificación de firma, ventana temporal y deduplicación del receptor.
INC-X605. Rotar el secreto de webhook si existe sospecha de exposición.
INC-X606. Quiero que solo el proveedor real pueda cambiar el estado de un pago en mi sistema.

### X7. Backup fallido descubierto tarde

INC-X701. Determinar desde cuándo fallan los backups y qué puntos de recuperación válidos existen.
INC-X702. Ejecutar un backup manual verificado de inmediato.
INC-X703. Evaluar el riesgo del período sin backups y comunicarlo al responsable.
INC-X704. Corregir la causa y la alerta que no avisó del fallo.
INC-X705. Ejecutar un ensayo de restauración con el nuevo backup.
INC-X706. Quiero enterarme de un backup fallido el mismo día, no el día que lo necesito.

### X8. Equipo portátil perdido o robado

INC-X801. Revocar sesiones, tokens y claves asociadas al equipo.
INC-X802. Rotar credenciales que pudieran estar almacenadas localmente.
INC-X803. Verificar que el disco estaba cifrado y registrar la evidencia.
INC-X804. Activar borrado remoto si la gestión del equipo lo permite.
INC-X805. Revisar accesos desde el equipo tras la pérdida.
INC-X806. Quiero que perder un equipo signifique perder hardware, no datos.

### X9. Notificación de brecha de un proveedor

INC-X901. Obtener del proveedor detalles de alcance, datos afectados y período.
INC-X902. Identificar qué datos del producto estaban en el proveedor y qué credenciales compartidas existen.
INC-X903. Rotar credenciales relacionadas con el proveedor.
INC-X904. Evaluar obligaciones propias de notificación con asesoría competente.
INC-X905. Revisar la relación con el proveedor y alternativas.
INC-X906. Quiero responder a la brecha de un tercero como si fuera propia, porque para mis usuarios lo es.

### X10. Correo de extorsión

INC-X1001. No responder ni pagar sin decisión de la dirección con asesoría competente.
INC-X1002. Verificar si la afirmación es creíble buscando evidencia de compromiso real.
INC-X1003. Preservar el mensaje con encabezados completos como evidencia.
INC-X1004. Si hay evidencia de compromiso, activar el playbook correspondiente.
INC-X1005. Quiero decidir con evidencia, no con miedo.

### X11. Consulta de autoridad o de medios durante un incidente

INC-X1101. Dirigir la consulta al responsable de comunicación y a la asesoría competente.
INC-X1102. Responder solo con hechos verificados y aprobados.
INC-X1103. Registrar la consulta y la respuesta en el expediente del incidente.
INC-X1104. Ningún agente ni operador responde a autoridades o medios por iniciativa propia.
INC-X1105. Quiero hablar hacia afuera con una sola voz, informada y autorizada.

### X12. Error de hora o zona horaria

INC-X1201. Identificar sistemas con reloj desincronizado o conversiones de zona horaria incorrectas.
INC-X1202. Evaluar efectos en tokens, vencimientos, reportes y tareas programadas.
INC-X1203. Corregir la sincronización o la conversión y recalcular datos afectados.
INC-X1204. Revisar registros cuya cronología quedó distorsionada durante la ventana.
INC-X1205. Añadir monitoreo de desviación de reloj y pruebas de conversión con America/Lima.
INC-X1206. Quiero que mi sistema sepa qué hora es para todos mis usuarios.

### X13. Caída del proveedor de identidad

INC-X1301. Confirmar la caída con el estado del proveedor y pruebas propias.
INC-X1302. Mantener sesiones existentes válidas cuando sea seguro y comunicar que nuevos inicios de sesión están afectados.
INC-X1303. Activar acceso de emergencia administrativo documentado y auditado si es imprescindible.
INC-X1304. No crear mecanismos improvisados de autenticación que debiliten la seguridad.
INC-X1305. Tras la recuperación, revisar accesos de emergencia usados y revocarlos.
INC-X1306. Quiero que la caída de mi proveedor de identidad no me obligue a abrir puertas inseguras.

### X14. Cuota agotada en una API de terceros

INC-X1401. Confirmar el agotamiento con las respuestas del proveedor y la consola de cuotas.
INC-X1402. Reducir llamadas no esenciales y activar caché o modo degradado.
INC-X1403. Solicitar ampliación de cuota con autorización cuando implique costo.
INC-X1404. Identificar la causa del consumo: crecimiento legítimo, bucle o abuso.
INC-X1405. Añadir alerta de consumo antes de alcanzar el límite.
INC-X1406. Quiero ver acercarse el límite antes de chocar con él.

## Anexo Y. Responsabilidades por severidad

INC-Y001. SEV1 requiere responsable dedicado, operador técnico, comunicación y actualizaciones frecuentes definidas por el proyecto.
INC-Y002. SEV1 requiere postmortem completo y revisión de acciones por la dirección.
INC-Y003. SEV2 requiere responsable y operador, con comunicación según impacto en clientes.
INC-Y004. SEV2 requiere postmortem y seguimiento de acciones.
INC-Y005. SEV3 puede gestionarse por una persona con registro y actualización al cierre.
INC-Y006. SEV3 requiere postmortem breve cuando revela lecciones.
INC-Y007. SEV4 se registra como evento con acción correctiva si corresponde.
INC-Y008. Las frecuencias y roles concretos se definen en el perfil del producto.

## Anexo Z. Evidencia por tipo de entorno

INC-Z001. Servidores Windows: registros de eventos del sistema, seguridad y aplicaciones, tareas programadas y servicios instalados.
INC-Z002. Servidores Linux: registros del sistema, autenticación, procesos, conexiones de red y tareas programadas.
INC-Z003. Nube: registros de auditoría de la cuenta, cambios de configuración, accesos a almacenamiento y uso de claves.
INC-Z004. Aplicación: registros estructurados de solicitudes, autenticación, autorización y operaciones sensibles.
INC-Z005. Base de datos: registros de consultas administrativas, cambios de esquema y accesos.
INC-Z006. Repositorio y CI: historial de commits, cambios de workflows, ejecuciones y accesos a secretos.
INC-Z007. Agentes: registros de herramientas invocadas, aprobaciones, contexto saneado y versiones.
INC-Z008. Servicios de terceros: registros que el proveedor exponga y solicitudes formales cuando se necesiten.
INC-Z009. La captura usa herramientas nativas y registra comando, hora, operador y hash del resultado.
INC-Z010. La evidencia se minimiza y no incluye secretos completos ni datos personales innecesarios.

## Anexo AA. Preguntas para evaluar notificaciones

INC-AA01. ¿Qué datos se vieron afectados y qué tan sensibles son?
INC-AA02. ¿Cuántos titulares están involucrados y en qué jurisdicciones?
INC-AA03. ¿Hay evidencia de acceso efectivo o solo exposición potencial?
INC-AA04. ¿Qué riesgo concreto enfrentan los titulares?
INC-AA05. ¿Qué contratos con clientes exigen notificación y en qué plazo?
INC-AA06. ¿Qué obligaciones legales aplican según fuente oficial vigente consultada?
INC-AA07. ¿Quién aprueba la decisión y con qué asesoría?
INC-AA08. Las respuestas se registran con fuente y fecha, y la decisión con su responsable.

## Anexo AB. Verificación de medidas temporales

INC-AB01. Cada medida temporal tiene propietario, motivo, alcance, inicio y TTL.
INC-AB02. Cada medida tiene monitoreo de su efecto sobre usuarios legítimos.
INC-AB03. Cada medida tiene procedimiento de retiro probado.
INC-AB04. Las medidas activas se revisan en cada actualización del incidente.
INC-AB05. Al cierre, ninguna medida queda activa sin decisión registrada.

## Anexo AC. Usuarios afectados por medidas defensivas

INC-AC01. Los usuarios bloqueados reciben un mensaje que explica cómo solicitar revisión sin revelar detalles de la regla.
INC-AC02. Las solicitudes de revisión se atienden con prioridad durante el incidente.
INC-AC03. Los desbloqueos se registran con su razón.
INC-AC04. Los patrones de falsos positivos se usan para ajustar la medida en curso.
INC-AC05. Tras el incidente, se evalúa si los usuarios afectados merecen comunicación adicional.

## Anexo AD. Uso de agentes como escribas

INC-AD01. El agente recibe acceso de solo lectura al canal del incidente y al registro.
INC-AD02. El agente propone entradas de cronología con hora y fuente para aprobación del responsable.
INC-AD03. El agente resume el estado cada cierto tiempo para la actualización interna.
INC-AD04. El agente redacta borradores de postmortem a partir del registro.
INC-AD05. El agente no modifica sistemas ni envía comunicaciones.
INC-AD06. El responsable revisa y aprueba lo que el agente redacta antes de usarlo.

## Anexo AE. Relevo de turno

INC-AE01. Estado actual del incidente y severidad.
INC-AE02. Acciones activas con sus TTL y responsables.
INC-AE03. Hipótesis abiertas y evidencia pendiente.
INC-AE04. Comunicaciones comprometidas y su próxima hora.
INC-AE05. Riesgos inmediatos y decisiones pendientes.
INC-AE06. Accesos necesarios para el siguiente turno.
INC-AE07. El relevo se registra con hora y nombres de quien entrega y recibe.

## Anexo AF. Revisión periódica del programa de respuesta

INC-AF01. Se revisan incidentes del período, sus métricas y el estado de acciones preventivas.
INC-AF02. Se verifica que contactos, accesos de emergencia y plantillas estén vigentes.
INC-AF03. Se revisan alertas por utilidad y fatiga generada.
INC-AF04. Se planifican ejercicios para el siguiente período según riesgos actuales.
INC-AF05. Se actualizan playbooks con lecciones aprendidas.
INC-AF06. Se registra la revisión con fecha, participantes y decisiones.
INC-AF07. La revisión se adapta al tamaño del equipo y puede ser breve en proyectos pequeños.

## Anexo AG. Responsabilidad editorial

INC-AG01. Este módulo fue dirigido por Pierre R. Boss (oprbguitar) y desarrollado con asistencia de IA.
INC-AG02. La firma expresa dirección editorial y no certifica capacidad de respuesta de ningún proyecto.
INC-AG03. Las propuestas de cambio se dirigen al propietario con evidencia de incidentes o ejercicios.

## Anexo AH. Casos trabajados adicionales

### AH1. Ataque de volumen contra el sitio público

INC-AH101. El tráfico hacia la página de búsqueda se multiplica por cincuenta desde miles de direcciones en pocos minutos.
INC-AH102. La latencia sube, el servicio de búsqueda satura la base y el resto del sitio se degrada.
INC-AH103. Se declara SEV2 y se activa limitación reforzada en la ruta de búsqueda con TTL de una hora.
INC-AH104. Se habilita respuesta en caché para consultas frecuentes y se reduce la profundidad de resultados.
INC-AH105. El monitoreo de efectos muestra que usuarios autenticados mantienen acceso con latencia aceptable.
INC-AH106. El proveedor de red, contactado por canal oficial, aplica mitigación en el borde.
INC-AH107. Tras dos horas el tráfico vuelve a niveles normales y se retiran medidas gradualmente.
INC-AH108. El postmortem propone separar la base de búsqueda y añadir límites por defecto a rutas costosas.
INC-AH109. El caso es ilustrativo.

### AH2. Dependencia comprometida en el registro de paquetes

INC-AH201. Un aviso público informa que una versión de una biblioteca de utilidades incluye código que envía variables de entorno.
INC-AH202. El inventario confirma que el lockfile fija una versión anterior no afectada en producción.
INC-AH203. Un entorno de desarrollo actualizó dependencias el día anterior y quedó con la versión maliciosa.
INC-AH204. Se aísla el equipo, se rotan las credenciales presentes en sus variables y se revisan accesos recientes.
INC-AH205. Se bloquea la versión maliciosa en la configuración de dependencias del proyecto.
INC-AH206. El postmortem refuerza la política de actualizar dependencias solo mediante cambios revisados con lockfile.
INC-AH207. El caso es ilustrativo.

### AH3. Corrupción por migración defectuosa

INC-AH301. Una migración convierte montos a enteros y trunca céntimos en cien mil registros.
INC-AH302. La reconciliación nocturna detecta diferencias en totales y alerta al responsable financiero.
INC-AH303. Se detienen procesos de facturación y se declara SEV2 de integridad.
INC-AH304. La restauración aislada recupera montos correctos y se comparan con los actuales.
INC-AH305. Se corrigen solo los registros afectados conservando cambios legítimos posteriores.
INC-AH306. Se verifican invariantes de totales por cliente antes de reanudar facturación.
INC-AH307. El postmortem añade prueba de migración con montos decimales y reconciliación previa al despliegue.
INC-AH308. El caso es ilustrativo.

## Anexo AI. Preparación según tipo de producto

INC-AI01. Sitio estático: protección de la cuenta de alojamiento y del dominio, y capacidad de redesplegar desde el repositorio.
INC-AI02. Aplicación web con datos: backups verificados, registros de seguridad, matriz de autorización y playbooks de exposición.
INC-AI03. Aplicación de escritorio en Windows: actualizaciones firmadas, canal de distribución protegido y procedimiento de revocación de versiones.
INC-AI04. Aplicación móvil: compatibilidad con versiones antiguas, mecanismo de aviso y desactivación remota de funciones.
INC-AI05. Producto con pagos: reconciliación, suspensión de cobros y playbook de cobro duplicado.
INC-AI06. Producto con agentes de IA: kill switch, límites de gasto, guardrails y playbook de inyección.
INC-AI07. La preparación se elige con el Capability Profiler según capacidades activas.

## Anexo AJ. Herramientas permitidas durante la respuesta

INC-AJ01. Responsable del incidente: lectura amplia, aprobación de acciones y edición del registro.
INC-AJ02. Operador técnico: acciones aprobadas sobre recursos anunciados.
INC-AJ03. Investigador: lectura de registros y artefactos sin modificación.
INC-AJ04. Comunicación: edición de borradores y publicación con aprobación.
INC-AJ05. Agentes de IA: lectura y redacción de borradores; nunca acciones de alto impacto sin autorización específica.
INC-AJ06. Los accesos de emergencia se revocan al cerrar el incidente.

## Anexo AK. Lecciones de diseño para resiliencia

INC-AK01. Separar volúmenes de registros y datos evita que un problema de registros detenga escrituras críticas.
INC-AK02. Los valores por defecto seguros reducen incidentes por configuración incompleta.
INC-AK03. Las rutas costosas necesitan límites por defecto aunque no haya abuso conocido.
INC-AK04. Los modos degradados preparados permiten mantener funciones esenciales durante fallas de dependencias.
INC-AK05. La idempotencia en efectos externos evita duplicados durante reintentos de recuperación.
INC-AK06. Las copias inmutables convierten el ransomware en un problema recuperable.
INC-AK07. Los agentes con herramientas mínimas limitan el daño de instrucciones inyectadas.
INC-AK08. Las alertas por tendencia detectan problemas antes que las alertas por umbral fijo.
INC-AK09. Cada lección se convierte en cláusula de diseño en el módulo correspondiente.

## Anexo AL. Comprobaciones posteriores al incidente

INC-AL01. A los siete días: verificar que medidas temporales se retiraron y que no hay recurrencia.
INC-AL02. A los siete días: confirmar avance de acciones preventivas de alta prioridad.
INC-AL03. A los treinta días: verificar cierre de acciones preventivas con sus pruebas.
INC-AL04. A los treinta días: revisar si la detección mejorada habría acortado el incidente original.
INC-AL05. A los treinta días: actualizar playbooks y ejercicios con lo aprendido.
INC-AL06. Los plazos son referencias y cada proyecto los ajusta a su ritmo.
INC-AL07. Las comprobaciones se registran en el expediente del incidente.

## Anexo AM. Playbooks breves adicionales

### AM1. Actualización de escritorio defectuosa distribuida

INC-AM101. Detener la distribución de la versión defectuosa en el canal de actualizaciones.
INC-AM102. Publicar la versión anterior verificada como actualización de reversión cuando el mecanismo lo permita.
INC-AM103. Comunicar a usuarios afectados cómo recuperar el funcionamiento.
INC-AM104. Verificar que la reversión no pierde datos locales creados con la versión defectuosa.
INC-AM105. Añadir distribución escalonada para futuras versiones.
INC-AM106. Quiero que una mala actualización llegue a pocos equipos y se corrija rápido.

### AM2. Cola de trabajos detenida

INC-AM201. Confirmar que los consumidores están detenidos y la cola crece.
INC-AM202. Identificar el mensaje o error que bloquea el procesamiento.
INC-AM203. Mover mensajes problemáticos a la cola de errores con registro.
INC-AM204. Reanudar consumidores y verificar que procesan en orden aceptable.
INC-AM205. Reconciliar operaciones afectadas por el retraso.
INC-AM206. Quiero que un mensaje defectuoso no detenga a todos los demás.

### AM3. Fuga de memoria en producción

INC-AM301. Confirmar el crecimiento de memoria con métricas por proceso.
INC-AM302. Reiniciar de forma escalonada como contención temporal registrada.
INC-AM303. Capturar perfil de memoria cuando sea seguro para diagnosticar.
INC-AM304. Corregir la causa y verificar estabilidad durante un período representativo.
INC-AM305. Retirar reinicios programados temporales tras la corrección.
INC-AM306. Quiero corregir fugas, no acostumbrarme a reiniciar.

### AM4. Envío masivo de correos erróneos

INC-AM401. Detener el proceso de envío de inmediato.
INC-AM402. Determinar destinatarios, contenido y datos incluidos.
INC-AM403. Evaluar si se expusieron datos de un usuario a otro.
INC-AM404. Preparar comunicación de corrección con autorización.
INC-AM405. Añadir límites y revisión previa para envíos masivos.
INC-AM406. Quiero que un error de envío alcance a pocos y se corrija con honestidad.

### AM5. Panel administrativo expuesto

INC-AM501. Restringir el acceso al panel de inmediato mediante red o autenticación.
INC-AM502. Revisar accesos al panel durante el período expuesto.
INC-AM503. Revertir cambios no autorizados detectados.
INC-AM504. Rotar credenciales administrativas.
INC-AM505. Añadir verificación externa periódica de rutas administrativas.
INC-AM506. Quiero que las puertas de administración nunca queden abiertas a internet por descuido.

## Anexo AN. Principios resumidos

INC-AN01. Primero reducir el daño con acciones acotadas y reversibles.
INC-AN02. Preservar la verdad de lo ocurrido con evidencia y cronología.
INC-AN03. Nombrar un responsable desde el primer minuto.
INC-AN04. Comunicar hechos confirmados y declarar lo que sigue en investigación.
INC-AN05. Proteger a usuarios legítimos de las medidas defensivas.
INC-AN06. Declarar recuperación solo con criterios verificados.
INC-AN07. Erradicar la causa completa, no solo lo visible.
INC-AN08. Aprender sin culpas y convertir lecciones en controles verificables.
INC-AN09. Usar agentes para pensar más rápido, nunca para decidir solos.
INC-AN10. Mantener al responsable humano al mando de las decisiones de alto impacto.
INC-AN11. Estos principios resumen el módulo y no reemplazan sus cláusulas detalladas.
INC-AN12. Pierre R. Boss (oprbguitar) los establece como criterio de toda respuesta en sus productos.

## Anexo AO. Comprobación rápida de preparación

INC-AO01. ¿Existe un responsable de incidentes designado con suplente para este producto?
INC-AO02. ¿Las alertas críticas llegan a un receptor efectivo en todos los horarios declarados?
INC-AO03. ¿El último ensayo de restauración cumplió su objetivo de tiempo?
INC-AO04. ¿Los accesos de emergencia funcionan y quedan registrados al usarse?
INC-AO05. ¿Las plantillas de comunicación interna y externa están revisadas?
INC-AO06. ¿Los contactos de proveedores críticos y asesoría están vigentes?
INC-AO07. ¿Los playbooks de las capacidades activas existen y fueron ejercitados?
INC-AO08. ¿Los agentes del proyecto tienen herramientas mínimas y un procedimiento de detención?
INC-AO09. ¿El kill switch de IA, si existe, se probó recientemente?
INC-AO10. ¿La reconciliación de pagos, si existe, detectaría un cobro duplicado en un día?
INC-AO11. ¿El registro de incidentes tiene ubicación conocida y plantilla lista?
INC-AO12. ¿Las acciones preventivas de incidentes anteriores están cerradas y verificadas?
INC-AO13. Una respuesta negativa se registra como pendiente con responsable y plazo.
INC-AO14. Esta comprobación se repite en cada revisión periódica del programa.
INC-AO15. La comprobación se adapta al perfil y omite justificadamente lo que no aplica.
INC-AO16. Un agente puede preparar la comprobación con lectura; las respuestas las valida el responsable.
INC-AO17. La preparación declarada sin evidencia se trata como inexistente.
INC-AO18. La comprobación no sustituye ejercicios reales de respuesta.
INC-AO19. Los resultados se conservan en el expediente del programa de respuesta.
INC-AO20. Pierre R. Boss (oprbguitar) espera que cada producto pueda responder sí a lo que le aplica, con evidencia.

## Anexo AP. Vínculo con las plantillas

INC-AP01. [INCIDENT-RECORD](../../templates/INCIDENT-RECORD.md) estructura el registro de cada incidente.
INC-AP02. [FINDING](../../templates/FINDING.md) documenta hallazgos que surgen de la investigación.
INC-AP03. [EXCEPTION](../../templates/EXCEPTION.md) registra medidas temporales que superan su TTL con aprobación.
INC-AP04. [EXEC-PLAN](../../templates/EXEC-PLAN.md) organiza acciones preventivas de varias etapas.
INC-AP05. [RELEASE-RECORD](../../templates/RELEASE-RECORD.md) registra correcciones desplegadas durante la respuesta.
INC-AP06. La skill [eos-incident](../../skills/eos-incident/SKILL.md) concreta el procedimiento para agentes.
INC-AP07. Las plantillas se adaptan al tamaño del incidente sin eliminar campos de evidencia.
INC-AP08. Un incidente pequeño puede usar una versión breve del registro con cronología y acciones.
INC-AP09. Las plantillas completadas se conservan con la retención definida para evidencia.
INC-AP10. Los cambios a plantillas se revisan junto con este módulo.
INC-AP11. Las plantillas llevan la firma editorial de Pierre R. Boss (oprbguitar).
INC-AP12. Las plantillas no contienen datos reales; los registros completados sí, con acceso restringido.
INC-AP13. El orquestador verifica que los registros de incidentes usen la plantilla vigente.
INC-AP14. Las plantillas se escriben en español de Perú para coherencia con la biblioteca.
INC-AP15. Una plantilla que no se usa en la práctica se revisa o se retira.
INC-AP16. Las mejoras a plantillas provienen de dificultades registradas al usarlas en incidentes o ejercicios.
INC-AP17. Este anexo cierra la Parte II del módulo de respuesta a incidentes.

# Migración progresiva, portabilidad y transferencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

**Origen:** SRC-03 §§5, 23–24, 84–92, 116 y 147; SRC-04 §§33–35; SRC-02 §§30–34. **Constitución:** §§58–59, 76–78 y 93. **Estado:** procedimiento reutilizable; ningún cambio de plataforma o transferencia a terceros se ejecuta solo por existir este manual.

## 1. La migración empieza con una causa comprobable

Documenta qué problema requiere migrar: incompatibilidad, fin de soporte, límites demostrados del runtime, requisitos de privacidad, costo, necesidad de mantenimiento o capacidad que el sistema actual no puede cubrir razonablemente. El crecimiento de usuarios o la aparición de un framework nuevo son señales para investigar, no razones suficientes para reescribir.

Compara permanecer y optimizar, sustituir un componente y migrar un dominio. La opción de no migrar conserva un papel legítimo. Incluye costo de transición, doble operación, formación, incidentes posibles, licencias, contratos y reversión. Si la alternativa nueva no demuestra valor en un ensayo representativo, conserva la evaluación en ASSESS o HOLD.

El propietario aprueba el alcance de cambios sensibles o externos. El Migration Architect diseña fases. System Archaeologist reconstruye comportamiento. Data Architect conserva integridad. Integration Architect compara consumidores. SRE ensaya continuidad. Handoff Auditor comprueba que el receptor pueda operar. Un developer implementa los componentes asignados. Los roles pueden combinarse proporcionalmente, pero los riesgos importantes requieren contraste independiente cuando el entorno lo permita.

## 2. Arqueología de un sistema existente

Inventaría código, versiones, despliegues, configuración, usuarios/roles, rutas, procesos, datos, jobs, integraciones, archivos y dependencias. Inspecciona documentación y verifica qué coincide con la implementación. Un README desactualizado es una pista; no lo conviertas en arquitectura real sin leer el código y observar el comportamiento.

Identifica reglas de negocio: quién puede realizar qué acción, estados permitidos, unidades, redondeos, plazos, horarios, límites, consecuencias y excepciones. Distingue reglas declaradas, reglas observadas y defectos conocidos. Si una regla carece de dueño, registra el bloqueo de decisión; un agente no inventa una política financiera o institucional.

Registra activos sensibles mediante rutas y categorías mínimas, sin volcar su contenido en tickets o logs. Descubrir una base de datos privada no autoriza copiarla al repo. El baseline utiliza datasets sintéticos o muestras autorizadas y minimizadas. Preserva el estado de trabajo y no ejecutes `reset --hard`, `clean`, sobrescrituras o stash automático para facilitar una migración.

## 3. Caracterización y equivalencia

Construye casos que capturen el comportamiento antes del cambio. Cada caso contiene entrada, precondiciones, actor, operación, salida, estado persistido y efecto externo. Determina qué equivalencia se necesita: exacta, semántica o con tolerancia explícita. Un resumen de IA no puede declararse equivalente a una salida determinista solo porque ambos parecen plausibles.

| Dimensión | Comparación mínima |
|---|---|
| Funcional | Mismos casos de negocio y errores importantes |
| Autorización | Acceso permitido y denegado por usuario/tenant/rol |
| Datos | Cantidades, constraints, referencias, claves, formatos y estados |
| Operación | Jobs, retry, cuotas, health y recuperabilidad |
| Rendimiento | Latencia, recursos y costos con cargas comparables |
| UX | Flujos, foco, móvil, accesibilidad y mensajes |
| Integraciones | Contratos, eventos, idempotencia y compatibilidad |
| Privacidad | Destinos, retención, permisos y propagación de borrado |

No exijas igualdad byte a byte cuando el contrato solo define equivalencia semántica. No reduzcas la comparación a conteos cuando importan importes, relaciones y permisos. Las tolerancias tienen motivo, dueño y criterio de fallo; no se amplían después del resultado para forzar aprobación.

## 4. Elegir el patrón de transición

**Strangler Fig:** redirige un dominio o ruta al componente nuevo mientras el resto sigue en el sistema existente. Declara ownership de datos y evita dos escrituras autoritativas inadvertidas.

**Branch by Abstraction:** introduce una interfaz para sustituir implementación sin cambiar consumidores. Prueba ambas implementaciones contra el mismo contrato y conserva una bandera controlada.

**Anti-Corruption Layer:** transforma formatos y semántica del sistema anterior. Los mappings tienen ejemplos, errores y límites; una traducción silenciosa de estados puede perder obligaciones.

**Parallel Run:** compara resultados con side effects aislados. Es útil para lecturas y cálculos, pero no puede cobrar, enviar correo o modificar expedientes dos veces. Los efectos externos del sistema sombra deben estar bloqueados o simulados con pruebas de aislamiento.

Elige un patrón por frontera real y registra ADR. Un Big Bang solo se evalúa si restricciones concretas descartan alternativas graduales; necesita ventana, recuperación, validación y autorización explícitas.

## 5. Datos, migraciones y sincronización

Define formato de origen/destino, invariantes, mapping de claves, unidades, zona horaria, encoding, nulabilidad y transformaciones. Documenta qué datos se descartan y con qué autorización. Nunca uses «limpiar» como permiso genérico para eliminar registros problemáticos.

Prefiere expand/contract: añade estructuras compatibles, despliega lectores/escritores preparados, migra en lotes verificables y retira lo viejo después de confirmar ausencia de consumidores. Cada lote registra checkpoint, cantidad, checksum o reconciliación apropiada, errores y reanudación. La ejecución debe poder repetirse de forma segura.

Una copia inicial seguida de cambios concurrentes exige un plan de delta, ventana o sincronización. El rollback puede requerir mappings inversos o forward repair. Un backup previo no asegura que se pueda volver sin perder transacciones ocurridas durante la transición. Especialmente en pagos, una restauración no debe borrar historia financiera válida.

Ensaya restauración aislada y conserva RPO/RTO medidos para el ejercicio. El plan identifica quién tiene acceso a claves y backups, dónde se recupera y cómo se valida integridad. Un archivo de backup encontrado no constituye una prueba de recuperación.

## 6. Canary, promoción y retorno

La fase canary define población, rutas, duración, tamaño de muestra, métricas de salud, eventos prohibidos y condición de promoción. Los porcentajes son elegidos para el producto; no uses un 5% universal sin tráfico suficiente. Combina percentiles, tasa de errores, invariantes de negocio y comparación de datos. Una única prueba exitosa no prueba estabilidad bajo carga.

Asocia cada versión a artifact digest/commit y configuración. Promueve el mismo artefacto verificado, o vuelve a verificar si se recompila. Captura dependencias externas y cambios de esquema relevantes. No expliques un fallo comparando un build local con otro commit desplegado.

Antes de ejecutar define retorno: qué componente vuelve, cómo se conserva el dato nuevo, qué consumidores seguirán compatibles, quién decide y qué criterio lo activa. Si el retorno no es seguro después de una fase, declara ese punto irreversible y requiere autorización correspondiente. «Rollback disponible» necesita un ensayo o límites concretos, no una frase.

## 7. Sustituir proveedores

Para IA usa [AI-GATEWAY](AI-GATEWAY.md): capacidad, formato, datos, embeddings, tool calls, calidad, costos y licencias se revalidan. Cambiar un endpoint no prueba equivalencia. Un proveedor alternativo puede devolver otra dimensión de embedding, usar un formato incompatible o tener restricciones contractuales diferentes.

Para pagos usa [PAYMENTS](PAYMENTS.md): transacciones inciertas se reconcilian antes de reenviarse. Mantén referencias del proveedor antiguo para devoluciones, disputas y auditoría. Desactivar nuevos cobros no implica poder borrar el adapter o sus credenciales de consulta inmediatamente.

Para storage usa [STORAGE-DATA](STORAGE-DATA.md): ownership, checksums, egress, cifrado, permisos, URLs, retención y eliminación se comparan. Para conectores, registra límites, APIs sunset y formatos de error. La salida incluye datos exportables y documentación que permita otro cambio futuro.

## 8. Handoff pensado para el receptor

El paquete se adapta a quién mantendrá el producto. Un equipo que usa Java y PostgreSQL puede preferir contratos y herramientas distintas de una persona que ejecuta un visor local en Windows. No impongas sofisticación que solo el autor conoce. La arquitectura elegida debe poder operarse con habilidades, presupuesto y acceso del receptor.

Incluye propósito, flujos, mapa de módulos, versiones, instalación, ejecución, configuración sin secretos, variables requeridas, datos y ubicación, contratos, deploy, rollback, backup, restore, observabilidad, permisos, pruebas, incidencias conocidas, licencias, decisiones y actualización. Usa rutas precisas y comandos específicos al entorno. Si un archivo contiene datos privados, referencia su ubicación local y política de acceso; no lo publiques para hacer el handoff cómodo.

Las credenciales se transfieren mediante el mecanismo seguro autorizado, con acceso mínimo y rotación cuando corresponda. El repositorio incluye placeholders, no claves reales. Documenta dependencias de cuentas, dominios, certificados y proveedores. Un sistema que corre solo con la sesión del autor conserva una dependencia operativa que debe resolverse.

## 9. Ejercicio Windows reproducible

Esta secuencia es un procedimiento, no un instalador ejecutado por este repositorio:

1. El receptor recibe el commit o release exacto y verifica su procedencia.
2. Abre PowerShell en la carpeta acordada y confirma versiones requeridas; no instala runtimes arbitrariamente.
3. Copia la configuración de ejemplo al archivo local ignorado y obtiene secretos por canal autorizado.
4. Identifica rutas absolutas de datos, backups y logs; comprueba permisos y espacio.
5. Ejecuta el launcher documentado o comando de arranque y observa el health real.
6. Completa un flujo permitido y uno denegado desde una sesión real cuando aplica.
7. Ejecuta pruebas de soporte y verifica su scope.
8. Detiene y reinicia; comprueba persistencia y límites de shutdown.
9. Ensaya recuperación en un destino aislado, nunca sobre producción por defecto.
10. Registra qué pudo hacer sin asistencia, qué faltó y cómo se corrigió.

Si el producto necesita un launcher Windows, debe respetar argumentos, rutas con espacios, logs, procesos existentes y secretos. Un archivo `.bat` que abre una consola no prueba que el backend esté disponible. Un túnel HTTPS necesita validación del enlace real y del flujo autenticado, dentro del alcance autorizado.

## 10. Gate de transferencia

Usa [HANDOFF-CHECKLIST](../../templates/HANDOFF-CHECKLIST.md). El receptor debe iniciar, usar, detener, diagnosticar y restaurar el sistema con documentación. Los pasos que solo el autor puede ejecutar se registran como pendientes. La transferencia de propiedad, cuentas o licencias exige su propio alcance contractual y autorización.

| Situación | Fallo que debe detectar el gate | Resultado necesario |
|---|---|---|
| Nueva DB tiene el mismo número de filas | Relaciones o importes incorrectos | Reconciliación de invariantes |
| Shadow envía un correo real | Side effects no aislados | Aislamiento y prueba negativa |
| App funciona con sesión del autor | Dependencia de credenciales personales | Cuenta y acceso revisados |
| Rollback requiere perder pagos | Retorno incompatible | Forward repair o decisión explícita |
| Launcher pierde ruta con espacios | Operación no reproducible | Arranque probado por receptor |
| Receptor no puede recuperar backup | Entrega incompleta | Ensayo de restore documentado |

La migración termina cuando el comportamiento acordado, los datos, la operación y la recuperación se verifican en el destino. El handoff termina cuando el receptor puede mantenerlo y reconoce los pendientes; un push por sí solo no satisface ninguno de esos dos criterios.

---

# Parte II — Especificación 3.0.0 de migración y transferencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

La Parte I conserva los diez contratos previos. Esta Parte II los desarrolla con cláusulas MIG estables, estados, invariantes, fallos, casos hipotéticos y criterios de aceptación. Ninguna cláusula ejecuta una migración ni una transferencia por existir en este documento.

## 11. Caso de negocio y decisión de migrar

MIG-1101. La propuesta de migración comienza describiendo el problema actual con evidencia medible, no con la preferencia por una tecnología nueva.
MIG-1102. La evidencia incluye métricas de fallos, costos, límites alcanzados, avisos de fin de soporte o requisitos que el sistema actual no puede cumplir.
MIG-1103. La propuesta compara al menos tres opciones: permanecer y optimizar, sustituir un componente acotado y migrar un dominio completo.
MIG-1104. Cada opción estima costo de transición, período de doble operación, formación del equipo, riesgo de incidentes y costo de salida futura.
MIG-1105. La opción de no migrar se evalúa con la misma seriedad, porque conservar un sistema conocido puede ser la decisión más segura.
MIG-1106. Los beneficios esperados se expresan como resultados verificables, por ejemplo latencia objetivo, costo mensual o eliminación de una dependencia sin soporte.
MIG-1107. Los riesgos se enumeran con probabilidad cualitativa, consecuencia, mitigación y señal temprana que indicaría su materialización.
MIG-1108. La decisión se registra como ADR con alternativas descartadas, razones, consecuencias aceptadas y fecha de revisión.
MIG-1109. El responsable del producto aprueba la migración; un agente puede preparar la propuesta pero no decidirla.
MIG-1110. Una migración sin criterio de éxito verificable no se inicia, porque nunca podría declararse terminada con honestidad.
MIG-1111. El alcance excluye explícitamente lo que no se migrará para evitar crecimiento silencioso durante la ejecución.
MIG-1112. La propuesta identifica quién mantendrá el sistema resultante y si tiene capacidad para operar la tecnología elegida.
MIG-1113. Caso hipotético: un equipo propone reescribir una aplicación estable porque el framework parece anticuado.
MIG-1114. La evaluación muestra que el framework tiene soporte vigente y que los problemas reales están en consultas lentas medibles.
MIG-1115. La decisión registrada es optimizar consultas y revisar de nuevo en un año, sin migración de framework.
MIG-1116. La aceptación verifica que las consultas optimizadas cumplen la latencia objetivo que motivaba la propuesta.
MIG-1117. Las migraciones motivadas por fin de soporte se planifican con margen antes de la fecha límite verificada en fuente oficial.
MIG-1118. Las fechas de fin de soporte se registran con fuente primaria y fecha de consulta, porque los proveedores las modifican.
MIG-1119. Una migración por costo se respalda con facturación real y tarifas verificadas del destino, no con estimaciones comerciales.
MIG-1120. Quiero migrar cuando la evidencia lo exige y quedarme cuando la evidencia demuestra que lo actual funciona.

## 12. Inventario arqueológico detallado

MIG-1201. El inventario registra componentes, lenguajes, versiones, frameworks, bibliotecas, servicios, procesos programados y scripts operativos.
MIG-1202. Registra despliegues reales: servidores, contenedores, servicios de nube, variables de entorno por nombre y dependencias de red.
MIG-1203. Registra datos: bases, tablas, volúmenes, archivos, colas, cachés y almacenes de terceros, con tamaño medido y responsable.
MIG-1204. Registra integraciones entrantes y salientes con contrato, autenticación, frecuencia, volumen y propietario externo.
MIG-1205. Registra usuarios, roles y permisos efectivos, distinguiendo los documentados de los observados en configuración.
MIG-1206. Registra procesos manuales que operadores realizan regularmente y que el sistema no documenta.
MIG-1207. Registra conocimiento implícito obtenido en entrevistas con usuarios y operadores, con fecha y fuente.
MIG-1208. Cada elemento del inventario indica cómo se verificó: lectura de código, configuración, ejecución observada o entrevista.
MIG-1209. Los elementos no verificados se marcan como pendientes con responsable y método propuesto de verificación.
MIG-1210. El inventario usa rutas y categorías para activos sensibles sin copiar su contenido a documentos o tickets.
MIG-1211. El acceso al sistema analizado se limita a lectura salvo autorización para entornos de prueba.
MIG-1212. Los procesos programados se inventarían con horario, duración, efectos y dependencias, porque suelen olvidarse en migraciones.
MIG-1213. Los certificados, dominios y cuentas externas asociados al sistema se inventarían con fecha de expiración y responsable.
MIG-1214. Caso hipotético: tras migrar, un reporte mensual deja de enviarse porque dependía de una tarea programada no inventariada.
MIG-1215. La corrección del proceso exige revisar programadores del sistema operativo y del servidor de aplicaciones durante la arqueología.
MIG-1216. La aceptación verifica que el inventario incluye todas las tareas programadas encontradas en las fuentes revisadas.
MIG-1217. El arqueólogo entrega un mapa del sistema con componentes, flujos de datos y fronteras de confianza.
MIG-1218. El mapa distingue lo observado de lo supuesto mediante etiquetas visibles.
MIG-1219. Un agente puede ejecutar la arqueología de solo lectura con nivel A0, registrando cada fuente consultada.
MIG-1220. Quiero conocer el sistema que voy a cambiar mejor que quienes lo construyeron, antes de tocar una línea.

## 13. Reglas de negocio implícitas

MIG-1301. Las reglas de negocio se buscan en código, consultas almacenadas, triggers, configuración, plantillas, datos y procesos manuales.
MIG-1302. Cada regla se registra con condición, efecto, excepciones, fuente encontrada y ejemplo verificable.
MIG-1303. Se distinguen reglas declaradas por el negocio, reglas observadas en el sistema y reglas accidentales producidas por defectos.
MIG-1304. Una regla accidental no se replica automáticamente; el responsable decide si conservarla, corregirla o eliminarla.
MIG-1305. Los redondeos, conversiones de moneda, zonas horarias y cálculos de plazos se documentan con ejemplos numéricos.
MIG-1306. Los estados permitidos y sus transiciones se reconstruyen como máquina de estados verificable.
MIG-1307. Las validaciones distribuidas entre interfaz, servidor y base se consolidan para no perder ninguna en la migración.
MIG-1308. Las reglas codificadas en datos, como tablas de parámetros, se migran con su historia cuando afectan decisiones pasadas.
MIG-1309. Caso hipotético: el sistema antiguo redondea comisiones hacia arriba en un trigger que nadie recordaba.
MIG-1310. El sistema nuevo redondea al más cercano y los totales mensuales difieren en pequeñas cantidades que generan reclamos.
MIG-1311. La arqueología habría encontrado el trigger; la corrección añade búsqueda de triggers y procedimientos al inventario.
MIG-1312. El responsable decide conservar el redondeo hacia arriba por contrato vigente y la prueba de caracterización lo protege.
MIG-1313. La aceptación compara comisiones de un mes histórico en ambos sistemas y verifica coincidencia exacta.
MIG-1314. Las reglas confirmadas se incorporan a la documentación del sistema nuevo con su fuente y decisión.
MIG-1315. Las reglas descartadas se registran con la razón, para responder preguntas futuras de usuarios.
MIG-1316. Quiero que ninguna regla de negocio desaparezca en una migración sin que alguien lo haya decidido.

## 14. Pruebas de caracterización

MIG-1401. Las pruebas de caracterización capturan el comportamiento actual antes de cualquier cambio, aunque ese comportamiento tenga defectos.
MIG-1402. Cada caso registra entrada, precondiciones, actor, operación, salida, estado persistido y efectos externos.
MIG-1403. Los casos se priorizan por criticidad del flujo, frecuencia de uso y riesgo de regresión.
MIG-1404. Los efectos externos se aíslan con dobles de prueba para no enviar correos, cobros o mensajes reales durante la captura.
MIG-1405. Los datos de caracterización son sintéticos o anonimizados y representan casos normales, límites y errores.
MIG-1406. Las salidas no deterministas, como fechas o identificadores, se normalizan antes de comparar.
MIG-1407. Un defecto descubierto durante la caracterización se registra y el responsable decide si el sistema nuevo lo reproduce o lo corrige.
MIG-1408. Las pruebas de caracterización se ejecutan contra el sistema nuevo con el mismo conjunto de casos.
MIG-1409. Las diferencias se clasifican como regresión, corrección intencional o diferencia aceptable con tolerancia justificada.
MIG-1410. Caso hipotético: la caracterización de un cálculo de impuestos revela que el sistema antiguo falla con montos de más de seis cifras.
MIG-1411. El responsable decide corregir en el sistema nuevo y la diferencia se documenta como corrección intencional.
MIG-1412. La aceptación verifica que todos los demás casos coinciden y que el caso corregido produce el valor esperado.
MIG-1413. Las pruebas de caracterización se conservan como pruebas de regresión del sistema nuevo tras la migración.
MIG-1414. Quiero saber exactamente qué hace mi sistema hoy antes de prometer que el nuevo hará lo mismo.

## 15. Equivalencia por dimensión

MIG-1501. La equivalencia funcional compara casos de negocio y errores relevantes con resultados idénticos o diferencias decididas.
MIG-1502. La equivalencia de autorización compara accesos permitidos y denegados para cada combinación de rol, tenant y recurso.
MIG-1503. La equivalencia de datos compara conteos, sumas, restricciones, referencias, formatos y estados, no solo número de filas.
MIG-1504. La equivalencia operativa compara procesos programados, reintentos, cuotas, salud y procedimientos de recuperación.
MIG-1505. La equivalencia de rendimiento compara latencia, uso de recursos y costo bajo cargas comparables medidas.
MIG-1506. La equivalencia de experiencia compara flujos, accesibilidad, foco, comportamiento móvil y mensajes de error.
MIG-1507. La equivalencia de integraciones compara contratos, eventos, idempotencia y compatibilidad con consumidores.
MIG-1508. La equivalencia de privacidad compara destinos de datos, retención, permisos y propagación de borrados.
MIG-1509. Cada dimensión declara tolerancia aceptable con justificación y responsable que la aprobó.
MIG-1510. Una dimensión no evaluada se declara como tal; no se asume equivalente por omisión.
MIG-1511. Caso hipotético: la migración conserva conteos de usuarios, pero los roles de administradores regionales no se trasladan.
MIG-1512. La prueba de equivalencia de autorización detecta que esos usuarios pierden acceso a sus regiones.
MIG-1513. La corrección añade el mapeo de roles faltante y la prueba se repite para todas las combinaciones de rol y región.
MIG-1514. La aceptación de la migración exige evidencia de cada dimensión aplicable.
MIG-1515. Quiero equivalencia demostrada en todo lo que importa, no solo en lo fácil de contar.

## 16. Patrón de estrangulamiento progresivo

MIG-1601. El estrangulamiento redirige una ruta o dominio al sistema nuevo mientras el resto permanece en el sistema existente.
MIG-1602. Cada dominio redirigido tiene un único sistema autoritativo para sus escrituras en cada momento de la transición.
MIG-1603. El enrutamiento se controla con configuración reversible que permite volver al sistema antiguo sin despliegue.
MIG-1604. Los datos compartidos entre dominios migrados y no migrados se sincronizan con dirección y propietario definidos.
MIG-1605. Los dominios se eligen en orden de menor acoplamiento y mayor aprendizaje para reducir riesgo inicial.
MIG-1606. Cada dominio migrado pasa caracterización, equivalencia y canary antes de redirigir todo su tráfico.
MIG-1607. El sistema antiguo se retira solo cuando ningún dominio depende de él y sus datos están migrados o archivados.
MIG-1608. La fachada de enrutamiento registra qué sistema atendió cada solicitud para diagnosticar diferencias.
MIG-1609. Caso hipotético: el catálogo se migra al sistema nuevo mientras los pedidos siguen en el antiguo.
MIG-1610. Los pedidos leen precios del catálogo nuevo mediante una API con contrato versionado y caché controlada.
MIG-1611. Una diferencia de precio entre sistemas se detecta por la reconciliación diaria y se corrige antes de afectar facturas.
MIG-1612. La aceptación del dominio de catálogo verifica precios idénticos en una muestra de pedidos durante dos semanas.
MIG-1613. Los plazos del caso son ilustrativos y cada proyecto fija los suyos por riesgo y volumen.
MIG-1614. Quiero migrar por partes que pueda verificar y revertir, no de una vez sin red.

## 17. Patrón de rama por abstracción

MIG-1701. La rama por abstracción introduce una interfaz entre consumidores y la implementación que se sustituirá.
MIG-1702. La interfaz se diseña con el contrato que necesitan los consumidores, no con la forma de la implementación antigua.
MIG-1703. Ambas implementaciones se prueban contra el mismo conjunto de pruebas de contrato.
MIG-1704. Una bandera controla qué implementación atiende a cada consumidor o porcentaje de tráfico.
MIG-1705. La implementación antigua se retira cuando la nueva atiende todo el tráfico durante el período de estabilidad acordado.
MIG-1706. La interfaz se conserva tras la migración si facilita sustituciones futuras, o se simplifica si añade complejidad sin beneficio.
MIG-1707. Caso hipotético: el envío de correos se abstrae detrás de una interfaz para cambiar de proveedor.
MIG-1708. Las pruebas de contrato verifican plantillas, adjuntos, errores y reintentos en ambas implementaciones con dobles de prueba.
MIG-1709. La bandera envía primero correos internos por el proveedor nuevo y luego un porcentaje creciente de clientes.
MIG-1710. La aceptación compara tasas de entrega y rebote entre proveedores con datos reales del período.
MIG-1711. Quiero sustituir piezas sin que el resto del sistema note el cambio.

## 18. Capa anticorrupción

MIG-1801. La capa anticorrupción traduce formatos y semántica entre el sistema antiguo y el nuevo para que el nuevo no herede conceptos defectuosos.
MIG-1802. Cada traducción tiene ejemplos, casos de error y límites documentados.
MIG-1803. Las traducciones de estados conservan obligaciones asociadas; perder un estado puede perder un compromiso con el cliente.
MIG-1804. Los valores sin equivalente en el sistema nuevo se reportan, no se convierten silenciosamente en un valor por defecto.
MIG-1805. La capa registra traducciones fallidas para análisis y corrección.
MIG-1806. La capa se prueba con datos históricos representativos, incluidos registros antiguos con formatos obsoletos.
MIG-1807. Caso hipotético: el sistema antiguo tiene un estado de pedido suspendido por fraude que el nuevo no contempla.
MIG-1808. La capa traduce ese estado a cancelado y se pierde la obligación de revisar el caso con el área de riesgo.
MIG-1809. La corrección añade el estado en el sistema nuevo o una marca equivalente con flujo de revisión.
MIG-1810. La aceptación migra pedidos de prueba con ese estado y verifica que aparecen en la cola de revisión.
MIG-1811. Quiero traducir entre sistemas sin perder significados que alguien necesitará después.

## 19. Ejecución en paralelo y comparación en sombra

MIG-1901. La ejecución en paralelo procesa las mismas entradas en ambos sistemas y compara resultados sin efectos externos duplicados.
MIG-1902. El sistema en sombra no envía correos, no cobra, no modifica expedientes reales ni llama a integraciones con efecto.
MIG-1903. Los efectos externos del sistema en sombra se sustituyen por registros de intención para compararlos con los efectos reales.
MIG-1904. Las diferencias se clasifican y se investigan antes de promover el sistema nuevo.
MIG-1905. La comparación se ejecuta durante un período que cubra ciclos de negocio relevantes, como cierres mensuales.
MIG-1906. El costo de ejecutar en paralelo se presupuesta y se limita en duración.
MIG-1907. Los datos procesados en sombra siguen las mismas reglas de privacidad que en producción.
MIG-1908. Caso hipotético: un sistema de cálculo de nómina nuevo se ejecuta en sombra durante tres periodos de pago.
MIG-1909. La comparación revela diferencias en horas extra nocturnas por una regla de recargo mal interpretada.
MIG-1910. La regla se corrige con la definición del responsable y el tercer periodo coincide completamente.
MIG-1911. La aceptación exige un periodo completo sin diferencias no explicadas antes de promover.
MIG-1912. Quiero ver al sistema nuevo acertar con datos reales antes de confiarle consecuencias reales.

## 20. Migración en un solo corte

MIG-2001. El corte único se evalúa solo cuando restricciones concretas descartan alternativas graduales, como imposibilidad técnica de coexistencia.
MIG-2002. El plan define ventana, secuencia, responsables, verificaciones, criterios de abortar y procedimiento de retorno.
MIG-2003. El corte se ensaya completo en un entorno representativo con datos de volumen comparable.
MIG-2004. El ensayo mide duración de cada paso y la ventana se dimensiona con margen sobre lo medido.
MIG-2005. Los criterios de abortar se fijan antes del corte y no se relajan durante la ejecución por presión del tiempo.
MIG-2006. La comunicación a usuarios anuncia ventana, impacto y canal de soporte con anticipación.
MIG-2007. El sistema antiguo se conserva intacto en solo lectura durante el período de retorno.
MIG-2008. Caso hipotético: un corte planificado de cuatro horas supera las tres horas al llegar a la migración de adjuntos.
MIG-2009. El criterio de abortar por tiempo se activa, se ejecuta el retorno ensayado y el sistema antiguo vuelve a operar.
MIG-2010. El análisis posterior divide la migración de adjuntos en una copia previa con delta durante el corte.
MIG-2011. La aceptación del segundo intento verifica duración dentro de la ventana con el procedimiento revisado.
MIG-2012. Quiero cortes únicos solo cuando no hay alternativa, ensayados hasta que sean aburridos.

## 21. Mapeo y transformación de datos

MIG-2101. El mapeo documenta cada campo de origen con su destino, transformación, validación y tratamiento de valores inválidos.
MIG-2102. Las claves se mapean con tabla de correspondencia conservada para trazabilidad y reconciliación.
MIG-2103. Las unidades, zonas horarias, codificación y nulabilidad se documentan y se prueban con casos límite.
MIG-2104. Los datos descartados se enumeran con autorización del responsable y retención del original si corresponde.
MIG-2105. Las transformaciones se implementan como código versionado con pruebas, no como operaciones manuales.
MIG-2106. Las transformaciones se ejecutan primero sobre copia anonimizada para medir duración y errores.
MIG-2107. Los registros rechazados se reportan con motivo y se resuelven antes de completar la migración.
MIG-2108. La reconciliación final compara conteos, sumas por grupo, referencias e invariantes entre origen y destino.
MIG-2109. Caso hipotético: las fechas de nacimiento se almacenan como texto en formatos mixtos en el sistema antiguo.
MIG-2110. La transformación reconoce formatos conocidos, rechaza ambiguos y los reporta para corrección manual.
MIG-2111. La aceptación verifica que ningún registro ambiguo se migró con una interpretación no confirmada.
MIG-2112. Quiero que cada dato migrado tenga un camino documentado desde su origen hasta su destino.

## 22. Expansión y contracción

MIG-2201. La expansión añade estructuras nuevas compatibles con el código existente sin eliminar las antiguas.
MIG-2202. El código se despliega para escribir en ambas estructuras y leer de la antigua durante la transición.
MIG-2203. Los datos históricos se migran por lotes verificables a la estructura nueva.
MIG-2204. Las lecturas se cambian a la estructura nueva tras verificar coherencia completa.
MIG-2205. Las escrituras a la estructura antigua se detienen después de un período de estabilidad.
MIG-2206. La contracción elimina la estructura antigua solo tras confirmar ausencia de consumidores.
MIG-2207. Cada paso puede revertirse de forma independiente hasta la contracción.
MIG-2208. La contracción se respalda con backup verificado antes de eliminar estructuras.
MIG-2209. Caso hipotético: una columna de dirección única se divide en calle, número y distrito.
MIG-2210. Durante la transición se escriben ambos formatos y la reconciliación verifica que coinciden.
MIG-2211. La aceptación de la contracción confirma que ningún reporte ni integración lee la columna antigua.
MIG-2212. Quiero cambiar estructuras sin un solo momento en que el sistema no sepa dónde están sus datos.

## 23. Sincronización de cambios y corte final

MIG-2301. Una copia inicial grande se complementa con sincronización de cambios ocurridos durante la copia.
MIG-2302. El mecanismo de captura de cambios se elige por capacidades del origen y se prueba con carga representativa.
MIG-2303. El corte final detiene escrituras en el origen, aplica el último delta, reconcilia y habilita el destino.
MIG-2304. La duración de la detención de escrituras se mide en ensayo y se comunica a los usuarios.
MIG-2305. Los cambios que llegan durante el corte se rechazan con mensaje claro o se encolan con garantía de aplicación.
MIG-2306. La reconciliación del corte usa invariantes y sumas, no solo conteos.
MIG-2307. Caso hipotético: la copia inicial de una base de 200 GB tarda diez horas y los usuarios siguen trabajando.
MIG-2308. La captura de cambios replica las modificaciones y el corte final dura quince minutos de solo lectura.
MIG-2309. La aceptación verifica que el último pedido registrado antes del corte aparece en el destino con todos sus datos.
MIG-2310. Las cifras del caso son ilustrativas.
MIG-2311. Quiero cortes cortos porque el trabajo pesado se hizo antes, con el sistema todavía en servicio.

## 24. Retorno, reparación hacia adelante y puntos de no retorno

MIG-2401. Cada fase declara si su retorno es posible, cómo se ejecuta, qué datos nuevos se conservan y quién lo decide.
MIG-2402. Un punto de no retorno se identifica explícitamente y requiere aprobación del responsable antes de cruzarlo.
MIG-2403. Cuando el retorno perdería datos nuevos, se prepara reparación hacia adelante como alternativa documentada.
MIG-2404. El retorno se ensaya en entorno representativo antes de iniciar la fase correspondiente en producción.
MIG-2405. Los criterios que activan el retorno son observables y se fijan antes de la fase.
MIG-2406. Un retorno ejecutado registra causa, duración, datos afectados y lecciones para el siguiente intento.
MIG-2407. Los datos creados en el sistema nuevo durante una fase revertida se migran de vuelta o se reingresan con procedimiento.
MIG-2408. Caso hipotético: tras dos días en el sistema nuevo se detecta un defecto grave y retornar perdería pedidos recientes.
MIG-2409. La reparación hacia adelante corrige el defecto en el sistema nuevo con un parche probado en pocas horas.
MIG-2410. La decisión se registra con la comparación entre retornar y reparar, y su aprobación por el responsable.
MIG-2411. Quiero saber antes de cada paso cómo volver atrás, o saber con certeza que ya no puedo.

## 25. Canary de migración

MIG-2501. El canary define población, rutas, duración, métricas de salud, eventos prohibidos y condición de promoción.
MIG-2502. La población inicial se elige por bajo riesgo y alta capacidad de observación, como usuarios internos.
MIG-2503. Las métricas comparan la población canary con la de control durante el mismo período.
MIG-2504. Un evento prohibido, como pérdida de datos o acceso indebido, detiene el canary de inmediato.
MIG-2505. La promoción ocurre por escalones con verificación en cada uno.
MIG-2506. El tamaño de muestra se dimensiona para detectar diferencias relevantes, no se elige por costumbre.
MIG-2507. El mismo artefacto verificado se promueve; un rebuild requiere nueva verificación.
MIG-2508. Caso hipotético: el canary al diez por ciento muestra latencia aceptable pero errores de exportación en un navegador antiguo.
MIG-2509. El canary se detiene en ese escalón, se corrige la compatibilidad y se repite desde el escalón anterior.
MIG-2510. Quiero exponer el sistema nuevo poco a poco, aprendiendo en cada escalón antes de subir al siguiente.

## 26. Banderas de funcionalidad durante la migración

MIG-2601. Las banderas que controlan la migración tienen propietario, propósito, estado por entorno y fecha de retiro.
MIG-2602. El cambio de una bandera productiva se registra con actor, motivo y verificación.
MIG-2603. Las combinaciones de banderas se prueban para evitar estados inconsistentes entre sistemas.
MIG-2604. Las banderas de migración se retiran tras completar la transición para no acumular complejidad.
MIG-2605. Una bandera olvidada que mantiene código antiguo activo se trata como deuda con responsable.
MIG-2606. Caso hipotético: una bandera desactivada por error devuelve parte del tráfico al sistema antiguo ya en solo lectura.
MIG-2607. Los usuarios reciben errores de escritura y el registro de banderas identifica el cambio y su autor.
MIG-2608. La corrección exige aprobación para cambios de banderas de migración y alerta ante escrituras rechazadas.
MIG-2609. Quiero banderas que me den control, no banderas que me sorprendan.

## 27. Migración de autenticación e identidades

MIG-2701. La migración de usuarios conserva identificadores, roles, estado de cuenta y relaciones con datos.
MIG-2702. Las contraseñas no se descifran ni se exportan en claro; se migran sus derivaciones o se exige restablecimiento.
MIG-2703. Cuando el algoritmo de derivación cambia, se rederiva en el siguiente inicio de sesión exitoso.
MIG-2704. Los factores adicionales de autenticación se migran o se solicita reinscripción con comunicación previa.
MIG-2705. Las sesiones activas se invalidan o se migran con plan explícito; no quedan sesiones huérfanas válidas.
MIG-2706. La equivalencia de autorización se prueba para cada rol antes y después.
MIG-2707. La comunicación a usuarios sobre cambios de inicio de sesión es clara y no imita mensajes de phishing.
MIG-2708. Caso hipotético: la migración a un proveedor de identidad externo pierde la vinculación de cuentas de clientes empresariales.
MIG-2709. La prueba de equivalencia con cuentas de cada tipo detecta la pérdida antes del corte.
MIG-2710. La corrección añade el mapeo de organizaciones y la prueba se repite con todos los tipos de cuenta.
MIG-2711. Quiero que mis usuarios sigan entrando a lo suyo, y solo a lo suyo, después de cualquier migración.

## 28. Migración de proveedor de IA

MIG-2801. El cambio de proveedor de IA revalida capacidad, formato, calidad, costo, latencia, privacidad y licencias.
MIG-2802. La evaluación usa el mismo conjunto de casos que el proveedor actual y compara resultados.
MIG-2803. Los embeddings no son compatibles entre modelos; cambiar de modelo exige reindexar.
MIG-2804. Las herramientas y salidas estructuradas se prueban porque cada proveedor las implementa de forma distinta.
MIG-2805. Los datos enviados al nuevo proveedor requieren aprobación de privacidad con su región y retención.
MIG-2806. El [AI Gateway](AI-GATEWAY.md) desarrolla la sustitución con canary y retorno.
MIG-2807. Caso hipotético: el nuevo modelo es más barato pero ignora un formato de salida obligatorio en el cinco por ciento de casos.
MIG-2808. El guardrail de salida rechaza esos casos y la evaluación decide mantener el proveedor anterior para ese caso de uso.
MIG-2809. Quiero cambiar de modelo cuando la evaluación lo justifique, no cuando cambie la moda.

## 29. Migración de pagos

MIG-2901. Las transacciones inciertas del proveedor antiguo se reconcilian antes de enviar operaciones al nuevo.
MIG-2902. Las referencias del proveedor antiguo se conservan para devoluciones, disputas y auditoría.
MIG-2903. Los instrumentos tokenizados no se asumen portables; la portabilidad se verifica con ambos proveedores.
MIG-2904. Las suscripciones activas se asignan a un proveedor por ciclo con período de coexistencia documentado.
MIG-2905. Desactivar nuevos cobros en el proveedor antiguo no desactiva su conciliación ni la atención de disputas.
MIG-2906. El [manual de pagos](PAYMENTS.md) desarrolla estados, idempotencia y conciliación.
MIG-2907. Caso hipotético: una migración cobra dos veces a clientes cuyos pagos estaban pendientes en el proveedor antiguo.
MIG-2908. La corrección bloquea nuevos cobros mientras exista intención incierta y la prueba lo verifica.
MIG-2909. Quiero migrar pagos sin cobrar dos veces ni perder un sol de trazabilidad.

## 30. Migración de almacenamiento

MIG-3001. La migración de almacenamiento compara propiedad, sumas de verificación, costos de egreso, cifrado, permisos y retención.
MIG-3002. Los objetos se copian con verificación de hash y las referencias se actualizan tras confirmar cada lote.
MIG-3003. Las URLs firmadas y enlaces públicos se regeneran y se comunica su cambio a consumidores.
MIG-3004. Las eliminaciones pendientes se aplican en el destino para no reintroducir datos olvidados.
MIG-3005. El [manual de almacenamiento](STORAGE-DATA.md) desarrolla backups, restauración y salida de proveedor.
MIG-3006. Caso hipotético: la migración copia objetos pero no sus políticas de acceso y algunos quedan públicos.
MIG-3007. La verificación de permisos posterior a cada lote detecta la exposición y la corrige antes de continuar.
MIG-3008. Quiero mover mis datos de lugar sin que cambien de dueño ni de nivel de protección.

## 31. Migración de frontend y framework de interfaz

MIG-3101. La migración de interfaz conserva flujos, accesibilidad, rutas, estados, mensajes y rendimiento percibido.
MIG-3102. Las rutas antiguas redirigen a las nuevas para no romper enlaces guardados ni indexados.
MIG-3103. Las pantallas se migran por flujo completo y no por componentes aislados que dejen experiencias mixtas confusas.
MIG-3104. Las pruebas de extremo a extremo de los flujos principales se ejecutan contra ambas versiones.
MIG-3105. La accesibilidad se verifica con teclado, lector de pantalla y contraste en la versión nueva.
MIG-3106. Los tamaños de pantalla declarados en el perfil se prueban en ambas versiones.
MIG-3107. Caso hipotético: la nueva interfaz pierde la navegación por teclado en un formulario crítico.
MIG-3108. La prueba de accesibilidad del flujo detecta la regresión y se corrige antes de la promoción.
MIG-3109. Quiero interfaces nuevas que nadie extrañe de las antiguas, especialmente quienes dependen de la accesibilidad.

## 32. Migración de lenguaje o runtime

MIG-3201. La migración de runtime verifica compatibilidad de dependencias, comportamiento numérico, codificación y manejo de fechas.
MIG-3202. Las diferencias de redondeo y precisión entre lenguajes se prueban con casos de caracterización.
MIG-3203. Las versiones de runtime se fijan y se documentan en el perfil del proyecto.
MIG-3204. El rendimiento se compara con cargas equivalentes y se explica cualquier diferencia relevante.
MIG-3205. Caso hipotético: un cálculo financiero migrado produce diferencias de un céntimo por uso de coma flotante.
MIG-3206. La corrección usa aritmética decimal exacta y la caracterización verifica coincidencia completa.
MIG-3207. Quiero cambiar de lenguaje sin cambiar los números que mis usuarios ven.

## 33. Migración de infraestructura

MIG-3301. Mover de local a nube o de nube a local reevalúa costo, latencia, operación, seguridad, residencia y dependencia.
MIG-3302. La migración de infraestructura se ensaya con el procedimiento de despliegue completo en el destino.
MIG-3303. Las configuraciones de red, firewall, DNS y certificados se inventarían y se verifican en el destino.
MIG-3304. El monitoreo y las alertas se configuran en el destino antes de recibir tráfico.
MIG-3305. Los backups y su restauración se verifican en el destino antes del corte.
MIG-3306. Caso hipotético: la migración a nube olvida una regla de firewall y la base queda accesible desde internet.
MIG-3307. La verificación de exposición externa antes del corte detecta el puerto abierto y se corrige.
MIG-3308. Quiero cambiar de infraestructura con la misma protección o mejor, verificada antes de exponer nada.

## 34. Agentes de IA en migraciones

MIG-3401. El arqueólogo de sistemas puede inventariar y caracterizar con lectura, acelerando la fase que más se omite por falta de tiempo.
MIG-3402. El arquitecto propone patrones y contratos; el responsable aprueba la estrategia y los puntos de no retorno.
MIG-3403. La guía de pruebas escribe caracterización antes de que el implementador cambie código del sistema existente.
MIG-3404. El implementador trabaja por fases con ownership acotado y no mezcla migración con refactors no solicitados.
MIG-3405. El verificador ejecuta comparaciones de equivalencia y reporta diferencias con evidencia.
MIG-3406. El gestor de releases prepara canary, retorno y handoff con artefactos verificados.
MIG-3407. Los agentes no ejecutan cortes productivos, migraciones de datos reales ni cambios de enrutamiento sin autorización específica.
MIG-3408. Las transformaciones de datos propuestas por agentes se revisan y se prueban sobre copias anonimizadas.
MIG-3409. Los agentes no inventan reglas de negocio para completar huecos; las registran como preguntas abiertas.
MIG-3410. Un plan ejecutable mantiene el estado de la migración para que cualquier agente pueda retomarla.
MIG-3411. Caso hipotético: un agente traduce un módulo a otro lenguaje y adapta un cálculo según su interpretación.
MIG-3412. La caracterización detecta la diferencia y la revisión exige conservar el cálculo original salvo decisión del responsable.
MIG-3413. La aceptación verifica que la traducción pasa todas las pruebas de caracterización sin modificarlas.
MIG-3414. Las pruebas de caracterización no se editan para que coincidan con el sistema nuevo sin decisión registrada.
MIG-3415. Quiero agentes que hagan la migración más rigurosa, no más rápida a costa de perder comportamiento.

## 35. Comunicación y gestión del cambio

MIG-3501. Los usuarios afectados se identifican y reciben comunicación sobre qué cambia, cuándo, por qué y cómo obtener ayuda.
MIG-3502. La comunicación se envía con anticipación suficiente y se repite cerca del cambio.
MIG-3503. Las guías de uso del sistema nuevo se preparan antes de la promoción y se prueban con usuarios representativos.
MIG-3504. El canal de soporte durante la transición tiene responsables y tiempos de respuesta definidos.
MIG-3505. Los cambios de comportamiento intencionales se explican con su razón para reducir reclamos.
MIG-3506. Las comunicaciones externas se preparan como borradores y se envían con autorización del responsable.
MIG-3507. Caso hipotético: un cambio de interfaz genera cientos de consultas porque nadie explicó la nueva ubicación de una función frecuente.
MIG-3508. La guía breve con capturas reduce las consultas y se incorpora al procedimiento estándar de migraciones.
MIG-3509. Quiero que mis usuarios entiendan el cambio antes de sufrirlo.

## 36. Paquete de transferencia

MIG-3601. El paquete describe propósito del sistema, usuarios, flujos principales y decisiones de arquitectura vigentes.
MIG-3602. Incluye mapa de módulos con responsabilidades, dependencias y puntos de extensión.
MIG-3603. Incluye versiones exactas de runtime, dependencias y herramientas requeridas.
MIG-3604. Incluye instalación, configuración sin secretos, variables requeridas y procedimiento de obtención de credenciales.
MIG-3605. Incluye ejecución, pruebas, despliegue, reversión, backup, restauración y monitoreo con comandos verificados.
MIG-3606. Incluye contratos de integraciones con propietarios externos y contactos.
MIG-3607. Incluye riesgos conocidos, deuda técnica, excepciones vigentes y pendientes con prioridad.
MIG-3608. Incluye historial de incidentes relevantes y sus lecciones.
MIG-3609. Incluye calendario de tareas periódicas: renovación de certificados, rotación de credenciales y ensayos de restauración.
MIG-3610. El paquete se adapta a la experiencia y herramientas del receptor.
MIG-3611. La plantilla [HANDOFF-CHECKLIST](../../templates/HANDOFF-CHECKLIST.md) estructura la verificación del paquete.
MIG-3612. Un paquete extenso sin comandos verificados es menos útil que uno breve que funciona.
MIG-3613. Quiero entregar un paquete que el receptor use, no uno que archive.

## 37. Capacidades del receptor

MIG-3701. Antes de transferir, se evalúa qué sabe operar el receptor y qué formación necesita.
MIG-3702. La tecnología del sistema se compara con las competencias del receptor y se planifica la brecha.
MIG-3703. Las sesiones de transferencia se organizan por tema con ejercicios prácticos en entorno de prueba.
MIG-3704. El receptor ejecuta los procedimientos críticos bajo observación antes de asumirlos solo.
MIG-3705. Las dudas recurrentes se convierten en mejoras del paquete.
MIG-3706. Un receptor que no puede operar una parte la declara como pendiente con plan y plazo.
MIG-3707. Caso hipotético: el receptor domina la aplicación pero nunca operó la base de datos elegida.
MIG-3708. La transferencia incluye un ejercicio de restauración guiado y un runbook ampliado para esa base.
MIG-3709. La aceptación verifica que el receptor restaura solo siguiendo el runbook.
MIG-3710. Quiero transferir a alguien que pueda sostener el sistema, no a alguien que solo pueda mirarlo.

## 38. Accesos y credenciales en la transferencia

MIG-3801. El receptor obtiene credenciales propias; no hereda las cuentas personales del equipo anterior.
MIG-3802. Las cuentas del equipo anterior se revocan o reducen tras la transferencia según acuerdo.
MIG-3803. Las credenciales compartidas se rotan al transferir para cortar accesos no controlados.
MIG-3804. Las cuentas de proveedores se transfieren al titular correcto con verificación de propiedad.
MIG-3805. Los dominios, certificados y repositorios se transfieren con registro de propietario y fechas de expiración.
MIG-3806. Las credenciales se entregan por el mecanismo seguro autorizado, nunca por correo o chat en claro.
MIG-3807. Caso hipotético: tras la transferencia, el dominio sigue registrado a nombre de un exintegrante y expira.
MIG-3808. La política exige verificar titularidad de dominios y cuentas como parte del gate de transferencia.
MIG-3809. Quiero que al terminar una transferencia nadie conserve accesos que ya no le corresponden.

## 39. Conocimiento implícito y sesiones de transferencia

MIG-3901. El conocimiento implícito se extrae con entrevistas estructuradas a quienes operaron el sistema.
MIG-3902. Las entrevistas preguntan por incidentes, tareas manuales, excepciones frecuentes y decisiones sin documentar.
MIG-3903. Las respuestas se convierten en documentación verificada, no en notas privadas.
MIG-3904. Las sesiones se registran con resumen escrito, sin grabar datos sensibles innecesarios.
MIG-3905. Las tareas manuales recurrentes se evalúan para automatizarlas o documentarlas como runbooks.
MIG-3906. Caso hipotético: el operador saliente reinicia manualmente un servicio cada lunes y nadie más lo sabe.
MIG-3907. La entrevista revela la tarea; se investiga la causa y se corrige la fuga de memoria que la motivaba.
MIG-3908. Quiero que el conocimiento se quede en el sistema cuando las personas se van.

## 40. Aceptación de la transferencia

MIG-4001. El receptor demuestra que puede instalar, ejecutar, probar, desplegar, revertir, restaurar y diagnosticar el sistema.
MIG-4002. Cada demostración se realiza en entorno representativo siguiendo solo el paquete.
MIG-4003. Las demostraciones fallidas se corrigen y se repiten antes de aceptar.
MIG-4004. La aceptación registra fecha, versión, receptor, demostraciones realizadas y pendientes reconocidos.
MIG-4005. Los riesgos aceptados se transfieren con su responsable nuevo.
MIG-4006. Un push al repositorio del receptor no constituye aceptación.
MIG-4007. El receptor puede rechazar la transferencia si la evidencia no permite operar con seguridad.
MIG-4008. Caso hipotético: el receptor no puede desplegar porque el pipeline depende de un runner del equipo anterior.
MIG-4009. La corrección migra el pipeline a infraestructura del receptor y la demostración se repite con éxito.
MIG-4010. Quiero transferencias aceptadas por evidencia, no por calendario.

## 41. Acompañamiento posterior a la transferencia

MIG-4101. Se acuerda un período de acompañamiento con alcance, duración, canal y responsabilidades.
MIG-4102. Durante el acompañamiento, el equipo anterior asesora pero el receptor ejecuta.
MIG-4103. Las consultas del período se registran y se convierten en mejoras del paquete.
MIG-4104. Los incidentes del período se gestionan con el receptor al mando y apoyo documentado.
MIG-4105. El final del acompañamiento se registra con pendientes y su responsable.
MIG-4106. Caso hipotético: durante el acompañamiento ocurre un incidente y el equipo anterior lo resuelve sin involucrar al receptor.
MIG-4107. El receptor no aprende el procedimiento y el siguiente incidente tarda más en resolverse.
MIG-4108. La política exige que el receptor ejecute con asesoría para que el aprendizaje ocurra.
MIG-4109. Quiero que el acompañamiento forme al receptor, no que lo reemplace.

## 42. Portabilidad desde el diseño

MIG-4201. Los sistemas nuevos se diseñan con fronteras que faciliten sustituir proveedores y componentes en el futuro.
MIG-4202. Las dependencias de proveedor se encapsulan detrás de interfaces cuando el costo de hacerlo es razonable.
MIG-4203. Los datos se almacenan en formatos abiertos o exportables con procedimiento probado.
MIG-4204. La configuración se externaliza para que el sistema pueda desplegarse en otro entorno sin cambiar código.
MIG-4205. La documentación de arquitectura se mantiene viva para que una migración futura no empiece con arqueología.
MIG-4206. Las funciones propietarias usadas se inventarían con su alternativa conocida.
MIG-4207. La portabilidad no justifica abstracciones especulativas sin necesidad demostrada.
MIG-4208. Caso hipotético: un sistema usa directamente el SDK de un proveedor de colas en veinte módulos.
MIG-4209. Una interfaz de mensajería mínima habría limitado el cambio a un adaptador; la mejora se planifica por módulos.
MIG-4210. Quiero que mi sistema de hoy no sea la arqueología difícil de mañana.

## 43. Documentación de arquitectura para el receptor

MIG-4301. La documentación de arquitectura explica contexto, contenedores, componentes y flujos principales con diagramas actualizados.
MIG-4302. Cada decisión relevante tiene ADR con contexto, alternativas y consecuencias.
MIG-4303. Los diagramas se mantienen en formato editable versionado junto al código.
MIG-4304. Las fronteras de confianza y datos sensibles se señalan en los diagramas.
MIG-4305. La documentación indica qué partes son estables, cuáles están en transición y cuáles se planea retirar.
MIG-4306. Caso hipotético: el receptor modifica un componente en transición creyendo que es definitivo.
MIG-4307. El diagrama marcaba el estado de transición y la revisión del cambio lo detecta a tiempo.
MIG-4308. Quiero que el receptor vea la forma real del sistema y hacia dónde iba.

## 44. Casos integrados de migración y transferencia

MIG-4401. Caso A: una aplicación de escritorio en Windows migra su base local a un servidor compartido para varios usuarios.
MIG-4402. En el caso A, la arqueología descubre que la aplicación asume un solo usuario y no controla concurrencia.
MIG-4403. La migración introduce control optimista con versión y la caracterización cubre ediciones simultáneas.
MIG-4404. El canary inicia con dos usuarios internos y se amplía tras una semana sin conflictos no resueltos.
MIG-4405. La aceptación del caso A verifica que ninguna edición se pierde con cinco usuarios concurrentes simulados.
MIG-4406. Caso B: un servicio de facturación migra de un proveedor de pagos a otro con suscripciones activas.
MIG-4407. En el caso B, los ciclos en curso permanecen en el proveedor antiguo y los nuevos ciclos se crean en el nuevo.
MIG-4408. La conciliación diaria cubre ambos proveedores durante la coexistencia y las disputas antiguas siguen su curso.
MIG-4409. La aceptación del caso B verifica cero cobros duplicados y conciliación completa en ambos proveedores.
MIG-4410. Caso C: un equipo transfiere un portal a un proveedor externo de mantenimiento.
MIG-4411. En el caso C, el receptor demuestra despliegue, reversión y restauración en su propia infraestructura.
MIG-4412. Las credenciales del equipo anterior se revocan y los dominios se transfieren al titular del producto.
MIG-4413. La aceptación del caso C registra demostraciones, pendientes y el período de acompañamiento acordado.
MIG-4414. Los casos son ejercicios de diseño y no describen proyectos reales.

## 45. Antipatrones de migración y transferencia

MIG-4501. Reescribir todo porque el código parece viejo, sin evidencia de un problema que la reescritura resuelva.
MIG-4502. Migrar sin caracterización y descubrir comportamientos perdidos por reclamos de usuarios.
MIG-4503. Comparar solo conteos de filas y declarar equivalencia de datos.
MIG-4504. Ejecutar en sombra con efectos externos activos y enviar correos o cobros duplicados.
MIG-4505. Planificar un corte único sin ensayo ni criterios de abortar.
MIG-4506. Perder reglas de negocio ocultas en triggers, tareas programadas o procesos manuales.
MIG-4507. Transferir con credenciales personales del equipo anterior.
MIG-4508. Declarar transferencia completa al hacer push al repositorio del receptor.
MIG-4509. Editar pruebas de caracterización para que coincidan con el sistema nuevo sin decisión registrada.
MIG-4510. Cada antipatrón tiene una cláusula preventiva en este manual y debe verificarse en la revisión del plan.

## 46. Lista de verificación de migración

MIG-4601. Caso de negocio con evidencia, alternativas y ADR aprobado.
MIG-4602. Inventario arqueológico con fuentes y pendientes.
MIG-4603. Reglas de negocio registradas con decisión para las accidentales.
MIG-4604. Pruebas de caracterización de flujos críticos.
MIG-4605. Criterios de equivalencia por dimensión con tolerancias aprobadas.
MIG-4606. Patrón de transición elegido por frontera con justificación.
MIG-4607. Mapeo de datos con transformaciones probadas y reconciliación definida.
MIG-4608. Retorno o reparación hacia adelante ensayados por fase.
MIG-4609. Canary con métricas, eventos prohibidos y escalones.
MIG-4610. Comunicación a usuarios preparada y canal de soporte asignado.
MIG-4611. Retiro del sistema antiguo planificado con archivo de datos y revocación de accesos.
MIG-4612. La lista se adapta al perfil y declara puntos no aplicables.

## 47. Lista de verificación de transferencia

MIG-4701. Paquete con propósito, arquitectura, instalación, operación, recuperación y pendientes.
MIG-4702. Evaluación de capacidades del receptor y plan de formación.
MIG-4703. Credenciales propias del receptor y revocación de accesos anteriores.
MIG-4704. Titularidad de dominios, certificados, repositorios y cuentas verificada.
MIG-4705. Demostraciones del receptor completadas en entorno representativo.
MIG-4706. Riesgos y excepciones transferidos con responsable nuevo.
MIG-4707. Período de acompañamiento acordado con alcance y final registrado.
MIG-4708. Aceptación firmada con fecha, versión y pendientes.

## 48. Glosario

MIG-4801. Caracterización: captura del comportamiento actual mediante pruebas antes de cambiarlo.
MIG-4802. Equivalencia: coincidencia demostrada entre sistemas en las dimensiones acordadas con tolerancias justificadas.
MIG-4803. Estrangulamiento: sustitución progresiva redirigiendo dominios al sistema nuevo.
MIG-4804. Capa anticorrupción: traducción entre modelos para que el sistema nuevo no herede conceptos defectuosos.
MIG-4805. Ejecución en sombra: procesamiento paralelo sin efectos externos para comparar resultados.
MIG-4806. Punto de no retorno: fase tras la cual volver al sistema anterior perdería datos o no es posible.
MIG-4807. Reparación hacia adelante: corrección en el sistema nuevo cuando retornar es más costoso o inseguro.
MIG-4808. Acompañamiento: período posterior a la transferencia en que el equipo anterior asesora al receptor.

## 49. Registro de riesgos de la migración

MIG-4901. El registro de riesgos enumera cada riesgo con descripción, probabilidad cualitativa, consecuencia, señal temprana, mitigación y responsable.
MIG-4902. Los riesgos se revisan al cerrar cada fase y se actualizan con la evidencia obtenida.
MIG-4903. Un riesgo materializado se convierte en incidente o en decisión registrada, nunca se borra del registro.
MIG-4904. Los riesgos residuales al terminar se transfieren con responsable explícito al equipo que opera el sistema.
MIG-4905. Los riesgos típicos incluyen pérdida de reglas, datos inconsistentes, regresiones de rendimiento, accesos indebidos y costos imprevistos.
MIG-4906. La mitigación preferida reduce probabilidad mediante pruebas; la secundaria reduce consecuencia mediante retorno ensayado.
MIG-4907. Caso hipotético: el riesgo de costos de egreso se registró como bajo sin medir el volumen real de objetos.
MIG-4908. La medición antes de la copia revela un costo cinco veces mayor y el plan se ajusta con copia por lotes y compresión.
MIG-4909. La aceptación verifica que el costo final coincide con la estimación revisada dentro del margen acordado.
MIG-4910. Quiero conocer mis riesgos antes de que se conviertan en sorpresas.

## 50. Estimación y calendario honestos

MIG-5001. La estimación se basa en mediciones de ensayos, como duración de copias, transformaciones y pruebas.
MIG-5002. El calendario incluye tiempo para caracterización, ensayos, canary, acompañamiento y retiro del sistema antiguo.
MIG-5003. Las fechas comprometidas se fijan después de los ensayos, no antes de conocer el volumen real.
MIG-5004. Las desviaciones del calendario se comunican con causa y nuevo plan, sin recortar controles para recuperar tiempo.
MIG-5005. Los hitos del calendario coinciden con los del plan ejecutable y su evidencia de cierre.
MIG-5006. Caso hipotético: la gerencia fija una fecha de corte antes del inventario y el equipo omite la caracterización para cumplirla.
MIG-5007. El corte produce regresiones que tardan más en corregirse que el tiempo ahorrado.
MIG-5008. La política exige que la fecha de corte dependa de evidencia de ensayos y que omitir controles sea una excepción aprobada.
MIG-5009. Quiero calendarios que respeten la realidad del sistema, no deseos de calendario.

## 51. Tareas programadas y procesos por lotes

MIG-5101. Cada tarea programada se migra con horario, zona horaria, duración, dependencias, efectos y monitoreo.
MIG-5102. Durante la transición, una tarea se ejecuta en un solo sistema para evitar efectos duplicados.
MIG-5103. La desactivación en el origen y la activación en el destino se coordinan en el mismo cambio controlado.
MIG-5104. Las tareas que procesan periodos se verifican para no omitir ni repetir el periodo de transición.
MIG-5105. Caso hipotético: la tarea de facturación mensual se ejecuta en ambos sistemas el primer día del mes.
MIG-5106. Los clientes reciben dos facturas y la corrección exige registro de propietario único por tarea durante la transición.
MIG-5107. La aceptación verifica que cada periodo se procesó exactamente una vez mediante registros de ejecución.
MIG-5108. Quiero que cada tarea automática corra una vez, en el lugar correcto, durante toda la migración.

## 52. Integraciones con terceros durante la migración

MIG-5201. Cada integración se migra con contrato, credenciales, direcciones, listas de IP permitidas y webhooks actualizados.
MIG-5202. Los terceros se notifican con anticipación cuando deben cambiar configuración de su lado.
MIG-5203. Los webhooks entrantes se aceptan en ambos sistemas durante la transición o se redirigen con deduplicación.
MIG-5204. Las integraciones se prueban en el destino con entornos de prueba del tercero antes del corte.
MIG-5205. Caso hipotético: un proveedor de pagos sigue enviando webhooks al servidor antiguo tras el corte.
MIG-5206. Los eventos se pierden hasta que un cliente reclama, porque el servidor antiguo estaba en solo lectura.
MIG-5207. La corrección actualiza la dirección del webhook en el corte y mantiene un reenvío temporal desde el origen.
MIG-5208. Quiero que ningún tercero quede hablando con un sistema que ya no escucha.

## 53. Reportes, análisis y consumidores de datos

MIG-5301. Los reportes y paneles se inventarían con sus consultas, fuentes y usuarios.
MIG-5302. Cada reporte se verifica en el destino comparando resultados para periodos históricos conocidos.
MIG-5303. Las diferencias se explican por correcciones intencionales o se corrigen antes de retirar el reporte antiguo.
MIG-5304. Los usuarios de reportes participan en la validación de resultados.
MIG-5305. Caso hipotético: un panel de ventas muestra cifras distintas tras la migración por cambio de zona horaria en los cortes.
MIG-5306. La comparación histórica detecta la diferencia y se corrige la conversión antes de que se tomen decisiones con el panel.
MIG-5307. Quiero que los números con los que se decide sigan significando lo mismo después de migrar.

## 54. Observabilidad durante la migración

MIG-5401. El monitoreo del destino se configura antes de recibir tráfico, con las mismas señales críticas del origen.
MIG-5402. Durante la coexistencia se observan ambos sistemas con paneles que permiten compararlos.
MIG-5403. Las métricas de reconciliación, como diferencias encontradas por lote, se muestran como señales de la migración.
MIG-5404. Las alertas tienen receptores durante toda la ventana de migración, incluidos horarios no habituales.
MIG-5405. Los registros identifican qué sistema atendió cada solicitud.
MIG-5406. Caso hipotético: tras el corte, el destino no tiene alerta de errores de escritura y un fallo pasa inadvertido horas.
MIG-5407. La política exige verificación de monitoreo del destino como condición de entrada al corte.
MIG-5408. Quiero ver la migración mientras ocurre, no descubrir sus problemas después.

## 55. Controles de seguridad en el destino

MIG-5501. Los controles de seguridad del origen se inventarían y se verifican en el destino antes del corte.
MIG-5502. La matriz de autorización se prueba en el destino con casos positivos y negativos.
MIG-5503. Los secretos del destino son nuevos y no copias de los del origen cuando el riesgo lo justifica.
MIG-5504. La exposición de red del destino se verifica desde fuera antes de recibir tráfico.
MIG-5505. Las dependencias del destino se auditan por vulnerabilidades conocidas antes del corte.
MIG-5506. Caso hipotético: el origen tenía limitación de intentos de inicio de sesión en un proxy que no se migró.
MIG-5507. El inventario de controles detecta la ausencia y el destino configura la limitación antes del corte.
MIG-5508. Quiero que migrar nunca signifique perder una defensa que tenía.

## 56. Cumplimiento y privacidad en la migración

MIG-5601. La migración evalúa si cambian ubicación, proveedores, retención o finalidad de datos personales.
MIG-5602. Los cambios se revisan con el analista de cumplimiento y, cuando corresponde, con revisión competente.
MIG-5603. Las copias temporales de datos durante la migración tienen retención y eliminación verificadas.
MIG-5604. Los registros de tratamiento se actualizan con el nuevo destino de los datos.
MIG-5605. Caso hipotético: una copia temporal de la base para pruebas de migración queda en un bucket sin cifrado tras terminar.
MIG-5606. La lista de cierre exige eliminación verificada de copias temporales y la revisión encuentra la omisión.
MIG-5607. Quiero que mis datos personales no queden dispersos por el camino de una migración.

## 57. Costos de la migración

MIG-5701. El presupuesto incluye doble operación, transferencia de datos, herramientas, horas de trabajo y acompañamiento.
MIG-5702. Los costos reales se registran por fase y se comparan con la estimación.
MIG-5703. Las desviaciones relevantes se comunican con causa y opciones.
MIG-5704. El período de doble operación se limita porque su costo crece con cada semana.
MIG-5705. Caso hipotético: el sistema antiguo sigue encendido meses después del corte por falta de responsable de su retiro.
MIG-5706. La política asigna responsable y fecha de retiro como parte del plan desde el inicio.
MIG-5707. Quiero que la migración cueste lo previsto y que su costo termine cuando termina.

## 58. Retiro del sistema antiguo

MIG-5801. El retiro se planifica con inventario de componentes, datos, accesos, dominios, certificados y costos asociados.
MIG-5802. Antes de apagar, se verifica que ningún consumidor sigue usando el sistema mediante registros de acceso.
MIG-5803. El sistema se pasa primero a solo lectura y luego se apaga tras el período de reversión acordado.
MIG-5804. Los datos se archivan según retención, con formato legible y procedimiento de consulta documentado.
MIG-5805. Las credenciales, cuentas y accesos del sistema retirado se revocan.
MIG-5806. Los contratos y suscripciones asociados se cancelan con autorización del responsable.
MIG-5807. El retiro se registra en el changelog e inventario con fecha y evidencia.
MIG-5808. Caso hipotético: tras apagar el sistema antiguo, una integración olvidada de un socio deja de funcionar.
MIG-5809. Los registros de acceso de las semanas previas habrían mostrado las llamadas del socio; la verificación se vuelve obligatoria.
MIG-5810. Quiero apagar lo viejo con la certeza de que nadie lo necesita.

## 59. Archivo y consulta de datos históricos

MIG-5901. Los datos históricos no migrados se archivan con formato abierto, esquema documentado y verificación de integridad.
MIG-5902. El archivo tiene retención, acceso restringido y procedimiento de consulta para auditorías o solicitudes.
MIG-5903. Las solicitudes de titulares sobre datos archivados se atienden con el mismo rigor que sobre datos activos.
MIG-5904. La eliminación del archivo al vencer su retención se ejecuta y se registra.
MIG-5905. Caso hipotético: un auditor solicita facturas de hace cinco años que solo existían en el sistema retirado.
MIG-5906. El archivo en formato abierto permite consultarlas sin reactivar el sistema antiguo.
MIG-5907. Quiero poder responder sobre el pasado sin mantener vivo un sistema del pasado.

## 60. Clientes antiguos y compatibilidad de versiones

MIG-6001. Las aplicaciones móviles o de escritorio instaladas pueden seguir usando versiones antiguas de la API durante meses.
MIG-6002. La API conserva compatibilidad con versiones de cliente activas medidas por registros de uso.
MIG-6003. La retirada de versiones antiguas se comunica en la aplicación y se aplica tras un período definido.
MIG-6004. Los clientes que no pueden actualizarse reciben mensaje claro con instrucciones, no errores crípticos.
MIG-6005. Caso hipotético: una versión antigua de la aplicación envía fechas en formato distinto y la API nueva las rechaza.
MIG-6006. La API acepta ambos formatos durante la transición y registra el uso para decidir la retirada.
MIG-6007. Quiero que mis usuarios con versiones antiguas tengan tiempo y guía para actualizarse.

## 61. Cambio de DNS y direcciones públicas

MIG-6101. El cambio de DNS se planifica reduciendo el tiempo de vida de los registros con antelación suficiente.
MIG-6102. El destino se verifica accediendo directamente antes de cambiar el DNS.
MIG-6103. Los certificados del destino cubren todos los nombres que recibirán tráfico.
MIG-6104. El origen sigue atendiendo durante la propagación o redirige al destino.
MIG-6105. El retorno de DNS está documentado y considera el tiempo de propagación.
MIG-6106. Caso hipotético: el cambio de DNS deja usuarios en el servidor antiguo por un tiempo de vida de un día.
MIG-6107. La reducción previa del tiempo de vida habría acortado la transición; la lista de verificación la incorpora.
MIG-6108. Quiero que el cambio de dirección sea invisible para mis usuarios.

## 62. Scripts de migración idempotentes y reanudables

MIG-6201. Los scripts de migración pueden ejecutarse varias veces sin duplicar datos ni efectos.
MIG-6202. Los scripts registran progreso por lote para reanudar tras interrupción desde el último lote confirmado.
MIG-6203. Cada lote se confirma en transacción con verificación de conteo y suma.
MIG-6204. Los scripts tienen modo de simulación que informa qué harían sin escribir.
MIG-6205. Los scripts se versionan, se revisan y se prueban sobre copias anonimizadas.
MIG-6206. Caso hipotético: un script se interrumpe a la mitad y al reiniciarse duplica los registros ya copiados.
MIG-6207. La corrección añade claves de idempotencia y registro de lotes, y la prueba simula interrupciones.
MIG-6208. Quiero scripts que pueda interrumpir y reanudar sin miedo.

## 63. Escritura dual y sus riesgos

MIG-6301. La escritura dual en dos sistemas puede divergir cuando una escritura falla y la otra no.
MIG-6302. La escritura dual se acompaña de reconciliación periódica que detecta y corrige divergencias.
MIG-6303. Un sistema es autoritativo durante la escritura dual; el otro se trata como copia hasta el cambio de autoridad.
MIG-6304. Los fallos de escritura en el sistema secundario se registran y reintentan sin bloquear al usuario cuando es seguro.
MIG-6305. La captura de cambios desde el autoritativo es preferible a la escritura dual desde la aplicación cuando es viable.
MIG-6306. Caso hipotético: durante la escritura dual, un fallo de red deja pedidos solo en el sistema antiguo.
MIG-6307. La reconciliación diaria detecta los pedidos faltantes y los replica antes del cambio de autoridad.
MIG-6308. Quiero que dos sistemas que escriben lo mismo terminen diciendo lo mismo, verificado.

## 64. Archivos y adjuntos en migraciones

MIG-6401. Los archivos se migran con hash verificado, metadatos, permisos y referencias actualizadas.
MIG-6402. Los nombres de archivo con caracteres especiales se prueban en el destino.
MIG-6403. Los archivos huérfanos del origen se identifican y se decide su destino antes de migrar.
MIG-6404. La copia de archivos grandes se reanuda tras interrupciones sin recopiar lo ya verificado.
MIG-6405. Caso hipotético: archivos con tildes en el nombre fallan al copiarse a un destino con otra codificación.
MIG-6406. La prueba previa con nombres representativos detecta el problema y se normaliza la codificación.
MIG-6407. Quiero que cada archivo llegue íntegro y encontrable al otro lado.

## 65. Entornos para ensayar la migración

MIG-6501. El ensayo se realiza en un entorno con volumen y forma de datos comparables a producción.
MIG-6502. Los datos del ensayo se anonimizan con procedimiento verificado.
MIG-6503. El entorno de ensayo no tiene integraciones con efectos reales.
MIG-6504. Los ensayos se repiten hasta que el procedimiento se ejecute sin pasos improvisados.
MIG-6505. Caso hipotético: el ensayo con un diez por ciento de los datos subestima la duración real del corte.
MIG-6506. El ensayo con volumen completo anonimizado da una duración realista y la ventana se ajusta.
MIG-6507. Quiero ensayar con la realidad, no con una muestra que me tranquilice.

## 66. Transferencia del sistema de agentes

MIG-6601. Cuando el receptor seguirá usando agentes, el paquete incluye definiciones, skills, plantillas e instrucciones adaptadas.
MIG-6602. El receptor revisa las herramientas permitidas de cada agente según su perfil de riesgo.
MIG-6603. El instalador de este repositorio copia el sistema sin sobrescribir archivos del receptor.
MIG-6604. Las evaluaciones de agentes se transfieren para que el receptor mida cambios futuros.
MIG-6605. Los planes ejecutables abiertos se transfieren con su estado y pendientes.
MIG-6606. Caso hipotético: el receptor instala los agentes y uno de ellos tiene herramientas de escritura en un repositorio sensible.
MIG-6607. La revisión de herramientas antes de habilitar detecta el permiso y lo restringe a lectura.
MIG-6608. Quiero que mis agentes lleguen al receptor con las mismas garantías con las que yo los uso.

## 67. Transferencia a proveedores externos de mantenimiento

MIG-6701. El contrato con el proveedor define alcance, niveles de servicio, accesos, seguridad, propiedad del código y salida.
MIG-6702. Los accesos del proveedor son nominales, mínimos y revisados periódicamente.
MIG-6703. El proveedor documenta sus cambios en el repositorio del producto con el mismo estándar.
MIG-6704. La salida del proveedor se planifica con transferencia inversa y verificación.
MIG-6705. Caso hipotético: el proveedor mantiene el código en su propio repositorio y entrega solo binarios.
MIG-6706. La política exige que el código y la documentación vivan en repositorios del titular del producto.
MIG-6707. Quiero que mi producto siga siendo mío aunque otro lo mantenga.

## 68. Relación con otros módulos

MIG-6801. [PRIME-DIRECTIVE](PRIME-DIRECTIVE.md) define autoridad, evidencia y cierre para decisiones de migración.
MIG-6802. [AGENT-ORCHESTRATION](AGENT-ORCHESTRATION.md) define los roles de agentes que participan en migraciones.
MIG-6803. [ENGINEERING-QUALITY](ENGINEERING-QUALITY.md) define pruebas y planes ejecutables.
MIG-6804. [UPDATES-RELIABILITY](UPDATES-RELIABILITY.md) gobierna releases y reversión.
MIG-6805. [STORAGE-DATA](STORAGE-DATA.md), [PAYMENTS](PAYMENTS.md) y [AI-GATEWAY](AI-GATEWAY.md) añaden reglas por dominio.
MIG-6806. [SECURITY-FABRIC](SECURITY-FABRIC.md) define controles que deben conservarse en el destino.
MIG-6807. Este módulo referencia esos contratos sin duplicarlos.

## 69. Límites declarados

MIG-6901. Este manual no ejecuta migraciones ni transferencias en ningún proyecto.
MIG-6902. Los casos son ejercicios de diseño y sus cifras son ilustrativas.
MIG-6903. Los patrones se describen conceptualmente y cada proyecto elige herramientas con evidencia.
MIG-6904. Los límites se revisan en cada edición.

## 70. Cierre de la Parte II

MIG-7001. La migración termina cuando comportamiento, datos, operación y recuperación se verifican en el destino.
MIG-7002. La transferencia termina cuando el receptor opera el sistema y reconoce los pendientes.
MIG-7003. Pierre R. Boss (oprbguitar) dirige este estándar y decide sobre su evolución.
MIG-7004. Quiero cambios de sistema que conserven lo valioso y transferencias que dejen a otros en control real.

## Anexo A. Caso trabajado paso a paso: migración de un sistema de reservas

MIG-A001. Estado inicial hipotético: sistema de reservas de un consultorio, escrito hace ocho años, con base local y acceso desde tres equipos Windows.
MIG-A002. Motivo registrado: el runtime perdió soporte de seguridad y el consultorio necesita acceso remoto para dos sedes nuevas.
MIG-A003. Alternativas evaluadas: actualizar runtime en el lugar, migrar a una aplicación web con servidor propio, o contratar un servicio externo.
MIG-A004. La actualización en el lugar no resuelve acceso remoto; el servicio externo no cubre reglas específicas de turnos.
MIG-A005. El responsable aprueba migrar a aplicación web con servidor propio, registrando costo, plazo y criterios de éxito.
MIG-A006. El arqueólogo inventaría pantallas, tablas, reportes, una tarea programada de recordatorios y un script manual de cierre diario.
MIG-A007. Las entrevistas revelan que la recepcionista bloquea turnos de almuerzo editando directamente una tabla.
MIG-A008. Las reglas registradas incluyen duración por especialidad, bloqueo de feriados y prohibición de doble reserva por paciente.
MIG-A009. La caracterización cubre creación, cambio, cancelación, conflicto de horario, feriado y recordatorio.
MIG-A010. Los recordatorios se aíslan con doble de prueba para no enviar mensajes a pacientes reales.
MIG-A011. El mapeo de datos detecta teléfonos en formatos mixtos y fechas sin zona horaria.
MIG-A012. Las fechas se interpretan como hora de Lima y se almacenan en UTC con conversión al mostrar.
MIG-A013. Los teléfonos ambiguos se reportan para corrección manual antes de activar recordatorios.
MIG-A014. El sistema nuevo añade una función explícita de bloqueo de horarios que sustituye la edición directa de tablas.
MIG-A015. La equivalencia funcional se verifica con los casos de caracterización; la de autorización con tres roles.
MIG-A016. El ensayo del corte con copia anonimizada completa dura cuarenta minutos.
MIG-A017. El corte se programa un domingo con comunicación previa a pacientes y personal.
MIG-A018. Los criterios de abortar incluyen cualquier diferencia en reservas futuras o fallo de inicio de sesión.
MIG-A019. El corte se completa, la reconciliación confirma todas las reservas futuras y el sistema antiguo queda en solo lectura.
MIG-A020. La primera semana el personal usa el sistema nuevo con acompañamiento y registra dudas.
MIG-A021. Dos dudas frecuentes se convierten en mejoras de la guía de uso.
MIG-A022. Tras un mes sin incidentes, se archivan los datos antiguos y se apaga el sistema anterior.
MIG-A023. La transferencia al técnico local incluye despliegue, backup, restauración y diagnóstico demostrados.
MIG-A024. El caso es un ejercicio de diseño y no describe un consultorio real.

## Anexo B. Guía de entrevista para conocimiento implícito

MIG-B001. ¿Qué tareas haces en el sistema todos los días, semanas o meses que no aparecen en ningún manual?
MIG-B002. ¿Qué haces cuando el sistema falla o se comporta de forma extraña?
MIG-B003. ¿Qué datos corriges a mano y con qué frecuencia?
MIG-B004. ¿Qué reglas aplicas que el sistema no conoce, como excepciones para ciertos clientes?
MIG-B005. ¿Qué reportes usas y qué decisiones tomas con ellos?
MIG-B006. ¿Qué integraciones o archivos externos recibes o envías?
MIG-B007. ¿Qué incidentes recuerdas y cómo se resolvieron?
MIG-B008. ¿Qué te gustaría que el sistema nuevo no cambiara?
MIG-B009. ¿Qué te molesta del sistema actual y por qué?
MIG-B010. ¿A quién más debería entrevistar?
MIG-B011. Las respuestas se registran con fecha, persona y verificación posterior en el sistema.
MIG-B012. Las entrevistas no recogen datos personales de clientes más allá de lo necesario para entender reglas.

## Anexo C. Campos mínimos del mapeo de datos

MIG-C001. Tabla o entidad de origen y campo.
MIG-C002. Tabla o entidad de destino y campo.
MIG-C003. Tipo de origen y tipo de destino.
MIG-C004. Transformación aplicada con ejemplo de entrada y salida.
MIG-C005. Validación y tratamiento de valores inválidos o nulos.
MIG-C006. Unidad, zona horaria y codificación cuando aplican.
MIG-C007. Clasificación de sensibilidad del dato.
MIG-C008. Responsable que aprobó la transformación.
MIG-C009. Prueba que verifica la transformación.
MIG-C010. Notas sobre valores descartados con autorización.

## Anexo D. Ejemplos de criterios de abortar

MIG-D001. Cualquier diferencia no explicada en registros financieros durante la reconciliación.
MIG-D002. Fallo de inicio de sesión de cualquier rol en las pruebas posteriores al corte.
MIG-D003. Duración del corte que excede la ventana menos el tiempo necesario para retornar.
MIG-D004. Errores de escritura sostenidos en el destino tras habilitarlo.
MIG-D005. Exposición de datos detectada por verificación de permisos.
MIG-D006. Indisponibilidad de una integración crítica sin alternativa.
MIG-D007. Los criterios reales se fijan por proyecto antes del corte y no se relajan durante la ejecución.
MIG-D008. La persona con autoridad para abortar se nombra en el plan y está disponible durante toda la ventana.

## Anexo E. Cronología del día de corte

MIG-E001. Confirmar disponibilidad del equipo, del responsable con autoridad para abortar y del canal de comunicación.
MIG-E002. Verificar backup reciente del origen con hash y restauración de prueba previa.
MIG-E003. Verificar monitoreo, alertas y receptores del destino.
MIG-E004. Comunicar a usuarios el inicio de la ventana.
MIG-E005. Poner el origen en solo lectura y registrar la hora.
MIG-E006. Aplicar el último delta de datos al destino.
MIG-E007. Ejecutar reconciliación de conteos, sumas e invariantes.
MIG-E008. Ejecutar pruebas de humo de flujos críticos y autorización en el destino.
MIG-E009. Evaluar criterios de abortar y decidir continuar o retornar.
MIG-E010. Actualizar enrutamiento, DNS o configuración de clientes hacia el destino.
MIG-E011. Actualizar webhooks y tareas programadas con propietario único.
MIG-E012. Observar métricas durante el período de estabilización definido.
MIG-E013. Comunicar a usuarios el fin de la ventana y el canal de soporte.
MIG-E014. Registrar cronología, decisiones y resultados en el expediente de la migración.
MIG-E015. Mantener el origen en solo lectura durante el período de retorno acordado.
MIG-E016. Cada paso tiene responsable y verificación; ninguno se omite por presión de tiempo sin decisión registrada.

## Anexo F. Primer día del receptor

MIG-F001. Clonar el repositorio desde la fuente oficial y verificar la revisión entregada.
MIG-F002. Instalar las versiones de runtime documentadas y ejecutar las pruebas.
MIG-F003. Obtener credenciales propias por el canal autorizado.
MIG-F004. Desplegar en entorno de prueba siguiendo el procedimiento.
MIG-F005. Ejecutar un flujo de usuario permitido y uno denegado.
MIG-F006. Consultar paneles de monitoreo y entender cada señal crítica.
MIG-F007. Leer el registro de riesgos y pendientes.
MIG-F008. Registrar dudas y obstáculos encontrados para mejorar el paquete.
MIG-F009. El primer día no incluye cambios en producción salvo emergencia acompañada.
MIG-F010. El resultado del primer día se revisa con el equipo anterior.

## Anexo G. Preguntas de revisión por rol

MIG-G001. Arquitecto: ¿el patrón elegido respeta un único sistema autoritativo por dominio en cada fase?
MIG-G002. Arquitecto: ¿cada fase tiene retorno ensayado o punto de no retorno aprobado?
MIG-G003. Guía de pruebas: ¿la caracterización cubre flujos críticos, errores y límites?
MIG-G004. Seguridad: ¿los controles del origen existen y se verificaron en el destino?
MIG-G005. Datos: ¿la reconciliación usa invariantes y sumas además de conteos?
MIG-G006. Operación: ¿el monitoreo del destino funciona antes del corte?
MIG-G007. Cumplimiento: ¿cambian ubicación, proveedores o retención de datos personales?
MIG-G008. Receptor: ¿puedo operar el sistema siguiendo solo el paquete?
MIG-G009. Orquestador: ¿las acciones productivas tuvieron autorización registrada?
MIG-G010. Responsable: ¿los criterios de éxito definidos al inicio se cumplieron con evidencia?

## Anexo H. Señales de que la migración va mal

MIG-H001. La fecha de corte se fijó antes de conocer el volumen real de datos.
MIG-H002. No hay pruebas de caracterización o se editan para coincidir con el sistema nuevo.
MIG-H003. El retorno no se ha ensayado y nadie sabe cuánto tarda.
MIG-H004. La reconciliación solo compara conteos de filas.
MIG-H005. Los usuarios no saben qué cambiará ni cuándo.
MIG-H006. El sistema antiguo no tiene fecha ni responsable de retiro.
MIG-H007. Las preguntas sobre reglas de negocio se responden con suposiciones.
MIG-H008. Cada señal detectada se registra como riesgo con mitigación y responsable.

## Anexo I. Preguntas iniciales al responsable

MIG-I001. ¿Qué problema concreto debe resolver la migración y cómo sabremos que lo resolvió?
MIG-I002. ¿Qué no puede cambiar para los usuarios bajo ninguna circunstancia?
MIG-I003. ¿Cuánto tiempo de interrupción es aceptable y en qué horarios?
MIG-I004. ¿Quién mantendrá el sistema resultante?
MIG-I005. ¿Qué presupuesto y plazo están disponibles, y qué flexibilidad tienen?
MIG-I006. ¿Hay obligaciones contractuales o legales que afecten datos o proveedores?
MIG-I007. Las preguntas se formulan solo cuando la respuesta no está en el repositorio o la documentación.

## Anexo J. Campos de la aceptación de transferencia

MIG-J001. Sistema, versión y revisión transferidos.
MIG-J002. Receptor y responsable que acepta.
MIG-J003. Demostraciones realizadas con fecha y resultado.
MIG-J004. Pendientes reconocidos con responsable y plazo.
MIG-J005. Riesgos transferidos con responsable nuevo.
MIG-J006. Accesos revocados del equipo anterior.
MIG-J007. Período de acompañamiento con alcance y fecha de fin.
MIG-J008. Firma o aceptación registrada de ambas partes.

## Anexo K. Mantenimiento del módulo

MIG-K001. El módulo se revisa en cada edición mayor con evidencia de migraciones y transferencias reales.
MIG-K002. Las cláusulas sin consecuencia demostrada se retiran sin reutilizar sus identificadores.
MIG-K003. Las lecciones de migraciones fallidas se incorporan con caso de aceptación.
MIG-K004. Las referencias a otros módulos se verifican para mantener coherencia.
MIG-K005. La revisión se registra en el changelog.
MIG-K006. Los receptores que mantengan variantes documentan sus diferencias.
MIG-K007. Los casos trabajados se revisan para que sigan alineados con las cláusulas vigentes.
MIG-K008. La responsabilidad editorial corresponde a Pierre R. Boss (oprbguitar).

## Anexo L. Declaración final

MIG-L001. Este manual describe cómo quiero migrar y transferir sistemas; no ejecuta ninguna migración.
MIG-L002. Cada proyecto aporta evidencia propia de equivalencia, recuperación y aceptación del receptor.
MIG-L003. Los agentes preparan inventarios, pruebas y planes; las decisiones de corte y transferencia son humanas.
MIG-L004. Firma editorial: Pierre R. Boss (oprbguitar), con desarrollo documental asistido por IA.

## Anexo M. Caso trabajado: transferencia a un equipo de mantenimiento externo

MIG-M001. Estado inicial hipotético: un portal de trámites desarrollado internamente pasa a un proveedor externo de mantenimiento.
MIG-M002. El contrato exige que el código permanezca en el repositorio del titular y que el proveedor use cuentas nominales.
MIG-M003. El paquete incluye arquitectura, ADR, runbooks, registro de riesgos e historial de incidentes del último año.
MIG-M004. El proveedor declara experiencia en el framework pero no en la base de datos utilizada.
MIG-M005. El plan de formación incluye ejercicio guiado de restauración y revisión de consultas lentas conocidas.
MIG-M006. El proveedor despliega en su propio pipeline y descubre una variable de entorno no documentada.
MIG-M007. La variable se documenta, se añade al ejemplo de configuración y el validador de arranque la exige con mensaje claro.
MIG-M008. El proveedor demuestra despliegue, reversión, restauración y diagnóstico de un incidente simulado.
MIG-M009. Las cuentas del equipo interno se reducen a lectura y las credenciales compartidas se rotan.
MIG-M010. El dominio y los certificados permanecen a nombre del titular con el proveedor como contacto técnico.
MIG-M011. El acompañamiento de seis semanas registra once consultas, de las cuales cuatro mejoran el paquete.
MIG-M012. La aceptación se firma con dos pendientes de baja prioridad y responsables asignados.
MIG-M013. El caso es un ejercicio de diseño y no describe un contrato real.

## Anexo N. Caso trabajado: migración de un asistente de IA a otro proveedor

MIG-N001. Estado inicial hipotético: un asistente de soporte usa un proveedor de modelos con costo creciente.
MIG-N002. La evaluación con doscientos casos etiquetados compara el proveedor actual y dos candidatos.
MIG-N003. Un candidato iguala la calidad en respuestas, pero falla en salidas estructuradas para derivación a humanos.
MIG-N004. El otro candidato cumple ambos criterios con menor costo medido en el conjunto de evaluación.
MIG-N005. La revisión de privacidad aprueba la región y retención del candidato elegido.
MIG-N006. El índice de recuperación se regenera con el modelo de embeddings del nuevo proveedor.
MIG-N007. El canary inicia con conversaciones internas y luego con un porcentaje creciente de clientes.
MIG-N008. Las métricas de derivación correcta y satisfacción se comparan con la población de control.
MIG-N009. Tras la promoción completa, el proveedor anterior queda configurado como retorno durante un mes.
MIG-N010. Las cifras del caso son ilustrativas.

## Anexo O. Caso trabajado: coexistencia de proveedores de pago

MIG-O001. Estado inicial hipotético: suscripciones mensuales activas en el proveedor A y decisión de migrar a B.
MIG-O002. Los ciclos que comienzan antes de la fecha de corte se cobran en A; los nuevos ciclos se crean en B.
MIG-O003. Los instrumentos de pago no se copian entre proveedores; los clientes registran su medio en B al renovar.
MIG-O004. La comunicación explica el cambio y la seguridad del nuevo registro sin imitar mensajes fraudulentos.
MIG-O005. Las disputas y devoluciones de cobros en A se atienden en A hasta su cierre.
MIG-O006. La conciliación diaria cubre ambos proveedores durante la coexistencia.
MIG-O007. Un cliente con pago incierto en A no recibe cobro en B hasta reconciliar.
MIG-O008. Tras cerrar todas las disputas y el último ciclo en A, se desactivan nuevos cobros y se conserva acceso a reportes.
MIG-O009. La aceptación verifica cero cobros duplicados y conciliación completa por periodo.
MIG-O010. El caso es didáctico y no describe proveedores reales.

## Anexo P. Secciones mínimas de un plan de migración

MIG-P001. Propósito y criterios de éxito verificables.
MIG-P002. Alcance y exclusiones.
MIG-P003. Inventario y reglas de negocio con referencias.
MIG-P004. Estrategia y patrón por frontera con ADR.
MIG-P005. Hitos con responsable, verificación y dependencia.
MIG-P006. Mapeo de datos y reconciliación.
MIG-P007. Retorno o reparación hacia adelante por fase.
MIG-P008. Canary y criterios de promoción.
MIG-P009. Comunicación y soporte.
MIG-P010. Registro de riesgos.
MIG-P011. Progreso, decisiones y descubrimientos actualizados durante la ejecución.
MIG-P012. Retiro del sistema antiguo.
MIG-P013. La plantilla EXEC-PLAN puede usarse como base adaptando estas secciones.

## Anexo Q. Mensajes tipo para usuarios

MIG-Q001. Aviso previo: qué cambiará, fecha y hora de la ventana, impacto esperado y canal de ayuda.
MIG-Q002. Recordatorio: confirmación de la ventana y acciones que el usuario debe realizar, si las hay.
MIG-Q003. Inicio de ventana: el sistema está en mantenimiento y cuándo se espera el retorno.
MIG-Q004. Fin de ventana: el sistema nuevo está disponible, dónde encontrar la guía y cómo reportar problemas.
MIG-Q005. Retorno: el cambio se pospuso, el sistema anterior sigue funcionando y se informará la nueva fecha.
MIG-Q006. Los mensajes se redactan en español de Perú, sin jerga técnica y sin pedir credenciales.
MIG-Q007. Los mensajes se envían solo con autorización del responsable.

## Anexo R. Elección de patrón por situación

MIG-R001. Dominio con fronteras claras y tráfico enrutable: estrangulamiento progresivo.
MIG-R002. Implementación sustituible detrás de una interfaz: rama por abstracción.
MIG-R003. Sistema antiguo con modelo de datos defectuoso que no debe contaminar el nuevo: capa anticorrupción.
MIG-R004. Cálculos o lecturas que deben compararse con datos reales: ejecución en sombra.
MIG-R005. Imposibilidad técnica de coexistencia demostrada: corte único ensayado.
MIG-R006. Cambio de estructura de datos sin interrupción: expansión y contracción.
MIG-R007. Los patrones pueden combinarse por dominio, con frontera y propietario explícitos.
MIG-R008. La elección se registra con la evidencia que la sostiene.

## Anexo S. Métricas de la migración

MIG-S001. Porcentaje de casos de caracterización que pasan en el destino.
MIG-S002. Diferencias encontradas por lote en la reconciliación y su resolución.
MIG-S003. Duración del corte frente a la ventana ensayada.
MIG-S004. Incidentes en las primeras semanas comparados con el periodo previo.
MIG-S005. Consultas de soporte relacionadas con el cambio.
MIG-S006. Costo real frente a estimación por fase.
MIG-S007. Las métricas se calculan con datos registrados y no con impresiones.

## Anexo T. Errores frecuentes en transferencias

MIG-T001. Entregar documentación que nadie siguió en un entorno limpio.
MIG-T002. Dejar credenciales personales del equipo anterior en uso.
MIG-T003. Olvidar dominios, certificados o cuentas a nombre de personas que se van.
MIG-T004. Resolver incidentes del acompañamiento sin involucrar al receptor.
MIG-T005. Transferir sin registro de riesgos ni pendientes.
MIG-T006. Considerar terminada la transferencia al hacer push del código.
MIG-T007. Cada error tiene una cláusula preventiva en las secciones 36 a 41.

## Anexo U. Uso del sistema de agentes en una migración

MIG-U001. Solicita al orquestador el modo MIGRATE con objetivo, alcance y autorizaciones explícitas.
MIG-U002. El orquestador activa al arqueólogo para inventario y reglas en solo lectura.
MIG-U003. La guía de pruebas escribe caracterización sobre el sistema existente.
MIG-U004. El arquitecto propone patrón, contratos y mapeo con ADR para aprobación del responsable.
MIG-U005. El planificador crea el plan ejecutable con hitos, retorno y criterios de abortar.
MIG-U006. El implementador ejecuta fases dentro de su ownership con pruebas en verde.
MIG-U007. El verificador ejecuta equivalencia y reconciliación con evidencia.
MIG-U008. El revisor de seguridad verifica controles del destino.
MIG-U009. El gestor de releases prepara canary, retorno y paquete de transferencia.
MIG-U010. El responsable aprueba cada punto de no retorno y el corte.
MIG-U011. El orquestador reporta participantes reales, verificación y pendientes al cierre.
MIG-U012. La skill [eos-migrate](../../skills/eos-migrate/SKILL.md) concreta este procedimiento.

## Anexo V. Ensayo del retorno

MIG-V001. El retorno se ensaya en el entorno de ensayo después de completar el corte de prueba.
MIG-V002. Se crean datos nuevos en el destino de prueba para verificar su tratamiento al retornar.
MIG-V003. Se ejecuta el procedimiento de retorno y se mide su duración.
MIG-V004. Se verifica que el origen recupera el servicio con los datos esperados.
MIG-V005. Se documenta qué datos nuevos se pierden o cómo se reingresan.
MIG-V006. Un retorno que no puede completarse dentro de la ventana obliga a revisar la estrategia antes del corte real.
MIG-V007. El resultado del ensayo se registra en el plan con fecha y responsable.

## Anexo W. Verificación a los treinta días

MIG-W001. Se revisan incidentes, consultas de soporte y métricas desde el corte.
MIG-W002. Se confirma que los criterios de éxito iniciales se cumplen con evidencia.
MIG-W003. Se verifica que las tareas programadas, reportes e integraciones funcionan en sus ciclos completos.
MIG-W004. Se decide el retiro del sistema antiguo o la extensión del período de retorno.
MIG-W005. Se registran lecciones para futuras migraciones.
MIG-W006. El plazo de treinta días es un ejemplo; cada proyecto fija el suyo según sus ciclos de negocio.

## Anexo X. Preguntas frecuentes del receptor

MIG-X001. ¿Dónde está la fuente de verdad de la configuración? En el repositorio para valores no secretos y en el gestor para secretos.
MIG-X002. ¿Cómo sé qué está en transición? Los diagramas y ADR marcan componentes en transición y su fecha de retiro.
MIG-X003. ¿Qué hago ante un incidente? Sigue el runbook correspondiente y el manual de respuesta a incidentes.
MIG-X004. ¿Puedo cambiar la arquitectura? Sí, con ADR nuevo que explique la razón y las consecuencias.
MIG-X005. ¿A quién consulto sobre decisiones históricas? A los registros de decisiones y, durante el acompañamiento, al equipo anterior.
MIG-X006. ¿Qué pendientes heredo? Los listados en la aceptación con su prioridad y plazo.
MIG-X007. ¿Qué pasa si encuentro un error en la documentación? Corrígelo en la fuente y regístralo en el changelog.
MIG-X008. ¿Cómo uso los agentes incluidos? Revisa sus herramientas, ajústalas a tu perfil y sigue el manual de orquestación.
MIG-X009. ¿Qué tareas periódicas debo programar? Las del calendario del paquete: certificados, rotaciones y ensayos.
MIG-X010. ¿Cuándo termina el acompañamiento? En la fecha acordada en la aceptación, con pendientes registrados.

## Anexo Y. Caso trabajado: migración de interfaz a un framework nuevo

MIG-Y001. Estado inicial hipotético: interfaz de administración con un framework sin soporte y problemas de accesibilidad conocidos.
MIG-Y002. Se caracterizan los diez flujos principales con pruebas de extremo a extremo y verificación de teclado.
MIG-Y003. La migración avanza flujo por flujo detrás de rutas nuevas, con redirecciones desde las antiguas.
MIG-Y004. Cada flujo migrado pasa las pruebas existentes y nuevas de accesibilidad antes de redirigir usuarios.
MIG-Y005. Los defectos de accesibilidad del sistema antiguo se corrigen como mejoras intencionales registradas.
MIG-Y006. Los usuarios internos usan primero los flujos nuevos y reportan diferencias.
MIG-Y007. Tras migrar todos los flujos, se elimina el framework antiguo y se verifica el tamaño de los recursos servidos.
MIG-Y008. El caso es ilustrativo.

## Anexo Z. Caso trabajado: de servidor local a nube

MIG-Z001. Estado inicial hipotético: aplicación con base y archivos en un servidor de oficina sin redundancia.
MIG-Z002. El motivo es eliminar el punto único de falla y permitir trabajo remoto seguro.
MIG-Z003. La arqueología registra puertos abiertos, tareas programadas y un script de copia a un disco externo.
MIG-Z004. El destino en nube se configura con red privada, acceso administrado, cifrado y backups con copia inmutable.
MIG-Z005. El monitoreo y las alertas se verifican antes de migrar datos.
MIG-Z006. La copia inicial se hace fuera de horario y el delta se aplica en una ventana breve.
MIG-Z007. La exposición externa se verifica desde internet y solo responde el puerto de la aplicación con certificado válido.
MIG-Z008. El servidor de oficina queda en solo lectura un mes y luego se borra de forma segura.
MIG-Z009. El costo mensual real se compara con la estimación y se ajusta el tamaño de instancias.
MIG-Z010. El caso es ilustrativo.

## Anexo AA. Verificación de seguridad del destino

MIG-AA01. Matriz de autorización probada con casos positivos y negativos.
MIG-AA02. Secretos nuevos o rotados, almacenados en el gestor.
MIG-AA03. Exposición de red verificada desde fuera.
MIG-AA04. Encabezados de seguridad y TLS verificados en el despliegue.
MIG-AA05. Limitación de intentos y controles de abuso presentes.
MIG-AA06. Registros de seguridad funcionando con receptores de alertas.
MIG-AA07. Dependencias auditadas sin vulnerabilidades críticas abiertas sin decisión.
MIG-AA08. Backups cifrados con credenciales separadas.
MIG-AA09. Cada punto con evidencia y fecha antes del corte.

## Anexo AB. Diagnóstico ante divergencias de equivalencia

MIG-AB01. ¿La diferencia proviene de datos, de lógica, de configuración o del entorno?
MIG-AB02. ¿La diferencia es una corrección intencional ya decidida?
MIG-AB03. ¿Afecta a un caso aislado o a una clase completa de registros?
MIG-AB04. ¿La caracterización capturó correctamente el comportamiento original?
MIG-AB05. ¿Hay zona horaria, redondeo o codificación involucrados?
MIG-AB06. ¿Qué decisión necesita el responsable y con qué evidencia?
MIG-AB07. Cada divergencia se registra con su diagnóstico y resolución.

## Anexo AC. Contenido mínimo del ADR de migración

MIG-AC01. Contexto con el problema medido que motiva la migración.
MIG-AC02. Opciones evaluadas, incluida no migrar.
MIG-AC03. Decisión con patrón y alcance.
MIG-AC04. Consecuencias positivas y negativas aceptadas.
MIG-AC05. Criterios de éxito y fecha de revisión.
MIG-AC06. Responsable que aprobó y fecha.
MIG-AC07. La plantilla [ADR](../../templates/ADR.md) ofrece la estructura base.

## Anexo AD. Compromisos del equipo saliente

MIG-AD01. Entregar documentación verificada en entorno limpio.
MIG-AD02. Responder consultas durante el acompañamiento en los plazos acordados.
MIG-AD03. No conservar accesos más allá de lo acordado.
MIG-AD04. Informar riesgos conocidos aunque sean incómodos.
MIG-AD05. Permitir que el receptor ejecute, aunque sea más lento al principio.
MIG-AD06. Registrar el cierre de su responsabilidad con fecha.

## Anexo AE. Señales de una transferencia exitosa

MIG-AE01. El receptor resuelve incidentes sin llamar al equipo anterior.
MIG-AE02. Las consultas al equipo anterior disminuyen hasta desaparecer antes del fin del acompañamiento.
MIG-AE03. El receptor mejora la documentación con sus propios aprendizajes.
MIG-AE04. Los ensayos de restauración se realizan según calendario por el receptor.
MIG-AE05. Los riesgos transferidos tienen seguimiento activo del nuevo responsable.
MIG-AE06. Las señales se evalúan con evidencia y no con autoevaluación optimista.

## Anexo AF. Plantillas relacionadas

MIG-AF01. [HANDOFF-CHECKLIST](../../templates/HANDOFF-CHECKLIST.md) para verificar la transferencia.
MIG-AF02. [EXEC-PLAN](../../templates/EXEC-PLAN.md) para el plan vivo de la migración.
MIG-AF03. [RELEASE-RECORD](../../templates/RELEASE-RECORD.md) para registrar las versiones promovidas.
MIG-AF04. [EXCEPTION](../../templates/EXCEPTION.md) para desviaciones aprobadas de este manual.
MIG-AF05. [FINDING](../../templates/FINDING.md) para hallazgos de revisión durante la migración.
MIG-AF06. Las plantillas se adaptan al tamaño del proyecto sin eliminar campos de evidencia.

## Anexo AG. Migración de datos con muchos tenants

MIG-AG01. La migración por tenant permite avanzar por lotes con verificación y retorno individual.
MIG-AG02. El orden de tenants se elige por tamaño, criticidad y disposición a participar en las primeras olas.
MIG-AG03. Cada tenant migrado pasa reconciliación propia antes de habilitarse en el destino.
MIG-AG04. El enrutamiento por tenant indica qué sistema atiende a cada uno durante la transición.
MIG-AG05. Un tenant con problemas retorna sin afectar a los ya migrados.
MIG-AG06. La comunicación se personaliza por ola con fecha específica para cada tenant.
MIG-AG07. Las métricas se comparan entre tenants migrados y pendientes durante la transición.
MIG-AG08. Caso hipotético: el tenant más grande se migra primero y su volumen satura el destino.
MIG-AG09. El orden se corrige empezando por tenants pequeños y dimensionando el destino con lo aprendido.
MIG-AG10. Quiero migrar clientes de uno en uno cuando eso reduce el riesgo para todos.

## Anexo AH. Migración de configuración y banderas

MIG-AH01. La configuración del origen se inventaría con valores por entorno y se compara con el destino.
MIG-AH02. Las diferencias de configuración se justifican o se corrigen antes del corte.
MIG-AH03. Los valores por defecto del destino se revisan porque pueden activar comportamientos no deseados.
MIG-AH04. Las banderas del origen se mapean al destino con su estado y propietario.
MIG-AH05. Caso hipotético: el destino activa por defecto un registro detallado que expone datos personales.
MIG-AH06. La comparación de configuración detecta la diferencia y se corrige antes de recibir tráfico.
MIG-AH07. Quiero que el sistema nuevo arranque con la configuración que decidí, no con la que traía de fábrica.

## Anexo AI. Pruebas de rendimiento comparativas

MIG-AI01. La carga de prueba reproduce la mezcla de operaciones y volumen observados en el origen.
MIG-AI02. Las mismas pruebas se ejecutan contra origen y destino en condiciones comparables.
MIG-AI03. Los resultados registran latencia por percentil, errores, uso de recursos y costo.
MIG-AI04. Una regresión de rendimiento se investiga y se corrige o se acepta con decisión registrada.
MIG-AI05. Caso hipotético: el destino responde más rápido en promedio pero su percentil alto empeora por una consulta sin índice.
MIG-AI06. El índice se añade y la prueba repetida confirma mejora en todos los percentiles.
MIG-AI07. Quiero que el sistema nuevo sea al menos tan rápido para todos, no solo en promedio.

## Anexo AJ. Revisión final del módulo

MIG-AJ01. Este módulo aplica las reglas de evidencia de PRIME-DIRECTIVE a cada decisión de migración y transferencia.
MIG-AJ02. Su extensión responde al requisito del propietario; su valor se mide en migraciones verificadas.
MIG-AJ03. Las propuestas de mejora se dirigen a Pierre R. Boss (oprbguitar) con evidencia y cláusulas afectadas.
MIG-AJ04. Cada proyecto conserva sus propios registros de migración y transferencia como evidencia.
MIG-AJ05. Los agentes aplican estas cláusulas dentro de los permisos que el host y el responsable conceden.
MIG-AJ06. Ninguna cláusula autoriza acciones externas por sí misma.
MIG-AJ07. Las secciones de la Parte I se conservan como antecedente normativo resumido.
MIG-AJ08. La coherencia entre Parte I y Parte II se revisa en cada edición.

## Anexo AK. Preguntas de cierre del responsable

MIG-AK01. ¿Se cumplieron los criterios de éxito definidos antes de empezar, con evidencia enlazada?
MIG-AK02. ¿Qué reglas de negocio se conservaron, cuáles se corrigieron y quién decidió cada corrección?
MIG-AK03. ¿Qué diferencias de equivalencia se aceptaron y con qué tolerancia aprobada?
MIG-AK04. ¿Se ensayó el retorno y cuánto tardó en el último ensayo registrado?
MIG-AK05. ¿Qué datos quedaron archivados, dónde y con qué procedimiento de consulta?
MIG-AK06. ¿Qué accesos del sistema antiguo y del equipo anterior se revocaron?
MIG-AK07. ¿Qué riesgos residuales quedan y quién es su responsable ahora?
MIG-AK08. ¿Qué costo real tuvo la migración frente a la estimación aprobada?
MIG-AK09. ¿Qué aprendimos que deba cambiar en este manual o en las instrucciones de los agentes?
MIG-AK10. ¿Puede el receptor operar el sistema sin depender de quienes lo migraron?
MIG-AK11. Las respuestas se registran en el expediente de la migración con fecha y responsable.
MIG-AK12. Una respuesta sin evidencia se registra como pendiente en lugar de afirmarse.
MIG-AK13. Las preguntas se adaptan al tamaño de la migración y se omiten justificadamente cuando no aplican.
MIG-AK14. El cierre formal de la migración ocurre solo cuando estas preguntas tienen respuesta verificable o pendiente asignado.
MIG-AK15. Este anexo cierra el módulo dirigido por Pierre R. Boss (oprbguitar).

## Anexo AL. Recordatorios operativos breves

MIG-AL01. Ninguna migración empieza sin causa medida y criterio de éxito.
MIG-AL02. Ningún cambio de comportamiento se hace sin caracterización previa.
MIG-AL03. Ningún dominio tiene dos sistemas autoritativos al mismo tiempo.
MIG-AL04. Ningún corte ocurre sin retorno ensayado o punto de no retorno aprobado.
MIG-AL05. Ninguna ejecución en sombra produce efectos externos reales.
MIG-AL06. Ninguna reconciliación se limita a contar filas.
MIG-AL07. Ningún sistema antiguo se apaga sin verificar ausencia de consumidores.
MIG-AL08. Ninguna transferencia termina sin demostración del receptor.
MIG-AL09. Ninguna credencial personal sobrevive a la transferencia.
MIG-AL10. Ningún agente ejecuta acciones productivas de migración sin autorización específica.
MIG-AL11. Ninguna prueba de caracterización se edita sin decisión registrada.
MIG-AL12. Ningún dato personal queda en copias temporales tras cerrar la migración.
MIG-AL13. Estos recordatorios resumen cláusulas desarrolladas en las secciones anteriores y no las sustituyen.

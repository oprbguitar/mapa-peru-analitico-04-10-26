# CAPABILITY PROFILER — clasificación, admisión y ciclo de vida de capacidades

**Edición:** 3.0.0. **Fecha documental:** 2026-10-03, Perú.
**Autoría y dirección:** Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.
**Naturaleza:** especificación de ingeniería; no implementa un perfilador automático ni activa capacidades en ningún proyecto.
**Origen:** desarrollo de la sección 2 de la [constitución maestra](../../EOS_MASTER_SYSTEM_INSTRUCTION.md) y de [SRC-03](../sources/SRC-03-master-constitution.txt), con aportes de SRC-01, SRC-02 y SRC-04.

Este manual decide qué capacidades de EOS necesita cada producto, en qué orden se activan, cómo se verifica que funcionan y cuándo se degradan o retiran. La regla central es que una capacidad presente en el estándar no está activa en todos los proyectos. Los identificadores CAP son requisitos estables de revisión. Los perfiles, umbrales y ejemplos son hipotéticos salvo que un proyecto aporte evidencia propia. Lee también [PRIME-DIRECTIVE](PRIME-DIRECTIVE.md) para autoridad y evidencia, y la plantilla [CAPABILITY-MATRIX](../../templates/CAPABILITY-MATRIX.md) para el registro.

## 01. Mandato y principio de proporcionalidad

CAP-0101. Quiero que cada producto active las capacidades que su riesgo, sus usuarios y sus datos justifican, ni más ni menos.
CAP-0102. Una capacidad documentada en EOS es una opción disponible, no una obligación de instalarla en cada sistema.
CAP-0103. Activar capacidades innecesarias añade costo, superficie de ataque, mantenimiento y complejidad para el receptor.
CAP-0104. Omitir capacidades necesarias deja riesgos sin control y promesas sin respaldo ante usuarios.
CAP-0105. La decisión de activar se basa en el perfil del proyecto, la evidencia disponible y la aprobación del responsable.
CAP-0106. Toda capacidad evaluada queda registrada con su estado, aunque la decisión sea no activarla.
CAP-0107. La ausencia de registro de una capacidad relevante se considera evaluación pendiente, no decisión de omitirla.
CAP-0108. El perfil se revisa cuando cambian usuarios, datos, jurisdicciones, volumen, integraciones o modelo comercial.
CAP-0109. La proporcionalidad no reduce controles exigidos por obligaciones aplicables verificadas.
CAP-0110. La proporcionalidad tampoco justifica construir controles de nivel bancario para un sitio informativo.
CAP-0111. Los agentes pueden proponer perfiles y matrices con evidencia; la activación corresponde al responsable.
CAP-0112. Una activación sin responsable operativo asignado no puede llegar a OPERATING.
CAP-0113. El perfil y la matriz forman parte de la documentación viva del proyecto y se versionan con él.
CAP-0114. Las capacidades activas se explican al receptor del sistema con su propósito y su costo de operación.
CAP-0115. Quiero sistemas que tengan exactamente la complejidad que su propósito exige.

## 02. Ciclo de vida canónico de una capacidad

CAP-0201. Los estados canónicos son PRESENT, ASSESSED, DORMANT, PLANNED, IMPLEMENTED, VERIFIED, OPERATING, DEGRADED y RETIRED.
CAP-0202. PRESENT indica que la capacidad existe en el estándar EOS y puede considerarse para el proyecto.
CAP-0203. ASSESSED indica que se evaluó su aplicabilidad con evidencia del perfil y existe una decisión registrada.
CAP-0204. DORMANT indica que la capacidad se mantiene disponible como contrato o punto de extensión, sin ejecución activa.
CAP-0205. PLANNED indica que existe diseño aprobado y tareas identificables para implementarla.
CAP-0206. IMPLEMENTED indica que existen artefactos reales en el proyecto, sin implicar que pasen pruebas.
CAP-0207. VERIFIED indica evidencia de pruebas con ambiente, versión, fecha, resultado y límites.
CAP-0208. OPERATING indica implementación verificada con responsable, monitoreo, recuperación y permisos vigentes en el entorno real.
CAP-0209. DEGRADED indica que una capacidad operativa perdió alguno de sus requisitos, como monitoreo o recuperación.
CAP-0210. RETIRED indica que la capacidad se desactivó con tratamiento documentado de datos, credenciales y dependencias.
CAP-0211. Cada transición registra fecha, actor, evidencia y razón.
CAP-0212. No se salta de PRESENT a OPERATING sin pasar por evaluación, implementación y verificación registradas.
CAP-0213. Una capacidad puede volver de OPERATING a DEGRADED automáticamente cuando falla un requisito medible.
CAP-0214. Volver de DEGRADED a OPERATING exige restaurar el requisito y verificarlo de nuevo.
CAP-0215. Una capacidad RETIRED puede reactivarse solo pasando de nuevo por evaluación, porque el contexto pudo cambiar.
CAP-0216. El estado se declara en la matriz del proyecto y no en textos comerciales que lo exageren.
CAP-0217. Caso hipotético: un proyecto declara la capacidad de backups como OPERATING, pero nunca restauró un backup.
CAP-0218. La revisión reclasifica la capacidad a IMPLEMENTED hasta que un ensayo de restauración aporte evidencia.
CAP-0219. La aceptación verifica que la matriz refleja el estado corregido y la fecha del ensayo programado.
CAP-0220. Quiero estados de capacidad que digan la verdad sobre lo que realmente funciona.

## 03. Ejes complementarios de evaluación

CAP-0301. Además del estado canónico, cada capacidad se evalúa en tres ejes: aplicabilidad, implementación y evidencia.
CAP-0302. La aplicabilidad puede ser REQUIRED, OPTIONAL, NOT_APPLICABLE o UNDETERMINED.
CAP-0303. La implementación puede ser ABSENT, DOCUMENTED, IMPLEMENTED_INACTIVE o ACTIVE.
CAP-0304. La evidencia puede ser VERIFIED, PARTIAL, MISSING o NOT_APPLICABLE.
CAP-0305. REQUIRED proviene de obligación verificada, riesgo alto del perfil o compromiso con clientes.
CAP-0306. OPTIONAL indica beneficio sin obligación, sujeto a costo y prioridad del responsable.
CAP-0307. NOT_APPLICABLE exige justificación concreta basada en el perfil, no una suposición conveniente.
CAP-0308. UNDETERMINED se resuelve con información faltante identificada y responsable de obtenerla.
CAP-0309. DOCUMENTED indica contrato o diseño sin código; IMPLEMENTED_INACTIVE indica código desactivado.
CAP-0310. ACTIVE indica ejecución habilitada en algún entorno, que debe declararse.
CAP-0311. PARTIAL indica evidencia que cubre parte del alcance y declara lo no cubierto.
CAP-0312. Los ejes descomponen el estado canónico sin sustituirlo; ambos se registran juntos.
CAP-0313. Una capacidad REQUIRED con evidencia MISSING es un hallazgo de alta prioridad.
CAP-0314. Una capacidad NOT_APPLICABLE con implementación ACTIVE indica complejidad innecesaria o perfil desactualizado.
CAP-0315. Quiero ver de un vistazo qué se necesita, qué existe y qué está demostrado.

## 04. Perfiles de sistema

CAP-0401. Los perfiles de referencia incluyen sitio estático, sitio de contenido, herramienta interna, CRM, ERP, SaaS, comercio electrónico y marketplace.
CAP-0402. También incluyen sistema del sector público, aplicación de escritorio, aplicación móvil, aplicación offline, tiempo real, plataforma de datos, sistema de IA, sistema de pagos y sistema crítico.
CAP-0403. Un proyecto puede combinar perfiles, por ejemplo SaaS con pagos e IA, y la matriz resulta de la unión justificada.
CAP-0404. El perfil se determina por comportamiento real, no por el nombre que el proyecto se da.
CAP-0405. El perfil considera usuarios, volumen, datos tratados, dinero involucrado, integraciones, jurisdicciones y criticidad.
CAP-0406. Un perfil mal asignado produce sobreingeniería o riesgos sin control; se corrige al detectarlo.
CAP-0407. Los perfiles son puntos de partida; cada proyecto ajusta la matriz con evidencia propia.
CAP-0408. La plantilla [PROJECT-PROFILE](../../templates/PROJECT-PROFILE.md) registra el perfil con su evidencia.
CAP-0409. Caso hipotético: una herramienta interna empieza a ser usada por clientes externos sin revisión del perfil.
CAP-0410. La revisión detecta el cambio de usuarios y reclasifica el perfil, activando controles de autenticación y aislamiento.
CAP-0411. Quiero que el perfil describa lo que el sistema es hoy, no lo que fue cuando se creó.

## 05. Entradas obligatorias del perfilado

CAP-0501. Propósito del sistema y tareas principales de sus usuarios.
CAP-0502. Tipos de usuarios, número aproximado medido o estimado con fuente, y si son internos o externos.
CAP-0503. Datos tratados con clasificación y presencia de datos personales o financieros.
CAP-0504. Flujos de dinero: si cobra, si custodia fondos, si emite comprobantes.
CAP-0505. Integraciones con terceros y su criticidad.
CAP-0506. Jurisdicciones de operación, de usuarios y de almacenamiento de datos.
CAP-0507. Requisitos de disponibilidad y recuperación expresados por el responsable.
CAP-0508. Recursos disponibles: presupuesto, equipo, hardware y capacidad operativa del receptor.
CAP-0509. Restricciones técnicas: sistemas operativos, entornos offline, dependencias existentes.
CAP-0510. Compromisos comerciales o contractuales que afecten capacidades.
CAP-0511. Uso previsto de IA y restricciones de privacidad asociadas.
CAP-0512. Los datos faltantes se registran como pendientes; no se rellenan con supuestos presentados como hechos.
CAP-0513. Un agente obtiene la mayoría de entradas del repositorio y la documentación antes de preguntar al responsable.
CAP-0514. Las preguntas al responsable se limitan a entradas que cambian materialmente la matriz.
CAP-0515. Quiero perfiles construidos con evidencia, no con imaginación.

## 06. Familias de capacidades de EOS

CAP-0601. Línea base de seguridad: dependencias, secretos, encabezados, validación de entradas y registros mínimos.
CAP-0602. Seguridad avanzada: autorización multi-tenant, detección de abuso, respuesta automatizada y endurecimiento.
CAP-0603. Documentación: perfil, decisiones, operación, instalación y transferencia.
CAP-0604. Observabilidad básica: salud funcional, errores y métricas esenciales con receptor.
CAP-0605. Observabilidad avanzada: trazas, objetivos de servicio y paneles por dominio.
CAP-0606. Almacenamiento gobernado: inventario, forecast, cuotas, backups y restauración.
CAP-0607. Pagos: puerto, idempotencia, webhooks, ledger y conciliación.
CAP-0608. AI Integration Port: contrato disponible con modo OFF por defecto.
CAP-0609. AI Gateway activo: proveedores, herramientas, guardrails, evaluación y presupuestos.
CAP-0610. Actualización y fiabilidad: releases reproducibles, migraciones y reversión.
CAP-0611. Respuesta a incidentes: playbooks, registro, comunicación y postmortem.
CAP-0612. Cumplimiento y propiedad intelectual: matriz de aplicabilidad, licencias y promesas comerciales.
CAP-0613. Migración y transferencia: arqueología, equivalencia y paquete del receptor.
CAP-0614. Orquestación de agentes: roles, delegación, permisos y evidencia.
CAP-0615. Sincronización y offline: versiones, conflictos y operaciones pendientes.
CAP-0616. Cada familia se detalla en su manual correspondiente; este módulo decide su activación.
CAP-0617. Quiero un catálogo claro de lo que EOS puede aportar a cada producto.

## 07. Capacidades siempre activas

CAP-0701. Todo proyecto activa la línea base de seguridad proporcional a su exposición.
CAP-0702. Todo proyecto activa documentación mínima: propósito, instalación, verificación y decisiones relevantes.
CAP-0703. Todo proyecto con usuarios activa observabilidad básica con al menos una señal de salud funcional.
CAP-0704. Todo proyecto conserva el AI Integration Port como contrato disponible en modo OFF.
CAP-0705. Todo proyecto registra su perfil y su matriz de capacidades.
CAP-0706. Todo proyecto declara su procedimiento de recuperación ante pérdida del entorno, aunque sea redesplegar desde el repositorio.
CAP-0707. Estas capacidades base se dimensionan al proyecto: en un sitio estático pueden ser pocas líneas de documentación y configuración.
CAP-0708. El AI Integration Port en modo OFF no descarga modelos, no llama proveedores y no genera gasto.
CAP-0709. Caso hipotético: un sitio estático personal registra su perfil en una página, activa encabezados de seguridad y documenta el redespliegue.
CAP-0710. No activa pagos, almacenamiento gobernado ni respuesta automatizada porque su perfil no los necesita.
CAP-0711. Quiero un mínimo responsable en todo lo que construyo, sin cargar cada proyecto con todo lo posible.

## 08. Matriz de referencia por perfil: sitios y herramientas

CAP-0801. Sitio estático: línea base de seguridad, documentación, redespliegue y puerto de IA en OFF.
CAP-0802. Sitio estático: no activa base de datos, sesiones, pagos ni almacenamiento gobernado salvo necesidad demostrada.
CAP-0803. Sitio de contenido con editor: añade autenticación de editores, backups del contenido y registro de cambios.
CAP-0804. Sitio de contenido con comentarios: añade moderación, protección contra abuso y tratamiento de datos personales.
CAP-0805. Herramienta interna: añade autenticación, autorización por rol, registro de accesos y backups de datos.
CAP-0806. Herramienta interna con datos sensibles: añade auditoría de exportaciones y revisión periódica de accesos.
CAP-0807. Cada matriz de referencia se ajusta con evidencia; no se adopta literalmente.
CAP-0808. Caso hipotético: un sitio de contenido añade un formulario de contacto que guarda mensajes.
CAP-0809. La matriz añade tratamiento de datos personales, retención de mensajes y protección contra envíos automatizados.
CAP-0810. Quiero que cada pequeño cambio de función revise si cambia lo que debo proteger.

## 09. Matriz de referencia: CRM y ERP

CAP-0901. CRM: monitoreo de sesiones y usuarios, auditoría de accesos, gobierno de almacenamiento y evaluación de facturación.
CAP-0902. CRM: autorización por rol y por cartera de clientes cuando los usuarios no deben ver toda la información.
CAP-0903. CRM: tratamiento de datos personales de contactos con retención y derechos de titulares.
CAP-0904. ERP: auditoría completa de operaciones, gobierno de datos, gestión de capacidad y registro de integraciones.
CAP-0905. ERP: evaluación de capacidad de pagos y controles financieros según los módulos activos.
CAP-0906. ERP: disponibilidad y recuperación reforzadas por su papel en la operación del negocio.
CAP-0907. ERP: migraciones de datos con reconciliación estricta y caracterización de reglas de negocio.
CAP-0908. Caso hipotético: un ERP pequeño para una empresa familiar no necesita alta disponibilidad multi-región.
CAP-0909. La matriz activa backups verificados, recuperación en horas y auditoría, sin replicación geográfica costosa.
CAP-0910. Quiero controles fuertes donde el negocio depende del sistema, dimensionados a su tamaño real.

## 10. Matriz de referencia: SaaS, comercio y marketplace

CAP-1001. SaaS: aislamiento multi-tenant, autorización por objeto, cuotas por tenant y política de escalado.
CAP-1002. SaaS con suscripciones: pagos recurrentes, conciliación y comunicación de cambios de plan.
CAP-1003. Comercio electrónico: pasarela de pagos, controles de consumidor, protección contra abuso y conciliación.
CAP-1004. Comercio electrónico: gestión de inventario con integridad bajo concurrencia.
CAP-1005. Marketplace: separación de fondos entre vendedores y plataforma según contratos y revisión competente.
CAP-1006. Marketplace: verificación de vendedores y gestión de disputas.
CAP-1007. Estas capacidades se activan por etapas según el crecimiento medido, no todas el primer día.
CAP-1008. Caso hipotético: un SaaS en lanzamiento con diez clientes activa aislamiento y autorización desde el inicio.
CAP-1009. Difiere escalado automático y observabilidad avanzada hasta que la medición muestre necesidad.
CAP-1010. Quiero que lo irreversible, como el aislamiento entre clientes, esté bien desde el inicio, y que lo escalable crezca con evidencia.

## 11. Matriz de referencia: escritorio, móvil, offline y tiempo real

CAP-1101. Aplicación de escritorio: actualizaciones firmadas, almacenamiento local protegido y procedimiento de revocación de versiones.
CAP-1102. Aplicación de escritorio en Windows: rutas con espacios, permisos de usuario estándar y desinstalación limpia.
CAP-1103. Aplicación móvil: compatibilidad con versiones antiguas, almacenamiento seguro y avisos de actualización.
CAP-1104. Aplicación offline: sincronización con versiones, resolución de conflictos y operaciones pendientes durables.
CAP-1105. Aplicación de tiempo real: gestión de conexiones, límites por cliente y degradación ante carga.
CAP-1106. Caso hipotético: una aplicación de inventario para bodegas sin conexión estable activa sincronización offline.
CAP-1107. La matriz incluye pruebas de reconexión tardía, conflictos y dispositivo perdido.
CAP-1108. Quiero que mis aplicaciones funcionen donde viven mis usuarios, con sus limitaciones reales.

## 12. Matriz de referencia: datos, IA, pagos y crítico

CAP-1201. Plataforma de datos: linaje, calidad, gobierno de acceso y retención.
CAP-1202. Sistema de IA: AI Gateway activo, evaluación, guardrails, presupuestos y kill switch.
CAP-1203. Sistema de pagos: todas las capacidades del manual de pagos con conciliación y reversión probadas.
CAP-1204. Sistema crítico: disponibilidad y recuperación reforzadas, revisión independiente y ejercicios frecuentes.
CAP-1205. Sistema del sector público: accesibilidad, transparencia, conservación documental y obligaciones aplicables verificadas.
CAP-1206. Estos perfiles requieren revisión competente de obligaciones antes de declarar controles suficientes.
CAP-1207. Caso hipotético: un asistente de IA interno para resumir documentos activa el gateway en modo LOCAL.
CAP-1208. La matriz activa evaluación, límites de recursos y guardrails de datos, sin proveedores externos ni gasto en nube.
CAP-1209. Quiero activar lo que cada dominio exige con la misma seriedad con que evito activar lo que no necesita.

## 13. Dependencias entre capacidades

CAP-1301. Cada capacidad declara de qué otras capacidades depende para funcionar con seguridad.
CAP-1302. Los pagos dependen de seguridad de APIs, gestión de secretos, almacenamiento con backups, observabilidad y respuesta a incidentes.
CAP-1303. El AI Gateway activo depende de gestión de secretos, presupuestos, observabilidad, guardrails y evaluación.
CAP-1304. La sincronización offline depende de versionado de datos, idempotencia y resolución de conflictos.
CAP-1305. La respuesta automatizada depende de detección confiable, registro y procedimiento de reversión.
CAP-1306. El aislamiento multi-tenant depende de autorización por objeto y pruebas de acceso cruzado.
CAP-1307. Una capacidad no se activa si alguna dependencia obligatoria está en estado inferior a VERIFIED.
CAP-1308. Las dependencias se representan como grafo dirigido y se verifica que no contenga ciclos.
CAP-1309. Un ciclo indica capacidades mal delimitadas y se resuelve redefiniendo fronteras.
CAP-1310. La degradación de una dependencia propaga advertencia a las capacidades que dependen de ella.
CAP-1311. El orden de activación sigue el orden topológico del grafo de dependencias.
CAP-1312. Caso hipotético: un equipo activa cobros antes de tener backups verificados de la base de pedidos.
CAP-1313. El perfilador bloquea la activación porque la dependencia de almacenamiento está en IMPLEMENTED, no en VERIFIED.
CAP-1314. Tras el ensayo de restauración exitoso, la dependencia pasa a VERIFIED y los cobros pueden activarse.
CAP-1315. La aceptación verifica que la matriz registra la secuencia y las fechas de ambas transiciones.
CAP-1316. Las dependencias opcionales mejoran la capacidad pero no bloquean su activación; se registran como recomendación.
CAP-1317. El grafo se documenta en la matriz del proyecto con la versión de esta edición usada.
CAP-1318. Los agentes pueden construir el grafo desde los manuales; el responsable valida las dependencias específicas del proyecto.
CAP-1319. Quiero que ninguna capacidad importante se apoye en otra que todavía no demostró funcionar.

## 14. Criterios de admisión de una capacidad

CAP-1401. Una capacidad se admite para implementación cuando existe necesidad demostrada en el perfil o una obligación verificada.
CAP-1402. La admisión exige que sus dependencias obligatorias estén verificadas o planificadas antes que ella.
CAP-1403. La admisión exige responsable de implementación y responsable de operación identificados.
CAP-1404. La admisión exige estimación de costo de implementación y de operación mensual con fuente.
CAP-1405. La admisión exige criterio de verificación definido antes de implementar.
CAP-1406. La admisión exige plan de degradación y de retiro, aunque sea breve.
CAP-1407. La admisión exige que el receptor del sistema pueda operar la capacidad o tenga plan de formación.
CAP-1408. Una capacidad que no cumple criterios de admisión permanece en ASSESSED o DORMANT con la razón registrada.
CAP-1409. La admisión se registra como decisión con fecha, responsable y evidencia.
CAP-1410. La admisión no autoriza gastos ni contrataciones externas; esas acciones requieren su propia autorización.
CAP-1411. Caso hipotético: se propone activar detección avanzada de bots para un sitio con cien visitas diarias.
CAP-1412. La evaluación no encuentra abuso medido y el costo supera el beneficio; la capacidad queda en ASSESSED.
CAP-1413. Se define una señal de reevaluación: aumento de registros falsos o pruebas de credenciales detectadas.
CAP-1414. La aceptación verifica que la decisión y la señal de reevaluación están en la matriz.
CAP-1415. Quiero admitir capacidades por necesidad comprobada, no por miedo ni por moda.

## 15. Costo de las capacidades

CAP-1501. El costo de una capacidad incluye implementación, infraestructura, licencias, operación, monitoreo, formación y retiro.
CAP-1502. Las tarifas de proveedores se verifican en fuente primaria con fecha antes de usarlas en la decisión.
CAP-1503. El costo de operación incluye el tiempo humano para responder alertas, revisar registros y ejecutar ensayos.
CAP-1504. El costo de no activar una capacidad se estima como riesgo: probabilidad cualitativa y consecuencia.
CAP-1505. La comparación entre costo y riesgo se registra en la decisión de admisión.
CAP-1506. Los costos estimados se etiquetan como estimación hasta reconciliarse con facturación real.
CAP-1507. Las capacidades con costo variable, como IA o almacenamiento, declaran límites y alertas desde su activación.
CAP-1508. El presupuesto total de capacidades se revisa con el responsable periódicamente.
CAP-1509. Caso hipotético: activar replicación geográfica duplicaría el costo de infraestructura de una herramienta interna.
CAP-1510. El riesgo de pérdida de la región es bajo frente al impacto tolerable de un día de recuperación desde backup.
CAP-1511. La decisión registra backups en otra región sin replicación activa, con costo mucho menor.
CAP-1512. Quiero pagar por controles que reducen riesgos reales en proporción a su valor.

## 16. Activación por etapas

CAP-1601. Las capacidades complejas se activan por etapas con verificación entre cada una.
CAP-1602. La primera etapa activa la capacidad en entorno de prueba con datos sintéticos.
CAP-1603. La segunda etapa activa en producción para un subconjunto controlado de usuarios o tráfico.
CAP-1604. La tercera etapa amplía la activación tras verificar métricas y ausencia de eventos prohibidos.
CAP-1605. Cada etapa tiene criterio de avance y criterio de retroceso definidos antes de iniciarla.
CAP-1606. Las banderas de capacidad permiten activar y desactivar sin despliegue cuando el diseño lo permite.
CAP-1607. Las banderas tienen propietario, propósito, estado por entorno y fecha de revisión.
CAP-1608. Caso hipotético: el AI Gateway pasa de OFF a LOCAL para un caso de uso interno antes de considerar proveedores en la nube.
CAP-1609. La evaluación en LOCAL confirma calidad suficiente y el caso de uso permanece en LOCAL sin gasto externo.
CAP-1610. La aceptación registra cada etapa con su evidencia y la decisión de no avanzar a CLOUD_API.
CAP-1611. Quiero activar por pasos que pueda verificar y revertir.

## 17. Verificación por familia de capacidad

CAP-1701. Línea base de seguridad: escaneo de dependencias, prueba de encabezados, revisión de secretos y validación de entradas.
CAP-1702. Documentación: un receptor sigue instalación y verificación desde un entorno limpio.
CAP-1703. Observabilidad básica: alerta de prueba que llega al receptor definido dentro del plazo.
CAP-1704. Almacenamiento gobernado: ensayo de restauración que cumple el objetivo de tiempo.
CAP-1705. Pagos: pruebas de idempotencia, webhooks duplicados, resultados inciertos y conciliación.
CAP-1706. AI Port en OFF: arranque sin credenciales ni modelos y rechazo claro de solicitudes de IA.
CAP-1707. AI Gateway activo: evaluación, guardrails adversariales, presupuesto y kill switch probados.
CAP-1708. Actualización y fiabilidad: release reproducible y reversión ensayada.
CAP-1709. Respuesta a incidentes: ejercicio de mesa o técnico con registro y mejoras.
CAP-1710. Aislamiento multi-tenant: matriz de pruebas de acceso cruzado aprobada.
CAP-1711. Sincronización offline: pruebas de conflicto, reconexión tardía y dispositivo perdido.
CAP-1712. Orquestación de agentes: tareas representativas con límites respetados y reportes verídicos.
CAP-1713. Cada verificación registra método, entorno, versión, fecha, resultado y límites.
CAP-1714. Una verificación antigua pierde validez cuando cambia la implementación o el entorno.
CAP-1715. Quiero verificaciones específicas para cada capacidad, no una declaración general de que todo funciona.

## 18. Evidencia y su vigencia

CAP-1801. La evidencia de una capacidad vive en la estructura documental del proyecto con referencia desde la matriz.
CAP-1802. Cada evidencia tiene fecha y una vigencia definida por la familia de capacidad.
CAP-1803. Los ensayos de restauración, ejercicios de incidentes y evaluaciones de IA tienen vigencia periódica.
CAP-1804. Las pruebas automatizadas mantienen vigencia mientras se ejecutan en cada cambio relevante.
CAP-1805. La evidencia vencida baja el estado de OPERATING a DEGRADED hasta renovarse.
CAP-1806. La evidencia no contiene secretos ni datos personales innecesarios.
CAP-1807. La evidencia generada por agentes se revisa antes de aceptarse.
CAP-1808. Caso hipotético: la evaluación de un caso de uso de IA tiene un año y el proveedor cambió el modelo por defecto.
CAP-1809. La evidencia se considera vencida por cambio de versión y la capacidad pasa a DEGRADED hasta reevaluar.
CAP-1810. La reevaluación confirma calidad y la capacidad vuelve a OPERATING con nueva fecha.
CAP-1811. Quiero que la evidencia envejezca de forma visible y que su renovación sea parte del trabajo normal.

## 19. Disparadores de degradación

CAP-1901. Pérdida de monitoreo o de su receptor efectivo.
CAP-1902. Falla del último ensayo de recuperación o vencimiento de su vigencia.
CAP-1903. Ausencia de responsable operativo por cambio de personal.
CAP-1904. Vencimiento de evidencia de verificación.
CAP-1905. Dependencia obligatoria degradada.
CAP-1906. Cambio de versión de un componente crítico sin nueva verificación.
CAP-1907. Excepción vigente que desactiva parte del control.
CAP-1908. Presupuesto agotado para una capacidad con costo variable.
CAP-1909. Cada disparador se monitorea cuando es medible y se revisa periódicamente cuando no lo es.
CAP-1910. La degradación se comunica al responsable con la causa y la acción para restaurar.
CAP-1911. Una capacidad degradada puede seguir funcionando, pero no se declara OPERATING ante clientes ni auditorías.
CAP-1912. Caso hipotético: el responsable de pagos deja el equipo y nadie asume la conciliación diaria.
CAP-1913. La capacidad de pagos pasa a DEGRADED y se asigna un nuevo responsable con traspaso documentado.
CAP-1914. Quiero saber cuándo algo que funcionaba dejó de tener lo necesario para seguir funcionando con seguridad.

## 20. Retiro de capacidades

CAP-2001. El retiro se planifica con inventario de datos, credenciales, integraciones, monitoreo y costos asociados.
CAP-2002. Los datos se conservan o eliminan según retención, con evidencia de la decisión y su ejecución.
CAP-2003. Las credenciales se revocan y se retiran del inventario de secretos.
CAP-2004. Las integraciones se desactivan con aviso a terceros cuando corresponde.
CAP-2005. El monitoreo y las alertas se eliminan para no generar ruido.
CAP-2006. Las capacidades dependientes se evalúan antes de retirar una de la que dependen.
CAP-2007. El retiro se registra en la matriz y en el changelog con fecha y evidencia.
CAP-2008. Caso hipotético: un producto deja de vender suscripciones y mantiene solo pagos únicos.
CAP-2009. La lógica de recurrencia se retira tras cerrar el último ciclo, conservando historia para auditoría y disputas.
CAP-2010. Quiero retirar lo que ya no uso con el mismo cuidado con que lo activé.

## 21. Revisión periódica del perfil y la matriz

CAP-2101. El perfil y la matriz se revisan en cada release mayor y al menos con la periodicidad definida por la criticidad.
CAP-2102. La revisión compara el perfil registrado con el comportamiento actual del sistema.
CAP-2103. La revisión identifica capacidades con evidencia vencida, dependencias degradadas y costos desviados.
CAP-2104. La revisión propone activaciones, degradaciones y retiros con evidencia.
CAP-2105. La revisión se registra con fecha, participantes, decisiones y próxima revisión.
CAP-2106. Un agente puede preparar la revisión con lectura del repositorio y de la matriz.
CAP-2107. Las decisiones resultantes las aprueba el responsable.
CAP-2108. Caso hipotético: la revisión anual detecta que un módulo de reportes exporta datos personales sin retención definida.
CAP-2109. Se añade la capacidad de gobierno de exportaciones como REQUIRED y se planifica su implementación.
CAP-2110. Quiero revisar mi sistema con la regularidad necesaria para que el perfil no envejezca en silencio.

## 22. Eventos que disparan reperfilado

CAP-2201. Llegada de usuarios externos a un sistema interno.
CAP-2202. Inicio de cobros o custodia de fondos.
CAP-2203. Tratamiento de nuevas categorías de datos personales o sensibles.
CAP-2204. Expansión a nuevas jurisdicciones.
CAP-2205. Crecimiento de volumen que cambia el orden de magnitud de usuarios o datos.
CAP-2206. Incorporación de IA con datos de usuarios.
CAP-2207. Integración con un sistema crítico de terceros.
CAP-2208. Cambio del equipo receptor o de su capacidad operativa.
CAP-2209. Incidente que revela un riesgo no contemplado en el perfil.
CAP-2210. Nuevo compromiso contractual con clientes sobre disponibilidad, seguridad o ubicación de datos.
CAP-2211. Cada evento genera revisión del perfil antes o junto con el cambio que lo provoca.
CAP-2212. El orquestador detecta estos eventos al admitir tareas y propone el reperfilado.
CAP-2213. Quiero que los cambios importantes del producto actualicen lo que protejo antes de que alguien lo descubra por un incidente.

## 23. Capacidades por entorno

CAP-2301. La matriz distingue estado por entorno: desarrollo, prueba, preproducción y producción.
CAP-2302. Una capacidad verificada en prueba no se declara OPERATING en producción sin verificación propia.
CAP-2303. Los entornos de desarrollo pueden activar capacidades en modo simulado, por ejemplo pagos en modo de prueba.
CAP-2304. Los entornos de prueba no comparten credenciales ni datos productivos.
CAP-2305. Las diferencias de capacidades entre entornos se documentan para explicar comportamientos distintos.
CAP-2306. Caso hipotético: el kill switch de IA funciona en prueba pero en producción depende de una configuración ausente.
CAP-2307. La verificación en producción detecta la ausencia y la capacidad permanece en VERIFIED solo para prueba.
CAP-2308. Quiero saber qué funciona en cada lugar, no suponer que lo que funciona en prueba funciona en producción.

## 24. Capacidades por tenant

CAP-2401. En productos multi-tenant, algunas capacidades pueden activarse por tenant según su plan o contrato.
CAP-2402. La matriz registra capacidades globales y capacidades por tenant con su estado.
CAP-2403. Las capacidades de seguridad base son globales y no dependen del plan contratado.
CAP-2404. Las capacidades opcionales por tenant se activan con verificación de aislamiento.
CAP-2405. Los compromisos contractuales por tenant se reflejan en la matriz y en la configuración verificada.
CAP-2406. Caso hipotético: un tenant empresarial contrata residencia de datos en una región específica.
CAP-2407. La matriz registra la capacidad para ese tenant con verificación de ubicación de datos y backups.
CAP-2408. Quiero que cada cliente reciba lo que contrató, verificado, y que la seguridad básica sea igual para todos.

## 25. Modos del AI Integration Port

CAP-2501. Los modos permitidos son OFF, LOCAL, LOCAL_REMOTE, CLOUD_API, PRIVATE_CLOUD, HYBRID y AUTO.
CAP-2502. OFF es el estado inicial de todo proyecto sin caso de IA autorizado.
CAP-2503. LOCAL requiere evaluación de recursos, licencia del modelo y aislamiento.
CAP-2504. LOCAL_REMOTE requiere identidad del servidor, red y permisos verificados.
CAP-2505. CLOUD_API requiere proveedor aprobado, datos permitidos y presupuesto reservado.
CAP-2506. PRIVATE_CLOUD requiere contrato y configuración de aislamiento verificados.
CAP-2507. HYBRID requiere reglas explícitas de enrutamiento por caso de uso y datos.
CAP-2508. AUTO selecciona entre modos aprobados y nunca habilita un destino no autorizado.
CAP-2509. Cada caso de uso de IA declara su modo en la matriz con evidencia.
CAP-2510. El [AI Gateway](AI-GATEWAY.md) desarrolla los contratos de cada modo.
CAP-2511. Caso hipotético: un proyecto quiere usar IA para clasificar tickets con datos de clientes.
CAP-2512. La evaluación de privacidad descarta CLOUD_API sin contrato adecuado y aprueba LOCAL con modelo evaluado.
CAP-2513. Quiero que la IA se active donde aporta valor, con el modo que respeta los datos y el presupuesto.

## 26. Admisión de recursos para IA local

CAP-2601. La admisión de un modelo local mide memoria, CPU, GPU, disco y latencia con la carga representativa.
CAP-2602. La memoria nominal del equipo no garantiza capacidad; se mide con el modelo cargado y concurrencia esperada.
CAP-2603. La admisión reserva recursos para el resto del sistema y el sistema operativo.
CAP-2604. La licencia del modelo se revisa para el uso previsto.
CAP-2605. La admisión registra modelo, versión o hash, cuantización, parámetros y resultados medidos.
CAP-2606. Un modelo que no cumple latencia o memoria se rechaza o se sustituye por uno más pequeño evaluado.
CAP-2607. Caso hipotético: un modelo de lenguaje local consume toda la memoria y el servidor web deja de responder.
CAP-2608. La admisión con reserva de memoria habría rechazado el modelo; la corrección limita recursos del proceso de IA.
CAP-2609. Quiero modelos locales que convivan con mi sistema, no que lo desplacen.

## 27. Capacidades y jurisdicción

CAP-2701. Las obligaciones aplicables por jurisdicción pueden convertir capacidades opcionales en requeridas.
CAP-2702. Cada obligación se registra con fuente oficial, fecha de consulta, alcance y revisión competente pendiente.
CAP-2703. El perfil Perú requiere análisis específico de protección de datos y consumidor según el flujo real.
CAP-2704. La expansión a otra jurisdicción activa revisión de la matriz antes del lanzamiento.
CAP-2705. Una obligación no verificada se marca como pendiente de revisión, no como cumplida.
CAP-2706. El [manual de cumplimiento](COMPLIANCE-IP-PRODUCT.md) desarrolla la matriz de aplicabilidad.
CAP-2707. Caso hipotético: un producto empieza a tratar datos de salud de usuarios.
CAP-2708. La revisión competente determina obligaciones adicionales y la matriz eleva controles de acceso, cifrado y auditoría a REQUIRED.
CAP-2709. Quiero que las obligaciones reales guíen mis controles, verificadas por quien corresponde.

## 28. Promesas comerciales y estado real

CAP-2801. Las promesas al cliente sobre seguridad, disponibilidad, privacidad o IA corresponden a capacidades en estado OPERATING.
CAP-2802. Una capacidad en PLANNED o IMPLEMENTED no se anuncia como disponible.
CAP-2803. Los textos comerciales se revisan contra la matriz antes de publicarse.
CAP-2804. Una degradación que afecta una promesa se comunica según el contrato.
CAP-2805. Caso hipotético: la página de ventas promete cifrado de extremo a extremo que el producto no implementa.
CAP-2806. La revisión contra la matriz detecta la discrepancia y el texto se corrige antes de nuevas ventas.
CAP-2807. Quiero vender exactamente lo que mi sistema hace.

## 29. Comunicación de capacidades al receptor

CAP-2901. El receptor del sistema recibe la matriz con estado, responsable, evidencia y costo de cada capacidad.
CAP-2902. El receptor entiende qué capacidades están DORMANT y cómo activarlas si las necesita.
CAP-2903. El receptor conoce los disparadores de degradación y sus procedimientos de restauración.
CAP-2904. Las capacidades que el receptor no puede operar se declaran como riesgo con plan.
CAP-2905. Quiero que quien reciba mi sistema sepa exactamente qué protege y qué no.

## 30. Deuda de capacidades

CAP-3001. La deuda de capacidades es la diferencia entre capacidades REQUIRED y su estado real.
CAP-3002. Cada deuda se registra con riesgo, plan, responsable y plazo.
CAP-3003. La deuda se prioriza por riesgo y por dependencias que bloquea.
CAP-3004. La deuda aceptada conscientemente se registra como excepción con vencimiento.
CAP-3005. La deuda se revisa en cada revisión periódica del perfil.
CAP-3006. Caso hipotético: un SaaS opera meses sin pruebas de acceso cruzado por presión de lanzamiento.
CAP-3007. La deuda registrada como alta prioridad se paga antes de incorporar clientes empresariales.
CAP-3008. Quiero ver mi deuda de controles con la misma claridad que mi deuda técnica.

## 31. Conflictos entre capacidades

CAP-3101. Algunas capacidades compiten: retención para auditoría frente a minimización de datos, o registros detallados frente a privacidad.
CAP-3102. El conflicto se resuelve con decisión registrada que explica el equilibrio elegido.
CAP-3103. Las obligaciones verificadas prevalecen sobre preferencias técnicas.
CAP-3104. La solución busca satisfacer ambas capacidades parcialmente cuando es posible, por ejemplo con seudonimización.
CAP-3105. Caso hipotético: la detección de abuso quiere conservar direcciones IP completas y la política de privacidad pide minimizarlas.
CAP-3106. La decisión conserva IP completa durante un período de investigación breve y luego la trunca, con registro.
CAP-3107. Quiero resolver tensiones entre controles con decisiones explícitas, no con el control que gane por omisión.

## 32. Priorización de capacidades pendientes

CAP-3201. Las capacidades pendientes se priorizan primero por obligaciones verificadas con plazo.
CAP-3202. Después por riesgo de daño irreversible a usuarios, datos o dinero.
CAP-3203. Después por número de capacidades que desbloquean en el grafo de dependencias.
CAP-3204. Después por costo y esfuerzo relativos.
CAP-3205. Las capacidades difíciles de añadir después, como aislamiento de tenants o modelo de datos, se priorizan temprano.
CAP-3206. Las capacidades fáciles de añadir con crecimiento, como escalado, pueden diferirse con señal de activación.
CAP-3207. La priorización se registra con la razón de cada posición para que el responsable pueda discutirla.
CAP-3208. Caso hipotético: un equipo prioriza un panel de métricas atractivo antes que backups verificados.
CAP-3209. La priorización por riesgo irreversible reordena: backups primero, panel después.
CAP-3210. Quiero proteger primero lo que no se puede recuperar.

## 33. Capacidades y agentes responsables

CAP-3301. Cada familia de capacidad tiene agentes de referencia en el sistema de orquestación.
CAP-3302. Seguridad: eos-security-reviewer para revisión y eos-implementer para controles asignados.
CAP-3303. Documentación: eos-docs-writer con validación del orquestador.
CAP-3304. Almacenamiento y datos: eos-architect para diseño y eos-qa-verifier para ensayos de restauración.
CAP-3305. Pagos: eos-architect, eos-security-reviewer y eos-qa-verifier con aprobación humana de toda operación real.
CAP-3306. IA: eos-architect con el manual AI-GATEWAY y eos-security-reviewer para inyección y suministro.
CAP-3307. Releases: eos-release-manager.
CAP-3308. Incidentes: eos-incident-commander.
CAP-3309. Cumplimiento: eos-compliance-analyst.
CAP-3310. Migración: eos-migration-archaeologist y eos-architect.
CAP-3311. Perfilado y matriz: eos-planner con revisión del orquestador y aprobación del responsable.
CAP-3312. Las definiciones de agentes están en [agents/](../../agents/README.md).
CAP-3313. Un agente no cambia el estado de una capacidad en la matriz sin evidencia y sin registro de la decisión humana cuando aplica.
CAP-3314. Quiero que cada capacidad tenga quién la diseñe, quién la verifique y quién la decida.

## 34. Aplicación a esta biblioteca

CAP-3401. Esta biblioteca es un repositorio documental con validador e instalador; su perfil es herramienta documental sin usuarios finales ni datos personales.
CAP-3402. Activa línea base de seguridad: sin secretos, acciones de CI fijadas por commit, permisos de lectura y revisión antes de publicar.
CAP-3403. Activa documentación completa con firma editorial y validación automática de estructura.
CAP-3404. Activa pruebas del validador y del instalador con cobertura mínima de 80 por ciento.
CAP-3405. Mantiene el AI Integration Port como concepto documentado; no ejecuta IA.
CAP-3406. No activa pagos, almacenamiento gobernado, respuesta automatizada ni sincronización porque no aplican.
CAP-3407. Su recuperación consiste en clonar el repositorio desde el remoto; los hashes protegen la integridad de las fuentes.
CAP-3408. El [perfil de la biblioteca](../PROJECT-PROFILE.md) registra esta decisión con su evidencia.
CAP-3409. Quiero que mis propias reglas se apliquen primero a mi propia biblioteca.

## 35. Algoritmo de perfilado

CAP-3501. Paso 1: leer instrucciones del host, AGENTS.md y la constitución, y confirmar el alcance autorizado.
CAP-3502. Paso 2: inspeccionar el repositorio y la documentación existentes para obtener entradas del perfil.
CAP-3503. Paso 3: registrar entradas faltantes y formular preguntas solo cuando cambian materialmente la matriz.
CAP-3504. Paso 4: asignar uno o varios perfiles de referencia con justificación.
CAP-3505. Paso 5: partir de la matriz de referencia de cada perfil y combinarlas.
CAP-3506. Paso 6: ajustar aplicabilidad de cada capacidad con evidencia del proyecto y obligaciones verificadas.
CAP-3507. Paso 7: construir el grafo de dependencias y verificar ausencia de ciclos.
CAP-3508. Paso 8: registrar el estado actual de cada capacidad con su evidencia.
CAP-3509. Paso 9: identificar deuda de capacidades y priorizarla.
CAP-3510. Paso 10: proponer plan de activación por etapas respetando el orden topológico.
CAP-3511. Paso 11: presentar la matriz y el plan al responsable para aprobación.
CAP-3512. Paso 12: registrar la decisión y programar la próxima revisión.
CAP-3513. El algoritmo se aplica en modo A0 o A1 porque no modifica el sistema; la implementación posterior sigue su propia autorización.
CAP-3514. En modo AUDIT, el algoritmo termina en el paso 9 con hallazgos y sin plan de cambios salvo solicitud.
CAP-3515. Quiero un procedimiento repetible que cualquier agente o persona pueda seguir con el mismo resultado.

## 36. Registro de decisiones de capacidad

CAP-3601. Cada decisión registra capacidad, decisión, estado resultante, evidencia, alternativas, responsable y fecha.
CAP-3602. Las decisiones de no activar incluyen señal de reevaluación.
CAP-3603. Las decisiones se enlazan desde la matriz para trazabilidad.
CAP-3604. Las decisiones importantes se registran como ADR cuando afectan arquitectura.
CAP-3605. Las decisiones revertidas conservan el registro original y la nueva decisión con su causa.
CAP-3606. Quiero poder responder por qué cada capacidad está como está.

## 37. Excepciones de capacidad

CAP-3701. Una excepción permite operar temporalmente sin una capacidad REQUIRED con riesgo aceptado.
CAP-3702. La excepción registra motivo, compensación, vencimiento, responsable y evidencia para retirarla.
CAP-3703. Una excepción no puede autorizar prácticas prohibidas, como exponer secretos o falsificar evidencia.
CAP-3704. Las excepciones vencidas sin renovación justificada se tratan como deuda crítica.
CAP-3705. La plantilla [EXCEPTION](../../templates/EXCEPTION.md) estructura el registro.
CAP-3706. Caso hipotético: un lanzamiento opera sin ensayo de restauración por falta de entorno aislado.
CAP-3707. La excepción compensa con backups adicionales en otro destino y vence en treinta días con ensayo programado.
CAP-3708. Quiero excepciones honestas y temporales, no permanentes disfrazadas.

## 38. Auditoría de la matriz

CAP-3801. Una auditoría de la matriz verifica que cada estado declarado tiene evidencia vigente.
CAP-3802. Verifica que las capacidades REQUIRED tienen plan o excepción vigente.
CAP-3803. Verifica que las decisiones NOT_APPLICABLE tienen justificación coherente con el perfil actual.
CAP-3804. Verifica que las promesas comerciales coinciden con capacidades OPERATING.
CAP-3805. Verifica que las dependencias están en estado suficiente para las capacidades activas.
CAP-3806. La auditoría se ejecuta en solo lectura y entrega hallazgos con severidad.
CAP-3807. La skill [eos-audit](../../skills/eos-audit/SKILL.md) incluye la auditoría de matriz como paso cuando aplica.
CAP-3808. Quiero auditar mis capacidades con la misma rigurosidad que mi código.

## 39. Métricas del perfilado

CAP-3901. Porcentaje de capacidades REQUIRED en OPERATING.
CAP-3902. Número de capacidades con evidencia vencida.
CAP-3903. Deuda de capacidades por prioridad y antigüedad.
CAP-3904. Excepciones vigentes y vencidas.
CAP-3905. Tiempo desde un evento de reperfilado hasta la actualización de la matriz.
CAP-3906. Las métricas se calculan desde la matriz registrada, sin estimaciones.
CAP-3907. Quiero medir la salud de mis controles con números que pueda reproducir.

## 40. Integración con las skills de modo

CAP-4001. INIT perfila el proyecto nuevo antes de elegir arquitectura y activa capacidades base desde el inicio.
CAP-4002. ADOPT perfila el sistema existente desde evidencia observada, distinguiendo capacidades reales de las documentadas.
CAP-4003. AUDIT evalúa la matriz y entrega hallazgos sin modificar el sistema.
CAP-4004. MIGRATE verifica que el destino tenga las capacidades activas del origen antes del corte.
CAP-4005. RELEASE verifica que las capacidades afectadas por la versión conservan su estado y evidencia.
CAP-4006. INCIDENT degrada capacidades afectadas y registra su restauración.
CAP-4007. Las skills están en [skills/](../../skills/README.md) y referencian este manual.
CAP-4008. Quiero que el perfilado esté presente en cada tipo de trabajo, no solo al comenzar un proyecto.

## 41. Caso trabajado A: tienda en línea pequeña

CAP-4101. Estado inicial hipotético: una tienda de artesanías quiere vender en línea a clientes en Perú con pagos con tarjeta.
CAP-4102. Las entradas muestran cientos de clientes mensuales, catálogo pequeño, un responsable con conocimientos técnicos básicos y presupuesto limitado.
CAP-4103. Los perfiles asignados son comercio electrónico y sistema de pagos en escala pequeña.
CAP-4104. La matriz combina línea base de seguridad, documentación, observabilidad básica y puerto de IA en OFF.
CAP-4105. Añade pagos mediante un proveedor que gestiona datos de tarjeta, sin almacenar instrumentos en el sistema propio.
CAP-4106. Añade almacenamiento gobernado básico: backups diarios verificados de pedidos y clientes.
CAP-4107. Añade tratamiento de datos personales con retención y política de privacidad coherente.
CAP-4108. Añade protección contra abuso en registro y pago con limitación básica.
CAP-4109. No activa multi-tenant, escalado automático ni observabilidad avanzada.
CAP-4110. El grafo exige backups verificados y gestión de secretos antes de activar cobros reales.
CAP-4111. El plan activa primero el modo de prueba del proveedor, luego cobros reales para pedidos internos y después para todos.
CAP-4112. La verificación de pagos incluye webhooks duplicados y resultado incierto simulado.
CAP-4113. El receptor, que es el propio dueño, recibe un runbook breve de conciliación semanal.
CAP-4114. La aceptación registra estados OPERATING con evidencia y el costo mensual estimado con fuente.
CAP-4115. El caso es ilustrativo y no describe una tienda real.

## 42. Caso trabajado B: herramienta interna que se vuelve producto

CAP-4201. Estado inicial hipotético: una herramienta interna de seguimiento de proyectos usada por diez empleados.
CAP-4202. La dirección decide ofrecerla a clientes externos como servicio con suscripción.
CAP-4203. El evento dispara reperfilado: usuarios externos, cobros recurrentes y datos de varios clientes.
CAP-4204. El nuevo perfil combina SaaS y pagos con suscripciones.
CAP-4205. La matriz eleva aislamiento multi-tenant, autorización por objeto y cuotas a REQUIRED.
CAP-4206. La revisión encuentra que la herramienta asume un solo cliente en el modelo de datos.
CAP-4207. La deuda de aislamiento se prioriza antes de cualquier venta por ser difícil de añadir después.
CAP-4208. La migración del modelo de datos sigue el manual de migración con caracterización previa.
CAP-4209. Los pagos recurrentes se activan solo tras verificar aislamiento y backups.
CAP-4210. Las promesas comerciales se revisan contra la matriz antes de publicar la página de ventas.
CAP-4211. La aceptación verifica pruebas de acceso cruzado aprobadas y conciliación de ciclos de prueba.
CAP-4212. El caso es ilustrativo.

## 43. Caso trabajado C: asistente de IA para un estudio contable

CAP-4301. Estado inicial hipotético: un estudio contable quiere un asistente que resuma documentos tributarios de clientes.
CAP-4302. Las entradas muestran datos financieros y personales sensibles, pocos usuarios internos y equipo con una GPU modesta.
CAP-4303. El perfil combina herramienta interna con datos sensibles y sistema de IA.
CAP-4304. La evaluación de privacidad descarta enviar documentos a proveedores en la nube sin contrato adecuado.
CAP-4305. La admisión de recursos mide un modelo local pequeño con latencia aceptable para resúmenes.
CAP-4306. El modo aprobado es LOCAL con evaluación de calidad sobre documentos sintéticos representativos.
CAP-4307. Los guardrails impiden que el asistente afirme cifras sin citar el documento fuente.
CAP-4308. Los montos extraídos se recalculan con código determinista antes de usarse.
CAP-4309. El kill switch permite volver a OFF sin afectar el resto del sistema.
CAP-4310. La matriz registra que CLOUD_API queda en ASSESSED con señal de reevaluación si se firma un contrato adecuado.
CAP-4311. La aceptación verifica evaluación aprobada, guardrails probados y retorno a OFF ensayado.
CAP-4312. El caso es ilustrativo.

## 44. Caso trabajado D: adopción de un sistema heredado

CAP-4401. Estado inicial hipotético: un sistema de gestión escolar heredado sin documentación ni pruebas.
CAP-4402. El modo ADOPT perfila desde evidencia observada: usuarios, datos de menores, reportes y una integración con el ministerio.
CAP-4403. La matriz registra capacidades reales: autenticación básica, backups manuales no verificados y sin registros de seguridad.
CAP-4404. La revisión competente señala obligaciones reforzadas por tratar datos de menores.
CAP-4405. La deuda prioriza backups verificados, control de acceso por rol y registro de accesos a datos de estudiantes.
CAP-4406. La caracterización de flujos críticos precede a cualquier cambio de código.
CAP-4407. Las capacidades se activan por etapas sin interrumpir el año escolar.
CAP-4408. La aceptación de la primera etapa verifica restauración de la base y matriz de acceso por rol.
CAP-4409. El caso es ilustrativo.

## 45. Caso trabajado E: sitio estático que no necesita casi nada

CAP-4501. Estado inicial hipotético: un portafolio personal con páginas estáticas alojado en un servicio de sitios estáticos.
CAP-4502. El perfil es sitio estático sin datos de usuarios ni formularios.
CAP-4503. La matriz activa encabezados de seguridad, autenticación fuerte en la cuenta de alojamiento y del dominio, y documentación de redespliegue.
CAP-4504. El puerto de IA queda en OFF como contrato documentado sin código adicional.
CAP-4505. Todas las demás familias quedan NOT_APPLICABLE con justificación breve.
CAP-4506. La revisión periódica se fija anual o ante la incorporación de cualquier formulario.
CAP-4507. La aceptación verifica encabezados en el sitio publicado y redespliegue desde el repositorio en un entorno limpio.
CAP-4508. Quiero que lo simple siga siendo simple, con un mínimo responsable y nada más.

## 46. Antipatrones de perfilado

CAP-4601. Activar todas las capacidades por si acaso, cargando al receptor con complejidad que no puede operar.
CAP-4602. Declarar NOT_APPLICABLE sin justificación para evitar trabajo.
CAP-4603. Declarar OPERATING con evidencia vencida o inexistente.
CAP-4604. Activar capacidades antes que sus dependencias obligatorias.
CAP-4605. No reperfilar tras cambios de usuarios, datos o modelo comercial.
CAP-4606. Prometer a clientes capacidades en estado PLANNED.
CAP-4607. Copiar la matriz de otro proyecto sin ajustar al perfil propio.
CAP-4608. Mantener capacidades degradadas como si siguieran operativas.
CAP-4609. Cada antipatrón tiene cláusulas preventivas en este manual y se revisa en la auditoría de matriz.
CAP-4610. Quiero detectar estos errores en revisión, no en incidentes.

## 47. Lista de verificación del perfilado

CAP-4701. Entradas del perfil con evidencia o pendientes asignados.
CAP-4702. Perfiles asignados con justificación.
CAP-4703. Matriz con estado canónico y ejes para cada capacidad relevante.
CAP-4704. Grafo de dependencias sin ciclos.
CAP-4705. Evidencia vigente para estados VERIFIED y OPERATING.
CAP-4706. Deuda priorizada con responsables y plazos.
CAP-4707. Excepciones vigentes con vencimiento.
CAP-4708. Plan de activación por etapas aprobado.
CAP-4709. Promesas comerciales revisadas contra la matriz.
CAP-4710. Próxima revisión programada.
CAP-4711. La lista se adapta al tamaño del proyecto.

## 48. Glosario

CAP-4801. Capacidad: conjunto de controles y funciones de EOS que cumple un propósito, como pagos o backups.
CAP-4802. Perfil: clasificación del sistema según usuarios, datos, dinero, integraciones y criticidad.
CAP-4803. Matriz de capacidades: registro de estado, aplicabilidad, implementación y evidencia de cada capacidad.
CAP-4804. Dependencia obligatoria: capacidad que debe estar verificada antes de activar otra.
CAP-4805. Deuda de capacidades: diferencia entre capacidades requeridas y su estado real.
CAP-4806. Reperfilado: revisión del perfil disparada por un cambio relevante del sistema.
CAP-4807. Admisión: decisión de implementar una capacidad tras cumplir sus criterios.
CAP-4808. Degradación: pérdida de un requisito de una capacidad operativa.

## 49. Límites de esta edición

CAP-4901. Este manual no implementa un perfilador automático; describe el procedimiento y sus criterios.
CAP-4902. Las matrices de referencia son puntos de partida y requieren ajuste por proyecto.
CAP-4903. Las obligaciones jurisdiccionales requieren verificación vigente y revisión competente.
CAP-4904. Los casos son ilustrativos y no describen proyectos reales.
CAP-4905. Los límites se revisan en cada edición.

## 50. Cierre

CAP-5001. El perfilado decide qué protege cada producto y demuestra que esa protección funciona.
CAP-5002. Una capacidad presente en el estándar no está activa en todos los proyectos.
CAP-5003. Pierre R. Boss (oprbguitar) dirige este estándar y decide sobre su evolución.
CAP-5004. Quiero sistemas con la complejidad justa, controles verificados y estados que digan la verdad.

## Anexo A. Ficha de decisión por familia de capacidad

### A1. Línea base de seguridad

CAP-A101. Requerida en todo proyecto, dimensionada a su exposición pública y a los datos que trata.
CAP-A102. Incluye gestión de secretos, dependencias auditadas, validación de entradas, encabezados y registros mínimos de seguridad.
CAP-A103. Evidencia mínima: escaneo de dependencias del manifiesto real, revisión de secretos del repositorio y prueba de encabezados desplegados.
CAP-A104. Degradación típica: dependencia con vulnerabilidad crítica sin decisión o secreto expuesto sin rotar.
CAP-A105. Manual de referencia: [Security Fabric](SECURITY-FABRIC.md).

### A2. Seguridad avanzada

CAP-A201. Requerida cuando hay usuarios externos autenticados, varios tenants, dinero o datos sensibles.
CAP-A202. Opcional en herramientas internas pequeñas sin datos sensibles.
CAP-A203. Incluye autorización por objeto, detección de abuso, respuesta proporcional y endurecimiento de hosts.
CAP-A204. Evidencia mínima: matriz de autorización probada y alerta de abuso ejercitada.
CAP-A205. Degradación típica: endpoint nuevo sin caso de autorización o alerta sin receptor efectivo.

### A3. Documentación

CAP-A301. Requerida en todo proyecto con el alcance que el receptor necesita para operarlo.
CAP-A302. Incluye propósito, instalación, verificación, decisiones, operación y transferencia según tamaño.
CAP-A303. Evidencia mínima: un receptor sigue la instalación desde un entorno limpio con éxito.
CAP-A304. Degradación típica: comando documentado que ya no funciona tras un cambio.
CAP-A305. Manual de referencia: [Ingeniería y calidad](ENGINEERING-QUALITY.md).

### A4. Observabilidad

CAP-A401. Básica requerida cuando el sistema tiene usuarios que dependen de él.
CAP-A402. Avanzada opcional hasta que el volumen o la criticidad lo justifiquen con evidencia.
CAP-A403. Evidencia mínima: alerta de prueba entregada al receptor dentro del plazo definido.
CAP-A404. Degradación típica: receptor de alertas que dejó el equipo o canal sin atención.
CAP-A405. Manual de referencia: [Actualización y fiabilidad](UPDATES-RELIABILITY.md).

### A5. Almacenamiento gobernado

CAP-A501. Requerido cuando el sistema conserva datos que no pueden regenerarse desde el repositorio.
CAP-A502. No aplicable a sitios estáticos sin datos propios.
CAP-A503. Incluye inventario, forecast, cuotas, backups y restauración ensayada.
CAP-A504. Evidencia mínima: ensayo de restauración reciente que cumple el objetivo de tiempo acordado.
CAP-A505. Degradación típica: backups que fallan sin alerta o ensayo vencido.
CAP-A506. Manual de referencia: [Almacenamiento y datos](STORAGE-DATA.md).

### A6. Pagos

CAP-A601. Requerida solo cuando el producto cobra dinero mediante integración técnica.
CAP-A602. No aplicable cuando el producto solo muestra información comercial o deriva a canales externos.
CAP-A603. Incluye puerto de pagos, idempotencia, webhooks autenticados, ledger y conciliación.
CAP-A604. Evidencia mínima: pruebas de duplicados, resultado incierto y conciliación sobre modo de prueba del proveedor.
CAP-A605. Degradación típica: conciliación sin responsable o webhooks sin verificación de firma.
CAP-A606. Manual de referencia: [Pagos](PAYMENTS.md).

### A7. AI Integration Port y AI Gateway

CAP-A701. El puerto en OFF está presente en todo proyecto como contrato disponible.
CAP-A702. El gateway activo se requiere solo cuando existe un caso de uso de IA aprobado.
CAP-A703. Evidencia mínima en OFF: arranque sin credenciales ni modelos y rechazo claro de solicitudes.
CAP-A704. Evidencia mínima activo: evaluación, guardrails, presupuesto y kill switch probados.
CAP-A705. Degradación típica: evaluación vencida tras cambio de modelo o presupuesto agotado.
CAP-A706. Manual de referencia: [AI Gateway](AI-GATEWAY.md).

### A8. Actualización y fiabilidad

CAP-A801. Requerida cuando el sistema recibe cambios en producción con usuarios activos.
CAP-A802. Incluye releases reproducibles, migraciones compatibles y reversión ensayada.
CAP-A803. Evidencia mínima: release desde artefacto verificado y reversión ensayada en entorno representativo.
CAP-A804. Degradación típica: reversión imposible por migración destructiva no planificada.

### A9. Respuesta a incidentes

CAP-A901. Requerida en proporción a la criticidad; un sitio estático necesita poco, un sistema de pagos mucho.
CAP-A902. Incluye responsable, playbooks de capacidades activas, registro, comunicación y postmortem.
CAP-A903. Evidencia mínima: ejercicio reciente con hallazgos y mejoras registradas.
CAP-A904. Degradación típica: contactos desactualizados o playbooks sin ejercitar.
CAP-A905. Manual de referencia: [Respuesta a incidentes](INCIDENT-RESPONSE.md).

### A10. Cumplimiento y propiedad intelectual

CAP-A1001. Requerida cuando hay datos personales, consumidores, contratos con clientes o publicación comercial.
CAP-A1002. Incluye matriz de aplicabilidad, inventario de licencias y revisión de promesas comerciales.
CAP-A1003. Evidencia mínima: matriz con fuentes, fechas y revisión competente pendiente o realizada.
CAP-A1004. Degradación típica: expansión a nueva jurisdicción sin revisión.
CAP-A1005. Manual de referencia: [Cumplimiento, producto y propiedad intelectual](COMPLIANCE-IP-PRODUCT.md).

### A11. Migración y transferencia

CAP-A1101. Requerida cuando se sustituye tecnología, proveedor o equipo responsable.
CAP-A1102. Incluye arqueología, caracterización, equivalencia, retorno y paquete del receptor.
CAP-A1103. Evidencia mínima: equivalencia demostrada y demostraciones del receptor completadas.
CAP-A1104. Manual de referencia: [Migración y transferencia](MIGRATION-HANDOFF.md).

### A12. Orquestación de agentes

CAP-A1201. Opcional para el producto; requerida para el proceso de desarrollo cuando se usan agentes de código.
CAP-A1202. Incluye roles definidos, herramientas mínimas, paquetes de tarea, revisión y evidencia.
CAP-A1203. Evidencia mínima: tareas representativas con límites respetados y reportes verídicos.
CAP-A1204. Degradación típica: agente con permisos ampliados sin revisión.
CAP-A1205. Manual de referencia: [Orquestación de agentes](AGENT-ORCHESTRATION.md).

### A13. Sincronización y offline

CAP-A1301. Requerida cuando hay clientes que trabajan sin conexión o réplicas editables.
CAP-A1302. No aplicable a aplicaciones siempre conectadas sin edición local.
CAP-A1303. Evidencia mínima: pruebas de conflicto, reconexión tardía y dispositivo perdido aprobadas.
CAP-A1304. Degradación típica: cambio de esquema sin compatibilidad con operaciones pendientes antiguas.

### A14. Aislamiento multi-tenant

CAP-A1401. Requerida cuando varios clientes comparten infraestructura y datos.
CAP-A1402. Debe activarse desde el diseño porque es costosa de añadir después.
CAP-A1403. Evidencia mínima: matriz de pruebas de acceso cruzado aprobada en consultas, cachés, índices y backups.
CAP-A1404. Degradación típica: consulta nueva sin filtro de tenant ni seguridad a nivel de fila.

### A15. Accesibilidad y experiencia

CAP-A1501. Requerida en interfaces de usuario, con exigencia mayor en servicios públicos.
CAP-A1502. Incluye navegación por teclado, contraste, lectores de pantalla y diseño responsivo.
CAP-A1503. Evidencia mínima: pruebas de flujos principales con teclado y lector de pantalla.
CAP-A1504. Degradación típica: componente nuevo sin foco visible ni etiquetas accesibles.

## Anexo B. Ficha de referencia por perfil

### B1. Sitio estático

CAP-B101. Señales del perfil: páginas generadas sin base de datos, sin cuentas de usuario y sin formularios que guarden información.
CAP-B102. Capacidades requeridas: encabezados de seguridad, protección de cuentas de alojamiento y dominio, documentación de redespliegue.
CAP-B103. Capacidades no aplicables habituales: pagos, almacenamiento gobernado, aislamiento, sincronización y respuesta automatizada.
CAP-B104. Disparador de reperfilado: incorporación de formularios, comentarios, cuentas o integraciones con datos de visitantes.
CAP-B105. Riesgo principal: secuestro de dominio o de la cuenta de alojamiento, mitigado con autenticación fuerte.

### B2. Sitio de contenido con edición

CAP-B201. Señales: editores autenticados que publican contenido y posiblemente comentarios de visitantes.
CAP-B202. Requeridas: autenticación de editores, backups del contenido, registro de cambios y protección de formularios.
CAP-B203. Opcionales: moderación asistida por IA en modo controlado, con evaluación previa.
CAP-B204. Disparador: monetización, suscripciones o datos personales de lectores.
CAP-B205. Riesgo principal: cuenta de editor comprometida que publica contenido malicioso.

### B3. Herramienta interna

CAP-B301. Señales: usuarios empleados, acceso desde la red de la organización o con autenticación corporativa.
CAP-B302. Requeridas: autenticación, autorización por rol, registro de accesos y backups verificados.
CAP-B303. Opcionales: observabilidad avanzada y auditoría detallada según sensibilidad de datos.
CAP-B304. Disparador: usuarios externos o datos de clientes.
CAP-B305. Riesgo principal: suponer que la red interna es segura y omitir autorización.

### B4. CRM

CAP-B401. Señales: datos de contactos y clientes, historial de interacciones y equipo comercial.
CAP-B402. Requeridas: autorización por cartera, auditoría de accesos, gobierno de exportaciones y tratamiento de datos personales.
CAP-B403. Opcionales: integración de facturación y asistentes de IA con datos minimizados.
CAP-B404. Disparador: integración con pagos o con canales de comunicación masiva.
CAP-B405. Riesgo principal: exportación masiva de la base de contactos por un usuario saliente.

### B5. ERP

CAP-B501. Señales: operación central del negocio con inventario, finanzas, compras o planillas.
CAP-B502. Requeridas: auditoría completa, gobierno de datos, capacidad gestionada, registro de integraciones y recuperación reforzada.
CAP-B503. Opcionales: alta disponibilidad geográfica según tamaño y tolerancia a interrupciones.
CAP-B504. Disparador: nuevas entidades legales, monedas o jurisdicciones.
CAP-B505. Riesgo principal: corrupción de datos financieros sin reconciliación que la detecte.

### B6. SaaS

CAP-B601. Señales: varios clientes independientes en infraestructura compartida con planes de servicio.
CAP-B602. Requeridas: aislamiento multi-tenant, autorización por objeto, cuotas por tenant y comunicación de incidentes a clientes.
CAP-B603. Opcionales al inicio: escalado automático y observabilidad avanzada con señal de activación medida.
CAP-B604. Disparador: clientes empresariales con requisitos contractuales de seguridad o residencia.
CAP-B605. Riesgo principal: acceso cruzado entre tenants por un filtro omitido.

### B7. Comercio electrónico

CAP-B701. Señales: catálogo, carrito, pagos y entregas a consumidores.
CAP-B702. Requeridas: pagos con conciliación, controles de consumidor, protección contra abuso e integridad de inventario.
CAP-B703. Opcionales: recomendaciones con IA evaluadas y sin datos sensibles innecesarios.
CAP-B704. Disparador: ventas transfronterizas o marketplace con vendedores terceros.
CAP-B705. Riesgo principal: cobros duplicados o inventario sobrevendido por concurrencia.

### B8. Marketplace

CAP-B801. Señales: vendedores y compradores terceros con la plataforma como intermediaria.
CAP-B802. Requeridas: verificación de vendedores, gestión de disputas, separación de fondos según contratos y revisión competente.
CAP-B803. Disparador: custodia de fondos de terceros o pagos a vendedores en varios países.
CAP-B804. Riesgo principal: asumir un rol financiero regulado sin evaluarlo.

### B9. Sistema del sector público

CAP-B901. Señales: servicios a ciudadanos, trámites oficiales o datos administrativos.
CAP-B902. Requeridas: accesibilidad, conservación documental, transparencia, seguridad reforzada y obligaciones aplicables verificadas.
CAP-B903. Disparador: interoperabilidad con otras entidades o datos sensibles de ciudadanos.
CAP-B904. Riesgo principal: exclusión de ciudadanos por falta de accesibilidad o caídas en plazos legales.

### B10. Aplicación de escritorio

CAP-B1001. Señales: instalación en equipos de usuarios, frecuentemente Windows, con datos locales.
CAP-B1002. Requeridas: actualizaciones firmadas, almacenamiento local protegido y desinstalación limpia.
CAP-B1003. Disparador: sincronización con servidor o varios usuarios por equipo.
CAP-B1004. Riesgo principal: actualización defectuosa distribuida sin mecanismo de reversión.

### B11. Aplicación móvil

CAP-B1101. Señales: distribución por tiendas, versiones antiguas en uso y almacenamiento en dispositivo.
CAP-B1102. Requeridas: compatibilidad de API con versiones activas, almacenamiento seguro y avisos de actualización.
CAP-B1103. Disparador: pagos dentro de la aplicación o funciones offline.
CAP-B1104. Riesgo principal: romper versiones antiguas al cambiar la API.

### B12. Aplicación offline

CAP-B1201. Señales: trabajo sin conexión con sincronización posterior.
CAP-B1202. Requeridas: versiones por registro, resolución de conflictos, operaciones pendientes durables y revocación de dispositivos.
CAP-B1203. Riesgo principal: pérdida silenciosa de ediciones al reconectar.

### B13. Aplicación de tiempo real

CAP-B1301. Señales: conexiones persistentes, colaboración simultánea o actualizaciones en vivo.
CAP-B1302. Requeridas: límites por conexión, gestión de reconexión y degradación ante carga.
CAP-B1303. Riesgo principal: saturación por conexiones abiertas sin límite.

### B14. Plataforma de datos

CAP-B1401. Señales: ingesta, transformación y análisis de datos de varias fuentes.
CAP-B1402. Requeridas: linaje, calidad, control de acceso, retención y minimización.
CAP-B1403. Riesgo principal: decisiones tomadas con datos incorrectos sin trazabilidad.

### B15. Sistema de IA

CAP-B1501. Señales: funciones cuyo resultado depende de modelos de IA.
CAP-B1502. Requeridas: AI Gateway con evaluación, guardrails, presupuesto, kill switch y privacidad por caso de uso.
CAP-B1503. Riesgo principal: decisiones o efectos basados en salidas no verificadas del modelo.

### B16. Sistema de pagos

CAP-B1601. Señales: el producto procesa cobros, devoluciones o suscripciones como función central.
CAP-B1602. Requeridas: todas las capacidades del manual de pagos con conciliación y reversión probadas.
CAP-B1603. Riesgo principal: resultado incierto tratado como fallo y cobrado de nuevo.

### B17. Sistema crítico

CAP-B1701. Señales: su falla causa daño grave a personas, operaciones esenciales o grandes pérdidas.
CAP-B1702. Requeridas: disponibilidad y recuperación reforzadas, revisión independiente, ejercicios frecuentes y obligaciones verificadas.
CAP-B1703. Riesgo principal: subestimar la criticidad por el tamaño del equipo o del presupuesto.

## Anexo C. Preguntas de decisión para cada capacidad

CAP-C001. ¿Qué daño concreto ocurriría si esta capacidad no existiera en este producto?
CAP-C002. ¿Ese daño es reversible, y con qué costo para usuarios y para el negocio?
CAP-C003. ¿Existe una obligación verificada o un compromiso contractual que la exija?
CAP-C004. ¿Qué dependencias necesita y en qué estado están hoy?
CAP-C005. ¿Cuánto cuesta implementarla y operarla cada mes, con qué fuente?
CAP-C006. ¿Quién la operará y tiene la competencia necesaria?
CAP-C007. ¿Cómo verificaremos que funciona y cada cuánto renovaremos esa evidencia?
CAP-C008. ¿Cómo se degrada y qué señal lo indicará?
CAP-C009. ¿Cómo la retiraríamos si dejara de ser necesaria?
CAP-C010. ¿Es más barato y seguro añadirla ahora que después?
CAP-C011. ¿Qué señal nos haría reevaluar si hoy decidimos no activarla?
CAP-C012. ¿Qué promesas a clientes dependen de ella?
CAP-C013. Las respuestas se registran en la decisión de admisión o de no activación.
CAP-C014. Una pregunta sin respuesta verificable se registra como pendiente con responsable.

## Anexo D. Vigencia sugerida de evidencias

CAP-D001. Pruebas automatizadas: vigentes mientras se ejecuten en cada cambio relevante del componente.
CAP-D002. Ensayo de restauración: vigencia hipotética trimestral, ajustable por criticidad.
CAP-D003. Ejercicio de incidentes: vigencia hipotética semestral para sistemas con usuarios externos.
CAP-D004. Evaluación de IA: vigente hasta el cambio de modelo, prompt, herramientas o fuente de datos.
CAP-D005. Revisión de accesos: vigencia hipotética trimestral para datos sensibles.
CAP-D006. Matriz de aplicabilidad legal: vigente hasta un cambio de actividad, jurisdicción o norma relevante.
CAP-D007. Escaneo de dependencias: vigente hasta la publicación de nuevas vulnerabilidades o cambio de manifiesto.
CAP-D008. Prueba de kill switch: vigencia hipotética trimestral para casos de uso activos.
CAP-D009. Prueba de conciliación de pagos: diaria en operación, con revisión de diferencias.
CAP-D010. Los valores son ejemplos; cada proyecto fija vigencias según riesgo y los registra en su matriz.

## Anexo E. Perfilado en modo ADOPT

CAP-E001. En sistemas existentes, la matriz se construye desde comportamiento observado, no desde documentación antigua.
CAP-E002. Cada capacidad declarada en documentos se verifica en código, configuración y operación.
CAP-E003. Las capacidades documentadas pero no encontradas se registran como DOCUMENTED o ABSENT, no como activas.
CAP-E004. Las capacidades encontradas pero no documentadas se registran y se documentan.
CAP-E005. La deuda se prioriza por riesgo sin interrumpir la operación existente.
CAP-E006. Los cambios se preceden de caracterización según el manual de migración.
CAP-E007. Caso hipotético: la documentación afirma backups diarios, pero el script dejó de ejecutarse hace meses.
CAP-E008. La matriz registra almacenamiento gobernado como DEGRADED y la restauración verificada como primera prioridad.
CAP-E009. La aceptación verifica un backup nuevo restaurado con éxito y la alerta de fallo configurada.
CAP-E010. Quiero conocer el sistema que heredo como es, no como alguien escribió que era.

## Anexo F. Campos del registro de decisión de capacidad

CAP-F001. Identificador de la decisión y fecha.
CAP-F002. Capacidad y familia.
CAP-F003. Perfil y versión de la matriz considerada.
CAP-F004. Decisión: activar, diferir, no activar, degradar o retirar.
CAP-F005. Estado canónico resultante y ejes de aplicabilidad, implementación y evidencia.
CAP-F006. Evidencia que sostiene la decisión.
CAP-F007. Alternativas consideradas y razón de descarte.
CAP-F008. Costo estimado con fuente.
CAP-F009. Responsable de implementación y de operación.
CAP-F010. Señal de reevaluación.
CAP-F011. Aprobación del responsable del producto.

## Anexo G. Preguntas frecuentes

CAP-G001. ¿Debo activar todas las capacidades de EOS? No; solo las que el perfil justifica con evidencia.
CAP-G002. ¿El AI Integration Port obliga a usar IA? No; en OFF no ejecuta nada ni genera gasto.
CAP-G003. ¿Puedo declarar NOT_APPLICABLE una capacidad? Sí, con justificación concreta basada en el perfil.
CAP-G004. ¿Qué hago si no sé si una obligación aplica? Márcala UNDETERMINED y solicita revisión competente.
CAP-G005. ¿Un agente puede activar capacidades? Puede proponer e implementar con autorización; la decisión es del responsable.
CAP-G006. ¿Cada cuánto reviso la matriz? En cada release mayor, ante eventos de reperfilado y con la periodicidad de la criticidad.
CAP-G007. ¿Qué pasa si la evidencia vence? La capacidad pasa a DEGRADED hasta renovarla.
CAP-G008. ¿Puedo copiar la matriz de otro proyecto? Puedes usarla como punto de partida, ajustándola con evidencia propia.
CAP-G009. ¿Cómo anuncio capacidades a clientes? Solo las que están en OPERATING con evidencia vigente.
CAP-G010. ¿Dónde registro todo? En la matriz del proyecto con la plantilla CAPABILITY-MATRIX y enlaces a evidencia.

## Anexo H. Señales de madurez del perfilado

CAP-H001. La matriz está actualizada y su fecha de revisión no ha vencido.
CAP-H002. Las capacidades REQUIRED están en OPERATING o con plan y excepción vigentes.
CAP-H003. Ninguna capacidad OPERATING tiene evidencia vencida.
CAP-H004. Los eventos de reperfilado se detectan al admitir tareas.
CAP-H005. Las promesas comerciales coinciden con la matriz.
CAP-H006. El receptor del sistema entiende la matriz y la usa para decidir.
CAP-H007. Las señales se evalúan con evidencia, no con autoevaluación.

## Anexo I. Relación con otros módulos

CAP-I001. [PRIME-DIRECTIVE](PRIME-DIRECTIVE.md) define autoridad, evidencia y cierre que este manual aplica a las capacidades.
CAP-I002. [AGENT-ORCHESTRATION](AGENT-ORCHESTRATION.md) asigna roles según las capacidades activas.
CAP-I003. Cada familia de capacidad tiene su manual de dominio, listado en el Anexo A.
CAP-I004. La [constitución maestra](../../EOS_MASTER_SYSTEM_INSTRUCTION.md), sección 2, establece la regla central que este manual desarrolla.
CAP-I005. Este manual decide activación; los manuales de dominio definen cómo implementar y verificar.
CAP-I006. Las contradicciones se reportan al propietario y se resuelven en la fuente canónica.

## Anexo J. Caso trabajado F: plataforma educativa con crecimiento rápido

CAP-J001. Estado inicial hipotético: plataforma de cursos en línea con cinco mil estudiantes y pagos por curso.
CAP-J002. El perfil combina SaaS para instituciones, comercio electrónico para estudiantes y contenido con datos de menores en algunos cursos.
CAP-J003. La revisión competente identifica obligaciones reforzadas para datos de menores y consentimiento parental.
CAP-J004. La matriz eleva a REQUIRED el aislamiento por institución, el tratamiento de datos de menores y la accesibilidad.
CAP-J005. Pagos queda REQUIRED con conciliación diaria y devoluciones con autorización.
CAP-J006. El AI Gateway para corrección automática de ejercicios queda en ASSESSED hasta evaluar sesgos y privacidad.
CAP-J007. El crecimiento medido duplica usuarios cada trimestre, lo que activa forecast de almacenamiento para videos.
CAP-J008. La observabilidad avanzada se activa cuando un incidente de rendimiento muestra que la básica no bastaba para diagnosticar.
CAP-J009. La deuda priorizada coloca aislamiento y datos de menores antes que nuevas funciones comerciales.
CAP-J010. La aceptación de la primera revisión registra estados, evidencia y fecha de la siguiente revisión trimestral.
CAP-J011. El caso es ilustrativo.

## Anexo K. Caso trabajado G: proyecto que reduce capacidades

CAP-K001. Estado inicial hipotético: un producto activó escalado automático, réplicas en dos regiones y observabilidad avanzada al lanzar.
CAP-K002. Tras un año, la medición muestra tráfico estable y bajo, y el costo de infraestructura triplica lo necesario.
CAP-K003. La revisión periódica evalúa cada capacidad con las preguntas de decisión del Anexo C.
CAP-K004. La replicación geográfica se retira y se reemplaza por backups en otra región con recuperación en horas aceptada por el responsable.
CAP-K005. El escalado automático se mantiene con límites más bajos porque su costo en reposo es mínimo.
CAP-K006. La observabilidad avanzada se reduce a las señales usadas en los últimos incidentes.
CAP-K007. Cada retiro sigue el procedimiento de la sección 20 con registro en la matriz y el changelog.
CAP-K008. La aceptación verifica el nuevo costo mensual y un ensayo de restauración desde la otra región.
CAP-K009. Quiero tener el valor de retirar lo que sobra con la misma disciplina con que activo lo que falta.

## Anexo L. Plantilla mental del perfilado rápido

CAP-L001. ¿Quiénes usan el sistema y son internos o externos?
CAP-L002. ¿Qué datos guarda y alguno es personal, financiero o sensible?
CAP-L003. ¿Cobra dinero o custodia fondos?
CAP-L004. ¿Con qué terceros se integra y cuáles son críticos?
CAP-L005. ¿En qué países opera y dónde están los datos?
CAP-L006. ¿Cuánto tiempo puede estar caído sin daño grave?
CAP-L007. ¿Usa o usará IA y con qué datos?
CAP-L008. ¿Quién lo operará y con qué recursos?
CAP-L009. Con estas respuestas se elige el perfil de referencia y se ajusta la matriz.
CAP-L010. El perfilado rápido sirve para tareas pequeñas; los proyectos sustanciales siguen el algoritmo completo de la sección 35.

## Anexo M. Mantenimiento del módulo

CAP-M001. El módulo se revisa en cada edición mayor con evidencia de proyectos que lo aplicaron.
CAP-M002. Las matrices de referencia se ajustan cuando la práctica muestra activaciones innecesarias o controles faltantes.
CAP-M003. Las familias de capacidades se amplían cuando aparece un dominio recurrente no cubierto.
CAP-M004. Las cláusulas sin consecuencia demostrada se retiran sin reutilizar identificadores.
CAP-M005. Las vigencias sugeridas se revisan con datos de incidentes y ensayos reales.
CAP-M006. Los casos trabajados se actualizan para mantenerse coherentes con las cláusulas vigentes.
CAP-M007. La revisión se registra en el changelog con alcance y responsable.
CAP-M008. Los receptores que mantengan variantes documentan sus diferencias.
CAP-M009. La coherencia con la constitución y los manuales de dominio se verifica en cada revisión.
CAP-M010. Un agente puede preparar la revisión del módulo; su aprobación corresponde al propietario.
CAP-M011. La responsabilidad editorial corresponde a Pierre R. Boss (oprbguitar).

## Anexo N. Recordatorios esenciales

CAP-N001. Presente en el estándar no significa activo en el proyecto.
CAP-N002. Toda capacidad relevante tiene estado registrado, incluso cuando la decisión es no activarla.
CAP-N003. Ninguna capacidad se activa antes que sus dependencias obligatorias estén verificadas.
CAP-N004. OPERATING exige implementación, verificación, responsable, monitoreo y recuperación vigentes.
CAP-N005. La evidencia vence y su vencimiento degrada la capacidad.
CAP-N006. Las promesas a clientes solo se refieren a capacidades operativas.
CAP-N007. Los cambios importantes del producto disparan reperfilado.
CAP-N008. Lo irreversible se diseña temprano y lo escalable crece con medición.
CAP-N009. Los agentes proponen y verifican; el responsable decide.
CAP-N010. Retirar lo innecesario es parte del mismo trabajo que activar lo necesario.
CAP-N011. Estos recordatorios resumen cláusulas desarrolladas en el módulo y no las sustituyen.

## Anexo O. Declaración final

CAP-O001. Este manual describe cómo quiero decidir las capacidades de mis productos; no activa ninguna por sí mismo.
CAP-O002. Cada proyecto aporta su perfil, su matriz y la evidencia de sus estados.
CAP-O003. Firma editorial: Pierre R. Boss (oprbguitar), con desarrollo documental asistido por IA.

## Anexo P. Dependencias obligatorias por familia

CAP-P001. Seguridad avanzada depende de la línea base de seguridad verificada y de observabilidad básica con receptor.
CAP-P002. Almacenamiento gobernado depende de gestión de secretos y de observabilidad básica para alertas de backup.
CAP-P003. Pagos depende de línea base de seguridad, almacenamiento gobernado, observabilidad, respuesta a incidentes y actualización con reversión.
CAP-P004. AI Gateway activo depende de gestión de secretos, observabilidad, presupuestos y respuesta a incidentes con playbook de IA.
CAP-P005. Aislamiento multi-tenant depende de autorización por objeto y de pruebas automatizadas de acceso cruzado.
CAP-P006. Sincronización offline depende de versionado de esquema, idempotencia y almacenamiento gobernado en el servidor.
CAP-P007. Respuesta automatizada depende de detección verificada, registro de acciones y procedimiento de reversión probado.
CAP-P008. Migración depende de caracterización, backups verificados y reversión ensayada.
CAP-P009. Orquestación de agentes en el proceso depende de instrucciones del repositorio, validadores y control de versiones.
CAP-P010. Observabilidad avanzada depende de observabilidad básica estable y de responsables por dominio.
CAP-P011. Cumplimiento depende de inventario de datos y de documentación del tratamiento real.
CAP-P012. Accesibilidad depende de pruebas de interfaz que incluyan teclado y lectores de pantalla.
CAP-P013. Las dependencias específicas de cada proyecto pueden añadirse con justificación en su matriz.
CAP-P014. Una dependencia nueva se refleja en el grafo y en el orden de activación.

## Anexo Q. Señales medibles para activar capacidades diferidas

CAP-Q001. Escalado automático: uso sostenido de recursos por encima del umbral definido durante picos recurrentes.
CAP-Q002. Observabilidad avanzada: incidentes cuyo diagnóstico superó el objetivo por falta de trazas.
CAP-Q003. Detección avanzada de bots: aumento medido de registros falsos, pruebas de credenciales o scraping.
CAP-Q004. Almacenamiento por niveles: forecast que alcanza la reserva antes del horizonte de planificación.
CAP-Q005. Replicación geográfica: compromiso contractual de disponibilidad o pérdida tolerable menor que la recuperación desde backup.
CAP-Q006. AI Gateway en nube: contrato de privacidad adecuado y evaluación que supere al modo local.
CAP-Q007. Particionado de datos: latencia de consultas críticas fuera de objetivo con índices optimizados.
CAP-Q008. Revisión independiente: incidentes repetidos o cambio a perfil crítico.
CAP-Q009. Cada señal se registra en la matriz junto a la capacidad diferida con su umbral.
CAP-Q010. El monitoreo de la señal se configura cuando es medible para no depender de la memoria.
CAP-Q011. Alcanzar la señal dispara evaluación, no activación automática.
CAP-Q012. Los umbrales concretos se definen por proyecto y se revisan con datos reales.

## Anexo R. Errores comunes al estimar costos de capacidades

CAP-R001. Usar tarifas de marketing en lugar de tarifas verificadas en la región y plan reales.
CAP-R002. Omitir costos de transferencia de datos y de recuperación desde niveles fríos.
CAP-R003. Ignorar el tiempo humano de operación y respuesta a alertas.
CAP-R004. Suponer que el crecimiento será lineal sin medir estacionalidad.
CAP-R005. Olvidar el costo de retirar la capacidad o de salir del proveedor.
CAP-R006. Presentar estimaciones como cifras reales en reportes al responsable.
CAP-R007. Cada error se previene con fuente, fecha, supuestos explícitos y reconciliación posterior.

## Anexo S. Explicar la matriz a personas no técnicas

CAP-S001. La matriz se resume en tres listas: lo que protegemos hoy, lo que planeamos proteger y lo que decidimos no necesitar.
CAP-S002. Cada elemento se describe por el riesgo que reduce, no por el nombre técnico del control.
CAP-S003. Los costos se presentan mensuales y con su fuente.
CAP-S004. Las decisiones pendientes se presentan con opciones, consecuencias y recomendación.
CAP-S005. El resumen evita jerga y siglas sin explicar.
CAP-S006. El resumen nunca exagera el estado real para tranquilizar.
CAP-S007. Quiero que quien decide entienda lo que decide.

## Anexo T. Caso trabajado H: IA en un CRM existente

CAP-T001. Estado inicial hipotético: un CRM operativo quiere sugerir respuestas a correos de clientes con IA.
CAP-T002. El reperfilado añade la familia de IA y revisa privacidad de los datos de contactos.
CAP-T003. El responsable aprueba evaluar CLOUD_API con un proveedor bajo contrato de no retención verificado por revisión competente.
CAP-T004. Las dependencias de presupuesto, observabilidad y playbook de IA se verifican antes de activar.
CAP-T005. Los guardrails impiden enviar respuestas automáticamente; el agente solo propone y un humano envía.
CAP-T006. La evaluación incluye correos con instrucciones inyectadas para comprobar que el asistente no las sigue.
CAP-T007. El canary inicia con un equipo pequeño y mide aceptación de sugerencias y errores detectados.
CAP-T008. La matriz registra el caso de uso en OPERATING tras evaluación, guardrails y kill switch probados.
CAP-T009. El caso es ilustrativo.

## Anexo U. Caso trabajado I: aplicación móvil offline para trabajo de campo

CAP-U001. Estado inicial hipotético: técnicos registran mantenimientos en zonas rurales sin conexión estable.
CAP-U002. El perfil combina aplicación móvil y offline con datos operativos y fotos.
CAP-U003. La matriz activa sincronización con versiones, conflictos por campo y operaciones pendientes durables.
CAP-U004. Activa almacenamiento seguro en el dispositivo y revocación de dispositivos perdidos.
CAP-U005. Activa compatibilidad de API con las versiones de aplicación en uso.
CAP-U006. Difiere notificaciones en tiempo real hasta que exista conectividad suficiente medida.
CAP-U007. La aceptación incluye pruebas de reconexión tras días sin señal y de dos técnicos editando la misma orden.
CAP-U008. El caso es ilustrativo.

## Anexo V. Checklist ante un evento de reperfilado

CAP-V001. Registrar el evento con fecha, descripción y evidencia.
CAP-V002. Revisar las entradas del perfil afectadas por el evento.
CAP-V003. Reasignar perfiles si el comportamiento del sistema cambió.
CAP-V004. Reevaluar aplicabilidad de cada familia afectada.
CAP-V005. Actualizar el grafo de dependencias.
CAP-V006. Identificar nueva deuda y priorizarla.
CAP-V007. Revisar promesas comerciales afectadas.
CAP-V008. Proponer plan de activación y presentarlo al responsable.
CAP-V009. Registrar decisiones y programar verificación.
CAP-V010. El cambio que provocó el evento no se lanza antes de cerrar los pasos que lo condicionan.

## Anexo W. Preguntas de auditoría de la matriz

CAP-W001. ¿Cada capacidad OPERATING tiene evidencia vigente enlazada?
CAP-W002. ¿Cada NOT_APPLICABLE tiene justificación coherente con el perfil actual?
CAP-W003. ¿Alguna capacidad activa depende de otra no verificada?
CAP-W004. ¿Hay excepciones vencidas sin renovación justificada?
CAP-W005. ¿Las promesas comerciales coinciden con capacidades operativas?
CAP-W006. ¿El perfil refleja usuarios, datos y jurisdicciones actuales?
CAP-W007. ¿La deuda tiene responsables y plazos realistas?
CAP-W008. ¿La última revisión se hizo dentro de su periodicidad?
CAP-W009. ¿Los costos reportados provienen de fuentes verificadas?
CAP-W010. Cada respuesta negativa se convierte en hallazgo con severidad y responsable.

## Anexo X. Caso trabajado J: sistema municipal de trámites

CAP-X001. Estado inicial hipotético: una municipalidad pequeña quiere recibir solicitudes de licencias en línea.
CAP-X002. El perfil es sistema del sector público con datos personales de ciudadanos y documentos adjuntos.
CAP-X003. La revisión competente identifica obligaciones de accesibilidad, conservación documental y protección de datos aplicables.
CAP-X004. La matriz eleva accesibilidad, almacenamiento gobernado con retención documental y registro de accesos a REQUIRED.
CAP-X005. Los archivos adjuntos se procesan con validación de tipo y almacenamiento aislado.
CAP-X006. Los pagos de tasas se derivan a la pasarela oficial sin integración técnica propia, por lo que pagos queda NOT_APPLICABLE.
CAP-X007. El puerto de IA queda en OFF; un asistente de orientación se evalúa más adelante con criterios de transparencia.
CAP-X008. La disponibilidad se dimensiona por plazos legales de atención, no por alta disponibilidad continua.
CAP-X009. La aceptación verifica accesibilidad de los formularios con teclado y lector de pantalla y una restauración de expedientes.
CAP-X010. El caso es ilustrativo.

## Anexo Y. Coordinación con el plan ejecutable

CAP-Y001. El plan de activación de capacidades se escribe como plan ejecutable cuando abarca varias etapas o participantes.
CAP-Y002. Cada hito corresponde a una transición de estado de una capacidad con su verificación.
CAP-Y003. El registro de progreso del plan actualiza la matriz al cerrar cada hito.
CAP-Y004. Las decisiones tomadas durante la activación se registran en el plan y en la matriz.
CAP-Y005. La plantilla [EXEC-PLAN](../../templates/EXEC-PLAN.md) estructura este trabajo.
CAP-Y006. Un plan cerrado deja la matriz con estados verificados y evidencia enlazada.
CAP-Y007. Quiero que activar capacidades sea un trabajo planificado y verificable, no una serie de cambios sueltos.

## Anexo Z. Responsabilidades humanas que no se delegan

CAP-Z001. La aprobación de activar, diferir o retirar capacidades pertenece al responsable del producto.
CAP-Z002. La aceptación de riesgos de capacidades REQUIRED no activas pertenece al responsable competente.
CAP-Z003. La interpretación de obligaciones legales pertenece a revisión profesional habilitada.
CAP-Z004. La contratación de servicios y aceptación de términos pertenece al responsable con autorización explícita.
CAP-Z005. Los agentes preparan perfiles, matrices, planes y evidencia para que estas decisiones sean informadas.
CAP-Z006. Ningún agente modifica la matriz para declarar estados que la evidencia no respalda.
CAP-Z007. Quiero delegar el análisis y conservar las decisiones que me corresponden.

## Anexo AA. Integración con la validación de la biblioteca

CAP-AA01. El validador de esta biblioteca comprueba que este módulo existe, está registrado y supera el piso de profundidad acordado.
CAP-AA02. El validador no verifica matrices de proyectos receptores; cada proyecto puede añadir su propia validación.
CAP-AA03. Un proyecto que quiera automatizar controles de su matriz puede validar estructura, estados permitidos y fechas de evidencia.
CAP-AA04. Esa automatización se diseña como código del proyecto con pruebas y revisión.
CAP-AA05. La validación automática complementa, no reemplaza, la revisión humana de decisiones.
CAP-AA06. La firma editorial de Pierre R. Boss (oprbguitar) en este módulo se comprueba por el validador como presencia, no como identidad.

## Anexo AB. Cambios tecnológicos que afectan capacidades

CAP-AB01. Un aviso de fin de soporte de un componente degrada las capacidades que dependen de él hasta planificar su reemplazo.
CAP-AB02. Una vulnerabilidad crítica publicada en una dependencia activa revisión de la línea base de seguridad.
CAP-AB03. Un cambio de condiciones de un proveedor reabre la decisión de admisión de la capacidad que lo usa.
CAP-AB04. Un cambio de modelo por defecto en un proveedor de IA vence la evaluación del caso de uso afectado.
CAP-AB05. Una nueva versión del host de agentes puede cambiar formatos de definiciones y requiere prueba antes de adoptarla.
CAP-AB06. Las fuentes de estos avisos se registran con fecha y se verifican en fuente primaria.
CAP-AB07. El orquestador incorpora estos avisos a la revisión periódica o abre reperfilado cuando son urgentes.
CAP-AB08. Quiero que los cambios del ecosistema actualicen mis decisiones antes de afectar a mis usuarios.

## Anexo AC. Receptores con poca experiencia técnica

CAP-AC01. Cuando el receptor tiene poca experiencia, se prefieren capacidades gestionadas por proveedores confiables sobre infraestructura propia.
CAP-AC02. Las capacidades activas se limitan a las que el receptor puede operar con runbooks claros.
CAP-AC03. Los runbooks se escriben paso a paso con capturas o comandos exactos y resultados esperados.
CAP-AC04. Las alertas se reducen a las accionables y cada una indica qué hacer.
CAP-AC05. Se planifica apoyo externo para capacidades que el receptor no puede asumir.
CAP-AC06. La matriz declara qué capacidades dependen de ese apoyo externo.
CAP-AC07. Quiero sistemas que su dueño pueda cuidar, aunque no sea ingeniero.

## Anexo AD. Ejemplo de matriz descrita en prosa para un sitio de contenido

CAP-AD01. Línea base de seguridad: REQUIRED, ACTIVE, VERIFIED con escaneo de dependencias y encabezados comprobados en la fecha registrada.
CAP-AD02. Documentación: REQUIRED, ACTIVE, VERIFIED con redespliegue probado desde un clon limpio.
CAP-AD03. Observabilidad básica: REQUIRED, ACTIVE, PARTIAL porque falta alerta de errores del editor.
CAP-AD04. Almacenamiento gobernado: REQUIRED para el contenido editorial, IMPLEMENTED_INACTIVE, MISSING por falta de ensayo de restauración.
CAP-AD05. Pagos: NOT_APPLICABLE porque el sitio no cobra; justificación registrada.
CAP-AD06. AI Port: presente en OFF; AI Gateway NOT_APPLICABLE hasta un caso de uso aprobado.
CAP-AD07. Seguridad avanzada: OPTIONAL, ABSENT, con señal de reevaluación ante comentarios abiertos.
CAP-AD08. Respuesta a incidentes: REQUIRED en forma básica, DOCUMENTED, PARTIAL por falta de ejercicio.
CAP-AD09. Cumplimiento: REQUIRED por formulario de contacto, DOCUMENTED con política de privacidad revisada.
CAP-AD10. Accesibilidad: REQUIRED, ACTIVE, PARTIAL con pruebas de teclado y pendiente lector de pantalla.
CAP-AD11. La deuda priorizada coloca el ensayo de restauración primero y la alerta del editor segundo.
CAP-AD12. El ejemplo es ilustrativo y muestra cómo leer los ejes junto al estado canónico.

## Anexo AE. DORMANT frente a NOT_APPLICABLE

CAP-AE01. DORMANT indica que la capacidad se mantiene disponible como contrato o punto de extensión para activarse sin rediseño.
CAP-AE02. NOT_APPLICABLE indica que el perfil no necesita la capacidad y no se reserva punto de extensión.
CAP-AE03. El AI Integration Port en OFF es el ejemplo canónico de DORMANT en todos los proyectos.
CAP-AE04. Una capacidad DORMANT documenta cómo activarse y qué dependencias requeriría.
CAP-AE05. Una capacidad NOT_APPLICABLE documenta por qué no aplica y qué cambio la haría aplicable.
CAP-AE06. Mantener demasiadas capacidades DORMANT añade complejidad; se reservan para las probables o costosas de añadir después.
CAP-AE07. Quiero distinguir lo que dejo preparado de lo que simplemente no necesito.

## Anexo AF. Proyectos con varios equipos

CAP-AF01. Cada capacidad tiene un equipo propietario explícito aunque varios equipos la usen.
CAP-AF02. Las dependencias entre capacidades de distintos equipos se acuerdan como contratos con versión.
CAP-AF03. La degradación de una capacidad compartida se comunica a todos los equipos dependientes.
CAP-AF04. La matriz global consolida las matrices por equipo y resuelve contradicciones.
CAP-AF05. Las revisiones periódicas incluyen a los propietarios de capacidades compartidas.
CAP-AF06. Quiero que una capacidad compartida tenga un dueño claro y consumidores informados.

## Anexo AG. Cierre de una revisión de matriz

CAP-AG01. La revisión termina con la matriz actualizada, decisiones registradas y deuda priorizada.
CAP-AG02. Los cambios de estado se reflejan con fecha y evidencia.
CAP-AG03. Las acciones resultantes tienen responsable y plazo.
CAP-AG04. La próxima revisión queda programada.
CAP-AG05. El resumen para el responsable se entrega en lenguaje comprensible.
CAP-AG06. La revisión se registra en el changelog del proyecto cuando cambia capacidades relevantes.
CAP-AG07. Una revisión sin cambios también se registra para demostrar que se realizó.
CAP-AG08. Pierre R. Boss (oprbguitar) espera que cada revisión deje el producto con controles más ajustados a su realidad.

## Anexo AH. Errores de interpretación de este manual

CAP-AH01. Leer las matrices de referencia como listas obligatorias en lugar de puntos de partida ajustables.
CAP-AH02. Interpretar el puerto de IA en OFF como obligación de integrar un proveedor de modelos.
CAP-AH03. Considerar que NOT_APPLICABLE exime de documentar la razón de la decisión.
CAP-AH04. Suponer que VERIFIED en prueba equivale a OPERATING en producción.
CAP-AH05. Tratar las vigencias sugeridas como plazos regulatorios en lugar de ejemplos ajustables.
CAP-AH06. Pensar que el manual certifica cumplimiento legal de un proyecto por aplicarlo.
CAP-AH07. Creer que un agente puede cerrar decisiones de activación sin aprobación del responsable.
CAP-AH08. Asumir que más capacidades activas significan un producto más seguro.
CAP-AH09. Cada interpretación errónea se corrige remitiendo a las cláusulas correspondientes del módulo.
CAP-AH10. Las dudas de interpretación se dirigen al propietario para aclarar la redacción en la siguiente edición.

## Anexo AI. Secuencia mínima para un proyecto nuevo

CAP-AI01. Registrar el perfil inicial con las entradas de la sección 05 y sus pendientes.
CAP-AI02. Activar las capacidades siempre activas de la sección 07 dimensionadas al proyecto.
CAP-AI03. Evaluar familias adicionales con las fichas del Anexo A y las preguntas del Anexo C.
CAP-AI04. Diseñar desde el inicio las capacidades difíciles de añadir después, como aislamiento y modelo de datos.
CAP-AI05. Diferir las capacidades escalables con señales medibles del Anexo Q.
CAP-AI06. Construir el grafo de dependencias y el plan por etapas.
CAP-AI07. Obtener aprobación del responsable y registrar decisiones.
CAP-AI08. Verificar cada capacidad activada y registrar su evidencia en la matriz.
CAP-AI09. Programar la primera revisión periódica antes del lanzamiento.
CAP-AI10. Revisar promesas comerciales contra la matriz antes de publicar el producto.
CAP-AI11. Esta secuencia resume la skill eos-init para la parte de capacidades.
CAP-AI12. Pierre R. Boss (oprbguitar) la propone como camino mínimo responsable para cualquier producto nuevo.

## Anexo AJ. Secuencia mínima para un sistema existente

CAP-AJ01. Inventariar capacidades reales observadas en código, configuración y operación.
CAP-AJ02. Contrastar con la documentación existente y registrar diferencias.
CAP-AJ03. Asignar perfiles según el comportamiento actual, no según el diseño original.
CAP-AJ04. Registrar estados reales, incluidas capacidades degradadas o solo documentadas.
CAP-AJ05. Identificar capacidades requeridas ausentes y priorizar por riesgo irreversible.
CAP-AJ06. Proteger primero datos y recuperación antes de cambios funcionales.
CAP-AJ07. Planificar activaciones con caracterización previa de flujos críticos.
CAP-AJ08. Presentar matriz y plan al responsable para aprobación.
CAP-AJ09. Ejecutar por etapas con verificación y actualización de la matriz.
CAP-AJ10. Programar revisión periódica y vigilar eventos de reperfilado.
CAP-AJ11. Esta secuencia resume la skill eos-adopt para la parte de capacidades.
CAP-AJ12. La adopción respeta lo que funciona y corrige lo que falta con evidencia.
CAP-AJ13. Las capacidades que el sistema ya cumple bien se documentan y se conservan sin rediseño innecesario.
CAP-AJ14. Las capacidades sobredimensionadas se evalúan para retiro con el procedimiento de la sección 20.
CAP-AJ15. Los hallazgos de la adopción se comunican al responsable con lenguaje claro y costos estimados con fuente.
CAP-AJ16. La matriz resultante se convierte en la línea base para medir mejoras futuras.
CAP-AJ17. La línea base se versiona para comparar revisiones posteriores.
CAP-AJ18. Un agente puede ejecutar los pasos 1 a 5 en solo lectura y preparar los siguientes como propuesta.
CAP-AJ19. Las acciones que modifican el sistema esperan la autorización correspondiente.
CAP-AJ20. Pierre R. Boss (oprbguitar) considera esta secuencia el primer trabajo obligado ante cualquier software heredado.
CAP-AJ21. Con este anexo concluye el módulo CAPABILITY-PROFILER de la edición 3.0.0.

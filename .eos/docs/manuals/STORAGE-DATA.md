# Manual EOS de almacenamiento, datos y recuperación

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**
**Fecha documental:** 2026-10-03, Perú. **Origen:** ampliación operacional SRC-02.
**Naturaleza:** reglas y procedimientos; no afirma que exista infraestructura, backup probado ni almacenamiento ilimitado.

## 1. Mandato personal y alcance

Quiero conocer dónde viven mis datos, cuánto espacio consumen, cuánto cuesta conservarlos y cómo recuperarlos cuando falla el equipo, el proveedor o una persona. El almacenamiento elástico es una capacidad de expansión condicionada por cuotas, presupuesto, rendimiento y operación. Ninguna nube elimina esos límites. Medir antes de ampliar y probar antes de prometer recuperación.

Este manual desarrolla la [constitución maestra](../../EOS_MASTER_SYSTEM_INSTRUCTION.md). Activar inventario básico cuando un proyecto conserve archivos o una base de datos. Añadir forecast cuando haya crecimiento; almacenamiento por niveles cuando el acceso y costo lo justifiquen; sincronización cuando existan réplicas editables o uso offline. Una web estática no necesita por defecto una plataforma de datos distribuida.

La documentación debe distinguir capacidad presente en el estándar de controles implementados, probados y operados. Registrar pendientes con dueño y siguiente acción. La [guía de actualizaciones](UPDATES-RELIABILITY.md) gobierna cambios de esquema y releases; el [manual de pagos](PAYMENTS.md) añade restricciones financieras cuando los datos representan dinero.

## 2. Propiedad, entradas y resultados

| Responsable | Entradas | Resultado verificable |
|---|---|---|
| Data Architect | Tipos, relaciones y sensibilidad | Diccionario, clasificación y ciclo de vida |
| Storage Architect | Entorno, restricciones y carga | Topología y contrato de acceso |
| Capacity Manager | Mediciones, cuotas y crecimiento | Forecast con incertidumbre y decisiones |
| SRE | Criticidad y dependencias | Backup, RPO/RTO y ensayo de recuperación |
| Seguridad/privacidad | Identidades, finalidad y amenazas | Controles y evaluación de retención |
| Operador | Runbook y autorización | Evidencia de ejecución y anomalías |

Definir quién puede leer, escribir, exportar, restaurar y eliminar cada clase. Si varios roles recaen en una persona, reconocer el riesgo y añadir revisión proporcional. La IA puede analizar métricas agregadas; acceder a datos personales reales requiere alcance explícito y herramientas adecuadas. Un permiso técnico no equivale a autorización de negocio.

## 3. Inventario real y línea base

Inventariar disco del sistema, disco de datos, volúmenes, NAS, bases, índices, objetos, cache, temporales, logs, exportaciones, replicas, snapshots y backups. Para cada recurso guardar propietario, ubicación, ambiente, tenant, finalidad, clasificación, tecnología, versión, cifrado, controles de acceso, cuota contratada, cuota efectiva, uso, reserva operativa y costos verificados. Marcar datos desconocidos como pendientes, sin rellenarlos con supuestos.

Una unidad muestra espacio libre físico, pero la aplicación puede estar limitada por cuota, límite de archivos, tamaño máximo de objeto, tablas, IOPS o presupuesto. Medir ambos. Registrar bytes y convención de unidades: TB/GB decimales o TiB/GiB binarios. No comparar cifras incompatibles. Separar tamaño lógico del dataset, tamaño físico de base, índices, WAL/journal, compresión, replicas y copias; el tamaño de un CSV no predice por sí solo el disco de producción.

La línea base incluye fecha, intervalo, fuente, permisos usados y calidad de medición. Registrar número de archivos, mayores datasets, crecimiento diario/semanal/mensual, operaciones, latencia, throughput, errores, duración de backup y costo. Una medición faltante no significa consumo cero. Un proveedor sin métrica accesible requiere método alternativo o declaración de incertidumbre.

## 4. Contrato de datos y fronteras de acceso

Cada conjunto declara esquema, claves, formatos, procedencia, unidad monetaria cuando corresponda, timestamps, zona horaria, reglas de calidad y responsable. Validar datos al ingresar, mantener consultas parametrizadas y controlar acceso por organización y recurso. Los datos importados pueden contener fórmulas, HTML o instrucciones maliciosas; tratarlos como contenido sin ejecutar.

Usar un contrato de almacenamiento reemplazable cuando beneficie al proyecto: lectura, escritura condicional, listado paginado, borrado gobernado y metadatos. No ocultar las diferencias entre filesystem y object storage. Documentar atomicidad, consistencia, límites, operaciones soportadas y errores. Evitar que una operación parcialmente ejecutada aparezca como éxito completo.

Para cargas de archivos validar tamaño, tipo efectivo, nombres, rutas y permisos. Generar nombres internos seguros, impedir traversal y controlar enlaces simbólicos según entorno. Escanear contenido cuando el riesgo lo justifique. Separar objetos públicos de privados y limitar URLs temporales. Las credenciales del almacenamiento no aparecen en repositorio, mensajes de error, trazas o documentación pública.

## 5. Forecast con supuestos explícitos

Calcular crecimiento neto observado y escenarios. Separar ingreso bruto, borrados efectivamente ejecutados, compresión medida, expansión de índices, replicas, backups y temporales. Una política de borrado todavía no operativa no reduce la proyección. La compresión estimada necesita pruebas representativas; no usar su ratio deseado como ahorro garantizado.

Una fórmula inicial es `días restantes = (capacidad efectiva − uso actual − reserva) / crecimiento neto diario positivo`. Es una aproximación, no fecha contractual. Para crecimiento cero o negativo informar que no se estima agotamiento con esa ventana y evaluar estacionalidad. Registrar rango, período observado, promociones, ingestiones extraordinarias, cambios de esquema y variabilidad. La fecha proyectada es útil únicamente si alguien puede actuar antes.

Ejemplo didáctico, no medición del repositorio: quedan 2000 GB decimales, se reservan 200 GB y el neto medido es 8 GB/día. Quedan aproximadamente 225 días hasta la reserva. Si el neto oscila entre 6 y 12 GB/día, el rango es 150–300 días. Sin reserva, el cálculo simple produce 250 días; explicar por qué el umbral operativo llega antes del disco lleno.

Si una nueva importación de 350 GB empieza mañana, descontarla al escenario. Si se promete borrar 3 GB diarios, conservar el escenario sin borrado hasta verificar la ejecución. Si backups comparten el volumen, añadir su expansión; si usan otro destino, proyectarlo aparte. Entregar escenarios base, adverso y planificado con acciones concretas: reducir retención permitida, optimizar índices, compactar con reserva o ampliar cuota.

## 6. Estados de capacidad y reservas

Configurar NORMAL, WARNING, CRITICAL y EMERGENCY por proyecto. Porcentajes como 70/80/90/95 son ejemplos, nunca política universal. Un archivo enorme puede agotar el espacio con uso del 60%; una base puede necesitar espacio adicional para reconstruir índices o migrar. Definir reserva por peor operación razonable y por tiempo de reposición de capacidad.

Combinar uso, forecast, latencia, errores de escritura y tiempo de aprovisionamiento. Ejemplo adaptable: WARNING si la reserva se alcanza en menos de 45 días; CRITICAL si quedan menos de 14 días o el rendimiento afecta el SLO; EMERGENCY si una escritura segura ya no puede completarse. El presupuesto o la cuota del proveedor también pueden disparar un estado aunque quede espacio físico.

Usar histéresis: entrar tras persistencia definida y salir únicamente después de recuperación sostenida con margen. No emitir cientos de alertas por oscilar alrededor de un porcentaje. Exigir mensaje con recurso, uso, fuente, tendencia, consecuencia, responsable y acción. Escalar si el forecast se acorta o la ampliación tarda más de lo disponible. Nunca resolver la alerta borrando silenciosamente datos.

## 7. Niveles, retención y suspensión de borrado

HOT atiende acceso frecuente y requisitos de latencia; WARM reduce costo con acceso razonable; COLD y ARCHIVE pueden imponer demoras y costos de recuperación. Elegir por patrones medidos. Períodos como 30 días en HOT y un año en WARM son ejemplos, no obligaciones legales. Incluir costos de solicitudes, egreso, versiones, mínimos de permanencia y recuperación al comparar proveedores.

Cada clase define finalidad, retención operativa, eventual obligación legal, ubicación, cifrado, backup, responsable y mecanismo de eliminación. El período concreto queda pendiente de revisión competente cuando dependa de normativa, contrato o investigación. El [DS 016-2024-JUS publicado por ANPD](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus) es fuente para evaluar protección de datos en Perú; no determina por sí solo una retención universal.

Un legal hold suspende el borrado de los objetos afectados, con motivo, alcance, autoridad y revisión. No convierte todo el repositorio en conservación indefinida. Las solicitudes de supresión requieren evaluar obligaciones, hold, trazabilidad y copias. Documentar cuándo desaparece un dato de producción, replicas y backups, y qué restricciones impiden restaurarlo como activo. La evidencia de eliminación no debe recrear el dato eliminado.

## 8. Local, nube e híbrido

En local evaluar acceso físico, energía, disco, antivirus, actualizaciones, robo y disponibilidad del responsable. En nube evaluar región, contrato, permisos, cuotas, costos, dependencia y salida. En híbrido identificar origen autorizado por clase, sincronización, reconciliación y conducta ante desconexión. No elegir nube por hábito ni local por asumir privacidad automática.

La sincronización necesita versiones, identificadores estables, operaciones pendientes durables y tombstones para borrados. Definir conflicto por campo o entidad: rechazo, resolución humana o merge probado. “Último escritor gana” solo procede cuando la pérdida resultante sea aceptable y documentada; no usarlo para ledger, autorizaciones o reservas críticas. Relojes locales pueden divergir, por lo que un timestamp no siempre establece orden fiable.

Probar desconexión, duplicados, modificación simultánea, eliminación offline, reconexión tardía y dispositivo perdido. Un cliente no puede recuperar permisos revocados por enviar operaciones antiguas. Cifrar tránsito y proteger material local; definir expiración de credenciales offline. Un documento sincronizado entre equipos sigue necesitando backup independiente del error replicado.

## 9. Backup, réplica y snapshot

Una réplica mejora disponibilidad, pero puede propagar corrupción o borrado. Un snapshot captura un punto, pero puede depender de la misma cuenta, disco o credencial. Un backup debe ofrecer recuperación frente a las amenazas definidas y conservar versiones suficientes. Una copia en otra carpeta del mismo disco no protege ante falla del disco.

Definir cobertura: base consistente, objetos vinculados, esquemas, configuración no secreta, manifiestos y procedimientos para recuperar secretos desde su fuente protegida. No copiar una base activa mediante un método que el motor no soporte. Verificar consistencia entre metadatos y archivos. Guardar catálogo con fecha, alcance, versión, checksum, cifrado, claves recuperables, duración y resultado.

RPO es pérdida máxima de datos aceptable; RTO es tiempo objetivo hasta recuperar el servicio necesario. Determinarlos por proceso y criticidad. Una frecuencia de backup no demuestra RPO si falla la ejecución; un restore de archivo no demuestra RTO si faltan identidad, DNS, claves y dependencias. Medir cumplimiento real y registrar pruebas fallidas.

Mantener separación de credenciales y destinos proporcional al riesgo, recuperación de claves y acceso de emergencia auditado. Retención bloqueada o almacenamiento WORM pueden reducir alteración, pero necesitan evaluación de configuración, privilegios y límites. Cifrado sin clave recuperable produce un backup inutilizable. El costo de copia y ensayo forma parte del presupuesto, no de un supuesto residual.

## 10. Ensayo de restauración aislado

Entradas obligatorias: punto de recuperación, backup elegido, manifiesto, dependencias, llaves autorizadas, destino aislado y criterios de aceptación. Antes de iniciar comprobar espacio, versión del motor, compatibilidad y acceso. El ensayo no se realiza encima de producción. Aislar notificaciones, pagos, webhooks salientes y tareas programadas para que la recuperación no repita acciones reales.

Procedimiento: verificar integridad del artefacto, restaurar con herramienta soportada, validar estructura y conteos, comprobar relaciones y muestras, iniciar aplicación con configuración de prueba, ejecutar flujos críticos y medir duración. Comparar último evento recuperable con el RPO y disponibilidad funcional con el RTO. Registrar diferencias, responsable y corrección.

Resultados: acta de ensayo, logs sanitizados, hashes, tiempos, versión restaurada, limitaciones y evidencia funcional. No conservar copias sensibles de prueba más allá del período autorizado. La aceptación exige un segundo operador capaz de seguir el runbook sin depender de memoria privada. Si falla la clave, el motor, un archivo o la aplicación, declarar fallo y no marcar backup como recuperable.

## 11. Fallos que deben tener respuesta

| Escenario | Respuesta inicial | Evidencia de salida |
|---|---|---|
| Disco lleno | Detener ingestión no esencial; preservar datos | Escritura segura y reserva restablecidas |
| Ransomware o borrado propagado | Aislar acceso y copias afectadas | Punto limpio verificado y permisos revisados |
| Backup incompleto | Mantener copia anterior; alertar | Nuevo backup íntegro y restaurado |
| Clave inaccesible | Activar custodio autorizado | Recuperación de clave auditada |
| Restore lento | Medir cuello de botella | RTO revisado o recuperación optimizada |
| Cuota cloud agotada | Confirmar límites y presupuesto | Ampliación o reducción autorizada |
| Conflicto híbrido | Cuarentena y resolución explícita | Versión elegida con motivo |
| Error de operador | Contener y recuperar sin ocultarlo | Cronología y control preventivo |

No ejecutar limpieza automática ante cualquiera de estos fallos. Un proceso de emergencia prioriza continuidad mínima, evidencia y recuperación. Ampliaciones que aumentan costo necesitan autorización dentro del presupuesto aprobado. Borrados de datos de producción no se ejecutan autónomamente por urgencia; preparar selección y consecuencias para la autoridad correspondiente.

## 12. Procedimientos Windows y entorno real

Inspeccionar sistema, rutas absolutas, usuario de servicio, disco, runtime disponible y permisos antes de elegir comandos. Usar PowerShell nativo para operaciones de archivos y `-LiteralPath` cuando corresponda. Si el runbook incluye mover o eliminar árboles, resolver y verificar que el destino esté dentro del workspace o directorio expresamente autorizado. No encadenar selección en PowerShell con borrado en otro shell.

Un lanzador documenta directorio de trabajo, argumentos, puerto, ubicación de base, logs y forma de detener. Preservar `.env`, base local y archivos del usuario al actualizar. Arranques de servicios auxiliares en segundo plano deben evitar ventanas innecesarias y generar diagnóstico verificable. No exigir Docker, Python o WSL si el entorno tiene una solución más adecuada.

El modo offline especifica qué funciona sin red, qué operaciones quedan pendientes y cómo se reanudan. Entregar exportación e importación reproducibles cuando el proyecto lo requiera, con formatos, versiones, checksum y comprobación posterior. El paquete de handoff no contiene secretos ni una copia privada inadvertida. Documentar pasos de recuperación y ubicación segura de originales.

## 13. Autonomía, aceptación y trazabilidad

A0/A1 inventarían y miden sin modificar datos. A2 prepara scripts, proyecciones y pruebas con datos sintéticos en rama. A3 exige autorización para restauración real, migración, ampliaciones costosas, exportaciones sensibles o cambios de retención. Aplicar autorizaciones previas dentro de su alcance. A4 prohíbe eliminación autónoma de producción, exposición de fuentes privadas y evidencia falsa.

Antes de cerrar exigir inventario completo o pendientes explícitos, unidades consistentes, forecast reproducible, umbrales con responsable, permisos por clase, política de retención y al menos un restore aislado cuando se prometa recuperación. Probar fallos de escritura, corrupción, pérdida de clave y sincronización si aplican. Registrar `trace_id`, recurso, actor seudonimizado, acción, resultado y referencia de autorización; nunca claves ni sesiones crudas.

El expediente conserva mediciones agregadas, manifest de backup, resultados de restore, decisiones y próxima revisión en la estructura documental existente. La fecha de prueba vence para efectos operativos cuando cambian esquema, motor, llaves o topología. No cerrar incidentes con “ya hay una copia” sin demostrar lectura y funcionamiento. Este repositorio proporciona el manual; cada proyecto debe aportar su evidencia real.

## 14. Referencias y revisión

Referencia primaria consultada el **2026-10-03**: [ANPD, DS 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-n-016-2024-jus). La aplicabilidad, finalidad, transferencias y conservación quedan pendientes de revisión competente para cada proyecto. Las cifras y umbrales de este manual son ejemplos de ingeniería y deben sustituirse por mediciones.

**Firma documental:** Pierre R. Boss · oprbguitar. Quiero expansión con presupuesto, conservación con propósito y recuperación que otro operador pueda demostrar.

---

# Parte II — Especificación 3.0.0 de almacenamiento y datos

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

La Parte I conserva los catorce contratos operativos previos. Esta Parte II los desarrolla con cláusulas STO estables, estados, invariantes, fallos, casos hipotéticos y aceptación. Ninguna cláusula declara que exista infraestructura, backup probado ni capacidad contratada en un proyecto concreto.

## 15. Decisión de activación de la capacidad de almacenamiento

STO-1501. Determina primero si el producto conserva datos propios o solo presenta contenido estático versionado en el repositorio.
STO-1502. Un sitio estático sin datos de usuarios mantiene la capacidad PRESENT y documenta por qué no necesita base de datos.
STO-1503. Activa inventario básico cuando el producto conserve archivos subidos, registros, sesiones o cualquier base de datos.
STO-1504. Activa forecast de capacidad cuando el crecimiento observado pueda agotar recursos dentro del horizonte de planificación.
STO-1505. Activa almacenamiento por niveles cuando el patrón de acceso y el costo justifiquen separar datos calientes de fríos.
STO-1506. Activa sincronización solo cuando existan réplicas editables, clientes offline o varias ubicaciones con escritura.
STO-1507. Registra cada activación con estado PRESENT, ASSESSED, PLANNED, IMPLEMENTED, VERIFIED u OPERATING y su evidencia.
STO-1508. Un estado OPERATING exige responsable, monitoreo, backup verificado por restauración y runbook ensayado.
STO-1509. La degradación de cualquiera de esos elementos baja el estado a DEGRADED aunque el almacenamiento siga respondiendo.
STO-1510. Evita introducir una plataforma de datos distribuida cuando una base relacional local cubre el requisito medido.
STO-1511. La elección de tecnología considera capacidad del receptor para operarla, no solo su rendimiento teórico.
STO-1512. Documenta la salida de cada proveedor de almacenamiento: exportación, formatos, volumen, tiempo y costo de egreso.
STO-1513. Una capacidad retirada conserva o elimina datos según retención, con evidencia de la decisión y su ejecución.
STO-1514. Los datos de prueba nunca comparten almacenamiento con datos productivos aunque el proveedor lo permita.
STO-1515. La aprobación de este manual no autoriza contratar almacenamiento ni ampliar cuotas en ningún proveedor.
STO-1516. Entrega pendientes concretos cuando falte información, separando lo que bloquea diseño de lo que bloquea producción.
STO-1517. La activación de capacidades de datos se coordina con el [Capability Profiler](CAPABILITY-PROFILER.md).
STO-1518. Un agente puede proponer activación con evidencia; la decisión corresponde al responsable del producto.
STO-1519. La matriz de capacidades de datos se publica con estado real, sin presentar capacidades planificadas como activas.
STO-1520. Quiero activar complejidad de datos solo cuando la evidencia demuestre que el producto la necesita.

## 16. Clasificación de datos y ciclo de vida

STO-1601. Cada conjunto de datos se clasifica en público, interno, confidencial o restringido según daño potencial de su exposición.
STO-1602. Los datos personales se identifican aparte de la clasificación general porque activan obligaciones específicas.
STO-1603. Los datos financieros, credenciales y documentos de identidad se tratan como restringidos por defecto.
STO-1604. La clasificación determina cifrado, acceso, retención, backup, registro y procedimiento de eliminación.
STO-1605. El ciclo de vida de cada conjunto declara creación, uso, archivo, retención, eliminación y evidencia de cada fase.
STO-1606. Un dato sin clasificación se trata como confidencial hasta que su responsable lo clasifique.
STO-1607. La clasificación se revisa cuando cambia el propósito, la fuente o el tipo de usuario que genera los datos.
STO-1608. Los datos derivados heredan la clasificación más alta de sus fuentes salvo anonimización verificada.
STO-1609. La anonimización se demuestra con análisis de reidentificación, no con eliminar solo el nombre.
STO-1610. La seudonimización conserva la clave de reversión bajo control separado y no equivale a anonimización.
STO-1611. Los metadatos, como nombres de archivo o rutas, pueden revelar información y se clasifican con su contenido.
STO-1612. Los registros técnicos con datos personales siguen la retención de datos personales, no la de logs genéricos.
STO-1613. El diccionario de datos documenta campo, tipo, clasificación, fuente, responsable y retención.
STO-1614. Los cambios de esquema actualizan el diccionario en el mismo cambio que modifica la estructura.
STO-1615. Caso hipotético: una tabla de auditoría almacena la dirección IP completa sin retención definida.
STO-1616. La revisión clasifica la IP como dato personal, define retención y aplica truncamiento tras el período de investigación.
STO-1617. La aceptación verifica que registros antiguos se truncan según la política y que la investigación reciente conserva lo necesario.
STO-1618. Un agente de IA no reclasifica datos a una categoría menos protegida sin aprobación del responsable.
STO-1619. La clasificación se refleja en las herramientas de acceso para que un usuario vea la sensibilidad de lo que consulta.
STO-1620. Quiero saber qué tan sensible es cada dato antes de decidir dónde vive y quién lo toca.

## 17. Integridad, transacciones e invariantes

STO-1701. Cada entidad declara invariantes que el almacenamiento debe preservar, como unicidad, referencias válidas y saldos coherentes.
STO-1702. Las invariantes críticas se aplican con restricciones de la base de datos, no solo con validación en la aplicación.
STO-1703. Las operaciones que modifican varias entidades relacionadas usan transacciones con aislamiento adecuado al riesgo.
STO-1704. El nivel de aislamiento elegido se documenta con las anomalías que permite y por qué son aceptables.
STO-1705. Las escrituras concurrentes sobre el mismo registro usan control optimista con versión o bloqueo explícito.
STO-1706. Una actualización basada en lectura obsoleta se rechaza con error claro en lugar de sobrescribir cambios ajenos.
STO-1707. Las operaciones idempotentes usan claves únicas para que reintentos no creen duplicados.
STO-1708. Las operaciones que cruzan almacenamiento y servicios externos usan patrones de bandeja de salida o reconciliación.
STO-1709. Un efecto externo confirmado sin registro local se reconcilia consultando la fuente externa antes de repetirlo.
STO-1710. Las sumas de verificación detectan corrupción en archivos grandes y en transferencias entre almacenes.
STO-1711. La corrupción detectada activa cuarentena del dato afectado y restauración desde un punto verificado.
STO-1712. Las eliminaciones en cascada se documentan y se prueban para evitar borrados masivos no intencionados.
STO-1713. Las claves foráneas se mantienen incluso cuando el ORM ofrece validación propia, porque protegen accesos directos.
STO-1714. Las migraciones que relajan restricciones registran la razón y el control compensatorio.
STO-1715. Caso hipotético: dos procesos reservan el mismo cupo de inventario porque leen el saldo antes de escribir.
STO-1716. La corrección usa actualización condicional sobre el saldo con restricción de no negatividad en la base.
STO-1717. La aceptación ejecuta reservas concurrentes en prueba de carga y confirma que el saldo nunca queda negativo.
STO-1718. Las pruebas de integridad se ejecutan también sobre datos restaurados para validar backups.
STO-1719. Las invariantes se documentan en el contrato de datos y se enlazan desde las pruebas que las protegen.
STO-1720. Quiero datos que sigan siendo verdaderos aunque dos usuarios hagan lo mismo al mismo tiempo.

## 18. Esquemas, migraciones y compatibilidad

STO-1801. Los cambios de esquema se versionan en migraciones ordenadas, revisadas y aplicadas por herramienta reproducible.
STO-1802. Cada migración declara efecto, duración estimada medida en datos representativos, bloqueo esperado y reversión.
STO-1803. Las migraciones destructivas se dividen en pasos compatibles: añadir, migrar, cambiar lecturas, cambiar escrituras y retirar.
STO-1804. Durante la transición, la aplicación tolera ambos esquemas para permitir despliegue y reversión sin interrupción.
STO-1805. Una migración sobre tablas grandes se ejecuta por lotes con límites de tiempo y monitoreo de carga.
STO-1806. Antes de una migración destructiva se verifica backup reciente restaurable del conjunto afectado.
STO-1807. Las migraciones se prueban sobre copia representativa anonimizada para medir duración y efectos reales.
STO-1808. Una migración fallida a mitad deja estado conocido documentado y procedimiento para completar o revertir.
STO-1809. Las migraciones no contienen datos personales ni secretos en su código fuente.
STO-1810. La reversión de una migración que perdió información se reconoce como imposible y se compensa con restauración.
STO-1811. Los consumidores de datos, como reportes o integraciones, se inventarían antes de cambiar estructuras que leen.
STO-1812. Los cambios de tipo de datos verifican conversión de valores existentes y registran los que no convierten.
STO-1813. Caso hipotético: una migración renombra una columna y un reporte externo deja de funcionar sin alerta.
STO-1814. La corrección introduce la columna nueva, mantiene la antigua durante la transición y notifica al consumidor.
STO-1815. La aceptación verifica que el reporte funciona con ambas columnas y que la antigua se retira tras confirmar migración.
STO-1816. El [manual de actualizaciones](UPDATES-RELIABILITY.md) gobierna el despliegue de migraciones dentro de releases.
STO-1817. Las migraciones generadas por agentes se revisan por un humano o revisor independiente antes de aplicarse en producción.
STO-1818. Quiero cambiar la forma de mis datos sin detener el servicio ni perder información en el camino.

## 19. Control de acceso a datos y auditoría

STO-1901. El acceso a datos se concede por rol y propósito, con permisos de lectura, escritura, exportación, restauración y eliminación separados.
STO-1902. Las cuentas de servicio de la aplicación tienen permisos mínimos y no pueden modificar esquemas en producción.
STO-1903. Las migraciones usan una identidad distinta con permisos de esquema, activada solo durante el despliegue.
STO-1904. El acceso humano directo a bases productivas requiere motivo, duración limitada y registro de consultas.
STO-1905. Las exportaciones masivas se registran con actor, filtro, volumen, destino y aprobación cuando superan umbrales.
STO-1906. Los entornos de análisis reciben datos minimizados o anonimizados, no copias completas de producción.
STO-1907. La auditoría de accesos se revisa periódicamente buscando patrones anómalos y permisos sin uso.
STO-1908. Los registros de auditoría se protegen contra modificación por quienes tienen acceso a los datos auditados.
STO-1909. La revocación de acceso de una persona se refleja en todas las identidades y credenciales asociadas.
STO-1910. Los agentes de IA acceden a datos mediante herramientas con permisos del usuario solicitante, no con cuentas amplias.
STO-1911. Una herramienta de agente que consulta datos aplica filtros de tenant y propósito en cada consulta.
STO-1912. Caso hipotético: un analista exporta la tabla completa de clientes a su equipo para un análisis puntual.
STO-1913. La política exige exportación minimizada con campos necesarios, destino aprobado y eliminación posterior registrada.
STO-1914. La aceptación verifica que la herramienta de exportación aplica límites y registra el evento con todos sus campos.
STO-1915. Las credenciales de bases se rotan y se almacenan en el gestor de secretos del entorno.
STO-1916. Las cadenas de conexión no aparecen en código, logs, errores ni documentación pública.
STO-1917. Quiero saber en todo momento quién puede tocar mis datos y quién los tocó realmente.

## 20. Cifrado y protección de datos en reposo y tránsito

STO-2001. Los datos en tránsito entre aplicación y almacenamiento usan transporte cifrado verificado en la configuración desplegada.
STO-2002. El cifrado en reposo se declara por almacén con responsable de llaves y procedimiento de rotación.
STO-2003. Los campos especialmente sensibles pueden cifrarse a nivel de aplicación cuando el riesgo lo justifica.
STO-2004. El cifrado a nivel de aplicación documenta cómo se busca, indexa y migra la información cifrada.
STO-2005. Las llaves se separan de los datos y de sus backups, con custodia y recuperación documentadas.
STO-2006. La pérdida de una llave sin respaldo equivale a pérdida de datos y se evalúa antes de activar cifrado.
STO-2007. Los backups heredan el cifrado y los controles de acceso del almacén original.
STO-2008. La eliminación criptográfica por destrucción de llave se documenta con alcance y evidencia.
STO-2009. El cifrado no sustituye control de acceso; un usuario autorizado indebidamente lee datos descifrados.
STO-2010. La configuración de cifrado se verifica tras cambios de infraestructura y renovaciones de certificados.
STO-2011. Caso hipotético: un backup se copia a un almacén sin cifrado para acelerar una restauración de prueba.
STO-2012. La revisión detecta el almacén sin cifrado, elimina la copia con evidencia y corrige el procedimiento de prueba.
STO-2013. La aceptación ejecuta la restauración de prueba con destino cifrado y confirma que el procedimiento lo exige.
STO-2014. La documentación declara qué está cifrado, con qué responsable de llaves y qué no lo está.
STO-2015. Quiero que mis datos estén protegidos incluso cuando el disco termina en manos equivocadas.

## 21. Medición de capacidad y fuentes confiables

STO-2101. La capacidad se mide con herramientas del sistema o del proveedor, registrando comando, fecha, unidad y permisos usados.
STO-2102. El tamaño lógico de los datos se distingue del tamaño físico, que incluye índices, journal, fragmentación y réplicas.
STO-2103. Las unidades decimales y binarias se declaran explícitamente para evitar errores de comparación del orden del siete por ciento.
STO-2104. Las cuotas del proveedor se consultan en su consola o API y se registran con fecha, porque pueden cambiar.
STO-2105. El número de archivos o inodos se mide junto al espacio, porque puede agotarse antes que los bytes.
STO-2106. Las métricas de rendimiento, como IOPS y throughput, se miden bajo carga representativa y no solo en reposo.
STO-2107. Las mediciones automáticas se programan con mecanismo autorizado y su ausencia se detecta como falta de evidencia.
STO-2108. Las series de medición conservan suficiente historia para distinguir tendencia de estacionalidad.
STO-2109. Un cambio de método de medición se registra para no interpretar el salto como crecimiento real.
STO-2110. Las mediciones de costo provienen de facturación verificada o de tarifas en fuente primaria con fecha.
STO-2111. Caso hipotético: el panel muestra 40 por ciento de uso del disco, pero la base falla por límite de archivos abiertos.
STO-2112. La investigación añade medición de descriptores y de inodos al inventario y define umbrales para ambos.
STO-2113. La aceptación provoca agotamiento controlado de descriptores en prueba y verifica alerta antes del fallo.
STO-2114. Las mediciones se almacenan sin datos personales; solo agregados y metadatos técnicos.
STO-2115. Un agente puede recopilar mediciones de solo lectura con nivel A0 o A1 sin modificar recursos.
STO-2116. Quiero cifras de capacidad que pueda reproducir con un comando, no estimaciones de memoria.

## 22. Forecast avanzado y escenarios

STO-2201. El forecast parte de crecimiento neto observado en una ventana declarada y excluye eventos extraordinarios identificados.
STO-2202. Los eventos planificados, como importaciones o campañas, se suman como escalones en el escenario correspondiente.
STO-2203. Las políticas de borrado solo reducen el forecast cuando su ejecución ha sido verificada en producción.
STO-2204. La compresión solo reduce el forecast con ratio medido sobre datos representativos del propio sistema.
STO-2205. Los backups y réplicas se proyectan en sus propios destinos, con su retención y frecuencia reales.
STO-2206. El escenario base usa la tendencia media, el adverso usa el percentil alto observado y el planificado añade eventos conocidos.
STO-2207. El resultado se expresa como rango de fechas con su supuesto principal, no como fecha única exacta.
STO-2208. Cada escenario incluye la acción recomendada y su plazo de ejecución, como ampliar, optimizar o reducir retención.
STO-2209. El tiempo de aprovisionamiento del proveedor o de compra de hardware se resta del margen disponible.
STO-2210. El forecast se recalcula periódicamente y cuando cambia la tendencia más allá de un umbral definido.
STO-2211. Las desviaciones entre forecast y realidad se analizan para mejorar el modelo, no para justificar el anterior.
STO-2212. Caso hipotético: el forecast base indica 200 días, pero una nueva funcionalidad duplica el volumen de adjuntos.
STO-2213. El escenario planificado incorpora el cambio y muestra 90 días, lo que activa la decisión de almacenamiento por niveles.
STO-2214. La aceptación compara el crecimiento real del mes siguiente con el escenario planificado y registra la desviación.
STO-2215. Los números de los casos son didácticos y no describen mediciones de un sistema real.
STO-2216. Quiero pronósticos que me den tiempo para decidir, con la incertidumbre a la vista.

## 23. Cuotas por usuario, tenant y función

STO-2301. Las cuotas por usuario y tenant impiden que un actor agote recursos compartidos por error o abuso.
STO-2302. Cada cuota declara unidad, límite, período, comportamiento al alcanzarla y comunicación al afectado.
STO-2303. El comportamiento al alcanzar una cuota preserva datos existentes y bloquea solo nuevas escrituras de ese ámbito.
STO-2304. Las cuotas se comunican al usuario antes de alcanzarlas, con opciones claras para liberar espacio o ampliar.
STO-2305. Las ampliaciones de cuota son acciones registradas con actor, motivo y, cuando implica costo, aprobación.
STO-2306. Las cuotas por función, como adjuntos o exportaciones, se dimensionan con uso legítimo medido.
STO-2307. El conteo de cuota es consistente bajo concurrencia para que varias cargas simultáneas no la excedan.
STO-2308. Los datos eliminados por el usuario liberan cuota según la política de retención, que se explica con claridad.
STO-2309. Las cuotas de agentes de IA que generan archivos se configuran como las de cualquier cliente automatizado.
STO-2310. Caso hipotético: un tenant sube miles de archivos pequeños y agota los inodos del volumen compartido.
STO-2311. La corrección añade cuota por número de archivos además de bytes y migra al tenant a almacenamiento de objetos.
STO-2312. La aceptación intenta superar la cuota de archivos y verifica rechazo controlado sin afectar a otros tenants.
STO-2313. La documentación de usuario describe cuotas sin revelar detalles internos de infraestructura.
STO-2314. Quiero que cada cliente tenga espacio suficiente y que ninguno pueda quitárselo a los demás.

## 24. Almacenamiento de objetos y archivos

STO-2401. Los objetos se nombran con claves generadas por el servidor que no revelan datos personales ni permiten enumeración.
STO-2402. Los buckets o contenedores son privados por defecto y el acceso público se concede objeto por objeto con justificación.
STO-2403. Las URLs firmadas tienen expiración corta, alcance de objeto y método permitido.
STO-2404. El versionado de objetos se activa cuando la recuperación ante sobrescritura o borrado lo justifica.
STO-2405. Las políticas de ciclo de vida mueven objetos entre niveles según acceso medido y retención aprobada.
STO-2406. La transición a niveles fríos considera costos y tiempos de recuperación antes de aplicarse.
STO-2407. Las cargas grandes usan subida multiparte con limpieza de partes huérfanas.
STO-2408. Los metadatos de objetos se mantienen en la base de datos con referencia consistente al objeto.
STO-2409. Una referencia sin objeto o un objeto sin referencia se detecta mediante reconciliación periódica.
STO-2410. Los objetos huérfanos se eliminan solo tras verificar que no son necesarios y según la política de retención.
STO-2411. La replicación entre regiones se evalúa por requisito de disponibilidad, costo y residencia de datos.
STO-2412. Caso hipotético: una política de ciclo de vida mueve adjuntos a archivo frío y los usuarios reportan descargas lentas y costosas.
STO-2413. La medición de accesos revela que los adjuntos se consultan durante más tiempo del supuesto.
STO-2414. La política se ajusta con el patrón medido y la aceptación verifica tiempos de descarga dentro del objetivo.
STO-2415. Quiero archivos que estén donde conviene según su uso real, no según un supuesto de diseño.

## 25. Bases de datos relacionales y rendimiento

STO-2501. Los índices se diseñan por consultas reales medidas y se revisan cuando cambian los patrones de acceso.
STO-2502. Cada índice tiene costo de escritura y espacio que se compara con su beneficio en lectura.
STO-2503. Las consultas lentas se identifican con planes de ejecución reales, no con suposiciones.
STO-2504. Las consultas parametrizadas son obligatorias; la concatenación de texto del usuario en SQL está prohibida.
STO-2505. La paginación por cursor se prefiere en colecciones grandes para evitar costos crecientes de desplazamiento.
STO-2506. Las conexiones se gestionan con pool dimensionado según capacidad medida de la base.
STO-2507. Las operaciones de mantenimiento, como vacuum o reconstrucción de índices, se planifican con reserva de espacio.
STO-2508. La reserva para reconstrucción de índices grandes se incluye en el cálculo de capacidad de emergencia.
STO-2509. Las réplicas de lectura declaran su retraso y no se usan para decisiones que requieren datos actuales.
STO-2510. El retraso de réplicas se monitorea y su exceso desvía lecturas críticas al primario.
STO-2511. Caso hipotético: un reporte nocturno bloquea tablas y las escrituras de usuarios fallan durante la madrugada.
STO-2512. La corrección traslada el reporte a una réplica con retraso aceptable y añade límite de tiempo a la consulta.
STO-2513. La aceptación ejecuta el reporte bajo carga simulada y confirma que las escrituras mantienen su latencia objetivo.
STO-2514. Quiero bases de datos rápidas por medición y correctas por diseño, sin optimizaciones a ciegas.

## 26. Sincronización, offline y resolución de conflictos

STO-2601. La sincronización se diseña con identificadores estables, versiones por registro y operaciones pendientes durables.
STO-2602. Los borrados se representan con marcas de eliminación que se propagan antes de purgarse.
STO-2603. La política de conflicto se define por tipo de dato: última escritura, fusión por campo o resolución manual.
STO-2604. Los conflictos que afectan dinero, permisos o datos legales se resuelven manualmente con registro.
STO-2605. El cliente offline conoce qué operaciones puede realizar sin conexión y cuáles quedan pendientes.
STO-2606. Las operaciones pendientes se reintentan con idempotencia para no duplicar efectos al reconectar.
STO-2607. Un dispositivo perdido puede revocarse y sus operaciones pendientes se tratan según política.
STO-2608. Los relojes de dispositivos no se usan como única fuente de orden; se usan versiones o relojes lógicos.
STO-2609. Las pruebas cubren desconexión, edición simultánea, borrado offline, reconexión tardía y duplicados.
STO-2610. Caso hipotético: dos técnicos editan la misma orden de trabajo offline y ambos cambian el estado.
STO-2611. La política de conflicto por campo detecta la colisión en el estado y la presenta al supervisor para resolver.
STO-2612. La aceptación reproduce el escenario y verifica que ninguna edición se pierde silenciosamente.
STO-2613. Quiero que mis usuarios trabajen sin conexión sin que la reconexión destruya el trabajo de nadie.

## 27. Retención, eliminación y derechos de los titulares

STO-2701. Cada clase de datos tiene retención con fundamento: propósito operativo, obligación aplicable o decisión del responsable.
STO-2702. La eliminación se ejecuta por procesos verificables que registran alcance, cantidad y resultado.
STO-2703. La eliminación cubre copias derivadas, índices de búsqueda, cachés y réplicas según su propia mecánica.
STO-2704. Los backups conservan datos eliminados hasta su expiración, y esa limitación se explica al titular con honestidad.
STO-2705. Una restauración desde backup reaplica eliminaciones registradas posteriores al punto restaurado.
STO-2706. Las solicitudes de titulares se atienden con verificación de identidad, alcance definido y respuesta registrada.
STO-2707. La exportación de datos de un titular usa formato comprensible y excluye datos de terceros.
STO-2708. La conservación por obligación legal suspende la eliminación de los datos afectados con motivo y revisión.
STO-2709. La suspensión de borrado no se extiende a datos no relacionados con su motivo.
STO-2710. Caso hipotético: un titular solicita eliminación y semanas después una restauración reintroduce sus datos.
STO-2711. El registro de eliminaciones permite reaplicar el borrado tras la restauración y la prueba lo verifica.
STO-2712. La aceptación restaura un backup anterior a una eliminación de prueba y confirma que el dato no reaparece.
STO-2713. La documentación de privacidad describe retención y eliminación tal como ocurren realmente.
STO-2714. Quiero poder demostrar que olvidé lo que prometí olvidar.

## 28. Backups: diseño, frecuencia y verificación

STO-2801. La frecuencia de backup se deriva del RPO acordado por proceso y no de un valor por defecto.
STO-2802. Los backups de bases usan herramientas que garantizan consistencia, no copias de archivos en caliente.
STO-2803. Los objetos y la base se respaldan de forma coordinada para que sus referencias sean restaurables juntas.
STO-2804. Cada backup genera manifiesto con contenido, hash, tamaño, duración, versión y resultado.
STO-2805. Un backup fallido o incompleto alerta al responsable y no reemplaza al último backup válido.
STO-2806. Los backups se almacenan en destino separado con credenciales distintas de las del sistema productivo.
STO-2807. Al menos una copia es resistente a borrado o cifrado por un atacante con acceso al sistema productivo.
STO-2808. La retención de backups equilibra necesidad de recuperación, costo y retención máxima de datos personales.
STO-2809. Un backup que nunca se restauró no se considera verificado.
STO-2810. La verificación incluye restauración periódica en entorno aislado con validación funcional.
STO-2811. Los secretos necesarios para restaurar se recuperan por procedimiento propio, no se incluyen en el backup.
STO-2812. Caso hipotético: los backups diarios terminan con éxito durante meses, pero la restauración falla por versión incompatible.
STO-2813. El ensayo trimestral detecta el problema y el procedimiento añade versión de herramienta al manifiesto.
STO-2814. La aceptación restaura con la versión registrada y verifica integridad y conteos.
STO-2815. Quiero backups que funcionen el día que los necesite, demostrado antes de ese día.

## 29. Restauración: procedimiento y aceptación

STO-2901. La restauración comienza eligiendo el punto adecuado según el incidente: anterior a la corrupción, no solo el más reciente.
STO-2902. El destino de restauración es aislado hasta validar, para no sobrescribir datos que todavía pueden ser útiles.
STO-2903. La validación compara estructura, conteos, sumas de verificación, relaciones y muestras funcionales.
STO-2904. La promoción de datos restaurados a producción es una acción autorizada con plan de reversión.
STO-2905. Los datos creados entre el punto restaurado y el incidente se evalúan para recuperación o reingreso.
STO-2906. La restauración registra tiempos de cada fase para comparar con el RTO acordado.
STO-2907. Un RTO no cumplido en ensayo genera mejora del procedimiento o revisión del objetivo con el responsable.
STO-2908. La restauración parcial de un tenant o conjunto se diseña cuando el modelo de datos lo permite.
STO-2909. El acta de restauración conserva evidencia sin copias de datos sensibles innecesarias.
STO-2910. Caso hipotético: un error de operador borra registros de un tenant y la restauración completa afectaría a todos.
STO-2911. El procedimiento restaura en entorno aislado, extrae los registros del tenant y los reintegra con validación.
STO-2912. La aceptación verifica que el tenant recupera sus datos y que los demás tenants no sufren cambios.
STO-2913. Quiero restauraciones precisas que reparen el daño sin causar uno nuevo.

## 30. Ransomware, borrado malicioso y recuperación segura

STO-3001. El diseño asume que un atacante puede obtener credenciales productivas y busca destruir también los backups.
STO-3002. Las copias inmutables o desconectadas tienen credenciales y administración separadas del sistema productivo.
STO-3003. Ante cifrado o borrado masivo, se aíslan accesos comprometidos antes de iniciar restauración.
STO-3004. El punto de restauración se elige tras determinar cuándo comenzó el compromiso, no solo cuándo se detectó.
STO-3005. Los sistemas restaurados se reconstruyen desde fuentes confiables antes de reconectarlos a los datos.
STO-3006. Las credenciales se rotan antes de restaurar para que el atacante no recupere acceso.
STO-3007. La recuperación conserva evidencia forense necesaria para la investigación.
STO-3008. Caso hipotético: un atacante borra el bucket productivo y sus versiones usando una clave de administración filtrada.
STO-3009. La copia inmutable en otra cuenta permanece intacta y la restauración procede tras rotar todas las claves.
STO-3010. La aceptación ensaya la restauración desde la copia inmutable y mide el tiempo frente al RTO.
STO-3011. El [manual de respuesta a incidentes](INCIDENT-RESPONSE.md) coordina la contención y comunicación del evento.
STO-3012. Quiero que el peor día de mi sistema termine con datos recuperados y no con un rescate pagado.

## 31. Entornos de desarrollo, pruebas y análisis

STO-3101. Los entornos de desarrollo usan datos sintéticos generados por scripts versionados en el repositorio.
STO-3102. Las copias de producción para pruebas se anonimizan con procedimiento verificado antes de salir del entorno productivo.
STO-3103. Los entornos de análisis reciben conjuntos minimizados con propósito declarado y retención propia.
STO-3104. Las bases locales de desarrollo no se sincronizan con producción ni comparten credenciales.
STO-3105. Los archivos de base local y de entorno se excluyen del control de versiones.
STO-3106. Los agentes de IA trabajan con datos sintéticos salvo autorización explícita para datos reales.
STO-3107. Caso hipotético: un desarrollador copia la base productiva a su portátil para depurar un error.
STO-3108. La política exige reproducir con datos sintéticos o anonimizados y el incidente se registra para revisar accesos.
STO-3109. La aceptación verifica que el script de anonimización elimina campos personales antes de cualquier copia.
STO-3110. Quiero depurar problemas reales sin exponer datos reales de mis usuarios.

## 32. Procedimientos concretos en Windows

STO-3201. Mide espacio en Windows con cmdlets nativos de PowerShell y registra la unidad y el formato devuelto.
STO-3202. Usa rutas absolutas con comillas cuando contienen espacios, comunes en carpetas de usuario.
STO-3203. Los servicios locales que almacenan datos se ejecutan con cuenta dedicada y permisos limitados a su carpeta.
STO-3204. Las tareas programadas de backup en Windows se documentan con disparador, cuenta, destino y verificación.
STO-3205. Las exclusiones de antivirus para carpetas de bases locales se limitan y documentan.
STO-3206. El historial de archivos o instantáneas del sistema no se considera backup del proyecto sin prueba de restauración.
STO-3207. Las rutas largas y caracteres especiales se prueban porque pueden fallar en herramientas antiguas.
STO-3208. Caso hipotético: un script de backup falla silenciosamente por una ruta con espacios sin comillas.
STO-3209. La corrección entrecomilla rutas, añade verificación de código de salida y alerta ante fallo.
STO-3210. La aceptación ejecuta el script con una ruta con espacios y confirma backup válido o alerta.
STO-3211. Quiero procedimientos que funcionen en mi equipo real y no solo en el ejemplo de un tutorial.

## 33. Costo de almacenamiento y optimización

STO-3301. El costo de almacenamiento incluye espacio, operaciones, transferencia, recuperación desde niveles fríos y backups.
STO-3302. Las tarifas se verifican en fuente primaria con fecha y región antes de calcular presupuestos.
STO-3303. Los costos de egreso se estiman antes de elegir proveedor porque condicionan la salida futura.
STO-3304. Las optimizaciones se priorizan por peso en el costo total medido.
STO-3305. La compresión, deduplicación y niveles se evalúan con pruebas sobre datos reales anonimizados.
STO-3306. Las alertas de costo tienen umbral, receptor y acción definidos.
STO-3307. Caso hipotético: el costo mensual se triplica por recuperaciones frecuentes desde un nivel de archivo.
STO-3308. El análisis muestra que un proceso de reportes lee datos archivados cada noche.
STO-3309. La corrección mantiene esos datos en nivel templado y la aceptación verifica costo dentro del presupuesto.
STO-3310. Quiero pagar por almacenamiento lo que vale su uso, sin sorpresas en la factura.

## 34. Observabilidad de datos y calidad

STO-3401. Las métricas de datos incluyen volumen, crecimiento, errores de escritura, latencia, retraso de réplicas y frescura.
STO-3402. Las reglas de calidad detectan nulos inesperados, duplicados, valores fuera de rango y referencias rotas.
STO-3403. Las violaciones de calidad tienen responsable, severidad y acción definida.
STO-3404. La frescura de datos derivados se mide para no tomar decisiones con información desactualizada.
STO-3405. La ausencia de métricas se trata como fallo de observabilidad.
STO-3406. Caso hipotético: un proceso de importación inserta duplicados durante semanas sin alertas.
STO-3407. La regla de unicidad sobre la clave natural detecta duplicados y la corrección añade restricción en la base.
STO-3408. La aceptación reimporta el lote de prueba y verifica rechazo de duplicados con registro.
STO-3409. Quiero detectar datos incorrectos antes de que alguien tome una decisión basada en ellos.

## 35. Agentes de IA y datos

STO-3501. Un agente de IA accede a datos solo mediante herramientas con permisos, filtros y registros definidos.
STO-3502. Los datos enviados a modelos remotos se minimizan y su destino se aprueba por caso de uso.
STO-3503. Los agentes no ejecutan eliminaciones, restauraciones ni migraciones productivas sin autorización humana específica.
STO-3504. Los agentes pueden preparar scripts, forecasts y planes con datos sintéticos en nivel A2.
STO-3505. Los resultados de análisis generados por IA citan consultas reproducibles.
STO-3506. Los datos de usuarios no se usan para entrenar ni evaluar modelos sin base aplicable y aprobación.
STO-3507. Caso hipotético: un agente propone limpiar registros antiguos para liberar espacio en una alerta crítica.
STO-3508. El agente prepara el plan con alcance, retención aplicable y respaldo, y espera aprobación sin ejecutar el borrado.
STO-3509. La aceptación verifica que ningún dato se eliminó antes de la aprobación registrada.
STO-3510. Quiero agentes que me ayuden a gestionar datos sin convertirse en una forma rápida de perderlos.

## 36. Casos hipotéticos integrados

STO-3601. Caso A: un portal de documentos crece por adjuntos y el forecast adverso indica agotamiento en 60 días.
STO-3602. En el caso A, el responsable aprueba almacenamiento de objetos para adjuntos nuevos y migración gradual de antiguos.
STO-3603. La migración por lotes verifica hash de cada objeto y actualiza referencias en la base con reconciliación final.
STO-3604. La aceptación del caso A confirma cero referencias rotas y espacio liberado medido en el volumen original.
STO-3605. Caso B: una aplicación móvil con modo offline pierde ediciones al reconectar tras cambios de esquema.
STO-3606. En el caso B, la corrección versiona las operaciones pendientes y el servidor acepta ambas versiones durante la transición.
STO-3607. La aceptación del caso B reproduce reconexión con cliente antiguo y confirma que las ediciones se aplican.
STO-3608. Caso C: un error de despliegue corrompe un campo de precios en miles de registros.
STO-3609. En el caso C, la restauración aislada recupera los valores, se comparan con los actuales y se corrigen solo los afectados.
STO-3610. La aceptación del caso C verifica que los precios cambiados legítimamente después del error se conservan.
STO-3611. Los casos son ejercicios de diseño y no describen incidentes reales.

## 37. Puerta de cierre de almacenamiento y datos

STO-3701. Cierra cada entrega con inventario, clasificación, forecast, cuotas, backups, restauración ensayada y estado por capacidad.
STO-3702. Adjunta el último ensayo de restauración con fecha, punto restaurado, tiempos, validaciones y limitaciones.
STO-3703. Declara RPO y RTO acordados por proceso y si el último ensayo los cumplió.
STO-3704. Documenta credenciales y llaves por almacén con custodio y rotación, sin valores.
STO-3705. Lista excepciones vigentes con vencimiento y compensación.
STO-3706. El receptor ejecuta una medición de capacidad y un ensayo de restauración siguiendo solo la documentación.
STO-3707. Las dudas del receptor se corrigen en la documentación antes de aceptar la transferencia.
STO-3708. La entrega no promete almacenamiento ilimitado ni recuperación no ensayada.
STO-3709. Pierre R. Boss (oprbguitar) mantiene la dirección de este estándar; cada proyecto aporta la evidencia de sus datos.
STO-3710. Mi criterio final exige datos clasificados, capacidad medida, backups restaurados y eliminación demostrable.

## 38. Cachés y datos efímeros

STO-3801. Una caché es una copia derivada que puede perderse sin pérdida de información; si no puede perderse, no es caché.
STO-3802. Cada caché declara fuente de verdad, clave, expiración, política de invalidación y comportamiento ante fallo.
STO-3803. Las claves de caché incluyen tenant, usuario o contexto de autorización cuando el contenido depende de ellos.
STO-3804. La invalidación se dispara por eventos de escritura en la fuente, no solo por expiración temporal.
STO-3805. Un fallo de la caché degrada rendimiento pero no correctitud; la aplicación consulta la fuente cuando la caché no responde.
STO-3806. La caché no almacena secretos ni datos restringidos sin cifrado y control de acceso equivalentes a la fuente.
STO-3807. El tamaño máximo de la caché y su política de expulsión se dimensionan con medición de acierto.
STO-3808. Las estampidas de recálculo tras expiración simultánea se mitigan con expiraciones escalonadas o bloqueo de recálculo.
STO-3809. Los datos temporales se escriben en ubicaciones con limpieza definida y no en directorios compartidos sin control.
STO-3810. Los archivos temporales con datos sensibles se eliminan al terminar el proceso que los creó, incluso ante error.
STO-3811. Caso hipotético: una caché de perfiles usa como clave solo el identificador de perfil y muestra datos de otro tenant.
STO-3812. La corrección incluye el tenant en la clave, invalida la caché completa y añade prueba de aislamiento.
STO-3813. La aceptación consulta el mismo identificador desde dos tenants y verifica respuestas independientes.
STO-3814. Las métricas de caché incluyen tasa de acierto, latencia y expulsiones, con alertas solo cuando afectan objetivos.
STO-3815. La caché se excluye de backups salvo que su reconstrucción tarde más que el RTO acordado.
STO-3816. Las cachés de respuestas de IA siguen las mismas reglas de clave, aislamiento y expiración.
STO-3817. Una caché sin propietario ni política documentada se trata como deuda y se revisa antes de ampliarla.
STO-3818. La documentación indica qué datos pueden estar desactualizados y por cuánto tiempo.
STO-3819. Los usuarios no toman decisiones irreversibles con datos de caché sin verificación contra la fuente.
STO-3820. Quiero cachés que aceleren sin mentir y que nunca mezclen lo que pertenece a distintos clientes.

## 39. Índices de búsqueda y almacenes derivados

STO-3901. Un índice de búsqueda es derivado y debe poder reconstruirse desde la fuente de verdad con procedimiento documentado.
STO-3902. El tiempo de reconstrucción completa se mide y se compara con el RTO del servicio de búsqueda.
STO-3903. Los documentos indexados respetan permisos; la búsqueda filtra resultados por autorización del usuario.
STO-3904. Los campos sensibles no se indexan salvo necesidad, y cuando se indexan heredan controles de la fuente.
STO-3905. Las eliminaciones en la fuente se propagan al índice con plazo definido y verificación periódica.
STO-3906. La divergencia entre índice y fuente se mide con muestreo y reconciliación programada.
STO-3907. Los cambios de esquema del índice usan índices paralelos y cambio de alias para evitar interrupciones.
STO-3908. Los almacenes vectoriales para retrieval registran modelo de embedding, versión y fecha de generación.
STO-3909. Un cambio de modelo de embedding requiere reindexación completa porque los vectores no son compatibles.
STO-3910. Los vectores de documentos sensibles se tratan como datos sensibles porque pueden revelar contenido.
STO-3911. Caso hipotético: un usuario elimina un documento, pero sigue apareciendo en resultados de búsqueda durante semanas.
STO-3912. La investigación encuentra que la propagación de borrados fallaba silenciosamente desde una actualización.
STO-3913. La corrección añade reintentos, alerta ante fallo y reconciliación diaria que elimina documentos huérfanos del índice.
STO-3914. La aceptación elimina un documento de prueba y verifica su desaparición del índice dentro del plazo.
STO-3915. Los informes analíticos derivados declaran su fecha de corte y fuente para evitar interpretaciones erróneas.
STO-3916. Quiero que todo almacén derivado pueda reconstruirse y que ninguno conserve lo que la fuente ya olvidó.

## 40. Colas, eventos y durabilidad de mensajes

STO-4001. Las colas que transportan operaciones de negocio declaran garantía de entrega, orden, retención y manejo de fallos.
STO-4002. Los consumidores son idempotentes porque la entrega al menos una vez puede repetir mensajes.
STO-4003. Los mensajes que fallan repetidamente se mueven a una cola de errores con alerta y procedimiento de revisión.
STO-4004. La cola de errores no se vacía sin analizar causa y decidir reprocesar o descartar con registro.
STO-4005. Los mensajes no contienen secretos ni datos sensibles innecesarios; usan referencias a datos protegidos.
STO-4006. La retención de mensajes se dimensiona para cubrir interrupciones del consumidor más largas que el objetivo de recuperación.
STO-4007. La profundidad y antigüedad de las colas se monitorean con umbrales que permitan actuar antes de perder mensajes.
STO-4008. Los esquemas de mensajes se versionan y los consumidores toleran versiones anteriores durante transiciones.
STO-4009. El patrón de bandeja de salida garantiza que un evento se publique si y solo si la transacción local se confirmó.
STO-4010. Caso hipotético: un consumidor se detiene durante un fin de semana y la cola expira mensajes de pedidos.
STO-4011. La alerta de antigüedad no tenía receptor en fines de semana y la retención era menor que la interrupción.
STO-4012. La corrección amplía retención, asigna receptor efectivo y añade reconciliación de pedidos contra la fuente.
STO-4013. La aceptación detiene el consumidor en prueba durante un período mayor y verifica que no se pierden mensajes.
STO-4014. Los eventos usados como registro histórico se tratan como almacenamiento con backup y retención propios.
STO-4015. Quiero mensajes que lleguen aunque el destino esté caído un rato, y fallos que alguien vea a tiempo.

## 41. Logs, trazas y almacenamiento de telemetría

STO-4101. Los logs se almacenan con retención por clase: depuración breve, operación moderada y seguridad según investigación.
STO-4102. El volumen de logs se mide y se proyecta como cualquier otro dato, porque puede dominar el consumo de disco.
STO-4103. La rotación de logs tiene tamaño máximo y número de archivos para que no agoten el volumen del servicio.
STO-4104. Los logs se escriben en volúmenes separados de los datos cuando su crecimiento podría afectar escrituras críticas.
STO-4105. Los logs no contienen contraseñas, tokens, datos de tarjeta ni documentos completos.
STO-4106. Los logs con datos personales siguen retención y acceso de datos personales.
STO-4107. La telemetría enviada a proveedores externos se minimiza y se evalúa como transferencia de datos.
STO-4108. La alta cardinalidad de etiquetas se controla para no multiplicar costo y memoria.
STO-4109. Caso hipotético: un modo de depuración activado en producción llena el disco en horas y la base deja de escribir.
STO-4110. La corrección separa volúmenes, limita tamaño de logs y alerta cuando el nivel de depuración permanece activo.
STO-4111. La aceptación activa depuración en prueba y verifica que la rotación protege el volumen de datos.
STO-4112. Los logs necesarios para un incidente se preservan con suspensión de rotación del alcance afectado.
STO-4113. Quiero logs que me ayuden a investigar sin convertirse en el próximo incidente de capacidad.

## 42. Residencia de datos y ubicación geográfica

STO-4201. La ubicación de cada almacén y backup se registra por región y proveedor.
STO-4202. Los requisitos de residencia se derivan de obligaciones aplicables, contratos y compromisos con clientes, con revisión competente.
STO-4203. Las réplicas y backups entre regiones se evalúan contra los requisitos de residencia antes de activarse.
STO-4204. Los proveedores de soporte que pueden acceder a datos se incluyen en el análisis de ubicación.
STO-4205. Un cambio de región se planifica como migración con equivalencia, reversión y comunicación cuando corresponde.
STO-4206. Las promesas de residencia en documentos comerciales coinciden con la configuración verificada.
STO-4207. Caso hipotético: un cliente exige que sus datos permanezcan en una región, pero los backups se replican a otra.
STO-4208. La revisión detecta la discrepancia y el responsable decide configurar backups regionales para ese tenant o renegociar.
STO-4209. La aceptación verifica la ubicación efectiva de cada copia del tenant tras el cambio.
STO-4210. Quiero saber dónde están físicamente mis datos y poder demostrarlo a quien lo pregunte.

## 43. Hardware local, discos y NAS

STO-4301. Los discos locales se monitorean con indicadores de salud disponibles y se reemplazan antes de fallar cuando las señales lo indican.
STO-4302. RAID mejora disponibilidad ante falla de disco, pero no protege contra borrado, corrupción ni ransomware; no es backup.
STO-4303. Un NAS se trata como almacén con firmware actualizado, acceso controlado, cifrado y backup externo.
STO-4304. La energía estable y el apagado ordenado protegen la integridad de bases locales ante cortes.
STO-4305. Los discos retirados se borran de forma segura o se destruyen con registro antes de desecharlos.
STO-4306. El equipo local con datos del proyecto tiene cifrado de disco y bloqueo de sesión.
STO-4307. Caso hipotético: un NAS doméstico con RAID guarda la única copia de documentos de clientes y sufre ransomware.
STO-4308. El RAID replica el cifrado del atacante y no existe copia externa; la pérdida es total.
STO-4309. La política corrige añadiendo copia externa inmutable y ensayo de restauración trimestral.
STO-4310. La aceptación restaura un conjunto de prueba desde la copia externa en otro equipo.
STO-4311. Quiero que un disco que muere sea un trámite y no una catástrofe.

## 44. Formatos de archivo y conservación a largo plazo

STO-4401. Los datos de conservación prolongada se almacenan en formatos abiertos, documentados y legibles sin software propietario.
STO-4402. Las exportaciones incluyen esquema, codificación, separadores y zona horaria para que sean interpretables años después.
STO-4403. La integridad de archivos conservados se verifica periódicamente con sumas de verificación registradas.
STO-4404. Una suma que no coincide activa restauración desde otra copia y análisis de causa.
STO-4405. Los archivos CSV exportados escapan contenido que empieza con caracteres de fórmula para evitar inyección en hojas de cálculo.
STO-4406. Las fechas se almacenan en formato estándar con zona horaria explícita, preferentemente UTC con conversión al mostrar.
STO-4407. Los montos se almacenan en unidades exactas con moneda, nunca en coma flotante binaria.
STO-4408. Caso hipotético: una exportación contable en CSV abre fórmulas maliciosas en la hoja de cálculo del contador.
STO-4409. La corrección escapa campos de texto y la aceptación exporta un registro con signo igual inicial y verifica que se muestra como texto.
STO-4410. Quiero que mis datos se puedan leer y confiar dentro de diez años, con o sin la aplicación que los creó.

## 45. Importación de datos externos

STO-4501. Los datos importados se validan contra esquema, tipos, rangos y referencias antes de integrarse.
STO-4502. Las importaciones se ejecutan en área de preparación aislada antes de afectar datos productivos.
STO-4503. Los registros rechazados se reportan con motivo para corrección, sin descartarse silenciosamente.
STO-4504. Las importaciones son idempotentes por lote para que un reintento no duplique registros.
STO-4505. El contenido importado se trata como no confiable: puede contener HTML, fórmulas o instrucciones dirigidas a agentes.
STO-4506. La procedencia de cada lote se registra con fuente, fecha, responsable y hash del archivo original.
STO-4507. Las importaciones grandes se dimensionan en el forecast como escalones planificados.
STO-4508. Caso hipotético: un archivo de proveedor cambia el orden de columnas y la importación asigna precios a cantidades.
STO-4509. La validación por encabezados y rangos detecta el cambio y rechaza el lote antes de afectar producción.
STO-4510. La aceptación importa un archivo con columnas reordenadas y verifica rechazo con reporte claro.
STO-4511. Quiero importar datos ajenos sin permitir que errores ajenos corrompan los míos.

## 46. Aislamiento multi-tenant en almacenamiento

STO-4601. El modelo de aislamiento se declara: base por tenant, esquema por tenant o tablas compartidas con columna de tenant.
STO-4602. Cada modelo documenta costos, límites de escala, complejidad operativa y garantías de aislamiento.
STO-4603. Con tablas compartidas, el filtro de tenant se aplica en la capa de acceso y se refuerza con seguridad a nivel de fila cuando la base lo permite.
STO-4604. Los índices incluyen la columna de tenant para que las consultas filtradas sean eficientes.
STO-4605. Los backups permiten restaurar un tenant sin afectar a otros, o la limitación se declara explícitamente.
STO-4606. La exportación y eliminación por tenant se prueban con datos de varios tenants.
STO-4607. Los objetos de almacenamiento se organizan con prefijo de tenant y políticas que impiden acceso cruzado.
STO-4608. Las métricas de uso por tenant permiten detectar consumo anómalo y aplicar cuotas.
STO-4609. Caso hipotético: una consulta de reportes omite el filtro de tenant y agrega datos de todos los clientes.
STO-4610. La seguridad a nivel de fila bloquea filas ajenas aunque la consulta omita el filtro, y la prueba lo demuestra.
STO-4611. La aceptación ejecuta la consulta defectuosa con identidad de un tenant y verifica que solo devuelve sus filas.
STO-4612. Quiero que el aislamiento entre clientes no dependa de que nadie olvide nunca un filtro.

## 47. Particionado y crecimiento horizontal

STO-4701. El particionado se adopta cuando la medición demuestra que una tabla o almacén excede límites de rendimiento o mantenimiento.
STO-4702. La clave de partición se elige por patrón de acceso dominante y distribución de datos medida.
STO-4703. Una clave que concentra carga en pocas particiones se corrige antes de crecer más.
STO-4704. Las consultas que cruzan particiones se identifican y se optimizan o se aceptan con su costo documentado.
STO-4705. El particionado por tiempo facilita retención eliminando particiones completas antiguas.
STO-4706. La eliminación de particiones sigue la política de retención y registra alcance y verificación.
STO-4707. El rebalanceo de particiones se planifica como migración con monitoreo y reversión.
STO-4708. Caso hipotético: una tabla de eventos crece sin límite y las consultas de los últimos días se vuelven lentas.
STO-4709. El particionado mensual permite consultar solo particiones recientes y eliminar las antiguas según retención.
STO-4710. La aceptación mide latencia antes y después con la misma carga y verifica la eliminación de particiones expiradas.
STO-4711. Quiero crecer dividiendo los datos cuando la medición lo pide, no antes por moda ni después por emergencia.

## 48. Runbook de disco lleno o cuota agotada

STO-4801. Confirma el síntoma con medición directa: espacio, inodos, cuota del proveedor o límite de tabla.
STO-4802. Identifica qué está creciendo con comandos de uso por directorio, tabla o prefijo.
STO-4803. Detén ingestiones no esenciales para preservar escrituras críticas, con registro de la acción.
STO-4804. No elimines datos de usuarios para liberar espacio sin aplicar retención y autorización.
STO-4805. Libera espacio con acciones seguras: rotar logs, eliminar temporales verificados o mover backups locales a su destino.
STO-4806. Si se requiere ampliación con costo, prepara la propuesta y solicita autorización al responsable.
STO-4807. Verifica que las escrituras críticas funcionan y que la reserva operativa se restableció.
STO-4808. Registra cronología, causa, acciones y control preventivo en el expediente del incidente.
STO-4809. Actualiza el forecast con la causa identificada para evitar repetir la emergencia.
STO-4810. Caso hipotético: el volumen de una base alcanza el límite durante la noche por logs de depuración.
STO-4811. El operador rota logs, desactiva depuración, verifica escrituras y registra el evento.
STO-4812. El postmortem añade separación de volúmenes y alerta por nivel de depuración activo.
STO-4813. La aceptación del runbook se demuestra ejecutándolo en un entorno de prueba con disco limitado.
STO-4814. Quiero que un disco lleno se resuelva siguiendo pasos claros y sin borrar nada que no debía borrarse.

## 49. Mensajes de alerta y comunicación de capacidad

STO-4901. Cada alerta de capacidad indica recurso, métrica, valor actual, umbral, tendencia, consecuencia esperada y acción.
STO-4902. La alerta enlaza el runbook correspondiente y el panel con historia reciente.
STO-4903. El receptor de la alerta está definido por horario y escalamiento si no responde.
STO-4904. Las alertas usan histéresis para no oscilar entre estados con pequeñas variaciones.
STO-4905. Las alertas resueltas registran causa y acción para alimentar el análisis de tendencias.
STO-4906. La comunicación a usuarios sobre límites de almacenamiento es clara, previa y con opciones.
STO-4907. Caso hipotético: una alerta dice solo disco al noventa por ciento sin indicar servidor ni tendencia.
STO-4908. El operador pierde tiempo identificando el recurso y la mejora añade contexto completo y enlace al runbook.
STO-4909. La aceptación genera una alerta de prueba y verifica que contiene todos los campos definidos.
STO-4910. Quiero alertas que me digan qué pasa, qué pasará y qué hacer, en una sola lectura.

## 50. Linaje y procedencia de datos

STO-5001. El linaje registra de qué fuentes proviene cada conjunto derivado y qué transformaciones lo produjeron.
STO-5002. Las transformaciones se versionan como código para reproducir un conjunto derivado en una fecha dada.
STO-5003. Un error en una fuente permite identificar todos los derivados afectados mediante el linaje.
STO-5004. Los reportes publicados indican fuente, fecha de corte y versión de transformación.
STO-5005. El linaje no requiere herramientas complejas al inicio; una tabla documentada puede bastar para sistemas pequeños.
STO-5006. Caso hipotético: un error de conversión de moneda afecta un reporte mensual y otros tres dependen de él.
STO-5007. El linaje identifica los cuatro reportes, se recalculan con la transformación corregida y se comunica la corrección.
STO-5008. La aceptación verifica que los reportes corregidos citan la nueva versión de transformación.
STO-5009. Quiero poder responder de dónde salió cada número que muestro.

## 51. Salida de proveedor y portabilidad de datos

STO-5101. Cada proveedor de almacenamiento tiene plan de salida con formato de exportación, volumen, duración y costo de egreso medidos o estimados.
STO-5102. La exportación se prueba periódicamente con un subconjunto para confirmar que el formato es utilizable.
STO-5103. Las funciones propietarias usadas se inventarían con su equivalente en alternativas.
STO-5104. La migración entre proveedores sigue el [manual de migración](MIGRATION-HANDOFF.md) con equivalencia y reversión.
STO-5105. Los contratos se revisan por cláusulas de retención posterior a la terminación y eliminación certificada.
STO-5106. Caso hipotético: un proveedor anuncia cambio de precios que triplica el costo y el equipo nunca probó exportar.
STO-5107. La exportación de prueba revela formatos propietarios para metadatos que requieren transformación.
STO-5108. La migración se planifica con tiempo suficiente gracias a la prueba temprana y el costo de egreso se presupuesta.
STO-5109. Quiero poder irme de cualquier proveedor cuando lo decida, sabiendo cuánto cuesta y cuánto tarda.

## 52. Descubrimiento de datos sensibles no inventariados

STO-5201. Los almacenes se escanean periódicamente buscando datos sensibles fuera de las ubicaciones inventariadas.
STO-5202. Los hallazgos se clasifican, se trasladan a ubicaciones controladas o se eliminan según retención.
STO-5203. Los escaneos usan patrones verificados y muestreo, con revisión humana de falsos positivos.
STO-5204. Los resultados de escaneo se protegen porque señalan dónde hay datos sensibles.
STO-5205. Caso hipotético: un escaneo encuentra documentos de identidad en una carpeta de exportaciones antiguas.
STO-5206. Los archivos se eliminan según retención, se revisan accesos al directorio y se corrige el proceso que los dejó.
STO-5207. La aceptación repite el escaneo y confirma ausencia de los hallazgos.
STO-5208. Quiero encontrar los datos sensibles olvidados antes de que los encuentre otra persona.

## 53. Documentación de datos para el receptor

STO-5301. El paquete de datos para el receptor incluye inventario, diccionario, clasificación, linaje, retención y responsables.
STO-5302. Incluye procedimientos de backup, restauración, medición de capacidad y respuesta a disco lleno con comandos verificados.
STO-5303. Incluye credenciales necesarias por referencia al gestor, sin valores, y procedimiento de obtención para el receptor.
STO-5304. Incluye último ensayo de restauración y forecast vigente con supuestos.
STO-5305. El receptor ejecuta una restauración y una medición siguiendo solo el paquete.
STO-5306. Las dudas del receptor se corrigen en el paquete antes de aceptar la transferencia.
STO-5307. Quiero que quien reciba mis datos los pueda cuidar igual o mejor que yo.

## 54. Máquina de estados de capacidad

STO-5401. Los estados NORMAL, WARNING, CRITICAL y EMERGENCY se definen por proyecto con condiciones medibles y no por porcentajes universales.
STO-5402. NORMAL indica margen suficiente para el horizonte de planificación con reserva intacta.
STO-5403. WARNING indica que la reserva se alcanzará antes del horizonte de acción y activa planificación.
STO-5404. CRITICAL indica que la reserva se alcanzará antes del tiempo de aprovisionamiento o que el rendimiento afecta objetivos.
STO-5405. EMERGENCY indica que una escritura segura ya no puede completarse o que la pérdida de datos es inminente.
STO-5406. Cada transición registra métrica, valor, tendencia, momento y responsable notificado.
STO-5407. La salida de un estado exige recuperación sostenida durante un período definido para evitar oscilaciones.
STO-5408. En EMERGENCY se priorizan escrituras críticas, se suspenden procesos no esenciales y se preserva evidencia.
STO-5409. Ningún estado autoriza borrado automático de datos de usuarios.
STO-5410. Los estados se calculan también por presupuesto: agotar el presupuesto aprobado puede disparar CRITICAL aunque quede espacio.
STO-5411. Caso hipotético: un volumen pasa de NORMAL a CRITICAL en un día por una importación no planificada.
STO-5412. La alerta llega con forecast actualizado y el responsable decide pausar la importación y ampliar capacidad.
STO-5413. La aceptación simula el salto y verifica que la transición omite WARNING cuando corresponde y notifica de inmediato.
STO-5414. Los umbrales se revisan tras cada incidente de capacidad con evidencia del comportamiento observado.
STO-5415. Quiero estados de capacidad que reflejen riesgo real y me den tiempo para decidir.

## 55. Rotación de llaves y credenciales de almacenamiento

STO-5501. Las credenciales de acceso a almacenes se rotan con calendario y ante sospecha de exposición.
STO-5502. La rotación se ensaya en entorno de prueba para verificar que los consumidores aceptan la nueva credencial.
STO-5503. Durante la rotación, ambas credenciales coexisten un período breve definido para evitar interrupciones.
STO-5504. La credencial antigua se revoca tras confirmar que ningún consumidor la usa.
STO-5505. Las llaves de cifrado se rotan con versionado para que datos antiguos sigan descifrándose.
STO-5506. La recifración de datos antiguos con la nueva llave se planifica cuando la política lo exige.
STO-5507. El inventario de credenciales registra consumidores para no romper integraciones olvidadas.
STO-5508. Caso hipotético: la rotación de una clave de almacenamiento rompe un proceso de reportes no inventariado.
STO-5509. El registro de accesos identifica al consumidor y se añade al inventario antes de completar la rotación.
STO-5510. La aceptación repite la rotación en prueba y verifica que todos los consumidores inventariados funcionan.
STO-5511. Quiero rotar credenciales sin miedo, porque sé exactamente quién las usa.

## 56. Datos en contexto, memoria y registros de agentes

STO-5601. El contenido enviado a agentes de IA se trata como transferencia de datos con propósito, minimización y destino.
STO-5602. Las conversaciones de agentes que contienen datos de usuarios siguen retención y acceso de esos datos.
STO-5603. La memoria persistente de agentes no almacena datos personales de terceros, secretos ni contenido restringido.
STO-5604. Los registros de herramientas de agentes se minimizan y no conservan resultados completos con datos sensibles.
STO-5605. Los checkpoints de flujos de agentes se almacenan con clasificación igual a la de los datos que contienen.
STO-5606. La eliminación de datos de un titular incluye conversaciones, memorias y checkpoints de agentes que los contengan.
STO-5607. Caso hipotético: un agente de soporte guarda en su memoria persistente el número de documento de un cliente.
STO-5608. La revisión detecta el dato, lo elimina de la memoria y añade un guardrail que bloquea patrones de documentos.
STO-5609. La aceptación intenta almacenar un documento de prueba en memoria y verifica el bloqueo.
STO-5610. Quiero que mis agentes olviden lo que no deben recordar y que su memoria sea auditable.

## 57. Almacenamiento de sesiones y estado de usuario

STO-5701. Las sesiones se almacenan con expiración, identificador aleatorio y vinculación al usuario y dispositivo cuando aplica.
STO-5702. El almacén de sesiones permite revocar todas las sesiones de un usuario de inmediato.
STO-5703. Las sesiones no almacenan secretos ni datos sensibles innecesarios.
STO-5704. La pérdida del almacén de sesiones obliga a reautenticar, lo que es aceptable si se documenta.
STO-5705. El tamaño del almacén de sesiones se monitorea y las sesiones expiradas se eliminan.
STO-5706. Caso hipotético: un usuario cambia su contraseña tras sospecha de robo, pero sus sesiones antiguas siguen activas.
STO-5707. La corrección revoca todas las sesiones al cambiar la contraseña y la prueba lo verifica.
STO-5708. La aceptación inicia sesión en dos dispositivos, cambia la contraseña y confirma la invalidación de ambas.
STO-5709. Quiero que cerrar una sesión o cambiar una contraseña tenga efecto inmediato y verificable.

## 58. Procedimiento de suspensión de borrado

STO-5801. Una suspensión de borrado se registra con motivo, alcance exacto, autoridad, fecha y revisión programada.
STO-5802. Los procesos de eliminación consultan suspensiones activas antes de ejecutar cada lote.
STO-5803. Los datos suspendidos se marcan para que operadores y agentes vean la restricción.
STO-5804. La suspensión se levanta formalmente con registro y los datos retoman su ciclo normal.
STO-5805. La suspensión no impide aplicar controles de acceso adicionales sobre los datos afectados.
STO-5806. Caso hipotético: un proceso automático elimina correos de un usuario involucrado en una investigación activa.
STO-5807. La corrección hace que el proceso consulte suspensiones antes de borrar y la prueba lo verifica.
STO-5808. La aceptación crea una suspensión de prueba y confirma que el lote correspondiente se omite.
STO-5809. Quiero conservar lo que debo conservar sin convertir todo en conservación indefinida.

## 59. Recuperación ante desastres entre ubicaciones

STO-5901. El plan de desastres define escenarios: pérdida de equipo, de región, de cuenta del proveedor y de proveedor completo.
STO-5902. Cada escenario tiene RPO, RTO, procedimiento, responsables y última fecha de ensayo.
STO-5903. Una segunda ubicación activa se justifica por requisito y costo, no por costumbre.
STO-5904. La conmutación a la ubicación secundaria se ensaya con datos y tráfico representativos.
STO-5905. El retorno a la ubicación principal se planifica y ensaya igual que la conmutación.
STO-5906. Las dependencias externas, como DNS y proveedores de identidad, se incluyen en el plan.
STO-5907. Caso hipotético: la cuenta del proveedor se suspende por un error de facturación y todos los datos quedan inaccesibles.
STO-5908. La copia en otra cuenta y otro proveedor permite restaurar el servicio mínimo dentro del RTO acordado.
STO-5909. La aceptación ensaya el escenario con restauración en la ubicación alterna y mide el tiempo.
STO-5910. Quiero sobrevivir a la pérdida de cualquier lugar donde guardo datos.

## 60. Objetivos de servicio para datos

STO-6001. Los objetivos de servicio de datos incluyen durabilidad, disponibilidad, latencia de escritura y lectura, y frescura.
STO-6002. Cada objetivo tiene métrica, fuente, ventana y responsable.
STO-6003. Los objetivos se fijan por proceso según impacto en usuarios, no por las cifras publicitadas del proveedor.
STO-6004. La durabilidad prometida por el proveedor no sustituye backups propios ante errores de operador.
STO-6005. El incumplimiento de objetivos genera análisis y acción, no solo un informe.
STO-6006. Caso hipotético: la latencia de escritura supera el objetivo cada lunes por procesos semanales.
STO-6007. La reprogramación de procesos y la medición posterior confirman el cumplimiento.
STO-6008. Quiero objetivos de datos que representen lo que mis usuarios necesitan, medidos con honestidad.

## 61. Estrategia de pruebas de la capa de datos

STO-6101. Las pruebas de la capa de datos cubren invariantes, migraciones, concurrencia, restauración y aislamiento de tenants.
STO-6102. Las pruebas de migración se ejecutan sobre copia representativa anonimizada y miden duración.
STO-6103. Las pruebas de concurrencia ejecutan operaciones simultáneas sobre los mismos registros.
STO-6104. Las pruebas de restauración validan conteos, relaciones y muestras funcionales.
STO-6105. Las pruebas de aislamiento consultan con identidades de distintos tenants.
STO-6106. Las pruebas usan bases efímeras para no compartir estado entre ejecuciones.
STO-6107. Las pruebas de inyección de fallos simulan disco lleno, conexión perdida y respuestas lentas.
STO-6108. Caso hipotético: una prueba de integración pasa localmente y falla en CI por depender del orden de inserción.
STO-6109. La corrección ordena explícitamente las consultas y la prueba se ejecuta con orden aleatorio.
STO-6110. Quiero pruebas de datos que fallen cuando algo se rompe y que no fallen por casualidad.

## 62. Contratos de datos con consumidores

STO-6201. Los consumidores de datos, como reportes, integraciones y equipos de análisis, se registran con los campos que usan.
STO-6202. Los cambios en esos campos se comunican con anticipación y período de compatibilidad.
STO-6203. Los contratos de datos declaran esquema, semántica, frescura y calidad garantizadas.
STO-6204. Las violaciones de contrato se detectan con pruebas automáticas antes de publicar cambios.
STO-6205. Caso hipotético: un cambio de semántica en un campo de estado rompe métricas de negocio sin error técnico.
STO-6206. La prueba de contrato con valores esperados detecta el cambio de semántica antes del despliegue.
STO-6207. Quiero cambiar mis datos sin romper silenciosamente a quienes dependen de ellos.

## 63. Errores frecuentes en almacenamiento

STO-6301. Confundir réplica con backup y descubrirlo cuando el borrado se replica.
STO-6302. Confiar en backups nunca restaurados.
STO-6303. Proyectar capacidad con borrados prometidos pero no ejecutados.
STO-6304. Comparar unidades decimales y binarias sin conversión.
STO-6305. Omitir el tenant en claves de caché o filtros de consulta.
STO-6306. Guardar secretos en backups o exportaciones.
STO-6307. Eliminar datos de usuarios para resolver una alerta de capacidad.
STO-6308. Usar coma flotante para montos y perder céntimos en conversiones.
STO-6309. Cada error de esta lista tiene una cláusula preventiva en este manual y debe convertirse en prueba cuando sea mecánico.
STO-6310. Quiero que estos errores aparezcan en las revisiones antes de aparecer en producción.

## 64. Series temporales y métricas almacenadas

STO-6401. Las series temporales se almacenan con resolución decreciente según antigüedad para controlar volumen.
STO-6402. La agregación conserva mínimos, máximos y percentiles cuando los promedios ocultarían picos relevantes.
STO-6403. La retención de cada resolución se documenta y se refleja en el forecast.
STO-6404. Las etiquetas de alta cardinalidad se evitan porque multiplican series y costo.
STO-6405. Los relojes de las fuentes se sincronizan para que las series sean comparables.
STO-6406. Caso hipotético: una etiqueta con identificador de usuario crea millones de series y agota la memoria del servidor de métricas.
STO-6407. La corrección elimina la etiqueta, agrega por segmentos y la prueba de carga verifica estabilidad.
STO-6408. Quiero métricas históricas útiles sin pagar por guardar cada segundo para siempre.

## 65. Identificadores, tiempo y codificación

STO-6501. Los identificadores públicos no son secuenciales cuando la enumeración revelaría volumen o permitiría acceso por adivinanza.
STO-6502. Los identificadores internos pueden ser secuenciales por eficiencia si no se exponen.
STO-6503. Las marcas temporales se almacenan en UTC con precisión suficiente y se convierten a America/Lima al mostrar cuando corresponde.
STO-6504. Los cambios de horario y zonas se prueban en cálculos de vencimiento y reportes por día.
STO-6505. El texto se almacena en UTF-8 y la ordenación usa colación adecuada al idioma español.
STO-6506. Los nombres con tildes, eñes y caracteres especiales se prueban en búsqueda, exportación y nombres de archivo.
STO-6507. Caso hipotético: un reporte diario corta los registros a medianoche UTC y los usuarios en Perú ven días incompletos.
STO-6508. La corrección calcula cortes en la zona horaria del usuario y la prueba verifica registros de las 19:00 a 23:59 hora local.
STO-6509. Quiero datos que respeten el idioma, la hora y la identidad de mis usuarios.

## 66. Borrado lógico y borrado físico

STO-6601. El borrado lógico marca registros como eliminados y se usa cuando la recuperación o la auditoría lo justifican.
STO-6602. Los registros con borrado lógico se excluyen de consultas por defecto mediante la capa de acceso.
STO-6603. El borrado lógico no satisface solicitudes de eliminación de titulares; requiere borrado físico posterior según retención.
STO-6604. El borrado físico se ejecuta por proceso programado autorizado con registro de cantidades.
STO-6605. Las restricciones de unicidad consideran registros con borrado lógico para no bloquear reutilización legítima.
STO-6606. Caso hipotético: un usuario elimina su cuenta y otro no puede registrarse con el mismo correo durante años.
STO-6607. La corrección ajusta la restricción de unicidad a registros activos y completa el borrado físico según política.
STO-6608. Quiero que eliminar signifique lo que el usuario cree que significa.

## 67. Datos de configuración y entorno

STO-6701. La configuración no secreta se versiona en el repositorio con valores por entorno documentados.
STO-6702. La configuración secreta vive en el gestor de secretos y se referencia por nombre.
STO-6703. Los cambios de configuración productiva se registran con actor, motivo y verificación.
STO-6704. La configuración efectiva de un entorno puede consultarse sin revelar secretos.
STO-6705. Los archivos de configuración local se excluyen del control de versiones y tienen ejemplo con marcadores.
STO-6706. Caso hipotético: una bandera de configuración activa en producción una función incompleta por un valor por defecto.
STO-6707. La corrección hace explícito el valor por entorno y la validación de arranque rechaza configuraciones incompletas.
STO-6708. Quiero saber qué configuración tiene cada entorno sin adivinar ni exponer secretos.

## 68. Datos de servicios de terceros

STO-6801. Los datos que el producto mantiene en servicios de terceros, como correo, CRM o almacenamiento de documentos, se inventarían.
STO-6802. Cada servicio declara qué datos contiene, quién accede, cómo se exporta y si existe backup propio.
STO-6803. La durabilidad del tercero no sustituye una copia propia cuando la pérdida sería grave.
STO-6804. Las exportaciones periódicas de servicios críticos se automatizan con autorización y se verifican.
STO-6805. La baja de un servicio incluye exportación, verificación y eliminación certificada según contrato.
STO-6806. Caso hipotético: una cuenta de un servicio de formularios se cierra por inactividad y se pierden respuestas de clientes.
STO-6807. La política añade el servicio al inventario, exporta respuestas periódicamente y asigna responsable de la cuenta.
STO-6808. Quiero que mis datos en servicios ajenos estén tan protegidos como los que guardo yo.

## 69. Asignación de costos por tenant y función

STO-6901. El costo de almacenamiento se asigna por tenant y función cuando la facturación o la rentabilidad lo requieren.
STO-6902. La asignación usa mediciones reales de uso y explica el método para costos compartidos.
STO-6903. Los clientes que exceden su plan se identifican con datos verificables antes de cualquier comunicación comercial.
STO-6904. Las cifras de costo por tenant se etiquetan como estimación hasta reconciliarse con facturación real.
STO-6905. Caso hipotético: un tenant consume la mitad del almacenamiento pero paga el plan básico.
STO-6906. La medición respalda la conversación comercial y la decisión corresponde al responsable, no al sistema.
STO-6907. Quiero entender cuánto cuesta servir a cada cliente con cifras que pueda defender.

## 70. Pruebas de rendimiento del almacenamiento

STO-7001. Las pruebas de rendimiento usan volumen y distribución de datos representativos del crecimiento esperado.
STO-7002. La carga simula concurrencia y mezcla de operaciones observadas, no solo lecturas simples.
STO-7003. Los resultados registran hardware, configuración, versión y datos usados para reproducirlos.
STO-7004. Las pruebas se ejecutan en entornos aislados para no afectar producción.
STO-7005. Los límites encontrados se documentan con la acción prevista antes de alcanzarlos en producción.
STO-7006. Caso hipotético: la base responde bien con mil registros de prueba y se degrada con el volumen real de un año.
STO-7007. La prueba con volumen proyectado revela un índice faltante que se añade antes del lanzamiento.
STO-7008. Quiero conocer los límites de mi almacenamiento en una prueba, no en una mañana de lunes.

## 71. Exportación de datos por el propio usuario

STO-7101. Los usuarios pueden exportar sus datos en formato comprensible cuando el producto lo ofrece o la obligación lo exige.
STO-7102. La exportación incluye solo datos del solicitante y excluye datos de terceros.
STO-7103. La exportación se entrega por canal seguro con enlace temporal y autenticación.
STO-7104. Las exportaciones grandes se procesan en segundo plano con notificación y límite de frecuencia.
STO-7105. Los archivos de exportación se eliminan tras su expiración.
STO-7106. Caso hipotético: una exportación de usuario incluye comentarios de otros miembros con sus nombres completos.
STO-7107. La corrección filtra datos de terceros según política y la prueba verifica el contenido del archivo.
STO-7108. Quiero que mis usuarios puedan llevarse lo suyo sin llevarse lo de otros.

## 72. Almacenamiento de evidencia de auditoría y cumplimiento

STO-7201. La evidencia de auditoría, como registros de aprobaciones, ensayos y decisiones, se almacena con integridad verificable.
STO-7202. La evidencia tiene retención definida por su propósito y no se elimina antes de su vencimiento.
STO-7203. El acceso a la evidencia se limita a roles de auditoría y queda registrado.
STO-7204. La evidencia no contiene secretos ni datos personales innecesarios.
STO-7205. Los hashes de evidencia se registran para detectar alteraciones.
STO-7206. Caso hipotético: un auditor solicita el último ensayo de restauración y el acta solo existía en un chat.
STO-7207. La política exige almacenar actas en la estructura documental del proyecto con referencia desde el registro de capacidades.
STO-7208. Quiero poder mostrar evidencia de lo que hice sin buscarla en conversaciones dispersas.

## 73. Gobierno de cambios en datos productivos

STO-7301. Las correcciones manuales de datos productivos se preparan como scripts revisados, no como consultas improvisadas.
STO-7302. Cada script declara alcance, conteo esperado, verificación previa, verificación posterior y reversión.
STO-7303. El script se ejecuta primero en copia representativa y se compara el resultado.
STO-7304. La ejecución en producción requiere autorización, respaldo previo del alcance y registro de resultados.
STO-7305. Un conteo afectado distinto del esperado detiene la ejecución dentro de una transacción.
STO-7306. Caso hipotético: una corrección de estados actualiza todos los pedidos por omitir una condición.
STO-7307. La verificación de conteo dentro de la transacción detecta la diferencia y revierte antes de confirmar.
STO-7308. La aceptación ejecuta el script defectuoso en prueba y verifica que se detiene por conteo inesperado.
STO-7309. Los agentes preparan scripts de corrección; su ejecución productiva requiere aprobación humana específica.
STO-7310. Quiero que corregir datos nunca cause un problema mayor que el que corrige.

## 74. Validación en las fronteras del sistema

STO-7401. Toda entrada que llega al almacenamiento se valida en el servidor por tipo, tamaño, formato y pertenencia.
STO-7402. Las validaciones del cliente mejoran la experiencia pero no sustituyen las del servidor.
STO-7403. Los valores fuera de rango se rechazan con error claro en lugar de truncarse silenciosamente.
STO-7404. Los textos se normalizan cuando su comparación lo requiere, conservando el original cuando sea significativo.
STO-7405. Caso hipotético: un campo de cantidad acepta negativos por la API aunque la interfaz lo impide.
STO-7406. La restricción en la base y la validación del servidor rechazan negativos, y la prueba de API lo verifica.
STO-7407. Quiero que mis datos sean válidos sin importar por qué puerta entraron.

## 75. Correo, adjuntos y comunicaciones almacenadas

STO-7501. Los correos y mensajes almacenados por el producto se clasifican y tienen retención propia.
STO-7502. Los adjuntos se procesan con las reglas de archivos subidos y se almacenan fuera de la base principal.
STO-7503. Las plantillas de comunicación se versionan sin datos personales.
STO-7504. Los registros de envío conservan destinatario, plantilla, estado y momento sin almacenar contenido sensible innecesario.
STO-7505. Caso hipotético: el registro de envíos guarda el cuerpo completo de correos con enlaces de recuperación de contraseña.
STO-7506. La corrección almacena solo metadatos del envío y la prueba verifica que ningún token aparece en registros.
STO-7507. Quiero comunicaciones trazables sin guardar las llaves que contienen.

## 76. Lista de verificación de almacenamiento

STO-7601. Inventario completo o pendientes explícitos con responsable.
STO-7602. Clasificación de cada conjunto de datos y diccionario actualizado.
STO-7603. Mediciones con unidad, fuente y fecha.
STO-7604. Forecast con escenarios, supuestos y acciones.
STO-7605. Estados de capacidad con umbrales, receptores y runbooks.
STO-7606. Cuotas por usuario y tenant con comportamiento definido.
STO-7607. Backups con manifiesto, destino separado y copia resistente a ataques.
STO-7608. Ensayo de restauración reciente con tiempos frente al RTO.
STO-7609. Retención y eliminación verificables, incluida reaplicación tras restauración.
STO-7610. Aislamiento de tenants probado en consultas, cachés, índices y backups.
STO-7611. Cifrado declarado por almacén con custodia de llaves.
STO-7612. Plan de salida de cada proveedor con exportación probada.
STO-7613. La lista se adapta al perfil y declara qué puntos no aplican y por qué.

## 77. Glosario de almacenamiento

STO-7701. RPO: pérdida máxima de datos aceptable medida en tiempo para un proceso.
STO-7702. RTO: tiempo objetivo para recuperar el servicio necesario tras una interrupción.
STO-7703. Reserva operativa: espacio que no se planifica consumir para permitir mantenimiento y emergencias.
STO-7704. Forecast: proyección de consumo con supuestos explícitos y rango de incertidumbre.
STO-7705. Suspensión de borrado: restricción que impide eliminar datos afectados por un motivo registrado.
STO-7706. Marca de eliminación: registro que propaga un borrado entre réplicas antes de purgarse.
STO-7707. Almacén derivado: copia reconstruible desde una fuente de verdad, como cachés e índices.
STO-7708. Copia inmutable: backup que no puede modificarse ni eliminarse durante su retención con las credenciales productivas.

## 78. Límites declarados de esta edición

STO-7801. Este manual no implementa almacenamiento, backups ni monitoreo en ningún proyecto.
STO-7802. Las cifras de ejemplos y casos son didácticas y no describen mediciones reales.
STO-7803. Las referencias normativas requieren verificación vigente y revisión competente por proyecto.
STO-7804. Las recomendaciones tecnológicas se expresan como criterios; la elección concreta depende de evidencia de cada proyecto.
STO-7805. Los límites se revisan en cada edición y se eliminan cuando la evidencia los resuelve.

## 79. Cierre de la Parte II

STO-7901. La Parte II convierte los contratos de la Parte I en cláusulas aplicables por sección y verificables por prueba.
STO-7902. Cada proyecto selecciona las secciones pertinentes según su perfil y documenta las omitidas.
STO-7903. La evidencia de cumplimiento pertenece a cada proyecto y se conserva en su estructura documental.
STO-7904. Las contradicciones con otros módulos se reportan y se resuelven en la fuente canónica.
STO-7905. Pierre R. Boss (oprbguitar) dirige este estándar y decide sobre su evolución.
STO-7906. Quiero datos que sepa dónde están, cuánto cuestan, quién los toca y cómo recuperarlos cuando todo falle.

## Anexo A. Caso trabajado: crecimiento de adjuntos en un portal de clientes

STO-A001. Estado inicial hipotético: portal con base relacional de 40 GB y adjuntos en el mismo volumen de 500 GB decimales.
STO-A002. La medición de seis semanas muestra crecimiento neto medio de 3 GB diarios, con picos de 7 GB los fines de mes.
STO-A003. La reserva operativa se fija en 75 GB para reconstrucción de índices y backups locales temporales.
STO-A004. El escenario base proyecta alcanzar la reserva en unos 128 días; el adverso, con picos sostenidos, en unos 55 días.
STO-A005. El tiempo de aprovisionamiento de un volumen mayor con el proveedor se mide en dos semanas incluyendo aprobación.
STO-A006. El estado pasa a WARNING porque el escenario adverso entra en el horizonte de acción de 60 días.
STO-A007. El arquitecto evalúa tres alternativas: ampliar volumen, mover adjuntos a almacenamiento de objetos o comprimir.
STO-A008. La compresión medida sobre muestra de adjuntos ofrece 4 por ciento de ahorro porque son PDF ya comprimidos.
STO-A009. Ampliar el volumen resuelve el corto plazo pero mantiene backups lentos por el tamaño total.
STO-A010. Mover adjuntos a objetos separa crecimiento, abarata almacenamiento frío y acelera backups de la base.
STO-A011. El responsable aprueba la migración a objetos con presupuesto mensual estimado y revisión al tercer mes.
STO-A012. La migración se planifica en hitos: adjuntos nuevos a objetos, copia por lotes de antiguos, verificación y liberación.
STO-A013. Cada lote verifica hash de origen y destino antes de actualizar la referencia en la base.
STO-A014. La reconciliación final compara número de referencias y objetos, y reporta cero diferencias.
STO-A015. Los archivos originales se eliminan del volumen solo tras la reconciliación y un backup verificado de la base.
STO-A016. El volumen recupera espacio medido y el estado vuelve a NORMAL tras el período de histéresis.
STO-A017. El forecast se recalcula por separado para base y objetos con sus propios escenarios.
STO-A018. La política de ciclo de vida mueve adjuntos sin acceso en 180 días a nivel templado tras medir patrones.
STO-A019. El ensayo de restauración combinada recupera base y objetos coherentes en entorno aislado.
STO-A020. Las cifras del caso son didácticas y no describen ningún sistema real.

## Anexo B. Caso trabajado: borrado accidental por un operador

STO-B001. Estado inicial hipotético: un operador ejecuta una consulta de limpieza sin condición de tenant en producción.
STO-B002. La consulta elimina registros de facturas de todos los tenants creados el mes anterior.
STO-B003. La alerta de anomalía de eliminaciones notifica al responsable a los pocos minutos.
STO-B004. El comandante de incidentes declara severidad alta y suspende procesos que escriben facturas.
STO-B005. Se identifica el momento exacto de la consulta en los registros de auditoría de la base.
STO-B006. Se elige el punto de restauración inmediatamente anterior a la consulta mediante recuperación a un instante.
STO-B007. La restauración se realiza en entorno aislado y se extraen solo los registros eliminados.
STO-B008. Se comparan los registros restaurados con facturas creadas después del borrado para evitar duplicados.
STO-B009. La reintegración se ejecuta con script revisado, conteo esperado y transacción.
STO-B010. Se verifica por tenant que los totales de facturas coinciden con los reportes previos al incidente.
STO-B011. Los procesos de escritura se reactivan tras la verificación.
STO-B012. El postmortem identifica ausencia de revisión para consultas manuales y acceso directo amplio del operador.
STO-B013. Las acciones preventivas exigen scripts revisados, transacciones con verificación de conteo y acceso temporal.
STO-B014. La comunicación a clientes se evalúa según impacto y el responsable decide con base en la evidencia.
STO-B015. El caso es un ejercicio de diseño y no describe un incidente real.

## Anexo C. Criterios para elegir tecnología de almacenamiento

STO-C001. Modelo de datos: relaciones y transacciones favorecen bases relacionales; documentos independientes permiten almacenes documentales.
STO-C002. Volumen y crecimiento medidos determinan si un servidor único basta o si se requiere particionado.
STO-C003. Patrón de acceso: archivos grandes y pocas modificaciones favorecen almacenamiento de objetos.
STO-C004. Consistencia requerida: operaciones financieras exigen garantías fuertes que algunos almacenes no ofrecen.
STO-C005. Capacidad operativa del receptor: una tecnología que nadie del equipo sabe operar añade riesgo.
STO-C006. Costo total: licencias, infraestructura, operación, backup, egreso y formación.
STO-C007. Portabilidad: formatos abiertos y herramientas estándar reducen dependencia del proveedor.
STO-C008. Entorno: el perfil puede exigir funcionamiento local en Windows, offline o en servidores propios.
STO-C009. Ecosistema: disponibilidad de herramientas de backup, monitoreo y migración maduras.
STO-C010. La decisión se registra como ADR con alternativas, evidencia y fecha de revisión.
STO-C011. Ninguna tecnología se elige por ser la más popular o la más nueva sin evidencia aplicada al perfil.
STO-C012. Una base embebida local puede ser la mejor opción para una aplicación de escritorio de un solo usuario.

## Anexo D. Campos mínimos del acta de restauración

STO-D001. Identificador del ensayo o incidente y responsable que ejecuta.
STO-D002. Fecha y hora de inicio y fin de cada fase.
STO-D003. Backup utilizado con identificador, fecha, hash y versión de herramienta.
STO-D004. Punto de recuperación objetivo y punto efectivamente restaurado.
STO-D005. Destino de restauración y su aislamiento.
STO-D006. Validaciones ejecutadas: estructura, conteos, sumas, relaciones y muestras funcionales con resultados.
STO-D007. Tiempo total comparado con el RTO acordado.
STO-D008. Datos perdidos entre el punto restaurado y el incidente, comparados con el RPO.
STO-D009. Problemas encontrados y correcciones al procedimiento.
STO-D010. Limpieza del entorno de restauración y eliminación de copias temporales.
STO-D011. Firma o aceptación del responsable y fecha del próximo ensayo.

## Anexo E. Campos mínimos del inventario de almacenamiento

STO-E001. Identificador del recurso y nombre legible.
STO-E002. Tipo: volumen, base, bucket, caché, índice, cola, backup u otro.
STO-E003. Ubicación: equipo, región y proveedor.
STO-E004. Ambiente: desarrollo, prueba o producción.
STO-E005. Propietario y responsable operativo.
STO-E006. Clasificación de los datos y presencia de datos personales.
STO-E007. Capacidad contratada, cuota efectiva, uso actual y reserva.
STO-E008. Crecimiento medido con ventana y fecha.
STO-E009. Cifrado y custodia de llaves.
STO-E010. Backup asociado, frecuencia, retención y último ensayo.
STO-E011. Consumidores conocidos y credenciales asociadas por referencia.
STO-E012. Costo verificado y fuente de la tarifa.
STO-E013. Estado de capacidad y fecha de próxima revisión.
STO-E014. Campos desconocidos marcados como pendientes con responsable.

## Anexo F. Preguntas de revisión por rol

STO-F001. Arquitecto: ¿la tecnología elegida responde a requisitos medidos y tiene plan de salida?
STO-F002. Arquitecto: ¿las invariantes críticas están en restricciones de la base?
STO-F003. Seguridad: ¿el acceso por rol y tenant está probado con casos negativos?
STO-F004. Seguridad: ¿los backups tienen credenciales separadas y una copia inmutable?
STO-F005. Privacidad: ¿la retención está definida y la eliminación se puede demostrar?
STO-F006. SRE: ¿el último ensayo de restauración cumple el RTO?
STO-F007. SRE: ¿los umbrales de capacidad tienen receptor efectivo y runbook ensayado?
STO-F008. Finanzas: ¿los costos provienen de facturación o tarifas verificadas con fecha?
STO-F009. Receptor: ¿puedo medir capacidad y restaurar siguiendo solo la documentación?
STO-F010. Orquestador: ¿las acciones sobre datos productivos tuvieron autorización registrada?
STO-F011. Cada pregunta sin respuesta verificable se registra como pendiente con responsable.
STO-F012. Las preguntas se adaptan al perfil y se omiten justificadamente cuando no aplican.

## Anexo G. Firma del módulo

STO-G001. Este módulo fue dirigido por Pierre R. Boss (oprbguitar) y desarrollado con asistencia de IA.
STO-G002. La firma expresa dirección editorial y no certifica infraestructura, backups ni cumplimiento de ningún proyecto.

## Anexo H. Caso trabajado: sincronización offline de inspecciones

STO-H001. Estado inicial hipotético: inspectores registran hallazgos en tablets sin conexión durante jornadas en campo.
STO-H002. Cada registro tiene identificador generado en el dispositivo, versión y marca de modificación lógica.
STO-H003. Las operaciones pendientes se guardan en almacenamiento local durable y sobreviven reinicios de la tablet.
STO-H004. Al reconectar, el cliente envía operaciones en orden con clave de idempotencia por operación.
STO-H005. El servidor aplica operaciones nuevas, ignora repetidas y detecta conflictos por versión.
STO-H006. Un conflicto en el campo de severidad se envía a revisión del supervisor con ambas versiones.
STO-H007. Un conflicto en notas libres se fusiona conservando ambos textos con autor y hora.
STO-H008. Los borrados offline se envían como marcas de eliminación que el servidor conserva durante la ventana de sincronización.
STO-H009. Una tablet que no sincroniza durante más que la ventana recibe resincronización completa antes de enviar cambios.
STO-H010. Una tablet perdida se revoca y sus operaciones pendientes no aplicadas se tratan como perdidas con aviso al supervisor.
STO-H011. Las fotos de inspección se suben por separado con reanudación y hash, y el registro referencia la foto verificada.
STO-H012. La prueba de aceptación simula dos inspectores editando el mismo hallazgo y verifica que ninguno pierde su trabajo.
STO-H013. Otra prueba simula reconexión tras actualización de esquema y verifica compatibilidad de operaciones antiguas.
STO-H014. El caso es didáctico y no describe un sistema existente.

## Anexo I. Caso trabajado: salida planificada de un proveedor

STO-I001. Estado inicial hipotético: un producto usa almacenamiento de objetos de un proveedor que anuncia cambio de condiciones.
STO-I002. El plan de salida existente indica formato de exportación, volumen total y costo de egreso estimado con tarifa verificada.
STO-I003. La exportación de prueba realizada meses antes confirmó que los metadatos requieren transformación.
STO-I004. El equipo habilita escritura dual hacia el nuevo proveedor para objetos nuevos con verificación de hash.
STO-I005. La copia de objetos antiguos se ejecuta por lotes con límite de ancho de banda para controlar costo.
STO-I006. La aplicación lee del nuevo proveedor con respaldo en el antiguo durante la transición.
STO-I007. La reconciliación final confirma igualdad de objetos y metadatos entre proveedores.
STO-I008. Las lecturas se cambian al nuevo proveedor y el antiguo queda en solo lectura durante un período de reversión.
STO-I009. Tras el período sin incidentes, se solicita eliminación al proveedor antiguo y se conserva su confirmación.
STO-I010. Las credenciales del proveedor antiguo se revocan y se retiran del inventario.
STO-I011. La aceptación verifica que ninguna referencia apunta al proveedor antiguo y que el costo coincide con la estimación.
STO-I012. El caso es didáctico y no describe un proveedor real.

## Anexo J. Ejemplo de RPO y RTO por proceso

STO-J001. Registro de pagos hipotético: RPO de minutos mediante recuperación a un instante y RTO de horas con procedimiento ensayado.
STO-J002. Catálogo de productos hipotético: RPO de un día porque puede reconstruirse desde la fuente editorial.
STO-J003. Adjuntos de clientes hipotéticos: RPO de un día con versionado de objetos y RTO de un día para restauración completa.
STO-J004. Registros de análisis hipotéticos: RPO de una semana porque son derivados reconstruibles.
STO-J005. Sesiones de usuario hipotéticas: sin backup, porque perderlas solo obliga a reautenticar.
STO-J006. Cada valor real se acuerda con el responsable según impacto y costo, y se verifica en ensayos.
STO-J007. Un RPO más estricto aumenta costo de backup; la decisión registra ese equilibrio.
STO-J008. Los valores de este anexo son ejemplos para ilustrar la diferenciación por proceso.

## Anexo K. Preguntas iniciales al responsable

STO-K001. ¿Qué datos conserva el producto y cuáles serían más graves de perder?
STO-K002. ¿Cuánto tiempo puede estar sin servicio cada proceso sin daño serio?
STO-K003. ¿Qué cantidad de datos recientes podría perderse sin consecuencias graves?
STO-K004. ¿Hay obligaciones contractuales o legales sobre ubicación y retención de los datos?
STO-K005. ¿Qué presupuesto mensual está disponible para almacenamiento y backups?
STO-K006. ¿Quién operará el almacenamiento después de la entrega?
STO-K007. Las preguntas se formulan solo cuando la respuesta no puede obtenerse del repositorio o la documentación existente.
STO-K008. Las respuestas se registran como decisiones con fecha y responsable.

## Anexo L. Señales de madurez del almacenamiento

STO-L001. El responsable conoce el estado de capacidad de cada recurso sin pedir un informe especial.
STO-L002. Los ensayos de restauración se realizan según calendario y cumplen sus objetivos.
STO-L003. Las alertas llegan a tiempo y conducen a acciones registradas.
STO-L004. Los costos se mantienen dentro del presupuesto y sus desviaciones se explican.
STO-L005. Las solicitudes de eliminación se atienden con evidencia.
STO-L006. Un receptor nuevo puede operar el almacenamiento siguiendo la documentación.
STO-L007. Los incidentes de datos disminuyen porque sus lecciones se convierten en controles.
STO-L008. Las señales se evalúan con evidencia y no como autoevaluación optimista.

## Anexo M. Relación con otros módulos

STO-M001. [PRIME-DIRECTIVE](PRIME-DIRECTIVE.md) define autoridad y evidencia para acciones sobre datos productivos.
STO-M002. [CAPABILITY-PROFILER](CAPABILITY-PROFILER.md) decide la activación de capacidades de datos por perfil.
STO-M003. [SECURITY-FABRIC](SECURITY-FABRIC.md) desarrolla controles de acceso, secretos, cifrado y archivos subidos.
STO-M004. [PAYMENTS](PAYMENTS.md) añade reglas para datos que representan dinero.
STO-M005. [UPDATES-RELIABILITY](UPDATES-RELIABILITY.md) gobierna migraciones dentro de releases.
STO-M006. [INCIDENT-RESPONSE](INCIDENT-RESPONSE.md) coordina incidentes de pérdida o exposición de datos.
STO-M007. [MIGRATION-HANDOFF](MIGRATION-HANDOFF.md) guía migraciones entre tecnologías y proveedores.
STO-M008. [COMPLIANCE-IP-PRODUCT](COMPLIANCE-IP-PRODUCT.md) evalúa obligaciones de privacidad y retención aplicables.
STO-M009. Este módulo no repite contratos de otros módulos; los referencia para mantener una sola fuente.
STO-M010. Las contradicciones se reportan al propietario y se resuelven en la fuente canónica.

## Anexo N. Mantenimiento del módulo

STO-N001. El módulo se revisa en cada edición mayor de EOS con evidencia de proyectos que lo aplicaron.
STO-N002. Las cláusulas que no produjeron decisiones útiles se retiran y sus identificadores no se reutilizan.
STO-N003. Las lecciones de incidentes de datos se incorporan como cláusulas nuevas con caso de aceptación.
STO-N004. Las referencias normativas se verifican en fuente primaria con fecha antes de cada edición.
STO-N005. Las tarifas y cuotas mencionadas en ejemplos se mantienen como hipotéticas y no se actualizan como precios reales.
STO-N006. Los receptores que mantengan variantes documentan sus diferencias respecto a esta edición.
STO-N007. La revisión del módulo se registra en el changelog con alcance y responsable.
STO-N008. La coherencia con los manuales de seguridad, pagos y migración se comprueba en cada revisión.
STO-N009. El validador confirma estructura y firma; la revisión humana confirma exactitud técnica.
STO-N010. Las propuestas de cambio se dirigen al propietario con evidencia y cláusulas afectadas.
STO-N011. Un agente puede preparar la revisión del módulo, pero su aprobación corresponde al propietario.
STO-N012. Las secciones de la Parte I se conservan como antecedente aunque la Parte II las desarrolle.
STO-N013. Los anexos se actualizan cuando cambian plantillas relacionadas del directorio templates.
STO-N014. La extensión del módulo se justifica por decisiones operativas, no por volumen.
STO-N015. Los ejemplos de Windows se prueban en la versión de sistema declarada en el perfil del proyecto.
STO-N016. Los casos trabajados se revisan para que sigan siendo coherentes con las cláusulas vigentes.
STO-N017. El glosario se amplía cuando aparecen términos nuevos en cláusulas o casos.
STO-N018. Los límites declarados se revisan y se eliminan cuando la evidencia los resuelve.
STO-N019. Las preguntas de revisión por rol se ajustan según los hallazgos más frecuentes en proyectos reales.
STO-N020. La responsabilidad editorial de este mantenimiento corresponde a Pierre R. Boss (oprbguitar).

## Anexo O. Runbook de ensayo trimestral de restauración

STO-O001. Agenda el ensayo con responsable, ventana, entorno aislado y criterios de aceptación definidos de antemano.
STO-O002. Selecciona el backup según el escenario del ensayo: último disponible, punto antiguo o copia inmutable.
STO-O003. Verifica integridad del backup comparando su hash con el manifiesto.
STO-O004. Prepara el destino aislado sin conectividad hacia producción ni credenciales productivas.
STO-O005. Recupera llaves y secretos por el procedimiento de custodia, registrando quién accedió.
STO-O006. Restaura la base con la herramienta y versión registradas en el manifiesto.
STO-O007. Restaura los objetos asociados y verifica coherencia de referencias con la base.
STO-O008. Ejecuta validaciones de estructura, conteos, sumas, relaciones y muestras funcionales.
STO-O009. Ejecuta un flujo de usuario representativo contra el entorno restaurado.
STO-O010. Mide la duración de cada fase y el total frente al RTO acordado.
STO-O011. Calcula la pérdida de datos del punto restaurado frente al RPO acordado.
STO-O012. Registra problemas encontrados y corrige el procedimiento en la documentación fuente.
STO-O013. Elimina el entorno restaurado y las copias temporales, registrando la limpieza.
STO-O014. Completa el acta con los campos del Anexo D y la fecha del próximo ensayo.
STO-O015. Actualiza el estado de la capacidad de backup en la matriz según el resultado.
STO-O016. Un ensayo fallido degrada el estado a DEGRADED hasta repetirlo con éxito.
STO-O017. Un agente puede ejecutar el ensayo en entorno aislado con autorización, sin tocar producción.
STO-O018. El resultado se comunica al responsable con lo verificado, lo fallido y las acciones.

## Anexo P. Runbook de revisión mensual de capacidad

STO-P001. Recopila mediciones de espacio, inodos, cuotas, rendimiento y costo de cada recurso del inventario.
STO-P002. Compara con el mes anterior y con el forecast vigente, registrando desviaciones.
STO-P003. Identifica los conjuntos de mayor crecimiento y su causa probable con evidencia.
STO-P004. Recalcula escenarios base, adverso y planificado con eventos conocidos del mes siguiente.
STO-P005. Actualiza estados de capacidad y notifica cambios a los responsables.
STO-P006. Verifica que las políticas de retención se ejecutaron y registra cantidades eliminadas.
STO-P007. Revisa backups del mes: éxitos, fallos, duración y tamaño.
STO-P008. Revisa costos frente a presupuesto y explica diferencias significativas.
STO-P009. Propone acciones con plazo y responsable para recursos en WARNING o superior.
STO-P010. Registra la revisión en el expediente con fecha, mediciones y decisiones.
STO-P011. Las mediciones automáticas reducen trabajo, pero la revisión de decisiones sigue siendo humana.
STO-P012. Un agente puede preparar el informe mensual en nivel A0 o A1 con las mediciones disponibles.
STO-P013. El informe declara mediciones faltantes como falta de evidencia y no como cero.
STO-P014. Las cifras del informe incluyen fuente y fecha para que puedan reproducirse.
STO-P015. La revisión mensual se adapta a sistemas pequeños con una lista breve de comprobaciones.
STO-P016. Quiero revisar mi almacenamiento con la regularidad suficiente para que nunca me sorprenda.

## Anexo Q. Declaración final

STO-Q001. Este manual especifica cómo quiero diseñar, operar y entregar almacenamiento; no describe infraestructura existente.
STO-Q002. Cada proyecto demuestra su cumplimiento con mediciones, ensayos y registros propios.
STO-Q003. Las cifras de ejemplos permanecen hipotéticas y no deben copiarse como parámetros de producción.
STO-Q004. Las decisiones sobre datos de terceros corresponden al responsable del producto con revisión competente cuando aplique.
STO-Q005. Los agentes preparan análisis y planes; las acciones productivas sobre datos requieren autorización específica.
STO-Q006. Firma editorial: Pierre R. Boss (oprbguitar), con desarrollo documental asistido por IA.

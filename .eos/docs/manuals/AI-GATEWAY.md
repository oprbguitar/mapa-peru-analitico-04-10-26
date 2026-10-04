# Manual EOS: AI Integration Port y AI Gateway

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**
**Versión documental:** 3.0.0 · **Fecha de elaboración:** 3 de octubre de 2026, Perú.
**Fuentes de intención:** SRC-04, conversación sobre el conector de IA; SRC-03, constitución unificada.
**Autoridad interna:** [constitución maestra](../../EOS_MASTER_SYSTEM_INSTRUCTION.md).
**Documento relacionado:** [orquestación de agentes](AGENT-ORCHESTRATION.md).

Este manual especifica una capacidad de arquitectura. Sus esquemas, rutas y ejemplos son contratos propuestos para implementar y verificar en cada proyecto; su presencia documental no acredita que exista un gateway ejecutable en este repositorio. Ninguna referencia a un proveedor garantiza compatibilidad, disponibilidad, precio, calidad o cumplimiento vigente.

## 1. Mandato de Pierre: integrable desde el inicio, activo por necesidad

Todo proyecto EOS debe conservar un punto de extensión para IA. En un sitio sencillo puede bastar un contrato documentado y un adaptador desactivado. En una aplicación compleja puede existir un servicio completo. La proporción depende del producto, la criticidad y la evidencia. Está prohibido introducir un proceso permanente, un contenedor o una descarga de modelos solo para decir que el puerto existe.

Separar cuatro estados: puerto presente, proveedor habilitado, modelo cargado y función habilitada. Tener uno no implica los demás. El estado inicial de un proyecto sin caso de IA autorizado es `OFF`: cero descargas automáticas, cero llamadas pagadas, cero precargas y ningún modelo residente. La interfaz puede consumir la memoria ordinaria de la aplicación; no se promete consumo total de RAM igual a cero.

La lógica de negocio llama al puerto, el puerto aplica políticas y el adaptador traduce al proveedor. El componente que calcula impuestos, valida identificadores o ejecuta reglas exactas conserva una implementación determinística. IA no sustituye controles de integridad, autorización ni cálculo financiero.

**Entrada:** Project Profile, casos de uso y restricciones. **Salida:** decisión de presencia y activación independiente. **Aceptación:** arrancar en `OFF` funciona sin credenciales ni runtime de modelos; las funciones esenciales mantienen su comportamiento. **Falla:** si el producto depende realmente de IA, declarar esa dependencia y ofrecer un estado de indisponibilidad honesto, sin inventar un resultado alternativo equivalente.

## 2. Modos exactos y semántica de selección

Usar exclusivamente estos identificadores en configuraciones nuevas:

| Modo | Destino permitido | Condición de uso |
|---|---|---|
| `OFF` | Ningún proveedor de IA | Contrato disponible; solicitudes de IA se rechazan claramente |
| `LOCAL` | Proceso en el mismo equipo | Recursos, licencia y aislamiento aprobados |
| `LOCAL_REMOTE` | Otro equipo o servidor de la organización | Identidad del servidor, red, transporte y permisos verificados |
| `CLOUD_API` | API de tercero | Proveedor aprobado, datos permitidos y presupuesto reservado |
| `PRIVATE_CLOUD` | Infraestructura cloud bajo gobierno de la organización | Validar operador, región, acceso, retención y dependencias externas |
| `HYBRID` | Composición de rutas autorizadas | Cada etapa conserva clasificación y trazabilidad |
| `AUTO` | Selección por políticas entre candidatos permitidos | Nunca amplía permisos ni habilita gasto por iniciativa propia |

`AUTO` es una estrategia de decisión, no una nueva ubicación. Registrar el modo solicitado y el efectivo. `LOCAL_REMOTE` no equivale automáticamente a seguro por estar en una LAN. `PRIVATE_CLOUD` tampoco garantiza exclusividad, ausencia de subencargados o residencia adecuada; esas propiedades requieren evidencia.

En adopciones, traducir etiquetas históricas como `REMOTE LOCAL` únicamente mediante una migración explícita. Un valor desconocido produce `INVALID_MODE`; no debe convertirse silenciosamente en `AUTO`.

## 3. Pipeline de admisión: intersección, nunca compensación

El router debe evaluar, en este orden lógico, autorización del caso, posibilidad determinística, capacidad requerida, clasificación de datos, destinos admitidos, compatibilidad técnica, recursos, presupuesto y salud. Puede precalcular filtros sin ejecutar proveedores. La ruta elegible es la intersección de todas las condiciones.

Un modelo barato no compensa una infracción de privacidad. Un modelo privado no compensa falta de RAM. Un modelo capaz no compensa un presupuesto agotado. Si la intersección queda vacía, devolver un rechazo específico o una alternativa con pérdida de capacidad declarada. No degradar una respuesta jurídica sustentada a una opinión genérica manteniendo la misma etiqueta de calidad.

**Ejemplo hipotético:** resumir un manual público permite candidatos cloud aprobados; extraer campos de expedientes restringidos permite únicamente destinos privados aprobados. Si el servidor privado falla, el segundo caso permanece en cola o devuelve indisponibilidad. La falla no habilita una API pública.

La selección debe registrar `policy_version`, candidatos descartados y razones. Para información desconocida aplicar la clase más restrictiva razonablemente necesaria hasta confirmar su clasificación. Una indicación contenida dentro del documento analizado nunca cambia esa política.

## 4. Clasificación, minimización y límites de circulación

| Clase | Regla EOS de enrutamiento | Evidencia mínima |
|---|---|---|
| `PUBLIC` | Destinos aprobados por política | Fuente pública y propósito válido |
| `INTERNAL` | Proveedores expresamente aprobados | Acuerdo de tratamiento y configuración evaluados |
| `CONFIDENTIAL` | Local/privado; otra ruta requiere evaluación y autorización del tratamiento | Minimización, controles y revisión del responsable |
| `RESTRICTED` | Local/privado permitido expresamente | Aislamiento, acceso, retención y auditoría adecuados |

La clasificación aplica también a prompts, adjuntos, embeddings, caché, resultados, trazas y llamadas de herramientas. Pseudonimizar no convierte automáticamente un conjunto en público. Una anonimización declarada debe evaluar reidentificación y los metadatos conservados. Este manual establece controles internos; no sustituye la determinación legal del tratamiento aplicable.

Recuperar solo fragmentos necesarios; filtrar autorización antes de recuperar; deduplicar sin mezclar organizaciones; redactar secretos; limitar retención. El caché debe separar organización, usuario o dominio de autorización, política, modelo, versión y propósito. Invalidarlo cuando cambie el acceso. Prohibir reutilización cruzada que revele información privada.

**Prueba negativa:** dos organizaciones presentan prompts iguales con documentos diferentes; ningún resultado de una debe aparecer en la otra. **Aceptación:** el contexto enviado puede reconstruirse mediante identificadores y hashes autorizados sin publicar su contenido sensible.

## 5. Evaluación de recursos antes de descargar, cargar o aumentar concurrencia

Inventariar sistema operativo, CPU, GPU, RAM disponible, VRAM disponible, disco libre, carga actual, procesos relevantes, restricciones del runtime y prioridad del producto. Registrar hora y método de medición. La fotografía de recursos caduca; repetir la admisión si la carga cambió significativamente.

No estimar memoria solo por tamaño del archivo. Considerar pesos, runtime, buffers, activaciones, contexto, KV cache cuando corresponda, precisión, cuantización, número de solicitudes simultáneas, lote y copias temporales. RAM y VRAM son presupuestos separados: que los pesos quepan en GPU no prueba que la aplicación quepa en RAM. Offloading modifica consumo y latencia; requiere medición propia.

Fórmula conceptual de admisión:

```text
necesidad_estimada = pesos + runtime + buffers + contexto/KV + concurrencia + transitorios
margen_permitido = memoria_disponible - reserva_del_producto - reserva_del_sistema
admitir solo si necesidad_estimada <= margen_permitido
y el benchmark confirma latencia, estabilidad y ausencia de swapping perjudicial
```

Las reservas se fijan por perfil y medición, no por un porcentaje universal. La guía de 8/16/32 GB de SRC-03 y SRC-04 es orientativa: nunca se transforma en garantía de que cierto modelo funcionará. Si faltan medidas, clasificar `RESOURCE_UNVERIFIED`, limitar el ensayo y evitar activación en producción.

La admisión de concurrencia necesita reserva atómica de memoria estimada y cupos. Dos solicitudes no deben consumir simultáneamente el mismo margen. Aplicar cola acotada y deadline. Ante presión de memoria: detener nuevas admisiones, cancelar trabajo de menor prioridad si la política lo permite y descargar modelos ociosos después de finalizar sus solicitudes. No matar procesos ajenos.

## 6. Registro de modelos, fuentes y licencias

Cada artefacto debe tener identidad estable, revisión exacta, responsable y estado `DISCOVERED`, `QUARANTINED`, `EVALUATING`, `APPROVED`, `DEPRECATED` o `REMOVED`. El nombre comercial por sí solo no identifica pesos ni configuración.

**Ejemplo hipotético de registro; los valores no describen un modelo real:**

```yaml
id: extractor-interno-demo
revision: revision-inmutable-demo
provider_adapter: private_http_v1
execution_modes: [LOCAL_REMOTE]
artifact:
  source: pendiente-de-fuente-verificada
  publisher: pendiente
  hash: pendiente
  signature: no-disponible
  license_id: pendiente-de-revision
  license_text_ref: pendiente
  size_bytes: null
runtime:
  version: pendiente
  quantization: pendiente
  context_limit: null
  benchmark_ref: pendiente
capabilities: [DOCUMENT_ANALYSIS]
allowed_data_classes: [INTERNAL]
cost_policy_ref: pendiente
owner: responsable-por-asignar
last_verified: null
status: QUARANTINED
```

Un registro con campos críticos pendientes no habilita uso. Revisar origen, hash, firma si existe, licencia de pesos, tokenizer, datasets relevantes, dependencias y código asociado. Una firma válida confirma una procedencia, no calidad ni seguridad integral. No ejecutar código remoto del modelo por conveniencia sin revisar y autorizar su alcance.

La descarga requiere espacio para archivo temporal, artefacto final, extracción cuando exista y reserva de disco del producto. Descargar a cuarentena, validar integridad y registrar resultado antes de promover. Permitir cancelar, reanudar si es seguro y eliminar parciales propios. No borrar modelos compartidos sin inventario de referencias.

## 7. Contratos por capacidad, con límites observables

Mantener un catálogo explícito: `TEXT`, `CODE`, `VISION`, `OCR`, `EMBEDDINGS`, `AUDIO`, `SPEECH_TO_TEXT`, `TEXT_TO_SPEECH`, `CLASSIFICATION`, `RERANKING`, `IMAGE_GENERATION`, `DOCUMENT_ANALYSIS` y `AGENT_TOOLS`. Un adaptador declara cuáles soporta, con qué límites y cuáles pasaron evaluación.

**Esquema conceptual de solicitud; no es una API implementada:**

```json
{
  "contract_version": "eos.ai.v1",
  "request_id": "demo-request-001",
  "tenant_id": "demo-tenant",
  "capability": "CLASSIFICATION",
  "data_class": "INTERNAL",
  "input": {"text": "Texto hipotético", "labels": ["consulta", "incidente"]},
  "constraints": {
    "mode": "AUTO",
    "deadline_ms": 3000,
    "max_output_tokens": 64,
    "allowed_tools": [],
    "budget_reservation_id": "demo-reservation"
  },
  "policy_version": "demo-policy-v1"
}
```

Validar tipos, tamaños, rangos, valores del catálogo y límites antes de enviar. La clase declarada por el cliente puede endurecerse por el servidor; jamás se acepta una rebaja sin control. Resolver `tenant_id` e identidad desde contexto autenticado, no confiar en el identificador enviado. `budget_reservation_id` debe pertenecer a esa operación, actor y vigencia.

Una salida común incluye `success`, `request_id`, `status`, `data`, `error`, `provenance` y `usage`. La forma de `data` varía por capacidad. Embeddings declaran dimensión, modelo, revisión y normalización; OCR declara páginas y posición si el producto la exige; clasificación devuelve etiqueta válida; audio declara formato, duración y límites. Las afirmaciones de confianza solo se muestran si su significado y calibración están evaluados.

Errores mínimos: `AI_DISABLED`, `INVALID_REQUEST`, `CAPABILITY_UNSUPPORTED`, `PRIVACY_DENIED`, `RESOURCE_DENIED`, `BUDGET_DENIED`, `DEADLINE_EXCEEDED`, `PROVIDER_UNAVAILABLE`, `OUTPUT_INVALID`, `CANCELLED` y `TOOL_DENIED`. Incluir si el error admite reintento, sin exponer credenciales, prompts ni respuestas sensibles. Un texto malformado no se convierte en éxito por parecer legible.

## 8. Equivalencia de adaptadores, con evidencia por operación

La abstracción evita llamadas de negocio al SDK; no crea compatibilidad universal. Evaluar por separado tokenización, contexto máximo, salida estructurada, streaming, herramientas, imágenes, audio, embeddings, cancelación, límites, errores y políticas de retención. Un proveedor puede cumplir texto y fallar visión. Una API de apariencia compatible puede cambiar semántica.

Cada contrato aprobado necesita fixtures representativos y pruebas negativas. El adaptador traduce respuestas y rechazos al dominio EOS, pero conserva el detalle técnico necesario en registros protegidos. Si una función no existe, devolver `CAPABILITY_UNSUPPORTED`; no simularla sin declarar la transformación y su evaluación.

Migrar requiere comparación sobre casos del proyecto, tolerancias explícitas y revisión de efectos operativos. Cambiar únicamente un nombre de modelo no demuestra equivalencia. Para requisitos estrictos, mantener proveedor previo como rollback hasta completar validación, siempre dentro del conjunto de destinos permitidos.

## 9. Presupuesto reservado y costo conciliado

Definir límites por solicitud, usuario, organización, tarea, día y mes; moneda, fuente de tarifa, fecha, margen de incertidumbre y autoridad para modificarlos. Reservar atómicamente el costo máximo estimado antes de despachar, incluyendo reintentos autorizados y etapas del agente. Si no puede estimarse con una cota aceptable, rechazar o usar una modalidad controlada.

Estado de reserva: `RESERVED → DISPATCHED → SETTLED`; alternativas `CANCELLED` o `RECONCILIATION_PENDING`. Cuando el proveedor confirma uso, liquidar costo real y liberar diferencia. Si hay timeout después del despacho, no liberar todo suponiendo que no hubo consumo: registrar exposición pendiente y conciliar. La suma de reservado, consumido y pendiente no debe superar el límite aprobado.

Separar cache hit, estimación, uso confirmado y facturación conciliada. Los tokens no son moneda y los contadores de distintos proveedores no son necesariamente equivalentes. Un presupuesto diario agotado deshabilita candidatos pagados; una alternativa local solo procede si también pasa privacidad, capacidad y recursos.

**Prueba:** dos solicitudes simultáneas intentan reservar el último saldo; solo se admite la combinación dentro del tope. **Aceptación:** ningún cambio de modelo, retry o fallback elude la reserva.

## 10. Reintentos, streaming, cancelación y efectos de herramientas

Reintentar solo errores transitorios definidos, con límite, espera controlada, deadline total y reserva vigente. Validación fallida, falta de permisos y clasificación prohibida no se corrigen insistiendo. Evitar reintentos simultáneos descontrolados entre gateway, SDK y worker; asignar una capa responsable y contabilizar todas las tentativas.

El streaming entrega eventos con secuencia, `request_id`, tipo, fragmento y estado final. Un flujo interrumpido es `PARTIAL` o fallido, nunca éxito completo. La interfaz debe distinguir respuesta en curso, detenida y validada. No ejecutar herramientas a partir de argumentos incompletos ni publicar automáticamente fragmentos que esperan validación.

Cancelar detiene admisiones futuras y solicita interrupción al adaptador. Registrar si la cancelación fue confirmada, no soportada o incierta. El consumo ya incurrido permanece contabilizado. Un kill switch revoca herramientas y nuevas llamadas; no promete deshacer una acción externa ya efectuada.

Para herramientas con efectos, usar autorización independiente de la inferencia, validación de argumentos, identidad, alcance, clave de idempotencia y registro de resultado. La clave debe asociarse a parámetros normalizados y actor: reutilizarla con otro contenido produce conflicto. Si una operación quedó incierta, consultar su estado antes de repetir. Cuando el destino no soporta idempotencia, la capa local no puede garantizar exactamente una ejecución; requerir reconciliación o revisión humana.

## 11. Salud, circuit breakers y degradación deliberada

Medir disponibilidad, latencia, errores, cola, memoria, uso, costo, rechazo de políticas y calidad observada. Health check de transporte no acredita calidad. Definir ventanas, mínimos de muestra y umbrales por servicio. Los estados `CLOSED`, `OPEN` y `HALF_OPEN` gobiernan llamadas de prueba acotadas.

Separar fallas del proveedor, errores del cliente y rechazos de política. Abrir circuitos por una avalancha de solicitudes inválidas confunde diagnóstico. Un cambio de ruta debe volver a evaluar políticas. Mantener lista de fallbacks previamente aprobados, capacidad perdida y mensaje de producto. Ante falta de ruta, preferir una indisponibilidad explícita a una fuga de datos o resultado fabricado.

Auto-unload libera modelos ociosos con referencias activas igual a cero. Warming necesita ventana justificada y presupuesto de recursos; se suspende ante presión del producto. Registrar consumo después de descargar, porque algunos runtimes conservan cachés. Verificar recuperación real antes de afirmar que RAM o VRAM quedó libre.

## 12. Evaluación, actualización, canary y retirada

Technology Scout detecta candidatos; AI Architect define evaluación; Security e IP revisan riesgos y licencias; Resource Evaluator mide; el responsable del producto acepta tolerancias. El descubrimiento no autoriza descarga, publicación ni cambio de producción.

Evaluar con conjunto versionado, representativo y protegido, incluyendo errores, idiomas del usuario, documentos adversariales, datos faltantes, sobrelongitud y abstención. Registrar calidad por caso y grupo, latencia, recursos, costo y regresiones. No afirmar superioridad por un promedio si empeora una clase crítica.

Promover mediante canary acotado con métricas, duración, responsable, frenos y rollback. El porcentaje se fija por exposición aceptable; no aplicar una secuencia universal. Las pruebas con tráfico copiado requieren controles de privacidad, retención y ausencia de efectos duplicados.

Cambiar embeddings exige evaluar dimensión, normalización y espacio semántico. Incluso con dimensión igual, una revisión puede volver incompatibles vectores antiguos. Crear índice versionado, reindexar corpus autorizado, comparar recuperación y cambiar lecturas con rollback. No mezclar vectores incompatibles ni sobrescribir el único índice recuperable.

Retirar un modelo implica bloquear nuevas solicitudes, drenar o cancelar las vigentes, comprobar referencias, invalidar caché y conservar metadatos necesarios para auditoría. Eliminar pesos no borra automáticamente índices, resultados ni obligaciones de retención. Documentar cada componente afectado.

## 13. Operación administrativa y prueba de cierre

La ruta conceptual `/admin/engineering/ai` muestra estado, modo solicitado/efectivo, modelos, recursos, costo confirmado/pendiente, salud, fallbacks, actualización y fecha de verificación. Su existencia debe comprobarse en el proyecto receptor; este manual no la implementa.

Cada acción `Enable`, `Disable`, `Download`, `Load`, `Unload`, `Benchmark`, `Switch`, `Delete`, `Set fallback`, `Set budget` o `Set privacy` exige autorización del servidor, alcance y auditoría. Cambiar un presupuesto o relajar privacidad no es una preferencia visual. Registrar actor, instante, política, antes/después saneados, motivo, aprobación cuando corresponda y resultado. Un error de autorización no debe ejecutar parcialmente la acción.

La aceptación final exige evidencia de arranque `OFF`, contratos por capacidad, rechazo de ruta prohibida, admisión de recursos concurrentes, reserva de presupuesto concurrente, cancelación/resultado incierto, pruebas de herramientas y rollback de modelo. Marcar cada control `VERIFIED`, `PARTIAL`, `MISSING` o `NOT_APPLICABLE` con fundamento. Ningún ejemplo de este manual cuenta como prueba ejecutada.

**Instrucción operativa final:** conserva el puerto, enciende solo la capacidad necesaria, admite solicitudes únicamente dentro de todas las políticas, mide lo que realmente ocurre y permite retirar la IA sin abandonar la función esencial del producto.

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## 14. Contrato avanzado del propietario y alcance verificable

AI-1401. Pierre R. Boss exige que cada integración justifique una necesidad concreta del producto receptor antes de seleccionar infraestructura.
AI-1402. El responsable identifica el resultado determinístico que seguirá disponible cuando todas las capacidades probabilísticas estén deshabilitadas.
AI-1403. Una capacidad indispensable para el producto debe declararse como dependencia operativa con su indisponibilidad explícita y medible.
AI-1404. El puerto representa una frontera de arquitectura; su existencia documental no prueba procesos, endpoints ni adaptadores ejecutables.
AI-1405. La activación requiere un caso autorizado, un propietario identificable, criterios de utilidad y una política vigente.
AI-1406. El diseño distingue aceptación de riesgos, permiso de ejecución y comprobación técnica; ninguno sustituye los otros dos.
AI-1407. Un benchmark satisfactorio no concede permiso para transmitir documentos ni convertir una prueba gratuita en operación pagada.
AI-1408. Cada proyecto receptor declara qué partes de este manual implementa y cuáles conserva como capacidad futura.
AI-1409. La declaración de implementación enumera versiones, evidencia ejecutada, responsables y excepciones con fecha de revisión.
AI-1410. Una demostración con respuestas simuladas se identifica como simulación en registros, pruebas y mensajes de entrega.
AI-1411. Los identificadores de requisitos son estables; cambiar su significado requiere nueva revisión y trazabilidad de migración.
AI-1412. El implementador puede dividir servicios, pero conserva las invariantes de autorización, recursos, presupuesto y aislamiento.
AI-1413. El gateway no decide obligaciones legales; consume restricciones aprobadas y reporta evidencia insuficiente sin inventar conformidad.
AI-1414. Las cifras de este manual son hipotéticas y sirven para comprobar algoritmos, nunca para presupuestar proveedores actuales.
AI-1415. Los ejemplos no describen datos reales del propietario, clientes existentes ni resultados obtenidos en producción.
AI-1416. El diseño debe poder ejecutarse sin un SDK específico mediante contratos de capacidades y errores neutrales.
AI-1417. El responsable separa el protocolo del puerto, las bibliotecas adaptadoras y la configuración de cada proveedor.
AI-1418. Ningún consumidor de negocio recibe credenciales del proveedor ni implementa su propio mecanismo de fallback.
AI-1419. Una función que necesite excepciones al contrato publica su ampliación explícita y pruebas de compatibilidad.
AI-1420. La decisión de adopción identifica restricciones del host que pueden impedir aislamiento, cancelación o medición fiable.
AI-1421. Una restricción imposible de satisfacer produce capacidad limitada declarada, no una promesa documental sin implementación.
AI-1422. El contrato de aceptación distingue seguridad de transporte, permisos de datos, calidad semántica y disponibilidad efectiva.
AI-1423. La configuración de emergencia pertenece al control administrativo y no puede alterarse mediante prompts de usuarios.
AI-1424. El gateway conserva una ruta de retirada que no dependa del mismo modelo que se pretende deshabilitar.
AI-1425. Un incidente del proveedor no debe impedir consultar presupuestos, detener llamadas ni recuperar evidencia administrativa.
AI-1426. Los responsables de integración documentan límites conocidos antes de recomendar el sistema para tareas críticas.
AI-1427. La firma editorial identifica dirección y asistencia; no pretende representar una firma criptográfica de aprobación.
AI-1428. Las interpretaciones contradictorias se resuelven mediante la autoridad del entorno y el alcance humano autorizado.
AI-1429. El control de calidad exige revisar consecuencias observables, no solamente encontrar palabras requeridas en documentos.
AI-1430. La evidencia final debe permitir a otro ingeniero reconstruir una decisión sin acceder a secretos ni contenido innecesario.

## 15. Estado dormido, residencia y semántica estricta de OFF

AI-1501. El estado `OFF` rechaza inferencia antes de resolver proveedores, adquirir conexiones o iniciar procesos auxiliares.
AI-1502. Conservar interfaces estáticas y validadores ordinarios no equivale a mantener un modelo residente en memoria.
AI-1503. La prueba de arranque mide procesos hijos, conexiones salientes, archivos nuevos y memoria asociada al runtime.
AI-1504. El inventario distingue memoria ordinaria del producto y memoria adicional atribuible a la integración probabilística.
AI-1505. Los instaladores no descargan pesos por efecto secundario de registrar un adaptador deshabilitado.
AI-1506. Importar una biblioteca adaptadora no debe ejecutar inicialización remota ni descubrimiento autenticado de modelos automáticamente.
AI-1507. Si el SDK realiza actividad durante importación, aislarlo tras activación explícita o rechazar esa dependencia.
AI-1508. El puerto dormido puede mantener metadatos locales aprobados sin consultar catálogos externos al arrancar.
AI-1509. Los health checks en `OFF` prueban el puerto y su configuración, nunca despiertan proveedores dormidos.
AI-1510. El administrador distingue `configured`, `enabled`, `downloaded`, `loaded`, `serving` y `draining` como estados separados.
AI-1511. Un modelo descargado puede permanecer deshabilitado; una configuración válida puede carecer de pesos descargados.
AI-1512. El estado `loaded` requiere evidencia del runtime, no se deriva únicamente de una marca administrativa persistida.
AI-1513. Después de reiniciar, reconciliar estados persistidos con procesos reales antes de aceptar solicitudes nuevas.
AI-1514. Una carga interrumpida produce estado `failed` con recursos pendientes identificados y limpieza verificable.
AI-1515. Habilitar un proveedor no habilita automáticamente todas sus capacidades ni todos sus modelos anunciados.
AI-1516. Deshabilitar una función de producto no elimina reservas ni cancela solicitudes ya admitidas sin política específica.
AI-1517. Entrar en `OFF` bloquea nuevas admisiones y define explícitamente el tratamiento de operaciones vigentes.
AI-1518. El cambio a `OFF` incrementa una época de configuración usada para invalidar decisiones previamente calculadas.
AI-1519. Cada ejecución comprueba la época inmediatamente antes del primer efecto externo para evitar admisiones obsoletas.
AI-1520. Los adaptadores que no pueden interrumpir operaciones publican esta limitación y conservan su costo pendiente.
AI-1521. El apagado confirma cuándo cesan nuevas llamadas y cuándo terminan realmente los procesos residentes.
AI-1522. Liberar un objeto cliente no prueba que el proceso del proveedor haya terminado ni liberado memoria.
AI-1523. El runtime informa referencias activas, buffers retenidos y trabajos pendientes antes de descargar el modelo.
AI-1524. La medición posterior comprueba RAM y VRAM separadamente con tolerancias definidas para cachés del sistema.
AI-1525. No forzar terminación de procesos compartidos con otros productos sin propiedad e impacto previamente identificados.
AI-1526. La integración usa nombres y directorios propios para distinguir residuos de otros servicios legítimos del equipo.
AI-1527. Un archivo de configuración ausente conserva `OFF`; una configuración inválida devuelve diagnóstico específico sin activación.
AI-1528. Un cambio de entorno no puede interpretar una variable vacía como autorización implícita de modo automático.
AI-1529. La aceptación ejecuta el producto sin credenciales, sin conectividad y sin runtimes instalados para funciones independientes.
AI-1530. La recuperación de `OFF` requiere revalidar políticas y recursos; no reutiliza automáticamente reservas anteriores vencidas.

## 16. Modos, destino efectivo y restricciones de composición

AI-1601. El enumerado cerrado contiene `OFF`, `LOCAL`, `LOCAL_REMOTE`, `CLOUD_API`, `PRIVATE_CLOUD`, `HYBRID` y `AUTO`.
AI-1602. La serialización distingue mayúsculas y rechaza etiquetas nuevas hasta que exista migración versionada del esquema.
AI-1603. `LOCAL` significa ejecución en el mismo equipo autorizado, aunque el runtime tenga dependencias de descarga externas.
AI-1604. La dependencia de descarga se evalúa como operación separada y no se oculta bajo la etiqueta local.
AI-1605. `LOCAL_REMOTE` requiere identidad del destino, autenticación, transporte y propiedad operativa registrados en el perfil.
AI-1606. Un hostname privado no demuestra que el servidor pertenezca a la organización ni que carezca de terceros.
AI-1607. `CLOUD_API` identifica consumo de una API operada por tercero y activa los controles correspondientes de egress.
AI-1608. `PRIVATE_CLOUD` exige un perímetro definido; no infiere residencia, exclusividad o retención desde el nombre comercial.
AI-1609. `HYBRID` describe un grafo de etapas cuyos destinos se autorizan individualmente para sus entradas y salidas.
AI-1610. Una primera etapa local no convierte automáticamente en públicas las salidas usadas por una segunda etapa cloud.
AI-1611. `AUTO` selecciona entre candidatos aprobados y no incorpora proveedores descubiertos durante una solicitud del usuario.
AI-1612. La decisión conserva `requestedMode`, `effectiveMode`, `routeId`, `policyVersion` y causa de elección o rechazo.
AI-1613. El modo efectivo se registra por etapa cuando el plan mezcla inferencia, embeddings y herramientas externas.
AI-1614. Una capacidad no soportada en el modo solicitado devuelve incompatibilidad antes de reservar gasto de inferencia.
AI-1615. Un modo desconocido nunca se sustituye por otro aparentemente disponible para mejorar artificialmente la tasa de éxito.
AI-1616. La migración histórica guarda valor anterior, valor canónico, evidencia del significado y aprobación del responsable.
AI-1617. La política puede prohibir `AUTO` para un caso crítico aunque existan varios candidatos técnicamente válidos.
AI-1618. Un cambio de modo que amplíe destinos requiere autoridad sobre esa ampliación y revisión de datos transmitidos.
AI-1619. Cambiar `LOCAL` por `LOCAL_REMOTE` modifica una frontera de confianza y no es simple ajuste de rendimiento.
AI-1620. El esquema de configuración evita booleanos ambiguos como `cloudAllowed` que mezclen proveedores, casos y clases de datos.
AI-1621. Cada ruta declara capacidades, límites, aislamiento, egress, clasificación máxima y requisitos de presupuesto por etapa.
AI-1622. Los fallbacks pertenecen a la ruta autorizada y se validan con las mismas restricciones de la ejecución primaria.
AI-1623. Un fallback configurado pero vencido se excluye hasta completar nuevamente su aprobación y pruebas pertinentes.
AI-1624. La indisponibilidad de una ruta local no autoriza sacar datos del equipo para mantener continuidad aparente.
AI-1625. El mensaje del producto explica la indisponibilidad sin revelar listas privadas de proveedores o decisiones administrativas sensibles.
AI-1626. La composición híbrida fija orden, dependencias y máximo de etapas para impedir expansión recursiva de llamadas.
AI-1627. Una etapa que genera instrucciones para otra conserva esas instrucciones como datos sujetos a la política receptora.
AI-1628. La ruta final se inmoviliza mediante digest del plan antes de ejecución y cambios exigen nueva admisión.
AI-1629. La prueba de modos incluye rechazo de aliases, destino removido y escalamiento prohibido durante una falla parcial.
AI-1630. La aceptación compara modo declarado y tráfico observado para detectar adaptadores que transmiten fuera del perímetro esperado.

## 17. Puerto por capacidades y versionado independiente del proveedor

AI-1701. El contrato separa `generate`, `embed`, `rerank`, `classify`, `transcribe` y otras capacidades mediante interfaces explícitas.
AI-1702. Cada capacidad declara tipos de entrada, límites, modalidad de salida y errores semánticos antes de anunciar disponibilidad.
AI-1703. Un adaptador no anuncia soporte estructurado porque un modelo produzca ocasionalmente JSON válido en pruebas simples.
AI-1704. El consumidor solicita propiedades verificables como validación de esquema, cancelación confirmable o herramientas bloqueables por separado.
AI-1705. `capabilityVersion` identifica semántica del puerto; `adapterVersion` identifica traducción; `modelRevision` identifica comportamiento evaluado del modelo.
AI-1706. El plan registra las tres versiones para evitar atribuir una regresión exclusivamente al cambio de pesos.
AI-1707. Los cambios incompatibles del puerto incrementan su versión mayor y mantienen un periodo explícito de migración.
AI-1708. Agregar un campo opcional conserva compatibilidad solamente si consumidores anteriores toleran campos desconocidos de forma documentada.
AI-1709. Cambiar valores por defecto de truncamiento o temperatura puede alterar semántica aunque los tipos permanezcan idénticos.
AI-1710. Las ampliaciones de esquema incluyen migraciones, fixtures previos y criterios para rechazar configuraciones antiguas ambiguas.
AI-1711. El objeto de solicitud contiene identidad del caso, actor autenticado, tenant, propósito y clase de datos calculados confiablemente.
AI-1712. El cliente no puede autodeclarar una clasificación menos restrictiva para acceder a un proveedor de mayor exposición.
AI-1713. Los límites solicitados se intersectan con límites administrativos; pedir más tokens no amplía el presupuesto autorizado.
AI-1714. La respuesta separa resultado, estado de validación, uso conocido, uso pendiente y evidencia mínima de ejecución.
AI-1715. Un error normalizado incluye código estable, categoría, posibilidad de reintento y certeza sobre efectos ya realizados.
AI-1716. Los mensajes del proveedor se saneán antes de cruzar al producto para evitar secretos o instrucciones hostiles.
AI-1717. El SDK se encapsula en un adaptador sin importar tipos propietarios en las entidades de negocio.
AI-1718. La lógica de negocio no depende de identificadores comerciales; usa perfiles de capacidades aprobados y versionados.
AI-1719. Los parámetros propietarios se permiten únicamente en una extensión tipada con política y pruebas de sustitución.
AI-1720. La extensión no puede omitir autorización, medición, cancelación ni normalización de errores del contrato común.
AI-1721. El adaptador traduce límites de contexto utilizando el tokenizador correspondiente o una estimación conservadora expresamente marcada.
AI-1722. Contar caracteres como tokens sin margen y sin validación viola el contrato de admisión de contexto.
AI-1723. La negociación de capacidades utiliza información aprobada persistida y evita descubrimiento remoto no autorizado por solicitud.
AI-1724. Si una capacidad deja de estar disponible, invalidar su anuncio antes de aceptar trabajo que dependa de ella.
AI-1725. La conformidad del adaptador se prueba con entradas vacías, excedidas, inválidas, adversariales y cancelación en distintas fases.
AI-1726. Una respuesta parcial no se convierte en éxito simplemente porque el proveedor devolvió un código HTTP satisfactorio.
AI-1727. La sustitución compara errores, uso, esquema, evidencia y calidad; compilar una interfaz común no demuestra equivalencia funcional.
AI-1728. Un perfil de proveedor puede tener capacidades incompatibles entre modelos y debe declararlas con granularidad suficiente.
AI-1729. El contrato permite rechazar funcionalidades que requieran persistencia remota no admitida por la política del caso.
AI-1730. El informe de conformidad identifica pruebas omitidas y no describe un adaptador incompleto como proveedor universal.

## 18. Solicitud canónica, identidad y separación de datos confiables

AI-1801. La solicitud interna es inmutable después de admisión y contiene un identificador generado por el servidor.
AI-1802. `requestId` identifica ejecución; `correlationId` agrupa trazas; `idempotencyKey` identifica una intención repetible con efectos.
AI-1803. Un identificador de correlación aportado por cliente se normaliza y nunca sustituye identidad autenticada del actor.
AI-1804. El servidor obtiene `tenantId` de la sesión y verifica pertenencia antes de consultar documentos o cachés.
AI-1805. La clasificación se deriva del contenido y sus fuentes; una etiqueta aportada por usuario puede aumentar restricciones.
AI-1806. El objeto canónico conserva `purposeId`, `caseVersion`, `inputManifest`, `deadline`, `outputContract` y `policySnapshotId`.
AI-1807. `inputManifest` identifica cada adjunto por digest, tamaño, tipo aprobado, autorización y versión del documento.
AI-1808. Las rutas de archivos son referencias internas verificadas y no aceptan traversal, enlaces inesperados ni dispositivos especiales.
AI-1809. La validación de MIME compara declaración y contenido cuando el riesgo justifique inspección del archivo recibido.
AI-1810. Los límites de adjuntos contemplan tamaño descomprimido, cantidad, profundidad y costo de análisis antes de extracción.
AI-1811. Las instrucciones confiables del caso se almacenan separadas de documentos, comentarios, páginas y respuestas del modelo.
AI-1812. El empaquetador etiqueta origen y confianza de cada fragmento sin depender solamente de separadores textuales decorativos.
AI-1813. Una cita documental que ordena cambiar permisos sigue siendo contenido citado y no modifica el plan autorizado.
AI-1814. El contexto recuperado incluye permisos vigentes y no hereda autorización de una copia almacenada semanas antes.
AI-1815. El conjunto final de documentos se congela para la solicitud y cambios posteriores requieren una nueva evaluación.
AI-1816. Los hashes se calculan sobre una representación especificada para que normalizaciones distintas no generen evidencia equívoca.
AI-1817. La normalización preserva elementos con significado legal o técnico y registra transformaciones destructivas cuando sean necesarias.
AI-1818. El campo de idioma describe una preferencia de salida; no altera controles de privacidad ni políticas de herramientas.
AI-1819. La configuración de generación efectiva se registra después de aplicar máximos y mínimos administrativos del caso.
AI-1820. Un prompt no puede solicitar `ignoreBudget`, `disableAudit` o equivalentes mediante extensiones libres de configuración.
AI-1821. Los campos desconocidos se rechazan o ignoran conforme a versión explícita, evitando comportamiento distinto entre adaptadores.
AI-1822. El esquema interno impide que parámetros arbitrarios del cliente lleguen directamente a las opciones propietarias del SDK.
AI-1823. La validación distingue sintaxis inválida, identidad ausente, recurso inaccesible y política incumplida sin filtrar información privada.
AI-1824. Los rechazos ocurren antes de generar embeddings si la autorización sobre los documentos no puede demostrarse.
AI-1825. La solicitud conserva únicamente los datos indispensables para producir el resultado y verificar su uso autorizado.
AI-1826. Un expediente completo no se envía por conveniencia si bastan fragmentos aprobados con procedencia verificable.
AI-1827. Los campos de respuesta que puedan revelar información de otra persona requieren los mismos controles que las entradas.
AI-1828. La prueba adversarial intenta falsificar tenant, actor, propósito, clase de datos y versión de política desde el cliente.
AI-1829. La evidencia del rechazo conserva códigos y referencias saneadas, evitando registrar el payload hostil íntegro por defecto.
AI-1830. El contrato canónico se publica como esquema hipotético implementable y nunca como endpoint existente en esta biblioteca.

## 19. Compilador de rutas y prueba de intersección de políticas

AI-1901. El compilador transforma una solicitud validada en un plan ejecutable o un rechazo con causas estructuradas.
AI-1902. Su primera fase resuelve identidad, propósito y autoridad antes de listar candidatos que puedan recibir contenido.
AI-1903. La segunda fase aplica clasificación y restricciones de destino sin invocar modelos ni herramientas para decidir permisos.
AI-1904. La tercera fase verifica capacidades, contrato de salida y compatibilidad de contexto para cada candidato superviviente.
AI-1905. La cuarta fase estima recursos, costo y tiempo considerando el trabajo completo, sus reintentos permitidos y etapas.
AI-1906. La quinta fase reserva límites y comprueba salud inmediatamente antes de producir un plan comprometido.
AI-1907. Elegibilidad significa pertenencia simultánea a todas las restricciones; la puntuación no puede compensar incumplimientos obligatorios.
AI-1908. Un ranking de calidad se aplica solamente después de excluir destinos, modelos y operaciones no autorizados.
AI-1909. La explicación del rechazo distingue filtros terminales y restricciones circunstanciales que podrían resolverse con recursos adicionales.
AI-1910. Los criterios de rechazo no revelan nombres de documentos o proveedores cuya existencia deba permanecer privada.
AI-1911. El plan registra candidatos considerados mediante identificadores autorizados, versiones y causas sin copiar contenido sensible.
AI-1912. La decisión puede ser reproducible con snapshots de políticas y catálogos sin garantizar respuesta probabilística idéntica.
AI-1913. La ausencia de una ruta aprobada produce `NO_ELIGIBLE_ROUTE` y no dispara descubrimiento abierto de servicios.
AI-1914. Una alternativa de menor capacidad requiere etiquetar la pérdida y cumplir el contrato del producto correspondiente.
AI-1915. El router no transforma extracción validada en opinión libre conservando el mismo estado de éxito del consumidor.
AI-1916. La política de desempate es determinística o registra su semilla, evitando decisiones inexplicables bajo carga equivalente.
AI-1917. Cada etapa del plan incluye presupuesto propio y el límite acumulado del caso para impedir gasto distribuido excesivo.
AI-1918. La salud de un candidato caduca y no puede reutilizarse indefinidamente para justificar admisión tras un incidente.
AI-1919. El compilador comprueba la época de autorización, configuración y presupuesto antes de entregar el plan al ejecutor.
AI-1920. Si una época cambió durante compilación, descartar el plan y liberar reservas sin enviar información al proveedor.
AI-1921. Un plan firmado internamente verifica integridad, no permite ampliar autoridad respecto de la solicitud humana original.
AI-1922. El ejecutor verifica que adaptador, modelo y destino coincidan exactamente con las referencias compiladas y aprobadas.
AI-1923. Una resolución DNS distinta de la aprobada exige reevaluación de egress y nunca confianza automática en el hostname.
AI-1924. La caché de planes conserva restricciones y caducidad, pero no sustituye admisión de recursos ni reserva financiera.
AI-1925. La política puede aceptar cambios de carga inocuos y requiere recompilar cuando alteren una restricción material.
AI-1926. La prueba de intersección genera candidatos que satisfacen cada restricción aislada pero ninguno satisface todas simultáneamente.
AI-1927. El resultado esperado de esa prueba es rechazo, aun cuando un promedio de puntuaciones parezca suficiente.
AI-1928. La prueba de concurrencia revoca un proveedor entre compilación y ejecución y comprueba ausencia de egress posterior.
AI-1929. El responsable conserva diagramas del pipeline con fronteras confiables, puntos de reserva y estados de fallo.
AI-1930. La aceptación requiere explicar una decisión difícil mediante evidencia del compilador, sin recurrir a razonamiento oculto del modelo.

## 20. Catálogo aprobado de proveedores y privacidad operacional

AI-2001. El catálogo contiene proveedores aprobados por caso y clasificación, con vigencia, responsable y evidencia de restricciones.
AI-2002. Registrar operador, destinos, regiones permitidas, subprocesadores conocidos, tratamiento de datos y retención relevante según evidencia disponible.
AI-2003. Una condición desconocida se marca desconocida y puede impedir admisión cuando la política exige certeza suficiente.
AI-2004. La aprobación distingue inferencia, archivos persistidos, entrenamiento, telemetría y asistencia técnica como usos potencialmente diferentes.
AI-2005. Una opción comercial de exclusión de entrenamiento no demuestra automáticamente ausencia de retención ni acceso operativo.
AI-2006. La configuración efectiva del proveedor se comprueba y sus cambios relevantes invalidan aprobaciones que dependían de ella.
AI-2007. El catálogo no se actualiza desde respuestas del modelo ni desde recomendaciones incrustadas en páginas recuperadas.
AI-2008. La incorporación de un proveedor nuevo requiere revisión de contrato técnico, datos, credenciales y costo antes del ensayo.
AI-2009. La prueba con datos sintéticos conserva límites de red y gasto aunque no transmita información sensible.
AI-2010. Un proveedor aprobado para contenido público puede permanecer prohibido para identificadores personales y expedientes restringidos.
AI-2011. La aprobación de una organización no sustituye consentimiento o autoridad del actor sobre el recurso particular consultado.
AI-2012. Las claves de acceso pertenecen al secret manager del proyecto y se entregan solamente al adaptador correspondiente.
AI-2013. Rotar una clave no invalida únicamente conexiones; también revisar procesos, volcados y canales que pudieron conservarla.
AI-2014. El gateway no muestra tokens completos en administración ni permite exportarlos mediante herramientas del modelo.
AI-2015. La renovación de credenciales utiliza identidad técnica acotada y evita privilegios administrativos innecesarios del proveedor.
AI-2016. Las políticas de retención se aplican a entradas, resultados, archivos, embeddings, cachés, errores y registros auxiliares.
AI-2017. Una anonimización propuesta incluye amenaza de reidentificación, metadatos preservados y comprobación independiente del resultado obtenido.
AI-2018. Pseudónimos estables pueden permitir correlación; tratarlos según riesgo efectivo y no como contenido necesariamente público.
AI-2019. La minimización excluye campos irrelevantes antes de transmisión y registra únicamente la transformación necesaria para auditoría.
AI-2020. El fallback nunca relaja clasificación, retención, ubicación o permisos con el argumento de que el proveedor principal falló.
AI-2021. Una política más restrictiva puede entrar en vigor inmediatamente y obliga a invalidar planes pendientes incompatibles.
AI-2022. Relajar una política requiere autoridad correspondiente y prueba de que no contradice restricciones superiores vigentes.
AI-2023. La revisión de privacidad incluye personas mencionadas indirectamente y datos derivados que revelan atributos sensibles del expediente.
AI-2024. Las solicitudes de soporte técnico al proveedor se preparan con reproducción sintética y logs saneados por defecto.
AI-2025. La exportación de una traza sensible requiere permiso específico y no se justifica solamente por una urgencia operativa.
AI-2026. Las revisiones programadas detectan aprobación vencida, cambios contractuales documentados y configuraciones que ya no coinciden.
AI-2027. Los registros distinguen evidencia observada, declaración del proveedor y supuesto operativo aceptado con vencimiento explícito.
AI-2028. La prueba adversarial solicita un proveedor barato no aprobado y comprueba rechazo pese a presupuesto disponible.
AI-2029. La prueba de retiro elimina una aprobación durante carga elevada y verifica exclusión consistente en todos los ejecutores.
AI-2030. La aceptación no usa sellos comerciales como sustituto de comprobar controles que el producto realmente necesita.

## 21. Egress, ejecución aislada y fronteras del sandbox

AI-2101. El proceso de inferencia y el proceso de herramientas poseen permisos separados y listas explícitas de destinos.
AI-2102. El sandbox niega red, filesystem y ejecución por defecto, habilitando únicamente capacidades necesarias para el caso aprobado.
AI-2103. Una lista de dominios permitidos debe resistir redirecciones, cambios DNS y accesos a rangos internos prohibidos.
AI-2104. Validar URLs normalizadas y destino resuelto para impedir acceso a metadata de infraestructura o servicios administrativos.
AI-2105. La validación se repite tras redirección y no confía en la primera URL como garantía del destino final.
AI-2106. El adaptador no hereda indiscriminadamente variables de entorno, credenciales del usuario ni sockets del host.
AI-2107. Los directorios de trabajo contienen únicamente archivos necesarios y separan entradas de salidas con permisos específicos.
AI-2108. Los modelos no reciben rutas que permitan enumerar documentos de otros tenants o proyectos del equipo.
AI-2109. Las herramientas ejecutables se identifican por artefacto aprobado y argumentos tipados, evitando shells libres de propósito general.
AI-2110. Si un caso necesita shell, su autoridad y límites se documentan independientemente de la capacidad de generación.
AI-2111. El aislamiento limita CPU, memoria, disco, tiempo y procesos hijos, incluyendo recursos usados por parsers documentales.
AI-2112. Un timeout solicita terminación del grupo de procesos y verifica residuos antes de liberar la reserva de recursos.
AI-2113. El sandbox conserva evidencia del exit code y de los efectos posibles sin almacenar el entorno completo.
AI-2114. Las salidas grandes se limitan y no pueden consumir disco ilimitado mediante generación de archivos intermedios.
AI-2115. Los mounts de lectura no se convierten en escritura por una instrucción emitida por el modelo o documento.
AI-2116. Un contenedor no acredita aislamiento suficiente si comparte sockets privilegiados o credenciales administrativas del host.
AI-2117. El uso de Docker es una opción técnica evaluada, no una condición universal de conformidad del puerto.
AI-2118. Los runtimes nativos pueden satisfacer el contrato mediante controles equivalentes comprobados en el entorno receptor.
AI-2119. La evaluación incluye fuga por logs, nombres de archivos, stderr y mensajes de errores del runtime.
AI-2120. El modelo no puede elegir libremente el destino de una carga ni presentar un enlace como autorización de egress.
AI-2121. Un plugin del runtime que amplíe permisos constituye cambio de perímetro y exige nueva revisión antes de habilitarlo.
AI-2122. La lista de herramientas disponibles se genera desde política, no desde capacidades anunciadas espontáneamente por el proveedor.
AI-2123. Las respuestas del proveedor se consideran entradas no confiables antes de interpretar URLs, rutas o comandos propuestos.
AI-2124. Los archivos producidos se inspeccionan y etiquetan según su origen antes de entregarlos a sistemas consumidores.
AI-2125. Una salida ejecutable no se ejecuta automáticamente por haber sido generada dentro de un entorno previamente aprobado.
AI-2126. El administrador identifica qué restricciones son impuestas por sistema operativo y cuáles dependen del comportamiento del adaptador.
AI-2127. Una protección basada únicamente en prompt se documenta como orientación y no como control técnico de aislamiento.
AI-2128. La prueba intenta leer secrets, escribir fuera del workspace y contactar un destino interno mediante redirección.
AI-2129. La recuperación destruye el entorno comprometido y reconcilia efectos posibles antes de reanudar ejecución en uno nuevo.
AI-2130. La aceptación conserva evidencias negativas reproducibles de aislamiento y sus limitaciones reales para cada runtime habilitado.

## 22. Admisión de memoria, contexto y concurrencia con reservas

AI-2201. La admisión utiliza memoria disponible medida y reservas vigentes, evitando tomar RAM nominal como capacidad libre.
AI-2202. El presupuesto de RAM separa producto, sistema, runtime, pesos residentes, buffers, activaciones y margen de incertidumbre.
AI-2203. El presupuesto de VRAM incorpora pesos, contexto, KV cache, kernels, buffers temporales y concurrencia real del runtime.
AI-2204. Una copia transitoria durante carga puede superar consumo estable; reservar para el máximo observado del ciclo completo.
AI-2205. La estimación de KV cache identifica arquitectura, precisión, capas, tamaño de contexto y sesiones concurrentes del candidato.
AI-2206. Usar una fórmula documentada cuando se conozcan parámetros y una envolvente medida cuando el runtime los oculte.
AI-2207. Las estimaciones conservan unidad, método, versión y confianza para impedir confusión entre bytes, megabytes y gibibytes.
AI-2208. La reserva de contexto contempla entrada, instrucciones, herramientas, recuperación y máximo de salida antes de admitir generación.
AI-2209. El truncamiento exige una política que preserve fragmentos críticos y explique al consumidor la pérdida de información.
AI-2210. Una función que requiera totalidad documental rechaza contexto insuficiente en lugar de truncar silenciosamente evidencia indispensable.
AI-2211. La admisión compara requisitos agregados con capacidad útil después de restar reservas de solicitudes ya comprometidas.
AI-2212. Reservar mediante operación atómica o serialización equivalente para evitar que dos ejecutores consuman el mismo margen disponible.
AI-2213. El registro de reserva identifica solicitud, recurso, cantidad, propietario, vencimiento, estado y versión de medición utilizada.
AI-2214. Un lease vencido no libera recursos que continúan ocupados sin verificar primero estado real del proceso propietario.
AI-2215. El reconciliador diferencia trabajo muerto, trabajo lento y trabajo cuyo estado resulta incierto tras perder comunicación.
AI-2216. La renovación del lease requiere evidencia de actividad y no puede superar el límite temporal aprobado del caso.
AI-2217. La cola aplica límites por tenant y caso para evitar que un actor agote recursos compartidos legítimos.
AI-2218. Los límites de concurrencia distinguen procesos, modelos, sesiones, tareas auxiliares y operaciones de carga potencialmente simultáneas.
AI-2219. Un runtime que agrupa solicitudes conserva su batch máximo y mide interacción entre longitud y consumo de memoria.
AI-2220. El offloading modifica RAM, VRAM, transferencia y latencia; su aprobación depende de medición bajo carga representativa.
AI-2221. La presión de memoria del producto puede suspender warming y rechazar nuevas sesiones sin matar trabajo autorizado arbitrariamente.
AI-2222. El scheduler admite prioridades explícitas y protege capacidad mínima del producto determinístico frente a inferencia oportunista.
AI-2223. La reserva conserva margen operativo y no intenta alcanzar uso nominal completo de memoria para mejorar utilización superficial.
AI-2224. La expiración de una medición exige actualizarla cuando cambios de carga alteren materialmente la capacidad disponible.
AI-2225. El sistema reporta diferencia entre consumo estimado y observado para calibrar perfiles de recursos por versión.
AI-2226. Una desviación superior a tolerancia reduce admisión o bloquea el perfil hasta completar evaluación del comportamiento nuevo.
AI-2227. La prueba concurrente inicia varias admisiones desde la misma fotografía y verifica que solo las compatibles obtengan reservas.
AI-2228. La prueba de carga fallida confirma limpieza de buffers temporales y conservación de evidencia del pico alcanzado.
AI-2229. La recuperación de un proceso huérfano requiere confirmar su propiedad antes de detenerlo o reasignar sus recursos.
AI-2230. La aceptación incluye presión de RAM y VRAM por separado, sin extrapolar resultados desde un único equipo.

## 23. Artefactos, descarga confiable y cuarentena de modelos

AI-2301. Descargar pesos es una acción independiente de activar inferencia y necesita autorización sobre red, disco y licencia.
AI-2302. El catálogo de artefactos registra origen aprobado, digest esperado, formato, tamaño previsto y evidencia de licencia.
AI-2303. Un nombre de modelo no identifica bytes; fijar revisión o digest evita recibir cambios silenciosos bajo el mismo alias.
AI-2304. La descarga escribe en ubicación de cuarentena y no expone archivos parciales al cargador del runtime.
AI-2305. Reservar espacio para descarga, descompresión, validación y coexistencia temporal con la versión recuperable anterior del modelo.
AI-2306. El descargador limita tamaño, redirecciones, tiempo y destinos para impedir agotamiento por artefactos inesperados o enlaces hostiles.
AI-2307. Un digest incorrecto bloquea promoción aunque el archivo parezca cargable y el proveedor publique un nombre conocido.
AI-2308. La verificación criptográfica demuestra integridad respecto de una referencia confiable, no calidad ni ausencia absoluta de riesgos.
AI-2309. El origen del digest también requiere confianza; calcularlo después de descargar no valida autenticidad del artefacto recibido.
AI-2310. Los formatos capaces de ejecutar código requieren controles reforzados y aprobación explícita del comportamiento de carga.
AI-2311. Las opciones equivalentes a confiar código remoto permanecen deshabilitadas salvo decisión documentada y sandbox verificado.
AI-2312. Un repositorio público puede contener código peligroso; visibilidad pública no constituye aprobación técnica del modelo descargado.
AI-2313. La licencia se evalúa para distribución, uso comercial, modificaciones y dependencias según las condiciones realmente documentadas.
AI-2314. Una licencia desconocida impide usos que exijan derechos claros y se registra como revisión pendiente del activo.
AI-2315. La licencia de pesos puede diferir de la licencia del runtime, tokenizer, dataset y código auxiliar de carga.
AI-2316. La inspección crea un inventario de componentes y conserva sus referencias sin copiar afirmaciones legales no verificadas.
AI-2317. Un artefacto retirado por seguridad se bloquea por digest y no solamente por el nombre de la ruta local.
AI-2318. La cuarentena utiliza permisos que impiden ejecución automática desde exploradores, notebooks o servicios que vigilen el directorio.
AI-2319. La promoción mueve un artefacto validado a una ubicación administrada mediante operación controlada y registro de evidencia.
AI-2320. Una promoción fallida conserva estado íntegro y no mezcla fragmentos de versiones distintas en el mismo directorio.
AI-2321. El cargador exige estado aprobado y digest vigente antes de mapear pesos o ejecutar inicialización del runtime.
AI-2322. El administrador diferencia descargar, validar, aprobar, cargar y servir para impedir atajos mediante un botón genérico.
AI-2323. El control de descarga respeta límites de red corporativa y no evita bloqueos utilizando mirrors no aprobados.
AI-2324. Un mirror requiere su propia validación de origen y no hereda confianza automática del catálogo original.
AI-2325. La reanudación de descarga valida metadatos y segmentos para impedir combinar contenido cambiado entre dos intentos separados.
AI-2326. Los archivos comprimidos se inspeccionan contra traversal, enlaces y expansión excesiva antes de extraer dentro de cuarentena.
AI-2327. La prueba introduce archivo truncado, digest alterado, licencia ausente y código remoto requerido por el cargador.
AI-2328. El resultado esperado conserva bloqueo de carga y evidencia diferenciada para cada incumplimiento, sin activar fallback externo.
AI-2329. La recuperación elimina solamente residuos propios verificados y conserva la versión anterior utilizable cuando esté autorizada.
AI-2330. La aceptación acredita procedencia e integridad del artefacto concreto, sin convertirlas en certificación de seguridad del modelo.

## 24. Cargar, descargar de memoria y eliminar sin confundir efectos

AI-2401. `Load` consume recursos y puede ejecutar código de inicialización; requiere artefacto aprobado y reserva de admisión.
AI-2402. `Unload` retira residencia de memoria y no elimina necesariamente archivos, índices, respuestas ni registros relacionados con el modelo.
AI-2403. `Delete` elimina un artefacto administrado y tiene precondiciones diferentes de detener un proceso que todavía lo utiliza.
AI-2404. Una eliminación solicita digest y versión exacta para impedir retirar el modelo equivocado por coincidencia de nombres.
AI-2405. El estado operativo sigue `available → loading → loaded → serving → draining → unloading → available` según evidencia del runtime.
AI-2406. Las transiciones fallidas registran `failed` y recursos pendientes, sin declarar completado el paso que no pudo verificarse.
AI-2407. Una carga concurrente del mismo artefacto se coordina mediante lease exclusivo o reutilización segura de instancia administrada.
AI-2408. Los consumidores mantienen referencias contadas para impedir unloading mientras existan solicitudes que necesitan el modelo residente.
AI-2409. El drenaje bloquea nuevas referencias, fija plazo y trata solicitudes vigentes conforme a política de cancelación del caso.
AI-2410. Un trabajo que excede el plazo de drenaje no se abandona sin registrar consumo y efectos que pudieron producirse.
AI-2411. El administrador puede preferir esperar cuando cancelar cause riesgo mayor que mantener temporalmente la reserva existente.
AI-2412. Una emergencia que exige terminación forzada conserva identidad del proceso y evidencia de impacto potencial antes de actuar.
AI-2413. La liberación de referencias es idempotente y no permite contadores negativos por callbacks duplicados del adaptador.
AI-2414. La falla del cliente no libera automáticamente la referencia si el servidor sigue procesando la solicitud originalmente admitida.
AI-2415. El reconciliador detecta discrepancias entre referencias persistidas y sesiones observadas en el runtime realmente activo.
AI-2416. La carga nueva no desplaza una versión necesaria para rollback sin comprobar recursos y exposición de esa decisión.
AI-2417. El warming tiene presupuesto temporal y se suspende cuando compite con funciones de mayor prioridad del producto.
AI-2418. La política de inactividad considera ausencia de referencias, trabajos en cola y operaciones administrativas que requieren residencia.
AI-2419. La fecha del último acceso no basta para unloading si una solicitud larga continúa activa sin emitir tokens.
AI-2420. La descarga de memoria mide consumo posterior y permite cachés conocidas solamente dentro de límites documentados del host.
AI-2421. Si el runtime conserva memoria considerable, identificar el mecanismo de liberación antes de afirmar retirada operativa completa.
AI-2422. Eliminar pesos requiere resolver índices y cachés dependientes según reglas de retención y compatibilidad del producto.
AI-2423. Conservar evidencia de versión retirada no exige retener contenido sensible ni un artefacto comprometido en almacenamiento activo.
AI-2424. Un modelo compartido por varios proyectos necesita ownership administrativo para evitar que un proyecto elimine recursos de otro.
AI-2425. La administración consulta referencias cruzadas y presenta consecuencias concretas antes de ejecutar eliminación autorizada del artefacto.
AI-2426. La prueba de carrera inicia `Load`, `Unload` y `Delete` simultáneamente y verifica transiciones consistentes bajo exclusión.
AI-2427. La prueba de caída durante carga confirma que el siguiente arranque detecta estado incompleto y no anuncia disponibilidad.
AI-2428. La prueba de drenaje confirma que solicitudes nuevas son rechazadas mientras las anteriores finalizan o quedan reconciliadas.
AI-2429. La recuperación evita reutilizar un proceso de versión incierta y verifica digest de la instancia antes de servir nuevamente.
AI-2430. La aceptación diferencia resultados de disco, memoria y disponibilidad con evidencia separada para cada efecto administrativo realizado.

## 25. Presupuesto financiero: reserva atómica, liquidación y exposición

AI-2501. El presupuesto mantiene límites por organización, caso, actor y periodo, con una moneda de contabilidad explícita.
AI-2502. Registrar importes mediante representación decimal o enteros escalados evita errores acumulados de coma flotante en límites estrictos.
AI-2503. La estimación usa una tabla aprobada con fecha, moneda, unidad y alcance; no contiene precios actuales inventados.
AI-2504. La tabla distingue entrada, salida, contexto almacenado, herramientas y cargos adicionales cuando sean relevantes para el proveedor.
AI-2505. Si un cargo potencial no puede acotarse, rechazar o exigir un límite comercial verificable antes de admitir ejecución.
AI-2506. El hold reserva costo máximo autorizado del intento y exposición adicional de los reintentos que el plan permite.
AI-2507. La operación de reserva compara `spent + held + unresolved + requestedHold` contra el límite en una transacción atómica.
AI-2508. Las reservas por niveles de presupuesto se adquieren conjuntamente o se compensan cuando alguna restricción no puede satisfacerse.
AI-2509. Un hold registra solicitud, moneda, estimación, tarifa versionada, vencimiento y límites de consumo autorizados al adaptador.
AI-2510. La liquidación distingue consumo confirmado, estimado y pendiente; no convierte ausencia de reporte en gasto igual a cero.
AI-2511. El proveedor puede facturar trabajo después de cancelar; conservar exposición pendiente hasta obtener evidencia suficiente del consumo.
AI-2512. Una reserva vencida no se libera si existe incertidumbre de facturación y la política exige cubrir esa exposición.
AI-2513. La reconciliación compara reportes de uso con evidencia local y maneja discrepancias sin sobrescribir registros originales del periodo.
AI-2514. La liquidación es idempotente por evento y solicitud para impedir sumar dos veces el mismo consumo confirmado.
AI-2515. Una actualización de uso tardía produce asiento adicional trazable y no cambia silenciosamente el historial financiero anterior.
AI-2516. El tipo de cambio conserva fecha, fuente aprobada y margen de variación cuando costos y límites usan monedas distintas.
AI-2517. Recalcular una estimación por tipo de cambio no altera el monto ya liquidado sin una política contable explícita.
AI-2518. La tasa estimada puede diferir del importe facturado; reportar ambos sin presentar estimación como comprobante financiero.
AI-2519. Un reintento consume el presupuesto restante y requiere un nuevo hold cuando la reserva original no cubra su exposición.
AI-2520. Los límites de token del adaptador se derivan de la reserva y no permiten generación ilimitada hasta alcanzar éxito.
AI-2521. La política establece alertas antes del límite y denegación efectiva en el límite, sin depender de notificaciones humanas.
AI-2522. Aumentar un presupuesto es acción administrativa autorizada y no respuesta automática al rechazo de una solicitud del modelo.
AI-2523. Un tenant no puede gastar el saldo reservado de otro aunque ambos compartan una credencial comercial del proveedor.
AI-2524. Los créditos promocionales se registran como condición verificable y no justifican declarar inexistente la exposición futura del producto.
AI-2525. El scheduler conoce hold disponible antes de entrar a cola para evitar inmovilizar recursos con presupuestos inviables.
AI-2526. Una cola larga puede vencer estimaciones y exige renovar admisión sin acumular holds duplicados por la misma solicitud.
AI-2527. La prueba lanza diez reservas simultáneas cuyo total excede saldo y verifica que nunca se sobrepase el límite.
AI-2528. La prueba de reporte duplicado conserva gasto estable y la de uso tardío actualiza exposición con causalidad verificable.
AI-2529. La recuperación de caída del ejecutor conserva holds inciertos y reconcilia facturación antes de permitir gasto adicional equivalente.
AI-2530. La aceptación reporta costo confirmado, máximo reservado y exposición pendiente por separado, con moneda y periodo explícitos.

## 26. Salida estructurada, validación y límites de reparación

AI-2601. El contrato de salida utiliza esquema versionado y define tipos, campos requeridos, límites y valores enumerados admisibles.
AI-2602. El texto generado no se convierte en entidad de negocio antes de superar validación sintáctica y semántica pertinente.
AI-2603. Un JSON válido puede contener valores imposibles; comprobar reglas determinísticas como fechas, sumas e identificadores independientes del modelo.
AI-2604. Las referencias a documentos se validan contra el manifiesto autorizado y no se aceptan citas inventadas como evidencia.
AI-2605. El consumidor distingue `VALID`, `INVALID`, `PARTIAL`, `ABSTAINED` y `UNCERTAIN` según el contrato concreto del caso.
AI-2606. Una abstención útil puede cumplir aceptación cuando el objetivo exige evitar respuestas infundadas frente a evidencia insuficiente.
AI-2607. La reparación de formato tiene número máximo de intentos, presupuesto propio y restricciones de privacidad idénticas al original.
AI-2608. Una reparación no puede agregar documentos, herramientas o autoridad que la solicitud original no autorizaba al ejecutor.
AI-2609. El validador nunca ejecuta código, expresiones o plantillas incluidas por el modelo dentro de campos aparentemente estructurados.
AI-2610. Los campos destinados a HTML se escapan o sanitizan según contexto antes de mostrarlos a usuarios finales.
AI-2611. Un enlace devuelto requiere esquema permitido y evaluación de destino; no se interpreta como autorización automática de navegación.
AI-2612. Los campos numéricos preservan precisión requerida y rechazan valores no finitos, unidades ambiguas o rangos operativamente imposibles.
AI-2613. La salida conserva grado de evidencia por afirmación cuando el producto exige fundamentación documental y auditoría del resultado.
AI-2614. La evaluación de fundamento compara afirmación y fuente, evitando aceptar una cita existente que no respalda lo dicho.
AI-2615. La confianza autodeclarada del modelo no constituye probabilidad calibrada ni sustituye comprobación independiente del campo generado.
AI-2616. Si el caso requiere puntuación, calibrar con datos representativos y documentar límites por segmento y versión del modelo.
AI-2617. Los campos desconocidos se manejan según versión del contrato, evitando que un proveedor introduzca efectos laterales encubiertos.
AI-2618. Una propuesta de herramienta dentro de salida estructurada permanece propuesta hasta superar admisión independiente de su operación.
AI-2619. El validador limita profundidad, longitud y cantidad de elementos para impedir agotamiento mediante estructuras formalmente válidas enormes.
AI-2620. La extracción conserva vínculo entre cada campo y fragmento fuente cuando esa trazabilidad sea requisito del producto receptor.
AI-2621. Los valores ausentes se expresan como ausencia definida, sin completar identidades, ubicaciones o hechos para mejorar apariencia del resultado.
AI-2622. La normalización posterior registra transformaciones que puedan alterar significado, especialmente en cantidades, fechas y nombres propios extraídos.
AI-2623. La respuesta al usuario distingue contenido generado y datos verificados sin una etiqueta global que oculte diferencias materiales.
AI-2624. La aplicación no presenta un resultado inválido porque el proveedor haya consumido presupuesto o demorado demasiado en generarlo.
AI-2625. Las reparaciones agotadas devuelven fallo específico y conservan evidencia mínima de incumplimiento sin almacenar indiscriminadamente el prompt.
AI-2626. La prueba adversarial genera objetos duplicados, tipos incorrectos, campos faltantes, citas ajenas y valores numéricos fuera de rango.
AI-2627. La prueba semántica incluye resultado formalmente correcto cuya suma o fecha contradice el documento fuente autorizado del caso.
AI-2628. La recuperación puede ofrecer revisión humana o extracción determinística, declarando claramente diferencias frente al resultado inicialmente solicitado.
AI-2629. La aceptación mide tasa de validez y fundamento por segmento, sin confundir ambos conceptos bajo una métrica única.
AI-2630. El estado de validación acompaña siempre al resultado persistido para impedir que consumidores posteriores pierdan sus limitaciones.

## 27. Streaming, buffering y cancelación con efectos inciertos

AI-2701. El streaming distingue entrega visual de texto, validación final y ejecución de efectos para evitar compromisos prematuros del producto.
AI-2702. Una salida estructurada se bufferiza hasta completar validación cuando fragmentos incompletos podrían afectar decisiones o persistencia sensible.
AI-2703. El producto puede mostrar progreso sin exponer contenido que aún no haya superado controles requeridos de clasificación y seguridad.
AI-2704. La política define cuáles fragmentos pueden mostrarse y cómo se retiran o corrigen si la validación final falla.
AI-2705. Los eventos de streaming llevan secuencia, solicitud y versión del contrato para detectar duplicados, saltos y reconexiones inconsistentes.
AI-2706. El consumidor no concatena eventos de solicitudes distintas por compartir un socket o identificador de sesión del navegador.
AI-2707. Un chunk tardío después de cancelar no se presenta como continuación válida sin comprobar el estado actual de la solicitud.
AI-2708. La desconexión del cliente no implica necesariamente cancelación del servidor ni cese de cargos por parte del proveedor.
AI-2709. El sistema define si una desconexión pausa entrega, solicita cancelación o permite finalizar para recuperación posterior autorizada.
AI-2710. El backpressure limita buffers y evita que clientes lentos mantengan memoria ilimitada por cada stream todavía activo.
AI-2711. El deadline abarca cola, conexión, primer token, generación, validación y acciones finales; no reinicia con cada fragmento recibido.
AI-2712. Un timeout de transporte se diferencia de timeout global y conserva certeza sobre si el proveedor inició el procesamiento.
AI-2713. `cancel_requested` registra intención; `cancel_confirmed` requiere evidencia; `cancel_uncertain` conserva exposición financiera y operativa pertinente.
AI-2714. Cancelar inferencia no deshace una herramienta ya ejecutada ni revierte datos escritos por un sistema consumidor independiente.
AI-2715. El gateway bloquea herramientas nuevas después de cancelación aunque continúen llegando propuestas desde el stream del proveedor.
AI-2716. Los efectos ya admitidos siguen su protocolo de reconciliación y compensación; no se borran del ledger por cancelar respuesta.
AI-2717. El adaptador declara la granularidad de cancelación y si puede detener generación, conexión o únicamente entrega de resultados.
AI-2718. La facturación conserva uso conocido y pendiente hasta confirmar terminación o recibir reporte definitivo del proveedor realmente utilizado.
AI-2719. Una reconexión autorizada recupera eventos por cursor sin repetir efectos de herramienta ni generar una solicitud nueva inadvertidamente.
AI-2720. Los eventos persistidos respetan retención y clasificación; recuperar un stream requiere autorización vigente sobre el resultado completo.
AI-2721. Los textos parciales no alimentan caché de respuestas válidas y se etiquetan explícitamente si se conservan para diagnóstico.
AI-2722. El cierre informa `completed`, `failed`, `cancelled` o `uncertain` con una causa normalizada y uso reportado hasta ese punto.
AI-2723. Un proveedor que cierra conexión sin terminador esperado produce estado incierto, no éxito deducido por longitud del texto.
AI-2724. La validación final comprueba que el stream corresponde al modelo y plan admitidos antes de persistir resultado del caso.
AI-2725. La prueba cancela antes de conexión, después del primer token y durante una herramienta con efecto externo autorizado.
AI-2726. La prueba de cliente lento verifica límites de memoria y decisiones explícitas de backpressure o desconexión controlada.
AI-2727. La prueba de reconexión duplica eventos y confirma que texto y efectos no se aplican dos veces al consumidor.
AI-2728. La recuperación informa efectos inciertos en lenguaje claro y ofrece consulta de estado antes de cualquier repetición peligrosa.
AI-2729. La aceptación incluye tiempos de confirmación y consumo posterior a cancelación, medidos por adaptador y versión del runtime.
AI-2730. Las promesas de cancelación se limitan a efectos demostrados y nunca describen como reversible una acción externa irrevocable.

## 28. Cachés, épocas de autorización y seguridad multiusuario

AI-2801. La clave de caché incluye tenant, propósito, política, modelo, revisión, contrato de salida y manifiesto de entradas autorizadas.
AI-2802. Incluir solamente prompt y nombre del modelo permite reutilización insegura entre organizaciones con documentos diferentes del mismo nombre.
AI-2803. Los permisos de recuperación se verifican antes de consultar caché y nuevamente antes de entregar un resultado almacenado.
AI-2804. Una época de autorización invalida resultados cuando cambios de membresía o permisos afectan su contenido potencialmente visible.
AI-2805. El valor almacenado conserva dominio de autorización y dependencias documentales para comprobar revocaciones relevantes de forma consistente.
AI-2806. Un resultado derivado de varios documentos exige acceso vigente a todos los que fundamentan su contenido expuesto al consumidor.
AI-2807. La revocación parcial puede requerir invalidación completa cuando no sea posible separar afirmaciones por documento con seguridad.
AI-2808. Los TTL complementan invalidación por eventos; esperar caducidad no basta para atender una revocación inmediata de permisos.
AI-2809. Las cachés de embeddings también contienen datos derivados y mantienen clasificación, retención y aislamiento entre tenants del producto.
AI-2810. Un cache hit no elimina obligación de auditar decisión, autorización y ahorro de ejecución conforme a política vigente.
AI-2811. La caché de planes no incluye reservas reutilizables; cada ejecución nueva necesita admisión real de recursos y exposición financiera.
AI-2812. Las claves evitan incorporar texto sensible visible en nombres de archivos o herramientas de administración de caché.
AI-2813. Los hashes de contenido pueden permitir ataques de adivinación; usar construcción protegida cuando el riesgo de correlación lo exija.
AI-2814. Los administradores de caché no reciben acceso automático a contenido de todos los tenants por su capacidad de purga técnica.
AI-2815. La purga identifica alcance, razón y evidencia, evitando borrar resultados ajenos por coincidencia de un prefijo ambiguo del identificador.
AI-2816. Las respuestas inválidas o inciertas se almacenan separadas y nunca se sirven como equivalentes a resultados correctamente validados.
AI-2817. El cache poisoning se previene autenticando escritores y validando versión, esquema y procedencia antes de aceptar un valor nuevo.
AI-2818. Un proveedor no escribe directamente en almacenamiento compartido de resultados mediante claves suministradas por el propio modelo.
AI-2819. La normalización de entradas para caché conserva diferencias materiales de autorización, idioma, instrucciones y documentos incluidos en contexto.
AI-2820. Una política permite compartir resultados públicos únicamente cuando contenido, propósito y permisos de uso realmente sean equivalentes.
AI-2821. La condición de público se comprueba en el resultado completo y no solo en el documento principal de la solicitud.
AI-2822. Los metadatos de hit y miss pueden revelar existencia de datos privados; restringir observabilidad de esas señales según riesgo.
AI-2823. La cuota de caché por tenant evita expulsión abusiva de datos legítimos mediante solicitudes diseñadas para producir claves nuevas.
AI-2824. Una migración de esquema usa namespaces versionados y no interpreta valores viejos con un contrato semánticamente incompatible del puerto.
AI-2825. El rollback conserva el namespace anterior si sigue autorizado, pero no resucita permisos revocados durante la versión nueva.
AI-2826. La prueba usa prompts idénticos con fuentes privadas distintas y comprueba aislamiento de resultado, traza y estadísticas expuestas.
AI-2827. La prueba revoca acceso después de cachear y verifica denegación inmediata sin esperar que termine el TTL del almacenamiento.
AI-2828. La prueba inserta un valor manipulado y confirma rechazo sin convertir el contenido hostil en instrucciones para ejecución posterior.
AI-2829. La recuperación purga únicamente el dominio comprometido, cambia época pertinente y verifica que escritores afectados quedaron efectivamente bloqueados.
AI-2830. La aceptación incluye coherencia de invalidación en todos los nodos y describe retrasos máximos observados bajo fallas de comunicación.

## 29. Herramientas: autorización independiente y defensa de instrucciones

AI-2901. El modelo propone una herramienta; un ejecutor determinístico valida autoridad, argumentos, estado y límites antes de realizar cualquier efecto.
AI-2902. El permiso para generar texto no incluye enviar mensajes, publicar contenido, gastar, modificar permisos ni escribir recursos externos.
AI-2903. Cada herramienta posee un contrato de efecto, alcance, identidad, precondiciones, límite temporal y evidencia esperada de cierre verificable.
AI-2904. Los argumentos se validan mediante esquema cerrado y reglas de dominio, evitando traducir strings libres directamente a comandos ejecutables.
AI-2905. El actor efectivo procede de la sesión confiable y no de un campo elegido por el modelo dentro de la llamada.
AI-2906. Las restricciones incluyen recurso exacto, operación, destino y contenido autorizado cuando la consecuencia externa depende de esos parámetros.
AI-2907. Un documento que contiene «envía esto al administrador» no concede permiso para mensajería aunque parezca una instrucción útil del caso.
AI-2908. Los resultados de herramientas también son datos no confiables y no pueden redefinir permisos de herramientas posteriores del mismo plan.
AI-2909. La autorización se comprueba en el servidor y no solamente mediante botones ocultos o opciones ausentes en la interfaz administrativa.
AI-2910. Una herramienta puede requerir una acción preparatoria local permitida y una ejecución externa pendiente de autorización humana distinta.
AI-2911. El ejecutor completa borradores y verificaciones autorizadas antes de solicitar la aprobación necesaria para el efecto externo restante del caso.
AI-2912. Una autorización ya recibida se reutiliza dentro de su alcance y no se solicita repetidamente por falta de memoria del worker.
AI-2913. El cambio material de destinatario, contenido, presupuesto o recurso puede exigir nueva autorización porque altera la acción previamente aprobada.
AI-2914. El catálogo clasifica lectura, escritura reversible, exposición externa y efectos irreversibles sin inferir autoridad desde el nombre comercial de la herramienta.
AI-2915. Una operación de lectura puede transmitir datos a tercero; evaluar su egress y exposición aunque no modifique almacenamiento remoto alguno.
AI-2916. Los conectores mantienen permisos mínimos por herramienta y evitan credenciales universales accesibles para todos los casos del producto receptor.
AI-2917. La validación de archivos y URLs ocurre antes de entregar argumentos a conectores que puedan ampliar superficies de acceso sensibles.
AI-2918. El límite de herramientas controla cantidad, profundidad y presupuesto acumulado para impedir bucles generativos que consuman recursos indefinidamente del sistema.
AI-2919. La reparación de argumentos no cambia intención ni amplía operación; un argumento ambiguo se rechaza con diagnóstico claro del campo requerido.
AI-2920. El ejecutor aplica precondiciones de estado para impedir modificar una entidad que cambió desde que el usuario revisó el borrador original.
AI-2921. El resultado de una herramienta distingue efecto confirmado, rechazado, compensado y desconocido mediante códigos que el modelo no puede alterar libremente.
AI-2922. Una respuesta amistosa del modelo no convierte efecto desconocido en confirmación ni reemplaza evidencia del servicio realmente invocado por el ejecutor.
AI-2923. El registro vincula autorización y parámetros normalizados mediante digest protegido sin conservar secretos ni payload completo cuando no resulte indispensable.
AI-2924. Los scripts generados requieren revisión y autoridad propias antes de ejecutarse, incluso cuando su propósito parece resolver un fallo del modelo admitido.
AI-2925. La prueba inyecta instrucciones mediante adjunto, resultado recuperado y mensaje de error del proveedor para intentar habilitar una herramienta no autorizada.
AI-2926. El resultado esperado bloquea la herramienta y conserva el contenido adversarial como dato, sin cambiar el plan ni el catálogo de permisos vigentes.
AI-2927. La prueba modifica un parámetro después de aprobación y comprueba que el digest de intención ya no coincide con la acción propuesta al ejecutor.
AI-2928. La recuperación detiene efectos posteriores, consulta estado de operaciones inciertas y conserva contexto para revisión humana sin repetir acciones por defecto del sistema.
AI-2929. La aceptación evidencia independencia entre generación y ejecución; deshabilitar una herramienta permanece efectivo aunque el modelo siga solicitándola en todas sus respuestas.
AI-2930. El propietario puede retirar una herramienta sin reemplazar el modelo y el modelo puede reemplazarse sin ampliar la autoridad de herramientas existentes del producto.

## 30. Idempotencia, leases, outbox y sagas de efectos

AI-3001. La clave de idempotencia identifica una intención autorizada y se vincula con actor, tenant, herramienta y parámetros normalizados.
AI-3002. Reutilizar la clave con parámetros diferentes produce conflicto; no actualiza silenciosamente la intención originalmente admitida por el ejecutor.
AI-3003. El ledger conserva `prepared`, `leased`, `dispatched`, `confirmed`, `failed`, `uncertain` y `compensated` con transiciones validadas del efecto.
AI-3004. La preparación valida autoridad y precondiciones antes de registrar trabajo listo para despachar hacia el destino externo correspondiente.
AI-3005. El lease concede ejecución temporal con token de fencing para impedir efectos de un worker cuya propiedad ya venció.
AI-3006. El token se comprueba en cada escritura local y en destinos que soporten precondiciones equivalentes de versión o ejecución.
AI-3007. Una outbox transaccional vincula cambio local y mensaje pendiente para evitar persistir uno sin registrar el otro necesario del flujo.
AI-3008. La outbox no garantiza entrega exactamente una vez cuando el transporte o destinatario solo permiten recepción al menos una vez.
AI-3009. El destinatario necesita deduplicación propia o idempotencia verificable para eliminar efectos duplicados tras reenvío del mensaje persistido por el gateway.
AI-3010. Si el destino no soporta deduplicación, el contrato declara posibilidad de repetición y exige reconciliación antes del reintento incierto.
AI-3011. Un timeout después de despacho conserva `uncertain`; no equivale a fallo seguro ni autoriza emitir nuevamente la misma operación externa.
AI-3012. La consulta de estado usa identidad de operación externa cuando exista y respeta límites de privacidad y presupuesto de la herramienta.
AI-3013. Si no existe consulta fiable, escalar una decisión concreta con evidencia disponible y consecuencias de repetir o esperar más información.
AI-3014. Una saga identifica pasos, precondiciones y compensaciones; la compensación puede ser otro efecto irreversible y requiere autoridad correspondiente.
AI-3015. La saga conserva estado de cada paso para no repetir pasos confirmados al recuperar después de una caída del coordinador local.
AI-3016. Una compensación fallida produce obligación pendiente visible y no una etiqueta de rollback completo que oculte impacto externo persistente.
AI-3017. La publicación de un documento y su eliminación posterior no borran necesariamente copias descargadas ni exposición ya producida a terceros.
AI-3018. El ledger evita almacenar contraseñas, tokens y contenido sensible; conserva digests protegidos y referencias autorizadas necesarias para reconciliar el efecto.
AI-3019. Las ventanas de deduplicación se comparan con plazos reales de reintento para impedir duplicados después de expirar claves en el destino.
AI-3020. El ejecutor no garantiza «exactamente una vez» sin demostrar los supuestos de extremo a extremo y los límites de fallas considerados.
AI-3021. Las operaciones compuestas necesitan idempotencia por intención y por paso para distinguir repetición del flujo y repetición de un efecto parcial.
AI-3022. Los reintentos conservan digest de intención original y nunca usan una nueva clave simplemente para evadir un conflicto del destino.
AI-3023. Un usuario que decide repetir conscientemente una acción crea intención nueva claramente diferenciada y recibe información sobre el efecto previo incierto.
AI-3024. El reconciliador mantiene presupuesto y límite de intentos para no convertirse en una fuente indefinida de tráfico y cargos externos del sistema.
AI-3025. La prueba cae después de escribir outbox y antes de enviar; la recuperación debe completar el envío sin perder intención autorizada del caso.
AI-3026. La prueba cae después de enviar y antes de confirmar; el ledger conserva incertidumbre y verifica estado antes de reenviar la operación externa.
AI-3027. La prueba vence el lease mientras el worker antiguo continúa y comprueba rechazo mediante fencing del efecto tardío intentado sobre el recurso.
AI-3028. La prueba altera argumentos con igual clave y confirma conflicto aun cuando la operación nueva parezca similar para el modelo generador del plan.
AI-3029. La recuperación conserva causalidad de intentos y consultas para explicar por qué un efecto fue repetido, compensado o sometido a revisión humana del propietario.
AI-3030. La aceptación declara garantías concretas de entrega y efecto sin usar vocabulario de transacciones para ocultar límites reales del servicio externo elegido por el caso.

## 31. Deadlines, circuitos y prevención de tormentas de reintentos

AI-3101. Cada solicitud lleva deadline global calculado al entrar y todas sus etapas consumen ese plazo sin reiniciarlo arbitrariamente.
AI-3102. La cola rechaza trabajo cuyo tiempo restante no permite completar admisión, inferencia y validación dentro del contrato del producto.
AI-3103. Los adaptadores distinguen errores transitorios, permanentes, de política, de cliente y de resultado para decidir si existe reintento permitido.
AI-3104. Un error de autorización nunca dispara reintento con credenciales más privilegiadas ni selección de un proveedor menos restringido del catálogo.
AI-3105. El número máximo de intentos se aplica al grafo completo y no se reinicia cuando una etapa llama a otra capacidad del puerto.
AI-3106. El backoff incorpora jitter y respeta el tiempo restante, las señales del proveedor y el presupuesto reservado para cada ejecución posible.
AI-3107. Un reintento cuyo costo máximo ya no cabe en presupuesto se rechaza aunque la causa de transporte sea claramente transitoria del proveedor.
AI-3108. El circuito usa una ventana documentada, mínimo de muestras y categorías de error relevantes para salud real del destino autorizado del caso.
AI-3109. Los rechazos internos de política se excluyen de la estadística de disponibilidad del proveedor porque no prueban una falla del servicio externo.
AI-3110. El estado `OPEN` bloquea tráfico ordinario y registra próxima oportunidad de evaluación, sin mantener una cola ilimitada de trabajo prometido al usuario.
AI-3111. `HALF_OPEN` permite probes limitados coordinados entre ejecutores para impedir que todos prueben simultáneamente el mismo proveedor durante recuperación del incidente.
AI-3112. El circuito vuelve a cerrar solo tras evidencia suficiente y no por una única respuesta satisfactoria dentro de una muestra insuficiente del servicio.
AI-3113. Los probes usan entradas aprobadas y presupuesto propio; no sacrifican privacidad ni operaciones del usuario para comprobar disponibilidad de una ruta alternativa.
AI-3114. El periodo de circuito abierto se acota y revisa para evitar tanto tormentas como indisponibilidad prolongada tras recuperación real del proveedor habilitado del producto.
AI-3115. Los límites de cola, conexiones y solicitudes por segundo son independientes del límite de presupuesto monetario y se aplican conjuntamente a cada ruta seleccionada.
AI-3116. El scheduler comparte un presupuesto de reintentos entre solicitudes para impedir amplificación masiva cuando falla un proveedor utilizado por múltiples tenants del mismo sistema.
AI-3117. Los clientes no deben agregar reintentos invisibles encima del gateway; el contrato define qué capa controla intentos y cómo se contabilizan los efectivamente ejecutados.
AI-3118. Si el SDK reintenta internamente, deshabilitarlo o integrarlo en evidencia de límites, costo y deadline antes de aprobar el adaptador para operación del producto.
AI-3119. Un fallback necesita admisión nueva sobre recursos, presupuesto y políticas, incluso cuando se ejecute dentro del plazo restante de la solicitud inicialmente autorizada del usuario.
AI-3120. La degradación conserva estados claros de producto y no fabrica respuestas almacenadas antiguas como si fueran datos recién verificados durante una interrupción del proveedor activo.
AI-3121. El informe operativo separa tiempo de cola, conexión, generación, validación y herramientas para localizar la causa real de latencia percibida por los usuarios del sistema receptor.
AI-3122. Las métricas por tenant se agregan de manera que no revelen documentos, prompts o identidades sensibles a otros consumidores del panel administrativo del producto en operación.
AI-3123. Los límites protegen también solicitudes de cancelación y administración para que una sobrecarga de inferencia no impida detener nuevos efectos del servicio probabilístico que está fallando.
AI-3124. Un kill switch de infraestructura no depende exclusivamente del mismo canal saturado que transporta solicitudes ordinarias del gateway bajo carga extrema durante el incidente de proveedor.
AI-3125. La prueba simula fallas simultáneas y verifica que tráfico total permanezca acotado por el presupuesto global de intentos definido para la ventana operativa de recuperación del servicio.
AI-3126. La prueba de half-open usa varios nodos y comprueba que solo los probes autorizados obtienen permiso de ejecución, evitando una reapertura coordinada accidental por todos los ejecutores.
AI-3127. La prueba incluye un SDK con reintentos propios para demostrar que la configuración final respeta deadline y máximo real de llamadas al proveedor elegido para atender el caso.
AI-3128. La recuperación conserva estadísticas anteriores y distingue nueva ventana para no esconder un incidente mediante reinicio de métricas antes de validar comportamiento estable del servicio nuevamente habilitado.
AI-3129. La aceptación exige evidencia de límite bajo sobrecarga, error transitorio, error permanente y presupuesto agotado con códigos de resultado útiles para el consumidor y para operación del producto.
AI-3130. El propietario define tolerancias del producto; este manual no prescribe un porcentaje universal de disponibilidad ni demuestra que cualquier proveedor pueda cumplirlo sin medición específica en el entorno receptor.

## 32. Evaluación de eficacia, provenance y experimentos multimodelo

AI-3201. El dataset de evaluación identifica origen, derechos de uso, clasificación, selección, transformaciones y versión de cada ejemplo incluido.
AI-3202. La partición de evaluación evita contaminación por ejemplos usados para ajustar prompts o seleccionar parámetros del mismo experimento comparativo.
AI-3203. Los ejemplos incluyen tareas representativas, idiomas del usuario, casos difíciles, abstención, entradas corruptas y ataques de instrucciones dentro de documentos.
AI-3204. Cada ejemplo conserva resultado esperado o rúbrica revisada, con incertidumbre explícita cuando no existe una única respuesta correcta del dominio.
AI-3205. La evaluación humana identifica revisores y desacuerdos, evitando describir una opinión aislada como verdad semántica de todas las respuestas posibles.
AI-3206. Una evaluación realizada por otro modelo registra sus limitaciones y no se presenta como revisión independiente experta del contenido crítico generado por el sistema.
AI-3207. Medir exactitud por campo, fundamento, abstención adecuada, violaciones de política, latencia y costo con definiciones reproducibles para cada caso del producto evaluado.
AI-3208. El promedio no oculta regresiones en clases críticas; publicar resultados por segmento relevante y tolerancias que deban cumplirse individualmente por la versión candidata.
AI-3209. La comparación fija corpus, hardware, versiones, contexto y carga para distinguir ventajas del modelo de diferencias accidentales del entorno utilizado por cada candidato de inferencia.
AI-3210. Cuando no sea posible igualar condiciones, declarar variables distintas y evitar una conclusión de superioridad global que los datos obtenidos no permiten sustentar de manera fiable.
AI-3211. Las semillas y parámetros ayudan reproducibilidad, pero no garantizan resultados idénticos entre runtimes, aceleradores o proveedores que no ofrecen determinismo efectivo bajo las mismas condiciones declaradas.
AI-3212. La decisión multimodelo distingue planificador, extractor, verificador y síntesis; cada etapa necesita una razón de utilidad y un presupuesto independiente además del máximo acumulado del caso completo.
AI-3213. Agregar un modelo puede aumentar costo y latencia sin mejorar calidad; exigir evidencia de beneficio incremental frente a un baseline más simple y operativo del mismo caso evaluado.
AI-3214. La evaluación considera errores correlacionados: dos modelos que repiten una misma afirmación infundada no crean corroboración documental por coincidir entre sí sobre la respuesta generada del caso crítico.
AI-3215. El verificador dispone de fuentes autorizadas y una rúbrica que le permita rechazar la síntesis, sin recibir instrucciones del generador con capacidad de cambiar su criterio de aceptación del experimento.
AI-3216. Los experimentos de planificación limitan ramas, profundidad, tiempo y gasto para impedir exploración arbitraria que convierta el benchmark en un proceso de consumo ilimitado del presupuesto aprobado para investigación técnica.
AI-3217. El criterio de promoción exige umbrales previamente definidos; no se eligen métricas favorables después de observar qué candidato ganó una comparación preliminar dentro del conjunto de evaluación preparado por el equipo.
AI-3218. El análisis conserva ejemplos fallidos y causas plausibles para que mejorar una métrica no oculte errores concretos que siguen siendo incompatibles con el objetivo del producto receptor y sus restricciones del propietario.
AI-3219. Los datos de evaluación privados mantienen aislamiento y retención iguales a producción; copiar un expediente a un benchmark no elimina permisos de tratamiento aplicables al contenido documental evaluado con un modelo externo.
AI-3220. La medición de costo incluye reparaciones, verificadores, recuperación y herramientas; contar únicamente la llamada principal favorece artificialmente pipelines complejos que trasladan gasto a etapas auxiliares no registradas dentro de su presupuesto declarado.
AI-3221. La medición de latencia incluye percentiles y muestras suficientes con explicación de carga, evitando conclusiones sustentadas solo en la respuesta más rápida de una corrida aislada del candidato experimental de inferencia del sistema.
AI-3222. La eficacia se relaciona con la tarea del usuario y no únicamente con longitud, elocuencia o satisfacción superficial de un evaluador que no tenga acceso a evidencia de los documentos usados en el experimento.
AI-3223. La seguridad de instrucciones se evalúa mediante resultados observables como herramientas bloqueadas, egress denegado y datos no revelados, sin asumir que una frase de rechazo del modelo demuestra aislamiento efectivo del sistema receptor en operación.
AI-3224. Las ejecuciones fallidas se contabilizan y se distinguen de casos excluidos por dataset inválido; no retirar fallos silenciosamente para mejorar el denominador de una tasa de calidad reportada como evidencia del producto evaluado por el equipo.
AI-3225. La prueba adversarial mezcla instrucciones hostiles con fuentes legítimas y exige que la respuesta siga utilizando la evidencia válida sin elevar autoridad del contenido malicioso ni activar efectos que no formaban parte del caso originalmente autorizado.
AI-3226. La prueba de regresión cambia solo una etapa multimodelo y verifica el sistema completo, porque mejoras locales pueden degradar interpretación, latencia o presupuesto del consumidor final que depende de resultados compuestos de varios adaptadores del gateway.
AI-3227. La recuperación de un experimento fallido revierte configuración y artefactos candidatos sin modificar automáticamente el baseline autorizado del producto ni mantener tráfico hacia un proveedor que solo tenía permiso temporal para evaluación técnica del caso documentado por el responsable.
AI-3228. La aceptación publica método, muestras, incertidumbre y límites; una tabla de resultados hipotéticos como las de este manual no sustituye ejecución real ni permite afirmar superioridad de un modelo en el entorno del propietario sin pruebas registradas del sistema receptor.
AI-3229. La decisión final puede preferir un modelo menos potente cuando su latencia, aislamiento y consumo satisfacen mejor las restricciones; esa elección debe explicarse mediante el problema concreto y no mediante una preferencia general por un proveedor o arquitectura particular de inferencia.
AI-3230. Los resultados evaluados pertenecen a una combinación versionada de modelo, prompt, recuperación, runtime y contrato; cambiar cualquiera de estas piezas exige revisar qué evidencia sigue siendo aplicable al sistema y qué pruebas pertinentes deben repetirse antes de promover la actualización correspondiente.

## 33. Retrieval, embeddings compatibles y migración de índices

AI-3301. El recuperador filtra permisos antes de seleccionar fragmentos y mantiene aislamiento de índices según tenant y clasificación efectiva.
AI-3302. La similitud semántica no concede acceso a un documento cuyo propietario o política prohibieron exposición al actor solicitante del caso.
AI-3303. Cada índice conserva modelo de embedding, revisión, dimensión, normalización, tokenizer, fragmentación y versión del corpus utilizado para construirlo.
AI-3304. Igual dimensión no demuestra compatibilidad semántica; dos revisiones pueden ubicar documentos equivalentes en espacios vectoriales con significado diferente de distancia.
AI-3305. La búsqueda nunca mezcla embeddings de familias incompatibles bajo una sola métrica para aparentar continuidad tras una actualización del modelo empleado por el sistema.
AI-3306. El pipeline de ingestión registra origen, derechos, permisos, transformaciones y digest del contenido antes de generar vectores que luego pueden revelar información privada del documento autorizado.
AI-3307. La eliminación documental se propaga a índices, cachés y resultados derivados conforme a retención definida, sin asumir que borrar texto elimina también toda representación asociada al expediente procesado por el caso.
AI-3308. La migración construye un índice nuevo versionado y conserva el anterior mientras siga autorizado y resulte necesario para reversión del cambio semántico propuesto dentro de las restricciones de almacenamiento aprobadas del producto.
AI-3309. El costo de reindexación se admite como operación propia, incluyendo lectura, embeddings, disco, concurrencia y carga del producto principal que comparte el entorno donde se ejecuta el pipeline de mantenimiento del corpus documental.
AI-3310. La autorización para inferencia sobre algunos documentos no implica autorización para copiar todo el corpus a un proveedor externo durante una reindexación que se presenta como mantenimiento técnico del sistema de recuperación semántica utilizado por el caso.
AI-3311. La comparación de recuperación usa consultas versionadas y relevancia revisada para medir recall, precisión y cobertura de fuentes críticas antes de intercambiar el alias de lectura del índice actualmente operativo en el sistema receptor del proyecto autorizado.
AI-3312. Las consultas de prueba incluyen documentos parecidos de tenants distintos, revocaciones y fragmentos adversariales que intenten alterar instrucciones del generador mientras se recuperan junto con fuentes válidas dentro del contexto autorizado para atender la solicitud original del usuario final.
AI-3313. Los cambios de fragmentación afectan significado y citas; conservar offsets o referencias estables permite localizar el contenido citado aun cuando el índice nuevo use unidades diferentes de recuperación documental para producir respuestas sustentadas por la evidencia original autorizada del caso.
AI-3314. Un chunk demasiado pequeño puede perder condiciones y excepciones; uno demasiado grande puede consumir contexto y mezclar información innecesaria, por lo que el criterio de fragmentación necesita evaluación específica del tipo de documento y tarea que el producto realmente realiza.
AI-3315. La estrategia híbrida de recuperación puede combinar lexical y semántica con ranking documentado, pero cada etapa conserva permisos y evidencia de selección para evitar que un reranker tenga acceso a fragmentos prohibidos que el generador nunca debería ver durante ejecución del caso.
AI-3316. Un reranker externo recibe información con su propia admisión de privacidad y presupuesto; no hereda permiso de egress porque los embeddings originales se generaron localmente dentro de un equipo del usuario previamente autorizado para ese caso concreto de recuperación del producto receptor.
AI-3317. El cambio de alias de lectura es atómico o tiene mecanismo equivalente que impida consultas con metadatos de una versión y vectores de otra dentro de la misma solicitud que el compilador admitió con un snapshot específico del índice semántico del sistema operativo.
AI-3318. Las escrituras durante migración se coordinan mediante pausa acotada, doble escritura comprobada o replay de eventos con deduplicación; la elección depende de volumen, reversibilidad y tolerancia de disponibilidad del producto, no de una promesa genérica de migración sin interrupciones del servicio al usuario.
AI-3319. El rollback no resucita documentos eliminados ni permisos revocados mientras el índice nuevo estaba activo; reconciliar cambios de corpus y autorización antes de devolver consultas a una versión anterior preservada para recuperación técnica del sistema receptor que sirve evidencia documental a usuarios autenticados del producto.
AI-3320. El manifiesto de migración conserva cantidad de documentos, fallos de ingestión, pendientes, versiones y hashes agregados saneados; una diferencia de conteo debe explicarse antes de declarar equivalencia completa entre los índices comparados para promover el cambio de embeddings del sistema de recuperación documental del proyecto.
AI-3321. Los vectores derivados se tratan como potencialmente sensibles porque pueden permitir correlación o inferencias; no publicarlos como artefactos inocuos de benchmark únicamente porque no contienen el texto en una representación legible para el usuario que descarga datos del producto usado para evaluar el nuevo modelo de embeddings.
AI-3322. La aceptación de citas verifica que una referencia de recuperación existe, pertenece al conjunto autorizado y respalda la afirmación generada; encontrar una palabra similar en un fragmento no demuestra fundamento suficiente para sostener una conclusión crítica del sistema sobre el expediente o documento consultado por el actor autenticado.
AI-3323. La degradación a búsqueda lexical es una alternativa explícita con evidencia propia; no se presenta como equivalente a la recuperación semántica cuando cambian cobertura, ranking o expectativas del consumidor que pidió una tarea fundamentada mediante la capacidad de IA inicialmente admitida por el gateway para el caso concreto del producto.
AI-3324. Las métricas de recuperación se separan de métricas de respuesta para localizar si una falla ocurrió en selección de fuentes, comprensión o generación; mejorar el estilo del texto no corrige un corpus incompleto o una autorización aplicada después de que la información privada ya salió hacia un proveedor externo del sistema.
AI-3325. La prueba introduce embeddings de dimensión idéntica pero revisión incompatible y exige bloqueo o migración explícita, nunca reutilización silenciosa del índice como si su significado matemático permaneciera idéntico porque el esquema de almacenamiento sigue admitiendo el mismo número de componentes del vector generado por cada documento del corpus protegido.
AI-3326. La prueba revoca un documento durante migración y verifica que la nueva versión y el rollback respetan la revocación sin devolver fragmentos cacheados cuyo TTL aún no haya vencido en nodos que conservan una copia de los resultados previos de recuperación semántica utilizados por la aplicación del proyecto receptor.
AI-3327. La recuperación de reindexación fallida preserva el índice anterior autorizado y un ledger de documentos pendientes, permitiendo reanudar solamente trabajo faltante bajo permisos vigentes y sin repetir cargos de embeddings ya confirmados para el mismo contenido y la misma revisión válida del modelo seleccionado por el responsable técnico del sistema receptor.
AI-3328. La aceptación identifica incompatibilidades semánticas y operativas y muestra cómo se resolvieron antes de activar lecturas; un índice que carga sin errores de base de datos puede seguir siendo inválido para el caso del producto porque sus distancias, permisos o referencias documentales no satisfacen el contrato de recuperación aprobado por el propietario.
AI-3329. La administración muestra edad del corpus, versión del índice y cobertura pendiente para que una respuesta no aparente actualidad mayor que sus fuentes; los mensajes al usuario mantienen precisión temporal y evitan prometer información en vivo cuando solo existe actualización periódica o una instantánea del corpus documental incorporado al sistema de recuperación.
AI-3330. El responsable documenta la ruta completa desde fuente hasta afirmación con identificadores y evidencia minimizada, permitiendo revisar errores de recuperación sin exponer a operadores generales el contenido de todos los documentos privados que alimentan índices compartidos por una infraestructura física bajo aislamiento lógico de múltiples tenants del producto receptor utilizado en el proyecto autorizado.

## 34. Upgrades determinísticos, canary y rollback de la combinación efectiva

AI-3401. La unidad de cambio incluye modelo, runtime, tokenizer, adaptador, librerías, prompt, esquema y recuperación cuando alguno pueda alterar resultados.
AI-3402. El inventario fija digests y versiones del baseline para que rollback no descargue una etiqueta mutable diferente de la versión previamente evaluada.
AI-3403. Una actualización de librería puede cambiar reintentos, cancelación o telemetría sin modificar interfaz pública; revisar consecuencias operativas además del diff tipado del contrato.
AI-3404. Los cambios de tokenizador y contexto requieren recalibrar admisión de memoria, límites de entrada y costo antes de aceptar tráfico del producto con el candidato nuevo.
AI-3405. El cambio de salida estructurada exige migración de consumidores y pruebas de fixtures anteriores que validen semántica, no solamente JSON correctamente parseado por un esquema amplio del sistema receptor.
AI-3406. La evaluación offline precede al canary y usa corpus autorizado con baseline reproducible, controles de privacidad y presupuesto que no dependan de una autorización futura de producción del candidato experimental.
AI-3407. El canary fija población, exposición máxima, duración, métricas, condiciones de freno y responsable de recuperación antes de empezar a servir resultados de la versión candidata a usuarios del producto receptor en operación.
AI-3408. El porcentaje de tráfico se deriva de riesgo y volumen reales; una secuencia universal de porcentajes no demuestra que la exposición de datos, gasto o errores permanezca aceptable durante el experimento operativo del sistema.
AI-3409. La asignación determinística por actor o solicitud permite comparar cohortes y evita mover al mismo usuario entre versiones incompatibles dentro de una tarea que necesita respuestas consistentes y referencias documentales estables para el caso del producto.
AI-3410. El tráfico shadow requiere permiso de tratamiento y presupuesto; duplicar una solicitud puede transmitir datos dos veces y ejecutar efectos duplicados si herramientas no se bloquean explícitamente en la ruta observadora configurada para evaluación de la versión candidata.
AI-3411. La ruta shadow no ejecuta herramientas con efectos y sus resultados nunca sustituyen automáticamente la respuesta oficial del usuario sin superar una decisión de promoción autorizada y evidencia de aceptación correspondiente al cambio de combinación técnica del gateway del producto receptor.
AI-3412. El rollback restaura contratos compatibles y configuración exacta, pero conserva límites de privacidad más restrictivos que entraron en vigor mientras la versión candidata servía solicitudes durante el experimento para evitar resucitar autorizaciones revocadas por una reversión puramente técnica del sistema probabilístico del producto.
AI-3413. Las migraciones de datos o cachés pueden exigir un plan de compatibilidad bidireccional; volver a pesos anteriores no recupera automáticamente entidades escritas con un esquema que el baseline previo ya no entiende al ejecutar inferencia o herramientas admitidas por el puerto en el sistema receptor.
AI-3414. Los nuevos parámetros por defecto quedan explícitos en configuración efectiva y pruebas para impedir que el rollback mantenga una configuración candidata incompatible con el comportamiento del modelo anterior que el responsable espera recuperar después de detectar regresiones de calidad, recursos o privacidad bajo tráfico real del producto.
AI-3415. Una regresión crítica en un segmento obliga a frenar aunque la métrica agregada mejore; el canary no puede compensar fuga de datos o errores graves de una clase con respuestas rápidas de casos triviales que dominan el volumen de solicitudes de usuarios durante la ventana de comparación del sistema.
AI-3416. La promoción registra evidencia, decisión y versión efectiva; el descubrimiento de un modelo nuevo por un scout no equivale a aprobación de descarga, canary o cambio de producción que el equipo no haya preparado y autorizado dentro del alcance del caso de mantenimiento solicitado por el propietario del producto receptor.
AI-3417. Las dependencias del candidato se revisan por procedencia, licencia y vulnerabilidades pertinentes, sin afirmar que una auditoría sin hallazgos garantiza ausencia de riesgos en todos los runtimes y usos futuros que la organización pueda dar al adaptador o al modelo promovido dentro del gateway de su sistema receptor del proyecto autorizado.
AI-3418. La retirada bloquea admisiones nuevas, drena operaciones, invalida cachés y conserva evidencia de decisiones anteriores; eliminar pesos de una versión vulnerable no debe borrar trazabilidad necesaria para explicar incidentes sin almacenar contenido privado más allá de retención aprobada por el producto para sus solicitudes y herramientas ejecutadas con autoridad humana vigente.
AI-3419. El mecanismo de actualización no depende de una herramienta generativa con autoridad para alterar políticas; las propuestas del modelo permanecen propuestas que un flujo determinístico revisa y ejecuta cuando existan permisos correspondientes sobre artefactos, configuración y destinos del sistema receptor que el propietario haya autorizado mantener mediante el gateway y su control administrativo.
AI-3420. La prueba modifica librería manteniendo modelo y verifica reintentos, egress, cancelación, errores y liquidación para detectar efectos que un benchmark de calidad lingüística no observaría porque no incluye caídas, presupuestos concurrentes o solicitudes interrumpidas en distintas fases de ejecución del adaptador actualizado dentro del entorno de inferencia real del producto receptor del proyecto autorizado.
AI-3421. La prueba reduce contexto en candidato y comprueba rechazo o truncamiento explícito según contrato, sin permitir que un expediente incompleto reciba una respuesta con etiqueta de revisión total que el usuario interpretaría como cobertura documental suficiente para una decisión crítica o un proceso de extracción validada que originalmente requería todos los fragmentos del documento autorizado del caso.
AI-3422. La prueba genera salidas del nuevo esquema, ejecuta rollback y verifica lectura por baseline para demostrar que una migración compatible realmente permite recuperación sin perder resultados ni interpretar incorrectamente campos persistidos por la ruta candidata durante su ventana de canary que consumió recursos y presupuesto bajo control del equipo técnico responsable del producto receptor en operación autorizada por el propietario.
AI-3423. La recuperación de un canary fallido detiene población nueva, reconcilia solicitudes vigentes y liquida su exposición, evitando liberar presupuesto solo porque la ruta candidata dejó de recibir tráfico mientras proveedores aún procesan inferencias que no pudieron cancelar de forma confirmada bajo las capacidades declaradas y verificadas del adaptador experimental de la combinación técnica del gateway que estaba evaluando el responsable del sistema.
AI-3424. La evidencia conserva el estado previo y posterior del cambio con referencias saneadas y métricas relevantes, para que un revisor pueda evaluar causalidad sin recibir prompts completos, contraseñas ni tokens que el equipo no debe copiar indiscriminadamente dentro de reportes de promoción, rollback o postmortem del servicio probabilístico del producto receptor donde se ejecutó el experimento autorizado de actualización por el propietario del proyecto.
AI-3425. El responsable define cuándo repetir evaluación completa y cuándo bastan pruebas dirigidas al cambio; esta decisión considera dependencias semánticas y operativas y no solo cantidad de líneas modificadas por una actualización que puede introducir comportamiento nuevo en el SDK sin alterar visiblemente el contrato tipado del puerto ni los pesos del modelo que el producto continúa usando como candidato dentro de su entorno real.
AI-3426. Una fecha reciente de release no demuestra superioridad ni conveniencia de actualización; el equipo contrasta beneficio, riesgo, costo de evaluación y capacidad de rollback antes de modificar una combinación que ya satisface objetivos medidos del producto y sigue dentro de restricciones de soporte, privacidad y seguridad documentadas para el caso concreto del propietario que utiliza el gateway en un sistema receptor de la biblioteca EOS.
AI-3427. La aceptación exige comparación antes y después bajo condiciones descritas, capacidad de freno y prueba de rollback pertinente; no confundir existencia de un script de reversión con haber demostrado que puede restaurar el estado requerido del producto después de efectos externos o migraciones de datos que una simple vuelta de configuración no puede deshacer completamente dentro del alcance técnico y humano autorizado para mantener el sistema receptor.
AI-3428. La autorización de promoción puede delegarse dentro de límites explícitos, pero no convierte al modelo evaluado en juez de su propia seguridad o utilidad ni permite que un agente incremente presupuesto para justificar un canary que no cabe en exposición aprobada por el propietario responsable de las consecuencias del producto y sus usuarios que dependen del servicio probabilístico operativo dentro de la arquitectura documentada por EOS en esta edición.
AI-3429. El informe de actualización identifica controles no comprobados y deuda temporal aceptada con vencimiento, evitando describir una promoción parcial como conformidad total del modelo, runtime o proveedor elegido para el caso del producto receptor que consume el puerto y necesita resultados útiles, costos acotados y capacidad de recuperación demostrada mediante evidencia técnica y decisiones humanas correspondientes al cambio concreto que el equipo pretende poner en operación autorizada por el propietario.
AI-3430. Toda promoción crea una nueva combinación efectiva identificable y mantiene trazabilidad hacia baseline, dataset, políticas y autorizaciones que la sustentan; el control administrativo muestra la versión realmente servida y no solamente la candidata configurada en un archivo que puede diferir del proceso residente después de una carga fallida, reinicio parcial o rollback incompleto dentro de la infraestructura del producto receptor que adoptó el gateway como capacidad arquitectónica en su sistema EOS.

## 35. Kill switch, observabilidad mínima y control administrativo protegido

AI-3501. El kill switch bloquea nuevas admisiones y efectos de herramientas mediante una política verificable independiente de instrucciones del modelo activo.
AI-3502. La señal de emergencia incrementa época y se propaga con tiempo máximo observado; los ejecutores verifican vigencia antes de producir cada efecto nuevo.
AI-3503. La cancelación de trabajos vigentes conserva su estado cierto o incierto y no elimina obligaciones de reconciliación de uso, presupuesto o herramientas externas del producto.
AI-3504. La recuperación de emergencia comienza en estado conservador y requiere verificar políticas, recursos y salud antes de volver a aceptar tráfico de los casos previamente habilitados del sistema receptor.
AI-3505. El plano administrativo utiliza autenticación y autorización de servidor separadas de usuarios ordinarios de inferencia y conserva permisos granulares para acciones concretas sobre proveedores, modelos y presupuestos aprobados.
AI-3506. Los roles administrativos distinguen observar, descargar, validar, habilitar, cargar, drenar, eliminar, cambiar privacidad y aumentar límites sin agrupar todas las acciones bajo una capacidad universal llamada administrador de IA del producto.
AI-3507. Una cuenta con permiso de observación no puede modificar fallback ni elevar presupuesto mediante parámetros manipulados de una solicitud administrativa que la interfaz visual no permite crear para ese actor autenticado del sistema receptor.
AI-3508. Las operaciones mutadoras protegen contra solicitudes forjadas según el mecanismo de autenticación utilizado y verifican precondiciones de versión para evitar aplicar cambios basados en pantallas administrativas obsoletas que ya no representan el estado efectivo del gateway.
AI-3509. Los registros administrativos conservan actor, acción, recurso, antes y después saneados, autoridad, motivo y resultado; no almacenan credenciales completas ni prompts privados simplemente porque el operador tenga un rol técnico de control sobre infraestructura del producto receptor.
AI-3510. La ruta `/admin/engineering/ai` es conceptual en este repositorio y solo puede declararse operativa cuando un proyecto receptor la implemente y verifique con pruebas de acceso, acciones y estados reales del gateway utilizado por sus usuarios autorizados en producción o entorno de evaluación.
AI-3511. La observabilidad conserva identificadores, tiempos, códigos, versiones, uso y causa de decisiones con minimización; la reproducción de un defecto se prepara con contenido sintético antes de pedir acceso a un payload privado completo que no resulte indispensable para investigar el incidente del sistema receptor de manera responsable.
AI-3512. Los fingerprints de solicitudes se diseñan para correlación autorizada y evitan permitir replay de tokens, reconstrucción de contraseñas o adivinación trivial de documentos sensibles desde un log exportado para soporte técnico que no tiene autoridad sobre el contenido de usuarios del producto receptor donde se produjo el evento de inferencia.
AI-3513. El sistema nunca registra cadenas de autenticación completas, cookies de sesión, claves comerciales o headers secretos dentro de métricas y errores del adaptador, aunque el SDK los incluya en excepciones que deben sanearse antes de cruzar la frontera del puerto o quedar disponibles a operadores generales del control administrativo del servicio probabilístico.
AI-3514. Un digest de contenido de baja entropía puede revelar información por comparación; evaluar construcción protegida y acceso al registro según amenaza, evitando describir el hash como anonimización suficiente de todo dato que se usó en una solicitud que el producto desea auditar sin exponer identidades ni secretos de su actor autenticado o tenant autorizado.
AI-3515. Los dashboards distinguen calidad, disponibilidad, política y costo confirmado o pendiente; una tasa de respuestas HTTP satisfactorias no representa éxito semántico ni ausencia de exposición de datos para las tareas que el gateway atiende mediante proveedores y herramientas con restricciones independientes dentro de la arquitectura real del sistema receptor que el propietario haya autorizado operar en su proyecto.
AI-3516. Los logs de decisiones guardan un resumen compilado de filtros y referencias de snapshots, permitiendo explicar por qué se eligió una ruta sin capturar razonamiento interno del modelo ni toda la documentación privada enviada como contexto durante la inferencia que produjo un resultado del caso concreto del usuario que consulta el producto receptor desde una sesión autenticada con permisos verificados.
AI-3517. El plano administrativo mantiene disponibilidad suficiente para detener y reconciliar trabajo aun cuando inferencia esté saturada, evitando compartir límites que permitan a un atacante bloquear controles de emergencia mediante una avalancha de solicitudes probabilísticas legítimamente rechazables que compiten por todos los recursos del gateway y sus nodos ejecutores dentro de la infraestructura operativa del producto receptor que sirve casos de usuario bajo políticas aprobadas.
AI-3518. Una modificación administrativa sensible puede exigir doble revisión según perfil del producto, pero este manual no crea una aprobación adicional cuando la autoridad humana existente ya cubre una acción reversible concreta dentro del alcance del encargo y los controles del entorno permiten ejecutarla después de preparar evidencia y verificar precondiciones necesarias para que su resultado sea revisable por el propietario del sistema receptor que usa el gateway.
AI-3519. La retención de evidencia responde a finalidad y riesgo definidos, evitando acumulación infinita de logs que contienen datos derivados potencialmente sensibles; los vencimientos se ejecutan y se comprueban en almacenamiento primario, backups y exportaciones dentro de los límites que el proyecto realmente controla sin prometer borrado instantáneo de copias externas que no puede verificar ni administrar bajo su autoridad sobre el producto y sus proveedores aprobados del caso.
AI-3520. Las alertas incluyen acción útil, condición medible y responsable, evitando notificaciones repetidas que no cambian estado ni requieren intervención; un incidente debe distinguir rechazo esperado por política y fallo del proveedor para que el propietario no reciba ruido que oculte costos inciertos, fuga potencial o imposibilidad de detener herramientas durante una emergencia del servicio probabilístico que forma parte de su arquitectura del sistema receptor de EOS documentada en este manual.
AI-3521. La prueba de RBAC manipula parámetros y llama directamente operaciones de presupuesto, privacidad y eliminación con cuentas de observación, verificando que el servidor rechaza todas antes de producir efectos y registra evidencia saneada del intento sin mostrar secretos ni recursos privados de otros tenants a quien ejecutó una solicitud administrativa no autorizada contra el control plane del producto receptor que implementa la capacidad descrita como propuesta arquitectónica en esta biblioteca documental del propietario.
AI-3522. La prueba de emergencia revoca herramientas mientras hay streaming activo y comprueba bloqueo de nuevos despachos, conservación de operaciones confirmadas y reconciliación de operaciones inciertas sin repetirlas por iniciativa del modelo que sigue generando sugerencias después de que su autoridad fue retirada mediante política confiable del gateway dentro del sistema receptor que está experimentando un incidente operativo de disponibilidad, privacidad o integridad durante la atención de solicitudes de usuarios autenticados con casos aprobados.
AI-3523. La prueba de saneamiento introduce un error del SDK con tokens y cabeceras sensibles y confirma que logs, paneles y respuesta del puerto no contienen esos valores; el diagnóstico conserva categoría, proveedor aprobado y referencia de evento suficiente para investigar sin filtrar credenciales que permitan replay de llamadas comerciales o acceso a datos privados del tenant cuyo caso estaba siendo procesado cuando el adaptador falló dentro del producto receptor autorizado por su propietario.
AI-3524. La prueba de saturación intenta agotar inferencia y confirma que control administrativo sigue pudiendo entrar en `OFF`, consultar exposiciones y emitir cancelaciones bajo límites definidos; esta evidencia no promete disponibilidad absoluta frente a fallas de todo el host y debe describir claramente las dependencias compartidas que todavía podrían impedir intervención rápida en un incidente real del gateway y sus servicios auxiliares que forman parte de la infraestructura operativa del sistema receptor del proyecto autorizado del propietario.
AI-3525. La recuperación restaura admisión por etapas previamente aprobadas y registra condiciones de reapertura, evitando habilitar todos los proveedores o herramientas por una sola señal de salud de transporte que no prueba calidad, presupuesto ni aislamiento del catálogo del caso; cada ruta vuelve a intersectar restricciones vigentes antes de transmitir contenido o iniciar efectos externos del producto receptor que consume el puerto bajo las políticas definidas por el propietario y el entorno anfitrión de ejecución del proyecto EOS autorizado.
AI-3526. La aceptación del manual exige casos de arranque dormido, intersección, reserva concurrente, cancelación incierta, aislamiento de caché, permiso independiente de herramientas, idempotencia y rollback pertinente; cada evidencia indica estado y límite sin convertir un test sintético aprobado en certificación legal, ausencia absoluta de riesgos o garantía de que un proveedor futuro se comportará de igual forma cuando cambie su API, contrato o configuración que el proyecto receptor debe verificar antes de utilizar el gateway dentro de su producto.
AI-3527. El propietario recibe una matriz de controles `VERIFIED`, `PARTIAL`, `MISSING` o `NOT_APPLICABLE` con fundamento y evidencia accesible, para que pueda distinguir capacidad implementada de aspiración documental antes de decidir si habilita un caso de IA que afecte recursos, dinero, datos o acciones externas del sistema receptor donde trabaja un equipo que adopta EOS como biblioteca de gobierno técnico y conserva responsabilidad real sobre decisiones y efectos de inferencia, herramientas y administración protegida del puerto arquitectónico descrito en este manual.
AI-3528. Un registro de excepción incluye control afectado, exposición, mitigación, autoridad y vencimiento, y nunca puede anular una prohibición superior ni transformarse en permiso general de fallback porque el producto tenga urgencia de continuidad; el equipo desarrolla alternativas concretas revisables y ejecuta únicamente las autorizadas dentro de límites del propietario y host para evitar que una supuesta excepción operativa o recomendación de modelo cambie silenciosamente fronteras de privacidad, gasto o integridad del sistema receptor que utiliza el gateway para un caso aprobado.
AI-3529. El cierre de un incidente conserva hechos, tiempos y acciones verificadas, separando hipótesis de causa y resultados observados; el modelo puede ayudar a redactar el informe pero no decide qué efectos ocurrieron ni reemplaza evidencia de proveedores, ledgers y procesos locales que permiten explicar costos pendientes y herramientas inciertas antes de declarar recuperación suficiente para los casos de usuario que el sistema receptor está autorizado a atender mediante su puerto de IA bajo políticas vigentes y recursos medidos del entorno del proyecto EOS del propietario.
AI-3530. Pierre R. Boss conserva dirección sobre activación, exposición y evolución del producto; el gateway ejecuta contratos aprobados y devuelve evidencia útil, sin atribuir a la IA autoridad implícita para ampliar permisos, comprometer dinero o certificar cumplimiento por el hecho de producir respuestas extensas o aparentemente convincentes dentro de un flujo que puede integrar múltiples modelos, herramientas y proveedores con estados independientes que siempre requieren admisión determinística y revisión proporcional al riesgo antes de ejecutar efectos del sistema receptor para el caso concreto del usuario autorizado.

## 36. Caso trabajado: puerto dormido en un producto determinístico

AI-3601. Entrada hipotética: una aplicación de inventario calcula saldos mediante transacciones y solo contempla resúmenes narrativos como posibilidad futura.
AI-3602. El propietario autoriza preparar integración arquitectónica, pero no instalar runtimes, descargar pesos ni contratar un proveedor externo.
AI-3603. La decisión inicial conserva puerto documentado y modo `OFF` con funciones determinísticas disponibles en el arranque ordinario.
AI-3604. El adaptador futuro se registra mediante metadatos locales y no importa un SDK con inicialización automática de conexiones.
AI-3605. El perfil declara que resúmenes narrativos están `NOT_IMPLEMENTED` y que los saldos de inventario no dependen de esa función.
AI-3606. El presupuesto de IA permanece cerrado y ningún proceso realiza discovery remoto para completar automáticamente la configuración ausente.
AI-3607. La prueba arranca sin credenciales, desconecta red y verifica que consultar existencias mantiene el resultado del baseline determinístico.
AI-3608. Una solicitud manual a la capacidad narrativa devuelve `AI_DISABLED` y no intenta identificar un proveedor gratuito disponible.
AI-3609. El registro conserva código de rechazo y caso solicitado, sin crear una reserva monetaria que nunca podría utilizarse.
AI-3610. La inspección de procesos confirma ausencia de runtime residente; la memoria ordinaria de validadores pertenece a la aplicación.
AI-3611. El inventario de archivos antes y después muestra que ningún modelo apareció por efecto secundario del arranque del producto.
AI-3612. Una dependencia candidata llama a su catálogo durante importación; ese comportamiento contradice el contrato dormido del caso.
AI-3613. El equipo mueve importación detrás de activación o reemplaza dependencia, conservando prueba negativa contra regresión en futuros upgrades.
AI-3614. Contraejemplo: mostrar un toggle apagado mientras un modelo se precarga constituye residencia activa encubierta, aunque no haya inferencia.
AI-3615. Contraejemplo: descargar pesos durante instalación «para estar listo» excede el alcance humano autorizado de preparar la arquitectura.
AI-3616. El resultado de diseño incluye capacidades futuras, errores y puntos de extensión sin presentar rutas administrativas como implementadas.
AI-3617. Una decisión posterior autoriza evaluar `LOCAL`, pero todavía no permite producción ni transmisión a APIs de terceros.
AI-3618. Antes de descargar, el evaluador mide RAM, VRAM, disco y carga real conforme a un perfil específico del candidato.
AI-3619. El catálogo comprueba licencia y digest; una aprobación técnica de carga no reemplaza autoridad sobre descarga externa.
AI-3620. El primer ensayo crea una reserva propia y utiliza datos sintéticos para no ampliar el tratamiento documental previsto del producto.
AI-3621. Si la evaluación no cabe en recursos, la aplicación continúa en `OFF` y conserva operativas sus funciones determinísticas.
AI-3622. La recuperación de una importación defectuosa elimina únicamente residuos propios verificados y devuelve al baseline sin cambiar permisos.
AI-3623. El informe no promete consumo total de RAM cero; explica ausencia de memoria adicional de modelos y servicios de inferencia.
AI-3624. El propietario puede decidir que la función futura no aporta utilidad suficiente y retirar su implementación experimental sin afectar saldos.
AI-3625. La prueba de retirada conserva el contrato y verifica que consumidores reciben un error estable, sin crash de negocio.
AI-3626. La aceptación registra `OFF` observado, cero llamadas externas de IA y ausencia de descargas automáticas durante el arranque inspeccionado.
AI-3627. La evidencia identifica periodo de observación y métodos empleados, evitando extrapolar una sesión a todos los entornos futuros.
AI-3628. El caso demuestra proporcionalidad: conservar extensibilidad no obliga a financiar ni mantener una infraestructura probabilística innecesaria.
AI-3629. La lección operativa se incorpora al perfil del producto y a pruebas pertinentes, sin crear una obligación de servicio permanente.
AI-3630. El cierre entrega arquitectura y evidencia del estado dormido, distinguiendo claramente la evaluación local posterior como operación separada.

## 37. Caso trabajado: intersección vacía con un expediente restringido

AI-3701. Entrada hipotética: un actor autorizado solicita extracción sustentada de un expediente clasificado restringido para su propio tenant.
AI-3702. La política admite únicamente `LOCAL` y `PRIVATE_CLOUD`, y exige salida estructurada con citas verificadas del manifiesto documental.
AI-3703. El candidato local cumple privacidad y esquema, pero su perfil de recursos excede VRAM disponible medida al momento de admisión.
AI-3704. El candidato privado cabe en recursos, pero no acredita el contrato de citas que necesita el consumidor del resultado.
AI-3705. Un candidato cloud ofrece buena calidad y bajo costo, pero su destino está prohibido para la clasificación del expediente.
AI-3706. El compilador genera filtros separados y observa que ningún candidato pertenece simultáneamente a todas las restricciones obligatorias del caso.
AI-3707. La decisión devuelve `NO_ELIGIBLE_ROUTE` con diagnóstico autorizado y no pondera privacidad contra calidad para elegir el proveedor cloud.
AI-3708. El producto comunica indisponibilidad de extracción sustentada y mantiene acceso determinístico al expediente para el actor autorizado.
AI-3709. No se envían fragmentos ni embeddings al candidato excluido durante comparación porque la elegibilidad se calcula sin ejecutar inferencia.
AI-3710. El ledger no registra gasto de proveedor y conserva únicamente causas del rechazo pertinentes para operación del caso.
AI-3711. Una alternativa local de extracción regex puede prepararse si el contrato del producto distingue su cobertura y limitaciones frente a IA.
AI-3712. Esa alternativa no recibe la etiqueta de «revisión semántica completa» porque solo extrae patrones verificables del documento aprobado.
AI-3713. El equipo propone reducir carga del host o validar un candidato privado capaz, sin habilitar automáticamente un destino externo nuevo.
AI-3714. El propietario autoriza una evaluación privada; el benchmark utiliza corpus aprobado y respeta recursos y presupuesto de ensayo.
AI-3715. El candidato privado demuestra citas correctas en casos representativos y adversariales, pero aún conserva revisión administrativa pendiente de activación.
AI-3716. La activación aprobada actualiza catálogo y época; solicitudes futuras recompilan rutas con capacidades comprobadas y política vigente.
AI-3717. Contraejemplo: el router selecciona cloud porque su score agregado supera al local; esa aritmética produce exposición prohibida del expediente.
AI-3718. Contraejemplo: el adaptador privado devuelve un texto convincente sin citas y el consumidor lo acepta porque el formato es legible.
AI-3719. La prueba reproduce ambas desviaciones y exige rechazo antes de egress o persistencia de una respuesta incompatible con el caso.
AI-3720. La prueba de carrera revoca candidato privado entre reserva y ejecución; el ejecutor verifica época y libera recursos sin enviar datos.
AI-3721. El rechazo de una nueva solicitud no invalida resultados históricos correctamente producidos, pero su entrega sigue verificando permisos actuales.
AI-3722. La recuperación de un egress accidental bloquea la ruta, preserva evidencia minimizada y trata exposición conforme al runbook del producto.
AI-3723. No se describe eliminación remota como borrado confirmado si el proveedor no ofrece evidencia suficiente del alcance del efecto.
AI-3724. La revisión investiga qué filtro fue omitido y corrige el compilador, evitando solamente agregar una frase de privacidad al prompt.
AI-3725. La aceptación exige cero llamadas al destino prohibido en el caso adversarial y evidencia de todos los filtros aplicados.
AI-3726. Los registros no publican contenido del expediente para demostrar rechazo; bastan identificadores y políticas saneadas accesibles al revisor.
AI-3727. La decisión del propietario puede conservar indisponibilidad antes que ampliar exposición, y el producto debe reflejarla honestamente al usuario.
AI-3728. El caso distingue restricción obligatoria y preferencia optimizable: precio y latencia se comparan únicamente dentro del conjunto elegible.
AI-3729. Una aprobación futura de otro destino requiere nueva evidencia y no reinterpreta retroactivamente como válida la ruta originalmente prohibida.
AI-3730. El cierre documenta extracción suspendida, alternativa limitada y condiciones concretas para reanudar la capacidad bajo el mismo objetivo autorizado.

## 38. Caso trabajado: dos cargas concurrentes y KV cache creciente

AI-3801. Entrada hipotética: un host dispone de 18 GiB útiles de RAM y 10 GiB útiles de VRAM después de márgenes operativos.
AI-3802. El perfil medido del modelo reserva 6 GiB de VRAM para pesos y runtime, más 2 GiB por sesión larga.
AI-3803. La carga requiere un pico temporal adicional de 1 GiB y la aplicación determinística conserva su propia reserva de RAM.
AI-3804. Dos ejecutores observan simultáneamente la misma disponibilidad y cada uno propone iniciar una instancia independiente con una sesión activa.
AI-3805. Una decisión basada solo en fotografía admitiría ambos trabajos y superaría la capacidad real cuando las cargas y KV coincidan.
AI-3806. El ledger atómico concede reserva a una instancia y rechaza o encola la otra antes de comenzar descarga de memoria.
AI-3807. El segundo trabajo puede reutilizar instancia compartida únicamente si el runtime lo soporta y existe presupuesto para otra sesión concurrente.
AI-3808. Con pesos comunes, dos sesiones consumen 10 GiB estables, pero el margen de seguridad puede impedir admitir la segunda sesión.
AI-3809. El límite efectivo deriva del perfil medido y tolerancias del host; no se fuerza utilización completa de VRAM para mejorar una gráfica.
AI-3810. Una solicitud amplía contexto después de admisión y necesita reevaluación; el adaptador no puede aumentar KV fuera de reserva.
AI-3811. La política restringe salida y contexto máximo para conservar un límite superior de consumo verificable por sesión admitida del modelo.
AI-3812. El scheduler registra reserva, estado de cola y deadline restante, evitando prometer atención de un trabajo cuyo plazo ya resulta inviable.
AI-3813. El primer worker cae durante carga; el lease expira pero el proceso del runtime permanece vivo consumiendo la memoria reservada.
AI-3814. El reconciliador consulta proceso y propiedad antes de liberar recursos; vencimiento temporal no demuestra disponibilidad real del host.
AI-3815. Si puede terminar proceso propio, confirma salida y medición posterior antes de admitir el trabajo en espera con una reserva nueva.
AI-3816. Si la propiedad del proceso es incierta, mantiene bloqueo y solicita intervención concreta sin matar otros servicios que comparten GPU.
AI-3817. La evidencia conserva picos, reserva y discrepancia entre estimado y observado para recalibrar el perfil del modelo posteriormente.
AI-3818. Contraejemplo: calcular memoria solamente desde tamaño de pesos omite KV, activaciones y copias temporales de carga del runtime seleccionado.
AI-3819. Contraejemplo: liberar reserva al desconectar navegador ignora que la inferencia continúa y mantiene memoria ocupada en el servidor.
AI-3820. La prueba concurrente usa barrera de inicio para que los ejecutores soliciten reserva sobre la misma fotografía de recursos disponible.
AI-3821. El resultado exige suma de reservas compatible y evidencia de que el segundo no inició carga antes de obtener admisión válida.
AI-3822. La prueba de contexto creciente fuerza el máximo permitido y confirma que el perfil cubre memoria bajo la combinación evaluada.
AI-3823. La prueba de caída verifica detección de proceso huérfano y ausencia de liberación prematura basada únicamente en caducidad del lease.
AI-3824. La recuperación devuelve la instancia a estado disponible o fallido según evidencia; nunca mantiene un indicador cargado basado en persistencia antigua.
AI-3825. La admisión también verifica RAM porque offloading puede reducir VRAM y aumentar presión del producto que comparte memoria principal.
AI-3826. Cambiar cuantización requiere perfil propio; el equipo no extrapola recursos ni calidad desde una variante de precisión distinta del modelo.
AI-3827. La aceptación usa equipo y runtime identificados, muestras y tolerancias, sin garantizar idéntico comportamiento para todos los aceleradores del mercado.
AI-3828. El propietario recibe capacidad segura observada y opciones concretas: menor contexto, menor concurrencia o hardware diferente bajo evaluación separada.
AI-3829. El caso demuestra que concurrencia es una decisión de reserva agregada, no una propiedad implícita de que un modelo haya cargado una vez.
AI-3830. El cierre conserva sesión rechazada o encolada con causa real y evita presentar falta de recursos como un fallo del proveedor de inferencia.

## 39. Caso trabajado: saldo limitado, moneda distinta y uso tardío

AI-3901. Entrada hipotética: un caso tiene límite interno de 100 unidades monetarias y gasto confirmado de 60 en el periodo vigente.
AI-3902. Existen holds por 20 y exposición incierta por 10; por tanto solo 10 unidades permanecen disponibles para nuevas reservas.
AI-3903. Dos solicitudes estiman máximo de 8 unidades cada una con una tarifa ficticia aprobada exclusivamente para esta prueba del algoritmo.
AI-3904. La reserva atómica permite una solicitud y rechaza la otra porque aceptar ambas llevaría exposición total a 106 unidades del periodo.
AI-3905. El sistema no compara únicamente gasto confirmado de 60, pues ignorar holds e incertidumbre permitiría comprometer un saldo inexistente del caso.
AI-3906. El proveedor factura en moneda distinta y el perfil utiliza tipo de cambio versionado con margen conservador dentro de la estimación.
AI-3907. La solicitud admitida conserva tarifa, tasa, fecha y moneda para explicar el cálculo sin atribuir precios reales a ningún proveedor comercial.
AI-3908. La generación se cancela después de consumir parte de salida y el adaptador no recibe reporte de uso definitivo del servicio externo.
AI-3909. El hold de 8 pasa a exposición incierta hasta que reconciliación permita estimar o confirmar gasto según la política financiera vigente.
AI-3910. El navegador recibe cancelación solicitada, pero la interfaz administrativa no muestra consumo cero ni libera automáticamente ese saldo pendiente del caso.
AI-3911. Un reporte tardío confirma costo de 5; la liquidación libera diferencia de 3 y registra gasto adicional idempotente en el ledger.
AI-3912. El mismo reporte se entrega dos veces y la clave de evento evita incrementar gasto a 10 por una sola solicitud originalmente admitida.
AI-3913. Una corrección posterior del proveedor indica costo de 6 y genera asiento de ajuste trazable de una unidad, preservando el historial anterior.
AI-3914. El saldo actualizado considera otros holds y exposición pendiente, por lo que la solicitud rechazada no se reenvía automáticamente al liberar diferencia.
AI-3915. El actor puede volver a solicitar y obtiene nueva admisión con tarifa y deadline actualizados, sin reutilizar una reserva que ya fue liquidada.
AI-3916. Contraejemplo: liberar hold por timeout permite gastar nuevamente aunque el proveedor siga procesando y posteriormente facture el trabajo inicialmente incierto del caso.
AI-3917. Contraejemplo: sumar cada callback de uso duplica costo y puede bloquear injustamente al tenant por eventos de transporte repetidos de una misma ejecución.
AI-3918. La prueba usa transacciones concurrentes y verifica exposición máxima, número de reservas concedidas y ausencia de saldo negativo bajo todas las intercalaciones consideradas.
AI-3919. La prueba de monedas cambia tasa después de admisión y confirma que el registro mantiene la estimación original y liquidación según política de ajuste explícita.
AI-3920. La prueba de incertidumbre simula caída del worker después del envío; el presupuesto mantiene exposición suficiente hasta contar con reporte o decisión autorizada sobre conciliación.
AI-3921. La recuperación consulta estado comercial mediante una operación autorizada y acotada, evitando revelar credenciales o reenviar la inferencia solamente para descubrir cuánto costó la anterior solicitud.
AI-3922. Si nunca llega evidencia definitiva, una decisión de conciliación conserva fundamento y autoridad sin describir el monto estimado como facturación real confirmada del proveedor externo seleccionado para el caso.
AI-3923. El panel separa consumido confirmado, reservado y pendiente; un único número de «gasto» podría esconder obligación todavía incierta o capacidad disponible del presupuesto administrado por el propietario del producto receptor.
AI-3924. Aumentar el límite requiere acción autorizada del plano administrativo y no se ejecuta porque el modelo recomiende continuar una conversación cuyo saldo reservado ya se agotó durante atención de solicitudes previas del usuario.
AI-3925. El límite se comprueba también para reparaciones de formato y verificadores, de modo que costo final no supere la exposición aprobada por contabilizar solo la llamada generativa principal del pipeline del caso.
AI-3926. La aceptación acredita idempotencia de liquidación y reserva concurrente con cifras hipotéticas, evitando convertir la prueba del algoritmo en presupuesto comercial para proveedores actuales cuya tarifa el equipo no ha verificado de manera primaria.
AI-3927. El responsable conserva política de redondeo y ajuste porque diferencias pequeñas acumuladas pueden alterar denegación efectiva del límite en un producto con muchas solicitudes y múltiples etapas de consumo por caso del usuario autenticado del sistema receptor.
AI-3928. El caso demuestra que cancelar no equivale a no gastar y que costo confirmado no representa toda exposición de una arquitectura con trabajo remoto, callbacks tardíos y reintentos que deben conservar causalidad dentro de su ledger financiero operativo.
AI-3929. La revisión final compara ledger, reportes y reglas de moneda y explica cualquier diferencia antes de declarar cerrado el periodo evaluado para evitar que una aparente disponibilidad administrativa oculte cargos aún no conciliados de proveedores usados por el caso autorizado.
AI-3930. El cierre entrega saldo verificable y estado de solicitudes rechazadas, admitidas y pendientes, con la información suficiente para que el propietario decida continuidad sin recibir precios inventados, tokens secretos ni afirmaciones contables más amplias que la evidencia disponible del producto receptor.

## 40. Caso trabajado: respuesta JSON parcial y cancelación después de herramienta

AI-4001. Entrada hipotética: una extracción produce un objeto con campos y citas, y una herramienta autorizada guarda un borrador interno reversible.
AI-4002. El contrato exige documento completo, esquema válido y citas del manifiesto; los fragmentos del stream no satisfacen por sí solos aceptación del resultado.
AI-4003. El buffer recibe apertura del objeto, dos campos y una propuesta de guardar borrador; el ejecutor valida la herramienta independientemente de la generación.
AI-4004. La política permite guardar un borrador etiquetado incompleto, pero prohíbe publicar o marcar extracción aprobada antes de validación final de contenido y referencias.
AI-4005. El guardado utiliza clave de intención y parámetros normalizados, devuelve identificador y versión del borrador confirmado en almacenamiento interno del tenant autorizado.
AI-4006. El usuario solicita cancelar antes de recibir cierre JSON y el gateway detiene nuevas herramientas aunque el proveedor continúe emitiendo tokens tardíos del stream.
AI-4007. El adaptador confirma cierre de transporte pero no cese de facturación; el estado combina cancelación de entrega y exposición monetaria pendiente del servicio externo utilizado.
AI-4008. El borrador confirmado permanece incompleto con evidencia de cancelación; no se elimina ni presenta como extracción final por una instrucción tardía del modelo generador.
AI-4009. La política puede ofrecer retirar el borrador mediante una acción reversible autorizada, pero esa compensación se registra como efecto propio y no como ausencia del guardado anterior.
AI-4010. La interfaz del usuario distingue texto parcial, borrador conservado y solicitud cancelada, evitando una única etiqueta «todo deshecho» que sería falsa respecto de almacenamiento y cargos pendientes del caso.
AI-4011. El validador no intenta cerrar manualmente el JSON e inventar campos faltantes para convertir una interrupción en éxito formal del esquema de salida solicitado para una extracción sustentada del documento.
AI-4012. Una reparación posterior requiere nueva intención y admisión, conserva contexto autorizado y puede usar el borrador solo si sigue siendo pertinente y accesible para el actor autenticado del tenant que pidió cancelar.
AI-4013. Contraejemplo: el cliente parsea campos incrementales y actualiza entidad final antes de verificar citas; el estado de negocio queda basado en respuesta no validada que el contrato original del producto nunca aceptó como resultado completo.
AI-4014. Contraejemplo: la desconexión del navegador se interpreta como rollback confirmado y el sistema libera saldo pese a que proveedor y almacenamiento mantienen efectos que aún necesitan conciliación dentro del caso cancelado por el usuario final del producto receptor.
AI-4015. La prueba cancela en una barrera inmediatamente después del guardado confirmado y verifica ausencia de publicación, presencia del borrador incompleto y conservación del evento de intención para evitar repetición de la herramienta durante recuperación posterior del flujo.
AI-4016. La prueba duplica el chunk que contiene propuesta de herramienta; la deduplicación del ejecutor mantiene un solo borrador para la misma intención autorizada y rechaza parámetros distintos con clave idéntica que el modelo intente generar más tarde del stream.
AI-4017. La prueba envía cierre JSON tardío después de cancelar y comprueba que no cambia el estado a completed ni sobrescribe el borrador cancelado como extracción final aceptada por el consumidor del producto que conserva un contrato explícito de validación antes de persistencia definitiva.
AI-4018. La prueba reconecta desde cursor y comprueba que eventos recuperados no ejecutan nuevamente herramientas, porque recuperación de entrega visual se separa de reconciliación y ejecución de efectos que ya tienen estado confirmado en ledger para la solicitud originalmente admitida bajo autoridad vigente del usuario.
AI-4019. La recuperación conserva causalidad entre cancelación, guardado y liquidación, y permite al operador autorizado consultar cada efecto por separado sin exponer contenido privado del documento en un panel general de infraestructura que solo necesita estado, identificadores saneados y recursos asociados al caso interrumpido durante generación de salida estructurada.
AI-4020. Si el guardado queda incierto por caída después de envío, consultar estado por intención antes de compensar; no crear un segundo borrador ni borrar uno de otro actor que coincida por título dentro del tenant que estaba usando la función autorizada de extracción durante el stream cancelado por el usuario.
AI-4021. La aceptación exige que ningún resultado parcial llegue a consumidores que esperan entidades finales validadas, mientras mantiene estados útiles de progreso y borrador para tareas permitidas que no necesitan la misma garantía de totalidad documental dentro del producto receptor que define explícitamente qué efectos puede producir el gateway en cada fase del caso.
AI-4022. El equipo revisa si realmente necesita una herramienta antes de completar validación; mover guardado después del resultado final puede simplificar recuperación y reducir superficie de estados intermedios, siempre que el requisito de experiencia del usuario no exija conservación incremental del trabajo parcialmente generado por el modelo bajo streaming durante atención del documento autorizado del caso.
AI-4023. La elección se documenta como diseño del producto y no como permiso general para ejecutar efectos tempranos en cualquier salida del modelo, porque otros casos pueden involucrar publicación, dinero o cambios irreversibles cuya compensación no representa recuperación completa del estado anterior a la solicitud probabilística cancelada por el usuario del sistema receptor.
AI-4024. El costo pendiente se reconcilia mediante reporte de uso y no desde longitud del fragmento mostrado, ya que el proveedor puede haber procesado tokens que nunca llegaron al cliente después de cancelar o perder conexión durante el stream cuya entrega final no superó validación de esquema y fundamento requerida por el contrato de salida del caso.
AI-4025. La evidencia de validación registra que nunca existió resultado final aceptado; conservar un borrador no permite contar esta ejecución como éxito semántico al evaluar la tasa de extracción correcta del modelo ni como ausencia de costo al analizar recursos consumidos por la combinación efectiva del gateway que atendió el documento dentro de restricciones del propietario del producto receptor.
AI-4026. El registro de cancelación incluye solicitante y época para impedir que un actor sin autoridad cancele trabajos ajenos simplemente adivinando requestId de un stream compartido, y la comprobación de acceso se aplica también a consultas posteriores de estado y recuperación del borrador que contiene datos derivados del documento privado utilizado por el tenant autorizado del sistema receptor.
AI-4027. El propietario recibe una explicación de qué cesó, qué permanece y qué es incierto, permitiendo decidir si elimina borrador o inicia extracción nueva sin inducir una repetición peligrosa de herramientas que ya pudieron ejecutar efectos; el modelo no elige esa decisión basándose en su preferencia por completar la tarea a cualquier costo después de que el usuario retiró continuidad del caso.
AI-4028. La lección del caso es separar entrega, validación, persistencia y herramientas como fronteras operativas verificables; un stream es transporte de contenido progresivo y no prueba que cada fragmento pueda actuar con autoridad de una entidad de negocio completa que el producto receptor pretende usar para una decisión crítica o como fundamento documental de una acción autorizada del usuario final.
AI-4029. La revisión comprueba límites de buffers y retención del borrador incompleto para que cancelaciones repetidas no acumulen memoria ni archivos privados indefinidamente; las pruebas de experiencia y recursos deben considerar usuarios lentos, reconexiones y errores del proveedor que interrumpen la respuesta sin un terminador confiable del stream que el adaptador normaliza para el puerto del sistema receptor.
AI-4030. El cierre distingue salida cancelada, herramienta confirmada y exposición pendiente con evidencia proporcional al caso, sin afirmar que un botón de cancelación garantiza reversión de todas las consecuencias externas de un pipeline que ya produjo efectos separados bajo autorización humana y política determinística del producto que utiliza la capacidad de IA arquitectónica descrita por este manual EOS del propietario.

## 41. Caso trabajado: revocación de acceso con un resultado cacheado

AI-4101. Entrada hipotética: dos tenants solicitan resumen con texto idéntico, pero adjuntan contratos privados distintos que comparten un nombre de archivo.
AI-4102. La clave basada solo en prompt y modelo sería igual y podría servir información del primer tenant al segundo actor del producto.
AI-4103. La clave correcta incorpora dominio de autorización, propósito, manifiesto, políticas y revisión efectiva del modelo y del contrato de salida.
AI-4104. El caché conserva resultados separados y cada lectura verifica permisos actuales sobre documentos que fundamentan el contenido devuelto al usuario autenticado.
AI-4105. Un actor del primer tenant pierde acceso al contrato después de que el resumen haya sido cacheado con TTL aún vigente.
AI-4106. La revocación incrementa época de autorización y el producto deniega lectura del resultado sin esperar caducidad natural del almacenamiento.
AI-4107. La invalidación elimina o marca inaccesible el resultado según retención definida, conservando únicamente evidencia administrativa necesaria para explicar denegación del caso.
AI-4108. Otro actor autorizado del mismo tenant puede requerir acceso distinto; el diseño debe definir dominio de autorización sin compartir automáticamente por pertenencia organizacional.
AI-4109. Una respuesta derivada de varios contratos requiere verificar acceso a todos los documentos relevantes o demostrar separación segura del contenido que se pretende exponer.
AI-4110. La revocación de uno obliga a invalidar resultado completo cuando no pueda atribuirse cada afirmación a fuentes todavía accesibles con suficiente certeza operativa.
AI-4111. El panel de infraestructura muestra invalidaciones agregadas y no revela nombres de contratos privados a un operador que solo administra capacidad del caché multiusuario.
AI-4112. La prueba usa contratos con marcadores sintéticos diferentes y comprueba que ningún marcador del tenant anterior aparece en respuesta, traza o métricas del tenant posterior.
AI-4113. La prueba revoca permisos entre lookup y entrega; la segunda comprobación de época impide exponer un valor encontrado antes de que cambiara la autorización vigente.
AI-4114. La prueba retrasa un evento de invalidación en un nodo y verifica que comprobación confiable de permisos o coherencia de época todavía impide acceso durante el retraso.
AI-4115. Contraejemplo: TTL breve reduce exposición temporal pero no satisface una revocación inmediata exigida por la política del producto para documentos restringidos del actor autenticado.
AI-4116. Contraejemplo: usar hash sin tenant permite correlación de contratos iguales y no demuestra autorización compartida sobre su resultado derivado entre organizaciones distintas del sistema receptor.
AI-4117. La recuperación de una fuga potencial bloquea namespace afectado, cambia época pertinente y revisa claves de escritores sin purgar indiscriminadamente datos de todos los tenants legítimos.
AI-4118. La investigación conserva referencias saneadas de cache hits y permisos, evitando copiar contratos completos a un reporte que ampliaría exposición causada por el defecto que se intenta analizar.
AI-4119. Un parche de clave no corrige automáticamente valores contaminados previos; ejecutar invalidación dirigida y verificar que namespace antiguo ya no recibe ni sirve resultados para nuevas solicitudes autorizadas.
AI-4120. La aceptación utiliza acceso revocado, archivos homónimos y resultados derivados mixtos para demostrar aislamiento real en lugar de una prueba positiva que solo muestra un resumen correcto del documento de un tenant.
AI-4121. Los embeddings y fragmentos recuperados se revisan también, pues corregir caché de respuestas no elimina otras superficies donde pudieron mezclarse datos privados durante el procesamiento previo del pipeline del caso.
AI-4122. El ledger de acceso conserva la decisión vigente y no interpreta una respuesta previamente generada como autorización perpetua para quien la produjo cuando aún podía leer el contrato del tenant correspondiente.
AI-4123. Las copias descargadas legítimamente antes de revocación pueden estar fuera del control del sistema; no prometer que invalidar caché borra contenido que un usuario ya recibió y conservó en su propio equipo.
AI-4124. La comunicación del incidente distingue acceso potencial y acceso observado, para que el propietario decida medidas sin recibir una afirmación de fuga confirmada que la evidencia técnica del producto aún no demuestra.
AI-4125. El caso obliga a definir comportamiento bajo partición de red: denegar por incertidumbre puede ser necesario cuando la política no tolera servir permisos potencialmente obsoletos desde un nodo aislado del servicio confiable de autorización.
AI-4126. La denegación se presenta como indisponibilidad o acceso retirado conforme al estado comprobado, evitando revelar existencia de un contrato privado cuando el actor del segundo tenant nunca tuvo autoridad sobre su consulta ni sus resultados derivados.
AI-4127. El diseño de clave y época se prueba en integración con la fuente real de permisos, porque una función de hash correcta no demuestra que revocaciones lleguen a todos los puntos de entrega del resultado generado por el gateway.
AI-4128. La lección operativa es que ahorro de inferencia no puede ahorrar comprobación de acceso vigente y que autorización forma parte de identidad semántica del valor cacheado que el producto decide devolver al usuario según su propósito y caso concreto.
AI-4129. El cierre conserva evidence de aislamiento y revocación y declara límites de coherencia observados, sin afirmar disponibilidad o privacidad absolutas frente a condiciones de infraestructura que el ensayo no cubrió ni el contrato del host permite controlar totalmente durante ejecución del producto receptor.
AI-4130. El propietario puede limitar caché a casos públicos o deshabilitarla para documentos altamente restringidos si beneficio medido no compensa complejidad de invalidación, y esa decisión conserva utilidad del puerto sin introducir una optimización que contradiga políticas de datos del sistema receptor autorizado del proyecto EOS.

## 42. Caso trabajado: inyección y tool call con envío incierto

AI-4201. Entrada hipotética: un usuario pide analizar un documento, y una página recuperada contiene una instrucción oculta para enviar el expediente a un correo externo.
AI-4202. La autoridad humana cubre análisis y un borrador local, pero no envío externo ni cambio de destinatarios del caso autorizado.
AI-4203. El empaquetador identifica la página como contenido no confiable y el modelo puede resumirla sin convertir sus instrucciones en política del sistema.
AI-4204. El modelo propone `sendDocument` y el ejecutor rechaza por falta de autoridad sobre destinatario, recurso y transmisión de datos restringidos.
AI-4205. El rechazo no se resuelve cambiando proveedor ni pidiendo al modelo que emita argumentos «más seguros» para la misma operación externa prohibida.
AI-4206. La evidencia registra herramienta denegada y origen de propuesta con referencias saneadas, manteniendo el documento privado fuera de logs generales del gateway.
AI-4207. Una decisión humana posterior autoriza un envío concreto de un borrador saneado a un destinatario específico, sin habilitar envío ilimitado de expedientes.
AI-4208. El ejecutor valida digest del borrador, destinatario normalizado y versión de autorización antes de preparar una intención en ledger del caso.
AI-4209. El proveedor de mensajería acepta solicitud pero la respuesta se pierde; el estado queda `uncertain` porque el envío pudo producirse externamente.
AI-4210. El destino no ofrece clave de idempotencia y una repetición automática puede enviar dos copias del documento al destinatario aprobado para una sola intención.
AI-4211. El reconciliador consulta estado mediante identificador disponible o evidencia del conector, con límites de tiempo y autoridad de lectura correspondientes al servicio externo del caso.
AI-4212. Si no existe evidencia suficiente, el propietario recibe decisión concreta sobre esperar, consultar otro canal autorizado o repetir conscientemente con riesgo de duplicado que el sistema no puede eliminar.
AI-4213. El gateway no afirma exactamente una vez porque una outbox local conserve intención; la incertidumbre persiste en la frontera del destinatario que carece de deduplicación verificable para esa operación externa.
AI-4214. Contraejemplo: un agente interpreta «ayúdame con este documento» como permiso de correo y ejecuta la instrucción hallada en su contenido, elevando autoridad de datos externos por encima del alcance humano real del caso.
AI-4215. Contraejemplo: un timeout se convierte en fallo seguro y el conector repite el envío con una clave nueva, ocultando al usuario la posibilidad de dos efectos externos derivados de una sola intención originalmente aprobada por el propietario.
AI-4216. La prueba inyecta destinatarios mediante documento, error del conector y salida del modelo y verifica que ninguno altera la autorización concreta del servidor que gobierna herramientas y egress del producto receptor en cada fase del caso.
AI-4217. La prueba cae después de despacho y antes de confirmación; la recuperación conserva estado incierto y nunca repite envío hasta completar reconciliación o recibir una decisión humana que cubra conscientemente el efecto nuevo con sus consecuencias explícitas del caso.
AI-4218. La prueba modifica contenido del borrador con la misma clave y confirma conflicto de intención, porque aprobación del documento anterior no autoriza automáticamente transmitir una versión distinta que pueda incluir datos sensibles adicionales del expediente restringido procesado por el gateway para el usuario del producto.
AI-4219. La recuperación bloquea nuevos envíos del flujo mientras revisa exposición potencial y conserva análisis local autorizado que no depende de la decisión sobre mensajería; el incidente no debe impedir trabajo independiente ni fabricar conclusión de que toda la tarea documental fue completada correctamente bajo el alcance del propietario.
AI-4220. La consulta de estado no incluye token comercial en prompts ni logs; el conector usa credenciales acotadas y devuelve estado normalizado, evitando que el modelo tenga capacidad de hacer replay arbitrario contra el servicio de mensajería cuya operación externa requiere permiso específico por intención y contenido autorizado del caso.
AI-4221. Si finalmente se confirma envío, el ledger marca efecto confirmado y el usuario recibe evidencia suficiente, sin afirmar que destinatario leyó el documento cuando el servicio solo acredita aceptación o entrega técnica bajo sus capacidades disponibles para el producto receptor que ejecutó la herramienta externa dentro del flujo autorizado del propietario.
AI-4222. Si se confirma ausencia de envío, el ejecutor puede reintentar dentro de la autorización vigente y presupuesto correspondiente, revalidando precondiciones del borrador y destinatario que podrían haber cambiado durante investigación; no reutiliza aprobación obsoleta para transmitir una nueva versión sin comprobar si su contenido sigue coincidiendo con la intención original admitida del caso.
AI-4223. Si la situación sigue incierta, el cierre conserva `uncertain` y no lo oculta como «completado» para satisfacer al usuario; el resto de entregables puede estar terminado y debe distinguirse de una herramienta cuyo efecto externo no permite garantía suficiente mediante los medios disponibles del host y conector usados por el gateway del sistema receptor.
AI-4224. El propietario puede retirar la herramienta de mensajería y seguir usando el modelo para análisis; esa independencia confirma que capacidad lingüística y autoridad externa son fronteras separadas que una integración universal no debe fusionar por conveniencia de SDK o porque un proveedor permita tool calling sin controles explícitos de ejecución dentro del puerto de IA del producto.
AI-4225. El caso incluye una compensación posible de notificar error, pero ese aviso es otra comunicación externa y necesita autoridad; la recuperación no concede por sí misma permiso para enviar mensajes adicionales a destinatarios distintos ni divulgar incidente a terceros cuando el usuario solo autorizó un envío específico de contenido revisado al destino concreto del flujo documental del producto receptor.
AI-4226. Las pruebas de herramientas contabilizan denegaciones como éxito del control y no como fracaso del modelo por negarse a completar una instrucción hostil, permitiendo comparar versiones con criterios de utilidad y seguridad que reflejan el mandato del propietario y no una métrica de cumplimiento indiscriminado de todas las solicitudes textuales presentadas como datos dentro del caso autorizado.
AI-4227. La evaluación conserva un ejemplo adversarial sintético del patrón y evita almacenar el expediente real completo para reproducir una inyección que puede demostrarse con contenido ficticio y el mismo contrato de permisos del servidor, lo que permite revisar regresiones futuras sin ampliar innecesariamente tratamiento de documentos privados que alimentaron el incidente del sistema receptor durante atención del usuario final autorizado.
AI-4228. El diseño puede exigir un borrador revisable antes de todo envío sensible y vincular aprobación a su digest, reduciendo ambigüedad de intención sin crear una confirmación repetida cuando el propietario ya autorizó exactamente la acción y contenido que el ejecutor tiene preparado, validado y listo para despachar dentro de los controles del entorno que permiten operación externa del producto receptor.
AI-4229. La lección operativa es que herramientas necesitan autoridad determinística y evidencia de efectos; un modelo puede proponer una acción útil o peligrosa, pero su propuesta no modifica permisos y un log local no convierte incertidumbre remota en garantía exactamente una vez que el destino no soporta ni el producto puede demostrar mediante sus contratos y capacidades verificadas para el caso concreto autorizado del usuario.
AI-4230. El cierre entrega análisis y borrador correctos, estado real del envío y condiciones de reconciliación, permitiendo al propietario decidir la única consecuencia aún incierta sin recibir una promesa falsa de recuperación automática ni una afirmación de publicación, entrega o lectura que las herramientas disponibles no han verificado en la frontera del servicio externo operado por un tercero y utilizado por el producto receptor del sistema EOS.

## 43. Caso trabajado: caída del proveedor y tormenta de reintentos

AI-4301. Entrada hipotética: un proveedor autorizado comienza a devolver errores transitorios mientras veinte tenants comparten la misma ruta de inferencia.
AI-4302. Cada SDK intenta tres reintentos internos y el gateway permite dos, produciendo amplificación potencial que el perfil inicial no había contabilizado.
AI-4303. El equipo deshabilita reintentos invisibles del SDK o integra su número real en presupuesto y deadline global de las solicitudes.
AI-4304. La política limita intentos agregados por ventana y abre circuito cuando muestra mínima y tasa de error cumplen umbrales definidos.
AI-4305. Los errores de prompts inválidos se excluyen porque no demuestran indisponibilidad del proveedor y podrían permitir a un atacante abrir circuito artificialmente.
AI-4306. Los trabajos nuevos reciben indisponibilidad honesta o una ruta alternativa previamente aprobada, siempre después de revalidar privacidad y presupuesto del caso.
AI-4307. La cola tiene capacidad máxima y descarta solicitudes cuyo deadline restante no permite completar trabajo, evitando acumular promesas imposibles de atención futura.
AI-4308. El proveedor recupera transporte y el circuito entra `HALF_OPEN` con probes coordinados que varios nodos no pueden multiplicar libremente por su propia decisión.
AI-4309. Los probes utilizan datos sintéticos aprobados y gasto limitado, manteniendo separado diagnóstico de disponibilidad y evaluación de calidad semántica del proveedor autorizado.
AI-4310. Una única respuesta correcta no basta para cerrar circuito cuando la política exige varias muestras en una ventana definida bajo condiciones representativas del servicio.
AI-4311. Una ruta fallback pública permanece excluida para expedientes restringidos aunque el proveedor privado siga abierto y tenga solicitudes pendientes de usuarios frustrados del producto.
AI-4312. El panel muestra tiempo de cola, intentos reales y costo pendiente para que el propietario no interprete falta de resultados como falta de consumo comercial durante el incidente.
AI-4313. Contraejemplo: reiniciar deadline por cada retry permite mantener solicitudes vivas indefinidamente y consume presupuesto más allá de lo que el usuario autorizó para su caso original.
AI-4314. Contraejemplo: todos los nodos ejecutan sus propios probes sin coordinación y producen una avalancha de reconexión justo cuando el servicio todavía tiene capacidad limitada de recuperación del proveedor.
AI-4315. La prueba simula error masivo y verifica que volumen externo nunca excede límite global de intentos, aunque clientes y SDK repitan solicitudes internamente durante la ventana de falla del servicio.
AI-4316. La prueba usa nodos concurrentes en half-open y registra número real de probes para demostrar exclusión y presupuesto efectivo, evitando una conclusión basada solamente en estados administrativos locales del circuito de cada ejecutor.
AI-4317. La prueba alterna fallas y éxitos por segmento, exigiendo que el circuito y la promoción de recuperación no oculten un caso crítico que continúa fallando pese a mejoría agregada de disponibilidad del proveedor seleccionado por el gateway.
AI-4318. La recuperación libera reservas de trabajos nunca despachados y mantiene exposición de los despachados cuyo uso aún no se confirmó, separando estado de cola y ejecución externa para no devolver saldo ya comprometido por intentos reales del caso.
AI-4319. El kill switch administrativo permanece accesible mediante capacidad reservada; la saturación de inferencia no debería impedir detener herramientas o consultar ledger cuando el propietario necesita controlar exposición del incidente que afecta al proveedor y los casos autorizados del producto receptor.
AI-4320. El informe identifica qué capa amplificó reintentos y corrige su configuración, sin atribuir toda la carga al proveedor cuando el gateway también generó tráfico excesivo por límites mal coordinados que el equipo debe demostrar resueltos antes de reabrir operación de los casos autorizados por el propietario.
AI-4321. Si la alternativa modifica capacidad de fundamento o esquema, el producto explica degradación y no devuelve un texto libre con la etiqueta de extracción validada; mantener continuidad visual no justifica reducir integridad del contrato de salida que los consumidores usan para decisiones concretas sobre documentos autorizados del caso.
AI-4322. El equipo conserva métricas del incidente después de recuperar y distingue nueva ventana, porque borrar estadísticas puede esconder duración, exposición y efectividad de controles que el propietario necesita valorar al decidir si mantiene el proveedor como candidato aprobado de su catálogo para tareas futuras bajo presupuesto y restricciones de privacidad del sistema receptor.
AI-4323. La revisión de costo incluye probes y reparaciones porque una ruta que parece operativamente saludable puede seguir generando respuestas inválidas que requieren consumo adicional y elevan exposición más allá de la estimación original usada por admisión para permitir inferencias de usuarios del producto receptor que dependen del contrato aprobado de extracción o síntesis del caso documental.
AI-4324. La recuperación no cambia automáticamente periodos o umbrales para declarar éxito; cualquier ajuste conserva hipótesis, evidencia y autoridad correspondiente, de modo que una modificación de política no oculte el fallo real de un proveedor ni amplíe tráfico y gasto del caso sin que el propietario pueda evaluar concretamente el resultado preparado y las consecuencias del nuevo límite propuesto al sistema.
AI-4325. El deadline global conserva una reserva de tiempo para validación y cierre, evitando una inferencia que agota todo el plazo y devuelve contenido sin controles finales por presión de responder antes de timeout al consumidor; la aplicación debe preferir fallo claro cuando no pueda garantizar el contrato del resultado dentro del tiempo que había aceptado para atender la solicitud autorizada del usuario final del producto receptor.
AI-4326. La aceptación demuestra volumen acotado, colas finitas, probes coordinados y rechazo de fallback prohibido con evidencia del tráfico observado, sin prometer disponibilidad absoluta ante caídas simultáneas de todos los destinos o del host que ejecuta los controles del gateway y mantiene estado necesario de reservas, políticas y herramientas permitidas dentro de la arquitectura real del sistema receptor que utiliza la capacidad probabilística documentada por EOS.
AI-4327. El propietario recibe opciones sustentadas como ajustar SLO, reducir dependencia o evaluar proveedor adicional, pero la evaluación y habilitación siguen siendo operaciones separadas que no ocurren por una recomendación del modelo ni porque un catálogo público anuncie un servicio más rápido durante la ventana de incidente del producto que ya tiene restricciones de privacidad, costo y autoridad sobre los casos de usuario autorizados para usar inferencia y herramientas.
AI-4328. La lección del caso es coordinar reintentos entre capas y presupuesto total; una configuración aparentemente prudente en cada SDK puede producir una carga excesiva cuando se multiplica por gateway, clientes y nodos que comparten una ruta de destino, y solo medición agregada de llamadas efectivamente realizadas demuestra que el sistema respeta exposición, deadlines y capacidad del servicio durante las fallas de transporte del proveedor externo seleccionado por el compilador de rutas del caso.
AI-4329. El cierre distingue fallas del proveedor y defectos de control propios con hechos observados, evitando una explicación basada en impresiones de latencia o en el último comando satisfactorio que no cubre la ventana completa del incidente ni el estado de solicitudes inciertas y saldos pendientes que deben reconciliarse para que el propietario pueda declarar recuperación suficiente de los casos habilitados del producto receptor bajo su autoridad y recursos medidos del entorno operativo del proyecto EOS.
AI-4330. Una alerta final se emite cuando cambia estado útil o requiere decisión del propietario, y los controles continúan observando silenciosamente señales ya conocidas sin generar un mensaje por cada probe fallido que no agrega información; la comunicación del incidente conserva claridad de disponibilidad, exposición y acciones realizadas para que la persona al mando pueda valorar continuidad y recuperación del gateway sin ruido de conclusiones genéricas que no aportan evidencia nueva del sistema receptor afectado por la falla del proveedor.

## 44. Caso trabajado: embeddings nuevos con igual dimensión y corpus cambiante

AI-4401. Entrada hipotética: un índice utiliza revisión E1 de embeddings y el equipo evalúa E2 con la misma dimensión vectorial declarada.
AI-4402. Las pruebas muestran que E2 cambia distancias y ranking; compatibilidad de almacenamiento no acredita compatibilidad semántica de vectores ya persistidos por E1.
AI-4403. El equipo crea namespace nuevo con modelo, revisión, normalización y estrategia de fragmentación declarados, sin sobrescribir el único índice recuperable de corpus autorizado.
AI-4404. La reindexación obtiene presupuesto propio para lectura, embeddings y disco; un caso de consulta ordinario no otorga permiso de exportación masiva del corpus hacia un proveedor externo.
AI-4405. Durante construcción, un documento se revoca y otro se actualiza; el pipeline registra eventos y aplica autorización vigente antes de procesar sus fragmentos con el modelo candidato aprobado.
AI-4406. El índice E2 excluye documento revocado y conserva digest de versión nueva del actualizado; los manifiestos permiten explicar conteos diferentes sin concluir automáticamente una pérdida accidental de registros del producto.
AI-4407. Las consultas de evaluación incluyen sinónimos, excepciones documentales, fuentes similares y tenants distintos, con rúbricas de relevancia y fundamento que no dependen solo de una puntuación de similitud semántica del índice nuevo.
AI-4408. La prueba detecta mejora promedio pero pérdida de recall en cláusulas excepcionales críticas, y el equipo frena promoción aunque consultas triviales respondan más rápido bajo la nueva combinación de embedding y fragmentación del corpus.
AI-4409. El responsable ajusta fragmentación con una hipótesis explícita y repite pruebas afectadas, conservando separación entre resultados anteriores y nueva configuración candidata que cambia unidades de recuperación dentro del índice E2 evaluado para el caso del producto receptor.
AI-4410. La promoción aprobada cambia alias de lectura atómicamente y nuevas solicitudes fijan snapshot E2, mientras las ya admitidas pueden terminar con E1 si permisos vigentes y política de migración lo permiten sin mezclar versiones semánticas de vectores durante la respuesta del caso.
AI-4411. Un rollback posterior restaura E1 solamente después de aplicar revocaciones y cambios del corpus ocurridos durante canary, porque preservar bytes antiguos para recuperación no autoriza devolver documentos que el usuario ya no puede consultar bajo la época actual de autorización del producto receptor.
AI-4412. Contraejemplo: agregar vectores E2 a la tabla E1 porque tienen igual número de columnas produce un ranking que combina espacios diferentes y no tiene la semántica de distancia evaluada por ninguno de los modelos usados para construir el índice del corpus documental protegido del proyecto.
AI-4413. Contraejemplo: rollback mediante cambio de alias reintroduce un documento eliminado y una respuesta cacheada todavía derivada de esa fuente, violando autorización vigente aunque el baseline técnico anterior se encuentre íntegro y haya sido correctamente evaluado antes de la revocación que ocurrió durante la migración del índice semántico del sistema.
AI-4414. La prueba compara consultas fijadas con corpus y metadatos de cada versión y exige que recuperación respete tenant y cambios de permiso incluso bajo nodos que conservan namespace antiguo para rollback técnico autorizado del modelo de embeddings empleado por el producto receptor para sustentar respuestas de sus usuarios autenticados.
AI-4415. La prueba de corte en construcción confirma que índice parcial no queda como activo y que reanudación procesa pendientes sin duplicar cargos de documentos cuyo embedding E2 ya está confirmado para el mismo contenido y revisión bajo los recursos y límites autorizados del caso de mantenimiento documental del sistema receptor.
AI-4416. La prueba de escrituras concurrentes documenta si hay pausa, doble escritura o replay de eventos, y verifica ausencia de pérdida mediante manifiestos y consultas de control que detectan documentos actualizados o revocados entre inicio de migración y cambio de alias de lectura del corpus protegido por autorización vigente del producto receptor del proyecto EOS.
AI-4417. La recuperación conserva causalidad entre ingestas y eventos de corpus, y no describe un índice cargable como cobertura completa cuando faltan documentos cuyo procesamiento falló por límites de formato, permisos o costos que el pipeline debe declarar como pendientes con impacto sobre respuestas futuras de recuperación del caso autorizado por el propietario del sistema receptor.
AI-4418. El producto muestra fecha y cobertura del índice cuando importan para interpretar respuesta, evitando una afirmación de información «en vivo» que solo corresponde a un corpus periódico con ventana de actualización y tareas de reindexación que todavía pueden estar pendientes bajo límites de recursos o presupuesto del entorno donde opera el gateway y su recuperador documental.
AI-4419. La privacidad se evalúa también para vectores, pues publicar un dataset de embeddings del corpus restringido puede permitir inferencias o correlación aunque el archivo no contenga texto legible; la propuesta de benchmark se revisa con finalidad y derechos de uso propios antes de producir un artefacto descargable que amplíe exposición respecto del caso original de consulta del usuario final del sistema receptor.
AI-4420. El responsable conserva fixtures sintéticos con mismas estructuras para pruebas futuras, reduciendo necesidad de copiar documentos privados reales a cada entorno de desarrollo o evaluación de una nueva librería o modelo de embeddings que puede cambiar tokenizer, normalización o tratamiento de entradas sin alterar dimensión ni tipos almacenados por el recuperador del producto receptor donde se ejecuta el pipeline de inferencia autorizado.
AI-4421. La evidencia de comparación incluye casos excluidos y causa, evitando eliminar una consulta difícil porque el candidato falló y luego reportar una mejora de precisión que solo existe tras retirar del denominador las excepciones documentales que representan precisamente el riesgo crítico del dominio que el producto pretende resolver con recuperación semántica y citas comprobadas en el contexto autorizado del actor autenticado del tenant consultante.
AI-4422. La aceptación requiere recall por segmento, aislamiento, vigencia de permisos y reversión de alias con corpus reconciliado, y no utiliza una métrica agregada como certificación universal de que E2 entiende mejor todos los documentos que el propietario puede incorporar en el futuro bajo una clasificación o formato distinto del conjunto autorizado que sirvió de evaluación del nuevo índice construido durante este caso hipotético del sistema receptor de EOS.
AI-4423. Si E2 necesita un tokenizer o runtime nuevo, la unidad de cambio los incluye y evalúa costo de contexto y recursos; una migración semántica puede introducir presión de memoria o tiempos de respuesta que no son visibles al comparar solamente vectores persistidos, y el compilador debe seguir admitiendo la combinación completa de recuperación e inferencia antes de producir resultados del caso bajo presupuesto y deadlines del producto receptor.
AI-4424. El propietario puede elegir conservar E1 mientras investiga la regresión del candidato, porque capacidad más reciente no obliga a reemplazar un baseline que satisface objetivos medidos; el scout registra oportunidad y evidencia pendiente sin activar gasto, descarga o producción por su propia interpretación de que la actualización resulta necesaria para mantener una apariencia de modernidad del gateway que EOS conserva como puerto arquitectónico desacoplado del proveedor utilizado por el sistema receptor.
AI-4425. La promoción futura de E2 vuelve a evaluar consultas y políticas si el corpus cambió materialmente, pues un resultado de benchmark antiguo no asegura que el nuevo conjunto documental mantenga la misma dificultad ni que permisos y destinos aprobados de embedding sigan vigentes para el caso de uso del producto receptor cuya recuperación alimenta respuestas generadas por otro modelo que también puede cambiar bajo un experimento separado de la biblioteca EOS gobernada por el propietario.
AI-4426. El caso demuestra independencia entre dimensión y semántica y entre rollback técnico y autorización; preservar una estructura de tabla o un índice anterior no satisface por sí solo el contrato de recuperación vigente que necesita citas, corpus correcto y restricciones de datos activas para cada actor que accede al producto desde su tenant bajo la política que el puerto determinísticamente aplica antes de transmitir fragmentos o ejecutar inferencia con proveedores aprobados para ese caso concreto del sistema receptor.
AI-4427. La revisión final identifica cuáles controles son medidos y cuáles dependen de servicio de permisos o retención que el ensayo no puede demostrar en todas sus copias externas, evitando convertir la migración sintética exitosa en garantía de borrado o conformidad legal de todos los artefactos derivados que existen fuera de la autoridad técnica del proyecto receptor o que los usuarios ya descargaron antes de revocación conforme a su acceso legítimo previo al corpus consultado del producto.
AI-4428. La documentación conserva un mapa de dependencias entre corpus, embeddings, índice, caché y resultado para planear futuras retiradas sin confundir eliminar pesos con borrar todo dato derivado del modelo antiguo; la operación administrativa específica define qué permanece por auditoría, qué deja de servir y qué puede eliminarse bajo retención y presupuesto de almacenamiento autorizados para el caso concreto de actualización del sistema receptor que usa el gateway como capacidad arquitectónica de IA dentro de un producto EOS.
AI-4429. El cierre comunica índice activo, coverage real, rollback disponible y documentos pendientes, permitiendo a un ingeniero receptor ejecutar un runbook concreto sin depender de las conclusiones del modelo que redactó el resumen del cambio; los valores y decisiones del caso son hipotéticos y no constituyen evidencia de que esta biblioteca haya construido un índice, procesado expedientes o validado compatibilidad de proveedores actuales cuyos APIs o modelos puedan tener propiedades diferentes de las descritas por este ejemplo técnico del manual.
AI-4430. El resultado aceptable es una migración semántica explícita con pruebas pertinentes y autoridad sobre cada efecto, o una decisión fundamentada de conservar baseline, y ambos pueden cumplir el mandato del propietario si el equipo informa límites con claridad en lugar de declarar progreso únicamente por haber descargado un modelo nuevo, incrementado dimensión vectorial o cambiado el nombre de la configuración que anuncia capacidad de recuperación del producto receptor sin demostrar utilidad, aislamiento y control de recursos bajo las condiciones reales del caso autorizado.

## 45. Caso trabajado: canary de runtime y control administrativo atacado

AI-4501. Entrada hipotética: un runtime nuevo mantiene modelo y contrato tipado, pero cambia reintentos internos y tratamiento de cancelación bajo streaming.
AI-4502. El candidato también anuncia contexto mayor; el equipo no adopta ese límite hasta recalibrar memoria, costo y validez de extracción bajo cargas representativas.
AI-4503. El baseline conserva versiones y digests de todas las piezas necesarias para volver a una combinación conocida sin resolver etiquetas mutables durante recuperación del incidente.
AI-4504. La evaluación offline detecta respuestas válidas y una diferencia de consumo tras cancelar que exige actualizar perfil de exposición antes del ensayo operativo con usuarios del producto.
AI-4505. El canary aprobado usa asignación determinística, una población limitada y frenos definidos por calidad, latencia, política y costo pendiente del servicio probabilístico evaluado en el caso.
AI-4506. El shadow bloquea herramientas con efectos; una solicitud de usuario no puede generar dos publicaciones porque ambas versiones del runtime observan el mismo contenido para comparación del experimento autorizado.
AI-4507. Un actor con rol de observación intenta elevar presupuesto mediante llamada directa al control plane y el servidor rechaza antes de modificar límite o liberar holds que ya estaban comprometidos.
AI-4508. Otro intento manipula destino fallback hacia un proveedor no aprobado y la política deniega modificación aunque el panel visual no muestre esa operación al usuario de observación que solo puede consultar métricas del gateway.
AI-4509. El candidato empieza a fallar en un segmento crítico; el freno detiene nuevas asignaciones y mantiene reconciliación de solicitudes vigentes cuyo proveedor sigue reportando uso después de cancelación incierta del servicio bajo evaluación operacional del runtime.
AI-4510. El rollback restaura runtime, tokenizer, adaptador y parámetros efectivos, verificando que modelo residente realmente coincide con baseline y no solamente que archivo de configuración contiene su nombre previo a la actualización del candidato que produjo regresiones de comportamiento durante canary.
AI-4511. Las políticas de privacidad que se endurecieron durante experimento permanecen vigentes, porque reversión técnica no concede nuevamente acceso a destinos o documentos que el propietario retiró de las rutas aprobadas del producto receptor mientras la versión candidata atendía solicitudes de inferencia de sus usuarios autenticados.
AI-4512. Una salida del nuevo esquema ya persistida requiere lector compatible o migración controlada; restaurar pesos sin resolver ese dato no basta para declarar recuperación completa del contrato que consumidores determinísticos del sistema receptor esperan cuando consultan resultados previamente generados por el gateway bajo el caso autorizado del producto.
AI-4513. Contraejemplo: el equipo compara solo calidad textual y no detecta reintentos internos nuevos que duplican costo durante fallas, pues una ejecución positiva con HTTP exitoso no observa comportamiento del SDK ni exposición monetaria de solicitudes canceladas o con respuesta incierta después de un envío aceptado por el proveedor externo del sistema receptor.
AI-4514. Contraejemplo: permitir a un observador editar privacidad porque puede ver panel administrativo mezcla visibilidad y autoridad, y el atacante amplía egress del corpus privado sin aprobación humana aunque no haya generado ningún prompt que ordene transmitir datos mediante el modelo que funciona como componente probabilístico del producto receptor en operación durante canary del runtime nuevo.
AI-4515. La prueba de RBAC llama directamente `Set budget`, `Set privacy`, `Delete` y `Set fallback` con identidades insuficientes, verificando que no hay efectos parciales ni exposición de secretos en errores que el plano de control normaliza para un actor que carece de autoridad sobre esas operaciones administrativas sensibles del gateway desplegado por el proyecto receptor del propietario.
AI-4516. La prueba de kill switch incrementa época durante streaming y confirma bloqueo de nuevos despachos de herramientas, persistencia de costos pendientes y cierre honesto de solicitudes que no pudieron cancelar con certeza debido a capacidades limitadas del proveedor o cambios del runtime candidato que todavía estaba siendo evaluado dentro del canary autorizado del producto receptor de la biblioteca EOS.
AI-4517. La prueba de saneamiento utiliza error sintético con token de acceso y datos privados, y comprueba que métricas, logs y respuestas administrativas conservan solo código, referencia y diagnóstico permitido, evitando convertir el informe de regresión en un medio de replay de credenciales comerciales o una copia innecesaria del contenido del expediente que alimentó el caso de extracción probado bajo la nueva combinación técnica del gateway.
AI-4518. La prueba de saturación confirma que administración puede entrar en `OFF` aunque colas de inferencia alcancen límite, y declara dependencias del host que todavía pueden impedir intervención si ocurre una falla total que el aislamiento lógico de pools no resuelve; la evidencia del caso no promete disponibilidad absoluta del control plane frente a todos los incidentes de infraestructura externa o equipo local del propietario del producto receptor.
AI-4519. La recuperación conserva eventos de decisión y antes y después saneados, permitiendo revisar qué cambio produjo regresión y qué versión realmente sirve al consumidor después del rollback, sin exigir razonamiento interno del modelo ni capturar prompts sensibles completos que no resultan necesarios para comprobar alteración de reintentos o cancelación dentro del SDK actualizado del gateway que fue evaluado por el caso de mantenimiento autorizado del sistema receptor.
AI-4520. El informe separa candidato rechazado, baseline restaurado y pruebas pendientes de lectura de datos nuevos, evitando una conclusión global de «sistema recuperado» cuando todavía existen resultados del esquema candidato que el consumidor anterior no puede interpretar correctamente bajo el contrato de extracción validada del producto y necesitan una migración que puede ser reversible o requerir otra autorización por su impacto concreto sobre entidades de negocio persistidas del tenant.
AI-4521. El propietario puede aprobar continuar operación del baseline dentro de las restricciones nuevas sin financiar otro canary inmediato; el scout conserva candidato y evidencia fallida para una evaluación posterior si aporta una mejora concreta que justifique costo y exposición, pero no reinstala la versión ni modifica límites para forzar un resultado satisfactorio que el equipo no obtuvo bajo la combinación probada y sus condiciones operativas de recursos y presupuesto del caso autorizado.
AI-4522. La retirada del candidato bloquea artefactos y namespaces afectados y preserva metadatos necesarios de trazabilidad, distinguiendo memoria, disco y resultados para no borrar evidencia del incidente junto con pesos de una versión que no debe volver a servir, ni conservar indefinidamente copias privadas de evaluación que la política de retención del producto receptor exige eliminar después de cumplir finalidad del ensayo autorizado por el propietario del gateway y su plano administrativo protegido.
AI-4523. La aceptación final exige rollback demostrado, permisos administrativos efectivos, redacción de secretos y estado financiero conciliado o pendiente explícito, con cada control marcado según evidencia que el proyecto receptor realmente ejecutó; los números y acciones descritos en este caso son hipotéticos y no prueban que esta biblioteca documental tenga un gateway, runtime o ruta de administración funcional disponible para usuarios o modelos actuales del entorno del propietario que lee el manual EOS de esta edición.
AI-4524. El caso muestra por qué la combinación efectiva, y no solo el nombre de un modelo, es unidad de gobierno: runtime, librerías y políticas pueden modificar exposición y efectos sin alterar una respuesta típica del benchmark positivo que el equipo suele usar para validar una actualización, por lo que pruebas de fallas, concurrencia y control administrativo deben acompañar evaluación de calidad semántica del resultado para conservar límites que el propietario espera del puerto de IA del producto receptor.
AI-4525. El runbook de recuperación identifica responsables y comandos propios del proyecto cuando se implemente, sin inventar operaciones ejecutables en esta biblioteca; la ruta conceptual de administración y sus acciones permanecen especificación hasta que existan servidor, autenticación, políticas y pruebas de acceso que demuestren que un actor autorizado puede controlar realmente admisión, descarga, residencia y gasto del gateway bajo estados observados del runtime del sistema receptor donde se integró EOS como arquitectura y gobierno documental del proyecto.
AI-4526. El plano administrativo no recibe instrucciones desde el chat como configuración confiable; un modelo puede preparar una propuesta de cambio con razones y evidencia, pero el ejecutor exige autoridad y precondiciones sobre recursos exactos antes de modificar políticas del producto receptor que gobiernan inferencia y herramientas, evitando que una explicación aparentemente convincente permita al componente probabilístico elevar su propio presupuesto, habilitar destinos nuevos o eliminar controles que lo limitan dentro de la operación autorizada del gateway por el propietario.
AI-4527. La evidencia minimizada utiliza fingerprints protegidos y snapshots de versiones para correlacionar el defecto sin guardar tokens de replay ni duplicar contenido del tenant, y el acceso a esa evidencia se restringe según propósito de soporte, revisión o auditoría interna; demostrar reproducibilidad de una decisión de compilador no significa que todo operador de infraestructura deba poder reconstruir el expediente completo que el usuario procesó para una tarea autorizada con restricciones de datos y permisos dentro del producto receptor del sistema EOS.
AI-4528. La comparación de éxito considera efectos y límites además de respuesta útil, porque un candidato puede aumentar exactitud y aun ser inaceptable por cancelar de manera incierta, filtrar headers en errores o admitir memoria fuera de reserva; las restricciones obligatorias permanecen intersección y el propietario decide sobre alternativas concretas que el equipo preparó y verificó, sin delegar al modelo la posibilidad de compensar una exposición prohibida con un promedio mejor de rendimiento lingüístico del caso evaluado en el sistema receptor.
AI-4529. El cierre registra decisión de no promover, baseline efectivo, riesgos pendientes y siguiente condición de evaluación, evitando lenguaje de éxito total que se base solamente en haber publicado un informe o terminado un benchmark; responsabilidad técnica consiste en conservar estado operable y evidencia suficiente para que otro ingeniero pueda retomar el caso sin reconstruir permisos, digests y presupuestos desde memoria informal ni asumir que la versión candidata llegó a producción cuando su canary fue detenido por una regresión comprobada del producto receptor.
AI-4530. La dirección del propietario queda preservada mediante contratos y evidencia: IA preparada desde arquitectura, activada por utilidad, admitida dentro de restricciones, cancelable con límites honestos y retirables sus componentes; esa combinación convierte la integración en capacidad gobernada del producto sin atribuir al repositorio servicios que no implementa ni prometer garantías universales de seguridad, calidad, costo o recuperación más amplias que las pruebas reales que cada sistema receptor debe ejecutar para adoptar este manual de AI Integration Port y AI Gateway bajo EOS.

## 36. Herramientas, MCP y contratos de invocación para agentes

AI-3601. Toda herramienta expuesta a un modelo se registra con nombre estable, descripción operativa, esquema de entrada, esquema de salida, efectos posibles y nivel de autonomía requerido.
AI-3602. La descripción de la herramienta explica cuándo usarla y cuándo no, porque el modelo selecciona herramientas a partir de ese texto y no de la implementación.
AI-3603. El esquema de entrada valida tipos, rangos y formatos en el servidor; la validación del modelo o del cliente nunca sustituye la comprobación del gateway.
AI-3604. Las herramientas se clasifican como lectura, escritura reversible, escritura irreversible o efecto externo, y cada clase define aprobación y registro distintos.
AI-3605. Un servidor MCP se trata como dependencia con proveedor, versión, permisos, destinos de red y datos expuestos, revisados antes de conectarlo a un agente productivo.
AI-3606. Las descripciones y resultados de un servidor MCP de terceros son datos no confiables; pueden contener instrucciones adversariales dirigidas al modelo.
AI-3607. El gateway limita qué herramientas ve cada caso de uso; exponer el catálogo completo a todos los agentes amplía la superficie de ataque sin beneficio.
AI-3608. Las credenciales de herramientas se inyectan en el ejecutor del servidor y nunca aparecen en el prompt, en el resultado devuelto ni en la traza visible.
AI-3609. Cada invocación conserva identificador de llamada, caso de uso, actor, versión de herramienta, entrada saneada, resultado, duración y decisión de aprobación.
AI-3610. Una herramienta con efecto externo admite clave de idempotencia para que un reintento del agente no duplique correos, cargos, tickets ni publicaciones.
AI-3611. El resultado de herramienta se trunca o resume con límites explícitos para impedir que una respuesta enorme desplace instrucciones críticas del contexto.
AI-3612. Los errores de herramienta se devuelven estructurados con causa clasificada y acción sugerida, sin trazas internas que revelen rutas, secretos o datos ajenos.
AI-3613. Un agente no puede registrar herramientas nuevas en tiempo de ejecución; la ampliación del catálogo es una operación administrativa versionada y revisada.
AI-3614. Las herramientas que leen archivos o URLs aplican listas de rutas y destinos permitidos para evitar exfiltración y SSRF iniciados por contenido inyectado.
AI-3615. Una herramienta de ejecución de código corre en sandbox con límites de CPU, memoria, tiempo, red y sistema de archivos definidos por el caso de uso.
AI-3616. La aprobación humana de una herramienta muestra la acción concreta, sus argumentos y su efecto esperado, no una descripción genérica que oculte el destino.
AI-3617. Una aprobación cubre una invocación o un alcance acotado explícito; no se transforma en permiso permanente para la misma herramienta en contextos distintos.
AI-3618. Las pruebas de contrato verifican que cada herramienta rechace entradas fuera de esquema, destinos prohibidos y actores sin permiso con errores esperados.
AI-3619. Las pruebas adversariales colocan instrucciones de exfiltración en resultados de herramientas y verifican que el agente no invoque herramientas de salida en respuesta.
AI-3620. La retirada de una herramienta conserva su registro histórico y redirige casos de uso a la sustituta con período de coexistencia documentado.
AI-3621. Un agente que propone usar una herramienta inexistente recibe error claro y el evento se registra para revisar descripciones confusas del catálogo.
AI-3622. El costo por invocación de herramienta se mide junto al costo del modelo, porque herramientas pagadas pueden dominar el presupuesto del caso de uso.
AI-3623. La matriz de herramientas por agente se publica en la documentación del producto con estado real y no con capacidades planificadas presentadas como activas.
AI-3624. Quiero herramientas que amplíen lo que un agente puede hacer sin ampliar lo que un atacante puede hacer a través de él.

## 37. Salidas estructuradas, guardrails y validación de resultados

AI-3701. Cuando el resultado alimenta código, el caso de uso exige salida estructurada con esquema versionado validado por el gateway antes de entregarla al consumidor.
AI-3702. Una salida que no cumple el esquema se trata como fallo clasificable, con reintento acotado o degradación declarada, nunca como dato parcialmente aceptado.
AI-3703. Los guardrails de entrada evalúan datos sensibles, alcance del caso de uso e intentos de inyección antes de consumir presupuesto en el modelo principal.
AI-3704. Los guardrails de salida verifican formato, datos prohibidos, afirmaciones no permitidas y coherencia con la política del caso de uso antes de mostrar la respuesta.
AI-3705. Un guardrail basado en modelo tiene su propia evaluación de precisión y falsos positivos; no se asume infalible por estar etiquetado como control de seguridad.
AI-3706. Los guardrails deterministas, como expresiones regulares para secretos o validación de identificadores, se prefieren cuando la regla es mecánica y verificable.
AI-3707. Un guardrail que bloquea una respuesta informa al usuario una razón comprensible sin revelar la regla exacta que podría usarse para evadirla.
AI-3708. Los bloqueos de guardrail se registran con categoría, versión de regla y caso de uso para medir falsos positivos que perjudiquen a usuarios legítimos.
AI-3709. Las citas a fuentes en respuestas de retrieval se verifican contra los documentos recuperados; una cita inexistente invalida la respuesta para casos críticos.
AI-3710. Los valores numéricos, fechas y montos producidos por un modelo se recalculan o validan con código determinista antes de usarse en decisiones.
AI-3711. El modelo no decide permisos; una salida que afirma que el usuario está autorizado se ignora como dato y el servidor consulta su política real.
AI-3712. Las salidas destinadas a HTML, SQL, shell o rutas se escapan o parametrizan por el consumidor, tratándolas como entrada no confiable.
AI-3713. Los guardrails se versionan junto al prompt y al modelo, porque un cambio en cualquiera puede alterar la tasa de bloqueos o fugas.
AI-3714. Las pruebas de guardrail incluyen casos benignos parecidos a ataques para medir rechazos injustificados de usuarios legítimos.
AI-3715. Un guardrail desactivado temporalmente por incidente requiere excepción registrada con vencimiento, compensación y responsable de reactivación.
AI-3716. La validación de resultados se ejecuta también en modo sombra antes de habilitarla como bloqueo, para conocer su impacto real sobre tráfico representativo.
AI-3717. Caso hipotético: un asistente de soporte devuelve un JSON con un campo de reembolso aprobado que el esquema no contempla.
AI-3718. El gateway rechaza la salida por campo no permitido, registra el evento y entrega una respuesta degradada que deriva a revisión humana.
AI-3719. La revisión descubre que el prompt mencionaba reembolsos como ejemplo y la corrección elimina esa sugerencia del contexto del modelo.
AI-3720. La aceptación repite el caso con el prompt corregido y confirma salida válida sin campos de decisión financiera generados por el modelo.
AI-3721. Los esquemas de salida evitan campos libres extensos cuando un enumerado cubre las decisiones posibles del caso de uso.
AI-3722. La documentación del caso de uso enumera guardrails activos, su modo y sus métricas recientes con fecha de medición.
AI-3723. Un consumidor nuevo de una salida estructurada se registra para evaluar el impacto de cambios de esquema antes de publicarlos.
AI-3724. Quiero salidas que el sistema pueda verificar, no respuestas persuasivas que el sistema deba creer.

## 38. Handoffs entre agentes, sesiones y estado conversacional

AI-3801. Un handoff entre agentes transfiere objetivo, contexto mínimo, restricciones vigentes y autorizaciones aplicables, con registro de origen y destino.
AI-3802. El agente receptor no hereda herramientas del emisor; recibe las definidas para su propio rol en la configuración aprobada.
AI-3803. Las restricciones de privacidad y presupuesto viajan con el handoff y no pueden relajarse por el agente receptor.
AI-3804. Un handoff que excede la profundidad máxima configurada se rechaza para evitar cadenas recursivas de delegación sin control de costo.
AI-3805. Las sesiones conversacionales tienen identificador, propietario, retención, límite de tamaño y política de compactación definidos por caso de uso.
AI-3806. El historial de sesión pertenece al usuario o tenant correspondiente; un agente no accede a sesiones ajenas aunque compartan infraestructura.
AI-3807. La compactación de sesión conserva instrucciones del sistema, restricciones, decisiones y pendientes; el resumen se valida en pruebas con restricciones tempranas.
AI-3808. La memoria persistente de agente requiere consentimiento o base aplicable, propósito declarado, visibilidad para el usuario y mecanismo de borrado.
AI-3809. Un dato aprendido durante una sesión no se convierte en instrucción permanente sin revisión, porque podría provenir de contenido adversarial.
AI-3810. El estado de un flujo multiagente largo se persiste en checkpoints que permiten reanudar sin repetir efectos externos ya confirmados.
AI-3811. Cada checkpoint registra paso, entradas, salidas, efectos confirmados, efectos inciertos y versión de configuración del flujo.
AI-3812. Un flujo reanudado desde checkpoint consulta efectos inciertos antes de reintentar, igual que una operación de pago con resultado desconocido.
AI-3813. La intervención humana en un flujo se modela como estado explícito de espera con plazo, responsable y acción por vencimiento.
AI-3814. Un flujo esperando aprobación no consume presupuesto de modelo en sondeos repetidos; se reactiva por evento o por consulta programada acotada.
AI-3815. Los grafos de flujo declaran nodos, transiciones, condiciones de salida y límites de iteración para impedir ciclos indefinidos.
AI-3816. Una transición condicional decidida por modelo tiene ruta por defecto segura cuando la salida no es válida o no es concluyente.
AI-3817. Caso hipotético: un agente de triage transfiere un ticket al agente de facturación con datos de tarjeta pegados por el cliente.
AI-3818. El guardrail de handoff detecta el dato sensible, lo redacta antes de transferir y registra la redacción sin conservar el valor original.
AI-3819. El agente de facturación recibe la referencia opaca del cliente y consulta datos permitidos mediante su herramienta autorizada.
AI-3820. La aceptación verifica que ningún log, checkpoint ni contexto del receptor contenga el número de tarjeta original.
AI-3821. Las trazas de handoff permiten reconstruir quién decidió cada transferencia y con qué información, para auditoría y postmortem.
AI-3822. Un handoff a humano conserva el contexto suficiente para que la persona no tenga que pedir al usuario repetir toda la información.
AI-3823. La documentación del flujo muestra el grafo vigente, sus agentes, herramientas por nodo y puntos de aprobación humana.
AI-3824. Quiero flujos de agentes que puedan interrumpirse, inspeccionarse y reanudarse sin perder control ni duplicar efectos.

## 39. Evaluación de modelos y agentes antes y después de activar

AI-3901. Ningún caso de uso pasa de PLANNED a OPERATING sin evaluación sobre conjunto representativo, criterio de aceptación y resultado registrado.
AI-3902. El conjunto de evaluación incluye casos frecuentes, casos límite, casos adversariales y casos donde la respuesta correcta es negarse o derivar.
AI-3903. Las métricas se eligen por consecuencia: exactitud de extracción, tasa de derivación correcta, fugas de datos, costo y latencia por solicitud.
AI-3904. Un evaluador automático basado en modelo se calibra con revisión humana en una muestra y su acuerdo medido se publica con la evaluación.
AI-3905. La evaluación se repite al cambiar modelo, prompt, herramientas, guardrails, parámetros de muestreo o fuente de retrieval.
AI-3906. Los resultados se comparan contra la línea base con varias ejecuciones cuando el modelo es no determinista, reportando variación observada.
AI-3907. Una mejora global con regresión en casos críticos se bloquea hasta decisión explícita del responsable con riesgo documentado.
AI-3908. Los datos de evaluación se protegen como datos del producto y no se envían a proveedores externos sin autorización y minimización.
AI-3909. La evaluación en producción usa muestreo con consentimiento o base aplicable y revisión de privacidad antes de inspeccionar contenido real.
AI-3910. Las fallas reportadas por usuarios se incorporan al conjunto tras anonimización, cerrando el ciclo entre operación y evaluación.
AI-3911. El informe de evaluación declara qué no mide, como robustez ante idiomas no incluidos o dominios ausentes del conjunto.
AI-3912. El modelo evaluado se identifica con versión exacta del proveedor o hash del artefacto local, no con un alias que pueda cambiar.
AI-3913. La ficha [MODEL-CARD](../../templates/MODEL-CARD.md) registra evaluación, límites, licencia y uso permitido del modelo en el producto.
AI-3914. Caso hipotético: un modelo local cuantizado reduce memoria a la mitad pero falla extracción de montos con separadores peruanos.
AI-3915. La evaluación con casos de formato local detecta la regresión y el responsable decide mantener el modelo anterior para ese caso.
AI-3916. El modelo cuantizado se habilita solo para clasificación, donde la evaluación demostró desempeño equivalente dentro del margen acordado.
AI-3917. La aceptación registra ambos resultados y la decisión por caso de uso, sin generalizar la conclusión a todos los usos del modelo.
AI-3918. La evaluación de agentes mide además cumplimiento de límites: herramientas no autorizadas, pasos excedidos y presupuesto consumido.
AI-3919. Un agente que completa la tarea violando un límite se considera fallido aunque el resultado final sea correcto.
AI-3920. Los umbrales de promoción se fijan antes de ver resultados para evitar ajustar el criterio a la conveniencia del candidato.
AI-3921. Las evaluaciones costosas se programan con presupuesto reservado y no se ejecutan automáticamente en cada commit sin autorización.
AI-3922. Quiero activar IA cuando la evidencia demuestre que mejora el producto, no cuando la demostración parezca convincente.

## 40. Defensa ante inyección de instrucciones en sistemas de agentes

AI-4001. Todo contenido que no proviene del responsable autorizado es dato: páginas web, documentos, correos, tickets, resultados de herramientas y mensajes de otros agentes.
AI-4002. El gateway etiqueta el origen de cada fragmento de contexto para que políticas y revisores distingan instrucciones de datos.
AI-4003. Un agente que procesa contenido no confiable opera con el conjunto mínimo de herramientas; leer correos no requiere capacidad de enviarlos.
AI-4004. Las herramientas de salida, como envío, publicación o solicitudes HTTP arbitrarias, requieren aprobación cuando el contexto contiene datos no confiables.
AI-4005. El patrón de doble agente separa un agente con herramientas privilegiadas de otro que lee contenido no confiable y solo devuelve datos estructurados.
AI-4006. Los datos estructurados devueltos por el agente de lectura se validan por esquema y no pueden contener instrucciones interpretables por el agente privilegiado.
AI-4007. Las URLs generadas por el modelo se validan contra destinos permitidos antes de solicitarse, para impedir exfiltración mediante parámetros.
AI-4008. Las imágenes o enlaces en respuestas renderizadas se controlan para que no filtren datos mediante solicitudes automáticas del navegador del usuario.
AI-4009. Un intento de inyección detectado se registra con origen, fragmento saneado y acción tomada, sin ejecutar la instrucción contenida.
AI-4010. La detección de inyección por modelo se complementa con limitación de capacidades, porque ningún detector es completo.
AI-4011. Las pruebas adversariales incluyen instrucciones en comentarios HTML, texto oculto, metadatos de archivos, nombres de archivo y resultados de herramientas.
AI-4012. Las pruebas incluyen afirmaciones falsas de autoridad, como mensajes que dicen provenir del administrador o de Anthropic, y verifican que no cambian permisos.
AI-4013. Un agente que encuentra instrucciones dirigidas a él en datos las reporta al responsable humano y continúa la tarea original sin obedecerlas.
AI-4014. La memoria persistente no almacena instrucciones provenientes de datos, porque una inyección persistida afectaría sesiones futuras.
AI-4015. Caso hipotético: un documento PDF contiene texto blanco que ordena enviar el contenido de la carpeta de configuración a una dirección externa.
AI-4016. El agente lector extrae datos del documento, no tiene herramienta de envío y su salida estructurada no contempla destinos externos.
AI-4017. El guardrail registra la instrucción detectada y el operador recibe aviso del documento sospechoso para revisión manual.
AI-4018. La aceptación verifica que ninguna solicitud de red saliente ocurrió durante el procesamiento del documento adversarial.
AI-4019. Las defensas se revisan cuando se agregan herramientas nuevas, porque cada herramienta de salida crea un canal potencial de exfiltración.
AI-4020. La documentación de seguridad del producto explica a usuarios qué tipos de contenido procesa la IA y qué protecciones existen sin prometer inmunidad.
AI-4021. Quiero agentes útiles con contenido externo que nunca permitan a ese contenido tomar el control de sus herramientas.

## 41. Gobierno de costos y presupuestos de IA

AI-4101. Cada caso de uso declara presupuesto por solicitud, por usuario, por tenant y por período, con unidad monetaria y fuente de tarifas.
AI-4102. El gateway reserva presupuesto antes de invocar y liquida con uso real después, registrando diferencias entre estimación y consumo.
AI-4103. Una solicitud que excede su reserva se corta de forma controlada con resultado parcial declarado o degradación, no con gasto sin límite.
AI-4104. Los agentes con bucles de herramientas tienen límite de pasos, tokens y costo total por tarea, independiente del límite por llamada.
AI-4105. La subdelegación consume el presupuesto del padre; un agente no obtiene más presupuesto creando subagentes.
AI-4106. Las tarifas del proveedor se verifican en fuente primaria con fecha antes de usarlas en presupuestos y se revisan periódicamente.
AI-4107. Los costos reportados distinguen estimación del gateway y facturación real del proveedor, reconciliadas por período.
AI-4108. Una alerta de costo tiene receptor, umbral, acción esperada y condición de recuperación; un correo ignorado no es control.
AI-4109. El caché de respuestas o de prompts se evalúa por ahorro medido y por riesgo de servir contenido de otro usuario o versión obsoleta.
AI-4110. La selección de modelo por costo se basa en evaluación del caso de uso, no en suponer que el modelo más barato es suficiente.
AI-4111. Caso hipotético: un agente de investigación entra en bucle llamando a búsqueda web y consume el presupuesto diario en una hora.
AI-4112. El límite por tarea corta el bucle al alcanzar el máximo de pasos, conserva resultados parciales y notifica al responsable.
AI-4113. El postmortem identifica una condición de salida ambigua en el prompt y la corrección añade criterio de suficiencia verificable.
AI-4114. La aceptación reproduce el escenario y confirma que el agente termina con el criterio nuevo dentro del presupuesto previsto.
AI-4115. Los presupuestos de evaluación, desarrollo y producción se separan para que pruebas extensas no agoten el gasto operativo.
AI-4116. El panel de costos muestra consumo por caso de uso, modelo y tenant con fecha de actualización y sin cifras inventadas.
AI-4117. Un aumento de presupuesto es una acción administrativa registrada con actor, motivo, vigencia y aprobación del responsable financiero.
AI-4118. El modo OFF garantiza gasto cero del gateway; cualquier costo observado en OFF se trata como incidente de configuración.
AI-4119. Quiero IA con costo predecible y explicable, donde cada sol gastado tenga un caso de uso y un responsable.

## 42. Integración con hosts de agentes de código

AI-4201. Cuando un proyecto se desarrolla con Claude Code, Codex u otro host de agentes, el host es parte del entorno y sus políticas prevalecen sobre este manual.
AI-4202. Las instrucciones de repositorio para hosts de agentes se mantienen en AGENTS.md y CLAUDE.md enlazados, evitando versiones divergentes de las mismas reglas.
AI-4203. Las definiciones de subagentes del repositorio declaran herramientas mínimas; un revisor no recibe permisos de escritura ni de red innecesarios.
AI-4204. Las skills del repositorio son procedimientos documentales; instalarlas en un host no concede permisos ni activa automatizaciones por sí mismo.
AI-4205. Los hooks del host que ejecutan comandos se revisan como código, con efecto, permisos y comportamiento ante fallo documentados.
AI-4206. Un servidor MCP configurado en el repositorio se declara en la matriz de capacidades con datos expuestos y responsable de su revisión.
AI-4207. El host de agentes no recibe secretos productivos en variables de entorno de desarrollo sin necesidad documentada y rotación prevista.
AI-4208. Las acciones del host sobre remotos, como push o creación de pull requests, se realizan dentro de la autorización explícita del responsable.
AI-4209. Los registros del host útiles para auditoría se conservan según la política del proyecto, sin almacenar contenido sensible innecesario.
AI-4210. El sistema de agentes de este repositorio puede instalarse en otro proyecto mediante su instalador, que copia definiciones sin sobrescribir archivos existentes.
AI-4211. Un proyecto receptor revisa las definiciones instaladas y las adapta a su perfil antes de usarlas en trabajo productivo.
AI-4212. La compatibilidad con cada host se declara por versión probada; una función nueva del host no se asume disponible en versiones anteriores.
AI-4213. Caso hipotético: un subagente revisor instalado desde este repositorio intenta usar una herramienta de escritura que el host concede por defecto.
AI-4214. La definición del agente limita herramientas a lectura y búsqueda, y el host rechaza la escritura según esa configuración.
AI-4215. La aceptación ejecuta una revisión de prueba y confirma que el árbol de trabajo no cambió tras la ejecución del revisor.
AI-4216. Quiero que el sistema de agentes funcione igual de controlado en cualquier host compatible, sin depender de configuración implícita.

## 43. Puerta de cierre del AI Gateway

AI-4301. Cierra la entrega de IA con matriz por caso de uso: modo, modelo, herramientas, guardrails, evaluación, presupuesto, estado y responsable.
AI-4302. Adjunta evaluación vigente con versión de modelo y prompt, resultados frente a la línea base y límites declarados.
AI-4303. Documenta kill switch, procedimiento de degradación, retorno a OFF y prueba reciente de cada mecanismo.
AI-4304. Declara proveedores, regiones, retención y datos enviados por caso de uso, con autorización de privacidad aplicable.
AI-4305. Lista herramientas por agente con clase de efecto y aprobación requerida, verificada contra la configuración desplegada.
AI-4306. Incluye pruebas adversariales de inyección y sus resultados sobre la versión exacta entregada.
AI-4307. Registra excepciones vigentes con vencimiento y compensación, especialmente guardrails desactivados o límites elevados.
AI-4308. El receptor ejecuta un caso de uso de prueba y el retorno a OFF siguiendo solo la documentación entregada.
AI-4309. Las dudas del receptor que bloqueen operación se corrigen en la documentación antes de aceptar la transferencia.
AI-4310. Una entrega sin IA activa lo declara expresamente: puerto presente, modo OFF, sin proveedores ni gasto.
AI-4311. La firma de cierre identifica a Pierre R. Boss (oprbguitar) como responsable de dirección y al operador que acepta el estado entregado.
AI-4312. Mi criterio final exige IA conectable, apagable, medible y reemplazable, con evidencia de cada afirmación sobre su comportamiento.

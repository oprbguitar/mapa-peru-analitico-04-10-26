# Biblioteca de peticiones por especialidad

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Completa `<variables>` y combina el prompt con [BOOTSTRAP](BOOTSTRAP.md). Son contratos de tarea para roles reales o revisiones por rol; no órdenes para crear usuarios, servicios o permisos inexistentes.

## 1. Planner y arquitecto

```text
Analiza <objetivo> en <repositorio>. Lee la implementación y sus restricciones.
Produce perfil, dependencias, riesgos y tres alternativas cuando la decisión
comprometa arquitectura. Compara con evidencia, incluyendo la opción simple.
Selecciona la menor intervención que cumpla requisitos.
Divide fases por entregable verificable y asigna ownership.
Define tests, compatibilidad, operación y rollback antes del cambio.
No implementes si el encargo está limitado a planificación.
Entrega ADR proporcional y condiciones para reconsiderar la decisión.
```

## 2. Developer y TDD Guide

```text
Corrige <defecto concreto> en <archivos propios>.
Primero reproduce entrada, entorno y resultado actual.
Escribe una prueba de la conducta esperada que falle por el defecto.
Implementa mínimo cambio; conserva <contratos y flujos relacionados>.
Comprueba validación, errores, autorización y concurrencia si aplican.
Ejecuta pruebas y cobertura del código cambiado; reporta su alcance.
No añadas dependencias ni refactors ajenos sin necesidad demostrada.
Entrega diff, RED/GREEN, resultados y limitaciones reales.
```

## 3. Code Reviewer

```text
Revisa <diff/commit> con <objetivo y criterios de aceptación>.
Busca regresiones, errores de contrato, manejo de fallo, permisos y tests.
Cada hallazgo tiene ubicación, escenario disparador, consecuencia y evidencia.
Prioriza errores reales sobre preferencias estilísticas.
Contrasta afirmaciones de tests con los resultados y scope recibidos.
No modifiques archivos si se pidió solo revisión.
Devuelve findings o indica que no hallaste fallos accionables en el alcance,
incluyendo riesgos y partes que no pudiste verificar.
```

## 4. Security Reviewer

```text
Evalúa <activos y cambio> usando SECURITY-FABRIC.
Mapea trust boundaries, exposición, actores y datos minimizados.
Comprueba autenticación, autorización por recurso/tenant, inputs, secretos,
proxy trust, sesiones, abuso, egress y supply chain según aplicabilidad.
No ejecutes ataques a terceros ni cambies WAF/credenciales por este prompt.
Usa entornos controlados y alcance expresamente autorizado.
Entrega riesgos reproducibles, controles, falsos positivos y gate de release.
No atribuyas seguridad total a un scanner sin hallazgos.
```

## 5. AI Architect y Resource Evaluator

```text
Evalúa <caso de IA> con AI-GATEWAY, manteniendo OFF al inicio.
Determina si código determinista u OCR especializado resuelve la tarea.
Clasifica datos, capacidades, calidad, destinos autorizados y presupuesto.
Mide recursos disponibles y headroom con carga/contexto/concurrencia reales.
Compara modelos/providers elegibles, registra fuente/licencia/versión.
Define fallback que respete las mismas restricciones, o fallo seguro.
No descargues, cargues ni envíes datos hasta tener alcance autorizado.
Entrega model card, evaluación, contrato y pruebas de aceptación.
```

## 6. Payments y Reconciliation

```text
Diseña o revisa <flujo de pagos> en <entorno autorizado> usando PAYMENTS.
Documenta estados, importes/unidades/moneda, idempotencia persistente,
webhook verificado, replay/duplicados/out-of-order y ledger append-only.
Reconcilia resultados inciertos antes de otro intento de cobro.
Separa sandbox, simulación y evidencia del proveedor real.
No cobres, devuelvas ni alteres contabilidad sin autorización concreta.
Entrega contratos, pruebas negativas y discrepancias con dueño.
```

## 7. Data y Storage Architect

```text
Inventaría <datos y almacenamiento> sin exportar información privada.
Mide capacidad útil, cuotas, reservas, crecimiento y tasa de cambio.
Define retención, legal holds, cifrado, permisos y eliminación propagada.
Evalúa backup, restore, RPO/RTO y sync/conflictos según producto.
No declares espacio ilimitado ni consideres una réplica backup suficiente.
Ensaya recuperación aislada solo en el alcance autorizado.
Entrega supuestos, forecast con incertidumbre y evidencia de integridad.
```

## 8. UX y Product Experience

```text
Mejora <flujo> para <usuarios> conservando identidad y contenido verificado.
Inspecciona la UI y aplica la skill/harness de diseño configurado en el host.
Considera tres direcciones y registra tokens antes de composición.
Comprueba 360/768/1280/1600, teclado, foco, touch, loading, error y vacío.
Respeta reduced motion, español de Perú y densidad útil del dominio.
No inventes métricas, testimonios ni capacidades backend.
Entrega cambios, pruebas reales del flujo y limitaciones del entorno.
```

## 9. SRE y Release

```text
Prepara <release exacta> usando UPDATES-RELIABILITY y eos-release.
Registra artifact/commit, pruebas, dependencias y configuración relevante.
Verifica backup y compatibilidad cuando el riesgo de datos lo exija.
Define promoción, health, rollback y responsables por entorno.
La autorización externa existente es <acción/destino/alcance o ninguna>.
Si existe, ejecuta dentro de ella y verifica el resultado real.
Si falta, termina la preparación revisable y pide aprobación para esa acción.
No confundas push, build, despliegue y disponibilidad pública.
```

## 10. Regulatory Scout y Product Legal

```text
Investiga <función/producto> para <entidad, sector y jurisdicciones>.
Usa COMPLIANCE-IP-PRODUCT y fuentes primarias con consulta fechada.
Separa publicación, vigencia, transición y aplicabilidad.
Clasifica requisito legal, contractual, voluntario o interno.
Relaciona control, evidencia, dueño y revisión competente pendiente.
Compara promesas web/términos/privacidad/checkout/comportamiento real.
No emitas certificación, plazo o compromiso externo no verificado.
Entrega matriz, RDR y vacíos concretos.
```

## 11. Handoff Auditor

```text
Evalúa si <receptor y habilidades> puede operar <versión del producto>.
Usa MIGRATION-HANDOFF y HANDOFF-CHECKLIST.
Reproduce instalación/arranque, flujo permitido y denegado, shutdown,
diagnóstico y restore aislado con configuración sin secretos.
Comprueba paths/datos privados, dependencias de cuentas y licencias.
No transfieras cuentas ni credenciales por canales no autorizados.
Entrega pasos reproducidos, dependencias del autor y pendientes de aceptación.
```

## 12. Technology, Regulatory y Model Scouts

```text
Revisa <componentes/fuentes/versiones> con ventana <fecha/periodo>.
Consulta fuentes oficiales; registra cambios, deprecación, EOL, licencia,
riesgo, fecha de efecto y consumidores afectados cuando corresponda.
Clasifica radar ADOPT/TRIAL/ASSESS/HOLD con motivo y evidencia.
Propón evaluación o migración; no actualices ni cambies políticas por observar.
No declares un monitor activo si solo hiciste una revisión puntual.
Notifica/publica a terceros únicamente dentro de autorización explícita.
Entrega cambios relevantes, última/próxima revisión y plan de impacto.
```

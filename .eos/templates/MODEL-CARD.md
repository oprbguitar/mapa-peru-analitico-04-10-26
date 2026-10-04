# Ficha de modelo — evaluación y gobierno EOS

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Completar antes de aprobar uso. Una ficha pendiente no habilita descarga o ejecución.
Leer [AI Gateway](../docs/manuals/AI-GATEWAY.md). `null` significa desconocido;
ningún tamaño del archivo ni memoria nominal garantiza viabilidad.

## Identidad y procedencia

```yaml
model_id: PENDIENTE
status: QUARANTINED # DISCOVERED | QUARANTINED | EVALUATING | APPROVED | DEPRECATED | REMOVED
owner: PENDIENTE
prepared_by: PENDIENTE
verified_at: PENDIENTE
model_revision: PENDIENTE
publisher: PENDIENTE
source_ref: PENDIENTE
hash: PENDIENTE
signature_verification: PENDIENTE
weights_license: PENDIENTE
runtime_license: PENDIENTE
license_review_ref: PENDIENTE
runtime_version: PENDIENTE
adapter_version: PENDIENTE
execution_mode: OFF
allowed_modes: []
allowed_data_classes: []
approved_destinations: []
```

## Capacidades y límites

Capacidades evaluadas y contratos: PENDIENTE.
Casos permitidos, usos prohibidos y limitaciones: PENDIENTE.
Contexto máximo, cuantización, formatos y herramientas: PENDIENTE.
Embeddings: dimensión, normalización, espacio/versionado e índice: PENDIENTE.
Privacidad: región, retención, acceso y tratamiento realmente evaluados: PENDIENTE.

## Recursos y benchmark

| Campo | Valor | Método, entorno y evidencia |
|---|---|---|
| Tamaño en disco y espacio temporal | null | PENDIENTE |
| RAM / VRAM pico | null / null | PENDIENTE |
| Contexto/KV cache, lote y concurrencia | PENDIENTE | PENDIENTE |
| Reserva del producto y del sistema | PENDIENTE | PENDIENTE |
| Carga, latencia y calidad por caso | PENDIENTE | PENDIENTE |
| Consumo/costo confirmado y estimado | PENDIENTE | PENDIENTE |

Registrar muestra, fecha, dataset autorizado y revisión. Incluir errores y abstención.
Definir presupuesto, moneda, periodo, reservas, reintentos y cuotas: PENDIENTE.
Estado de salud, breaker, cancelación y auto-unload comprobados: PENDIENTE.

## Promoción, rollback y retirada

- Criterios de calidad, privacidad, recurso, licencia y costo: PENDIENTE.
- Evaluación de compatibilidad y regresión: PENDIENTE.
- Canary, responsable, exposición máxima y frenos: PENDIENTE.
- Modelo previo e índices/cachés recuperables: PENDIENTE.
- Autorización vigente de activación y límite: PENDIENTE.
- Decisión real de aprobación, evidencia y fecha: PENDIENTE.
- Retiro: referencias, drenaje, invalidación y retención de auditoría: PENDIENTE.

**Ejemplo hipotético:** dos modelos comparten dimensión de embeddings, pero tienen
espacios incompatibles. Crear índice versionado; no mezclar vectores por igualdad de tamaño.

Mientras falte evidencia crítica, conservar OFF y estado no aprobado.
Aplicar [convenciones](README.md) y guardar únicamente referencias minimizadas.

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

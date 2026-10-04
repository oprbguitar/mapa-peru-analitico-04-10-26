# ADR-0004 — Índice compuesto determinista; IA solo para explicar, con verificación

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

```yaml
adr_id: ADR-0004
title: Índice Situacional Perú v1 y límites de la IA
status: PROPOSED
owner: Pierre R. Boss (oprbguitar)
prepared_by: Claude Code (eos-architect + eos-compliance-analyst)
affected_components: [config/crime_index_v1.yaml, peru_intel.analytics, peru_intel.ai]
```

## Decisión propuesta

- El índice se calcula con SQL y aritmética desde `config/crime_index_v1.yaml` (versión, variables, pesos,
  normalización, período, política de faltantes). Cada respuesta incluye el SHA-256 de la especificación.
  Se rotula siempre «no oficial».
- La IA (DataAgent → GeoAnalyst → Verifier) explica, compara y resume; **no** produce cifras. El Verifier
  comprueba cada número y cita contra los hechos y marca «NO VERIFICADO» lo que no tiene soporte, además
  del lenguaje causal.
- Proyecciones con StatsForecast (AutoETS) o, si no está instalado, naive estacional declarado.
- Prohibido: predicción o ranking de personas. Solo territorios y series agregadas (el agente rechaza
  preguntas sobre personas).
- Ruteo: Ollama local por defecto; API externa solo si el usuario la autoriza y el paquete es agregado.

## Limitación conocida

El Verifier comprueba números y citas, no la semántica del período (p. ej. llamar «semestre» a enero–julio).
Mitigación: los hechos llevan el período explícito y la ficha muestra la lista de hechos usados.

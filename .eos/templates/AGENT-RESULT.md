# AGENT-RESULT — bloque de cierre para integración

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Todo agente EOS termina su respuesta con un único bloque `eos-result`. El orquestador integra, decide y reporta leyendo solo este bloque; la prosa previa queda para el humano y solo se consulta si el bloque indica `PARTIAL`, `BLOCKED`, `FAILED` o un hallazgo `CRITICAL`/`HIGH`. Así la integración de varios agentes no repite contexto.

## Formato

````text
```eos-result
{
  "agent": "eos-code-reviewer",
  "status": "COMPLETED",
  "summary": "Una línea con el resultado",
  "files": ["scripts/x.mjs"],
  "checks": [{"cmd": "node --test tests/x.test.mjs", "result": "PASS", "note": "12/12"}],
  "findings": [{"id": "F-1", "severity": "HIGH", "where": "scripts/x.mjs:42", "what": "Ruta sin validar", "fix": "Usar inside()"}],
  "next": [{"item": "Revisar seguridad del parser", "owner": "eos-security-reviewer"}],
  "approval_needed": []
}
```
````

## Reglas

- `status`: `COMPLETED | PARTIAL | BLOCKED | FAILED`.
- `checks[].result`: `PASS | FAIL | NOT_RUN | NOT_APPLICABLE`; `note` es un extracto de 80 caracteres como máximo, nunca el log completo.
- `findings[].severity`: `CRITICAL | HIGH | MEDIUM | LOW | INFO`. Máximo 10 hallazgos; si hay más, agrupa por causa y deja el detalle en la prosa.
- `files`: solo rutas creadas o modificadas por el agente. Un agente de solo lectura usa `[]`.
- `approval_needed`: operaciones A3 preparadas pero no ejecutadas.
- Listas vacías se escriben `[]`; no omitas claves. El bloque es JSON válido.
- El bloque no reemplaza la evidencia: cada `PASS` debe corresponder a un comando realmente ejecutado.

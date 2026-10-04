# Agentes EOS de Pierre R. Boss

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Este directorio contiene trece definiciones de agentes especializados. Son archivos Markdown con frontmatter (`name`, `description` con ejemplos, `model`, `color`, `tools`) compatibles con los subagentes de Claude Code y legibles como guías de rol en Codex u otros hosts. El contrato que los gobierna está en [AGENT-ORCHESTRATION](../docs/manuals/AGENT-ORCHESTRATION.md), Parte II.

Las definiciones no crean procesos ni conceden permisos: el host decide cuándo invocarlas y con qué herramientas. La lista `tools` es el máximo recomendado; el receptor puede restringirla más.

## Catálogo

| Agente | Rol | Herramientas máximas | Roles originales cubiertos |
|---|---|---|---|
| [eos-orchestrator](eos-orchestrator.md) | Coordina admisión, plan, delegación, integración, verificación y reporte | Lectura, edición, Bash, delegación | 01, 20 |
| [eos-planner](eos-planner.md) | Planes ejecutables con hitos verificables y ownership | Lectura, escritura del plan | 14 |
| [eos-architect](eos-architect.md) | Contratos, alternativas y ADR | Lectura, escritura de ADR, búsqueda web | 02, 03, 06, 07, 10, 11, 12, 13 |
| [eos-tdd-guide](eos-tdd-guide.md) | Pruebas primero y caracterización | Lectura, edición de pruebas, Bash | Calidad de pruebas |
| [eos-implementer](eos-implementer.md) | Cambios acotados dentro de su ownership | Lectura, edición, Bash | Implementación |
| [eos-code-reviewer](eos-code-reviewer.md) | Revisión de código en solo lectura | Lectura, Bash de consulta | 04 |
| [eos-security-reviewer](eos-security-reviewer.md) | Revisión de seguridad y previa a publicar | Lectura, Bash de consulta | 05 |
| [eos-qa-verifier](eos-qa-verifier.md) | Ejecuta verificaciones y reporta estados exactos | Lectura, Bash | 08, Migration Validator |
| [eos-docs-writer](eos-docs-writer.md) | Documentación sincronizada con firma | Lectura, edición de docs, Bash | 15, 22 |
| [eos-migration-archaeologist](eos-migration-archaeologist.md) | Inventario y reglas ocultas de sistemas existentes | Lectura, Bash de consulta, escritura de inventario | 16, System Archaeologist |
| [eos-incident-commander](eos-incident-commander.md) | Coordinación de incidentes y postmortem | Lectura, Bash de diagnóstico, registros | SRE en incidentes |
| [eos-release-manager](eos-release-manager.md) | Releases reproducibles y transferencia | Lectura, Bash, notas y registros | 09, 17 |
| [eos-compliance-analyst](eos-compliance-analyst.md) | Aplicabilidad normativa, licencias y promesas | Lectura, escritura de matrices, búsqueda web | 18, 19, 21 |

Ningún agente tiene por definición herramientas para publicar, enviar mensajes, gastar dinero o cambiar permisos. Esas acciones pertenecen al responsable humano o a la autorización explícita que reciba el orquestador.

## Uso en Claude Code

- Como plugin: el manifiesto [.claude-plugin/plugin.json](../.claude-plugin/plugin.json) expone `agents/` y `skills/`. Registra el repositorio como marketplace con `/plugin marketplace add oprbguitar/dev-funcy-agents-03-10-26` e instala el plugin `eos-agents`.
- Como copia local en otro proyecto: `node scripts/install-agents.mjs --host claude --target <ruta>` copia los agentes a `.claude/agents/` y las skills a `.claude/skills/` sin sobrescribir archivos existentes.
- Dentro de este repositorio, [CLAUDE.md](../CLAUDE.md) importa `AGENTS.md`.

## Uso en Codex

- Codex lee `AGENTS.md` de forma nativa. `node scripts/install-agents.mjs --host codex --target <ruta>` añade un bloque EOS delimitado al `AGENTS.md` del destino, copia las skills a `.agents/skills/` y los roles a `.agents/eos-agents/`.
- Para asumir un rol, Codex lee el archivo del agente y aplica su proceso, herramientas permitidas y formato de salida.

## Niveles de modelo

Cada agente declara en `model` el nivel mínimo que su riesgo justifica, para no ejecutar todo con el modelo más caro de la sesión:

| Nivel | Agentes | Criterio |
|---|---|---|
| `opus` | architect, security-reviewer, compliance-analyst, incident-commander | Decisiones difíciles de revertir o con impacto legal y de seguridad |
| `sonnet` | planner, tdd-guide, implementer, code-reviewer, migration-archaeologist, release-manager, docs-writer | Trabajo de ingeniería acotado por un plan |
| `haiku` | qa-verifier | Ejecutar comandos y reportar estados exactos |
| `inherit` | orchestrator | Usa el modelo que eligió el responsable para la sesión |

El responsable puede cambiar el valor en el frontmatter o en la copia instalada. Codex y otros hosts ignoran este campo.

## Formato común de entregas

Todas las definiciones usan el mismo esquema: estado (`COMPLETED`, `PARTIAL`, `BLOCKED`, `FAILED`), archivos, verificaciones con `PASS`/`FAIL`/`NOT_RUN`/`NOT_APPLICABLE` y hallazgos con severidad (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`) y veredicto (`CONFIRMED`, `PLAUSIBLE`). Así el orquestador consolida entregas de varios agentes. Cada entrega cierra con el bloque JSON `eos-result` de [AGENT-RESULT](../templates/AGENT-RESULT.md): el orquestador integra leyendo solo ese bloque y abre la prosa únicamente ante `PARTIAL`, `BLOCKED`, `FAILED` o hallazgos `CRITICAL`/`HIGH`.

## Mantenimiento

Para añadir un agente: justifica el rol recurrente que no cubren los existentes, escribe la definición con el mismo formato, regístrala en `library.json` (`documents` y `agents`) y en esta tabla, y ejecuta el validador. El validador comprueba frontmatter, coincidencia entre `name` y archivo, descripción, firma editorial y enlaces.

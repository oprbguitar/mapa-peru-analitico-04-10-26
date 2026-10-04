# CLAUDE.md — Pierre R. Boss EOS

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Claude Code: las reglas de este repositorio viven en una sola fuente para todos los hosts. Lee y aplica `AGENTS.md`, importado a continuación, antes de cualquier tarea.

@AGENTS.md

## Notas específicas de Claude Code

- Los subagentes de [agents/](agents/README.md) y las skills de [skills/](skills/README.md) están disponibles como plugin `eos-agents` mediante [.claude-plugin/plugin.json](.claude-plugin/plugin.json).
- Usa subagentes reales solo cuando el host los ofrezca; si ejecutas varios roles tú mismo, decláralo en el reporte.
- Antes de entregar ejecuta `node scripts/eos.mjs gate` (validador, tres suites de pruebas con cobertura y `git diff --check`; solo muestra fallos resumidos).

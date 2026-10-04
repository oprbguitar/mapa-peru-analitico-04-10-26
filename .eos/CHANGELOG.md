# Registro de cambios EOS

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

## 4.1.0 — 2026-10-04

### Endurecimiento tras revisión adversarial

- **CRITICAL corregido — `eos run` sin shell.** Antes unía los argumentos con espacios y los ejecutaba con `shell:true`: se perdían los límites de cada argumento y `;`, `&` o `$()` de un prompt podían ejecutar comandos. Ahora usa `spawnSync(archivo, argv, { shell: false })`. En Windows resuelve PATH/PATHEXT; un shim `.cmd`/`.bat` pasa por `cmd.exe` con cada argumento entre comillas y rechaza `"`, `%`, `!`, saltos de línea y barra final.
- **Confianza de gate por revisión.** La confianza registra el SHA-256 del gate y una huella del repositorio (árbol de HEAD, diff sin commit, archivos nuevos no ignorados; sin drivers de diff externos). Si cambia código, scripts o manifiestos, el gate devuelve `REVISION_CHANGED`. `--trust-commands` mantiene el alcance solo de comandos, rotulado en el plan.
- **Privacidad operacional.** El ledger de `run` se mueve a `~/.eos/runs/<proyecto>.jsonl` (`EOS_HOME` lo cambia) y guarda la tarea solo como huella SHA-256 salvo `--log-task`. El instalador añade a `.gitignore` un bloque EOS para `.eos/context*.md`, `.eos/runs*.jsonl`, `.eos/.update-backup/` y `*.eos-new`.
- **Actualización transaccional.** `--update` planifica sin escribir, respalda, aplica, verifica el hash de cada archivo y revierte todo ante un error; el manifiesto se escribe al final. Los archivos 3.x asumidos de EOS se informan y quedan respaldados.
- **Router de política.** `context` incluye las secciones constitucionales obligatorias de cada tema detectado (pagos, seguridad, IA, datos, release, incidente, cumplimiento, migración) antes del BM25, y avisa si alguna queda fuera del presupuesto.
- **Evaluación sin fuga.** `evals/context/cases.json` separa dev (15, único usado para ajustar), holdout (20) y adversarial (10). Medido: dev 0.767, holdout 0.950 (optimista) y adversarial 0.600 de Recall@10. CI exige umbrales en dev y holdout.
- **Deriva corregida.** Cabeceras de `eos.mjs` e `install-agents.mjs` describen su comportamiento actual. Los pisos de volumen de los manuales quedan congelados (`depth_contract.status = frozen`).
- **Pruebas adversariales.** Metacaracteres y espacios en `run` (en proceso y por CLI real), shim `.cmd` real en Windows, gate con `package.json` modificado y con un script nuevo, fallo inyectado en la actualización. Totales: validador 25, instalador 17, CLI 24.
- Sigue sin runtime DAG propio: EOS es un framework de control para agentes del host, no un motor multiagente autónomo.

## 4.0.0 — 2026-10-04

### Seguridad, actualización y medición

- **Gate con frontera de confianza.** `eos gate` ya no ejecuta un `eos.gate.json` sin revisión: `--plan` muestra comandos y SHA-256, `--trust` registra la aprobación en `~/.eos/trusted-gates.json` (fuera del repositorio) sin ejecutar nada y cualquier edición devuelve el gate a `BLOCKED` (código 2). Descarga y ejecución, borrado masivo, `git push`, `npm publish` y `gh pr merge` nunca se pueden confiar.
- **Actualización segura.** `install-agents.mjs --update [--dry-run]` registra el SHA-256 de cada archivo instalado, reemplaza solo los intactos, conserva ediciones locales con la propuesta en `.eos-new`, informa retirados y renueva el bloque EOS de `AGENTS.md`. Las instalaciones 3.x sin hashes actualizan solo `.eos/`.
- **Consistencia de versión.** El validador compara `library.json` con marketplace, la entrada más reciente del CHANGELOG y `version_refs` (README, PROJECT-PROFILE, EOS-CORE, AGENTS, VERIFICATION). Corrige la deriva 3.0.0/3.5.0 de README y PROJECT-PROFILE.
- **Evaluación de contexto.** `eos eval-context` mide Recall@5, Recall@10 y MRR sobre `evals/context/cases.json` (15 casos, 2 de sinónimos difíciles). Línea base 0.60/0.60; el bonus por encabezado elegido con esta evaluación sube Recall@10 a 0.767 y MRR a 0.718. El CI exige al menos 0.70 y 0.65.
- **Medición real.** `eos run --agent <rol> -- <comando>` registra en `.eos/runs.jsonl` el uso que reportan Claude Code (`--output-format json`) o Codex (`exec --json`); `eos runs` resume por agente. Sin datos del host queda `n/d`.
- Pruebas: validador 25, instalador 14, CLI 18; cobertura de líneas y funciones 100% en los tres scripts.
- No incluye runtime DAG propio: el host sigue ejecutando agentes por decisión de diseño.

## 3.5.0 — 2026-10-04

### CLI de contexto y verificación

- Añade `scripts/eos.mjs`, sin dependencias ni red ni modelos:
  - `context "<tarea>" [--mode] [--budget] [--limit] [--list] [--out]`: indexa constitución y manuales por encabezados `#`–`###`, parte secciones mayores de 6,000 caracteres, clasifica con BM25 (encabezado con triple peso, stemming ligero español/inglés, prioridad 1.5× a los manuales del modo) y entrega solo lo que cabe en el presupuesto, con marcas `archivo:líneas`.
  - `gate [--config] [--json]`: ejecuta `eos.gate.json` y muestra solo los fallos resumidos (máximo 15 líneas por comando) o un bloque `eos-result`.
  - `index [--out]`: tabla de 1,033 secciones con tokens estimados (unos 510k tokens en total en el corpus).
- Añade `eos.gate.json` con las cinco verificaciones de la biblioteca y `tests/eos.test.mjs` (14 pruebas, cobertura de líneas y funciones 100%).
- El instalador copia el CLI a `.eos/scripts/eos.mjs` y documenta su uso en el bloque EOS del destino.
- EOS-CORE, AGENTS, CLAUDE, orquestador y qa-verifier usan `context --list` antes de cargar manuales y `gate` en lugar de logs completos. El CI ejecuta las pruebas del CLI y una prueba sobre el corpus real.
- Límite: la selección es léxica; no comprende sinónimos sin raíz común.

## 3.1.0 — 2026-10-04

### Contexto ligero

- Añade `EOS-CORE.md` (7.2 KB, unos 2k tokens): destilado normativo de carga obligatoria con tabla de carga bajo demanda por tema, sección constitucional y manual. Sustituye la lectura completa de la constitución (60.7 KB, unos 16k tokens) al inicio de cada tarea y de cada subagente; la constitución sigue prevaleciendo ante discrepancia.
- Actualiza `AGENTS.md`, skills, orquestador, guía de navegación, BOOTSTRAP e instalador para leer el núcleo y abrir constitución y manuales solo por secciones.
- Añade la plantilla `AGENT-RESULT` con el bloque JSON `eos-result`; los trece agentes cierran con él y el orquestador integra leyendo solo ese bloque.
- Asigna niveles de modelo por riesgo: `opus` a architect, security-reviewer, compliance-analyst e incident-commander; `sonnet` a planner, tdd-guide, implementer, code-reviewer, migration-archaeologist, release-manager y docs-writer; `haiku` a qa-verifier; `inherit` al orquestador.
- Las cifras de tokens son estimaciones por tamaño (unos 3.7 caracteres por token en español), no mediciones de facturación.

## 3.0.0 — 2026-10-03

### Sistema de agentes clonable

- Completa los doce módulos mayores sobre el piso de 1,001 líneas de contenido y 12,000 palabras: añade CAPABILITY-PROFILER y las Partes II de AGENT-ORCHESTRATION, INCIDENT-RESPONSE, STORAGE-DATA y MIGRATION-HANDOFF; amplía PRIME-DIRECTIVE, SECURITY-FABRIC, AI-GATEWAY, ENGINEERING-QUALITY y PAYMENTS.
- Añade trece agentes especializados en `agents/` con descripción de activación, herramientas mínimas, proceso, estándares, formato común de entrega y casos límite.
- Expone agentes y skills como plugin de Claude Code (`.claude-plugin/plugin.json` y `marketplace.json`) y añade `CLAUDE.md`, que importa `AGENTS.md` como fuente única.
- Añade `scripts/install-agents.mjs` para instalar el sistema en otros proyectos (Claude Code en `.claude/`, Codex en `.agents/`) con instantánea `.eos/`, reescritura de enlaces, simulación y política de no sobrescritura.
- Añade la plantilla EXEC-PLAN para trabajo largo y la incorpora a manuales, skills y agentes.
- Incorpora patrones de los principales sistemas de agentes (procedimientos por rol, grafos con puntos de control, transferencias con guardrails, sandboxes paralelos, subagentes en archivo, instrucciones por directorio y planes ejecutables) sin dependencias externas.
- Amplía el validador con verificación de frontmatter de agentes y de la versión del plugin; añade pruebas del instalador al CI. Firma de Pierre R. Boss (oprbguitar) en cabeceras de scripts, pruebas, workflow y definiciones de agentes.

### Especificaciones extensas por módulo

- Incorpora PRIME-DIRECTIVE y CAPABILITY-PROFILER como módulos propios, enlazados desde la constitución y la guía de navegación.
- Reescribe los diez manuales de dominio para desarrollar decisiones, contratos, estados, invariantes, efectos concurrentes, recuperación, aceptación y casos de ingeniería.
- Establece el requisito del propietario sobre cada módulo mayor: superar 1,000 líneas de contenido. Añade un piso editorial de 12,000 palabras y revisión técnica del dominio.
- Conserva identificadores de cláusula dentro de los módulos para referenciar decisiones y resultados sin trasladar toda la biblioteca a cada contexto.
- Amplía el validador y sus pruebas para rechazar módulos cortos, perfiles inválidos y archivos ausentes; excluye líneas estructurales del conteo.
- Añade informe de profundidad reproducible y aclara que el mínimo editorial no certifica calidad, cumplimiento legal ni implementación de sistemas.
- Mantiene la firma editorial del propietario, la transparencia sobre asistencia de IA y los bytes originales de las cuatro conversaciones fuente.

## 2.0.0 — 2026-10-03

### Biblioteca de instrucciones operativas

- Conserva las secciones 0–83 del maestro y añade aclaraciones 84–95 sobre autoridad, capacidades, evidencias, privacidad, permisos, IA, invariantes y gates.
- Normaliza modos IA a OFF, LOCAL, LOCAL_REMOTE, CLOUD_API, PRIVATE_CLOUD, HYBRID y AUTO. Aclara que la presencia del puerto no activa modelos ni gasto.
- Corrige el algoritmo AUDIT con evaluación read-only y retorno antes de modificar/configurar componentes. Acota loops por tiempo, pasos, presupuesto y autorización.
- El algoritmo descarta acciones prohibidas y retorna con propuesta revisable cuando falta autorización, antes de ejecutar o registrar verificación de un cambio inexistente.
- Añade diez manuales de dominio que desarrollan entradas, responsables, contratos, fallos, aceptación y operación.
- Añade seis skills canónicas, prompts por especialidad y plantillas para registros verificables.
- Amplía README, entrada de agentes, perfil real de la biblioteca, guía de navegación, firma y procedencia.
- Conserva los cuatro antecedentes exactos con SHA-256 y mapa de 301 secciones numeradas.

### Herramientas y revisión

- Incorpora validador de manifiesto, documentos, firma, enlaces locales, fences y hashes sin dependencias externas.
- Incorpora pruebas unitarias, integración y E2E de CLI, con gate mínimo de 80% de coverage del código de soporte.
- Incorpora CI con acciones fijadas a commit, permisos de lectura y checks de alcance documental.
- Distingue hechos verificados, propuestas y funciones futuras: los manuales no despliegan infraestructura, pagos, IA ni automatizaciones.

### Precisiones de seguridad y producto

- Fallback IA restringido por privacidad, destinos y presupuesto.
- Monitoreo sin contraseñas, fingerprints de intentos, tokens de sesión reutilizables ni payloads sensibles íntegros.
- Proxy trust explícito, recuperación tras falsos positivos y límites a respuestas automáticas.
- Pagos inciertos reconciliados antes de nuevos cobros; ledger con correcciones y sin reescribir historia.
- Capacity forecast y restores con datos medidos; ninguna promesa de almacenamiento físicamente ilimitado.
- Aplicabilidad normativa e IP trazable, firma editorial y asistencia de IA transparentes.

## Baseline anterior

El commit `0afe7df` introdujo la constitución EOS identificada con Pierre R. Boss. El commit `e7fcbd5` es el inicio del repositorio. Estas referencias describen historia observada; no se inventa una fecha o release semántica para los commits previos.

# Verificación de la biblioteca y límites de la evidencia

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

Edición verificada: 4.1.0 (2026-10-04).

## Herramientas y scope

La biblioteca utiliza Node.js 24 y su test runner, filesystem, crypto y child_process de la biblioteca estándar. No instala paquetes npm ni módulos Python. Por eso no existe un lockfile que auditar con npm/pip; si se agregan dependencias, debe incorporarse una auditoría real además de revisar origen y licencia.

El programa `scripts/validate-library.mjs` lee, sin modificar, el root elegido explícitamente o el repositorio que contiene el script. Valida forma del manifiesto, documentos registrados, duplicados, firma editorial, cierre de bloques backtick/tilde, enlaces locales en prosa, SHA-256 de fuentes y pisos documentales de los módulos. Rechaza rutas de manifiesto y enlaces que escapen lexicamente del repositorio. No imprime bytes fuente ni valores de secretos. Desde 4.0.0 también exige que la versión de `library.json` coincida con plugin, marketplace, la entrada más reciente de `CHANGELOG.md` y cada referencia de `version_refs`.

`scripts/install-agents.mjs` instala sin sobrescribir y, con `--update`, reemplaza solo archivos intactos según los SHA-256 de `.eos/install-manifest.json`. `scripts/eos.mjs` selecciona contexto (`context`), ejecuta verificaciones confiadas (`gate`), registra corridas de agentes (`run`, `runs`) y mide la recuperación (`eval-context`).

## Reproducción

Desde la raíz del repositorio:

```powershell
node scripts/validate-library.mjs
node --test --experimental-test-coverage --test-coverage-include=scripts/validate-library.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/validate-library.test.mjs
node --test --experimental-test-coverage --test-coverage-include=scripts/install-agents.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/install-agents.test.mjs
node --test --experimental-test-coverage --test-coverage-include=scripts/eos.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 tests/eos.test.mjs
node scripts/eos.mjs eval-context
git diff --check
```

Para comprobar otra copia de esta biblioteca, el root es un argumento literal:

```powershell
node scripts/validate-library.mjs --root 'C:\ruta\a\copia EOS'
```

`PASS` requiere cero errores del alcance estructural; `FAIL` devuelve exit code 1 con referencias a los fallos. Los tests crean fixtures aislados en la carpeta temporal y eliminan únicamente sus propios directorios de fixture al terminar.

## Casos de prueba

| Nivel | Qué comprueba |
|---|---|
| Unitarias | Clasificación de enlaces, fences, rutas y forma de registros |
| Integración | Lectura de archivos reales, manifiesto, firma y source hash |
| CLI E2E | Ejecución del proceso, stdout/stderr y exit codes PASS/FAIL |
| Negativas | Documento ausente, firma ausente, enlace roto, codificación inválida, path externo, archivo fuente modificado/ausente y manifiesto inválido |
| Agentes y plugin | Frontmatter de subagentes, coincidencia `name`/archivo, descripción, registro en `documents` y versión de `.claude-plugin/plugin.json` igual a `library.json` |
| Instalador | Instantánea `.eos/`, copias para Claude Code y Codex, reescritura de enlaces, no sobrescritura, bloque idempotente en `AGENTS.md`/`CLAUDE.md`, simulación, rechazo del origen y CLI |
| Profundidad | Líneas estructurales excluidas, piso de palabras independiente, perfiles inválidos, módulo no registrado/ausente y reporte de medidas |
| Versiones | `version_refs`, entrada más reciente del CHANGELOG y marketplace contra `library.json` |
| Actualización | Hashes por archivo, reemplazo solo de intactos, conflictos con `.eos-new`, instalaciones antiguas sin hashes, retirados y bloque renovado |
| CLI eos | Stemming, secciones y fragmentos, BM25 con bonus de encabezado y modo, router de política y obligatorias omitidas, presupuesto, gate bloqueado/confiado/cambiado/riesgoso y confianza por revisión git, `run` sin shell con metacaracteres hostiles y shims `.cmd`, ledger fuera del repositorio con huella de tarea, uso de Claude y Codex, evaluación por conjuntos |
| Actualización transaccional | Fallo inyectado a mitad de la escritura, restauración completa, manifiesto intacto, respaldo, `.gitignore` y archivos legacy informados |

La edición 2.0 partió de un ciclo RED por ausencia del validador y alcanzó doce pruebas. La edición 3.0 añadió primero cinco pruebas de profundidad que fallaron antes de implementar el control, y después verificó su paso a GREEN. La salida más reciente de tests/CI es la autoridad para el número total de pruebas y la cobertura de líneas, ramas y funciones. El gate exige al menos 80% en cada categoría del código de soporte. No se atribuye esa cobertura a los manuales, proveedores o productos futuros.

La revisión del sistema de agentes añadió cinco pruebas de agentes y plugin al validador (22 en total) y nueve pruebas del instalador; todas fallaron antes de implementar cada control. La cobertura medida el 2026-10-03 fue 100% de líneas en ambos scripts, con 95.6% y 95.5% de ramas.

## Cómo se mide la extensión

`library.json.module_requirements` identifica los doce módulos y sus pisos. Cada perfil debe apuntar a un documento registrado y contener enteros positivos seguros para `min_content_lines` y `min_words`. El validador no infiere qué archivo es un módulo: cambiar ese registro requiere revisar expresamente el contrato de profundidad y el inventario del propietario.

Para cada módulo, el algoritmo separa líneas LF/CRLF y recorta espacios extremos. Descarta líneas vacías; títulos Markdown ATX de uno a seis `#`; marcadores iniciales backtick/tilde; líneas hechas únicamente de llaves, corchetes, comas o espacios; separadores `-`, `*` y `_`; y divisores de tabla de la forma `|---|---|`. Cuenta las líneas restantes, incluidos requisitos y contenido útil de ejemplos. Las palabras son tokens separados por whitespace de esas mismas líneas. No usa estimaciones de tokens de un proveedor ni conteos de palabras de un procesador de texto.

El algoritmo es deliberadamente mecánico, no un parser Markdown completo. No identifica automáticamente relleno, repeticiones semánticas, premisas incorrectas, párrafos envueltos, etiquetas de cláusula vacías o coherencia entre módulos. Esos aspectos requieren revisión editorial y técnica. El piso adicional de palabras ayuda a rechazar listas demasiado breves, pero tampoco acredita profundidad por sí solo.

El [informe de profundidad](DEPTH-REPORT.md) es una medición de esta revisión documental. Después de editar módulos, la salida actual del validador prevalece sobre una tabla histórica; actualiza el informe antes de publicar una nueva edición.

## Revisión que sigue siendo humana o específica del producto

- El parser de links es deliberadamente limitado a enlaces Markdown inline comunes, fuera de bloques fenced. No es un parser CommonMark completo; no valida anchors, referencias indirectas, HTML embebido ni enlaces externos.
- La firma se comprueba como presencia de etiqueta editorial, no autenticidad de identidad o firma digital.
- SHA-256 detecta modificaciones contra un manifiesto confiable; no protege contra un atacante que pueda editar fuente y manifiesto a la vez.
- Las rutas se controlan lexicamente. No se ejecutan archivos enlazados; no se ofrece aislamiento frente a symlinks hostiles ni sandbox de filesystem.
- La calidad normativa, contradicciones y adecuación de ejemplos se revisan por dominio. No son certificadas por un test de estructura.
- Las fuentes legales/técnicas tienen su fecha y alcance de consulta en cada manual. No se garantiza frescura automática.
- No se prueba un sistema web, login, pago, WAF, backup o modelo real con estos tests.
- `eval-context` separa tres conjuntos. **dev** (15 casos) es el único usado para ajustar parámetros: Recall@10 0.767, MRR 0.718. **holdout** (20 casos de temas no usados en el ajuste): Recall@10 0.950, MRR 0.890; es optimista porque sus consultas se redactaron conociendo los encabezados. **adversarial** (10 casos con errores ortográficos, Spanglish, inglés y paráfrasis): Recall@10 0.600, MRR 0.509, sin umbral para no ocultar el límite léxico. CI exige dev ≥ 0.70/0.65 y holdout ≥ 0.85/0.75. 45 casos no demuestran generalización; la meta pendiente es 100–200.
- El router de política garantiza las secciones constitucionales por tema solo cuando la tarea menciona vocabulario del tema; una tarea sin esas palabras no las activa.
- La lista de riesgos de `gate` es un freno, no un sandbox: un comando confiado conserva los permisos del usuario que lo ejecuta. La huella de revisión cubre archivos versionados y no ignorados; no cubre dependencias instaladas ignoradas (`node_modules/`), variables de entorno ni herramientas globales.
- `run` no usa shell; las pruebas adversariales cubren `;`, `&`, `|`, `$()`, backticks, redirecciones y comillas en argumentos, y en Windows el paso por shims `.cmd`.
- La actualización transaccional se prueba con un fallo inyectado a mitad de la escritura; no protege contra un corte de energía durante la restauración.
- `run` mide solo lo que el host reporta; no verifica facturación del proveedor.
- La detección de secretos exige revisar material completo y diff; una búsqueda de patrones no garantiza ausencia universal de información sensible.

## Gate antes de publicación

Confirma que los cuatro antecedentes conservan sus bytes, todos los documentos están registrados, los doce módulos superan sus pisos, las firmas y links cumplen el alcance, tests y coverage pasan y no existe material privado fuera de la autorización. Revisa contratos, invariantes y escenarios con especialistas disponibles. Registra fallos corregidos y límites; conserva visibilidad y estado ajeno.

La publicación se verifica con commit local, ref remoto y checks reales. Un workflow escrito no se reporta como aprobado hasta que GitHub haya ejecutado sus jobs. Las mediciones locales y el resultado remoto se distinguen en la entrega.

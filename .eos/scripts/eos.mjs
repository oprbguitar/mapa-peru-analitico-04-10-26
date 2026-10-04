// CLI de contexto, verificación y medición de EOS.
// Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo asistido por IA.
// Reduce tokens con código determinista. `context` arma un paquete con secciones obligatorias
// por tema (router de política) más secciones relevantes por BM25 dentro de un presupuesto;
// `index` publica la tabla de secciones; `gate` ejecuta verificaciones solo si su archivo y la
// revisión del repositorio fueron confiados; `run`/`runs` lanzan un comando del host sin shell y
// registran su uso real fuera del repositorio; `eval-context` mide la recuperación por conjunto
// (dev, holdout, adversarial). Sin dependencias, sin red y sin llamadas a modelos.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CHARS_PER_TOKEN = 3.7;
export const estimateTokens = text => Math.ceil(text.length / CHARS_PER_TOKEN);

// Manuales que cada modo prioriza; multiplican la puntuación, no excluyen otros resultados.
export const MODE_MANUALS = {
  INIT: ['PRIME-DIRECTIVE', 'CAPABILITY-PROFILER', 'ENGINEERING-QUALITY'],
  ADOPT: ['MIGRATION-HANDOFF', 'CAPABILITY-PROFILER', 'ENGINEERING-QUALITY'],
  AUDIT: ['ENGINEERING-QUALITY', 'SECURITY-FABRIC', 'COMPLIANCE-IP-PRODUCT'],
  MIGRATE: ['MIGRATION-HANDOFF', 'UPDATES-RELIABILITY', 'STORAGE-DATA'],
  RELEASE: ['UPDATES-RELIABILITY', 'ENGINEERING-QUALITY'],
  INCIDENT: ['INCIDENT-RESPONSE', 'SECURITY-FABRIC'],
};
const MODE_BOOST = 1.5;
const HEADING_WEIGHT = 3;
// Elegido con evals/context: 2 sube Recall@10 de 0.60 a 0.77; valores mayores no mejoran.
const HEADING_BONUS = 2;

const STOP = new Set(`para por con sin una uno unos unas los las del que como cuando donde este esta estos estas
ese esa eso sus son ser hay mas pero tras segun bajo dentro cada debe deben puede pueden entre sobre tambien solo antes despues desde hasta
the and for with that this from are not was were have has into when what which their than then also only must
should can any all its our your out use usa uso`.split(/\s+/));

export const normalize = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Stemming ligero para español e inglés: quita plural y trunca a 7 caracteres, de modo que
// idempotencia/idempotente, sesión/sesiones o conciliar/conciliación comparten raíz.
export const stem = term => (term.length > 4 ? term.replace(/(es|s)$/, '') : term).slice(0, 7);
export const terms = text => (normalize(text).match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])
  .filter(term => !STOP.has(term)).map(stem);

// Divide un Markdown en secciones #, ## y ###, ignora encabezados dentro de fences y parte
// secciones mayores que maxChars en fragmentos por párrafo para no cargar bloques enormes.
export function splitSections(text, file, maxChars = 6000) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let fence = null;
  let current = { file, heading: '(preámbulo)', start: 1, lines: [] };
  const flush = end => {
    if (current.lines.some(line => line.trim())) sections.push({ ...current, end });
  };
  lines.forEach((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) fence = fence === null ? marker[1] : (marker[1][0] === fence[0] ? null : fence);
    const heading = fence === null && !marker ? line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/) : null;
    if (heading) {
      flush(index);
      current = { file, heading: heading[2], start: index + 1, lines: [] };
    }
    current.lines.push(line);
  });
  flush(lines.length);
  return sections.flatMap(section => chunk(section, maxChars));
}

function chunk(section, maxChars) {
  const body = section.lines.join('\n');
  if (body.length <= maxChars) return [{ ...strip(section), text: body }];
  const parts = [];
  let buffer = [];
  let start = section.start;
  let fence = false;
  let size = 0;
  const push = end => {
    if (!buffer.length) return;
    parts.push({ file: section.file, heading: section.heading, start, end, text: buffer.join('\n') });
    buffer = [];
    size = 0;
    start = end + 1;
  };
  section.lines.forEach((line, offset) => {
    if (/^\s{0,3}(`{3,}|~{3,})/.test(line)) fence = !fence;
    buffer.push(line);
    size += line.length + 1;
    // Corta en párrafo desde el 60%, en cualquier línea al llegar al máximo y siempre al doble (fences largos).
    const soft = !fence && (line.trim() ? size >= maxChars : size >= maxChars * 0.6);
    if (soft || size >= maxChars * 2) push(section.start + offset);
  });
  push(section.start + section.lines.length - 1);
  return parts.map((part, index) => ({ ...part, heading: `${part.heading} (parte ${index + 1}/${parts.length})` }));
}

const strip = ({ lines, ...rest }) => rest;

export async function loadCorpus(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'library.json'), 'utf8'));
  const files = manifest.documents.filter(file =>
    file === 'EOS_MASTER_SYSTEM_INSTRUCTION.md' || /^docs\/manuals\/[^/]+\.md$/.test(file));
  const sections = [];
  for (const file of files) sections.push(...splitSections(await readFile(path.join(root, file), 'utf8'), file));
  return { version: manifest.version, sections };
}

// BM25 sobre el texto de cada sección; los términos del encabezado cuentan HEADING_WEIGHT veces.
export function rank(sections, query, mode) {
  const queryTerms = [...new Set(terms(query))];
  if (!queryTerms.length) return [];
  const docs = sections.map(section => {
    const bag = [...terms(section.text)];
    for (let repeat = 1; repeat < HEADING_WEIGHT; repeat += 1) bag.push(...terms(section.heading));
    const tf = new Map();
    for (const term of bag) tf.set(term, (tf.get(term) ?? 0) + 1);
    return { tf, length: bag.length };
  });
  const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1;
  const df = new Map(queryTerms.map(term => [term, docs.filter(doc => doc.tf.has(term)).length]));
  const preferred = MODE_MANUALS[mode] ?? [];
  return sections.map((section, index) => {
    const doc = docs[index];
    let score = 0;
    for (const term of queryTerms) {
      const freq = doc.tf.get(term) ?? 0;
      if (!freq) continue;
      const idf = Math.log(1 + (docs.length - df.get(term) + 0.5) / (df.get(term) + 0.5));
      score += idf * (freq * 2.2) / (freq + 1.2 * (0.25 + 0.75 * doc.length / avg));
    }
    // Un encabezado que nombra el tema de la consulta pesa más que una sección larga que solo lo menciona.
    const headingTerms = new Set(terms(section.heading));
    const covered = queryTerms.filter(term => headingTerms.has(term)).length;
    if (score) score *= 1 + HEADING_BONUS * covered / queryTerms.length;
    if (score && preferred.some(name => section.file.endsWith(`/${name}.md`))) score *= MODE_BOOST;
    return { ...section, score, tokens: estimateTokens(section.text) };
  }).filter(section => section.score > 0).sort((a, b) => b.score - a.score);
}

// Router de política: versión ejecutable de la tabla de carga bajo demanda de EOS-CORE. Si la tarea
// toca un tema, sus secciones constitucionales entran siempre, aunque BM25 no las encuentre: una
// obligación normativa no debe depender de que la consulta comparta vocabulario con ella.
export const CONSTITUTION = 'EOS_MASTER_SYSTEM_INSTRUCTION.md';
export const POLICY_RULES = [
  { topic: 'pagos', match: /\b(pag|cobr|payment|webhook|reembol|refund|factur|checkout|tarjet|card|ledger|concili)/, sections: [33, 34, 35, 36, 37, 90] },
  { topic: 'seguridad', match: /\b(segur|secur|login|sesion|session|auth|oauth|mfa|ddos|waf|bot|rate|csrf|secret|credenc|token|vulner|cve|ataqu)/, sections: [16, 21, 88] },
  { topic: 'ia', match: /\b(llm|model|prompt|embedd|agent|ollama|openai|claude|gpt|ia)\b/, sections: [11, 13, 14, 15, 89] },
  { topic: 'datos', match: /\b(backup|respald|almacen|storage|disco|restaur|dato|base|schema|esquem|retenc)/, sections: [29, 32, 38, 90] },
  { topic: 'release', match: /\b(releas|deploy|desplieg|actualiz|updat|rollback|canary|slo|version)/, sections: [41, 43, 60, 90] },
  { topic: 'incidente', match: /\b(incident|caida|outage|postmort|brecha|breach|filtr|leak)/, sections: [42, 88] },
  { topic: 'cumplimiento', match: /\b(legal|licenc|licens|regul|privac|cumpli|complian|ley|contrat|patent|marca|indecopi|gdpr)/, sections: [47, 48, 50, 56, 91] },
  { topic: 'migracion', match: /\b(migr|handoff|transfer|reescrit|rewrite|legacy|hereda)/, sections: [58, 59] },
];

export function policySections(sections, task) {
  const query = terms(task).join(' ');
  const topics = POLICY_RULES.filter(rule => rule.match.test(query));
  const wanted = new Set(topics.flatMap(rule => rule.sections));
  const mandatory = sections.filter(section => section.file === CONSTITUTION
    && wanted.has(Number(section.heading.match(/^(\d+)\.\s/)?.[1])))
    .map(section => ({ ...section, mandatory: true, score: 0, tokens: estimateTokens(section.text) }));
  return { topics: topics.map(rule => rule.topic), mandatory };
}

// Las obligatorias entran primero y no cuentan contra el límite de secciones; si exceden el
// presupuesto se reportan como omitidas para que nadie crea que el paquete las incluye.
export function selectWithinBudget(ranked, budget, limit = 12, mandatory = []) {
  const chosen = [];
  const omitted = [];
  let used = 0;
  for (const section of mandatory) {
    if (used + section.tokens > budget) { omitted.push(section); continue; }
    chosen.push(section);
    used += section.tokens;
  }
  const taken = new Set(chosen.map(section => `${section.file}:${section.start}`));
  let relevant = 0;
  for (const section of ranked) {
    if (relevant >= limit) break;
    if (taken.has(`${section.file}:${section.start}`) || used + section.tokens > budget) continue;
    chosen.push(section);
    used += section.tokens;
    relevant += 1;
  }
  chosen.sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start);
  return { chosen, used, omitted };
}

export function renderPack({ task, mode, budget, chosen, used, listOnly, topics = [], omitted = [] }) {
  const head = [
    '# Paquete de contexto EOS',
    `Tarea: ${task} | Modo: ${mode ?? 'sin modo'} | Presupuesto: ${budget} tokens | Usado: ~${used} | Secciones: ${chosen.length}`,
    `Temas de política: ${topics.length ? topics.join(', ') : 'ninguno'}`,
    '',
    ...chosen.map(section =>
      `- ${section.file}:${section.start}-${section.end} — ${section.heading} (~${section.tokens} tokens, ${section.mandatory ? 'obligatoria' : section.score.toFixed(2)})`),
    ...omitted.map(section => `- OMITIDA POR PRESUPUESTO (obligatoria): ${section.file}:${section.start}-${section.end} — ${section.heading}`),
  ];
  if (!chosen.length) head.push('Sin coincidencias: usa términos del dominio (p. ej. "rollback", "webhook", "sesión").');
  if (listOnly) return `${head.join('\n')}\n`;
  const body = chosen.map(section => `\n---\n<!-- ${section.file}:${section.start}-${section.end} -->\n${section.text.trim()}\n`);
  return `${head.join('\n')}\n${body.join('')}`;
}

// Extrae las líneas útiles de una salida fallida: primero las que nombran el fallo, si no las últimas.
export function summarizeFailure(output, maxLines = 15) {
  const lines = output.split(/\r?\n/).map(line => line.trimEnd()).filter(Boolean);
  // Excluye líneas de éxito (✔, "ok N", "PASS") aunque su nombre contenga "fail" o "error".
  const relevant = lines.filter(line => !/^\s*(✔|ok \d|PASS\b)/.test(line)
    && /fail|error|not ok|assert|expected|actual|✖|missing|roto|falta/i.test(line));
  return (relevant.length ? relevant : lines.slice(-10)).slice(0, maxLines)
    .map(line => (line.length > 200 ? `${line.slice(0, 197)}...` : line));
}

// Patrones que nunca se confían: descarga y ejecución, borrado masivo, publicación o cambios remotos.
// No es un sandbox; es un freno para que un gate de verificación no se convierta en despliegue.
export const RISKY = [
  /\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh|pwsh|powershell|node|python)\b/i,
  /\b(iwr|irm|invoke-webrequest|invoke-restmethod)\b[\s\S]*\b(iex|invoke-expression)\b/i,
  /\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\*|\.\.)(\s|$)/i,
  /\b(remove-item)\b[\s\S]*-recurse[\s\S]*\s(\/|~|[a-z]:\\?)(\s|$)/i,
  /\b(mkfs|format\s+[a-z]:|shutdown|reboot|diskpart)\b/i,
  /\bgit\s+push\b/i,
  /\b(npm|pnpm|yarn)\s+publish\b/i,
  /\b(gh\s+(release|pr\s+merge|repo\s+delete))\b/i,
];
export const riskyReason = run => RISKY.find(pattern => pattern.test(run))?.source ?? null;

// Estado operativo de EOS fuera de cualquier repositorio: confianza de gates y ledger de corridas.
export const eosHome = () => process.env.EOS_HOME ?? path.join(homedir(), '.eos');
export const defaultTrustStore = () => process.env.EOS_TRUST_STORE ?? path.join(eosHome(), 'trusted-gates.json');
export const projectId = dir => `${path.basename(dir).replace(/[^a-z0-9_-]+/gi, '_')}-${createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 10)}`;
export const defaultLedger = dir => path.join(eosHome(), 'runs', `${projectId(dir)}.jsonl`);

// Huella de lo que el gate realmente ejecuta: árbol de HEAD, cambios sin commit y archivos no
// ignorados sin seguimiento. Si cambia package.json, un script o un test, la confianza caduca.
// Desactiva diff externo y textconv para no ejecutar drivers configurados. Fuera de git: null.
export function revisionFingerprint(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, maxBuffer: 512 * 1024 * 1024 });
  const tree = git('rev-parse', 'HEAD^{tree}');
  if (tree.status !== 0) return null;
  const hash = createHash('sha256').update(tree.stdout);
  hash.update(git('diff', 'HEAD', '--binary', '--no-ext-diff', '--no-textconv').stdout);
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z').stdout.toString('utf8').split('\0').filter(Boolean).sort();
  for (const file of untracked) {
    hash.update(`\0${file}\0`);
    try { hash.update(readFileSync(path.join(dir, file))); } catch { hash.update('ilegible'); }
  }
  return hash.digest('hex');
}

// Resuelve el ejecutable sin shell. En Windows recorre PATH con PATHEXT para distinguir un .exe
// de un shim .cmd/.bat; un nombre sin extensión no se ejecuta como archivo sin extensión.
export function resolveExecutable(command, { platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32') return command;
  const hasExt = path.extname(command) !== '';
  const extensions = hasExt ? [''] : (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const bases = /[\\/]/.test(command) ? [command]
    : (env.PATH ?? env.Path ?? '').split(';').filter(Boolean).map(dir => path.win32.join(dir, command));
  for (const base of bases) for (const ext of extensions) if (existsSync(base + ext)) return base + ext;
  return command;
}

// Un shim .cmd/.bat solo puede ejecutarse a través de cmd.exe. Cada argumento va entre comillas y
// se rechazan los caracteres que cmd o el parser del programa destino reinterpretan aun entre comillas.
const CMD_UNSAFE = /["%!\r\n]|\\$/;
export function buildSpawn(argv, options = {}) {
  const file = resolveExecutable(argv[0], options);
  if (!/\.(cmd|bat)$/i.test(file)) return { file, args: argv.slice(1), options: {} };
  if (argv.slice(1).some(arg => CMD_UNSAFE.test(arg))) {
    throw new Error('argumento no admitido con un shim .cmd/.bat (contiene ", %, !, salto de línea o termina en \\); usa el ejecutable .exe o pasa el texto en un archivo');
  }
  const line = [file, ...argv.slice(1)].map(arg => `"${arg}"`).join(' ');
  return { file: (options.env ?? process.env).ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], options: { windowsVerbatimArguments: true } };
}

const readStore = async file => JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));

// Confianza = ruta absoluta del gate + SHA-256 exacto + (por defecto) huella de la revisión del
// repositorio. Vive fuera del repositorio para que este no pueda declararse confiable. Con alcance
// "revision", cambiar package.json, un script o un test invalida la confianza aunque el gate no cambie.
export async function trustStatus(store, configPath, hash, revision) {
  const entry = (await readStore(store))[configPath];
  if (!entry) return { status: 'UNTRUSTED', scope: null };
  const scope = entry.scope ?? 'commands';
  if (entry.sha256 !== hash) return { status: 'CHANGED', scope };
  if (scope === 'revision' && entry.revision !== revision) return { status: 'REVISION_CHANGED', scope };
  return { status: 'TRUSTED', scope };
}

export async function trustGate(store, configPath, hash, commands, scope, revision) {
  const data = await readStore(store);
  data[configPath] = {
    sha256: hash, scope, revision: scope === 'revision' ? revision : null,
    trusted_at: new Date().toISOString(), commands: commands.map(item => item.run),
  };
  await mkdir(path.dirname(store), { recursive: true });
  await writeFile(store, `${JSON.stringify(data, null, 2)}\n`);
}

const SCOPE_LABEL = {
  commands: 'solo comandos (no cubre cambios del repositorio)',
  revision: 'comandos + revisión del repositorio',
};

export function renderPlan(configPath, hash, trust, commands, revision) {
  return [
    `Gate: ${configPath}`,
    `SHA-256: ${hash}`,
    `Revisión: ${revision ? revision.slice(0, 16) : 'sin git (la confianza solo cubre el archivo del gate)'}`,
    `Confianza: ${trust.status} — alcance: ${SCOPE_LABEL[trust.scope] ?? 'sin confiar'}`,
    ...commands.map(item => {
      const risk = riskyReason(item.run);
      return `- ${item.name}: ${item.run}${risk ? `  ⚠ RIESGO (${risk})` : ''}`;
    }),
  ].join('\n') + '\n';
}

export function runGate(commands, cwd, timeoutMs = 600000) {
  return commands.map(({ name, run }) => {
    const began = Date.now();
    const result = spawnSync(run, { cwd, shell: true, encoding: 'utf8', timeout: timeoutMs });
    const seconds = ((Date.now() - began) / 1000).toFixed(1);
    const passed = result.status === 0 && !result.error;
    return {
      name, run, seconds, result: passed ? 'PASS' : 'FAIL', exit: result.status,
      detail: passed ? [] : summarizeFailure(`${result.stdout ?? ''}\n${result.stderr ?? ''}\n${result.error?.message ?? ''}`),
    };
  });
}

export function renderGate(results, asJson) {
  const failed = results.filter(item => item.result === 'FAIL');
  if (asJson) {
    return `\`\`\`eos-result\n${JSON.stringify({
      agent: 'eos-gate',
      status: failed.length ? 'FAILED' : 'COMPLETED',
      summary: `${results.length - failed.length}/${results.length} verificaciones PASS`,
      files: [],
      checks: results.map(item => ({ cmd: item.run, result: item.result, note: (item.detail[0] ?? `${item.seconds}s`).slice(0, 80) })),
      findings: [],
      next: failed.map(item => ({ item: `Corregir ${item.name}`, owner: 'eos-implementer' })),
      approval_needed: [],
    }, null, 2)}\n\`\`\`\n`;
  }
  const lines = results.map(item => `${item.result} ${item.name} (${item.seconds}s${item.result === 'FAIL' ? `, salida ${item.exit}` : ''})`
    + item.detail.map(line => `\n    ${line}`).join(''));
  lines.push(`${failed.length ? 'FAIL' : 'PASS'}: ${results.length - failed.length}/${results.length} verificaciones`);
  return `${lines.join('\n')}\n`;
}

// Suma el uso que reportan los hosts: objeto JSON de `claude -p --output-format json` o líneas
// JSONL de `codex exec --json`. Si no hay campos de uso, devuelve null: nunca se estima ni inventa.
export function extractUsage(stdout) {
  const objects = [];
  const tryParse = text => { try { const value = JSON.parse(text); if (value && typeof value === 'object') objects.push(value); } catch { /* no es JSON */ } };
  tryParse(stdout.trim());
  if (!objects.length) for (const line of stdout.split(/\r?\n/)) if (line.trim().startsWith('{')) tryParse(line.trim());
  const usage = { input_tokens: null, output_tokens: null, cache_read_tokens: null, cost_usd: null, result: null };
  const add = (key, value) => { if (Number.isFinite(value)) usage[key] = (usage[key] ?? 0) + value; };
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.usage && typeof value.usage === 'object') {
      add('input_tokens', value.usage.input_tokens);
      add('output_tokens', value.usage.output_tokens);
      add('cache_read_tokens', value.usage.cache_read_input_tokens ?? value.usage.cached_input_tokens);
    }
    add('cost_usd', value.total_cost_usd);
    if (typeof value.result === 'string') usage.result = value.result;
    for (const child of Object.values(value)) if (child && typeof child === 'object' && child !== value.usage) visit(child);
  };
  objects.forEach(visit);
  return usage;
}

export async function recordRun(ledger, entry) {
  await mkdir(path.dirname(ledger), { recursive: true });
  await writeFile(ledger, `${JSON.stringify(entry)}\n`, { flag: 'a' });
}

export function summarizeRuns(lines) {
  const runs = lines.split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
  const byAgent = new Map();
  for (const run of runs) {
    const row = byAgent.get(run.agent) ?? { agent: run.agent, runs: 0, pass: 0, input: 0, output: 0, cost: 0, measured: 0, ms: [] };
    row.runs += 1;
    if (run.status === 'PASS') row.pass += 1;
    if (run.input_tokens !== null && run.input_tokens !== undefined) {
      row.measured += 1;
      row.input += run.input_tokens;
      row.output += run.output_tokens ?? 0;
    }
    row.cost += run.cost_usd ?? 0;
    row.ms.push(run.duration_ms);
    byAgent.set(run.agent, row);
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
  const rows = [...byAgent.values()].map(row =>
    `${row.agent} | ${row.runs} | ${row.pass}/${row.runs} | ${row.measured ? row.input : 'n/d'} | ${row.measured ? row.output : 'n/d'} | ${row.cost.toFixed(4)} | ${(median(row.ms) / 1000).toFixed(1)}s`);
  return `agente | corridas | PASS | tokens entrada | tokens salida | costo USD | mediana\n${rows.join('\n') || '(sin corridas)'}\n`;
}

// Evalúa la recuperación de `context` contra casos con secciones esperadas (archivo + parte del encabezado).
export function evaluateContext(sections, cases) {
  const results = cases.map(item => {
    const ranked = rank(sections, item.query, item.mode?.toUpperCase());
    const hits = item.expected.map(expected => ranked.findIndex(section =>
      section.file === expected.file && normalize(section.heading).includes(normalize(expected.heading))) + 1);
    const recall = k => hits.filter(position => position > 0 && position <= k).length / hits.length;
    const first = Math.min(...hits.filter(position => position > 0));
    return { id: item.id, recall5: recall(5), recall10: recall(10), rr: Number.isFinite(first) ? 1 / first : 0, hits };
  });
  const mean = key => results.reduce((sum, item) => sum + item[key], 0) / (results.length || 1);
  return { results, recall_at_5: mean('recall5'), recall_at_10: mean('recall10'), mrr: mean('rr') };
}

export function parseOptions(args) {
  const options = { positional: [] };
  const flags = new Set(['--list', '--json', '--plan', '--trust', '--trust-commands', '--log-task']);
  const valued = new Set(['--mode', '--budget', '--out', '--root', '--config', '--limit', '--agent', '--task', '--ledger', '--cases']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') { options.command = args.slice(index + 1); break; }
    if (flags.has(arg)) options[arg.slice(2)] = true;
    else if (valued.has(arg)) {
      if (args[index + 1] === undefined) return null;
      options[arg.slice(2)] = args[index + 1];
      index += 1;
    } else if (arg.startsWith('--')) return null;
    else options.positional.push(arg);
  }
  return options;
}

const USAGE = `Uso:
  node scripts/eos.mjs context "<tarea>" [--mode INIT|ADOPT|AUDIT|MIGRATE|RELEASE|INCIDENT] [--budget 8000] [--limit 12] [--list] [--out archivo]
  node scripts/eos.mjs gate [--config eos.gate.json] [--plan | --trust] [--json]
    --plan muestra comandos, SHA-256 y confianza; --trust registra la revisión fuera del repo sin ejecutar.
    Sin confianza vigente para ese SHA-256, gate termina BLOCKED (código 2) y no ejecuta nada.
  node scripts/eos.mjs index [--out .eos-index.json]
  node scripts/eos.mjs run --agent <rol> [--task "<texto>"] [--ledger .eos/runs.jsonl] -- <comando del host>
    p. ej. -- claude -p "..." --output-format json   |   -- codex exec --json "..."
  node scripts/eos.mjs runs [--ledger .eos/runs.jsonl]
  node scripts/eos.mjs eval-context [--cases evals/context/cases.json]
  Opción común: --root <biblioteca EOS> (por defecto, la carpeta que contiene este script)
`;

export async function main(args, {
  cwd = process.cwd(), out = text => process.stdout.write(text), err = text => process.stderr.write(text),
  store = defaultTrustStore(),
} = {}) {
  const [command, ...rest] = args;
  const options = parseOptions(rest);
  if (!options || !['context', 'gate', 'index', 'run', 'runs', 'eval-context'].includes(command)) { err(USAGE); return 1; }
  const root = path.resolve(cwd, options.root ?? path.dirname(path.dirname(fileURLToPath(import.meta.url))));
  const emit = async text => {
    if (!options.out) { out(text); return; }
    const target = path.resolve(cwd, options.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
    out(`Escrito ${path.relative(cwd, target) || target} (~${estimateTokens(text)} tokens)\n`);
  };
  try {
    if (command === 'context') {
      const task = options.positional.join(' ').trim();
      const mode = options.mode?.toUpperCase();
      const budget = Number(options.budget ?? 8000);
      const limit = Number(options.limit ?? 12);
      if (!task || (mode && !MODE_MANUALS[mode]) || !(budget > 0) || !(limit > 0)) { err(USAGE); return 1; }
      const { sections } = await loadCorpus(root);
      const { topics, mandatory } = policySections(sections, task);
      const { chosen, used, omitted } = selectWithinBudget(rank(sections, task, mode), budget, limit, mandatory);
      await emit(renderPack({ task, mode, budget, chosen, used, omitted, topics, listOnly: options.list }));
      return 0;
    }
    if (command === 'index') {
      const { version, sections } = await loadCorpus(root);
      const index = sections.map(({ file, heading, start, end, text }) => ({
        file, heading, start, end, tokens: estimateTokens(text),
      }));
      const total = index.reduce((sum, item) => sum + item.tokens, 0);
      await emit(`${JSON.stringify({ version, chars_per_token: CHARS_PER_TOKEN, sections: index.length, total_tokens: total, index }, null, 2)}\n`);
      return 0;
    }
    const ledger = options.ledger ? path.resolve(cwd, options.ledger) : defaultLedger(cwd);
    if (command === 'run') {
      // Sin shell: cada argumento llega intacto y ; & | $ ` no se reinterpretan.
      if (!options.agent || !options.command?.length) { err(USAGE); return 1; }
      let spawn;
      try { spawn = buildSpawn(options.command); }
      catch (error) { err(`ERROR: ${error.message}\n`); return 1; }
      const began = Date.now();
      const result = spawnSync(spawn.file, spawn.args, { cwd, shell: false, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...spawn.options });
      const usage = extractUsage(result.stdout ?? '');
      // La tarea puede ser confidencial: por defecto se guarda solo su huella; --log-task guarda el texto.
      const task = options.task ?? null;
      const entry = {
        run_id: `run-${began.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        ts: new Date(began).toISOString(), agent: options.agent,
        task: options['log-task'] ? task : null,
        task_sha256: task === null ? null : createHash('sha256').update(task).digest('hex').slice(0, 16),
        host_cmd: options.command[0], exit: result.status, status: result.status === 0 ? 'PASS' : 'FAIL',
        duration_ms: Date.now() - began, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
        cache_read_tokens: usage.cache_read_tokens, cost_usd: usage.cost_usd,
      };
      await recordRun(ledger, entry);
      out(`${usage.result ?? result.stdout ?? ''}${(usage.result ?? result.stdout ?? '').endsWith('\n') ? '' : '\n'}`);
      if (result.status !== 0 && (result.stderr || result.error)) {
        err(`${summarizeFailure(`${result.stderr ?? ''}\n${result.error?.message ?? ''}`).join('\n')}\n`);
      }
      err(`[eos run] ${entry.run_id} ${entry.agent} ${entry.status} ${(entry.duration_ms / 1000).toFixed(1)}s`
        + ` tokens ${entry.input_tokens ?? 'n/d'}→${entry.output_tokens ?? 'n/d'} costo ${entry.cost_usd ?? 'n/d'}\n`);
      return result.status === 0 ? 0 : 1;
    }
    if (command === 'runs') {
      out(summarizeRuns(await readFile(ledger, 'utf8').catch(() => '')));
      return 0;
    }
    if (command === 'eval-context') {
      const spec = JSON.parse(await readFile(path.resolve(cwd, options.cases ?? path.join(root, 'evals/context/cases.json')), 'utf8'));
      const { sections } = await loadCorpus(root);
      // Formato por conjuntos {sets, thresholds: {set: {...}}}; un archivo antiguo {cases, thresholds} es "dev".
      const sets = spec.sets ?? { dev: spec.cases };
      const thresholds = spec.sets ? (spec.thresholds ?? {}) : { dev: spec.thresholds ?? {} };
      const lines = [];
      const failures = [];
      for (const [name, cases] of Object.entries(sets)) {
        const report = evaluateContext(sections, cases);
        if (!options.json) {
          lines.push(`== ${name}`, ...report.results.map(item =>
            `${item.recall10 === 1 ? 'OK  ' : item.recall10 > 0 ? 'PARC' : 'FALLO'} ${item.id}: R@5 ${item.recall5.toFixed(2)} R@10 ${item.recall10.toFixed(2)} RR ${item.rr.toFixed(2)} posiciones [${item.hits.join(', ')}]`));
        }
        const min = thresholds[name] ?? {};
        const below = ['recall_at_10', 'mrr'].filter(key => min[key] !== undefined && report[key] < min[key]);
        failures.push(...below.map(key => `${name}.${key}`));
        lines.push(`${name}: Recall@5 ${report.recall_at_5.toFixed(3)} | Recall@10 ${report.recall_at_10.toFixed(3)} | MRR ${report.mrr.toFixed(3)} | casos ${report.results.length}${Object.keys(min).length ? '' : ' | sin umbral'}`);
      }
      lines.push(failures.length ? `FAIL: bajo umbral en ${failures.join(', ')}` : 'PASS: umbrales cumplidos');
      out(`${lines.join('\n')}\n`);
      return failures.length ? 1 : 0;
    }
    const configPath = path.resolve(cwd, options.config ?? 'eos.gate.json');
    let raw;
    let config;
    try { raw = await readFile(configPath); config = JSON.parse(raw.toString('utf8')); }
    catch { err(`Sin configuración de gate válida: ${configPath}\nCrea eos.gate.json con {"commands":[{"name":"tests","run":"npm test"}]}\n`); return 1; }
    const commands = Array.isArray(config?.commands)
      ? config.commands.filter(item => typeof item?.name === 'string' && typeof item?.run === 'string' && item.run) : [];
    if (!commands.length) { err(`eos.gate.json sin comandos válidos: ${configPath}\n`); return 1; }
    const hash = createHash('sha256').update(raw).digest('hex');
    const revision = revisionFingerprint(path.dirname(configPath));
    const trust = await trustStatus(store, configPath, hash, revision);
    if (options.plan) { out(renderPlan(configPath, hash, trust, commands, revision)); return 0; }
    if (options.trust || options['trust-commands']) {
      const risky = commands.filter(item => riskyReason(item.run));
      if (risky.length) {
        err(`${renderPlan(configPath, hash, trust, commands, revision)}No se confía un gate con comandos de riesgo (${risky.map(item => item.name).join(', ')}). Ejecútalos manualmente o retíralos del gate.\n`);
        return 1;
      }
      const scope = options['trust-commands'] ? 'commands' : 'revision';
      await trustGate(store, configPath, hash, commands, scope, revision);
      out(`${renderPlan(configPath, hash, { status: 'TRUSTED', scope }, commands, revision)}Confianza registrada en ${store}. No se ejecutó ningún comando.\n`);
      return 0;
    }
    if (trust.status !== 'TRUSTED') {
      const reason = {
        CHANGED: 'el gate cambió desde que se confió',
        REVISION_CHANGED: 'el repositorio cambió desde que se confió (código, scripts o manifiestos que el gate ejecuta)',
        UNTRUSTED: 'el gate no ha sido revisado',
      }[trust.status];
      const plan = renderPlan(configPath, hash, trust, commands, revision);
      if (options.json) {
        out(`\`\`\`eos-result\n${JSON.stringify({
          agent: 'eos-gate', status: 'BLOCKED', summary: `Gate bloqueado: ${reason}`, files: [],
          checks: commands.map(item => ({ cmd: item.run, result: 'NOT_RUN', note: trust.status })),
          findings: [], next: [],
          approval_needed: [`Revisar ${configPath} y los cambios del repositorio; luego: node <eos.mjs> gate --trust`],
        }, null, 2)}\n\`\`\`\n`);
      } else out(`${plan}BLOCKED: ${reason}. Revisa comandos y cambios y, si son correctos, ejecuta \`gate --trust\` (no ejecuta nada).\n`);
      return 2;
    }
    const results = runGate(commands, path.dirname(configPath), Number(config.timeout_ms ?? 600000));
    await emit(renderGate(results, options.json));
    return results.some(item => item.result === 'FAIL') ? 1 : 0;
  } catch (error) {
    err(`ERROR: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Un agente puede recortar la salida con `| head`; cerrar la tubería no es un error del comando.
  process.stdout.on('error', error => { if (error.code !== 'EPIPE') throw error; });
  process.exitCode = await main(process.argv.slice(2));
}

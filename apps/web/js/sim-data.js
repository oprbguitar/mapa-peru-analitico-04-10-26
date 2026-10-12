// Panel lateral del laboratorio: solo cuando se piden las cifras (tablas A/B, supuestos, ajustes finos, historial).
// La experiencia principal ocurre en el mapa (simulation.js); aquí está el detalle verificable.
import { esc, fmt, getJSON, kindBadge, postJSON } from './util.js'

export const signed = (v, u) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), 1)}${u}`
const pct = (q) => `${fmt(q.p50, 1)} % <small>${fmt(q.p5, 0)}–${fmt(q.p95, 0)}</small>`
const mins = (q) => `${fmt(q.p50, 1)} min <small>${fmt(q.p5, 1)}–${fmt(q.p95, 1)}</small>`
const q1 = (q, u) => (q?.p50 == null ? '—' : `${fmt(q.p50, 1)}${u} <small>${fmt(q.p5, 1)}–${fmt(q.p95, 1)}</small>`)
const table = (rows) => `<table class="why-table"><thead><tr><th></th><th>Hoy (A)</th><th>Hipótesis (B)</th><th>B − A</th></tr></thead><tbody>
  ${rows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join('')}</tbody></table>`

function assumptions(r, tail) {
  return `<details class="why section-gap"><summary>Supuestos y validez</summary><div class="why-body">
    <ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    <p class="src-meta">Validez: ${esc(r.validity)} · ${tail}</p>
    <p class="src-meta">Fuentes: ${r.provenance.map((p) => esc(`${p.name} (${p.institution})`)).join(' · ')}.</p></div></details>`
}

const runLine = (r, extra) => `<p class="src-meta">Ejecución <code>${esc(r.run_id)}</code> · semilla ${r.params.seed} · ${esc(r.params.engine_version)} ·
  ${extra} · ${r.reused ? 'recuperada del registro' : `${fmt(r.elapsed_s, 2)} s`}</p>
  <div class="tool-row"><button class="btn" type="button" data-report="run" data-run-id="${esc(r.run_id)}">Informe imprimible</button></div>`

function accessHtml(r) {
  const { A, B, diff } = r.results
  return `${table([['Tiempo mediano', mins(A.median_min), mins(B.median_min), signed(diff.median_min, ' min')],
    ...['15', '30', '45'].map((t) => [`Área ≤ ${t} min`, pct(A.coverage_pct[t]), pct(B.coverage_pct[t]), signed(diff.coverage_pct[t], ' pp')])])}
    <p class="src-meta">Mediana y rango del 90 % entre ${fmt(r.sample.iterations, 0)} repeticiones. Cambio en área ≤ 30 min:
      ${fmt(diff.coverage_30_interval[0], 1)} a ${fmt(diff.coverage_30_interval[1], 1)} pp (A y B usan el mismo azar).</p>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    ${assumptions(r, `error estándar ${fmt(r.results.A.convergence.standard_error_pct, 2)} pp · ${fmt(r.sample.points, 0)} puntos cada
      ${fmt(r.sample.spacing_km, 2)} km · ${fmt(r.sample.facilities, 0)} sedes.`)}
    ${runLine(r, `${fmt(r.sample.iterations, 0)} repeticiones`)}`
}

function capacityHtml(r, within) {
  const { A, B, diff } = r.results
  const d = (v, u) => (v == null ? '—' : signed(v, u))
  const bA = Object.fromEntries(A.sites.map((x) => [x.id, x]))
  const top = [...B.sites].sort((x, y) => (y.utilization_pct ?? -1) - (x.utilization_pct ?? -1)).slice(0, 8)
  const bott = (s) => (s.bottlenecks.length ? s.bottlenecks.slice(0, 4).map((x) => `${esc(x.name)} (${fmt(x.utilization_pct, 0)} %)`).join(', ') : 'ninguna')
  const util = (u, none) => (u == null ? none : `${fmt(u, 0)} %`)
  return `${table([['Espera p50', q1(A.wait_p50_min, ' min'), q1(B.wait_p50_min, ' min'), d(diff.wait_p50_min, ' min')],
    ['Espera p90', q1(A.wait_p90_min, ' min'), q1(B.wait_p90_min, ' min'), d(diff.wait_p90_min, ' min')],
    ['Respuesta p50', q1(A.response_p50_min, ' min'), q1(B.response_p50_min, ' min'), d(diff.response_p50_min, ' min')],
    [`Atendidas ≤ ${within} min`, q1(A.within_30_pct, ' %'), q1(B.within_30_pct, ' %'), d(diff.within_30_pct, ' pp')],
    ['Llamadas por réplica', q1(A.calls, ''), q1(B.calls, ''), ''], ['Sin asignar al cortar', q1(A.unassigned, ''), q1(B.unassigned, ''), '']])}
    <p class="src-meta">Mediana y percentiles 5–95 entre ${fmt(r.sample.replications, 0)} réplicas de ${fmt(r.sample.horizon_h, 0)} h.
      Espera = cola antes de asignar unidad; respuesta = espera + traslado.</p>
    <dl class="kv sim-bott section-gap"><dt>Cuellos de botella hoy</dt><dd>${bott(A)}</dd><dt>Con la hipótesis</dt><dd>${bott(B)}</dd></dl>
    <table class="why-table sim-sites"><caption>Utilización mediana por sede (las ${top.length} más cargadas con la hipótesis).</caption>
      <thead><tr><th>Sede</th><th>Unid.</th><th>A</th><th>B</th><th>Deriv. B</th></tr></thead><tbody>
      ${top.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.capacity}</td><td>${util(bA[x.id]?.utilization_pct, '—')}</td>
        <td>${util(x.utilization_pct, 'fuera')}</td><td>${fmt(x.diverted, 1)}</td></tr>`).join('')}</tbody></table>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    ${assumptions(r, `${fmt(r.sample.sites, 0)} sedes · tasa ${fmt(r.params.queue.rate_per_h, 1)} llamadas/h · ${r.params.queue.capacity} unidad(es) por sede.`)}
    ${runLine(r, `${fmt(r.sample.replications, 0)} réplicas`)}`
}

function opsHtml(r) {
  const R = r.results
  const u = [...r.units].sort((a, b) => b.utilization_pct - a.utilization_pct)
  return `${table([['A tiempo (≤ ' + r.params.ops.target_min + ' min)', q1(R.within_target_pct, ' %'), '', ''],
      ['Respuesta p50', q1(R.response_p50_min, ' min'), '', ''], ['Respuesta p90', q1(R.response_p90_min, ' min'), '', ''],
      ['Llamadas', q1(R.calls, ''), '', ''], ['Sin atender al cierre', q1(R.unattended, ''), '', ''],
      ['Trayectos que cruzan tramos cortados', q1(R.crossing_tramos_pct, ' %'), '', '']]).replace('<th>Hoy (A)</th><th>Hipótesis (B)</th><th>B − A</th>', '<th>Mediana y rango 90 %</th><th></th><th></th>')}
    <table class="why-table sim-sites"><caption>Ocupación por unidad (mediana entre ${r.sample.replications} réplicas).</caption>
      <thead><tr><th>Unidad</th><th>Tipo</th><th>Ocupada</th><th>Llamadas</th></tr></thead><tbody>
      ${u.map((x) => `<tr><td>${esc(x.id)}</td><td>${esc(x.label)}</td><td>${fmt(x.utilization_pct, 0)} %</td><td>${fmt(x.served_p50, 0)}</td></tr>`).join('')}</tbody></table>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    ${assumptions(r, `${r.sample.units} unidades · ${r.sample.tramos} tramo(s) cortado(s) · ${r.sample.replications} réplicas.`)}
    ${runLine(r, `${fmt(r.sample.replications, 0)} réplicas`)}`
}

async function jevCompareHtml(ops) {
  const ids = ops.filter((s) => s.run_id).map((s) => s.id)
  if (ids.length < 2) return ''
  try {
    const c = await postJSON('/api/v1/jev/compare', { scenario_ids: ids })
    const name = Object.fromEntries(c.rows.map((r) => [r.run_id, r.label]))
    return `<p class="note"><b>JEV:</b> ${esc(c.note)}${c.ties.length ? ` Empate técnico con el primero: ${c.ties.map((t) => esc(name[t] || t)).join(', ')}.` : ''}</p>`
  } catch { return '' }
}

export async function scenariosHtml() {
  const { scenarios } = await getJSON('/api/v1/sim/scenarios')
  const ops = scenarios.filter((s) => s.engine === 'operations')
  if (!ops.length) return '<p class="src-meta">Aún no hay escenarios guardados. Usa «Guardar» y luego «Duplicar» para crear B, C…</p>'
  const m = (s, k, u) => (s.metrics?.[k] == null ? '—' : `${fmt(s.metrics[k], 0)}${u}`)
  const best = Math.max(...ops.map((s) => s.metrics?.within_target_pct ?? -1))
  const ST = { borrador: 'Borrador', configurado: 'Configurado', validado_para_simular: 'Validado', finalizado: 'Finalizado', revisado: 'Revisado', archivado: 'Archivado' }
  return `<table class="why-table sim-cmp"><thead><tr><th>Escenario</th><th>Estado</th><th>A tiempo</th><th>Resp. p50</th><th>Sin atender</th><th>Unid.</th><th>Tramos</th><th></th></tr></thead><tbody>
    ${ops.map((s) => `<tr ${s.metrics?.within_target_pct === best && best >= 0 ? 'data-best="true"' : ''}><td>${esc(s.name)}<small>v${s.version} · ${esc(s.metrics?.scenario || '')}</small></td>
      <td><i class="scn-state" data-state="${esc(s.state || 'borrador')}">${esc(ST[s.state] || 'Borrador')}</i></td>
      <td>${m(s, 'within_target_pct', ' %')}</td><td>${m(s, 'response_p50_min', ' min')}</td><td>${m(s, 'unattended', '')}</td>
      <td>${m(s, 'units', '')}</td><td>${m(s, 'tramos', '')}</td>
      <td><button class="btn btn-ghost" type="button" data-load-scn="${esc(s.id)}">Abrir</button></td></tr>`).join('')}</tbody></table>
    <p class="src-meta">Ordenado por última edición. El mayor «a tiempo» se resalta como referencia: la decisión es tuya, con sus supuestos.
      Un escenario en borrador o sin revisar no es una recomendación validada.</p>
    <div class="tool-row"><button class="btn" type="button" data-report="compare" data-ids="${esc(ops.map((s) => s.id).join(','))}">Informe comparativo</button></div>
    ${await jevCompareHtml(ops)}`
}

function settingsHtml(cfg, meta, engine) {
  const cap = engine === 'cap'
  const n = (id, label, value, attrs = '') => `<label class="field"><span>${label}</span><input type="number" id="${id}" value="${value}" ${attrs}></label>`
  return `<details class="why section-gap" id="sim-settings"><summary>Ajustes finos</summary><div class="why-body">
    ${n('sim-speed', 'Velocidad normal (km/h)', cfg.speed_kmh, 'min="5" max="90"')}
    ${engine === 'ops' ? `${n('ops-rate', 'Llamadas hipotéticas por hora', cfg.ops.rate_per_h, 'min="0.1" max="60" step="any"')}
      ${n('ops-horizon', 'Horizonte (h)', cfg.ops.horizon_h, 'min="1" max="24"')}
      ${n('ops-service', 'Tiempo en escena (min)', cfg.ops.service_min, 'min="1" max="240"')}
      ${n('ops-target', 'Objetivo de respuesta (min)', cfg.ops.target_min, 'min="1" max="120"')}
      ${n('ops-detour', 'Rodeo por tramo cortado cruzado (%)', cfg.ops.detour_per_tramo_pct ?? 60, 'min="0" max="300"')}
      ${n('ops-reps', 'Réplicas (más = rango más estrecho)', cfg.opsReplications, 'min="1" max="60"')}
      <p class="src-meta">Las llamadas son sintéticas y se reparten al azar en el área: no provienen de denuncias ni de personas.</p>`
    : cap ? `${n('sim-rate', 'Llamadas por hora (supuesto)', cfg.rate_per_h, `min="0.1" max="${meta.queue?.limits?.rate_per_h ?? 120}" step="any"`)}
      ${n('sim-capacity', 'Unidades o camas por sede', cfg.capacity, `min="1" max="${meta.queue?.limits?.capacity ?? 50}"`)}
      ${n('sim-svc', 'Atención media (min)', cfg.service_min, 'min="1" max="720"')}
      <label class="field"><span>Cambio de demanda: <b id="sim-demand_pct-v">${signed(cfg.demand_pct, ' %')}</b></span>
        <input type="range" id="sim-demand_pct" min="-50" max="200" step="10" value="${cfg.demand_pct}"></label>
      <p class="src-meta">La tasa de llamadas es una hipótesis tuya (Poisson): no se obtiene repartiendo cifras distritales.</p>`
      : `<label class="field"><span>Repeticiones (más = más preciso)</span><select id="sim-iter">${[200, 500, 1000, 2000].map((v) =>
        `<option ${cfg.iterations === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`}
    ${n('sim-seed', 'Semilla', cfg.seed, 'min="0"')}
  </div></details>`
}

const ACTION_LABEL = { mas_iteraciones: 'Más iteraciones', mas_datos: 'Más datos', otro_modelo: 'Otro modelo', revision_humana: 'Revisión humana' }

function jevSection(j) {
  if (!j) return ''
  return `<details class="why section-gap" open><summary>Evaluación JEV · ${esc(j.decision_label)}</summary><div class="why-body">
    <p class="src-meta"><b>Puntuación interna ${j.score ?? '—'}</b> (es la métrica principal: ${esc(j.subject)}; <b>no es una probabilidad</b>) ·
      incertidumbre ${esc(j.uncertainty.level)}${j.uncertainty.precision != null ? ` (±${fmt(j.uncertainty.precision, 1)} puntos en la mediana)` : ''} ·
      variabilidad ${esc(j.variability?.level || '—')} ·
      datos: ${esc(j.data_quality.level)} · motor ${esc(j.engine)}</p>
    <ol class="jev-facts">${j.facts.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ol>
    ${j.actions.length ? `<ul class="jev-actions">${j.actions.map((a) => `<li><b>${esc(ACTION_LABEL[a.action] || a.action)}</b> ${esc(a.detail || '')}
      <small>(hechos ${a.why.join(', ')})</small></li>`).join('')}</ul>` : '<p class="src-meta">Sin observaciones: apto para explorar, no para decidir solo con esto.</p>'}
    ${j.fallback ? `<p class="note">${esc(j.fallback)}</p>` : ''}</div></details>`
}

export function dataHtml({ last, cfg, meta, engine, scenario, jev, scenarioId }) {
  const head = `<div class="panel-head"><div class="eyebrow">Laboratorio · cifras de la simulación</div>
    <h2>${engine === 'ops' ? 'Operativo simulado' : engine === 'cap' ? 'Capacidad de las sedes' : 'Tiempo de llegada'}</h2>
    <p class="sub">Hoy frente a «${esc(scenario)}». Todo es ${kindBadge('estimacion')} exploratoria con supuestos editables.</p></div>`
  const body = !last ? '<p class="src-meta">Aún no hay resultado: elige una zona en el mapa.</p>'
    : last.params.engine === 'operations' ? opsHtml(last)
      : last.params.engine === 'queue' ? capacityHtml(last, meta.queue?.within_min ?? 30) : accessHtml(last)
  return `${head}${jevSection(jev)}${body}${settingsHtml(cfg, meta, engine)}
    ${engine === 'ops' ? `<details class="why" id="sim-lifecycle"><summary>Estado y archivo del escenario</summary><div class="why-body" id="sim-life">
      ${scenarioId ? '<p class="loading">Leyendo</p>' : '<p class="src-meta">Guarda el escenario para gestionar su estado o exportarlo.</p>'}
      <div class="tool-row"><label class="btn btn-ghost import-btn">Importar escenario…<input type="file" id="scn-import" accept="application/json,.json" hidden></label></div></div></details>` : ''}
    ${engine === 'ops' && scenarioId ? '<details class="why" id="sim-timeline"><summary>Desarrollo del escenario (versiones)</summary><div class="why-body" id="sim-tl"></div></details>' : ''}
    ${engine === 'ops' ? '<details class="why" id="sim-compare"><summary>Comparar escenarios A / B / C</summary><div class="why-body" id="sim-cmp"></div></details>' : ''}
    <details class="why" id="sim-history"><summary>Simulaciones anteriores</summary><div class="why-body" id="sim-runs"></div></details>
    <details class="why"><summary>Motores del plan maestro</summary><div class="why-body"><dl class="kv">
      ${meta.engines.map((e) => `<dt>${e.id} · ${esc(e.name)}</dt><dd>${e.status !== 'disponible' ? 'planificado'
        : e.requires === 'simpy' && !meta.queue?.available ? 'requiere SimPy' : 'disponible'}</dd>`).join('')}</dl></div></details>`
}

export async function runsHtml(services) {
  const { runs } = await getJSON('/api/v1/sim/runs?limit=10')
  const ok = runs.filter((r) => r.state === 'finalizado')
  if (!ok.length) return '<p class="src-meta">Aún no hay simulaciones guardadas.</p>'
  const gist = (r) => (!r.diff ? '' : r.engine === 'queue'
    ? (r.diff.within_30_pct == null ? 'sin llamadas atendidas' : `${signed(r.diff.within_30_pct, ' pp')} atendidas ≤ 30 min`)
    : `${signed(r.diff.coverage_pct['15'], ' pp')} de área ≤ 15 min`)
  return `<ul class="sim-runs">${ok.map((r) => `<li><button class="btn btn-ghost" type="button" data-run="${esc(r.run_id)}">
    ${r.engine === 'queue' ? 'Capacidad' : 'Llegada'} · ${esc(services[r.service] || r.service)} · ${fmt(r.area?.radius_km, 1)} km
    <small>${esc((r.created_at || '').replace('T', ' ').slice(0, 16))} UTC · ${gist(r)}</small></button></li>`).join('')}</ul>`
}

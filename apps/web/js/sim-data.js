// Panel lateral del laboratorio: solo cuando se piden las cifras (tablas A/B, supuestos, ajustes finos, historial).
// La experiencia principal ocurre en el mapa (simulation.js); aquí está el detalle verificable.
import { esc, fmt, getJSON, kindBadge } from './util.js'

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
  ${extra} · ${r.reused ? 'recuperada del registro' : `${fmt(r.elapsed_s, 2)} s`}</p>`

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

function settingsHtml(cfg, meta, engine) {
  const cap = engine === 'cap'
  const n = (id, label, value, attrs = '') => `<label class="field"><span>${label}</span><input type="number" id="${id}" value="${value}" ${attrs}></label>`
  return `<details class="why section-gap" id="sim-settings"><summary>Ajustes finos</summary><div class="why-body">
    ${n('sim-speed', 'Velocidad normal (km/h)', cfg.speed_kmh, 'min="5" max="90"')}
    ${cap ? `${n('sim-rate', 'Llamadas por hora (supuesto)', cfg.rate_per_h, `min="0.1" max="${meta.queue?.limits?.rate_per_h ?? 120}" step="any"`)}
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

export function dataHtml({ last, cfg, meta, engine, scenario }) {
  const head = `<div class="panel-head"><div class="eyebrow">Laboratorio · cifras de la simulación</div>
    <h2>${engine === 'cap' ? 'Capacidad de las sedes' : 'Tiempo de llegada'}</h2>
    <p class="sub">Hoy frente a «${esc(scenario)}». Todo es ${kindBadge('estimacion')} exploratoria con supuestos editables.</p></div>`
  const body = !last ? '<p class="src-meta">Aún no hay resultado: elige una zona en el mapa.</p>'
    : last.params.engine === 'queue' ? capacityHtml(last, meta.queue?.within_min ?? 30) : accessHtml(last)
  return `${head}${body}${settingsHtml(cfg, meta, engine)}
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

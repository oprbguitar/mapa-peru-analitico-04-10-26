// Laboratorio de simulación (solo local), escenario A (base) frente a B (hipótesis), en dos pestañas:
// «Accesibilidad» (S1+S2+S9, Monte Carlo) y «Capacidad» (S3, eventos discretos con SimPy: colas y sedes saturadas).
// El cálculo y su registro ocurren en el servidor local; aquí solo se configuran supuestos y se dibuja el resultado.
import { ensureLineLayer, ensurePointLayer, map, ptFeature, setLines, setPoints, showLayer } from './map.js'
import { esc, fmt, getJSON, kindBadge, postJSON, toast } from './util.js'

const body = () => document.getElementById('panel-body')
const BANDS = { '15': '--seq-7', '30': '--seq-5', '45': '--seq-3', mas: '--seq-1', sin: '--danger' }
const DELTA = { mejor: '--ok', igual: '--ink-muted', peor: '--danger', sin: '--warn' }
const BAND_LABEL = { '15': '≤ 15 min', '30': '≤ 30', '45': '≤ 45', mas: '> 45', sin: 'sin servicio' }
const DELTA_LABEL = { mejor: 'mejora', igual: 'igual (±1 min)', peor: 'empeora', sin: 'pierde servicio' }
const UTIL = { baja: '--ok', media: '--warn', alta: '--danger', cerrada: '--ink-muted' }
const UTIL_LABEL = { baja: 'utilización < 50 %', media: '50–80 %', alta: '≥ 80 % (cuello de botella)', cerrada: 'fuera de operación' }
const TABS = { acc: 'Accesibilidad', cap: 'Capacidad' }
let meta = null
let picking = false
let tab = 'acc'
const lastBy = { acc: null, cap: null }
let view = 'b'
let bound = false
const cfg = { area: null, radius_km: 10, service: 'hospital', rain: 'moderada', congestion_pct: 20, out_of_service_pct: 10,
  detour_pct: 0, demand_pct: 50, iterations: 500, seed: 2026, closed: new Set(),
  rate_per_h: 6, capacity: 2, service_min: 45, horizon_h: 24, replications: 30 }
const current = () => lastBy[tab]

export const isSimPicking = () => picking

export function simPick(lngLat) {
  if (!picking) return false
  setCenter(lngLat)
  return true
}

function setCenter(lngLat) {
  picking = false
  document.body.classList.remove('picking')
  cfg.area = { lat: +lngLat.lat.toFixed(5), lon: +lngLat.lng.toFixed(5) }
  cfg.closed.clear()
  drawArea()
  renderSimulation()
}

export function hideSimulation() {
  picking = false
  document.body.classList.remove('picking')
  for (const id of ['sim-area', 'sim-pts', 'sim-fac', 'sim-cap']) showLayer(id, false)
}

function circle({ lat, lon }, km) {
  const coords = []
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI
    coords.push([lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(t), lat + (km / 111.32) * Math.sin(t)])
  }
  return coords
}

function drawArea() {
  ensureLineLayer('sim-area', { dashed: true })
  setLines('sim-area', cfg.area ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: circle(cfg.area, cfg.radius_km) }, properties: {} }] : [])
  showLayer('sim-area', !!cfg.area)
}

const band = (t) => (t == null ? 'sin' : t <= 15 ? '15' : t <= 30 ? '30' : t <= 45 ? '45' : 'mas')
const delta = (a, b) => (b == null ? 'sin' : a == null ? 'mejor' : b - a > 1 ? 'peor' : a - b > 1 ? 'mejor' : 'igual')

const utilBand = (u) => (u == null ? 'cerrada' : u >= 80 ? 'alta' : u >= 50 ? 'media' : 'baja')

function drawResult() {
  for (const id of ['sim-pts', 'sim-fac', 'sim-cap']) showLayer(id, false)
  const last = current()
  if (!last) return
  if (tab === 'cap') return drawCapacity(last)
  ensurePointLayer('sim-pts', { colorBy: 'k', colors: view === 'd' ? DELTA : BANDS, radius: 4 })
  if (map.getLayer('sim-pts')) map.setPaintProperty('sim-pts', 'circle-color', ['match', ['get', 'k'],
    ...Object.entries(view === 'd' ? DELTA : BANDS).flatMap(([k, v]) => [k, getComputedStyle(document.documentElement).getPropertyValue(v).trim()]), '#888'])
  setPoints('sim-pts', last.points.map((p) => ptFeature(p.lon, p.lat, { k: view === 'd' ? delta(p.a, p.b) : band(p[view]) })))
  ensurePointLayer('sim-fac', { colorBy: 'st', colors: { activo: '--ink', cerrado: '--danger' }, radius: 5,
    onClick: (f) => toggleClosed(f.properties.id) })
  setPoints('sim-fac', last.facilities.map((f) => ptFeature(f.lon, f.lat, { id: f.id, st: cfg.closed.has(f.id) ? 'cerrado' : 'activo' })))
}

function drawCapacity(r) {
  const sites = Object.fromEntries(r.results[view === 'a' ? 'A' : 'B'].sites.map((x) => [x.id, x]))
  ensurePointLayer('sim-cap', { colorBy: 'u', colors: UTIL, radius: 7, onClick: (f) => toggleClosed(f.properties.id) })
  setPoints('sim-cap', r.facilities.map((f) => ptFeature(f.lon, f.lat, {
    id: f.id, u: view !== 'a' && cfg.closed.has(f.id) ? 'cerrada' : utilBand(sites[f.id]?.utilization_pct) })))
}

function toggleClosed(id) {
  if (cfg.closed.has(id)) cfg.closed.delete(id)
  else cfg.closed.add(id)
  drawResult()
  const n = document.getElementById('sim-closed')
  if (n) n.textContent = cfg.closed.size ? `${cfg.closed.size} cerrado(s) en B` : 'Ninguno'
}

const pct = (q) => `${fmt(q.p50, 1)} % <small>(${fmt(q.p5, 0)}–${fmt(q.p95, 0)})</small>`
const mins = (q) => `${fmt(q.p50, 1)} min <small>(${fmt(q.p5, 1)}–${fmt(q.p95, 1)})</small>`
const signed = (v, u) => `${v > 0 ? '+' : ''}${fmt(v, 1)}${u}`

const q1 = (q, u) => (q?.p50 == null ? '—' : `${fmt(q.p50, 1)}${u} <small>(${fmt(q.p5, 1)}–${fmt(q.p95, 1)})</small>`)
const viewSeg = (opts) => `<div class="seg section-gap" role="group" aria-label="Qué colorear en el mapa">
  ${opts.map(([k, l]) => `<button type="button" data-sim-view="${k}" aria-pressed="${view === k}">${l}</button>`).join('')}</div>`
const runLine = (r, extra) => `<p class="src-meta">Ejecución <code>${esc(r.run_id)}</code> · semilla ${r.params.seed} · ${esc(r.params.engine_version)} ·
  ${extra} · ${r.reused ? 'recuperada del registro' : `${fmt(r.elapsed_s, 2)} s`}</p>`
const assumptionsHtml = (r, tail) => `<details class="why section-gap"><summary>Supuestos y validez</summary><div class="why-body">
  <ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
  <p class="src-meta">Validez: ${esc(r.validity)} · ${tail}</p>
  <p class="src-meta">Fuentes: ${r.provenance.map((p) => esc(`${p.name} (${p.institution})`)).join(' · ')}.</p></div></details>`

function capacityHtml(r) {
  const { A, B, diff } = r.results
  const d = (v, u) => (v == null ? '—' : signed(v, u))
  const within = meta.queue.within_min
  const rows = [['Espera p50', q1(A.wait_p50_min, ' min'), q1(B.wait_p50_min, ' min'), d(diff.wait_p50_min, ' min')],
    ['Espera p90', q1(A.wait_p90_min, ' min'), q1(B.wait_p90_min, ' min'), d(diff.wait_p90_min, ' min')],
    ['Respuesta p50', q1(A.response_p50_min, ' min'), q1(B.response_p50_min, ' min'), d(diff.response_p50_min, ' min')],
    [`Atendidas ≤ ${within} min`, q1(A.within_30_pct, ' %'), q1(B.within_30_pct, ' %'), d(diff.within_30_pct, ' pp')],
    ['Llamadas por réplica', q1(A.calls, ''), q1(B.calls, ''), ''],
    ['Sin asignar al cortar', q1(A.unassigned, ''), q1(B.unassigned, ''), '']]
  const h = r.params.hypothesis
  const bA = Object.fromEntries(A.sites.map((x) => [x.id, x]))
  const top = [...B.sites].sort((x, y) => (y.utilization_pct ?? -1) - (x.utilization_pct ?? -1)).slice(0, 8)
  const bott = (s) => (s.bottlenecks.length ? s.bottlenecks.slice(0, 4).map((x) => `${esc(x.name)} (${fmt(x.utilization_pct, 0)} %)`).join(', ') : 'ninguna')
  const util = (u, none) => (u == null ? none : `${fmt(u, 0)} %`)
  return `<section class="section"><h3><span>Capacidad · ${esc(meta.services[r.params.service])}</span>${kindBadge('estimacion')}</h3>
    <table class="why-table"><thead><tr><th></th><th>A · base</th><th>B · hipótesis</th><th>B − A</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join('')}</tbody></table>
    <p class="src-meta">Mediana y percentiles 5–95 entre ${fmt(r.sample.replications, 0)} réplicas de ${fmt(r.sample.horizon_h, 0)} h. Espera = cola antes de
      asignar unidad; respuesta = espera + traslado. ${diff.within_30_interval ? `Diferencia en atendidas ≤ ${within} min: ${fmt(diff.within_30_interval[0], 1)} a
      ${fmt(diff.within_30_interval[1], 1)} pp (mismos números aleatorios). ` : ''}Hipótesis B: demanda ${signed(h.demand_pct, ' %')}, lluvia ${esc(h.rain)},
      congestión ${fmt(h.congestion_pct, 0)} %, sedes fuera ${fmt(h.out_of_service_pct, 0)} %${h.closed_ids.length ? `, ${h.closed_ids.length} cerrada(s)` : ''}.</p>
    <dl class="kv sim-bott section-gap"><dt>Cuellos de botella en A</dt><dd>${bott(A)}</dd><dt>Cuellos de botella en B</dt><dd>${bott(B)}</dd></dl>
    <table class="why-table sim-sites"><caption>Utilización mediana por sede (las ${top.length} más cargadas en B). Derivadas: llamadas que su sede más
      cercana no pudo tomar.</caption><thead><tr><th>Sede</th><th>Unid.</th><th>A</th><th>B</th><th>Deriv. B</th></tr></thead><tbody>
      ${top.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.capacity}</td><td>${util(bA[x.id]?.utilization_pct, '—')}</td>
        <td>${util(x.utilization_pct, 'fuera')}</td><td>${fmt(x.diverted, 1)}</td></tr>`).join('')}</tbody></table>
    ${viewSeg([['a', 'Mapa A'], ['b', 'Mapa B']])}
    <p class="sim-key">${Object.entries(UTIL_LABEL).map(([k, l]) => `<span><i style="background:var(${UTIL[k]})"></i>${l}</span>`).join('')}</p>
    <p class="src-meta">Clic en una sede del mapa para cerrarla en B y vuelve a simular.</p>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    ${assumptionsHtml(r, `${fmt(r.sample.sites, 0)} sedes · tasa A ${fmt(r.params.queue.rate_per_h, 1)} llamadas/h · ${r.params.queue.capacity} unidad(es) por sede.`)}
    ${runLine(r, `${fmt(r.sample.replications, 0)} réplicas`)}
    <div class="ai-actions" style="padding:0"><button class="btn" type="button" id="sim-reseed">Repetir con otra semilla</button></div></section>`
}

function resultHtml(r) {
  if (r.params.engine === 'queue') return capacityHtml(r)
  const { A, B, diff } = r.results
  const rows = [['Tiempo mediano', mins(A.median_min), mins(B.median_min), signed(diff.median_min, ' min')],
    ...['15', '30', '45'].map((t) => [`Área ≤ ${t} min`, pct(A.coverage_pct[t]), pct(B.coverage_pct[t]), signed(diff.coverage_pct[t], ' pp')])]
  const h = r.params.hypothesis
  return `<section class="section"><h3><span>Resultado · ${esc(meta.services[r.params.service])}</span>${kindBadge('estimacion')}</h3>
    <table class="why-table"><thead><tr><th></th><th>A · base</th><th>B · hipótesis</th><th>B − A</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td></tr>`).join('')}</tbody></table>
    <p class="src-meta">Mediana y percentiles 5–95 entre ${fmt(r.sample.iterations, 0)} iteraciones. Diferencia en área ≤ 30 min:
      ${fmt(diff.coverage_30_interval[0], 1)} a ${fmt(diff.coverage_30_interval[1], 1)} pp (mismos números aleatorios en A y B).
      Hipótesis B: lluvia ${esc(h.rain)}, congestión ${fmt(h.congestion_pct, 0)} %, servicios fuera ${fmt(h.out_of_service_pct, 0)} %,
      rodeo extra ${fmt(h.detour_pct, 0)} %${h.closed_ids.length ? `, ${h.closed_ids.length} cerrado(s)` : ''}.</p>
    ${viewSeg([['a', 'Mapa A'], ['b', 'Mapa B'], ['d', 'Cambio B − A']])}
    <p class="sim-key">${Object.entries(view === 'd' ? DELTA_LABEL : BAND_LABEL).map(([k, l]) =>
      `<span><i style="background:var(${(view === 'd' ? DELTA : BANDS)[k]})"></i>${l}</span>`).join('')}</p>
    <p class="src-meta">Clic en un servicio del mapa (punto con borde) para cerrarlo en B y vuelve a simular.</p>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    ${assumptionsHtml(r, `convergencia: error estándar ${fmt(r.results.A.convergence.standard_error_pct, 2)} pp ·
      ${fmt(r.sample.points, 0)} puntos cada ${fmt(r.sample.spacing_km, 2)} km · ${fmt(r.sample.facilities, 0)} servicios.`)}
    ${runLine(r, `${fmt(r.sample.iterations, 0)} iteraciones`)}
    <div class="ai-actions" style="padding:0"><button class="btn" type="button" id="sim-reseed">Repetir con otra semilla</button></div></section>`
}

function formHtml() {
  const a = cfg.area
  const cap = tab === 'cap'
  const ready = !cap || meta.queue?.available
  return `<div class="panel-head"><div class="eyebrow">Laboratorio · ${cap ? 'S3 · eventos discretos' : 'S1 + S2 + S9'} · solo local</div>
    <h2>${cap ? 'Capacidad de las sedes' : 'Accesibilidad a servicios'}</h2>
    <p class="sub">${cap ? 'Llamadas que llegan a una tasa supuesta, se asignan a la sede libre más cercana y ocupan una unidad: espera, saturación y atendidas a tiempo.'
      : 'Compara la situación base con una hipótesis (lluvia, congestión, cortes, servicios fuera) en un área de estudio.'}</p>
    <div class="sim-tabs" role="tablist" aria-label="Motor de simulación">${Object.entries(TABS).map(([k, l]) =>
      `<button type="button" role="tab" id="sim-tab-${k}" data-sim-tab="${k}" aria-selected="${tab === k}" aria-controls="sim-form" tabindex="${tab === k ? 0 : -1}">${l}</button>`).join('')}</div></div>
    ${ready ? '' : `<p class="note">Falta SimPy, la dependencia opcional de este motor. Instálala con <code>pip install -r requirements-simulation.txt</code>
      y reinicia el servidor local; la pestaña Accesibilidad funciona sin ella.</p>`}
    <form class="settings" id="sim-form" role="tabpanel" aria-labelledby="sim-tab-${tab}" autocomplete="off">
      <fieldset><legend>Área de estudio</legend>
        <p class="src-meta">${a ? `Centro ${fmt(a.lat, 4)}, ${fmt(a.lon, 4)}` : 'Sin centro: marca un punto en el mapa o usa el centro de la vista.'}</p>
        <div class="tool-row"><button class="btn" type="button" id="sim-pick">Marcar en el mapa</button><button class="btn" type="button" id="sim-center">Centro de la vista</button></div>
        <div class="seg" role="group" aria-label="Radio">${meta.limits.radius_km.map((r) => `<button type="button" data-sim-radius="${r}" aria-pressed="${cfg.radius_km === r}">${r} km</button>`).join('')}</div>
        <label class="field"><span>Servicio</span><select id="sim-service">${Object.entries(meta.services).map(([k, l]) => `<option value="${k}" ${cfg.service === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      </fieldset>
      <fieldset><legend>Hipótesis B</legend>
        <label class="field"><span>Lluvia</span><select id="sim-rain">${meta.rain.map((r) => `<option ${cfg.rain === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
        ${[...(cap ? [['demand_pct', 'Cambio de demanda', -50, 200, 10]] : []), ['congestion_pct', 'Congestión (menos velocidad)', 0, 80, 5],
          ['out_of_service_pct', 'Servicios fuera de operación', 0, 90, 5], ['detour_pct', 'Rodeo extra por cortes de vía', 0, 100, 5]].map(([k, l, min, max, step]) =>
          `<label class="field"><span>${l}: <b id="sim-${k}-v">${cfg[k]} %</b></span><input type="range" id="sim-${k}" min="${min}" max="${max}" step="${step}" value="${cfg[k]}"></label>`).join('')}
        <p class="src-meta">Servicios cerrados a mano: <span id="sim-closed">${cfg.closed.size ? `${cfg.closed.size} cerrado(s) en B` : 'Ninguno'}</span></p>
      </fieldset>
      ${cap ? `<fieldset><legend>Demanda y capacidad (supuestos)</legend>
        <label class="field"><span>Llamadas por hora en A</span><input type="number" id="sim-rate" min="0.1" max="${meta.queue.limits.rate_per_h}" step="any" value="${cfg.rate_per_h}"></label>
        <label class="field"><span>Unidades o camas por sede</span><input type="number" id="sim-capacity" min="1" max="${meta.queue.limits.capacity}" value="${cfg.capacity}"></label>
        <label class="field"><span>Atención media (min)</span><input type="number" id="sim-svc" min="1" max="720" value="${cfg.service_min}"></label>
        <p class="src-meta">La tasa es una hipótesis tuya (Poisson): no se obtiene repartiendo cifras distritales.</p>
      </fieldset>` : ''}
      <details class="why"><summary>Supuestos de base y ejecución</summary><div class="why-body">
        <label class="field"><span>Velocidad base (km/h)</span><input type="number" id="sim-speed" min="5" max="90" value="${meta.defaults.speed_kmh}"></label>
        ${cap ? `<label class="field"><span>Horizonte (h)</span><select id="sim-horizon">${[8, 12, 24, 48, 72].map((n) => `<option ${cfg.horizon_h === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Réplicas</span><select id="sim-reps">${[10, 30, 60, 100].map((n) => `<option ${cfg.replications === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
        : `<label class="field"><span>Iteraciones</span><select id="sim-iter">${[200, 500, 1000, 2000].map((n) => `<option ${cfg.iterations === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
        <label class="field"><span>Semilla</span><input type="number" id="sim-seed" min="0" value="${cfg.seed}"></label>
      </div></details>
      <div class="ai-actions" style="padding:0"><button class="btn btn-primary" type="submit" ${a && ready ? '' : 'disabled'}>Simular A y B</button></div>
    </form><div id="sim-out">${current() ? resultHtml(current()) : ''}</div>
    <details class="why section-gap" id="sim-history"><summary>Ejecuciones registradas</summary><div class="why-body" id="sim-runs"></div></details>
    <details class="why"><summary>Motores del plan maestro</summary><div class="why-body"><dl class="kv">
      ${meta.engines.map((e) => `<dt>${e.id} · ${esc(e.name)}</dt><dd>${e.status !== 'disponible' ? 'planificado'
        : e.requires === 'simpy' && !meta.queue?.available ? 'requiere SimPy' : 'disponible'}</dd>`).join('')}</dl></div></details>`
}

async function submit() {
  const out = document.getElementById('sim-out')
  out.innerHTML = '<p class="loading">Simulando</p>'
  const btn = document.querySelector('#sim-form [type="submit"]')
  btn.disabled = true
  const common = { area: { ...cfg.area, radius_km: cfg.radius_km }, service: cfg.service, seed: cfg.seed,
    base: { speed_kmh: Number(document.getElementById('sim-speed').value) },
    hypothesis: { rain: cfg.rain, congestion_pct: cfg.congestion_pct, out_of_service_pct: cfg.out_of_service_pct,
      detour_pct: cfg.detour_pct, closed_ids: [...cfg.closed] } }
  try {
    const r = tab === 'cap'
      ? await postJSON('/api/v1/sim/queue/run', { ...common, replications: cfg.replications,
        hypothesis: { ...common.hypothesis, demand_pct: cfg.demand_pct },
        queue: { rate_per_h: cfg.rate_per_h, capacity: cfg.capacity, service_min: cfg.service_min, horizon_h: cfg.horizon_h } })
      : await postJSON('/api/v1/sim/accessibility/run', { ...common, iterations: cfg.iterations })
    lastBy[tab] = r
    out.innerHTML = resultHtml(r)
    drawResult()
  } catch (e) {
    out.innerHTML = `<p class="note">${esc(e.message)}</p>`
  } finally {
    btn.disabled = false
  }
}

async function loadRuns() {
  const box = document.getElementById('sim-runs')
  try {
    const { runs } = await getJSON('/api/v1/sim/runs?limit=8')
    const gist = (r) => (!r.diff ? esc(r.state) : r.engine === 'queue'
      ? (r.diff.within_30_pct == null ? 'sin llamadas atendidas' : `${signed(r.diff.within_30_pct, ' pp')} en atendidas ≤ 30 min`)
      : `${signed(r.diff.coverage_pct['30'], ' pp')} en área ≤ 30 min`)
    box.innerHTML = runs.length ? `<ul class="sim-runs">${runs.map((r) => `<li><button class="btn btn-ghost" type="button" data-run="${esc(r.run_id)}">
      ${r.engine === 'queue' ? 'Capacidad' : 'Accesibilidad'} · ${esc(meta.services[r.service] || r.service)} · ${r.area?.radius_km} km · semilla ${r.seed}
      <small>${esc(r.created_at)} · ${gist(r)}</small></button></li>`).join('')}</ul>`
      : '<p class="src-meta">Aún no hay ejecuciones.</p>'
  } catch (e) {
    box.innerHTML = `<p class="note">${esc(e.message)}</p>`
  }
}

export async function renderSimulation() {
  if (!meta) meta = await getJSON('/api/v1/sim/engines')
  if (!meta.local) {
    body().innerHTML = '<div class="panel-head"><h2>Laboratorio de simulación</h2><p class="sub">Disponible solo en la instalación local (INICIAR-MAPA.bat): el cálculo pesado no corre en el visor web.</p></div>'
    return
  }
  body().innerHTML = formHtml()
  drawArea()
  drawResult()
  const f = document.getElementById('sim-form')
  f.addEventListener('submit', (e) => { e.preventDefault(); submit() })
  document.getElementById('sim-pick').onclick = () => {
    picking = true
    document.body.classList.add('picking')
    toast('Haz clic en el mapa para fijar el centro del área de estudio.')
  }
  document.getElementById('sim-center').onclick = () => setCenter(map.getCenter())
  f.querySelectorAll('[data-sim-radius]').forEach((b) => b.addEventListener('click', () => {
    cfg.radius_km = Number(b.dataset.simRadius)
    renderSimulation()
  }))
  document.getElementById('sim-service').onchange = (e) => { cfg.service = e.target.value; cfg.closed.clear() }
  document.getElementById('sim-rain').onchange = (e) => { cfg.rain = e.target.value }
  const num = (id, key, int = false) => {
    const el = document.getElementById(id)
    if (el) el.onchange = (e) => { cfg[key] = int ? Math.round(Number(e.target.value)) : Number(e.target.value) }
  }
  num('sim-iter', 'iterations')
  num('sim-seed', 'seed', true)
  num('sim-rate', 'rate_per_h')
  num('sim-capacity', 'capacity', true)
  num('sim-svc', 'service_min')
  num('sim-horizon', 'horizon_h')
  num('sim-reps', 'replications')
  for (const k of ['demand_pct', 'congestion_pct', 'out_of_service_pct', 'detour_pct']) {
    const input = document.getElementById(`sim-${k}`)
    if (input) input.oninput = (e) => {
      cfg[k] = Number(e.target.value)
      document.getElementById(`sim-${k}-v`).textContent = `${cfg[k]} %`
    }
  }
  if (!bound) {
    body().addEventListener('click', onPanelClick)
    body().addEventListener('keydown', onPanelKey)
    bound = true
  }
  document.getElementById('sim-history').addEventListener('toggle', (e) => { if (e.target.open) loadRuns() }, { once: true })
}

function selectTab(k) {
  if (k === tab) return
  tab = k
  if (k === 'cap' && view === 'd') view = 'b'
  renderSimulation().then(() => document.getElementById(`sim-tab-${k}`)?.focus())
}

function onPanelKey(e) {
  const t = e.target.closest('[data-sim-tab]')
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const keys = Object.keys(TABS)
  const i = keys.indexOf(tab)
  selectTab(e.key === 'Home' ? keys[0] : e.key === 'End' ? keys.at(-1) : keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length])
}

function onPanelClick(e) {
  const t = e.target.closest('[data-sim-tab]')
  if (t) return selectTab(t.dataset.simTab)
  const v = e.target.closest('[data-sim-view]')
  if (v && current()) {
    view = v.dataset.simView
    document.getElementById('sim-out').innerHTML = resultHtml(current())
    drawResult()
  }
  if (e.target.closest('#sim-reseed')) {
    cfg.seed = Math.floor(Math.random() * 1e6)
    document.getElementById('sim-seed').value = cfg.seed
    submit()
  }
  const run = e.target.closest('[data-run]')
  if (run) getJSON(`/api/v1/sim/runs/${run.dataset.run}`).then((r) => {
    tab = r.params.engine === 'queue' ? 'cap' : 'acc'
    if (tab === 'cap' && view === 'd') view = 'b'
    lastBy[tab] = r
    cfg.area = { lat: r.params.area.lat, lon: r.params.area.lon }
    cfg.radius_km = r.params.area.radius_km
    cfg.closed = new Set(r.params.hypothesis.closed_ids)
    renderSimulation()
    map.fitBounds([[cfg.area.lon - cfg.radius_km / 100, cfg.area.lat - cfg.radius_km / 111], [cfg.area.lon + cfg.radius_km / 100, cfg.area.lat + cfg.radius_km / 111]], { padding: 40 })
  }).catch((err) => toast(err.message))
}

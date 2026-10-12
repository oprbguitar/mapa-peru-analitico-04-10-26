// Laboratorio de simulación (solo local) — todo ocurre SOBRE EL MAPA:
//   clic → aparece la zona (arrastra el borde para el radio, el centro para moverla) → se simula sola;
//   fichas de escenario flotantes, lluvia visible en la zona, sedes que se cierran tocándolas,
//   mosaico de tiempos con cortina «hoy ⟷ hipótesis» y un marcador con el resultado.
// El panel lateral solo aparece al pedir las cifras (sim-data.js). Cálculo, supuestos y registro: servidor local.
/* global maplibregl */
import { setPanel } from './chrome.js'
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge, postJSON, toast } from './util.js'
import { dataHtml, runsHtml, scenariosHtml, signed } from './sim-data.js'
import { setRain, stopRain } from './sim-rain.js'
import { centerSwipeOn, hideSwipe, showSwipe } from './sim-swipe.js'
import { fitZone, getZone, hideZone, initZone, setZone, showZone } from './sim-zone.js'
import { clearAll, finishTramo, hasUnits, hideOps, initOps, loadSpec, onOpsClick, onReplayClick, onReplayInput, opsKeyHtml,
  opsSpec, opsTool, replayHtml, setTool, showOps, showResult, toolbarHtml } from './sim-ops.js'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const BANDS = [[15, '--seq-7', '≤ 15 min'], [30, '--seq-5', '≤ 30'], [45, '--seq-3', '≤ 45'], [Infinity, '--seq-1', '> 45']]
const DELTA = { mejor: ['--ok', 'mejora'], igual: ['--ink-muted', 'igual'], peor: ['--danger', 'empeora'], sin: ['--warn', 'sin servicio'] }
const UTIL = { baja: ['--ok', '< 50 %'], media: ['--warn', '50–80 %'], alta: ['--danger', '≥ 80 % saturada'], cerrada: ['--ink-muted', 'cerrada'] }
const SERVICE = {
  hospital: { label: 'Hospitales', one: 'un hospital' }, salud: { label: 'Centros de salud', one: 'un centro de salud' },
  bomberos: { label: 'Bomberos', one: 'bomberos' }, comisaria: { label: 'Comisarías', one: 'una comisaría' },
}
const CALM = { rain: 'ninguna', congestion_pct: 0, out_of_service_pct: 0, detour_pct: 0, demand_pct: 0 }
// Escenarios de un toque: combinaciones HIPOTÉTICAS para explorar; ninguna está calibrada con un evento real.
const PRESETS = [
  { id: 'lluvia', icon: '☂', label: 'Lluvia intensa', hint: '40 % más lento', h: { rain: 'intensa' } },
  { id: 'punta', icon: '⧗', label: 'Hora punta', hint: 'tráfico 40 %', h: { congestion_pct: 40 } },
  { id: 'huaico', icon: '⛰', label: 'Huaico', hint: 'vías cortadas, rodeos +40 %', h: { rain: 'moderada', detour_pct: 40 } },
  { id: 'sedes', icon: '✕', label: 'Sedes cerradas', hint: '30 % sin atender', h: { out_of_service_pct: 30 } },
  { id: 'demanda', icon: '▲', label: 'Más llamadas', hint: 'demanda +100 %', h: { demand_pct: 100 }, cap: true },
  { id: 'todo', icon: '⚑', label: 'Todo junto', hint: 'lluvia, tráfico, cortes, sedes', h: { rain: 'intensa', congestion_pct: 30, out_of_service_pct: 15, detour_pct: 30, demand_pct: 50 } },
]

let meta = null
let hud = null
let score = null
let active = false
let engine = 'acc'          // acc = tiempo de llegada · cap = capacidad (S3) · ops = operativo (ejercicio de mesa)
let view = 'swipe'          // swipe (hoy ⟷ hipótesis) · delta (qué cambia)
let split = 0
let runSeq = 0
let liveTimer = 0
let layersBound = false
let lastError = ''
const lastBy = { acc: null, cap: null, ops: null }
const jevBy = { acc: null, cap: null, ops: null }   // evaluación JEV del último resultado de cada motor
let scenario = { id: null, name: 'Escenario A' }
const cfg = { service: 'hospital', preset: 'lluvia', iterations: 400, seed: 2026, speed_kmh: 30, closed: new Set(),
  rate_per_h: 6, capacity: 2, service_min: 45, horizon_h: 24, replications: 30,
  ops: { rate_per_h: 2, horizon_h: 8, service_min: 25, target_min: 15 }, opsReplications: 20, ...CALM, ...PRESETS[0].h }

const last = () => lastBy[engine]
const presetById = (id) => PRESETS.find((p) => p.id === id)
const scenarioName = () => (cfg.preset === 'propio' ? 'tu escenario' : presetById(cfg.preset)?.label || 'la hipótesis')

// ── capas del resultado ─────────────────────────────────────────────────────
const LAYERS = ['sim-cells-a', 'sim-cells-b', 'sim-cells-d', 'sim-sites']
const fc = (features) => ({ type: 'FeatureCollection', features })

function bandColor(prop) {
  // minutos por tramos; sin servicio → rojo
  return ['case', ['==', ['get', prop], null], cssVar('--danger'),
    ['step', ['get', prop], cssVar(BANDS[0][1]), 15.0001, cssVar(BANDS[1][1]), 30.0001, cssVar(BANDS[2][1]), 45.0001, cssVar(BANDS[3][1])]]
}

/** Radio de cada celda en píxeles para que el muestreo forme un mosaico continuo a cualquier zoom. */
function cellRadius(spacingKm, lat) {
  const kmPerPx0 = (40075 * Math.cos(lat * Math.PI / 180)) / 512
  const r0 = (spacingKm * 0.62) / kmPerPx0
  return ['interpolate', ['exponential', 2], ['zoom'], 0, r0, 22, r0 * 2 ** 22]
}

function ensureLayers() {
  if (!map.getSource('sim-cells')) {
    map.addSource('sim-cells', { type: 'geojson', data: fc([]) })
    map.addSource('sim-sites', { type: 'geojson', data: fc([]) })
  }
  const before = map.getLayer('sim-zone-line') ? 'sim-zone-line' : undefined
  for (const id of ['sim-cells-a', 'sim-cells-b', 'sim-cells-d']) {
    if (!map.getLayer(id)) map.addLayer({ id, type: 'circle', source: 'sim-cells', layout: { visibility: 'none' },
      paint: { 'circle-opacity': 0.62, 'circle-blur': 0.35, 'circle-color': cssVar('--ink-muted') } }, before)
  }
  if (!map.getLayer('sim-sites')) map.addLayer({ id: 'sim-sites', type: 'circle', source: 'sim-sites', layout: { visibility: 'none' },
    paint: { 'circle-radius': ['coalesce', ['get', 'size'], 6], 'circle-color': ['coalesce', ['get', 'color'], cssVar('--ink')],
      'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--void'),
      // las sedes fuera de la zona cuentan (pueden ser las más cercanas) pero se atenúan para no saturar
      'circle-opacity': ['case', ['get', 'inside'], 1, 0.35], 'circle-stroke-opacity': ['case', ['get', 'inside'], 1, 0.35] } })
  if (layersBound) return
  layersBound = true
  map.on('click', 'sim-sites', (e) => { if (active) toggleClosed(e.features[0].properties.id) })
  map.on('mouseenter', 'sim-sites', (e) => {
    if (!active) return
    map.getCanvas().style.cursor = 'pointer'
    const p = e.features[0].properties
    map.getCanvas().title = `${p.name}${p.util ? ` · ${p.util}` : ''} — clic para ${p.closed ? 'reabrir' : 'cerrar'}`
  })
  map.on('mouseleave', 'sim-sites', () => { if (!active) return; map.getCanvas().style.cursor = 'crosshair'; map.getCanvas().title = '' })
}

function vis(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none') }

function drawResult() {
  ensureLayers()
  const r = last()
  for (const id of LAYERS) vis(id, false)
  hideSwipe()
  if (engine === 'ops') return showOps()
  if (!r) return
  if (r.params.engine === 'queue') return drawCapacity(r)
  const radius = cellRadius(r.sample.spacing_km, r.params.area.lat)
  map.getSource('sim-cells').setData(fc(r.points.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { a: p.a, b: p.b, lon: p.lon, d: p.b == null ? 'sin' : p.a == null ? 'mejor' : p.b - p.a > 1 ? 'peor' : p.a - p.b > 1 ? 'mejor' : 'igual' } }))))
  for (const id of ['sim-cells-a', 'sim-cells-b', 'sim-cells-d']) map.setPaintProperty(id, 'circle-radius', radius)
  map.setPaintProperty('sim-cells-a', 'circle-color', bandColor('a'))
  map.setPaintProperty('sim-cells-b', 'circle-color', bandColor('b'))
  map.setPaintProperty('sim-cells-d', 'circle-color', ['match', ['get', 'd'], ...Object.entries(DELTA).flatMap(([k, [v]]) => [k, cssVar(v)]), cssVar('--ink-muted')])
  if (view === 'delta') vis('sim-cells-d', true)
  else {
    vis('sim-cells-a', true)
    vis('sim-cells-b', true)
    showSwipe(scenarioName(), (lon) => { split = lon; applySplit() })
  }
  drawSites(r, (f) => ({ color: cfg.closed.has(f.id) ? cssVar('--danger') : cssVar('--ink'), size: cfg.closed.has(f.id) ? 8 : 5 }))
}

function applySplit() {
  if (!map.getLayer('sim-cells-a')) return
  map.setFilter('sim-cells-a', ['<', ['get', 'lon'], split])
  map.setFilter('sim-cells-b', ['>=', ['get', 'lon'], split])
}

function drawCapacity(r) {
  const sites = Object.fromEntries(r.results.B.sites.map((x) => [x.id, x]))
  const band = (u) => (u == null ? 'cerrada' : u >= 80 ? 'alta' : u >= 50 ? 'media' : 'baja')
  drawSites(r, (f) => {
    const u = cfg.closed.has(f.id) ? null : sites[f.id]?.utilization_pct
    return { color: cssVar(UTIL[band(u)][0]), size: u == null ? 6 : 5 + Math.min(u, 100) / 10, util: u == null ? 'cerrada' : `${fmt(u, 0)} % ocupada` }
  })
}

function drawSites(r, style) {
  map.getSource('sim-sites').setData(fc(r.facilities.map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
    properties: { id: f.id, name: f.name, closed: cfg.closed.has(f.id), inside: f.km_to_center <= r.params.area.radius_km, ...style(f) } }))))
  vis('sim-sites', true)
}

// ── marcador de resultado sobre la zona ─────────────────────────────────────
const tone = (from, to) => (to < from - 1 ? 'peor' : to > from + 1 ? 'mejor' : 'igual')

function scoreHtml() {
  const r = last()
  if (lastError) return `<p class="sim-score-k">No se pudo simular</p><p class="sim-score-s">${esc(lastError)}</p>`
  if (engine === 'ops' && !hasUnits()) return '<p class="sim-score-k">Operativo</p><p class="sim-score-s">Elige una unidad arriba y haz clic en el mapa para colocarla.</p>'
  if (!r) return '<p class="sim-score-busy">Calculando…</p>'
  if (r.params.engine === 'operations') {
    const R = r.results
    return `<p class="sim-score-k">Operativo · ${esc(scenario.name)} · ${esc(scenarioName())}</p>
      <p class="sim-score-n"><b data-tone="${(R.within_target_pct.p50 ?? 0) < 70 ? 'peor' : 'mejor'}">${R.within_target_pct.p50 == null ? '—' : `${fmt(R.within_target_pct.p50, 0)} %`}</b></p>
      <p class="sim-score-s">a tiempo (≤ ${r.params.ops.target_min} min) · respuesta típica ${R.response_p50_min.p50 == null ? '—' : `${fmt(R.response_p50_min.p50, 0)} min`}
        · ${r.saturated.length} unidad(es) saturada(s) · ${kindBadge('estimacion')}</p>`
  }
  if (r.params.engine === 'queue') {
    const A = r.results.A.within_30_pct?.p50, B = r.results.B.within_30_pct?.p50
    const sat = (s) => s.sites.filter((x) => (x.utilization_pct ?? 0) >= 80).length
    return `<p class="sim-score-k">Atendidas en ≤ 30 min · ${esc(scenarioName())}</p>
      <p class="sim-score-n"><span>${A == null ? '—' : `${fmt(A, 0)} %`}</span><i aria-hidden="true">→</i><b data-tone="${A == null || B == null ? 'igual' : tone(A, B)}"
        data-to="${B ?? ''}" data-from="${A ?? ''}">${B == null ? '—' : `${fmt(B, 0)} %`}</b></p>
      <p class="sim-score-s">Sedes saturadas ${sat(r.results.A)} → ${sat(r.results.B)} · ${kindBadge('estimacion')}</p>`
  }
  const { A, B, diff } = r.results
  const a = A.coverage_pct['15'].p50, b = B.coverage_pct['15'].p50
  return `<p class="sim-score-k">Zona a ≤ 15 min de ${esc(SERVICE[r.params.service].one)} · ${esc(scenarioName())}</p>
    <p class="sim-score-n"><span>${fmt(a, 0)} %</span><i aria-hidden="true">→</i><b data-tone="${tone(a, b)}" data-to="${b}" data-from="${a}">${fmt(b, 0)} %</b></p>
    <p class="sim-score-s">Llegada típica ${fmt(A.median_min.p50, 1)} → ${fmt(B.median_min.p50, 1)} min (${signed(diff.median_min, ' min')}) · ${kindBadge('estimacion')}</p>`
}

function placeScore(busy = false) {
  const z = getZone()
  if (!z) return score?.remove()
  if (!score) {
    const el = document.createElement('div')
    el.className = 'sim-score hud hud-frame'
    el.setAttribute('aria-live', 'polite')
    el.addEventListener('click', (e) => { if (e.target.closest('[data-jev="more"]')) { e.stopPropagation(); applyMoreIterations() } })
    score = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -12] })
  }
  const el = score.getElement()
  el.dataset.busy = String(busy)
  if (busy) lastError = ''
  if (!busy || !last()) el.innerHTML = scoreHtml() + (busy ? '' : jevHtml())
  score.setLngLat([z.lon, z.lat + z.radius_km / 111.32]).addTo(map)
  if (!busy) countUp(el)
}

function countUp(el) {
  const b = el.querySelector('[data-to]')
  if (!b || reduced() || b.dataset.to === '' || b.dataset.from === '') return
  const from = Number(b.dataset.from), to = Number(b.dataset.to)
  const t0 = performance.now()
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 700)
    b.textContent = `${fmt(from + (to - from) * (1 - (1 - k) ** 3), 0)} %`
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ── controles flotantes (HUD) ───────────────────────────────────────────────
function hudHtml() {
  const capOk = meta.queue?.available
  return `<div class="sim-bar sim-top hud hud-frame" role="toolbar" aria-label="Qué simular">
      <div class="seg" role="group" aria-label="Qué medir">
        <button type="button" data-sim-engine="acc" aria-pressed="${engine === 'acc'}">Tiempo de llegada</button>
        <button type="button" data-sim-engine="cap" aria-pressed="${engine === 'cap'}" ${capOk ? '' : 'disabled title="Falta SimPy: pip install -r requirements-simulation.txt"'}>Capacidad</button>
        <button type="button" data-sim-engine="ops" aria-pressed="${engine === 'ops'}">Operativo</button></div>
      ${engine === 'ops' ? toolbarHtml(scenario.name) : `<div class="seg" role="group" aria-label="Servicio">${Object.entries(SERVICE).map(([k, s]) =>
        `<button type="button" data-sim-service="${k}" aria-pressed="${cfg.service === k}">${s.label}</button>`).join('')}</div>`}
    </div>
    <p class="sim-hint hud" id="sim-hint" ${getZone() && (engine !== 'ops' || hasUnits()) ? 'hidden' : ''}>${!getZone()
      ? 'Haz clic en el mapa para elegir la zona · después arrastra su borde para agrandarla'
      : 'Elige Patrullero, Serenazgo, Ambulancia o Bomberos arriba y haz clic en el mapa para colocar unidades · ╱ Tramo cortado: clic punto a punto y «Terminar tramo»'}</p>
    <div class="sim-bottom">
      ${engine === 'ops' ? replayHtml(cfg.ops.horizon_h * 60) : ''}
      <div class="sim-cards" role="group" aria-label="¿Qué pasa si…?">${PRESETS.filter((p) => !p.cap || engine === 'cap').map((p) =>
        `<button type="button" class="sim-card hud" data-sim-preset="${p.id}" aria-pressed="${cfg.preset === p.id}">
          <span class="sim-card-i" aria-hidden="true">${p.icon}</span><b>${p.label}</b><small>${p.hint}</small></button>`).join('')}</div>
      <div class="sim-bar hud" role="toolbar" aria-label="Vista">
        ${engine === 'acc' ? `<div class="seg" role="group" aria-label="Qué pintar">
          <button type="button" data-sim-view="swipe" aria-pressed="${view === 'swipe'}">Hoy ⟷ hipótesis</button>
          <button type="button" data-sim-view="delta" aria-pressed="${view === 'delta'}">Qué cambia</button></div>` : ''}
        <p class="sim-key" id="sim-key">${keyHtml()}</p>
        <button class="btn" type="button" id="sim-data">Ver cifras</button>
      </div>
    </div>`
}

function keyHtml() {
  const sw = (v, l) => `<span><i style="background:var(${v})"></i>${l}</span>`
  if (engine === 'ops') return opsKeyHtml()
  if (engine === 'cap') return Object.values(UTIL).map(([v, l]) => sw(v, l)).join('')
  if (view === 'delta') return Object.values(DELTA).map(([v, l]) => sw(v, l)).join('')
  return BANDS.map(([, v, l]) => sw(v, l)).join('') + sw('--danger', 'sin servicio')
}

function renderHud() {
  if (!hud) {
    hud = document.createElement('div')
    hud.className = 'sim-hud'
    hud.id = 'sim-hud'
    document.body.appendChild(hud)
    hud.addEventListener('click', onHudClick)
    hud.addEventListener('input', onReplayInput)
  }
  hud.dataset.anim = hud.hidden || !hud.innerHTML ? 'on' : 'off'   // la entrada escalonada solo al abrir, no en cada ajuste
  hud.hidden = false
  hud.innerHTML = hudHtml()
}

function syncHud() {
  if (!hud) return
  for (const b of hud.querySelectorAll('[data-sim-preset]')) b.setAttribute('aria-pressed', String(b.dataset.simPreset === cfg.preset))
  for (const b of hud.querySelectorAll('[data-sim-service]')) b.setAttribute('aria-pressed', String(b.dataset.simService === cfg.service))
  for (const b of hud.querySelectorAll('[data-sim-view]')) b.setAttribute('aria-pressed', String(b.dataset.simView === view))
  const key = hud.querySelector('#sim-key')
  if (key) key.innerHTML = keyHtml()
}

function onHudClick(e) {
  const t = e.target
  if (onReplayClick(e)) return
  const kindB = t.closest('[data-ops-kind]')
  if (kindB) { setTool('unit', kindB.dataset.opsKind); return renderHud() }
  const tool = t.closest('[data-ops-tool]')
  if (tool) {
    const a = tool.dataset.opsTool
    if (a === 'tramo') setTool(opsTool() === 'tramo' ? 'unit' : 'tramo')
    else if (a === 'finish') { finishTramo(); setTool('unit') }   // terminar el tramo ya recalcula (onChange)
    else if (a === 'clear') { clearAll(); lastBy.ops = null; placeScore(false) }
    return renderHud()
  }
  const scn = t.closest('[data-scn]')
  if (scn) return scenarioAction(scn.dataset.scn)
  const eng = t.closest('[data-sim-engine]')
  if (eng && !eng.disabled) {
    if (engine === 'ops' && eng.dataset.simEngine !== 'ops') hideOps()
    engine = eng.dataset.simEngine
    if (engine === 'ops') setTool('unit')
    if (engine === 'acc' && cfg.preset === 'demanda') applyPreset('lluvia', false)
    renderHud()
    drawResult()
    placeScore(!last())
    if (getZone()) frameZone()   // la barra superior cambia de alto: el marcador debe seguir visible
    return simulate()
  }
  const s = t.closest('[data-sim-service]')
  if (s) {
    cfg.service = s.dataset.simService
    cfg.closed.clear()
    syncHud()
    return simulate()
  }
  const p = t.closest('[data-sim-preset]')
  if (p) return applyPreset(p.dataset.simPreset)
  const v = t.closest('[data-sim-view]')
  if (v) {
    view = v.dataset.simView
    syncHud()
    return drawResult()
  }
  if (t.closest('#sim-data')) openData()
}

function applyPreset(id, run = true) {
  Object.assign(cfg, CALM, presetById(id).h)
  cfg.preset = id
  syncHud()
  setRain(cfg.rain, getZone())
  if (view === 'swipe' && last() && engine === 'acc') showSwipe(scenarioName(), (lon) => { split = lon; applySplit() })
  if (run) simulate()
}

function toggleClosed(id) {
  if (cfg.closed.has(id)) cfg.closed.delete(id)
  else cfg.closed.add(id)
  toast(cfg.closed.size ? `${cfg.closed.size} sede(s) cerrada(s) en la hipótesis` : 'Todas las sedes abiertas')
  simulate()
}

// ── simulación ──────────────────────────────────────────────────────────────
function payload() {
  const z = getZone()
  const common = { area: { lat: +z.lat.toFixed(5), lon: +z.lon.toFixed(5), radius_km: z.radius_km }, service: cfg.service, seed: cfg.seed,
    base: { speed_kmh: cfg.speed_kmh },
    hypothesis: { rain: cfg.rain, congestion_pct: cfg.congestion_pct, out_of_service_pct: cfg.out_of_service_pct, detour_pct: cfg.detour_pct,
      closed_ids: [...cfg.closed] } }
  if (engine === 'ops') {
    return ['/api/v1/sim/operations/run', { area: common.area, base: common.base, seed: cfg.seed, replications: cfg.opsReplications,
      hypothesis: { ...common.hypothesis, closed_ids: [] }, ...opsSpec(), ops: cfg.ops }]
  }
  return engine === 'cap'
    ? ['/api/v1/sim/queue/run', { ...common, replications: cfg.replications, hypothesis: { ...common.hypothesis, demand_pct: cfg.demand_pct },
      queue: { rate_per_h: cfg.rate_per_h, capacity: cfg.capacity, service_min: cfg.service_min, horizon_h: cfg.horizon_h } }]
    : ['/api/v1/sim/accessibility/run', { ...common, iterations: cfg.iterations }]
}

const JEV_TONE = { aceptable_para_exploracion: 'mejor', mas_iteraciones: 'igual', otro_modelo: 'igual', mas_datos: 'peor', revision_humana: 'peor' }

async function evaluateJev(forEngine, r, seq) {
  try {
    const j = await postJSON('/api/v1/jev/evaluate', { run_id: r.run_id })
    if (lastBy[forEngine]?.run_id !== r.run_id) return
    jevBy[forEngine] = j
    if (forEngine === engine && seq === runSeq) placeScore(false)
    document.dispatchEvent(new CustomEvent('notify-refresh'))
  } catch { /* JEV es opcional: el resultado se muestra igual */ }
}

function jevHtml() {
  const j = jevBy[engine]
  if (!j) return ''
  const more = j.actions.find((a) => a.action === 'mas_iteraciones')
  return `<p class="sim-jev" data-tone="${JEV_TONE[j.decision] || 'igual'}"><b>JEV ${j.score ?? '—'}</b> · ±${j.uncertainty.precision ?? '—'} · variabilidad ${esc(j.variability?.level || '—')}
    · ${esc(j.decision_label)}${more ? ' <button type="button" class="btn btn-ghost" data-jev="more">Aplicar</button>' : ''}</p>`
}

/** Consejo de JEV «más iteraciones»: sube repeticiones o réplicas al siguiente escalón y recalcula. */
function applyMoreIterations() {
  if (engine === 'ops') cfg.opsReplications = Math.min(60, cfg.opsReplications * 2)
  else if (engine === 'cap') cfg.replications = Math.min(100, cfg.replications * 2)
  else cfg.iterations = Math.min(2000, Math.max(500, cfg.iterations * 2))
  toast(engine === 'acc' ? `Repeticiones: ${cfg.iterations}` : `Réplicas: ${engine === 'ops' ? cfg.opsReplications : cfg.replications}`)
  simulate()
}

/** Cada cambio recalcula solo, tras una pausa corta; una respuesta vieja nunca pisa a la más reciente. */
function simulate() {
  if (!getZone() || !active) return
  clearTimeout(liveTimer)
  if (engine === 'ops' && !hasUnits()) { lastBy.ops = null; return placeScore(false) }
  placeScore(true)
  liveTimer = setTimeout(async () => {
    const seq = ++runSeq
    const forEngine = engine
    const [url, body] = payload()
    try {
      const r = await postJSON(url, body)
      if (seq !== runSeq || !active) return
      lastBy[forEngine] = r
      jevBy[forEngine] = null
      evaluateJev(forEngine, r, seq)
      if (forEngine === 'ops') showResult(r)
      drawResult()
      placeScore(false)
      // refresca las cifras solo si el panel está a la vista; cerrado, no debe reabrirse solo
      if (document.getElementById('sim-data-panel') && document.body.dataset.panelC === 'on') openData(document.getElementById('sim-compare')?.open ? 'compare' : undefined)
    } catch (e) {
      if (seq !== runSeq) return
      lastError = e.message
      placeScore(false)
    }
  }, 300)
}

// ── panel de cifras (solo a pedido) ─────────────────────────────────────────
function openData(section) {
  document.dispatchEvent(new CustomEvent('sim-open-panel'))
  const box = document.getElementById('panel-body')
  box.innerHTML = `<div id="sim-data-panel">${dataHtml({ last: last(), cfg, meta, engine, scenario: scenarioName(), jev: jevBy[engine] })}</div>`
  const num = (id, key, int = false) => {
    const el = document.getElementById(id)
    if (el) el.onchange = () => { cfg[key] = int ? Math.round(Number(el.value)) : Number(el.value); simulate() }
  }
  num('sim-speed', 'speed_kmh')
  num('sim-iter', 'iterations', true)
  num('sim-seed', 'seed', true)
  num('sim-rate', 'rate_per_h')
  num('sim-capacity', 'capacity', true)
  num('sim-svc', 'service_min')
  const opsNum = (id, key) => {
    const el = document.getElementById(id)
    if (el) el.onchange = () => { cfg.ops = { ...cfg.ops, [key]: Number(el.value) }; renderHud(); simulate() }
  }
  opsNum('ops-rate', 'rate_per_h')
  opsNum('ops-horizon', 'horizon_h')
  opsNum('ops-service', 'service_min')
  opsNum('ops-target', 'target_min')
  opsNum('ops-detour', 'detour_per_tramo_pct')
  const reps = document.getElementById('ops-reps')
  if (reps) reps.onchange = () => { cfg.opsReplications = Math.round(Number(reps.value)); simulate() }
  const cmp = document.getElementById('sim-compare')
  if (cmp) {
    const load = async () => {
      const box2 = document.getElementById('sim-cmp')
      try { box2.innerHTML = await scenariosHtml() } catch (err) { box2.innerHTML = `<p class="note">${esc(err.message)}</p>` }
    }
    cmp.addEventListener('toggle', () => { if (cmp.open) load() })
    if (section === 'compare') {
      cmp.open = true
      cmp.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }
  const dem = document.getElementById('sim-demand_pct')
  if (dem) dem.oninput = () => {
    cfg.demand_pct = Number(dem.value)
    cfg.preset = 'propio'
    document.getElementById('sim-demand_pct-v').textContent = signed(cfg.demand_pct, ' %')
    syncHud()
    simulate()
  }
  document.getElementById('sim-history').addEventListener('toggle', async (e) => {
    if (!e.target.open) return
    const runs = document.getElementById('sim-runs')
    try { runs.innerHTML = await runsHtml(Object.fromEntries(Object.entries(SERVICE).map(([k, s]) => [k, s.label]))) }
    catch (err) { runs.innerHTML = `<p class="note">${esc(err.message)}</p>` }
  }, { once: true })
  box.querySelector('#sim-data-panel').addEventListener('click', (e) => {
    const run = e.target.closest('[data-run]')
    if (run) loadRun(run.dataset.run)
    const scn = e.target.closest('[data-load-scn]')
    if (scn) loadScenario(scn.dataset.loadScn)
  })
}

async function loadRun(id) {
  try {
    const r = await getJSON(`/api/v1/sim/runs/${id}`)
    const p = r.params
    engine = p.engine === 'queue' ? 'cap' : 'acc'
    lastBy[engine] = r
    Object.assign(cfg, { service: p.service, seed: p.seed, speed_kmh: p.base.speed_kmh, preset: 'propio', rain: p.hypothesis.rain,
      congestion_pct: p.hypothesis.congestion_pct, out_of_service_pct: p.hypothesis.out_of_service_pct, detour_pct: p.hypothesis.detour_pct,
      demand_pct: p.hypothesis.demand_pct ?? 0, closed: new Set(p.hypothesis.closed_ids) })
    if (p.iterations) cfg.iterations = p.iterations
    setZone(p.area)
    fitZone(80)
    renderHud()
    setRain(cfg.rain, getZone())
    drawResult()
    placeScore(false)
  } catch (err) { toast(err.message) }
}

// ── escenarios A/B/C (operativo) ────────────────────────────────────────────
function scenarioSpec() {
  const z = getZone()
  return { engine: 'operations', area: z && { lat: +z.lat.toFixed(5), lon: +z.lon.toFixed(5), radius_km: z.radius_km }, ...opsSpec(),
    preset: cfg.preset, hypothesis: { rain: cfg.rain, congestion_pct: cfg.congestion_pct, out_of_service_pct: cfg.out_of_service_pct,
      detour_pct: cfg.detour_pct }, ops: { ...cfg.ops }, seed: cfg.seed }
}

function scenarioMetrics() {
  const r = lastBy.ops
  if (!r) return null
  return { within_target_pct: r.results.within_target_pct.p50, response_p50_min: r.results.response_p50_min.p50,
    response_p90_min: r.results.response_p90_min.p50, unattended: r.results.unattended.p50, saturated: r.saturated.length,
    units: r.params.units.length, tramos: r.params.tramos.length, scenario: scenarioName() }
}

async function scenarioAction(a) {
  try {
    if (a === 'save') {
      const s = await postJSON('/api/v1/sim/scenarios', { id: scenario.id, name: scenario.name, spec: scenarioSpec(),
        run_id: lastBy.ops?.run_id, metrics: scenarioMetrics() })
      scenario = { id: s.id, name: s.name }
      toast(`«${s.name}» guardado (versión ${s.versions.at(-1).v})`)
    } else if (a === 'dup') {
      if (!scenario.id) await scenarioAction('save')
      const letter = String.fromCharCode(65 + Math.min(25, (await getJSON('/api/v1/sim/scenarios')).scenarios.length))
      const d = await postJSON(`/api/v1/sim/scenarios/${scenario.id}/duplicate`, { name: `Escenario ${letter}` })
      scenario = { id: d.id, name: d.name }
      toast(`Ahora editas «${d.name}», copia independiente. Cambia unidades, tramos o el «¿qué pasa si…?».`)
    } else if (a === 'compare') return openData('compare')
    renderHud()
  } catch (e) { toast(e.message) }
}

export async function loadScenario(id) {
  try {
    const s = await getJSON(`/api/v1/sim/scenarios/${id}`)
    const spec = s.versions.at(-1).spec
    scenario = { id: s.id, name: s.name }
    engine = 'ops'
    Object.assign(cfg, CALM, spec.hypothesis || {}, { preset: spec.preset || 'propio', seed: spec.seed ?? cfg.seed, ops: { ...cfg.ops, ...(spec.ops || {}) } })
    if (spec.area) { setZone(spec.area); fitZone(80) }
    loadSpec(spec)
    renderHud()
    setRain(cfg.rain, getZone())
    simulate()
  } catch (e) { toast(e.message) }
}

// ── ciclo de vida del modo ──────────────────────────────────────────────────
initOps({ onChange: () => { renderHudKeepingTool(); simulate() } })
function renderHudKeepingTool() { if (hud && !hud.hidden) renderHud() }

initZone({
  onEdit: (z) => { setRain(cfg.rain, z); placeScore(true) },
  onCommit: (z) => { centerSwipeOn(z.lon, z.lat); simulate() },
})

/** Encuadra la zona en el espacio libre entre los controles flotantes, dejando sitio al marcador encima. */
function frameZone() {
  const top = hud?.querySelector('.sim-top')?.getBoundingClientRect().bottom ?? 0
  const bottomEl = hud?.querySelector('.sim-bottom')?.getBoundingClientRect()
  const pad = { top: top + 200, bottom: (bottomEl ? innerHeight - bottomEl.top : 0) + 16, left: 24, right: 24 }
  const free = innerHeight - pad.top - pad.bottom
  if (free < 120) { const k = (innerHeight - 120) / (pad.top + pad.bottom); pad.top *= k; pad.bottom *= k }
  fitZone(pad)
}

/** Clic en el mapa dentro del modo: coloca (o recoloca) la zona con un radio acorde al zoom. */
export function onMapClick(e) {
  if (!active) return false
  if (map.getLayer('sim-sites') && map.queryRenderedFeatures(e.point, { layers: ['sim-sites'] }).length) return true
  if (engine === 'ops' && getZone() && onOpsClick(e)) {
    hud?.querySelector('#sim-hint')?.setAttribute('hidden', '')
    if (opsTool() !== 'tramo') simulate()
    return true
  }
  const z = getZone()
  const b = map.getBounds()
  const viewKm = (b.getEast() - b.getWest()) * 111.32 * Math.cos(e.lngLat.lat * Math.PI / 180)
  const radius = z?.radius_km ?? Math.min(30, Math.max(1, Math.round((viewKm / 8) * 2) / 2))
  cfg.closed.clear()
  setZone({ lat: e.lngLat.lat, lon: e.lngLat.lng, radius_km: radius })
  hud?.querySelector('#sim-hint')?.setAttribute('hidden', '')
  frameZone()
  setRain(cfg.rain, getZone())
  centerSwipeOn(e.lngLat.lng, e.lngLat.lat)
  simulate()
  return true
}

export async function renderSimulation() {
  if (!meta) meta = await getJSON('/api/v1/sim/engines')
  if (!meta.local) {
    document.getElementById('panel-body').innerHTML = '<div class="panel-head"><h2>Laboratorio de simulación</h2><p class="sub">Disponible solo en la instalación local (INICIAR-MAPA.bat): el cálculo pesado no corre en el visor web.</p></div>'
    return
  }
  active = true
  document.body.classList.add('sim-on')
  setPanel('panel', false)
  map.getCanvas().style.cursor = 'crosshair'
  renderHud()
  showZone()
  setRain(cfg.rain, getZone())
  drawResult()
  if (getZone()) placeScore(!last())
}

export function hideSimulation() {
  active = false
  clearTimeout(liveTimer)
  runSeq++
  document.body.classList.remove('sim-on')
  map.getCanvas().style.cursor = ''
  if (hud) hud.hidden = true
  hideZone()
  stopRain()
  hideSwipe()
  hideOps()
  score?.remove()
  for (const id of LAYERS) vis(id, false)
}


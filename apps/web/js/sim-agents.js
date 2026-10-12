// Evacuación con agentes sintéticos (S4) sobre el mapa: marcar puntos seguros, ver a los agentes moverse hacia ellos,
// dónde se congestionan y qué parte llega a tiempo. Los agentes son sintéticos y uniformes en el área: no son personas.
/* global maplibregl */
import { map } from './map.js'
import { cssVar, esc, fmt } from './util.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const st = { points: [], seq: 0, markers: new Map(), result: null, t: 0, playing: false, frame: 0, speed: 10, mode: 'pie', n: 1500, onChange: () => {} }

export const agentsSpec = () => ({ safe_points: st.points.map(({ id, lat, lon, capacity }) => ({ id, lat, lon, capacity: capacity || 0 })),
  agents: { n: st.n, mode: st.mode, horizon_min: 90 } })
export const hasSafePoints = () => st.points.length > 0
export const agentsConfig = () => ({ mode: st.mode, n: st.n })
export function initAgents({ onChange }) { st.onChange = onChange }
export function setAgentsConfig({ mode, n }) { if (mode) st.mode = mode; if (n) st.n = n; st.onChange() }

function ensureLayers() {
  if (map.getSource('agt-dots')) return
  map.addSource('agt-dots', { type: 'geojson', data: fc([]) })
  map.addSource('agt-cells', { type: 'geojson', data: fc([]) })
  map.addLayer({ id: 'agt-cells', type: 'circle', source: 'agt-cells', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 6, 15, 26], 'circle-blur': 0.6,
    'circle-color': ['case', ['>=', ['get', 'ratio'], 1], cssVar('--danger'), cssVar('--warn')], 'circle-opacity': 0.55 } })
  map.addLayer({ id: 'agt-dots', type: 'circle', source: 'agt-dots', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.2, 15, 4.5], 'circle-stroke-width': 0.6, 'circle-stroke-color': cssVar('--void'),
    'circle-color': ['case', ['==', ['get', 'a'], 1], cssVar('--ok'), cssVar('--info')], 'circle-opacity': 0.85 } })
}

function vis(on) {
  for (const id of ['agt-dots', 'agt-cells']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
}

function pointEl(p) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'agt-safe'
  el.innerHTML = `<b>⛨</b><small>${p.capacity ? `cap. ${p.capacity}` : 'sin tope'}</small>`
  el.title = 'Punto seguro · arrastra para mover · doble clic para quitar'
  el.setAttribute('aria-label', `Punto seguro ${p.id}`)
  el.addEventListener('dblclick', (e) => { e.stopPropagation(); st.points = st.points.filter((x) => x.id !== p.id); paintPoints(); st.onChange() })
  return el
}

function paintPoints() {
  for (const [id, m] of st.markers) if (!st.points.some((p) => p.id === id)) { m.remove(); st.markers.delete(id) }
  for (const p of st.points) {
    let m = st.markers.get(p.id)
    if (!m) {
      m = new maplibregl.Marker({ element: pointEl(p), draggable: true }).setLngLat([p.lon, p.lat]).addTo(map)
      m.on('dragend', () => { const q = m.getLngLat(); Object.assign(p, { lat: +q.lat.toFixed(5), lon: +q.lng.toFixed(5) }); st.onChange() })
      st.markers.set(p.id, m)
    } else m.setLngLat([p.lon, p.lat]).addTo(map)
    const over = st.result?.safe_points?.find((x) => x.id === p.id)
    m.getElement().dataset.over = String(!!over?.over_capacity)
    m.getElement().querySelector('small').textContent = over ? `${fmt(over.load_p50, 0)} llegan${p.capacity ? ` / ${p.capacity}` : ''}` : (p.capacity ? `cap. ${p.capacity}` : 'sin tope')
  }
}

/** Clic con la herramienta «punto seguro»: añade un punto (capacidad opcional desde «Ver cifras»). */
export function addSafePoint(lngLat) {
  st.points.push({ id: `s${++st.seq}`, lat: +lngLat.lat.toFixed(5), lon: +lngLat.lng.toFixed(5), capacity: 0 })
  paintPoints()
  st.onChange()
}

export function setCapacity(id, capacity) {
  const p = st.points.find((x) => x.id === id)
  if (p) { p.capacity = Math.max(0, Math.round(capacity) || 0); paintPoints(); st.onChange() }
}
export const safePoints = () => st.points

// ── reproducción ────────────────────────────────────────────────────────────
function renderFrame() {
  ensureLayers()
  const r = st.result
  const bar = document.getElementById('agt-replay')
  if (!r) { map.getSource('agt-dots').setData(fc([])); map.getSource('agt-cells').setData(fc([])); if (bar) bar.hidden = true; return }
  const frames = r.replay.frames
  const i = Math.min(frames.length - 1, Math.floor(st.t))
  const fr = frames[i] || []
  map.getSource('agt-dots').setData(fc(fr.map(([x, y, a]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x, y] }, properties: { a } }))))
  if (!bar) return
  bar.hidden = false
  const pct = r.curve[Math.min(r.curve.length - 1, Math.floor(st.t / 5))] ?? 0
  bar.querySelector('#agt-clock').textContent = `${String(Math.floor(st.t)).padStart(2, '0')} min`
  bar.querySelector('#agt-time').value = String(Math.floor(st.t))
  bar.querySelector('#agt-live').innerHTML = `<span><b>${fmt(pct, 0)} %</b> evacuado (curva cada 5 min)</span><span><b>${fr.filter((f) => !f[2]).length}</b> de ${fr.length} en camino (muestra)</span>`
  bar.querySelector('[data-agt="play"]').textContent = st.playing ? '⏸' : '▶'
}

function tick(last) {
  st.frame = requestAnimationFrame((now) => {
    if (!st.playing || !st.result) return
    const end = st.result.replay.frames.length - 1
    st.t = Math.min(end, st.t + ((now - last) / 1000) * st.speed)
    renderFrame()
    if (st.t >= end) { st.playing = false; renderFrame(); return }
    tick(now)
  })
}

export function play() {
  if (!st.result) return
  if (st.t >= st.result.replay.frames.length - 1) st.t = 0
  if (reduced()) { st.t = st.result.replay.frames.length - 1; return renderFrame() }
  st.playing = true
  cancelAnimationFrame(st.frame)
  tick(performance.now())
}
export function pause() { st.playing = false; cancelAnimationFrame(st.frame); renderFrame() }

export function showResult(r) {
  if (st.result?.run_id && st.result.run_id === r.run_id) { st.result = r; return renderFrame() }
  st.result = r
  ensureLayers()
  vis(true)
  map.getSource('agt-cells').setData(fc(r.replay.cells.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { ratio: c.ratio } }))))
  paintPoints()
  st.t = 0
  renderFrame()
  play()
}

export function showAgents() { ensureLayers(); vis(true); paintPoints(); renderFrame() }
export function hideAgents() {
  pause()
  vis(false)
  for (const m of st.markers.values()) m.remove()
  st.markers.clear()
}
export function clearAgents() { st.points = []; st.result = null; paintPoints(); renderFrame(); st.onChange() }

export function onAgentsReplay(e) {
  const b = e.target.closest('[data-agt]')
  if (b) {
    const a = b.dataset.agt
    if (a === 'play') st.playing ? pause() : play()
    else if (a === 'start') { pause(); st.t = 0; renderFrame() }
    return true
  }
  return false
}
export function onAgentsInput(e) {
  if (e.target.id === 'agt-time') { const v = Number(e.target.value); pause(); st.t = v; renderFrame() }
  if (e.target.id === 'agt-speed') st.speed = Number(e.target.value)
}

export function toolbarHtml(tool) {
  return `<button type="button" class="btn" data-agt-tool="safe" aria-pressed="${tool === 'safe'}">⛨ Punto seguro</button>
    <div class="seg" role="group" aria-label="Cómo se desplazan">${[['pie', 'A pie'], ['vehiculo', 'En vehículo']].map(([k, l]) =>
      `<button type="button" data-agt-mode="${k}" aria-pressed="${st.mode === k}">${l}</button>`).join('')}</div>
    <label class="agt-n">Agentes <select id="agt-n">${[500, 1500, 3000, 5000].map((n) => `<option ${st.n === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <button type="button" class="btn" data-ops-tool="tramo" aria-pressed="${tool === 'tramo'}">╱ Tramo cortado</button>
    <button type="button" class="btn" data-ops-tool="perimetro" aria-pressed="${tool === 'perimetro'}">⬠ Perímetro</button>
    ${tool === 'tramo' || tool === 'perimetro' ? '<button type="button" class="btn btn-primary" data-ops-tool="finish">Terminar</button>' : ''}
    <button type="button" class="btn btn-ghost" data-agt-tool="clear">Quitar puntos</button>`
}

export function replayHtml() {
  return `<div class="sim-bar hud ops-replay" id="agt-replay" ${st.result ? '' : 'hidden'} role="group" aria-label="Tiempo virtual de la evacuación">
    <button type="button" class="btn btn-icon" data-agt="start" aria-label="Al inicio">⏮</button>
    <button type="button" class="btn btn-icon btn-primary" data-agt="play" aria-label="Reproducir o pausar">▶</button>
    <output id="agt-clock" class="ops-clock">00 min</output>
    <input type="range" id="agt-time" min="0" max="${(st.result?.replay.frames.length || 91) - 1}" value="${Math.floor(st.t)}" aria-label="Minuto de la evacuación">
    <select id="agt-speed" aria-label="Velocidad">${[[5, '×5'], [10, '×10'], [30, '×30']].map(([v, l]) => `<option value="${v}" ${st.speed === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <p class="ops-live" id="agt-live"></p></div>`
}

export function keyHtml() {
  return '<span><i style="background:var(--info)"></i>agente en camino</span><span><i style="background:var(--ok)"></i>llegó</span>' +
    '<span><i style="background:var(--warn)"></i>celda cargada</span><span><i style="background:var(--danger)"></i>celda saturada</span>' +
    '<span><i style="background:var(--danger);border-radius:0"></i>tramo cortado</span>'
}

export function scoreHtml(r, kindBadge) {
  const R = r.results
  const e30 = R.evacuated_pct['30'].p50
  const over = r.safe_points.filter((s) => s.over_capacity).length
  return `<p class="sim-score-k">Evacuación · ${fmt(r.params.agents.n, 0)} agentes sintéticos · ${r.params.agents.mode === 'pie' ? 'a pie' : 'en vehículo'}</p>
    <p class="sim-score-n"><b data-tone="${e30 < 70 ? 'peor' : 'mejor'}">${fmt(e30, 0)} %</b></p>
    <p class="sim-score-s">evacuado en 30 min · 90 % en ${R.t90_min.p50 == null ? '> horizonte' : `${fmt(R.t90_min.p50, 0)} min`}
      · ${over} punto(s) excedido(s) · ${kindBadge('estimacion')}</p>`
}

export function dataHtml(r) {
  if (!r) return '<p class="src-meta">Marca al menos un punto seguro en el mapa.</p>'
  const R = r.results
  const q = (x, u) => (x?.p50 == null ? '—' : `${fmt(x.p50, 1)}${u} <small>(${fmt(x.p5, 1)}–${fmt(x.p95, 1)})</small>`)
  return `<table class="why-table"><tbody>
      ${['10', '30', '60'].map((m) => `<tr><td>Evacuado en ${m} min</td><td>${q(R.evacuated_pct[m], ' %')}</td></tr>`).join('')}
      <tr><td>50 % llega en</td><td>${q(R.t50_min, ' min')}</td></tr><tr><td>90 % llega en</td><td>${q(R.t90_min, ' min')}</td></tr>
      <tr><td>No llegan en el horizonte</td><td>${q(R.not_arrived, '')}</td></tr><tr><td>Con rodeo por tramos</td><td>${q(R.detour_pct, ' %')}</td></tr></tbody></table>
    <table class="why-table sim-sites"><caption>Carga por punto seguro (mediana). Capacidad 0 = sin tope.</caption>
      <thead><tr><th>Punto</th><th>Llegan</th><th>Capacidad</th></tr></thead><tbody>
      ${r.safe_points.map((s) => `<tr><td>${esc(s.id)}${s.over_capacity ? ' ⚠' : ''}</td><td>${fmt(s.load_p50, 0)}</td>
        <td><input type="number" min="0" max="100000" value="${s.capacity}" data-cap="${esc(s.id)}" aria-label="Capacidad de ${esc(s.id)}"></td></tr>`).join('')}</tbody></table>
    ${r.warnings.length ? `<p class="note">${r.warnings.map(esc).join(' ')}</p>` : ''}
    <details class="why section-gap"><summary>Supuestos y validez</summary><div class="why-body"><ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <p class="src-meta">Validez: ${esc(r.validity)} · ${r.sample.replications} réplicas.</p></div></details>
    <p class="src-meta">Ejecución <code>${esc(r.run_id)}</code> · semilla ${r.params.seed}</p>
    <div class="tool-row"><button class="btn" type="button" data-report="run" data-run-id="${esc(r.run_id)}">Informe imprimible</button></div>`
}

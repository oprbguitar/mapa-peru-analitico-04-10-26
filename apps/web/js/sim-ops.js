// Operativo simulado sobre el mapa (ejercicio de mesa): marcar unidades y tramos cortados, y reproducir en tiempo
// virtual cómo unidades HIPOTÉTICAS atienden llamadas HIPOTÉTICAS. Reproducir, pausar, retroceder y adelantar.
/* global maplibregl */
import { map } from './map.js'
import { cssVar, esc, fmt } from './util.js'

export const UNIT_KINDS = {
  patrulla: { label: 'Patrullero', short: 'P', color: '--info' }, serenazgo: { label: 'Serenazgo', short: 'S', color: '--support' },
  ambulancia: { label: 'Ambulancia', short: 'A', color: '--ok' }, bomberos: { label: 'Bomberos', short: 'B', color: '--hot' },
}
const CALL_STATE = { espera: ['--danger', 'esperando'], atencion: ['--warn', 'en atención'], cerrada: ['--ink-muted', 'cerrada'] }
const SPEEDS = [[10, '×10'], [30, '×30'], [120, '×120']]   // minutos virtuales por segundo real
const fc = (features) => ({ type: 'FeatureCollection', features })
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const st = {
  units: [], tramos: [], draft: [], tool: 'unit', kind: 'patrulla', seq: 0,
  result: null, t: 0, speed: 30, playing: false, frame: 0, markers: new Map(), onChange: () => {},
}

export const opsSpec = () => ({ units: st.units.map(({ id, kind, lat, lon }) => ({ id, kind, lat, lon })), tramos: st.tramos })
export const hasUnits = () => st.units.length > 0
export const opsTool = () => st.tool

export function initOps({ onChange }) { st.onChange = onChange }

export function loadSpec(spec) {
  clearMarkers()
  st.units = (spec.units || []).map((u) => ({ ...u }))
  st.tramos = (spec.tramos || []).map((t) => ({ ...t }))
  st.seq = st.units.length + st.tramos.length
  st.draft = []
  st.result = null
  paintMarks()
}

// ── capas ───────────────────────────────────────────────────────────────────
function ensureLayers() {
  if (map.getSource('ops-tramos')) return
  for (const id of ['ops-tramos', 'ops-draft', 'ops-routes', 'ops-calls', 'ops-moving']) map.addSource(id, { type: 'geojson', data: fc([]) })
  map.addLayer({ id: 'ops-routes', type: 'line', source: 'ops-routes', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [1, 1.5], 'line-opacity': 0.9 } })
  map.addLayer({ id: 'ops-tramos', type: 'line', source: 'ops-tramos', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': cssVar('--danger'), 'line-width': 6, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'ops-tramos-x', type: 'line', source: 'ops-tramos', layout: { 'line-cap': 'butt' },
    paint: { 'line-color': cssVar('--void'), 'line-width': 2, 'line-dasharray': [1, 1] } })
  map.addLayer({ id: 'ops-draft', type: 'line', source: 'ops-draft', paint: { 'line-color': cssVar('--danger'), 'line-width': 4, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'ops-calls', type: 'circle', source: 'ops-calls', paint: {
    'circle-radius': ['match', ['get', 's'], 'espera', 8, 'atencion', 7, 4], 'circle-color': ['get', 'color'],
    'circle-stroke-width': ['match', ['get', 's'], 'espera', 3, 1], 'circle-stroke-color': cssVar('--void'),
    'circle-opacity': ['match', ['get', 's'], 'cerrada', 0.45, 1] } })
  map.addLayer({ id: 'ops-moving', type: 'circle', source: 'ops-moving', paint: {
    'circle-radius': 7, 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--ink') } })
}

function vis(on) {
  for (const id of ['ops-routes', 'ops-tramos', 'ops-tramos-x', 'ops-draft', 'ops-calls', 'ops-moving']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
}

function unitEl(u) {
  const k = UNIT_KINDS[u.kind]
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'ops-unit'
  el.style.setProperty('--unit', `var(${k.color})`)
  el.textContent = k.short
  el.title = `${k.label} · arrastra para mover · doble clic para quitar`
  el.setAttribute('aria-label', `${k.label} ${u.id}`)
  el.addEventListener('dblclick', (e) => { e.stopPropagation(); removeUnit(u.id) })
  el.addEventListener('keydown', (e) => { if (e.key === 'Delete' || e.key === 'Backspace') removeUnit(u.id) })
  return el
}

function clearMarkers() {
  for (const m of st.markers.values()) m.remove()
  st.markers.clear()
}

function paintMarks() {
  ensureLayers()
  vis(true)
  for (const [id, m] of st.markers) if (!st.units.some((u) => u.id === id)) { m.remove(); st.markers.delete(id) }
  for (const u of st.units) {
    let m = st.markers.get(u.id)
    if (!m) {
      m = new maplibregl.Marker({ element: unitEl(u), draggable: true }).setLngLat([u.lon, u.lat]).addTo(map)
      m.on('dragend', () => {
        const p = m.getLngLat()
        Object.assign(u, { lat: +p.lat.toFixed(5), lon: +p.lng.toFixed(5) })
        st.onChange()
      })
      st.markers.set(u.id, m)
    } else m.setLngLat([u.lon, u.lat]).addTo(map)
    m.getElement().dataset.ghost = String(!!st.result)
  }
  map.getSource('ops-tramos').setData(fc(st.tramos.map((t) => ({ type: 'Feature', properties: { id: t.id }, geometry: { type: 'LineString', coordinates: t.coords } }))))
  map.getSource('ops-draft').setData(fc(st.draft.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: st.draft } }] : []))
}

function removeUnit(id) {
  st.units = st.units.filter((u) => u.id !== id)
  paintMarks()
  st.onChange()
}

// ── herramientas ────────────────────────────────────────────────────────────
let keysBound = false

export function setTool(tool, kind) {
  if (st.tool === 'tramo' && tool !== 'tramo') finishTramo()
  st.tool = tool
  if (kind) st.kind = kind
  map.getCanvas().style.cursor = 'crosshair'
  // mientras se dibuja un tramo, el doble clic lo termina en vez de acercar el mapa
  if (tool === 'tramo') map.doubleClickZoom.disable()
  else map.doubleClickZoom.enable()
  if (keysBound) return
  keysBound = true
  map.on('dblclick', () => { if (st.tool === 'tramo' && st.draft.length >= 2) { st.draft.pop(); finishTramo() } })
  document.addEventListener('keydown', (e) => {
    if (st.tool !== 'tramo' || e.target.closest('input, textarea, select')) return
    if (e.key === 'Enter') finishTramo()
    if (e.key === 'Escape') { st.draft = []; paintMarks() }
  })
}

/** Clic en el mapa con el modo operativo activo. Devuelve true si lo consumió. */
export function onOpsClick(e) {
  const p = [+e.lngLat.lng.toFixed(5), +e.lngLat.lat.toFixed(5)]
  if (st.tool === 'unit') {
    st.units.push({ id: `${UNIT_KINDS[st.kind].short.toLowerCase()}${++st.seq}`, kind: st.kind, lon: p[0], lat: p[1] })
    paintMarks()
    st.onChange()
    return true
  }
  if (st.tool === 'tramo') {
    st.draft.push(p)
    paintMarks()
    return true
  }
  return false
}

export function finishTramo() {
  if (st.draft.length >= 2) {
    st.tramos.push({ id: `t${++st.seq}`, coords: st.draft })
    st.draft = []
    paintMarks()
    st.onChange()
    return true
  }
  st.draft = []
  paintMarks()
  return false
}

export function clearAll() {
  st.units = []
  st.tramos = []
  st.draft = []
  st.result = null
  pause()
  clearMarkers()
  paintMarks()
  renderFrame()
  st.onChange()
}

// ── reproducción ────────────────────────────────────────────────────────────
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]

function stateAt(t) {
  const r = st.result
  const color = (s) => cssVar(CALL_STATE[s][0])
  const calls = []
  const counts = { total: 0, espera: 0, atencion: 0, cerrada: 0, onTarget: 0 }
  for (const c of r.timeline.calls) {
    if (c.t > t) continue
    const s = t < c.arrive ? 'espera' : t < c.clear ? 'atencion' : 'cerrada'
    counts.total++
    counts[s]++
    if (s !== 'espera' && c.response <= r.params.ops.target_min) counts.onTarget++
    calls.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { s, color: color(s) } })
  }
  for (const c of r.timeline.unattended) {
    if (c.t > t) continue
    counts.total++
    counts.espera++
    calls.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { s: 'espera', color: color('espera') } })
  }
  const kindOf = Object.fromEntries(r.params.units.map((u) => [u.id, u.kind]))
  const moving = [], routes = []
  for (const tr of r.timeline.trips) {
    if (t < tr.t0 || t > tr.t1) continue
    const k = tr.t1 > tr.t0 ? (t - tr.t0) / (tr.t1 - tr.t0) : 1
    const col = cssVar(UNIT_KINDS[kindOf[tr.unit]]?.color || '--ink')
    moving.push({ type: 'Feature', geometry: { type: 'Point', coordinates: lerp(tr.from, tr.to, k) }, properties: { color: col } })
    routes.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [lerp(tr.from, tr.to, k), tr.to] }, properties: { color: col } })
  }
  return { calls, moving, routes, counts }
}

function renderFrame() {
  ensureLayers()
  const r = st.result
  const bar = document.getElementById('ops-replay')
  if (!r) {
    for (const id of ['ops-calls', 'ops-moving', 'ops-routes']) map.getSource(id).setData(fc([]))
    if (bar) bar.hidden = true
    return
  }
  const s = stateAt(st.t)
  map.getSource('ops-calls').setData(fc(s.calls))
  map.getSource('ops-moving').setData(fc(s.moving))
  map.getSource('ops-routes').setData(fc(s.routes))
  if (!bar) return
  bar.hidden = false
  const h = Math.floor(st.t / 60), m = Math.floor(st.t % 60)
  bar.querySelector('#ops-clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} h`
  const slider = bar.querySelector('#ops-time')
  slider.value = String(Math.round(st.t))
  slider.setAttribute('aria-valuetext', `${h} h ${m} min de ${r.replay.horizon_min / 60} h`)
  const done = s.counts.atencion + s.counts.cerrada
  bar.querySelector('#ops-live').innerHTML = `<span><b>${s.counts.total}</b> llamadas</span><span data-s="espera"><b>${s.counts.espera}</b> esperando</span>
    <span data-s="atencion"><b>${s.counts.atencion}</b> en atención</span>
    <span><b>${done ? fmt((s.counts.onTarget / s.counts.total) * 100, 0) : '—'} %</b> a tiempo (≤ ${r.params.ops.target_min} min)</span>`
  bar.querySelector('#ops-play').textContent = st.playing ? '⏸' : '▶'
  bar.querySelector('#ops-play').setAttribute('aria-label', st.playing ? 'Pausar' : 'Reproducir')
}

function tick(last) {
  st.frame = requestAnimationFrame((now) => {
    if (!st.playing || !st.result) return
    const end = st.result.replay.horizon_min
    st.t = Math.min(end, st.t + ((now - last) / 1000) * st.speed)
    renderFrame()
    if (st.t >= end) { pause(); return }
    tick(now)
  })
}

export function play() {
  if (!st.result) return
  if (st.t >= st.result.replay.horizon_min) st.t = 0
  if (reduced()) { st.t = st.result.replay.horizon_min; renderFrame(); return }
  st.playing = true
  cancelAnimationFrame(st.frame)
  tick(performance.now())
  renderFrame()
}

export function pause() {
  st.playing = false
  cancelAnimationFrame(st.frame)
  if (document.getElementById('ops-replay')) renderFrame()
}

export function seek(t) {
  if (!st.result) return
  st.t = Math.max(0, Math.min(st.result.replay.horizon_min, t))
  renderFrame()
}

export const step = (dm) => seek(st.t + dm)
export const getTime = () => st.t

export function showResult(r, autoplay = true) {
  if (st.result?.run_id && st.result.run_id === r.run_id) { st.result = r; return renderFrame() }   // mismo cálculo: no reinicia el tiempo
  st.result = r
  paintMarks()
  st.t = 0
  renderFrame()
  if (autoplay) play()
}

export function onReplayInput(e) {
  const t = e.target
  if (t.id === 'ops-time') { const v = Number(t.value); pause(); seek(v) }   // leer antes: pausar redibuja el deslizador
  if (t.id === 'ops-speed') { st.speed = Number(t.value) }
}

export function onReplayClick(e) {
  const b = e.target.closest('[data-ops]')
  if (!b) return false
  const a = b.dataset.ops
  if (a === 'play') st.playing ? pause() : play()
  else if (a === 'start') { pause(); seek(0) }
  else if (a === 'back') { pause(); step(-15) }
  else if (a === 'fwd') { pause(); step(15) }
  return true
}

export function hideOps() {
  pause()
  map.doubleClickZoom.enable()
  clearMarkers()
  vis(false)
}

export function showOps() {
  paintMarks()
  renderFrame()
}

// ── HTML de las barras ──────────────────────────────────────────────────────
/** Herramientas de marcado (van dentro de la barra superior del simulador). */
export function toolbarHtml(scenarioName) {
  return `<div class="seg" role="group" aria-label="Unidad a colocar">${Object.entries(UNIT_KINDS).map(([k, u]) =>
      `<button type="button" data-ops-kind="${k}" aria-pressed="${st.tool === 'unit' && st.kind === k}"><i class="ops-dot" style="--unit:var(${u.color})">${u.short}</i>${u.label}</button>`).join('')}</div>
    <button type="button" class="btn" data-ops-tool="tramo" aria-pressed="${st.tool === 'tramo'}">╱ Tramo cortado</button>
    ${st.tool === 'tramo' ? '<button type="button" class="btn btn-primary" data-ops-tool="finish">Terminar tramo</button>' : ''}
    <button type="button" class="btn btn-ghost" data-ops-tool="clear">Borrar todo</button>
    <span class="ops-scn"><b title="Escenario actual">${esc(scenarioName)}</b>
      <button type="button" class="btn" data-scn="save">Guardar</button><button type="button" class="btn" data-scn="dup">Duplicar</button>
      <button type="button" class="btn" data-scn="compare">Comparar</button></span>`
}

export function replayHtml(horizonMin = 480) {
  return `<div class="sim-bar hud ops-replay" id="ops-replay" ${st.result ? '' : 'hidden'} role="group" aria-label="Tiempo virtual">
      <button type="button" class="btn btn-icon" data-ops="start" aria-label="Al inicio">⏮</button>
      <button type="button" class="btn btn-icon" data-ops="back" aria-label="Retroceder 15 minutos">−15</button>
      <button type="button" class="btn btn-icon btn-primary" data-ops="play" id="ops-play" aria-label="Reproducir">▶</button>
      <button type="button" class="btn btn-icon" data-ops="fwd" aria-label="Adelantar 15 minutos">+15</button>
      <output id="ops-clock" class="ops-clock">00:00 h</output>
      <input type="range" id="ops-time" min="0" max="${horizonMin}" step="1" value="${Math.round(st.t)}" aria-label="Tiempo virtual">
      <select id="ops-speed" aria-label="Velocidad">${SPEEDS.map(([v, l]) => `<option value="${v}" ${st.speed === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <p class="ops-live" id="ops-live"></p>
    </div>`
}

export function opsKeyHtml() {
  return Object.values(UNIT_KINDS).map((u) => `<span><i style="background:var(${u.color})"></i>${u.label}</span>`).join('') +
    Object.values(CALL_STATE).map(([v, l]) => `<span><i style="background:var(${v})"></i>llamada ${l}</span>`).join('') +
    '<span><i style="background:var(--danger);border-radius:0"></i>tramo cortado</span>'
}

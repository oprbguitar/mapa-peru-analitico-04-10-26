// Operativo simulado sobre el mapa (ejercicio de mesa): marcar unidades y tramos cortados, y reproducir en tiempo
// virtual cómo unidades HIPOTÉTICAS atienden llamadas HIPOTÉTICAS. Reproducir, pausar, retroceder y adelantar.
/* global maplibregl */
import { map } from './map.js'
import { cssVar, esc, fmt } from './util.js'
import { renderLog, setLog, showRings } from './sim-tactical.js'

const RAIN_FACTOR = { ninguna: 1, moderada: 0.8, intensa: 0.6 }
const CALL_NAME = { seguridad: 'SEGURIDAD', medica: 'MÉDICA', incendio: 'INCENDIO' }

/** Indicativos tácticos por tipo y orden de alta: P-01, P-02, A-01, B-01, S-01… */
function callsigns(units) {
  const n = {}
  return Object.fromEntries(units.map((u) => {
    n[u.kind] = (n[u.kind] || 0) + 1
    return [u.id, `${UNIT_KINDS[u.kind].short}-${String(n[u.kind]).padStart(2, '0')}`]
  }))
}

export const UNIT_KINDS = {
  patrulla: { label: 'Patrullero', short: 'P', color: '--info' }, serenazgo: { label: 'Serenazgo', short: 'S', color: '--support' },
  ambulancia: { label: 'Ambulancia', short: 'A', color: '--ok' }, bomberos: { label: 'Bomberos', short: 'B', color: '--hot' },
}
const CALL_STATE = { espera: ['--danger', 'esperando'], atencion: ['--warn', 'en atención'], cerrada: ['--ink-muted', 'cerrada'] }
const SPEEDS = [[10, '×10'], [30, '×30'], [120, '×120']]   // minutos virtuales por segundo real
const fc = (features) => ({ type: 'FeatureCollection', features })
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const NOTE_CAT = { referencia: { label: 'Referencia', glyph: 'i' }, evidencia: { label: 'Evidencia', glyph: '✓' }, riesgo: { label: 'Riesgo', glyph: '!' } }
const st = {
  marksOnly: false,   // en «Evacuación» solo se muestran tramos y perímetro (sin unidades ni llamadas del operativo)
  units: [], tramos: [], draft: [], tool: 'unit', kind: 'patrulla', seq: 0, perimeter: [], notes: [], measure: [], noteMarkers: new Map(), measureLabel: null,
  result: null, t: 0, speed: 30, playing: false, frame: 0, markers: new Map(), onChange: () => {},
}

export const opsSpec = () => ({ units: st.units.map(({ id, kind, lat, lon }) => ({ id, kind, lat, lon })), tramos: st.tramos,
  perimeter: st.perimeter, notes: st.notes })
export const hasUnits = () => st.units.length > 0
export const opsTool = () => st.tool

export function initOps({ onChange }) { st.onChange = onChange }

export function loadSpec(spec) {
  clearMarkers()
  st.units = (spec.units || []).map((u) => ({ ...u }))
  st.tramos = (spec.tramos || []).map((t) => ({ ...t }))
  st.perimeter = (spec.perimeter || []).map((q) => [...q])
  st.notes = (spec.notes || []).map((n) => ({ ...n }))
  st.seq = st.units.length + st.tramos.length
  st.draft = []
  st.result = null
  paintMarks()
}

// ── capas ───────────────────────────────────────────────────────────────────
function ensureLayers() {
  if (map.getSource('ops-tramos')) return
  for (const id of ['ops-tramos', 'ops-draft', 'ops-routes', 'ops-calls', 'ops-moving', 'ops-perimeter', 'ops-measure']) map.addSource(id, { type: 'geojson', data: fc([]) })
  map.addLayer({ id: 'ops-perimeter-fill', type: 'fill', source: 'ops-perimeter', paint: { 'fill-color': cssVar('--warn'), 'fill-opacity': 0.08 } })
  map.addLayer({ id: 'ops-perimeter', type: 'line', source: 'ops-perimeter', paint: { 'line-color': cssVar('--warn'), 'line-width': 3 } })
  map.addLayer({ id: 'ops-measure', type: 'line', source: 'ops-measure', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!', ['get', 'live']]],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--accent'), 'line-width': 3 } })
  map.addLayer({ id: 'ops-measure-live', type: 'line', source: 'ops-measure', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['get', 'live']],
    paint: { 'line-color': cssVar('--accent'), 'line-width': 2, 'line-dasharray': [2, 2] } })
  map.addLayer({ id: 'ops-measure-pt', type: 'circle', source: 'ops-measure', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 4, 'circle-color': cssVar('--accent'), 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--void') } })
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

const MARK_LAYERS = ['ops-tramos', 'ops-tramos-x', 'ops-draft', 'ops-perimeter', 'ops-perimeter-fill', 'ops-measure', 'ops-measure-live', 'ops-measure-pt']

function vis(on) {
  for (const id of ['ops-routes', 'ops-calls', 'ops-moving', ...MARK_LAYERS]) {
    const show = on && (!st.marksOnly || MARK_LAYERS.includes(id))
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none')
  }
}

/** Solo marcas (tramos, perímetro): lo usa la evacuación para compartir el dibujo sin mostrar el operativo. */
export function setMarksOnly(on) {
  st.marksOnly = on
  if (on) { pause(); for (const m of st.markers.values()) m.remove(); st.markers.clear() }
  paintMarks()
}

function unitEl(u) {
  const k = UNIT_KINDS[u.kind]
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'ops-unit'
  el.style.setProperty('--unit', `var(${k.color})`)
  el.textContent = k.short
  el.title = `${k.label} · clic: anillos de alcance · arrastra para mover · doble clic para quitar`
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    const p = st.result?.params
    const speed = p ? p.base.speed_kmh * RAIN_FACTOR[p.hypothesis.rain] * (1 - p.hypothesis.congestion_pct / 100) : 30
    showRings({ ...u, callsign: el.textContent }, speed, p?.base.circuity ?? 1.4)
  })
  el.setAttribute('aria-label', `${k.label} ${u.id}`)
  el.addEventListener('dblclick', (e) => { e.stopPropagation(); removeUnit(u.id) })
  el.addEventListener('keydown', (e) => { if (e.key === 'Delete' || e.key === 'Backspace') removeUnit(u.id) })
  return el
}

function clearMarkers() {
  for (const m of st.markers.values()) m.remove()
  st.markers.clear()
  for (const m of st.noteMarkers.values()) m.remove()
  st.noteMarkers.clear()
  st.measureLabel?.remove()
}

function noteEl(n) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'ops-note'
  el.dataset.cat = n.cat
  el.textContent = NOTE_CAT[n.cat].glyph
  el.title = `${NOTE_CAT[n.cat].label}: ${n.text} · doble clic para quitar`
  el.setAttribute('aria-label', el.title)
  el.addEventListener('dblclick', (e) => { e.stopPropagation(); st.notes = st.notes.filter((x) => x.id !== n.id); paintMarks(); st.onChange() })
  return el
}

const kmBetween = (a, b) => metersBetween(a, b) / 1000

/** Distancia geodésica (haversine, radio medio WGS84 6 371 008,8 m): error < 0,3 % frente al elipsoide. */
export function metersBetween(a, b) {
  const R = 6371008.8, r = Math.PI / 180
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

const bearing = (a, b) => {
  const r = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r)
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}

export const fmtDist = (m) => m < 1000 ? `${Math.round(m).toLocaleString('es-PE')} m`
  : `${(m / 1000).toLocaleString('es-PE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km`

/** Pinta la medición; con `cursor`, añade el tramo provisional hasta el puntero (vista previa en vivo). */
function paintMeasure(cursor) {
  const pts = cursor && st.measure.length ? [...st.measure, [cursor.lng, cursor.lat]] : st.measure
  const feats = st.measure.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
  if (st.measure.length > 1) feats.push({ type: 'Feature', properties: { live: false }, geometry: { type: 'LineString', coordinates: st.measure } })
  if (pts.length > st.measure.length && st.measure.length) feats.push({ type: 'Feature', properties: { live: true }, geometry: { type: 'LineString', coordinates: pts.slice(-2) } })
  map.getSource('ops-measure')?.setData(fc(feats))
  for (const id of ['ops-measure', 'ops-measure-live', 'ops-measure-pt']) if (map.getLayer(id)) map.moveLayer(id)   // siempre encima de la zona
  const panel = document.getElementById('tac-measure')
  if (pts.length < 2) {
    st.measureLabel?.remove()
    st.measureLabel = null
    if (panel) { panel.hidden = st.tool !== 'medir'; panel.innerHTML = st.tool === 'medir' ? '<span>MEDIR · clic en el punto inicial</span>' : '' }
    return
  }
  const segs = pts.slice(1).map((q, i) => metersBetween(pts[i], q))
  const total = segs.reduce((a, b) => a + b, 0)
  const last = segs.at(-1), rumbo = bearing(pts.at(-2), pts.at(-1))
  if (!st.measureLabel) {
    const el = Object.assign(document.createElement('div'), { className: 'ops-measure-label' })
    st.measureLabel = new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [10, -8] })
  }
  st.measureLabel.getElement().textContent = fmtDist(total)
  st.measureLabel.setLngLat(pts.at(-1)).addTo(map)
  if (panel) {
    panel.hidden = false
    panel.innerHTML = `<span>MEDICIÓN · ${pts.length - 1} tramo${pts.length > 2 ? 's' : ''}${cursor ? ' · en vivo' : ''}</span><b>${fmtDist(total)}</b>
      <span>Último tramo ${fmtDist(last)} · rumbo ${String(Math.round(rumbo)).padStart(3, '0')}°</span>
      <span>Geodésica (haversine) · Esc borra · doble clic termina</span>`
  }
}

/** Formulario de nota en el punto elegido (sin diálogos del navegador). */
function askNote(p) {
  const form = document.createElement('form')
  form.className = 'ops-note-form'
  form.innerHTML = `<select aria-label="Tipo de nota">${Object.entries(NOTE_CAT).map(([k, c]) => `<option value="${k}">${c.label}</option>`).join('')}</select>
    <textarea rows="2" maxlength="240" required aria-label="Texto de la nota" placeholder="p. ej., paso a desnivel inundable"></textarea>
    <div class="tool-row"><button class="btn btn-primary" type="submit">Guardar nota</button><button class="btn btn-ghost" type="button" data-cancel>Cancelar</button></div>`
  const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px' }).setLngLat(p).setDOMContent(form).addTo(map)
  form.querySelector('textarea').focus()
  form.querySelector('[data-cancel]').onclick = () => pop.remove()
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    st.notes.push({ id: `n${++st.seq}`, cat: form.querySelector('select').value, text: form.querySelector('textarea').value.trim(), lon: p[0], lat: p[1] })
    pop.remove()
    paintMarks()
    st.onChange()
  })
}

function paintMarks() {
  ensureLayers()
  vis(true)
  for (const [id, m] of st.markers) if (!st.units.some((u) => u.id === id)) { m.remove(); st.markers.delete(id) }
  const cs = callsigns(st.units)
  for (const u of st.marksOnly ? [] : st.units) {
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
    m.getElement().textContent = cs[u.id]
    m.getElement().setAttribute('aria-label', `${UNIT_KINDS[u.kind].label} ${cs[u.id]}`)
  }
  map.getSource('ops-tramos').setData(fc(st.tramos.map((t) => ({ type: 'Feature', properties: { id: t.id }, geometry: { type: 'LineString', coordinates: t.coords } }))))
  map.getSource('ops-draft').setData(fc(st.draft.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: st.tool === 'perimetro' ? [...st.draft, st.draft[0]] : st.draft } }] : []))
  map.getSource('ops-perimeter').setData(fc(st.perimeter.length >= 3 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...st.perimeter, st.perimeter[0]]] } }] : []))
  for (const [id, m] of st.noteMarkers) if (!st.notes.some((n) => n.id === id)) { m.remove(); st.noteMarkers.delete(id) }
  for (const n of st.notes) if (!st.noteMarkers.has(n.id)) st.noteMarkers.set(n.id, new maplibregl.Marker({ element: noteEl(n) }).setLngLat([n.lon, n.lat]).addTo(map))
  paintMeasure()
}

function removeUnit(id) {
  st.units = st.units.filter((u) => u.id !== id)
  paintMarks()
  st.onChange()
}

// ── herramientas ────────────────────────────────────────────────────────────
let keysBound = false

export function setTool(tool, kind) {
  if ((st.tool === 'tramo' || st.tool === 'perimetro') && tool !== st.tool) finishTramo()
  if (st.tool === 'medir' && tool !== 'medir') { st.measure = []; st.measureDone = false; st.tool = tool; paintMeasure() }
  st.tool = tool
  if (kind) st.kind = kind
  map.getCanvas().style.cursor = 'crosshair'
  // mientras se dibuja un tramo, el doble clic lo termina en vez de acercar el mapa
  if (['tramo', 'perimetro', 'medir'].includes(tool)) map.doubleClickZoom.disable()
  else map.doubleClickZoom.enable()
  if (tool === 'medir') paintMeasure()
  if (keysBound) return
  keysBound = true
  map.on('dblclick', () => {
    const min = st.tool === 'perimetro' ? 3 : 2
    if ((st.tool === 'tramo' || st.tool === 'perimetro') && st.draft.length >= min) { st.draft.pop(); finishTramo() }
  })
  map.on('mousemove', (e) => { if (st.tool === 'medir' && st.measure.length && !st.measureDone) paintMeasure(e.lngLat) })
  map.on('dblclick', () => { if (st.tool === 'medir' && st.measure.length > 1) { st.measureDone = true; paintMeasure() } })
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return
    if (st.tool === 'medir' && e.key === 'Escape') { st.measure = []; st.measureDone = false; paintMeasure(); return }
    if (st.tool !== 'tramo' && st.tool !== 'perimetro') return
    if (e.key === 'Enter') finishTramo()
    if (e.key === 'Escape') { st.draft = []; paintMarks() }
  })
}

/** Clic en el mapa con el modo operativo activo. Devuelve true si lo consumió. */
export function onOpsClick(e) {
  const p = [+e.lngLat.lng.toFixed(st.tool === 'medir' ? 7 : 5), +e.lngLat.lat.toFixed(st.tool === 'medir' ? 7 : 5)]
  if (st.tool === 'unit') {
    st.units.push({ id: `${UNIT_KINDS[st.kind].short.toLowerCase()}${++st.seq}`, kind: st.kind, lon: p[0], lat: p[1] })
    paintMarks()
    st.onChange()
    return true
  }
  if (st.tool === 'tramo' || st.tool === 'perimetro') {
    st.draft.push(p)
    paintMarks()
    return true
  }
  if (st.tool === 'nota') { askNote(p); return true }
  if (st.tool === 'cobertura') { import('./sim-coverage.js').then((c) => c.pickComisaria(e.lngLat)); return true }
  if (st.tool === 'incidente') { import('./sim-coverage.js').then((c) => c.incident(e.lngLat)); return true }
  if (st.tool === 'medir') {
    if (st.measureDone) { st.measure = []; st.measureDone = false }   // tras terminar, un clic nuevo empieza otra medición
    if (!st.measure.length || metersBetween(st.measure.at(-1), p) > 0.5) st.measure.push(p)
    paintMeasure()
    return true
  }
  return false
}

/** Unidades colocadas desde fuera (despacho de un incidente): mismas reglas que un clic con la herramienta Unidad. */
export function addUnits(units) {
  for (const u of units) {
    if (!UNIT_KINDS[u.kind]) continue
    if (st.units.some((x) => x.kind === u.kind && Math.abs(x.lon - u.lon) < 1e-5 && Math.abs(x.lat - u.lat) < 1e-5)) continue   // ya despachada
    st.units.push({ id: `${UNIT_KINDS[u.kind].short.toLowerCase()}${++st.seq}`, kind: u.kind, lon: +u.lon.toFixed(5), lat: +u.lat.toFixed(5) })
  }
  paintMarks()
  st.onChange()
}

export function finishTramo() {
  if (st.tool === 'perimetro') {
    if (st.draft.length >= 3) {
      st.perimeter = st.draft
      st.draft = []
      paintMarks()
      st.onChange()
      return true
    }
    st.draft = []
    paintMarks()
    return false
  }
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
  st.perimeter = []
  st.notes = []
  st.measure = []
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
  // estado táctico de cada unidad: en ruta (ida), en escena, retorno o disponible
  const status = {}
  for (const c of r.timeline.calls) if (t >= c.arrive && t < c.clear) status[c.unit] = 'escena'
  for (const tr of r.timeline.trips) {
    if (t < tr.t0 || t > tr.t1 || status[tr.unit] === 'escena') continue
    const call = r.timeline.calls.find((c) => c.id === tr.call)
    status[tr.unit] = call && tr.to[0] === call.lon && tr.to[1] === call.lat ? 'ruta' : 'retorno'
  }
  return { calls, moving, routes, counts, status }
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
  for (const [id, m] of st.markers) m.getElement().dataset.status = s.status[id] || 'disponible'
  renderLog(st.t)
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
  const cs = callsigns(r.params.units)
  const ev = []
  for (const c of r.timeline.calls) {
    ev.push({ t: c.t, kind: 'llamada', text: `LLAMADA #${c.id} · ${CALL_NAME[c.type]}` })
    ev.push({ t: c.dispatch, kind: 'despacho', text: `${cs[c.unit]} DESPACHADO → #${c.id}${c.tramos ? ' · rodeo por tramo' : ''}` })
    ev.push({ t: c.arrive, kind: 'escena', text: `${cs[c.unit]} EN ESCENA #${c.id} · respuesta ${Math.round(c.response)} min` })
    ev.push({ t: c.clear, kind: 'cierre', text: `#${c.id} CERRADA · ${cs[c.unit]} retorna` })
  }
  for (const c of r.timeline.unattended) ev.push({ t: c.t, kind: 'alerta', text: `#${c.id} SIN UNIDAD DISPONIBLE · ${CALL_NAME[c.type]}` })
  setLog(ev.sort((a, b) => a.t - b.t))
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
  import('./sim-coverage.js').then((c) => c.hideCoverage())
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
const STATE_LABEL = { borrador: 'Borrador', configurado: 'Configurado', validado_para_simular: 'Validado', finalizado: 'Finalizado', revisado: 'Revisado', archivado: 'Archivado' }

export function toolbarHtml(scenarioName, state) {
  return `<div class="seg" role="group" aria-label="Unidad a colocar">${Object.entries(UNIT_KINDS).map(([k, u]) =>
      `<button type="button" data-ops-kind="${k}" aria-pressed="${st.tool === 'unit' && st.kind === k}"><i class="ops-dot" style="--unit:var(${u.color})">${u.short}</i>${u.label}</button>`).join('')}</div>
    <button type="button" class="btn" data-ops-tool="tramo" aria-pressed="${st.tool === 'tramo'}">╱ Tramo cortado</button>
    <button type="button" class="btn" data-ops-tool="perimetro" aria-pressed="${st.tool === 'perimetro'}" title="Las llamadas caen dentro del perímetro">⬠ Perímetro</button>
    <button type="button" class="btn" data-ops-tool="nota" aria-pressed="${st.tool === 'nota'}">✎ Nota</button>
    <button type="button" class="btn" data-ops-tool="medir" aria-pressed="${st.tool === 'medir'}">↔ Medir</button>
    <button type="button" class="btn" data-ops-tool="cobertura" aria-pressed="${st.tool === 'cobertura'}" title="Clic cerca de una comisaría: área de atención, radio de inflexión, sedes dentro y estimador de dotación">⌖ Comisaría</button>
    <button type="button" class="btn" data-ops-tool="incidente" aria-pressed="${st.tool === 'incidente'}" title="Clic en un punto crítico: sedes más cercanas, tiempos en paralelo y despacho al escenario">◎ Incidente</button>
    ${st.tool === 'tramo' || st.tool === 'perimetro' ? `<button type="button" class="btn btn-primary" data-ops-tool="finish">Terminar ${st.tool === 'tramo' ? 'tramo' : 'perímetro'}</button>` : ''}
    ${st.perimeter.length ? '<button type="button" class="btn btn-ghost" data-ops-tool="noperim">Quitar perímetro</button>' : ''}
    <button type="button" class="btn btn-ghost" data-ops-tool="clear">Borrar todo</button>
    <span class="ops-scn"><b title="Escenario actual">${esc(scenarioName)}</b>${state ? `<i class="scn-state" data-state="${esc(state)}">${esc(STATE_LABEL[state] || state)}</i>` : ''}
      <button type="button" class="btn" data-scn="save">Guardar</button><button type="button" class="btn" data-scn="dup">Duplicar</button>
      <button type="button" class="btn" data-scn="compare">Comparar</button><button type="button" class="btn" data-scn="report">Informe</button></span>`
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

export function clearPerimeter() {
  st.perimeter = []
  paintMarks()
  st.onChange()
}

export function opsKeyHtml() {
  return Object.values(UNIT_KINDS).map((u) => `<span><i style="background:var(${u.color})"></i>${u.label}</span>`).join('') +
    Object.values(CALL_STATE).map(([v, l]) => `<span><i style="background:var(${v})"></i>llamada ${l}</span>`).join('') +
    '<span><i style="background:var(--danger);border-radius:0"></i>tramo cortado</span><span><i style="background:var(--warn);border-radius:0"></i>perímetro</span>'
}

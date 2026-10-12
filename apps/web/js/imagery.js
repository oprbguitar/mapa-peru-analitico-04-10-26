// Imágenes recientes: Sentinel-2 (10 m, escenas con fecha UTC verificable) o NASA VIIRS color real (diario, GIBS).
// Modos: IMAGEN (sobre el mapa con opacidad), VS MAPA BASE y A / B (cortina arrastrable: un segundo mapa sincronizado
// pinta solo la imagen y se recorta a la derecha de la cortina). Comparación visual: no se infieren cambios.
/* global maplibregl */
import { map, mapReady } from './map.js'
import { cssVar, esc, getJSON, toast } from './util.js'

let panel
let drawing = null
let vertices = []
let area = null
let items = []
const st = { source: 'sentinel', mode: 'image', opacity: 1, a: null, b: null, nasaA: '', nasaB: '', nasaLatest: '' }
let seq = 0
let searchAbort = null
let cmp = null, swipe = null, swipeX = 0.5

export const isDrawingImagery = () => Boolean(drawing)
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const NASA = (date) => `${location.origin}/api/v1/intel/weather/tiles/gibs/truecolor/{z}/{x}/{y}.jpg?date=${date}`

function geometry(points) { return { type: 'Polygon', coordinates: [[...points, points[0]]] } }

function paintArea() {
  const data = { type: 'FeatureCollection', features: area ? [{ type: 'Feature', properties: {}, geometry: area }] : [] }
  if (map.getSource('imagery-aoi')) map.getSource('imagery-aoi').setData(data)
  else {
    map.addSource('imagery-aoi', { type: 'geojson', data })
    map.addLayer({ id: 'imagery-aoi-line', type: 'line', source: 'imagery-aoi', paint: { 'line-color': cssVar('--accent'), 'line-width': 2 } })
  }
  setBadge()
}

function status(message) { const n = panel?.querySelector('#img-status'); if (n) n.textContent = message }
function setBadge() { const b = panel?.querySelector('.img-badge'); if (b) b.textContent = area ? 'ÁREA LISTA' : 'SIN ÁREA' }

function startDrawing(mode) {
  searchAbort?.abort()
  seq++
  drawing = mode
  vertices = []
  map.getCanvas().style.cursor = 'crosshair'
  status(mode === 'rectangle' ? 'Marca dos esquinas opuestas en el mapa.' : 'Marca al menos tres vértices y pulsa «Cerrar polígono».')
  document.dispatchEvent(new Event('imagery-drawing'))
}

export function hideImagery() {
  seq++
  searchAbort?.abort()
  drawing = null
  map.getCanvas().style.cursor = ''
}

/** Al salir del modo Satélite el mapa vuelve limpio: sin escenas, área, cortina ni mapa de comparación. */
export function clearImagery() {
  hideImagery()
  removeMain()
  for (const id of ['imagery-aoi-line']) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource('imagery-aoi')) map.removeSource('imagery-aoi')
  destroyCompare()
  st.a = st.b = null
  area = null
  items = []
}

export async function initImagery() {
  await mapReady
  map.on('click', (event) => {
    if (!drawing) return
    event.originalEvent?.stopPropagation()
    const p = [event.lngLat.lng, event.lngLat.lat]
    if (st.source === 'sentinel' && (p[0] < -81.6 || p[0] > -68.4 || p[1] < -18.6 || p[1] > 0.2)) return status('Selecciona una zona en el Perú.')
    vertices = [...vertices, p]
    if (drawing === 'rectangle' && vertices.length === 2) {
      const [first, last] = vertices
      area = geometry([first, [last[0], first[1]], last, [first[0], last[1]]])
      paintArea()
      hideImagery()
      document.dispatchEvent(new Event('imagery-area-ready'))
      if (panel?.isConnected) st.source === 'sentinel' ? search() : (status('Área lista.'), paint())
    } else status(`${vertices.length} vértices marcados.`)
  })
  map.on('style.load', () => { if (area) paintArea(); paint() })
}

function viewportArea() {
  const b = map.getBounds()
  const w = Math.max(-81.6, b.getWest()), e = Math.min(-68.4, b.getEast())
  const s = Math.max(-18.6, b.getSouth()), n = Math.min(0.2, b.getNorth())
  if (w >= e || s >= n) throw new Error('Mueve el mapa sobre el Perú.')
  if (st.source === 'sentinel' && (e - w) * (n - s) > 4) {
    const c = map.getCenter()
    const cx = Math.min(-68.6, Math.max(-81.4, c.lng)), cy = Math.min(0, Math.max(-18.4, c.lat))
    area = geometry([[cx - 0.15, cy - 0.15], [cx + 0.15, cy - 0.15], [cx + 0.15, cy + 0.15], [cx - 0.15, cy + 0.15]])
    map.fitBounds([[cx - 0.15, cy - 0.15], [cx + 0.15, cy + 0.15]], { padding: 40, duration: reduce() ? 0 : 600 })
    paintArea()
    status('Vista muy amplia: uso un recuadro central de ~0,3°. Marca otra zona con «Seleccionar área».')
    return
  }
  area = geometry([[w, s], [e, s], [e, n], [w, n]])
  paintArea()
  status('Usando el área visible.')
}

// ── fuentes de cada lado ────────────────────────────────────────────────────
function aoiExtent() {
  const pts = area?.coordinates?.[0]
  return pts ? [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))] : null
}

/** Origen raster de un lado: { tiles, bounds?, maxzoom, label } o null. */
function sideSource(side) {
  if (st.source === 'nasa') {
    const d = side === 'a' ? st.nasaA : st.nasaB
    return d ? { tiles: [NASA(d)], maxzoom: 9, label: `NASA VIIRS · ${d}`, attribution: 'NASA EOSDIS GIBS' } : null
  }
  const item = st[side]
  if (!item) return null
  const ext = aoiExtent() || item.bbox
  const bounds = [Math.max(ext[0], item.bbox[0]), Math.max(ext[1], item.bbox[1]), Math.min(ext[2], item.bbox[2]), Math.min(ext[3], item.bbox[3])]
  if (bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) return null
  return { tiles: [location.origin + item.tile_url], bounds, maxzoom: 18, label: `Sentinel‑2 · ${item.acquired_at.slice(0, 10)}`, attribution: 'Copernicus Sentinel-2 · Earth Search' }
}

function removeMain() {
  for (const id of ['imagery-a', 'imagery-b']) {
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
  }
}

function addMain(src, opacity) {
  removeMain()
  if (!src) return
  map.addSource('imagery-a', { type: 'raster', tiles: src.tiles, tileSize: 256, maxzoom: src.maxzoom, ...(src.bounds ? { bounds: src.bounds } : {}), attribution: src.attribution })
  const before = map.getLayer('observed-clouds-raster') ? 'observed-clouds-raster' : map.getStyle().layers.find((l) => l.id === 'departamentos-fill' || l.id.startsWith('pl-') || l.id === 'imagery-aoi-line')?.id
  map.addLayer({ id: 'imagery-a', type: 'raster', source: 'imagery-a', paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 } }, before)
  if (map.getLayer('imagery-aoi-line')) map.moveLayer('imagery-aoi-line')
}

// ── mapa de comparación (segundo mapa sincronizado, recortado por la cortina) ─
function ensureCompare() {
  if (cmp) return
  const box = document.createElement('div')
  box.className = 'img-compare'
  box.setAttribute('aria-hidden', 'true')
  map.getContainer().appendChild(box)
  cmp = new maplibregl.Map({ container: box, interactive: false, attributionControl: false, fadeDuration: 0,
    style: { version: 8, sources: {}, layers: [] }, center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() })
  map.on('move', syncCompare)
  map.on('resize', resizeCompare)
  swipe = document.createElement('div')
  swipe.className = 'sim-swipe img-swipe'
  swipe.setAttribute('role', 'slider')
  swipe.setAttribute('tabindex', '0')
  swipe.setAttribute('aria-valuemin', '0')
  swipe.setAttribute('aria-valuemax', '100')
  swipe.innerHTML = '<span class="sim-swipe-tag" data-side="a"></span><span class="sim-swipe-grip" aria-hidden="true">⟷</span><span class="sim-swipe-tag" data-side="b"></span>'
  map.getContainer().appendChild(swipe)
  const move = (clientX) => {
    const r = map.getContainer().getBoundingClientRect()
    swipeX = Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width))
    placeSwipe()
  }
  swipe.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    swipe.setPointerCapture(e.pointerId)
    swipe.classList.add('dragging')
    const mv = (ev) => move(ev.clientX)
    const up = () => { swipe.classList.remove('dragging'); swipe.removeEventListener('pointermove', mv); swipe.removeEventListener('pointerup', up) }
    swipe.addEventListener('pointermove', mv)
    swipe.addEventListener('pointerup', up)
  })
  swipe.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key]
    if (!d) return
    e.preventDefault()
    swipeX = Math.min(0.97, Math.max(0.03, swipeX + d))
    placeSwipe()
  })
}

function syncCompare() { cmp?.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }) }
function resizeCompare() { cmp?.resize() }
function placeSwipe() {
  if (!swipe) return
  swipe.style.left = `${swipeX * 100}%`
  swipe.setAttribute('aria-valuenow', String(Math.round(swipeX * 100)))
  cmp.getContainer().style.clipPath = `inset(0 0 0 ${swipeX * 100}%)`
}

function setCompare(src, labelA, labelB) {
  ensureCompare()
  if (cmp.getLayer('img')) cmp.removeLayer('img')
  if (cmp.getSource('img')) cmp.removeSource('img')
  if (src) {
    const add = () => {
      cmp.addSource('img', { type: 'raster', tiles: src.tiles, tileSize: 256, maxzoom: src.maxzoom, ...(src.bounds ? { bounds: src.bounds } : {}) })
      cmp.addLayer({ id: 'img', type: 'raster', source: 'img', paint: { 'raster-fade-duration': 0 } })
    }
    cmp.isStyleLoaded() ? add() : cmp.once('load', add)
  }
  swipe.hidden = false
  cmp.getContainer().hidden = false
  swipe.querySelector('[data-side="a"]').textContent = labelA
  swipe.querySelector('[data-side="b"]').textContent = labelB
  swipe.setAttribute('aria-label', `Cortina: izquierda ${labelA}, derecha ${labelB}`)
  syncCompare()
  placeSwipe()
}

function hideCompare() { if (swipe) swipe.hidden = true; if (cmp) cmp.getContainer().hidden = true }

function destroyCompare() {
  if (!cmp) return
  map.off('move', syncCompare)
  map.off('resize', resizeCompare)
  cmp.remove()
  cmp.getContainer().remove()
  swipe.remove()
  cmp = swipe = null
}

/** Aplica el modo: qué va en el mapa principal y qué en el lado derecho de la cortina. */
function paint() {
  if (!panel?.isConnected) return
  const A = sideSource('a'), B = sideSource('b')
  if (st.mode === 'image') { hideCompare(); addMain(A, st.opacity) }
  else if (st.mode === 'base') { removeMain(); setCompare(A, 'Mapa base', A?.label || 'Imagen') }
  else { addMain(A, 1); setCompare(B, A?.label || 'A', B?.label || 'B') }
  const op = panel.querySelector('#img-opacity')
  if (op) op.disabled = st.mode !== 'image' || !A
  const exp = panel.querySelector('#img-export')
  if (exp) exp.disabled = st.source !== 'sentinel' || !st.a || !area
  panel.querySelector('[data-slot="b"]')?.toggleAttribute('hidden', st.mode !== 'ab')
}

// ── Sentinel-2 ──────────────────────────────────────────────────────────────
async function search() {
  searchAbort?.abort()
  searchAbort = new AbortController()
  const requestSeq = ++seq
  const button = panel.querySelector('#img-viewport')
  try {
    if (drawing) throw new Error('Termina de marcar el área antes de buscar.')
    if (!area) viewportArea()
    const [w, s, e, n] = aoiExtent()
    if ((e - w) * (n - s) > 4) throw new Error('Acerca el mapa y marca un área más pequeña (máximo 4 grados cuadrados).')
    button.disabled = true
    status('Consultando adquisiciones Sentinel‑2 en Earth Search…')
    const params = new URLSearchParams({ geometry: JSON.stringify(area), cloud: panel.querySelector('#img-cloud').value })
    for (const name of ['start', 'end']) { const v = panel.querySelector(`#img-${name}`).value; if (v) params.set(name, v) }
    const result = await getJSON(`/api/v1/imagery/search?${params}`, { signal: searchAbort.signal })
    if (seq !== requestSeq || !panel?.isConnected) return
    items = result.items || []
    st.a = items[0] || null
    st.b = items[1] || null
    renderSlots()
    paint()
    status(items.length ? `${items.length} escenas. A = la más reciente${items[1] ? ', B = la anterior' : ''}.` : 'Sin escenas para estas fechas. Amplía el período o la nubosidad en Detalles.')
  } catch (error) { if (error.name !== 'AbortError' && seq === requestSeq) status(error.message) }
  finally { if (button.isConnected && seq === requestSeq) button.disabled = false }
}

async function download() {
  if (!area || !st.a) return status('Selecciona un área y una escena A antes de exportar.')
  const button = panel.querySelector('#img-export')
  button.disabled = true
  try {
    status('Recortando RGB de 10 m con CRS, transformación y fecha incorporados…')
    const params = new URLSearchParams({ id: st.a.id, geometry: JSON.stringify(area) })
    const response = await fetch(`/api/v1/imagery/crop?${params}`)
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'No se pudo exportar el recorte.')
    const url = URL.createObjectURL(await response.blob())
    const link = Object.assign(document.createElement('a'), { href: url, download: `${st.a.id}-recorte.tif` })
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    status('GeoTIFF descargado; conserva georreferenciación y fecha de adquisición.')
  } catch (error) { status(error.message); toast(error.message) }
  finally { button.disabled = false }
}

// ── panel ───────────────────────────────────────────────────────────────────
function slotHtml(side) {
  if (st.source === 'nasa') {
    return `<input type="date" id="img-nasa-${side}" max="${esc(st.nasaLatest)}" min="2012-01-19" value="${esc(side === 'a' ? st.nasaA : st.nasaB)}" aria-label="Fecha de la imagen ${side.toUpperCase()}">`
  }
  return `<select id="img-select-${side}" ${items.length ? '' : 'disabled'} aria-label="Escena ${side.toUpperCase()}"><option value="">Sin escena</option>${items.map((it) =>
    `<option value="${esc(it.id)}" ${st[side]?.id === it.id ? 'selected' : ''}>${esc(it.acquired_at.slice(0, 10))} · nubes ${esc(it.cloud_percent ?? 's/d')} %</option>`).join('')}</select>`
}

function renderSlots() {
  for (const side of ['a', 'b']) {
    const box = panel.querySelector(`[data-slot="${side}"] .img-slot-in`)
    if (box) box.innerHTML = slotHtml(side)
  }
}

export async function openImagery(container) {
  panel = container
  hideImagery()
  if (!st.nasaLatest) {
    try { const r = await getJSON('/api/v1/intel/weather/gibs-range/truecolor'); st.nasaLatest = r.latest || '' } catch { st.nasaLatest = '' }
    if (st.nasaLatest) {
      st.nasaA = st.nasaLatest
      const d = new Date(`${st.nasaLatest}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 1)
      st.nasaB = d.toISOString().slice(0, 10)
    }
  }
  panel.innerHTML = `<div class="img">
    <div class="img-head"><h2>Imágenes recientes</h2><span class="img-badge">${area ? 'ÁREA LISTA' : 'SIN ÁREA'}</span><span class="street-rule" aria-hidden="true"></span></div>
    <div class="img-tools"><button class="btn" type="button" id="img-rectangle">Seleccionar área</button><button class="btn" type="button" id="img-viewport">Usar vista</button>
      <button class="btn" type="button" id="img-clear">Limpiar</button></div>
    <p id="img-status" class="img-status" role="status" aria-live="polite">Selecciona un área o usa la vista.</p>
    <div class="img-box">
      <div class="seg" role="group" aria-label="Fuente"><button type="button" data-src="sentinel" aria-pressed="${st.source === 'sentinel'}">Sentinel‑2 · 10 m</button>
        <button type="button" data-src="nasa" aria-pressed="${st.source === 'nasa'}">NASA · diaria</button></div>
      <div class="seg img-modes" role="group" aria-label="Modo"><button type="button" data-imode="image" aria-pressed="${st.mode === 'image'}">Imagen</button>
        <button type="button" data-imode="base" aria-pressed="${st.mode === 'base'}">vs Mapa base</button><button type="button" data-imode="ab" aria-pressed="${st.mode === 'ab'}">A / B</button></div>
      <div class="img-slot" data-slot="a"><span class="img-slot-k">A</span><div class="img-slot-in">${slotHtml('a')}</div></div>
      <div class="img-slot" data-slot="b" ${st.mode === 'ab' ? '' : 'hidden'}><span class="img-slot-k">B</span><div class="img-slot-in">${slotHtml('b')}</div></div>
    </div>
    <div class="img-row"><label class="img-op"><span>Opacidad</span><input id="img-opacity" type="range" min="0" max="100" value="${st.opacity * 100}"><output>${Math.round(st.opacity * 100)} %</output></label>
      <button class="btn" type="button" id="img-export" disabled title="GeoTIFF de la escena A (Sentinel‑2)">Exportar</button></div>
    <details class="img-details"><summary><b>Detalles</b><span>Fechas, cobertura y fuentes</span></summary>
      <label class="field">Desde <input id="img-start" type="date"></label><label class="field">Hasta <input id="img-end" type="date"></label>
      <label class="field">Nubosidad máxima (%) <input id="img-cloud" type="number" min="0" max="100" value="100"></label>
      <div class="tool-row"><button class="btn" id="img-polygon" type="button">Polígono</button><button class="btn" id="img-close" type="button">Cerrar polígono</button>
        <button class="btn" id="img-search" type="button">Buscar de nuevo</button></div>
      <p class="src-meta">Sentinel‑2 L2A (Copernicus, Earth Search): adquisición UTC por escena, 10 m, nubes de escena completa; GeoTIFF hasta 0,08 grados².
        NASA VIIRS SNPP color real corregido (GIBS): mosaico diario mundial ~375 m, desde 2012. Comparación visual, sin clasificación automática de cambios.</p>
    </details></div>`
  const $ = (s) => panel.querySelector(s)
  $('#img-rectangle').onclick = () => startDrawing('rectangle')
  $('#img-polygon').onclick = () => startDrawing('polygon')
  $('#img-close').onclick = () => {
    if (vertices.length < 3) return status('Marca al menos tres vértices.')
    area = geometry(vertices); paintArea(); hideImagery(); status('Polígono listo.')
    document.dispatchEvent(new Event('imagery-area-ready'))
    if (st.source === 'sentinel') search(); else paint()
  }
  $('#img-viewport').onclick = () => { try { viewportArea(); st.source === 'sentinel' ? search() : paint() } catch (e) { status(e.message) } }
  $('#img-search').onclick = search
  $('#img-export').onclick = download
  $('#img-clear').onclick = () => {
    removeMain(); hideCompare(); st.a = st.b = null; items = []; area = null
    if (map.getSource('imagery-aoi')) map.getSource('imagery-aoi').setData({ type: 'FeatureCollection', features: [] })
    setBadge(); renderSlots(); status('Área e imágenes borradas.')
  }
  panel.querySelector('.img').addEventListener('click', (e) => {
    const s = e.target.closest('[data-src]')
    if (s) {
      st.source = s.dataset.src
      panel.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-pressed', String(b === s)))
      renderSlots(); paint()
      if (st.source === 'sentinel' && area && !items.length) search()
      status(st.source === 'nasa' ? 'NASA: elige la fecha de A (y de B en modo A / B).' : items.length ? `${items.length} escenas.` : 'Selecciona un área o usa la vista para buscar escenas.')
      return
    }
    const m = e.target.closest('[data-imode]')
    if (m) {
      st.mode = m.dataset.imode
      panel.querySelectorAll('[data-imode]').forEach((b) => b.setAttribute('aria-pressed', String(b === m)))
      paint()
    }
  })
  panel.querySelector('.img').addEventListener('change', (e) => {
    const id = e.target.id
    if (id === 'img-select-a' || id === 'img-select-b') { st[id.slice(-1)] = items.find((r) => r.id === e.target.value) || null; paint() }
    if (id === 'img-nasa-a') { st.nasaA = e.target.value; paint() }
    if (id === 'img-nasa-b') { st.nasaB = e.target.value; paint() }
  })
  $('#img-opacity').oninput = (e) => {
    st.opacity = Number(e.target.value) / 100
    e.target.nextElementSibling.textContent = `${e.target.value} %`
    if (map.getLayer('imagery-a') && st.mode === 'image') map.setPaintProperty('imagery-a', 'raster-opacity', st.opacity)
  }
  paint()
}

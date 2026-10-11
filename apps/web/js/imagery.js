// Adquisiciones verificables: el comparador conserva ambas fechas, sin inferir cambios.
import { map, mapReady } from './map.js'
import { cssVar, esc, getJSON, toast } from './util.js'

let panel
let drawing = null
let vertices = []
let area = null
let items = []
let chosen = { a: null, b: null }
let seq = 0
let comparisonOpacity = 0.5
let searchAbort = null

export const isDrawingImagery = () => Boolean(drawing)

function geometry(points) {
  return { type: 'Polygon', coordinates: [[...points, points[0]]] }
}

function paintArea() {
  const data = { type: 'FeatureCollection', features: area ? [{ type: 'Feature', properties: {}, geometry: area }] : [] }
  if (map.getSource('imagery-aoi')) map.getSource('imagery-aoi').setData(data)
  else {
    map.addSource('imagery-aoi', { type: 'geojson', data })
    map.addLayer({ id: 'imagery-aoi-line', type: 'line', source: 'imagery-aoi', paint: { 'line-color': cssVar('--accent') || cssVar('--live-weather'), 'line-width': 2 } })
  }
}

function status(message) {
  const node = panel?.querySelector('#img-status')
  if (node) node.textContent = message
}

function startDrawing(mode) {
  searchAbort?.abort()
  seq++
  const searchButton = panel?.querySelector('#img-search')
  if (searchButton) searchButton.disabled = false
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

/** Al salir del modo Satélite el mapa vuelve limpio: sin escenas ni área marcada. */
export function clearImagery() {
  hideImagery()
  for (const id of ['imagery-a', 'imagery-b', 'imagery-aoi-line']) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of ['imagery-a', 'imagery-b', 'imagery-aoi']) if (map.getSource(id)) map.removeSource(id)
  chosen = { a: null, b: null }
  area = null
  items = []
}

export async function initImagery() {
  await mapReady
  map.on('click', (event) => {
    if (!drawing) return
    event.originalEvent?.stopPropagation()
    const p = [event.lngLat.lng, event.lngLat.lat]
    if (p[0] < -81.6 || p[0] > -68.4 || p[1] < -18.6 || p[1] > 0.2) return status('Selecciona una zona en el Perú.')
    vertices = [...vertices, p]
    if (drawing === 'rectangle' && vertices.length === 2) {
      const [first, last] = vertices
      area = geometry([first, [last[0], first[1]], last, [first[0], last[1]]])
      paintArea()
      hideImagery()
      status('Área lista. Buscando imágenes…')
      document.dispatchEvent(new Event('imagery-area-ready'))
      if (panel?.isConnected) search()
    } else status(`${vertices.length} vértices marcados.`)
  })
  map.on('style.load', () => {
    if (area) paintArea()
    Object.entries(chosen).forEach(([side, item]) => { if (item) showScene(side, item) })
  })
}

function viewportArea() {
  const b = map.getBounds()
  const w = Math.max(-81.6, b.getWest()), e = Math.min(-68.4, b.getEast())
  const s = Math.max(-18.6, b.getSouth()), n = Math.min(0.2, b.getNorth())
  if (w >= e || s >= n) throw new Error('Mueve el mapa sobre el Perú.')
  if ((e - w) * (n - s) > 4) {
    // vista demasiado amplia: se usa un recuadro de ~0,3° en el centro y se acerca el mapa, en vez de no encontrar nada
    const c = map.getCenter()
    const cx = Math.min(-68.6, Math.max(-81.4, c.lng)), cy = Math.min(0, Math.max(-18.4, c.lat))
    area = geometry([[cx - 0.15, cy - 0.15], [cx + 0.15, cy - 0.15], [cx + 0.15, cy + 0.15], [cx - 0.15, cy + 0.15]])
    map.fitBounds([[cx - 0.15, cy - 0.15], [cx + 0.15, cy + 0.15]], { padding: 40, duration: 600 })
    paintArea()
    status('Vista muy amplia: busco en el recuadro central. Marca otra zona con «Seleccionar zona».')
    return
  }
  area = geometry([[w,s],[e,s],[e,n],[w,n]])
  paintArea()
  status('Usando el rectángulo visible.')
}

function showScene(side, item) {
  const points = area?.coordinates?.[0]
  const extent = points ? [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] : item.bbox
  const bounds = [Math.max(extent[0], item.bbox[0]), Math.max(extent[1], item.bbox[1]),
    Math.min(extent[2], item.bbox[2]), Math.min(extent[3], item.bbox[3])]
  if (bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
    status('Esta escena no cruza el área seleccionada. Busca imágenes para la nueva zona.')
    return false
  }
  const id = `imagery-${side}`
  if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(id)) map.removeSource(id)
  // Bounds limit tile requests; polygon masking remains exclusive to the GeoTIFF export.
  map.addSource(id, { type: 'raster', tiles: [location.origin + item.tile_url], tileSize: 256, bounds, maxzoom: 18, attribution: 'Copernicus Sentinel-2 · Earth Search' })
  const before = map.getLayer('observed-clouds-raster') ? 'observed-clouds-raster' : map.getStyle().layers.find((layer) => layer.id === 'departamentos-fill' || layer.id.startsWith('pl-') || layer.id === 'imagery-aoi-line')?.id
  const opacity = side === 'a' ? 1 : comparisonOpacity
  map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 } }, before)
  if (map.getLayer('imagery-a') && map.getLayer('imagery-b')) map.moveLayer('imagery-a', 'imagery-b')
  // Keep selected AOI boundary above both acquisitions.
  if (map.getLayer('imagery-aoi-line')) map.moveLayer('imagery-aoi-line')
  return true
}

function selectScene(side, id) {
  const item = items.find((row) => row.id === id)
  if (!item) return
  if (!showScene(side, item)) {
    panel.querySelector(`#img-select-${side}`).value = chosen[side]?.id || ''
    return
  }
  chosen = { ...chosen, [side]: item }
  panel.querySelector(`#img-date-${side}`).textContent = `${item.acquired_at} · ${item.resolution_m ?? 's/d'} m · nubes ${item.cloud_percent ?? 's/d'} %`
  panel.querySelector(`[data-img-download="${side}"]`).disabled = false
  panel.querySelector('#img-opacity').disabled = !chosen.b
    status('Escena cargando en el mapa. Nubosidad de escena completa.')
}

async function search() {
  searchAbort?.abort()
  searchAbort = new AbortController()
  const requestSeq = ++seq
  const button = panel.querySelector('#img-search')
  try {
    if (drawing) throw new Error('Termina de marcar el área antes de buscar.')
    if (!area) viewportArea()
    const points = area.coordinates[0]
    const width = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]))
    const height = Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))
    if (width * height > 4) throw new Error('Acerca el mapa y vuelve a marcar una zona más pequeña (máximo 4 grados cuadrados).')
    button.disabled = true
    status('Consultando adquisiciones Sentinel-2 en Earth Search…')
    const params = new URLSearchParams({ geometry: JSON.stringify(area), cloud: panel.querySelector('#img-cloud').value })
    for (const name of ['start', 'end']) {
      const value = panel.querySelector(`#img-${name}`).value
      if (value) params.set(name, value)
    }
    const result = await getJSON(`/api/v1/imagery/search?${params}`, { signal: searchAbort.signal })
    if (seq !== requestSeq || !panel?.isConnected) return
    items = result.items || []
    clearScene('a')
    clearScene('b')
    renderSceneOptions()
    if (items.length) {
      panel.querySelector('#img-select-a').value = items[0].id
      selectScene('a', items[0].id)
    }
    status(items.length ? `${items.length} escenas disponibles. Elige otra fecha para comparar.` : 'No hay escenas para estas fechas. Amplía el período o la nubosidad en Opciones.')
  } catch (error) { if (error.name !== 'AbortError' && seq === requestSeq) status(error.message) }
  finally { if (button.isConnected && seq === requestSeq) button.disabled = false }
}

async function download(side) {
  if (!area || !chosen[side]) return status('Selecciona un área y una adquisición antes de descargar.')
  const button = panel.querySelector(`[data-img-download="${side}"]`)
  button.disabled = true
  try {
    status('Recortando RGB de 10 m con CRS, transformación y fecha incorporados…')
    const params = new URLSearchParams({ id: chosen[side].id, geometry: JSON.stringify(area) })
    const response = await fetch(`/api/v1/imagery/crop?${params}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || 'No se pudo exportar el recorte.')
    }
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = `${chosen[side].id}-recorte.tif`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    status('GeoTIFF descargado; conserva georreferenciación y fecha de adquisición.')
  } catch (error) { status(error.message); toast(error.message) }
  finally { button.disabled = false }
}

function clearScene(side) {
  const id = `imagery-${side}`
  if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(id)) map.removeSource(id)
  chosen = { ...chosen, [side]: null }
  panel.querySelector(`#img-select-${side}`).value = ''
  panel.querySelector(`#img-date-${side}`).textContent = 'Sin seleccionar'
  panel.querySelector(`[data-img-download="${side}"]`).disabled = true
  panel.querySelector('#img-opacity').disabled = !chosen.b
}

function renderSceneOptions() {
  for (const side of ['a', 'b']) {
    const select = panel.querySelector(`#img-select-${side}`)
    const rows = [...items]
    if (chosen[side] && !rows.some(row => row.id === chosen[side].id)) rows.push(chosen[side])
    select.innerHTML = '<option value="">Sin seleccionar</option>' + rows.map(item =>
      `<option value="${esc(item.id)}">${esc(item.acquired_at.slice(0, 10))} · ${esc(item.cloud_percent ?? 's/d')} % nubes</option>`).join('')
    select.value = chosen[side]?.id || ''
    select.disabled = !rows.length
  }
}

export function openImagery(container) {
  panel = container
  hideImagery()
  panel.innerHTML = `<h2>Satélite · comparar fechas</h2>
    <p class="note">Sentinel-2 · adquisición UTC verificable.</p>
    <div class="tool-row"><button id="img-rectangle" type="button">Seleccionar zona</button><button id="img-search" type="button">Buscar imágenes</button></div>
    <p id="img-status" class="note" role="status" aria-live="polite">Marca dos esquinas o busca en el área visible.</p>
    <label>Imagen A <select id="img-select-a" disabled></select></label><p id="img-date-a" class="src-meta">Sin seleccionar</p>
    <label>Comparar con B <select id="img-select-b" disabled></select></label><p id="img-date-b" class="src-meta">Sin seleccionar</p>
    <label>Mezcla A / B <input id="img-opacity" type="range" min="0" max="100" value="50" disabled></label>
    <details id="img-advanced" class="imagery-options"><summary>Fechas, filtros y descarga</summary>
      <label>Desde <input id="img-start" type="date"></label><label>Hasta <input id="img-end" type="date"></label>
      <label>Nubosidad máxima (%) <input id="img-cloud" type="number" min="0" max="100" value="100"></label>
      <div class="tool-row"><button id="img-polygon" type="button">Polígono</button><button id="img-close" type="button">Cerrar polígono</button><button id="img-viewport" type="button">Usar área visible</button></div>
      <div class="tool-row"><button type="button" data-img-download="a" disabled>Descargar A</button><button type="button" data-img-download="b" disabled>Descargar B</button><button type="button" id="img-clear">Quitar imágenes</button></div>
      <p class="note">GeoTIFF hasta 0,08 grados cuadrados. Nubes de escena completa. Comparación visual, sin clasificación automática de cambios.</p>
    </details>`
  panel.querySelectorAll('label').forEach((label) => label.classList.add('field'))
  panel.querySelectorAll('button').forEach((button) => button.classList.add('btn'))
  panel.querySelector('#img-rectangle').onclick = () => startDrawing('rectangle')
  panel.querySelector('#img-polygon').onclick = () => startDrawing('polygon')
  panel.querySelector('#img-close').onclick = () => {
    if (vertices.length < 3) return status('Marca al menos tres vértices.')
    area = geometry(vertices)
    paintArea()
    hideImagery()
    status('Polígono listo para consultar.')
    document.dispatchEvent(new Event('imagery-area-ready'))
  }
  panel.querySelector('#img-viewport').onclick = () => { try { viewportArea() } catch (error) { status(error.message) } }
  panel.querySelector('#img-search').onclick = search
  panel.querySelector('#img-opacity').oninput = (event) => {
    comparisonOpacity = Number(event.target.value) / 100
    if (map.getLayer('imagery-b')) map.setPaintProperty('imagery-b', 'raster-opacity', comparisonOpacity)
  }
  panel.querySelector('#img-opacity').value = String(comparisonOpacity * 100)
  renderSceneOptions()
  for (const side of ['a', 'b']) {
    panel.querySelector(`#img-select-${side}`).onchange = event => event.target.value ? selectScene(side, event.target.value) : clearScene(side)
    if (chosen[side]) {
      panel.querySelector(`#img-date-${side}`).textContent = `${chosen[side].acquired_at} · ${chosen[side].resolution_m ?? 's/d'} m`
      panel.querySelector(`[data-img-download="${side}"]`).disabled = false
    }
  }
  panel.querySelector('#img-opacity').disabled = !chosen.b
  panel.querySelector('#img-clear').onclick = () => {
    clearScene('a')
    clearScene('b')
    status('Imágenes retiradas del mapa.')
  }
  panel.querySelectorAll('[data-img-download]').forEach((button) => { button.onclick = () => download(button.dataset.imgDownload) })
}

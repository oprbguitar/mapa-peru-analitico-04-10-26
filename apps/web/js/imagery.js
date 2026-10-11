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
  drawing = mode
  vertices = []
  map.getCanvas().style.cursor = 'crosshair'
  status(mode === 'rectangle' ? 'Marca dos esquinas opuestas en el mapa.' : 'Marca al menos tres vértices y pulsa «Cerrar polígono».')
  document.dispatchEvent(new Event('imagery-drawing'))
}

export function hideImagery() {
  seq++
  drawing = null
  map.getCanvas().style.cursor = ''
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
      status('Área lista. Busca adquisiciones recientes o un período histórico.')
      document.dispatchEvent(new Event('imagery-area-ready'))
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
  area = geometry([[w,s],[e,s],[e,n],[w,n]])
  paintArea()
  status('Usando el rectángulo visible. Acerca el mapa si el área es muy grande.')
}

function showScene(side, item) {
  const id = `imagery-${side}`
  if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(id)) map.removeSource(id)
  map.addSource(id, { type: 'raster', tiles: [location.origin + item.tile_url], tileSize: 256, bounds: item.bbox, maxzoom: 18, attribution: 'Copernicus Sentinel-2 · Earth Search' })
  const before = map.getLayer('observed-clouds-raster') ? 'observed-clouds-raster' : map.getStyle().layers.find((layer) => layer.id === 'departamentos-fill' || layer.id.startsWith('pl-') || layer.id === 'imagery-aoi-line')?.id
  const opacity = side === 'a' ? 1 : comparisonOpacity
  map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 } }, before)
  if (map.getLayer('imagery-a') && map.getLayer('imagery-b')) map.moveLayer('imagery-a', 'imagery-b')
  // Keep selected AOI boundary above both acquisitions.
  if (map.getLayer('imagery-aoi-line')) map.moveLayer('imagery-aoi-line')
}

function selectScene(side, id) {
  const item = items.find((row) => row.id === id)
  if (!item) return
  chosen = { ...chosen, [side]: item }
  showScene(side, item)
  panel.querySelector(`#img-date-${side}`).textContent = `${side.toUpperCase()}: ${item.acquired_at} · ${item.resolution_m} m · nubes ${item.cloud_percent ?? 's/d'} %`
  status('Nubes: porcentaje de la escena completa. La superposición no calcula cambios ni acredita su causa.')
}

async function search() {
  const requestSeq = ++seq
  const button = panel.querySelector('#img-search')
  try {
    if (!area) viewportArea()
    button.disabled = true
    status('Consultando adquisiciones Sentinel-2 en Earth Search…')
    const params = new URLSearchParams({ geometry: JSON.stringify(area), cloud: panel.querySelector('#img-cloud').value })
    for (const name of ['start', 'end']) {
      const value = panel.querySelector(`#img-${name}`).value
      if (value) params.set(name, value)
    }
    const result = await getJSON(`/api/v1/imagery/search?${params}`)
    if (seq !== requestSeq || !panel?.isConnected) return
    items = result.items || []
    panel.querySelector('#img-results').innerHTML = items.map((item) => `<div class="src-meta"><b>${esc(item.acquired_at)}</b><br>${esc(item.resolution_m)} m · nubosidad ${esc(item.cloud_percent ?? 's/d')} %<br><button type="button" data-img-side="a" data-img-id="${esc(item.id)}">Usar A</button> <button type="button" data-img-side="b" data-img-id="${esc(item.id)}">Usar B</button></div>`).join('')
    status(items.length ? `${items.length} adquisiciones${result.truncated ? ' · se muestra el límite más reciente' : ''}. Fechas UTC de adquisición; no de publicación.` : 'Sin adquisiciones para este filtro. Amplía el período o la nubosidad.')
  } catch (error) { status(error.message) }
  finally { if (button.isConnected) button.disabled = false }
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

export function openImagery(container) {
  panel = container
  hideImagery()
  panel.innerHTML = `<h2>Imágenes satelitales con fecha</h2>
    <p class="note">Sentinel-2 RGB · 10 m · Copernicus. Una escena puede cubrir solo parte del área. Nubosidad de escena; no de recorte.</p>
    <div class="tool-row"><button id="img-rectangle" type="button">Dibujar rectángulo</button><button id="img-polygon" type="button">Dibujar polígono</button><button id="img-close" type="button">Cerrar polígono</button><button id="img-viewport" type="button">Área visible</button></div>
    <label>Desde <input id="img-start" type="date"></label><label>Hasta <input id="img-end" type="date"></label>
    <label>Nubosidad máxima (%) <input id="img-cloud" type="number" min="0" max="100" value="100"></label>
    <button id="img-search" type="button">Buscar adquisiciones</button>
    <p id="img-status" class="note" role="status" aria-live="polite">Selecciona un área. Sin fechas, se recuperan las escenas más recientes disponibles.</p>
    <h3>Comparación histórica por superposición</h3><p id="img-date-a" class="src-meta">A: sin seleccionar</p><p id="img-date-b" class="src-meta">B: sin seleccionar</p>
    <label>Opacidad de B <input id="img-opacity" type="range" min="0" max="100" value="50"></label>
    <div class="tool-row"><button type="button" data-img-download="a">GeoTIFF A</button><button type="button" data-img-download="b">GeoTIFF B</button><button type="button" id="img-clear">Ocultar imágenes</button></div>
    <p class="note">Comparación visual: deforestación, expansión urbana, minería e inundaciones requieren interpretación y validación adicional. Exportación hasta 0,08 grados cuadrados.</p><div id="img-results"></div>`
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
  }
  panel.querySelector('#img-viewport').onclick = () => { try { viewportArea() } catch (error) { status(error.message) } }
  panel.querySelector('#img-search').onclick = search
  panel.querySelector('#img-opacity').oninput = (event) => {
    comparisonOpacity = Number(event.target.value) / 100
    if (map.getLayer('imagery-b')) map.setPaintProperty('imagery-b', 'raster-opacity', comparisonOpacity)
  }
  panel.querySelector('#img-opacity').value = String(comparisonOpacity * 100)
  for (const side of ['a', 'b']) if (chosen[side]) panel.querySelector(`#img-date-${side}`).textContent = `${side.toUpperCase()}: ${chosen[side].acquired_at} · ${chosen[side].resolution_m ?? 's/d'} m`
  panel.querySelector('#img-clear').onclick = () => {
    for (const side of ['a', 'b']) {
      const id = `imagery-${side}`
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
    chosen = { a: null, b: null }
  }
  panel.querySelectorAll('[data-img-download]').forEach((button) => { button.onclick = () => download(button.dataset.imgDownload) })
  panel.querySelector('#img-results').onclick = (event) => {
    const button = event.target.closest('[data-img-side]')
    if (button) selectScene(button.dataset.imgSide, button.dataset.imgId)
  }
}

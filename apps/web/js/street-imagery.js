/* Self-origin Mapillary metadata/photo proxy. No credentials enter the DOM or browser URLs. */
import { map } from './map.js'
const SOURCE = 'street-mapillary'
const LAYER = 'street-mapillary-points'

function node(tag, text, attributes = {}) {
  const element = document.createElement(tag)
  if (tag === 'button') element.className = 'btn'
  if (text) element.textContent = text
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}

export function mountStreetImagery(map, container) {
  const search = node('button', 'Buscar imágenes en esta vista', { type: 'button' })
  const clear = node('button', 'Ocultar fotografías', { type: 'button' })
  const status = node('p', 'Acérquese al lugar y consulte fotos existentes. Requiere clave Mapillary.', { role: 'status', 'aria-live': 'polite' })
  const list = node('select', '', { 'aria-label': 'Fotografía geolocalizada Mapillary' })
  const photo = node('div')
  const label = node('label', '', { class: 'field' })
  label.append(node('span', 'Fotografía geolocalizada'), list)
  container.append(node('h2', 'Imágenes a nivel de calle'), search, clear, status, label, photo)
  let items = [], request = null, destroyed = false
  const restore = () => {
    if (destroyed || !items.length) return
    const data = { type: 'FeatureCollection', features: items.map((item) => ({ type: 'Feature',
      properties: { id: item.id }, geometry: { type: 'Point', coordinates: [item.lon, item.lat] } })) }
    if (map.getSource(SOURCE)) map.getSource(SOURCE).setData(data)
    else map.addSource(SOURCE, { type: 'geojson', data })
    if (!map.getLayer(LAYER)) {
      const color = getComputedStyle(document.documentElement).getPropertyValue('--support').trim()
      map.addLayer({ id: LAYER, type: 'circle', source: SOURCE, paint: { 'circle-radius': 5,
        'circle-color': color, 'circle-stroke-color': getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), 'circle-stroke-width': 1 } })
    }
  }
  const hide = () => {
    request?.abort(); items = []; photo.replaceChildren(); list.replaceChildren()
    if (map.getLayer(LAYER)) map.removeLayer(LAYER)
    if (map.getSource(SOURCE)) map.removeSource(SOURCE)
  }
  const show = (id) => {
    const item = items.find((row) => row.id === id)
    if (!item) return
    list.value = id
    photo.replaceChildren()
    const image = node('img', '', { src: item.thumbnail, alt: `Mapillary: fotografía geolocalizada en ${item.lat}, ${item.lon}`,
      loading: 'lazy', referrerpolicy: 'no-referrer', width: '320' })
    image.onerror = () => { status.textContent = 'La fotografía no está disponible; abra la fuente Mapillary.'; image.remove() }
    const date = item.captured_at ? new Date(item.captured_at).toLocaleString('es-PE', { timeZone: 'UTC' }) + ' UTC' : 'Fecha no publicada'
    photo.append(image, node('p', `Mapillary / colaboradores · Capturada: ${date}`),
      node('a', 'Abrir fotografía y atribución en Mapillary', { href: item.url, target: '_blank', rel: 'noopener noreferrer' }))
    map.easeTo({ center: [item.lon, item.lat], duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400 })
  }
  search.onclick = async () => {
    request?.abort(); request = new AbortController(); search.disabled = true
    status.textContent = 'Consultando cobertura fotográfica…'
    try {
      const b = map.getBounds()
      if (b.getEast() - b.getWest() > .25 || b.getNorth() - b.getSouth() > .25) throw new Error('Acérquese al mapa: máximo 0.25 grados por lado para imágenes de calle.')
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',')
      const response = await fetch('/api/v1/street/images?bbox=' + encodeURIComponent(bbox), { signal: request.signal })
      const result = await response.json(), data = result.data || result
      if (destroyed) return
      if (!response.ok || result.error) throw new Error(result.error || 'Mapillary no respondió.')
      hide(); items = data.items || []
      status.textContent = data.status === 'key_required' ? data.note : items.length ?
        `${items.length} fotografías${data.truncated ? ' · muestra limitada; acerque el mapa para completar' : ''}. Seleccione un punto o una fotografía.` :
        'No se encontraron fotografías en esta consulta; la cobertura comunitaria puede ser incompleta.'
      list.append(node('option', 'Seleccione una fotografía', { value: '' }))
      for (const item of items) list.append(node('option', `${item.id} · ${item.captured_at?.slice(0, 10) || 'sin fecha'}`, { value: item.id }))
      restore()
    } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message }
    finally { search.disabled = false }
  }
  clear.onclick = () => { hide(); status.textContent = 'Fotografías ocultas.' }
  list.onchange = () => show(list.value)
  const click = (event) => {
    if (!map.getLayer(LAYER)) return
    const hits = map.queryRenderedFeatures(event.point, { layers: [LAYER] })
    if (hits.length) show(String(hits[0].properties.id))
  }
  map.on('click', click); map.on('style.load', restore)
  return { destroy() { destroyed = true; hide(); map.off('click', click); map.off('style.load', restore); container.replaceChildren() } }
}

let activeStreet = null
export function openStreetImagery(container) {
  hideStreetImagery()
  container.replaceChildren()
  activeStreet = mountStreetImagery(map, container)
}
export function hideStreetImagery() { activeStreet?.destroy(); activeStreet = null }

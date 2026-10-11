// Cobertura móvil OSIPTEL a nivel de centro poblado y objetos telecom comunitarios OSM.
/* global maplibregl */
import { ensurePointLayer, map, mapReady, onStyleReady, ptFeature, setPoints } from './map.js'
import { esc, fmt, getJSON, kindBadge, state } from './util.js'
import { setLiveMeta } from './rail.js'

const OSM_COLORS = { mobile: '--live-weather', antenna: '--live-port', tower: '--kind-ia' }
const OSM_LABELS = { mobile: 'Antena móvil registrada', antenna: 'Antena de telecomunicaciones', tower: 'Torre de comunicación' }
const osmSelected = new Set()
let coverageEnabled = false
let coverageSeq = 0
let osmSeq = 0
let refreshTimer
let popup
let coverageFilters = {}
let coverageFeatures = []
let osmFeatures = []

function restoreLayers() {
  ensurePointLayer('pl-mobile-coverage', { colorBy: 'estado_cobertura', colors: { cobertura_declarada: '--live-weather', cero_declarado: '--ink-muted' }, radius: 5, onClick: pointPopup })
  ensurePointLayer('pl-telecom-osm', { colors: OSM_COLORS, radius: 6, onClick: pointPopup })
  setPoints('pl-mobile-coverage', coverageFeatures, coverageEnabled)
  setPoints('pl-telecom-osm', osmFeatures, osmSelected.size > 0)
}

function osmStatus(message) {
  for (const category of osmSelected) setLiveMeta(`telecom:${category}`, message)
  return message
}

const bounds = () => {
  const b = map.getBounds()
  const west = Math.max(b.getWest(), -81.6)
  const south = Math.max(b.getSouth(), -18.6)
  const east = Math.min(b.getEast(), -68.4)
  const north = Math.min(b.getNorth(), 0.2)
  return west < east && south < north ? [west, south, east, north].map((x) => x.toFixed(4)).join(',') : null
}

function pointPopup(feature, lngLat) {
  const p = feature.properties
  if (p.cat === 'coverage') {
    const operator = p.operadora === 'Mayor valor entre las operadoras' ? 'Mayor valor reportado entre operadoras' : p.operadora
    const provenance = `<div class="src-meta">OSIPTEL · cobertura reportada por las operadoras · ${esc(p.periodo || 'período no publicado')} · ${esc(p.descargado || 'descarga no publicada')}</div>`
    popup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 8 })
    return popup.setLngLat(lngLat).setHTML(`<div class="pop-title">${esc(p.centro_poblado)}</div>${kindBadge('oficial', 'OSIPTEL · declarado')}
      <div class="pop-row"><span>Cobertura ${esc(p.tecnologia)}</span><b>${fmt(p.cobertura, 1)} %</b></div>
      <div class="pop-row"><span>Medida</span><b>${esc(p.medida)}</b></div><div class="pop-row"><span>Operadora</span><b>${esc(operator)}</b></div>
      <div class="src-meta">${esc(p.clasificacion)} · ${esc(p.distrito)}, ${esc(p.provincia)}, ${esc(p.departamento)}</div>${provenance}
      <div class="note">${p.estado_cobertura === 'cero_declarado' ? 'Cero declarado para los filtros seleccionados; no descarta otras redes. ' : ''}La coordenada ubica el centro poblado; no es una antena ni una medición independiente de señal.</div>`).addTo(map)
  }
  popup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 8 })
  const link = `https://www.openstreetmap.org/${encodeURIComponent(p.osm_type)}/${encodeURIComponent(p.osm_id)}`
  return popup.setLngLat(lngLat).setHTML(`<div class="pop-title">${esc(p.nombre)}</div>${kindBadge('vivo_tercero', 'OpenStreetMap · ODbL')}
    <div class="pop-row"><span>Etiqueta</span><b>${esc(OSM_LABELS[p.cat] || p.cat)}</b></div>
    <div class="pop-row"><span>Operador</span><b>${esc(p.operador || 'No consta')}</b></div>
    <div class="pop-row"><span>Tecnologías registradas</span><b>${esc(p.tecnologias || 'No constan')}</b></div>
    ${p.distancia_centro_vista_km != null ? `<div class="pop-row"><span>Al centro de la vista</span><b>${fmt(p.distancia_centro_vista_km, 2)} km</b></div>` : ''}
    ${p.altura ? `<div class="pop-row"><span>Altura registrada</span><b>${esc(p.altura)}</b></div>` : ''}
    <div class="src-meta">Revisión OSM: ${esc(p.osm_timestamp || 'no publicada')} · consulta: ${esc(p.retrieved_at || 'no publicada')}</div>
    <a href="${link}" target="_blank" rel="noopener noreferrer">Ver objeto OSM</a>
    <div class="note">Proximidad calculada por Haversine al centro de la vista consultada. Registro comunitario incompleto: no acredita operación, intensidad de señal ni ausencia de cobertura.</div>`).addTo(map)
}

export async function initTelecom() {
  await mapReady
  restoreLayers()
  onStyleReady(restoreLayers)
  map.on('moveend', () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      if (coverageEnabled) refreshCoverage()
      if (osmSelected.size) refreshOsm()
    }, 350)
  })
}

export async function toggleCoverage(enabled, filters = {}) {
  coverageEnabled = enabled
  if (!enabled) {
    coverageSeq++
    coverageFeatures = []
    setPoints('pl-mobile-coverage', [], false)
    return ''
  }
  return refreshCoverage(filters)
}

export async function refreshCoverage(filters = {}) {
  if (!coverageEnabled) return ''
  const seq = ++coverageSeq
  coverageFilters = { ...coverageFilters, ...filters }
  const operator = filters.operator || document.getElementById('sel-cov-op')?.value || coverageFilters.operator || 'all'
  const technology = filters.technology || document.getElementById('sel-cov-tech')?.value || coverageFilters.technology || '4g'
  const scope = filters.scope || document.getElementById('sel-cov-scope')?.value || coverageFilters.scope || 'cg'
  const status = filters.status || document.getElementById('sel-cov-status')?.value || state.mobileStatus || coverageFilters.status || 'covered'
  const extent = bounds()
  if (!extent) {
    coverageFeatures = []
    setPoints('pl-mobile-coverage', [], true)
    const message = 'Mueve el mapa sobre el Perú para consultar la cobertura.'
    setLiveMeta('telecom:coverage', message)
    return message
  }
  setLiveMeta('telecom:coverage', 'Consultando cobertura declarada…')
  const query = new URLSearchParams({ bbox: extent, operator, technology, scope, status })
  const data = await getJSON(`/api/v1/intel/layers/mobile-coverage?${query}`).catch((e) => ({ available: false, reason: e.message }))
  if (seq !== coverageSeq || !coverageEnabled) return ''
  if (!data.available) {
    coverageFeatures = []
    setPoints('pl-mobile-coverage', [], true)
    const message = data.reason || 'fuente no disponible'
    setLiveMeta('telecom:coverage', message)
    return message
  }
  const source = data.provenance?.[0] || {}
  const features = data.items.map((item) => ptFeature(item.lon, item.lat, { ...item, cat: 'coverage', periodo: source.coverage_end || source.period || '', descargado: source.downloaded || '' }))
  coverageFeatures = features
  setPoints('pl-mobile-coverage', features, true)
  const message = `${features.length.toLocaleString('es-PE')}${data.truncated ? ' · límite de vista' : ''} centros poblados${status === 'uncovered' ? ' · cero declarado' : ''}`
  setLiveMeta('telecom:coverage', message)
  return message
}

export async function toggleOsm(category, enabled) {
  enabled ? osmSelected.add(category) : osmSelected.delete(category)
  if (!osmSelected.size) {
    osmSeq++
    osmFeatures = []
    setPoints('pl-telecom-osm', [], false)
    return ''
  }
  const b = map.getBounds()
  if (enabled && (b.getEast() - b.getWest()) * (b.getNorth() - b.getSouth()) > 8) {
    const center = map.getCenter()
    const inside = center.lng >= -81.6 && center.lng <= -68.4 && center.lat >= -18.6 && center.lat <= 0.2
    const target = inside ? [center.lng, center.lat] : [-77.04, -12.05]
    map.jumpTo({ center: target, zoom: 10 })
    clearTimeout(refreshTimer)
    osmStatus('Área acercada para consultar antenas; mueve el mapa para explorar.')
  }
  return refreshOsm()
}

async function refreshOsm() {
  const seq = ++osmSeq
  const extent = bounds()
  if (!extent) {
    osmFeatures = []
    setPoints('pl-telecom-osm', [], true)
    return osmStatus('Mueve el mapa sobre el Perú para consultar infraestructura.')
  }
  osmStatus('Consultando infraestructura OSM…')
  const query = new URLSearchParams({ bbox: extent, cat: [...osmSelected].join(',') })
  const data = await getJSON(`/api/v1/intel/layers/telecom?${query}`).catch((e) => ({ available: false, reason: e.message }))
  if (seq !== osmSeq || !osmSelected.size) return ''
  if (!data.available) {
    const message = data.reason || 'infraestructura OSM no disponible'
    return osmStatus(`${message}${osmFeatures.length ? ' · conservando consulta anterior' : ''}`)
  }
  osmFeatures = data.items.map((item) => ptFeature(item.lon, item.lat, { ...item, retrieved_at: data.retrieved_at }))
  setPoints('pl-telecom-osm', osmFeatures, true)
  return osmStatus(`${data.items.length.toLocaleString('es-PE')} objetos OSM${data.truncated ? ' · inventario truncado: acerca el mapa' : ''}${data.retrieved_at ? ` · ${data.retrieved_at.slice(11, 16)} UTC` : ''}${!data.items.length ? ' · sin registros, cobertura desconocida' : ''}`)
}

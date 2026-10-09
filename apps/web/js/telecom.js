// Cobertura móvil OSIPTEL a nivel de centro poblado y objetos telecom comunitarios OSM.
/* global maplibregl */
import { ensurePointLayer, map, mapReady, ptFeature, setPoints } from './map.js'
import { esc, fmt, getJSON, kindBadge, toast } from './util.js'

const OSM_COLORS = { mobile: '--live-weather', antenna: '--live-port', tower: '--kind-ia' }
const OSM_LABELS = { mobile: 'Antena móvil registrada', antenna: 'Antena de telecomunicaciones', tower: 'Torre de comunicación' }
const osmSelected = new Set()
let coverageEnabled = false
let coverageSeq = 0
let osmSeq = 0
let refreshTimer
let popup

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
    const provenance = '<div class="src-meta">OSIPTEL · cobertura reportada por las operadoras · corte 2025</div>'
    popup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 8 })
    return popup.setLngLat(lngLat).setHTML(`<div class="pop-title">${esc(p.centro_poblado)}</div>${kindBadge('oficial', 'OSIPTEL · declarado')}
      <div class="pop-row"><span>Cobertura ${esc(p.tecnologia)}</span><b>${fmt(p.cobertura, 1)} %</b></div>
      <div class="pop-row"><span>Medida</span><b>${esc(p.medida)}</b></div><div class="pop-row"><span>Operadora</span><b>${esc(operator)}</b></div>
      <div class="src-meta">${esc(p.clasificacion)} · ${esc(p.distrito)}, ${esc(p.provincia)}, ${esc(p.departamento)}</div>${provenance}
      <div class="note">La coordenada ubica el centro poblado; no es una antena ni una medición independiente de señal.</div>`).addTo(map)
  }
  popup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '340px', offset: 8 })
  const link = `https://www.openstreetmap.org/${encodeURIComponent(p.osm_type)}/${encodeURIComponent(p.osm_id)}`
  return popup.setLngLat(lngLat).setHTML(`<div class="pop-title">${esc(p.nombre)}</div>${kindBadge('vivo_tercero', 'OpenStreetMap · ODbL')}
    <div class="pop-row"><span>Etiqueta</span><b>${esc(OSM_LABELS[p.cat] || p.cat)}</b></div>
    ${p.operador ? `<div class="pop-row"><span>Operador</span><b>${esc(p.operador)}</b></div>` : ''}
    ${p.altura ? `<div class="pop-row"><span>Altura registrada</span><b>${esc(p.altura)}</b></div>` : ''}
    <a href="${link}" target="_blank" rel="noopener noreferrer">Ver objeto OSM</a>
    <div class="note">Registro comunitario; puede estar incompleto y no acredita que la estación esté operativa.</div>`).addTo(map)
}

export async function initTelecom() {
  await mapReady
  ensurePointLayer('pl-mobile-coverage', { colorBy: 'cat', colors: { coverage: '--live-weather' }, radius: 5, minzoom: 5.5, onClick: pointPopup })
  ensurePointLayer('pl-telecom-osm', { colors: OSM_COLORS, radius: 6, minzoom: 8, onClick: pointPopup })
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
    setPoints('pl-mobile-coverage', [], false)
    return ''
  }
  return refreshCoverage(filters)
}

export async function refreshCoverage(filters = {}) {
  if (!coverageEnabled) return ''
  const seq = ++coverageSeq
  const operator = filters.operator || document.getElementById('sel-cov-op')?.value || 'all'
  const technology = filters.technology || document.getElementById('sel-cov-tech')?.value || '4g'
  const scope = filters.scope || document.getElementById('sel-cov-scope')?.value || 'cg'
  const extent = bounds()
  if (!extent) return 'Mueve el mapa sobre el Perú para consultar la cobertura.'
  const query = new URLSearchParams({ bbox: extent, operator, technology, scope })
  const data = await getJSON(`/api/v1/intel/layers/mobile-coverage?${query}`).catch((e) => ({ available: false, reason: e.message }))
  if (seq !== coverageSeq || !coverageEnabled) return ''
  if (!data.available) {
    setPoints('pl-mobile-coverage', [], true)
    return data.reason || 'fuente no disponible'
  }
  const features = data.items.map((item) => ptFeature(item.lon, item.lat, { ...item, cat: 'coverage' }))
  setPoints('pl-mobile-coverage', features, true)
  return `${features.length.toLocaleString('es-PE')}${data.truncated ? ' · límite de vista' : ''} centros poblados`
}

export async function toggleOsm(category, enabled) {
  enabled ? osmSelected.add(category) : osmSelected.delete(category)
  if (!osmSelected.size) {
    setPoints('pl-telecom-osm', [], false)
    return ''
  }
  return refreshOsm()
}

async function refreshOsm() {
  const seq = ++osmSeq
  const extent = bounds()
  if (!extent) return 'Mueve el mapa sobre el Perú para consultar infraestructura.'
  const query = new URLSearchParams({ bbox: extent, cat: [...osmSelected].join(',') })
  const data = await getJSON(`/api/v1/intel/layers/telecom?${query}`).catch((e) => ({ available: false, reason: e.message }))
  if (seq !== osmSeq || !osmSelected.size) return ''
  if (!data.available) {
    setPoints('pl-telecom-osm', [], true)
    return data.reason || 'infraestructura OSM no disponible'
  }
  setPoints('pl-telecom-osm', data.items.map((item) => ptFeature(item.lon, item.lat, item)), true)
  return `${data.items.length.toLocaleString('es-PE')} objetos OSM${data.retrieved_at ? ` · ${data.retrieved_at.slice(11, 16)} UTC` : ''}`
}

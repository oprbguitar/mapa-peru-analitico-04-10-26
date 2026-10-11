// Zona de estudio dibujable sobre el mapa: un círculo con asa central (mover) y asa de borde (radio).
// Mientras se arrastra, el círculo y el rótulo de radio siguen al cursor; al soltar se confirma el cambio.
/* global maplibregl */
import { map } from './map.js'
import { cssVar, fmt } from './util.js'

const SRC = 'sim-zone'
const MIN_KM = 1
const MAX_KM = 30
let zone = null          // { lat, lon, radius_km }
let center = null
let edge = null
let handlers = { onEdit: () => {}, onCommit: () => {} }

const kmPerLon = (lat) => 111.32 * Math.cos(lat * Math.PI / 180)
const distanceKm = (a, b) => {
  const dx = (b.lon - a.lon) * kmPerLon((a.lat + b.lat) / 2), dy = (b.lat - a.lat) * 111.32
  return Math.hypot(dx, dy)
}

function circle({ lat, lon, radius_km: km }, steps = 72) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI
    return [lon + (km / kmPerLon(lat)) * Math.cos(t), lat + (km / 111.32) * Math.sin(t)]
  })
}

function ensureLayers() {
  if (map.getSource(SRC)) return
  map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({ id: 'sim-zone-fill', type: 'fill', source: SRC, paint: { 'fill-color': cssVar('--accent'), 'fill-opacity': 0.06 } })
  map.addLayer({ id: 'sim-zone-line', type: 'line', source: SRC,
    paint: { 'line-color': cssVar('--accent'), 'line-width': 2, 'line-dasharray': [3, 2] } })
}

function paint() {
  ensureLayers()
  map.getSource(SRC).setData({ type: 'FeatureCollection', features: zone
    ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(zone)] } }] : [] })
  for (const id of ['sim-zone-fill', 'sim-zone-line']) map.setLayoutProperty(id, 'visibility', zone ? 'visible' : 'none')
}

const edgePoint = () => [zone.lon + zone.radius_km / kmPerLon(zone.lat), zone.lat]

function handle(cls, label) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `sim-handle ${cls}`
  el.setAttribute('aria-label', label)
  return el
}

function placeMarkers() {
  if (!center) {
    center = new maplibregl.Marker({ element: handle('sim-handle-center', 'Mover la zona'), draggable: true })
    center.on('drag', () => {
      const p = center.getLngLat()
      zone = { ...zone, lat: p.lat, lon: p.lng }
      edge.setLngLat(edgePoint())
      paint()
      handlers.onEdit(zone)
    })
    center.on('dragend', () => handlers.onCommit(zone))
    edge = new maplibregl.Marker({ element: handle('sim-handle-edge', 'Cambiar el radio de la zona'), draggable: true })
    edge.on('drag', () => {
      const p = edge.getLngLat()
      zone = { ...zone, radius_km: Math.min(MAX_KM, Math.max(MIN_KM, Math.round(distanceKm(zone, { lat: p.lat, lon: p.lng }) * 2) / 2)) }
      edge.getElement().dataset.km = `${fmt(zone.radius_km, 1)} km`
      paint()
      handlers.onEdit(zone)
    })
    edge.on('dragend', () => {
      edge.setLngLat(edgePoint())   // el asa vuelve al borde exacto del radio redondeado
      handlers.onCommit(zone)
    })
    // teclado: flechas cambian el radio sin ratón
    edge.getElement().addEventListener('keydown', (e) => {
      const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key]
      if (!step) return
      e.preventDefault()
      setZone({ ...zone, radius_km: Math.min(MAX_KM, Math.max(MIN_KM, zone.radius_km + step)) })
      handlers.onCommit(zone)
    })
  }
  center.setLngLat([zone.lon, zone.lat]).addTo(map)
  edge.setLngLat(edgePoint()).addTo(map)
  edge.getElement().dataset.km = `${fmt(zone.radius_km, 1)} km`
}

export function initZone(h) {
  handlers = { ...handlers, ...h }
}

export function setZone(z) {
  zone = { lat: +z.lat, lon: +z.lon, radius_km: z.radius_km }
  paint()
  placeMarkers()
}

export const getZone = () => zone

export function hideZone() {
  center?.remove()
  edge?.remove()
  if (map.getSource(SRC)) for (const id of ['sim-zone-fill', 'sim-zone-line']) map.setLayoutProperty(id, 'visibility', 'none')
}

export function showZone() {
  if (zone) setZone(zone)
}

export function fitZone(padding) {
  if (!zone) return
  const dLat = zone.radius_km / 111.32, dLon = zone.radius_km / kmPerLon(zone.lat)
  map.fitBounds([[zone.lon - dLon, zone.lat - dLat], [zone.lon + dLon, zone.lat + dLat]],
    { padding, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700 })
}

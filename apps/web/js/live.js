// Capas en vivo. El navegador solo habla con el backend; el backend habla con los proveedores.
/* global maplibregl, satellite */
import { map, mapReady, onStyleReady } from './map.js'
import { cssVar, dateTime, esc, fmt, getJSON, state, timeAgo, toast } from './util.js'
import { setLiveMeta } from './rail.js'

const INTERVAL = { flights: 15000, vessels: 20000, seismic: 120000, fires: 600000, weather: 600000 }
const timers = {}
const markers = { weather: [] }
let satTimer = null
let satRecs = []
let popup

const WINDOW_S = { ahora: 86400, '24h': 86400, '7d': 7 * 86400, '30d': 30 * 86400, '1a': 30 * 86400, '5a': 30 * 86400, year: 30 * 86400 }
const fc = (features) => ({ type: 'FeatureCollection', features })
const pt = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props })

function arrowImage(size = 28) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.beginPath()
  g.moveTo(size / 2, 2)
  g.lineTo(size - 5, size - 4)
  g.lineTo(size / 2, size - 9)
  g.lineTo(5, size - 4)
  g.closePath()
  g.fill()
  return g.getImageData(0, 0, size, size)
}

let markLive
const liveReady = new Promise((res) => (markLive = res))

onStyleReady(() => {
  // setStyle descarta las imágenes del sprite propio: se vuelven a registrar
  if (!map.hasImage('pi-arrow')) map.addImage('pi-arrow', arrowImage(), { sdf: true })
})

export function initLive() {
  popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 10, maxWidth: '300px' })
  if (!map.hasImage('pi-arrow')) map.addImage('pi-arrow', arrowImage(), { sdf: true })
  const add = (id, layer) => {
    map.addSource(id, { type: 'geojson', data: fc([]) })
    map.addLayer({ ...layer, id, source: id, layout: { ...(layer.layout || {}), visibility: 'none' } })
    map.on('click', id, (e) => onClick(id, e.features[0], e.lngLat))
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
  }
  map.addSource('traffic', { type: 'raster', tiles: ['/api/v1/intel/traffic/tiles/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 5, maxzoom: 18 })
  map.addLayer({ id: 'traffic', type: 'raster', source: 'traffic', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } })
  add('ports', { type: 'circle', paint: { 'circle-radius': 6, 'circle-color': cssVar('--live-port'), 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--surface-2') } })
  add('datacenters', { type: 'circle', paint: { 'circle-radius': 4, 'circle-color': cssVar('--live-dc'), 'circle-stroke-width': 1.5, 'circle-stroke-color': cssVar('--surface-2') } })
  add('fires', { type: 'circle', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 5], 'circle-color': cssVar('--live-fire'), 'circle-opacity': 0.85 } })
  add('seismic', { type: 'circle', paint: {
    'circle-radius': ['step', ['get', 'mag'], 3, 3, 5, 4, 8, 5, 12],
    'circle-color': cssVar('--live-quake'), 'circle-opacity': ['interpolate', ['linear'], ['get', 'age_d'], 0, 0.85, 30, 0.25],
    'circle-stroke-width': ['step', ['get', 'mag'], 1, 4, 2], 'circle-stroke-color': cssVar('--surface-2') } })
  add('vessels', { type: 'symbol', layout: { 'icon-image': 'pi-arrow', 'icon-size': 0.55, 'icon-rotate': ['get', 'heading'], 'icon-allow-overlap': true, 'icon-rotation-alignment': 'map' },
    paint: { 'icon-color': cssVar('--live-vessel'), 'icon-halo-color': cssVar('--surface-2'), 'icon-halo-width': 1 } })
  add('flights', { type: 'symbol', layout: { 'icon-image': 'pi-arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.55, 9, 0.85], 'icon-rotate': ['get', 'track'],
    'icon-allow-overlap': true, 'icon-rotation-alignment': 'map' }, paint: { 'icon-color': cssVar('--live-flight'), 'icon-halo-color': cssVar('--surface-2'), 'icon-halo-width': 1.5 } })
  queueMicrotask(markLive)
  add('satellites', { type: 'circle', paint: { 'circle-radius': 3.5, 'circle-color': cssVar('--live-sat'), 'circle-stroke-width': 1, 'circle-stroke-color': cssVar('--surface-2') } })
}

export async function toggle(id, on) {
  await mapReady
  await liveReady // sources y capas creadas
  clearInterval(timers[id])
  const layerIds = { weather: [] }[id] ?? [id]
  for (const l of layerIds) map.getLayer(l) && map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none')
  if (id === 'weather') clearWeather()
  if (id === 'satellites') {
    clearInterval(satTimer)
    satRecs = []
  }
  if (!on) {
    if (map.getSource(id)) map.getSource(id).setData?.(fc([]))
    return
  }
  await refresh(id)
  if (INTERVAL[id]) timers[id] = setInterval(() => refresh(id), INTERVAL[id])
}

export async function refresh(id) {
  try {
    if (id === 'traffic') {
      const t = await getJSON('/api/v1/intel/traffic')
      setLiveMeta(id, t.configured ? 'TomTom' : 'sin clave')
      if (!t.configured) toast('Tráfico: falta la clave de TomTom (botón «Claves»). Es un proveedor opcional.')
      return
    }
    if (id === 'ports') return ports()
    if (id === 'datacenters') return datacenters()
    if (id === 'satellites') return satellites()
    if (id === 'weather') return weather()
    const d = await getJSON(`/api/v1/intel/${id}`)
    const st = d.status
    if (st.status === 'sin_configurar') {
      setLiveMeta(id, 'sin clave')
      toast(`${label(id)}: requiere configurar ${st.requires} en «Claves».`)
      return
    }
    if (!d.data) {
      setLiveMeta(id, 'cargando')
      setTimeout(() => state.live.has(id) && refresh(id), 3000)
      return
    }
    const now = Date.now() / 1000
    const win = WINDOW_S[state.preset] ?? 86400
    let feats = []
    if (id === 'flights') feats = d.data.items.map((a) => pt(a.lon, a.lat, a))
    if (id === 'vessels') feats = d.data.items.map((b) => pt(b.lon, b.lat, { ...b, heading: b.heading ?? 0 }))
    if (id === 'seismic') feats = d.data.items.filter((q) => now - q.time <= win).map((q) => pt(q.lon, q.lat, { ...q, age_d: (now - q.time) / 86400 }))
    if (id === 'fires') feats = d.data.items.filter((f) => now - f.time <= Math.min(win, 7 * 86400)).map((f) => pt(f.lon, f.lat, f))
    map.getSource(id).setData(fc(feats))
    const stale = st.status === 'desactualizado' ? ' · desact.' : ''
    setLiveMeta(id, `${feats.length}${stale}`)
  } catch (e) {
    setLiveMeta(id, 'error')
    toast(`${label(id)}: ${e.message}`)
  }
}

const label = (id) => ({ flights: 'Vuelos', vessels: 'Embarcaciones', seismic: 'Sismos', fires: 'Focos de calor', weather: 'Clima', ports: 'Puertos', satellites: 'Satélites', traffic: 'Tráfico', datacenters: 'Centros de datos' })[id] || id

async function ports() {
  const d = await getJSON('/api/v1/intel/ports')
  if (!d.available) return setLiveMeta('ports', 'sin datos')
  map.getSource('ports').setData(fc(d.ports.map((p) => pt(p.lon, p.lat, { ...p, teu: JSON.stringify(p.teuAnnual || {}), tm: JSON.stringify(p.tmAnnual || {}), vessels: JSON.stringify(d.vessels?.by_port?.[p.locode] || null) }))))
  setLiveMeta('ports', String(d.ports.length))
}

async function datacenters() {
  const d = await getJSON('/api/v1/intel/datacenters')
  if (!d.available) return setLiveMeta('datacenters', 'sin datos')
  map.getSource('datacenters').setData(fc(d.items.map((x) => pt(x.lon, x.lat, x))))
  setLiveMeta('datacenters', String(d.items.length))
}

async function satellites() {
  clearInterval(satTimer)
  const d = await getJSON(`/api/v1/intel/satellites?group=${encodeURIComponent(state.satGroup)}`)
  satRecs = d.satellites.map((s) => ({ name: s.name, rec: satellite.twoline2satrec(s.l1, s.l2) }))
  const step = () => {
    const now = new Date()
    const gmst = satellite.gstime(now)
    const feats = []
    for (const s of satRecs) {
      const pv = satellite.propagate(s.rec, now)
      if (!pv || !pv.position || typeof pv.position === 'boolean') continue
      const g = satellite.eciToGeodetic(pv.position, gmst)
      feats.push(pt(satellite.degreesLong(g.longitude), satellite.degreesLat(g.latitude), { name: s.name, alt_km: Math.round(g.height) }))
    }
    map.getSource('satellites')?.setData(fc(feats))
  }
  step()
  satTimer = setInterval(step, 2000)
  setLiveMeta('satellites', `${satRecs.length}${d.stale ? ' · caché' : ''}`)
}

function clearWeather() {
  for (const m of markers.weather) m.remove()
  markers.weather = []
}

async function weather() {
  clearWeather()
  const d = await getJSON('/api/v1/intel/weather')
  const useObs = state.weatherModel === 'obs'
  const block = useObs ? d.observed : d.models
  if (block.status.status === 'sin_configurar') {
    setLiveMeta('weather', 'SENAMHI sin configurar')
    toast('SENAMHI: configura la URL o ruta del CSV de estaciones en «Claves». Se muestran solo modelos.')
    return
  }
  if (!block.data) {
    setLiveMeta('weather', 'cargando')
    setTimeout(() => state.live.has('weather') && weather(), 3000)
    return
  }
  const items = useObs ? block.data.items : block.data.models[state.weatherModel].items
  const tag = useObs ? 'OBSERVADO · SENAMHI' : `MODELO · ${block.data.models[state.weatherModel].model}`
  for (const p of items) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'wx'
    el.setAttribute('aria-label', `${p.lugar || p.station}: ${fmt(p.temp_c)} grados`)
    el.innerHTML = `<b class="num">${fmt(p.temp_c)}°</b>`
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      popup.setLngLat([p.lon, p.lat]).setHTML(`<div class="pop-title">${esc(p.lugar || p.station)}</div>
        <span class="kind" data-kind="${useObs ? 'oficial' : 'proyeccion'}">${esc(tag)}</span>
        <div class="pop-row"><span>Temperatura</span><b>${fmt(p.temp_c)} °C</b></div>
        <div class="pop-row"><span>Humedad relativa</span><b>${fmt(p.rh_pct)} %</b></div>
        <div class="pop-row"><span>Precipitación</span><b>${fmt(p.precip_mm)} mm</b></div>
        ${p.precip_next24_mm != null ? `<div class="pop-row"><span>Lluvia próximas 24 h</span><b>${fmt(p.precip_next24_mm)} mm</b></div>` : ''}
        ${p.wind_kmh != null ? `<div class="pop-row"><span>Viento</span><b>${fmt(p.wind_kmh)} km/h</b></div>` : ''}
        <div class="src-meta">${esc(p.time || '')} · ${useObs ? 'SENAMHI' : 'vía Open-Meteo'}</div>`).addTo(map)
    })
    markers.weather.push(new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map))
  }
  setLiveMeta('weather', useObs ? 'SENAMHI' : block.data.models[state.weatherModel].model)
}

async function onClick(id, f, lngLat) {
  const p = f.properties
  let html = ''
  if (id === 'flights') {
    html = `<div class="pop-title">✈ ${esc(p.callsign || p.hex)}</div>${tag('vivo_tercero', 'ADS-B · adsb.lol')}
      <div class="pop-row"><span>ICAO</span><b>${esc(p.hex)}</b></div><div class="pop-row"><span>Altitud</span><b>${fmt(p.alt)} ft</b></div>
      <div class="pop-row"><span>Velocidad</span><b>${fmt(p.speed)} kt</b></div><div class="pop-row"><span>Rumbo</span><b>${fmt(p.track, 0)}°</b></div>
      <div class="pop-row"><span>Tipo</span><b>${esc(p.type || '—')}</b></div><div id="fl-extra" class="loading">Ruta</div>`
    popup.setLngLat(lngLat).setHTML(html).addTo(map)
    try {
      const d = await getJSON(`/api/v1/intel/flights/${encodeURIComponent(p.hex)}?callsign=${encodeURIComponent(p.callsign || '')}`)
      const x = d.details
      const route = x.origin ? `${esc(x.origin.iata || x.origin.city)} → ${esc(x.destination?.iata || x.destination?.city)}` : esc(x.route_note || 'Sin ruta')
      const el = document.getElementById('fl-extra')
      if (el) {
        el.className = ''
        el.innerHTML = `<div class="pop-row"><span>Ruta</span><b>${route}</b></div>${x.airline ? `<div class="pop-row"><span>Aerolínea</span><b>${esc(x.airline)}</b></div>` : ''}
          <div class="src-meta">${d.track.length} posiciones guardadas (6 h, reducidas)</div>`
      }
    } catch { /* la ficha básica ya está visible */ }
    return
  }
  if (id === 'vessels') html = `<div class="pop-title">${esc(p.name || p.mmsi)}</div>${tag('vivo_tercero', 'AIS · aisstream.io')}
      <div class="pop-row"><span>MMSI</span><b>${esc(p.mmsi)}</b></div><div class="pop-row"><span>Tipo</span><b>${esc(p.type)}</b></div>
      <div class="pop-row"><span>Destino declarado</span><b>${esc(p.destination || '—')}</b></div><div class="pop-row"><span>Sentido</span><b>${esc(p.direction)}</b></div>
      <div class="pop-row"><span>Velocidad</span><b>${fmt(p.speed)} kn</b></div><div class="src-meta">Última señal hace ${fmt(p.age_s, 0)} s</div>`
  if (id === 'seismic') html = `<div class="pop-title">M ${fmt(p.mag)} · ${esc(p.source)}</div>${tag('oficial', p.source === 'IGP' ? 'IGP · CENSIS' : 'USGS (secundaria)')}
      <div>${esc(p.place || '')}</div><div class="pop-row"><span>Profundidad</span><b>${fmt(p.depth_km)} km</b></div>
      <div class="pop-row"><span>Fecha</span><b>${esc(dateTime(p.time))}</b></div>${p.intensity ? `<div class="pop-row"><span>Intensidad</span><b>${esc(p.intensity)}</b></div>` : ''}
      ${p.report && p.report !== 'null' ? `<a href="${esc(p.report)}" target="_blank" rel="noopener">Reporte acelerométrico (PDF)</a>` : ''}`
  if (id === 'fires') html = `<div class="pop-title">Foco de calor</div>${tag('vivo_tercero', 'NASA FIRMS · VIIRS')}
      <div class="pop-row"><span>Detección</span><b>${esc(dateTime(p.time))}</b></div><div class="pop-row"><span>Potencia radiativa</span><b>${fmt(p.frp)} MW</b></div>
      <div class="pop-row"><span>Confianza</span><b>${esc(p.confidence)}</b></div><div class="note">Anomalía térmica satelital; no es un incendio confirmado.</div>`
  if (id === 'ports') {
    const teu = JSON.parse(p.teu || '{}')
    const tm = JSON.parse(p.tm || '{}')
    const ly = Object.keys(tm).sort().pop()
    const lt = Object.keys(teu).sort().pop()
    const v = JSON.parse(p.vessels || 'null')
    html = `<div class="pop-title">${esc(p.name)} · ${esc(p.locode || '')}</div>${tag('oficial', 'APN + NGA WPI')}
      ${ly ? `<div class="pop-row"><span>Carga ${ly}</span><b>${fmt(tm[ly])} t</b></div>` : ''}${lt ? `<div class="pop-row"><span>Contenedores ${lt}</span><b>${fmt(teu[lt])} TEU</b></div>` : ''}
      <div class="pop-row"><span>Tamaño (WPI)</span><b>${esc(p.harborSize || '—')}</b></div>
      ${v ? `<div class="pop-row"><span>Barcos AIS cerca</span><b>${v.near}</b></div><div class="pop-row"><span>Con destino declarado aquí</span><b>${v.declared_destination}</b></div>` : '<div class="src-meta">Activa «Embarcaciones» (AIS) para ver barcos cercanos.</div>'}`
  }
  if (id === 'datacenters') html = `<div class="pop-title">${esc(p.nombre)}</div>${tag('vivo_tercero', 'OpenStreetMap')}<div>${esc(p.operador || '')}</div>`
  if (id === 'satellites') html = `<div class="pop-title">${esc(p.name)}</div>${tag('calculado', 'Posición calculada · CelesTrak')}<div class="pop-row"><span>Altitud</span><b>${fmt(p.alt_km)} km</b></div>`
  popup.setLngLat(lngLat).setHTML(html).addTo(map)
}

const tag = (kind, text) => `<div><span class="kind" data-kind="${kind}">${esc(text)}</span></div>`

export function refreshWindowed() {
  for (const id of ['seismic', 'fires']) if (state.live.has(id)) refresh(id)
}

export async function statusStrip() {
  try {
    const s = await getJSON('/api/v1/meta/status')
    const names = { flights: 'Vuelos', vessels: 'AIS', seismic: 'Sismos', fires: 'FIRMS', weather_models: 'Modelos', weather_obs: 'SENAMHI' }
    document.getElementById('live-strip').innerHTML = s.live.map((l) =>
      `<span class="live-dot" data-status="${esc(l.status)}" title="${esc(`${names[l.layer] || l.layer}: ${l.status}${l.updated ? ' · ' + timeAgo(l.updated) : ''}${l.error ? ' · ' + l.error : ''}`)}">${esc(names[l.layer] || l.layer)}</span>`).join('')
    return s
  } catch {
    return null
  }
}

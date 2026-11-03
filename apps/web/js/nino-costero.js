// Niño costero 2026-2027 sobre el mapa: escenario CENEPRED por distrito, cauces HydroRIVERS que van al mar o a la
// Amazonía, tramos críticos ANA, zonas INGEMMET y susceptibilidad PMLL. El flujo se anima solo al acercar (≥ z7) y la
// simulación ilustrativa de lluvia y huaico solo en vista cercana (≥ z9), con letrero «Simulación».
// Nada aquí es un pronóstico propio: los meses citan el Comunicado ENFEN N.° 19-2026 y los niveles son los publicados.
/* global maplibregl */
import { map, onStyleReady } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge, postJSON } from './util.js'

const BASE = 'data/nino2627/'
const ENFEN = { label: 'Comunicado Oficial ENFEN N.° 19-2026', date: '30/10/2026', next: '13/11/2026',
  url: 'https://enfen.imarpe.gob.pe/download/comunicado-oficial-enfen-n-19-2026/' }
const SIGRID = 'https://sigrid.cenepred.gob.pe/sigridv3/escenarios'
const RAIN_NOV_ENE = 'Lluvias sobre lo normal en costa norte, sierra occidental, costa central y sierra central occidental, con episodios de moderada a fuerte intensidad.'
const RAIN_VERANO = 'Lluvias sobre lo normal en costa norte, costa central y sierra norte occidental; más intensas y frecuentes en la costa norte.'
// Cada mes cita el comunicado; `rain` es solo el grado visual de la animación (sin milímetros), `sc` el escenario CENEPRED aplicable
const MONTHS = [
  { id: '2026-11', label: 'Nov', year: 2026, sc: 'ond26', rain: 2, sea: 'Extraordinario frente a la costa (Niño 1+2).', text: RAIN_NOV_ENE },
  { id: '2026-12', label: 'Dic', year: 2026, sc: 'ond26', rain: 2, sea: 'Extraordinario (Niño 1+2).', text: `${RAIN_NOV_ENE} Desde diciembre los caudales altos se extienden a la costa central: Chillón, Rímac y Lurín.` },
  { id: '2027-01', label: 'Ene', year: 2027, sc: 'ver27', rain: 3, sea: 'Extraordinario (Niño 1+2).', text: `${RAIN_NOV_ENE} ${RAIN_VERANO}` },
  { id: '2027-02', label: 'Feb', year: 2027, sc: 'ver27', rain: 3, sea: 'Extraordinario hasta febrero (Niño 1+2).', text: RAIN_VERANO },
  { id: '2027-03', label: 'Mar', year: 2027, sc: 'ver27', rain: 3, sea: 'Magnitud en descenso gradual.', text: RAIN_VERANO },
  { id: '2027-04', label: 'Abr', year: 2027, sc: 'base', rain: 1, sea: 'Descenso gradual hasta junio.', text: 'El comunicado no publica pronóstico de lluvias para este mes.' },
  { id: '2027-05', label: 'May', year: 2027, sc: 'base', rain: 0, sea: 'Descenso gradual hasta junio.', text: 'El comunicado no publica pronóstico de lluvias para este mes.' },
  { id: '2027-06', label: 'Jun', year: 2027, sc: 'base', rain: 0, sea: 'Fin previsto a fines de otoño de 2027.', text: 'El comunicado no publica pronóstico de lluvias para este mes.' },
]
const SC_LABEL = { ond26: 'CENEPRED · escenario oct–dic 2026 (act. set. 2026)', ver27: 'CENEPRED · escenario verano 2027 (act. set. 2026)', base: 'Sin escenario trimestral publicado · se muestra la base PMLL 2024-2026' }
const LAYERS = [
  ['dist', 'Distritos en riesgo (escenario del mes)', 'oficial'],
  ['pacifico', 'Cauces que van al mar (Pacífico)', 'calculado'],
  ['amazonia', 'Cauces hacia la Amazonía y Titicaca', 'calculado'],
  ['criticos', 'Tramos y puntos críticos ANA', 'oficial'],
  ['zonas', 'Zonas críticas INGEMMET', 'oficial'],
  ['susc', 'Susceptibilidad PMLL (mancha)', 'oficial'],
]
const MIN_FLOW_ZOOM = 7
const MIN_SIM_ZOOM = 9
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const st = {
  host: null, meta: null, month: '2026-11', hazard: 'm', on: new Set(['dist', 'pacifico', 'criticos']), sim: true, open: true,
  loaded: false, frame: 0, last: 0, step: 0, sign: null, endSign: null, wind: null, windAt: 0, ai: '',
}
let popup = null
let canvas = null
let drops = []

const month = () => MONTHS.find((m) => m.id === st.month) || MONTHS[0]
/** Propiedad de nivel de riesgo publicada para el mes y la amenaza elegidos. */
const distKey = () => `${st.hazard}_${month().sc}`
const caucesKey = () => (month().sc === 'base' ? (st.hazard === 'i' ? 'bi' : 'bm') : (st.hazard === 'i' ? 'ri' : 'rm'))
const lvColor = () => ['match', ['get', distKey()], 4, cssVar('--nc-lv-4'), 3, cssVar('--nc-lv-3'), 2, cssVar('--nc-lv-2'), 'rgba(0,0,0,0)']

// ── capas ────────────────────────────────────────────────────────────────────
function before() { return map.getStyle().layers.find((l) => l.type === 'symbol')?.id }

function addLayers() {
  if (!map || map.getSource('enso-nc-dist')) return
  const sym = before()
  map.addSource('enso-nc-dist', { type: 'geojson', data: `${BASE}distritos.geojson`, promoteId: 'u' })
  map.addSource('enso-nc-cauces', { type: 'geojson', data: `${BASE}cauces.geojson`, lineMetrics: true })
  map.addSource('enso-nc-crit', { type: 'geojson', data: `${BASE}criticos.geojson` })
  const r = st.meta?.rasters || {}
  for (const [k, id] of [['inund', 'i'], ['mm', 'm']]) {
    if (!r[k]) continue
    map.addSource(`enso-nc-susc-${id}`, { type: 'image', url: `${BASE}${r[k].file}`, coordinates: r[k].coordinates })
    map.addLayer({ id: `enso-nc-susc-${id}`, type: 'raster', source: `enso-nc-susc-${id}`, layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.72, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, sym)
  }
  map.addLayer({ id: 'enso-nc-dist-fill', type: 'fill', source: 'enso-nc-dist', layout: { visibility: 'none' },
    paint: { 'fill-color': lvColor(), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 0.24, 12, 0.14] } }, sym)
  map.addLayer({ id: 'enso-nc-dist-line', type: 'line', source: 'enso-nc-dist', minzoom: 6, layout: { visibility: 'none' },
    paint: { 'line-color': cssVar('--nc-edge'), 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.2, 0.4], 'line-opacity': 0.7 } }, sym)
  // ancho por orden de Strahler; «zoom» debe quedar en el interpolate de primer nivel
  const width = (k = 1, add = 0) => ['interpolate', ['linear'], ['zoom'], 4, ['+', add * 0.3, ['*', 0.12 * k, ['get', 'o']]],
    9, ['+', add + 0.8, ['*', 0.5 * k, ['get', 'o']]], 13, ['+', add + 1.6, ['*', 1 * k, ['get', 'o']]]]
  map.addLayer({ id: 'enso-nc-cauce', type: 'line', source: 'enso-nc-cauces', layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['match', ['get', 'v'], 'P', cssVar('--nc-flow'), 'T', cssVar('--nc-lake'), cssVar('--nc-amazon')],
      'line-width': width(), 'line-opacity': ['match', ['get', 'v'], 'P', 0.85, 0.55] } })
  // flujo: guiones que avanzan aguas abajo (HydroRIVERS está dibujado en el sentido del flujo)
  map.addLayer({ id: 'enso-nc-flow', type: 'line', source: 'enso-nc-cauces', minzoom: MIN_FLOW_ZOOM, layout: { visibility: 'none', 'line-cap': 'butt' },
    paint: { 'line-color': cssVar('--nc-flow-hi'), 'line-width': width(0.6, 0.4), 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] } })
  // huaico ilustrativo: un frente de lodo recorre cada tramo de distritos con nivel alto o muy alto
  map.addLayer({ id: 'enso-nc-huayco', type: 'line', source: 'enso-nc-cauces', minzoom: MIN_SIM_ZOOM, layout: { visibility: 'none', 'line-cap': 'round' },
    paint: { 'line-width': width(1.4, 3), 'line-gradient': gradient(0.5) } })
  map.addLayer({ id: 'enso-nc-crit-line', type: 'line', source: 'enso-nc-crit', filter: ['==', ['geometry-type'], 'LineString'], layout: { visibility: 'none', 'line-cap': 'round' },
    paint: { 'line-color': ['match', ['get', 't'], 'pm', cssVar('--nc-mud'), cssVar('--nc-crit')], 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 13, 7] } })
  map.addLayer({ id: 'enso-nc-crit-pt', type: 'circle', source: 'enso-nc-crit', filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 't'], 'zc']], layout: { visibility: 'none' },
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.8, 10, 4.5, 14, 7], 'circle-color': ['match', ['get', 't'], 'pm', cssVar('--nc-mud'), cssVar('--nc-crit')],
      'circle-stroke-width': 1, 'circle-stroke-color': cssVar('--inst-ring') } })
  map.addLayer({ id: 'enso-nc-zc', type: 'circle', source: 'enso-nc-crit', filter: ['==', ['get', 't'], 'zc'], layout: { visibility: 'none' },
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 10, 4, 14, 6], 'circle-color': cssVar('--nc-zone'), 'circle-opacity': 0.9,
      'circle-stroke-width': 1, 'circle-stroke-color': cssVar('--inst-ring') } })
  for (const id of ['enso-nc-cauce', 'enso-nc-crit-pt', 'enso-nc-crit-line', 'enso-nc-zc', 'enso-nc-dist-fill']) {
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
  }
  map.on('click', onMapClick)
  map.on('moveend', onMoveEnd)
  st.loaded = true
}

/** Gradiente de un frente de lodo centrado en `t` (0 = aguas arriba, 1 = aguas abajo). */
function gradient(t) {
  const clear = 'rgba(0,0,0,0)'
  const mud = cssVar('--nc-mud') || '#b5651d', soft = cssVar('--nc-mud-soft') || 'rgba(181,101,29,.35)'
  const stops = [[0, clear], [t - 0.32, clear], [t - 0.12, soft], [t, mud], [t + 0.03, clear], [1, clear]]
  const out = ['interpolate', ['linear'], ['line-progress']]
  let prev = -1
  for (const [p, c] of stops) {
    const q = Math.min(1, Math.max(0, p))
    if (q <= prev) continue
    out.push(q, c)
    prev = q
  }
  return out
}

function filters() {
  if (!st.loaded) return
  const slopes = [...(st.on.has('pacifico') ? ['P'] : []), ...(st.on.has('amazonia') ? ['A', 'T'] : [])]
  const k = caucesKey()
  const inSlope = ['in', ['get', 'v'], ['literal', slopes.length ? slopes : ['-']]]
  // cauces «activos»: distrito con nivel alto o muy alto en el escenario del mes, o tramo con punto crítico ANA cercano
  const active = ['all', inSlope, ['any', ['>=', ['get', k], 3], ['==', ['get', 'c'], 1]], ...(month().rain ? [] : [['==', 1, 0]])]
  map.setFilter('enso-nc-cauce', inSlope)
  map.setFilter('enso-nc-flow', active)
  map.setFilter('enso-nc-huayco', ['all', ['==', ['get', 'v'], 'P'], ['>=', ['get', st.hazard === 'i' ? k : (month().sc === 'base' ? 'bm' : 'rm')], 3], ...(month().rain ? [] : [['==', 1, 0]])])
  map.setPaintProperty('enso-nc-dist-fill', 'fill-color', lvColor())
  const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  vis('enso-nc-dist-fill', st.on.has('dist'))
  vis('enso-nc-dist-line', st.on.has('dist'))
  vis('enso-nc-cauce', slopes.length > 0)
  vis('enso-nc-flow', slopes.length > 0)
  vis('enso-nc-huayco', st.sim && st.on.has('pacifico'))
  vis('enso-nc-crit-line', st.on.has('criticos'))
  vis('enso-nc-crit-pt', st.on.has('criticos'))
  vis('enso-nc-zc', st.on.has('zonas'))
  vis('enso-nc-susc-i', st.on.has('susc') && st.hazard === 'i')
  vis('enso-nc-susc-m', st.on.has('susc') && st.hazard === 'm')
}

function hideAll() {
  if (!map) return
  for (const l of map.getStyle()?.layers || []) if (l.id.startsWith('enso-nc-')) map.setLayoutProperty(l.id, 'visibility', 'none')
}

// ── animación: flujo (≥ z7), huaico + lluvia + letrero (≥ z9) ───────────────
const DASH = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]

function tick(now) {
  st.frame = requestAnimationFrame(tick)
  if (document.hidden || !st.host || now - st.last < 55) return
  st.last = now
  const z = map.getZoom()
  if (z >= MIN_FLOW_ZOOM && map.getLayoutProperty('enso-nc-flow', 'visibility') === 'visible') {
    st.step = (st.step + 1) % DASH.length
    map.setPaintProperty('enso-nc-flow', 'line-dasharray', DASH[st.step])
  }
  const simOn = st.sim && z >= MIN_SIM_ZOOM && month().rain > 0
  if (simOn && map.getLayoutProperty('enso-nc-huayco', 'visibility') === 'visible') map.setPaintProperty('enso-nc-huayco', 'line-gradient', gradient((now / 2800) % 1.3))
  drawRain(simOn ? rainLevel() : 0, 0.055)
}

function startLoop() {
  cancelAnimationFrame(st.frame)
  if (reduce()) { drawRain(st.sim && map.getZoom() >= MIN_SIM_ZOOM ? rainLevel() : 0, 0); return }
  st.frame = requestAnimationFrame(tick)
}

/** Grado visual de lluvia: mes del comunicado × nivel publicado del distrito al centro; sin lluvia fuera de la vertiente del Pacífico. */
function rainLevel() {
  const c = map.project(map.getCenter())
  const hits = map.queryRenderedFeatures([[c.x - 60, c.y - 60], [c.x + 60, c.y + 60]], { layers: ['enso-nc-cauce'] })
  const pacific = hits.length ? hits.filter((f) => f.properties.v === 'P').length / hits.length : 0
  if (pacific < 0.5) return 0
  const lv = Math.max(0, ...hits.map((f) => Number(f.properties[caucesKey()]) || 0))
  return month().rain * (lv >= 3 ? 1 : 0.55)
}

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'nc-rain'
  canvas.setAttribute('aria-hidden', 'true')
  map.getContainer().appendChild(canvas)
  const size = () => {
    const r = map.getContainer().getBoundingClientRect()
    canvas.width = r.width * devicePixelRatio
    canvas.height = r.height * devicePixelRatio
  }
  size()
  addEventListener('resize', size)
}

function drawRain(level, dt) {
  if (!canvas) ensureCanvas()
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvas.hidden = !level
  if (!level) return
  const want = Math.round(level * 90)
  while (drops.length < want) drops.push({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.6, len: 8 + Math.random() * 12 })
  drops.length = want
  // inclinación real del viento al centro (Open-Meteo), solo como dirección visual; sin dato, lluvia vertical
  const slant = st.wind ? Math.sin((st.wind.deg * Math.PI) / 180) * Math.min(1, st.wind.kmh / 40) * 0.6 : 0
  const k = devicePixelRatio
  ctx.strokeStyle = cssVar('--fx-rain')
  ctx.globalAlpha = 0.25 + 0.15 * level
  ctx.lineWidth = 1.1 * k
  ctx.lineCap = 'round'
  for (const d of drops) {
    d.y += d.v * dt
    d.x -= d.v * dt * slant
    if (d.y > 1) { d.y = -0.05; d.x = Math.random() }
    if (d.x < 0) d.x += 1
    if (d.x > 1) d.x -= 1
    const px = d.x * canvas.width, py = d.y * canvas.height
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px - slant * d.len * k, py + d.len * k)
    ctx.stroke()
  }
}

// ── letrero «Simulación» en el cauce activo más cercano al centro ───────────
async function onMoveEnd() {
  if (!st.host) return
  // con la animación el mapa nunca queda «idle»: se reintenta cuando ya se dibujaron las teselas nuevas
  clearTimeout(st.signTimer); st.signTimer = setTimeout(placeSign, 900)
  placeSign()
  if (st.sim && map.getZoom() >= MIN_SIM_ZOOM && Date.now() - st.windAt > 120000) {
    st.windAt = Date.now()
    const c = map.getCenter()
    try {
      const w = await getJSON(`/api/v1/intel/weather/point?lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}`)
      const d = w.primary?.data
      st.wind = d && Number.isFinite(d.wind_deg) ? { deg: d.wind_deg, kmh: d.wind_kmh || 0, provider: w.primary.label, at: d.observed_at } : null
    } catch { st.wind = null }
    renderStatus()
  }
}

function clearSigns() {
  st.sign?.remove(); st.endSign?.remove()
  st.sign = st.endSign = null
}

function placeSign() {
  clearSigns()
  if (!st.sim || map.getZoom() < MIN_SIM_ZOOM || !month().rain) return renderStatus()
  const c = map.project(map.getCenter())
  const box = [[c.x - 220, c.y - 160], [c.x + 220, c.y + 160]]
  const hits = map.queryRenderedFeatures(box, { layers: ['enso-nc-huayco'] })
  if (!hits.length) return renderStatus()
  const best = hits.map((f) => {
    const g = f.geometry.coordinates
    const p = map.project(g[0])
    return { f, d: Math.hypot(p.x - c.x, p.y - c.y) }
  }).sort((a, b) => a.d - b.d)[0].f
  const g = best.geometry.coordinates
  const p = best.properties
  // MapLibre posiciona el marcador con transform: la animación de entrada va en un hijo para no anularla
  const sign = (cls, html) => {
    const el = document.createElement('div')
    el.innerHTML = `<div class="nc-sign ${cls}" role="note">${html}</div>`
    return el
  }
  st.sign = new maplibregl.Marker({ element: sign('', `<b>Simulación</b><span>${p.v === 'P' ? 'Quebrada hacia el mar' : 'Cauce'} · ${fmt(Number(p.up))} km² de cuenca · ${fmt(Number(p.dn))} km al mar</span>`), anchor: 'bottom' })
    .setLngLat(g[0]).addTo(map)
  st.endSign = new maplibregl.Marker({ element: sign('nc-sign--end', Number(p.end) ? 'Desemboca en el mar' : 'Sigue aguas abajo ↓'), anchor: 'top' }).setLngLat(g.at(-1)).addTo(map)
  st.focus = p
  renderStatus()
}

// ── ventanas de detalle ─────────────────────────────────────────────────────
const LV = { 4: 'Muy alto', 3: 'Alto', 2: 'Medio', 1: 'Bajo', 0: 'Sin dato' }
const T = { pi: 'Punto crítico por inundación (ANA)', pm: 'Punto crítico por movimientos en masa (ANA)', zc: 'Zona crítica por movimientos en masa (INGEMMET)' }

function onMapClick(e) {
  if (!st.host) return
  const order = ['enso-nc-crit-line', 'enso-nc-crit-pt', 'enso-nc-zc', 'enso-nc-cauce', 'enso-nc-dist-fill'].filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') === 'visible')
  const f = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: order })
    .sort((a, b) => order.indexOf(a.layer.id) - order.indexOf(b.layer.id))[0]
  if (!f) return
  const p = f.properties
  let html
  if (f.layer.id === 'enso-nc-dist-fill') {
    html = `<b>${esc(p.n)}</b><small>${esc(p.p || '')} · ${esc(p.d || '')} · UBIGEO ${esc(p.u)}</small>
      <dl><dt>Inundación · ${esc(month().label)} ${month().year}</dt><dd>${LV[p[`i_${month().sc}`]] || '—'}</dd>
      <dt>Movimientos en masa</dt><dd>${LV[p[`m_${month().sc}`]] || '—'}</dd><dt>Base PMLL 2024-2026</dt><dd>${LV[p.i_base] || '—'} / ${LV[p.m_base] || '—'}</dd>
      ${p.pob ? `<dt>Población del distrito</dt><dd>${fmt(Number(p.pob))}</dd>` : ''}</dl>
      <small>${kindBadge('oficial', 'CENEPRED')} niveles publicados; no se reparten cifras.</small>`
  } else if (f.layer.id === 'enso-nc-cauce') {
    html = `<b>${p.v === 'P' ? 'Cauce que va al mar (Pacífico)' : p.v === 'T' ? 'Cauce hacia el Titicaca' : 'Cauce hacia la Amazonía'}</b>
      <dl><dt>Cuenca aguas arriba</dt><dd>${fmt(Number(p.up))} km²</dd><dt>Caudal medio de largo plazo</dt><dd>${fmt(Number(p.q), 1)} m³/s (modelo)</dd>
      <dt>Distancia hasta la desembocadura</dt><dd>${fmt(Number(p.dn))} km</dd><dt>Distrito (punto medio)</dt><dd>UBIGEO ${esc(p.u)} · ${LV[p[caucesKey()]]}</dd>
      <dt>Punto crítico ANA a ≤ 2 km</dt><dd>${Number(p.c) ? 'Sí' : 'No'}</dd></dl>
      <small>${kindBadge('calculado', 'HydroRIVERS')} red modelada (~500 m); el sentido del dibujo es el del flujo.</small>`
  } else {
    html = `<b>${esc(T[p.t] || 'Punto crítico')}</b><small>${esc(p.rio || '')}${p.sector ? ` · sector ${esc(p.sector)}` : ''}</small>
      <dl><dt>Ubicación</dt><dd>${esc([p.dist, p.dep].filter(Boolean).join(', '))}</dd><dt>Peligro</dt><dd>${esc(p.pel || '—')}${Number(p.lv) ? ` · ${LV[p.lv]}` : ''}</dd>
      ${p.expuesto ? `<dt>Elementos expuestos (publicado)</dt><dd>${esc(p.expuesto)}</dd>` : ''}${p.medida ? `<dt>Medida propuesta</dt><dd>${esc(p.medida)}</dd>` : ''}
      ${f.geometry.type === 'LineString' ? '<dt>Tramo</dt><dd>De inicio a fin según coordenadas publicadas</dd>' : ''}</dl>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Ficha de la fuente ↗</a>` : ''} <small>${kindBadge('oficial', p.fuente || 'ANA')}${p.fecha ? ` ${esc(p.fecha)}` : ''}</small>`
  }
  popup?.remove()
  popup = new maplibregl.Popup({ maxWidth: '320px', className: 'nc-pop' }).setLngLat(e.lngLat).setHTML(html).addTo(map)
}

// ── panel lateral ───────────────────────────────────────────────────────────
function count(key) {
  const c = st.meta?.counts?.[key]
  return c ? `${fmt(c.muy_alto)} muy alto · ${fmt(c.alto)} alto` : '—'
}

function renderStatus() {
  const el = st.host?.querySelector('#nc-status')
  if (!el) return
  const z = map.getZoom()
  const m = month()
  const stage = !m.rain ? 'Sin lluvias pronosticadas este mes: la animación queda en pausa.'
    : z < MIN_FLOW_ZOOM ? `Acerca el mapa para ver fluir los cauces (nivel ${MIN_FLOW_ZOOM}+).`
      : z < MIN_SIM_ZOOM || !st.sim ? `Flujo activo. ${st.sim ? `Acerca un poco más (nivel ${MIN_SIM_ZOOM}+) para la simulación de lluvia y huaico.` : 'Simulación apagada.'}`
        : st.sign ? 'Simulación activa en esta vista: lluvia, frente de huaico por la quebrada y letrero en su inicio.' : 'Sin quebradas de nivel alto en esta vista.'
  el.innerHTML = `<p>${esc(stage)}</p>${st.wind && z >= MIN_SIM_ZOOM ? `<p class="src-meta">Viento al centro: ${fmt(st.wind.kmh, 0)} km/h desde ${fmt(st.wind.deg, 0)}° · ${esc(st.wind.provider)} ${kindBadge('proyeccion')}</p>` : ''}`
}

function render() {
  const m = month()
  st.host.innerHTML = `<details class="nc" ${st.open ? 'open' : ''}><summary><span class="eyebrow">Niño costero 2026–2027</span><span class="nc-title">Lluvias, quebradas y huaicos</span></summary>
    <p class="nc-alert"><b>Alerta de El Niño costero</b> · magnitud extraordinaria frente a la costa hasta feb. 2027; descenso hasta junio.
      <a href="${ENFEN.url}" target="_blank" rel="noopener">${ENFEN.label}</a> · ${ENFEN.date} · próximo ${ENFEN.next}</p>
    <div class="nc-months" role="radiogroup" aria-label="Mes del pronóstico">${MONTHS.map((x) => `<button type="button" role="radio" aria-checked="${x.id === st.month}" data-nc-month="${x.id}"><span>${x.label}</span><small>${String(x.year).slice(2)}</small></button>`).join('')}</div>
    <div class="nc-month"><p>${esc(m.text)}</p><p class="src-meta">Mar: ${esc(m.sea)} · ${esc(SC_LABEL[m.sc])}</p></div>
    <div class="seg" role="radiogroup" aria-label="Amenaza"><button type="button" role="radio" data-nc-haz="m" aria-checked="${st.hazard === 'm'}">Huaicos y deslizamientos</button><button type="button" role="radio" data-nc-haz="i" aria-checked="${st.hazard === 'i'}">Inundación</button></div>
    <fieldset class="nc-layers"><legend>En el mapa</legend>${LAYERS.map(([id, label, kind]) => `<label><input type="checkbox" data-nc-layer="${id}" ${st.on.has(id) ? 'checked' : ''}${id === 'susc' && !st.meta?.rasters?.inund ? ' disabled' : ''}><span>${esc(label)}</span>${kindBadge(kind)}</label>`).join('')}</fieldset>
    <div class="nc-key" aria-label="Leyenda"><span><i class="lv4"></i>Muy alto</span><span><i class="lv3"></i>Alto</span><span><i class="lv2"></i>Medio</span><span><i class="flow"></i>Al mar</span><span><i class="mud"></i>Huaico</span></div>
    <label class="nc-sim"><input type="checkbox" data-nc="sim" ${st.sim ? 'checked' : ''}><span><b>Simulación automática al acercar</b><small>Lluvia, frente de huaico y letrero solo en la zona que miras de cerca. Ilustrativa: no es un pronóstico.</small></span></label>
    <div id="nc-status" class="nc-status" aria-live="polite"></div>
    <div class="nc-actions"><button class="btn" type="button" data-nc="wind">Viento y lluvia en vivo</button><button class="btn" type="button" data-nc="ai">Lectura con IA de esta vista</button></div>
    <div id="nc-ai" class="ai-out" aria-live="polite">${st.ai}</div>
    <details class="nc-more"><summary>Cifras del escenario y fuentes</summary>
      <ul class="nc-facts"><li>Huaicos y deslizamientos · ${count(`m_${m.sc === 'base' ? 'base' : m.sc}`)} (distritos)</li><li>Inundación · ${count(`i_${m.sc === 'base' ? 'base' : m.sc}`)} (distritos)</li>
      <li>Frente a la base PMLL 2024-2026, ${fmt(st.meta?.raised_vs_base || 0)} distritos suben de nivel en al menos una amenaza ${kindBadge('calculado')}</li>
      <li>${fmt(st.meta?.critical_features || 0)} puntos, tramos y zonas críticas · ${fmt(st.meta?.cauces?.by_slope?.P || 0)} tramos de cauce hacia el Pacífico</li></ul>
      <p class="src-meta">CENEPRED publicó los mismos niveles distritales para oct–dic 2026 y verano 2027 (actualización de setiembre 2026).</p>
      <div class="sources-list"><a href="${SIGRID}" target="_blank" rel="noopener">SIGRID · escenarios por pronóstico trimestral (CENEPRED)</a>
        <a href="https://www.hydrosheds.org/products/hydrorivers" target="_blank" rel="noopener">HydroRIVERS v1.0 · HydroSHEDS (CC BY 4.0)</a>
        <a href="https://snirh.ana.gob.pe/" target="_blank" rel="noopener">ANA · fichas de puntos críticos (vía SIGRID)</a>
        <a href="https://geocatmin.ingemmet.gob.pe/" target="_blank" rel="noopener">INGEMMET · zonas críticas</a>
        <a href="${ENFEN.url}" target="_blank" rel="noopener">${ENFEN.label}</a></div></details></details>`
  renderStatus()
}

async function action(name) {
  if (name === 'wind') return document.getElementById('btn-wx')?.click()
  if (name !== 'ai') return
  const out = st.host.querySelector('#nc-ai')
  const c = map.getCenter()
  out.innerHTML = '<p class="loading">Reuniendo hechos oficiales y verificando</p>'
  const q = `Niño costero 2026-2027 en la zona ${c.lat.toFixed(2)}, ${c.lng.toFixed(2)} para ${month().label} ${month().year}: ¿qué quebradas y riesgos vigilar según el comunicado ENFEN vigente y los escenarios de CENEPRED?`
  try {
    const r = await postJSON('/api/v1/intel/ai/enso', { question: q })
    const v = r.verification
    st.ai = `<p class="src-meta">${kindBadge('ia', r.answer.engine)} ${esc(v.status)} · ${v.total - v.unverified}/${v.total} oraciones verificadas</p>${v.sentences.map((s) => `<p class="ai-sentence" data-status="${esc(s.status)}">${esc(s.sentence)}</p>`).join('')}`
  } catch (err) {
    st.ai = `<p class="note">${esc(err.message)}</p>`
  }
  out.innerHTML = st.ai
}

function bind() {
  st.host.addEventListener('click', (e) => {
    const mo = e.target.closest('[data-nc-month]')
    if (mo) { st.month = mo.dataset.ncMonth; filters(); render(); placeSign(); return }
    const hz = e.target.closest('[data-nc-haz]')
    if (hz) { st.hazard = hz.dataset.ncHaz; filters(); render(); placeSign(); return }
    const a = e.target.closest('[data-nc="wind"],[data-nc="ai"]')
    if (a) action(a.dataset.nc)
  })
  st.host.addEventListener('change', (e) => {
    const id = e.target.dataset.ncLayer
    if (id) { e.target.checked ? st.on.add(id) : st.on.delete(id); filters(); placeSign() }
    if (e.target.dataset.nc === 'sim') { st.sim = e.target.checked; filters(); placeSign(); startLoop() }
  })
  st.host.addEventListener('toggle', (e) => { if (e.target.classList.contains('nc')) st.open = e.target.open }, true)
}

export async function mountNinoCostero(host) {
  st.host = host
  host.className = 'nc-host'
  try { st.meta ??= await getJSON(`${BASE}meta.json`) } catch { st.meta = {} }
  // mes inicial: el actual si está dentro del período, si no el primero
  const now = new Date().toISOString().slice(0, 7)
  if (MONTHS.some((m) => m.id === now)) st.month = now
  render()
  bind()
  addLayers()
  filters()
  map.on('zoomend', renderStatus)
  startLoop()
  st.signTimer = setTimeout(placeSign, 1200)
}

export function unmountNinoCostero() {
  if (!st.host) return
  cancelAnimationFrame(st.frame)
  map?.off('zoomend', renderStatus)
  st.host = null
  clearSigns()
  popup?.remove()
  if (canvas) canvas.hidden = true
  hideAll()
}

onStyleReady(() => {
  // tras cambiar el mapa base vectorial las fuentes propias se conservan; si no, se recrean
  if (!st.loaded || map.getSource('enso-nc-dist')) return
  st.loaded = false
  map.off('click', onMapClick)
  map.off('moveend', onMoveEnd)
  addLayers()
  if (st.host) filters()
})

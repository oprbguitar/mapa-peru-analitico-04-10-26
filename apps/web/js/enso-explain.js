// El Niño explicado sobre el mapa. Tres capas de distinta naturaleza, siempre rotuladas:
//  · Dato oficial: anomalía de temperatura del mar NASA GHRSST MUR por día, con la paleta publicada por GIBS
//    (leyenda exacta y lectura del valor al hacer clic) y la lluvia satelital NASA IMERG del mismo día.
//  · Modelo: corrientes superficiales reales animadas (Open-Meteo Marine, ocean.js).
//  · Esquema conceptual: cinco pasos del mecanismo (mar cálido → humedad → lluvia → quebradas → impactos) con
//    flujos animados ilustrativos; no son mediciones y no llevan cifras propias.
/* global maplibregl */
import { getFirstSymbol, map } from './map.js'
import { setOcean } from './ocean.js'
import { cssVar, esc, getJSON, kindBadge } from './util.js'

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const TILE = (layer, date) => `${location.origin}/api/v1/intel/weather/tiles/gibs/${layer}/{z}/{x}/{y}.png?date=${date}`

const STEPS = [
  { title: 'Mar más cálido frente a la costa', where: [-84, -6, 4.2], flows: ['kelvin'],
    text: 'El agua cálida del Pacífico ecuatorial avanza hacia la costa norte y los vientos alisios se debilitan. En rojo, el mar está más cálido que su promedio (climatología MUR 2003–2014); en azul, más frío.' },
  { title: 'Más evaporación y aire húmedo', where: [-81.5, -6.5, 5], flows: ['humedad'],
    text: 'El mar cálido evapora más. El viento lleva ese aire húmedo hacia la costa, que de ordinario es desértica porque el mar frío frena la formación de nubes de lluvia.' },
  { title: 'Lluvias intensas en la costa y la sierra oeste', where: [-79.6, -6.8, 5.6], flows: ['ascenso'], precip: true,
    text: 'El aire húmedo asciende por la cordillera occidental, se enfría y forma nubes de tormenta. La capa azul es la lluvia satelital NASA IMERG del mismo día.' },
  { title: 'Se activan quebradas y ríos', where: [-78.8, -8, 5.6], flows: ['escorrentia'],
    text: 'La lluvia de la vertiente occidental baja por quebradas secas y ríos: huaicos, crecidas y desbordes hacia los valles costeros.' },
  { title: 'Impactos en ciudades y valles', where: [-78.8, -8, 5.2], flows: ['escorrentia'], cities: true,
    text: 'Inundaciones y huaicos en Tumbes, Piura, Lambayeque, La Libertad, Áncash y Lima. Los registros históricos (OSSO/DesInventar, SINPAD) están en «Historias de eventos».' },
]

// trazos ilustrativos [lon, lat]; la dirección importa (el brillo avanza del primer al último punto)
const FLOWS = {
  kelvin: [[[-95, -0.5], [-88, -1.5], [-83, -3.2], [-81.6, -4.6]], [[-95, -3], [-88, -4], [-83.5, -6], [-81.6, -7.2]], [[-93, 1.5], [-86, 0.2], [-81.5, -2.4]]],
  humedad: [-3.8, -5, -6.2, -7.4, -8.6, -9.8].map((y) => [[-86.2, y - 0.6], [-83.4, y - 0.2], [-80.9, y + 0.15]]),
  ascenso: [-4.2, -5.3, -6.4, -7.5, -8.6].map((y) => [[-80.8, y], [-79.9, y - 0.15], [-79.1, y - 0.35]]),
  escorrentia: [-4.6, -5.6, -6.8, -7.9, -9, -10.1, -11.6].map((y) => [[-78.6, y - 0.4], [-79.4, y - 0.1], [-80.3, y + 0.1]]),
}
const CITIES = [['Tumbes', -80.45, -3.57], ['Piura', -80.63, -5.19], ['Chiclayo', -79.84, -6.77], ['Trujillo', -79.03, -8.11],
  ['Chimbote', -78.58, -9.07], ['Lima', -77.04, -12.05]]
const CALLOUTS = [[-84.6, -2.2], [-84.8, -7.8], [-78.6, -5.0], [-77.4, -8.6], [-77.6, -11.4]]

let on = false, card = null, legend = null, cmap = null, frames = [], fi = 0, step = 0
let playTimer = 0, flowRaf = 0, popup = null, callouts = [], cityMarkers = []

function addRaster(id, layer, date, opacity) {
  if (map.getSource(id)) { map.getSource(id).setTiles([TILE(layer, date)]); return }
  map.addSource(id, { type: 'raster', tiles: [TILE(layer, date)], tileSize: 256, maxzoom: layer === 'ssta' ? 7 : 6,
    attribution: 'NASA EOSDIS GIBS' })
  map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity, 'raster-fade-duration': reduce() ? 0 : 250 } }, getFirstSymbol())
}

function removeLayer(id) {
  if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(id)) map.removeSource(id)
}

/** Un fotograma por mes (día 15, o el día publicado más cercano dentro de ese mes) desde el primer día con datos. */
function monthlyFrames(r) {
  const inRange = (d) => r.ranges.some(([a, b]) => a <= d && d <= b)
  const out = []
  const first = new Date(`${r.first}T00:00:00Z`), last = new Date(`${r.latest}T00:00:00Z`)
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); m === 11 ? (y++, m = 0) : m++) {
    const ym = `${y}-${String(m + 1).padStart(2, '0')}`
    const isLast = y === last.getUTCFullYear() && m === last.getUTCMonth()
    let d = isLast ? r.latest : `${ym}-15`
    if (!inRange(d)) d = Array.from({ length: 28 }, (_, k) => `${ym}-${String(k + 1).padStart(2, '0')}`).find(inRange)
    if (d && d <= r.latest && d >= r.first) out.push(d)
  }
  return out
}

function legendHtml() {
  if (!cmap) return ''
  const ramp = cmap.entries.filter((e) => e.from !== null && e.to !== null)
  // de arriba (+3 °C) hacia abajo (−3 °C), con posiciones crecientes
  const stops = [...ramp].reverse().map((e, i, a) => `rgb(${e.rgb.join(',')}) ${((i / (a.length - 1)) * 100).toFixed(1)}%`).join(', ')
  return `<p class="ex-leg-t">Anomalía de temperatura del mar</p><div class="ex-leg-body"><div class="ex-leg-ramp" style="background:linear-gradient(${stops})"></div>
    <ol class="ex-leg-ticks">${['+3', '+2', '+1', '0', '−1', '−2', '−3'].map((t) => `<li>${t} °C</li>`).join('')}</ol></div>
    <p class="src-meta">NASA GHRSST MUR · ${esc(frames[fi] || '')}<br>paleta oficial GIBS · clic en el mar para leer el valor</p>`
}

function stepsHtml() {
  return STEPS.map((s, k) => `<li><button type="button" data-ex-step="${k}" aria-current="${k === step}"><span class="n">${k + 1}</span>
    <span><b>${esc(s.title)}</b>${k === step ? `<small>${esc(s.text)}</small>` : ''}</span></button></li>`).join('')
}

function cardHtml() {
  const d = frames[fi] || '—'
  return `<div class="ex-head"><div><p class="eyebrow">El Niño en el mapa</p><h2>Cómo se forma y qué provoca</h2></div>
      <button class="btn btn-ghost btn-icon" type="button" data-ex="min" aria-label="Ocultar o mostrar la explicación">▾</button></div>
    <div class="ex-body">
    <div class="ex-time" role="group" aria-label="Evolución de la temperatura del mar">
      <button class="btn btn-icon" type="button" data-ex="prev" aria-label="Mes anterior" ${fi ? '' : 'disabled'}>◀</button>
      <button class="btn btn-icon btn-primary" type="button" data-ex="play" aria-pressed="${!!playTimer}" aria-label="${playTimer ? 'Pausar' : 'Reproducir'} la evolución">${playTimer ? '❚❚' : '▶'}</button>
      <button class="btn btn-icon" type="button" data-ex="next" aria-label="Mes siguiente" ${fi < frames.length - 1 ? '' : 'disabled'}>▶</button>
      <input type="range" id="ex-date" min="0" max="${Math.max(0, frames.length - 1)}" value="${fi}" aria-label="Fecha de la imagen NASA">
      <output class="ex-date">${esc(d)}</output></div>
    <p class="src-meta">${kindBadge('oficial', 'NASA GHRSST MUR')} anomalía diaria · publicada desde ${esc(frames[0] || '—')}. Para eventos anteriores (1982–83, 1997–98) se usa el ICEN del gráfico inferior.</p>
    <ol class="ex-steps">${stepsHtml()}</ol>
    <div class="ex-nav"><button class="btn" type="button" data-ex="steps">▶ Recorrer los 5 pasos</button>
      <label class="ex-check"><input type="checkbox" id="ex-flow" checked> Flujos</label>
      <label class="ex-check"><input type="checkbox" id="ex-cur" ${step === 0 ? 'checked' : ''}> Corrientes reales</label></div>
    <p class="src-meta">${kindBadge('estimacion', 'esquema conceptual')} Las flechas ilustran el mecanismo (ENFEN, SENAMHI); no son mediciones.
      ${kindBadge('proyeccion', 'modelo')} Corrientes: partículas del modelo Open-Meteo Marine.</p></div>`
}

function renderCard() {
  if (!card) return
  const min = card.classList.contains('min')
  card.innerHTML = cardHtml()
  card.classList.toggle('min', min)
  if (legend) legend.innerHTML = legendHtml()
}

function setFrame(i) {
  fi = Math.max(0, Math.min(frames.length - 1, i))
  const d = frames[fi]
  if (!d) return
  addRaster('ex-ssta', 'ssta', d, 0.85)
  if (STEPS[step].precip) addRaster('ex-precip', 'precip', d, 0.9)
  const out = card?.querySelector('.ex-date')
  if (out) out.textContent = d
  const r = card?.querySelector('#ex-date')
  if (r) r.value = String(fi)
  for (const [k, dis] of [['prev', fi === 0], ['next', fi === frames.length - 1]]) { const b = card?.querySelector(`[data-ex="${k}"]`); if (b) b.disabled = dis }
  if (legend) legend.innerHTML = legendHtml()
}

// ── flujos animados (cometas que avanzan por cada trazo) ───────────────────
const FLOW_IDS = Object.keys(FLOWS).map((k) => `ex-flow-${k}`)
function ensureFlows() {
  const color = { kelvin: cssVar('--fx-wind'), humedad: cssVar('--fx-rain'), ascenso: cssVar('--fx-storm'), escorrentia: cssVar('--info') }
  for (const [k, lines] of Object.entries(FLOWS)) {
    const id = `ex-flow-${k}`
    if (map.getSource(id)) continue
    map.addSource(id, { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection',
      features: lines.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) } })
    map.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-width': k === 'kelvin' ? 5 : 3.5, 'line-color': color[k], 'line-opacity': 0.95,
        'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(0,0,0,0)', 1, color[k]] } })
    map.setLayoutProperty(id, 'visibility', 'none')
    FLOWS[k].color = color[k]
  }
}

function comet(color, t) {
  // banda brillante que avanza por el trazo: cola que se desvanece detrás y nada delante
  const clear = 'rgba(0,0,0,0)'
  const head = Math.max(0.02, Math.min(1, t)), tail = Math.max(0, head - 0.35)
  const s = []
  const add = (p, c) => { if (!s.length || p > s[s.length - 2]) s.push(p, c) }
  add(0, clear)
  if (tail > 0) add(tail, clear)
  add(head, color)
  if (head < 0.98) { add(head + 0.02, clear); add(1, clear) } else add(1, color)
  return ['interpolate', ['linear'], ['line-progress'], ...s]
}

function showFlows() {
  cancelAnimationFrame(flowRaf)
  const wanted = card?.querySelector('#ex-flow')?.checked !== false ? STEPS[step].flows.map((k) => `ex-flow-${k}`) : []
  for (const id of FLOW_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', wanted.includes(id) ? 'visible' : 'none')
  if (!wanted.length || reduce()) return
  const t0 = performance.now()
  let last = 0
  const tick = (now) => {
    if (!on) return
    if (now - last > 50) {   // ~20 fps: suficiente para leer la dirección sin cargar la GPU
      last = now
      const t = ((now - t0) / 2600) % 1.35
      for (const id of wanted) {
        const k = id.slice(8)
        if (map.getLayer(id)) map.setPaintProperty(id, 'line-gradient', comet(FLOWS[k].color, Math.min(1, t)))
      }
    }
    flowRaf = requestAnimationFrame(tick)
  }
  flowRaf = requestAnimationFrame(tick)
}

function drawCallouts() {
  callouts.forEach((m) => m.remove())
  callouts = STEPS.map((s, k) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'ex-call'
    el.setAttribute('aria-current', String(k === step))
    el.innerHTML = `<span class="n">${k + 1}</span><span class="t"><b>${esc(s.title)}</b></span>`
    el.addEventListener('click', (e) => { e.stopPropagation(); goStep(k) })
    return new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat(CALLOUTS[k]).addTo(map)
  })
  cityMarkers.forEach((m) => m.remove())
  cityMarkers = STEPS[step].cities ? CITIES.map(([n, lon, lat]) => {
    const el = Object.assign(document.createElement('span'), { className: 'ex-city', textContent: n })
    return new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([lon, lat]).addTo(map)
  }) : []
}

async function goStep(k, { fly = true } = {}) {
  step = k
  const s = STEPS[k]
  if (s.precip) addRaster('ex-precip', 'precip', frames[fi], 0.9)
  else removeLayer('ex-precip')
  if (fly) map.flyTo({ center: [s.where[0], s.where[1]], zoom: s.where[2], duration: reduce() ? 0 : 1400, essential: true })
  renderCard()
  const cur = card?.querySelector('#ex-cur')
  if (cur) { cur.checked = k <= 1; await setOcean(k <= 1, 'sst') }
  drawCallouts()
  showFlows()
}

let stepsTimer = 0
function playSteps() {
  clearInterval(stepsTimer)
  let k = 0
  goStep(0)
  stepsTimer = setInterval(() => { k++; if (k >= STEPS.length || !on) return clearInterval(stepsTimer); goStep(k) }, 7000)
}

function togglePlay() {
  if (playTimer) { clearInterval(playTimer); playTimer = 0 }
  else {
    if (fi >= frames.length - 1) setFrame(Math.max(0, frames.length - 25))   // empieza dos años atrás
    playTimer = setInterval(() => { if (fi >= frames.length - 1) { clearInterval(playTimer); playTimer = 0; renderCard(); return } setFrame(fi + 1) }, reduce() ? 2500 : 1300)
  }
  const b = card?.querySelector('[data-ex="play"]')
  if (b) { b.textContent = playTimer ? '❚❚' : '▶'; b.setAttribute('aria-pressed', String(!!playTimer)) }
}

/** Lee el valor de la anomalía en el punto: color exacto de la tesela NASA → intervalo de la paleta oficial. */
export async function probeExplain(lngLat) {
  if (!on || !cmap || !frames[fi]) return false
  const z = Math.max(0, Math.min(7, Math.floor(map.getZoom())))
  const n = 2 ** z
  const xf = (lngLat.lng + 180) / 360 * n
  const s = Math.sin(lngLat.lat * Math.PI / 180)
  const yf = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n
  const url = TILE('ssta', frames[fi]).replace('{z}', z).replace('{x}', Math.floor(xf)).replace('{y}', Math.floor(yf))
  let txt
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error()
    const bmp = await createImageBitmap(await res.blob())
    const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(bmp, 0, 0)
    const [r, gg, b, a] = g.getImageData(Math.floor((xf % 1) * bmp.width), Math.floor((yf % 1) * bmp.height), 1, 1).data
    if (a < 10) txt = 'Sin dato aquí (tierra, hielo o fuera de la imagen).'
    else {
      const best = cmap.entries.reduce((m, e) => { const d = (e.rgb[0] - r) ** 2 + (e.rgb[1] - gg) ** 2 + (e.rgb[2] - b) ** 2; return d < m.d ? { d, e } : m }, { d: Infinity }).e
      const f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',')
      txt = best.from === null ? `Anomalía menor que ${f(best.to)} °C` : best.to === null ? `Anomalía mayor que ${f(best.from)} °C`
        : `Anomalía entre ${f(best.from)} y ${f(best.to)} °C`
      txt += best.from !== null && best.from >= 0.5 ? ' · mar más cálido que su promedio' : best.to !== null && best.to <= -0.5 ? ' · mar más frío que su promedio' : ' · cerca de lo normal'
    }
  } catch { txt = 'No se pudo leer la imagen NASA en este punto.' }
  popup?.remove()
  popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'ex-pop' }).setLngLat(lngLat)
    .setHTML(`<b>${esc(txt)}</b><p class="src-meta">NASA GHRSST MUR · ${esc(frames[fi])} · paleta oficial GIBS (intervalos de 0,1 °C)</p>`).addTo(map)
  return true
}

function onCard(e) {
  const st = e.target.closest('[data-ex-step]')
  if (st) { clearInterval(stepsTimer); return goStep(Number(st.dataset.exStep)) }
  const a = e.target.closest('[data-ex]')?.dataset.ex
  if (a === 'prev') setFrame(fi - 1)
  else if (a === 'next') setFrame(fi + 1)
  else if (a === 'play') togglePlay()
  else if (a === 'steps') playSteps()
  else if (a === 'min') card.classList.toggle('min')
}

export async function startExplain() {
  if (on) return
  on = true
  card = document.createElement('section')
  card.className = 'enso-explain hud hud-frame'
  if (matchMedia('(max-width: 767px)').matches) card.classList.add('min')   // en móvil empieza plegada: el mapa primero
  card.setAttribute('aria-label', 'Explicación de El Niño en el mapa')
  card.innerHTML = '<p class="loading">Cargando imágenes NASA</p>'
  document.body.appendChild(card)
  legend = document.createElement('div')
  legend.className = 'ex-legend hud'
  map.getContainer().appendChild(legend)
  card.addEventListener('click', onCard)
  card.addEventListener('input', (e) => { if (e.target.id === 'ex-date') setFrame(Number(e.target.value)) })
  card.addEventListener('change', async (e) => {
    if (e.target.id === 'ex-flow') showFlows()
    if (e.target.id === 'ex-cur') await setOcean(e.target.checked, 'sst')
  })
  try {
    const [range, cm] = await Promise.all([getJSON('/api/v1/intel/weather/gibs-range/ssta'), getJSON('/api/v1/intel/weather/colormap/ssta')])
    if (!on) return
    cmap = cm
    frames = monthlyFrames(range)
    fi = frames.length - 1
  } catch (err) {
    card.innerHTML = `<p class="note">No se pudieron cargar las imágenes NASA: ${esc(err.message)}</p>`
    return
  }
  ensureFlows()
  setFrame(fi)
  await goStep(0, { fly: true })
}

export function stopExplain() {
  if (!on) return
  on = false
  clearInterval(playTimer); playTimer = 0
  clearInterval(stepsTimer)
  cancelAnimationFrame(flowRaf)
  popup?.remove()
  callouts.forEach((m) => m.remove()); callouts = []
  cityMarkers.forEach((m) => m.remove()); cityMarkers = []
  for (const id of ['ex-ssta', 'ex-precip', ...FLOW_IDS]) removeLayer(id)
  setOcean(false)
  card?.remove(); card = null
  legend?.remove(); legend = null
}

export const isExplaining = () => on
/** Al abrir una historia, la explicación se pliega para dejar sitio. */
export function foldExplain() { card?.classList.add('min') }

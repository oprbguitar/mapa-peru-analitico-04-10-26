// Capa táctica del simulador (operaciones): retícula, coordenadas bajo el cursor (grados y UTM), cinta de rumbo,
// reloj DTG en hora Zulu, cuadrícula UTM de 1 km o 500 m, anillos de alcance por unidad y registro de eventos del tiempo virtual.
// Todo es lectura del mapa y de la simulación local; no se envía nada fuera del equipo.
import { map } from './map.js'
import { cssVar, esc } from './util.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
let root = null
let on = { grid: false }
const GRID_STEPS = [0, 1000, 500]   // metros; 500 m es el mínimo
let gridIx = 0
let ringsFor = null
let log = []
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC']

/** UTM (WGS84) en formato de referencia de campo: «18L 279 123E 8 664 321N». */
export function utm(lat, lon, forceZone) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2)
  const zone = forceZone || Math.floor((lon + 180) / 6) + 1
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180
  const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2)
  const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lon0)
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi))
  const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000
  let Nn = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720))
  if (lat < 0) Nn += 10000000
  const band = 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)] || '?'
  const g = (x) => Math.round(x).toLocaleString('es-PE').replace(/[.,]/g, ' ')
  return { zone, band, e: Math.round(E), n: Math.round(Nn), text: `${zone}${band} ${g(E)}E ${g(Nn)}N` }
}

const dms = (v, pos, neg) => {
  const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d - m / 60) * 3600).toFixed(1)
  return `${d}°${String(m).padStart(2, '0')}′${s.padStart(4, '0')}″${v >= 0 ? pos : neg}`
}

/** Grupo fecha-hora en Zulu: «121352Z OCT 26». */
export function dtg(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0')
  return `${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`
}

function ensureLayers() {
  if (map.getSource('tac-grid')) return
  map.addSource('tac-grid', { type: 'geojson', data: fc([]) })
  map.addSource('tac-rings', { type: 'geojson', data: fc([]) })
  map.addLayer({ id: 'tac-grid', type: 'line', source: 'tac-grid', layout: { visibility: 'none' },
    paint: { 'line-color': cssVar('--accent'), 'line-width': ['case', ['get', 'major'], 1, 0.6], 'line-opacity': ['case', ['get', 'major'], 0.55, 0.35] } })
  map.addLayer({ id: 'tac-rings', type: 'line', source: 'tac-rings',
    paint: { 'line-color': cssVar('--accent'), 'line-width': 1.4, 'line-dasharray': [4, 3], 'line-opacity': 0.9 } })
}

/** Inversa UTM (WGS84): de este/norte en una zona a latitud y longitud (precisión submétrica). */
export function utmToLatLon(zone, E, N, south) {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const x = E - 500000, y = south ? N - 10000000 : N
  const mu = y / k0 / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2
  const R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = x / (N1 * k0)
  const lat = p1 - (N1 * Math.tan(p1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720)
  const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(p1)
  return [((zone - 1) * 6 - 180 + 3) + lon * 180 / Math.PI, lat * 180 / Math.PI]
}

/** Cuadrícula UTM real (líneas cada 1 km o 500 m de este/norte en la zona del centro), como en una carta topográfica. */
function drawGrid() {
  if (!on.grid || !map.getSource('tac-grid')) return
  const step = GRID_STEPS[gridIx]
  const b = map.getBounds(), c = map.getCenter()
  const zone = utm(c.lat, c.lng).zone, south = c.lat < 0
  const corners = [[b.getWest(), b.getSouth()], [b.getEast(), b.getSouth()], [b.getEast(), b.getNorth()], [b.getWest(), b.getNorth()]]
    .map(([lo, la]) => utm(la, lo, zone))
  const e0 = Math.floor(Math.min(...corners.map((q) => q.e)) / step) * step, e1 = Math.max(...corners.map((q) => q.e))
  const n0 = Math.floor(Math.min(...corners.map((q) => q.n)) / step) * step, n1 = Math.max(...corners.map((q) => q.n))
  if ((e1 - e0) / step > 160 || (n1 - n0) / step > 160) { setGridNote('acerca el mapa'); return map.getSource('tac-grid').setData(fc([])) }
  setGridNote('')
  const feats = []
  const line = (pts, major) => feats.push({ type: 'Feature', properties: { major }, geometry: { type: 'LineString', coordinates: pts } })
  const K = 12
  for (let e = e0; e <= e1; e += step) line(Array.from({ length: K + 1 }, (_, i) => utmToLatLon(zone, e, n0 + (n1 - n0 + step) * i / K, south)), e % 1000 === 0)
  for (let n = n0; n <= n1; n += step) line(Array.from({ length: K + 1 }, (_, i) => utmToLatLon(zone, e0 + (e1 - e0 + step) * i / K, n, south)), n % 1000 === 0)
  map.getSource('tac-grid').setData(fc(feats))
}

function setGridNote(text) {
  const b = root?.querySelector('[data-tac="grid"]')
  if (!b) return
  const step = GRID_STEPS[gridIx]
  b.textContent = step ? `Cuadrícula ${step >= 1000 ? `${step / 1000} km` : `${step} m`}${text ? ` · ${text}` : ''}` : 'Cuadrícula'
}

const circle = (lon, lat, km) => Array.from({ length: 65 }, (_, i) => {
  const t = (i / 64) * 2 * Math.PI
  return [lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(t), lat + (km / 111.32) * Math.sin(t)]
})

/** Anillos de alcance 5/10/15 min (línea recta × rodeo, velocidad efectiva del escenario) alrededor de una unidad. */
export function showRings(unit, speedKmh, circuity = 1.4) {
  ensureLayers()
  if (!unit || ringsFor === unit.id) { ringsFor = null; map.getSource('tac-rings').setData(fc([])); renderRingLegend(); return }
  ringsFor = unit.id
  const rings = [5, 10, 15].map((m) => ({ m, km: (speedKmh * m / 60) / circuity }))
  map.getSource('tac-rings').setData(fc(rings.map((r) => ({ type: 'Feature', properties: { m: r.m }, geometry: { type: 'LineString', coordinates: circle(unit.lon, unit.lat, r.km) } }))))
  renderRingLegend(unit, rings, speedKmh)
}

function renderRingLegend(unit, rings, speed) {
  const el = root?.querySelector('.tac-rings-info')
  if (!el) return
  el.hidden = !unit
  if (unit) el.textContent = `${unit.callsign} · alcance ${rings.map((r) => `${r.m}′ ${r.km.toFixed(1)} km`).join(' · ')} · ${speed.toFixed(0)} km/h efectivos`
}

/** Registro táctico: lista de eventos {t, text, kind} del tiempo virtual; se muestran los ocurridos hasta `now`. */
export function setLog(events) { log = events || []; renderLog(0) }

export function renderLog(now) {
  const el = root?.querySelector('.tac-log ol')
  if (!el) return
  const shown = log.filter((e) => e.t <= now).slice(-9).reverse()
  root.querySelector('.tac-log').hidden = !log.length
  el.innerHTML = shown.map((e) => `<li data-kind="${esc(e.kind)}"><b>T+${String(Math.floor(e.t / 60)).padStart(2, '0')}:${String(Math.floor(e.t % 60)).padStart(2, '0')}</b> ${esc(e.text)}</li>`).join('')
}

function heading() {
  const b = ((map.getBearing() % 360) + 360) % 360
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  root.querySelector('.tac-heading').textContent = `RUMBO ${String(Math.round(b)).padStart(3, '0')}° ${names[Math.round(b / 45) % 8]}`
}

export function initTactical() {
  if (root) return
  root = document.createElement('div')
  root.className = 'tac'
  root.setAttribute('aria-hidden', 'false')
  root.innerHTML = `<div class="tac-reticle" aria-hidden="true"></div>
    <div class="tac-stack">
    <div class="tac-top"><span class="tac-heading">RUMBO 000° N</span><span class="tac-dtg"></span></div>
    <div class="tac-readout" aria-live="off"><span class="tac-ll">—</span><span class="tac-utm">—</span></div>
    <div class="tac-tools" role="toolbar" aria-label="Capa táctica">
      <button type="button" class="btn" data-tac="grid" aria-pressed="false" title="Cuadrícula UTM alineada a la zona: apagada → 1 km → 500 m (tecla G)">Cuadrícula</button></div>
    <div class="tac-measure" id="tac-measure" role="status" aria-live="polite" hidden></div>
    </div>
    <p class="tac-rings-info" hidden></p>
    <section class="tac-log hud" hidden aria-label="Registro de eventos"><h3>Registro · tiempo virtual</h3><ol></ol></section>`
  document.body.appendChild(root)
  ensureLayers()
  // la «Z» va en otra tipografía: en la monoespaciada se confunde con un «2»
  const clock = () => { root.querySelector('.tac-dtg').innerHTML = `DTG ${dtg().replace('Z', '<b class="tac-z">Z</b>')}` }
  clock()
  setInterval(clock, 15000)
  map.on('mousemove', (e) => {
    if (!document.body.classList.contains('sim-on')) return
    const { lat, lng } = e.lngLat
    root.querySelector('.tac-ll').textContent = `${dms(lat, 'N', 'S')} ${dms(lng, 'E', 'O')}`
    root.querySelector('.tac-utm').textContent = `UTM ${utm(lat, lng).text}`
  })
  map.on('rotate', heading)
  map.on('moveend', drawGrid)
  heading()
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tac]')
    if (!b) return
    gridIx = (gridIx + 1) % GRID_STEPS.length
    on.grid = gridIx > 0
    b.setAttribute('aria-pressed', String(on.grid))
    setGridNote('')
    map.setLayoutProperty('tac-grid', 'visibility', on.grid ? 'visible' : 'none')
    drawGrid()
  })
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('sim-on') || e.target.closest('input, textarea, select') || e.key.toLowerCase() !== 'g' || e.ctrlKey || e.metaKey) return
    root.querySelector('[data-tac="grid"]').click()
  })
}

export function hideTactical() {
  ringsFor = null
  if (map.getSource('tac-rings')) map.getSource('tac-rings').setData(fc([]))
  if (map.getLayer('tac-grid')) map.setLayoutProperty('tac-grid', 'visibility', 'none')
  on.grid = false
  gridIx = 0
  root?.querySelector('[data-tac="grid"]')?.setAttribute('aria-pressed', 'false')
  setGridNote('')
  setLog([])
  renderRingLegend(null)
}

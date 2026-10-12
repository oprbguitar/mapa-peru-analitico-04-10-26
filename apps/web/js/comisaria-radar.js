// Radar de comisarías: con el modo activo, cada comisaría territorial a la vista muestra su radio de inflexión (mitad de la
// distancia a la vecina) y un clic en el mapa abre la comisaría más cercana con su área de atención por cercanía (Voronoi),
// sus radios, las vecinas, las sedes dentro del área y las cifras oficiales del distrito tal cual. Funciona en Mapa y en
// Operativos. Todo es cálculo geométrico sobre ubicaciones OSM aproximadas: no es la jurisdicción oficial.
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge, toast } from './util.js'

const fc = (features) => ({ type: 'FeatureCollection', features })
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const st = { on: false, data: null, sweep: 0, timer: 0, moveTimer: 0, panel: null, btns: new Set(), seq: 0 }
const INSIDE = { serenazgo: ['Serenazgo', '--inst-serenazgo'], fiscalia: ['Ministerio Público', '--inst-fiscalia'],
  judicial: ['Poder Judicial', '--inst-judicial'], comisaria: ['Otras dependencias PNP', '--inst-comisaria'] }

/** Círculo geodésico aproximado (suficiente a escala de ciudad). */
function circle(lon, lat, km, n = 72, props = {}) {
  const ring = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    ring.push([lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(a), lat + (km / 110.574) * Math.sin(a)])
  }
  return { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } }
}

function sector(lon, lat, km, from, span = 0.7) {
  const ring = [[lon, lat]]
  for (let i = 0; i <= 16; i++) {
    const a = from - (i / 16) * span
    ring.push([lon + (km / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.cos(a), lat + (km / 110.574) * Math.sin(a)])
  }
  ring.push([lon, lat])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

function ensureLayers() {
  if (map.getSource('rad-all')) return
  for (const id of ['rad-all', 'rad-sedes', 'rad-area', 'rad-rings', 'rad-sweep', 'rad-links', 'rad-pts']) map.addSource(id, { type: 'geojson', data: fc([]) })
  const c = cssVar('--inst-comisaria')
  map.addLayer({ id: 'rad-all-fill', type: 'fill', source: 'rad-all', paint: { 'fill-color': c, 'fill-opacity': 0.07 } })
  map.addLayer({ id: 'rad-all-line', type: 'line', source: 'rad-all', paint: { 'line-color': c, 'line-width': 1.2, 'line-opacity': 0.7 } })
  map.addLayer({ id: 'rad-area-fill', type: 'fill', source: 'rad-area', paint: { 'fill-color': cssVar('--info'), 'fill-opacity': 0.14 } })
  map.addLayer({ id: 'rad-area-line', type: 'line', source: 'rad-area', paint: { 'line-color': cssVar('--info'), 'line-width': 2.5, 'line-dasharray': [3, 2] } })
  map.addLayer({ id: 'rad-sweep', type: 'fill', source: 'rad-sweep', paint: { 'fill-color': cssVar('--accent'), 'fill-opacity': 0.22 } })
  map.addLayer({ id: 'rad-rings', type: 'line', source: 'rad-rings', paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'],
    'line-dasharray': ['match', ['get', 'k'], 'media', ['literal', [4, 3]], 'alcance', ['literal', [1, 2]], ['literal', [1, 0]]] } })
  map.addLayer({ id: 'rad-links', type: 'line', source: 'rad-links', paint: { 'line-color': c, 'line-width': 1.5, 'line-dasharray': [1, 2], 'line-opacity': 0.8 } })
  map.addLayer({ id: 'rad-sedes', type: 'circle', source: 'rad-sedes', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 15, 7],
    'circle-color': c, 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--void') } })
  map.addLayer({ id: 'rad-pts', type: 'circle', source: 'rad-pts', paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'color'],
    'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--void') } })
  map.on('click', 'rad-sedes', (e) => { const id = e.features[0]?.properties?.id; if (id) { e.preventDefault(); showRadar(id) } })
  map.on('mouseenter', 'rad-sedes', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'rad-sedes', () => (map.getCanvas().style.cursor = ''))
  map.on('moveend', () => { if (st.on) { clearTimeout(st.moveTimer); st.moveTimer = setTimeout(loadView, 250) } })
}

const setData = (id, f) => map.getSource(id)?.setData(fc(f))

async function loadView() {
  if (!st.on) return
  if (map.getZoom() < 11) {
    setData('rad-all', []); setData('rad-sedes', [])
    return note('Acerca el mapa (zoom 11 o más) para ver el radar de cada comisaría. Un clic en el mapa abre la más cercana.')
  }
  const b = map.getBounds()
  try {
    const d = await getJSON(`/api/v1/intel/coverage/radar?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(4)).join(',')}`)
    if (!st.on) return
    if (d.truncated) { setData('rad-all', []); setData('rad-sedes', []); return note(d.note) }
    setData('rad-all', d.items.map((i) => circle(i.lon, i.lat, i.inflexion_km, 48, { id: i.id })))
    setData('rad-sedes', d.items.map((i) => ({ type: 'Feature', properties: { id: i.id, name: i.name }, geometry: { type: 'Point', coordinates: [i.lon, i.lat] } })))
    if (!st.data) note(`${d.count} comisarías territoriales a la vista con su radio de inflexión. Haz clic en una (o en cualquier punto) para ver su área de atención.`)
  } catch (e) { note(e.message) }
}

// ── panel ───────────────────────────────────────────────────────────────────
function panel() {
  if (st.panel) return st.panel
  st.panel = Object.assign(document.createElement('section'), { className: 'radar-panel hud hud-frame' })
  st.panel.setAttribute('aria-label', 'Radar de comisarías')
  st.panel.setAttribute('aria-live', 'polite')
  st.panel.hidden = true
  document.body.append(st.panel)
  st.panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rad]')
    if (!b) return
    if (b.dataset.rad === 'close') setRadarMode(false)
    else if (b.dataset.rad === 'clear') clearSelection()
    else if (b.dataset.rad === 'go') showRadar(b.dataset.id)
  })
  return st.panel
}

const head = `<div class="radar-head"><b>◎ Radar de comisarías</b><button class="btn btn-ghost btn-icon" type="button" data-rad="close" aria-label="Cerrar el radar">✕</button></div>`
function note(msg) {
  const p = panel()
  p.hidden = false
  if (!st.data) p.innerHTML = `${head}<p class="src-meta">${esc(msg)}</p>`
}

function render() {
  const d = st.data
  const p = panel()
  p.hidden = false
  const dist = d.district || {}
  const den = dist.denuncias
  p.innerHTML = `${head}
    <h3 class="radar-name">${esc(d.sede.name)}</h3>
    <p class="src-meta">${esc([d.sede.distrito, d.sede.provincia, d.sede.departamento].filter(Boolean).join(', '))} ${kindBadge('vivo_tercero', 'OSM · ubicación aproximada')}</p>
    ${d.territorial === false ? '<p class="note">Esta dependencia no parece territorial (dirección, división, escuela…); su área se calcula igual frente a las comisarías vecinas.</p>' : ''}
    <dl class="radar-kv">
      <div><dt><i class="radar-k" style="--c:var(--info)"></i>Área de atención</dt><dd>${fmt(d.area_km2, 2)} km²</dd></div>
      <div><dt><i class="radar-k is-solid"></i>Radio de inflexión</dt><dd>${d.inflexion_km != null ? fmt(d.inflexion_km, 2) + ' km' : '—'}</dd></div>
      <div><dt><i class="radar-k is-dash"></i>Inflexión media (3 vecinas)</dt><dd>${d.mean_inflexion_km != null ? fmt(d.mean_inflexion_km, 2) + ' km' : '—'}</dd></div>
      <div><dt><i class="radar-k is-dot"></i>Alcance máximo del área</dt><dd>${fmt(d.reach_km, 2)} km</dd></div>
    </dl>
    <p class="src-meta">${kindBadge('calculado', 'cálculo geométrico')} ${esc(d.method)}</p>
    <h4 class="radar-h">Comisarías vecinas</h4>
    <ol class="radar-list">${d.neighbors.map((n) => `<li><button type="button" class="jo-link" data-rad="go" data-id="${esc(n.id)}">${esc(n.name)}</button>
      <span>${fmt(n.km, 2)} km · inflexión ${fmt(n.inflexion_km, 2)} km</span></li>`).join('') || '<li class="src-meta">Sin vecinas a menos de 25 km.</li>'}</ol>
    <h4 class="radar-h">Dentro del área</h4>
    <ul class="radar-inside">${Object.entries(INSIDE).map(([k, [label, c]]) => `<li><i style="background:var(${c})"></i>${label}<b>${d.inside_counts?.[k] ?? 0}</b></li>`).join('')}</ul>
    <h4 class="radar-h">Cifras oficiales del distrito ${dist.ubigeo ? `(${esc(dist.ubigeo)})` : ''}</h4>
    ${den ? `<p class="radar-off"><b>${den.total.toLocaleString('es-PE')}</b> denuncias en ${den.year} (${fmt(den.per_day, 1)} por día) ${kindBadge('oficial', 'MININTER · SIDPOL')}</p>
      <p class="src-meta">Cifra del distrito completo, tal como se publica: no se reparte entre comisarías.</p>` : '<p class="src-meta">Sin cifras oficiales descargadas para este distrito.</p>'}
    ${(dist.indicators || []).map((i) => `<p class="radar-off">${esc(i.label)}: <b>${fmt(i.value)}</b> (${i.year}) ${kindBadge('oficial', 'MININTER')}</p>`).join('')}
    <div class="jo-row"><button class="btn btn-ghost" type="button" data-rad="clear">Quitar selección</button></div>`
}

// ── selección de una comisaría ──────────────────────────────────────────────
export async function showRadar(id) {
  ensureLayers()
  if (!st.on) setRadarMode(true)
  const seq = ++st.seq
  const p = panel()
  p.hidden = false
  p.innerHTML = `${head}<p class="loading">Calculando el área de atención</p>`
  try {
    const d = await getJSON(`/api/v1/intel/coverage/comisaria?id=${encodeURIComponent(id)}`)
    if (seq !== st.seq) return
    st.data = d
    const { lon, lat } = d.sede
    setData('rad-area', d.area ? [{ type: 'Feature', properties: {}, geometry: d.area }] : [])
    const rings = []
    if (d.inflexion_km) rings.push(circle(lon, lat, d.inflexion_km, 72, { k: 'inflexion', color: cssVar('--accent'), w: 2.5 }))
    if (d.mean_inflexion_km) rings.push(circle(lon, lat, d.mean_inflexion_km, 72, { k: 'media', color: cssVar('--accent'), w: 1.5 }))
    if (d.reach_km) rings.push(circle(lon, lat, d.reach_km, 72, { k: 'alcance', color: cssVar('--info'), w: 1.5 }))
    setData('rad-rings', rings)
    setData('rad-links', d.neighbors.map((n) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lon, lat], [n.lon, n.lat]] } })))
    const pts = [{ type: 'Feature', properties: { color: cssVar('--accent'), r: 9 }, geometry: { type: 'Point', coordinates: [lon, lat] } }]
    for (const [k, list] of Object.entries(d.inside || {})) {
      for (const i of list) pts.push({ type: 'Feature', properties: { color: cssVar(INSIDE[k]?.[1] || '--ink-soft'), r: 5 }, geometry: { type: 'Point', coordinates: [i.lon, i.lat] } })
    }
    setData('rad-pts', pts)
    render()
    const reach = Math.max(d.reach_km || 0.5, 0.3)
    const dLat = reach / 110.574, dLon = reach / (111.32 * Math.cos(lat * Math.PI / 180))
    map.fitBounds([[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]], { padding: 80, maxZoom: 16, duration: reduced() ? 0 : 700 })
    startSweep()
  } catch (e) {
    if (seq === st.seq) p.innerHTML = `${head}<p class="note">${esc(e.message)}</p>`
  }
}

/** Clic en el mapa con el radar activo: abre la comisaría territorial más cercana. Devuelve true si atendió el clic. */
export async function radarClick(lngLat) {
  if (!st.on) return false
  if (map.queryRenderedFeatures(map.project(lngLat), { layers: ['rad-sedes'] }).length) return true   // lo atiende la capa
  try {
    const n = await getJSON(`/api/v1/intel/coverage/nearest?lat=${lngLat.lat.toFixed(6)}&lon=${lngLat.lng.toFixed(6)}&n=1&territorial=1`)
    const c = n.by_cat.comisaria?.[0]
    if (!c) { toast('No hay comisarías cargadas cerca de este punto.'); return true }
    showRadar(c.id)
  } catch (e) { toast(e.message) }
  return true
}

function startSweep() {
  clearInterval(st.timer)
  setData('rad-sweep', [])
  if (reduced() || !st.data) return
  st.timer = setInterval(() => {
    if (!st.data || !st.on) return clearInterval(st.timer)
    st.sweep = (st.sweep + 0.12) % (Math.PI * 2)
    const { lon, lat } = st.data.sede
    setData('rad-sweep', [sector(lon, lat, Math.max(st.data.reach_km || 0.5, st.data.inflexion_km || 0), -st.sweep)])
  }, 50)
}

function clearSelection() {
  st.data = null
  st.seq++
  clearInterval(st.timer)
  for (const id of ['rad-area', 'rad-rings', 'rad-sweep', 'rad-links', 'rad-pts']) setData(id, [])
  loadView()
}

export function setRadarMode(on) {
  ensureLayers()
  st.on = on
  for (const b of st.btns) b.setAttribute('aria-pressed', String(on))
  for (const id of ['rad-all-fill', 'rad-all-line', 'rad-area-fill', 'rad-area-line', 'rad-sweep', 'rad-rings', 'rad-links', 'rad-sedes', 'rad-pts']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  }
  if (on) { loadView(); map.getCanvas().style.cursor = '' }
  else { clearSelection(); if (st.panel) st.panel.hidden = true }
}

export const isRadarOn = () => st.on
export const toggleRadar = () => setRadarMode(!st.on)

/** Botón que activa/desactiva el radar (puede haber varios: barra de vista del mapa, pestaña Apoyos). */
export function bindRadarButton(btn) {
  if (!btn || st.btns.has(btn)) return
  st.btns.add(btn)
  btn.setAttribute('aria-pressed', String(st.on))
  btn.addEventListener('click', () => toggleRadar())
}

// botones «◎ Radar» dentro de popups y listas: data-radar="<id de comisaría>"
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-radar]')
  if (b) { e.preventDefault(); showRadar(b.dataset.radar) }
})

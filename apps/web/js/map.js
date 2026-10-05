// Mapa: base intercambiable (vectorial OpenFreeMap o raster realista), relieve 3D, límites y choropleth por escalas.
// Patrón de relieve tomado de RUC360 (mapa-vivo.js): Terrain Tiles Terrarium + hillshade + setTerrain.
/* global maplibregl */
import { cssVar, esc, fmt, fmtPct, state } from './util.js'

const LEVEL_SRC = { departamento: 'departamentos', provincia: 'provincias', distrito: 'distritos' }
// Paletas elegibles (tokens.css). «espectral» por defecto: azul → verde → amarillo → rojo.
export const PALETTES = {
  espectral: { label: 'Espectral (azul → rojo)', prefix: '--pal-esp-' },
  calor: { label: 'Calor (amarillo → rojo)', prefix: '--pal-cal-' },
  viridis: { label: 'Viridis (apta daltonismo)', prefix: '--pal-vir-' },
  cian: { label: 'Cian HUD (un tono)', prefix: '--seq-' },
}
const seqVars = () => Array.from({ length: 7 }, (_, i) => `${(PALETTES[state.palette] || PALETTES.espectral).prefix}${i + 1}`)
const DIV = ['--pal-esp-1', '--pal-esp-2', '--div-neg-1', '--div-mid', '--pal-esp-5', '--pal-esp-6', '--pal-esp-7']
const DIV_BREAKS = [-30, -15, -5, 5, 15, 30]

// Mapas base. `vector`: estilo OpenFreeMap. `raster`: capa de /tiles/base/<id> + qué conservar del vectorial.
export const BASES = {
  oscuro: { label: 'Noche (vectorial)', vector: 'dark' },
  calles: { label: 'Calles (vectorial)', vector: 'liberty' },
  satelite: { label: 'Satélite híbrido', raster: 'satelite', keep: 'labels', max: 19, attribution: '© Esri, Maxar, Earthstar Geographics' },
  sentinel: { label: 'Sentinel-2 2024 (10 m)', raster: 'sentinel', keep: 'labels', max: 15, attribution: 'Sentinel-2 cloudless 2024 © EOX (CC BY-NC-SA 4.0), Copernicus' },
  topo: { label: 'Topográfico', raster: 'topo', keep: 'none', max: 17, attribution: '© OpenTopoMap (CC BY-SA), © OSM' },
  ign: { label: 'Carta Nacional IGN 1:100 000', raster: 'ign100', keep: 'none', max: 16, attribution: '© Instituto Geográfico Nacional del Perú' },
}
const DEM_URL = '/tiles/base/dem/{z}/{x}/{y}'

export let map
let markReady
export const mapReady = new Promise((res) => (markReady = res))
let firstSymbol
let baseLayerIds = new Set()
let vectorStyle = null
let hovered = null
let selected = null
let painted = { level: null, ids: [] }
let hoverPopup
const styleHooks = []
export const view = { base: null, terrain: false, relief: false, exaggeration: 1.4 }

const OFFLINE_STYLE = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#05080c' } }] }
const abs = (u) => (u.startsWith('/') ? location.origin + u : u)

async function fetchStyle(name) {
  try {
    const r = await fetch(`/ofm/styles/${name}`, { cache: 'no-store' })
    if (!r.ok) throw new Error()
    const s = await r.json()
    for (const l of s.layers) {  // etiquetas en español cuando OSM tiene name:es
      const tf = l.type === 'symbol' && l.layout?.['text-field']
      if (tf && JSON.stringify(tf).includes('name')) l.layout['text-field'] = ['coalesce', ['get', 'name:es'], ['get', 'name']]
    }
    return s
  } catch {
    return OFFLINE_STYLE // sin red y sin caché: solo límites y capas propias
  }
}

/** Registra una función que debe correr cada vez que el estilo se recarga (cambio noche/día). */
export const onStyleReady = (fn) => styleHooks.push(fn)

export async function initMap({ onSelect, onClick }) {
  maplibregl.setWorkerUrl('vendor/maplibre/maplibre-gl-csp-worker.js')
  const dark = document.documentElement.dataset.theme !== 'light'
  view.base = dark ? 'oscuro' : 'calles'
  vectorStyle = BASES[view.base].vector
  const style = await fetchStyle(vectorStyle)
  baseLayerIds = new Set(style.layers.map((l) => l.id))
  map = new maplibregl.Map({
    container: 'map', style, center: [-75.2, -9.3], zoom: window.innerWidth < 768 ? 3.9 : 4.6,
    minZoom: 1.5, maxZoom: 18, maxPitch: 78, attributionControl: false,
    transformRequest: (url) => ({ url: abs(url) }),
  })
  window.__piMap = map // depuración desde la consola y pruebas E2E
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left') // licencias ODbL/CC BY: siempre visible
  if (!map.isStyleLoaded()) await new Promise((res) => map.once('style.load', res))
  addOwnLayers()
  for (const src of Object.values(LEVEL_SRC)) {
    map.on('mousemove', `${src}-fill`, (e) => hover(src, e))
    map.on('mouseleave', `${src}-fill`, () => unhover())
    map.on('click', `${src}-fill`, (e) => {
      const f = e.features?.[0]
      if (f && !state.wxPoint) onSelect(f.properties.u, f.properties)
    })
  }
  map.on('click', (e) => onClick?.(e))
  hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, maxWidth: '280px' })
  markReady(map)
  return map
}

/** Fuentes y capas propias (relieve, límites, choropleth). Se vuelven a crear si cambia el estilo vectorial. */
function addOwnLayers() {
  firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  if (!map.getSource('pi-dem')) map.addSource('pi-dem', { type: 'raster-dem', tiles: [abs(DEM_URL)], tileSize: 256, maxzoom: 12, encoding: 'terrarium',
    attribution: 'Relieve: Terrain Tiles © Mapzen/AWS' })
  if (!map.getSource('pi-dem-hs')) map.addSource('pi-dem-hs', { type: 'raster-dem', tiles: [abs(DEM_URL)], tileSize: 256, maxzoom: 13, encoding: 'terrarium' })
  if (!map.getLayer('pi-hillshade')) map.addLayer({ id: 'pi-hillshade', type: 'hillshade', source: 'pi-dem-hs', layout: { visibility: view.relief ? 'visible' : 'none' },
    paint: { 'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#000000', 'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': cssVar('--surface-3') } }, firstSymbol)
  for (const [level, src] of Object.entries(LEVEL_SRC)) {
    if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: `/geo/${src}.geojson`, promoteId: 'u' })
    if (map.getLayer(`${src}-fill`)) continue
    map.addLayer({ id: `${src}-fill`, type: 'fill', source: src, layout: { visibility: 'none' },
      paint: { 'fill-color': cssVar('--seq-none'), 'fill-opacity': 0.78 } }, firstSymbol)
    map.addLayer({ id: `${src}-line`, type: 'line', source: src, layout: { visibility: 'none' },
      paint: { 'line-color': cssVar('--void'), 'line-width': level === 'departamento' ? 1.2 : 0.5 } }, firstSymbol)
    map.addLayer({ id: `${src}-hot`, type: 'line', source: src, layout: { visibility: 'none', 'line-join': 'round' },
      paint: { 'line-color': cssVar('--hot'), 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 10, 3],
        'line-dasharray': [3, 4], 'line-opacity': ['case', ['boolean', ['feature-state', 'hot'], false], 1, 0] } })
    map.addLayer({ id: `${src}-focus`, type: 'line', source: src, layout: { visibility: 'none' },
      paint: { 'line-color': cssVar('--accent'),
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, ['boolean', ['feature-state', 'hover'], false], 1.5, 0] } })
  }
  if (!map.getLayer('dep-context')) map.addLayer({ id: 'dep-context', type: 'line', source: 'departamentos',
    paint: { 'line-color': cssVar('--accent'), 'line-width': 0.8, 'line-opacity': 0.5 } }, firstSymbol)
  applySky()
}

function applySky() {
  try {
    const dark = document.documentElement.dataset.theme !== 'light'
    map.setSky({ 'sky-color': dark ? '#03111c' : '#9fd3ef', 'horizon-color': dark ? '#0b3346' : '#e6f3fb', 'fog-color': dark ? '#05080c' : '#dfe9ef',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.85, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 1, 12, 0] })
  } catch { /* versión sin cielo */ }
}

// ── mapa base ────────────────────────────────────────────────────────────────
export async function setBase(id) {
  const b = BASES[id]
  if (!b) return
  if (b.vector && b.vector !== vectorStyle) await swapVector(b.vector)
  view.base = id
  const firstBase = map.getStyle().layers.find((l) => baseLayerIds.has(l.id) && l.type !== 'background')?.id
  if (map.getLayer('pi-base-raster')) map.removeLayer('pi-base-raster')
  if (map.getSource('pi-base-raster')) map.removeSource('pi-base-raster')
  if (b.raster) {
    map.addSource('pi-base-raster', { type: 'raster', tiles: [abs(`/tiles/base/${b.raster}/{z}/{x}/{y}`)], tileSize: 256, maxzoom: b.max, attribution: b.attribution })
    map.addLayer({ id: 'pi-base-raster', type: 'raster', source: 'pi-base-raster', paint: { 'raster-fade-duration': 150 } }, firstBase)
  }
  for (const l of map.getStyle().layers) {
    if (!baseLayerIds.has(l.id) || l.type === 'background') continue
    let vis = 'visible'
    if (b.raster) {
      const keep = b.keep === 'labels' && (l.type === 'symbol' || l['source-layer'] === 'boundary')
      vis = keep ? 'visible' : 'none'
    }
    map.setLayoutProperty(l.id, 'visibility', vis)
  }
}

async function swapVector(name) {
  const next = await fetchStyle(name)
  const prev = map.getStyle()
  const own = prev.layers.filter((l) => !baseLayerIds.has(l.id))
  const ownSources = Object.fromEntries(Object.entries(prev.sources).filter(([k]) => !(k in next.sources) && !['openmaptiles', 'ne2_shaded'].includes(k)))
  const terrain = map.getTerrain?.()
  baseLayerIds = new Set(next.layers.map((l) => l.id))
  vectorStyle = name
  await new Promise((res) => {
    map.once('style.load', res)
    map.setStyle(next, {
      diff: false,
      transformStyle: (_p, n) => {
        const sym = n.layers.findIndex((l) => l.type === 'symbol')
        const under = own.filter((l) => l.type === 'fill' || l.type === 'hillshade' || l.type === 'raster' || /-line$|dep-context/.test(l.id))
        const over = own.filter((l) => !under.includes(l))
        const layers = sym < 0 ? [...n.layers, ...under, ...over] : [...n.layers.slice(0, sym), ...under, ...n.layers.slice(sym), ...over]
        return { ...n, sources: { ...n.sources, ...ownSources }, layers }
      },
    })
  })
  firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  painted = { level: null, ids: [] }
  if (terrain) setTerrain(true)
  applySky()
  for (const fn of styleHooks) fn()
}

// ── relieve 3D ───────────────────────────────────────────────────────────────
export function setTerrain(on, { camera = true } = {}) {
  view.terrain = on
  try { map.setTerrain(on ? { source: 'pi-dem', exaggeration: view.exaggeration } : null) } catch { /* navegador sin terreno 3D */ }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (camera) map.easeTo(on ? { pitch: 62, bearing: -15, duration: reduce ? 0 : 900 } : { pitch: 0, bearing: 0, duration: reduce ? 0 : 600 })
}

export function setExaggeration(v) {
  view.exaggeration = v
  if (view.terrain) setTerrain(true, { camera: false })
}

export function setRelief(on) {
  view.relief = on
  if (map.getLayer('pi-hillshade')) map.setLayoutProperty('pi-hillshade', 'visibility', on ? 'visible' : 'none')
}

export function resetNorth() {
  map.easeTo({ bearing: 0, pitch: view.terrain ? 62 : 0, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 })
}

export const getFirstSymbol = () => firstSymbol

// ── interacción y choropleth ─────────────────────────────────────────────────
function hover(src, e) {
  const f = e.features?.[0]
  if (!f || state.wxPoint) return
  map.getCanvas().style.cursor = 'pointer'
  if (hovered && hovered.id !== f.id) map.setFeatureState(hovered, { hover: false })
  hovered = { source: src, id: f.id }
  map.setFeatureState(hovered, { hover: true })
  const row = rowIndex.get(f.properties.u)
  const c = state.choropleth
  let body = '<div class="empty">Sin dato publicado para este territorio en el período.</div>'
  if (row && c) {
    body = Object.entries(c.measures)
      .filter(([k]) => row[k] !== undefined && row[k] !== null)
      .slice(0, 4)
      .map(([k, meta]) => `<div class="pop-row"><span>${esc(meta.label)}</span><b>${k === 'change_pct' ? fmtPct(row[k]) : fmt(row[k])}</b></div>`)
      .join('')
    if (row.calculated) body += '<div class="pop-row"><span>Lima Metropolitana + Región Lima</span><b>calc.</b></div>'
  }
  const where = f.properties.p ? `${f.properties.p}, ${f.properties.d}` : f.properties.d !== f.properties.n ? f.properties.d : ''
  hoverPopup.setLngLat(e.lngLat).setHTML(`<div class="pop-title">${esc(f.properties.n)}</div>${where ? `<div class="src-meta">${esc(where)}</div>` : ''}${body}`).addTo(map)
}

export function unhover() {
  map.getCanvas().style.cursor = state.wxPoint ? 'crosshair' : ''
  if (hovered) map.setFeatureState(hovered, { hover: false })
  hovered = null
  hoverPopup.remove()
}

let rowIndex = new Map()

export function showLevel(level) {
  for (const [lv, src] of Object.entries(LEVEL_SRC)) {
    const vis = lv === level && !state.hideChoropleth ? 'visible' : 'none'
    for (const suffix of ['fill', 'line', 'focus']) map.setLayoutProperty(`${src}-${suffix}`, 'visibility', vis)
    map.setLayoutProperty(`${src}-hot`, 'visibility', vis === 'visible' && state.hotspots ? 'visible' : 'none')
  }
}

function classify(values, measure) {
  if (measure === 'change_pct') return { breaks: DIV_BREAKS, colors: DIV.map(cssVar), diverging: true }
  if (measure === 'gi_z') return { breaks: [-2.58, -1.96, -1, 1, 1.96, 2.58], colors: DIV.map(cssVar), diverging: true, gi: true }
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b)
  const SEQ = seqVars()
  if (!v.length) return { breaks: [], colors: SEQ.map(cssVar) }
  const breaks = []
  for (let i = 1; i < SEQ.length; i++) breaks.push(v[Math.min(v.length - 1, Math.floor((v.length * i) / SEQ.length))])
  const uniq = [...new Set(breaks)]
  return { breaks: uniq, colors: SEQ.slice(SEQ.length - uniq.length - 1).map(cssVar), min: v[0], max: v[v.length - 1] }
}

export function paint(choropleth, measure) {
  const level = choropleth.level
  const src = LEVEL_SRC[level]
  showLevel(level)
  if (painted.level) for (const id of painted.ids) {
    map.removeFeatureState({ source: LEVEL_SRC[painted.level], id }, 'cls')
    map.removeFeatureState({ source: LEVEL_SRC[painted.level], id }, 'hot')
  }
  rowIndex = new Map(choropleth.rows.map((r) => [r.ubigeo, r]))
  const cls = classify(choropleth.rows.map((r) => r[measure]), measure)
  const ids = []
  for (const r of choropleth.rows) {
    const v = r[measure]
    if (v === null || v === undefined) continue
    let i = cls.breaks.findIndex((b) => v < b)
    if (i < 0) i = cls.breaks.length
    map.setFeatureState({ source: src, id: r.ubigeo }, { cls: i })
    ids.push(r.ubigeo)
  }
  painted = { level, ids }
  markHotspots(choropleth, measure, src)
  const expr = ['case', ['==', ['coalesce', ['feature-state', 'cls'], -1], -1], cssVar('--seq-none'),
    ['match', ['feature-state', 'cls'], ...cls.colors.flatMap((c, i) => [i, c]), cssVar('--seq-none')]]
  map.setPaintProperty(`${src}-fill`, 'fill-color', expr)
  map.setPaintProperty(`${src}-fill`, 'fill-opacity', zoomOpacity(state.choroplethOpacity ?? 0.78))
  map.setPaintProperty(`${src}-line`, 'line-color', cssVar('--void'))
  return cls
}

// Focos: el 10 % de territorios con el valor más alto de la medida (mínimo 3) recibe un contorno discontinuo coral.
let hotTimer = null
export let hotList = []
function markHotspots(choropleth, measure, src) {
  const rows = choropleth.rows.filter((r) => Number.isFinite(r[measure]))
  const n = Math.max(3, Math.ceil(rows.length * 0.1))
  hotList = measure === 'change_pct' || measure === 'gi_z' || rows.length < 6 ? [] : [...rows].sort((a, b) => b[measure] - a[measure]).slice(0, n)
  for (const r of hotList) map.setFeatureState({ source: src, id: r.ubigeo }, { hot: true })
  clearInterval(hotTimer)
  if (!state.hotspots || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // secuencia de trazos del ejemplo «animate a line» de MapLibre: las líneas discontinuas «marchan» sin parpadear
  const steps = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
    [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
  let k = 0
  hotTimer = setInterval(() => {
    if (!map.getLayer(`${src}-hot`) || !state.hotspots) return clearInterval(hotTimer)
    map.setPaintProperty(`${src}-hot`, 'line-dasharray', steps[k++ % steps.length])
  }, 90)
}

export function setHotspots(on) {
  state.hotspots = on
  if (state.choropleth) paint(state.choropleth, state.measure)
}

// al acercarse a la escala de calle el coloreado se atenúa para leer el mapa base (calles, quebradas, trazos)
const zoomOpacity = (v) => ['interpolate', ['linear'], ['zoom'], 9, v, 12, v * 0.28]

export function setChoroplethOpacity(v) {
  state.choroplethOpacity = v
  for (const src of Object.values(LEVEL_SRC)) map.setPaintProperty(`${src}-fill`, 'fill-opacity', zoomOpacity(v))
}

export function setSelected(ubigeo) {
  if (selected) map.setFeatureState(selected, { selected: false })
  selected = null
  if (!ubigeo) return
  const src = { 2: 'departamentos', 4: 'provincias', 6: 'distritos' }[ubigeo.length]
  selected = { source: src, id: ubigeo }
  map.setFeatureState(selected, { selected: true })
}

export function fitBBox(bbox) {
  if (!bbox) return
  map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 60, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700, maxZoom: 11 })
}

export function refreshThemeColors() {
  if (!map) return
  for (const src of Object.values(LEVEL_SRC)) map.setPaintProperty(`${src}-focus`, 'line-color', cssVar('--accent'))
  map.setPaintProperty('dep-context', 'line-color', cssVar('--accent'))
  applySky()
}

// ── capas de puntos y líneas genéricas (sedes, servicios, emergencias, rutas) ─────────────
const fcol = (features) => ({ type: 'FeatureCollection', features })
export const ptFeature = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props })

/** Crea (una vez) una capa de círculos con color por categoría y la devuelve. */
export function ensurePointLayer(id, { colorBy = 'cat', colors = {}, radius = 5, minzoom = 0, onClick, before } = {}) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: fcol([]) })
  if (!map.getLayer(id)) {
    const match = ['match', ['get', colorBy], ...Object.entries(colors).flatMap(([k, v]) => [k, cssVar(v)]), cssVar('--ink-soft')]
    map.addLayer({ id, type: 'circle', source: id, minzoom, layout: { visibility: 'none' },
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, radius * 0.55, 12, radius, 16, radius * 1.6],
        'circle-color': match, 'circle-stroke-width': 1.2, 'circle-stroke-color': cssVar('--inst-ring'), 'circle-opacity': 0.92 } }, before)
    if (onClick) {
      map.on('click', id, (e) => onClick(e.features[0], e.lngLat))
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''))
    }
  }
}

export function setPoints(id, features, visible = true) {
  map.getSource(id)?.setData(fcol(features))
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
}

export function showLayer(id, on) {
  if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
}

/** Líneas (rutas, trazos de huaicos). `dashed`: discontinua; `width` y `color` por propiedad. */
export function ensureLineLayer(id, { dashed = false, color = '--accent', width = 3 } = {}) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: fcol([]) })
  if (!map.getLayer(id)) {
    map.addLayer({ id, type: 'line', source: id, layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['coalesce', ['get', 'color'], cssVar(color)], 'line-width': ['coalesce', ['get', 'width'], width],
        'line-opacity': ['coalesce', ['get', 'opacity'], 0.95], ...(dashed ? { 'line-dasharray': [2, 1.5] } : {}) } })
  }
}

export function setLines(id, features) {
  map.getSource(id)?.setData(fcol(features))
}

export const flyTo = (lon, lat, zoom = 12) =>
  map.flyTo({ center: [lon, lat], zoom, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1600, essential: true })

// Mapa base (OpenFreeMap vía /ofm/ con caché local) + límites + choropleth por escalas.
/* global maplibregl */
import { cssVar, esc, fmt, fmtPct, state } from './util.js'

const LEVEL_SRC = { departamento: 'departamentos', provincia: 'provincias', distrito: 'distritos' }
const SEQ = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7']
const DIV = ['--div-neg-3', '--div-neg-2', '--div-neg-1', '--div-mid', '--div-pos-1', '--div-pos-2', '--div-pos-3']
const DIV_BREAKS = [-30, -15, -5, 5, 15, 30]

export let map
let markReady
export const mapReady = new Promise((res) => (markReady = res))
let firstSymbol
let hovered = null
let selected = null
let painted = { level: null, ids: [] }
const popup = () => new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, maxWidth: '280px' })
let hoverPopup

const OFFLINE_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e9eef2' } }],
}

export async function initMap({ onSelect }) {
  maplibregl.setWorkerUrl('vendor/maplibre/maplibre-gl-csp-worker.js')
  let style
  try {
    const r = await fetch('/ofm/styles/liberty', { cache: 'no-store' })
    if (!r.ok) throw new Error()
    style = await r.json()
  } catch {
    style = OFFLINE_STYLE // sin red y sin caché: solo límites y capas propias
  }
  map = new maplibregl.Map({
    container: 'map',
    style,
    center: [-75.2, -9.3],
    zoom: window.innerWidth < 768 ? 3.9 : 4.6,
    minZoom: 3,
    maxZoom: 16,
    attributionControl: { compact: true },
    transformRequest: (url) => (url.startsWith('/') ? { url: location.origin + url } : { url }),
    dragRotate: false,
    pitchWithRotate: false,
  })
  window.__piMap = map // depuración desde la consola
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
  // basta con el estilo para añadir fuentes y capas; no se espera a que se dibujen todas las teselas
  if (!map.isStyleLoaded()) await new Promise((res) => map.once('style.load', res))
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show') // atribución plegada: no tapa la leyenda
  firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  // etiquetas del mapa base en español cuando OSM tiene name:es
  for (const l of map.getStyle().layers) {
    const tf = l.type === 'symbol' && l.layout?.['text-field']
    if (tf && JSON.stringify(tf).includes('name')) map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']])
  }
  for (const [level, src] of Object.entries(LEVEL_SRC)) {
    map.addSource(src, { type: 'geojson', data: `/geo/${src}.geojson`, promoteId: 'u' })
    map.addLayer({ id: `${src}-fill`, type: 'fill', source: src, layout: { visibility: 'none' },
      paint: { 'fill-color': cssVar('--seq-none'), 'fill-opacity': 0.82 } }, firstSymbol)
    map.addLayer({ id: `${src}-line`, type: 'line', source: src, layout: { visibility: 'none' },
      paint: { 'line-color': cssVar('--surface-2'), 'line-width': level === 'departamento' ? 1.2 : 0.5 } }, firstSymbol)
    map.addLayer({ id: `${src}-focus`, type: 'line', source: src, layout: { visibility: 'none' },
      paint: { 'line-color': cssVar('--ink'),
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, ['boolean', ['feature-state', 'hover'], false], 1.5, 0] } })
    map.on('mousemove', `${src}-fill`, (e) => hover(src, e))
    map.on('mouseleave', `${src}-fill`, () => unhover(src))
    map.on('click', `${src}-fill`, (e) => {
      const f = e.features?.[0]
      if (f) onSelect(f.properties.u, f.properties)
    })
  }
  // contexto: los departamentos siempre dibujan su contorno sobre provincias y distritos
  map.addLayer({ id: 'dep-context', type: 'line', source: 'departamentos',
    paint: { 'line-color': cssVar('--ink'), 'line-width': 0.8, 'line-opacity': 0.55 } }, firstSymbol)
  hoverPopup = popup()
  markReady(map)
  return map
}

function hover(src, e) {
  const f = e.features?.[0]
  if (!f) return
  map.getCanvas().style.cursor = 'pointer'
  if (hovered && hovered.id !== f.id) map.setFeatureState(hovered, { hover: false })
  hovered = { source: src, id: f.id }
  map.setFeatureState(hovered, { hover: true })
  const row = rowFor(f.properties.u)
  const c = state.choropleth
  const m = state.measure
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
  void m
}

function unhover(src) {
  map.getCanvas().style.cursor = ''
  if (hovered) map.setFeatureState(hovered, { hover: false })
  hovered = null
  hoverPopup.remove()
  void src
}

let rowIndex = new Map()
const rowFor = (u) => rowIndex.get(u)

export function showLevel(level) {
  for (const [lv, src] of Object.entries(LEVEL_SRC)) {
    const vis = lv === level ? 'visible' : 'none'
    for (const suffix of ['fill', 'line', 'focus']) map.setLayoutProperty(`${src}-${suffix}`, 'visibility', vis)
  }
}

function classify(values, measure) {
  if (measure === 'change_pct') return { breaks: DIV_BREAKS, colors: DIV.map(cssVar), diverging: true }
  const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b)
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
  for (const id of painted.ids) map.removeFeatureState({ source: LEVEL_SRC[painted.level], id }, 'cls')
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
  const expr = ['case', ['==', ['coalesce', ['feature-state', 'cls'], -1], -1], cssVar('--seq-none'),
    ['match', ['feature-state', 'cls'], ...cls.colors.flatMap((c, i) => [i, c]), cssVar('--seq-none')]]
  map.setPaintProperty(`${src}-fill`, 'fill-color', expr)
  map.setPaintProperty(`${src}-line`, 'line-color', cssVar('--surface-2'))
  return cls
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
  for (const src of Object.values(LEVEL_SRC)) {
    map.setPaintProperty(`${src}-focus`, 'line-color', cssVar('--ink'))
  }
  map.setPaintProperty('dep-context', 'line-color', cssVar('--ink'))
}

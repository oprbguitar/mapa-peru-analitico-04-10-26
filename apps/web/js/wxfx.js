// Nubes reales NOAA (infrarrojo observado) como velo blanco transparente y animado, al estilo GOdEyes:
// el servidor aplica la clave de brillo (solo nubes frías opacas) y aquí se reproducen en bucle las últimas horas
// publicadas con fundido entre fotogramas. Sin partículas simuladas; con movimiento reducido queda la última hora.
import { map, onStyleReady } from './map.js'
import { esc, getJSON } from './util.js'
import { setLiveMeta } from './rail.js'

export const FX = { nubes: 'Nubes reales · infrarrojo NOAA animado' }
const FRAMES = 5            // horas observadas en el bucle
const STEP_MS = 900         // tiempo por fotograma
const HOLD_MS = 2200        // pausa en la observación más reciente
const OPACITY = 0.9
let enabled = false, meta = null, timer = null, anim = null, generation = 0, shown = 0
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const id = (i) => `observed-clouds-${i}`

function removeLayers() {
  for (const l of map.getStyle()?.layers || []) if (l.id.startsWith('observed-clouds-')) map.removeLayer(l.id)
  for (const s of Object.keys(map.getStyle()?.sources || {})) if (s.startsWith('observed-clouds-')) map.removeSource(s)
}

function frames() {
  const times = meta?.times?.length ? meta.times : meta?.time ? [meta.time] : []
  return reduce() ? times.slice(-1) : times.slice(-FRAMES)
}

function render() {
  if (!enabled || !meta?.time || !map.getStyle()?.layers) return
  removeLayers()
  const overlay = map.getStyle().layers.find((layer) => layer.id === 'departamentos-fill' || layer.id.startsWith('pl-'))
  const list = frames()
  // todas las horas se cargan a la vez (opacidad 0) para que el bucle no parpadee al cambiar de fotograma
  list.forEach((time, i) => {
    map.addSource(id(i), { type: 'raster', tileSize: 256, maxzoom: 7,   // ~3 km por píxel en origen: más zoom solo amplía
      tiles: [`${location.origin}/api/v1/intel/weather/clouds/tiles/{z}/{x}/{y}.png?time=${encodeURIComponent(time)}&key=1`],
      attribution: 'NOAA/NWS nowCOAST · infrarrojo observado' })
    map.addLayer({ id: id(i), type: 'raster', source: id(i),
      paint: { 'raster-opacity': i === list.length - 1 ? OPACITY : 0, 'raster-opacity-transition': { duration: reduce() ? 0 : 600 }, 'raster-fade-duration': 0 } }, overlay?.id)
  })
  shown = list.length - 1
  play(list)
}

function play(list) {
  clearTimeout(anim)
  if (list.length < 2 || reduce()) return label(list[shown])
  const next = () => {
    if (!enabled) return
    const prev = shown
    shown = (shown + 1) % list.length
    if (map.getLayer(id(prev))) map.setPaintProperty(id(prev), 'raster-opacity', 0)
    if (map.getLayer(id(shown))) map.setPaintProperty(id(shown), 'raster-opacity', OPACITY)
    label(list[shown])
    anim = setTimeout(next, shown === list.length - 1 ? HOLD_MS : STEP_MS)
  }
  label(list[shown])
  anim = setTimeout(next, HOLD_MS)
}

function label(time) {
  const t = time ? new Date(time) : null
  setLiveMeta('wxfx', t ? `${t.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} (observado)` : meta?.error || '')
}

onStyleReady(render)

export async function setWeatherFx(on) {
  enabled = on
  const current = ++generation
  clearInterval(timer)
  clearTimeout(anim)
  if (!on) { removeLayers(); meta = null; return null }
  const load = async () => {
    try {
      const result = await getJSON('/api/v1/intel/weather/clouds')
      if (generation !== current || !enabled) return null
      if (!result.time) throw new Error(result.error || 'NOAA no publicó una observación verificable')
      const changed = result.time !== meta?.time
      meta = result
      if (changed) render()
    } catch (error) {
      if (generation !== current) return null
      removeLayers()
      meta = { error: error.message }
      setLiveMeta('wxfx', meta.error)
    }
    return meta
  }
  const result = await load()
  if (generation === current && enabled) timer = setInterval(load, 10 * 60 * 1000)
  return result
}
export function setFxMode() { return 'nubes' }
export const fxMode = () => 'nubes'
export function fxSummary() {
  if (meta?.error) return `<p class="src-meta">${esc(meta.error)}. No se muestra una simulación.</p>`
  const n = frames().length
  return `<p class="src-meta">NOAA nowCOAST · infrarrojo observado · ${esc(meta?.time || 'Consultando fecha publicada…')}${n > 1 ? ` · bucle de las últimas ${n} horas` : ''}<br>
    Velo blanco = topes de nube fríos (clave de brillo como GOdEyes); lo cálido queda transparente. ${esc(meta?.description || '')}</p>`
}

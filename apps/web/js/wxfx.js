// Observación infrarroja NOAA: fechas publicadas; sin partículas meteorológicas simuladas.
import { map, onStyleReady } from './map.js'
import { esc, getJSON } from './util.js'
import { setLiveMeta } from './rail.js'

export const FX = { nubes: 'Nubes reales · infrarrojo NOAA' }
const SOURCE = 'observed-clouds'
const LAYER = 'observed-clouds-raster'
let enabled = false, meta = null, timer = null, generation = 0

function removeLayer() {
  if (map.getLayer(LAYER)) map.removeLayer(LAYER)
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
}
function render() {
  // Pending imagery tiles do not prevent adding another layer to an initialized style.
  if (!enabled || !meta?.time || !map.getStyle()?.layers) return
  removeLayer()
  map.addSource(SOURCE, { type: 'raster', tileSize: 256, maxzoom: 11,
    tiles: [`${location.origin}/api/v1/intel/weather/clouds/tiles/{z}/{x}/{y}.png?time=${encodeURIComponent(meta.time)}`],
    attribution: 'NOAA/NWS nowCOAST · infrarrojo observado' })
  const overlay = map.getStyle().layers.find((layer) => layer.id === 'departamentos-fill' || layer.id.startsWith('pl-'))
  map.addLayer({ id: LAYER, type: 'raster', source: SOURCE,
    paint: { 'raster-opacity': 0.65, 'raster-fade-duration': 0 } }, overlay?.id)
}
onStyleReady(render)

export async function setWeatherFx(on) {
  enabled = on
  const current = ++generation
  clearInterval(timer)
  if (!on) { removeLayer(); meta = null; return null }
  const load = async () => {
    try {
      const result = await getJSON('/api/v1/intel/weather/clouds')
      if (generation !== current || !enabled) return null
      if (!result.time) throw new Error(result.error || 'NOAA no publicó una observación verificable')
      meta = result
      setLiveMeta('wxfx', meta.time)
      render()
    } catch (error) {
      if (generation !== current) return null
      removeLayer()
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
  return `<p class="src-meta">NOAA nowCOAST · infrarrojo observado · ${esc(meta?.time || 'Consultando fecha publicada…')}<br>${esc(meta?.description || 'Nubes y temperaturas de superficie; no es una máscara exclusiva de nubes.')}</p>`
}

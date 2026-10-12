// Selector de clima sobre el mapa: proveedor × tipo (lluvia, nubes, temperatura, viento, presión), opacidad y
// valor exacto al hacer clic (consulta por punto con todos los proveedores lado a lado, ver weather.js).
// Las capas OpenWeather y Tomorrow.io usan la clave de este equipo a través del servidor; nunca llega al navegador.
import { currentOverlay, loadCatalog, setOverlay, setOverlayOpacity, setPointMode } from './weather.js'
import { esc, state } from './util.js'

const PROVIDERS = [['owm', 'OpenWeather'], ['tomorrow', 'Tomorrow.io'], ['gibs', 'NASA'], ['senamhi', 'SENAMHI']]
let dock = null, cat = null, prov = null, type = 'lluvia'

function layerFor(p, t) {
  const list = cat?.[p] || []
  if (p === 'owm' || p === 'tomorrow') return list.find((l) => l.type === t)
  const key = Object.entries(cat.type_of || {}).find(([k, v]) => v === t && k.startsWith(`${p}:`))?.[0]
  return key ? list.find((l) => `${p}:${l.id}` === key) : null
}

function render() {
  const avail = PROVIDERS.filter(([p]) => cat?.[p]?.length)
  const types = Object.entries(cat?.types || {})
  const spec = layerFor(prov, type)
  dock.innerHTML = `<div class="wxd-head"><b>Clima en el mapa</b>
      <button class="btn btn-ghost btn-icon" type="button" data-wxd="close" aria-label="Cerrar el clima">✕</button></div>
    <div class="seg" role="group" aria-label="Proveedor">${avail.map(([p, l]) => `<button type="button" data-wxd-p="${p}" aria-pressed="${p === prov}">${esc(l)}</button>`).join('')}</div>
    <div class="wxd-types" role="group" aria-label="Tipo de clima">${types.map(([t, v]) => {
      const ok = !!layerFor(prov, t)
      return `<button type="button" class="wxd-type" data-wxd-t="${t}" data-type="${t}" aria-pressed="${t === type && ok}" ${ok ? '' : 'disabled title="Este proveedor no publica esta capa"'}>${esc(v.label)}</button>`
    }).join('')}</div>
    <div class="wxd-ramp" data-type="${esc(type)}" aria-hidden="true"></div>
    <div class="legend-ticks"><span>menos</span><span>${esc(cat?.types?.[type]?.unit || '')}</span><span>más</span></div>
    <label class="wxd-row"><span>Opacidad</span><input type="range" min="0.2" max="1" step="0.05" value="${currentOverlay().opacity}" data-wxd="op"></label>
    <label class="wxd-row"><input type="checkbox" data-wxd="probe" ${state.wxPoint ? 'checked' : ''}> <span>Valor exacto al hacer clic (todos los proveedores)</span></label>
    <p class="src-meta">${spec ? `${esc(spec.label)} · ${esc(spec.attribution)}${spec.date ? ` · ${esc(spec.date)}` : ''}` : 'Sin capa para esta combinación.'}
      ${!cat?.owm?.length ? ' · Para OpenWeather, configura su clave en «Claves».' : ''}</p>`
}

function apply() {
  const spec = layerFor(prov, type)
  setOverlay(spec ? `${prov}:${spec.id}` : null)
  render()
}

export async function toggleWxDock(btn) {
  if (dock) return closeDock(btn)
  cat = await loadCatalog(true)
  prov = PROVIDERS.find(([p]) => cat?.[p]?.length)?.[0] || 'gibs'
  dock = document.createElement('section')
  dock.className = 'wx-dock hud hud-frame'
  dock.setAttribute('aria-label', 'Clima en el mapa')
  document.body.appendChild(dock)
  btn?.setAttribute('aria-pressed', 'true')
  dock.addEventListener('click', (e) => {
    const p = e.target.closest('[data-wxd-p]')
    if (p) { prov = p.dataset.wxdP; if (!layerFor(prov, type)) type = Object.keys(cat.types).find((t) => layerFor(prov, t)) || type; return apply() }
    const t = e.target.closest('[data-wxd-t]')
    if (t && !t.disabled) { type = t.dataset.wxdT; return apply() }
    if (e.target.closest('[data-wxd="close"]')) closeDock(btn)
  })
  dock.addEventListener('input', (e) => { if (e.target.dataset.wxd === 'op') setOverlayOpacity(Number(e.target.value)) })
  dock.addEventListener('change', (e) => { if (e.target.dataset.wxd === 'probe') setPointMode(e.target.checked) })
  setPointMode(true)
  apply()
}

function closeDock(btn) {
  setOverlay(null)
  setPointMode(false)
  dock?.remove()
  dock = null
  btn?.setAttribute('aria-pressed', 'false')
}

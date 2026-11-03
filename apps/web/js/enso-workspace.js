import { flyTo, map } from './map.js'
import { esc, getJSON } from './util.js'
import { historyEvents } from './enso-history.js'
import { DEFAULT_ASSUMPTIONS, createScenario, compareScenarios, serializeScenario, restoreScenario } from './enso-scenario.js'

const STORAGE_KEY = 'mapa-peru.enso360.scenario.v1'
const PILOTS = [
  { label: 'Costa · Lima Este / Huaycoloro', lon: -76.94, lat: -11.98, zoom: 11 },
  { label: 'Sierra central · Matucana', lon: -76.38, lat: -11.84, zoom: 10 },
  { label: 'Sierra sur · Abancay', lon: -72.88, lat: -13.64, zoom: 9 },
  { label: 'Selva alta · Tarapoto', lon: -76.37, lat: -6.49, zoom: 9 },
  { label: 'Costa norte · Piura', lon: -80.63, lat: -5.19, zoom: 9 },
  { label: 'Perú · vista nacional', lon: -75.2, lat: -9.4, zoom: 4.5 },
]
let active = null
let requestId = 0
let pins = []

const locationOf = (c) => ({ lon: Number(c.lon ?? c.center?.[0]), lat: Number(c.lat ?? c.center?.[1]), label: c.label || c.name || c.territory?.distrito || 'Punto seleccionado' })
const finiteLocation = (l) => Number.isFinite(l.lon) && Number.isFinite(l.lat)

function sourcesHtml(items = []) {
  return items.filter((p) => /^https?:\/\//.test(p.url || '')).map((p) => `<a target="_blank" rel="noopener" href="${esc(p.url)}">${esc(p.institution || p.name || 'Fuente')} · ${esc(p.date || p.downloaded?.slice(0, 10) || 'fecha en origen')}</a>`).join('')
}

function historyHtml(s) {
  return `<label for="ew-episode">Episodio documentado</label><select id="ew-episode"><option value="">Selecciona un episodio</option>${(s.data.storylines || []).map((e) => `<option value="${esc(e.id)}" ${s.episode === e.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select>
    <button class="btn btn-primary" type="button" data-ew="story" ${s.episode ? '' : 'disabled'}>▶ Reproducir episodio en el mapa</button>
    <p class="src-meta">La reproducción muestra fechas y registros publicados. Su cobertura depende de cada fuente; no representa todos los daños ocurridos.</p>
    ${s.context?.summary ? `<p>${esc(s.context.summary)}</p>` : '<p class="src-meta">Haz clic en el mapa para reconocer el territorio y consultar su contexto.</p>'}
    ${recordsHtml(s)}<div class="ew-sources">${sourcesHtml(s.context?.provenance || [])}</div>`
}

function recordsHtml(s) {
  const ubigeo = s.context?.territory?.ubigeo
  if (!s.records) return '<p class="src-meta">Reproduce un episodio para consultar sus registros históricos.</p>'
  if (!ubigeo) return '<p class="src-meta">Identifica un distrito en el mapa para filtrar los registros por su UBIGEO publicado.</p>'
  const rows = historyEvents(s.records.events, { ubigeo, date: s.records.date })
  return `<h4>Registros documentados del territorio</h4><p class="src-meta">${rows.length} registros en el conjunto disponible · conteo calculado por UBIGEO publicado ${esc(ubigeo)}${s.records.date ? ` · hasta el mes ${esc(s.records.date.slice(0, 7))}` : ''}. Sin registros no equivale a ausencia de ocurrencias.</p>
    <ol class="ew-records">${rows.slice(0, 15).map((e) => `<li><strong>${esc(e[3])} · ${esc(s.records.types?.[e[2]] || e[2])}</strong><span>${esc(e[5])}</span><small>Registro: ${esc(e[9] || 'sin identificador')} · ${esc(e[10] || 'fuente en catálogo')}${e[11] !== 'punto' ? ` · centroide de ${esc(e[11] || 'ámbito publicado')}` : ' · punto publicado'}</small></li>`).join('')}</ol>
    <p class="src-meta">${rows.length > 15 ? 'Se muestran los primeros 15 registros. ' : ''}${esc(s.records.coverageNote || 'Cobertura según el catálogo de fuentes del episodio.')}</p><div class="ew-sources">${sourcesHtml(s.records.provenance || [])}</div>`
}

function captureDraft(s) {
  const form = s.host.querySelector('#ew-form')
  if (!form) return
  const f = new FormData(form)
  s.assumptions = { rainfallMm: f.get('rainfallMm'), durationHours: f.get('durationHours'), soilCondition: f.get('soilCondition') }
}

function receiveRecords(e) {
  if (!active) return
  captureDraft(active)
  active.records = e.detail
  if (e.detail.episodeId) active.episode = e.detail.episodeId
  if (active.tab === 'history') render()
}

function scenarioHtml(s) {
  const a = s.assumptions
  return `<p class="ew-notice">Hipótesis del usuario · ejercicio conceptual. La lluvia ingresada no es un pronóstico publicado.</p>
    <form id="ew-form"><div class="ew-fields"><label>Lluvia acumulada (mm)<input name="rainfallMm" type="number" min="0" max="2000" step="0.1" required value="${esc(a.rainfallMm)}"></label>
    <label>Duración (horas)<input name="durationHours" type="number" min="0.1" max="720" step="0.1" required value="${esc(a.durationHours)}"></label></div>
    <label>Condición inicial del suelo<select name="soilCondition">${[['seco', 'Seco'], ['humedo', 'Húmedo'], ['saturado', 'Saturado']].map(([v, l]) => `<option value="${v}" ${a.soilCondition === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn btn-primary" type="submit" ${finiteLocation(s.location) ? '' : 'disabled'}>Preparar escenario conceptual</button></form>
    ${s.scenario ? '<p class="ew-ready">Escenario preparado con tus supuestos. Sin cálculo de propagación, inundación ni daños.</p>' : '<p class="src-meta">Selecciona un territorio o un piloto para preparar el escenario.</p>'}
    <div class="ew-actions"><button class="btn" type="button" data-ew="save" ${s.scenario ? '' : 'disabled'}>Guardar localmente</button><button class="btn" type="button" data-ew="restore">Abrir guardado</button><button class="btn" type="button" data-ew="export" ${s.scenario ? '' : 'disabled'}>Exportar JSON</button></div>
    <div class="ew-actions"><button class="btn" type="button" data-ew="baseline" ${s.scenario ? '' : 'disabled'}>Fijar como A</button><button class="btn" type="button" data-ew="compare" ${s.baseline && s.scenario ? '' : 'disabled'}>Comparar A / B</button></div>
    ${s.comparison ? `<div class="ew-comparison">${comparisonHtml(s)}</div>` : ''}`
}

function comparisonHtml(s) {
  const a = s.baseline.assumptions, b = s.scenario.assumptions
  return `<table><caption>Comparación de entradas · A guardado / B actual</caption><thead><tr><th>Supuesto</th><th>A</th><th>B</th></tr></thead><tbody>${[['Lluvia (mm)', a.rainfallMm, b.rainfallMm], ['Duración (h)', a.durationHours, b.durationHours], ['Suelo', a.soilCondition, b.soilCondition]].map((r) => `<tr>${r.map((v, i) => `<${i ? 'td' : 'th'}>${esc(v)}</${i ? 'td' : 'th'}>`).join('')}</tr>`).join('')}</tbody></table><p class="src-meta">Compara supuestos; no calcula diferencias de daño o riesgo.</p>`
}

function responseHtml() {
  return `<p class="ew-notice">Necesidades por determinar. Faltan huellas de amenaza validadas e inventarios de exposición compatibles para cuantificar personas, activos, daños o costos.</p>
    <ol class="ew-checklist"><li>Contrastar los avisos vigentes de ENFEN, SENAMHI, ANA e INDECI.</li><li>Verificar cauces y amenazas con cartografía oficial y evaluación local.</li><li>Inventariar población, puentes, vías, servicios y rutas de evacuación en el ámbito comprobado.</li><li>Definir medidas preventivas y capacidades con la autoridad competente.</li></ol>
    <p class="src-meta">Guía cualitativa de preparación; no constituye una alerta ni una orden de intervención.</p>`
}

function render() {
  const s = active
  if (!s) return
  const t = s.context?.territory
  s.host.innerHTML = `<section class="enso-workspace" aria-label="El Niño 360"><header class="ew-header"><div><p class="eyebrow">El Niño 360 · territorio</p><h3>${esc(s.location.label)}</h3></div><button class="btn btn-ghost" type="button" data-ew="collapse" aria-expanded="${!s.collapsed}" aria-label="${s.collapsed ? 'Desplegar' : 'Plegar'} El Niño 360">${s.collapsed ? '+' : '−'}</button></header>
    <div ${s.collapsed ? 'hidden' : ''}><p class="ew-intro">Explora cómo ocurrió El Niño en el Perú o simula qué podría suceder en tu territorio.</p>
    ${t ? `<p class="src-meta">${esc([t.departamento, t.provincia, t.distrito].filter(Boolean).join(' / '))}${t.ubigeo ? ` · UBIGEO ${esc(t.ubigeo)}` : ''}</p>` : ''}
    <details class="ew-pilots"><summary>Ampliar un territorio piloto</summary><p class="src-meta">Puntos orientativos para navegar. No son cauces, huellas de inundación ni geometrías modeladas.</p><div>${PILOTS.map((p, i) => `<button type="button" class="btn" data-ew-pilot="${i}">${esc(p.label)} ↗</button>`).join('')}</div></details>
    <div class="ew-tabs" role="tablist" aria-label="Momentos del análisis">${[['history', 'Qué ocurrió'], ['scenario', 'Qué podría pasar'], ['response', 'Qué se necesitaría']].map(([id, title]) => `<button type="button" role="tab" id="ew-tab-${id}" aria-controls="ew-panel" aria-selected="${s.tab === id}" tabindex="${s.tab === id ? 0 : -1}" data-ew-tab="${id}">${title}</button>`).join('')}</div>
    <div id="ew-panel" role="tabpanel" aria-labelledby="ew-tab-${s.tab}" tabindex="0">${s.tab === 'history' ? historyHtml(s) : s.tab === 'scenario' ? scenarioHtml(s) : responseHtml()}</div>
    <p class="ew-status" role="status">${esc(s.message)}</p></div></section>`
  bind(s)
}

function bind(s) {
  s.host.querySelectorAll('[data-ew-tab]').forEach((b) => {
    b.addEventListener('click', () => { captureDraft(s); s.tab = b.dataset.ewTab; render(); s.host.querySelector(`[data-ew-tab="${s.tab}"]`).focus() })
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
      e.preventDefault()
      captureDraft(s)
      const tabs = ['history', 'scenario', 'response'], i = tabs.indexOf(s.tab)
      s.tab = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]
      render(); s.host.querySelector(`[data-ew-tab="${s.tab}"]`).focus()
    })
  })
  s.host.querySelectorAll('[data-ew-pilot]').forEach((b) => b.addEventListener('click', () => navigatePilot(PILOTS[Number(b.dataset.ewPilot)])))
  s.host.querySelector('#ew-episode')?.addEventListener('change', (e) => { s.episode = e.target.value; render() })
  s.host.querySelector('#ew-form')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const assumptions = { rainfallMm: Number(f.get('rainfallMm')), durationHours: Number(f.get('durationHours')), soilCondition: f.get('soilCondition') }
    try {
      const scenario = createScenario({ location: s.location, episodeId: s.episode || null, assumptions })
      Object.assign(s, { assumptions, scenario, comparison: null, message: 'Supuestos preparados. Naturaleza: simulación conceptual propia.' })
      window.dispatchEvent(new CustomEvent('enso360:scenario', { detail: scenario }))
    } catch (err) { s.message = err.message }
    render()
  })
  s.host.querySelectorAll('[data-ew]').forEach((b) => b.addEventListener('click', () => action(b.dataset.ew)))
}

function action(name) {
  const s = active
  captureDraft(s)
  try {
    if (name === 'collapse') s.collapsed = !s.collapsed
    if (name === 'story' && s.episode) s.playStory?.(s.episode)
    if (name === 'save') { localStorage.setItem(STORAGE_KEY, serializeScenario(s.scenario)); s.message = 'Escenario guardado en este navegador. Incluye la ubicación seleccionada.' }
    if (name === 'restore') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) throw new Error('No hay un escenario guardado en este navegador.')
      const scenario = restoreScenario(raw)
      ++requestId
      Object.assign(s, { scenario, assumptions: { ...scenario.assumptions }, location: { ...scenario.location }, context: null, episode: scenario.episodeId || '', comparison: null, message: 'Escenario local recuperado.' })
      flyTo(s.location.lon, s.location.lat, 10)
      window.dispatchEvent(new CustomEvent('enso360:scenario', { detail: scenario }))
    }
    if (name === 'baseline') { s.baseline = restoreScenario(serializeScenario(s.scenario)); s.message = 'Escenario A fijado. Cambia los supuestos y prepara B para comparar.' }
    if (name === 'compare') { s.comparison = compareScenarios(s.baseline, s.scenario); s.message = 'Comparación de supuestos disponible.' }
    if (name === 'export') {
      const url = URL.createObjectURL(new Blob([serializeScenario(s.scenario)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'el-nino-360-escenario.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      s.message = 'JSON exportado con supuestos y limitaciones.'
    }
  } catch (err) { s.message = `No se pudo completar: ${err.message}` }
  render()
}

function navigatePilot(p) {
  if (p === PILOTS.at(-1)) { flyTo(p.lon, p.lat, p.zoom); return }
  selectEnsoTerritory(p)
  flyTo(p.lon, p.lat, p.zoom)
  probeEnsoTerritory(p)
}

export function selectEnsoTerritory(context) {
  if (!active) return
  const location = locationOf(context)
  if (!finiteLocation(location)) return
  captureDraft(active)
  const samePoint = active.location.lon === location.lon && active.location.lat === location.lat
  Object.assign(active, { location, context, ...(samePoint ? {} : { scenario: null, comparison: null }), message: 'Ubicación seleccionada. La cuenca no se infiere sin una capa verificada.' })
  render()
}

export async function probeEnsoTerritory(point) {
  if (!active) return
  const lon = Number(point.lng ?? point.lon), lat = Number(point.lat)
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
  const seq = ++requestId, owner = active
  selectEnsoTerritory({ lon, lat, label: 'Punto del mapa' })
  owner.message = 'Consultando el territorio y sus fuentes…'; render()
  try {
    const context = await getJSON(`/api/v1/intel/context?lat=${lat}&lon=${lon}`)
    if (active !== owner || seq !== requestId) return
    selectEnsoTerritory({ ...context, lon, lat, label: context.territory?.distrito || 'Ubicación sin distrito identificado' })
  } catch (err) {
    if (active !== owner || seq !== requestId) return
    owner.message = `Contexto no disponible: ${err.message}`; render()
  }
}

export function mountEnsoWorkspace(host, data, { playStory } = {}) {
  unmountEnsoWorkspace()
  active = { host, data, playStory, tab: 'history', collapsed: true, episode: '', location: { label: 'Selecciona un lugar en el mapa', lon: NaN, lat: NaN }, assumptions: { ...DEFAULT_ASSUMPTIONS }, message: '' }
  window.addEventListener('enso360:records', receiveRecords)
  render()
  if (typeof maplibregl !== 'undefined' && map) {
    pins = PILOTS.slice(0, -1).map((p) => {
      const element = document.createElement('button')
      element.type = 'button'; element.className = 'ew-map-pin'; element.textContent = '+'
      element.title = `Ampliar ${p.label} · ubicación orientativa`; element.setAttribute('aria-label', element.title)
      element.addEventListener('click', (e) => { e.stopPropagation(); navigatePilot(p) })
      return new maplibregl.Marker({ element }).setLngLat([p.lon, p.lat]).addTo(map)
    })
  }
}

export function unmountEnsoWorkspace() {
  ++requestId
  window.removeEventListener('enso360:records', receiveRecords)
  pins.forEach((p) => p.remove()); pins = []
  if (active?.host) active.host.replaceChildren()
  active = null
}

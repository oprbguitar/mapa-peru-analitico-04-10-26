// Orquestación: modos (Mapa · Patrones · Rutas · El Niño), choropleth, capas, Informador 360, asistente y espina temporal.
import { openAdmin } from './admin.js'
import { initAssistant } from './assistant.js'
import { initChrome, setPanel } from './chrome.js'
import { lastContext, renderContext, renderObservatory } from './context360.js'
import { initDialogs } from './dialogs.js'
import { closeStory, initStory, playStory, renderEnso } from './enso.js'
import { renderLegend } from './legend.js'
import { initLive, refreshWindowed, statusStrip, toggle } from './live.js'
import { fitBBox, flyTo, initMap, map, onStyleReady, paint, refreshThemeColors, resetNorth, setBase, setChoroplethOpacity, setExaggeration,
  setHotspots, setRelief, setSelected, setTerrain, showLevel, view } from './map.js'
import { setOcean, setOceanColor } from './ocean.js'
import { renderOverview, renderRegion } from './panel.js'
import { renderPatterns, setPatternScope } from './patterns.js'
import { initPlaces, toggleEmergencias, toggleSede, toggleServicio, toggleVias } from './places.js'
import { bindRail, bindRailView, renderKindKey, renderRail, setLiveMeta, showThematic, thematicChips } from './rail.js'
import { pickHandler as routePick, plan as planRoute, renderRoutes, setEndpoint } from './routes.js'
import { draw, initTimeline, setNote, syncPresets } from './timeline.js'
import { esc, getJSON, setState, state, toast } from './util.js'
import { initVision, openCameras, pickHandler as visionPick, refreshLayer as refreshCameras } from './vision.js'
import { bindSuggested, loadCatalog, setOverlay, setOverlayOpacity, setPointMode, weatherAt } from './weather.js'
import { setFxMode, setWeatherFx } from './wxfx.js'

const LEVELS = [['departamento', 'Departamento'], ['provincia', 'Provincia'], ['distrito', 'Distrito']]
const LIVE_WINDOW = { ahora: 'año en curso · vivo: ahora (sismos y focos 24 h)', '24h': 'vivo: últimas 24 h', '7d': 'vivo: últimos 7 días',
  '30d': 'vivo: últimos 30 días', '1a': 'vivo: últimos 30 días (máximo disponible)', '5a': 'vivo: últimos 30 días (máximo disponible)', year: 'vivo: últimos 30 días' }
let meta = { live: {} }
let loadSeq = 0
let mode = 'mapa'
let panelView = 'overview'   // overview · region · context · observatory · patterns · routes · enso · weather
let playTimer = null

function levelsFor() {
  if (state.dataset === 'sidpol') return ['departamento', 'provincia', 'distrito']
  if (state.dataset === 'indicador') return meta.indicators?.find((i) => i.codigo === state.code)?.levels || ['departamento']
  return ['departamento']
}

function renderLevels() {
  const ok = levelsFor()
  if (!ok.includes(state.level)) state.level = ok[0]
  const el = document.getElementById('level-switch')
  el.innerHTML = LEVELS.map(([id, label]) => `<button type="button" role="radio" data-lv="${id}" aria-checked="${state.level === id}"
    ${ok.includes(id) ? '' : `disabled title="Esta fuente no publica datos a nivel ${label.toLowerCase()}: no se reparten cifras"`}>${label}</button>`).join('')
}

function statPeriod() {
  const ext = state.extent
  const p = state.preset
  if (p === 'year') return { year: state.year, months: state.year === ext.last_year ? `1-${ext.last_month}` : '1-12' }
  if (p === 'ahora') return { year: ext.last_year, months: `1-${ext.last_month}` }
  if (['24h', '7d', '30d'].includes(p)) return { year: ext.last_year, months: `${ext.last_month}-${ext.last_month}` }
  if (p === '1a') return { year: ext.last_full_year, months: '1-12' }
  if (p === '5a') return { year: ext.last_full_year, months: '1-12', compare: ext.last_full_year - 5 }
  return {}
}

function choroplethURL() {
  const q = new URLSearchParams({ dataset: state.dataset, level: state.level })
  const sp = statPeriod()
  if (state.dataset === 'sidpol') {
    if (sp.year) q.set('year', sp.year)
    if (sp.months) q.set('months', sp.months)
    if (sp.compare) q.set('compare', sp.compare)
    if (state.modalidad) q.set('modalidad', state.modalidad)
  } else if (state.preset === 'year' && state.year) {
    q.set('year', state.year)
  }
  if (state.dataset === 'indicador') q.set('code', state.code)
  if (state.dataset === 'mpfn' && state.mpfnTid) q.set('tid', '1')
  if (state.dataset === 'devida') q.set('indicador', state.devidaInd)
  return `/api/v1/intel/crime/choropleth?${q}`
}

async function loadChoropleth() {
  const seq = ++loadSeq
  renderLevels()
  document.getElementById('layer-title').innerHTML = '<p class="loading">Calculando</p>'
  let c
  try {
    c = await getJSON(choroplethURL())
  } catch (e) {
    toast(e.message)
    return
  }
  if (seq !== loadSeq) return
  if (!c.available) {
    document.getElementById('layer-title').innerHTML = `<h2>Sin datos</h2><p>${esc(c.reason)}</p>`
    renderLegend(null)
    return
  }
  // con una modalidad elegida, el mapa muestra por defecto su % dentro del total del territorio
  if (!state.measure || !c.measures[state.measure]) state.measure = state.preset === '5a' && c.measures.change_pct ? 'change_pct' : c.measures.share_pct ? 'share_pct' : c.default_measure
  state.choropleth = c
  state.periodYear = c.period?.year
  state.periodMonths = c.period?.months
  state.compareYear = c.comparison?.year
  draw()
  const cls = paint(c, state.measure)
  renderLegend(c, state.measure, cls, measureHandler(c), legendTools(c))
  const cmp = c.comparison ? ` · cambio vs ${c.comparison.label}` : ''
  document.getElementById('layer-title').innerHTML = `<h2>${esc(c.title)}</h2><p>${esc(c.period?.label || '')}${esc(cmp)}${c.period?.partial ? ' · período parcial' : ''}</p>${thematicChips()}`
  setNote(c.dataset === 'sidpol' ? `Estadística: ${c.period.label}` : `Estadística anual: ${c.period?.label || ''}`, LIVE_WINDOW[state.preset] || '')
  if (panelView === 'region' && state.selected) selectRegion(state.selected, { keepView: true })
  else if (panelView === 'observatory' && state.selected) showObservatory(state.selected)
  else if (panelView === 'overview') renderOverview(c)
}

function legendTools(c) {
  const redraw = () => renderLegend(c, state.measure, paint(c, state.measure), measureHandler(c), legendTools(c))
  return {
    onPalette: (k) => {
      state.palette = k
      try { localStorage.setItem('pi-palette', k) } catch { /* sin almacenamiento */ }
      redraw()
    },
    onHot: (on) => {
      setHotspots(on)
      redraw()
    },
  }
}

function measureHandler(c) {
  return function onMeasure(m) {
    state.measure = m
    renderLegend(c, m, paint(c, m), onMeasure, legendTools(c))
    if (panelView === 'overview') renderOverview(c)
  }
}

function showPanel() {
  setPanel('panel', true)
  openSheet('panel')
}

async function selectRegion(ub, { keepView = false } = {}) {
  setState({ selected: ub })
  setSelected(ub)
  panelView = 'region'
  showPanel()
  try {
    const sp = statPeriod()
    const p = await renderRegion(ub, { year: sp.year, months: sp.months })
    if (!keepView) fitBBox(p.bbox)
  } catch (e) {
    toast(`Ficha no disponible: ${e.message}`)
  }
}

async function showObservatory(ub) {
  setState({ selected: ub })
  setSelected(ub)
  panelView = 'observatory'
  showPanel()
  await renderObservatory(ub, state.modalidad, {
    onYear: (y) => { state.preset = 'year'; state.year = y; syncPresets(); loadChoropleth() },
    onModalidad: (m) => { setState({ dataset: 'sidpol', modalidad: m, measure: m ? 'share_pct' : null }); renderRail(meta); loadChoropleth() },
    onSelect: (u) => showObservatory(u),
  })
}

async function showContext(lat, lon) {
  panelView = 'context'
  showPanel()
  try {
    const c = await renderContext(lat, lon, { onAction: contextAction })
    if (c.territory.ubigeo && state.level === 'distrito') setSelected(c.territory.ubigeo)
    state.selected = c.territory.ubigeo && state.level === 'distrito' ? c.territory.ubigeo : state.selected
    return c
  } catch (e) {
    toast(`Informador no disponible: ${e.message}`)
    return null
  }
}

function contextAction(act, c) {
  const t = c.territory
  if (act === 'speak') return import('./assistant.js').then((m) => m.speak(c.summary))
  if (act === 'observatory') return showObservatory(t.ubigeo)
  if (act === 'region') return selectRegion(t.ubigeo, { keepView: true })
  if (act === 'patterns') {
    setPatternScope(t.ubigeo.slice(0, 4), `${t.provincia} (provincia)`)
    return setMode('patrones')
  }
  if (act === 'route-from' || act === 'route-to') {
    setEndpoint(act === 'route-from' ? 'a' : 'b', c.point.lat, c.point.lon, t.distrito)
    return setMode('rutas')
  }
}

function openSheet(name) {
  document.body.dataset.sheet = name
  document.body.dataset.panel = name === 'panel' ? 'open' : ''
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-pressed', String(t.dataset.sheet === name))
}

// ── modos ───────────────────────────────────────────────────────────────────
function paintGi(d) {
  state.level = 'distrito'
  renderLevels()
  const c = { available: true, dataset: 'gi', level: 'distrito', title: `Focos Gi* · ${d.modalidad} · ${d.year}`, rows: d.rows.map((r) => ({ ubigeo: r.ubigeo, nombre: r.nombre, gi_z: r.z })),
    measures: { gi_z: { label: 'Gi* z', unit: 'z (rojo = foco, azul = frío)', kind: 'calculado' } }, default_measure: 'gi_z' }
  state.measure = 'gi_z'
  const cls = paint(c, 'gi_z')
  renderLegend(c, 'gi_z', cls, () => {}, legendTools(c))
  document.getElementById('layer-title').innerHTML = `<h2>${esc(c.title)}</h2><p>Getis-Ord Gi* · evolución frente a ${d.compare_year}</p>`
}

async function setMode(m) {
  if ((m === 'ninio') !== (mode === 'ninio')) {   // en El Niño el mar y el relieve importan más que el coloreado de denuncias
    state.hideChoropleth = m === 'ninio'
    showLevel(state.level)
  }
  mode = m
  document.body.dataset.mode = m
  if (m !== 'ninio') closeStory()
  for (const b of document.querySelectorAll('#modes [data-mode]')) b.setAttribute('aria-selected', String(b.dataset.mode === m))
  showPanel()
  if (m === 'mapa') {
    panelView = 'overview'
    return loadChoropleth()
  }
  if (m === 'patrones') {
    panelView = 'patterns'
    return renderPatterns({ onPaint: paintGi, onSelect: (u) => { goTo(u); setMode('mapa') } })
  }
  if (m === 'rutas') {
    panelView = 'routes'
    return renderRoutes()
  }
  if (m === 'ninio') {
    panelView = 'enso'
    return renderEnso()
  }
}

// ── búsqueda ────────────────────────────────────────────────────────────────
function bindSearch() {
  const input = document.getElementById('search')
  const list = document.getElementById('search-results')
  let t
  input.addEventListener('input', () => {
    clearTimeout(t)
    const q = input.value.trim()
    if (q.length < 2) return (list.hidden = true)
    t = setTimeout(async () => {
      const r = await getJSON(`/api/v1/map/geocode?q=${encodeURIComponent(q)}`)
      list.innerHTML = r.results.map((x, i) => `<li role="option" data-u="${esc(x.ubigeo || '')}" data-ll="${x.lon},${x.lat}" data-kind="${esc(x.kind)}" aria-selected="${i === 0}">${esc(x.name)}<small>${esc(x.detail)}</small></li>`).join('') || '<li aria-disabled="true">Sin resultados</li>'
      list.hidden = false
    }, 220)
  })
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-ll]')
    if (!li) return
    list.hidden = true
    input.value = li.firstChild.textContent
    const [lon, lat] = li.dataset.ll.split(',').map(Number)
    if (li.dataset.kind === 'territorio' && li.dataset.u) goTo(li.dataset.u)
    else {
      flyTo(lon, lat, 15)
      showContext(lat, lon)
    }
  })
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault()
    list.querySelector('li[data-ll]')?.click()
  })
  input.addEventListener('keydown', (e) => e.key === 'Escape' && (list.hidden = true))
}

function goTo(ub) {
  const level = { 2: 'departamento', 4: 'provincia', 6: 'distrito' }[ub.length]
  if (levelsFor().includes(level) && state.level !== level) {
    state.level = level
    loadChoropleth().then(() => selectRegion(ub))
  } else selectRegion(ub)
}

function bindTheme() {
  const btn = document.getElementById('toggle-theme')
  try {
    const saved = localStorage.getItem('pi-theme')
    if (saved) document.documentElement.dataset.theme = saved
  } catch { /* almacenamiento no disponible */ }
  btn.addEventListener('click', () => toggleTheme())
}

async function toggleTheme(force) {
  const dark = document.documentElement.dataset.theme !== 'light'
  const toLight = force ? force === 'dia' : dark
  if (toLight === !dark) return
  document.documentElement.dataset.theme = toLight ? 'light' : 'dark'
  try { localStorage.setItem('pi-theme', document.documentElement.dataset.theme) } catch { /* sin almacenamiento */ }
  if (view.base === 'oscuro' && toLight) await setBase('calles')
  else if (view.base === 'calles' && !toLight) await setBase('oscuro')
  refreshThemeColors()
  renderRail(meta)
  if (state.choropleth) loadChoropleth()
}

async function onView(kind, value) {
  if (kind === 'base') await setBase(value)
  else if (kind === 'terrain') {
    setTerrain(!view.terrain)
    if (view.terrain && !view.relief) setRelief(true)
  } else if (kind === 'relief') setRelief(!view.relief)
  else if (kind === 'choro') {
    state.hideChoropleth = !state.hideChoropleth
    showLevel(state.level)
  } else if (kind === 'exag') setExaggeration(value)
  else if (kind === 'choroOpacity') setChoroplethOpacity(value)
  else if (kind === 'wxo') setOverlay(value)
  else if (kind === 'wxoOpacity') setOverlayOpacity(value)
  else if (kind === 'oceanColor') {
    state.oceanColor = value
    setOceanColor(value)
    renderRail(meta)
  }
  document.getElementById('btn-3d').setAttribute('aria-pressed', String(view.terrain))
  document.getElementById('btn-relief').setAttribute('aria-pressed', String(view.relief))
  if (['base', 'terrain', 'relief', 'choro'].includes(kind)) renderRail(meta)
}

async function onLive(id, on) {
  if (id === 'wxfx-mode') {
    setFxMode(on)
    return renderRail(meta)
  }
  const [kind, cat] = id.split(':')
  try {
    if (id === 'wxpoint') {
      setPointMode(on)
      if (on) openSheet('map')
    } else if (id === 'wxlayer') setOverlay(on ? 'senamhi:aviso24h' : null)
    else if (id === 'ssta') setOverlay(on ? 'gibs:ssta' : null)
    else if (kind === 'sede') {
      const counts = await toggleSede(cat, on)
      if (counts) for (const [c, n] of Object.entries(counts)) setLiveMeta(`sede:${c}`, String(n))
    } else if (kind === 'svc') {
      if (cat === 'universidad') toggleServicio('instituto', on)
      toggleServicio(cat, on)
    } else if (id === 'emerg') setLiveMeta('emerg', (await toggleEmergencias(on)) || '')
    else if (id === 'vias') setLiveMeta('vias', (await toggleVias(on)) || '')
    else if (id === 'wxfx') {
      const m = await setWeatherFx(on)
      setLiveMeta('wxfx', on ? (m?.loading ? 'cargando' : `${m?.n || 0} celdas`) : '')
      if (m?.loading) setTimeout(() => state.live.has('wxfx') && onLive('wxfx', true), 5000)
    } else if (id === 'ocean') {
      const s = await setOcean(on, state.oceanColor)
      setLiveMeta('ocean', on ? (s?.loading ? 'cargando' : `${s?.n || 0} celdas`) : '')
      if (s?.loading) setTimeout(() => state.live.has('ocean') && onLive('ocean', true), 6000)
    } else if (id === 'cameras') setLiveMeta('cameras', on ? `${await refreshCameras(true)} canales` : (await refreshCameras(false), ''))
    else toggle(id, on) // capas en vivo existentes (vuelos, barcos, sismos…)
  } catch (e) {
    toast(e.message)
  }
  renderRail(meta)
}

function setLive(id, on) {
  const live = new Set(state.live)
  on ? live.add(id) : live.delete(id)
  setState({ live })
  return onLive(id, on)
}

async function liveMeta() {
  const s = await statusStrip()
  if (!s) return
  meta.live = Object.fromEntries(s.live.map((l) => [l.layer, l]))
}

// ── recorrido de años (▶ Años) ─────────────────────────────────────────────
function bindPlayYears() {
  const btn = document.getElementById('play-years')
  btn.addEventListener('click', () => {
    if (playTimer) {
      clearInterval(playTimer)
      playTimer = null
      btn.setAttribute('aria-pressed', 'false')
      btn.textContent = '▶ Años'
      return
    }
    const ext = state.extent
    let y = state.preset === 'year' && state.year < ext.last_year ? state.year + 1 : ext.first_year
    btn.setAttribute('aria-pressed', 'true')
    btn.textContent = '❚❚ Años'
    const stepYear = () => {
      state.preset = 'year'
      state.year = y
      syncPresets()
      loadChoropleth()
      if (++y > ext.last_year) {
        clearInterval(playTimer)
        playTimer = null
        btn.setAttribute('aria-pressed', 'false')
        btn.textContent = '▶ Años'
      }
    }
    stepYear()
    playTimer = setInterval(stepYear, 1800)
  })
}

// ── asistente: acciones que puede ejecutar ─────────────────────────────────
const LAYER_IDS = { comisarias: 'sede:comisaria', serenazgo: 'sede:serenazgo', fiscalias: 'sede:fiscalia', judicial: 'sede:judicial', salud: 'svc:hospital',
  emergencias: 'emerg', vias: 'vias', vuelos: 'flights', barcos: 'vessels', sismos: 'seismic', clima: 'wxfx', corrientes: 'ocean', camaras: 'cameras',
  satelites: 'satellites', focos: 'fires' }

const assistantActions = {
  selection: () => (lastContext() ? { lugar: lastContext().territory.distrito, ubigeo: lastContext().territory.ubigeo } : null),
  async ubicar({ lugar }) {
    const r = await getJSON(`/api/v1/map/geocode?q=${encodeURIComponent(lugar)}`)
    const x = r.results[0]
    if (!x) return `No encontré «${lugar}».`
    if (x.bbox && x.kind === 'territorio') fitBBox(x.bbox)
    else flyTo(x.lon, x.lat, 15)
    setMode('mapa')
    await showContext(x.lat, x.lon)
    return `Ubicado: ${x.name}.`
  },
  async informar({ tema = 'todo' }) {
    let c = lastContext()
    if (!c) {
      const ctr = map.getCenter()
      c = await showContext(ctr.lat, ctr.lng)
    }
    if (!c) return 'No hay un lugar seleccionado.'
    if (tema === 'todo') return c.summary
    const s = c.security
    if (tema === 'seguridad' && s) return `En ${c.territory.distrito}, ${s.year}: ${s.count} denuncias, tasa ${Math.round(s.rate || 0)} por 100 mil, cambio ${s.change_pct} por ciento. Modalidad principal: ${s.top_modality}.`
    if (tema === 'servicios') return c.services.rows.filter((r) => r.nearest).map((r) => `${r.label}: ${r.n_1km} a menos de 1 km`).join('. ') + '.'
    if (tema === 'emergencias') return c.emergencies.indeci ? `${c.emergencies.indeci.total} emergencias en 12 meses; la más frecuente: ${c.emergencies.indeci.by_type[0]?.fenomeno?.toLowerCase() || 'ninguna'}.` : 'Sin datos de emergencias.'
    if (tema === 'ninio') return c.enso ? `${c.enso.status}: ${c.enso.headline}.` : 'Este lugar no está en la zona de mayor influencia de El Niño costero.'
    if (tema === 'clima') return c.environment?.clima ? `Ahora ${Math.round(c.environment.clima.temp_c)} grados según el modelo.` : 'Activa el clima animado para tener datos de la celda.'
    return c.summary
  },
  async capa({ nombre, encender = true }) {
    const id = LAYER_IDS[nombre]
    if (!id) return `No conozco la capa ${nombre}.`
    await setLive(id, encender)
    return `${encender ? 'Encendí' : 'Apagué'} ${nombre}.`
  },
  tema({ modalidad }) {
    setState({ dataset: 'sidpol', modalidad: modalidad === 'todas' ? '' : modalidad, measure: null })
    renderRail(meta)
    loadChoropleth()
    return `Mapa de ${modalidad === 'todas' ? 'todas las denuncias' : modalidad.toLowerCase()}.`
  },
  anio({ anio }) {
    state.preset = 'year'
    state.year = Math.max(state.extent.first_year, Math.min(state.extent.last_year, anio))
    syncPresets()
    loadChoropleth()
    return `Año ${state.year}.`
  },
  abrir({ modulo }) {
    if (modulo === 'admin') return openAdmin()
    if (modulo === 'camaras') return openCameras()
    if (modulo === 'fuentes') return document.getElementById('open-sources').click()
    setMode({ ninio: 'ninio', patrones: 'patrones', rutas: 'rutas' }[modulo] || 'mapa')
    return ''
  },
  historia_ninio({ evento }) {
    setMode('ninio')
    playStory(evento)
    return 'Reproduciendo la historia.'
  },
  async ruta({ origen, destino }) {
    await setMode('rutas')
    const p = await planRoute({ text: origen, name: origen }, { text: destino, name: destino })
    renderRoutes()
    return p ? p.why : 'No pude trazar la ruta.'
  },
  vista({ modo }) {
    if (modo === 'amplia') setPanel('wide', true)
    else if (modo === 'normal') setPanel('wide', false)
    else if (modo === '3d') onView('terrain')
    else if (modo === 'plano' && view.terrain) onView('terrain')
    else if (modo === 'noche' || modo === 'dia') toggleTheme(modo)
    else if (modo === 'satelite') onView('base', 'satelite')
    return ''
  },
}

async function boot() {
  renderKindKey()
  initChrome()
  initDialogs()
  bindTheme()
  bindSearch()
  document.getElementById('open-admin').addEventListener('click', openAdmin)
  document.getElementById('modes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]')
    if (b && state.extent) setMode(b.dataset.mode)
  })
  initAssistant(assistantActions)
  const fam = await getJSON('/api/v1/intel/crime/families')
  state.extent = fam.sidpol
  const dev = await getJSON('/api/v1/intel/crime/choropleth?dataset=devida').catch(() => ({}))
  meta = { ...meta, indicators: fam.indicators, modalities: fam.sidpol?.modalities || [], devida: dev.indicators || [] }
  await liveMeta()
  renderRail(meta)
  bindRail({
    onThematic: (off) => {
      renderRail(meta)
      showLevel(state.level)
      if (!off) return loadChoropleth()
      renderLegend(null)
      document.getElementById('layer-title').innerHTML = ''
    },
    onLive,
    onView,
  })
  bindRailView(onView)
  const thShow = (id) => {
    showThematic(id)
    renderRail(meta)
    showLevel(state.level)
    loadChoropleth()
  }
  document.getElementById('families').addEventListener('th-show', (e) => thShow(e.detail))
  document.getElementById('layer-title').addEventListener('click', (e) => {
    const b = e.target.closest('[data-th-show]')
    if (b) thShow(b.dataset.thShow)
  })
  await initMap({
    onSelect: (ub) => {   // el clic sobre un territorio solo lo resalta; la ficha la arma el Informador 360
      setState({ selected: ub })
      setSelected(ub)
    },
    onClick: (e) => {
      if (routePick(e.lngLat) || visionPick(e.lngLat)) return
      if (state.wxPoint) {
        openSheet('panel')
        panelView = 'weather'
        weatherAt(e.lngLat, { render: (html) => (document.getElementById('panel-body').innerHTML = html) })
        return
      }
      if (e.originalEvent?.target?.closest?.('.maplibregl-marker')) return
      const hit = map.queryRenderedFeatures(e.point).some((f) => /^(pl-|cam-|ports|flights|vessels|seismic|fires|satellites|datacenters|rt-)/.test(f.layer.id))
      if (hit) return
      if (mode !== 'mapa') setMode('mapa')
      showContext(e.lngLat.lat, e.lngLat.lng)
    },
  })
  initLive()
  initPlaces()
  initStory()
  initVision()
  bindPlayYears()
  bindSuggested(document.getElementById('panel-body'), (key) => {
    const live = new Set(state.live)
    live.add('wxlayer')
    setState({ live })
    setOverlay(key)
    renderRail(meta)
  })
  onStyleReady(() => {
    if (state.choropleth) loadChoropleth()
    if (state.selected) setSelected(state.selected)
  })
  for (const [id, fn] of [['btn-3d', () => onView('terrain')], ['btn-relief', () => onView('relief')], ['btn-north', () => resetNorth()]]) {
    document.getElementById(id).addEventListener('click', fn)
  }
  loadCatalog().then(() => renderRail(meta))
  renderRail(meta)
  document.getElementById('level-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lv]')
    if (!b || b.disabled) return
    state.level = b.dataset.lv
    state.selected = null
    setSelected(null)
    if (panelView !== 'context') panelView = 'overview'
    loadChoropleth()
  })
  await initTimeline({
    onPreset: (p) => {
      state.preset = p
      state.measure = null
      syncPresets()
      loadChoropleth()
      refreshWindowed()
    },
    onYear: (y) => {
      state.preset = 'year'
      state.year = y
      syncPresets()
      loadChoropleth()
    },
  })
  for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => openSheet(t.dataset.sheet))
  openSheet('map')
  await loadChoropleth()
  setInterval(liveMeta, 30000)
  const es = new EventSource('/api/v1/stream')
  es.addEventListener('layer', () => liveMeta())
}

boot().catch((e) => {
  console.error(e)
  toast(`No se pudo iniciar: ${e.message}`, 10000)
})

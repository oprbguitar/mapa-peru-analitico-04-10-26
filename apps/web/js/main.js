// Orquestación: estado → choropleth, capas en vivo, ficha y espina temporal.
import { initDialogs } from './dialogs.js'
import { renderLegend } from './legend.js'
import { initLive, refreshWindowed, statusStrip, toggle } from './live.js'
import { fitBBox, initMap, paint, refreshThemeColors, setSelected } from './map.js'
import { renderOverview, renderRegion } from './panel.js'
import { bindRail, renderKindKey, renderRail } from './rail.js'
import { draw, initTimeline, setNote, syncPresets } from './timeline.js'
import { esc, getJSON, setState, state, toast } from './util.js'

const LEVELS = [['departamento', 'Departamento'], ['provincia', 'Provincia'], ['distrito', 'Distrito']]
const LIVE_WINDOW = { ahora: 'año en curso · vivo: ahora (sismos y focos 24 h)', '24h': 'vivo: últimas 24 h', '7d': 'vivo: últimos 7 días',
  '30d': 'vivo: últimos 30 días', '1a': 'vivo: últimos 30 días (máximo disponible)', '5a': 'vivo: últimos 30 días (máximo disponible)', year: 'vivo: últimos 30 días' }
let meta = { live: {} }
let loadSeq = 0

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
  if (!state.measure || !c.measures[state.measure]) state.measure = state.preset === '5a' && c.measures.change_pct ? 'change_pct' : c.default_measure
  state.choropleth = c
  state.periodYear = c.period?.year
  state.periodMonths = c.period?.months
  state.compareYear = c.comparison?.year
  draw()
  const cls = paint(c, state.measure)
  renderLegend(c, state.measure, cls, measureHandler(c))
  const cmp = c.comparison ? ` · cambio vs ${c.comparison.label}` : ''
  document.getElementById('layer-title').innerHTML = `<h2>${esc(c.title)}</h2><p>${esc(c.period?.label || '')}${esc(cmp)}${c.period?.partial ? ' · período parcial' : ''}</p>`
  setNote(c.dataset === 'sidpol' ? `Estadística: ${c.period.label}` : `Estadística anual: ${c.period?.label || ''}`, LIVE_WINDOW[state.preset] || '')
  if (state.selected) selectRegion(state.selected, { keepView: true })
  else renderOverview(c)
}

function measureHandler(c) {
  return function onMeasure(m) {
    state.measure = m
    renderLegend(c, m, paint(c, m), onMeasure)
    if (!state.selected) renderOverview(c)
  }
}

async function selectRegion(ub, { keepView = false } = {}) {
  const level = { 2: 'departamento', 4: 'provincia', 6: 'distrito' }[ub.length]
  setState({ selected: ub })
  setSelected(ub)
  openSheet('panel')
  try {
    const sp = statPeriod()
    const p = await renderRegion(ub, { year: sp.year, months: sp.months })
    if (!keepView) fitBBox(p.bbox)
    void level
  } catch (e) {
    toast(`Ficha no disponible: ${e.message}`)
  }
}

function openSheet(name) {
  document.body.dataset.sheet = name
  document.body.dataset.panel = name === 'panel' ? 'open' : ''
  for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-pressed', String(t.dataset.sheet === name))
}

function bindSearch() {
  const input = document.getElementById('search')
  const list = document.getElementById('search-results')
  let t
  input.addEventListener('input', () => {
    clearTimeout(t)
    const q = input.value.trim()
    if (q.length < 2) return (list.hidden = true)
    t = setTimeout(async () => {
      const r = await getJSON(`/api/v1/map/search?q=${encodeURIComponent(q)}`)
      list.innerHTML = r.results.map((x, i) => `<li role="option" data-u="${esc(x.ubigeo)}" aria-selected="${i === 0}">${esc(x.nombre)}<small>${esc(x.nivel)} · ${esc(x.departamento)}</small></li>`).join('') || '<li aria-disabled="true">Sin resultados</li>'
      list.hidden = false
    }, 180)
  })
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-u]')
    if (!li) return
    list.hidden = true
    input.value = li.firstChild.textContent
    goTo(li.dataset.u)
  })
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const first = list.querySelector('li[data-u]')
    if (first) first.click()
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
  btn.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = dark ? 'light' : 'dark'
    try { localStorage.setItem('pi-theme', document.documentElement.dataset.theme) } catch { /* sin almacenamiento */ }
    refreshThemeColors()
    if (state.choropleth) loadChoropleth()
  })
}

async function liveMeta() {
  const s = await statusStrip()
  if (!s) return
  meta.live = Object.fromEntries(s.live.map((l) => [l.layer, l]))
}

async function boot() {
  renderKindKey()
  initDialogs()
  bindTheme()
  bindSearch()
  const fam = await getJSON('/api/v1/intel/crime/families')
  state.extent = fam.sidpol
  const dev = await getJSON('/api/v1/intel/crime/choropleth?dataset=devida').catch(() => ({}))
  meta = { ...meta, indicators: fam.indicators, modalities: fam.sidpol?.modalities || [], devida: dev.indicators || [] }
  await liveMeta()
  renderRail(meta)
  bindRail({
    onThematic: () => {
      renderRail(meta)
      loadChoropleth()
    },
    onLive: (id, on) => {
      renderRail(meta)
      toggle(id, on) // espera internamente a que el mapa y las capas estén listos
    },
  })
  await initMap({ onSelect: (ub) => selectRegion(ub, { keepView: true }) })
  initLive()
  document.getElementById('level-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-lv]')
    if (!b || b.disabled) return
    state.level = b.dataset.lv
    state.selected = null
    setSelected(null)
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

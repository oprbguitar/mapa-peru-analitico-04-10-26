// Rutas estratégicas: A → B con alternativas comparadas por criterios explícitos (tiempo, focos, vías, apoyo, lluvia).
/* global maplibregl */
import { ensureLineLayer, ensurePointLayer, map, ptFeature, setLines, setPoints } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge, postJSON, toast } from './util.js'

const body = () => document.getElementById('panel-body')
const ends = { a: null, b: null }
let picking = null
let markers = []
let lastPlan = null
const COLORS = ['--accent', '--pal-esp-5', '--kind-ia']

export function setEndpoint(which, lat, lon, name) {
  ends[which] = { lat, lon, name: name || `${fmt(lat, 4)}, ${fmt(lon, 4)}` }
}

export function pickHandler(lngLat) {
  if (!picking) return false
  setEndpoint(picking, lngLat.lat, lngLat.lng)
  picking = null
  document.body.classList.remove('picking')
  document.getElementById('pick-banner').hidden = true
  renderRoutes()
  return true
}

function field(which, label) {
  const v = ends[which]
  return `<label class="field"><span>${label}</span><input type="text" id="rt-${which}" value="${esc(v?.name || '')}" placeholder="Distrito, lugar o dirección">
    <button class="btn" type="button" data-pick="${which}">Marcar en el mapa</button></label>`
}

export function renderRoutes() {
  body().innerHTML = `<div class="panel-head"><div class="eyebrow">Rutas estratégicas</div><h2>Trazar y comparar</h2>
    <p class="sub">Escribe dos lugares o márcalos en el mapa. Se comparan las alternativas con criterios públicos.</p></div>
    <form class="settings" id="rt-form" autocomplete="off"><fieldset><legend>Trayecto</legend>${field('a', 'Origen')}${field('b', 'Destino')}
      <div class="ai-actions" style="padding:0"><button class="btn btn-primary" type="submit">Trazar</button>
      <button class="btn btn-ghost" type="button" id="rt-swap">⇅ Invertir</button></div></fieldset></form>
    <div id="rt-out">${lastPlan ? planHtml(lastPlan) : ''}</div>`
  body().querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    picking = b.dataset.pick
    document.body.classList.add('picking')
    const bn = document.getElementById('pick-banner')
    bn.hidden = false
    bn.innerHTML = `Haz clic en el mapa para marcar el ${picking === 'a' ? 'origen' : 'destino'} <button class="btn" type="button" id="pick-cancel">Cancelar</button>`
    document.getElementById('pick-cancel').onclick = () => { picking = null; bn.hidden = true; document.body.classList.remove('picking') }
  }))
  document.getElementById('rt-swap').addEventListener('click', () => {
    [ends.a, ends.b] = [ends.b, ends.a]
    renderRoutes()
  })
  document.getElementById('rt-form').addEventListener('submit', (e) => {
    e.preventDefault()
    for (const w of ['a', 'b']) {
      const txt = document.getElementById(`rt-${w}`).value.trim()
      if (!ends[w] || ends[w].name !== txt) ends[w] = txt ? { text: txt, name: txt } : null
    }
    if (!ends.a || !ends.b) return toast('Indica origen y destino.')
    plan()
  })
  if (lastPlan) bindPlan()
}

export async function plan(a = ends.a, b = ends.b) {
  ends.a = a
  ends.b = b
  const out = document.getElementById('rt-out')
  if (out) out.innerHTML = '<p class="loading">Calculando rutas y analizando el trayecto</p>'
  const q = new URLSearchParams()
  for (const [k, txt, e] of [['a', 'from', a], ['b', 'to', b]]) {
    if (e.lat != null) {
      q.set(`${k}lat`, e.lat)
      q.set(`${k}lon`, e.lon)
      q.set(`${k}name`, e.name)
    } else q.set(txt, e.text || e.name)
  }
  try {
    lastPlan = await getJSON(`/api/v1/intel/routes?${q}`)
  } catch (e) {
    if (out) out.innerHTML = `<p class="note">${esc(e.message)}</p>`
    return null
  }
  draw(lastPlan)
  if (document.getElementById('rt-out')) {
    document.getElementById('rt-out').innerHTML = planHtml(lastPlan)
    bindPlan()
  }
  return lastPlan
}

function draw(p) {
  ensureLineLayer('rt-lines', { width: 4 })
  ensurePointLayer('rt-vias', { colorBy: 'st', colors: { activa: '--danger', cerrada: '--warn' }, radius: 8 })
  setLines('rt-lines', p.routes.map((r, i) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords },
    properties: { color: cssVar(COLORS[i] || '--ink-soft'), width: r.id === p.recommended ? 6 : 3, opacity: r.id === p.recommended ? 1 : 0.6 } })).reverse())
  setPoints('rt-vias', p.routes.flatMap((r) => r.vias).map((v) => ptFeature(v.lon, v.lat, { st: v.active ? 'activa' : 'cerrada' })), true)
  for (const m of markers) m.remove()
  markers = [['A', p.origin], ['B', p.dest]].map(([t, e]) => new maplibregl.Marker({ element: Object.assign(document.createElement('div'),
    { className: 'wx', textContent: t }) }).setLngLat([e.lon, e.lat]).addTo(map))
  const all = p.routes.flatMap((r) => r.coords)
  const xs = all.map((c) => c[0]), ys = all.map((c) => c[1])
  map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 80, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900 })
}

function planHtml(p) {
  return `<section class="section"><h3><span>${esc(p.origin.name)} → ${esc(p.dest.name)}</span>${kindBadge('calculado')}</h3>
    ${p.online ? '' : '<p class="note">Sin conexión al servicio de rutas: se muestra la línea recta. Configura un OSRM propio (osrm_url) para operar sin Internet.</p>'}
    <div class="callout" style="border-left-color:var(--accent)"><strong>Recomendada: ruta ${esc(p.recommended)}</strong><span>${esc(p.why)}</span></div>
    <table class="why-table section-gap"><thead><tr><th>Criterio</th>${p.routes.map((r, i) => `<th style="color:var(${COLORS[i]})">${esc(r.id)}${r.id === p.recommended ? ' ✓' : ''}</th>`).join('')}</tr></thead><tbody>
      <tr><td>Distancia</td>${p.routes.map((r) => `<td>${fmt(r.distance_km, 1)} km</td>`).join('')}</tr>
      <tr><td>Tiempo (OSRM)</td>${p.routes.map((r) => `<td>${r.duration_min == null ? '—' : fmt(r.duration_min, 0) + ' min'}</td>`).join('')}</tr>
      <tr><td>Km por distritos foco</td>${p.routes.map((r) => `<td>${fmt(r.hot_km, 1)}</td>`).join('')}</tr>
      <tr><td>Vías MTC afectadas ≤ 2 km</td>${p.routes.map((r) => `<td>${r.vias.filter((v) => v.active).length} activas / ${r.vias.length}</td>`).join('')}</tr>
      <tr><td>Emergencias INDECI (12 m)</td>${p.routes.map((r) => `<td>${r.indeci_12m}</td>`).join('')}</tr>
      <tr><td>Comisarías ≤ 1 km</td>${p.routes.map((r) => `<td>${r.support_1km.comisaria}</td>`).join('')}</tr>
      <tr><td>Salud ≤ 1 km</td>${p.routes.map((r) => `<td>${r.support_1km.salud + r.support_1km.hospital}</td>`).join('')}</tr>
      <tr><td>Bomberos ≤ 1 km</td>${p.routes.map((r) => `<td>${r.support_1km.bomberos}</td>`).join('')}</tr>
      <tr><td>Lluvia en ruta (celdas)</td>${p.routes.map((r) => `<td>${r.rain_cells}</td>`).join('')}</tr></tbody></table>
    <details class="why section-gap"><summary>Distritos atravesados (ruta ${esc(p.recommended)})</summary><div class="why-body"><dl class="kv">
      ${p.routes.find((r) => r.id === p.recommended).districts.map((d) => `<dt>${esc(d.nombre)} <small>${esc(d.band || '')}</small></dt><dd>${fmt(d.km, 1)} km</dd>`).join('')}</dl></div></details>
    <p class="src-meta">Criterios: ${esc(p.criteria.join(' · '))}. ${esc(p.caveat)}</p>
    <div class="ai-actions" style="padding:0"><button class="btn" type="button" id="rt-ai">Explicar la decisión con IA</button></div><div class="ai-out" id="rt-ai-out"></div></section>`
}

function bindPlan() {
  document.getElementById('rt-ai')?.addEventListener('click', async (e) => {
    const p = lastPlan
    const facts = p.routes.flatMap((r) => [
      { label: `Distancia de la ruta ${r.id}`, value: r.distance_km, unit: 'km' }, { label: `Tiempo de la ruta ${r.id}`, value: r.duration_min ?? 0, unit: 'min' },
      { label: `Km por distritos foco en la ruta ${r.id}`, value: r.hot_km, unit: 'km' },
      { label: `Vías afectadas activas cerca de la ruta ${r.id}`, value: r.vias.filter((v) => v.active).length, unit: 'tramos' },
      { label: `Comisarías a 1 km de la ruta ${r.id}`, value: r.support_1km.comisaria, unit: 'sedes' }])
    const out = document.getElementById('rt-ai-out')
    e.currentTarget.setAttribute('aria-busy', 'true')
    try {
      const r = await postJSON('/api/v1/intel/ai/explain', { topic: `Ruta ${p.origin.name} → ${p.dest.name}; recomendada ${p.recommended}`, facts })
      out.innerHTML = r.verification.sentences.map((s) => `<p class="ai-sentence" data-status="${esc(s.status)}">${esc(s.sentence)}</p>`).join('') +
        `<p class="src-meta">${kindBadge(r.answer.kind === 'ia' ? 'ia' : 'calculado', r.answer.engine)} · ${esc(r.verification.status)}</p>`
    } catch (err) {
      out.innerHTML = `<p class="note">${esc(err.message)}</p>`
    }
  })
}

export const isPicking = () => !!picking

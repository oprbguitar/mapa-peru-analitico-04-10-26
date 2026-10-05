// Observatorio de El Niño: estado oficial ENFEN, ICEN 1950–hoy, comparación con eventos y la historia animada.
/* global maplibregl */
import { ensureLineLayer, ensurePointLayer, flyTo, map, ptFeature, setLines, setPoints, showLayer } from './map.js'
import { esc, fmt, getJSON, kindBadge, postJSON, toast } from './util.js'
import { oceanKey, setOcean, setOceanColor } from './ocean.js'

let data = null
let story = null // { s, i, playing, timer }
let dashTimer = null
const body = () => document.getElementById('panel-body')
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

async function load() {
  if (!data) data = await getJSON('/api/v1/intel/enso')
  return data
}

function icenChart(d) {
  const W = 360, H = 160, padB = 18, padT = 8
  const s = d.icen
  const n = s.length
  const vals = s.map((r) => r.v)
  const max = Math.max(4.5, ...vals), min = Math.min(-2.5, ...vals)
  const x = (i) => (i / (n - 1)) * (W - 4) + 2
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padB - padT)
  const idxOf = (ym) => s.findIndex((r) => r.y === +ym.slice(0, 4) && r.m === +ym.slice(5, 7))
  const band = (e, cls) => {
    const a = idxOf(e.start), b = e.end ? idxOf(e.end) : -1
    if (a < 0) return ''
    const st = d.storylines.find((x) => x.start === e.start)
    const xb = x(b < 0 ? n - 1 : b)
    return `<rect class="${cls}" x="${x(a)}" y="${padT}" width="${Math.max(2, xb - x(a))}" height="${H - padB - padT}"/>` +
      (st ? `<rect class="hit" data-story="${esc(st.id)}" x="${x(a) - 3}" y="${padT}" width="${Math.max(8, xb - x(a) + 6)}" height="${H - padB - padT}" tabindex="0" role="button" aria-label="Ver historia ${esc(st.title)}"><title>${esc(st.title)} · ${esc(e.magnitude)}</title></rect>` : '')
  }
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [1950, 1970, 1990, 2010, 2026].map((yy) => {
    const i = s.findIndex((r) => r.y === yy)
    return i >= 0 ? `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">${yy}</text>` : ''
  }).join('')
  const cur = d.storylines.find((x) => x.id === '2026-27')
  return `<svg class="icen" viewBox="0 0 ${W} ${H}" role="img" aria-label="Índice Costero El Niño mensual 1950–${s.at(-1).y}">
    ${d.events.nino.map((e) => band(e, 'warm')).join('')}${d.events.nina.map((e) => band(e, 'cold')).join('')}
    ${cur ? band({ start: cur.start, end: null, magnitude: 'en curso' }, 'warm') : ''}
    <line class="z" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
    ${[0.4, 1.0, 1.7, 3.0].map((t) => `<line class="th" x1="0" x2="${W}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}
    <path class="ln" d="${line}"/><circle class="now" cx="${x(n - 1)}" cy="${y(vals.at(-1))}" r="4"/>${ticks}
    <text x="${W - 2}" y="${y(3.0) - 3}" text-anchor="end">extraordinario 3,0</text></svg>`
}

export async function renderEnso() {
  body().innerHTML = '<p class="loading">Cargando El Niño</p>'
  const d = await load()
  const c = d.current
  const li = d.latest?.icen
  const wk = d.latest?.weekly
  body().innerHTML = `<div class="stagger">
    <div class="panel-head"><div class="eyebrow">El Niño · Perú</div><h2>Observatorio de El Niño</h2>
      <p class="sub">Estado oficial, histórico desde 1950 y corrientes del mar.</p></div>
    <div id="enso-side" aria-live="polite"></div>
    <section class="alert-band" aria-label="Estado oficial ENFEN"><div class="eyebrow">${esc(c.status)} · ${kindBadge('oficial', 'ENFEN')}</div>
      <h3>${esc(c.headline)}</h3><ul>${c.points.slice(0, 4).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="src-meta"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.comunicado)}</a> · ${esc(c.date)} · próximo: ${esc(c.next)}</p></section>
    ${d.available ? `<div class="triad">
      <div><div class="label">ICEN ${li ? `${li.y}-${String(li.m).padStart(2, '0')}` : ''}</div><div class="value">${li ? (li.v > 0 ? '+' : '') + fmt(li.v, 2) : '—'}</div><div class="unit">°C · índice oficial</div>${kindBadge('oficial', 'IGP')}</div>
      <div><div class="label">Mar Niño 1+2</div><div class="value">${wk ? (wk.anom12 > 0 ? '+' : '') + fmt(wk.anom12, 1) : '—'}</div><div class="unit">°C anomalía · ${esc(wk?.date || '')}</div>${kindBadge('oficial', 'NOAA')}</div>
      <div><div class="label">Temperatura</div><div class="value">${wk ? fmt(wk.sst12, 1) : '—'}</div><div class="unit">°C frente a la costa</div>${kindBadge('oficial', 'NOAA')}</div></div>
    <section class="section"><h3><span>ICEN 1950–hoy · clic en un evento para ver su historia</span>${kindBadge('oficial')}</h3>${icenChart(d)}
      <p class="src-meta">Rojo: El Niño costero · azul: La Niña costera (lista oficial IGP/ENFEN 2024). Líneas: umbrales débil 0,4 · moderado 1,0 · fuerte 1,7 · extraordinario 3,0.</p></section>
    <section class="section"><h3><span>¿Qué tan fuerte es hoy?</span>${kindBadge('calculado')}</h3>
      <div class="bars">${d.comparison.items.map((x, i) => `<div class="bar-row"><span>${esc(x.title)} · máx. ${fmt(x.peak, 2)} (${esc(x.peak_period)})</span>
        <span class="val">${fmt(x.ratio * 100, 0)} %</span><div class="track"><div class="fill calc" style="--i:${i};width:${Math.min(100, x.ratio * 100)}%"></div></div></div>`).join('')}</div>
      <p class="src-meta">${esc(d.comparison.method)}</p></section>` : `<p class="note">${esc(d.reason)}</p>`}
    <section class="section"><h3><span>Historias de eventos</span>${kindBadge('oficial', 'con fuentes')}</h3><div class="story-list">
      ${d.storylines.map((s) => `<button type="button" class="story-btn" data-story="${esc(s.id)}"><span class="play" aria-hidden="true">▶</span>
        <span><b>${esc(s.title)}</b><br><small>${esc(s.summary)}</small></span><span class="mag">${esc(s.official?.magnitude || (s.end ? '' : 'en curso'))}${s.duration_months ? ` · ${s.duration_months} m` : ''}</span></button>`).join('')}</div></section>
    <section class="section"><h3><span>Corrientes del mar ahora</span>${kindBadge('proyeccion', 'modelo')}</h3>
      <div class="seg" role="group" aria-label="Corrientes"><button type="button" data-ocean="sst" aria-pressed="false">Temperatura</button>
        <button type="button" data-ocean="delta" aria-pressed="false">Cambio 7 días</button><button type="button" data-ocean="off" aria-pressed="true">Ocultar</button></div>
      <div id="ocean-info" class="section-gap"></div></section>
    <section class="ai-box" aria-label="Lectura con IA"><div class="ai-head"><strong>Lectura guiada</strong>${kindBadge('ia')}</div>
      <label class="sr-only" for="enso-q">Pregunta</label><textarea id="enso-q" placeholder="¿Cómo se compara con 1997-98? ¿Qué zonas vigilar?"></textarea>
      <div class="ai-actions"><button class="btn btn-primary" type="button" id="enso-ai">Explicar</button><span class="src-meta">La IA no pronostica: cita el pronóstico oficial ENFEN y verifica cada cifra.</span></div>
      <div class="ai-out" id="enso-out" aria-live="polite"></div></section>
    <section class="section"><h3>Fuentes</h3><div class="sources-list">${(d.provenance || []).map((p) => `<div class="src">${kindBadge(p.kind, p.institution)}
      <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a><div class="src-meta">Descargado: ${esc((p.downloaded || '—').slice(0, 10))}</div></div>`).join('')}</div></section></div>`
  bindEnso()
}

function bindEnso() {
  const root = body()
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fly]')
    if (f) flyTo(...f.dataset.fly.split(',').map(Number), 10)
  })
  root.addEventListener('change', (e) => {
    if (e.target.id === 'enso-cmp' && story) {
      story.cmp = e.target.value
      sideUpdate()
    }
  })
  root.querySelectorAll('[data-story]').forEach((el) => {
    el.addEventListener('click', () => playStory(el.dataset.story))
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), playStory(el.dataset.story)))
  })
  root.querySelectorAll('[data-ocean]').forEach((b) => b.addEventListener('click', async () => {
    root.querySelectorAll('[data-ocean]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
    const v = b.dataset.ocean
    const s = await setOcean(v !== 'off', v === 'off' ? null : v)
    if (v !== 'off') setOceanColor(v)
    document.getElementById('ocean-info').innerHTML = v === 'off' ? '' : s?.loading ? '<p class="loading">Consultando el modelo oceánico</p>' : oceanKey()
    if (s?.loading) setTimeout(() => b.click(), 5000)
  }))
  document.getElementById('enso-ai').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const out = document.getElementById('enso-out')
    btn.setAttribute('aria-busy', 'true')
    out.innerHTML = '<p class="loading">Reuniendo hechos oficiales y verificando</p>'
    try {
      const r = await postJSON('/api/v1/intel/ai/enso', { question: document.getElementById('enso-q').value })
      const v = r.verification
      out.innerHTML = `<div class="ai-head"><span>${kindBadge(r.answer.kind === 'ia' ? 'ia' : 'calculado', r.answer.engine)}</span>
        <span class="verdict" data-v="${esc(v.status)}">${esc(v.status)} · ${v.total - v.unverified}/${v.total}</span></div>
        ${v.sentences.map((s) => `<p class="ai-sentence" data-status="${esc(s.status)}">${esc(s.sentence)}${s.problems.length ? `<span class="flag">NO VERIFICADO: ${esc(s.problems.join('; '))}</span>` : ''}</p>`).join('')}
        <p class="src-meta">Pronóstico oficial: <a href="${esc(r.official.url)}" target="_blank" rel="noopener">${esc(r.official.comunicado)}</a></p>`
    } catch (err) {
      out.innerHTML = `<p class="note">${esc(err.message)}</p>`
    } finally {
      btn.removeAttribute('aria-busy')
    }
  })
}

// ── historia: todo el período en paralelo + recorrido opcional ─────────────
const TYPE = { mar: 'Mar cálido', lluvia: 'Lluvias', inundacion: 'Inundación', huaico: 'Huaico', rio: 'Desborde de río', emergencia: 'Emergencia', fin: 'Fin del evento', pronostico: 'Pronóstico oficial' }
let markers = []
let evs = null          // registros del período (SINPAD + DesInventar)
const evOff = new Set() // tipos ocultos por el usuario
const EV_COLORS = { huaico: '--kind-estimacion', rio: '--pal-esp-2', inundacion: '--info', lluvia: '--fx-rain', deslizamiento: '--live-quake', marejada: '--enso-cold' }
let evPopup = null
let onEvChange = null
const cmpCache = {}
export const setEnsoRepaint = (fn) => (onEvChange = fn)
const shortPlace = (s) => (s || '').split(',').map((x) => x.replace(/^(DIST|PROV|DEPA)\. /, '').trim()).filter(Boolean).slice(0, 3).join(', ')

/** Conteo de registros visibles por territorio (solo con el UBIGEO publicado a ese nivel o más fino: nunca se reparte). */
export function ensoChoropleth(level) {
  if (!evs) return null
  const len = { departamento: 2, provincia: 4, distrito: 6 }[level]
  const n = {}
  for (const e of evs.events) if (!evOff.has(e[2]) && e[12]?.length >= len) n[e[12].slice(0, len)] = (n[e[12].slice(0, len)] || 0) + 1
  return { available: true, dataset: 'enso', level, title: `${story.s.title} · registros por ${level}`, rows: Object.entries(n).map(([ubigeo, count]) => ({ ubigeo, count })),
    measures: { count: { label: 'Registros', unit: 'registros del período (tipos visibles)', kind: 'calculado' } }, default_measure: 'count' }
}

async function sideUpdate() {
  const el = document.getElementById('enso-side')
  if (!el) return
  if (!evs || !story) return (el.innerHTML = '')
  const on = Object.keys(evs.types).filter((k) => !evOff.has(k) && evs.counts[k])
  const places = {}
  for (const e of evs.events) {
    if (evOff.has(e[2])) continue
    const k = shortPlace(e[5])
    const p = (places[k] ??= { n: 0, lon: e[0], lat: e[1], t: e[2] })
    p.n++
  }
  const top = Object.entries(places).sort((a, b) => b[1].n - a[1].n).slice(0, 10)
  const tipo = story.cmp && on.includes(story.cmp) ? story.cmp : on[0]
  el.innerHTML = `<section class="section"><h3><span>${esc(story.s.title)} · dónde hubo más registros</span>${kindBadge('calculado')}</h3>
    <p class="src-meta">${on.map((k) => esc(evs.types[k])).join(' · ') || 'Ningún tipo visible'}</p>
    <ol class="ev-rank">${top.map(([k, p]) => `<li><button type="button" data-fly="${p.lon},${p.lat}" data-type="${p.t}"><span>${esc(k)}</span><b>${p.n}</b></button></li>`).join('')}</ol></section>
    ${tipo ? `<section class="section"><h3><span>Comparar Niños</span>${kindBadge('calculado')}</h3>
      <label class="sr-only" for="enso-cmp">Tipo a comparar</label><select id="enso-cmp">${on.map((k) => `<option value="${k}" ${k === tipo ? 'selected' : ''}>${esc(evs.types[k])}</option>`).join('')}</select>
      <div id="enso-cmp-out"><p class="loading">Comparando períodos</p></div></section>` : ''}`
  if (!tipo) return
  try {
    const c = (cmpCache[tipo] ??= await getJSON(`/api/v1/intel/enso/compare/${tipo}`))
    const out = document.getElementById('enso-cmp-out')
    if (!out) return
    const max = Math.max(1, ...c.events.map((x) => x.total))
    out.innerHTML = `<div class="ev-cmp">${c.events.map((x) => `<div class="ev-cmp-row${x.id === story?.s.id ? ' cur' : ''}"><div class="bar-row"><span>${esc(x.title)}</span><span class="val">${fmt(x.total)}</span>
      <div class="track"><div class="fill calc" style="width:${(x.total / max) * 100}%"></div></div></div>
      <ol class="ev-rank">${x.top.slice(0, 3).map((p) => `<li><button type="button" data-fly="${p.lon},${p.lat}" data-type="${tipo}"><span>${esc(p.lugar)}</span><b>${p.n}</b></button></li>`).join('')}</ol></div>`).join('')}</div>
      <p class="src-meta">${esc(c.method)} SINPAD no nombra la quebrada: el lugar es el distrito publicado; DesInventar a veces trae el paraje.</p>`
  } catch (err) {
    toast(err.message)
  }
}
const icenTxt = (ch) => (ch.icen != null ? (ch.icen > 0 ? '+' : '') + fmt(ch.icen, 2) + ' °C' : '—')
const sstTxt = (ch) => (ch.sst ? fmt(ch.sst.sst, 1) + ' °C (' + (ch.sst.anom > 0 ? '+' : '') + fmt(ch.sst.anom, 1) + ')' : '—')

function marchDash(id) {
  clearInterval(dashTimer)
  if (reduce()) return
  const steps = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
  let k = 0
  dashTimer = setInterval(() => map.getLayer(id) && map.setPaintProperty(id, 'line-dasharray', steps[k++ % steps.length]), 90)
}

function clearMarkers() {
  markers.forEach((m) => m.remove())
  markers = []
}

function evFilter() {
  if (!evs) return
  onEvChange?.()
  sideUpdate()
  setPoints('enso-ev', evs.events.flatMap((e, i) => (evOff.has(e[2]) ? [] : [ptFeature(e[0], e[1], { t: e[2], i })])), true)
}

function evClick(f, lngLat) {
  const e = evs?.events[f.properties.i]
  if (!e) return
  const [, , t, fecha, fen, lugar, dam, afe, fal, reg, fuente, ubic] = e
  evPopup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 6 })
  evPopup.setLngLat(lngLat).setHTML(`<div class="pop-title">${esc(evs.types[t])}</div><div class="src-meta">${esc(fecha)} · ${esc(lugar)}</div>
    <div class="pop-row"><span>Registro</span><b>${esc(fen)}</b></div>
    ${dam ? `<div class="pop-row"><span>Damnificados</span><b>${fmt(dam)}</b></div>` : ''}${afe ? `<div class="pop-row"><span>Afectados</span><b>${fmt(afe)}</b></div>` : ''}
    ${fal ? `<div class="pop-row"><span>Fallecidos</span><b>${fmt(fal)}</b></div>` : ''}
    <div class="src-meta">${esc(reg)}${fuente ? ` · prensa: ${esc(fuente)}` : ''}${ubic !== 'punto' ? ` · ubicado en el centroide del ${esc(ubic)}` : ''}</div>`).addTo(map)
}

async function loadEvents(id) {
  evs = null
  ensurePointLayer('enso-ev', { colorBy: 't', colors: EV_COLORS, radius: 5, onClick: evClick })
  try {
    const d = await getJSON(`/api/v1/intel/enso/events/${encodeURIComponent(id)}`)
    if (story?.s.id !== id) return
    evs = d
    evFilter()
    render()
  } catch (err) {
    toast(err.message)
  }
}

function evBlock() {
  if (!evs) return '<p class="loading">Reuniendo registros del período</p>'
  return `<div class="ev-types" role="group" aria-label="Tipos de registro">${Object.entries(evs.types).map(([k, v]) => `<button type="button" data-ev="${k}" data-type="${k}" aria-pressed="${!evOff.has(k)}" ${evs.counts[k] ? '' : 'disabled'}>
      <span class="sw" aria-hidden="true"></span>${esc(v)} <b>${fmt(evs.counts[k])}</b></button>`).join('')}</div>
    <p class="src-meta">${fmt(evs.total)} registros ${esc(evs.from)} → ${esc(evs.to)} · ${evs.provenance.map((p) => kindBadge(p.kind, p.institution)).join(' ')} · clic en un punto para ver el detalle</p>`
}

/** Dibuja TODOS los registros del período a la vez: marcadores fijos con fecha, tipo y temperatura del mar del momento. */
function drawAll() {
  const { s } = story
  clearMarkers()
  ensureLineLayer('st-path', { dashed: true, color: '--enso-warm', width: 4 })
  setLines('st-path', s.chapters.filter((c) => c.path?.length).map((c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c.path }, properties: {} })))
  marchDash('st-path')
  const pts = data.current.rivers && s.chapters.some((c) => c.rivers) ? data.current.rivers.map((r) => ptFeature(r.lon, r.lat, { k: 'river', name: r.name })) : []
  ensurePointLayer('st-pts', { colorBy: 'k', colors: { river: '--fx-rain' }, radius: 7 })
  setPoints('st-pts', pts, pts.length > 0)
  s.chapters.forEach((ch, k) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'ev-mark'
    el.dataset.type = ch.type || 'mar'
    el.dataset.k = k
    el.setAttribute('aria-current', String(k === story.i))
    el.innerHTML = `<span class="n">${k + 1}</span><span class="t"><b>${k === 0 ? 'Inicio · ' : ''}${esc(TYPE[ch.type] || ch.title)}</b> ${esc(ch.date)}<br>ICEN ${icenTxt(ch)}</span>`
    el.addEventListener('click', (e) => (e.stopPropagation(), go(k)))
    markers.push(new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([ch.lon, ch.lat]).addTo(map))
  })
  const b = new maplibregl.LngLatBounds()
  s.chapters.forEach((c) => { b.extend([c.lon, c.lat]); (c.path || []).forEach((p) => b.extend(p)) })
  map.fitBounds(b, { padding: { top: 80, bottom: 80, left: 380, right: 380 }, maxZoom: 9, duration: reduce() ? 0 : 900 })
}

function render() {
  const { s, i } = story
  const ch = s.chapters[i]
  markers.forEach((m, k) => m.getElement().setAttribute('aria-current', String(k === i)))
  const el = document.getElementById('story')
  el.hidden = false
  el.classList.toggle('min', !!story.min)
  el.innerHTML = `<div class="story-head"><span class="when">${esc(s.title)}${s.duration_months ? ` · ${s.duration_months} meses` : ''}</span>
      <span><button class="btn btn-ghost btn-icon" type="button" data-st="min" aria-expanded="${!story.min}" aria-label="${story.min ? 'Mostrar' : 'Ocultar'} el panel">${story.min ? '▴' : '▾'}</button>
      <button class="btn btn-ghost btn-icon" type="button" data-st="close" aria-label="Cerrar la historia">✕</button></span></div>
    <div class="story-body">${evBlock()}
    <ol class="ev-list">${s.chapters.map((c, k) => `<li><button type="button" data-st="go" data-k="${k}" data-type="${esc(c.type || 'mar')}" aria-current="${k === i}">
      <span class="n">${k + 1}</span><span><b>${esc(c.title)}</b><small>${esc(TYPE[c.type] || '')} · ${esc(c.date)} · ICEN ${icenTxt(c)} · mar ${sstTxt(c)}</small></span></button></li>`).join('')}</ol>
    <div class="ev-detail"><h3>${i + 1}. ${esc(ch.title)}</h3><p>${esc(ch.text)}</p>
      ${ch.path_label ? `<p class="src-meta">${kindBadge('estimacion', 'trazo ilustrativo')} ${esc(ch.path_label)}</p>` : ''}
      <div class="story-src">${(ch.sources || []).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join('')}</div></div>
    <div class="story-progress"><span id="st-bar"></span></div>
    <div class="story-nav"><button class="btn" type="button" data-st="all">Ver todo</button>
      <button class="btn btn-primary" type="button" data-st="play" aria-pressed="${story.playing}">${story.playing ? '❚❚ Pausa' : '▶ Recorrido'}</button>
      <button class="btn" type="button" data-st="prev" ${i ? '' : 'disabled'} aria-label="Anterior">◀</button>
      <button class="btn" type="button" data-st="next" ${i < s.chapters.length - 1 ? '' : 'disabled'} aria-label="Siguiente">▶</button></div></div>`
  const bar = document.getElementById('st-bar')
  if (story.playing && !reduce()) {
    bar.style.transition = 'none'
    bar.style.transform = 'scaleX(0)'
    requestAnimationFrame(() => { bar.style.transition = 'transform 9s linear'; bar.style.transform = 'scaleX(1)' })
  }
  clearTimeout(story.timer)
  if (story.playing) story.timer = setTimeout(() => (story.i < s.chapters.length - 1 ? go(story.i + 1) : pause()), 9000)
}

function go(i) {
  story.i = i
  const ch = story.s.chapters[i]
  flyTo(ch.lon, ch.lat, ch.zoom || 6)
  render()
}

function pause() {
  story.playing = false
  clearTimeout(story.timer)
  render()
}

function close() {
  clearTimeout(story?.timer)
  clearInterval(dashTimer)
  story = null
  clearMarkers()
  document.getElementById('story').hidden = true
  setLines('st-path', [])
  showLayer('st-pts', false)
  showLayer('enso-ev', false)
  evPopup?.remove()
  evs = null
  sideUpdate()
  onEvChange?.()
}

export async function playStory(id) {
  const d = await load()
  const s = d.storylines.find((x) => x.id === id)
  if (!s) return toast('Historia no disponible')
  if (story) close()
  story = { s, i: 0, playing: false, timer: null, min: false }
  drawAll()
  render()
  loadEvents(id)
}

export const closeStory = () => story && close()

export function initStory() {
  document.getElementById('story').addEventListener('click', (e) => {
    const ev = e.target.closest('[data-ev]')
    if (ev && story) {
      evOff.has(ev.dataset.ev) ? evOff.delete(ev.dataset.ev) : evOff.add(ev.dataset.ev)
      evFilter()
      return render()
    }
    const b = e.target.closest('[data-st]')
    if (!b || !story) return
    const a = b.dataset.st
    if (a === 'close') close()
    else if (a === 'min') {
      story.min = !story.min
      render()
    }
    else if (a === 'prev') go(Math.max(0, story.i - 1))
    else if (a === 'next') go(Math.min(story.s.chapters.length - 1, story.i + 1))
    else if (a === 'go') go(+b.dataset.k)
    else if (a === 'all') {
      story.playing = false
      drawAll()
      render()
    } else if (a === 'play') {
      story.playing = !story.playing
      story.playing ? go(story.i) : render()
    }
  })
  document.addEventListener('keydown', (e) => e.key === 'Escape' && story && close())
}

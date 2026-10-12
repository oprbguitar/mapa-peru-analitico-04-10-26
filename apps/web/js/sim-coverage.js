// Cobertura de comisarías e incidentes dentro del simulador operativo (planificación exploratoria).
//  · Comisaría: área de atención por cercanía (Voronoi), radio de inflexión hasta la vecina, sedes dentro del área,
//    cifras oficiales del distrito tal cual y un estimador de dotación con supuestos visibles y editables.
//  · Incidente: sedes más cercanas por tipo con tiempo estimado; «Despachar» las coloca como unidades del escenario
//    para simular la respuesta en paralelo; «Perímetro» y «Tramo» cierran bloques.
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge } from './util.js'

const CAT = { comisaria: ['Comisarías', 'patrulla', '--inst-comisaria'], serenazgo: ['Serenazgo', 'serenazgo', '--inst-serenazgo'],
  fiscalia: ['Ministerio Público', null, '--inst-fiscalia'], judicial: ['Poder Judicial', null, '--inst-judicial'] }
const fc = (features) => ({ type: 'FeatureCollection', features })
let panel = null, last = null, onDispatch = () => {}
// supuestos del estimador (editables en el panel; nada sale de la comisaría real)
const plan = { base: 'distrito', perDay: null, minPer: 25, occupancy: 70, crew: 2, shifts: 3, relief: 1.25 }

export function initCoverage({ dispatch }) { onDispatch = dispatch }

function ensureLayers() {
  if (map.getSource('cov-area')) return
  for (const id of ['cov-area', 'cov-links', 'cov-pts']) map.addSource(id, { type: 'geojson', data: fc([]) })
  map.addLayer({ id: 'cov-area-fill', type: 'fill', source: 'cov-area', paint: { 'fill-color': cssVar('--info'), 'fill-opacity': 0.12 } })
  map.addLayer({ id: 'cov-area-line', type: 'line', source: 'cov-area', paint: { 'line-color': cssVar('--info'), 'line-width': 2.5, 'line-dasharray': [3, 2] } })
  map.addLayer({ id: 'cov-links', type: 'line', source: 'cov-links', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.85 } })
  map.addLayer({ id: 'cov-pts', type: 'circle', source: 'cov-pts', paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'color'],
    'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--void') } })
}

function ensurePanel() {
  if (panel) return panel
  panel = document.createElement('section')
  panel.className = 'cov-panel hud hud-frame'
  panel.setAttribute('aria-live', 'polite')
  panel.hidden = true
  document.body.appendChild(panel)
  panel.addEventListener('click', onPanelClick)
  panel.addEventListener('input', onPanelInput)
  return panel
}

const pt = (lon, lat, color, r = 6) => ({ type: 'Feature', properties: { color, r }, geometry: { type: 'Point', coordinates: [lon, lat] } })
const link = (a, b, color) => ({ type: 'Feature', properties: { color }, geometry: { type: 'LineString', coordinates: [a, b] } })

// ── comisaría ──────────────────────────────────────────────────────────────
export async function pickComisaria(lngLat) {
  ensureLayers()
  const p = ensurePanel()
  p.hidden = false
  p.innerHTML = '<p class="loading">Buscando la comisaría más cercana</p>'
  try {
    const n = await getJSON(`/api/v1/intel/coverage/nearest?lat=${lngLat.lat.toFixed(6)}&lon=${lngLat.lng.toFixed(6)}&n=1`)
    const c = n.by_cat.comisaria[0]
    if (!c) throw new Error('No hay comisarías cargadas cerca de este punto.')
    last = { kind: 'comisaria', d: await getJSON(`/api/v1/intel/coverage/comisaria?id=${encodeURIComponent(c.id)}`) }
    plan.perDay = last.d.district.denuncias?.per_day ?? null
    drawComisaria()
  } catch (e) { p.innerHTML = `<p class="note">${esc(e.message)}</p>${closeBtn()}` }
}

function drawComisaria() {
  const d = last.d
  map.getSource('cov-area').setData(fc(d.area ? [{ type: 'Feature', properties: {}, geometry: d.area }] : []))
  const pts = [pt(d.sede.lon, d.sede.lat, cssVar('--inst-comisaria'), 9)]
  for (const [c, rows] of Object.entries(d.inside)) for (const r of rows) pts.push(pt(r.lon, r.lat, cssVar(CAT[c][2]), 6))
  const nb = d.neighbors[0]
  map.getSource('cov-pts').setData(fc(pts))
  map.getSource('cov-links').setData(fc(nb ? [link([d.sede.lon, d.sede.lat], [nb.lon, nb.lat], cssVar('--warn'))] : []))
  for (const id of ['cov-area-fill', 'cov-area-line', 'cov-links', 'cov-pts']) map.moveLayer(id)
  const ring = d.area?.coordinates?.[0]
  if (ring?.length) {
    const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1])
    map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: 120, maxZoom: 16, duration: 700 })
  }
  renderComisaria()
}

function estimate() {
  const perDay = Number(plan.perDay)
  if (!perDay || perDay <= 0) return null
  const busyH = perDay * plan.minPer / 60                     // horas-móvil de atención por día
  const simult = busyH / 24 / (plan.occupancy / 100)          // móviles en servicio a la vez para esa ocupación
  const units = Math.max(1, Math.ceil(simult))
  const staff = Math.ceil(units * plan.crew * plan.shifts * plan.relief)
  return { busyH, simult, units, staff }
}

function renderComisaria() {
  const d = last.d, dist = d.district, e = estimate()
  const ic = d.inside_counts
  panel.innerHTML = `<div class="cov-head"><div><p class="eyebrow">Comisaría · área de atención</p><h2>${esc(d.sede.name || 'Comisaría')}</h2>
      <p class="src-meta">${esc([d.sede.distrito, d.sede.provincia, d.sede.departamento].filter(Boolean).join(' · '))}</p></div>${closeBtn()}</div>
    <dl class="kv cov-kv">
      <dt>Radio de inflexión</dt><dd>${d.inflexion_km != null ? `${fmt(d.inflexion_km, 2)} km` : '—'}<small>mitad de la distancia a la comisaría vecina más cercana</small></dd>
      <dt>Radio medio (3 vecinas)</dt><dd>${d.mean_inflexion_km != null ? `${fmt(d.mean_inflexion_km, 2)} km` : '—'}</dd>
      <dt>Área de atención</dt><dd>${fmt(d.area_km2, 2)} km² · alcance máx. ${fmt(d.reach_km, 2)} km</dd>
      <dt>Dentro del área</dt><dd>${ic.serenazgo} serenazgo · ${ic.comisaria} otras sedes PNP · ${ic.fiscalia} fiscalía · ${ic.judicial} judicial</dd>
      <dt>Comisaría vecina</dt><dd>${d.neighbors[0] ? `${esc(d.neighbors[0].name || '')} · ${fmt(d.neighbors[0].km, 2)} km` : '—'}</dd></dl>
    <p class="src-meta">${kindBadge('calculado')} ${esc(d.method)}</p>
    <section class="section"><h3><span>Cifras oficiales del distrito</span>${kindBadge('oficial', 'MININTER')}</h3>
      ${dist.indicators.length ? `<dl class="kv">${dist.indicators.map((x) => `<dt>${esc(x.label)} (${x.year})</dt><dd>${fmt(x.value, 0)}</dd>`).join('')}</dl>`
        : '<p class="src-meta">Personal y vehículos por distrito (RENAMU/PNP) no descargados en este equipo: «Fuentes» → MININTER indicadores.</p>'}
      ${dist.denuncias ? `<p class="src-meta">Denuncias SIDPOL ${dist.denuncias.year}: <b>${fmt(dist.denuncias.total, 0)}</b> en todo el distrito (${fmt(dist.denuncias.per_day, 1)} por día). Es la cifra del distrito: no se reparte entre comisarías.</p>` : ''}</section>
    <section class="section"><h3><span>Estimador de dotación</span>${kindBadge('estimacion', 'supuestos editables')}</h3>
      <div class="cov-form">
        <label class="field"><span>Incidentes por día a atender</span><input type="number" min="0" step="0.1" data-plan="perDay" value="${plan.perDay ?? ''}" placeholder="escribe un valor">
          <small>${dist.denuncias ? `Prellenado con el total diario del distrito (supone que esta sede lo atiende todo); ajústalo.` : 'Sin dato del distrito: escribe tu valor.'}</small></label>
        <label class="field"><span>Minutos por atención</span><input type="number" min="5" max="240" data-plan="minPer" value="${plan.minPer}"></label>
        <label class="field"><span>Ocupación objetivo %</span><input type="number" min="20" max="95" data-plan="occupancy" value="${plan.occupancy}"></label>
        <label class="field"><span>Efectivos por móvil</span><input type="number" min="1" max="6" data-plan="crew" value="${plan.crew}"></label>
        <label class="field"><span>Turnos por día</span><input type="number" min="1" max="4" data-plan="shifts" value="${plan.shifts}"></label>
        <label class="field"><span>Factor de relevo</span><input type="number" min="1" max="2" step="0.05" data-plan="relief" value="${plan.relief}"></label></div>
      <div class="cov-out" id="cov-out">${estimateHtml(e)}</div>
      <p class="src-meta">Fórmula: incidentes/día × minutos ÷ 60 = horas‑móvil; ÷ 24 ÷ ocupación = móviles simultáneos (redondeo hacia arriba);
        × efectivos × turnos × relevo = personal. Es un orden de magnitud para planificar, no una norma de dotación.</p></section>`
}

function estimateHtml(e) {
  if (!e) return '<p class="src-meta">Escribe los incidentes por día para estimar.</p>'
  return `<div class="cov-big"><div><b>${e.units}</b><span>móviles en servicio a la vez</span></div><div><b>${fmt(e.staff, 0)}</b><span>efectivos en total</span></div></div>
    <p class="src-meta">${fmt(e.busyH, 1)} horas‑móvil por día · ${fmt(e.simult, 2)} móviles ocupados en promedio.</p>`
}

// ── incidente ──────────────────────────────────────────────────────────────
export async function incident(lngLat) {
  ensureLayers()
  const p = ensurePanel()
  p.hidden = false
  p.innerHTML = '<p class="loading">Buscando sedes cercanas</p>'
  try {
    last = { kind: 'incidente', d: await getJSON(`/api/v1/intel/coverage/nearest?lat=${lngLat.lat.toFixed(6)}&lon=${lngLat.lng.toFixed(6)}&n=3`), sel: new Set() }
    for (const c of ['comisaria', 'serenazgo']) if (last.d.by_cat[c][0]) last.sel.add(last.d.by_cat[c][0].id)
    drawIncident()
  } catch (e) { p.innerHTML = `<p class="note">${esc(e.message)}</p>${closeBtn()}` }
}

function chosen() {
  const out = []
  for (const [c, rows] of Object.entries(last.d.by_cat)) for (const r of rows) if (last.sel.has(r.id)) out.push({ ...r, cat: c })
  return out
}

function drawIncident() {
  const d = last.d, [lon, lat] = d.point
  const sel = chosen()
  map.getSource('cov-area').setData(fc([]))
  map.getSource('cov-pts').setData(fc([pt(lon, lat, cssVar('--danger'), 10), ...Object.entries(d.by_cat).flatMap(([c, rows]) =>
    rows.map((r) => pt(r.lon, r.lat, cssVar(CAT[c][2]), last.sel.has(r.id) ? 8 : 5)))]))
  map.getSource('cov-links').setData(fc(sel.map((r) => link([r.lon, r.lat], [lon, lat], cssVar(CAT[r.cat][2])))))
  for (const id of ['cov-links', 'cov-pts']) map.moveLayer(id)
  const first = sel.length ? Math.min(...sel.map((r) => r.eta_min)) : null
  const all = sel.length ? Math.max(...sel.map((r) => r.eta_min)) : null
  panel.innerHTML = `<div class="cov-head"><div><p class="eyebrow">Incidente · respuesta en paralelo</p><h2>${first != null ? `Primera llegada ~${fmt(first, 1)} min` : 'Elige quién responde'}</h2>
      <p class="src-meta">${sel.length} sedes · todas en el lugar ~${all != null ? fmt(all, 1) : '—'} min</p></div>${closeBtn()}</div>
    ${Object.entries(d.by_cat).map(([c, rows]) => `<section class="section"><h3><span>${esc(CAT[c][0])}</span></h3><ul class="cov-list">${rows.map((r) =>
      `<li><label><input type="checkbox" data-sel="${esc(r.id)}" ${last.sel.has(r.id) ? 'checked' : ''}><span>${esc(r.name || 'Sede')}</span></label>
        <span class="cov-eta"><b>${fmt(r.eta_min, 1)}</b> min · ${fmt(r.km, 2)} km</span></li>`).join('') || '<li class="src-meta">Sin sedes cargadas</li>'}</ul></section>`).join('')}
    <div class="tool-row"><button class="btn btn-primary" type="button" data-cov="dispatch" ${sel.some((r) => CAT[r.cat][1]) ? '' : 'disabled'}>Despachar al escenario</button>
      <button class="btn" type="button" data-cov="perimetro">⬠ Cerrar bloque</button><button class="btn" type="button" data-cov="tramo">╱ Cortar vía</button></div>
    <p class="src-meta">${kindBadge('estimacion')} ${esc(d.method)} Velocidad ${fmt(d.assumptions.speed_kmh, 0)} km/h · rodeo ×${fmt(d.assumptions.circuity, 1)}.
      «Despachar» coloca patrulleros en las comisarías y serenazgo en sus sedes elegidas, y el simulador recalcula. Ubicación de sedes: OSM aproximada.</p>`
}

// ── eventos del panel ──────────────────────────────────────────────────────
const closeBtn = () => '<button class="btn btn-ghost btn-icon" type="button" data-cov="close" aria-label="Cerrar">✕</button>'

function onPanelClick(e) {
  const a = e.target.closest('[data-cov]')?.dataset.cov
  if (a === 'close') return hideCoverage()
  if (a === 'dispatch' && last?.kind === 'incidente') {
    const units = chosen().filter((r) => CAT[r.cat][1]).map((r) => ({ kind: CAT[r.cat][1], lon: r.lon, lat: r.lat }))
    return onDispatch({ units })
  }
  if (a === 'perimetro' || a === 'tramo') return onDispatch({ tool: a })
}

function onPanelInput(e) {
  const k = e.target.dataset.plan
  if (k && last?.kind === 'comisaria') {
    plan[k] = e.target.value === '' ? null : Number(e.target.value)
    document.getElementById('cov-out').innerHTML = estimateHtml(estimate())
    return
  }
  const s = e.target.dataset.sel
  if (s && last?.kind === 'incidente') {
    e.target.checked ? last.sel.add(s) : last.sel.delete(s)
    drawIncident()
  }
}

export function hideCoverage() {
  if (panel) panel.hidden = true
  last = null
  for (const id of ['cov-area', 'cov-links', 'cov-pts']) map.getSource(id)?.setData(fc([]))
}

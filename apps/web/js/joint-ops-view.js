// Operativos conjuntos — vistas (HTML como texto; los eventos se delegan en joint-ops.js con data-act).
import { esc, fmt, kindBadge } from './util.js'
import { PHASE, PRIORITY, SIGLA, clock, costAt, fmtDur, fmtT, soles, unitState } from './joint-ops-model.js'

const opColor = (n) => `var(--ops-op-${((n - 1) % 12) + 1})`
const kColor = (k) => `var(--ops-k-${k})`
const fColor = (c) => `var(--ops-f-${c})`
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`
export const FAC_GLYPH = { comisaria: '◆', serenazgo: '◆', fiscalia: '§', judicial: '§', hospital: '+', salud: '+', bomberos: '▲',
  aeropuerto: '✈', puerto: '⚓', base_militar: '★', base_naval: '⚓', mercado: '▣' }

// ── panel izquierdo ─────────────────────────────────────────────────────────
export function leftHtml(st) {
  const tabs = [['ops', 'Operativos'], ['apoyos', 'Apoyos'], ['hipo', 'Hipótesis y costos'], ['lib', 'Guardados']]
  return `<div class="jo-tabs" role="tablist" aria-label="Plan">${tabs.map(([id, l]) =>
    `<button type="button" role="tab" data-act="tab" data-tab="${id}" aria-selected="${st.tab === id}">${l}</button>`).join('')}</div>
    <div class="jo-tabbody">${st.tab === 'ops' ? opsHtml(st) : st.tab === 'apoyos' ? supportsHtml(st) : st.tab === 'hipo' ? hypoHtml(st) : libHtml(st)}</div>`
}

function opsHtml(st) {
  const ops = st.plan.operations
  const cat = st.catalog
  const sel = ops.find((o) => o.id === st.sel)
  return `<div class="jo-row">
      <button class="btn jo-btn-ops" type="button" data-act="add-op" aria-pressed="${st.pick?.type === 'op'}">＋ Operativo en el mapa</button>
      <button class="btn btn-ghost" type="button" data-act="demo" title="Cuatro operativos simultáneos en Lima, Callao, Iquitos y Piura">Ejemplo</button>
    </div>
    ${ops.length ? `<ol class="jo-oplist">${ops.map((o) => {
      const r = st.result?.operations.find((x) => x.id === o.id)
      return `<li><button type="button" class="jo-op" data-act="sel-op" data-id="${o.id}" aria-pressed="${o.id === st.sel}">
        <span class="jo-num" style="--c:${opColor(o.n)}">${o.n}</span>
        <span class="jo-op-main"><b>${esc(o.name)}</b><small>${esc(cat.incidents[o.incident]?.label || o.incident)} · ${esc(PRIORITY[o.priority] || '')}</small></span>
        <span class="jo-op-meta">${o.resources.reduce((a, x) => a + (+x.qty || 1), 0)} u.<small>${r?.first_arrival != null ? `1.ª ${fmtDur(r.first_arrival - r.start)}` : 'sin calcular'}</small></span>
      </button></li>`
    }).join('')}</ol>` : '<p class="note">Pulsa <b>＋ Operativo en el mapa</b> y haz clic donde ocurre, o carga el <b>Ejemplo</b>. Puedes tener varios operativos a la vez en distintas regiones.</p>'}
    ${sel ? editorHtml(st, sel) : ''}`
}

function editorHtml(st, o) {
  const cat = st.catalog
  const inc = cat.incidents[o.incident] || {}
  const res = st.result?.units.filter((u) => u.op === o.id) || []
  const warn = st.result?.warnings.filter((w) => w.op === o.id) || []
  return `<section class="jo-editor" aria-label="Operativo ${o.n}">
    <div class="jo-ed-head"><span class="jo-num" style="--c:${opColor(o.n)}">${o.n}</span>
      <input class="jo-in" data-field="name" value="${esc(o.name)}" aria-label="Nombre del operativo" maxlength="60">
      <button class="btn btn-ghost btn-icon" type="button" data-act="fly-op" data-id="${o.id}" title="Ir al operativo" aria-label="Ir al operativo">⌖</button>
      <button class="btn btn-ghost btn-icon" type="button" data-act="del-op" data-id="${o.id}" title="Quitar operativo" aria-label="Quitar operativo">✕</button></div>
    <div class="jo-grid">
      <label>Incidencia<select data-field="incident">${Object.entries(cat.incidents).map(([k, v]) => opt(k, v.label, o.incident)).join('')}</select></label>
      <label>Prioridad<select data-field="priority">${Object.entries(PRIORITY).map(([k, v]) => opt(k, v, o.priority)).join('')}</select></label>
      <label>Inicio (T+ min)<input type="number" min="0" max="1440" step="5" data-field="start" value="${o.start || 0}"></label>
      <label>En sitio (min)<input type="number" min="5" max="1440" step="5" data-field="onsite" value="${o.onsite ?? inc.onsite}" title="Supuesto de la incidencia: ${inc.onsite} min"></label>
      <label>Complejidad ×<input type="number" min="0.8" max="3" step="0.05" data-field="complexity" value="${o.complexity ?? inc.complexity}" title="Multiplica el traslado (acceso difícil, vías dañadas)"></label>
      <label>Ubicación<output>${fmt(o.lat, 4)}, ${fmt(o.lon, 4)}</output></label>
    </div>
    <h3 class="jo-h">Recursos <small>vehículos, personal, aeronaves, lanchas</small></h3>
    <div class="jo-row jo-add">
      <select id="jo-kind" aria-label="Tipo de recurso">${Object.entries(cat.kinds).map(([k, v]) => opt(k, `${SIGLA[k]} · ${v.label}`, st.kind)).join('')}</select>
      <input id="jo-qty" type="number" min="1" max="50" value="1" aria-label="Cantidad">
      <button class="btn" type="button" data-act="add-res">Agregar</button>
      <button class="btn btn-ghost" type="button" data-act="preset" title="Reemplaza por la plantilla de la incidencia">Plantilla</button>
    </div>
    ${o.resources.length ? `<table class="jo-res"><thead><tr><th>Recurso</th><th>Cant.</th><th>Pers.</th><th>Salida</th><th>Llega</th><th></th></tr></thead><tbody>
      ${o.resources.map((r, i) => {
        const k = cat.kinds[r.kind]
        const u = res.find((x) => x.id === `${o.id}-${i + 1}`)
        const w = warn.find((x) => x.unit === `${o.id}-${i + 1}`)
        return `<tr data-i="${i}">
          <td><span class="jo-sig" style="--c:${kColor(r.kind)}">${SIGLA[r.kind]}</span> ${esc(k.label)}
            <div class="jo-origin">${u ? `desde ${esc(u.origin.name)} · ${fmt(u.km, 1)} km · ${esc(u.engine)}` : w ? `<span class="jo-warn">${esc(w.msg)}</span>` : r.origin ? esc(r.origin.name) : 'sede más cercana compatible'}
              <button type="button" class="jo-link" data-act="pick-origin" data-i="${i}">${r.origin ? 'cambiar origen' : 'fijar origen'}</button>
              ${r.origin ? `<button type="button" class="jo-link" data-act="auto-origin" data-i="${i}">automático</button>` : ''}
              <label class="jo-chk"><input type="checkbox" data-rfield="force_fail" ${r.force_fail ? 'checked' : ''}> ensayar falla</label></div></td>
          <td><input type="number" min="1" max="50" data-rfield="qty" value="${r.qty || 1}" aria-label="Cantidad"></td>
          <td><input type="number" min="0" max="200" data-rfield="crew" value="${r.crew ?? k.crew}" aria-label="Personas por unidad"></td>
          <td><input type="number" min="0" max="1440" step="5" data-rfield="delay" value="${r.delay || 0}" aria-label="Demora de salida (min)" title="Minutos después del inicio del operativo"></td>
          <td class="jo-eta">${u ? `${fmtDur(u.t.arrive - (o.start || 0))}<small>P90 ${fmtDur(u.arrive_p90 - (o.start || 0))}</small>` : '—'}</td>
          <td><button class="btn btn-ghost btn-icon" type="button" data-act="del-res" data-i="${i}" aria-label="Quitar recurso">✕</button></td></tr>`
      }).join('')}</tbody></table>` : '<p class="src-meta">Sin recursos: usa la <b>Plantilla</b> o agrégalos uno por uno.</p>'}
    ${o.links?.length ? `<h3 class="jo-h">Apoyos conectados</h3><ul class="jo-links">${o.links.map((l, i) =>
      `<li><span class="jo-fg" style="--c:${fColor(l.cat)}">${FAC_GLYPH[l.cat] || '•'}</span>${esc(l.name)} <small>${esc(cat.facility_labels[l.cat] || l.cat)} · ${fmt(l.km, 1)} km</small>
      <button class="btn btn-ghost btn-icon" type="button" data-act="unlink" data-i="${i}" aria-label="Desconectar">✕</button></li>`).join('')}</ul>` : ''}
  </section>`
}

function supportsHtml(st) {
  const cat = st.catalog
  const o = st.plan.operations.find((x) => x.id === st.sel)
  const cats = Object.keys(cat.facility_labels)
  return `<h3 class="jo-h">Capas de apoyo en el mapa</h3>
    <div class="jo-cats">${cats.map((c) => `<label class="jo-chk"><input type="checkbox" data-act="fac-cat" data-cat="${c}" ${st.facCats.has(c) ? 'checked' : ''}>
      <span class="jo-fg" style="--c:${fColor(c)}">${FAC_GLYPH[c]}</span>${esc(cat.facility_labels[c])} <small>${(cat.counts[c] || 0).toLocaleString('es-PE')}</small></label>`).join('')}</div>
    <p class="src-meta">${kindBadge('oficial', 'RENIPRESS')} salud · ${kindBadge('vivo_tercero', 'OpenStreetMap')} el resto (ubicación aproximada). Desde zoom 9 se muestran todas; antes, solo aeropuertos, puertos y bases.</p>
    <h3 class="jo-h">Cerca del operativo ${o ? o.n : ''}</h3>
    ${!o ? '<p class="note">Selecciona un operativo para ver sus apoyos más cercanos.</p>'
      : !st.near ? '<p class="loading">Buscando sedes cercanas</p>'
      : `<div class="jo-near">${cats.filter((c) => st.near.by_cat[c]?.length).map((c) => `<div class="jo-near-cat"><b><span class="jo-fg" style="--c:${fColor(c)}">${FAC_GLYPH[c]}</span>${esc(cat.facility_labels[c])}</b>
        ${st.near.by_cat[c].map((f) => `<div class="jo-near-row"><span>${esc(f.name)}<small>${fmt(f.km, 1)} km en línea recta${f.distrito ? ' · ' + esc(f.distrito) : ''}</small></span>
          <button class="btn btn-ghost" type="button" data-act="link" data-fid="${esc(f.id)}" data-cat="${c}" ${o.links?.some((l) => l.id === f.id) ? 'aria-pressed="true"' : ''}>Conectar</button></div>`).join('')}</div>`).join('')}</div>
        <p class="src-meta">${esc(st.near.note)}</p>`}`
}

function hypoHtml(st) {
  const h = st.plan.hypothesis
  const cat = st.catalog
  const tf = st.plan.tariff || {}
  const num = (k, v, attrs) => `<input type="number" data-hfield="${k}" value="${v ?? ''}" ${attrs}>`
  return `<h3 class="jo-h">Hipótesis del ejercicio</h3>
    <div class="jo-grid">
      <label>Hora de inicio${num('start_hour', h.start_hour ?? 10, 'min="0" max="23"')}</label>
      <label>Día<select data-hfield="day">${opt('laboral', 'Laboral', h.day)}${opt('finde', 'Fin de semana', h.day)}</select></label>
      <label>Lluvia<select data-hfield="rain">${opt('ninguna', 'Ninguna', h.rain)}${opt('moderada', 'Moderada', h.rain)}${opt('intensa', 'Intensa', h.rain)}</select></label>
      <label>Tráfico ×<input type="number" data-hfield="congestion" value="${h.congestion ?? ''}" min="0.5" max="4" step="0.1" placeholder="perfil" title="Vacío = perfil horario supuesto (o TomTom si hay clave)"></label>
      <label>Prob. de falla${num('p_fail', h.p_fail ?? 0.05, 'min="0" max="0.5" step="0.01"')}</label>
      <label>Demora por falla (min)${num('fail_delay', h.fail_delay ?? 25, 'min="0" max="240" step="5"')}</label>
      <label>Variabilidad σ${num('sigma', h.sigma ?? 0.25, 'min="0" max="0.8" step="0.05"')}</label>
      <label>Semilla${num('seed', h.seed ?? 7, 'min="0" max="999999"')}</label>
      <label class="jo-chk"><input type="checkbox" data-hfield="return" ${h.return !== false ? 'checked' : ''}> Incluir retorno a base</label>
      <label class="jo-chk"><input type="checkbox" data-hfield="routing" ${h.routing !== 'recta' ? 'checked' : ''}> Rutas por carretera (OSRM)</label>
    </div>
    <p class="src-meta">${kindBadge('estimacion', 'supuestos')} El perfil horario de tráfico, la velocidad de cada recurso y los minutos por incidencia son supuestos editables, no mediciones.</p>
    <h3 class="jo-h">Tarifario (S/) <small>${st.plan.tariff_origin === 'ejemplo' ? '<span class="jo-warn">EJEMPLO · no oficial</span>' : 'ingresado por ti'}</small></h3>
    <div class="jo-row"><button class="btn btn-ghost" type="button" data-act="tariff-example">Cargar ejemplo</button>
      <button class="btn btn-ghost" type="button" data-act="tariff-clear">Vaciar</button></div>
    <table class="jo-res jo-tariff"><thead><tr><th>Recurso</th><th>por km</th><th>por hora</th><th>pers.-hora</th><th>fijo</th></tr></thead><tbody>
      ${Object.entries(cat.kinds).map(([k, v]) => `<tr data-kind="${k}"><td><span class="jo-sig" style="--c:${kColor(k)}">${SIGLA[k]}</span> ${esc(v.label)}</td>
        ${['km', 'hora', 'persona_hora', 'fijo'].map((f) => `<td><input type="number" min="0" step="0.1" data-tfield="${f}" value="${tf[k]?.[f] ?? ''}" aria-label="${esc(v.label)} ${f}"></td>`).join('')}</tr>`).join('')}
    </tbody></table>
    <p class="src-meta">Sin tarifas no se muestran costos. El ejemplo sirve para ver el desglose: reemplázalo por los costos reales de tu institución.</p>`
}

function libHtml(st) {
  return `<h3 class="jo-h">Guardar y abrir</h3>
    <div class="jo-grid"><label>Nombre del plan<input class="jo-in" data-pfield="name" value="${esc(st.plan.name)}" maxlength="80"></label></div>
    <div class="jo-row"><button class="btn btn-primary" type="button" data-act="save">Guardar en este navegador</button>
      <button class="btn" type="button" data-act="export-json">Descargar plan (.json)</button>
      <label class="btn btn-ghost jo-file">Abrir archivo<input type="file" accept=".json,application/json" data-act="import"></label></div>
    ${st.library.length ? `<ul class="jo-lib">${st.library.map((p, i) => `<li><button type="button" class="jo-link" data-act="open" data-i="${i}">${esc(p.name)}</button>
      <small>${p.plan.operations.length} operativos · ${new Date(p.saved).toLocaleString('es-PE')}</small>
      <button class="btn btn-ghost btn-icon" type="button" data-act="lib-del" data-i="${i}" aria-label="Borrar ${esc(p.name)}">✕</button></li>`).join('')}</ul>`
      : '<p class="src-meta">Aún no hay planes guardados en este navegador.</p>'}
    <button class="btn btn-ghost" type="button" data-act="new">Plan nuevo (vacío)</button>`
}

// ── visor 1: tablero en vivo ────────────────────────────────────────────────
export function snapshot(st, t) {
  const r = st.result
  const fd = r.hypothesis.fail_delay
  const ph = { base: 0, alistamiento: 0, ruta: 0, falla: 0, sitio: 0, retorno: 0, fin: 0 }
  let personnel = 0, kmDone = 0, cost = 0, costKnown = false
  const byBudget = {}, byOp = {}
  for (const u of r.units) {
    const s = u._s = unitState(u, t, fd)
    ph[s.phase] += u.qty
    if (s.phase === 'sitio') personnel += u.qty * u.crew
    kmDone += u.qty * s.kmDone
    const c = costAt(u, s, t, st.plan.tariff?.[u.kind])
    if (c != null) { cost += c; costKnown = true; byBudget[u.budget] = (byBudget[u.budget] || 0) + c }
    const o = byOp[u.op] ??= { arrived: 0, total: 0 }
    o.total += u.qty
    if (['sitio', 'retorno', 'fin'].includes(s.phase)) o.arrived += u.qty
  }
  return { ph, personnel, kmDone, cost: costKnown ? cost : null, byBudget, byOp }
}

export function boardHtml(st, t, snap) {
  const r = st.result
  const h = r.hypothesis
  const T = r.totals
  const opsById = Object.fromEntries(st.plan.operations.map((o) => [o.id, o]))
  const k = (label, v, cls = '') => `<div class="jo-k ${cls}"><span>${label}</span><b>${v}</b></div>`
  const budgets = Object.entries(r.budgets).filter(([b]) => (T.cost_by_budget?.[b] || 0) > 0)
  return `<div class="jo-clock"><b>T+${fmtT(t)}</b><span>${clock(h.start_hour, t)} h · ${h.day === 'laboral' ? 'día laboral' : 'fin de semana'}</span>${kindBadge('estimacion', 'estimación')}</div>
    <div class="jo-kgrid">
      ${k('En base', snap.ph.base + snap.ph.fin)}${k('Alistando', snap.ph.alistamiento)}${k('En ruta', snap.ph.ruta, 'is-route')}
      ${k('Fallas', snap.ph.falla, snap.ph.falla ? 'is-warn' : '')}${k('En sitio', snap.ph.sitio, 'is-site')}${k('Retornando', snap.ph.retorno)}
      ${k('Personal en sitio', snap.personnel.toLocaleString('es-PE'))}${k('Km recorridos', fmt(snap.kmDone, 1))}
      ${k('Costo acumulado', snap.cost == null ? '<small>define tarifas</small>' : soles(snap.cost), 'is-cost')}
    </div>
    <table class="jo-optable"><thead><tr><th>#</th><th>Operativo</th><th>Llegadas</th><th>1.ª</th><th>Todas · P90</th></tr></thead><tbody>
      ${r.operations.map((o) => {
        const p = opsById[o.id]
        const b = snap.byOp[o.id] || { arrived: 0, total: 0 }
        const pct = b.total ? (b.arrived / b.total) * 100 : 0
        return `<tr data-act="sel-op" data-id="${o.id}"><td><span class="jo-num sm" style="--c:${opColor(p?.n || 1)}">${p?.n || '?'}</span></td>
          <td>${esc(p?.name || o.id)}<div class="jo-prog"><i style="width:${pct.toFixed(1)}%"></i></div></td>
          <td>${b.arrived}/${b.total}</td><td>${o.first_arrival != null ? fmtDur(o.first_arrival - o.start) : '—'}</td>
          <td>${o.all_arrived != null ? `${fmtDur(o.all_arrived - o.start)}<small>${fmtDur(o.all_arrived_p90 - o.start)}</small>` : '—'}</td></tr>`
      }).join('')}</tbody></table>
    ${T.cost != null ? `<h3 class="jo-h">Costo por institución <small>${T.tariff_origin === 'ejemplo' ? '<span class="jo-warn">tarifas de EJEMPLO</span>' : 'tus tarifas'}</small></h3>
      <div class="jo-budget">${budgets.map(([b, label]) => {
        const tot = T.cost_by_budget[b]
        const acc = snap.byBudget[b] || 0
        return `<div class="jo-brow"><span>${esc(label)}</span><div class="jo-prog"><i style="width:${(tot ? acc / tot * 100 : 0).toFixed(1)}%"></i></div><b>${soles(acc)}<small>de ${soles(tot)}</small></b></div>`
      }).join('')}</div>
      <div class="jo-types">${[['personal', 'Personal (operativo)'], ['vehiculo', 'Vehículos (logístico)'], ['fijo', 'Despliegue (fijo)']].map(([x, l]) =>
        `<span>${l}<b>${soles(T.cost_by_type[x])}</b></span>`).join('')}<span>Total estimado<b>${soles(T.cost)}</b></span></div>`
      : `<p class="note">Para ver costos (operativo, logístico, fiscal, Fuerzas Armadas, externos) completa el tarifario en <b>Hipótesis y costos</b>.</p>`}
    <p class="src-meta">${T.units} unidades · ${T.personnel.toLocaleString('es-PE')} personas · ${fmt(T.km, 1)} km · fin T+${fmtT(T.end)} (${fmtDur(T.end)}).</p>`
}

// ── visor 2: cronograma y bitácora ──────────────────────────────────────────
export function ganttHtml(st, width = 640) {
  const r = st.result
  const end = Math.max(30, r.totals.end)
  const W = Math.max(280, Math.round(width)), rowH = 14, top = 18
  const opsById = Object.fromEntries(st.plan.operations.map((o) => [o.id, o]))
  const x = (m) => (m / end) * W
  let y = top
  const rows = []
  for (const o of r.operations) {
    const p = opsById[o.id]
    rows.push(`<text x="2" y="${y + 10}" class="jo-g-op" style="fill:${opColor(p?.n || 1)}">${p?.n || '?'} · ${esc((p?.name || '').slice(0, 40))}</text>`)
    y += rowH
    for (const u of r.units.filter((v) => v.op === o.id)) {
      const T = u.t, c = kColor(u.kind)
      rows.push(`<g class="jo-g-row"><title>${esc(u.label)} ×${u.qty} — sale T+${fmtT(T.depart)}, llega T+${fmtT(T.arrive)} (P90 T+${fmtT(u.arrive_p90)}), vuelve T+${fmtT(T.back)}</title>
        <rect x="${x(T.depart)}" y="${y + 3}" width="${Math.max(1, x(T.ready) - x(T.depart))}" height="8" class="jo-g-prep"/>
        <rect x="${x(T.ready)}" y="${y + 3}" width="${Math.max(1, x(T.arrive) - x(T.ready))}" height="8" style="fill:${c}"/>
        <rect x="${x(T.arrive)}" y="${y + 1}" width="${Math.max(1, x(T.leave) - x(T.arrive))}" height="12" style="fill:${c}" class="jo-g-site"/>
        ${T.back > T.leave ? `<rect x="${x(T.leave)}" y="${y + 3}" width="${Math.max(1, x(T.back) - x(T.leave))}" height="8" style="fill:${c}" opacity=".45"/>` : ''}
        ${u.failed ? `<rect x="${x(T.ready + u.travel_min / 2)}" y="${y + 1}" width="${Math.max(2, x(r.hypothesis.fail_delay))}" height="12" class="jo-g-fail"/>` : ''}
        <line x1="${x(u.arrive_p90)}" x2="${x(u.arrive_p90)}" y1="${y + 1}" y2="${y + 13}" class="jo-g-p90"/>
        <text x="${Math.min(W - 60, x(T.back) + 4)}" y="${y + 10}" class="jo-g-lbl">${SIGLA[u.kind]}×${u.qty}</text></g>`)
      y += rowH
    }
  }
  const ticks = []
  const step = end > 600 ? 120 : end > 240 ? 60 : end > 90 ? 30 : 10
  for (let m = 0; m <= end; m += step) ticks.push(`<line x1="${x(m)}" x2="${x(m)}" y1="12" y2="${y}" class="jo-g-tick"/><text x="${x(m) + 2}" y="10" class="jo-g-lbl">${fmtT(m)}</text>`)
  return `<svg class="jo-gantt" width="${W}" height="${y + 4}" viewBox="0 0 ${W} ${y + 4}" data-act="seek-gantt" data-end="${end}" role="img"
    aria-label="Cronograma de cada recurso: alistamiento, traslado, en sitio y retorno">
    ${ticks.join('')}${rows.join('')}<line id="jo-playhead" x1="0" x2="0" y1="12" y2="${y}" class="jo-g-head"/></svg>
    <div class="jo-g-key"><span><i class="jo-g-prep"></i>alistamiento</span><span><i style="background:var(--ink-soft)"></i>traslado</span><span><i class="jo-g-site"></i>en sitio</span>
      <span><i style="opacity:.45;background:var(--ink-soft)"></i>retorno</span><span><i class="jo-g-fail"></i>falla</span><span><i class="jo-g-p90"></i>llegada P90</span></div>`
}

export function logHtml(st, t) {
  const r = st.result
  const opsById = Object.fromEntries(st.plan.operations.map((o) => [o.id, o]))
  const ev = r.events.filter((e) => e.t <= t).slice(-60).reverse()
  return ev.length ? `<ol class="jo-log">${ev.map((e) => `<li class="is-${e.type}"><time>T+${fmtT(e.t)}</time>
    <span class="jo-num sm" style="--c:${opColor(opsById[e.op]?.n || 1)}">${opsById[e.op]?.n || '?'}</span>${esc(e.text)}</li>`).join('')}</ol>`
    : '<p class="src-meta">La bitácora se llena al reproducir.</p>'
}

export const phaseLabel = (p) => PHASE[p] || p

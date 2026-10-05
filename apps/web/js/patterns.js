// Patrones: Hotspots · Secuencias · Correlaciones · Cambios · Anomalías · Proyecciones. Todo calculado y explicable.
import { esc, fmt, fmtPct, getJSON, kindBadge, postJSON, state } from './util.js'

const body = () => document.getElementById('panel-body')
const TABS = [['hotspots', 'Hotspots'], ['sequences', 'Secuencias'], ['leadlag', 'Correlaciones'], ['changes', 'Cambios'], ['anomalies', 'Anomalías'], ['forecast', 'Proyección']]
let tab = 'hotspots'
let ctx = { scope: null, nombre: 'Perú', onPaint: null, onSelect: null }

export function setPatternScope(scope, nombre) {
  ctx.scope = scope
  ctx.nombre = nombre || 'Perú'
}

function q(extra = {}) {
  const p = new URLSearchParams()
  if (ctx.scope) p.set('scope', ctx.scope)
  if (state.modalidad) p.set('modalidad', state.modalidad)
  for (const [k, v] of Object.entries(extra)) p.set(k, v)
  return p.toString()
}

function sparkline(series, changes = []) {
  const W = 340, H = 110
  const v = series.map((s) => s.v)
  const max = Math.max(...v, 1)
  const x = (i) => (i / (v.length - 1)) * (W - 4) + 2
  const y = (val) => 6 + (1 - val / max) * (H - 24)
  const line = v.map((val, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`).join('')
  const marks = changes.map((c) => {
    const i = series.findIndex((s) => s.p === c.at)
    return i >= 0 ? `<line class="sel-edge" x1="${x(i)}" x2="${x(i)}" y1="4" y2="${H - 18}" stroke="var(--hot)" stroke-width="2" stroke-dasharray="3 3"/><text x="${x(i) + 3}" y="14">${esc(c.at)}</text>` : ''
  }).join('')
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Serie mensual con cambios estructurales"><path class="hist" d="${line}"/>${marks}
    <text x="2" y="${H - 4}">${esc(series[0].p)}</text><text x="${W - 2}" y="${H - 4}" text-anchor="end">${esc(series.at(-1).p)}</text></svg>`
}

function explainBox(facts, topic) {
  return `<section class="ai-box"><div class="ai-head"><strong>Explicar para decidir</strong>${kindBadge('ia')}</div>
    <div class="ai-actions"><button class="btn btn-primary" type="button" id="pt-ai" data-topic="${esc(topic)}">Explicar con IA</button>
    <span class="src-meta">Usa solo los números de arriba; cada cifra se verifica.</span></div><div class="ai-out" id="pt-out"></div></section>`
}

async function renderTab() {
  const out = document.getElementById('pt-body')
  out.innerHTML = '<p class="loading">Calculando</p>'
  let html = '', facts = []
  try {
    if (tab === 'hotspots') {
      const d = await getJSON(`/api/v1/intel/patterns/hotspots?${q()}`)
      ctx.onPaint?.(d)
      const top = d.rows.filter((r) => r.z >= 1.96).slice(0, 12)
      html = `<p class="src-meta">${esc(d.method)}</p><div class="triad">
        ${['nuevo', 'persistente', 'intensificado'].map((k) => `<div><div class="label">${k}</div><div class="value">${d.counts[k]}</div><div class="unit">distritos foco</div></div>`).join('')}</div>
        <p class="src-meta">${d.counts['se disipa']} distritos dejaron de ser foco desde ${d.compare_year}. El mapa muestra el z de Gi* (rojo = foco, azul = frío).</p>
        ${top.map((r) => `<button type="button" class="peer" data-ub="${esc(r.ubigeo)}"><span class="num">${fmt(r.z, 1)}</span><span>${esc(r.nombre || r.ubigeo)} <small>${esc(r.trend || '')}</small></span><span class="num">${esc(r.band)}</span></button>`).join('')}`
      facts = [{ label: 'Distritos foco nuevos', value: d.counts.nuevo, unit: 'distritos', period: String(d.year) },
        { label: 'Distritos foco persistentes', value: d.counts.persistente, unit: 'distritos', period: `${d.compare_year}–${d.year}` },
        { label: 'Distritos foco intensificados', value: d.counts.intensificado, unit: 'distritos', period: String(d.year) },
        { label: 'Distritos que dejaron de ser foco', value: d.counts['se disipa'], unit: 'distritos', period: String(d.year) }]
    } else if (tab === 'sequences') {
      const d = await getJSON(`/api/v1/intel/patterns/sequences?${q()}`)
      html = `<p class="src-meta">${esc(d.method)}</p>${d.pairs.length ? `<table class="why-table"><thead><tr><th>A → B (≤ ${d.window_days} días)</th><th>veces</th><th>esperado</th><th>lift</th><th>distritos</th></tr></thead>
        <tbody>${d.pairs.map((p) => `<tr><td>${esc(p.a.toLowerCase())} → ${esc(p.b.toLowerCase())}</td><td>${p.observed}</td><td>${fmt(p.expected, 1)}</td><td><b>${fmt(p.lift, 1)}×</b></td><td>${p.districts}</td></tr>`).join('')}</tbody></table>`
        : '<p class="empty">Sin secuencias repetidas suficientes en este ámbito.</p>'}`
      facts = d.pairs.slice(0, 5).map((p) => ({ label: `Veces que ${p.a.toLowerCase()} fue seguido de ${p.b.toLowerCase()}`, value: p.observed, unit: 'veces', period: `≤ ${d.window_days} días` }))
        .concat(d.pairs.slice(0, 5).map((p) => ({ label: `Lift de ${p.a.toLowerCase()} → ${p.b.toLowerCase()}`, value: p.lift, unit: 'veces lo esperado', period: '' })))
    } else if (tab === 'leadlag') {
      const d = await getJSON(`/api/v1/intel/patterns/leadlag?${q()}`)
      html = d.available ? `<p class="callout" style="border-left-color:var(--kind-calculado)">${esc(d.text)}</p>
        <div class="bars">${d.lags.map((l, i) => `<div class="bar-row"><span>desfase ${l.lag > 0 ? '+' : ''}${l.lag} m</span><span class="val">${fmt(l.r, 2)}${l.significant ? ' *' : ''}</span>
          <div class="track"><div class="fill ${l.r < 0 ? '' : 'calc'}" style="--i:${i};width:${Math.abs(l.r) * 100}%"></div></div></div>`).join('')}</div>
        <p class="src-meta">${esc(d.method)} Series: emergencias INDECI vs. denuncias SIDPOL (${esc(d.b)}).</p>` : `<p class="empty">${esc(d.reason)}</p>`
      if (d.best) facts = [{ label: 'Correlación más fuerte entre emergencias y denuncias', value: d.best.r, unit: 'r', period: `desfase ${d.best.lag} meses` }, { label: 'Meses comparados', value: d.best.n, unit: 'meses', period: '' }]
    } else if (tab === 'changes') {
      const d = await getJSON(`/api/v1/intel/patterns/changes?${q()}`)
      html = d.available ? `${sparkline(d.series, d.changes)}${d.changes.length ? `<dl class="kv">${d.changes.map((c) => `<dt>Cambio estructural en ${esc(c.at)}</dt><dd>${fmt(c.before, 0)} → ${fmt(c.after, 0)} / mes · ${fmtPct(c.change_pct)}</dd>`).join('')}</dl>`
        : '<p class="empty">Sin cambios estructurales significativos.</p>'}<p class="src-meta">${esc(d.method)}</p>` : `<p class="empty">${esc(d.reason)}</p>`
      facts = (d.changes || []).map((c) => ({ label: `Promedio mensual después del cambio de ${c.at}`, value: c.after, unit: 'denuncias/mes', period: c.at }))
        .concat((d.changes || []).map((c) => ({ label: `Variación del nivel en ${c.at}`, value: c.change_pct, unit: '%', period: c.at })))
    } else if (tab === 'anomalies') {
      const d = await getJSON(`/api/v1/intel/patterns/anomalies?${q({ level: 'distrito' })}`)
      html = `<p class="src-meta">${esc(d.method)} Mes: ${esc(d.period)}.</p>${d.rows.map((r) => `<button type="button" class="peer" data-ub="${esc(r.ubigeo)}"><span class="num">${r.z > 0 ? '▲' : '▼'}</span>
        <span>${esc(r.nombre)} <small>${r.value} vs ${fmt(r.expected, 0)} esperado</small></span><span class="num">z ${fmt(r.z, 1)}</span></button>`).join('') || '<p class="empty">Sin anomalías.</p>'}`
      facts = d.rows.slice(0, 6).map((r) => ({ label: `Anomalía z en ${r.nombre}`, value: r.z, unit: 'z', period: d.period }))
    } else if (tab === 'forecast') {
      const d = await getJSON(`/api/v1/intel/patterns/forecast?${q()}`)
      html = d.available ? `<table class="why-table"><thead><tr><th>Modelo</th><th>MAE</th><th>MAPE</th></tr></thead><tbody>${d.scores.map((s) => `<tr${s.model === d.best ? ' style="color:var(--accent)"' : ''}><td>${esc(s.model)}${s.model === d.best ? ' ✓' : ''}</td><td>${s.mae == null ? esc(s.error) : fmt(s.mae, 1)}</td><td>${s.mape_pct == null ? '—' : fmt(s.mape_pct, 1) + ' %'}</td></tr>`).join('')}</tbody></table>
        <dl class="kv section-gap">${d.forecast.map((f) => `<dt>${esc(f.period)}</dt><dd>${fmt(f.point, 0)} <small>(95 %: ${fmt(f.lo95, 0)}–${fmt(f.hi95, 0)})</small></dd>`).join('')}</dl>
        <p class="src-meta">${esc(d.method)}</p>` : `<p class="empty">${esc(d.reason)}</p>`
      if (d.available) facts = d.forecast.slice(0, 3).map((f) => ({ label: `Proyección ${f.period} (${d.best})`, value: f.point, unit: 'denuncias', period: f.period }))
        .concat([{ label: `Error medio del mejor modelo (${d.best})`, value: d.scores[0].mae, unit: 'denuncias/mes', period: 'backtesting' }])
    }
  } catch (e) {
    html = `<p class="note">${esc(e.message)}</p>`
  }
  out.innerHTML = html + (facts.length ? explainBox(facts, `${TABS.find((t) => t[0] === tab)[1]} · ${ctx.nombre} · ${state.modalidad || 'todas las modalidades'}`) : '')
  out.querySelectorAll('.peer[data-ub]').forEach((b) => b.addEventListener('click', () => ctx.onSelect?.(b.dataset.ub)))
  document.getElementById('pt-ai')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const o = document.getElementById('pt-out')
    btn.setAttribute('aria-busy', 'true')
    try {
      const r = await postJSON('/api/v1/intel/ai/explain', { topic: btn.dataset.topic, facts })
      const v = r.verification
      o.innerHTML = `<div class="ai-head"><span>${kindBadge(r.answer.kind === 'ia' ? 'ia' : 'calculado', r.answer.engine)}</span><span class="verdict" data-v="${esc(v.status)}">${esc(v.status)}</span></div>
        ${v.sentences.map((s) => `<p class="ai-sentence" data-status="${esc(s.status)}">${esc(s.sentence)}${s.problems.length ? `<span class="flag">NO VERIFICADO: ${esc(s.problems.join('; '))}</span>` : ''}</p>`).join('')}`
    } catch (err) {
      o.innerHTML = `<p class="note">${esc(err.message)}</p>`
    } finally {
      btn.removeAttribute('aria-busy')
    }
  })
}

export function renderPatterns({ onPaint, onSelect } = {}) {
  ctx.onPaint = onPaint
  ctx.onSelect = onSelect
  body().innerHTML = `<div class="panel-head"><div class="eyebrow">Patrones · ${esc(ctx.scope ? 'UBIGEO ' + ctx.scope : 'nacional')}</div>
    <h2>${esc(ctx.nombre)}</h2><p class="sub">${esc(state.modalidad || 'Todas las modalidades')} · cálculo, no causalidad. Selecciona un territorio en el mapa para acotar.</p></div>
    <div class="chips" role="tablist" aria-label="Vistas de patrones">${TABS.map(([k, l]) => `<button type="button" class="chip" role="tab" data-tab="${k}" aria-pressed="${k === tab}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    ${ctx.scope ? '<button type="button" class="btn btn-ghost" id="pt-national">Ver nivel nacional</button>' : ''}
    <div id="pt-body"></div>`
  body().querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab
    body().querySelectorAll('[data-tab]').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-selected', String(x === b)) })
    renderTab()
  }))
  document.getElementById('pt-national')?.addEventListener('click', () => {
    setPatternScope(null, 'Perú')
    renderPatterns({ onPaint, onSelect })
  })
  renderTab()
}

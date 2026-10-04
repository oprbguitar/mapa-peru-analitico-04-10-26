// Ficha lateral: el territorio seleccionado, su explicación y su procedencia.
import { esc, fmt, fmtPct, getJSON, kindBadge, postJSON, sign, state } from './util.js'

const body = () => document.getElementById('panel-body')
const LEVEL = { departamento: 'Departamento', provincia: 'Provincia', distrito: 'Distrito' }
let tip

function triad(items) {
  return `<div class="triad">${items.map((t) => `<div>
    <div class="label">${esc(t.label)}</div>
    <div class="value ${t.delta ? 'delta' : ''}" ${t.delta ? `data-sign="${sign(t.raw)}"` : ''}>${t.value}</div>
    <div class="unit">${esc(t.unit)}</div>${kindBadge(t.kind)}</div>`).join('')}</div>`
}

function sources(prov) {
  if (!prov?.length) return ''
  return `<section class="section"><h3>Fuentes de esta ficha</h3><div class="sources-list">${prov.map((p) => `<div class="src">
    <div>${kindBadge(p.kind, p.institution)}</div>
    <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>
    <div class="src-meta">Nivel: ${esc(p.geographic_level || '—')} · Cobertura: ${esc(p.coverage_start || '—')} → ${esc(p.coverage_end || '—')}
      · Descargado: ${esc((p.downloaded || '—').slice(0, 10))}${p.checksum ? ` · SHA-256 ${esc(p.checksum.slice(0, 12))}…` : ''}</div>
    ${p.transform ? `<div class="src-meta">Transformación: ${esc(p.transform)}</div>` : ''}</div>`).join('')}</div></section>`
}

export function renderOverview(c) {
  if (!c) return
  if (!c.available) {
    body().innerHTML = `<div class="panel-head"><div class="eyebrow">Perú</div><h2>Sin datos</h2><p class="sub">${esc(c.reason || '')}</p></div>`
    return
  }
  const rows = c.rows.filter((r) => r[state.measure] != null)
  const sorted = [...rows].sort((a, b) => b[state.measure] - a[state.measure])
  const top = sorted.slice(0, 8)
  const max = Math.max(...top.map((r) => Math.abs(r[state.measure])), 1)
  const meta = c.measures[state.measure]
  body().innerHTML = `
    <div class="panel-head panel-head--overview"><div class="eyebrow">Perú · ${esc(LEVEL[c.level] || c.level)}</div><h2>${esc(c.title)}</h2>
      <p class="sub">${esc(c.period?.label || '')}${c.comparison ? ` · comparado con ${esc(c.comparison.label)}` : ''}</p></div>
    ${c.total != null ? triad([
      { label: 'Total nacional', value: fmt(c.total, 0), unit: 'denuncias', kind: 'oficial' },
      { label: 'Territorios con dato', value: fmt(rows.length, 0), unit: LEVEL[c.level]?.toLowerCase() + 's', kind: 'calculado' },
      { label: 'Cambio nacional', value: fmtPct(c.prev_total ? ((c.total - c.prev_total) / c.prev_total) * 100 : null), unit: c.comparison ? `vs ${c.comparison.label}` : '', kind: 'calculado', delta: true, raw: c.prev_total ? c.total - c.prev_total : 0 },
    ]) : ''}
    ${c.disclaimer ? `<p class="note">${esc(c.disclaimer)}</p>` : ''}
    ${c.granularity_note ? `<p class="note">${esc(c.granularity_note)}</p>` : ''}
    ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    <section class="section"><h3><span>Mayor ${esc(meta.label.toLowerCase())}</span>${kindBadge(meta.kind)}</h3>
      <div class="bars">${top.map((r, i) => `<div class="bar-row"><span>${esc(r.nombre)}</span><span class="val">${state.measure === 'change_pct' ? fmtPct(r[state.measure]) : fmt(r[state.measure])}</span>
        <div class="track"><div class="fill ${meta.kind === 'calculado' ? 'calc' : ''}" style="--i:${i};width:${(Math.abs(r[state.measure]) / max) * 100}%"></div></div></div>`).join('')}</div>
      <p class="src-meta">Unidad: ${esc(meta.unit)}. Haz clic en un territorio del mapa para ver su ficha.</p></section>
    ${c.method ? `<section class="section"><h3>Cómo se calcula</h3><p class="src-meta">${esc(c.method)}</p></section>` : ''}
    ${sources(c.provenance)}`
}

function spark(fc) {
  if (!fc?.available) return ''
  const hist = fc.history.slice(-36)
  const all = [...hist.map((h) => h.value), ...fc.forecast.map((f) => f.hi95)]
  const W = 340
  const H = 120
  const max = Math.max(...all) * 1.05
  const n = hist.length + fc.forecast.length
  const x = (i) => (i / (n - 1)) * (W - 8) + 4
  const y = (v) => 6 + (1 - v / max) * (H - 24)
  const hl = hist.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.value).toFixed(1)}`).join('')
  const off = hist.length - 1
  const fl = [`M${x(off).toFixed(1)},${y(hist[off].value).toFixed(1)}`, ...fc.forecast.map((f, i) => `L${x(off + 1 + i).toFixed(1)},${y(f.point).toFixed(1)}`)].join('')
  const band = [...fc.forecast.map((f, i) => `${i ? 'L' : 'M'}${x(off + 1 + i).toFixed(1)},${y(f.hi95).toFixed(1)}`),
    ...fc.forecast.slice().reverse().map((f, i) => `L${x(off + fc.forecast.length - i).toFixed(1)},${y(f.lo95).toFixed(1)}`)].join('') + 'Z'
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Serie mensual de denuncias y proyección" data-n="${n}">
    <line class="axis" x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}"/>
    <path class="band" d="${band}"/><path class="hist" d="${hl}"/><path class="fc" d="${fl}"/>
    <text x="4" y="${H - 4}">${esc(hist[0].period)}</text><text x="${W - 4}" y="${H - 4}" text-anchor="end">${esc(fc.forecast.at(-1).period)}</text></svg>`
}

function indexBlock(ix) {
  if (!ix || ix.score == null) return ''
  const comps = ix.components
  return `<section class="section"><h3><span>${esc(ix.name)}</span>${kindBadge('calculado', 'no oficial')}</h3>
    ${triad([
      { label: 'Puntaje', value: fmt(ix.score, 1), unit: '0–100', kind: 'calculado' },
      { label: 'Posición', value: `${ix.rank ?? '—'}`, unit: 'de 25', kind: 'calculado' },
      { label: 'Cobertura', value: `${Math.round(ix.coverage * 100)} %`, unit: 'del peso', kind: 'calculado' },
    ])}
    <div class="bars section-gap">${comps.map((c, i) => `<div class="bar-row"><span>${esc(c.label)}</span><span class="val">${fmt(c.share_pct, 1)} %</span>
      <div class="track"><div class="fill calc" style="--i:${i};width:${c.share_pct}%"></div></div></div>`).join('')}</div>
    <details class="why"><summary>¿Por qué tiene este valor?</summary><div class="why-body">
      <p>Cada variable se normaliza entre el departamento con el valor más bajo (0) y el más alto (100). El puntaje es la suma ponderada;
      la columna «aporte» es la parte del puntaje que explica cada variable.</p>
      <table class="why-table"><thead><tr><th>Variable</th><th>Valor</th><th>Norm.</th><th>Peso</th><th>Aporte</th></tr></thead>
      <tbody>${comps.map((c) => `<tr><td>${esc(c.label)}<br><small>${esc(c.period)}</small></td><td>${fmt(c.raw)}</td><td>${fmt(c.normalized, 1)}</td><td>${fmt(c.effective_weight * 100, 0)} %</td><td>${fmt(c.points, 1)}</td></tr>`).join('')}</tbody></table>
      ${ix.missing?.length ? `<p class="note">Sin dato: ${esc(ix.missing.join(', '))} (pesos reponderados).</p>` : ''}
      <p>${esc(ix.disclaimer)}</p><p class="src-meta">Metodología: ${esc(ix.spec_path)} · SHA-256 ${esc(ix.spec_sha256.slice(0, 16))}…</p></div></details></section>`
}

function aiBlock(ub) {
  return `<section class="ai-box" aria-label="Análisis con IA"><div class="ai-head"><strong>Análisis territorial</strong>${kindBadge('ia')}</div>
    <label class="sr-only" for="ai-q">Pregunta para el análisis</label>
    <textarea id="ai-q" placeholder="Pregunta opcional (p. ej. ¿qué modalidades explican el cambio?)"></textarea>
    <div class="ai-actions"><button class="btn btn-primary" type="button" id="ai-run" data-ub="${esc(ub)}">Analizar con IA</button>
      <span class="src-meta">Local por defecto (Ollama). Cada cifra se verifica contra los datos.</span></div>
    <div class="ai-out" id="ai-out" aria-live="polite"></div></section>`
}

export async function renderRegion(ub, period = {}) {
  body().innerHTML = '<p class="loading">Cargando ficha</p>'
  const q = new URLSearchParams(Object.entries(period).filter(([, v]) => v != null))
  const [p, fc] = await Promise.all([
    getJSON(`/api/v1/intel/regions/${ub}/crime?${q}`),
    getJSON(`/api/v1/intel/regions/${ub}/forecast`).catch(() => null),
  ])
  const s = p.sidpol
  const where = p.level === 'departamento' ? 'Perú' : `${p.departamento}`
  body().innerHTML = `<div class="stagger">
    <div class="panel-head" style="--i:0"><div class="eyebrow">${esc(LEVEL[p.level])} · ${esc(where)} · UBIGEO ${esc(p.ubigeo)}</div>
      <h2>${esc(p.nombre)}</h2><p class="sub">Denuncias policiales · ${esc(s.period)} frente a ${esc(s.comparison)}</p></div>
    <div style="--i:1">${triad([
      { label: 'Absoluto', value: fmt(s.total, 0), unit: 'denuncias', kind: 'oficial' },
      { label: 'Tasa', value: fmt(s.rate, 1), unit: 'por 100 mil hab.', kind: 'calculado' },
      { label: 'Cambio', value: fmtPct(s.change_pct), unit: `vs ${s.comparison}`, kind: 'calculado', delta: true, raw: s.change_pct },
    ])}
    <p class="src-meta">Población proyectada ${fmt(s.population, 0)} hab. ${kindBadge('estimacion', 'INEI vía MININTER')} · Año en curso (${esc(s.ytd.label)}): ${fmt(s.ytd.count, 0)} denuncias, ${fmtPct(s.ytd.change_pct)} vs ${esc(s.ytd.prev_label)}</p></div>
    <section class="section" style="--i:2"><h3><span>Por modalidad · ${esc(s.period)}</span>${kindBadge('oficial')}</h3>
      <div class="bars">${s.by_modality.map((m, i) => `<div class="bar-row"><span>${esc(m.modalidad)}</span><span class="val">${fmt(m.count, 0)} · ${fmtPct(m.change_pct)}</span>
        <div class="track"><div class="fill" style="--i:${i};width:${m.share_pct || 0}%"></div></div></div>`).join('')}</div>
      <p class="src-meta">SIDPOL solo publica estas modalidades; «Otros» agrupa el resto.</p></section>
    <div style="--i:3">${indexBlock(p.index)}</div>
    ${fc?.available ? `<section class="section" style="--i:4"><h3><span>Serie mensual y proyección 6 meses</span>${kindBadge('proyeccion')}</h3>${spark(fc)}
      <dl class="kv">${fc.forecast.slice(0, 3).map((f) => `<dt>${esc(f.period)}</dt><dd>${fmt(f.point, 0)} <small>(95 %: ${fmt(f.lo95, 0)}–${fmt(f.hi95, 0)})</small></dd>`).join('')}
      <dt>Último mes (${esc(fc.anomaly.period)})</dt><dd>${fc.anomaly.flag ? '⚠ inusual' : 'dentro de lo habitual'} · z ${fmt(fc.anomaly.z)}</dd></dl>
      <p class="src-meta">Método: ${esc(fc.method)}. ${esc(fc.caveat)}</p></section>` : ''}
    ${p.indicators.length ? `<section class="section" style="--i:5"><h3><span>Indicadores MININTER</span>${kindBadge('oficial')}</h3><dl class="kv">${p.indicators
      .map((i) => `<dt>${esc(i.label.split(' (')[0])} <small>(${i.year}${i.kind === 'calculado' ? ', LM+RL' : ''})</small></dt><dd>${fmt(i.value)} <small>${esc(i.unit)}</small></dd>`).join('')}</dl></section>` : ''}
    ${p.trends?.length ? `<section class="section"><h3>Tendencias oficiales</h3><dl class="kv">${p.trends.slice(0, 8).map((t) => `<dt>${esc((t.label || `Indicador ${t.code}`).split(' (')[0])}</dt><dd>${esc(t.tendencia)}</dd>`).join('')}</dl></section>` : ''}
    ${p.mpfn ? `<section class="section"><h3><span>Fiscalía (MPFN) · ${p.mpfn.year}</span>${kindBadge('oficial')}</h3><dl class="kv">
      <dt>Delitos denunciados (sede fiscal)</dt><dd>${fmt(p.mpfn.count, 0)}</dd><dt>Tasa</dt><dd>${fmt(p.mpfn.rate, 1)} <small>por 100 mil</small></dd>
      <dt>Cambio</dt><dd>${fmtPct(p.mpfn.change_pct)}</dd></dl><p class="src-meta">Agregado por la sede del distrito fiscal, no por el lugar del hecho.</p></section>` : ''}
    ${p.devida?.length ? `<section class="section"><h3><span>Drogas / TID (DEVIDA)</span>${kindBadge('oficial')}</h3><dl class="kv">${p.devida
      .map((d) => `<dt>${esc(d.etiqueta)} <small>(${d.anio})</small></dt><dd>${fmt(d.valor)} <small>${esc(d.unidad)}</small></dd>`).join('')}</dl>
      <p class="src-meta">Capa separada de la criminalidad general; compararlas no implica causalidad.</p></section>` : ''}
    ${aiBlock(p.ubigeo)}
    ${sources(p.provenance)}</div>`
  bindAI()
  bindSpark(fc)
  return p
}

function bindSpark(fc) {
  const svg = body().querySelector('.spark')
  if (!svg || !fc) return
  tip ??= document.querySelector('.chart-tip')
  const pts = [...fc.history.slice(-36).map((h) => ({ p: h.period, v: h.value, k: 'oficial' })), ...fc.forecast.map((f) => ({ p: f.period, v: f.point, k: 'proyección', lo: f.lo95, hi: f.hi95 }))]
  svg.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect()
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - r.left) / r.width) * (pts.length - 1))))
    const d = pts[i]
    tip.hidden = false
    tip.textContent = `${d.p} · ${fmt(d.v, 0)}${d.lo != null ? ` (95 %: ${fmt(d.lo, 0)}–${fmt(d.hi, 0)})` : ''} · ${d.k}`
    tip.style.left = `${e.clientX + 12}px`
    tip.style.top = `${e.clientY - 28}px`
  })
  svg.addEventListener('mouseleave', () => (tip.hidden = true))
}

function bindAI() {
  const btn = document.getElementById('ai-run')
  if (!btn) return
  btn.addEventListener('click', async () => {
    const out = document.getElementById('ai-out')
    btn.setAttribute('aria-busy', 'true')
    btn.disabled = true
    out.innerHTML = '<p class="loading">DataAgent reúne los datos; GeoAnalyst redacta; Verifier revisa cada cifra</p>'
    try {
      const r = await postJSON('/api/v1/intel/ai/ask', { ubigeo: btn.dataset.ub, question: document.getElementById('ai-q').value })
      if (r.refused) {
        out.innerHTML = `<p class="note">${esc(r.text)}</p>`
        return
      }
      const v = r.verification
      out.innerHTML = `<div class="ai-head"><span>${kindBadge(r.answer.kind === 'ia' ? 'ia' : 'calculado', r.answer.engine)}</span>
          <span class="verdict" data-v="${esc(v.status)}">${esc(v.status)} · ${v.total - v.unverified}/${v.total}</span></div>
        ${v.sentences.map((s) => `<p class="ai-sentence" data-status="${esc(s.status)}">${esc(s.sentence)}${s.problems.length ? `<span class="flag">NO VERIFICADO: ${esc(s.problems.join('; '))}</span>` : ''}</p>`).join('')}
        <details class="why"><summary>Hechos usados (${r.facts.length})</summary><div class="why-body"><dl class="kv">${r.facts
          .map((f) => `<dt>[${esc(f.id)}] ${esc(f.label)} <small>${esc(f.period)}</small></dt><dd>${fmt(f.value)} <small>${esc(f.unit)}</small></dd>`).join('')}</dl></div></details>
        <p class="src-meta">Ruta: ${esc(r.answer.route_reason)}. La IA explica y compara; no calcula el índice ni las cifras.</p>`
    } catch (e) {
      out.innerHTML = `<p class="note">No se pudo completar el análisis: ${esc(e.message)}</p>`
    } finally {
      btn.removeAttribute('aria-busy')
      btn.disabled = false
    }
  })
}

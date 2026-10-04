// Espina temporal: el tiempo es una dimensión del mapa. Serie nacional mensual (SIDPOL) + ventanas.
import { esc, fmt, getJSON, state } from './util.js'

export const PRESETS = [
  { id: 'ahora', label: 'AHORA' },
  { id: '24h', label: '24 H' },
  { id: '7d', label: '7 D' },
  { id: '30d', label: '30 D' },
  { id: '1a', label: '1 AÑO' },
  { id: '5a', label: '5 AÑOS' },
]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
let series = []
let onPick = () => {}
let tip

export async function initTimeline({ onPreset, onYear }) {
  onPick = onYear
  const box = document.getElementById('presets')
  box.innerHTML = PRESETS.map((p) => `<button type="button" role="radio" data-p="${p.id}" aria-checked="${state.preset === p.id}">${p.label}</button>`).join('')
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (b) onPreset(b.dataset.p)
  })
  box.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const i = PRESETS.findIndex((p) => p.id === state.preset)
    const n = PRESETS[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + PRESETS.length) % PRESETS.length]
    onPreset(n.id)
    box.querySelector(`[data-p="${n.id}"]`)?.focus()
    e.preventDefault()
  })
  tip = document.createElement('div')
  tip.className = 'chart-tip'
  tip.hidden = true
  document.body.append(tip)
  try {
    series = (await getJSON('/api/v1/intel/history')).series
  } catch {
    series = []
  }
  new ResizeObserver(() => draw()).observe(document.getElementById('spine-chart'))
}

export function syncPresets() {
  for (const b of document.querySelectorAll('#presets button')) b.setAttribute('aria-checked', String(b.dataset.p === state.preset))
}

export function setNote(stat, live) {
  document.getElementById('spine-note').innerHTML = `<strong>${esc(stat)}</strong>${esc(live)}`
}

export function draw() {
  const host = document.getElementById('spine-chart')
  const W = host.clientWidth
  const H = host.clientHeight
  if (!W || !H || !series.length) {
    host.innerHTML = ''
    return
  }
  const padB = 16
  const padT = 4
  const n = series.length
  const max = Math.max(...series.map((s) => s.value))
  const x = (i) => (i / (n - 1)) * (W - 2) + 1
  const y = (v) => padT + (1 - v / max) * (H - padB - padT)
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join('')
  const area = `${line}L${x(n - 1).toFixed(1)},${H - padB}L${x(0).toFixed(1)},${H - padB}Z`
  const years = [...new Set(series.map((s) => s.anio))]
  const idx = (yy, m) => series.findIndex((s) => s.anio === yy && s.mes === m)
  let sel = ''
  const sy = state.periodYear
  if (sy) {
    const [m0, m1] = state.periodMonths || [1, 12]
    const a = idx(sy, m0)
    const b = idx(sy, m1)
    if (a >= 0 && b >= 0) {
      const xa = x(Math.max(0, a - 0.5))
      const xb = x(Math.min(n - 1, b + 0.5))
      sel = `<rect class="sel" x="${xa}" y="${padT}" width="${Math.max(3, xb - xa)}" height="${H - padB - padT}"/>
        <line class="sel-edge" x1="${xa}" x2="${xa}" y1="${padT}" y2="${H - padB}"/><line class="sel-edge" x1="${xb}" x2="${xb}" y1="${padT}" y2="${H - padB}"/>`
    }
    if (state.compareYear) {
      const c0 = idx(state.compareYear, m0)
      const c1 = idx(state.compareYear, m1)
      if (c0 >= 0 && c1 >= 0) sel += `<rect class="sel" opacity=".5" x="${x(c0)}" y="${H - padB - 4}" width="${Math.max(3, x(c1) - x(c0))}" height="4"/>`
    }
  }
  const ticks = years.map((yy) => {
    const i0 = idx(yy, 1) >= 0 ? idx(yy, 1) : series.findIndex((s) => s.anio === yy)
    const i1 = series.map((s) => s.anio).lastIndexOf(yy)
    const xa = x(i0)
    const xb = x(i1)
    return `<line class="tick" x1="${xa}" x2="${xa}" y1="${padT}" y2="${H - padB}"/>
      <rect class="year-hit" data-year="${yy}" x="${xa}" y="0" width="${Math.max(1, xb - xa)}" height="${H}" tabindex="0" role="button" aria-label="Ver ${yy}"/>
      <text class="year" data-year="${yy}" x="${(xa + xb) / 2}" y="${H - 3}" text-anchor="middle" aria-current="${sy === yy}">${yy}</text>`
  }).join('')
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Denuncias policiales por mes en el Perú, ${series[0].anio}–${series[n - 1].anio}">
    <path class="area" d="${area}"/>${sel}<path class="line" d="${line}"/>${ticks}
    <line class="now" x1="${x(n - 1)}" x2="${x(n - 1)}" y1="${padT}" y2="${H - padB}"/></svg>`
  const svg = host.querySelector('svg')
  svg.addEventListener('click', (e) => {
    const yy = e.target.dataset?.year
    if (yy) onPick(Number(yy))
  })
  svg.addEventListener('keydown', (e) => {
    const yy = e.target.dataset?.year
    if (yy && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      onPick(Number(yy))
    }
  })
  svg.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    const s = series[Math.max(0, Math.min(n - 1, i))]
    tip.hidden = false
    tip.textContent = `${MESES[s.mes - 1]} ${s.anio} · ${fmt(s.value)} denuncias`
    tip.style.left = `${e.clientX + 12}px`
    tip.style.top = `${e.clientY - 28}px`
  })
  svg.addEventListener('mouseleave', () => (tip.hidden = true))
}

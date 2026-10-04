// Leyenda del choropleth con selector de medida (absoluto · tasa · cambio).
import { esc, fmt, kindBadge } from './util.js'

const ORDER = ['count', 'rate', 'value', 'score', 'change_pct']

export function renderLegend(c, measure, cls, onMeasure) {
  const el = document.getElementById('legend')
  if (!c?.available) {
    el.innerHTML = ''
    return
  }
  const ms = ORDER.filter((k) => c.measures[k])
  const meta = c.measures[measure]
  const swatches = cls.colors.map((col) => `<span style="background:${col}"></span>`).join('')
  let ticks = ''
  if (cls.diverging) {
    ticks = `<span>≤ −30 %</span><span></span><span></span><span>0</span><span></span><span></span><span>≥ +30 %</span>`
  } else if (cls.breaks.length) {
    ticks = `<span>${fmt(cls.min)}</span>${cls.colors.slice(2).map(() => '<span></span>').join('')}<span>${fmt(cls.max)}</span>`
  }
  el.innerHTML = `
    ${ms.length > 1 ? `<div class="legend-measures" role="group" aria-label="Medida">${ms
      .map((k) => `<button type="button" data-m="${k}" aria-pressed="${k === measure}">${esc(c.measures[k].label)}</button>`).join('')}</div>` : ''}
    <div class="legend-scale" aria-hidden="true">${swatches}</div>
    <div class="legend-ticks" aria-hidden="true">${ticks}</div>
    <div class="legend-foot"><span>${esc(meta.unit)}</span>${kindBadge(meta.kind)}</div>
    <div class="legend-foot"><span><span class="swatch-none"></span> sin dato publicado</span><span>${cls.diverging ? 'cortes fijos' : 'cuantiles · 7 clases'}</span></div>`
  el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => onMeasure(b.dataset.m)))
}

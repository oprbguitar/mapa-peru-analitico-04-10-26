// Leyenda del choropleth con selector de medida (absoluto · tasa · cambio).
import { esc, fmt, kindBadge, state } from './util.js'
import { PALETTES, hotList } from './map.js'

const ORDER = ['count', 'rate', 'share_pct', 'value', 'score', 'change_pct']

export function renderLegend(c, measure, cls, onMeasure, { onPalette, onHot } = {}) {
  const el = document.getElementById('legend')
  if (!c?.available) {
    el.innerHTML = ''
    return
  }
  const ms = ORDER.filter((k) => c.measures[k])
  const meta = c.measures[measure]
  const swatches = cls.colors.map((col) => `<span style="background:${col}"></span>`).join('')
  let ticks = ''
  if (cls.gi) {
    ticks = `<span>frío 99 %</span><span></span><span></span><span>0</span><span></span><span></span><span>foco 99 %</span>`
  } else if (cls.diverging) {
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
    <div class="legend-foot"><span><span class="swatch-none"></span> sin dato publicado</span><span>${cls.gi ? 'z de Getis-Ord · ±1,96 = 95 %' : cls.diverging ? 'cortes fijos · ▼ azul baja · ▲ rojo sube' : 'cuantiles · 7 clases · posición relativa'}</span></div>
    <div class="legend-tools">
      <label class="sr-only" for="sel-palette">Colores del mapa</label>
      <select id="sel-palette" ${cls.diverging ? 'disabled title="El cambio % usa siempre azul (baja) → rojo (sube)"' : ''}>${Object.entries(PALETTES)
        .map(([k, p]) => `<option value="${k}" ${state.palette === k ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
      <button class="btn" type="button" id="btn-hot" aria-pressed="${state.hotspots}" title="Contorno discontinuo en el 10 % de territorios con el valor más alto">
        <span class="hot-key" aria-hidden="true"></span>Focos${state.hotspots && hotList.length ? ` · ${hotList.length}` : ''}</button>
    </div>`
  el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => onMeasure(b.dataset.m)))
  el.querySelector('#sel-palette')?.addEventListener('change', (e) => onPalette?.(e.target.value))
  el.querySelector('#btn-hot')?.addEventListener('click', () => onHot?.(!state.hotspots))
}

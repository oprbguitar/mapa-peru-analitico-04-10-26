// Corrientes del mar peruano animadas: partículas que siguen la corriente superficial del modelo (Open-Meteo Marine).
// Color = temperatura del mar (azul frío → rojo cálido) o su cambio en 7 días (azul se enfría · rojo se calienta).
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON } from './util.js'

let canvas, ctx, raf = null, cells = [], idx = new Map(), parts = [], colorBy = 'sst', data = null
const GRID = 1.5
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const key = (lat, lon) => `${Math.round((lat + 19.5) / GRID)},${Math.round((lon + 92) / GRID)}`
const RAMP = ['--pal-esp-1', '--pal-esp-2', '--pal-esp-3', '--pal-esp-4', '--pal-esp-5', '--pal-esp-6', '--pal-esp-7']

function colorFor(c) {
  const ramp = RAMP.map(cssVar)
  if (colorBy === 'delta') {
    const d = c.delta_7d ?? 0
    return ramp[Math.max(0, Math.min(6, Math.round(3 + d * 3)))]  // ±1 °C en 7 días cubre la rampa
  }
  return ramp[Math.max(0, Math.min(6, Math.round(((c.sst ?? 20) - 15) / 13 * 6)))]  // 15 °C → azul, 28 °C → rojo
}

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'fx-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  map.getContainer().append(canvas)
  ctx = canvas.getContext('2d')
  const resize = () => {
    const r = map.getContainer().getBoundingClientRect()
    canvas.width = r.width * devicePixelRatio
    canvas.height = r.height * devicePixelRatio
    canvas.style.width = `${r.width}px`
    canvas.style.height = `${r.height}px`
  }
  resize()
  map.on('resize', resize)
  map.on('movestart', () => ctx?.clearRect(0, 0, canvas.width, canvas.height))
}

function seed(n = 1400) {
  parts = []
  if (!cells.length) return
  for (let i = 0; i < n; i++) {
    const c = cells[Math.floor(Math.random() * cells.length)]
    parts.push({ lat: c.lat + (Math.random() - 0.5) * GRID, lon: c.lon + (Math.random() - 0.5) * GRID, age: Math.random() * 120 })
  }
}

function step() {
  const dpr = devicePixelRatio
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = 'destination-out'   // estela que se desvanece
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr)
  ctx.globalCompositeOperation = 'source-over'
  ctx.lineWidth = 1.4
  for (const p of parts) {
    const c = idx.get(key(p.lat, p.lon))
    if (!c || p.age > 140) {
      const s = cells[Math.floor(Math.random() * cells.length)]
      Object.assign(p, { lat: s.lat + (Math.random() - 0.5) * GRID, lon: s.lon + (Math.random() - 0.5) * GRID, age: 0 })
      continue
    }
    const sp = (c.speed_kmh || 0) * 0.0035 + 0.0015  // velocidad visual proporcional a la real
    const a = (c.dir_deg || 0) * Math.PI / 180        // dirección hacia la que fluye el agua
    const a0 = map.project([p.lon, p.lat])
    p.lat += Math.cos(a) * sp
    p.lon += Math.sin(a) * sp / Math.cos(p.lat * Math.PI / 180)
    p.age++
    const a1 = map.project([p.lon, p.lat])
    ctx.strokeStyle = colorFor(c)
    ctx.globalAlpha = 0.85
    ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke()
  }
  ctx.globalAlpha = 1
  if (!document.hidden) raf = requestAnimationFrame(step)
}

function drawStatic() {  // movimiento reducido: flechas fijas por celda
  const dpr = devicePixelRatio
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (const c of cells) {
    const a = (c.dir_deg || 0) * Math.PI / 180
    const p = map.project([c.lon, c.lat])
    const L = 6 + (c.speed_kmh || 0) * 8
    ctx.strokeStyle = colorFor(c)
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(a) * L, p.y - Math.cos(a) * L); ctx.stroke()
  }
}

export async function setOcean(on, by) {
  if (by) colorBy = by
  cancelAnimationFrame(raf)
  if (!on) {
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
    return null
  }
  ensureCanvas()
  const d = await getJSON('/api/v1/intel/ocean')
  if (!d.data) return { loading: true }
  data = d.data
  cells = d.data.cells
  idx = new Map(cells.map((c) => [key(c.lat, c.lon), c]))
  seed()
  if (reduce()) {
    drawStatic()
    map.on('moveend', () => cells.length && drawStatic())
  } else raf = requestAnimationFrame(step)
  return stats()
}

export function setOceanColor(by) {
  colorBy = by
  if (reduce()) drawStatic()
}

/** Resumen calculado para la ficha (frente a la costa norte vs. centro-sur). */
export function stats() {
  if (!cells.length) return null
  const coast = cells.filter((c) => c.lon > -84)
  const north = coast.filter((c) => c.lat > -8)
  const south = coast.filter((c) => c.lat <= -8)
  const avg = (xs, k) => (xs.length ? xs.reduce((s, c) => s + (c[k] ?? 0), 0) / xs.length : null)
  const warming = cells.filter((c) => (c.delta_7d ?? 0) > 0.1).length
  const northward = coast.filter((c) => c.dir_deg != null && (c.dir_deg >= 270 || c.dir_deg <= 90)).length
  return { time: data.time, n: cells.length, sstNorth: avg(north, 'sst'), sstSouth: avg(south, 'sst'), deltaNorth: avg(north, 'delta_7d'),
    deltaSouth: avg(south, 'delta_7d'), warmingShare: warming / cells.length, northwardShare: coast.length ? northward / coast.length : null }
}

export function oceanKey() {
  const s = stats()
  const sw = RAMP.map((v) => `<span style="background:${cssVar(v)}"></span>`).join('')
  return `<div class="ocean-key" aria-hidden="true">${sw}</div><div class="legend-ticks"><span>${colorBy === 'delta' ? '−1 °C (se enfría)' : '15 °C'}</span><span>${colorBy === 'delta' ? '+1 °C (se calienta)' : '28 °C'}</span></div>
    ${s ? `<dl class="kv section-gap"><dt>Mar frente a la costa norte (≥ −8°)</dt><dd>${fmt(s.sstNorth, 1)} °C · ${s.deltaNorth >= 0 ? '+' : ''}${fmt(s.deltaNorth, 2)} en 7 d</dd>
      <dt>Centro y sur</dt><dd>${fmt(s.sstSouth, 1)} °C · ${s.deltaSouth >= 0 ? '+' : ''}${fmt(s.deltaSouth, 2)} en 7 d</dd>
      <dt>Celdas que se calientan</dt><dd>${fmt(s.warmingShare * 100, 0)} %</dd>
      <dt>Corriente costera hacia el norte</dt><dd>${s.northwardShare != null ? fmt(s.northwardShare * 100, 0) + ' %' : '—'}</dd></dl>
      <p class="src-meta">Modelo Open-Meteo Marine · ${esc(s.time)} · ${s.n} celdas de 1,5°. Cálculo propio; no es el ICEN oficial.</p>` : ''}`
}

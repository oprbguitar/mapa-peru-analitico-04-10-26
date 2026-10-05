// Clima animado sobre el mapa. Datos: rejilla Open-Meteo (modelo, ~165 km) del backend.
// El usuario elige qué ver: «automático» (todo lo que reporta el modelo) o un fenómeno (calor, lluvia, tormenta, nubes, viento,
// niebla, frío). Cada celda se dibuja solo si el modelo reporta ese fenómeno: la animación interpreta datos, no decora.
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON } from './util.js'

export const FX = {
  auto: 'Automático (lo que reporta el modelo)', calor: 'Calor (≥ 28 °C)', lluvia: 'Lluvia', tormenta: 'Tormenta',
  nubes: 'Nubosidad (≥ 70 %)', viento: 'Viento (≥ 30 km/h)', niebla: 'Niebla', frio: 'Frío y nieve (≤ 2 °C)',
}
let canvas, ctx, raf = null, cells = [], mode = 'auto', particles = [], last = 0, timer = null, meta = null
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

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
  map.on('move', () => reduce() && draw(0))
}

const want = (c, kinds) => kinds.some((k) => c.fx.includes(k))

function visibleCells() {
  const k = { auto: null, calor: ['calor'], lluvia: ['lluvia', 'tormenta'], tormenta: ['tormenta'], nubes: ['nubes'], viento: ['viento'],
    niebla: ['niebla'], frio: ['helada', 'nieve'] }[mode]
  return cells.filter((c) => (k ? want(c, k) : c.fx.length && !(c.fx.length === 1 && c.fx[0] === 'despejado')))
}

function cellRadius(c) {
  const a = map.project([c.lon, c.lat])
  const b = map.project([c.lon + 0.75, c.lat])
  return { x: a.x, y: a.y, r: Math.max(14, Math.abs(b.x - a.x)) }
}

function spawn() {
  particles = []
  for (const c of visibleCells()) {
    const n = c.fx.includes('tormenta') ? 46 : c.fx.includes('lluvia') ? Math.min(40, 8 + (c.precip_mm || 0) * 14) : 0
    for (let i = 0; i < n; i++) particles.push({ c, kind: 'rain', u: Math.random() * 2 - 1, v: Math.random(), s: 0.6 + Math.random() * 0.8 })
    if (want(c, ['helada', 'nieve']) && (mode === 'auto' || mode === 'frio')) for (let i = 0; i < 18; i++) particles.push({ c, kind: 'snow', u: Math.random() * 2 - 1, v: Math.random(), s: 0.2 + Math.random() * 0.3 })
    if (c.fx.includes('viento') && (mode === 'auto' || mode === 'viento')) for (let i = 0; i < 14; i++) particles.push({ c, kind: 'wind', u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, s: Math.random() })
  }
}

function draw(t) {
  if (!ctx) return
  const dpr = devicePixelRatio
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const dt = Math.min(64, t - last || 16) / 16
  last = t
  const col = { sun: cssVar('--fx-sun'), rain: cssVar('--fx-rain'), storm: cssVar('--fx-storm'), cloud: cssVar('--fx-cloud'),
    wind: cssVar('--fx-wind'), frost: cssVar('--fx-frost'), fog: cssVar('--fx-fog') }
  for (const c of visibleCells()) {
    const { x, y, r } = cellRadius(c)
    if (x < -r || y < -r || x > canvas.width / dpr + r || y > canvas.height / dpr + r) continue
    if (c.fx.includes('calor') && (mode === 'auto' || mode === 'calor')) {   // punto amarillo que brilla, más intenso a más calor
      const k = Math.min(1, ((c.temp_c || 28) - 26) / 10)
      const pulse = reduce() ? 1 : 0.75 + 0.25 * Math.sin(t / 420 + c.lon)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.55 * pulse)
      g.addColorStop(0, col.sun)
      g.addColorStop(0.25, col.sun + 'cc')
      g.addColorStop(1, col.sun + '00')
      ctx.globalAlpha = 0.35 + 0.5 * k
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(x, y, r * 0.55 * pulse, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = col.sun
      ctx.beginPath(); ctx.arc(x, y, 3 + 3 * k, 0, Math.PI * 2); ctx.fill()
    }
    if ((c.fx.includes('nubes') || c.fx.includes('lluvia') || c.fx.includes('tormenta')) && ['auto', 'nubes', 'lluvia', 'tormenta'].includes(mode)) {
      const drift = reduce() ? 0 : ((t / 90) % (r * 2)) - r
      ctx.globalAlpha = 0.16 + (c.cloud_pct || 70) / 600
      ctx.fillStyle = c.fx.includes('tormenta') ? col.storm : col.cloud
      for (const [dx, dy, s] of [[-0.3, -0.1, 0.42], [0.1, -0.2, 0.5], [0.35, 0, 0.38]]) {
        ctx.beginPath(); ctx.ellipse(x + dx * r + drift * 0.15, y + dy * r, r * s, r * s * 0.55, 0, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    if (c.fx.includes('niebla') && (mode === 'auto' || mode === 'niebla')) {
      ctx.globalAlpha = 0.28
      ctx.fillStyle = col.fog
      for (let i = 0; i < 4; i++) ctx.fillRect(x - r * 0.6, y - r * 0.3 + i * r * 0.18 + (reduce() ? 0 : Math.sin(t / 900 + i) * 3), r * 1.2, r * 0.06)
      ctx.globalAlpha = 1
    }
    if (c.fx.includes('tormenta') && !reduce() && Math.sin(t / 97 + c.lat * 13) > 0.995) {  // relámpago ocasional
      ctx.strokeStyle = col.storm
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.2); ctx.lineTo(x - 6, y + 8); ctx.lineTo(x + 4, y + 10); ctx.lineTo(x - 4, y + r * 0.35); ctx.stroke()
    }
  }
  for (const p of particles) {
    const { x, y, r } = cellRadius(p.c)
    if (p.kind === 'rain') {
      if (!reduce()) p.v = (p.v + 0.018 * p.s * dt) % 1
      const px = x + p.u * r * 0.55
      const py = y - r * 0.25 + p.v * r * 0.75
      ctx.strokeStyle = p.c.fx.includes('tormenta') ? col.storm : col.rain
      ctx.globalAlpha = 0.75
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 2, py + 7); ctx.stroke()
    } else if (p.kind === 'snow') {
      if (!reduce()) p.v = (p.v + 0.004 * p.s * dt) % 1
      ctx.fillStyle = col.frost
      ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.arc(x + p.u * r * 0.5 + Math.sin(t / 600 + p.u * 9) * 3, y - r * 0.2 + p.v * r * 0.6, 1.8, 0, Math.PI * 2); ctx.fill()
    } else if (p.kind === 'wind') {
      const ang = ((p.c.wind_dir || 0) + 180) * Math.PI / 180  // la dirección meteorológica indica de dónde viene
      if (!reduce()) p.s = (p.s + 0.01 * dt) % 1
      const L = r * 0.9
      const cx = x + p.u * r * 0.4 + Math.sin(ang) * (p.s - 0.5) * L
      const cy = y + p.v * r * 0.4 - Math.cos(ang) * (p.s - 0.5) * L
      ctx.strokeStyle = col.wind
      ctx.globalAlpha = 0.6 * Math.sin(p.s * Math.PI)
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.sin(ang) * 12, cy + Math.cos(ang) * 12); ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  if (!reduce() && !document.hidden) raf = requestAnimationFrame(draw)
}

export async function setWeatherFx(on, newMode) {
  if (newMode) mode = newMode
  cancelAnimationFrame(raf)
  clearInterval(timer)
  if (!on) {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    cells = []
    return null
  }
  ensureCanvas()
  const load = async () => {
    const d = await getJSON('/api/v1/intel/weather/grid')
    if (!d.data) {
      setTimeout(() => cells.length || load(), 4000)
      meta = { loading: true }
      return
    }
    cells = d.data.cells
    meta = { time: d.data.cells[0]?.time, n: cells.length, model: d.data.model }
    spawn()
  }
  await load()
  timer = setInterval(load, 30 * 60 * 1000)
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(draw)
  return meta
}

export function setFxMode(m) {
  mode = m
  spawn()
}

export function fxSummary() {
  const vis = visibleCells()
  const count = (k) => cells.filter((c) => c.fx.includes(k)).length
  return `<p class="src-meta">${esc(meta?.model || 'Open-Meteo')} · ${esc(meta?.time || '')} · ${vis.length} celdas visibles ·
    calor ${count('calor')} · lluvia ${count('lluvia')} · tormenta ${count('tormenta')} · temperatura máx. ${fmt(Math.max(...cells.map((c) => c.temp_c ?? -99)))} °C</p>`
}

export const fxMode = () => mode

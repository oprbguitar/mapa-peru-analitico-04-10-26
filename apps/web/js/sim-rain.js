// Lluvia HIPOTÉTICA del escenario, dibujada solo dentro de la zona simulada (no es una observación meteorológica).
// Lienzo sobre el mapa sin eventos de puntero; con movimiento reducido se muestra un rayado fijo.
import { map } from './map.js'
import { cssVar } from './util.js'

const DROPS = { ninguna: 0, moderada: 110, intensa: 260 }
let canvas = null
let ctx = null
let level = 'ninguna'
let zone = null
let drops = []
let frame = 0

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'sim-rain'
  canvas.setAttribute('aria-hidden', 'true')
  map.getContainer().appendChild(canvas)
  ctx = canvas.getContext('2d')
  map.on('move', () => { if (reduced()) draw(0) })
  addEventListener('resize', size)
  size()
}

function size() {
  if (!canvas) return
  const r = map.getContainer().getBoundingClientRect()
  canvas.width = r.width * devicePixelRatio
  canvas.height = r.height * devicePixelRatio
  canvas.style.width = `${r.width}px`
  canvas.style.height = `${r.height}px`
}

/** Centro y radio de la zona en píxeles de pantalla. */
function screenCircle() {
  const c = map.project([zone.lon, zone.lat])
  const e = map.project([zone.lon + zone.radius_km / (111.32 * Math.cos(zone.lat * Math.PI / 180)), zone.lat])
  return { x: c.x * devicePixelRatio, y: c.y * devicePixelRatio, r: Math.abs(e.x - c.x) * devicePixelRatio }
}

function draw(dt) {
  const k = devicePixelRatio
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!zone || level === 'ninguna') return
  const { x, y, r } = screenCircle()
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = cssVar('--fx-rain') || cssVar('--info')
  ctx.lineCap = 'round'
  if (reduced()) {
    ctx.globalAlpha = level === 'intensa' ? 0.35 : 0.2
    ctx.lineWidth = k
    for (let i = -r * 2; i < r * 2; i += 14 * k) {
      ctx.beginPath()
      ctx.moveTo(x + i, y - r)
      ctx.lineTo(x + i - r * 0.4, y + r)
      ctx.stroke()
    }
  } else {
    ctx.globalAlpha = level === 'intensa' ? 0.7 : 0.5
    ctx.lineWidth = 1.2 * k
    for (const d of drops) {
      d.y += d.v * dt
      d.x -= d.v * dt * 0.25
      if (d.y > 1) { d.y = -0.05; d.x = Math.random() }
      if (d.x < 0) d.x += 1
      const px = x - r + d.x * 2 * r, py = y - r + d.y * 2 * r
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px - d.len * 0.25 * k, py + d.len * k)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function loop(t0) {
  cancelAnimationFrame(frame)
  let last = t0
  const tick = (now) => {
    draw(Math.min(0.05, (now - last) / 1000))
    last = now
    if (level !== 'ninguna' && zone && !reduced()) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

export function setRain(nextLevel, nextZone) {
  level = DROPS[nextLevel] ? nextLevel : 'ninguna'
  zone = nextZone
  ensureCanvas()
  canvas.dataset.level = level
  // sin lluvia el lienzo se oculta y se reinicia su memoria: el navegador no puede restaurar una imagen vieja
  canvas.hidden = level === 'ninguna' || !nextZone
  if (canvas.hidden) size()
  drops = Array.from({ length: DROPS[level] }, () => ({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.6, len: 8 + Math.random() * 10 }))
  if (level === 'ninguna' || !zone) { cancelAnimationFrame(frame); draw(0); return }
  if (reduced()) draw(0)
  else loop(performance.now())
}

export const stopRain = () => setRain('ninguna', null)

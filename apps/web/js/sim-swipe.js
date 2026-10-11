// Cortina «antes ⟷ después» sobre el mapa: a la izquierda se pinta HOY (A) y a la derecha la HIPÓTESIS (B).
// Se arrastra con ratón, dedo o flechas del teclado; informa la longitud del corte para filtrar las capas.
import { map } from './map.js'

let el = null
let x = 0.5               // posición relativa dentro del mapa (0–1)
let onChange = () => {}

const lonAt = () => {
  const r = map.getContainer().getBoundingClientRect()
  return map.unproject([r.width * x, r.height / 2]).lng
}

function place() {
  el.style.left = `${x * 100}%`
  el.setAttribute('aria-valuenow', String(Math.round(x * 100)))
  onChange(lonAt())
}

function ensure() {
  if (el) return
  el = document.createElement('div')
  el.className = 'sim-swipe'
  el.setAttribute('role', 'slider')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', 'Comparar hoy y la hipótesis')
  el.setAttribute('aria-valuemin', '0')
  el.setAttribute('aria-valuemax', '100')
  el.innerHTML = '<span class="sim-swipe-tag" data-side="a">Hoy</span><span class="sim-swipe-grip" aria-hidden="true">⟷</span><span class="sim-swipe-tag" data-side="b">Hipótesis</span>'
  map.getContainer().appendChild(el)
  const move = (clientX) => {
    const r = map.getContainer().getBoundingClientRect()
    x = Math.min(0.97, Math.max(0.03, (clientX - r.left) / r.width))
    place()
  }
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    el.classList.add('dragging')
    const mv = (ev) => move(ev.clientX)
    const up = () => {
      el.classList.remove('dragging')
      el.removeEventListener('pointermove', mv)
      el.removeEventListener('pointerup', up)
    }
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', up)
  })
  el.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key]
    if (!step) return
    e.preventDefault()
    x = Math.min(0.97, Math.max(0.03, x + step))
    place()
  })
  map.on('move', () => { if (!el.hidden) onChange(lonAt()) })
}

export function showSwipe(labelB, cb) {
  ensure()
  onChange = cb
  el.hidden = false
  el.querySelector('[data-side="b"]').textContent = labelB
  place()
}

export function hideSwipe() {
  if (el) el.hidden = true
}

/** Lleva la cortina al centro de la zona para que el contraste aparezca justo donde se simuló. */
export function centerSwipeOn(lon, lat) {
  ensure()
  const r = map.getContainer().getBoundingClientRect()
  x = Math.min(0.97, Math.max(0.03, map.project([lon, lat]).x / r.width))
  if (!el.hidden) place()
}

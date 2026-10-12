// Paneles replegables y «vista amplia»: el mapa puede ocupar toda la pantalla.
// Teclas (fuera de campos de texto): [ capas · ] ficha · F vista amplia · Esc sale de la vista amplia.
import { map } from './map.js'

let state = { rail: false, panel: false, spine: false, wide: false }

function apply() {
  const b = document.body.dataset
  const off = (k) => state.wide || !state[k]
  b.rail = off('rail') ? 'off' : 'on'
  b.panelC = off('panel') ? 'off' : 'on'
  b.spine = off('spine') ? 'off' : 'on'
  b.wide = state.wide ? 'on' : 'off'
  document.getElementById('toggle-wide')?.setAttribute('aria-pressed', String(state.wide))
  try { localStorage.setItem('pi-chrome-clean', JSON.stringify(state)) } catch { /* sin almacenamiento */ }
  // el lienzo del mapa no cambia de tamaño (pantalla completa), pero los controles sí se reubican
  setTimeout(() => map?.resize(), 300)
}

export function setPanel(name, on) {
  if (name === 'wide') state.wide = on
  else {
    state[name] = on
    if (on) state.wide = false
  }
  apply()
}

export const isOpen = (name) => !state.wide && state[name]

/**
 * Menús emergentes (⋯ Herramientas, 🔔 Avisos): se cierran al hacer clic fuera, con Esc o al retirar el puntero
 * (tras una breve pausa para poder cruzar el hueco entre botón y menú). No se cierran si se está escribiendo dentro.
 */
export function autoDismiss(trigger, popup, close, isOpen) {
  let timer = 0
  const inside = (t) => trigger.contains(t) || popup.contains(t)
  const leave = (e) => {
    if (e.pointerType === 'touch' || !isOpen()) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (popup.matches(':hover') || trigger.matches(':hover') || popup.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return
      close()
    }, 450)
  }
  const enter = () => clearTimeout(timer)
  for (const el of [trigger, popup]) { el.addEventListener('pointerleave', leave); el.addEventListener('pointerenter', enter) }
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !inside(e.target)) close() }, true)
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { close(); trigger.focus?.() } })
}

export function initChrome() {
  try {
    const saved = JSON.parse(localStorage.getItem('pi-chrome-clean') || 'null')
    if (saved) state = { ...state, ...saved }
  } catch { /* sin almacenamiento */ }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.tool-menu-body button')) document.querySelector('.tool-menu')?.removeAttribute('open')
    const c = e.target.closest('[data-collapse]')
    if (c) return setPanel(c.dataset.collapse, false)
    const x = e.target.closest('[data-expand]')
    if (x) return x.dataset.expand === 'wide' ? setPanel('wide', false) : setPanel(x.dataset.expand, true)
  })
  document.getElementById('toggle-wide').addEventListener('click', () => setPanel('wide', !state.wide))
  const menu = document.querySelector('.tool-menu')
  if (menu) autoDismiss(menu.querySelector('summary'), menu.querySelector('.tool-menu-body'), () => menu.removeAttribute('open'), () => menu.open)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelector('.tool-menu')?.removeAttribute('open')
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === '[') setPanel('rail', !isOpen('rail'))
    else if (e.key === ']') setPanel('panel', !isOpen('panel'))
    else if (e.key === 'f' || e.key === 'F') setPanel('wide', !state.wide)
    else if ((e.key === 't' || e.key === 'T') && !document.body.classList.contains('sim-on')) setPanel('spine', !isOpen('spine'))
    else if (e.key === 'Escape' && state.wide) setPanel('wide', false)
    else return
    e.preventDefault()
  })
  apply()
}

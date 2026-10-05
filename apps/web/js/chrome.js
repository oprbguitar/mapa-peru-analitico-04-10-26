// Paneles replegables y «vista amplia»: el mapa puede ocupar toda la pantalla.
// Teclas (fuera de campos de texto): [ capas · ] ficha · F vista amplia · Esc sale de la vista amplia.
import { map } from './map.js'

let state = { rail: true, panel: true, spine: true, wide: false }

function apply() {
  const b = document.body.dataset
  const off = (k) => state.wide || !state[k]
  b.rail = off('rail') ? 'off' : 'on'
  b.panelC = off('panel') ? 'off' : 'on'
  b.spine = off('spine') ? 'off' : 'on'
  b.wide = state.wide ? 'on' : 'off'
  document.getElementById('toggle-wide')?.setAttribute('aria-pressed', String(state.wide))
  try { localStorage.setItem('pi-chrome', JSON.stringify(state)) } catch { /* sin almacenamiento */ }
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

export function initChrome() {
  try {
    const saved = JSON.parse(localStorage.getItem('pi-chrome') || 'null')
    if (saved) state = { ...state, ...saved }
  } catch { /* sin almacenamiento */ }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-collapse]')
    if (c) return setPanel(c.dataset.collapse, false)
    const x = e.target.closest('[data-expand]')
    if (x) return x.dataset.expand === 'wide' ? setPanel('wide', false) : setPanel(x.dataset.expand, true)
  })
  document.getElementById('toggle-wide').addEventListener('click', () => setPanel('wide', !state.wide))
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === '[') setPanel('rail', !isOpen('rail'))
    else if (e.key === ']') setPanel('panel', !isOpen('panel'))
    else if (e.key === 'f' || e.key === 'F') setPanel('wide', !state.wide)
    else if (e.key === 'Escape' && state.wide) setPanel('wide', false)
    else return
    e.preventDefault()
  })
  apply()
}

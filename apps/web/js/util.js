// Utilidades compartidas: red, formato es-PE, DOM y estado.

export async function getJSON(url, { signal } = {}) {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

export async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
  return data
}

const nf0 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

export function fmt(v, digits) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (digits === 0) return nf0.format(v)
  if (digits === 1) return nf1.format(v)
  if (Math.abs(v) >= 1000) return nf0.format(v)
  return nf2.format(v)
}

export function fmtPct(v) {
  if (v === null || v === undefined) return '—'
  return `${v > 0 ? '+' : ''}${nf1.format(v)} %`
}

export const sign = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function h(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content
}

export const KIND_LABEL = {
  oficial: 'Dato oficial',
  vivo_tercero: 'En vivo de tercero',
  calculado: 'Calculado',
  estimacion: 'Estimación',
  proyeccion: 'Proyección',
  ia: 'Interpretación IA',
}

export const kindBadge = (kind, label) =>
  `<span class="kind" data-kind="${esc(kind)}" title="${esc(KIND_LABEL[kind] || kind)}">${esc(label ?? KIND_LABEL[kind] ?? kind)}</span>`

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function timeAgo(ts) {
  if (!ts) return '—'
  const s = Math.max(0, Date.now() / 1000 - ts)
  if (s < 90) return `hace ${Math.round(s)} s`
  if (s < 5400) return `hace ${Math.round(s / 60)} min`
  if (s < 172800) return `hace ${Math.round(s / 3600)} h`
  return `hace ${Math.round(s / 86400)} d`
}

export function dateTime(ts) {
  return new Date(ts * 1000).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
}

// Estado mínimo con suscriptores
const listeners = new Set()
export const state = {
  dataset: 'sidpol', code: 10, modalidad: '', level: 'departamento', measure: null,
  preset: 'ahora', year: null, months: null, compare: null,
  mpfnTid: false, devidaInd: 'coca_ha',
  selected: null, live: new Set(), satGroup: 'stations', weatherModel: 'gfs',
  extent: null, choropleth: null,
  palette: (() => { try { return localStorage.getItem('pi-palette') || 'espectral' } catch { return 'espectral' } })(),
  hotspots: true, wxfx: 'auto', oceanColor: 'sst',
}
export function setState(patch) {
  Object.assign(state, patch)
  for (const fn of listeners) fn(patch)
}
export const onState = (fn) => listeners.add(fn)

export function toast(msg, ms = 4000) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.hidden = false
  clearTimeout(toast._t)
  toast._t = setTimeout(() => (el.hidden = true), ms)
}

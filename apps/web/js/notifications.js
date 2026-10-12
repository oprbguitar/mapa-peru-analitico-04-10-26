// Centro de avisos (plan maestro §9): observado · técnico · predictivo (con incertidumbre y hechos) · actividad.
// Campana en la barra superior; se consulta cada 30 s y al terminar una simulación (evento «notify-refresh»).
import { esc, getJSON, postJSON } from './util.js'
import { autoDismiss } from './chrome.js'

const TYPE_TONE = { observado: '--info', tecnico: '--warn', predictivo: '--kind-ia', actividad: '--ok' }
let box = null
let filter = ''
let last = { items: [], unread: 0, types: {} }

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  return s < 60 ? 'ahora' : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : new Date(iso).toLocaleDateString('es-PE')
}

async function refresh() {
  try {
    last = await getJSON(`/api/v1/notifications?limit=40${filter ? `&type=${filter}` : ''}`)
  } catch { return }
  const badge = document.querySelector('#open-notify .notify-count')
  if (badge) {
    badge.hidden = !last.unread
    badge.textContent = last.unread > 9 ? '9+' : String(last.unread)
  }
  if (box && !box.hidden) render()
}

function itemHtml(n) {
  return `<li class="notify-item" data-read="${n.read}" style="--tone:var(${TYPE_TONE[n.type] || '--ink-muted'})">
    <p class="notify-meta"><b>${esc(last.types[n.type] || n.type)}</b> · ${esc(ago(n.at))}${n.uncertainty ? ` · incertidumbre ${esc(n.uncertainty)}` : ''}</p>
    <p class="notify-title">${esc(n.title)}</p>${n.detail ? `<p class="notify-detail">${esc(n.detail)}</p>` : ''}
    ${n.facts?.length ? `<details><summary>Hechos que lo sustentan</summary><ol>${n.facts.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ol></details>` : ''}
  </li>`
}

function render() {
  box.innerHTML = `<div class="notify-head"><h2>Avisos</h2><button class="btn btn-ghost" type="button" data-notify="read">Marcar todo leído</button></div>
    <div class="seg" role="group" aria-label="Tipo de aviso">${[['', 'Todos'], ...Object.entries(last.types)].map(([k, l]) =>
      `<button type="button" data-notify-type="${k}" aria-pressed="${filter === k}">${esc(l)}</button>`).join('')}</div>
    <ul class="notify-list">${last.items.length ? last.items.map(itemHtml).join('') : '<li class="src-meta">Sin avisos.</li>'}</ul>
    <p class="src-meta">Los avisos predictivos son puntuaciones del evaluador JEV con su incertidumbre: no son probabilidades.</p>`
}

function toggle(open) {
  box.hidden = !open
  document.getElementById('open-notify').setAttribute('aria-expanded', String(open))
  if (open) { render(); refresh() }
}

export function initNotifications() {
  const btn = document.getElementById('open-notify')
  if (!btn) return
  box = document.createElement('section')
  box.className = 'notify-panel hud hud-frame'
  box.id = 'notify-panel'
  box.hidden = true
  box.setAttribute('aria-label', 'Avisos')
  document.body.appendChild(box)
  btn.addEventListener('click', () => toggle(box.hidden))
  box.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-notify-type]')
    if (t) { filter = t.dataset.notifyType; return refresh().then(render) }
    if (e.target.closest('[data-notify="read"]')) {
      await postJSON('/api/v1/notifications/read', { all: true }).catch(() => {})
      refresh()
    }
  })
  autoDismiss(btn, box, () => toggle(false), () => !box.hidden)
  document.addEventListener('notify-refresh', refresh)
  refresh()
  setInterval(refresh, 30000)
}

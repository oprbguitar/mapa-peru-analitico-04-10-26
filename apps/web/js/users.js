// Usuarios, roles y actividades (plan maestro §8), solo en la instalación local.
// Sin usuarios: «uso personal», nada cambia. Con usuarios: inicio de sesión, vista según rol y actividades asignadas.
import { esc, getJSON, postJSON, toast } from './util.js'

let me = { enabled: false, user: null, roles: {}, perms: [], local: false }
let panel = null
let view = 'menu'
const STATE_LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha', bloqueada: 'Bloqueada' }
const can = (p) => me.perms.includes('*') || me.perms.includes(p)

function chip() {
  const b = document.getElementById('open-user')
  if (!b) return
  b.hidden = !me.local
  const u = me.user
  b.textContent = u ? (u.personal ? 'Uso personal' : u.name) : 'Iniciar sesión'
  b.title = u ? `${u.personal ? 'Sin usuarios activados' : me.roles[u.role]} · actividades y cuenta` : 'Iniciar sesión'
  document.body.dataset.role = u?.role || 'anonimo'
}

// ── inicio de sesión ────────────────────────────────────────────────────────
function loginScreen() {
  let el = document.getElementById('login-screen')
  if (!el) {
    el = document.createElement('div')
    el.id = 'login-screen'
    el.className = 'login-screen'
    document.body.appendChild(el)
  }
  el.innerHTML = `<form class="login-card hud hud-frame" id="login-form" autocomplete="off">
      <div class="eyebrow">Mapa Perú Analítico · instalación local</div><h2>Iniciar sesión</h2>
      <label class="field"><span>Nombre</span><input id="login-name" required minlength="2" maxlength="40" autocomplete="username"></label>
      <label class="field"><span>PIN</span><input id="login-pin" type="password" inputmode="numeric" pattern="\\d{4,12}" required autocomplete="current-password"></label>
      <p class="note" id="login-error" hidden></p>
      <button class="btn btn-primary" type="submit">Entrar</button></form>`
  el.hidden = false
  el.querySelector('#login-name').focus()
  el.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      await postJSON('/api/v1/auth/login', { name: el.querySelector('#login-name').value, pin: el.querySelector('#login-pin').value })
      location.reload()
    } catch (err) {
      const p = el.querySelector('#login-error')
      p.hidden = false
      p.textContent = err.message
    }
  })
}

// ── panel de cuenta, actividades y usuarios ─────────────────────────────────
async function render() {
  if (!panel) return
  const u = me.user
  const tabs = [['menu', 'Cuenta'], ['activities', 'Actividades'], ...(can('users') || u?.personal ? [['users', 'Usuarios']] : [])]
  let body = ''
  if (view === 'activities') body = await activitiesHtml()
  else if (view === 'users') body = await usersHtml()
  else {
    body = `<p class="src-meta">${u?.personal ? 'Uso personal: sin usuarios ni inicio de sesión. Activa usuarios para trabajar en equipo con roles.'
      : `${esc(u?.name || '')} · ${esc(me.roles[u?.role] || '')}`}</p>
      ${u?.personal ? '' : '<button class="btn" type="button" data-u="logout">Cerrar sesión</button>'}`
  }
  panel.innerHTML = `<div class="notify-head"><h2>${u?.personal ? 'Uso personal' : esc(u?.name || '')}</h2>
      <button class="btn btn-ghost btn-icon" type="button" data-u="close" aria-label="Cerrar">✕</button></div>
    <div class="seg" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-u-view="${k}" aria-selected="${view === k}" aria-pressed="${view === k}">${l}</button>`).join('')}</div>
    <div class="user-body">${body}</div>`
}

async function activitiesHtml() {
  let data
  try { data = await getJSON('/api/v1/activities') } catch (e) { return `<p class="note">${esc(e.message)}</p>` }
  const manage = can('activities.manage')
  let form = ''
  if (manage) {
    const [dir, scn] = await Promise.all([getJSON('/api/v1/users/directory').catch(() => ({ users: [] })),
      getJSON('/api/v1/sim/scenarios').catch(() => ({ scenarios: [] }))])
    form = `<form class="act-form" id="act-form"><label class="field"><span>Nueva actividad</span><input id="act-title" required minlength="3" maxlength="120" placeholder="p. ej., Revisar cobertura del escenario B"></label>
      <label class="field"><span>Asignar a</span><select id="act-assignee">${dir.users.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Escenario (opcional)</span><select id="act-scn"><option value="">—</option>${scn.scenarios.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Vence</span><input id="act-due" type="date"></label>
      <button class="btn btn-primary" type="submit">Asignar</button></form>`
  }
  const items = data.items.length ? `<ul class="act-list">${data.items.map((a) => `<li class="act-item" data-status="${esc(a.status)}">
      <p class="notify-title">${esc(a.title)}</p>
      <p class="notify-meta">${esc(a.assignee_name)}${a.due ? ` · vence ${esc(a.due)}` : ''}${a.scenario_id ? ' · escenario vinculado' : ''} · por ${esc(a.created_by)}</p>
      <div class="seg" role="group" aria-label="Estado">${Object.entries(STATE_LABEL).map(([k, l]) =>
        `<button type="button" data-act="${esc(a.id)}" data-st="${k}" aria-pressed="${a.status === k}">${l}</button>`).join('')}</div>
      <details><summary>Historial</summary><ol>${a.history.map((h) => `<li>${esc(h.at.replace('T', ' ').slice(0, 16))} · ${esc(h.by)} · ${esc(STATE_LABEL[h.status] || h.status)}${h.note ? ` · ${esc(h.note)}` : ''}</li>`).join('')}</ol></details></li>`).join('')}</ul>`
    : '<p class="src-meta">No hay actividades.</p>'
  return form + items
}

async function usersHtml() {
  if (me.user?.personal) {
    return `<form class="act-form" id="first-admin"><p class="src-meta">Crea el primer <b>administrador</b>. Desde ese momento se pedirá iniciar sesión
      en esta instalación. Guarda el PIN: no se puede recuperar, solo otro administrador puede crear otro usuario.</p>
      <label class="field"><span>Nombre</span><input id="nu-name" required minlength="2" maxlength="40"></label>
      <label class="field"><span>PIN (4 a 12 dígitos)</span><input id="nu-pin" type="password" inputmode="numeric" pattern="\\d{4,12}" required></label>
      <button class="btn btn-primary" type="submit">Activar usuarios</button></form>`
  }
  let data
  try { data = await getJSON('/api/v1/users') } catch (e) { return `<p class="note">${esc(e.message)}</p>` }
  return `<form class="act-form" id="new-user"><label class="field"><span>Nombre</span><input id="nu-name" required minlength="2" maxlength="40"></label>
      <label class="field"><span>Rol</span><select id="nu-role">${Object.entries(data.roles).map(([k, l]) => `<option value="${k}" ${k === 'participante' ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>PIN</span><input id="nu-pin" type="password" inputmode="numeric" pattern="\\d{4,12}" required></label>
      <button class="btn btn-primary" type="submit">Crear usuario</button></form>
    <table class="why-table"><thead><tr><th>Nombre</th><th>Rol</th><th></th></tr></thead><tbody>${data.users.map((x) => `<tr>
      <td>${esc(x.name)}</td><td><select data-role-of="${esc(x.id)}">${Object.entries(data.roles).map(([k, l]) => `<option value="${k}" ${x.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><button class="btn btn-ghost" type="button" data-remove="${esc(x.id)}">Quitar</button></td></tr>`).join('')}</tbody></table>`
}

async function onPanelClick(e) {
  const t = e.target
  if (t.closest('[data-u="close"]')) { panel.hidden = true; return }
  if (t.closest('[data-u="logout"]')) { await postJSON('/api/v1/auth/logout', {}); location.reload(); return }
  const v = t.closest('[data-u-view]')
  if (v) { view = v.dataset.uView; return render() }
  const st = t.closest('[data-act]')
  if (st) {
    try { await postJSON(`/api/v1/activities/${st.dataset.act}/status`, { status: st.dataset.st }); document.dispatchEvent(new CustomEvent('notify-refresh')) } catch (err) { toast(err.message) }
    return render()
  }
  const rm = t.closest('[data-remove]')
  if (rm) {
    try { await postJSON(`/api/v1/users/${rm.dataset.remove}/remove`, {}) } catch (err) { toast(err.message) }
    return render()
  }
}

async function onPanelSubmit(e) {
  e.preventDefault()
  const f = e.target
  const val = (id) => f.querySelector(`#${id}`)?.value
  try {
    if (f.id === 'act-form') {
      await postJSON('/api/v1/activities', { title: val('act-title'), assignee: val('act-assignee'), scenario_id: val('act-scn') || null, due: val('act-due') || null })
      toast('Actividad asignada')
      document.dispatchEvent(new CustomEvent('notify-refresh'))
    } else if (f.id === 'first-admin') {
      await postJSON('/api/v1/users', { name: val('nu-name'), role: 'admin', pin: val('nu-pin') })
      await postJSON('/api/v1/auth/login', { name: val('nu-name'), pin: val('nu-pin') })
      location.reload()
      return
    } else if (f.id === 'new-user') {
      await postJSON('/api/v1/users', { name: val('nu-name'), role: val('nu-role'), pin: val('nu-pin') })
      toast('Usuario creado')
    }
  } catch (err) { toast(err.message) }
  render()
}

async function onPanelChange(e) {
  const sel = e.target.closest('[data-role-of]')
  if (!sel) return
  try { await postJSON(`/api/v1/users/${sel.dataset.roleOf}/role`, { role: sel.value }); toast('Rol actualizado') } catch (err) { toast(err.message); render() }
}

export async function initUsers() {
  try { me = await getJSON('/api/v1/auth/me') } catch { return }
  chip()
  document.addEventListener('need-login', () => { if (me.enabled) loginScreen() })
  if (me.enabled && !me.user) return loginScreen()
  const b = document.getElementById('open-user')
  if (!b || !me.local) return
  panel = document.createElement('section')
  panel.className = 'notify-panel user-panel hud hud-frame'
  panel.hidden = true
  panel.setAttribute('aria-label', 'Cuenta y actividades')
  document.body.appendChild(panel)
  panel.addEventListener('click', onPanelClick)
  panel.addEventListener('submit', onPanelSubmit)
  panel.addEventListener('change', onPanelChange)
  b.addEventListener('click', () => {
    panel.hidden = !panel.hidden
    if (!panel.hidden) { view = me.user?.role === 'participante' ? 'activities' : 'menu'; render() }
  })
  if (me.user?.role === 'participante') document.querySelector('[data-mode="simular"]')?.setAttribute('hidden', '')
}

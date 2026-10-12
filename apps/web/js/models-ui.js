// Conexiones de modelos e intérpretes (JEV, Claude, OpenAI, Gemini…): agregar con selector de proveedor, usar,
// probar y quitar. Las claves se envían una vez al servidor local y nunca vuelven: aquí solo se ve «✓ clave».
import { esc, getJSON, postJSON, toast } from './util.js'

let box = null, data = null

function rowHtml(c) {
  const active = data.active[c.role] === c.id
  return `<li class="mk-row" data-active="${active}">
    <div><b>${esc(c.label)}</b> <span class="mk-role">${esc(data.roles[c.role])}</span>
      <small>${esc(c.base_url)}${c.model ? ` · ${esc(c.model)}` : ''} · ${c.has_key ? '✓ clave guardada' : 'sin clave'}</small></div>
    <div class="mk-actions">${active ? `<button class="btn btn-ghost" type="button" data-mk="deactivate" data-role="${c.role}">En uso · quitar</button>`
      : `<button class="btn" type="button" data-mk="activate" data-id="${esc(c.id)}">Usar</button>`}
      <button class="btn btn-ghost" type="button" data-mk="test" data-id="${esc(c.id)}">Probar</button>
      <button class="btn btn-ghost" type="button" data-mk="edit" data-id="${esc(c.id)}">Editar</button>
      <button class="btn btn-ghost btn-icon" type="button" data-mk="delete" data-id="${esc(c.id)}" aria-label="Quitar ${esc(c.label)}">✕</button>
      <output class="src-meta" id="mk-out-${esc(c.id)}"></output></div></li>`
}

function formHtml(edit) {
  const p = edit?.provider || 'jev'
  const pre = data.presets[p]
  return `<div class="mk-form" data-edit="${esc(edit?.id || '')}">
    <label class="field"><span>Proveedor</span><select data-mkf="provider" ${edit ? 'disabled' : ''}>${Object.entries(data.presets).map(([k, v]) =>
      `<option value="${k}" ${k === p ? 'selected' : ''}>${esc(v.label)} · ${esc(data.roles[v.role])}</option>`).join('')}</select></label>
    <label class="field"><span>Nombre</span><input data-mkf="label" value="${esc(edit?.label || pre.label)}"></label>
    <label class="field"><span>URL base de la API</span><input data-mkf="base_url" type="url" value="${esc(edit?.base_url || pre.base_url)}" placeholder="https://…"></label>
    <label class="field"><span>Modelo</span><input data-mkf="model" value="${esc(edit?.model ?? pre.model)}" placeholder="${pre.role === 'jev' ? 'opcional' : 'id del modelo'}"></label>
    <label class="field"><span>Clave API ${edit?.has_key ? '<span class="state" data-on="true">✓ guardada</span>' : ''}</span>
      <input data-mkf="api_key" type="password" autocomplete="off" placeholder="${edit?.has_key ? 'dejar vacío para no cambiar' : 'pega tu clave'}"></label>
    <div class="tool-row"><button class="btn btn-primary" type="button" data-mk="save">${edit ? 'Guardar cambios' : 'Agregar'}</button>
      <button class="btn" type="button" data-mk="cancel">Cancelar</button></div></div>`
}

function render(edit = null, showForm = false) {
  const byRole = (r) => data.connections.filter((c) => c.role === r)
  box.innerHTML = `<legend>Modelos e intérpretes (JEV, IA)</legend>
    <p class="src-meta">${esc(data.note)} El asistente usa la conexión IA marcada «en uso» solo si permites datos agregados hacia APIs externas (abajo).</p>
    ${['jev', 'ai'].map((r) => `<h4 class="mk-h">${esc(data.roles[r])}</h4><ul class="mk-list">${byRole(r).map(rowHtml).join('') || '<li class="src-meta">Ninguna todavía.</li>'}</ul>`).join('')}
    ${showForm || edit ? formHtml(edit) : '<button class="btn" type="button" data-mk="new">＋ Agregar conexión</button>'}`
}

async function act(body, msg) {
  try {
    data = await postJSON('/api/v1/meta/models', body)
    render()
    if (msg) toast(msg)
  } catch (e) { toast(`No se guardó: ${e.message}`) }
}

async function onClick(e) {
  const b = e.target.closest('[data-mk]')
  if (!b) return
  const a = b.dataset.mk, id = b.dataset.id
  if (a === 'new') return render(null, true)
  if (a === 'cancel') return render()
  if (a === 'edit') return render(data.connections.find((c) => c.id === id))
  if (a === 'activate') return act({ action: 'activate', id }, 'Conexión en uso.')
  if (a === 'deactivate') return act({ action: 'deactivate', role: b.dataset.role }, 'Conexión desactivada.')
  if (a === 'delete') return act({ action: 'delete', id }, 'Conexión quitada.')
  if (a === 'test') {
    const out = box.querySelector(`#mk-out-${CSS.escape(id)}`)
    out.textContent = 'Probando…'
    try { const r = await postJSON('/api/v1/meta/models', { action: 'test', id }); out.textContent = `${r.ok ? '✓' : '✕'} ${r.detail}` }
    catch (err) { out.textContent = `✕ ${err.message}` }
    return
  }
  if (a === 'save') {
    const f = box.querySelector('.mk-form')
    const v = Object.fromEntries([...f.querySelectorAll('[data-mkf]')].map((x) => [x.dataset.mkf, x.value.trim()]))
    if (!v.api_key) delete v.api_key
    return act({ action: 'save', id: f.dataset.edit || undefined, ...v }, 'Conexión guardada en este equipo.')
  }
}

function onChange(e) {
  if (e.target.dataset.mkf !== 'provider') return
  const pre = data.presets[e.target.value]
  const f = box.querySelector('.mk-form')
  f.querySelector('[data-mkf="label"]').value = pre.label
  f.querySelector('[data-mkf="base_url"]').value = pre.base_url
  f.querySelector('[data-mkf="model"]').value = pre.model
}

/** Inserta la sección al inicio del formulario de «Claves». */
export async function mountModels(form) {
  box = document.createElement('fieldset')
  box.className = 'mk'
  form.prepend(box)
  box.addEventListener('click', onClick)
  box.addEventListener('change', onChange)
  try { data = await getJSON('/api/v1/meta/models'); render() }
  catch (e) { box.innerHTML = `<legend>Modelos e intérpretes</legend><p class="note">${esc(e.message)}</p>` }
}

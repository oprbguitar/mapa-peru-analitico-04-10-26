// Consola de conexiones (plan maestro §3), solo administración: una ficha por servicio, prueba en vivo y asignación
// de componentes. Las claves nunca llegan al navegador: solo «configurada / sin clave»; se editan en «Claves».
import { esc, getJSON, postJSON, toast } from './util.js'

const STATUS = {
  ok: ['--ok', 'En línea'], esperando: ['--info', 'Esperando'], descargado: ['--ok', 'Datos locales'], configurado: ['--ok', 'Configurado'],
  a_demanda: ['--ink-muted', 'A demanda'], desactualizado: ['--warn', 'Desactualizado'], error: ['--danger', 'Error'],
  sin_configurar: ['--warn', 'Sin configurar'], sin_descargar: ['--ink-muted', 'Sin descargar'],
}
let data = null
let cat = ''
let query = ''
let jevUrl = ''

const dlg = () => document.getElementById('connections-dialog')
const body = () => document.getElementById('connections-body')

function cardHtml(c) {
  const [tone, label] = STATUS[c.status] || ['--ink-muted', c.status]
  const auth = !c.auth.required ? 'Sin clave' : c.auth.configured ? `Clave configurada (${esc(c.auth.setting)})` : `Falta clave: ${esc(c.auth.setting)}`
  return `<article class="conn-card" style="--tone:var(${tone})" data-conn="${esc(c.id)}">
    <header><b>${esc(c.name)}</b><span class="conn-status">${esc(label)}</span></header>
    <p class="src-meta">${esc(c.institution)} · ${esc(c.purpose || '')}</p>
    <dl class="kv conn-kv">
      <dt>Dirección</dt><dd>${c.address ? esc(c.address) : '—'}</dd>
      <dt>Autenticación</dt><dd>${auth}</dd>
      <dt>Frecuencia</dt><dd>${esc(c.frequency || '—')}${c.limits ? ` · cada ${Math.round(c.limits.refresh_s)} s` : ''}</dd>
      <dt>Última sincronización</dt><dd>${esc((c.last_sync || '—').replace('T', ' ').slice(0, 16))}</dd>
      <dt>Si falla</dt><dd>${esc(c.fallback || '—')}</dd>
      ${c.used_by.length ? `<dt>La usa</dt><dd>${c.used_by.map(esc).join(' · ')}</dd>` : ''}
    </dl>
    ${c.error ? `<p class="note">${esc(c.error)}</p>` : ''}
    <div class="tool-row"><button class="btn" type="button" data-test="${esc(c.id)}">Probar</button>
      ${c.auth.required || c.setting_url ? '<button class="btn btn-ghost" type="button" data-keys>Editar en Claves</button>' : ''}
      <output class="src-meta" id="test-${esc(c.id)}"></output></div>
  </article>`
}

function render() {
  const list = data.cards.filter((c) => (!cat || c.category === cat) && (!query || `${c.name} ${c.institution} ${c.id}`.toLowerCase().includes(query)))
  const comp = data.components
  body().innerHTML = `
    <section class="conn-components"><h3>Quién hace qué</h3><dl class="kv">
      ${Object.values(comp).map((x) => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</dd>`).join('')}</dl>
      <label class="field"><span>JEV externo (URL; vacío = jev-ref local)</span><input id="jev-url" type="url" placeholder="http://127.0.0.1:9900/jev" value="${esc(jevUrl)}"></label>
      <button class="btn" type="button" id="jev-save">Guardar intérprete</button>
      <h3>Fuentes por simulación</h3><dl class="kv">${Object.entries(data.simulations).map(([k, v]) =>
        `<dt>${esc(k)}</dt><dd>${v.length ? v.map(esc).join(', ') : 'solo supuestos declarados (sin fuentes externas)'}</dd>`).join('')}</dl></section>
    <div class="conn-filter"><input type="search" id="conn-q" placeholder="Buscar conexión" value="${esc(query)}" aria-label="Buscar conexión">
      <div class="seg" role="group" aria-label="Categoría">${[['', 'Todas'], ...Object.entries(data.categories)].map(([k, l]) =>
        `<button type="button" data-cat="${k}" aria-pressed="${cat === k}">${esc(l)}</button>`).join('')}</div>
      <p class="src-meta">${Object.entries(data.counts).map(([k, n]) => `${esc(STATUS[k]?.[1] || k)}: ${n}`).join(' · ')}</p></div>
    <div class="conn-grid">${list.map(cardHtml).join('') || '<p class="src-meta">Sin coincidencias.</p>'}</div>`
}

export async function openConnections() {
  dlg().showModal()
  body().innerHTML = '<p class="loading">Leyendo conexiones</p>'
  try {
    const [d, st] = await Promise.all([getJSON('/api/v1/admin/connections'), getJSON('/api/v1/meta/settings').catch(() => ({ values: {} }))])
    data = d
    jevUrl = st.values?.jev_url || ''
    render()
  } catch (e) {
    body().innerHTML = `<p class="note">${esc(e.message)}</p>`
  }
}

export function initConnections() {
  const b = document.getElementById('open-connections')
  if (!b) return
  b.addEventListener('click', openConnections)
  dlg().addEventListener('click', async (e) => {
    const c = e.target.closest('[data-cat]')
    if (c) { cat = c.dataset.cat; return render() }
    const t = e.target.closest('[data-test]')
    if (t) {
      const outEl = document.getElementById(`test-${t.dataset.test}`)
      t.setAttribute('aria-busy', 'true')
      try {
        const r = await postJSON(`/api/v1/admin/connections/${t.dataset.test}/test`, {})
        outEl.textContent = `${r.ok ? '✓' : '✕'} ${r.status} · ${r.ms} ms${r.error ? ` · ${r.error}` : ''}`
      } catch (err) { outEl.textContent = err.message }
      t.removeAttribute('aria-busy')
      return
    }
    if (e.target.closest('[data-keys]')) { dlg().close(); document.getElementById('open-settings')?.click(); return }
    if (e.target.closest('#jev-save')) {
      try {
        await postJSON('/api/v1/meta/settings', { jev_url: document.getElementById('jev-url').value.trim() })
        toast('Intérprete guardado')
        data = await getJSON('/api/v1/admin/connections')
        render()
      } catch (err) { toast(err.message) }
    }
  })
  dlg().addEventListener('input', (e) => {
    if (e.target.id !== 'conn-q') return
    query = e.target.value.trim().toLowerCase()
    const pos = e.target.selectionStart
    render()
    const q = document.getElementById('conn-q')
    q.focus()
    q.setSelectionRange(pos, pos)
  })
}

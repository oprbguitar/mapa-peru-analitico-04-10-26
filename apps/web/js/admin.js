// Administrador de IA (/admin/engineering/ai): estado, funciones, proveedores, presupuesto, modelos locales y voz.
// Cada acción pasa por el servidor (auditada). Las claves nunca vuelven al navegador: solo «configurada / sin clave».
import { esc, fmt, getJSON, postJSON, toast } from './util.js'
import { speak } from './assistant.js'

const TABS = [['estado', 'Estado'], ['funciones', 'Funciones'], ['proveedores', 'Proveedores'], ['local', 'Modelos locales'], ['voz', 'Voz']]
const MODE_HELP = { OFF: 'apagado', LOCAL: 'solo este equipo', LOCAL_REMOTE: 'otro equipo de tu red', CLOUD_API: 'API de tercero',
  PRIVATE_CLOUD: 'nube propia', HYBRID: 'combinación autorizada', AUTO: 'elige entre los permitidos (nunca habilita gasto)' }
let tab = 'estado'
let view = null
let pin = ''

const dlg = () => document.getElementById('admin-dialog')
const box = () => document.getElementById('admin-body')

async function act(action, body) {
  try {
    const r = await postJSON(`/api/v1/admin/engineering/ai/${action}`, { ...body, pin })
    return r
  } catch (e) {
    toast(e.message, 6000)
    throw e
  }
}

const badge = (ok, yes, no) => `<span class="state" data-on="${!!ok}">${ok ? '✓ ' + yes : '— ' + no}</span>`

function estado(v) {
  const r = v.resources
  return `<div class="triad">
    <div><div class="label">IA</div><div class="value">${v.kill_switch ? 'DETENIDA' : 'ACTIVA'}</div><div class="unit">interruptor general</div></div>
    <div><div class="label">Gasto hoy</div><div class="value">US$ ${fmt(v.spend.day.settled_usd, 2)}</div><div class="unit">+ ${fmt(v.spend.day.pending_usd, 2)} pendiente · tope ${fmt(v.budget.daily_usd, 2)}</div></div>
    <div><div class="label">RAM libre</div><div class="value">${r.ram_free_gb ?? '—'} GB</div><div class="unit">de ${r.ram_total_gb ?? '—'} · ${r.cpus} CPU</div></div></div>
    <fieldset><legend>Controles generales</legend>
      <label class="opt opt-check"><input type="checkbox" id="ad-kill" ${v.kill_switch ? 'checked' : ''}><span class="opt-label">Detener toda la IA (kill switch)<small>Las funciones esenciales del mapa siguen funcionando sin IA.</small></span></label>
      <label class="opt opt-check"><input type="checkbox" id="ad-paid" ${v.allow_paid ? 'checked' : ''}><span class="opt-label">Permitir proveedores de pago<small>Aun así, cada uso reserva presupuesto antes de llamar.</small></span></label></fieldset>
    <fieldset><legend>Presupuesto (US$)</legend><div class="form-grid">
      ${[['per_request_usd', 'Tope por solicitud'], ['daily_usd', 'Tope diario'], ['monthly_usd', 'Tope mensual']].map(([k, l]) =>
        `<label class="field"><span>${l}</span><input type="number" step="0.01" min="0" data-budget="${k}" value="${v.budget[k]}"></label>`).join('')}</div>
      <p class="src-meta">Tarifas: ${esc(v.budget.tariff_source)} (${esc(v.budget.tariff_date)}). Sin presupuesto, los proveedores de pago no se usan.</p>
      <button class="btn" type="button" id="ad-budget">Guardar presupuesto</button></fieldset>
    <section class="section"><h3>Últimos movimientos</h3>${v.spend.recent.length ? `<table class="why-table"><thead><tr><th>Función</th><th>Proveedor</th><th>Estado</th><th>US$</th></tr></thead><tbody>
      ${v.spend.recent.map((x) => `<tr><td>${esc(x.feature)}</td><td>${esc(x.provider)}</td><td>${esc(x.state)}</td><td>${fmt(x.settled_usd || x.reserved_usd, 4)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Sin gasto registrado.</p>'}</section>
    <p class="src-meta">Política ${esc(v.policy_version)} · ${esc(v.stored_in)}${v.admin_pin_required ? ' · requiere PIN' : ' · sin PIN (define admin_pin en config.local.json para exigirlo)'}</p>`
}

function funciones(v) {
  const provs = v.providers
  return `<p class="src-meta">Cada función usa el primer proveedor de su lista que cumpla TODO: habilitado, aprobado, con la capacidad, clase de dato permitida, modo, clave, salud y presupuesto. Nunca se compensa una condición con otra.</p>
    ${Object.entries(v.features).map(([k, f]) => `<fieldset data-feat="${esc(k)}"><legend>${esc(f.label)}</legend>
      <div class="form-grid">
        <label class="opt opt-check"><input type="checkbox" data-f="enabled" ${f.enabled ? 'checked' : ''}><span class="opt-label">Habilitada</span></label>
        <label class="field"><span>Modo</span><select data-f="mode">${v.modes.map((m) => `<option value="${m}" ${f.mode === m ? 'selected' : ''}>${m} · ${MODE_HELP[m]}</option>`).join('')}</select></label>
        <label class="field"><span>Clase de dato</span><select data-f="data_class">${v.data_classes.map((m) => `<option ${f.data_class === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <label class="field"><span>Orden de proveedores (fallbacks aprobados)</span><select data-f="order" multiple size="${Math.min(6, provs.length)}">
        ${provs.filter((p) => p.capabilities.includes(f.capability)).map((p) => `<option value="${esc(p.id)}" ${f.order.includes(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        <small>Capacidad requerida: ${esc(f.capability)}. Ctrl+clic para elegir varios; el orden sigue el de la lista.</small></label>
      <p class="src-meta">Ruta efectiva: ${f.effective ? `<b>${esc(f.effective.provider)}</b> (${esc(f.effective.mode)})` : `<b>sin ruta</b> — ${esc(f.error?.code || 'apagada')}: ${esc(f.error?.message || '')}`}
        ${(f.effective?.discarded || f.error?.detail?.discarded || []).map((d) => `<br>· ${esc(d.provider)}: ${esc(d.reason)}`).join('')}</p>
      <button class="btn" type="button" data-save-feat>Guardar</button></fieldset>`).join('')}`
}

function proveedores(v) {
  return v.providers.map((p) => `<fieldset data-prov="${esc(p.id)}"><legend>${esc(p.name)} · ${esc(p.mode)}${p.paid ? ' · de pago' : ' · sin costo'}</legend>
    <p class="src-meta">${esc(p.notes || '')} Capacidades: ${esc(p.capabilities.join(', '))}. Clases: ${esc(p.allowed_data_classes.join(', '))}.
      Circuito: ${esc(p.circuit.state)}${p.circuit.last_error ? ` (${esc(p.circuit.last_error)})` : ''}. Verificado: ${esc(p.last_verified || '—')}.</p>
    <div class="form-grid">
      <label class="opt opt-check"><input type="checkbox" data-p="enabled" ${p.enabled ? 'checked' : ''}><span class="opt-label">Habilitado</span></label>
      <label class="field"><span>Estado</span><select data-p="status">${v.statuses.map((s) => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      ${p.adapter !== 'browser' ? `<label class="field"><span>URL base</span><input type="text" data-p="base_url" value="${esc(p.base_url)}"></label>
      <label class="field"><span>Modelo</span><input type="text" data-p="model" value="${esc(p.model || '')}"></label>` : ''}
      ${p.capabilities.some((c) => ['TEXT_TO_SPEECH', 'VOICE_AGENT'].includes(c)) && p.adapter !== 'browser' ? `<label class="field"><span>Voz</span><input type="text" data-p="voice" value="${esc(p.voice || '')}"></label>` : ''}
      ${p.stt_model !== undefined ? `<label class="field"><span>Modelo de transcripción</span><input type="text" data-p="stt_model" value="${esc(p.stt_model || '')}"></label>` : ''}
      ${p.tts_model !== undefined ? `<label class="field"><span>Modelo de voz</span><input type="text" data-p="tts_model" value="${esc(p.tts_model || '')}"></label>` : ''}
      ${p.model_mini !== undefined ? `<label class="field"><span>Nivel</span><select data-p="tier"><option value="mini" ${p.tier === 'mini' ? 'selected' : ''}>MINI (${esc(p.model_mini)})</option><option value="standard" ${p.tier !== 'mini' ? 'selected' : ''}>ESTÁNDAR (${esc(p.model)})</option></select></label>
      <label class="field"><span>Tope por sesión (US$)</span><input type="number" step="0.05" min="0" data-p="session_cap_usd" value="${p.session_cap_usd ?? 0.5}"></label>` : ''}
      ${p.needs_key ? `<label class="field"><span>Clave ${badge(p.has_key, 'configurada', 'sin clave')}</span><input type="password" data-key placeholder="dejar vacío para no cambiar" autocomplete="off"><small>${esc(p.key_hint || '')}</small></label>` : ''}
    </div>
    <div class="ai-actions" style="padding:0"><button class="btn btn-primary" type="button" data-save-prov>Guardar</button>
      <button class="btn" type="button" data-test>Probar conexión</button><span class="src-meta" data-test-out></span></div></fieldset>`).join('')
}

async function local(v) {
  const p = v.providers.find((x) => x.adapter === 'ollama')
  const st = await getJSON(`/api/v1/admin/engineering/ai/ollama?id=${encodeURIComponent(p?.id || 'ollama-local')}`)
  if (!st.running) return `<p class="note">Ollama no responde en ${esc(p?.base_url || '')}. Instálalo desde ollama.com y vuelve a abrir esta pestaña.</p>`
  return `<section class="section"><h3>Instalados</h3><table class="why-table"><thead><tr><th>Modelo</th><th>Tamaño</th><th>Parámetros</th><th></th></tr></thead><tbody>
    ${st.installed.map((m) => `<tr><td>${esc(m.name)}${p.model === m.name ? ' ✓' : ''}</td><td>${fmt(m.size_gb, 1)} GB</td><td>${esc(m.params || '')} ${esc(m.quant || '')}</td>
      <td><button class="btn" type="button" data-load="${esc(m.name)}">Cargar</button> <button class="btn btn-ghost" type="button" data-use="${esc(m.name)}">Usar</button></td></tr>`).join('')}</tbody></table></section>
    <section class="section"><h3>En memoria</h3>${st.loaded.length ? st.loaded.map((m) => `<div class="shift-row"><span>${esc(m.name)}</span><span class="num">${fmt(m.size_gb, 1)} GB · VRAM ${fmt(m.vram_gb, 1)}</span>
      <button class="btn btn-ghost" type="button" data-unload="${esc(m.name)}">Descargar de memoria</button></div>`).join('') : '<p class="empty">Ningún modelo cargado (consumo de RAM mínimo).</p>'}</section>
    <fieldset><legend>Descargar un modelo (ocupa disco y red)</legend><label class="field"><span>Nombre en Ollama</span><input type="text" id="ad-pull" placeholder="qwen3:8b"></label>
      <button class="btn" type="button" id="ad-pull-go">Descargar</button><p class="src-meta">Queda en estado EVALUATING hasta que lo pruebes.</p></fieldset>`
}

function voz(v) {
  const f = v.features
  const r = (k) => (f[k].effective ? `${esc(f[k].effective.provider)} (${esc(f[k].effective.mode)})` : `sin ruta: ${esc(f[k].error?.code || 'apagada')}`)
  return `<p class="src-meta">El asistente usa estas cuatro funciones. Local y sin costo por defecto; los proveedores de pago entran solo si los habilitas, con clave y presupuesto.</p>
    <dl class="kv"><dt>Voz a texto</dt><dd>${r('voz_stt')}</dd><dt>Entender órdenes</dt><dd>${r('voz_comandos')}</dd><dt>Texto a voz</dt><dd>${r('voz_tts')}</dd><dt>Tiempo real</dt><dd>${r('voz_realtime')}</dd></dl>
    <fieldset><legend>Prueba</legend><label class="field"><span>Texto</span><input type="text" id="ad-say" value="Hola, soy el asistente del Mapa Perú Analítico."></label>
      <button class="btn" type="button" id="ad-say-go">Escuchar</button></fieldset>
    <fieldset><legend>Opciones locales (sin Internet)</legend><ul class="steps">
      <li>Whisper local: <code>docker run -p 8000:8000 ghcr.io/speaches-ai/speaches:latest-cpu</code> y habilita «Whisper local».</li>
      <li>Voz local en español: <code>docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu</code> y habilita «Kokoro TTS local» (voz ef_dora).</li>
      <li>Órdenes: Ollama con un modelo con herramientas (qwen3, llama3.1+). Las órdenes frecuentes se entienden sin modelo.</li></ul></fieldset>
    <fieldset><legend>Opciones de pago</legend><ul class="steps"><li>OpenAI: texto, transcripción (gpt-4o-mini-transcribe) y voz (gpt-4o-mini-tts).</li>
      <li>OpenAI Realtime: voz a voz como GOdEyes; nivel MINI por defecto y tope por sesión.</li><li>Groq: Whisper muy rápido · ElevenLabs: voz de alta calidad.</li></ul></fieldset>`
}

async function render() {
  box().innerHTML = '<p class="loading">Leyendo el gateway</p>'
  view = await getJSON('/api/v1/admin/engineering/ai')
  const nav = `<div class="chips" role="tablist">${TABS.map(([k, l]) => `<button type="button" class="chip" role="tab" data-tab="${k}" aria-pressed="${k === tab}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    ${view.admin_pin_required ? `<label class="field"><span>PIN de administrador</span><input type="password" id="ad-pin" value="${esc(pin)}" autocomplete="off"></label>` : ''}`
  const content = tab === 'estado' ? estado(view) : tab === 'funciones' ? funciones(view) : tab === 'proveedores' ? proveedores(view) : tab === 'voz' ? voz(view) : await local(view)
  box().innerHTML = `${nav}<div class="settings">${content}</div>`
  bind()
}

function bind() {
  const b = box()
  b.querySelectorAll('[data-tab]').forEach((x) => x.addEventListener('click', () => { tab = x.dataset.tab; render() }))
  document.getElementById('ad-pin')?.addEventListener('input', (e) => (pin = e.target.value))
  document.getElementById('ad-kill')?.addEventListener('change', async (e) => { await act('kill', { on: e.target.checked }); render() })
  document.getElementById('ad-paid')?.addEventListener('change', async (e) => { await act('allow_paid', { on: e.target.checked }); render() })
  document.getElementById('ad-budget')?.addEventListener('click', async () => {
    const body = Object.fromEntries([...b.querySelectorAll('[data-budget]')].map((i) => [i.dataset.budget, Number(i.value)]))
    await act('budget', body)
    toast('Presupuesto guardado.')
    render()
  })
  b.querySelectorAll('[data-feat]').forEach((fs) => fs.querySelector('[data-save-feat]').addEventListener('click', async () => {
    const order = [...fs.querySelector('[data-f="order"]').selectedOptions].map((o) => o.value)
    await act('feature', { id: fs.dataset.feat, enabled: fs.querySelector('[data-f="enabled"]').checked, mode: fs.querySelector('[data-f="mode"]').value,
      data_class: fs.querySelector('[data-f="data_class"]').value, order })
    toast('Función guardada.')
    render()
  }))
  b.querySelectorAll('[data-prov]').forEach((fs) => {
    const id = fs.dataset.prov
    fs.querySelector('[data-save-prov]').addEventListener('click', async () => {
      const body = { id }
      fs.querySelectorAll('[data-p]').forEach((i) => (body[i.dataset.p] = i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value))
      await act('provider', body)
      const k = fs.querySelector('[data-key]')
      if (k?.value) await act('key', { id, key: k.value })
      toast('Proveedor guardado.')
      render()
    })
    fs.querySelector('[data-test]').addEventListener('click', async () => {
      const out = fs.querySelector('[data-test-out]')
      out.textContent = 'probando…'
      const r = await act('test', { id }).catch(() => null)
      out.textContent = r ? `${r.ok ? '✓' : '✗'} ${r.detail} · ${r.latency_ms} ms` : 'error'
    })
  })
  b.querySelectorAll('[data-load]').forEach((x) => x.addEventListener('click', async () => { x.setAttribute('aria-busy', 'true'); await act('load', { model: x.dataset.load }).catch(() => null); render() }))
  b.querySelectorAll('[data-unload]').forEach((x) => x.addEventListener('click', async () => { await act('unload', { model: x.dataset.unload }).catch(() => null); render() }))
  b.querySelectorAll('[data-use]').forEach((x) => x.addEventListener('click', async () => { await act('provider', { id: 'ollama-local', model: x.dataset.use }); render() }))
  document.getElementById('ad-pull-go')?.addEventListener('click', async (e) => {
    const m = document.getElementById('ad-pull').value.trim()
    if (!m || !confirm(`¿Descargar «${m}» con Ollama? Puede ocupar varios GB.`)) return
    e.currentTarget.setAttribute('aria-busy', 'true')
    await act('pull', { model: m, confirm: true }).catch(() => null)
    render()
  })
  document.getElementById('ad-say-go')?.addEventListener('click', () => speak(document.getElementById('ad-say').value))
}

export function openAdmin() {
  dlg().showModal()
  render()
}

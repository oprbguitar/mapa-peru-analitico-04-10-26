// «¿De dónde sale cada dato?» y claves BYOK (se guardan solo en data/config.local.json del backend).
import { esc, getJSON, kindBadge, postJSON, toast } from './util.js'

export function initDialogs() {
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close()
    })
  }
  document.getElementById('open-sources').addEventListener('click', openSources)
  document.getElementById('open-settings').addEventListener('click', openSettings)
}

async function openSources() {
  const dlg = document.getElementById('sources-dialog')
  const body = document.getElementById('sources-body')
  body.innerHTML = '<p class="loading">Leyendo el registro de fuentes</p>'
  dlg.showModal()
  const d = await getJSON('/api/v1/meta/sources')
  body.innerHTML = `
    <p class="src-meta">Ningún número aparece en el mapa sin responder: quién lo publicó, de qué fecha y período es, a qué nivel geográfico,
      cómo se transformó y cuándo se descargó. Los originales se guardan sin modificar en <code>data/raw/&lt;fuente&gt;/&lt;fecha&gt;/</code>.</p>
    <div class="kind-key">${Object.keys(d.kinds).map((k) => kindBadge(k, d.kinds[k])).join('')}</div>
    <table class="src-table"><thead><tr><th>Fuente</th><th>Naturaleza</th><th>Nivel · frecuencia</th><th>Cobertura</th><th>Estado</th></tr></thead>
    <tbody>${d.sources.map((s) => `<tr>
      <td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><small>${esc(s.institution)}</small>
        ${s.license ? `<small>Licencia: ${esc(s.license)}</small>` : ''}${s.notes ? `<small>${esc(s.notes)}</small>` : ''}</td>
      <td>${kindBadge(s.kind)}</td>
      <td>${esc(s.geographic_level || '—')}<small>${esc(s.update_frequency || '')}</small></td>
      <td class="num">${esc(s.coverage_start || '—')} → ${esc(s.coverage_end || '—')}<small>descarga: ${esc((s.last_downloaded || '—').slice(0, 10))}</small>
        ${s.checksum ? `<small title="${esc(s.checksum)}">sha256 ${esc(s.checksum.slice(0, 10))}…</small>` : ''}</td>
      <td>${esc(s.status)}${s.requires_key ? `<small>${s.configured ? 'clave configurada' : 'requiere clave'}</small>` : ''}</td></tr>`).join('')}</tbody></table>`
}

const FIELDS = [
  ['Proveedores en vivo (opcionales)', [
    ['aisstream_key', 'Clave aisstream.io (embarcaciones AIS)', 'password', 'Gratuita en aisstream.io'],
    ['tomtom_key', 'Clave TomTom (tráfico)', 'password', 'Sujeta a términos y cuotas de TomTom'],
    ['firms_key', 'MAP_KEY NASA FIRMS (focos de calor)', 'password', 'Gratuita en firms.modaps.eosdis.nasa.gov'],
    ['senamhi_csv_url', 'CSV de estaciones SENAMHI (URL o ruta local)', 'text', 'Columnas: estación, fecha, temperatura, humedad, precipitación, latitud, longitud'],
  ]],
  ['IA', [
    ['ollama_url', 'URL de Ollama', 'text', 'Por defecto http://127.0.0.1:11434'],
    ['ollama_model', 'Modelo local', 'text', 'Vacío = el primero instalado'],
    ['external_base_url', 'API externa compatible OpenAI (base URL)', 'text', 'OpenRouter, DeepSeek, Qwen, NVIDIA…'],
    ['external_api_key', 'Clave de la API externa', 'password', ''],
    ['external_model', 'Modelo externo', 'text', ''],
  ]],
]

async function openSettings() {
  const dlg = document.getElementById('settings-dialog')
  const form = document.getElementById('settings-form')
  const s = await getJSON('/api/v1/meta/settings')
  form.innerHTML = `<p class="src-meta">Se guardan en ${esc(s.stored_in)}. Las claves nunca vuelven al navegador: solo se muestra si están configuradas.</p>
    ${FIELDS.map(([legend, fields]) => `<fieldset><legend>${esc(legend)}</legend>${fields.map(([k, label, type, hint]) => `
      <label class="field"><span>${esc(label)} ${type === 'password' ? `<span class="state" data-on="${!!s.secrets[k]}">${s.secrets[k] ? '✓ configurada' : '— sin configurar'}</span>` : ''}</span>
        <input name="${k}" type="${type}" autocomplete="off" value="${type === 'password' ? '' : esc(s.values[k] || '')}" placeholder="${type === 'password' ? 'dejar vacío para no cambiar' : ''}">
        ${hint ? `<small>${esc(hint)}</small>` : ''}</label>`).join('')}</fieldset>`).join('')}
    <fieldset><legend>Datos agregados hacia APIs externas</legend>
      <label class="field"><span>Permitir enviar estadísticas agregadas a la API externa</span>
        <select name="ai_allow_external"><option value="false" ${s.values.ai_allow_external !== 'true' ? 'selected' : ''}>No (solo IA local)</option>
        <option value="true" ${s.values.ai_allow_external === 'true' ? 'selected' : ''}>Sí, solo datos agregados</option></select></label></fieldset>
    <div class="ai-actions"><button class="btn btn-primary" type="submit">Guardar</button><button class="btn" type="button" data-close>Cancelar</button></div>`
  form.onsubmit = async (e) => {
    e.preventDefault()
    const data = Object.fromEntries([...new FormData(form)].filter(([, v]) => String(v).trim() !== ''))
    try {
      await postJSON('/api/v1/meta/settings', data)
      toast('Ajustes guardados en este equipo.')
      dlg.close()
    } catch (err) {
      toast(`No se guardó: ${err.message}`)
    }
  }
  dlg.showModal()
}

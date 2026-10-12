// Edición municipal: marca de la municipalidad, arranque en su distrito y kit de presentación para la venta.
// Las cifras del kit son SOLO las publicadas (con su fuente); propuesta e inversión quedan «a definir».
import { map, mapReady } from './map.js'
import { esc, fmt, getJSON, postJSON, toast } from './util.js'
import { snapshotMap } from './reports.js'

let cfg = { configured: false }
const dlg = () => document.getElementById('municipal-dialog')
const body = () => document.getElementById('municipal-body')

export const municipalConfig = () => cfg

function applyBrand() {
  const brand = document.querySelector('.brand')
  if (!brand || !cfg.configured) return
  document.body.dataset.municipal = cfg.ubigeo
  let tag = brand.querySelector('.muni-tag')
  if (!tag) { tag = document.createElement('span'); tag.className = 'muni-tag'; brand.appendChild(tag) }
  tag.innerHTML = `${cfg.has_logo ? `<img src="/api/v1/municipal/logo?t=${Date.parse(cfg.updated_at) || 0}" alt="">` : ''}<span>${esc(cfg.name)}</span>`
  tag.title = cfg.name
}

async function flyToDistrict() {
  const b = cfg.territory?.bbox
  if (!b) return
  await mapReady
  map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200 })
}

export async function initMunicipal() {
  try { cfg = await getJSON('/api/v1/municipal') } catch { return }
  if (!cfg.configured) return
  applyBrand()
  flyToDistrict()
}

function formHtml() {
  const t = cfg.territory
  return `<p class="src-meta">Personaliza esta instalación para una municipalidad: su nombre y logo en la barra y en los informes,
      el mapa arranca en su territorio y el simulador propone su distrito como zona.</p>
    <form class="settings" id="muni-form" autocomplete="off"><fieldset><legend>Municipalidad</legend>
      <label class="field"><span>Nombre</span><input name="name" required minlength="3" maxlength="90" value="${esc(cfg.name || '')}" placeholder="Municipalidad Distrital de …"></label>
      <label class="field"><span>Distrito o provincia</span><input id="muni-search" placeholder="Escribe el distrito" value="${esc(t ? `${t.nombre} (${t.provincia}, ${t.departamento})` : '')}"></label>
      <input type="hidden" name="ubigeo" value="${esc(cfg.ubigeo || '')}"><ul class="muni-results" id="muni-results"></ul>
      <label class="field"><span>Área responsable</span><input name="responsable" maxlength="80" value="${esc(cfg.responsable || '')}" placeholder="Gerencia de Seguridad Ciudadana"></label>
      <label class="field"><span>Cargo de contacto</span><input name="cargo" maxlength="80" value="${esc(cfg.cargo || '')}"></label>
      <label class="field"><span>Correo de contacto</span><input name="email" type="email" maxlength="180" value="${esc(cfg.email || '')}"></label>
      <label class="field"><span>Logo (PNG o JPEG, máx. 300 KB)</span><input id="muni-logo" type="file" accept="image/png,image/jpeg"></label>
      ${cfg.has_logo ? '<img class="muni-logo-preview" src="/api/v1/municipal/logo" alt="Logo actual">' : ''}
      <div class="tool-row"><button class="btn btn-primary" type="submit">Guardar edición municipal</button></div></fieldset></form>
    ${cfg.configured ? `<section class="section"><h3>Perfil del territorio (cifras publicadas)</h3><div id="muni-profile"><p class="loading">Leyendo</p></div>
      <div class="tool-row"><button class="btn btn-primary" type="button" id="muni-kit">Kit de presentación (imprimible)</button></div></section>` : ''}`
}

async function renderProfile() {
  const box = document.getElementById('muni-profile')
  if (!box) return
  try {
    const p = await getJSON('/api/v1/municipal/profile')
    box.innerHTML = factsTable(p) + `<p class="src-meta">Fuentes: ${p.provenance.map((s) => esc(`${s.name} (${s.institution})`)).join(' · ')}.</p>`
  } catch (e) { box.innerHTML = `<p class="note">${esc(e.message)}</p>` }
}

const factsTable = (p) => `<table class="why-table"><tbody>${p.facts.map((f) => `<tr><td>${esc(f.label)}</td><td>${fmt(f.value, 0)} ${esc(f.unit)}${f.note ? `<small> · ${esc(f.note)}</small>` : ''}</td></tr>`).join('')}</tbody></table>`

async function readLogo(input) {
  const f = input.files?.[0]
  if (!f) return null
  if (f.size > 300_000) throw new Error('Logo: máximo 300 KB')
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f) })
}

function kitHtml(k, img) {
  const m = k.municipality
  const t = k.profile.territory
  return `<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><title>${esc(m.name)} · Propuesta · Mapa Perú Analítico</title>
<style>
  body { margin:0; padding:36px; max-width:980px; font:15px/1.55 "Noto Sans","Segoe UI",sans-serif; color:#14181d; }
  header { display:flex; gap:18px; align-items:center; border-bottom:4px solid #14181d; padding-bottom:14px; }
  header img { max-height:72px; max-width:160px; }
  h1 { font:700 28px/1.2 "Space Grotesk","Segoe UI",sans-serif; margin:0; } h2 { font:700 19px "Space Grotesk","Segoe UI",sans-serif; margin:28px 0 8px; }
  .meta { color:#5a6470; font-size:13px; } table { width:100%; border-collapse:collapse; } th, td { text-align:left; padding:7px 8px; border-bottom:1px solid #d5dbe1; vertical-align:top; }
  .cap { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 22px; } .cap div { border-left:3px solid #0b7285; padding-left:10px; }
  .cap b { display:block; } img.map { width:100%; border:1px solid #d5dbe1; margin:10px 0; } .hint { font-size:12px; color:#5a6470; }
  @media print { body { padding:0; } .hint { display:none; } section, table, img { break-inside:avoid; } }
</style></head><body>
<p class="hint">Guardar: Ctrl+S · PDF: Ctrl+P → «Guardar como PDF»</p>
<header>${m.has_logo ? '<img src="LOGO" alt="">' : ''}<div><p class="meta">Propuesta de implementación · ${esc(k.generated_at.slice(0, 10))}</p>
  <h1>${esc(m.name)}</h1><p class="meta">Mapa Perú Analítico · inteligencia territorial y simulación local${m.responsable ? ` · para ${esc(m.responsable)}` : ''}</p></div></header>
<h2>El territorio hoy (cifras publicadas)</h2>
<p class="meta">${esc(t.nombre)}, ${esc(t.provincia)}, ${esc(t.departamento)} · ubigeo ${esc(k.profile.ubigeo)}</p>
${img ? `<img class="map" src="${img}" alt="Mapa del territorio">` : ''}
<table><tbody>${k.profile.facts.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${fmt(f.value, 0)} ${esc(f.unit)}${f.note ? ` · <span class="meta">${esc(f.note)}</span>` : ''}</td></tr>`).join('')}</tbody></table>
<p class="meta">Fuentes: ${k.profile.provenance.map((s) => esc(`${s.name} — ${s.institution}${s.downloaded ? `, descargado ${s.downloaded.slice(0, 10)}` : ''}`)).join(' · ')}.</p>
<h2>Qué puede hacer la municipalidad con la plataforma</h2>
<div class="cap">${k.capabilities.map((c) => `<div><b>${esc(c.title)}</b>${esc(c.detail)}</div>`).join('')}</div>
<h2>Requisitos y funcionamiento</h2><ul>${k.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<h2>Privacidad y uso responsable</h2><p>${esc(k.privacy)}</p>
<h2>Propuesta</h2><table><tbody>${k.proposal.map((p) => `<tr><th scope="row">${esc(p.item)}</th><td>${esc(p.value)}</td></tr>`).join('')}</tbody></table>
<p class="meta">Documento generado desde la instalación local. Las cifras provienen de fuentes públicas citadas; no incluye proyecciones de impacto.</p>
</body></html>`
}

async function openKit() {
  const win = window.open('', '_blank')
  try {
    await flyToDistrict()
    await new Promise((r) => map.once('idle', r))
    const [k, img] = await Promise.all([getJSON('/api/v1/municipal/kit'), snapshotMap()])
    let html = kitHtml(k, img)
    if (k.municipality.has_logo) {
      const blob = await (await fetch('/api/v1/municipal/logo')).blob()
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob) })
      html = html.replace('src="LOGO"', `src="${dataUrl}"`)
    }
    const href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    if (win) win.location.href = href
    else window.open(href, '_blank')
    setTimeout(() => URL.revokeObjectURL(href), 60000)
  } catch (e) { win?.close(); toast(e.message) }
}

export async function openMunicipal() {
  dlg().showModal()
  body().innerHTML = formHtml()
  renderProfile()
  const search = document.getElementById('muni-search')
  const results = document.getElementById('muni-results')
  let timer = 0
  search.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const q = search.value.trim()
      if (q.length < 3) { results.innerHTML = ''; return }
      const r = await getJSON(`/api/v1/map/geocode?q=${encodeURIComponent(q)}`).catch(() => ({ results: [] }))
      results.innerHTML = r.results.filter((x) => x.ubigeo && [4, 6].includes(x.ubigeo.length)).slice(0, 6)
        .map((x) => `<li><button type="button" class="btn btn-ghost" data-ub="${esc(x.ubigeo)}">${esc(x.name)} <small>${esc(x.detail)}</small></button></li>`).join('')
    }, 250)
  })
  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ub]')
    if (!b) return
    document.querySelector('#muni-form [name="ubigeo"]').value = b.dataset.ub
    search.value = b.textContent.trim()
    results.innerHTML = ''
  })
  document.getElementById('muni-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = new FormData(e.target)
    try {
      const logo = await readLogo(document.getElementById('muni-logo'))
      cfg = await postJSON('/api/v1/municipal', { ...Object.fromEntries(f), ...(logo ? { logo } : {}) })
      toast('Edición municipal guardada')
      applyBrand()
      flyToDistrict()
      openMunicipal()
    } catch (err) { toast(err.message) }
  })
  document.getElementById('muni-kit')?.addEventListener('click', openKit)
}

export function initMunicipalUi() {
  document.getElementById('open-municipal')?.addEventListener('click', openMunicipal)
}

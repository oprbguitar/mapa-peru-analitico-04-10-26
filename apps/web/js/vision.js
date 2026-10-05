// Vision Edge: conectar mi grabador (Dahua DH-XVR5108HS-X u otro ONVIF/RTSP), ubicar sus canales en el mapa y verlos.
// Sin go2rtc el visor muestra fotos del grabador (~1 por segundo); con go2rtc corriendo, las toma del flujo (más fluido).
import { ensurePointLayer, map, mapReady, ptFeature, setPoints } from './map.js'
import { esc, getJSON, postJSON, toast } from './util.js'

let data = null
let placing = null      // { cam, ch }
let viewer = { cam: null, chans: [], timer: null, paused: false }
const body = () => document.getElementById('cameras-body')

async function load() {
  data = await getJSON('/api/v1/intel/vision/cameras')
  return data
}

function form(c = {}) {
  return `<form id="cam-form" class="settings" autocomplete="off"><fieldset><legend>${c.id ? 'Editar grabador' : 'Agregar grabador'}</legend>
    <input type="hidden" name="id" value="${esc(c.id || '')}"><div class="form-grid">
    <label class="field"><span>Nombre</span><input name="name" value="${esc(c.name || 'XVR Casa')}"></label>
    <label class="field"><span>Fabricante</span><select name="vendor">${['dahua', 'hikvision', 'onvif', 'rtsp'].map((v) => `<option ${c.vendor === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field"><span>IP en tu red</span><input name="host" value="${esc(c.host || '')}" placeholder="192.168.1.108" required></label>
    <label class="field"><span>Puerto web (HTTP)</span><input name="http_port" type="number" value="${c.http_port || 80}"></label>
    <label class="field"><span>Puerto RTSP</span><input name="rtsp_port" type="number" value="${c.rtsp_port || 554}"></label>
    <label class="field"><span>Usuario</span><input name="username" value="${esc(c.username || 'admin')}"></label>
    <label class="field"><span>Contraseña ${c.has_password ? '<span class="state" data-on="true">✓ guardada</span>' : ''}</span><input name="password" type="password" placeholder="${c.has_password ? 'dejar vacío para no cambiar' : ''}" autocomplete="new-password"></label>
    ${c.id ? '' : '<label class="field"><span>Canales</span><input name="n_channels" type="number" min="1" max="64" value="8"></label>'}
    <label class="field"><span>Ruta RTSP (solo ONVIF/RTSP genérico)</span><input name="rtsp_path" value="${esc(c.rtsp_path || '')}" placeholder="/stream{ch}"></label></div>
    <div class="ai-actions" style="padding:0"><button class="btn" type="button" id="cam-probe">Probar conexión</button>
      <button class="btn btn-primary" type="submit">Guardar</button></div><div id="cam-probe-out" class="probe"></div></fieldset></form>`
}

function camTable(c) {
  return `<fieldset data-cam="${esc(c.id)}"><legend>${esc(c.name)} · ${esc(c.vendor)} ${esc(c.model || '')} · ${esc(c.host)}</legend>
    <table class="cam-table"><thead><tr><th>Canal</th><th>Nombre</th><th>Ubicación</th><th>Activo</th><th></th></tr></thead><tbody>
    ${c.channels.map((ch) => `<tr data-ch="${ch.ch}"><td>${ch.ch}</td><td><input type="text" data-chname value="${esc(ch.name)}" aria-label="Nombre del canal ${ch.ch}"></td>
      <td>${ch.lat != null ? `${esc(ch.distrito || '')} <small>${ch.lat.toFixed(5)}, ${ch.lon.toFixed(5)}</small>` : '<small>sin ubicar</small>'}</td>
      <td><input type="checkbox" data-chon ${ch.enabled ? 'checked' : ''} aria-label="Canal ${ch.ch} activo"></td>
      <td><button class="btn" type="button" data-place="${ch.ch}">Ubicar</button> <button class="btn btn-ghost" type="button" data-view="${ch.ch}">Ver</button></td></tr>
      <tr><td></td><td colspan="4" class="rtsp">${esc((c.rtsp || []).find((r) => r.ch === ch.ch)?.sub || '')}</td></tr>`).join('')}</tbody></table>
    <div class="ai-actions" style="padding:0"><button class="btn btn-primary" type="button" data-save-ch>Guardar canales</button>
      <button class="btn" type="button" data-mosaic>Mosaico</button><button class="btn btn-ghost" type="button" data-edit>Editar</button>
      <button class="btn btn-ghost" type="button" data-del>Eliminar</button></div></fieldset>`
}

async function render(editId) {
  const d = await load()
  const g = d.guide.dahua
  const editing = d.cameras.find((c) => c.id === editId)
  body().innerHTML = `<p class="note">${esc(d.guide.privacy)}</p>
    <details class="why" ${d.cameras.length ? '' : 'open'}><summary>Cómo conectar tu ${esc(g.title)}</summary><div class="why-body">
      <ol class="steps">${g.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="rtsp">RTSP: ${esc(g.rtsp)}<br>Foto: ${esc(g.snapshot)}<br>${esc(g.vlc)}</p></div></details>
    <div class="ai-actions" style="padding:0"><button class="btn" type="button" id="cam-discover">Buscar en mi red (ONVIF)</button>
      <span class="src-meta">go2rtc: ${d.go2rtc.running ? `<b>activo</b> en ${esc(d.go2rtc.url)}` : `no detectado (<a href="${esc(d.guide.go2rtc)}" target="_blank" rel="noopener">descargar</a>)`}</span>
      ${d.cameras.length ? '<button class="btn" type="button" id="cam-go2rtc">Generar go2rtc.yaml</button>' : ''}</div>
    <div id="cam-found"></div>
    ${d.cameras.map(camTable).join('')}
    ${form(editing || {})}`
  bind()
}

function formBody() {
  const f = new FormData(document.getElementById('cam-form'))
  const o = Object.fromEntries([...f].filter(([, v]) => String(v).trim() !== ''))
  for (const k of ['http_port', 'rtsp_port', 'n_channels']) if (o[k]) o[k] = Number(o[k])
  return o
}

function bind() {
  document.getElementById('cam-discover').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    btn.setAttribute('aria-busy', 'true')
    const r = await getJSON('/api/v1/intel/vision/discover').catch((err) => ({ devices: [{ error: err.message }] }))
    btn.removeAttribute('aria-busy')
    const box = document.getElementById('cam-found')
    box.innerHTML = r.devices.length ? `<table class="cam-table"><thead><tr><th>IP</th><th>Equipo</th><th></th></tr></thead><tbody>${r.devices.map((x) => x.error
      ? `<tr><td colspan="3">${esc(x.error)}</td></tr>` : `<tr><td>${esc(x.ip)}</td><td>${esc(x.hardware || x.name || x.vendor_guess)}<br><small>${esc(x.how || 'ONVIF')}${x.ports ? ' · puertos ' + esc(x.ports.join(', ')) : ''}</small></td>
      <td><button class="btn" type="button" data-use-ip="${esc(x.ip)}" data-vendor="${esc(x.vendor_guess)}">Usar</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="empty">Ningún equipo respondió en tu red. Verifica que el XVR esté conectado al mismo router (cable Ethernet) y encendido, o escribe la IP que muestra el XVR en Menú → Red → TCP/IP.</p>'
    box.querySelectorAll('[data-use-ip]').forEach((b) => b.addEventListener('click', () => {
      const f = document.getElementById('cam-form')
      f.host.value = b.dataset.useIp
      f.vendor.value = b.dataset.vendor
      f.password.focus()
    }))
  })
  document.getElementById('cam-probe').addEventListener('click', async (e) => {
    const out = document.getElementById('cam-probe-out')
    const btn = e.currentTarget
    btn.setAttribute('aria-busy', 'true')
    try {
      const r = await postJSON('/api/v1/intel/vision/probe', formBody())
      out.innerHTML = r.steps.map((s) => `<div data-ok="${s.ok}">${esc(s.step)}${s.hint ? `<small>${esc(s.hint)}</small>` : ''}</div>`).join('') +
        (r.device.model ? `<div data-ok="true">Equipo: ${esc(r.device.model)}${r.device.firmware ? ` · firmware ${esc(r.device.firmware)}` : ''} · ${r.device.channels.length} canales leídos</div>` : '')
    } catch (err) {
      out.innerHTML = `<div data-ok="false">${esc(err.message)}</div>`
    } finally {
      btn.removeAttribute('aria-busy')
    }
  })
  document.getElementById('cam-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const r = await postJSON('/api/v1/intel/vision/cameras', formBody())
      if (!formBody().id) await postJSON('/api/v1/intel/vision/probe', { id: r.camera.id }).catch(() => null) // lee nombres de canal
      toast('Grabador guardado. Ahora ubica cada canal en el mapa.')
      render()
      refreshLayer()
    } catch (err) {
      toast(err.message, 7000)
    }
  })
  document.getElementById('cam-go2rtc')?.addEventListener('click', async () => {
    const r = await postJSON('/api/v1/intel/vision/go2rtc', {})
    toast(`Archivo creado: ${r.path}. Ejecuta: ${r.run}`, 12000)
  })
  body().querySelectorAll('[data-cam]').forEach((fs) => {
    const cam = data.cameras.find((c) => c.id === fs.dataset.cam)
    fs.querySelector('[data-save-ch]').addEventListener('click', () => saveChannels(cam, fs))
    fs.querySelector('[data-edit]').addEventListener('click', () => render(cam.id))
    fs.querySelector('[data-del]').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar «${cam.name}» de este mapa? (el grabador no se modifica)`)) return
      await postJSON('/api/v1/intel/vision/cameras/delete', { id: cam.id })
      render()
      refreshLayer()
    })
    fs.querySelector('[data-mosaic]').addEventListener('click', () => openViewer(cam, cam.channels.filter((c) => c.enabled).map((c) => c.ch)))
    fs.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openViewer(cam, [+b.dataset.view])))
    fs.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => {
      placing = { cam, ch: +b.dataset.place, fs }
      document.getElementById('cameras-dialog').close()
      document.body.classList.add('picking')
      const bn = document.getElementById('pick-banner')
      bn.hidden = false
      bn.innerHTML = `Haz clic en el mapa donde está el canal ${placing.ch} de «${esc(cam.name)}» <button class="btn" type="button" id="pick-cancel">Cancelar</button>`
      document.getElementById('pick-cancel').onclick = cancelPlacing
    }))
  })
}

function cancelPlacing() {
  placing = null
  document.body.classList.remove('picking')
  document.getElementById('pick-banner').hidden = true
}

async function saveChannels(cam, fs, override) {
  const chans = cam.channels.map((ch) => {
    const row = fs?.querySelector(`tr[data-ch="${ch.ch}"]`)
    return { ...ch, name: row?.querySelector('[data-chname]').value || ch.name, enabled: row ? row.querySelector('[data-chon]').checked : ch.enabled,
      ...(override?.ch === ch.ch ? { lat: override.lat, lon: override.lon } : {}) }
  })
  await postJSON('/api/v1/intel/vision/cameras', { id: cam.id, channels: chans })
  refreshLayer()
}

/** Devuelve true si el clic se usó para ubicar un canal. */
export function pickHandler(lngLat) {
  if (!placing) return false
  const p = placing
  cancelPlacing()
  saveChannels(p.cam, null, { ch: p.ch, lat: lngLat.lat, lon: lngLat.lng }).then(() => {
    toast(`Canal ${p.ch} ubicado.`)
    openCameras()
  })
  return true
}

export async function refreshLayer(visible) {
  await mapReady
  ensurePointLayer('cam-pts', { colors: { cam: '--danger' }, radius: 7, onClick: (f) => {
    const cam = data?.cameras.find((c) => c.id === f.properties.cam)
    if (cam) openViewer(cam, [f.properties.ch])
  } })
  const d = data || await load()
  const vis = visible ?? map.getLayoutProperty('cam-pts', 'visibility') === 'visible'
  setPoints('cam-pts', d.features.map((x) => ptFeature(x.lon, x.lat, { ...x, cat: 'cam' })), vis)
  return d.features.length
}

function openViewer(cam, chans) {
  clearInterval(viewer.timer)
  viewer = { cam, chans, timer: null, paused: false }
  const el = document.getElementById('cam-viewer')
  const cols = chans.length > 4 ? 3 : chans.length > 1 ? 2 : 1
  el.hidden = false
  el.innerHTML = `<div class="cam-viewer-head"><b>${esc(cam.name)}</b><span class="src-meta">${chans.length > 1 ? 'Mosaico' : `Canal ${chans[0]}`} · foto cada ~1 s</span>
    <span><button class="btn" type="button" id="cv-pause" aria-pressed="false">❚❚</button> <button class="btn btn-ghost btn-icon" type="button" id="cv-close" aria-label="Cerrar el visor">✕</button></span></div>
    <div class="cam-grid" style="--cols:${cols}">${chans.map((ch) => `<button type="button" class="cam-cell" data-cell="${ch}" aria-label="Canal ${ch}"><img alt="Canal ${ch}"><span>CH ${ch} · ${esc(cam.channels.find((c) => c.ch === ch)?.name || '')}</span><span class="live">● EN VIVO</span></button>`).join('')}</div>`
  el.querySelector('#cv-close').onclick = () => { clearInterval(viewer.timer); el.hidden = true }
  el.querySelector('#cv-pause').onclick = (e) => { viewer.paused = !viewer.paused; e.currentTarget.setAttribute('aria-pressed', String(viewer.paused)) }
  el.querySelectorAll('[data-cell]').forEach((c) => c.addEventListener('click', () => chans.length > 1 && openViewer(cam, [+c.dataset.cell])))
  const tick = () => {
    if (viewer.paused || document.hidden) return
    for (const ch of chans) {
      const cell = el.querySelector(`[data-cell="${ch}"]`)
      const img = cell.querySelector('img')
      if (img.dataset.busy) continue
      img.dataset.busy = '1'
      const next = new Image()
      next.onload = () => { img.src = next.src; delete img.dataset.busy; cell.dataset.state = 'ok'; cell.querySelector('.err')?.remove() }
      next.onerror = () => {
        delete img.dataset.busy
        cell.dataset.state = 'error'
        if (!cell.querySelector('.err')) cell.insertAdjacentHTML('beforeend', '<span class="err">sin imagen: revisa la conexión</span>')
      }
      next.src = `/api/v1/intel/vision/snap/${cam.id}/${ch}.jpg?t=${Date.now()}`
    }
  }
  tick()
  viewer.timer = setInterval(tick, chans.length > 4 ? 2000 : 1000)
}

export async function openCameras() {
  document.getElementById('cameras-dialog').showModal()
  body().innerHTML = '<p class="loading">Leyendo tus cámaras</p>'
  await render()
}

export function initVision() {
  document.getElementById('open-cameras').addEventListener('click', openCameras)
  refreshLayer(false).catch(() => {})
}

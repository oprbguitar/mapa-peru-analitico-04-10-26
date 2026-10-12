// Reproductor de cámaras (plan maestro §7): por canal intenta video continuo WebRTC (go2rtc, negociado vía el servidor)
// y si no puede usa fotos del grabador (~1 s). Cada celda declara su modo — EN VIVO · WebRTC / FOTO / SIMULADO —,
// el retraso aproximado, la última imagen y los cortes. La señal simulada sirve para probar el visor sin equipo.
import { esc, postJSON } from './util.js'

let win = null
let cells = []

const now = () => new Date().toLocaleTimeString('es-PE')

function setInfo(c) {
  const el = c.el
  el.dataset.mode = c.mode
  el.querySelector('.cam-mode').textContent = { webrtc: '● EN VIVO · WebRTC', foto: 'FOTO ~1 s', simulado: 'SIMULADO', conectando: 'Conectando…' }[c.mode] || c.mode
  el.querySelector('.cam-stat').textContent = [c.delay != null ? `retraso ~${Math.round(c.delay)} ms` : null,
    c.last ? `última ${c.last}` : null, c.cuts ? `${c.cuts} corte(s)` : null, c.reason || null].filter(Boolean).join(' · ')
}

// ── modo foto (respaldo) ────────────────────────────────────────────────────
function startPhotos(c, reason) {
  c.mode = 'foto'
  c.reason = reason
  c.video.hidden = true
  c.img.hidden = false
  setInfo(c)
  const tick = () => {
    if (c.stopped || document.hidden || win?.dataset.paused === 'true' || c.busy) return
    c.busy = true
    const t0 = performance.now()
    const next = new Image()
    next.onload = () => { c.img.src = next.src; c.busy = false; c.delay = performance.now() - t0; c.last = now(); c.el.dataset.state = 'ok'; setInfo(c) }
    next.onerror = () => { c.busy = false; c.cuts++; c.el.dataset.state = 'error'; c.reason = 'sin imagen: revisa la conexión'; setInfo(c) }
    next.src = `/api/v1/intel/vision/snap/${c.cam.id}/${c.ch}.jpg?t=${Date.now()}`
  }
  tick()
  c.timer = setInterval(tick, c.many ? 2000 : 1000)
}

// ── modo WebRTC (go2rtc) ────────────────────────────────────────────────────
async function startWebRTC(c) {
  c.mode = 'conectando'
  setInfo(c)
  const pc = new RTCPeerConnection({ iceServers: [] })   // red local: sin servidores externos
  c.pc = pc
  pc.addTransceiver('video', { direction: 'recvonly' })
  pc.addTransceiver('audio', { direction: 'recvonly' })
  pc.ontrack = (e) => {
    if (c.video.srcObject !== e.streams[0]) c.video.srcObject = e.streams[0]
  }
  pc.onconnectionstatechange = () => {
    if (c.stopped) return
    if (pc.connectionState === 'connected') {
      c.mode = 'webrtc'
      c.reason = ''
      c.video.hidden = false
      c.img.hidden = true
      setInfo(c)
    } else if (['disconnected', 'failed'].includes(pc.connectionState)) {
      c.cuts++
      if (pc.connectionState === 'failed') { pc.close(); startPhotos(c, 'WebRTC cayó: se muestran fotos') }
      else setInfo(c)
    }
  }
  await pc.setLocalDescription(await pc.createOffer())
  await new Promise((res) => {   // esperar candidatos ICE (máx. 2 s): go2rtc recibe la oferta completa
    if (pc.iceGatheringState === 'complete') return res()
    const t = setTimeout(res, 2000)
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res() } })
  })
  const ans = await postJSON('/api/v1/intel/vision/webrtc', { cam: c.cam.id, ch: c.ch, sdp: pc.localDescription.sdp })
  await pc.setRemoteDescription({ type: 'answer', sdp: ans.sdp })
  c.stats = setInterval(async () => {   // retraso aproximado: buffer de jitter + ida y vuelta
    if (!c.pc) return
    let jitter = null, rtt = null
    for (const s of (await c.pc.getStats()).values()) {
      if (s.type === 'inbound-rtp' && s.kind === 'video' && s.jitterBufferEmittedCount) jitter = (s.jitterBufferDelay / s.jitterBufferEmittedCount) * 1000
      if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.currentRoundTripTime != null) rtt = s.currentRoundTripTime * 1000
    }
    if (jitter != null || rtt != null) { c.delay = (jitter || 0) + (rtt || 0) / 2; c.last = now(); setInfo(c) }
  }, 2000)
  setTimeout(() => { if (!c.stopped && c.mode === 'conectando') { pc.close(); startPhotos(c, 'WebRTC no conectó en 8 s: se muestran fotos') } }, 8000)
}

// ── señal simulada (prueba del visor sin equipo) ────────────────────────────
function startSimulated(c) {
  c.mode = 'simulado'
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 360
  const g = cv.getContext('2d')
  let f = 0
  const draw = () => {
    if (c.stopped) return
    f++
    g.fillStyle = '#10161c'
    g.fillRect(0, 0, 640, 360)
    const bars = ['#c8c8c8', '#c8c800', '#00c8c8', '#00c800', '#c800c8', '#c80000', '#0000c8']
    // franjas de color, texto y reloj quedan en la zona central: las etiquetas del visor ocupan arriba y abajo
    bars.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 91, 50, 91, 150) })
    g.fillStyle = '#fff'
    g.font = 'bold 28px monospace'
    g.fillText(`SEÑAL SIMULADA · CH ${c.ch}`, 20, 240)
    g.font = '22px monospace'
    g.fillText(new Date().toLocaleTimeString('es-PE'), 20, 272)
    g.fillStyle = '#ff5c6c'
    g.fillRect((f * 4) % 640, 284, 36, 24)
    c.last = now()
    c.delay = 0
    if (f % 30 === 0) setInfo(c)
    c.raf = requestAnimationFrame(draw)
  }
  draw()
  c.video.srcObject = cv.captureStream(30)
  c.video.hidden = false
  c.img.hidden = true
  setInfo(c)
}

function stopAll() {
  for (const c of cells) {
    c.stopped = true
    clearInterval(c.timer)
    clearInterval(c.stats)
    cancelAnimationFrame(c.raf)
    c.pc?.close()
    c.video.srcObject = null
  }
  cells = []
}

function draggable(el, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - r.left, dy = e.clientY - r.top
    handle.setPointerCapture(e.pointerId)
    const mv = (ev) => {
      el.style.left = `${Math.max(0, Math.min(innerWidth - 120, ev.clientX - dx))}px`
      el.style.top = `${Math.max(0, Math.min(innerHeight - 60, ev.clientY - dy))}px`
      el.style.right = 'auto'
    }
    const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up) }
    handle.addEventListener('pointermove', mv)
    handle.addEventListener('pointerup', up)
  })
}

/**
 * Abre la ventana flotante con uno o varios canales.
 * mode: 'auto' (WebRTC si go2rtc está activo, si no fotos) · 'foto' · 'simulado'.
 */
export function openViewer({ cam, chans, go2rtc = false, mode = 'auto', onPick }) {
  stopAll()
  win = document.getElementById('cam-viewer')
  const cols = chans.length > 4 ? 3 : chans.length > 1 ? 2 : 1
  win.hidden = false
  win.dataset.paused = 'false'
  const label = mode === 'simulado' ? 'Prueba del visor · señal simulada (no es video real)' : `${chans.length > 1 ? 'Mosaico' : `Canal ${chans[0]}`} · ${go2rtc && mode === 'auto' ? 'video continuo' : 'fotos'}`
  win.innerHTML = `<div class="cam-viewer-head" title="Arrastra para mover"><b>${esc(cam.name)}</b><span class="src-meta">${esc(label)}</span>
    <span><button class="btn" type="button" id="cv-pause" aria-pressed="false" aria-label="Pausar fotos">❚❚</button>
    <button class="btn btn-ghost btn-icon" type="button" id="cv-close" aria-label="Cerrar el visor">✕</button></span></div>
    <div class="cam-grid" style="--cols:${cols}">${chans.map((ch) => `<div class="cam-cell" role="button" tabindex="0" data-cell="${ch}" aria-label="Canal ${ch}">
      <video muted playsinline autoplay hidden></video><img alt="Canal ${ch}">
      <span class="cam-name">CH ${ch} · ${esc(cam.channels.find((c) => c.ch === ch)?.name || '')}</span>
      <span class="cam-mode"></span><span class="cam-stat"></span></div>`).join('')}</div>`
  win.querySelector('#cv-close').onclick = () => { stopAll(); win.hidden = true }
  win.querySelector('#cv-pause').onclick = (e) => {
    win.dataset.paused = String(win.dataset.paused !== 'true')
    e.currentTarget.setAttribute('aria-pressed', win.dataset.paused)
  }
  draggable(win, win.querySelector('.cam-viewer-head'))
  for (const ch of chans) {
    const el = win.querySelector(`[data-cell="${ch}"]`)
    const c = { cam, ch, el, video: el.querySelector('video'), img: el.querySelector('img'), cuts: 0, many: chans.length > 4, mode: '' }
    cells.push(c)
    if (chans.length > 1 && onPick) el.addEventListener('click', () => onPick(ch))
    if (mode === 'simulado') startSimulated(c)
    else if (mode === 'auto' && go2rtc && window.RTCPeerConnection) startWebRTC(c).catch((e) => startPhotos(c, `WebRTC no disponible: ${e.message}`))
    else startPhotos(c, go2rtc ? '' : 'sin go2rtc: fotos del grabador')
  }
}

export const closeViewer = () => { stopAll(); if (win) win.hidden = true }

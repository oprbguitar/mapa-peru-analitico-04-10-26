// Asistente de voz: «Ubica El Agustino y infórmame», «enciende las comisarías», «traza una ruta de Miraflores a Chosica».
// Ruta por el AI Gateway: voz→texto (Whisper local · navegador · pago) → órdenes (intérprete local o modelo con herramientas)
// → acciones en el mapa → informe hablado (Kokoro local · voz del navegador · pago). Modo «tiempo real»: OpenAI Realtime.
import { esc, getJSON, postJSON, toast } from './util.js'

let actions = {}
let routeInfo = null
let rec = null           // SpeechRecognition o MediaRecorder activo
let rt = null            // sesión Realtime
let audioEl = null
const el = () => document.getElementById('assistant')

function log(who, text, cls = '') {
  const box = document.getElementById('as-log')
  if (!box) return
  const p = document.createElement('p')
  p.className = `as-line ${cls}`
  p.innerHTML = `<b>${esc(who)}</b> ${esc(text)}`
  box.append(p)
  box.scrollTop = box.scrollHeight
}

function status(text, state = 'idle') {
  const s = document.getElementById('as-status')
  if (s) s.textContent = text
  el()?.setAttribute('data-state', state)
}

export async function speak(text) {
  if (!text) return
  try {
    const r = await fetch('/api/v1/ai/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
    const ct = r.headers.get('Content-Type') || ''
    if (r.ok && ct.startsWith('audio/')) {
      const url = URL.createObjectURL(await r.blob())
      audioEl ??= new Audio()
      audioEl.src = url
      await audioEl.play()
      return
    }
    const meta = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(meta.error || `HTTP ${r.status}`)
  } catch (e) {
    if (!('speechSynthesis' in window)) return toast(`Voz no disponible: ${e.message}`)
  }
  // voz del navegador (local): se elige una voz en español si existe
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'es-PE'
  const v = speechSynthesis.getVoices().find((x) => /^es(-PE|-419|-MX|-US|-ES)?/i.test(x.lang))
  if (v) u.voice = v
  u.rate = 1.02
  speechSynthesis.speak(u)
}

async function execute(list) {
  const said = []
  for (const a of list) {
    const fn = actions[a.name]
    if (!fn) continue
    try {
      const r = await fn(a.arguments || {})
      if (typeof r === 'string' && r) said.push(r)
    } catch (e) {
      said.push(`No pude ${a.name}: ${e.message}`)
    }
  }
  return said.join(' ')
}

export async function runCommand(text) {
  if (!text?.trim()) return
  log('Tú', text)
  status('Interpretando…', 'busy')
  let r
  try {
    r = await postJSON('/api/v1/ai/voice/command', { text, context: { selection: actions.selection?.() } })
  } catch (e) {
    status('Error', 'error')
    return log('Asistente', e.message, 'err')
  }
  const out = r.actions.length ? await execute(r.actions) : ''
  const reply = [r.reply, out].filter(Boolean).join(' ') || (r.actions.length ? 'Listo.' : 'No entendí. Prueba: «ubica Cusco y infórmame».')
  log('Asistente', reply)
  document.getElementById('as-engine').textContent = r.engine
  status('Listo', 'idle')
  speak(reply)
}

// ── voz → texto ─────────────────────────────────────────────────────────────
function browserSTT() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return false
  rec = new SR()
  rec.lang = 'es-PE'
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.onresult = (e) => runCommand(e.results[0][0].transcript)
  rec.onerror = (e) => { status(`Micrófono: ${e.error}`, 'error'); rec = null }
  rec.onend = () => { rec = null; if (el()?.dataset.state === 'listening') status('Listo', 'idle') }
  rec.start()
  status('Escuchando… (navegador)', 'listening')
  return true
}

async function serverSTT() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks = []
  const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '' })
  rec = mr
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop())
    rec = null
    status('Transcribiendo…', 'busy')
    const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' })
    try {
      const r = await fetch('/api/v1/ai/voice/stt', { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      if (d.text) runCommand(d.text)
      else status('No se escuchó nada', 'idle')
    } catch (e) {
      status('Error de transcripción', 'error')
      log('Asistente', e.message, 'err')
    }
  }
  mr.start()
  status(`Escuchando… (${routeInfo?.voz_stt?.name || 'servidor'}) — pulsa otra vez para enviar`, 'listening')
  setTimeout(() => mr.state === 'recording' && mr.stop(), 15000)
}

async function toggleMic() {
  if (rt) return stopRealtime()
  if (rec) {
    rec.stop()
    return
  }
  if (document.getElementById('as-mode').value === 'realtime') return startRealtime()
  routeInfo = await getJSON('/api/v1/ai/voice/route').catch(() => null)
  const stt = routeInfo?.voz_stt
  if (stt?.error) return status(`Voz a texto apagada: ${stt.error.message}`, 'error')
  try {
    if (stt?.adapter === 'browser') {
      if (!browserSTT()) await serverSTT()
    } else await serverSTT()
  } catch (e) {
    status(`Micrófono: ${e.message}`, 'error')
  }
}

// ── tiempo real (voz a voz, OpenAI Realtime) ────────────────────────────────
async function startRealtime() {
  status('Conectando voz en tiempo real…', 'busy')
  let s
  try {
    s = await postJSON('/api/v1/ai/voice/realtime', {})
  } catch (e) {
    status('Tiempo real no disponible', 'error')
    return log('Asistente', `${e.message}. Actívalo en Administrador de IA (proveedor OpenAI Realtime, presupuesto y función «voz_realtime»).`, 'err')
  }
  const pc = new RTCPeerConnection()
  const audio = new Audio()
  audio.autoplay = true
  pc.ontrack = (e) => (audio.srcObject = e.streams[0])
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
  mic.getTracks().forEach((t) => pc.addTrack(t, mic))
  const dc = pc.createDataChannel('oai-events')
  const usage = { input_tokens: 0, output_tokens: 0 }
  dc.onmessage = async (m) => {
    const ev = JSON.parse(m.data)
    if (ev.type === 'response.function_call_arguments.done') {
      let args = {}
      try { args = JSON.parse(ev.arguments || '{}') } catch { /* argumentos inválidos */ }
      log('Acción', `${ev.name} ${JSON.stringify(args)}`)
      const out = await execute([{ name: ev.name, arguments: args }])
      dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: ev.call_id, output: JSON.stringify({ ok: true, informe: out || 'hecho' }) } }))
      dc.send(JSON.stringify({ type: 'response.create' }))
    } else if (ev.type === 'response.done' && ev.response?.usage) {
      usage.input_tokens += ev.response.usage.input_tokens || 0
      usage.output_tokens += ev.response.usage.output_tokens || 0
    } else if (ev.type === 'conversation.item.input_audio_transcription.completed') log('Tú', ev.transcript || '')
    else if (ev.type === 'response.output_audio_transcript.done') log('Asistente', ev.transcript || '')
  }
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  const r = await fetch(`${s.calls_url}?model=${encodeURIComponent(s.model)}`, { method: 'POST', body: offer.sdp,
    headers: { Authorization: `Bearer ${s.value}`, 'Content-Type': 'application/sdp' } })
  if (!r.ok) {
    pc.close()
    mic.getTracks().forEach((t) => t.stop())
    return status(`Realtime: HTTP ${r.status}`, 'error')
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: await r.text() })
  rt = { pc, mic, usage, reservation: s.reservation, timer: setTimeout(stopRealtime, 10 * 60 * 1000) }
  status(`En vivo (${s.model}) · tope US$ ${s.session_cap_usd} · habla con normalidad`, 'listening')
}

async function stopRealtime() {
  if (!rt) return
  clearTimeout(rt.timer)
  rt.pc.close()
  rt.mic.getTracks().forEach((t) => t.stop())
  const r = await postJSON('/api/v1/ai/voice/realtime/settle', { reservation: rt.reservation, usage: rt.usage }).catch(() => null)
  rt = null
  status(r ? `Sesión cerrada · US$ ${r.settled_usd}` : 'Sesión cerrada', 'idle')
}

export function initAssistant(handlers) {
  actions = handlers
  const root = el()
  root.innerHTML = `<div class="as-head"><span class="rail-title">Asistente</span>
      <label class="sr-only" for="as-mode">Modo</label><select id="as-mode"><option value="auto">Órdenes (local primero)</option><option value="realtime">Voz en tiempo real (pago)</option></select>
      <button class="btn btn-ghost btn-icon" type="button" id="as-close" aria-label="Cerrar el asistente">✕</button></div>
    <div class="as-row"><button class="as-mic" type="button" id="as-mic" aria-label="Hablar (clic para empezar y terminar)"><span aria-hidden="true">🎙</span></button>
      <form id="as-form" class="as-form"><label class="sr-only" for="as-text">Escribe una orden</label>
      <input id="as-text" type="text" placeholder="Ubica El Agustino y infórmame" autocomplete="off"><button class="btn" type="submit">Enviar</button></form></div>
    <div id="as-status" class="as-status" role="status">Listo · pulsa el micrófono o escribe</div>
    <div id="as-log" class="as-log" aria-live="polite"></div>
    <div class="as-foot"><span class="src-meta">Motor: <span id="as-engine">—</span></span><button class="btn btn-ghost" type="button" id="as-admin">Configurar voz e IA</button></div>`
  document.getElementById('as-mic').addEventListener('click', toggleMic)
  document.getElementById('as-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const t = document.getElementById('as-text')
    runCommand(t.value)
    t.value = ''
  })
  document.getElementById('as-close').addEventListener('click', () => (root.hidden = true))
  document.getElementById('as-admin').addEventListener('click', () => handlers.abrir?.({ modulo: 'admin' }))
  document.getElementById('open-assistant').addEventListener('click', () => {
    root.hidden = !root.hidden
    if (!root.hidden) document.getElementById('as-text').focus()
  })
  document.addEventListener('keydown', (e) => {  // Alt+V: hablar
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault()
      root.hidden = false
      toggleMic()
    }
  })
  if ('speechSynthesis' in window) speechSynthesis.getVoices()
}

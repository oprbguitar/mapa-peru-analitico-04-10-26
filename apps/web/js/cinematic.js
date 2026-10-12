// Recorrido cinematográfico y grabación (director de cámara): tomas con pose, duración y pausa; movimiento suave
// (cúbico, rumbo por el arco más corto); relieve 3D y vista satelital; grabación a video en esta PC con superposición
// táctica (DTG, UTM, rumbo, rótulo de naturaleza del dato). Inspirado en el «director» de God's Eye View; código propio.
import { map, setBase, setTerrain, view } from './map.js'
import { esc, fmt, toast } from './util.js'
import { dtg, utm } from './sim-tactical.js'

const st = { shots: [], playing: false, recording: false, rec: null, raf: 0, title: 'Recorrido de análisis', hud: true, res: '1280x720', seq: 0 }
let panel = null
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const lerp = (a, b, t) => a + (b - a) * t
const angle = (a, b, t) => a + ((((b - a + 540) % 360) + 360) % 360 - 180) * t

const pose = () => {
  const c = map.getCenter()
  return { lon: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +map.getZoom().toFixed(2), pitch: +map.getPitch().toFixed(1), bearing: +map.getBearing().toFixed(1) }
}
const apply = (p) => map.jumpTo({ center: [p.lon, p.lat], zoom: p.zoom, pitch: p.pitch, bearing: p.bearing })
const between = (a, b, t) => {
  const e = ease(t)
  return { lon: lerp(a.lon, b.lon, e), lat: lerp(a.lat, b.lat, e), zoom: lerp(a.zoom, b.zoom, e), pitch: lerp(a.pitch, b.pitch, e), bearing: angle(a.bearing, b.bearing, e) }
}
const shot = (p, duration = 4, hold = 1, label = '') => ({ id: `t${++st.seq}`, ...p, duration, hold, label })

// ── recorridos prefabricados ────────────────────────────────────────────────
function orbit() {
  const p = pose()
  const base = { ...p, pitch: Math.max(p.pitch, 58) }
  st.shots = [0, 90, 180, 270, 360].map((d, i) => shot({ ...base, bearing: p.bearing + d }, i ? 4 : 0.5, i === 4 ? 1 : 0, `Órbita ${d}°`))
}
function approach() {
  const p = pose()
  st.shots = [shot({ lon: -75.2, lat: -9.4, zoom: 4.6, pitch: 0, bearing: 0 }, 0.5, 1, 'Perú'),
    shot({ ...p, zoom: Math.max(6, p.zoom - 4), pitch: 30, bearing: p.bearing - 30 }, 5, 0.5, 'Región'),
    shot({ ...p, pitch: Math.max(p.pitch, 60) }, 5, 2, 'Objetivo')]
}
function flyover() {
  const z = document.querySelector('.sim-handle-center') ? map.getCenter() : null
  const p = pose()
  const c = z ? { lon: z.lng, lat: z.lat } : p
  st.shots = [0, 120, 240, 360].map((d, i) => shot({ ...p, ...c, zoom: p.zoom + 0.6, pitch: 66, bearing: p.bearing + d }, i ? 5 : 0.5, i === 3 ? 1.5 : 0, `Sobrevuelo ${d}°`))
}

// ── reproducción ────────────────────────────────────────────────────────────
function sequence() {
  const seg = []
  let prev = null
  for (const s of st.shots) {
    seg.push({ from: prev || s, to: s, dur: prev ? s.duration : 0.01 })
    if (s.hold) seg.push({ from: s, to: s, dur: s.hold })
    prev = s
  }
  return seg
}

function play({ record = false } = {}) {
  if (st.shots.length < 2) return toast('Añade al menos dos tomas (o elige un recorrido prefabricado).')
  stop()
  const seg = sequence()
  const total = seg.reduce((a, s) => a + s.dur, 0)
  st.playing = true
  if (record && !startRecording()) { st.playing = false; return }
  render()
  if (reduced() && !record) { apply(st.shots.at(-1)); st.playing = false; return render() }
  const t0 = performance.now()
  const tick = (now) => {
    if (!st.playing) return
    let el = (now - t0) / 1000
    const prog = panel?.querySelector('#cine-progress')
    if (prog) prog.value = String(Math.min(1, el / total))
    for (const s of seg) {
      if (el <= s.dur) { apply(between(s.from, s.to, s.dur ? el / s.dur : 1)); break }
      el -= s.dur
    }
    if ((now - t0) / 1000 >= total) { apply(st.shots.at(-1)); return finish() }
    if (st.recording) map.triggerRepaint()   // un cuadro por fotograma aunque la cámara esté quieta (pausas)
    st.raf = requestAnimationFrame(tick)
  }
  st.raf = requestAnimationFrame(tick)
}

function finish() {
  st.playing = false
  if (st.recording) setTimeout(stopRecording, 300)
  render()
}

function stop() {
  st.playing = false
  cancelAnimationFrame(st.raf)
  if (st.recording) stopRecording()
}

// ── grabación ───────────────────────────────────────────────────────────────
function pickMime() {
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m
  }
  return ''
}

/** Copia del lienzo del mapa + marcadores HTML (unidades, notas, puntos) + superposición táctica. */
function compose(ctx, W, H) {
  const src = map.getCanvas()
  const s = Math.max(W / src.width, H / src.height)
  const dw = src.width * s, dh = src.height * s, dx = (W - dw) / 2, dy = (H - dh) / 2
  ctx.drawImage(src, dx, dy, dw, dh)
  const box = map.getContainer().getBoundingClientRect()
  const k = (src.width / box.width) * s
  ctx.textBaseline = 'middle'
  for (const el of map.getContainer().querySelectorAll('.maplibregl-marker')) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.right < box.left || r.left > box.right) continue
    const x = dx + (r.left - box.left) * k, y = dy + (r.top - box.top) * k, w = r.width * k, h = r.height * k
    const bg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : 'rgba(8,14,22,.85)'
    ctx.globalAlpha = Number(cs.opacity) || 1
    ctx.fillStyle = bg
    ctx.fillRect(x, y, w, h)
    const lines = (el.innerText || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5)
    ctx.fillStyle = cs.color || '#fff'
    ctx.font = `700 ${Math.max(10, 11 * k)}px monospace`
    lines.forEach((l, i) => ctx.fillText(l.slice(0, 48), x + 4 * k, y + (lines.length === 1 ? h / 2 : (8 + i * 15) * k)))
    ctx.globalAlpha = 1
  }
  if (!st.hud) return
  const c = map.getCenter()
  const pad = Math.round(H * 0.03), fs = Math.round(H * 0.022)
  ctx.font = `700 ${fs}px monospace`
  ctx.fillStyle = 'rgba(5,8,12,.72)'
  ctx.fillRect(pad, pad, W * 0.42, fs * 4.6)
  ctx.fillStyle = '#00d4ff'
  ctx.fillText(st.title.toUpperCase().slice(0, 40), pad * 1.4, pad + fs)
  ctx.fillStyle = '#e8eef4'
  ctx.fillText(`DTG ${dtg()} · RUMBO ${String(Math.round(((map.getBearing() % 360) + 360) % 360)).padStart(3, '0')}°`, pad * 1.4, pad + fs * 2.2)
  ctx.fillText(`UTM ${utm(c.lat, c.lng).text} · Z ${map.getZoom().toFixed(1)}`, pad * 1.4, pad + fs * 3.4)
  const sim = document.body.classList.contains('sim-on')
  const tag = sim ? 'SIMULACIÓN · DATOS HIPOTÉTICOS · NO OPERATIVO' : 'MAPA PERÚ ANALÍTICO · DATOS CON PROCEDENCIA'
  ctx.fillStyle = 'rgba(5,8,12,.72)'
  ctx.fillRect(pad, H - pad - fs * 1.6, ctx.measureText(tag).width + pad, fs * 1.6)
  ctx.fillStyle = sim ? '#ffb547' : '#00d4ff'
  ctx.fillText(tag, pad * 1.5, H - pad - fs * 0.8)
  // retícula y esquinas de encuadre
  ctx.strokeStyle = 'rgba(0,212,255,.6)'
  ctx.lineWidth = Math.max(1, H / 540)
  const L = H * 0.05
  for (const [x, y, sx, sy] of [[pad, pad, 1, 1], [W - pad, pad, -1, 1], [pad, H - pad, 1, -1], [W - pad, H - pad, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke()
  }
  ctx.beginPath(); ctx.moveTo(W / 2 - L / 2, H / 2); ctx.lineTo(W / 2 + L / 2, H / 2); ctx.moveTo(W / 2, H / 2 - L / 2); ctx.lineTo(W / 2, H / 2 + L / 2); ctx.stroke()
  if (st.recording && Math.floor(performance.now() / 500) % 2) {
    ctx.fillStyle = '#ff5c6c'
    ctx.beginPath(); ctx.arc(W - pad * 2.2, pad * 2, fs * 0.45, 0, Math.PI * 2); ctx.fill()
    ctx.font = `700 ${fs}px monospace`
    ctx.fillText('REC', W - pad * 2.2 - fs * 3, pad * 2)
  }
}

function startRecording() {
  const mime = pickMime()
  if (!mime) { toast('Este navegador no permite grabar video del mapa.'); return false }
  const [W, H] = st.res.split('x').map(Number)
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const ctx = canvas.getContext('2d')
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: W >= 1920 ? 12_000_000 : 6_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const onRender = () => compose(ctx, W, H)
  map.on('render', onRender)
  rec.onstop = () => {
    map.off('render', onRender)
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
    const name = `recorrido-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(chunks, { type: mime.split(';')[0] })), download: name })
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 30000)
    toast(`Video guardado en tu carpeta de Descargas: ${name}`, 8000)
    st.recording = false
    render()
  }
  st.rec = rec
  st.recording = true
  rec.start(1000)
  return true
}

function stopRecording() {
  if (st.rec && st.rec.state !== 'inactive') st.rec.stop()
}

function downloadScript() {
  const data = { format: 'mapa-peru-recorrido', version: 1, title: st.title, created_at: new Date().toISOString(), base: view.base, terrain: view.terrain, shots: st.shots }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })),
    download: `guion-recorrido-${Date.now()}.json` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

async function loadScript(file) {
  try {
    const d = JSON.parse(await file.text())
    if (d.format !== 'mapa-peru-recorrido' || !Array.isArray(d.shots)) throw new Error('Guion no reconocido')
    st.shots = d.shots.slice(0, 60).map((s) => shot({ lon: +s.lon, lat: +s.lat, zoom: +s.zoom, pitch: +s.pitch, bearing: +s.bearing }, +s.duration || 4, +s.hold || 0, String(s.label || '')))
    st.title = String(d.title || st.title).slice(0, 60)
    render()
  } catch (e) { toast(e.message) }
}

// ── panel ───────────────────────────────────────────────────────────────────
function render() {
  if (!panel) return
  const sat = view.base === 'satelite'
  panel.innerHTML = `<div class="notify-head"><h2>🎬 Recorrido 3D</h2><button class="btn btn-ghost btn-icon" type="button" data-cine="close" aria-label="Cerrar">✕</button></div>
    <label class="field"><span>Título (sale en el video)</span><input id="cine-title" maxlength="60" value="${esc(st.title)}"></label>
    <div class="seg" role="group" aria-label="Vista">
      <button type="button" data-cine="terrain" aria-pressed="${view.terrain}">Relieve 3D</button>
      <button type="button" data-cine="sat" aria-pressed="${sat}">Satélite</button>
      <button type="button" data-cine="hud" aria-pressed="${st.hud}">HUD en video</button></div>
    <p class="src-meta">Prefabricados:</p>
    <div class="tool-row"><button class="btn" type="button" data-cine="orbit">Órbita 360°</button><button class="btn" type="button" data-cine="approach">Acercamiento</button>
      <button class="btn" type="button" data-cine="flyover">Sobrevuelo</button></div>
    <div class="tool-row"><button class="btn btn-primary" type="button" data-cine="add">＋ Añadir toma (vista actual)</button>
      <button class="btn btn-ghost" type="button" data-cine="clear">Vaciar</button></div>
    <ol class="cine-shots">${st.shots.map((s, i) => `<li data-shot="${s.id}"><b>${i + 1}</b> ${esc(s.label || `Toma ${i + 1}`)}
        <small>Z ${fmt(s.zoom, 1)} · incl. ${Math.round(s.pitch)}° · rumbo ${Math.round(((s.bearing % 360) + 360) % 360)}°</small>
        <label>${i ? 'viaje' : 'inicio'} <input type="number" min="0.5" max="60" step="0.5" value="${s.duration}" data-dur="${s.id}" aria-label="Duración de la toma ${i + 1}"> s</label>
        <label>pausa <input type="number" min="0" max="30" step="0.5" value="${s.hold}" data-hold="${s.id}" aria-label="Pausa de la toma ${i + 1}"> s</label>
        <span class="cine-row"><button class="btn btn-ghost btn-icon" type="button" data-go="${s.id}" title="Ir a la toma">◎</button>
        <button class="btn btn-ghost btn-icon" type="button" data-up="${s.id}" title="Subir" ${i ? '' : 'disabled'}>↑</button>
        <button class="btn btn-ghost btn-icon" type="button" data-del="${s.id}" title="Quitar">✕</button></span></li>`).join('') || '<li class="src-meta">Sin tomas: mueve el mapa y pulsa «Añadir toma», o usa un prefabricado.</li>'}</ol>
    <progress id="cine-progress" max="1" value="0"></progress>
    <label class="field"><span>Resolución del video</span><select id="cine-res">${['1280x720', '1920x1080'].map((r) => `<option ${st.res === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <div class="tool-row">${st.playing ? '<button class="btn btn-primary" type="button" data-cine="stop">■ Detener</button>'
      : `<button class="btn" type="button" data-cine="play">▶ Vista previa</button><button class="btn btn-primary cine-rec" type="button" data-cine="rec">● Grabar video</button>`}</div>
    <div class="tool-row"><button class="btn btn-ghost" type="button" data-cine="script">Guardar guion</button>
      <label class="btn btn-ghost import-btn">Abrir guion…<input type="file" id="cine-load" accept=".json,application/json" hidden></label></div>
    <p class="src-meta">El video se guarda en esta PC (Descargas). Las etiquetas de unidades y notas se dibujan en el video; los paneles no.
      En simulación, el video rotula «datos hipotéticos · no operativo».</p>`
}

export function initCinematic() {
  const btn = document.getElementById('btn-cine')
  if (!btn) return
  panel = document.createElement('section')
  panel.className = 'notify-panel cine-panel hud hud-frame'
  panel.hidden = true
  panel.setAttribute('aria-label', 'Recorrido 3D y grabación')
  document.body.appendChild(panel)
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-pressed', String(!panel.hidden)); render() })
  panel.addEventListener('click', async (e) => {
    const t = e.target
    const a = t.closest('[data-cine]')?.dataset.cine
    const find = (attr) => st.shots.findIndex((s) => s.id === t.closest(`[${attr}]`)?.getAttribute(attr))
    if (a === 'close') { stop(); panel.hidden = true; btn.setAttribute('aria-pressed', 'false'); return }
    if (a === 'add') st.shots.push(shot(pose(), 4, 1))
    else if (a === 'clear') st.shots = []
    else if (a === 'orbit') orbit()
    else if (a === 'approach') approach()
    else if (a === 'flyover') flyover()
    else if (a === 'play') return play()
    else if (a === 'rec') return play({ record: true })
    else if (a === 'stop') stop()
    else if (a === 'hud') st.hud = !st.hud
    else if (a === 'terrain') setTerrain(!view.terrain, { camera: false })
    else if (a === 'sat') await setBase(view.base === 'satelite' ? (document.documentElement.dataset.theme === 'light' ? 'calles' : 'oscuro') : 'satelite')
    else if (a === 'script') return downloadScript()
    else if (t.closest('[data-go]')) apply(st.shots[find('data-go')])
    else if (t.closest('[data-up]')) { const i = find('data-up'); if (i > 0) [st.shots[i - 1], st.shots[i]] = [st.shots[i], st.shots[i - 1]] }
    else if (t.closest('[data-del]')) st.shots.splice(find('data-del'), 1)
    else return
    render()
  })
  panel.addEventListener('change', (e) => {
    const t = e.target
    if (t.id === 'cine-title') st.title = t.value.trim() || st.title
    if (t.id === 'cine-res') st.res = t.value
    if (t.id === 'cine-load' && t.files?.[0]) loadScript(t.files[0])
    const d = t.dataset.dur && st.shots.find((s) => s.id === t.dataset.dur)
    if (d) d.duration = Math.max(0.5, Number(t.value) || 4)
    const h = t.dataset.hold && st.shots.find((s) => s.id === t.dataset.hold)
    if (h) h.hold = Math.max(0, Number(t.value) || 0)
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.playing) stop() })
}

export const cinematicState = () => ({ shots: st.shots.length, playing: st.playing, recording: st.recording })

// Operativos conjuntos — salidas: video del operativo animado (MediaRecorder), imagen PNG del cuadro actual,
// desglose CSV por recurso y plan JSON (para volver a abrirlo). Todo se genera en el navegador y baja a Descargas.
import { map } from './map.js'
import { toast } from './util.js'
import { SIGLA, fmtT } from './joint-ops-model.js'

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
const slug = (s) => (s || 'operativo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}

export function pickMime() {
  for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m
  }
  return ''
}

/** Copia el mapa y la capa animada al lienzo de salida (recorte «cover») y devuelve la transformación usada. */
export function drawBase(ctx, W, H, overlay) {
  const src = map.getCanvas()
  const s = Math.max(W / src.width, H / src.height)
  const dw = src.width * s, dh = src.height * s, dx = (W - dw) / 2, dy = (H - dh) / 2
  ctx.drawImage(src, dx, dy, dw, dh)
  if (overlay?.width) ctx.drawImage(overlay, dx, dy, dw, dh)
  return { s, dx, dy, k: (src.width / map.getContainer().clientWidth) * s }
}

/** Grabación: `draw(ctx, W, H)` compone cada cuadro; `onDone` recibe el nombre del archivo. */
export function startRecording({ res = '1280x720', title, draw, onStop }) {
  const mime = pickMime()
  if (!mime) { toast('Este navegador no permite grabar video del mapa (prueba con Chrome o Edge).'); return null }
  const [W, H] = res.split('x').map(Number)
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const ctx = canvas.getContext('2d')
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: W >= 1920 ? 12_000_000 : 6_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const onRender = () => draw(ctx, W, H)
  map.on('render', onRender)
  rec.onstop = () => {
    map.off('render', onRender)
    const name = `${slug(title)}-${stamp()}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`
    download(new Blob(chunks, { type: mime.split(';')[0] }), name)
    toast(`Video guardado en Descargas: ${name}`, 8000)
    onStop?.(name)
  }
  rec.start(500)
  return { stop: () => rec.state !== 'inactive' && rec.stop() }
}

/** Imagen del cuadro actual (espera un render del mapa para leer el lienzo WebGL). */
export function snapshotPng({ res = '1920x1080', title, draw }) {
  const [W, H] = res.split('x').map(Number)
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
  map.once('render', () => {
    draw(canvas.getContext('2d'), W, H)
    canvas.toBlob((b) => { if (b) { download(b, `${slug(title)}-${stamp()}.png`); toast('Imagen guardada en Descargas.') } }, 'image/png')
  })
  map.triggerRepaint()
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(plan, result) {
  const ops = Object.fromEntries(plan.operations.map((o) => [o.id, o]))
  const head = ['operativo', 'nombre_operativo', 'incidencia', 'recurso', 'sigla', 'tipo', 'cantidad', 'personas_por_unidad', 'institucion',
    'origen', 'origen_tipo', 'origen_fuente', 'ruta', 'km_ida', 'km_total', 'sale_T_min', 'listo_T_min', 'llega_T_min', 'llega_P50_T_min',
    'llega_P90_T_min', 'termina_T_min', 'vuelve_T_min', 'factor_trafico', 'falla_ensayada', 'horas', 'personas_hora',
    'costo_personal_PEN', 'costo_vehiculo_PEN', 'costo_fijo_PEN', 'costo_total_PEN', 'naturaleza']
  const rows = result.units.map((u) => [u.op, ops[u.op]?.name, ops[u.op]?.incident, u.label, SIGLA[u.kind], u.kind, u.qty, u.crew,
    result.budgets[u.budget], u.origin.name, u.origin.cat, u.origin.kind === 'oficial' ? 'RENIPRESS' : u.origin.cat === 'manual' ? 'usuario' : 'OpenStreetMap',
    u.engine, u.km, u.km_total, u.t.depart, u.t.ready, u.t.arrive, u.arrive_p50, u.arrive_p90, u.t.leave, u.t.back, u.traffic_factor,
    u.failed ? 'sí' : 'no', u.hours, u.person_hours, u.has_rate ? u.cost.personal : '', u.has_rate ? u.cost.vehiculo : '',
    u.has_rate ? u.cost.fijo : '', u.has_rate ? u.cost_total : '', 'estimación'])
  const meta = [[`# ${plan.name} — desglose por recurso (S/ = soles). ${result.disclaimer}`], [`# Método: ${result.method}`],
    [`# Tarifario: ${result.totals.tariff_origin === 'ejemplo' ? 'EJEMPLO no oficial' : result.totals.tariff_origin ? 'ingresado por el usuario' : 'sin tarifas'}`],
    [`# Fuentes: ${result.provenance.map((p) => `${p.name || p.source_id} (${p.institution || ''}${p.last_downloaded ? ', descargado ' + String(p.last_downloaded).slice(0, 10) : ''})`).join(' | ')}`]]
  const txt = '﻿' + [...meta, head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n')
  download(new Blob([txt], { type: 'text/csv;charset=utf-8' }), `${slug(plan.name)}-desglose-${stamp()}.csv`)
}

export function exportJson(plan, result) {
  const body = { format: 'mapa-peru-operativo-conjunto', version: 1, saved: new Date().toISOString(), plan,
    result: result ? { totals: result.totals, operations: result.operations, method: result.method, disclaimer: result.disclaimer, provenance: result.provenance } : null }
  download(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }), `${slug(plan.name)}-${stamp()}.json`)
}

export async function readPlanFile(file) {
  const d = JSON.parse(await file.text())
  const plan = d.format === 'mapa-peru-operativo-conjunto' ? d.plan : d
  if (!Array.isArray(plan?.operations)) throw new Error('El archivo no es un plan de operativos conjuntos')
  return plan
}

/** Rótulo de tiempo para el video: T+hh:mm. */
export const tLabel = (t) => `T+${fmtT(t)}`

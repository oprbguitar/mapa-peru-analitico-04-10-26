// Operativos conjuntos sobre el mapa: varios operativos HIPOTÉTICOS a la vez, en una o varias regiones, con apoyos reales
// cercanos (comisarías, hospitales, fiscalías, mercados, aeropuertos, puertos, bases militares y navales). Al calcular,
// cada recurso sale de su sede, recorre su ruta animada y llega; dos visores (tablero y cronograma) se actualizan en vivo.
// Se descarga como video, imagen, desglose CSV o plan JSON. Tiempos y costos son ESTIMACIONES con supuestos visibles.
/* global maplibregl */
import { map } from './map.js'
import { cssVar, esc, fmt, getJSON, kindBadge, postJSON, toast } from './util.js'
import { dtg, utm } from './sim-tactical.js'
import { PHASE, PRESETS, SIGLA, clock, demoPlan, fmtT, kmBetween, prepareUnits, soles } from './joint-ops-model.js'
import { FAC_GLYPH, boardHtml, ganttHtml, leftHtml, logHtml, snapshot } from './joint-ops-view.js'
import { drawBase, exportCsv, exportJson, readPlanFile, snapshotPng, startRecording } from './joint-ops-media.js'

const LIB_KEY = 'jo.library.v1'
const PLAN_KEY = 'jo.current.v1'
const SPEEDS = [1, 2, 5, 10, 20]   // minutos virtuales por segundo real
const AIR_CATS = ['aeropuerto', 'base_militar', 'base_naval', 'puerto']
const fc = (features) => ({ type: 'FeatureCollection', features })
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sin almacenamiento */ } } }

const emptyPlan = () => ({ name: 'Operativo conjunto', hypothesis: { start_hour: 10, day: 'laboral', rain: 'ninguna', p_fail: 0.05, fail_delay: 25, return: true, seed: 7 },
  operations: [], tariff: {}, tariff_origin: 'usuario' })

const st = {
  on: false, catalog: null, plan: store.get(PLAN_KEY, null) || emptyPlan(), library: store.get(LIB_KEY, []),
  tab: 'ops', sel: null, kind: 'patrullero', pick: null, near: null, facCats: new Set(['comisaria', 'hospital', 'fiscalia', 'bomberos', ...AIR_CATS, 'serenazgo']),
  result: null, t: 0, playing: false, speed: 5, raf: 0, last: 0, busy: false, calcTimer: 0, reqSeq: 0,
  markers: new Map(), overlay: null, recorder: null, res: '1280x720', flashes: [], lastBoard: 0, logCount: -1, sheet: 'map', facTimer: 0, popup: null,
}
let root = null

// ── estructura ──────────────────────────────────────────────────────────────
function mount() {
  if (root) return
  root = document.createElement('div')
  root.className = 'jo'
  root.innerHTML = `
    <header class="jo-head hud hud-frame">
      <div class="jo-title"><b>Operativo conjunto</b><span id="jo-plan-name"></span></div>
      <div class="jo-chips" id="jo-chips" aria-label="Operativos"></div>
      <div class="jo-sheets seg" role="group" aria-label="Vista en pantallas chicas">
        <button type="button" data-act="sheet" data-sheet="left" aria-pressed="false">Plan</button>
        <button type="button" data-act="sheet" data-sheet="map" aria-pressed="true">Mapa</button>
        <button type="button" data-act="sheet" data-sheet="right" aria-pressed="false">Visores</button></div>
      <span class="jo-tag">${kindBadge('estimacion', 'ejercicio de mesa · recursos hipotéticos')}</span>
    </header>
    <aside class="jo-left hud hud-frame" id="jo-left" aria-label="Plan de operativos"></aside>
    <aside class="jo-right hud hud-frame" id="jo-right" aria-label="Visores en vivo">
      <section class="jo-visor" aria-labelledby="jo-v1"><h2 id="jo-v1" class="jo-vh">Visor 1 · Tablero en vivo</h2><div id="jo-board"></div></section>
      <section class="jo-visor" aria-labelledby="jo-v2"><h2 id="jo-v2" class="jo-vh">Visor 2 · Cronograma y bitácora</h2><div id="jo-gantt"></div><div id="jo-log" aria-live="polite"></div></section>
    </aside>
    <footer class="jo-bar hud hud-frame" aria-label="Reproducción y salidas">
      <button class="btn btn-primary jo-play" type="button" data-act="play" aria-label="Reproducir el operativo (barra espaciadora)">▶</button>
      <div class="jo-scrub"><output id="jo-t">T+00:00</output><input type="range" id="jo-range" min="0" max="240" step="0.5" value="0" aria-label="Tiempo del operativo (minutos)"></div>
      <div class="seg jo-speed" role="group" aria-label="Velocidad">${SPEEDS.map((s) => `<button type="button" data-act="speed" data-v="${s}" aria-pressed="${s === st.speed}">×${s}</button>`).join('')}</div>
      <button class="btn" type="button" data-act="calc" id="jo-calc">Calcular</button>
      <span class="jo-status" id="jo-status" role="status"></span>
      <div class="jo-out">
        <select id="jo-res" aria-label="Resolución de salida"><option value="1280x720">720p</option><option value="1920x1080">1080p</option></select>
        <button class="btn" type="button" data-act="record" id="jo-rec" title="Graba el operativo animado de principio a fin">● Grabar video</button>
        <button class="btn btn-ghost" type="button" data-act="png" title="Imagen del cuadro actual">PNG</button>
        <button class="btn btn-ghost" type="button" data-act="csv" title="Desglose por recurso: tiempos, km y costos">CSV</button>
        <button class="btn btn-ghost" type="button" data-act="export-json" title="Plan para volver a abrirlo">JSON</button>
      </div>
    </footer>
    <div class="jo-pickbar hud" id="jo-pick" role="status" hidden></div>`
  document.body.append(root)
  root.addEventListener('click', onClick)
  root.addEventListener('change', onChange)
  root.addEventListener('input', onInput)
  addEventListener('keydown', onKey)
  let gw = 0
  new ResizeObserver(([e]) => {
    const w = e.contentRect.width
    if (st.result && Math.abs(w - gw) > 8) { gw = w; renderGantt() }
  }).observe(root.querySelector('#jo-gantt'))
}

// ── capas del mapa ──────────────────────────────────────────────────────────
function ensureLayers() {
  if (map.getSource('jo-fac')) return
  for (const id of ['jo-fac', 'jo-routes', 'jo-links']) map.addSource(id, { type: 'geojson', data: fc([]) })
  const facColor = ['match', ['get', 'cat'], ...Object.keys(st.catalog.facility_labels).flatMap((c) => [c, cssVar(`--ops-f-${c}`)]), cssVar('--ink-soft')]
  map.addLayer({ id: 'jo-links', type: 'line', source: 'jo-links', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [0.5, 2], 'line-opacity': 0.9 } })
  map.addLayer({ id: 'jo-routes', type: 'line', source: 'jo-routes', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 13, 3.5], 'line-dasharray': [2, 1.5], 'line-opacity': 0.55 } })
  map.addLayer({ id: 'jo-fac', type: 'circle', source: 'jo-fac', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['match', ['get', 'cat'], ['aeropuerto', 'base_militar', 'base_naval', 'puerto'], 4, 2], 12, 6, 16, 9],
    'circle-color': facColor, 'circle-stroke-width': ['case', ['boolean', ['get', 'linked'], false], 3, 1], 'circle-stroke-color': ['case', ['boolean', ['get', 'linked'], false], cssVar('--ops-accent'), cssVar('--void')],
    'circle-opacity': 0.92 } })
  map.on('click', 'jo-fac', onFacClick)
  map.on('mouseenter', 'jo-fac', () => (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'jo-fac', () => (map.getCanvas().style.cursor = ''))
  map.on('moveend', () => { if (st.on) { clearTimeout(st.facTimer); st.facTimer = setTimeout(loadFacilities, 250) } })
  map.on('move', () => st.on && !st.playing && drawOverlay())
  map.on('resize', () => st.on && sizeOverlay())
}

function setVis(on) {
  for (const id of ['jo-fac', 'jo-routes', 'jo-links']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  for (const m of st.markers.values()) m.getElement().hidden = !on
  if (st.overlay) st.overlay.hidden = !on
}

async function loadFacilities() {
  if (!st.on || !map.getSource('jo-fac')) return
  const z = map.getZoom()
  const cats = [...st.facCats].filter((c) => z >= 9 || AIR_CATS.includes(c))
  if (!cats.length) return map.getSource('jo-fac').setData(fc([]))
  const b = map.getBounds()
  try {
    const d = await getJSON(`/api/v1/intel/ops/facilities?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(4)).join(',')}&cat=${cats.join(',')}&limit=3000`)
    const linked = new Set(st.plan.operations.flatMap((o) => (o.links || []).map((l) => l.id)))
    st.facIndex = new Map(d.items.map((f) => [f.id, f]))
    map.getSource('jo-fac').setData(fc(d.items.map((f) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: { id: f.id, cat: f.cat, name: f.name, kind: f.kind, linked: linked.has(f.id) } }))))
  } catch { /* sin conexión: el mapa sigue */ }
}

function onFacClick(e) {
  if (st.pick) return
  const f = e.features[0]?.properties
  if (!f) return
  const o = selOp()
  const lab = st.catalog.facility_labels[f.cat] || f.cat
  const html = `<div class="pop-title">${esc(f.name)}</div><div>${kindBadge(f.kind, f.kind === 'oficial' ? 'RENIPRESS' : 'OpenStreetMap')}</div>
    <div class="pop-row"><span>Tipo</span><b>${esc(lab)}</b></div>
    ${o ? `<div class="pop-row"><span>A operativo ${o.n}</span><b>${fmt(kmBetween([o.lon, o.lat], e.features[0].geometry.coordinates), 1)} km</b></div>
      <div class="jo-row"><button class="btn" type="button" data-pop="link">Conectar al operativo ${o.n}</button></div>` : '<p class="src-meta">Selecciona un operativo para conectar este apoyo.</p>'}
    ${f.cat === 'comisaria' ? `<div class="jo-row"><button class="btn btn-ghost" type="button" data-radar="${esc(f.id)}">◎ Radar y área de atención</button></div>` : ''}
    ${f.kind !== 'oficial' ? '<div class="note">Ubicación aproximada.</div>' : ''}`
  st.popup?.remove()
  st.popup = new maplibregl.Popup({ maxWidth: '300px', offset: 8 }).setLngLat(e.lngLat).setHTML(html).addTo(map)
  st.popup.getElement().querySelector('[data-pop="link"]')?.addEventListener('click', () => {
    link(o, { id: f.id, cat: f.cat, name: f.name, lat: e.features[0].geometry.coordinates[1], lon: e.features[0].geometry.coordinates[0], kind: f.kind })
    st.popup.remove()
  })
}

// ── capa animada (canvas sobre el mapa) ─────────────────────────────────────
function sizeOverlay() {
  const c = st.overlay
  const box = map.getContainer()
  const dpr = devicePixelRatio || 1
  c.width = Math.round(box.clientWidth * dpr)
  c.height = Math.round(box.clientHeight * dpr)
  c.style.width = `${box.clientWidth}px`
  c.style.height = `${box.clientHeight}px`
  drawOverlay()
}

function ensureOverlay() {
  if (st.overlay) return
  st.overlay = Object.assign(document.createElement('canvas'), { className: 'jo-canvas' })
  st.overlay.setAttribute('aria-hidden', 'true')
  const cc = map.getCanvasContainer()
  cc.insertBefore(st.overlay, map.getCanvas().nextSibling)
  sizeOverlay()
}

const colorOf = (() => {
  const cache = new Map()
  return (name) => cache.get(name) ?? (cache.set(name, cssVar(name)), cache.get(name))
})()

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Dibuja rutas recorridas, unidades, anillos y rótulos. `ex` = exportación (incluye los números que en pantalla son marcadores HTML). */
function drawOverlay(ctx = null, ex = null) {
  const c = st.overlay
  if (!c || (!ctx && c.hidden)) return
  const dpr = ex ? ex.k : (devicePixelRatio || 1)
  const g = ctx || c.getContext('2d')
  if (!ctx) g.clearRect(0, 0, c.width, c.height)
  const P = (ll) => { const p = map.project(ll); return [p.x * dpr + (ex?.dx || 0), p.y * dpr + (ex?.dy || 0)] }
  const now = performance.now()
  const still = reduced()
  const ink = colorOf('--ink'), voidc = colorOf('--void')
  // anillos y rótulos de cada operativo
  const snap = st.result ? st.snap : null
  for (const o of st.plan.operations) {
    const [x, y] = P([o.lon, o.lat])
    const col = colorOf(`--ops-op-${((o.n - 1) % 12) + 1}`)
    const r = st.result?.operations.find((q) => q.id === o.id)
    const active = r && st.t >= r.start && st.t <= (r.end ?? 0)
    const pulse = active && !still ? (Math.sin(now / 380) + 1) / 2 : 0
    const R0 = (o.priority === 'alta' ? 34 : o.priority === 'media' ? 28 : 22) * dpr
    g.save()
    g.globalAlpha = 0.16 + pulse * 0.1
    g.fillStyle = col
    g.beginPath(); g.arc(x, y, R0 * (1 + pulse * 0.25), 0, Math.PI * 2); g.fill()
    g.globalAlpha = 0.95
    g.strokeStyle = col
    g.lineWidth = 2 * dpr
    g.setLineDash(o.priority === 'baja' ? [3 * dpr, 4 * dpr] : o.priority === 'media' ? [8 * dpr, 4 * dpr] : [])
    g.beginPath(); g.arc(x, y, R0, 0, Math.PI * 2); g.stroke()
    g.restore()
    if (ex) {   // número del operativo (en pantalla lo dibuja el marcador HTML)
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 11 * dpr, 0, Math.PI * 2); g.fill()
      g.strokeStyle = ink; g.lineWidth = 2 * dpr; g.stroke()
      g.fillStyle = voidc; g.font = `700 ${12 * dpr}px "Space Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(String(o.n), x, y + dpr)
      g.textAlign = 'start'
    }
    // rótulo
    const b = snap?.byOp[o.id]
    const line2 = b ? `${b.arrived}/${b.total} en sitio · ${st.catalog.incidents[o.incident]?.label || ''}` : (st.catalog.incidents[o.incident]?.label || '')
    g.font = `700 ${12 * dpr}px "Space Grotesk", sans-serif`
    const w1 = g.measureText(o.name).width
    g.font = `${11 * dpr}px "Noto Sans", sans-serif`
    const w = Math.max(w1, g.measureText(line2).width) + 18 * dpr
    const lx = x + 16 * dpr, ly = y - 46 * dpr, lh = 34 * dpr
    g.fillStyle = 'rgba(5,8,12,.86)'
    roundRect(g, lx, ly, w, lh, 3 * dpr); g.fill()
    g.fillStyle = col; g.fillRect(lx, ly, 4 * dpr, lh)
    g.strokeStyle = col; g.lineWidth = 1 * dpr; g.beginPath(); g.moveTo(x + 8 * dpr, y - 8 * dpr); g.lineTo(lx, ly + lh); g.stroke()
    g.fillStyle = '#e6f1f7'; g.font = `700 ${12 * dpr}px "Space Grotesk", sans-serif`; g.textBaseline = 'alphabetic'
    g.fillText(o.name, lx + 10 * dpr, ly + 14 * dpr)
    g.fillStyle = '#a9bccb'; g.font = `${11 * dpr}px "Noto Sans", sans-serif`
    g.fillText(line2, lx + 10 * dpr, ly + 28 * dpr)
  }
  if (!st.result) return
  // destellos de llegada
  st.flashes = st.flashes.filter((f) => now - f.at < 900)
  for (const f of st.flashes) {
    const [x, y] = P(f.ll)
    const k = (now - f.at) / 900
    g.strokeStyle = f.color; g.globalAlpha = 1 - k; g.lineWidth = 3 * dpr
    g.beginPath(); g.arc(x, y, (14 + k * 40) * dpr, 0, Math.PI * 2); g.stroke()
    g.globalAlpha = 1
  }
  // rutas recorridas y unidades
  const onsite = {}
  for (const u of st.result.units) {
    const s = u._s
    if (!s) continue
    const col = colorOf(`--ops-k-${u.kind}`)
    if ((s.phase === 'ruta' || s.phase === 'falla' || s.phase === 'retorno') && u.coords.length > 1) {
      g.strokeStyle = col; g.lineWidth = 3.5 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'
      g.beginPath()
      const upto = s.phase === 'retorno' ? u.coords.length - 1 : (s.i ?? 1)
      const from = s.phase === 'retorno' ? (s.i ?? 1) - 1 : 0
      let [x0, y0] = P(u.coords[from])
      g.moveTo(x0, y0)
      for (let i = from + 1; i < (s.phase === 'retorno' ? u.coords.length : upto); i++) { [x0, y0] = P(u.coords[i]); g.lineTo(x0, y0) }
      const [px, py] = P(s.pos); g.lineTo(px, py)
      g.globalAlpha = 0.9; g.stroke(); g.globalAlpha = 1
    }
    let [x, y] = P(s.pos)
    if (s.phase === 'sitio') {   // en sitio: alrededor del punto para que todas se vean
      const n = (onsite[u.op] = (onsite[u.op] || 0) + 1)
      const a = n * 0.9, rr = (18 + Math.floor(n / 7) * 12) * dpr
      x += Math.cos(a) * rr; y += Math.sin(a) * rr
    }
    if (s.phase === 'base' || s.phase === 'fin') g.globalAlpha = 0.45
    const sig = SIGLA[u.kind] + (u.qty > 1 ? `×${u.qty}` : '')
    g.font = `700 ${10 * dpr}px "Space Mono", monospace`
    const bw = g.measureText(sig).width + 10 * dpr, bh = 16 * dpr
    if (s.phase === 'alistamiento' && !still) { g.strokeStyle = col; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(x, y, (12 + ((now / 60) % 12)) * dpr, 0, Math.PI * 2); g.stroke() }
    if (s.phase === 'ruta' || s.phase === 'retorno') {   // punta de rumbo
      const h = s.heading || 0
      g.fillStyle = col
      g.beginPath(); g.moveTo(x + Math.cos(-h) * (bw / 2 + 8 * dpr), y + Math.sin(-h) * (bw / 2 + 8 * dpr))
      g.lineTo(x + Math.cos(-h + 2.6) * 7 * dpr, y + Math.sin(-h + 2.6) * 7 * dpr); g.lineTo(x + Math.cos(-h - 2.6) * 7 * dpr, y + Math.sin(-h - 2.6) * 7 * dpr); g.fill()
    }
    g.fillStyle = col
    roundRect(g, x - bw / 2, y - bh / 2, bw, bh, (u.mode === 'aire' ? 8 : u.mode === 'agua' ? 1 : 3) * dpr); g.fill()
    const blink = s.phase === 'falla' && (still || Math.floor(now / 300) % 2)
    g.strokeStyle = blink ? colorOf('--warn') : voidc; g.lineWidth = (blink ? 3 : 1.5) * dpr; g.stroke()
    g.fillStyle = '#05080c'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(sig, x, y + 0.5 * dpr)
    if (s.phase === 'falla') { g.fillStyle = colorOf('--warn'); g.font = `700 ${13 * dpr}px "Noto Sans", sans-serif`; g.fillText('⚠', x + bw / 2 + 8 * dpr, y - 8 * dpr) }
    g.textAlign = 'start'; g.textBaseline = 'alphabetic'; g.globalAlpha = 1
  }
}

/** Cuadro completo para video y PNG: mapa + capa animada + HUD táctico con reloj, totales y leyenda. */
function composeFrame(ctx, W, H) {
  const tr = drawBase(ctx, W, H, null)
  drawOverlay(ctx, tr)
  const r = st.result
  const fs = Math.round(H * 0.022), pad = Math.round(H * 0.03)
  const box = (x, y, w, h) => { ctx.fillStyle = 'rgba(5,8,12,.80)'; ctx.fillRect(x, y, w, h) }
  ctx.textBaseline = 'middle'
  // cabecera
  box(pad, pad, W * 0.46, fs * 4.8)
  ctx.font = `700 ${fs * 1.1}px "Space Grotesk", sans-serif`; ctx.fillStyle = cssVar('--ops-accent')
  ctx.fillText(`OPERATIVO CONJUNTO · ${st.plan.name}`.toUpperCase().slice(0, 52), pad * 1.4, pad + fs)
  ctx.font = `700 ${fs}px "Space Mono", monospace`; ctx.fillStyle = '#e6f1f7'
  const h = r?.hypothesis || st.plan.hypothesis
  ctx.fillText(`T+${fmtT(st.t)} · ${clock(h.start_hour ?? 10, st.t)} h · DTG ${dtg()}`, pad * 1.4, pad + fs * 2.3)
  const c = map.getCenter()
  ctx.fillText(`UTM ${utm(c.lat, c.lng).text} · ${st.plan.operations.length} operativos`, pad * 1.4, pad + fs * 3.6)
  // totales en vivo
  if (r && st.snap) {
    const s = st.snap
    const lines = [['EN RUTA', s.ph.ruta + s.ph.falla], ['EN SITIO', s.ph.sitio], ['PERSONAL', s.personnel], ['KM', fmt(s.kmDone, 1)],
      ['COSTO', s.cost == null ? '—' : soles(s.cost)]]
    const bw = W * 0.2
    box(W - pad - bw, pad, bw, fs * (1.4 * lines.length + 0.8))
    lines.forEach(([k, v], i) => {
      ctx.fillStyle = '#a9bccb'; ctx.font = `700 ${fs * 0.85}px "Space Mono", monospace`; ctx.fillText(k, W - pad - bw + fs * 0.6, pad + fs * (1.1 + i * 1.4))
      ctx.fillStyle = '#e6f1f7'; ctx.font = `700 ${fs}px "Space Mono", monospace`
      ctx.textAlign = 'right'; ctx.fillText(String(v), W - pad - fs * 0.6, pad + fs * (1.1 + i * 1.4)); ctx.textAlign = 'start'
    })
    // leyenda de recursos presentes
    const kinds = [...new Set(r.units.map((u) => u.kind))]
    const lw = W * 0.2, lh = fs * (1.3 * kinds.length + 0.8)
    box(W - pad - lw, H - pad - lh - fs * 2.4, lw, lh)
    kinds.forEach((k, i) => {
      const y = H - pad - lh - fs * 2.4 + fs * (1.0 + i * 1.3)
      ctx.fillStyle = cssVar(`--ops-k-${k}`); ctx.fillRect(W - pad - lw + fs * 0.6, y - fs * 0.45, fs * 1.8, fs * 0.9)
      ctx.fillStyle = '#05080c'; ctx.font = `700 ${fs * 0.7}px "Space Mono", monospace`; ctx.fillText(SIGLA[k], W - pad - lw + fs * 0.8, y)
      ctx.fillStyle = '#e6f1f7'; ctx.font = `${fs * 0.85}px "Noto Sans", sans-serif`; ctx.fillText(st.catalog.kinds[k].label, W - pad - lw + fs * 2.8, y)
    })
  }
  const tag = 'SIMULACIÓN · RECURSOS HIPOTÉTICOS · TIEMPOS Y COSTOS ESTIMADOS'
  ctx.font = `700 ${fs}px "Space Mono", monospace`
  box(pad, H - pad - fs * 1.6, ctx.measureText(tag).width + pad, fs * 1.6)
  ctx.fillStyle = '#ffb547'; ctx.fillText(tag, pad * 1.5, H - pad - fs * 0.8)
  // barra de progreso
  if (r) { ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, H - 4, W, 4); ctx.fillStyle = cssVar('--ops-accent'); ctx.fillRect(0, H - 4, W * Math.min(1, st.t / r.totals.end), 4) }
  if (st.recorder && Math.floor(performance.now() / 500) % 2) {
    ctx.fillStyle = '#ff5c6c'; ctx.beginPath(); ctx.arc(W - pad - fs, H - pad - fs * 0.8, fs * 0.45, 0, Math.PI * 2); ctx.fill()
    ctx.fillText('REC', W - pad - fs * 4, H - pad - fs * 0.8)
  }
}

// ── marcadores de operativo ─────────────────────────────────────────────────
function paintMarkers() {
  for (const [id, m] of st.markers) if (!st.plan.operations.some((o) => o.id === id)) { m.remove(); st.markers.delete(id) }
  for (const o of st.plan.operations) {
    let m = st.markers.get(o.id)
    if (!m) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'jo-pin'
      el.addEventListener('click', (e) => { e.stopPropagation(); select(o.id) })
      m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([o.lon, o.lat]).addTo(map)
      m.on('dragend', () => {
        const ll = m.getLngLat()
        const op = st.plan.operations.find((x) => x.id === o.id)
        if (!op) return
        op.lat = +ll.lat.toFixed(6); op.lon = +ll.lng.toFixed(6)
        changed({ near: true })
      })
      st.markers.set(o.id, m)
    }
    const el = m.getElement()
    el.textContent = String(o.n)
    el.style.setProperty('--c', `var(--ops-op-${((o.n - 1) % 12) + 1})`)
    el.setAttribute('aria-label', `Operativo ${o.n}: ${o.name}. Arrastra para moverlo`)
    el.setAttribute('aria-pressed', String(o.id === st.sel))
    m.setLngLat([o.lon, o.lat])
  }
}

function paintLinks() {
  if (!map.getSource('jo-links')) return
  const feats = st.plan.operations.flatMap((o) => (o.links || []).map((l) => ({ type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[o.lon, o.lat], [l.lon, l.lat]] }, properties: { color: cssVar(`--ops-f-${l.cat}`) } })))
  map.getSource('jo-links').setData(fc(feats))
}

function paintRoutes() {
  if (!map.getSource('jo-routes')) return
  map.getSource('jo-routes').setData(fc((st.result?.units || []).filter((u) => u.coords.length > 1).map((u) => ({ type: 'Feature',
    geometry: { type: 'LineString', coordinates: u.coords }, properties: { color: cssVar(`--ops-k-${u.kind}`) } }))))
}

// ── render de paneles ───────────────────────────────────────────────────────
const selOp = () => st.plan.operations.find((o) => o.id === st.sel)

function renderLeft() {
  const el = root.querySelector('#jo-left')
  const y = el.querySelector('.jo-tabbody')?.scrollTop || 0
  el.innerHTML = leftHtml(st)
  const body = el.querySelector('.jo-tabbody')
  if (body) body.scrollTop = y
  root.querySelector('#jo-plan-name').textContent = st.plan.name
  root.querySelector('#jo-chips').innerHTML = st.plan.operations.map((o) => `<button type="button" class="jo-chip" data-act="sel-op" data-id="${o.id}" aria-pressed="${o.id === st.sel}"
    style="--c:var(--ops-op-${((o.n - 1) % 12) + 1})"><span>${o.n}</span>${esc(o.name)}</button>`).join('')
    + (st.plan.operations.length > 1 ? '<button type="button" class="jo-chip" data-act="fit">Vista conjunta</button>' : '')
}

function renderGantt() {
  const el = root.querySelector('#jo-gantt')
  if (!st.result) { el.innerHTML = ''; return }
  el.innerHTML = ganttHtml(st, el.clientWidth || 600)
  movePlayhead()
}

function movePlayhead() {
  const svg = root.querySelector('.jo-gantt')
  if (!svg || !st.result) return
  const x = (st.t / +svg.dataset.end) * +svg.getAttribute('width')
  const ph = svg.querySelector('#jo-playhead')
  ph.setAttribute('x1', x); ph.setAttribute('x2', x)
}

function renderVisors(force = false) {
  const board = root.querySelector('#jo-board')
  if (!st.result) {
    board.innerHTML = `<p class="note">${st.plan.operations.length ? 'Pulsa <b>Calcular</b>: se eligen las sedes de salida, se trazan las rutas y se estiman tiempos y costos.' : 'Crea uno o más operativos para empezar.'}</p>`
    root.querySelector('#jo-log').innerHTML = ''
    return
  }
  const now = performance.now()
  if (force || now - st.lastBoard > 150) {
    st.lastBoard = now
    board.innerHTML = boardHtml(st, st.t, st.snap)
  }
  const n = st.result.events.filter((e) => e.t <= st.t).length
  if (force || n !== st.logCount) { st.logCount = n; root.querySelector('#jo-log').innerHTML = logHtml(st, st.t) }
  movePlayhead()
}

function renderBar() {
  const r = st.result
  const range = root.querySelector('#jo-range')
  range.max = String(Math.ceil(r ? r.totals.end + 5 : 240))
  range.value = String(st.t)
  range.disabled = !r
  root.querySelector('#jo-t').textContent = `T+${fmtT(st.t)}`
  const play = root.querySelector('[data-act="play"]')
  play.textContent = st.playing ? '❚❚' : '▶'
  play.setAttribute('aria-label', st.playing ? 'Pausar (barra espaciadora)' : 'Reproducir el operativo (barra espaciadora)')
  play.disabled = !r
  root.querySelector('#jo-calc').setAttribute('aria-busy', String(st.busy))
  root.querySelector('#jo-rec').textContent = st.recorder ? '■ Detener' : '● Grabar video'
  root.querySelector('#jo-rec').setAttribute('aria-pressed', String(!!st.recorder))
  for (const b of root.querySelectorAll('[data-act="speed"]')) b.setAttribute('aria-pressed', String(+b.dataset.v === st.speed))
  for (const b of root.querySelectorAll('[data-act="csv"], #jo-rec')) b.disabled = !r
}

function status(msg) { root.querySelector('#jo-status').innerHTML = msg }

function frame(t) {
  st.t = t
  if (st.result) st.snap = snapshot(st, t)
  drawOverlay()
  renderVisors()
  root.querySelector('#jo-range').value = String(t)
  root.querySelector('#jo-t').textContent = `T+${fmtT(t)}`
}

// ── cálculo ─────────────────────────────────────────────────────────────────
function changed({ near = false, calc = true } = {}) {
  store.set(PLAN_KEY, st.plan)
  paintMarkers()
  paintLinks()
  renderLeft()
  if (near) loadNear()
  drawOverlay()
  if (calc && st.result) { clearTimeout(st.calcTimer); st.calcTimer = setTimeout(calculate, 700) }   // recálculo en vivo
  if (!st.result) renderVisors(true)
}

async function calculate() {
  if (!st.plan.operations.length) return toast('Agrega al menos un operativo.')
  if (!st.plan.operations.some((o) => o.resources.length)) return toast('Agrega recursos al operativo (o usa la Plantilla).')
  const seq = ++st.reqSeq
  st.busy = true
  renderBar()
  status('<span class="loading">Trazando rutas y estimando</span>')
  try {
    const body = { operations: st.plan.operations.map(({ id, lat, lon, incident, start, onsite, complexity, resources }) => ({ id, lat, lon, incident, start, onsite, complexity, resources })),
      hypothesis: st.plan.hypothesis, tariff: st.plan.tariff, tariff_origin: st.plan.tariff_origin }
    const r = await postJSON('/api/v1/intel/ops/plan', body)
    if (seq !== st.reqSeq) return
    prepareUnits(r.units)
    const keepT = st.result ? Math.min(st.t, r.totals.end + 5) : 0
    st.result = r
    paintRoutes()
    renderLeft()
    renderGantt()
    st.logCount = -1
    frame(keepT)
    renderVisors(true)
    const osrm = r.units.filter((u) => u.engine === 'OSRM').length
    status(`${r.units.length} recursos · ${osrm} rutas por carretera${r.warnings.length ? ` · <span class="jo-warn">${r.warnings.length} sin origen</span>` : ''}`)
  } catch (e) {
    if (seq === st.reqSeq) { status(`<span class="jo-warn">${esc(e.message)}</span>`); toast(e.message) }
  } finally {
    if (seq === st.reqSeq) { st.busy = false; renderBar() }
  }
}

// ── reproducción ────────────────────────────────────────────────────────────
function play() {
  if (!st.result) return
  if (st.t >= st.result.totals.end) st.t = 0
  st.playing = true
  st.last = performance.now()
  renderBar()
  const tick = (now) => {
    if (!st.playing) return
    const dt = Math.min(0.1, (now - st.last) / 1000)
    st.last = now
    const prev = st.t
    const t = Math.min(st.result.totals.end + 2, st.t + dt * st.speed)
    for (const e of st.result.events) {
      if (e.type === 'llegada' && e.t > prev && e.t <= t && !reduced()) {
        const o = st.plan.operations.find((x) => x.id === e.op)
        const u = st.result.units.find((x) => x.id === e.unit)
        if (o) st.flashes.push({ ll: [o.lon, o.lat], at: now, color: cssVar(`--ops-k-${u?.kind || 'externo'}`) })
      }
    }
    frame(t)
    if (st.recorder) map.triggerRepaint()
    if (t >= st.result.totals.end + 2) { pause(); if (st.recorder) setTimeout(stopRecording, 400); return }
    st.raf = requestAnimationFrame(tick)
  }
  st.raf = requestAnimationFrame(tick)
}

function pause() {
  st.playing = false
  cancelAnimationFrame(st.raf)
  renderBar()
  drawOverlay()
}

function seek(t) {
  if (!st.result) return
  frame(Math.max(0, Math.min(+root.querySelector('#jo-range').max, t)))
}

function record() {
  if (st.recorder) return stopRecording()
  if (!st.result) return toast('Calcula el plan antes de grabar.')
  st.res = root.querySelector('#jo-res').value
  pause()
  frame(0)
  st.recorder = startRecording({ res: st.res, title: st.plan.name, draw: composeFrame, onStop: (name) => { st.recorder = null; renderBar(); status(`Video guardado en Descargas: ${esc(name)}`) } })
  if (!st.recorder) return
  renderBar()
  status('<span class="jo-rec-dot"></span> Grabando el operativo de principio a fin')
  setTimeout(play, 300)
}

function stopRecording() {
  const r = st.recorder
  if (!r) return
  pause()
  r.stop()
}

// ── acciones ────────────────────────────────────────────────────────────────
function nextN() { const used = new Set(st.plan.operations.map((o) => o.n)); let n = 1; while (used.has(n)) n++; return n }

function addOp(lngLat) {
  const n = nextN()
  const o = { id: `op${Date.now().toString(36)}${n}`, n, name: `Operativo ${n}`, incident: 'intervencion', priority: 'media', start: 0,
    lat: +lngLat.lat.toFixed(6), lon: +lngLat.lng.toFixed(6), links: [], resources: PRESETS.intervencion.map(([kind, qty]) => ({ kind, qty })) }
  st.plan.operations.push(o)
  st.sel = o.id
  st.near = null
  changed({ near: true })
  if (st.result) calculate()
  else status('Operativo creado con la plantilla de intervención. Ajusta sus recursos y pulsa <b>Calcular</b>.')
}

function select(id) {
  st.sel = id
  st.near = null
  st.tab = st.tab === 'lib' || st.tab === 'hipo' ? 'ops' : st.tab
  paintMarkers()
  renderLeft()
  loadNear()
  if (matchMedia('(max-width: 767px)').matches) setSheet('left')
}

async function loadNear() {
  const o = selOp()
  if (!o) return
  const id = o.id
  try {
    const d = await getJSON(`/api/v1/intel/ops/nearest?lat=${o.lat}&lon=${o.lon}&n=3&max_km=300`)
    if (st.sel !== id) return
    st.near = d
    if (st.tab === 'apoyos') renderLeft()
  } catch { st.near = { by_cat: {}, note: 'No se pudo consultar las sedes cercanas.' } }
}

function link(o, f) {
  if (!o) return
  o.links ??= []
  const i = o.links.findIndex((l) => l.id === f.id)
  if (i >= 0) o.links.splice(i, 1)
  else o.links.push({ ...f, km: +kmBetween([o.lon, o.lat], [f.lon, f.lat]).toFixed(2) })
  changed({ calc: false })
  loadFacilities()
}

function setPick(p) {
  st.pick = p
  const bar = root.querySelector('#jo-pick')
  bar.hidden = !p
  bar.innerHTML = p ? `${p.type === 'op' ? 'Haz clic en el mapa donde ocurre el operativo' : 'Haz clic en el mapa en el punto de salida del recurso'} · <button type="button" class="btn btn-ghost" data-act="cancel-pick">Cancelar (Esc)</button>` : ''
  map.getCanvas().style.cursor = p ? 'crosshair' : ''
  renderLeft()
}

function setSheet(s) {
  st.sheet = s
  root.dataset.sheet = s
  for (const b of root.querySelectorAll('[data-act="sheet"]')) b.setAttribute('aria-pressed', String(b.dataset.sheet === s))
  if (s === 'right' && st.result) renderGantt()
}

function fitAll() {
  const ops = st.plan.operations
  if (!ops.length) return
  if (ops.length === 1) return map.flyTo({ center: [ops[0].lon, ops[0].lat], zoom: 12, duration: reduced() ? 0 : 900 })
  const b = new maplibregl.LngLatBounds()
  for (const o of ops) b.extend([o.lon, o.lat])
  for (const u of st.result?.units || []) b.extend(u.coords[0])
  const wide = innerWidth >= 1024
  map.fitBounds(b, { padding: { top: 140, bottom: 110, left: wide ? 400 : 40, right: wide ? 440 : 40 }, maxZoom: 13, duration: reduced() ? 0 : 900 })
}

function loadPlan(plan) {
  pause()
  st.plan = { ...emptyPlan(), ...structuredClone(plan) }
  st.plan.operations.forEach((o, i) => { o.n ??= i + 1; o.links ??= []; o.resources ??= [] })
  st.result = null
  st.sel = st.plan.operations[0]?.id || null
  st.t = 0
  paintRoutes()
  changed({ near: true, calc: false })
  renderGantt()
  renderVisors(true)
  renderBar()
  fitAll()
  if (st.plan.operations.length) calculate()
}

/** Agrega los 4 operativos de ejemplo (marcados como tales) sin borrar los del usuario. */
function addDemo() {
  const demo = demoPlan()
  if (!st.plan.operations.length) {
    st.plan.name = demo.name
    st.plan.hypothesis = { ...st.plan.hypothesis, ...demo.hypothesis }
  }
  for (const o of demo.operations) {
    const n = nextN()
    st.plan.operations.push({ ...o, id: `demo${Date.now().toString(36)}${n}`, n, demo: true })
  }
  st.sel = st.plan.operations.find((o) => o.demo)?.id || st.sel
  st.result = null
  paintRoutes()
  changed({ near: true, calc: false })
  fitAll()
  calculate()
}

function removeOps(pred) {
  pause()
  st.plan.operations = st.plan.operations.filter((o) => !pred(o))
  st.sel = st.plan.operations[0]?.id || null
  st.near = null
  st.result = null
  st.t = 0
  paintRoutes()
  renderGantt()
  changed({ near: true, calc: false })
  renderBar()
  status(st.plan.operations.length ? 'Plan actualizado. Pulsa <b>Calcular</b>.' : 'Plan vacío. Crea un operativo con <b>＋ Operativo en el mapa</b> o carga el <b>Ejemplo</b>.')
  if (st.plan.operations.length) calculate()
}

function onClick(e) {
  const b = e.target.closest('[data-act]')
  if (!b || b.tagName === 'INPUT' && b.type !== 'button') return
  const act = b.dataset.act
  const o = selOp()
  const i = +b.dataset.i
  switch (act) {
    case 'tab': st.tab = b.dataset.tab; renderLeft(); if (st.tab === 'apoyos' && !st.near) loadNear(); break
    case 'add-op': setPick(st.pick?.type === 'op' ? null : { type: 'op' }); break
    case 'cancel-pick': setPick(null); break
    case 'demo': addDemo(); break
    case 'undemo': removeOps((x) => x.demo); toast('Ejemplo retirado. Puedes volver a cargarlo con «Ejemplo».'); break
    case 'clear-ops':
      if (confirm(`¿Quitar los ${st.plan.operations.length} operativos del plan? (Los planes guardados no se borran.)`)) removeOps(() => true)
      break
    case 'radar-toggle': import('./comisaria-radar.js').then((r) => r.toggleRadar()); break
    case 'sel-op': select(b.dataset.id); { const op = selOp(); if (op && !b.closest('.jo-left')) map.flyTo({ center: [op.lon, op.lat], zoom: Math.max(map.getZoom(), 12), duration: reduced() ? 0 : 800 }) } break
    case 'fly-op': map.flyTo({ center: [o.lon, o.lat], zoom: Math.max(map.getZoom(), 13), duration: reduced() ? 0 : 800 }); break
    case 'fit': fitAll(); break
    case 'del-op':
      st.plan.operations = st.plan.operations.filter((x) => x.id !== b.dataset.id)
      st.sel = st.plan.operations[0]?.id || null
      if (!st.plan.operations.length) { st.result = null; paintRoutes(); renderGantt() }
      changed({ near: true })
      break
    case 'add-res': {
      const kind = root.querySelector('#jo-kind').value
      st.kind = kind
      o.resources.push({ kind, qty: Math.max(1, +root.querySelector('#jo-qty').value || 1) })
      changed()
      break
    }
    case 'preset': o.resources = (PRESETS[o.incident] || []).map(([kind, qty]) => ({ kind, qty })); changed(); break
    case 'del-res': o.resources.splice(i, 1); changed(); break
    case 'pick-origin': setPick({ type: 'origin', op: o.id, i }); break
    case 'auto-origin': delete o.resources[i].origin; changed(); break
    case 'link': {
      const f = Object.values(st.near?.by_cat || {}).flat().find((x) => x.id === b.dataset.fid)
      if (f) link(o, { id: f.id, cat: f.cat, name: f.name, lat: f.lat, lon: f.lon, kind: f.kind })
      break
    }
    case 'unlink': o.links.splice(i, 1); changed({ calc: false }); loadFacilities(); break
    case 'tariff-example': st.plan.tariff = structuredClone(st.catalog.example_tariff); st.plan.tariff_origin = 'ejemplo'; changed(); break
    case 'tariff-clear': st.plan.tariff = {}; st.plan.tariff_origin = 'usuario'; changed(); break
    case 'save': {
      const lib = st.library.filter((p) => p.name !== st.plan.name)
      lib.unshift({ name: st.plan.name, saved: Date.now(), plan: structuredClone(st.plan) })
      st.library = lib.slice(0, 30)
      store.set(LIB_KEY, st.library)
      toast(`Plan «${st.plan.name}» guardado en este navegador.`)
      renderLeft()
      break
    }
    case 'open': loadPlan(st.library[i].plan); st.tab = 'ops'; renderLeft(); break
    case 'lib-del': st.library.splice(i, 1); store.set(LIB_KEY, st.library); renderLeft(); break
    case 'new': loadPlan(emptyPlan()); break
    case 'export-json': exportJson(st.plan, st.result); break
    case 'csv': if (st.result) exportCsv(st.plan, st.result); break
    case 'png': snapshotPng({ res: root.querySelector('#jo-res').value, title: st.plan.name, draw: composeFrame }); break
    case 'record': record(); break
    case 'play': st.playing ? pause() : play(); break
    case 'speed': st.speed = +b.dataset.v; renderBar(); break
    case 'calc': calculate(); break
    case 'sheet': setSheet(b.dataset.sheet); break
    case 'seek-gantt': {
      const svg = b.closest('svg')
      const r = svg.getBoundingClientRect()
      seek(((e.clientX - r.left) / r.width) * +svg.dataset.end)
      break
    }
  }
}

function onChange(e) {
  const el = e.target
  const o = selOp()
  if (el.dataset.act === 'fac-cat') {
    el.checked ? st.facCats.add(el.dataset.cat) : st.facCats.delete(el.dataset.cat)
    return loadFacilities()
  }
  if (el.dataset.act === 'import') {
    const f = el.files?.[0]
    if (f) readPlanFile(f).then((p) => { loadPlan(p); toast(`Plan «${p.name || 'importado'}» abierto.`) }).catch((err) => toast(err.message))
    return
  }
  if (el.dataset.field && o) {
    const k = el.dataset.field
    o[k] = el.type === 'number' ? +el.value : el.value
    if (k === 'incident') { delete o.onsite; delete o.complexity }
    return changed()
  }
  if (el.dataset.rfield && o) {
    const r = o.resources[+el.closest('tr').dataset.i]
    r[el.dataset.rfield] = el.type === 'checkbox' ? el.checked : +el.value
    return changed()
  }
  if (el.dataset.hfield) {
    const k = el.dataset.hfield
    const h = st.plan.hypothesis
    if (k === 'return') h.return = el.checked
    else if (k === 'routing') h.routing = el.checked ? 'osrm' : 'recta'
    else if (k === 'congestion') h.congestion = el.value === '' ? null : +el.value
    else h[k] = el.type === 'number' ? +el.value : el.value
    return changed()
  }
  if (el.dataset.tfield) {
    const kind = el.closest('tr').dataset.kind
    st.plan.tariff[kind] ??= {}
    if (el.value === '') delete st.plan.tariff[kind][el.dataset.tfield]
    else st.plan.tariff[kind][el.dataset.tfield] = +el.value
    st.plan.tariff_origin = 'usuario'
    return changed()
  }
  if (el.dataset.pfield) { st.plan.name = el.value.trim() || 'Operativo conjunto'; changed({ calc: false }) }
  if (el.id === 'jo-range') seek(+el.value)
}

function onInput(e) {
  if (e.target.id === 'jo-range') { if (st.playing) pause(); seek(+e.target.value) }
}

function onKey(e) {
  if (!st.on || e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape' && st.pick) { setPick(null); e.preventDefault() }
  else if (e.key === ' ' && st.result) { st.playing ? pause() : play(); e.preventDefault() }
  else if (e.key === 'ArrowRight' && st.result) { seek(st.t + 5); e.preventDefault() }
  else if (e.key === 'ArrowLeft' && st.result) { seek(st.t - 5); e.preventDefault() }
}

// ── API para main.js ────────────────────────────────────────────────────────
export function onMapClick(e) {
  if (!st.pick) {
    if (map.queryRenderedFeatures(e.point, { layers: ['jo-fac'] }).length) return
    return import('./comisaria-radar.js').then((r) => r.radarClick(e.lngLat))
  }
  if (st.pick.type === 'op') { setPick(null); return addOp(e.lngLat) }
  if (st.pick.type === 'origin') {
    const o = st.plan.operations.find((x) => x.id === st.pick.op)
    const r = o?.resources[st.pick.i]
    if (r) {
      const near = map.queryRenderedFeatures(e.point, { layers: ['jo-fac'] })[0]?.properties
      r.origin = near ? { id: near.id, name: near.name, cat: near.cat, kind: near.kind, lat: e.lngLat.lat, lon: e.lngLat.lng }
        : { id: 'manual', name: `Punto ${fmt(e.lngLat.lat, 4)}, ${fmt(e.lngLat.lng, 4)}`, cat: 'manual', kind: 'usuario', lat: +e.lngLat.lat.toFixed(6), lon: +e.lngLat.lng.toFixed(6) }
      if (near) { const f = st.facIndex?.get(near.id); if (f) { r.origin.lat = f.lat; r.origin.lon = f.lon } }
    }
    setPick(null)
    changed()
    if (!st.result) calculate()
  }
}

export async function renderJointOps() {
  mount()
  st.on = true
  document.body.classList.add('jo-on')
  root.hidden = false
  setSheet(innerWidth < 768 ? 'map' : st.sheet)
  if (!st.catalog) {
    root.querySelector('#jo-left').innerHTML = '<p class="loading">Cargando catálogo de recursos y apoyos</p>'
    try { st.catalog = await getJSON('/api/v1/intel/ops/catalog') } catch (e) { root.querySelector('#jo-left').innerHTML = `<p class="note">${esc(e.message)}</p>`; return }
  }
  ensureLayers()
  ensureOverlay()
  setVis(true)
  // planes guardados con la versión anterior: los operativos del ejemplo se reconocen por nombre y ubicación
  const demoKeys = new Set(demoPlan().operations.map((o) => `${o.name}|${o.lat}|${o.lon}`))
  for (const o of st.plan.operations) if (demoKeys.has(`${o.name}|${o.lat}|${o.lon}`)) o.demo = true
  st.sel ??= st.plan.operations[0]?.id || null
  paintMarkers()
  paintLinks()
  paintRoutes()
  renderLeft()
  renderVisors(true)
  renderBar()
  loadFacilities()
  if (st.plan.operations.length) { fitAll(); if (!st.result) calculate() }
  else {
    status('Crea un operativo con <b>＋ Operativo en el mapa</b> o carga el <b>Ejemplo</b>.')
    map.flyTo({ center: [-75.5, -9.3], zoom: 4.8, duration: reduced() ? 0 : 900 })
  }
}

export function hideJointOps() {
  if (!root) return
  st.on = false
  pause()
  stopRecording()
  setPick(null)
  st.popup?.remove()
  document.body.classList.remove('jo-on')
  root.hidden = true
  setVis(false)
}

export const jointOpsState = () => ({ on: st.on, operations: st.plan.operations.length, units: st.result?.units.length || 0, t: st.t,
  playing: st.playing, recording: !!st.recorder, phases: st.snap?.ph || null })
export { PHASE }

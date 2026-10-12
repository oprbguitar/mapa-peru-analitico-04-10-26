/* Nivel de calle con Mapillary: cobertura (teselas vectoriales oficiales) en verde, clic → foto más cercana,
   recorrido por la secuencia y vista 360° arrastrable. El token se queda en el servidor; el navegador solo ve
   rutas propias (/api/v1/street/…). */
/* global maplibregl */
const SRC = 'street-cov'
const LINE = 'street-cov-line'
const SEL = 'street-cov-sel'
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const YEAR0 = 2014

function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
  if (html) n.innerHTML = html
  return n
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function mountStreetImagery(map, container) {
  const f = { on: true, pano: '', since: YEAR0 - 1 }   // pano: '' todas · 'true' 360° · 'false' planas; since: año mínimo (YEAR0-1 = cualquiera)
  let seq = { id: '', ids: [], i: -1 }, current = null, marker = null, playTimer = 0, abort = null, destroyed = false
  const year = new Date().getFullYear()
  const root = el('div', { class: 'street' })
  root.innerHTML = `
    <div class="street-head"><h2>Nivel de calle</h2><span class="street-rule" aria-hidden="true"></span>
      <button type="button" class="street-on" data-st="on" aria-pressed="true">ON</button>
      <button type="button" class="btn btn-icon" data-st="play" aria-label="Recorrer la secuencia" disabled>▶</button></div>
    <dl class="street-rows">
      <dt>Proveedor</dt><dd><span class="street-chip"><i aria-hidden="true"></i>Mapillary</span></dd>
      <dt>Imágenes</dt><dd><div class="seg" role="group" aria-label="Tipo de imagen">
        <button type="button" data-pano="" aria-pressed="true">Todas</button><button type="button" data-pano="true" aria-pressed="false">360°</button>
        <button type="button" data-pano="false" aria-pressed="false">Planas</button></div></dd>
      <dt>Desde</dt><dd><input type="range" min="${YEAR0 - 1}" max="${year}" value="${YEAR0 - 1}" aria-label="Año mínimo de captura" data-st="since">
        <output class="street-since">Cualquier fecha</output></dd></dl>
    <p class="street-key"><span><i class="k-cov"></i>Mapillary</span><span><i class="k-sel"></i>Seleccionada</span></p>
    <p class="street-status" role="status" aria-live="polite">Acerca el mapa (zoom 13 o más) para ver las calles con fotos y haz clic en una línea verde.</p>
    <figure class="street-view" hidden><div class="street-photo" tabindex="0" aria-label="Fotografía; arrastra para girar si es 360°"></div>
      <figcaption></figcaption>
      <div class="street-nav"><button type="button" class="btn btn-icon" data-st="prev" aria-label="Foto anterior de la secuencia">◀</button>
        <output class="street-pos"></output><button type="button" class="btn btn-icon" data-st="next" aria-label="Foto siguiente de la secuencia">▶</button></div></figure>`
  container.replaceChildren(root)
  const $ = (s) => root.querySelector(s)
  const status = (t) => { $('.street-status').textContent = t }

  // ── capa de cobertura ────────────────────────────────────────────────────
  const filter = () => {
    const parts = ['all']
    if (f.pano) parts.push(['==', ['get', 'is_pano'], f.pano === 'true'])
    if (f.since >= YEAR0) parts.push(['>=', ['get', 'captured_at'], Date.UTC(f.since, 0, 1)])
    return parts.length > 1 ? parts : null
  }
  const addLayers = () => {
    if (destroyed || !f.on) return
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'vector', tiles: [`${location.origin}/api/v1/street/tiles/{z}/{x}/{y}.pbf`],
      minzoom: 13, maxzoom: 13, attribution: '© Mapillary (CC BY-SA)' })
    const css = getComputedStyle(document.documentElement)
    if (!map.getLayer(LINE)) map.addLayer({ id: LINE, type: 'line', source: SRC, 'source-layer': 'sequence', minzoom: 13,
      layout: { 'line-cap': 'round' }, paint: { 'line-color': css.getPropertyValue('--street-cov').trim() || '#05cb63', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.8, 17, 3], 'line-opacity': 0.75 } })
    if (!map.getLayer(SEL)) map.addLayer({ id: SEL, type: 'line', source: SRC, 'source-layer': 'sequence', minzoom: 13,
      filter: ['==', ['get', 'id'], seq.id || '-'], paint: { 'line-color': css.getPropertyValue('--street-sel').trim() || '#35d0ff', 'line-width': 5 } })
    map.setFilter(LINE, filter())
    map.setFilter(SEL, ['==', ['get', 'id'], seq.id || '-'])
  }
  const removeLayers = () => {
    for (const id of [SEL, LINE]) if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(SRC)) map.removeSource(SRC)
  }

  // ── foto ─────────────────────────────────────────────────────────────────
  const show = (item) => {
    current = item
    const fig = $('.street-view')
    fig.hidden = false
    const ph = $('.street-photo')
    ph.dataset.pano = String(item.is_pano)
    ph.style.backgroundImage = `url("${item.thumbnail}")`
    ph.style.backgroundPositionX = '50%'
    const date = item.captured_at ? new Date(item.captured_at).toLocaleDateString('es-PE', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }) : 'fecha no publicada'
    fig.querySelector('figcaption').innerHTML = `${item.is_pano ? '<b>360°</b> · arrastra para girar · ' : ''}Capturada: ${esc(date)} ·
      <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Abrir en Mapillary</a> · © colaboradores (CC BY‑SA)`
    if (!marker) {
      const m = el('div', { class: 'street-marker', 'aria-hidden': 'true' })
      marker = new maplibregl.Marker({ element: m, rotationAlignment: 'map' })
    }
    marker.setLngLat([item.lon, item.lat]).setRotation(item.compass ?? 0).addTo(map)
    map.easeTo({ center: [item.lon, item.lat], duration: reduce() ? 0 : 400 })
    $('.street-pos').textContent = seq.ids.length ? `${seq.i + 1} / ${seq.ids.length}` : ''
    $('[data-st="play"]').disabled = seq.ids.length < 2
    $('[data-st="prev"]').disabled = seq.i <= 0
    $('[data-st="next"]').disabled = seq.i < 0 || seq.i >= seq.ids.length - 1
    status(seq.ids.length ? `${seq.ids.length} imágenes en esta secuencia · Esc limpia` : 'Foto más cercana al clic · Esc limpia')
  }

  const loadSequence = async (item) => {
    if (!item.sequence) { seq = { id: '', ids: [], i: -1 }; return }
    if (seq.id !== item.sequence) {
      try { seq = { id: item.sequence, ids: (await getJSON(`/api/v1/street/sequence/${encodeURIComponent(item.sequence)}`)).ids, i: -1 } }
      catch { seq = { id: item.sequence, ids: [], i: -1 } }
    }
    seq.i = seq.ids.indexOf(item.id)
    if (map.getLayer(SEL)) map.setFilter(SEL, ['==', ['get', 'id'], seq.id])
  }

  const step = async (d) => {
    const i = seq.i + d
    if (i < 0 || i >= seq.ids.length) return stop()
    try {
      const item = await getJSON(`/api/v1/street/meta/${seq.ids[i]}`)
      seq.i = i
      show(item)
    } catch (e) { status(e.message); stop() }
  }
  const stop = () => { clearInterval(playTimer); playTimer = 0; const b = $('[data-st="play"]'); if (b) { b.textContent = '▶'; b.setAttribute('aria-pressed', 'false') } }

  async function getJSON(url) {
    const r = await fetch(url, { signal: abort?.signal })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Mapillary no respondió.')
    return j.data || j
  }

  const click = async (e) => {
    if (!f.on) return
    if (map.getZoom() < 13) return status('Acerca el mapa a zoom 13 o más para elegir una foto.')
    abort?.abort(); abort = new AbortController(); stop()
    status('Buscando la foto más cercana…')
    try {
      const q = new URLSearchParams({ lon: e.lngLat.lng.toFixed(6), lat: e.lngLat.lat.toFixed(6) })
      if (f.pano) q.set('pano', f.pano)
      if (f.since >= YEAR0) q.set('since', `${f.since}-01-01`)
      const r = await getJSON(`/api/v1/street/near?${q}`)
      if (destroyed) return
      if (r.status === 'key_required') return status(r.note)
      if (!r.item) return status(r.note || 'Sin fotos cerca de este punto.')
      await loadSequence(r.item)
      show(r.item)
    } catch (err) { if (err.name !== 'AbortError') status(err.message) }
  }

  // ── panorámica arrastrable ───────────────────────────────────────────────
  const ph = $('.street-photo')
  let drag = null
  ph.addEventListener('pointerdown', (e) => { if (ph.dataset.pano !== 'true') return; drag = { x: e.clientX, p: parseFloat(ph.style.backgroundPositionX) || 50 }; ph.setPointerCapture(e.pointerId) })
  ph.addEventListener('pointermove', (e) => { if (drag) ph.style.backgroundPositionX = `${drag.p - (e.clientX - drag.x) / ph.clientWidth * 50}%` })
  ph.addEventListener('pointerup', () => { drag = null })
  ph.addEventListener('keydown', (e) => {
    if (ph.dataset.pano !== 'true' || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    ph.style.backgroundPositionX = `${(parseFloat(ph.style.backgroundPositionX) || 50) + (e.key === 'ArrowLeft' ? -5 : 5)}%`
  })

  // ── controles ────────────────────────────────────────────────────────────
  root.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pano]')
    if (p) {
      f.pano = p.dataset.pano
      root.querySelectorAll('[data-pano]').forEach((b) => b.setAttribute('aria-pressed', String(b === p)))
      if (map.getLayer(LINE)) map.setFilter(LINE, filter())
      return
    }
    const a = e.target.closest('[data-st]')?.dataset.st
    if (a === 'on') {
      f.on = !f.on
      e.target.setAttribute('aria-pressed', String(f.on))
      e.target.textContent = f.on ? 'ON' : 'OFF'
      if (f.on) addLayers(); else { removeLayers(); marker?.remove() }
    } else if (a === 'prev') { stop(); step(-1) }
    else if (a === 'next') { stop(); step(1) }
    else if (a === 'play') {
      if (playTimer) return stop()
      e.target.textContent = '❚❚'
      e.target.setAttribute('aria-pressed', 'true')
      playTimer = setInterval(() => step(1), 1600)
    }
  })
  root.addEventListener('input', (e) => {
    if (e.target.dataset.st !== 'since') return
    f.since = Number(e.target.value)
    $('.street-since').textContent = f.since >= YEAR0 ? `Desde ${f.since}` : 'Cualquier fecha'
    if (map.getLayer(LINE)) map.setFilter(LINE, filter())
  })
  const key = (e) => {
    if (e.key !== 'Escape' || e.target.closest?.('input, textarea, select')) return
    stop(); current = null; seq = { id: '', ids: [], i: -1 }
    marker?.remove(); $('.street-view').hidden = true
    if (map.getLayer(SEL)) map.setFilter(SEL, ['==', ['get', 'id'], '-'])
    status('Selección borrada. Haz clic en una línea verde.')
  }
  const zoomHint = () => { if (!current) status(map.getZoom() < 13 ? 'Acerca el mapa (zoom 13 o más) para ver las calles con fotos.' : 'Haz clic en una línea verde para ver la foto más cercana.') }
  addLayers()
  zoomHint()
  map.on('click', click); map.on('style.load', addLayers); map.on('zoomend', zoomHint)
  document.addEventListener('keydown', key)
  return { destroy() {
    destroyed = true; stop(); abort?.abort(); marker?.remove(); removeLayers()
    map.off('click', click); map.off('style.load', addLayers); map.off('zoomend', zoomHint)
    document.removeEventListener('keydown', key)
    container.replaceChildren()
  } }
}

let activeStreet = null
export async function openStreetImagery(container) {
  hideStreetImagery()
  container.replaceChildren()
  const { map } = await import('./map.js')
  activeStreet = mountStreetImagery(map, container)
}
export function hideStreetImagery() { activeStreet?.destroy(); activeStreet = null }

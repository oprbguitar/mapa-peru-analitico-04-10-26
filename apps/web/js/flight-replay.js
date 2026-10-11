/* Actual locally stored ADS-B samples; interpolation is visual, never a claimed observation. */
import { map } from './map.js'
const LAYER = 'flight-replay-3d'
const DATE = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' })
const utcInput = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 16)
const unixInput = (value) => Date.parse(value + ':00Z') / 1000

export function replayPosition(points, timestamp, gapSeconds = 300) {
  if (!points.length) return null
  if (timestamp <= points[0].t) return { ...points[0], interpolated: false }
  for (let index = 1; index < points.length; index++) {
    const before = points[index - 1], after = points[index]
    if (timestamp > after.t) continue
    if (timestamp === after.t) return { ...after, interpolated: false }
    if (after.gap_before || after.t - before.t > gapSeconds) return null
    const ratio = (timestamp - before.t) / (after.t - before.t)
    const altitude = before.altitude_m == null || after.altitude_m == null ? null :
      before.altitude_m + (after.altitude_m - before.altitude_m) * ratio
    return { t: timestamp, lon: before.lon + (after.lon - before.lon) * ratio,
      lat: before.lat + (after.lat - before.lat) * ratio, altitude_m: altitude, interpolated: true }
  }
  return { ...points.at(-1), interpolated: false }
}

function compile(gl, type, code) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, code)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error('No se pudo preparar la reproducción 3D: ' + message)
  }
  return shader
}

function createLayer(map, readPoints, readCurrent, reportError) {
  let program, buffer, position, matrix, color, size
  const xyz = (point, altitude = point.altitude_m) => {
    const c = globalThis.maplibregl.MercatorCoordinate.fromLngLat([point.lon, point.lat], altitude)
    return [c.x, c.y, c.z]
  }
  const draw = (gl, values, mode, rgba) => {
    if (!values.length) return
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW)
    gl.uniform4fv(color, rgba)
    gl.drawArrays(mode, 0, values.length / 3)
  }
  return { id: LAYER, type: 'custom', renderingMode: '3d',
    onAdd(_map, gl) {
      try {
        const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext
        const vertex = webgl2 ? '#version 300 es\nin' : 'attribute'
        const fragment = webgl2 ? '#version 300 es\nprecision mediump float; out vec4 outColor;' : 'precision mediump float;'
        const vs = compile(gl, gl.VERTEX_SHADER, `${vertex} vec3 a_position; uniform mat4 u_matrix;
          uniform float u_size; void main(){gl_Position=u_matrix*vec4(a_position,1.0);gl_PointSize=u_size;}`)
        const fs = compile(gl, gl.FRAGMENT_SHADER, `${fragment} uniform vec4 u_color;
          void main(){${webgl2 ? 'outColor' : 'gl_FragColor'}=u_color;}`)
        program = gl.createProgram()
        gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
        gl.deleteShader(vs); gl.deleteShader(fs)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL no pudo enlazar la trayectoria.')
        buffer = gl.createBuffer()
        position = gl.getAttribLocation(program, 'a_position')
        matrix = gl.getUniformLocation(program, 'u_matrix')
        color = gl.getUniformLocation(program, 'u_color')
        size = gl.getUniformLocation(program, 'u_size')
      } catch (error) { reportError(error.message); program = null }
    },
    render(gl, args) {
      if (!program) return
      const projection = args.defaultProjectionData?.mainMatrix || args
      if (!projection || projection.length !== 16) return
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)
      gl.uniformMatrix4fv(matrix, false, projection)
      gl.uniform1f(size, 12)
      // Read theme tokens, so the trajectory remains legible in day/night modes.
      const theme = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const hex = /^#[0-9a-f]{6}$/i.test(theme) ? theme : '#00d4ff'
      const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      const points = readPoints(), segments = []
      for (let i = 1; i < points.length; i++) {
        if (points[i].gap_before || points[i].altitude_m == null || points[i - 1].altitude_m == null) continue
        segments.push(...xyz(points[i - 1]), ...xyz(points[i]))
      }
      draw(gl, segments, gl.LINES, [...rgb, 1])
      const current = readCurrent()
      if (current?.altitude_m != null) {
        const ground = map.queryTerrainElevation([current.lon, current.lat], { exaggerated: false })
        if (Number.isFinite(ground)) draw(gl, [...xyz(current, ground), ...xyz(current)], gl.LINES, [...rgb, .65])
        draw(gl, xyz(current), gl.POINTS, [...rgb, 1])
      }
      gl.disableVertexAttribArray(position)
    },
    onRemove(_map, gl) { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program) },
  }
}

function element(tag, text, attrs = {}) {
  const node = document.createElement(tag)
  if (tag === 'button') node.className = 'btn'
  if (text) node.textContent = text
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
  return node
}

function field(title, control) {
  const label = element('label', '', { class: 'field' })
  label.append(element('span', title), control)
  return label
}

/** Container is a project-styled panel; destroy releases events, requests and WebGL resources. */
export function mountFlightReplay(map, container) {
  const now = Math.floor(Date.now() / 1000)
  const start = element('input', '', { type: 'datetime-local', 'aria-label': 'Inicio UTC', value: utcInput(now - 21600) })
  const end = element('input', '', { type: 'datetime-local', 'aria-label': 'Fin UTC', value: utcInput(now) })
  const select = element('select', '', { 'aria-label': 'Trayectoria ADS-B disponible' })
  const refresh = element('button', 'Buscar vuelos guardados', { type: 'button' })
  const play = element('button', 'Reproducir', { type: 'button', disabled: '' })
  const speed = element('select', '', { 'aria-label': 'Velocidad de reproducción' })
  for (const value of [1, 10, 60, 120]) speed.append(element('option', `${value}×`, { value }))
  speed.value = '60'
  const slider = element('input', '', { type: 'range', min: '0', max: '1', step: '1', value: '0', disabled: '',
    'aria-label': 'Tiempo de trayectoria UTC' })
  const status = element('p', 'Consulte posiciones recibidas por este servidor en los últimos siete días.', { role: 'status', 'aria-live': 'polite' })
  const info = element('p', 'UTC · ADS-B comunitario · muestras históricas locales · altitud barométrica, no altura exacta sobre el terreno.')
  container.append(element('h2', 'Reconstrucción de vuelos 3D'), info,
    field('Inicio (UTC)', start), field('Fin (UTC)', end), refresh,
    field('Aeronave guardada', select), play, field('Velocidad', speed), field('Tiempo (UTC)', slider), status)
  let points = [], current = null, frame = null, previousFrame = null, request = null, destroyed = false, playhead = 0
  const stop = () => { if (frame != null) cancelAnimationFrame(frame); frame = null; previousFrame = null; play.textContent = 'Reproducir' }
  const setTime = (timestamp) => {
    playhead = timestamp
    slider.value = String(timestamp)
    current = replayPosition(points, timestamp)
    status.textContent = current ? `${DATE.format(new Date(timestamp * 1000))} UTC · ${current.altitude_m == null ?
      'altitud desconocida; tramo sin dibujo 3D' : `${Math.round(current.altitude_m)} m barométricos`}${current.interpolated ? ' · interpolación visual' : ' · muestra recibida'}` :
      `${DATE.format(new Date(timestamp * 1000))} UTC · sin muestras: reproducción interrumpida en este vacío.`
    map.triggerRepaint()
  }
  const restoreLayer = () => {
    if (!destroyed && points.length && !map.getLayer(LAYER)) map.addLayer(createLayer(map, () => points, () => current, (error) => { status.textContent = error; stop() }))
  }
  const fetchJSON = async (url) => {
    request?.abort(); request = new AbortController()
    const response = await fetch(url, { signal: request.signal })
    const data = await response.json()
    if (!response.ok || data.error) throw new Error(data.error || 'No se pudieron consultar las trayectorias.')
    return data.data || data
  }
  refresh.onclick = async () => {
    stop(); points = []; current = null; play.disabled = true; slider.disabled = true
    map.triggerRepaint(); refresh.disabled = true; status.textContent = 'Consultando posiciones guardadas…'
    try {
      const from = unixInput(start.value), to = unixInput(end.value)
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 604800) throw new Error('Seleccione un intervalo UTC de hasta siete días.')
      const data = await fetchJSON(`/api/v1/flights/history?start=${from}&end=${to}`)
      if (destroyed) return
      select.replaceChildren(element('option', 'Seleccione una aeronave', { value: '' }))
      for (const row of data.items || []) select.append(element('option', `${row.hex} · ${row.count} posiciones`, { value: row.hex }))
      status.textContent = data.items?.length ? 'Seleccione una trayectoria disponible.' : 'Este servidor aún no tiene posiciones en ese intervalo; active Vuelos para registrar muestras.'
    } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message }
    finally { refresh.disabled = false }
  }
  select.onchange = async () => {
    stop(); points = []; current = null; play.disabled = true; slider.disabled = true; map.triggerRepaint()
    if (!select.value) return
    try {
      status.textContent = 'Cargando trayectoria…'
      const data = await fetchJSON(`/api/v1/flights/history/${encodeURIComponent(select.value)}?start=${unixInput(start.value)}&end=${unixInput(end.value)}`)
      if (destroyed) return
      points = data.points || []
      if (!data.available) { status.textContent = data.note; return }
      slider.min = String(points[0].t); slider.max = String(points.at(-1).t)
      slider.disabled = false; play.disabled = false
      restoreLayer(); setTime(points[0].t)
      // At street zoom the camera is below cruise altitude and the aircraft falls outside the frustum.
      map.easeTo({ center: [points[0].lon, points[0].lat], pitch: 60, zoom: Math.min(map.getZoom(), 8),
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 })
    } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message }
  }
  slider.oninput = () => { stop(); setTime(Number(slider.value)) }
  const tick = (time) => {
    if (previousFrame != null) setTime(Math.min(Number(slider.max), playhead + (time - previousFrame) / 1000 * Number(speed.value)))
    previousFrame = time
    if (playhead >= Number(slider.max)) { stop(); return }
    frame = requestAnimationFrame(tick)
  }
  // Playback is explicitly requested; reduced-motion users retain seek/pause controls.
  play.onclick = () => {
    if (frame != null) { stop(); return }
    if (Number(slider.value) >= Number(slider.max)) setTime(Number(slider.min))
    play.textContent = 'Pausar'; frame = requestAnimationFrame(tick)
  }
  map.on('style.load', restoreLayer)
  return { destroy() { destroyed = true; stop(); request?.abort(); map.off('style.load', restoreLayer);
    if (map.getLayer(LAYER)) map.removeLayer(LAYER); container.replaceChildren() } }
}

let activeReplay = null
export function openFlightReplay(container) {
  hideFlightReplay()
  container.replaceChildren()
  activeReplay = mountFlightReplay(map, container)
}
export function hideFlightReplay() { activeReplay?.destroy(); activeReplay = null }

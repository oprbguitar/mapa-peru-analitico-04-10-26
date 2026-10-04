// Riel de capas agrupado por familias (no una lista de 40 interruptores).
import { esc, kindBadge, KIND_LABEL, setState, state } from './util.js'
import { BASES, view } from './map.js'
import { currentOverlay, overlayOptions } from './weather.js'

const THEMATIC = [
  { id: 'sidpol', label: 'Denuncias policiales', hint: 'SIDPOL · distrito', kind: 'oficial', patch: { dataset: 'sidpol' } },
  { id: 'victim', label: 'Victimización', hint: 'ENAPRES · región', kind: 'oficial', patch: { dataset: 'indicador', code: 10 }, codes: [10, 11, 12, 13, 14, 15, 16] },
  { id: 'violencia', label: 'Homicidios y violencia', hint: 'CEIC, SIDPOL · varios niveles', kind: 'oficial', patch: { dataset: 'indicador', code: 30 }, codes: [30, 31, 3, 4, 5, 20, 21, 22] },
  { id: 'organizada', label: 'Criminalidad organizada', hint: 'Aproximación: extorsión, secuestro, pandillaje', kind: 'oficial', patch: { dataset: 'indicador', code: 7 }, codes: [7, 8, 1] },
  { id: 'operaciones', label: 'Capacidad policial y serenazgo', hint: 'RENAMU, PNP', kind: 'oficial', patch: { dataset: 'indicador', code: 202 }, codes: [201, 202, 205, 101, 102, 103, 111, 113, 210] },
  { id: 'mpfn', label: 'Delitos ante la Fiscalía', hint: 'MPFN · sede del distrito fiscal', kind: 'oficial', patch: { dataset: 'mpfn' } },
  { id: 'devida', label: 'Drogas / TID', hint: 'DEVIDA · departamento', kind: 'oficial', patch: { dataset: 'devida' } },
  { id: 'indice', label: 'Índice compuesto', hint: 'Índice Situacional v1 · no oficial', kind: 'calculado', patch: { dataset: 'indice' } },
]

const FAMILIES = [
  { id: 'vista', label: 'Vista y relieve', view: true },
  { id: 'seguridad', label: 'Seguridad', open: true, thematic: true },
  { id: 'movilidad', label: 'Movilidad', live: [
    { id: 'traffic', label: 'Tráfico', hint: 'TomTom · clave propia', kind: 'vivo_tercero' },
    { id: 'flights', label: 'Vuelos', hint: 'ADS-B · adsb.lol', kind: 'vivo_tercero' },
    { id: 'vessels', label: 'Embarcaciones', hint: 'AIS · aisstream.io · clave propia', kind: 'vivo_tercero' },
  ] },
  { id: 'ambiente', label: 'Ambiente', live: [
    { id: 'wxpoint', label: 'Clima en un punto', hint: 'Clic en el mapa · Open-Meteo, MET Norway y más, combinados', kind: 'proyeccion' },
    { id: 'wxlayer', label: 'Capas meteorológicas', hint: 'SENAMHI (oficial) · NASA GIBS (satélite)', kind: 'oficial' },
    { id: 'weather', label: 'Clima en capitales', hint: 'SENAMHI observado · GFS / ECMWF modelo', kind: 'proyeccion' },
    { id: 'fires', label: 'Focos de calor', hint: 'NASA FIRMS · clave propia', kind: 'vivo_tercero' },
    { id: 'seismic', label: 'Sismos', hint: 'IGP (primaria) · USGS', kind: 'oficial' },
  ] },
  { id: 'infra', label: 'Infraestructura', live: [
    { id: 'ports', label: 'Puertos', hint: 'APN + World Port Index', kind: 'oficial' },
    { id: 'cameras', label: 'Cámaras propias', hint: 'Módulo vision-edge (no instalado)', kind: 'vivo_tercero', disabled: true },
    { id: 'datacenters', label: 'Centros de datos', hint: 'OpenStreetMap', kind: 'vivo_tercero' },
  ], extra: [{ id: 'cam107', label: 'Cámaras municipales operativas', hint: 'MININTER · indicador 107', kind: 'oficial', patch: { dataset: 'indicador', code: 107 } }] },
  { id: 'espacio', label: 'Espacio', live: [
    { id: 'satellites', label: 'Satélites', hint: 'CelesTrak + satellite.js', kind: 'vivo_tercero' },
  ] },
]

const SAT_GROUPS = { 'gps-ops': 'GPS', starlink: 'Starlink', resource: 'Observación de la Tierra', weather: 'Meteorológicos', stations: 'Estaciones espaciales', geo: 'Geoestacionarios' }

let indicatorNames = {}
const liveText = {}
let modalities = []
let devidaInds = []

export function renderKindKey() {
  document.getElementById('kind-key').innerHTML = Object.keys(KIND_LABEL).map((k) => kindBadge(k)).join('')
}

function thematicKey() {
  if (state.dataset === 'indicador') {
    for (const t of THEMATIC) if (t.codes?.includes(state.code)) return t.id
    return state.code === 107 ? 'cam107' : 'victim'
  }
  return { sidpol: 'sidpol', mpfn: 'mpfn', devida: 'devida', indice: 'indice' }[state.dataset]
}

function radio(t, checked) {
  const sub = []
  if (checked && t.id === 'sidpol') {
    sub.push(`<label class="sr-only" for="sel-mod">Modalidad</label><select id="sel-mod">
      <option value="">Todas las modalidades</option>${modalities.map((m) => `<option ${state.modalidad === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>`)
  }
  if (checked && t.codes) {
    sub.push(`<label class="sr-only" for="sel-code">Indicador</label><select id="sel-code">${t.codes
      .map((c) => `<option value="${c}" ${state.code === c ? 'selected' : ''}>${esc((indicatorNames[c] || `Indicador ${c}`).split(' (')[0])}</option>`).join('')}</select>`)
  }
  if (checked && t.id === 'mpfn') {
    sub.push(`<label class="opt opt-check"><input type="checkbox" id="chk-tid" ${state.mpfnTid ? 'checked' : ''}><span class="opt-label">Solo tráfico ilícito de drogas (arts. 296–303)</span></label>`)
  }
  if (checked && t.id === 'devida') {
    sub.push(`<label class="sr-only" for="sel-devida">Indicador DEVIDA</label><select id="sel-devida">${devidaInds
      .map((d) => `<option value="${d.indicador}" ${state.devidaInd === d.indicador ? 'selected' : ''}>${esc(d.etiqueta)} (${esc(d.unidad)})</option>`).join('')}</select>`)
  }
  return `<label class="opt"><input type="radio" name="thematic" value="${t.id}" ${checked ? 'checked' : ''}>
    <span class="opt-label">${esc(t.label)}<small>${esc(t.hint)}</small></span>${kindBadge(t.kind, '')}</label>
    ${sub.length ? `<div class="sub-control">${sub.join('')}</div>` : ''}`
}

export function renderRail(meta = {}) {
  if (meta.indicators) indicatorNames = Object.fromEntries(meta.indicators.map((i) => [i.codigo, i.nombre]))
  if (meta.modalities) modalities = meta.modalities
  if (meta.devida) devidaInds = meta.devida
  const key = thematicKey()
  const wasOpen = new Set([...document.querySelectorAll('#families details.family[open]')].map((d) => d.dataset.f))
  const firstRender = !document.querySelector('#families details')
  const html = FAMILIES.map((f) => {
    let body = ''
    if (f.view) body = viewBlock()
    if (f.thematic) body = THEMATIC.map((t) => radio(t, key === t.id)).join('')
    if (f.extra) body += f.extra.map((t) => radio(t, key === t.id)).join('')
    if (f.live) {
      body += f.live.map((l) => {
        const st = meta.live?.[l.id]
        const metaTxt = l.disabled ? 'no instalado' : liveText[l.id] ?? (st?.status === 'sin_configurar' ? 'sin clave' : '')
        let sub = ''
        if (l.id === 'satellites' && state.live.has('satellites')) {
          sub = `<div class="sub-control"><label class="sr-only" for="sel-sat">Grupo de satélites</label><select id="sel-sat">${Object.entries(SAT_GROUPS)
            .map(([k, v]) => `<option value="${k}" ${state.satGroup === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`
        }
        if (l.id === 'wxlayer' && state.live.has('wxlayer')) {
          sub = `<div class="sub-control"><label class="sr-only" for="sel-wxo">Capa meteorológica</label><select id="sel-wxo">${overlayOptions()}</select>
            <label class="range"><span>Opacidad</span><span class="num">${Math.round(currentOverlay().opacity * 100)} %</span>
            <input type="range" id="rng-wxo" min="0.2" max="1" step="0.05" value="${currentOverlay().opacity}"></label></div>`
        }
        if (l.id === 'weather' && state.live.has('weather')) {
          sub = `<div class="sub-control"><label class="sr-only" for="sel-wx">Fuente de clima</label><select id="sel-wx">
            <option value="gfs" ${state.weatherModel === 'gfs' ? 'selected' : ''}>Modelo NOAA GFS</option>
            <option value="ecmwf" ${state.weatherModel === 'ecmwf' ? 'selected' : ''}>Modelo ECMWF IFS</option>
            <option value="obs" ${state.weatherModel === 'obs' ? 'selected' : ''}>Observado SENAMHI</option></select></div>`
        }
        return `<label class="opt"><input type="checkbox" value="${l.id}" data-live ${state.live.has(l.id) ? 'checked' : ''} ${l.disabled ? 'disabled' : ''}>
          <span class="opt-label">${esc(l.label)}<small>${esc(l.hint)}</small></span><span class="opt-meta num" data-live-meta="${l.id}">${esc(metaTxt)}</span></label>${sub}`
      }).join('')
    }
    const open = firstRender ? f.open : wasOpen.has(f.id) || f.live?.some((l) => state.live.has(l.id))
    return `<details class="family" data-f="${f.id}" ${open ? 'open' : ''}><summary>${esc(f.label)}</summary><div class="family-body">${body}</div></details>`
  }).join('')
  document.getElementById('families').innerHTML = html
}

function viewBlock() {
  return `<div class="sub-control sub-control--flush"><label class="sr-only" for="sel-base">Mapa base</label>
    <select id="sel-base">${Object.entries(BASES).map(([k, b]) => `<option value="${k}" ${view.base === k ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select>
    <div class="seg" role="group" aria-label="Relieve">
      <button type="button" data-view="terrain" aria-pressed="${view.terrain}">Relieve 3D</button>
      <button type="button" data-view="relief" aria-pressed="${view.relief}">Sombreado</button>
      <button type="button" data-view="choro" aria-pressed="${!state.hideChoropleth}">Capa temática</button></div>
    <label class="range"><span>Exageración vertical</span><span class="num">${view.exaggeration.toFixed(1)}×</span>
      <input type="range" id="rng-exag" min="1" max="3" step="0.1" value="${view.exaggeration}"></label>
    <label class="range"><span>Opacidad de la capa temática</span><span class="num">${Math.round((state.choroplethOpacity ?? 0.78) * 100)} %</span>
      <input type="range" id="rng-choro" min="0.15" max="1" step="0.05" value="${state.choroplethOpacity ?? 0.78}"></label></div>`
}

export function bindRail({ onThematic, onLive, onView }) {
  const root = document.getElementById('families')
  root.addEventListener('change', (e) => {
    const t = e.target
    if (t.name === 'thematic') {
      const def = [...THEMATIC, ...FAMILIES.flatMap((f) => f.extra || [])].find((x) => x.id === t.value)
      setState({ ...def.patch, measure: null })
      onThematic()
    } else if (t.id === 'sel-mod') {
      setState({ modalidad: t.value })
      onThematic()
    } else if (t.id === 'sel-code') {
      setState({ code: Number(t.value), measure: null })
      onThematic()
    } else if (t.id === 'chk-tid') {
      setState({ mpfnTid: t.checked })
      onThematic()
    } else if (t.id === 'sel-devida') {
      setState({ devidaInd: t.value })
      onThematic()
    } else if (t.dataset.live !== undefined) {
      const live = new Set(state.live)
      t.checked ? live.add(t.value) : live.delete(t.value)
      setState({ live })
      onLive(t.value, t.checked)
    } else if (t.id === 'sel-sat') {
      setState({ satGroup: t.value })
      onLive('satellites', true)
    } else if (t.id === 'sel-base') {
      onView('base', t.value)
    } else if (t.id === 'sel-wxo') {
      onView('wxo', t.value)
    } else if (t.id === 'sel-wx') {
      setState({ weatherModel: t.value })
      onLive('weather', true)
    }
  })
}

export function bindRailView(onView) {
  const root = document.getElementById('families')
  root.addEventListener('input', (e) => {
    const t = e.target
    const out = t.closest('.range')?.querySelector('.num')
    if (t.id === 'rng-exag') {
      onView('exag', Number(t.value))
      if (out) out.textContent = `${Number(t.value).toFixed(1)}×`
    } else if (t.id === 'rng-choro') {
      onView('choroOpacity', Number(t.value))
      if (out) out.textContent = `${Math.round(t.value * 100)} %`
    } else if (t.id === 'rng-wxo') {
      onView('wxoOpacity', Number(t.value))
      if (out) out.textContent = `${Math.round(t.value * 100)} %`
    }
  })
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]')
    if (b) onView(b.dataset.view)
  })
}

export function setLiveMeta(id, text) {
  liveText[id] = text
  const el = document.querySelector(`[data-live-meta="${id}"]`)
  if (el) el.textContent = text
}

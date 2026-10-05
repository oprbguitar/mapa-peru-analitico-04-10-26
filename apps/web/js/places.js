// Sedes, servicios, emergencias y vías: capas de puntos con su procedencia en el popup.
/* global maplibregl */
import { ensurePointLayer, map, mapReady, ptFeature, setPoints, showLayer } from './map.js'
import { esc, fmt, getJSON, kindBadge, toast } from './util.js'

export const PLACE_LAYERS = {
  sedes: { label: 'Sedes de seguridad y justicia', cats: { comisaria: '--inst-comisaria', serenazgo: '--inst-serenazgo', fiscalia: '--inst-fiscalia', judicial: '--inst-judicial' } },
  servicios: { label: 'Servicios', cats: { hospital: '--inst-fiscalia', salud: '--pal-esp-3', colegio: '--pal-esp-5', universidad: '--kind-ia', instituto: '--kind-ia', bomberos: '--live-fire' } },
  emergencias: { label: 'Emergencias INDECI', cats: {} },
  vias: { label: 'Vías nacionales afectadas (MTC)', cats: {} },
}
export const CAT_LABEL = { comisaria: 'Comisaría', serenazgo: 'Serenazgo', fiscalia: 'Ministerio Público', judicial: 'Poder Judicial',
  hospital: 'Hospital', salud: 'Centro/puesto de salud', colegio: 'Colegio', universidad: 'Universidad', instituto: 'Instituto', bomberos: 'Bomberos' }

const on = { sedes: new Set(), servicios: new Set(), emergencias: false, vias: false }
let sedes = null
let popup
let svcTimer

const pop = (lngLat, html) => (popup ??= new maplibregl.Popup({ closeButton: true, maxWidth: '320px', offset: 8 })).setLngLat(lngLat).setHTML(html).addTo(map)

function placePopup(f, lngLat) {
  const p = f.properties
  pop(lngLat, `<div class="pop-title">${esc(p.nombre || p.name)}</div><div>${kindBadge(p.kind || 'vivo_tercero', p.fuente || 'OpenStreetMap')}</div>
    <div class="pop-row"><span>Tipo</span><b>${esc(CAT_LABEL[p.cat] || p.cat)}</b></div>
    ${p.detalle && p.detalle !== 'null' ? `<div class="src-meta">${esc(p.detalle)}</div>` : ''}
    ${p.distrito ? `<div class="src-meta">${esc(p.distrito)}${p.provincia ? ', ' + esc(p.provincia) : ''}</div>` : ''}
    ${p.kind !== 'oficial' ? '<div class="note">Ubicación aproximada (OpenStreetMap).</div>' : ''}`)
}

const GROUP_COLOR = (g) => (/lluvia|inund|huaic|desliz|derrumbe|alud|erosi/i.test(g) ? '--fx-rain'
  : /incend/i.test(g) ? '--live-fire' : /sismo|tsunami/i.test(g) ? '--live-quake' : /helada|nevada|friaje/i.test(g) ? '--fx-frost' : '--ink-soft')

export async function initPlaces() {
  await mapReady
  ensurePointLayer('pl-sedes', { colors: PLACE_LAYERS.sedes.cats, radius: 6, onClick: placePopup })
  ensurePointLayer('pl-servicios', { colors: PLACE_LAYERS.servicios.cats, radius: 5, onClick: placePopup })
  ensurePointLayer('pl-emerg', { colorBy: 'col', colors: { '--fx-rain': '--fx-rain', '--live-fire': '--live-fire', '--live-quake': '--live-quake',
    '--fx-frost': '--fx-frost', '--ink-soft': '--ink-soft' }, radius: 5, onClick: (f, ll) => {
    const p = f.properties
    pop(ll, `<div class="pop-title">${esc(p.fenomeno)}</div>${kindBadge('oficial', 'INDECI · SINPAD')}
      <div class="pop-row"><span>Fecha</span><b>${esc(p.fecha)}</b></div><div class="pop-row"><span>Distrito</span><b>${esc(p.distrito || '—')}</b></div>
      <div class="pop-row"><span>Afectados</span><b>${fmt(p.afectados, 0)}</b></div><div class="pop-row"><span>Damnificados</span><b>${fmt(p.damnificados, 0)}</b></div>
      <div class="pop-row"><span>Fallecidos</span><b>${fmt(p.fallecidos, 0)}</b></div><div class="pop-row"><span>Viviendas destruidas</span><b>${fmt(p.viv_destruidas, 0)}</b></div>`)
  } })
  ensurePointLayer('pl-vias', { colorBy: 'st', colors: { cortada: '--danger', restringida: '--warn', normal: '--ok' }, radius: 7, onClick: (f, ll) => {
    const p = f.properties
    pop(ll, `<div class="pop-title">${esc(p.evento)} · ${esc(p.ruta)}</div>${kindBadge('oficial', 'MTC · Provías Nacional')}
      <div class="pop-row"><span>Estado</span><b>${esc(p.estado)}</b></div><div class="pop-row"><span>Tramo</span><b>${esc(p.tramo)}</b></div>
      <div class="pop-row"><span>Fecha</span><b>${esc(p.fecha)}</b></div><div class="src-meta">${esc(p.hechos || '')}</div>`)
  } })
  map.on('moveend', () => {
    clearTimeout(svcTimer)
    svcTimer = setTimeout(loadServices, 250)
  })
}

export async function toggleSede(cat, value) {
  value ? on.sedes.add(cat) : on.sedes.delete(cat)
  if (on.sedes.size && !sedes) {
    const d = await getJSON('/api/v1/intel/institutions')
    if (!d.available) return toast(d.reason)
    sedes = d.items
  }
  setPoints('pl-sedes', (sedes || []).filter((i) => on.sedes.has(i.cat)).map((i) => ptFeature(i.lon, i.lat, { ...i, nombre: i.name, kind: 'vivo_tercero' })), on.sedes.size > 0)
  return sedes ? Object.fromEntries(Object.keys(PLACE_LAYERS.sedes.cats).map((c) => [c, sedes.filter((i) => i.cat === c).length])) : {}
}

async function loadServices() {
  if (!on.servicios.size) return showLayer('pl-servicios', false)
  const b = map.getBounds()
  const z = map.getZoom()
  const cats = [...on.servicios].filter((c) => z >= 10 || !['colegio', 'salud'].includes(c)) // los numerosos solo con zoom de ciudad
  if (!cats.length) return setPoints('pl-servicios', [], true)
  const d = await getJSON(`/api/v1/intel/layers/services?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(4)).join(',')}&cat=${cats.join(',')}`).catch(() => null)
  if (!d?.available) return
  setPoints('pl-servicios', d.items.map((i) => ptFeature(i.lon, i.lat, i)), true)
}

export function toggleServicio(cat, value) {
  value ? on.servicios.add(cat) : on.servicios.delete(cat)
  loadServices()
}

export async function toggleEmergencias(value, days = 90) {
  on.emergencias = value
  if (!value) return showLayer('pl-emerg', false)
  const d = await getJSON(`/api/v1/intel/layers/emergencies?days=${days}`)
  if (!d.available) return toast(d.reason)
  setPoints('pl-emerg', d.items.map((i) => ptFeature(i.lon, i.lat, { ...i, col: GROUP_COLOR(`${i.grupo} ${i.fenomeno}`) })), true)
  return `${d.items.length} · hasta ${d.window_end}`
}

export async function toggleVias(value) {
  on.vias = value
  if (!value) return showLayer('pl-vias', false)
  const d = await getJSON('/api/v1/intel/layers/roads')
  if (!d.available) return toast(d.reason)
  const st = (e) => (/INTERRUMP/i.test(e) ? 'cortada' : /RESTRING/i.test(e) ? 'restringida' : 'normal')
  setPoints('pl-vias', d.items.map((i) => ptFeature(i.lon, i.lat, { ...i, st: st(i.estado || '') })), true)
  return `${d.items.filter((i) => st(i.estado || '') !== 'normal').length} con tránsito afectado`
}

export const isOn = () => on

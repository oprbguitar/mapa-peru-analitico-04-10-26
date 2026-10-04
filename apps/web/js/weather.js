// Clima combinado: punto (todos los proveedores lado a lado + consenso calculado) y capas raster (NASA GIBS, SENAMHI).
/* global maplibregl */
import { getFirstSymbol, map, onStyleReady, unhover } from './map.js'
import { esc, fmt, getJSON, kindBadge, state, toast } from './util.js'

let catalog = null
let pin = null
let current = { id: null, opacity: 0.75 }
const COLS = [['temp_c', '°C'], ['precip_mm', 'mm'], ['wind_kmh', 'km/h'], ['rh_pct', '%'], ['cloud_pct', 'nub. %']]

export async function loadCatalog() {
  if (!catalog) catalog = await getJSON('/api/v1/intel/weather/layers').catch(() => ({ gibs: [], senamhi: [] }))
  return catalog
}

export function overlayOptions() {
  if (!catalog) return ''
  const group = (list, src, title) => {
    const groups = [...new Set(list.map((l) => l.group))]
    return groups.map((g) => `<optgroup label="${esc(title)} · ${esc(g)}">${list.filter((l) => l.group === g)
      .map((l) => `<option value="${src}:${l.id}" ${current.id === `${src}:${l.id}` ? 'selected' : ''}>${esc(l.label)}${l.date ? ` · ${esc(l.date)}` : ''}</option>`).join('')}</optgroup>`).join('')
  }
  return group(catalog.senamhi, 'senamhi', 'SENAMHI') + group(catalog.gibs, 'gibs', 'NASA GIBS')
}

export function currentOverlay() {
  return current
}

export function setOverlay(key) {
  if (map.getLayer('pi-wx')) map.removeLayer('pi-wx')
  if (map.getSource('pi-wx')) map.removeSource('pi-wx')
  current.id = key || null
  if (!key) return
  const [src, id] = key.split(':')
  const spec = catalog?.[src]?.find((l) => l.id === id)
  if (!spec) return
  map.addSource('pi-wx', { type: 'raster', tiles: [location.origin + spec.tiles], tileSize: 256, maxzoom: spec.maxzoom,
    ...(spec.bounds ? { bounds: spec.bounds } : {}), attribution: spec.attribution })
  map.addLayer({ id: 'pi-wx', type: 'raster', source: 'pi-wx', paint: { 'raster-opacity': current.opacity, 'raster-fade-duration': 200 } }, getFirstSymbol())
  toast(`${spec.label} — ${src === 'senamhi' ? 'SENAMHI · IDESEP (oficial)' : `NASA GIBS · ${spec.date}`}`)
}

export function setOverlayOpacity(v) {
  current.opacity = v
  if (map.getLayer('pi-wx')) map.setPaintProperty('pi-wx', 'raster-opacity', v)
}

onStyleReady(() => {
  // tras cambiar el estilo, la capa se conserva; solo se re-aplica la opacidad elegida
  if (map.getLayer('pi-wx')) map.setPaintProperty('pi-wx', 'raster-opacity', current.opacity)
})

export function setPointMode(on) {
  state.wxPoint = on
  unhover() // un popup de territorio abierto taparía el punto donde se hace clic
  map.getCanvas().style.cursor = on ? 'crosshair' : ''
  if (!on && pin) {
    pin.remove()
    pin = null
  }
  if (on) toast('Clima por punto: haz clic en cualquier lugar del mundo.')
}

function spark24(next) {
  if (!next?.length) return ''
  const W = 340
  const H = 110
  const temps = next.map((h) => h.temp_c)
  const precip = next.map((h) => h.precip_mm || 0)
  const tmin = Math.min(...temps) - 1
  const tmax = Math.max(...temps) + 1
  const pmax = Math.max(1, ...precip)
  const x = (i) => 6 + (i / (next.length - 1)) * (W - 12)
  const y = (t) => 8 + (1 - (t - tmin) / (tmax - tmin)) * (H - 34)
  const bw = (W - 12) / next.length - 1
  const bars = precip.map((p, i) => `<rect class="bar" x="${x(i) - bw / 2}" y="${H - 18 - (p / pmax) * 30}" width="${bw}" height="${(p / pmax) * 30}"/>`).join('')
  const line = temps.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t).toFixed(1)}`).join('')
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperatura y precipitación de las próximas 24 horas (Open-Meteo)">
    <line class="axis" x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}"/>${bars}<path class="tline" d="${line}"/>
    <text x="6" y="${H - 4}">${esc(next[0].time.slice(11, 16))}</text><text x="${W - 6}" y="${H - 4}" text-anchor="end">${esc(next.at(-1).time.slice(11, 16))}</text>
    <text x="${W - 6}" y="14" text-anchor="end">${fmt(Math.max(...temps))} °C</text></svg>`
}

const cell = (d, k) => (d && d[k] != null ? fmt(d[k]) : '—')
const STATUS = { ok: 'ok', sin_configurar: 'sin clave', cuota_agotada: 'cuota agotada', error: 'error' }

export async function weatherAt(lngLat, { render }) {
  const { lng, lat } = lngLat
  if (pin) pin.remove()
  const el = document.createElement('div')
  el.className = 'wx-pin'
  pin = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
  render('<p class="loading">Consultando proveedores meteorológicos</p>')
  let d
  try {
    d = await getJSON(`/api/v1/intel/weather/point?lat=${lat.toFixed(4)}&lon=${(((lng + 540) % 360) - 180).toFixed(4)}`)
  } catch (e) {
    render(`<p class="note">No se pudo consultar el clima: ${esc(e.message)}</p>`)
    return
  }
  const p = d.primary
  const pd = p?.data || {}
  const ok = d.results.filter((r) => r.status === 'ok')
  const place = d.place ? `${d.place.distrito}, ${d.place.provincia} · ${d.place.departamento} (UBIGEO ${d.place.ubigeo})` : `${fmt(d.lat)}°, ${fmt(d.lon)}°`
  const cons = d.consensus
  render(`<div class="stagger">
    <div class="panel-head"><div class="eyebrow">Clima en el punto · ${d.in_peru ? 'Perú' : 'mundo'}</div>
      <h2>${p ? `${fmt(pd.temp_c)} °C` : 'Sin datos'}</h2>
      <p class="sub">${esc(place)}</p></div>
    ${p ? `<div class="wx-hero"><span class="c">${esc(pd.condition || '—')} · sensación ${fmt(pd.feels_c)} °C</span>
      <span>${kindBadge(p.kind, `Principal: ${p.label}`)}</span></div>
    <dl class="kv"><dt>Humedad relativa</dt><dd>${cell(pd, 'rh_pct')} %</dd><dt>Precipitación</dt><dd>${cell(pd, 'precip_mm')} mm</dd>
      <dt>Viento</dt><dd>${cell(pd, 'wind_kmh')} km/h${pd.wind_deg != null ? ` · ${fmt(pd.wind_deg, 0)}°` : ''}</dd><dt>Ráfagas</dt><dd>${cell(pd, 'gust_kmh')} km/h</dd>
      <dt>Presión</dt><dd>${cell(pd, 'pressure_hpa')} hPa</dd><dt>Nubosidad</dt><dd>${cell(pd, 'cloud_pct')} %</dd>
      <dt>Visibilidad</dt><dd>${cell(pd, 'visibility_km')} km</dd><dt>Índice UV</dt><dd>${cell(pd, 'uv')}</dd>
      ${pd.elevation_m != null ? `<dt>Altitud del modelo</dt><dd>${fmt(pd.elevation_m, 0)} m</dd>` : ''}
      <dt>Hora del dato</dt><dd>${esc(String(pd.observed_at || '—'))}</dd></dl>` : ''}
    ${pd.next24 ? `<section class="section"><h3><span>Próximas 24 h · Open-Meteo</span>${kindBadge('proyeccion')}</h3>${spark24(pd.next24)}
      <p class="src-meta">Línea: temperatura. Barras: precipitación por hora.</p></section>` : ''}
    <section class="section"><h3><span>Comparación de proveedores</span><span>${ok.length}/${d.results.length} responden</span></h3>
      <table class="wx-table"><thead><tr><th>Proveedor</th>${COLS.map(([, u]) => `<th>${esc(u)}</th>`).join('')}</tr></thead><tbody>
      ${d.results.map((r) => `<tr data-status="${esc(r.status)}"><td>${kindBadge(r.kind, r.label)}${r.status !== 'ok' ? `<br><small>${esc(STATUS[r.status] || r.status)}${r.error ? ` · ${esc(r.error.slice(0, 60))}` : ''}</small>` : r.data?.station_km != null ? `<br><small>a ${fmt(r.data.station_km)} km</small>` : ''}</td>
        ${COLS.map(([k]) => `<td>${cell(r.data, k)}</td>`).join('')}</tr>`).join('')}
      ${Object.keys(cons).length ? `<tr class="consensus"><td>${kindBadge('calculado', 'Consenso (mediana)')}</td>${COLS.map(([k]) => `<td>${cons[k] ? `${fmt(cons[k].median)}<br><small>±${fmt(cons[k].spread / 2)}</small>` : '—'}</td>`).join('')}</tr>` : ''}
      </tbody></table>
      <p class="src-meta">${esc(d.note)}</p></section>
    ${d.in_peru ? `<section class="section"><h3><span>Capas oficiales SENAMHI para esta zona</span>${kindBadge('oficial')}</h3>
      <div class="seg" role="group" aria-label="Capas SENAMHI sugeridas">
        <button type="button" data-wxo="senamhi:aviso24h">Aviso 24 h</button><button type="button" data-wxo="senamhi:quebradas">Quebradas</button>
        <button type="button" data-wxo="senamhi:uv48">UV 48 h</button><button type="button" data-wxo="senamhi:fwi">Incendios FWI</button></div>
      <p class="src-meta">Geoservicios WMS del IDESEP. Las estaciones observadas se activan configurando el CSV de SENAMHI en «Claves».</p></section>` : ''}
    <section class="section"><h3>Atribución</h3><p class="src-meta">${d.results.filter((r) => r.status === 'ok').map((r) => esc(r.attribution)).join(' · ')}</p></section>
  </div>`)
}

export function bindSuggested(container, onPick) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-wxo]')
    if (b) onPick(b.dataset.wxo)
  })
}

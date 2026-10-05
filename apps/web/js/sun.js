// Análisis solar de un punto (casa, lote): trayectoria del Sol, salida/puesta, sombra y sol directo por fachada.
// Posición solar con las fórmulas de SunCalc (V. Agafonkin, BSD; error típico ~0,1°) calculadas en el navegador: sin API.
/* global maplibregl */
import { ensureLineLayer, ensurePointLayer, map, ptFeature, setLines, setPoints, showLayer } from './map.js'
import { cssVar, fmt, kindBadge } from './util.js'

const RAD = Math.PI / 180
const TZ = -5   // hora del Perú (UTC−5, sin horario de verano)
const ORIENT = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]]
let pt = null
let pin = null
const ui = { date: null, min: 10 * 60, h: 6 }

/** Altura y azimut (desde el norte, horario) del Sol en grados. */
export function sunPos(date, lat, lon) {
  const d = date / 864e5 - 0.5 + 2440588 - 2451545
  const M = RAD * (357.5291 + 0.98560028 * d)
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI
  const e = RAD * 23.4397
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L))
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lon - ra
  const phi = RAD * lat
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  return { alt: alt / RAD, az: ((az / RAD + 180) % 360 + 360) % 360 }
}

const at = (ymd, minutes) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), 0, minutes - TZ * 60))
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`

/** Recorre el día cada 2 min: salida, puesta, mediodía solar y altura máxima. */
function dayInfo(ymd, lat, lon) {
  let rise = null, set = null, noon = { alt: -90 }
  let prev = sunPos(at(ymd, 0), lat, lon)
  for (let m = 2; m <= 1440; m += 2) {
    const p = sunPos(at(ymd, m), lat, lon)
    if (prev.alt < -0.833 && p.alt >= -0.833) rise = { m, az: p.az }
    if (prev.alt >= -0.833 && p.alt < -0.833) set = { m, az: p.az }
    if (p.alt > noon.alt) noon = { m, alt: p.alt, az: p.az }
    prev = p
  }
  return { rise, set, noon, len: rise && set ? set.m - rise.m : null }
}

/** Horas de sol directo por fachada (sin obstáculos), promedio por día en verano (dic–feb), invierno (jun–ago) y año. */
function facades(lat, lon, year) {
  const acc = Object.fromEntries(ORIENT.map(([k]) => [k, { ver: 0, inv: 0, an: 0 }]))
  const days = { ver: 0, inv: 0, an: 0 }
  for (let doy = 0; doy < 365; doy += 4) {
    const d = new Date(Date.UTC(year, 0, 1 + doy))
    const mo = d.getUTCMonth()
    const season = [11, 0, 1].includes(mo) ? 'ver' : [5, 6, 7].includes(mo) ? 'inv' : null
    const ymd = d.toISOString().slice(0, 10)
    days.an++
    if (season) days[season]++
    for (let m = 0; m < 1440; m += 15) {
      const p = sunPos(at(ymd, m), lat, lon)
      if (p.alt <= 0) continue
      for (const [k, f] of ORIENT) {
        if (Math.cos((p.az - f) * RAD) <= 0.08) continue   // el Sol debe estar delante de la fachada (> ~5° de rasante)
        acc[k].an += 0.25
        if (season) acc[k][season] += 0.25
      }
    }
  }
  for (const k in acc) for (const s in days) acc[k][s] /= days[s]
  return acc
}

// ── dibujo sobre el mapa ────────────────────────────────────────────────────
const dest = (lat, lon, az, r) => [lon + (r * Math.sin(az * RAD)) / (111320 * Math.cos(lat * RAD)), lat + (r * Math.cos(az * RAD)) / 111320]
const radius = () => 40 * 2 ** (18 - Math.max(15, Math.min(19, map.getZoom())))

function pathLine(ymd, color, width, r) {
  const c = []
  for (let m = 0; m <= 1440; m += 10) {
    const p = sunPos(at(ymd, m), pt.lat, pt.lon)
    if (p.alt > 0) c.push(dest(pt.lat, pt.lon, p.az, (r * (90 - p.alt)) / 90))
  }
  return c.length > 1 ? { type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { color: cssVar(color), width } } : null
}

function draw() {
  if (!pt) return
  if (!map.style?._loaded) return map.once('styledata', draw)   // el estilo aún se está armando: dibuja en cuanto esté
  const r = radius()
  const y = ui.date.slice(0, 4)
  const ray = (az, len, color, width, opacity = 0.95) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[pt.lon, pt.lat], dest(pt.lat, pt.lon, az, len)] }, properties: { color: cssVar(color), width, opacity } })
  const info = dayInfo(ui.date, pt.lat, pt.lon)
  const now = sunPos(at(ui.date, ui.min), pt.lat, pt.lon)
  const f = [pathLine(`${y}-12-21`, '--enso-warm', 2, r), pathLine(`${y}-06-21`, '--enso-cold', 2, r), pathLine(`${y}-03-20`, '--ink-soft', 1.5, r),
    pathLine(ui.date, '--fx-sun', 4, r)].filter(Boolean)
  if (info.rise) f.push(ray(info.rise.az, r * 1.15, '--fx-sun', 1.5, 0.6))
  if (info.set) f.push(ray(info.set.az, r * 1.15, '--live-fire', 1.5, 0.6))
  if (now.alt > 0) {
    f.push(ray(now.az, (r * (90 - now.alt)) / 90, '--fx-sun', 2.5))
    if (ui.h > 0) f.push(ray((now.az + 180) % 360, Math.min(r * 3, ui.h / Math.tan(now.alt * RAD)), '--void', 5, 0.55))   // sombra
  }
  ensureLineLayer('sun-lines', { width: 2 })
  setLines('sun-lines', f)
  showLayer('sun-lines', true)
  const ticks = []
  for (let m = 360; m <= 1080; m += 60) {
    const p = sunPos(at(ui.date, m), pt.lat, pt.lon)
    if (p.alt > 0) ticks.push(ptFeature(...dest(pt.lat, pt.lon, p.az, (r * (90 - p.alt)) / 90), { k: m === Math.round(ui.min / 60) * 60 ? 'now' : 'h' }))
  }
  ensurePointLayer('sun-pts', { colorBy: 'k', colors: { h: '--fx-sun', now: '--live-fire' }, radius: 6 })
  setPoints('sun-pts', ticks, true)
}

// ── panel ───────────────────────────────────────────────────────────────────
function panel() {
  const { lat, lon } = pt
  const info = dayInfo(ui.date, lat, lon)
  const fac = facades(lat, lon, +ui.date.slice(0, 4))
  const best = (s) => ORIENT.map(([k]) => k).sort((a, b) => fac[b][s] - fac[a][s])
  const winter = best('inv')[0], summer = best('ver')[0]
  const card = (k) => ({ N: 'norte', NE: 'noreste', E: 'este', SE: 'sureste', S: 'sur', SO: 'suroeste', O: 'oeste', NO: 'noroeste' }[k])
  return `<div class="stagger"><div class="panel-head"><div class="eyebrow">Análisis solar · ${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
      <h2>Sol en este punto</h2><p class="sub">Trayectoria, sombra y sol directo por fachada para ubicar ventanas.</p></div>
    <section class="section sun-ctl"><label>Fecha <input type="date" id="sun-date" value="${ui.date}"></label>
      <label class="range"><span>Hora (Perú)</span><span class="num">${hhmm(ui.min)}</span><input type="range" id="sun-min" min="300" max="1140" step="10" value="${ui.min}"></label>
      <label>Altura del objeto para la sombra (m) <input type="number" id="sun-h" min="0" max="300" step="0.5" value="${ui.h}"></label></section>
    <div class="triad">
      <div><div class="label">Salida</div><div class="value">${info.rise ? hhmm(info.rise.m) : '—'}</div><div class="unit">azimut ${info.rise ? fmt(info.rise.az, 0) + '°' : '—'}</div></div>
      <div><div class="label">Mediodía solar</div><div class="value">${hhmm(info.noon.m)}</div><div class="unit">altura máx. ${fmt(info.noon.alt, 1)}° · ${info.noon.az < 90 || info.noon.az > 270 ? 'al norte' : 'al sur'}</div></div>
      <div><div class="label">Puesta</div><div class="value">${info.set ? hhmm(info.set.m) : '—'}</div><div class="unit">azimut ${info.set ? fmt(info.set.az, 0) + '°' : '—'} · día ${info.len ? Math.floor(info.len / 60) + ' h ' + (info.len % 60) + ' min' : '—'}</div></div></div>
    <section class="section"><h3><span>A las <span id="sun-hh">${hhmm(ui.min)}</span></span>${kindBadge('calculado')}</h3>
      <p id="sun-now">${nowText()}</p>
      <p class="src-meta"><span class="sun-key" style="--c:var(--fx-sun)"></span>día elegido <span class="sun-key" style="--c:var(--enso-warm)"></span>21 dic (verano)
        <span class="sun-key" style="--c:var(--enso-cold)"></span>21 jun (invierno) <span class="sun-key" style="--c:var(--ink-soft)"></span>equinoccio · más lejos del centro = Sol más bajo</p></section>
    <section class="section"><h3><span>Sol directo por fachada · horas/día</span>${kindBadge('calculado')}</h3>
      <table class="sun-tab"><thead><tr><th>Fachada mira al</th><th>Verano</th><th>Invierno</th><th>Año</th></tr></thead><tbody>
      ${ORIENT.map(([k]) => `<tr${k === winter ? ' class="hi"' : ''}><td>${card(k)}</td><td>${fmt(fac[k].ver, 1)}</td><td>${fmt(fac[k].inv, 1)}</td><td>${fmt(fac[k].an, 1)}</td></tr>`).join('')}</tbody></table>
      <ul class="sun-tips"><li>Más sol en invierno: ventanas hacia el <b>${card(winter)}</b>${fac[winter].inv > fac[winter].ver ? ', con poco sol en verano (fácil de sombrear con alero)' : ''}.</li>
        <li>Más sol en verano: fachada <b>${card(summer)}</b> → conviene alero, parasol o vidrio de control solar.</li>
        <li>Sol de tarde (más caluroso): fachadas <b>oeste</b> y <b>noroeste</b> · ${fmt(fac.O.ver, 1)} h/día en verano.</li></ul>
      <p class="src-meta">Cálculo astronómico (fórmulas SunCalc, ~0,1°) cada 15 min, un día de cada cuatro. No considera edificios vecinos, cerros ni nubosidad.</p></section></div>`
}

function nowText() {
  const now = sunPos(at(ui.date, ui.min), pt.lat, pt.lon)
  const shadow = now.alt > 0 && ui.h > 0 ? ui.h / Math.tan(now.alt * RAD) : null
  return now.alt > 0 ? `Sol a <b>${fmt(now.alt, 1)}°</b> de altura, azimut <b>${fmt(now.az, 0)}°</b>.${shadow != null ? ` Un objeto de ${fmt(ui.h, 1)} m proyecta una sombra de <b>${fmt(shadow, 1)} m</b> hacia ${fmt((now.az + 180) % 360, 0)}°.` : ''}` : 'El Sol está bajo el horizonte.'
}

function update() {   // slider u altura: solo lo que cambia, sin rehacer el panel (el arrastre no se corta)
  document.getElementById('sun-now').innerHTML = nowText()
  document.getElementById('sun-hh').textContent = hhmm(ui.min)
  const n = document.querySelector('#sun-min')?.closest('.range')?.querySelector('.num')
  if (n) n.textContent = hhmm(ui.min)
  draw()
}

function render() {
  const el = document.getElementById('panel-body')
  el.innerHTML = panel()
  draw()
}

export function sunAt(lngLat) {
  pt = { lat: lngLat.lat, lon: lngLat.lng }
  ui.date ??= new Date(Date.now() + TZ * 36e5).toISOString().slice(0, 10)
  pin ??= new maplibregl.Marker({ element: Object.assign(document.createElement('div'), { className: 'wx-pin' }) })
  pin.setLngLat(lngLat).addTo(map)
  render()
}

export function setSunMode(on) {
  map.getCanvas().style.cursor = on ? 'crosshair' : ''
  if (on) return
  pt = null
  pin?.remove()
  showLayer('sun-lines', false)
  showLayer('sun-pts', false)
}

export function initSun() {
  const body = document.getElementById('panel-body')
  body.addEventListener('input', (e) => {
    if (!pt) return
    const t = e.target
    if (t.id === 'sun-min') {
      ui.min = +t.value
      update()
    } else if (t.id === 'sun-h') {
      ui.h = Math.max(0, +t.value || 0)
      update()
    }
  })
  body.addEventListener('change', (e) => {
    if (pt && e.target.id === 'sun-date' && e.target.value) {
      ui.date = e.target.value
      render()
    }
  })
  map.on('zoomend', () => pt && draw())
}

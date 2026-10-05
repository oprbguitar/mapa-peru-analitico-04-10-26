// Informador 360 (clic en cualquier punto) y Observatorio de denuncias del territorio.
/* global maplibregl */
import { flyTo, map } from './map.js'
import { esc, fmt, fmtPct, getJSON, kindBadge, state } from './util.js'
import { CAT_LABEL } from './places.js'

const body = () => document.getElementById('panel-body')
let pin
let last = null
const MOD_COLOR = { Otros: '--mod-otros', 'Violencia contra la mujer e integrantes': '--mod-violencia', Hurto: '--mod-hurto', Robo: '--mod-robo',
  Estafa: '--mod-estafa', 'Extorsión': '--mod-extorsion', Secuestro: '--mod-secuestro' }
export const modColor = (m) => `var(${MOD_COLOR[m] || '--ink-muted'})`

export const lastContext = () => last

export async function renderContext(lat, lon, { onAction } = {}) {
  pin ??= new maplibregl.Marker({ element: Object.assign(document.createElement('div'), { className: 'wx-pin' }) })
  pin.setLngLat([lon, lat]).addTo(map)
  body().innerHTML = '<p class="loading">Armando la ficha del lugar: territorio, seguridad, servicios, emergencias y peligros</p>'
  const c = await getJSON(`/api/v1/intel/context?lat=${lat}&lon=${lon}`)
  last = c
  const t = c.territory
  const s = c.security
  const sv = c.services.rows
  const e = c.emergencies
  const hz = c.hazards
  const env = c.environment || {}
  body().innerHTML = `<div class="stagger">
    <div class="panel-head"><div class="eyebrow">Informador 360 · ${fmt(lat, 4)}, ${fmt(lon, 4)}${t.h3_r7 ? ` · H3 ${esc(t.h3_r7)}` : ''}</div>
      <h2>${esc(t.distrito || 'Fuera del Perú')}</h2><p class="sub">${t.in_peru ? `${esc(t.provincia)}, ${esc(t.departamento)} · UBIGEO ${esc(t.ubigeo)}` : ''}</p></div>
    <p class="callout" style="border-left-color:var(--accent)">${esc(c.summary)}</p>
    <div class="ai-actions" style="padding:0">
      <button class="btn btn-primary" type="button" data-act="speak">🔊 Escuchar</button>
      ${t.in_peru ? `<button class="btn" type="button" data-act="observatory">Observatorio</button>
      <button class="btn" type="button" data-act="patterns">Patrones aquí</button>
      <button class="btn" type="button" data-act="route-from">Ruta desde aquí</button>
      <button class="btn" type="button" data-act="route-to">Ruta hasta aquí</button>
      <button class="btn btn-ghost" type="button" data-act="region">Ficha estadística</button>` : ''}</div>
    ${s ? `<section class="section"><h3><span>Seguridad · ${s.year}</span>${kindBadge('oficial', 'SIDPOL')}</h3><div class="triad">
      <div><div class="label">Denuncias</div><div class="value">${fmt(s.count, 0)}</div><div class="unit">en el distrito</div></div>
      <div><div class="label">Tasa</div><div class="value">${fmt(s.rate, 0)}</div><div class="unit">por 100 mil hab.</div></div>
      <div><div class="label">Cambio</div><div class="value delta" data-sign="${s.change_pct > 0 ? 'up' : s.change_pct < 0 ? 'down' : 'flat'}">${fmtPct(s.change_pct)}</div><div class="unit">vs año anterior</div></div></div>
      <p class="src-meta">Modalidad principal: ${esc(s.top_modality || '—')} (${fmt(s.top_share_pct, 0)} %) · puesto ${s.position ?? '—'} de ${s.of} en su provincia${s.hot ? ' · <b>foco (10 % más alto)</b>' : ''}.
        SIDPOL ubica el hecho por distrito: no hay datos públicos por calle.</p></section>` : ''}
    <section class="section"><h3><span>Servicios y sedes cercanas</span>${kindBadge('oficial', 'RENIPRESS')}${kindBadge('vivo_tercero', 'OSM')}</h3>
      <table class="why-table"><thead><tr><th>Tipo</th><th>≤ 1 km</th><th>≤ 5 km</th><th>Más cercano</th></tr></thead><tbody>
      ${sv.map((r) => `<tr><td><span class="dot" style="--c:var(${r.cat === 'hospital' ? '--inst-fiscalia' : `--inst-${r.cat}`}, var(--ink-muted))"></span> ${esc(r.label)}</td>
        <td>${r.n_1km}</td><td>${r.n_5km}</td><td>${r.nearest ? `<button class="peer" type="button" data-fly="${r.nearest.lon},${r.nearest.lat}" title="${esc(r.nearest.nombre)}">${fmt(r.nearest.km, 1)} km</button>` : '—'}</td></tr>`).join('')}
      </tbody></table><p class="src-meta">${esc(c.services.note)}</p></section>
    ${e.indeci ? `<section class="section"><h3><span>Emergencias · 12 meses hasta ${esc(e.indeci.window_end)}</span>${kindBadge('oficial', 'INDECI')}</h3>
      ${e.indeci.by_type.length ? `<dl class="kv">${e.indeci.by_type.map((x) => `<dt>${esc(x.fenomeno)}</dt><dd>${x.n} · ${fmt(x.af, 0)} afect.</dd>`).join('')}</dl>` : '<p class="empty">Sin emergencias registradas.</p>'}
      ${e.vias.length ? `<p class="src-meta section-gap">Red vial nacional a ≤ 25 km (MTC):</p><dl class="kv">${e.vias.map((v) => `<dt>${esc(v.ruta)} · ${esc(v.evento)} <small>${esc(v.fecha)}</small></dt><dd>${esc(v.estado)} · ${fmt(v.km, 0)} km</dd>`).join('')}</dl>` : ''}</section>` : ''}
    ${hz ? `<section class="section"><h3><span>Peligros geológicos ≤ 5 km</span>${kindBadge('oficial', 'INGEMMET')}</h3>
      ${hz.error ? `<p class="note">${esc(hz.error)}</p>` : `${hz.zonas_criticas.length ? `<dl class="kv">${hz.zonas_criticas.slice(0, 5).map((z) => `<dt>${esc(z.peligro)} <small>${esc(z.paraje || '')}</small></dt><dd>${fmt(z.km, 1)} km</dd>`).join('')}</dl>` : '<p class="empty">Sin zonas críticas cercanas.</p>'}
      <p class="src-meta">${hz.inventario} peligros inventariados en 5 km.</p>`}</section>` : ''}
    ${c.enso ? `<section class="alert-band"><div class="eyebrow">${esc(c.enso.status)}</div><p>${esc(c.enso.headline)}</p>
      <p class="src-meta"><a href="${esc(c.enso.url)}" target="_blank" rel="noopener">${esc(c.enso.comunicado)}</a></p></section>` : ''}
    ${env.clima || env.sismos ? `<section class="section"><h3><span>Ambiente ahora</span>${kindBadge('proyeccion', 'modelo')}</h3><dl class="kv">
      ${env.clima ? `<dt>Clima (celda a ${env.clima.km_celda} km)</dt><dd>${fmt(env.clima.temp_c)} °C · ${fmt(env.clima.precip_mm)} mm · ${esc((env.clima.fx || []).join(', ') || '—')}</dd>` : ''}
      ${env.sismos ? `<dt>Sismos ≤ 150 km (30 d)</dt><dd>${env.sismos.n}${env.sismos.max_mag ? ` · máx. M${fmt(env.sismos.max_mag)}` : ''}</dd>` : ''}
      ${env.focos ? `<dt>Focos de calor ≤ 25 km</dt><dd>${env.focos.n}</dd>` : ''}</dl></section>` : ''}
    ${t.in_peru ? `<section class="section"><h3><span>Señales mediáticas</span>${kindBadge('vivo_tercero', 'GDELT')}</h3>
      <button class="btn" type="button" data-act="media">Buscar titulares (3 días)</button><div id="media-out"></div></section>` : ''}
    <section class="section"><h3>Fuentes de esta ficha</h3><div class="sources-list">${c.provenance.map((p) => `<div class="src">${kindBadge(p.kind, p.institution)}
      <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></div>`).join('')}</div></section></div>`
  body().querySelectorAll('[data-fly]').forEach((b) => b.addEventListener('click', () => {
    const [x, y] = b.dataset.fly.split(',').map(Number)
    flyTo(x, y, 16)
  }))
  body().querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.act === 'media') {
      const out = document.getElementById('media-out')
      out.innerHTML = '<p class="loading">Consultando GDELT</p>'
      const m = await getJSON(`/api/v1/intel/context/media?q=${encodeURIComponent(t.distrito)}`).catch((err) => ({ error: err.message, items: [] }))
      out.innerHTML = `<p class="note">SEÑAL MEDIÁTICA NO VERIFICADA: titulares, no hechos.</p>${m.error ? `<p class="empty">${esc(m.error)}</p>` : ''}
        ${m.items.length ? `<ul class="steps">${m.items.map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a> <small>${esc(a.domain)}</small></li>`).join('')}</ul>` : '<p class="empty">Sin titulares recientes.</p>'}`
      return
    }
    onAction?.(b.dataset.act, c)
  }))
  return c
}

// ── observatorio de denuncias ───────────────────────────────────────────────
export async function renderObservatory(ub, modalidad, { onYear, onModalidad, onSelect } = {}) {
  body().innerHTML = '<p class="loading">Cargando el observatorio</p>'
  const o = await getJSON(`/api/v1/intel/observatory/${ub}${modalidad ? `?modalidad=${encodeURIComponent(modalidad)}` : ''}`)
  const max = Math.max(...o.years.map((y) => Math.max(y.count, o.projection && y.year === o.projection.year ? o.projection.hi95 : 0)), 1)
  const selYear = state.preset === 'year' ? state.year : o.years.at(-1).year
  const yrow = o.years.find((y) => y.year === selYear) || o.years.at(-1)
  body().innerHTML = `<div class="stagger">
    <div class="panel-head"><div class="eyebrow">Observatorio de denuncias · ${esc(o.level)} · UBIGEO ${esc(o.ubigeo)}</div><h2>${esc(o.nombre)}</h2>
      <p class="sub">Elige una modalidad: el mapa se colorea con su porcentaje.</p></div>
    <div class="chips" role="group" aria-label="Modalidad">
      <button type="button" class="chip" data-mod="" aria-pressed="${!modalidad}">Todas</button>
      ${o.modalities.map((m) => `<button type="button" class="chip" data-mod="${esc(m)}" aria-pressed="${modalidad === m}" style="--c:${modColor(m)}"><i></i>${esc(m.replace(' e integrantes', ''))}</button>`).join('')}</div>
    <section class="section"><h3><span>Año por año · ${esc(o.modalidad)}</span>${kindBadge('oficial')}</h3>
      <div class="years" role="group" aria-label="Denuncias por año; clic para ver el año en el mapa">
      ${o.years.map((y, i) => {
        const pr = o.projection && y.year === o.projection.year ? o.projection : null
        return `<button type="button" class="year-col" data-year="${y.year}" aria-pressed="${y.year === selYear}" title="${y.year}: ${fmt(y.count, 0)} denuncias${y.partial ? ` (ene–${y.months})` : ''}${pr ? ` · proyección ${fmt(pr.point, 0)}` : ''}">
          <span class="chg" data-t="${y.trend || ''}">${y.change_pct == null ? '' : (y.change_pct > 0 ? '▲' : '▼') + Math.abs(Math.round(y.change_pct))}</span>
          <span class="slot">${pr ? `<span class="proj" style="bottom:${(pr.lo95 / max) * 100}%;height:${((pr.hi95 - pr.lo95) / max) * 100}%"></span><span class="proj-pt" style="bottom:calc(${(pr.point / max) * 100}% - 4px)"></span>` : ''}
            <span class="col" data-t="${y.trend || ''}" data-partial="${y.partial}" style="--i:${i};height:${(y.count / max) * 100}%"></span></span>
          <span class="yr">${String(y.year).slice(2)}</span></button>`
      }).join('')}</div>
      <p class="src-meta">▲ rojo sube · ▼ azul baja (frente al año anterior; el año en curso se compara con los mismos meses). Rombo: proyección del año.</p></section>
    ${o.projection ? `<div class="callout"><span>${kindBadge('proyeccion')} Proyección ${o.projection.year}</span><strong>${fmt(o.projection.point, 0)} denuncias</strong>
      <span>${fmt(o.projection.observed, 0)} registradas (ene–${o.projection.observed_months}) + meses restantes · 95 %: ${fmt(o.projection.lo95, 0)}–${fmt(o.projection.hi95, 0)}
      · ${fmtPct(o.projection.vs_prev_full)} vs ${o.projection.year - 1}</span><span class="src-meta">${esc(o.projection.method)}</span></div>` : ''}
    <section class="section"><h3><span>Composición ${yrow.year}${yrow.partial ? ' (parcial)' : ''}</span>${kindBadge('calculado', '% del total')}</h3>
      <div class="stack" aria-hidden="true">${yrow.by_modality.filter((m) => m.count).map((m) => `<span style="--c:${modColor(m.modalidad)};width:${m.share_pct}%"></span>`).join('')}</div>
      <div class="stack-key">${yrow.by_modality.map((m) => `<span style="--c:${modColor(m.modalidad)}"><i></i>${esc(m.modalidad.replace(' e integrantes', ''))}<b>${fmt(m.share_pct, 1)} %</b></span>`).join('')}</div></section>
    ${o.shift.items.length ? `<section class="section"><h3><span>¿Hacia dónde se sesgó? ${o.shift.from} → ${o.shift.to}</span>${kindBadge('calculado')}</h3>
      ${o.shift.items.slice(0, 5).map((r) => `<div class="shift-row"><span>${esc(r.modalidad)}</span><span class="num">${fmt(r.share_prev, 1)} → ${fmt(r.share, 1)} %</span>
        <span class="pp" data-sign="${r.pp > 0 ? 'up' : r.pp < 0 ? 'down' : 'flat'}">${fmt(Math.abs(r.pp), 1)} pp</span></div>`).join('')}
      <p class="src-meta">${esc(o.shift.note)}</p></section>` : ''}
    <section class="section"><h3><span>Frente a ${esc(o.peers.scope)} · ${o.peers.year}</span>${kindBadge('calculado', 'tasa')}</h3>
      <p class="src-meta">Puesto ${o.peers.position ?? '—'} de ${o.peers.of} por tasa (1 = más alta).</p>
      ${o.peers.top.map((r, i) => `<button type="button" class="peer" data-ub="${esc(r.ubigeo)}" aria-current="${r.ubigeo === o.ubigeo}"><span class="num">${i + 1}</span><span>${esc(r.nombre)}</span><span class="num">${fmt(r.rate, 0)}</span></button>`).join('')}</section>
    <p class="note">${esc(o.caveat)}</p></div>`
  const root = body()
  root.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => onModalidad?.(b.dataset.mod)))
  root.querySelectorAll('[data-year]').forEach((b) => b.addEventListener('click', () => onYear?.(+b.dataset.year)))
  root.querySelectorAll('.peer[data-ub]').forEach((b) => b.addEventListener('click', () => onSelect?.(b.dataset.ub)))
  return o
}

export const catLabel = (c) => CAT_LABEL[c] || c

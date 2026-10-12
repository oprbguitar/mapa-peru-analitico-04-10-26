// Informes imprimibles (plan maestro §10): el servidor arma el modelo con cifras, supuestos, fuentes y JEV; aquí se
// compone un documento HTML autónomo (captura del mapa incluida) que se guarda con Ctrl+S o se imprime a PDF.
import { map } from './map.js'
import { esc, fmt, getJSON, toast } from './util.js'

/** Captura del lienzo del mapa en el mismo cuadro de dibujo (sin preserveDrawingBuffer). Los marcadores HTML no salen. */
export function snapshotMap() {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 3000)
    map.once('render', () => {
      clearTimeout(t)
      try { resolve(map.getCanvas().toDataURL('image/jpeg', 0.85)) } catch { resolve(null) }
    })
    map.triggerRepaint()
  })
}

const q = (x, u = '') => (x?.p50 == null ? '—' : `${fmt(x.p50, 1)}${u} <small>(${fmt(x.p5, 1)}–${fmt(x.p95, 1)})</small>`)

function runSection(run) {
  if (!run) return '<p>Sin ejecución terminada.</p>'
  const p = run.params
  const r = run.results
  let rows = []
  if (p.engine === 'operations') {
    rows = [['A tiempo (≤ ' + p.ops.target_min + ' min)', q(r.within_target_pct, ' %')], ['Respuesta p50', q(r.response_p50_min, ' min')],
      ['Respuesta p90', q(r.response_p90_min, ' min')], ['Llamadas', q(r.calls)], ['Sin atender al cierre', q(r.unattended)],
      ['Trayectos que cruzan tramos', q(r.crossing_tramos_pct, ' %')]]
  } else if (p.engine === 'queue') {
    rows = [['Atendidas ≤ 30 min · hoy', q(r.A.within_30_pct, ' %')], ['Atendidas ≤ 30 min · hipótesis', q(r.B.within_30_pct, ' %')],
      ['Espera p90 · hoy', q(r.A.wait_p90_min, ' min')], ['Espera p90 · hipótesis', q(r.B.wait_p90_min, ' min')]]
  } else {
    rows = ['15', '30', '45'].map((t) => [`Área ≤ ${t} min · hoy → hipótesis`, `${q(r.A.coverage_pct[t], ' %')} → ${q(r.B.coverage_pct[t], ' %')}`])
    rows.unshift(['Tiempo mediano · hoy → hipótesis', `${q(r.A.median_min, ' min')} → ${q(r.B.median_min, ' min')}`])
  }
  const units = run.units ? `<h3>Unidades</h3><table><thead><tr><th>Unidad</th><th>Tipo</th><th>Ocupada</th><th>Llamadas</th></tr></thead><tbody>
    ${run.units.map((u) => `<tr><td>${esc(u.id)}</td><td>${esc(u.label)}</td><td>${fmt(u.utilization_pct, 0)} %</td><td>${fmt(u.served_p50, 0)}</td></tr>`).join('')}</tbody></table>` : ''
  return `<table><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>
    <p class="meta">Mediana y rango del 90 % entre repeticiones · ejecución <code>${esc(run.run_id)}</code> · semilla ${esc(p.seed)} · ${esc(p.engine_version)}</p>
    ${units}
    <h3>Supuestos</h3><ul>${(run.assumptions || []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
    ${run.warnings?.length ? `<h3>Avisos del motor</h3><ul>${run.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    <h3>Fuentes</h3>${run.provenance?.length ? `<ul>${run.provenance.map((s) => `<li>${esc(s.name)} · ${esc(s.institution)} · ${s.official ? 'oficial' : 'colaborativa / tercero'} ·
      descarga ${esc((s.downloaded || '—').slice(0, 10))}</li>`).join('')}</ul>` : '<p>Solo supuestos declarados (sin fuentes externas).</p>'}`
}

function jevSection(j) {
  if (!j) return ''
  if (j.ranking) return `<p>${esc(j.note)}</p>`
  return `<p><b>${esc(j.decision_label)}</b> · puntuación interna ${esc(j.score ?? '—')} (no es una probabilidad) · incertidumbre ${esc(j.uncertainty.level)}
    · variabilidad ${esc(j.variability?.level || '—')} · ${esc(j.engine)}</p><ol>${j.facts.map((f) => `<li>${esc(f.text)}</li>`).join('')}</ol>`
}

function versionsSection(versions) {
  if (!versions?.length) return ''
  return `<h2>Desarrollo del escenario</h2><table><thead><tr><th>Versión</th><th>Fecha · autor</th><th>Cambios</th><th>A tiempo</th></tr></thead><tbody>
    ${versions.map((v) => `<tr><td>v${v.v}</td><td>${esc(v.at.replace('T', ' ').slice(0, 16))} UTC<br>${esc(v.by || '')}</td>
      <td>${v.changes.map(esc).join('<br>')}${v.note ? `<br><i>${esc(v.note)}</i>` : ''}</td>
      <td>${v.metrics?.within_target_pct == null ? '—' : `${fmt(v.metrics.within_target_pct, 1)} %`}</td></tr>`).join('')}</tbody></table>`
}

function compareSection(rows) {
  if (!rows) return ''
  return `<h2>Escenarios comparados</h2><table><thead><tr><th>Escenario</th><th>Versión</th><th>Unidades</th><th>Tramos</th><th>«¿Qué pasa si…?»</th><th>A tiempo</th><th>Resp. p50</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>v${r.version}</td><td>${r.summary.units}</td><td>${r.summary.tramos}</td><td>${esc(r.summary.preset || '—')}</td>
      <td>${r.metrics?.within_target_pct == null ? '—' : `${fmt(r.metrics.within_target_pct, 1)} %`}</td>
      <td>${r.metrics?.response_p50_min == null ? '—' : `${fmt(r.metrics.response_p50_min, 0)} min`}</td></tr>`).join('')}</tbody></table>`
}

export function reportHtml(m, img) {
  return `<!doctype html><html lang="es-PE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.title)} · Mapa Perú Analítico</title>
<style>
  :root { --ink:#14181d; --muted:#5a6470; --line:#d5dbe1; --accent:#0b7285; --warn:#b35c00; }
  body { margin:0; padding:32px; font:15px/1.5 "Noto Sans", "Segoe UI", sans-serif; color:var(--ink); background:#fff; max-width:980px; }
  h1 { font:700 28px/1.2 "Space Grotesk", "Segoe UI", sans-serif; margin:0 0 4px; }
  h2 { font:700 19px/1.3 "Space Grotesk", "Segoe UI", sans-serif; margin:28px 0 8px; padding-top:12px; border-top:3px solid var(--ink); }
  h3 { font-size:15px; margin:18px 0 6px; }
  .meta, small { color:var(--muted); font-size:13px; }
  .badge { display:inline-block; padding:2px 8px; border:1px solid var(--warn); color:var(--warn); font:700 12px/1.4 monospace; text-transform:uppercase; }
  .exec { border-left:4px solid var(--accent); padding:4px 16px; margin:16px 0; }
  .exec p { margin:6px 0; font-size:16px; }
  table { width:100%; border-collapse:collapse; margin:8px 0; font-size:14px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  thead th { font:700 12px monospace; text-transform:uppercase; color:var(--muted); }
  img.map { width:100%; border:1px solid var(--line); margin:12px 0; }
  code { font-size:12px; }
  .hint { font-size:12px; color:var(--muted); }
  @media print { body { padding:0; } .hint { display:none; } h2 { break-after:avoid; } table, img { break-inside:avoid; } }
</style></head><body>
<p class="hint">Guardar: Ctrl+S · PDF: Ctrl+P → «Guardar como PDF»</p>
<p class="meta">Mapa Perú Analítico · laboratorio de simulación (instalación local) · generado ${esc(m.generated_at.replace('T', ' ').slice(0, 16))} UTC</p>
<h1>${esc(m.title)}</h1><span class="badge">Estimación exploratoria</span>
${m.scenario?.parent ? `<p class="meta">Derivado de «${esc(m.scenario.parent.name || m.scenario.parent.id)}» v${esc(m.scenario.parent.version)}</p>` : ''}
<h2>Resumen ejecutivo</h2><div class="exec">${m.executive.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
${img ? `<img class="map" src="${img}" alt="Captura del mapa con la zona simulada">` : ''}
${m.kind === 'comparacion' ? compareSection(m.rows) : ''}
${m.run ? `<h2>Resultados</h2>${runSection(m.run)}` : ''}
${m.jev ? `<h2>Evaluación JEV</h2>${jevSection(m.jev)}` : ''}
${versionsSection(m.versions)}
<h2>Limitaciones</h2><ul>${m.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<p class="meta">Ejercicio de análisis: no genera órdenes operativas ni se refiere a personas o hechos reales. La decisión es de la persona responsable.</p>
</body></html>`
}

/** Abre el informe en una pestaña nueva. La pestaña se abre en el mismo clic (sin bloqueo de ventanas emergentes). */
export async function openReport(url) {
  const win = window.open('', '_blank')
  try {
    const [model, img] = await Promise.all([getJSON(url), snapshotMap()])
    const blob = new Blob([reportHtml(model, img)], { type: 'text/html' })
    const href = URL.createObjectURL(blob)
    if (win) win.location.href = href
    else window.open(href, '_blank')
    setTimeout(() => URL.revokeObjectURL(href), 60000)
  } catch (e) {
    win?.close()
    toast(e.message)
  }
}

export async function timelineHtml(scenarioId) {
  const m = await getJSON(`/api/v1/reports/scenario/${scenarioId}`)
  return `<ol class="scn-timeline">${m.versions.map((v) => `<li><b>v${v.v}</b> · ${esc(v.at.replace('T', ' ').slice(0, 16))} · ${esc(v.by || '')}
      <span>${v.changes.map(esc).join(' · ')}</span>
      <small>${v.metrics?.within_target_pct == null ? '' : `a tiempo ${fmt(v.metrics.within_target_pct, 1)} %`}</small>
      <button class="btn btn-ghost" type="button" data-open-version="${v.v}">Abrir esta versión</button></li>`).join('')}</ol>`
}

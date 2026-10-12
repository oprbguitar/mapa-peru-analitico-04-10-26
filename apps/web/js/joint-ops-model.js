// Operativos conjuntos — modelo puro (sin DOM): fase y posición de cada unidad en el tiempo virtual, costo acumulado
// con el tarifario del usuario, plantillas de recursos por incidencia y un escenario de ejemplo con varios operativos.

export const SIGLA = { patrullero: 'P', motorizado: 'M', unidad_especial: 'UE', agentes: 'AP', dron: 'D', serenazgo: 'S',
  ambulancia: 'A', bomberos: 'B', fiscal: 'F', ejercito: 'E', marina: 'N', helicoptero: 'H', logistica: 'L', externo: 'X' }
export const PHASE = { base: 'En base', alistamiento: 'Alistando', ruta: 'En ruta', falla: 'Falla en ruta', sitio: 'En sitio',
  retorno: 'Retornando', fin: 'De vuelta' }
export const PRIORITY = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' }

/** Recursos sugeridos al crear un operativo (el usuario los cambia; no es una dotación normativa). */
export const PRESETS = {
  intervencion: [['patrullero', 3], ['motorizado', 2], ['unidad_especial', 1], ['fiscal', 1], ['ambulancia', 1]],
  control: [['patrullero', 2], ['motorizado', 2], ['agentes', 2], ['dron', 1], ['ejercito', 1]],
  rescate: [['bomberos', 1], ['ambulancia', 2], ['helicoptero', 1], ['serenazgo', 1], ['dron', 1]],
  incendio: [['bomberos', 3], ['ambulancia', 1], ['patrullero', 1], ['serenazgo', 1]],
  desastre: [['ejercito', 2], ['helicoptero', 1], ['logistica', 2], ['ambulancia', 2], ['bomberos', 1]],
  evacuacion: [['ambulancia', 2], ['helicoptero', 1], ['patrullero', 1]],
  humanitaria: [['logistica', 3], ['ejercito', 1], ['serenazgo', 1]],
  orden_publico: [['patrullero', 4], ['motorizado', 4], ['unidad_especial', 2], ['serenazgo', 2], ['ambulancia', 1], ['dron', 1]],
}

const R = 6371.0088
export function kmBetween([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180
  const h = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Prepara las distancias acumuladas de la ruta de cada unidad (una vez por resultado). */
export function prepareUnits(units) {
  for (const u of units) {
    const c = u.coords || []
    const cum = [0]
    for (let i = 1; i < c.length; i++) cum.push(cum[i - 1] + kmBetween(c[i - 1], c[i]))
    u._cum = cum
    u._len = cum.at(-1) || 0
  }
  return units
}

function along(u, frac) {
  const c = u.coords
  if (!c?.length) return null
  if (c.length === 1 || u._len === 0) return { pos: c[0], heading: 0 }
  const target = Math.max(0, Math.min(1, frac)) * u._len
  let i = 1
  while (i < c.length - 1 && u._cum[i] < target) i++
  const seg = u._cum[i] - u._cum[i - 1] || 1
  const k = (target - u._cum[i - 1]) / seg
  const a = c[i - 1], b = c[i]
  return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], heading: Math.atan2(b[1] - a[1], b[0] - a[0]), i }
}

/** Fase, posición y avance de una unidad en el minuto virtual t (escenario central del resultado). */
export function unitState(u, t, failDelay) {
  const T = u.t
  const travel = Math.max(0.01, u.travel_min)
  if (t < T.depart) return { phase: 'base', pos: u.coords[0], frac: 0, kmDone: 0 }
  if (t < T.ready) return { phase: 'alistamiento', pos: u.coords[0], frac: 0, kmDone: 0 }
  if (t < T.arrive) {
    let e = t - T.ready
    let phase = 'ruta'
    if (u.failed) {
      if (e >= travel / 2 && e < travel / 2 + failDelay) { phase = 'falla'; e = travel / 2 } else if (e >= travel / 2 + failDelay) e -= failDelay
    }
    const frac = Math.min(1, e / travel)
    return { phase, frac, kmDone: frac * u.km, ...along(u, frac) }
  }
  if (t < T.leave) return { phase: 'sitio', pos: u.coords.at(-1), frac: 1, kmDone: u.km }
  if (T.back > T.leave && t < T.back) {
    const frac = (t - T.leave) / (T.back - T.leave)
    const a = along(u, 1 - frac)
    return { phase: 'retorno', frac, kmDone: u.km * (1 + frac), pos: a.pos, heading: a.heading + Math.PI }
  }
  return { phase: 'fin', pos: T.back > T.leave ? u.coords[0] : u.coords.at(-1), frac: 1, kmDone: u.km_total }
}

/** Costo acumulado de la unidad hasta t con el tarifario del plan (S/). null si no hay tarifa para su tipo. */
export function costAt(u, s, t, rate) {
  if (!rate || !u.has_rate) return null
  if (t < u.t.depart) return 0
  const el = Math.max(0, Math.min(t, u.t.back) - u.t.depart) / 60
  // aeronaves: horas de vuelo (traslado de ida y de vuelta); demás vehículos: toda la misión (como en el servidor)
  const flown = u.mode === 'aire'
    ? (Math.max(0, Math.min(t, u.t.arrive) - u.t.ready) + Math.max(0, Math.min(t, u.t.back) - u.t.leave)) / 60 : el
  return u.qty * ((s.kmDone || 0) * (+rate.km || 0) + flown * (+rate.hora || 0) + (+rate.fijo || 0)) + u.qty * u.crew * el * (+rate.persona_hora || 0)
}

export function fmtT(min) {
  if (min == null || !Number.isFinite(min)) return '—'
  const m = Math.max(0, Math.round(min))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export const fmtDur = (min) => {
  if (min == null || !Number.isFinite(min)) return '—'
  const m = Math.round(min)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
export const clock = (startHour, min) => fmtT(startHour * 60 + min).replace(/^(\d+)/, (h) => String(+h % 24).padStart(2, '0'))
export const soles = (v) => v == null ? '—' : `S/ ${Math.round(v).toLocaleString('es-PE')}`

/** Escenario de ejemplo: cuatro operativos simultáneos en tres regiones (recursos hipotéticos). */
export function demoPlan() {
  const mk = (n, name, incident, lat, lon, start, priority, extra = []) => ({
    id: `op${n}`, n, name, incident, lat, lon, start, priority, links: [],
    resources: [...(PRESETS[incident] || []), ...extra].map(([kind, qty]) => ({ kind, qty })),
  })
  return {
    name: 'Ejercicio multirregión',
    hypothesis: { start_hour: 8, day: 'laboral', rain: 'ninguna', p_fail: 0.05, fail_delay: 25, return: true, seed: 7 },
    operations: [
      mk(1, 'Intervención Cercado', 'intervencion', -12.0464, -77.0300, 0, 'alta'),
      mk(2, 'Control portuario Callao', 'control', -12.0520, -77.1440, 15, 'media', [['marina', 1]]),
      mk(3, 'Rescate fluvial Iquitos', 'rescate', -3.7437, -73.2516, 30, 'alta', [['marina', 1]]),
      mk(4, 'Huaico en Piura', 'desastre', -5.1945, -80.6328, 45, 'alta'),
    ],
    tariff: {}, tariff_origin: 'usuario',
  }
}

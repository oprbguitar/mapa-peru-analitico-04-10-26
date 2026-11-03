// Ejercicio de mesa: los supuestos del usuario no son observaciones ni pronósticos.
export const DEFAULT_ASSUMPTIONS = Object.freeze({ rainfallMm: 60, durationHours: 24, soilCondition: 'humedo' })
export const SCENARIO_PHASES = Object.freeze([
  { id: 'lluvia', label: 'Lluvias', description: 'Examinar la lluvia ingresada como supuesto; no representa una observación meteorológica.' },
  { id: 'saturacion', label: 'Saturación y escorrentía', description: 'Revisar la condición inicial del suelo; la escorrentía requiere datos y calibración locales.' },
  { id: 'cauces', label: 'Ríos y quebradas', description: 'Consultar cauces cartografiados; no se calcula activación, caudal ni propagación.' },
  { id: 'amenazas', label: 'Inundaciones y movimientos en masa', description: 'Consultar amenazas publicadas; no se generan huellas de inundación ni deslizamiento.' },
  { id: 'exposicion', label: 'Impacto territorial', description: 'La exposición requiere intersección de una huella validada con activos fechados; no se estima aquí.' },
  { id: 'respuesta', label: 'Respuesta y recuperación', description: 'Revisar medidas de preparación con las autoridades; no se calculan daños, recursos ni costos.' },
].map(phase => Object.freeze(phase)))

const METHOD = 'Lluvia total supuesta / duración supuesta; sin modelo hidrológico calibrado.'
function record(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error(`${name}: estructura no válida.`)
}
function number(value, min, max, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${name}: valor fuera del intervalo permitido.`)
  return value
}
function text(value, max, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) throw new Error(`${name}: texto no válido.`)
  return value.trim()
}

export function createScenario(input = {}) {
  record(input, ['location', 'episodeId', 'assumptions'], 'Escenario')
  const location = input.location ?? { lon: -75, lat: -9, label: 'Perú · referencia nacional' }
  record(location, ['lon', 'lat', 'label'], 'Ubicación')
  const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS
  record(assumptions, ['rainfallMm', 'durationHours', 'soilCondition'], 'Supuestos')
  const rainfallMm = number(assumptions.rainfallMm, 0, 10000, 'Lluvia (mm)')
  const durationHours = number(assumptions.durationHours, 0.1, 2160, 'Duración (h)')
  if (!['seco', 'humedo', 'saturado'].includes(assumptions.soilCondition)) throw new Error('Condición del suelo no válida.')
  return {
    schemaVersion: 1,
    nature: 'escenario_hipotetico',
    location: { lon: number(location.lon, -180, 180, 'Longitud'), lat: number(location.lat, -90, 90, 'Latitud'), label: text(location.label, 180, 'Lugar') },
    episodeId: text(input.episodeId ?? 'sin_episodio', 80, 'Episodio'),
    assumptions: { rainfallMm, durationHours, soilCondition: assumptions.soilCondition },
    calculated: { rainfallMeanMmHour: rainfallMm / durationHours },
    provenance: { source: 'Supuestos ingresados por el usuario', nature: 'calculado', method: METHOD, geographicLevel: 'punto de referencia; no representa una cuenca modelada', period: 'Duración hipotética ingresada; sin fechas observadas', downloadedAt: null },
  }
}

export function validateScenario(scenario) {
  record(scenario, ['schemaVersion', 'nature', 'location', 'episodeId', 'assumptions', 'calculated', 'provenance'], 'Archivo de escenario')
  if (scenario.schemaVersion !== 1 || scenario.nature !== 'escenario_hipotetico') throw new Error('Versión o naturaleza del escenario no compatible.')
  const expected = createScenario({ location: scenario.location, episodeId: scenario.episodeId, assumptions: scenario.assumptions })
  if (!scenario.calculated || scenario.calculated.rainfallMeanMmHour !== expected.calculated.rainfallMeanMmHour) throw new Error('Cálculo de escenario inconsistente.')
  record(scenario.calculated, ['rainfallMeanMmHour'], 'Cálculo')
  record(scenario.provenance, Object.keys(expected.provenance), 'Procedencia')
  if (Object.entries(expected.provenance).some(([key, value]) => scenario.provenance[key] !== value)) throw new Error('Procedencia de escenario no compatible.')
  return true
}

export function scenarioFrame(scenario, phaseIndex) {
  validateScenario(scenario)
  if (!Number.isInteger(phaseIndex) || phaseIndex < 0 || phaseIndex >= SCENARIO_PHASES.length) throw new Error('Fase conceptual no válida.')
  return { phase: { ...SCENARIO_PHASES[phaseIndex] }, mode: 'conceptual', hydrologicalOutput: null, exposure: null }
}

export function compareScenarios(a, b) {
  validateScenario(a)
  validateScenario(b)
  return {
    rainfallMmDelta: b.assumptions.rainfallMm - a.assumptions.rainfallMm,
    durationHoursDelta: b.assumptions.durationHours - a.assumptions.durationHours,
    rainfallMeanMmHourDelta: b.calculated.rainfallMeanMmHour - a.calculated.rainfallMeanMmHour,
    soilChanged: b.assumptions.soilCondition !== a.assumptions.soilCondition,
    sameLocation: a.location.lon === b.location.lon && a.location.lat === b.location.lat,
    nature: 'comparacion_de_supuestos',
  }
}

export function serializeScenario(scenario) {
  validateScenario(scenario)
  return JSON.stringify(scenario, null, 2)
}

export function restoreScenario(json) {
  if (typeof json !== 'string' || json.length > 20000) throw new Error('Archivo de escenario no válido o demasiado grande.')
  let scenario
  try { scenario = JSON.parse(json) } catch { throw new Error('El archivo no contiene JSON válido.') }
  validateScenario(scenario)
  return createScenario({ location: scenario.location, episodeId: scenario.episodeId, assumptions: scenario.assumptions })
}

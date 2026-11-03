import test from 'node:test'
import assert from 'node:assert/strict'
import { createScenario, validateScenario, scenarioFrame, compareScenarios, serializeScenario, restoreScenario, SCENARIO_PHASES } from '../apps/web/js/enso-scenario.js'

const input = { location: { lon: -80.63, lat: -5.19, label: 'Piura' }, episodeId: '2017', assumptions: { rainfallMm: 120, durationHours: 24, soilCondition: 'humedo' } }
test('escenario determinista y exportación con supuestos explícitos', () => {
  const original = structuredClone(input)
  const s = createScenario(input)
  assert.deepEqual(input, original)
  assert.equal(s.calculated.rainfallMeanMmHour, 5)
  assert.equal(s.nature, 'escenario_hipotetico')
  assert.deepEqual(restoreScenario(serializeScenario(s)), s)
  assert.deepEqual(createScenario(input), s)
  assert.equal(s.provenance.method, 'Lluvia total supuesta / duración supuesta; sin modelo hidrológico calibrado.')
})
test('rechaza entradas no finitas, fuera de rango y estructuras desconocidas', () => {
  for (const value of [NaN, Infinity, -1, 10001, '120', null]) assert.throws(() => createScenario({ ...input, assumptions: { ...input.assumptions, rainfallMm: value } }))
  for (const value of [0, -1, 2161, '24']) assert.throws(() => createScenario({ ...input, assumptions: { ...input.assumptions, durationHours: value } }))
  assert.throws(() => createScenario({ ...input, assumptions: { ...input.assumptions, soilCondition: 'desconocido' } }))
  assert.throws(() => createScenario({ ...input, location: { lon: 181, lat: 0, label: 'x' } }))
  assert.throws(() => createScenario({ ...input, location: { lon: 0, lat: 91, label: 'x' } }))
  assert.throws(() => createScenario({ ...input, unknown: 1 }))
  assert.equal(validateScenario(createScenario(input)), true)
  assert.throws(() => validateScenario({ ...createScenario(input), schemaVersion: 2 }))
  assert.throws(() => validateScenario({ ...createScenario(input), calculated: { rainfallMeanMmHour: 999 } }))
  assert.throws(() => restoreScenario('{'))
  assert.throws(() => restoreScenario(JSON.stringify({ ...createScenario(input), damage: 5 })))
})
test('seis fases conceptuales sin predicción física ni tiempos de llegada', () => {
  const s = createScenario(input)
  assert.equal(SCENARIO_PHASES.length, 6)
  for (let i = 0; i < 6; i++) {
    const frame = scenarioFrame(s, i)
    assert.equal(frame.phase.id, SCENARIO_PHASES[i].id)
    assert.equal(frame.mode, 'conceptual')
    assert.equal(frame.hydrologicalOutput, null)
    assert.equal(frame.exposure, null)
  }
  assert.throws(() => scenarioFrame(s, -1))
  assert.throws(() => scenarioFrame(s, 6))
  assert.throws(() => scenarioFrame(s, 0.5))
})
test('comparación expresa solo diferencias entre supuestos', () => {
  const a = createScenario(input)
  const b = createScenario({ ...input, assumptions: { rainfallMm: 180, durationHours: 12, soilCondition: 'saturado' } })
  assert.deepEqual(compareScenarios(a, b), { rainfallMmDelta: 60, durationHoursDelta: -12, rainfallMeanMmHourDelta: 10, soilChanged: true, sameLocation: true, nature: 'comparacion_de_supuestos' })
})

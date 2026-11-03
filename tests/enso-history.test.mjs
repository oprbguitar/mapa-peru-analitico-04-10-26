import { test } from 'node:test'
import assert from 'node:assert/strict'
import { historyEvents, playbackDelay } from '../apps/web/js/enso-history.js'

test('filtra por mes publicado y territorio sin repartir registros agregados', () => {
  const rows = [[0,0,'rio','2017-01-02',0,0,0,0,0,0,0,0,'150101'],[0,0,'rio','2017-02-01',0,0,0,0,0,0,0,0,'15'],[0,0,'rio','2017-03-01',0,0,0,0,0,0,0,0,'150102']]
  assert.deepEqual(historyEvents(rows, { date: '2017-02', ubigeo: '150101' }), [rows[0]])
  assert.equal(historyEvents(rows, { date: '2017-02', ubigeo: '15' }).length, 2)
  assert.equal(rows.length, 3)
})
test('vista completa conserva fechas y respeta tipos ocultos', () => {
  const rows = [[0,0,'rio','2017-01-02'],[0,0,'lluvia','2017-03-01']]
  assert.deepEqual(historyEvents(rows, { hidden: new Set(['rio']) }), [rows[1]])
  assert.equal(historyEvents(rows, { date:'2017-02' }).length, 1)
  assert.equal(historyEvents(rows, { date:'incorrecta' }).length, 0)
})
test('velocidad narrativa válida y separada del reloj del fenómeno', () => {
  assert.equal(playbackDelay(1), 9000)
  assert.equal(playbackDelay(2), 4500)
  assert.throws(() => playbackDelay(0))
  assert.throws(() => playbackDelay(Infinity))
})

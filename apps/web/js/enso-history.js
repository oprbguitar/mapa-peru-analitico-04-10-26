// Filas del contrato /enso/events. La fecha y el UBIGEO publicados gobiernan el filtro.
export function historyEvents(rows, { date = null, ubigeo = null, hidden = new Set() } = {}) {
  const month = date?.slice(0, 7)
  if (date && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  return rows.filter((e) => !hidden.has(e[2]) &&
    (!month || (typeof e[3] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e[3]) && e[3].slice(0, 7) <= month)) &&
    (!ubigeo || (typeof e[12] === 'string' && e[12].startsWith(ubigeo))))
}

// Cadencia de lectura de capítulos, nunca tiempo de propagación hidrológica.
export function playbackDelay(speed) {
  if (![0.5, 1, 2, 4].includes(speed)) throw new RangeError('Velocidad de lectura no válida')
  return 9000 / speed
}

import { SCENARIO_PHASES, scenarioFrame } from './enso-scenario.js'
import { esc } from './util.js'

let active = null, timer = null
export function stopScenarioPlayer() {
  clearTimeout(timer)
  if (active) document.getElementById('story').hidden = true
  if (active) document.body.classList.remove('enso-timeline-on')
  active = null
}
export function startScenarioPlayer(scenario) {
  stopScenarioPlayer()
  active = { scenario, index: 0, playing: false }
  render()
}
function render() {
  clearTimeout(timer)
  if (!active) return
  const s = active, frame = scenarioFrame(s.scenario, s.index)
  const host = document.getElementById('story')
  host.hidden = false
  document.body.classList.add('enso-timeline-on')
  host.classList.add('enso-timeline')
  host.classList.remove('min')
  host.innerHTML = `<div class="story-head"><span class="when">Escenario conceptual · ${esc(s.scenario.location.label)}</span><button type="button" class="btn" data-sc="close" aria-label="Cerrar escenario">✕</button></div>
    <p class="src-meta">Secuencia explicativa sin reloj hidrológico. No representa un pronóstico ni una simulación calibrada.</p>
    <ol class="ev-list">${SCENARIO_PHASES.map((p, i) => `<li><button class="btn" type="button" data-phase="${i}" aria-current="${i === s.index}">${i + 1}. ${esc(p.label)}</button></li>`).join('')}</ol>
    <div class="ev-detail"><h3>${esc(frame.phase.label)}</h3><p>${esc(frame.phase.description)}</p></div>
    <p class="src-meta">Supuestos del usuario: ${esc(s.scenario.assumptions.rainfallMm)} mm / ${esc(s.scenario.assumptions.durationHours)} h · suelo ${esc(s.scenario.assumptions.soilCondition)}. Sin resultados territoriales calculados.</p>
    <div class="story-nav"><button class="btn" type="button" data-sc="prev" ${s.index === 0 ? 'disabled' : ''}>Anterior</button><button class="btn btn-primary" type="button" data-sc="play" aria-pressed="${s.playing}">${s.playing ? 'Pausar' : 'Recorrer fases'}</button><button class="btn" type="button" data-sc="next" ${s.index === 5 ? 'disabled' : ''}>Siguiente</button></div>`
  host.querySelectorAll('[data-phase]').forEach((b) => b.addEventListener('click', () => { s.index = Number(b.dataset.phase); render() }))
  host.querySelectorAll('[data-sc]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.sc === 'close') return stopScenarioPlayer()
    if (b.dataset.sc === 'play') { s.playing = !s.playing; if (s.index === 5) s.index = 0 }
    if (b.dataset.sc === 'prev') s.index = Math.max(0, s.index - 1)
    if (b.dataset.sc === 'next') s.index = Math.min(5, s.index + 1)
    render()
  }))
  if (s.playing) timer = setTimeout(() => { if (s.index < 5) s.index++; else s.playing = false; render() }, 6000)
}

// Genera las capturas de docs/GUIA-SIMULADOR.md recorriendo la app local real (no son maquetas).
// Uso: PLAYWRIGHT_MODULE=<ruta a playwright> node scripts/capturas_guia_simulador.mjs [http://127.0.0.1:8360]
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.argv[2] || 'http://127.0.0.1:8360'
const dir = fileURLToPath(new URL('../docs/img/simulador/', import.meta.url))
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const settled = () => page.waitForFunction(() => document.querySelector('.sim-score')?.dataset.busy === 'false', null, { timeout: 30000 })
const idle = () => page.evaluate(() => new Promise((r) => window.__piMap.once('idle', r)))

/** Resalta un elemento con un anillo y un globo numerado; sin selector, solo el globo en (x, y). */
async function mark(n, text, selector, at) {
  await page.evaluate(({ n, text, selector, at }) => {
    document.querySelectorAll('.guide-mark').forEach((e) => e.remove())
    const r = selector ? document.querySelector(selector).getBoundingClientRect() : { left: at[0] - 20, top: at[1] - 20, width: 40, height: 40 }
    const ring = Object.assign(document.createElement('div'), { className: 'guide-mark' })
    Object.assign(ring.style, { position: 'fixed', zIndex: 99, left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`,
      height: `${r.height + 12}px`, border: '3px solid #ffb547', borderRadius: '10px', pointerEvents: 'none', boxShadow: '0 0 0 4px rgba(255,181,71,.25)' })
    const tip = Object.assign(document.createElement('div'), { className: 'guide-mark', textContent: `${n}  ${text}` })
    const below = r.top < innerHeight / 2
    Object.assign(tip.style, { position: 'fixed', zIndex: 99, left: `${Math.min(Math.max(8, r.left), innerWidth - 380)}px`,
      top: below ? `${r.top + r.height + 14}px` : 'auto', bottom: below ? 'auto' : `${innerHeight - r.top + 14}px`, maxWidth: '360px',
      background: '#ffb547', color: '#101418', font: '700 15px/1.35 system-ui, sans-serif', padding: '8px 12px', borderRadius: '8px', pointerEvents: 'none' })
    document.body.append(ring, tip)
  }, { n, text, selector, at })
}
const shot = async (name) => { await page.screenshot({ path: dir + name }); await page.evaluate(() => document.querySelectorAll('.guide-mark').forEach((e) => e.remove())) }

try {
  await page.goto(base)
  await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
  await page.waitForFunction(() => !document.querySelector('[data-mode="simular"]').hidden)
  await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.07], zoom: 11, bearing: 0, pitch: 0 }))
  await idle()
  await mark('1', 'Pulsa SIMULAR en la barra de modos', '[data-mode="simular"]')
  await shot('01-boton-simular.png')

  await page.locator('[data-mode="simular"]').click()
  await page.waitForSelector('#sim-hud:not([hidden]) #sim-hint:not([hidden])')
  const box = await page.locator('#map').boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2 + 40
  await mark('2', 'Haz clic en cualquier punto del mapa: ahí se dibuja la zona', null, [cx, cy])
  await shot('02-clic-en-el-mapa.png')

  await page.mouse.click(cx, cy)
  await settled()
  await idle()
  await mark('3', 'Arrastra este punto para agrandar o achicar la zona (el centro la mueve)', '.sim-handle-edge')
  await shot('03-zona-y-radio.png')

  await page.waitForTimeout(600)   // deja caer la lluvia animada
  await mark('4', 'Lluvia intensa: la lluvia se ve dentro de la zona y el resultado aparece arriba', '.sim-score')
  await shot('04-resultado-lluvia.png')

  await mark('5', 'Toca otra ficha para cambiar el «¿qué pasa si…?»: se recalcula solo', '.sim-cards')
  await shot('05-fichas-escenario.png')

  await page.locator('[data-sim-preset="todo"]').click()
  await settled()
  await idle()
  await mark('6', 'Arrastra la cortina: a la izquierda HOY, a la derecha la HIPÓTESIS', '.sim-swipe-grip')
  await shot('06-cortina-hoy-hipotesis.png')

  await page.locator('[data-sim-view="delta"]').click()
  await idle()
  const site = await page.evaluate(() => {
    const f = window.__piMap.queryRenderedFeatures({ layers: ['sim-sites'] }).find((x) => x.properties.inside)
    if (!f) return null
    const p = window.__piMap.project(f.geometry.coordinates)
    return [p.x, p.y]
  })
  await mark('7', 'QUÉ CAMBIA pinta en rojo lo que empeora. Toca una sede (punto blanco) para cerrarla', null, site || [cx, cy])
  await shot('07-que-cambia-y-sedes.png')

  if (site) {
    await page.mouse.click(site[0], site[1])
    await settled()
  }
  if (await page.locator('[data-sim-engine="cap"]').isEnabled()) {
    await page.locator('[data-sim-engine="cap"]').click()
    await settled()
    await idle()
    await mark('8', 'CAPACIDAD: colas y sedes saturadas (verde, ámbar, rojo)', '[data-sim-engine="cap"]')
    await shot('08-capacidad.png')
    await page.locator('[data-sim-engine="acc"]').click()
    await settled()
  }
  await page.locator('#sim-data').click()
  await page.waitForSelector('#sim-data-panel table')
  await mark('9', 'VER CIFRAS abre el detalle verificable: tablas, supuestos, fuentes y ajustes', '#sim-data-panel')
  await shot('09-ver-cifras.png')
  console.log('Capturas en docs/img/simulador/')
} finally { await browser.close() }

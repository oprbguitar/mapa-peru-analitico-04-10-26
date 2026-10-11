// Capa «Eventos naturales» (NASA EONET): apagada al inicio, opt-in desde Capas, con naturaleza del dato en la ficha.
// Uso: PI_URL=http://127.0.0.1:8360 PLAYWRIGHT_MODULE=<ruta a playwright> node tests/e2e/natural-events.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PI_URL || 'http://127.0.0.1:8360'
const assert = (ok, label) => { if (!ok) throw new Error(label); console.log(`PASS ${label}`) }
mkdirSync('output/e2e', { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const [width, height] of [[1280, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    const requests = []
    const errors = []
    page.on('request', r => requests.push(r.url()))
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base)
    await page.waitForFunction(() => window.__piMap?.getLayer('eonet'), null, { timeout: 60000 })
    await page.waitForTimeout(1000)
    assert(!requests.some(u => u.includes('/intel/eonet')), `${width}px: EONET no se consulta al arrancar`)
    assert(await page.evaluate(() => window.__piMap.getLayoutProperty('eonet', 'visibility') === 'none'), `${width}px: capa apagada por defecto`)
    if (await page.locator('[data-expand="rail"]').isVisible()) await page.locator('[data-expand="rail"]').click()
    if (await page.locator('.tab[data-sheet="rail"]').isVisible()) {
      await page.locator('.tab[data-sheet="rail"]').click()
      await page.waitForTimeout(800) // la hoja de Capas termina de deslizarse
    }
    await page.locator('details[data-f="riesgos"] summary').click()
    const response = page.waitForResponse(r => r.url().includes('/api/v1/intel/eonet'), { timeout: 30000 })
    await page.locator('input[value="eonet"]').check()
    const body = await (await response).json()
    assert(body.provenance?.[0]?.source_id === 'nasa_eonet' && body.provenance[0].kind === 'vivo_tercero', `${width}px: respuesta con procedencia NASA EONET`)
    await page.waitForFunction(() => /^\d+/.test(document.querySelector('[data-live-meta="eonet"]')?.textContent || ''), null, { timeout: 60000 })
    const meta = await page.locator('[data-live-meta="eonet"]').textContent()
    assert(/^\d+/.test(meta), `${width}px: contador de eventos visible (${meta})`)
    if (width === 1280 && Number.parseInt(meta, 10) > 0) {
      const first = await page.evaluate(async () => (await window.__piMap.getSource('eonet').getData()).features[0].geometry.coordinates)
      await page.evaluate(c => window.__piMap.jumpTo({ center: c, zoom: 7 }), first)
      await page.waitForTimeout(1500)
      const point = await page.evaluate(c => { const p = window.__piMap.project(c); return { x: p.x, y: p.y } }, first)
      await page.mouse.click(point.x, point.y)
      await page.waitForSelector('.maplibregl-popup .kind[data-kind="vivo_tercero"]', { timeout: 10000 })
      const text = await page.locator('.maplibregl-popup').textContent()
      assert(/NASA EONET/.test(text) && /no es un registro oficial/.test(text), 'ficha declara fuente y que no es dato oficial')
      await page.screenshot({ path: 'output/e2e/eonet-1280.png' })
    }
    await page.locator('input[value="eonet"]').uncheck()
    await page.waitForFunction(() => window.__piMap.getLayoutProperty('eonet', 'visibility') === 'none')
    assert(true, `${width}px: se apaga desde Capas`)
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `${width}px: sin desbordamiento horizontal`)
    assert(errors.length === 0, `${width}px: sin errores de JS ${errors.join(' | ')}`)
    await page.close()
  }
} finally {
  await browser.close()
}

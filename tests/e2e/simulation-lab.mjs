// Laboratorio de simulación local: A/B con Monte Carlo, mapa coloreado, cierre manual de un servicio y registro.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
try {
  for (const [w, h] of [[1280, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
    await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
    await page.waitForFunction(() => !document.querySelector('[data-mode="simular"]').hidden)
    await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.07], zoom: 10.5 }))
    await page.locator('[data-mode="simular"]').click()
    await page.locator('#sim-center').click()
    await page.locator('#sim-form details summary').click()
    await page.locator('#sim-iter').selectOption('200')
    await page.locator('#sim-form [type="submit"]').click()
    await page.waitForSelector('#sim-out table', { timeout: 30000 })
    const text = await page.locator('#sim-out').innerText()
    assert.match(text, /B − A/)
    assert.match(text, /acc-[0-9a-f]{12}/)
    assert.ok(await page.evaluate(() => window.__piMap.getSource('sim-pts').serialize().data.features.length > 100), 'puntos de muestreo en el mapa')
    await page.locator('[data-sim-view="d"]').click()
    assert.equal(await page.locator('[data-sim-view="d"]').getAttribute('aria-pressed'), 'true')
    const kinds = await page.evaluate(() => [...new Set(window.__piMap.getSource('sim-pts').serialize().data.features.map((f) => f.properties.k))])
    assert.ok(kinds.every((k) => ['mejor', 'igual', 'peor', 'sin'].includes(k)), 'vista de cambio usa categorías de diferencia')
    await page.evaluate(() => new Promise((r) => window.__piMap.once('idle', r)))
    if (out) await page.screenshot({ path: `${out}/simulacion-${w}.png` })
    await page.locator('#sim-history summary').click()
    await page.waitForSelector('#sim-runs [data-run]')
    await page.locator('[data-mode="mapa"]').click()
    await page.waitForFunction(() => window.__piMap.getLayoutProperty('sim-pts', 'visibility') === 'none', null, { timeout: 5000 })
    assert.deepEqual(errors, [])
    console.log(`PASS laboratorio de simulación a ${w}px`)
    await page.close()
  }
} finally { await browser.close() }

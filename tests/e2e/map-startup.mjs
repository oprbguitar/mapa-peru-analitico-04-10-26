// Startup contract: render independently of analytical metadata; heavy sources are opt-in.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const base = process.env.PI_URL || 'http://127.0.0.1:8360'
const assert = (ok, label) => { if (!ok) throw new Error(label); console.log(`PASS ${label}`) }
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 1280, height: 900 } })
    const requests = []
    const errors = []
    page.on('request', r => requests.push(r.url()))
    page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = success => success({ coords: { longitude: -77.04, latitude: -12.04 } })
    })
    await page.route('**/ofm/styles/**', r => r.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#05080c' } }] } }))
    let releaseMetadata
    const metadataGate = new Promise(resolve => { releaseMetadata = resolve })
    await page.route('**/api/v1/intel/crime/families', async r => { await metadataGate; await r.continue() })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__piMap?.getLayer('departamentos-fill'))
    assert(true, 'Mapa preparado mientras los metadatos permanecen pendientes')
    await page.waitForTimeout(1500)
    assert(!requests.some(u => /\/geo\/|\/intel\/history|crime\/choropleth/.test(u)), 'Arranque sin fronteras ni estadísticas pesadas')
    assert(await page.evaluate(() => window.__piMap.getLayoutProperty('departamentos-fill', 'visibility') === 'none'), 'Mapa limpio sin denuncias')
    assert(await page.evaluate(() => Math.abs(window.__piMap.getCenter().lng + 77.04) < 0.01), 'Ubicación del navegador centrada')
    const bearing = await page.evaluate(() => window.__piMap.getBearing())
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => window.__piMap.getBearing())
    assert(reducedMotion === 'reduce' ? after === bearing : after !== bearing, `Giro respeta ${reducedMotion}`)
    await page.locator('#map').dispatchEvent('mousedown')
    const stopped = await page.evaluate(() => window.__piMap.getBearing())
    await page.waitForTimeout(300)
    assert(await page.evaluate(b => window.__piMap.getBearing() === b, stopped), 'Interacción detiene el giro')
    await page.locator('[data-mode="satelite"]').click()
    await page.waitForSelector('#img-search')
    assert(true, 'Satélite disponible sin esperar metadatos estadísticos')
    releaseMetadata()
    assert(!errors.length, `Sin errores JavaScript: ${errors.join('; ')}`)
    await page.close()
  }
} finally { await browser.close() }

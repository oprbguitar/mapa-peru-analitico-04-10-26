// Same browser UI with deterministic provider fixtures, plus real provider probes separately.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PI_URL || 'http://127.0.0.1:8362'
const output = 'output/territorial'
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const failures = []
const check = (name, result) => { console.log(`${result ? 'PASS' : 'FAIL'} ${name}`); if (!result) failures.push(name) }
try {
  for (const width of [360, 768, 1280, 1600]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base)
    await page.waitForFunction(() => window.__piMap?.isStyleLoaded(), null, { timeout: 60000 })
    await page.waitForSelector('#layer-title h2', { timeout: 60000 })
    await page.locator('[data-mode="satelite"]').click()
    await page.waitForSelector('#img-search')
    check(`${width}px Satélite disponible`, await page.locator('#img-search').isVisible())
    check(`${width}px sin desbordamiento`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `${output}/satellite-${width}.png` })
    await page.locator('[data-mode="vuelos"]').click()
    await page.waitForSelector('#panel-body select')
    check(`${width}px Vuelos 3D disponible`, /Reconstrucción/.test(await page.locator('#panel-body').textContent()))
    await page.locator('[data-mode="calle"]').click()
    await page.waitForFunction(() => document.querySelector('#panel-body')?.textContent.includes('Mapillary'))
    check(`${width}px Calle disponible`, /Mapillary/.test(await page.locator('#panel-body').textContent()))
    check(`${width}px sin errores JS`, !errors.length)
    if (width === 1280) {
      page.on('request', request => { if (request.url().includes('/layers/telecom')) console.log('OSM request', request.url()) })
      await page.locator('[data-mode="mapa"]').click()
      await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.05, -12.05], zoom: 12 }))
      await page.locator('details[data-f="infra"] summary').click()
      // Deterministic OSM fixture proves map rendering and style restoration independently of Overpass uptime.
      await page.route('**/api/v1/intel/layers/telecom?*', route => route.fulfill({ json: { available: true,
        items: [{ lon: -77.05, lat: -12.05, cat: 'mobile', categories: ['mobile'], nombre: 'Fixture antena', osm_type: 'node', osm_id: '1', operador: 'Operador fixture', tecnologias: ['4G'], osm_timestamp: '2026-01-01T00:00:00Z' }], provenance: [] } }))
      await page.locator('input[value="telecom:mobile"]').check()
      await page.waitForFunction(() => window.__piMap.querySourceFeatures('pl-telecom-osm').length > 0).catch(async error => {
        console.log(await page.evaluate(() => ({ source: window.__piMap.getSource('pl-telecom-osm')?.serialize(), meta: document.querySelector('[data-live-meta="telecom:mobile"]')?.textContent })))
        throw error
      })
      check('Antena dibujada', await page.evaluate(() => window.__piMap.queryRenderedFeatures({ layers: ['pl-telecom-osm'] }).length > 0).catch(() => false))
      await page.evaluate(async () => { const m = await import('/js/map.js'); await m.setBase('satelite') })
      await page.waitForFunction(() => window.__piMap.querySourceFeatures('pl-telecom-osm').length > 0)
      check('Antena conservada al cambiar base', true)
      await page.route('**/api/v1/flights/history?*', route => route.fulfill({ json: { items: [{ hex: 'abc123', count: 3 }] } }))
      const now = Math.floor(Date.now() / 1000)
      await page.route('**/api/v1/flights/history/abc123?*', route => route.fulfill({ json: { available: true,
        points: [{ t: now-200, lat: -12.05, lon: -77.05, altitude_m: 3000 }, { t: now-100, lat: -12.04, lon: -77.04, altitude_m: 4000 }, { t: now, lat: -12.03, lon: -77.03, altitude_m: 4500 }] } }))
      await page.locator('[data-mode="vuelos"]').click()
      await page.getByRole('button', { name: 'Buscar vuelos guardados' }).click()
      await page.getByRole('combobox', { name: 'Trayectoria ADS-B disponible' }).selectOption('abc123')
      await page.waitForFunction(() => !!window.__piMap.getLayer('flight-replay-3d'))
      await page.getByRole('button', { name: 'Reproducir', exact: true }).click()
      await page.waitForTimeout(1000)
      check('Vuelo 3D reproduce fixture sin errores', !errors.length && /barométricos/.test(await page.locator('#panel-body').textContent()))
      await page.screenshot({ path: `${output}/flight-3d.png` })
    }
    check(`${width}px errores finales`, !errors.length)
    if (errors.length) console.log(errors.join('\n'))
    await page.close()
  }
} finally { await browser.close() }
if (failures.length) process.exitCode = 1

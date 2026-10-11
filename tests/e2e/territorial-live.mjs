// Real providers, no intercepted requests. Run separately from deterministic UI tests.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PI_URL || 'http://127.0.0.1:8362'
mkdirSync('output/territorial', { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base)
  await page.waitForFunction(() => window.__piMap?.isStyleLoaded(), null, { timeout: 60000 })
  await page.waitForSelector('#layer-title h2', { timeout: 60000 })
  await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.05, -12.05], zoom: 14 }))
  await page.locator('[data-mode="satelite"]').click()
  await page.locator('#img-rectangle').click()
  for (const coordinate of [[-77.055, -12.055], [-77.045, -12.045]]) {
    const point = await page.evaluate(coordinate => { const p = window.__piMap.project(coordinate); return { x: p.x, y: p.y } }, coordinate)
    await page.mouse.click(point.x, point.y)
  }
  await page.locator('#img-start').fill('2026-09-20')
  await page.locator('#img-end').fill('2026-10-11')
  await page.locator('#img-search').click()
  await page.waitForSelector('[data-img-side="a"]', { timeout: 60000 })
  await page.locator('[data-img-side="a"]').first().click()
  await page.locator('[data-img-side="b"]').nth(1).click()
  await page.locator('#img-opacity').fill('70')
  await page.waitForFunction(() => window.__piMap.querySourceFeatures('imagery-aoi').length > 0)
  console.log('PASS actual acquisition A/B', await page.locator('#img-date-a').textContent(), await page.locator('#img-date-b').textContent())
  if (!process.env.PI_SKIP_CROP) {
    const downloadEvent = page.waitForEvent('download', { timeout: 90000 })
    await page.locator('[data-img-download="a"]').click()
    const download = await downloadEvent.catch(async error => { console.log(await page.locator('#img-status').textContent()); throw error })
    await download.saveAs('output/territorial/sentinel2-live.tif')
    console.log('PASS real downloaded GeoTIFF', download.suggestedFilename())
  }
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'output/territorial/imagery-live.png' })
  if (!process.env.PI_SKIP_OSM) {
  await page.locator('details[data-f="infra"] summary').click()
  await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.05, -12.05], zoom: 12 }))
  await page.locator('input[value="telecom:mobile"]').check()
  await page.locator('input[value="telecom:antenna"]').check()
  await page.locator('input[value="telecom:tower"]').check()
  const antennas = await page.waitForFunction(() => window.__piMap.querySourceFeatures('pl-telecom-osm').length > 0, null, { timeout: 70000 }).then(() => true, () => false)
  console.log(antennas ? 'PASS real antenna points alongside satellite' : 'DEGRADED Overpass provider', await page.locator('[data-live-meta="telecom:mobile"]').textContent())
  await page.screenshot({ path: 'output/territorial/imagery-telecom-live.png' })
  }
  await page.locator('details[data-f="ambiente"] summary').click()
  await page.locator('input[value="wxfx"]').check()
  await page.waitForFunction(() => !!window.__piMap.getLayer('observed-clouds-raster'), null, { timeout: 60000 })
  console.log('PASS real NOAA cloud layer', await page.locator('[data-live-meta="wxfx"]').textContent())
  await page.locator('[data-mode="vuelos"]').click()
  await page.getByRole('button', { name: 'Buscar vuelos guardados' }).click()
  await page.waitForFunction(() => document.querySelector('[aria-label="Trayectoria ADS-B disponible"]')?.options.length > 1, null, { timeout: 20000 })
  const options = await page.getByRole('combobox', { name: 'Trayectoria ADS-B disponible' }).evaluate(select => [...select.options].map(option => ({ value: option.value, text: option.textContent })))
  const flight = options.find(option => option.value && Number(option.text.match(/· (\d+)/)?.[1]) >= 2)
  if (!flight) throw new Error('Sin trayectoria real disponible para verificar')
  await page.getByRole('combobox', { name: 'Trayectoria ADS-B disponible' }).selectOption(flight.value)
  await page.waitForFunction(() => !!window.__piMap.getLayer('flight-replay-3d'))
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click()
  await page.waitForTimeout(1500)
  console.log('PASS real ADS-B stored trajectory', flight.text)
  await page.screenshot({ path: 'output/territorial/flight-real.png' })
  if (errors.length) throw new Error(errors.join('\n'))
  console.log('PASS no JavaScript errors')
} finally { await browser.close() }

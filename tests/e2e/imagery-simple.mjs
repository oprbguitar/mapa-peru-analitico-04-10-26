import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  let queries = []
  await page.route('**/api/v1/imagery/search?*', route => {
    queries.push(new URL(route.request().url()))
    return route.fulfill({ json: { items: ['2026-10-06', '2026-09-26'].map((date, i) => ({ id: `scene-${i}`, acquired_at: `${date}T15:26:00Z`, resolution_m: 10, cloud_percent: 6, bbox: [-77.5,-12.5,-76.5,-11.5], tile_url: `/fixture/${i}/{z}/{x}/{y}.png` })) } })
  })
  await page.route('**/fixture/**', route => route.fulfill({ status: 204 }))
  await page.goto(process.env.PI_URL || 'http://127.0.0.1:8362')
  await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
  await page.locator('[data-mode="satelite"]').click()
  assert.equal(await page.locator('#img-advanced').getAttribute('open'), null)
  // vista nacional: se busca en un recuadro central acotado, nunca en todo el país
  await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.05,-12.05], zoom: 5 }))
  await page.locator('#img-search').click()
  await page.waitForFunction(() => document.querySelector('#img-select-a')?.options.length === 3)
  assert.equal(queries.length, 1)
  const g = JSON.parse(queries[0].searchParams.get('geometry')).coordinates[0]
  assert.ok(Math.abs(g[1][0] - g[0][0]) <= 0.31, 'oversized view must fall back to a small central box')
  assert.equal(await page.locator('#img-select-a').inputValue(), 'scene-0')
  const bounds = await page.evaluate(() => window.__piMap.getSource('imagery-a').serialize().bounds)
  assert.ok(bounds[0] > -77.5 && bounds[1] > -12.5 && bounds[2] < -76.5 && bounds[3] < -11.5,
    'raster requests must stay within the selected area, not the full scene')
  assert.equal(await page.locator('#img-select-b').inputValue(), '')
  await page.locator('#img-select-b').selectOption('scene-1')
  assert.equal(await page.evaluate(() => !!window.__piMap.getLayer('imagery-b')), true)
  await page.locator('#img-advanced summary').click()
  await page.locator('#img-clear').click()
  assert.equal(await page.evaluate(() => !!window.__piMap.getLayer('imagery-a')), false)
  assert.equal(await page.locator('#img-select-a').inputValue(), '')
  console.log('PASS compact imagery flow, area validation, automatic scene and comparison')
} finally { await browser.close() }

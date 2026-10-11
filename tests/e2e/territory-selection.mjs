// A searched territory remains visible while thematic data are turned off.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__piMap?.getLayer('departamentos-fill'))
  assert.equal(await page.locator('input[name="thematic"]:checked').count(), 0)
  await page.locator('#search').fill('Lima')
  await page.waitForSelector('#search-results li[data-u]')
  await page.locator('#search-results li[data-u]').first().click()
  await page.waitForFunction(() => window.__piMap.queryRenderedFeatures({ layers: ['departamentos-focus'] }).length > 0)
  assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('departamentos-fill', 'visibility')), 'none')
  await page.evaluate(async () => { (await import('/js/map.js')).setSelected(null) })
  assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('departamentos-focus', 'visibility')), 'none')
  console.log('PASS searched outline without thematic fill; clear removes outline')
} finally { await browser.close() }

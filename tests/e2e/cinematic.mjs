// Recorrido 3D cinematográfico: prefabricado, tomas, vista previa y grabación de video descargada en la PC.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { statSync, copyFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
  await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
  await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.05], zoom: 13, pitch: 0, bearing: 0 }))
  await page.locator('#btn-cine').click()
  await page.waitForSelector('.cine-panel:not([hidden])')
  await page.locator('[data-cine="add"]').click()
  assert.equal(await page.locator('.cine-shots li[data-shot]').count(), 1)
  await page.locator('[data-cine="orbit"]').click()   // el prefabricado reemplaza las tomas
  assert.equal(await page.locator('.cine-shots li[data-shot]').count(), 5)
  // tomas cortas para la prueba
  await page.evaluate(() => document.querySelectorAll('.cine-shots [data-dur], .cine-shots [data-hold]').forEach((i) => { i.value = '0.5'; i.dispatchEvent(new Event('change', { bubbles: true })) }))
  const b0 = await page.evaluate(() => window.__piMap.getBearing())
  await page.locator('[data-cine="play"]').click()
  await page.waitForFunction(() => !document.querySelector('[data-cine="stop"]'), null, { timeout: 20000 })
  assert.ok(await page.evaluate(() => window.__piMap.getPitch()) >= 55, 'la órbita inclina la cámara')
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('[data-cine="rec"]').click()])
  const name = dl.suggestedFilename()
  assert.match(name, /^recorrido-.*\.(mp4|webm)$/)
  const file = await dl.path()
  const size = statSync(file).size
  assert.ok(size > 20_000, `video con contenido (${size} bytes)`)
  if (out) copyFileSync(file, `${out}/${name}`)
  const [js] = await Promise.all([page.waitForEvent('download'), page.locator('[data-cine="script"]').click()])
  assert.match(js.suggestedFilename(), /^guion-recorrido-\d+\.json$/)
  assert.deepEqual(errors, [])
  console.log(`PASS recorrido 3D: ${name} · ${(size / 1024).toFixed(0)} KB · bearing inicial ${b0.toFixed(0)}`)
} finally { await browser.close() }

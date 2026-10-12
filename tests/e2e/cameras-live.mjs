// Cámaras (§7) sin equipo: la lista de verificación se rellena sola y el visor funciona con la señal SIMULADA
// (rotulada). No abre canales reales para no conectarse al grabador del usuario durante la prueba.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
try {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
    await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
    await page.evaluate(() => document.getElementById('open-cameras').click())
    await page.waitForSelector('#cameras-dialog[open] .cam-check li', { timeout: 20000 })
    const steps = await page.locator('.cam-check li').count()
    assert.equal(steps, 7, 'siete pasos de verificación')
    assert.match(await page.locator('.cam-check').innerText(), /go2rtc/)
    await page.locator('#cam-sim').click()
    await page.waitForSelector('#cam-viewer:not([hidden]) .cam-cell[data-mode="simulado"]')
    assert.equal(await page.locator('.cam-cell[data-mode="simulado"]').count(), 4)
    await page.waitForFunction(() => [...document.querySelectorAll('#cam-viewer video')].every((v) => v.readyState >= 2), null, { timeout: 10000 })
    assert.match(await page.locator('#cam-viewer').innerText(), /SIMULADO/)
    assert.match(await page.locator('#cam-viewer .cam-viewer-head').innerText(), /no es video real/)
    // la ventana se arrastra desde la cabecera
    const head = page.locator('.cam-viewer-head')
    const b0 = await page.locator('#cam-viewer').boundingBox()
    const hb = await head.boundingBox()
    await page.mouse.move(hb.x + 20, hb.y + 8)
    await page.mouse.down()
    await page.mouse.move(hb.x - 60, hb.y + 40, { steps: 5 })
    await page.mouse.up()
    const b1 = await page.locator('#cam-viewer').boundingBox()
    assert.ok(Math.abs(b1.x - b0.x) > 20 || Math.abs(b1.y - b0.y) > 20, 'ventana flotante movible')
    if (out) await page.screenshot({ path: `${out}/camaras-simulado-${w}.png` })
    await page.locator('#cv-close').click()
    assert.equal(await page.locator('#cam-viewer').isHidden(), true)
    assert.deepEqual(errors, [])
    console.log(`PASS cámaras: verificación y visor simulado a ${w}px`)
    await page.close()
  }
} finally { await browser.close() }

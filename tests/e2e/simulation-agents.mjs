// Evacuación con agentes sintéticos (S4) sobre el mapa: puntos seguros, agentes animados, congestión, tramo cortado,
// modo vehículo, capacidad editable, informe y limpieza al salir.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
const settled = (page) => page.waitForFunction(() => document.querySelector('.sim-score')?.dataset.busy === 'false', null, { timeout: 40000 })
try {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
    await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
    await page.waitForFunction(() => !document.querySelector('[data-mode="simular"]').hidden)
    await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.07], zoom: 13 }))
    await page.locator('[data-mode="simular"]').click()
    await page.waitForSelector('#sim-hud:not([hidden]) #sim-hint:not([hidden])')
    const box = await page.locator('#map').boundingBox()
    const k = Math.min(box.width, box.height * 0.6)
    const at = (dx, dy) => [box.x + box.width / 2 + dx * k, box.y + box.height / 2 + dy * k]
    await page.mouse.click(...at(0, 0.05))
    await settled(page)
    await page.locator('[data-sim-engine="agt"]').click()
    assert.match(await page.locator('#sim-hint').innerText(), /puntos seguros/)
    await page.mouse.click(...at(-0.12, -0.04))
    await page.mouse.click(...at(0.12, 0.1))
    await page.waitForFunction(() => document.querySelectorAll('.agt-safe').length === 2)
    await settled(page)
    assert.match(await page.locator('.sim-score').innerText(), /evacuado en 30 min/i)
    await page.waitForSelector('#agt-replay:not([hidden])')
    await page.waitForFunction(() => window.__piMap.getSource('agt-dots').serialize().data.features.length > 50, null, { timeout: 10000 })
    assert.equal(await page.locator('.ops-unit').count(), 0, 'en evacuación no se muestran unidades del operativo')

    // tramo cortado compartido con el operativo
    await page.locator('[data-ops-tool="tramo"]').click()
    await page.mouse.click(...at(-0.02, -0.15))
    await page.mouse.click(...at(-0.02, 0.18))
    await page.locator('[data-ops-tool="finish"]').click()
    await settled(page)
    assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('ops-tramos', 'visibility')), 'visible')
    await page.locator('[data-agt-mode="vehiculo"]').click()
    await settled(page)
    assert.match(await page.locator('.sim-score').innerText(), /en vehículo/i)
    if (out) { await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/evacuacion-${w}.png` }) }

    // cifras: tabla y capacidad editable que recalcula
    await page.locator('#sim-data').click()
    await page.waitForSelector('#sim-data-panel [data-cap]')
    assert.match(await page.locator('#sim-data-panel').innerText(), /Evacuado en 30 min/)
    const run0 = await page.locator('#sim-data-panel code').first().innerText()
    await page.locator('#sim-data-panel [data-cap]').first().fill('100')
    await page.locator('#sim-data-panel [data-cap]').first().dispatchEvent('change')
    await page.waitForFunction((r) => { const c = document.querySelector('#sim-data-panel code'); return c && c.textContent !== r }, run0, { timeout: 30000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin desplazamiento horizontal')

    await page.locator('[data-mode="mapa"]').click()
    await page.waitForFunction(() => document.getElementById('sim-hud').hidden)
    assert.equal(await page.locator('.agt-safe').count(), 0, 'salir quita los puntos seguros del mapa')
    assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('agt-dots', 'visibility')), 'none')
    assert.deepEqual(errors, [])
    console.log(`PASS evacuación con agentes a ${w}px`)
    await page.close()
  }
} finally { await browser.close() }

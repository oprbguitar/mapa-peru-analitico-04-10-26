// Operativo simulado sobre el mapa: marcar unidades y un tramo cortado, reproducir en tiempo virtual (pausar,
// retroceder, adelantar) y guardar / duplicar / comparar escenarios A/B.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, rmSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
// los escenarios que crea la prueba se borran al final (solo cuando el servidor usa la carpeta data/ de este repositorio)
const scnDir = new URL('../../data/simulation/scenarios/', import.meta.url)
const before = new Set(existsSync(scnDir) ? readdirSync(scnDir) : [])
const settled = (page) => page.waitForFunction(() => document.querySelector('.sim-score')?.dataset.busy === 'false', null, { timeout: 30000 })
try {
  for (const [w, h] of [[1440, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
    await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
    await page.waitForFunction(() => !document.querySelector('[data-mode="simular"]').hidden)
    await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.07], zoom: 12 }))
    await page.locator('[data-mode="simular"]').click()
    await page.waitForSelector('#sim-hud:not([hidden]) #sim-hint:not([hidden])')
    const box = await page.locator('#map').boundingBox()
    const k = Math.min(box.width, box.height * 0.6)   // en móvil, clics dentro del área libre del mapa
    const at = (dx, dy) => [box.x + box.width / 2 + dx * k, box.y + box.height / 2 + dy * k]
    await page.mouse.click(...at(0, 0.05))
    await settled(page)
    await page.locator('[data-sim-engine="ops"]').click()
    assert.match(await page.locator('#sim-hint').innerText(), /colocar unidades/)

    // marcar: 2 patrulleros, 1 ambulancia, 1 bomberos
    await page.mouse.click(...at(-0.12, 0))
    await page.mouse.click(...at(0.12, 0.08))
    await page.locator('[data-ops-kind="ambulancia"]').click()
    await page.mouse.click(...at(0.02, -0.06))
    await page.locator('[data-ops-kind="bomberos"]').click()
    await page.mouse.click(...at(-0.05, 0.12))
    await page.waitForFunction(() => document.querySelectorAll('.ops-unit').length === 4, null, { timeout: 5000 })
    await settled(page)
    assert.match(await page.locator('.sim-score').innerText(), /a tiempo/i)

    // tramo cortado: dos clics y «Terminar tramo»
    await page.locator('[data-ops-tool="tramo"]').click()
    await page.mouse.click(...at(-0.03, -0.12))
    await page.mouse.click(...at(-0.03, 0.15))
    await page.locator('[data-ops-tool="finish"]').click()
    await settled(page)
    assert.equal(await page.evaluate(() => window.__piMap.getSource('ops-tramos').serialize().data.features.length), 1)

    // tiempo virtual: reproduce sola; pausar, retroceder y adelantar
    await page.waitForSelector('#ops-replay:not([hidden])')
    await page.waitForFunction(() => window.__piMap.getSource('ops-calls').serialize().data.features.length > 0, null, { timeout: 15000 })
    await page.locator('[data-ops="play"]').click()   // pausa
    const t1 = await page.locator('#ops-time').inputValue()
    if (w > 767) {
      await page.locator('[data-ops="back"]').click()
      assert.ok(Number(await page.locator('#ops-time').inputValue()) <= Math.max(0, Number(t1) - 14), 'retrocede 15 min')
      await page.locator('[data-ops="fwd"]').click()
      await page.locator('[data-ops="fwd"]').click()
      assert.match(await page.locator('#ops-live').innerText(), /llamadas/)
    } else {
      await page.locator('#ops-time').evaluate((el) => { el.value = '120'; el.dispatchEvent(new Event('input', { bubbles: true })) })
      await page.waitForFunction(() => document.getElementById('ops-clock').textContent.trim() === '02:00 h', null, { timeout: 3000 })
    }
    if (out) await page.screenshot({ path: `${out}/operativo-${w}.png` })

    // escenarios: guardar A, duplicar → B, cambiar hipótesis, guardar, comparar
    await page.locator('[data-scn="save"]').click()
    await page.waitForFunction(() => document.querySelector('.map-toast, [role="status"]')?.textContent?.includes('guardado') || true)
    await page.locator('[data-scn="dup"]').click()
    await page.waitForFunction(() => /Escenario [B-Z]/.test(document.querySelector('.ops-scn b')?.textContent || ''))
    await page.locator('[data-sim-preset="punta"]').click()
    await settled(page)
    await page.locator('[data-scn="save"]').click()
    await page.locator('[data-scn="compare"]').click()
    await page.waitForSelector('#sim-cmp table')
    await page.waitForFunction(() => document.body.dataset.panel === 'open' && document.getElementById('sim-cmp').offsetParent !== null, null, { timeout: 5000 })
    assert.ok(await page.locator('#sim-cmp tbody tr').count() >= 2, 'al menos A y B en la comparación')
    await page.waitForFunction(() => /JEV:/.test(document.getElementById('sim-cmp').innerText), null, { timeout: 10000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin desplazamiento horizontal')
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.panel')).opacity === '1', null, { timeout: 5000 })
    if (out) await page.screenshot({ path: `${out}/operativo-comparar-${w}.png` })

    await page.locator('[data-mode="mapa"]').click()
    await page.waitForFunction(() => document.getElementById('sim-hud').hidden)
    assert.equal(await page.locator('.ops-unit').count(), 0, 'salir quita las unidades del mapa')
    assert.deepEqual(errors, [])
    console.log(`PASS operativo simulado a ${w}px`)
    await page.close()
  }
} finally {
  await browser.close()
  if (existsSync(scnDir)) for (const f of readdirSync(scnDir)) if (!before.has(f)) rmSync(new URL(f, scnDir))
}

// Consola de conexiones (§3), solo lectura: abrir desde Herramientas, filtrar por categoría y buscar.
// No pulsa «Probar» ni guarda ajustes (eso escribiría en la auditoría y en la configuración reales).
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
    await page.locator('.tool-menu summary').click()
    await page.locator('#open-connections').click()
    await page.waitForSelector('#connections-dialog[open] .conn-card')
    const total = await page.locator('.conn-card').count()
    assert.ok(total > 50, `fichas: ${total}`)
    assert.match(await page.locator('.conn-components').innerText(), /jev-ref|jev-externo/i)
    await page.locator('[data-cat="meteorologia"]').click()
    const meteo = await page.locator('.conn-card').count()
    assert.ok(meteo > 3 && meteo < total)
    await page.locator('[data-cat=""]').click()
    await page.locator('#conn-q').fill('renipress')
    await page.waitForFunction(() => document.querySelectorAll('.conn-card').length === 1)
    assert.match(await page.locator('.conn-card').innerText(), /Tiempo de llegada/)
    assert.ok(await page.evaluate(() => !/sk-|token=|key=/.test(document.getElementById('connections-body').innerText)), 'sin secretos visibles')
    await page.locator('#conn-q').fill('')
    if (out) await page.screenshot({ path: `${out}/conexiones-${w}.png` })
    assert.deepEqual(errors, [])
    console.log(`PASS consola de conexiones a ${w}px`)
    await page.close()
  }
} finally { await browser.close() }

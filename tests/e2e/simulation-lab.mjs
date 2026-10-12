// Laboratorio de simulación local, todo sobre el mapa: clic → zona → resultado automático; escenarios de un toque,
// cortina hoy ⟷ hipótesis, cierre de sedes tocándolas, capacidad (S3) y cifras solo a pedido.
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
const score = (page) => page.locator('.sim-score')
const rainInk = (page) => page.evaluate(() => {
  const c = document.querySelector('.sim-rain')
  if (c.hidden) return 0
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0
  for (let i = 3; i < d.length; i += 4) if (d[i]) n++
  return n
})
const settled = (page) => page.waitForFunction(() => document.querySelector('.sim-score')?.dataset.busy === 'false', null, { timeout: 30000 })
try {
  for (const [w, h] of [[1280, 900], [360, 780]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
    await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
    await page.waitForFunction(() => !document.querySelector('[data-mode="simular"]').hidden)
    await page.evaluate(() => window.__piMap.jumpTo({ center: [-77.03, -12.07], zoom: 11 }))
    await page.locator('[data-mode="simular"]').click()
    await page.waitForSelector('#sim-hud:not([hidden]) #sim-hint:not([hidden])')
    assert.notEqual(await page.evaluate(() => document.body.dataset.panel), 'open', 'el panel lateral no se abre al simular')

    // 1 · clic en el mapa: zona + simulación automática con el escenario por defecto (lluvia)
    const box = await page.locator('#map').boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await settled(page)
    assert.match(await score(page).innerText(), /≤ 15 min/i)
    assert.equal(await page.locator('#sim-hint').isHidden(), true)
    assert.ok(await page.evaluate(() => window.__piMap.getSource('sim-cells').serialize().data.features.length > 100), 'mosaico de tiempos')
    assert.ok(await page.evaluate(() => window.__piMap.getSource('sim-sites').serialize().data.features.length > 0), 'sedes visibles sin pedirlas')
    assert.equal(await page.locator('.sim-swipe').isVisible(), true, 'cortina hoy ⟷ hipótesis')
    assert.equal(await page.locator('.sim-rain').getAttribute('data-level'), 'intensa', 'la lluvia de la hipótesis se ve en la zona')
    await page.waitForSelector('.sim-score .sim-jev', { timeout: 10000 })
    assert.match(await page.locator('.sim-jev').innerText(), /JEV .*variabilidad/i, 'consejo JEV en el marcador')

    // 2 · imprevistos combinables: activar hora punta SUMA a la lluvia; apagar la lluvia la quita del mapa
    await page.locator('[data-sim-preset="punta"]').click()
    await settled(page)
    assert.match(await score(page).innerText(), /Lluvia intensa \+ Hora punta/i)
    assert.equal(await page.locator('[data-sim-preset="lluvia"]').getAttribute('aria-pressed'), 'true')
    await page.locator('[data-sim-preset="lluvia"]').click()
    await settled(page)
    assert.equal(await page.locator('[data-sim-preset="lluvia"]').getAttribute('aria-pressed'), 'false')
    assert.match(await score(page).innerText(), /Hora punta/i)
    await page.locator('[data-sim-preset="todos"]').click()
    await settled(page)
    assert.equal(await page.locator('.sim-cards [aria-pressed="false"]').count(), 0, '«Todos» activa todas las fichas')
    await page.locator('[data-sim-preset="todos"]').click()
    await settled(page)
    assert.match(await score(page).innerText(), /sin imprevistos/i)
    await page.locator('[data-sim-preset="punta"]').click()
    await settled(page)
    assert.equal(await page.locator('.sim-rain').getAttribute('data-level'), 'ninguna')
    assert.equal(await rainInk(page), 0, 'sin lluvia en hora punta')

    // 3 · cortina con teclado cambia el corte; vista «qué cambia»
    const before = await page.evaluate(() => JSON.stringify(window.__piMap.getFilter('sim-cells-a')))
    await page.locator('.sim-swipe').focus()
    await page.keyboard.press('ArrowLeft')
    assert.notEqual(await page.evaluate(() => JSON.stringify(window.__piMap.getFilter('sim-cells-a'))), before)
    await page.locator('[data-sim-view="delta"]').click()
    assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('sim-cells-d', 'visibility')), 'visible')
    assert.equal(await page.locator('.sim-swipe').isVisible(), false)

    // 4 · radio con teclado sobre el asa del borde → recalcula
    await page.locator('.sim-handle-edge').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page)
    assert.match(await page.locator('.sim-handle-edge').getAttribute('data-km'), /km/)
    if (out) {
      await page.evaluate(() => new Promise((r) => window.__piMap.once('idle', r)))
      await page.screenshot({ path: `${out}/simulacion-${w}.png` })
    }

    // 5 · capacidad (S3) si SimPy está instalado
    if (await page.locator('[data-sim-engine="cap"]').isEnabled()) {
      await page.locator('[data-sim-engine="cap"]').click()
      await settled(page)
      assert.match(await score(page).innerText(), /Atendidas en ≤ 30 min/i)
      const util = await page.evaluate(() => window.__piMap.getSource('sim-sites').serialize().data.features.map((f) => f.properties.util))
      assert.ok(util.length > 0 && util.every((u) => /ocupada|cerrada/.test(u)), 'sedes coloreadas por utilización')
      assert.equal(await rainInk(page), 0, 'sin lluvia dibujada en capacidad con hora punta')
      if (out) await page.screenshot({ path: `${out}/capacidad-${w}.png` })
      await page.locator('[data-sim-engine="acc"]').click()
      await settled(page)
    }

    // 6 · cifras solo a pedido
    await page.locator('#sim-data').click()
    await page.waitForSelector('#sim-data-panel table')
    assert.match(await page.locator('#sim-data-panel').innerText(), /acc-[0-9a-f]{12}/)
    assert.match(await page.locator('#sim-data-panel').innerText(), /no es una probabilidad/i, 'JEV declara que su puntuación no es probabilidad')
    // avisos: la campana abre el centro con tipos diferenciados
    await page.locator('#open-notify').click()
    await page.waitForSelector('#notify-panel:not([hidden]) .notify-head')
    assert.match(await page.locator('#notify-panel').innerText(), /Resultado predictivo|Actividad|Sin avisos/i)
    await page.keyboard.press('Escape')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sin desplazamiento horizontal')

    // 7 · salir deja el mapa limpio
    await page.locator('[data-mode="mapa"]').click()
    await page.waitForFunction(() => document.getElementById('sim-hud').hidden)
    assert.equal(await page.evaluate(() => window.__piMap.getLayoutProperty('sim-cells-a', 'visibility')), 'none')
    assert.equal(await page.locator('.sim-handle').count(), 0, 'sin asas de zona fuera del modo')
    assert.deepEqual(errors, [])
    console.log(`PASS simulación sobre el mapa a ${w}px`)
    await page.close()
  }
} finally { await browser.close() }

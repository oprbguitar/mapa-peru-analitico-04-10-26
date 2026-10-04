// Prueba de humo E2E (Playwright, headless): carga, choropleth, ficha, capas en vivo y responsive.
// Uso: PI_URL=http://127.0.0.1:8360 PLAYWRIGHT_MODULE=<ruta a playwright> node tests/e2e/smoke.mjs [carpeta-capturas]
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const URL = process.env.PI_URL || 'http://127.0.0.1:8360/'
const OUT = process.argv[2] || 'output/e2e'
mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }) // WebGL por software en headless
try {
  for (const [w, h, scheme] of [[1280, 800, 'light'], [1600, 900, 'dark'], [768, 1024, 'light'], [360, 780, 'light']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(URL)
    await page.waitForFunction(() => document.querySelector('#layer-title h2'), null, { timeout: 30000 })
    await page.waitForTimeout(2500)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    check(`${w}px sin desbordamiento horizontal`, !overflow)
    check(`${w}px sin errores de JS`, errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: `${OUT}/home-${w}.png` })
    if (w === 1280) {
      const painted = await page.evaluate(() => window.__piMap.queryRenderedFeatures({ layers: ['departamentos-fill'] }).length)
      check('choropleth departamental dibujado', painted > 0, `${painted} polígonos`)
      await page.fill('#search', 'Cusco')
      await page.waitForSelector('#search-results li[data-u="08"]')
      await page.click('#search-results li[data-u="08"]')
      await page.waitForSelector('#ai-run', { timeout: 30000 })
      const txt = await page.textContent('#panel-body')
      check('ficha de Cusco con tríada y fuentes', /Absoluto/.test(txt) && /Tasa/.test(txt) && /Fuentes de esta ficha/i.test(txt))
      await page.screenshot({ path: `${OUT}/ficha-cusco-${w}.png` })
      await page.click('.level-switch button[data-lv="distrito"]')
      await page.waitForTimeout(3000)
      const dist = await page.evaluate(() => window.__piMap.queryRenderedFeatures({ layers: ['distritos-fill'] }).length)
      check('nivel distrital dibujado', dist > 0, `${dist} polígonos`)
      await page.click('input[name="thematic"][value="victim"]')
      await page.waitForTimeout(2500)
      const distBtn = await page.$eval('.level-switch button[data-lv="distrito"]', (b) => b.disabled)
      check('victimización no se ofrece a nivel distrital', distBtn)
      for (const f of ['ambiente', 'infra', 'espacio']) await page.click(`details.family[data-f="${f}"] > summary`)
      for (const id of ['seismic', 'satellites', 'ports', 'datacenters', 'weather']) await page.click(`input[data-live][value="${id}"]`)
      await page.waitForTimeout(12000)
      const counts = await page.evaluate(() => Object.fromEntries(['seismic', 'satellites', 'ports', 'datacenters', 'weather']
        .map((id) => [id, document.querySelector(`[data-live-meta="${id}"]`)?.textContent || ''])))
      check('capas en vivo con datos', ['seismic', 'satellites', 'ports', 'datacenters'].every((id) => parseInt(counts[id], 10) > 0) && counts.weather,
        JSON.stringify(counts))
      await page.screenshot({ path: `${OUT}/vivo-${w}.png` })
      await page.click('input[name="thematic"][value="sidpol"]')
      await page.waitForTimeout(2000)
      await page.click('button[data-p="5a"]')
      await page.waitForTimeout(2500)
      const t = await page.textContent('#layer-title')
      check('ventana 5 años compara contra 5 años antes', /2020/.test(t), t.trim())
      await page.click('#open-sources')
      await page.waitForSelector('.src-table')
      check('registro de fuentes visible', (await page.$$('.src-table tbody tr')).length > 15)
      await page.screenshot({ path: `${OUT}/fuentes-${w}.png` })
    }
    if (w === 360) {
      await page.click('.tab[data-sheet="rail"]')
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}/movil-capas.png` })
      await page.click('.tab[data-sheet="map"]')
    }
    await page.close()
  }
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`)
process.exit(failed.length ? 1 : 0)

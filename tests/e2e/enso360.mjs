import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']})
const assert = (ok,label) => { if(!ok) throw Error(label); console.log('PASS '+label) }
mkdirSync('output/e2e', {recursive:true})
try {
 for (const width of [360,768,1280,1600]) {
  const page = await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'})
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360/')
  await page.waitForFunction(()=>window.__piMap?.loaded(),null,{timeout:90000})
  await page.locator('[data-mode="ninio"]').click({force:true})
  await page.waitForSelector('.enso-workspace',{state:'attached'})
  // Las hojas móviles se abren mediante su control público.
  if (!(await page.locator('.enso-workspace').isVisible())) await page.locator('.tab[data-sheet="panel"]').click()
  await page.locator('.ew-pilots summary').click()
  await page.locator('[data-ew-pilot="4"]').click()
  await page.locator('[data-ew-tab="scenario"]').click()
  await page.locator('[name="rainfallMm"]').fill('120')
  await page.locator('#ew-form button[type="submit"]').click()
  await page.waitForSelector('[data-sc="next"]',{state:'attached'})
  assert((await page.locator('#story').textContent()).includes('Escenario conceptual'),`${width}: fases conceptuales`)
  await page.locator('[data-ew="save"]').click()
  await page.locator('[data-ew="baseline"]').click()
  await page.locator('[name="rainfallMm"]').fill('160')
  await page.locator('#ew-form button[type="submit"]').click()
  await page.locator('[data-ew="compare"]').click()
  assert((await page.locator('.ew-comparison').textContent()).includes('160'),`${width}: comparar A/B`)
  const download=page.waitForEvent('download'); await page.locator('[data-ew="export"]').click(); const file=await download
  assert(file.suggestedFilename().endsWith('.json'),`${width}: exportación JSON`)
  await page.locator('[data-ew="restore"]').click()
  assert(await page.locator('[name="rainfallMm"]').inputValue()==='120',`${width}: restaurar guardado`)
  await page.screenshot({path:`output/e2e/enso360-scenario-${width}.png`})
  await page.locator('[data-ew-tab="history"]').click()
  await page.locator('#ew-episode').selectOption('2017')
  await page.locator('[data-ew="story"]').click()
  await page.waitForSelector('#st-speed',{state:'attached'})
  await page.locator('#st-speed').selectOption('2')
  await page.locator('#st-date').fill('1'); await page.locator('#st-date').dispatchEvent('change')
  await page.waitForFunction(()=>document.querySelector('#story')?.textContent.includes('Registros acumulados'))
  assert((await page.locator('#story').textContent()).includes('2017'),`${width}: episodio histórico`)
  await page.locator('#st-episode').selectOption('1982-83')
  await page.waitForFunction(()=>document.querySelector('#story')?.textContent.includes('1982'))
  assert(await page.evaluate(async()=>{
    const x=await import('/js/enso-explain.js');
    x.syncHistoricalDate('1982-07');
    return !window.__piMap.getSource('ex-ssta') && await x.probeExplain({lng:-81,lat:-5})===false
  }),`${width}: sin imágenes actuales sobre 1982`)
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`${width}: sin overflow`)
  if (await page.locator('.tab[data-sheet="map"]').isVisible()) await page.locator('.tab[data-sheet="map"]').click()
  await page.screenshot({path:`output/e2e/enso360-history-${width}.png`})
  await page.locator('[data-mode="mapa"]').click({force:true})
  assert(await page.locator('.ew-map-pin').count()===0 && await page.locator('#story').isHidden(),`${width}: salida limpia al mapa`)
  assert(errors.length===0,`${width}: sin errores JS: ${errors.join('|')}`)
  await page.close()
 }
} finally { await browser.close() }


// Edición municipal: configurar (nombre, distrito, logo), marca visible, perfil con fuentes, kit sin precios y arranque
// en el distrito. Borra la configuración al final (no deja la instalación del usuario con una marca de prueba).
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const brandDir = new URL('../../data/branding/', import.meta.url)
assert.ok(!existsSync(new URL('municipal.json', brandDir)), 'ya existe una edición municipal real: no se ejecuta la prueba para no tocarla')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(process.env.PI_URL || 'http://127.0.0.1:8360')
  await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
  await page.locator('.tool-menu summary').click()
  await page.locator('#open-municipal').click()
  await page.waitForSelector('#municipal-dialog[open] #muni-form')
  await page.locator('#muni-form [name="name"]').fill('Municipalidad Distrital de Miraflores')
  await page.locator('#muni-search').fill('Miraflores')
  await page.waitForSelector('#muni-results [data-ub="150122"]')
  await page.locator('#muni-results [data-ub="150122"]').click()
  await page.locator('#muni-form [name="responsable"]').fill('Gerencia de Seguridad Ciudadana')
  await page.locator('#muni-logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  await page.locator('#muni-form [type="submit"]').click()
  await page.waitForSelector('.brand .muni-tag')
  assert.match(await page.locator('.brand .muni-tag').getAttribute('title'), /Miraflores/)
  await page.waitForSelector('#muni-profile table')
  assert.match(await page.locator('#muni-profile').innerText(), /Población|Denuncias|Hospitales/)
  assert.match(await page.locator('#muni-profile').innerText(), /Fuentes:/)
  const [kit] = await Promise.all([page.context().waitForEvent('page'), page.locator('#muni-kit').click()])
  await kit.waitForFunction(() => document.body?.innerText.includes('Propuesta'), null, { timeout: 30000 })
  const txt = await kit.locator('body').innerText()
  assert.match(txt, /Municipalidad Distrital de Miraflores/)
  assert.match(txt, /A definir/)
  assert.doesNotMatch(txt, /S\/\s?\d|US\$\s?\d/, 'el kit no inventa precios')
  assert.equal(await kit.locator('header img').count(), 1, 'logo en el kit')
  if (out) await kit.screenshot({ path: `${out}/kit-municipal.png`, fullPage: true })
  await kit.close()
  // al recargar, el mapa arranca en el distrito
  await page.reload()
  await page.waitForFunction(() => window.__piMap?.getStyle()?.layers?.length)
  await page.waitForFunction(() => { const c = window.__piMap.getCenter(); return c.lng > -77.07 && c.lng < -76.99 && c.lat > -12.15 && c.lat < -12.09 }, null, { timeout: 15000 })
  assert.deepEqual(errors, [])
  console.log('PASS edición municipal: marca, perfil con fuentes, kit sin precios y arranque en el distrito')
} finally {
  await browser.close()
  rmSync(brandDir, { recursive: true, force: true })
}

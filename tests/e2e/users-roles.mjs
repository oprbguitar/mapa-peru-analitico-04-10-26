// Usuarios y roles (§8) contra un servidor AISLADO (PI_DATA_DIR temporal): nunca crear usuarios en los datos reales.
// Uso: PI_DATA_DIR=<carpeta vacía> python -m peru_intel serve --port 8362 ; PI_URL=http://127.0.0.1:8362 node tests/e2e/users-roles.mjs
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PI_URL || 'http://127.0.0.1:8362'
assert.ok(!/:8360/.test(base), 'usa un servidor aislado, no el de los datos reales')
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const out = process.argv[2]
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(base)
  await page.waitForSelector('#open-user:not([hidden])')
  assert.match(await page.locator('#open-user').innerText(), /uso personal/i, 'sin usuarios: uso personal, sin inicio de sesión')

  // 1 · activar usuarios: primer administrador → sesión iniciada
  await page.locator('#open-user').click()
  await page.locator('[data-u-view="users"]').click()
  await page.locator('#nu-name').fill('Ana Admin')
  await page.locator('#nu-pin').fill('2468')
  await page.locator('#first-admin [type="submit"]').click()
  await page.waitForFunction(() => /Ana Admin/i.test(document.getElementById('open-user')?.textContent || ''))

  // 2 · el administrador crea un coordinador y un participante
  await page.locator('#open-user').click()
  await page.locator('[data-u-view="users"]').click()
  for (const [name, role, pin] of [['Beto Coord', 'coordinador', '1357'], ['Cira Part', 'participante', '9753']]) {
    await page.locator('#nu-name').fill(name)
    await page.locator('#nu-role').selectOption(role)
    await page.locator('#nu-pin').fill(pin)
    await page.locator('#new-user [type="submit"]').click()
    await page.waitForFunction((n) => document.querySelector('.user-body')?.textContent.includes(n), name)
  }

  // 3 · asignar una actividad a la participante
  await page.locator('[data-u-view="activities"]').click()
  await page.locator('#act-title').fill('Revisar el escenario B del operativo')
  await page.locator('#act-assignee').selectOption({ label: 'Cira Part' })
  await page.locator('#act-form [type="submit"]').click()
  await page.waitForFunction(() => document.querySelector('.act-list')?.textContent.includes('Revisar el escenario B'))
  if (out) await page.screenshot({ path: `${out}/usuarios-admin.png` })

  // 4 · otra sesión sin cookie: pantalla de inicio de sesión; la API exige sesión
  const anon = await browser.newPage()
  await anon.goto(base)
  await anon.waitForSelector('#login-screen:not([hidden]) #login-form')
  assert.equal(await anon.evaluate(async () => (await fetch('/api/v1/sim/engines')).status), 401)
  await anon.locator('#login-name').fill('Cira Part')
  await anon.locator('#login-pin').fill('0000')
  await anon.locator('#login-form [type="submit"]').click()
  await anon.waitForSelector('#login-error:not([hidden])')
  await anon.locator('#login-pin').fill('9753')
  await anon.locator('#login-form [type="submit"]').click()
  await anon.waitForFunction(() => /Cira Part/i.test(document.getElementById('open-user')?.textContent || ''))

  // 5 · vista restringida: sin Simular, sin claves; solo su actividad, que puede actualizar
  assert.equal(await anon.locator('[data-mode="simular"]').isVisible(), false)
  assert.equal(await anon.evaluate(async () => (await (await fetch('/api/v1/sim/engines')).json()).local), false)
  assert.equal(await anon.evaluate(async () => (await fetch('/api/v1/sim/accessibility/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status), 403)
  await anon.locator('#open-user').click()
  await anon.waitForSelector('.act-list')
  assert.equal(await anon.locator('.act-item').count(), 1)
  await anon.locator('.act-item [data-st="en_curso"]').click()
  await anon.waitForFunction(() => document.querySelector('.act-item')?.dataset.status === 'en_curso')
  if (out) await anon.screenshot({ path: `${out}/usuarios-participante.png` })

  // 6 · cerrar sesión vuelve a pedir inicio
  await anon.locator('[data-u-view="menu"]').click()
  await anon.locator('[data-u="logout"]').click()
  await anon.waitForSelector('#login-screen:not([hidden])')
  assert.deepEqual(errors, [])
  console.log('PASS usuarios, roles, actividades y sesión')
} finally { await browser.close() }

/**
 * Browser tests for "Copy as R code": the R button, shown when MiRA is opened
 * from R by ggmira, opens the ggmira code for the current view (js/rCode.js,
 * js/rCodePanel.js).
 *
 * The R server is faked with page.route, as in viewSpec.spec.js.
 * Dataset: pilosof2017 — 6 bipartite layers, state attribute module.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const NETWORK = readFileSync(new URL('../../data/pilosof2017.json', import.meta.url), 'utf8')
const MIRA_CALL = 'mira(net, bipartite = TRUE, setA_type = "parasite")'
const NODE_COLOR = 'rgb(217, 119, 6)'        // #d97706, ggmira mira_options()
const INTERLAYER_COLOR = 'rgb(30, 64, 175)'  // #1e40af

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => {
    if (!d.message().startsWith('Data warnings:')) errors.push(`dialog: ${d.message()}`)
    d.dismiss()
  })
  await page.setViewportSize({ width: 1200, height: 800 })
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

/** Open MiRA as print() does; `spec` null = no view spec (404, as plot_multilayer()). */
async function openFromR(page, spec) {
  await page.route('**/api/network.json', route =>
    route.fulfill({ contentType: 'application/json', body: NETWORK }))
  await page.route('**/api/view.json', route => spec === null
    ? route.fulfill({ status: 404, body: '' })
    : route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, ...spec }) }))
  await page.goto('/?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
}

async function openCode(page) {
  await page.locator('#copyRCodeBtn').click()
  return page.locator('#rCodePanel pre').innerText()
}

const SPEC = {
  r: { mira: MIRA_CALL },
  layout: { type: 'fruchterman', seed: 4 },
  node: { color_by: 'module', size: 12 },
  interlayer: { show: true },
  camera: { rotate: 30, zoom: 1.2 },
  legend: { show: ['node_color'] },
}

test('the R button: only for plots from ggmira, not on the website or from plot_multilayer()', async ({ page, context }) => {
  await openFromR(page, SPEC)
  await expect(page.locator('#copyRCodeBtn')).toBeVisible()

  const multilayer = await context.newPage()
  multilayer.on('pageerror', e => errors.push(e.message))
  await openFromR(multilayer, null)
  await expect(multilayer.locator('#copyRCodeBtn')).toBeHidden()

  const site = await context.newPage()
  await site.goto('/')
  await site.waitForTimeout(1000)
  await expect(site.locator('#copyRCodeBtn')).toBeHidden()
})

test('the code of the plot as R opened it, colored by element', async ({ page }) => {
  await openFromR(page, SPEC)
  expect(await openCode(page)).toBe([
    `${MIRA_CALL} +`,
    '  mira_layout("fruchterman", seed = 4) +',
    '  mira_node(color_by = "module", size = 12) +',
    '  mira_interlayer(show = TRUE) +',
    '  mira_camera(rotate = 30, zoom = 1.2) +',
    '  mira_legends(show = "node_color")',
  ].join('\n'))
  const colorOf = (element) => page.locator(`#rCodePanel pre span[data-element="${element}"]`)
    .evaluate(span => getComputedStyle(span).color)
  expect(await colorOf('node')).toBe(NODE_COLOR)
  expect(await colorOf('interlayer')).toBe(INTERLAYER_COLOR)
})

test('settings changed in MiRA are in the code', async ({ page }) => {
  await openFromR(page, SPEC)
  await page.locator('#nodeSizeSlider').evaluate(el => {
    el.value = '20'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.locator('#toggleLegendBtn').click()
  expect(await openCode(page)).toContain('  mira_node(color_by = "module", size = 20) +')
  expect(await page.locator('#rCodePanel pre').innerText()).toContain('  mira_legends(show = FALSE)')
})

test('a layout recomputed in MiRA: no seed, and a note', async ({ page }) => {
  await openFromR(page, SPEC)
  await page.locator('#layoutSelect').evaluate(el => {
    el.value = 'circle'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(500)
  const code = await openCode(page)
  expect(code).toContain('  mira_layout("circle") +')
  expect(code).toContain('# Not in this code (R cannot set it):\n# - The layout was recomputed in MiRA without a seed')
})

test('Copy puts the code and the notes on the clipboard; Escape closes the panel', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFromR(page, SPEC)
  // dragged legends cannot be reproduced: a note
  await page.locator('#legendPanel').evaluate(el => { Object.assign(el.style, { left: '300px', top: '200px', right: 'auto', bottom: 'auto' }) })
  const shown = await openCode(page)
  await page.locator('#rCodePanel .r-code-copy').click()
  await expect(page.locator('#rCodePanel .r-code-copy')).toHaveText('Copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied.startsWith(`${MIRA_CALL} +\n`)).toBe(true)
  expect(copied).toContain('# - The legends were dragged')
  expect(copied.trim()).toBe(shown.trim())
  await page.keyboard.press('Escape')
  await expect(page.locator('#rCodePanel')).toHaveCount(0)
})

test('the meta-network view, with its selected layers', async ({ page }) => {
  await openFromR(page, { r: { mira: MIRA_CALL }, mode: { view: 'meta', aggregation: 'weights' } })
  await page.locator('#mnLayerList li').first().click()
  const layer = await page.locator('#mnLayerList li').first().getAttribute('data-layer-name')
  expect(await openCode(page)).toBe(`${MIRA_CALL} +\n  mira_mode_meta(aggregation = "weights", layers = "${layer}")`)
})

test('plot_mira(): no settings, only the mira() call; changes made in MiRA become components', async ({ page }) => {
  const call = 'mira(net, bipartite = TRUE, directed = TRUE)'
  await openFromR(page, { r: { mira: call } })
  expect(await openCode(page)).toBe(call)
  await page.keyboard.press('Escape')
  await page.locator('#nodeSizeSlider').evaluate(el => {
    el.value = '20'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(await openCode(page)).toBe(`${call} +\n  mira_node(size = 20)`)
})

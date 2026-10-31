/**
 * Browser tests for ggmira view specs: MiRA opened from R with plot settings.
 *
 * The R server is faked with page.route: /api/network.json serves a demo
 * dataset, /api/view.json serves the spec under test (or 404, as
 * plot_multilayer() does). The page is opened with ?autoload=true, like R.
 *
 * Dataset: pilosof2017 — 6 bipartite layers, sets parasite (A) / host (B),
 * state attributes module + abundance, interlayer links.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const NETWORK = readFileSync(new URL('../../data/pilosof2017.json', import.meta.url), 'utf8')
const NOT_SERVED = null
const PARASITE = 'Parasitus_consanguineus'
const HOST = 'Myodes_rufocanus'

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => {
    if (!d.message().startsWith('Data warnings:')) errors.push(`dialog: ${d.message()}`)
    d.dismiss()
  })
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

// ── helpers ──────────────────────────────────────────────────────────────────

/** Open MiRA the way R does, with `spec` (object, raw string, or NOT_SERVED). */
async function openFromR(page, spec) {
  await page.route('**/api/network.json', route =>
    route.fulfill({ contentType: 'application/json', body: NETWORK }))
  await page.route('**/api/view.json', route => {
    if (spec === NOT_SERVED) return route.fulfill({ status: 404, body: 'Not Found' })
    const body = typeof spec === 'string' ? spec : JSON.stringify(spec)
    return route.fulfill({ contentType: 'application/json', body })
  })
  await page.goto('/?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
}

const view = (body) => ({ version: 1, ...body })

async function appState(page) {
  return page.evaluate(() => {
    const r = window._renderer
    const val = id => document.getElementById(id).value
    const pressed = id => document.getElementById(id).getAttribute('aria-pressed') === 'true'
    return {
      layoutSelect: val('layoutSelect'),
      rendererLayout: r.layoutType,
      nodeColorSelect: val('nodeColorSelect'),
      nodeColorSelectSetA: val('nodeColorSelectSetA'),
      nodeColorSelectSetB: val('nodeColorSelectSetB'),
      nodeSizeSelect: val('nodeSizeSelect'),
      colorSplit: pressed('nodeColorSplitToggle'),
      sizeSplit: pressed('nodeSizeSplitToggle'),
      shapeSplit: pressed('nodeShapeSplitToggle'),
      nodeRadius: r.nodeRadius,
      showInterlayerLinks: r.showInterlayerLinks,
      showInterlayerChecked: document.getElementById('showInterlayerCheckbox').checked,
      defaultInterColor: r.defaultInterColor,
      intraMinWeight: r.intraMinWeight,
    }
  })
}

async function shapeOf(page, nodeName) {
  return page.evaluate(name => {
    const r = window._renderer
    const layer = r.model.stateNodes.find(sn => sn.node_name === name).layer_name
    return r.nodeShapeFn ? r.nodeShapeFn(layer, name) : 'circle'
  }, nodeName)
}

async function positionsOf(page) {
  return page.evaluate(() => JSON.stringify(
    [...window._renderer.positions].map(([layer, nodes]) =>
      [layer, [...nodes].map(([name, p]) => [name, Math.round(p.x * 1e6), Math.round(p.y * 1e6)])])))
}

async function noticeMessages(page) {
  const notice = page.locator('#viewSpecNotice')
  if (await notice.count() === 0) return null
  return notice.locator('li').allTextContents()
}

// ── tests ────────────────────────────────────────────────────────────────────

test('without a view spec, MiRA loads exactly as before', async ({ page }) => {
  await openFromR(page, NOT_SERVED)
  const s = await appState(page)
  expect(s.layoutSelect).toBe('bipartite')
  expect(s.rendererLayout).toBe('bipartite')
  expect(s.nodeColorSelect).toBe('set:membership')
  expect(s.colorSplit).toBe(false)
  expect(await noticeMessages(page)).toBeNull()
})

test('per-set color, shared size and per-set shapes are applied', async ({ page }) => {
  await openFromR(page, view({
    node: {
      color_by: { parasite: 'module', host: 'abundance' },
      size_by: 'abundance',
      shape: { parasite: 'square', host: 'circle' },
    },
  }))
  const s = await appState(page)
  expect(s.colorSplit).toBe(true)
  expect(s.nodeColorSelectSetA).toBe('state:module')
  expect(s.nodeColorSelectSetB).toBe('state:abundance')
  expect(s.sizeSplit).toBe(false)
  expect(s.nodeSizeSelect).toBe('state:abundance')
  expect(s.shapeSplit).toBe(true)
  expect(await shapeOf(page, PARASITE)).toBe('square')
  expect(await shapeOf(page, HOST)).toBe('circle')
  expect(await noticeMessages(page)).toBeNull()
})

test('per-set color without shapes splits shapes automatically', async ({ page }) => {
  await openFromR(page, view({ node: { color_by: { parasite: 'module', host: 'module' } } }))
  expect((await appState(page)).shapeSplit).toBe(true)
  expect(await shapeOf(page, PARASITE)).toBe('circle')
  expect(await shapeOf(page, HOST)).toBe('square')
})

test('a seeded layout gives identical positions on every load', async ({ page, browser }) => {
  const spec = view({ layout: { type: 'kamada_kawai', seed: 42 } })
  await openFromR(page, spec)
  const s = await appState(page)
  expect(s.layoutSelect).toBe('kamada_kawai')
  expect(s.rendererLayout).toBe('kamada_kawai') // not drawn as bipartite
  const first = await positionsOf(page)

  const again = await browser.newPage()
  await openFromR(again, spec)
  expect(await positionsOf(again)).toBe(first)

  const other = await browser.newPage()
  await openFromR(other, view({ layout: { type: 'kamada_kawai', seed: 7 } }))
  expect(await positionsOf(other)).not.toBe(first)
})

test('links: interlayer shown with a constant color, intralayer weight filter', async ({ page }) => {
  await openFromR(page, view({
    interlayer: { show: true, color: '#ff0000' },
    intralayer: { min_weight: 0.1 },
  }))
  const s = await appState(page)
  expect(s.showInterlayerLinks).toBe(true)
  expect(s.showInterlayerChecked).toBe(true)
  expect(s.defaultInterColor).toBe('#ff0000')
  expect(s.intraMinWeight).toBe(0.1)
})

test('a constant node color replaces the default set coloring', async ({ page }) => {
  await openFromR(page, view({ node: { color: '#123456' } }))
  expect((await appState(page)).nodeColorSelect).toBe('')
  const color = await page.evaluate(n => {
    const r = window._renderer
    const sn = r.model.stateNodes.find(s => s.node_name === n)
    return r.nodeColorFn(sn.layer_name, n)
  }, HOST)
  expect(color.toLowerCase()).toBe('#123456')
})

test('invalid fields are listed in a notice; valid fields still apply', async ({ page }) => {
  await openFromR(page, view({
    node: { color_by: 'modul', size: 14 },
    scales: { module: { type: 'discrete' } },
  }))
  expect((await appState(page)).nodeRadius).toBe(14)
  expect(await noticeMessages(page)).toEqual([
    'node.color_by: "modul" is not an available attribute',
    'scales: not a known section; ignored',
  ])
  await page.click('.view-spec-notice-close')
  expect(await noticeMessages(page)).toBeNull()
})

test('a view spec that is not valid JSON leaves the default view', async ({ page }) => {
  await openFromR(page, '{ not json')
  expect((await appState(page)).layoutSelect).toBe('bipartite')
  expect(await noticeMessages(page)).toEqual(['view spec: not valid JSON'])
})

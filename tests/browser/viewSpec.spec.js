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
    theme: { font: 'serif' },
  }))
  expect((await appState(page)).nodeRadius).toBe(14)
  expect(await noticeMessages(page)).toEqual([
    'node.color_by: "modul" is not an available attribute',
    'theme: not a known section; ignored',
  ])
  await page.click('.view-spec-notice-close')
  expect(await noticeMessages(page)).toBeNull()
})

test('a view spec that is not valid JSON leaves the default view', async ({ page }) => {
  await openFromR(page, '{ not json')
  expect((await appState(page)).layoutSelect).toBe('bipartite')
  expect(await noticeMessages(page)).toEqual(['view spec: not valid JSON'])
})

test('stage 1: labels, layer display, layer colors, pairs and scales are applied', async ({ page }) => {
  await openFromR(page, NOT_SERVED)
  const defaultScale = await page.evaluate(() => window._renderer.scale)

  const again = await page.context().newPage()
  again.on('pageerror', e => errors.push(e.message))
  await openFromR(again, view({
    node: { color_by: 'module', labels: true, label_size: 16, perspective: false },
    layer: {
      color_by: '.individual', colors: { 1983: '#ff0000' },
      labels: true, label_size: 20, set_labels: true, stack: 'vertical', spacing: 450,
    },
    intralayer: { arrow_size: 2 },
    interlayer: { show: true, curvature: 0.8, pairs: [['1982', '1983']] },
    scales: { module: { type: 'categorical', values: { 3: '#00ff00' } } },
  }))
  expect(await noticeMessages(again)).toBeNull()

  const s = await again.evaluate(() => {
    const r = window._renderer
    const val = id => document.getElementById(id).value
    const checked = id => document.getElementById(id).checked
    const layerIndex = r.model.layers.findIndex(l => l.layer_name === '1983')
    const sn = r.model.stateNodes.find(n => n.module === 3)
    return {
      showLabels: r.showLabels, labelsChecked: checked('showLabelsCheckbox'),
      labelFont: r.labelFont, labelSize: val('labelSizeSlider'),
      transformNodes: r.transformNodes, transformChecked: checked('transformNodesCheckbox'),
      showLayerNames: r.showLayerNames, layerNameFontSize: r.layerNameFontSize,
      showSetNames: r.showSetNames, stackMode: r.stackMode, layerSpacing: r.layerSpacing,
      verticalActive: document.getElementById('stackVerticalBtn').classList.contains('active'),
      arrowheadSize: r.arrowheadSize, interArrowSlider: val('interArrowheadSizeSlider'),
      curvature: r.interlayerCurvature, curvatureSlider: val('interlayerCurvatureSlider'),
      pairs: r.interlayerLayerPairs ? [...r.interlayerLayerPairs].sort() : null,
      layerColorSelect: val('layerColorSelect'),
      layer1983: r.layerColorFn(layerIndex, r.model.layers[layerIndex]).text,
      module3: r.nodeColorFn(sn.layer_name, sn.node_name).toLowerCase(),
      scale: r.scale,
    }
  })
  expect(s).toMatchObject({
    showLabels: true, labelsChecked: true, labelFont: '16px Inter, system-ui, sans-serif', labelSize: '16',
    transformNodes: false, transformChecked: false,
    showLayerNames: true, layerNameFontSize: 20, showSetNames: true,
    stackMode: 'vertical', layerSpacing: 450, verticalActive: true,
    arrowheadSize: 2, interArrowSlider: '2', curvature: 0.8, curvatureSlider: '0.8',
    pairs: ['1982::1983', '1983::1982'],
    layerColorSelect: '__individual__', layer1983: '#ff0000', module3: '#00ff00',
  })
  expect(s.scale).not.toBe(defaultScale) // recentered for the new stacking and spacing
})

test('stage 2: the filter keeps only the listed nodes and links, with the banner', async ({ page }) => {
  // At 1280 px the Feedback button covers the banner's Clear button (a MiRA
  // layout bug, backlog item 33), so use a wider window
  await page.setViewportSize({ width: 1400, height: 900 })
  await openFromR(page, view({
    filter: {
      nodes: [PARASITE, HOST, 'Not_a_node'],
      links: [['1982', HOST, '1982', PARASITE]],
    },
  }))
  expect(await noticeMessages(page)).toEqual(['filter.nodes[2]: "Not_a_node" is not a node name'])
  const banner = page.locator('#dataFilterBanner')
  await expect(banner).toBeVisible()
  await expect(page.locator('#dataFilterText')).toContainText('2 nodes, 1 links visible')

  // Clearing from the banner restores the full network
  await page.locator('#dataFilterClear').click()
  await expect(banner).toBeHidden()
})

test('stage 3: camera, legends and highlight are applied', async ({ page }) => {
  await openFromR(page, NOT_SERVED)
  const fitted = await page.evaluate(() => window._renderer.scale)

  const again = await page.context().newPage()
  again.on('pageerror', e => errors.push(e.message))
  await openFromR(again, view({
    node: { color_by: 'module', size_by: 'abundance', highlight: PARASITE },
    camera: { rotate: 90, tilt: 20, zoom: 2 },
    legend: { show: ['node_color'], position: 'top-right' },
  }))
  expect(await noticeMessages(again)).toBeNull()
  const s = await again.evaluate(() => {
    const r = window._renderer
    const panel = document.getElementById('legendPanel')
    return {
      skewX: r.skewX, skewY: r.skewY, scale: r.scale,
      selected: r.selectedNode?.nodeName ?? null,
      banner: document.getElementById('selectedNodeText').innerText,
      boxes: [...panel.querySelectorAll('.legend-box')].map(b => b.innerText.split('\n')[0]),
      collapsed: [...panel.querySelectorAll('button.btn')].map(b => b.innerText.trim()),
      top: panel.style.top, bottom: panel.style.bottom,
    }
  })
  expect(s.skewX).toBeCloseTo(Math.PI / 2)
  expect(s.skewY).toBeCloseTo(20 * Math.PI / 180)
  expect(s.selected).toBe('Parasitus_consanguineus')
  expect(s.banner).toContain('Parasitus_consanguineus')
  expect(s.boxes).toHaveLength(1)
  expect(s.boxes[0]).toMatch(/node color/i)
  expect(s.collapsed.some(t => /node size/i.test(t))).toBe(true)
  expect(s).toMatchObject({ top: '50px', bottom: '' })
  // zoom 2 of a fit made for the new angles; not the default fit
  expect(s.scale).not.toBeCloseTo(fitted)
})

test('stage 3: legends start minimized; show = false hides the panel', async ({ page }) => {
  await openFromR(page, view({ node: { color_by: 'module' } }))
  expect(await page.locator('#legendPanel .legend-box').count()).toBe(0)
  await expect(page.locator('#legendPanel')).toBeVisible()

  const again = await page.context().newPage()
  again.on('pageerror', e => errors.push(e.message))
  await openFromR(again, view({ node: { color_by: 'module' }, legend: { show: false } }))
  await expect(again.locator('#legendPanel')).toBeHidden()
  await again.locator('#toggleLegendBtn').click() // MiRA's own toggle brings it back
  await expect(again.locator('#legendPanel')).toBeVisible()
})

test('camera readout: the values R sent, live, with Copy for R; only when opened from R', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFromR(page, view({ camera: { rotate: 70, tilt: 15, zoom: 1.5, pan: [0.1, -0.05] } }))
  const readout = page.locator('#cameraReadout')
  await expect(readout).toBeVisible()
  await expect(readout).toContainText('rotate 70°  tilt 15°  zoom 1.50  pan 0.10, -0.05')

  // Zooming about the center also scales the earlier pan; the readout gives
  // the call that reproduces the view
  await page.locator('#zoomInBtn').click() // ×1.2
  await expect(readout).toContainText('zoom 1.80  pan 0.12, -0.06')

  await readout.locator('button').click()
  await expect(readout.locator('button')).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('mira_camera(rotate = 70, tilt = 15, zoom = 1.8, pan = c(0.12, -0.06))')

  const site = await context.newPage()
  await site.goto('/')
  await site.waitForTimeout(1500)
  expect(await site.locator('#cameraReadout').count()).toBe(0)
})

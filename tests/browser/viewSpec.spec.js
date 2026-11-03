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

test('triangles and diamonds from R', async ({ page }) => {
  await openFromR(page, view({ node: { shape: { parasite: 'triangle', host: 'diamond' } } }))
  expect(await shapeOf(page, PARASITE)).toBe('triangle')
  expect(await shapeOf(page, HOST)).toBe('diamond')
  expect(await page.inputValue('#nodeShapeSelectSetA')).toBe('triangle')
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
  await expect(readout).toHaveAttribute('title', 'rotate 70°  tilt 15°  zoom 1.50  pan 0.10, -0.05')
  await expect(readout).toContainText('rotate70°')

  // Zooming about the center also scales the earlier pan; the readout gives
  // the call that reproduces the view
  await page.locator('#zoomInBtn').click() // ×1.2
  await expect(readout).toHaveAttribute('title', /zoom 1\.80  pan 0\.12, -0\.06/)

  await readout.locator('button').click()
  await expect(readout.locator('button')).toHaveText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText()))
    .toBe('mira_camera(rotate = 70, tilt = 15, zoom = 1.8, pan = c(0.12, -0.06))')

  const site = await context.newPage()
  await site.goto('/')
  await site.waitForTimeout(1500)
  expect(await site.locator('#cameraReadout').count()).toBe(0)
})

// ── stage 4: the view MiRA opens in ──────────────────────────────────────────

const activeView = (page) => page.evaluate(() =>
  document.querySelector('.mode-btn.active')?.dataset.mode ?? null)

test('stage 4: every view opens from R; the map needs coordinates', async ({ page }) => {
  for (const [view, button] of [['grid', 'grid'], ['layer', 'layer'], ['meta', 'meta'],
    ['dashboard', 'dashboard'], ['data', 'data']]) {
    const p = await page.context().newPage()
    p.on('pageerror', e => errors.push(`${view}: ${e.message}`))
    await openFromR(p, { version: 1, mode: { view } })
    expect(await activeView(p), view).toBe(button)
    expect(await noticeMessages(p), view).toBeNull()
    await p.close()
  }
  await openFromR(page, view({ mode: { view: 'map' } }))
  expect(await activeView(page)).toBe('network')
  expect((await noticeMessages(page))[0]).toMatch(/could not open this view \(the map needs latitude and longitude/)
})

test('stage 4: the map opens when the layers have coordinates', async ({ page }) => {
  const network = readFileSync(new URL('../../data/magrach2020.json', import.meta.url), 'utf8')
  await page.route('**/api/network.json', route => route.fulfill({ contentType: 'application/json', body: network }))
  await page.route('**/api/view.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(view({ mode: { view: 'map' } })) }))
  await page.goto('/?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
  expect(await activeView(page)).toBe('map')
  expect(await noticeMessages(page)).toBeNull()
})

test('stage 4: grid columns, given or MiRA\'s own', async ({ page }) => {
  await openFromR(page, view({ mode: { view: 'grid', columns: 2 } }))
  expect(await page.evaluate(() => window._renderer._gridColumns)).toBe(2)
  const own = await page.context().newPage()
  await openFromR(own, view({ mode: { view: 'grid' } }))
  expect(await own.evaluate(() => window._renderer._gridColumns)).toBe(3) // 6 layers: ceil(sqrt(6))
})

test('the data filter applies in grid mode, with the banner', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 }) // see stage 2: the banner's Clear button
  await openFromR(page, view({ filter: { nodes: [PARASITE, HOST] }, mode: { view: 'grid' } }))
  expect(await activeView(page)).toBe('grid')
  await expect(page.locator('#dataFilterBanner')).toBeVisible()
  const gridNodes = () => page.evaluate(() =>
    [...new Set(window._renderer._gridView._lastCells.flatMap(c => [...c.nodePositions.keys()]))].sort())
  expect(await gridNodes()).toEqual([HOST, PARASITE].sort())

  await page.locator('#dataFilterClear').click()
  await expect(page.locator('#dataFilterBanner')).toBeHidden()
  expect((await gridNodes()).length).toBeGreaterThan(2)
})

test('meta-network layers from R are selected in its Filter Layers panel', async ({ page }) => {
  await openFromR(page, view({ mode: { view: 'meta', layers: ['1982', '1984', 'not_a_layer'] } }))
  expect(await activeView(page)).toBe('meta')
  expect(await noticeMessages(page)).toEqual(['mode.layers[2]: "not_a_layer" is not a layer name'])
  const selected = await page.evaluate(() =>
    [...document.querySelectorAll('#mnLayerList li.active')].map(li => li.dataset.layerName))
  expect(selected).toEqual(['1982', '1984'])
})

test('stage 4: the meta-network from R looks as when its button is clicked', async ({ page }) => {
  test.slow() // three pages, and the canvas pixels copied out of each; near 30 s in CI
  await openFromR(page, NOT_SERVED)
  await page.click('#metaNetworkBtn')
  await page.waitForTimeout(1500) // let the layout settle
  const controls = (p) => p.evaluate(() => ['mnAggregationSelect', 'mnLayoutSelect', 'mnColorBySelect',
    'mnSizeBySelect', 'mnBaseSizeSlider', 'mnMinWeightSlider', 'mnLabelSizeSlider']
    .map(id => document.getElementById(id).value)
    .concat([document.getElementById('mnNestedSortCheckbox').checked,
      document.getElementById('mnShowLabelsCheckbox').checked]))
  const clicked = await controls(page)
  const pixels = (p) => p.evaluate(() => {
    const c = document.getElementById('networkCanvas')
    return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data)
  })
  const clickedPixels = await pixels(page)

  const fromR = await page.context().newPage()
  fromR.on('pageerror', e => errors.push(e.message))
  await openFromR(fromR, view({ mode: { view: 'meta' } }))
  await fromR.waitForTimeout(1500)
  expect(await controls(fromR)).toEqual(clicked)
  const rPixels = await pixels(fromR)
  expect(rPixels.length).toBe(clickedPixels.length)
  expect(rPixels.filter((v, i) => v !== clickedPixels[i]).length).toBe(0)

  const set = await page.context().newPage()
  await openFromR(set, view({ mode: { view: 'meta', aggregation: 'weights', size_by: 'participation',
    labels: true, label_size: 16, min_weight: 0.5 } }))
  const shown = await controls(set)
  expect(shown.filter((_, i) => i !== 5)).toEqual(['sumWeights', 'bipartite', 'uniform', 'participation', '1', '16',
    true, true])
  // the slider steps by 1% of the largest weight; the threshold and its label are 0.5
  expect(await set.evaluate(() => document.getElementById('mnMinWeightLabel').textContent)).toBe('0.50')
})

// ── the maps open fitted to the layers, clear of the panels over them ──────────

// magrach2020 (5 layers in Spain, near where MiRA's maps start), moved to the
// Galapagos so that a map left at its start shows none of the locations
const GALAPAGOS = [[-0.909, -89.6], [-0.533, -90.4], [-0.25, -91.0], [-1.3, -90.4], [-0.6, -89.9]]
async function openGalapagos(page, mode) {
  const network = JSON.parse(readFileSync(new URL('../../data/magrach2020.json', import.meta.url), 'utf8'))
  network.layers.forEach((layer, i) => { [layer.latitude, layer.longitude] = GALAPAGOS[i] })
  await page.setViewportSize({ width: 1400, height: 850 })
  await page.route('**/api/network.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(network) }))
  await page.route('**/api/view.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(view({ mode })) }))
  await page.goto('/?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500) // let the map's fit animation end
}

/** The boxes (left, top, right, bottom) outside the window or over a panel on the map. */
const hiddenBoxes = (page, boxes) => page.evaluate(boxes => {
  const panels = ['bottomBar', 'controlPanels', 'mapControlsFloat', 'legendPanel', 'mapLayerPanel']
    .map(id => document.getElementById(id))
    .filter(el => el && getComputedStyle(el).display !== 'none')
    .map(el => el.getBoundingClientRect())
    .filter(r => r.width && r.height)
  const overlaps = (b, r) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top
  return boxes.filter(b => b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight ||
    panels.some(r => overlaps(b, r)))
}, boxes)

test('the map from R opens on the layers, clear of the panels', async ({ page }) => {
  await openGalapagos(page, { view: 'map' })
  expect(await activeView(page)).toBe('map')
  const markers = await page.evaluate(() => [...document.querySelectorAll('#mapMarkersOverlay .map-marker')]
    .map(m => { const r = m.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }))
  expect(markers.length).toBe(5)
  expect(await hiddenBoxes(page, markers)).toEqual([])
})

test('the layer view from R fits the bubbles clear of the panels', async ({ page }) => {
  await openGalapagos(page, { view: 'layer' })
  expect(await activeView(page)).toBe('layer')
  const bubbles = () => page.evaluate(() => {
    const c = document.getElementById('networkCanvas').getBoundingClientRect()
    return window._layerView._bubbles.map(b => ({
      left: c.left + b._geoX - b.r, top: c.top + b._geoY - b.r,
      right: c.left + b._geoX + b.r, bottom: c.top + b._geoY + b.r }))
  })
  expect((await bubbles()).length).toBe(5)
  expect(await hiddenBoxes(page, await bubbles())).toEqual([])

  // Reset fits the same way after a zoom in
  await page.mouse.move(700, 425)
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -300)
  await page.waitForTimeout(800)
  expect((await hiddenBoxes(page, await bubbles())).length).toBeGreaterThan(0)
  await page.locator('#zoomResetBtn').click()
  await page.waitForTimeout(1500)
  expect(await hiddenBoxes(page, await bubbles())).toEqual([])
})

test('meta-network from R: nodes take mira_node(shape = ) shapes', async ({ page }) => {
  await openFromR(page, view({ node: { shape: { parasite: 'square', host: 'circle' } }, mode: { view: 'meta' } }))
  expect(await activeView(page)).toBe('meta')
  const shapes = await page.evaluate(([parasite, host]) => {
    const meta = window._metaNetwork
    return [meta.nodeShapeFn(null, parasite), meta.nodeShapeFn(null, host)]
  }, [PARASITE, HOST])
  expect(shapes).toEqual(['square', 'circle'])
  await expect(page.locator('#legendPanel')).toContainText('Node Shape')
})

// ── small fixes (backlog item 33) ────────────────────────────────────────────

test('opened from R, data warnings are shown once', async ({ page }) => {
  const net = JSON.parse(NETWORK)
  const first = net.extended.find(l => l.layer_from === l.layer_to)
  net.extended.push({ ...first, node_from: first.node_to, node_to: first.node_from }) // B→A of an undirected A→B
  const dialogs = []
  page.on('dialog', d => dialogs.push(d.message()))
  await page.route('**/api/network.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(net) }))
  await page.route('**/api/view.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(view({ node: { size: 8 } })) }))
  await page.goto('/?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  expect(dialogs.filter(m => m.startsWith('Data warnings:'))).toHaveLength(1)
})

test('the camera readout and both banners sit in one row, clear of the bar and the panels', async ({ page }) => {
  for (const width of [1280, 1400]) {
    await page.setViewportSize({ width, height: 800 })
    await openFromR(page, view({ filter: { nodes: [PARASITE, HOST] }, node: { highlight: HOST } }))
    for (const id of ['cameraReadout', 'dataFilterBanner', 'selectedNodeBanner']) {
      await expect(page.locator(`#${id}`), `${id} at ${width}px`).toBeVisible()
    }
    const boxes = await page.evaluate(() => Object.fromEntries(
      ['cameraReadout', 'dataFilterBanner', 'selectedNodeBanner', 'dataFilterClear', 'selectedNodeClear',
        'controlPanels', 'bottomBar', 'brandingGroup']
        .map(id => [id, document.getElementById(id).getBoundingClientRect().toJSON()])))
    const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    const row = ['cameraReadout', 'dataFilterBanner', 'selectedNodeBanner']
    for (const id of row) {
      for (const other of ['controlPanels', 'bottomBar', ...row.filter(o => o !== id)]) {
        expect(overlap(boxes[id], boxes[other]), `${id} overlaps ${other} at ${width}px`).toBe(false)
      }
    }
    // the readout is first, right of the menu panels, at their top
    expect(boxes.cameraReadout.left).toBeGreaterThan(boxes.controlPanels.right)
    expect(Math.abs(boxes.cameraReadout.top - boxes.controlPanels.top)).toBeLessThan(2)
    for (const id of ['dataFilterClear', 'selectedNodeClear']) {
      const b = boxes[id]
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [b.left + b.width / 2, b.top + b.height / 2])
      expect(hit, `${id} clickable at ${width}px`).toBe(id)
    }
  }
})

test('palette, reversal and limits from R', async ({ page }) => {
  await openFromR(page, view({
    node: { color_by: 'abundance' },
    scales: { abundance: { type: 'continuous', palette: 'magma', reverse: true, limits: [0, 100] } },
    legend: { show: ['node_color'] },
  }))
  const legend = page.locator('#legendPanel')
  await expect(legend.locator('.legend-palette-select')).toHaveValue('magma')
  await expect(legend.locator('.legend-palette-reverse')).toHaveAttribute('aria-pressed', 'true')
  // above the upper limit: the end color of the reversed palette (magma's first stop)
  const color = await page.evaluate(() => {
    const r = window._renderer
    const sn = r.model.stateNodes.find(s => Number(s.abundance) > 100)
    return r.nodeColorFn(sn.layer_name, sn.node_name)
  })
  expect(color).toBe('#000004')
  expect(await noticeMessages(page)).toBeNull()
})

/**
 * Browser tests for shared / per-set node color and size schemes.
 *
 * Each channel (color, size) is either shared by both bipartite sets or split
 * into one scheme per set. The choice is independent of the layout. Splitting
 * either channel draws Set B nodes as squares.
 *
 * Datasets:
 *   pilosof2017  — 6 bipartite layers, host / parasite, state attrs module + abundance
 *   magrach2020  — bipartite + geographic (reaches Map Mode)
 *   keresztes2022_connectome — unipartite (toggles must stay hidden)
 *   fixtures/mixed_bipartite_unipartite.json — plant–pollinator layer plus a
 *     plant-only layer (non-bipartite)
 */
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { waitForAppReady, loadDemoDataset, openSection, dismissDataNotice } from './helpers.js'

const LAYOUTS = ['kamada_kawai', 'fruchterman', 'bipartite', 'grid', 'random']
const MIXED_FIXTURE = new URL('../fixtures/mixed_bipartite_unipartite.json', import.meta.url).pathname

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  // Load-time data warnings are expected (e.g. the mixed-layer notice); any
  // other alert means something failed.
  page.on('dialog', d => {
    if (!d.message().startsWith('Data warnings:')) errors.push(`dialog: ${d.message()}`)
    d.dismiss()
  })
  await page.goto('/')
  await waitForAppReady(page)
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

// ── helpers ──────────────────────────────────────────────────────────────────

async function setLayout(page, value) {
  await openSection(page, 'sectionLayers')
  await page.selectOption('#layoutSelect', value)
}

async function selectNodeOption(page, id, value) {
  await openSection(page, 'sectionNodes')
  await page.selectOption(`#${id}`, value)
}

async function clickToggle(page, id) {
  await openSection(page, 'sectionNodes')
  await page.click(`#${id}`)
}

async function toggleState(page) {
  return page.evaluate(() => {
    const vis = id => getComputedStyle(document.getElementById(id)).display !== 'none'
    const btn = id => {
      const b = document.getElementById(id)
      return { hidden: b.hidden, pressed: b.getAttribute('aria-pressed') === 'true' }
    }
    return {
      color: btn('nodeColorSplitToggle'),
      size: btn('nodeSizeSplitToggle'),
      shape: btn('nodeShapeSplitToggle'),
      sharedColorVisible: vis('colorByContainer'),
      splitColorVisible: vis('bipartiteColorByContainer'),
      sharedSizeVisible: vis('sizeByContainer'),
      splitSizeVisible: vis('bipartiteSizeByContainer'),
      hasShapes: !!window._renderer.nodeShapeFn,
    }
  })
}

/** Every rendered (layer, node) pair with its node_type, color, size and shape. */
async function renderedNodes(page) {
  return page.evaluate(() => {
    const r = window._renderer
    return r.model.stateNodes.map(sn => {
      const node = r.model.nodesByName.get(sn.node_name)
      return {
        layer: sn.layer_name,
        name: sn.node_name,
        type: node?.node_type ?? null,
        module: sn.module,
        color: r.nodeColorFn ? r.nodeColorFn(sn.layer_name, sn.node_name) : null,
        size: r.nodeSizeFn ? r.nodeSizeFn(sn.layer_name, sn.node_name) : 1,
        shape: r.nodeShapeFn ? r.nodeShapeFn(sn.layer_name, sn.node_name) : 'circle',
      }
    })
  })
}

function colorsByKey(nodes, key) {
  const m = new Map()
  for (const n of nodes) {
    if (!m.has(n[key])) m.set(n[key], new Set())
    m.get(n[key]).add(n.color)
  }
  return m
}

async function loadFixtureFile(page, path) {
  await page.setInputFiles('#fileInput', path)
  await page.waitForFunction(() => document.getElementById('nodeColorSelect').options.length > 1)
  await dismissDataNotice(page)
}

async function saveSessionToFile(page, testInfo) {
  await page.evaluate(() => { delete window.showSaveFilePicker })
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#saveSessionBtn'),
  ])
  const path = testInfo.outputPath('session.json')
  await download.saveAs(path)
  return path
}

async function loadSessionFile(page, path) {
  await page.setInputFiles('#sessionFileInput', path)
  await page.waitForFunction(() => !!window._renderer.model)
  await page.waitForTimeout(300)
  await dismissDataNotice(page)
}

// ── defaults ─────────────────────────────────────────────────────────────────

test('bipartite network loads shared, colored by set, circles only', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  const s = await toggleState(page)
  expect(s.color).toEqual({ hidden: false, pressed: false })
  expect(s.size).toEqual({ hidden: false, pressed: false })
  expect(s.sharedColorVisible).toBe(true)
  expect(s.splitColorVisible).toBe(false)
  expect(s.hasShapes).toBe(false)
  expect(await page.inputValue('#nodeColorSelect')).toBe('set:membership')

  const nodes = await renderedNodes(page)
  const byType = colorsByKey(nodes, 'type')
  expect(byType.get('host').size).toBe(1)
  expect(byType.get('parasite').size).toBe(1)
  expect([...byType.get('host')][0]).not.toBe([...byType.get('parasite')][0])
  await expect(page.locator('#legendPanel')).toContainText('Set')
})

test('unipartite network hides both toggles and the Set option', async ({ page }) => {
  await loadDemoDataset(page, 'keresztes2022_connectome')
  const s = await toggleState(page)
  expect(s.color.hidden).toBe(true)
  expect(s.size.hidden).toBe(true)
  expect(s.shape.hidden).toBe(true)
  expect(await page.inputValue('#nodeColorSelect')).toBe('')
  expect(await page.locator('#nodeColorSelect option[value="set:membership"]').count()).toBe(0)
})

// ── split behavior is layout-independent ─────────────────────────────────────

test('splitting color works in every layout and turns Set B into squares', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeColorSplitToggle')

  for (const layout of LAYOUTS) {
    await setLayout(page, layout)
    const s = await toggleState(page)
    expect(s.color.pressed, layout).toBe(true)
    expect(s.splitColorVisible, layout).toBe(true)
    expect(s.sharedColorVisible, layout).toBe(false)
    expect(s.size.pressed, layout).toBe(false)
    expect(s.hasShapes, layout).toBe(true)

    const nodes = await renderedNodes(page)
    const shapesByType = new Map()
    for (const n of nodes) {
      if (!shapesByType.has(n.type)) shapesByType.set(n.type, new Set())
      shapesByType.get(n.type).add(n.shape)
    }
    expect(shapesByType.get('host').size, layout).toBe(1)
    expect(shapesByType.get('parasite').size, layout).toBe(1)
    expect(new Set([...shapesByType.values()].map(s => [...s][0])), layout)
      .toEqual(new Set(['circle', 'square']))
  }
})

test('unsplitting both channels removes the shapes', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeColorSplitToggle')
  await clickToggle(page, 'nodeSizeSplitToggle')
  expect((await toggleState(page)).hasShapes).toBe(true)
  await clickToggle(page, 'nodeColorSplitToggle')
  expect((await toggleState(page)).hasShapes).toBe(true) // size still split
  await clickToggle(page, 'nodeSizeSplitToggle')
  expect((await toggleState(page)).hasShapes).toBe(false)
})

// ── category colors are consistent across sets ───────────────────────────────

for (const mode of ['shared', 'split']) {
  test(`a module has one color across hosts and parasites (${mode})`, async ({ page }) => {
    await loadDemoDataset(page, 'pilosof2017')
    await setLayout(page, 'kamada_kawai')
    if (mode === 'split') {
      await clickToggle(page, 'nodeColorSplitToggle')
      await selectNodeOption(page, 'nodeColorSelectSetA', 'state:module')
      await selectNodeOption(page, 'nodeColorSelectSetB', 'state:module')
    } else {
      await selectNodeOption(page, 'nodeColorSelect', 'state:module')
    }
    const nodes = await renderedNodes(page)
    const byModule = colorsByKey(nodes.filter(n => n.module != null), 'module')
    expect(byModule.size).toBeGreaterThan(1)
    for (const [module, colors] of byModule) {
      expect(colors.size, `module ${module} colors: ${[...colors]}`).toBe(1)
    }
  })
}

// ── size ranges ──────────────────────────────────────────────────────────────

test('split size gives each set its own range; shared uses one range', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  const MAX_MULT = 2.0 // _buildSizeScaleFn maps the max value to 0.3 + 1.7

  await clickToggle(page, 'nodeSizeSplitToggle')
  await selectNodeOption(page, 'nodeSizeSelectSetA', 'state:abundance')
  await selectNodeOption(page, 'nodeSizeSelectSetB', 'state:abundance')
  let nodes = await renderedNodes(page)
  const maxOf = (type) => Math.max(...nodes.filter(n => n.type === type).map(n => n.size))
  expect(maxOf('host')).toBeCloseTo(MAX_MULT)
  expect(maxOf('parasite')).toBeCloseTo(MAX_MULT)

  await clickToggle(page, 'nodeSizeSplitToggle') // carries state:abundance back to shared
  expect(await page.inputValue('#nodeSizeSelect')).toBe('state:abundance')
  nodes = await renderedNodes(page)
  const maxima = [maxOf('host'), maxOf('parasite')]
  expect(Math.max(...maxima)).toBeCloseTo(MAX_MULT)
})

test('toggling carries the current choice over', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await selectNodeOption(page, 'nodeColorSelect', 'state:module')
  await clickToggle(page, 'nodeColorSplitToggle')
  expect(await page.inputValue('#nodeColorSelectSetA')).toBe('state:module')
  expect(await page.inputValue('#nodeColorSelectSetB')).toBe('state:module')
})

// ── mixed bipartite + non-bipartite layers ───────────────────────────────────

test('plants in the plant-only layer look like plants in the bipartite layer', async ({ page }) => {
  await loadFixtureFile(page, MIXED_FIXTURE)
  await clickToggle(page, 'nodeColorSplitToggle')
  for (const layout of LAYOUTS) {
    await setLayout(page, layout)
    const nodes = await renderedNodes(page)
    const plants = nodes.filter(n => n.type === 'plant')
    expect(plants.some(n => n.layer === 'PlantSimilarity'), layout).toBe(true)
    expect(new Set(plants.map(n => n.color)).size, layout).toBe(1)
    expect(new Set(plants.map(n => n.shape)).size, layout).toBe(1)
    expect(plants.every(n => n.color !== '#6b7280'), `${layout}: no gray fallback`).toBe(true)
  }
})

// ── other views ──────────────────────────────────────────────────────────────

test('every mode renders with both channels split', async ({ page }) => {
  await loadDemoDataset(page, 'magrach2020')
  await clickToggle(page, 'nodeColorSplitToggle')
  await clickToggle(page, 'nodeSizeSplitToggle')
  const modes = ['#gridViewBtn', '#layerViewBtn', '#metaNetworkBtn', '#dashboardBtn',
    '#dataModeBtn', '#mapModeBtn', '#networkModeBtn']
  for (const btn of modes) {
    await page.click(btn)
    await expect(page.locator(btn)).toHaveClass(/active/)
    await page.waitForTimeout(150)
  }
  expect((await toggleState(page)).color.pressed).toBe(true)
})

// ── sessions ─────────────────────────────────────────────────────────────────

test('session round-trip restores split state, selections and shapes', async ({ page }, testInfo) => {
  await loadDemoDataset(page, 'pilosof2017')
  await setLayout(page, 'fruchterman')
  await clickToggle(page, 'nodeColorSplitToggle')
  await selectNodeOption(page, 'nodeColorSelectSetA', 'state:module')
  await selectNodeOption(page, 'nodeColorSelectSetB', 'state:abundance')
  const before = await renderedNodes(page)
  const path = await saveSessionToFile(page, testInfo)

  const saved = JSON.parse(readFileSync(path, 'utf8'))
  expect(saved.version).toBe(2)
  expect(saved.ui.nodeColorSplit).toBe(true)
  expect(saved.ui.nodeSizeSplit).toBe(false)

  await page.goto('/')
  await waitForAppReady(page)
  await loadSessionFile(page, path)
  const s = await toggleState(page)
  expect(s.color.pressed).toBe(true)
  expect(s.size.pressed).toBe(false)
  expect(await page.inputValue('#nodeColorSelectSetA')).toBe('state:module')
  expect(await page.inputValue('#nodeColorSelectSetB')).toBe('state:abundance')
  const after = await renderedNodes(page)
  expect(after.map(n => [n.color, n.shape])).toEqual(before.map(n => [n.color, n.shape]))
})

for (const [layout, expectSplit] of [['bipartite', true], ['kamada_kawai', false]]) {
  test(`legacy v1 session in ${layout} layout restores ${expectSplit ? 'split' : 'shared'}`, async ({ page }, testInfo) => {
    await loadDemoDataset(page, 'pilosof2017')
    await setLayout(page, layout)
    const path = await saveSessionToFile(page, testInfo)
    const legacy = JSON.parse(readFileSync(path, 'utf8'))
    legacy.version = 1
    delete legacy.ui.nodeColorSplit
    delete legacy.ui.nodeSizeSplit
    if (!expectSplit) legacy.ui.nodeColorSelect = '' // v1 had no Set option
    writeFileSync(path, JSON.stringify(legacy))

    await page.goto('/')
    await waitForAppReady(page)
    await loadSessionFile(page, path)
    const s = await toggleState(page)
    expect(s.color.pressed).toBe(expectSplit)
    expect(s.size.pressed).toBe(expectSplit)
    expect(s.shape.pressed).toBe(false) // shapes did not exist in v1
    expect(s.hasShapes).toBe(false)
  })
}

// ── Shape channel ────────────────────────────────────────────────────────────

test('shared shape applies to every node, also in a unipartite network', async ({ page }) => {
  await loadDemoDataset(page, 'keresztes2022_connectome')
  await selectNodeOption(page, 'nodeShapeSelect', 'square')
  const nodes = await renderedNodes(page)
  expect(new Set(nodes.map(n => n.shape))).toEqual(new Set(['square']))
  await selectNodeOption(page, 'nodeShapeSelect', 'circle')
  expect((await toggleState(page)).hasShapes).toBe(false)
})

test('automatic shape split shows a shape legend and follows color', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeColorSplitToggle')
  const s = await toggleState(page)
  expect(s.shape.pressed).toBe(true)
  expect(await page.inputValue('#nodeShapeSelectSetA')).toBe('circle')
  expect(await page.inputValue('#nodeShapeSelectSetB')).toBe('square')
  await expect(page.locator('#legendPanel')).toContainText('Node Shape')
  await clickToggle(page, 'nodeColorSplitToggle')
  expect((await toggleState(page)).shape.pressed).toBe(false)
  await expect(page.locator('#legendPanel')).not.toContainText('Node Shape')
})

test('a shape edit by the user survives un-splitting color', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeColorSplitToggle')
  await selectNodeOption(page, 'nodeShapeSelectSetA', 'square')
  await selectNodeOption(page, 'nodeShapeSelectSetB', 'circle')
  await clickToggle(page, 'nodeColorSplitToggle')
  const s = await toggleState(page)
  expect(s.shape.pressed).toBe(true)
  const nodes = await renderedNodes(page)
  const shapeOf = type => new Set(nodes.filter(n => n.type === type).map(n => n.shape))
  // parasite is Set A in pilosof2017 (setA_type)
  expect(shapeOf('parasite')).toEqual(new Set(['square']))
  expect(shapeOf('host')).toEqual(new Set(['circle']))
})

test('shape split can be used on its own, with color and size shared', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeShapeSplitToggle')
  const s = await toggleState(page)
  expect(s.shape.pressed).toBe(true)
  expect(s.color.pressed).toBe(false)
  expect(s.hasShapes).toBe(true)
  await clickToggle(page, 'nodeShapeSplitToggle')
  expect((await toggleState(page)).hasShapes).toBe(false)
})

test('session round-trip restores manual shapes', async ({ page }, testInfo) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeShapeSplitToggle')
  await selectNodeOption(page, 'nodeShapeSelectSetA', 'square')
  const path = await saveSessionToFile(page, testInfo)
  await page.goto('/')
  await waitForAppReady(page)
  await loadSessionFile(page, path)
  expect((await toggleState(page)).shape.pressed).toBe(true)
  expect(await page.inputValue('#nodeShapeSelectSetA')).toBe('square')
  expect(await page.inputValue('#nodeShapeSelectSetB')).toBe('square')
})

// ── Shapes in the meta-network (follow network mode) ─────────────────────────

/** Shape of each meta-network node by node type, and the legend titles. */
const metaShapes = (page) => page.evaluate(() => {
  const meta = window._metaNetwork
  const types = new Map(window._renderer.model.nodes.map(n => [n.node_name, n.node_type]))
  const byType = {}
  for (const node of meta._mnNodes) {
    const shape = meta.nodeShapeFn ? meta.nodeShapeFn(null, node.name) : 'circle'
    ;(byType[types.get(node.name)] ??= new Set()).add(shape)
  }
  return Object.fromEntries(Object.entries(byType).map(([t, s]) => [t, [...s]]))
})

test('meta-network nodes take the shapes set in network mode, with a shape legend', async ({ page }) => {
  await loadDemoDataset(page, 'pilosof2017')
  await clickToggle(page, 'nodeShapeSplitToggle')
  await selectNodeOption(page, 'nodeShapeSelectSetA', 'square') // parasite is Set A
  await selectNodeOption(page, 'nodeShapeSelectSetB', 'circle')
  await page.click('#metaNetworkBtn')
  expect(await metaShapes(page)).toEqual({ parasite: ['square'], host: ['circle'] })
  await expect(page.locator('#legendPanel')).toContainText('Node Shape')

  // Back in network mode, one shape for all; the meta-network follows, no shape legend
  await page.click('#metaNetworkBtn')
  await clickToggle(page, 'nodeShapeSplitToggle')
  await selectNodeOption(page, 'nodeShapeSelect', 'square')
  await page.click('#metaNetworkBtn')
  expect(await metaShapes(page)).toEqual({ parasite: ['square'], host: ['square'] })
  await expect(page.locator('#legendPanel')).not.toContainText('Node Shape')
})

/**
 * rCode.test.js — Unit tests for "Copy as R code" (js/rCode.js)
 *
 * stateToSpec reads a session state back into a view spec; applying that
 * spec to the default view must give the same state (the round trip), and
 * a spec in canonical form must come back as it was. specToR prints a spec
 * as ggmira code.
 *
 * TEST GROUPS:
 *   1. Round trip     — spec → state → spec, section by section
 *   2. Not from R     — what the view passes in: camera, legend panel, meta layers
 *   3. Changes in MiRA — the layout recomputed, the filter changed; notes
 *   4. R code         — components, arguments, scales, wrapping, elements
 */

import { describe, it, expect } from 'vitest'
import { applyViewSpec } from '../js/viewSpec.js'
import { stateToSpec, specToR } from '../js/rCode.js'

const defaultState = () => ({
  version: 2,
  appMode: 'network',
  selectedNode: null,
  positions: [['L1', [['bee', { x: 1, y: 2 }]]]],
  renderer: {
    skewX: 0.6, skewY: 0.3, nodeRadius: 10, showInterlayerLinks: false, intraMinWeight: 0,
    interlayerMinWeight: 0, defaultIntraColor: '#cccccc', defaultInterColor: '#dddddd',
    showLabels: false, labelSizePx: 12, transformNodes: true, showLayerNames: false,
    layerNameFontSize: 14, showSetNames: false, stackMode: 'horizontal', layerSpacing: 300,
    arrowheadSize: 1, interlayerCurvature: 0.35, layerOffsets: [], gridColumns: 2,
  },
  ui: {
    nodeColorSelect: 'set:membership', nodeColorSelectSetA: '', nodeColorSelectSetB: '',
    nodeSizeSelect: '', nodeSizeSelectSetA: '', nodeSizeSelectSetB: '',
    nodeColorSplit: false, nodeSizeSplit: false, nodeShapeSplit: false, nodeShapeAuto: false,
    nodeShapeSelect: 'circle', nodeShapeSelectSetA: 'circle', nodeShapeSelectSetB: 'square',
    intraLinkColorSelect: '', interLinkColorSelect: '', layerColorSelect: '',
    layerColorPicker: '#8b5cf6', nodeColorPicker: '#a78bfa',
    intraLinkColorPicker: '#cccccc', interLinkColorPicker: '#dddddd',
    layoutSelect: 'bipartite', bipartiteNestedCheckbox: false,
    colorScaleOverrides: [], categoryColorOverrides: [], colorPalettes: [], colorReverse: [], colorLimits: [],
    layerColors: [['L1', '#8b5cf6'], ['L2', '#8b5cf6']],
  },
  legend: { expandedLegends: [], lvExpandedLegends: [] },
  filter: { nodeNames: null, layerNames: null, linkKeys: null, interPairFilter: [] },
  meta: { aggregation: 'sumOccurrence', layout: 'circular', colorBy: 'uniform', sizeBy: 'participation',
    baseSize: 1, minWeight: 0, nestedSort: false, showLabels: false, labelSize: 12, uniformColor: '#000000',
    colorSetA: '#000000', colorSetB: '#000000', viewScale: 1, viewOffsetX: 0, viewOffsetY: 0 },
  layerView: null,
  map: null,
})

const nodeOptions = ['', 'node:module', 'node:abundance', 'state:intra_degree', 'state:module']
const ctx = () => ({
  options: {
    nodeColorSelect: new Set(['', 'set:membership', ...nodeOptions]),
    nodeColorSelectSetA: new Set(nodeOptions),
    nodeColorSelectSetB: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelect: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelectSetA: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelectSetB: new Set(['', 'state:intra_degree']),
    intraLinkColorSelect: new Set(['', 'weight', 'type']),
    interLinkColorSelect: new Set(['', 'weight']),
    layerColorSelect: new Set(['', '__individual__', 'habitat']),
  },
  sets: { hasSets: true, labelA: 'pollinator', labelB: 'plant' },
  hasBipartite: true,
  layerNames: ['L1', 'L2', 'L3'],
  nodeNames: new Map([['bee', 'bee'], ['fly', 'fly'], ['rose', 'rose'], ['7', 7]]),
  linkKeys: new Set(['L1::bee::L1::rose', 'L1::fly::L1::rose', 'L1::bee::L2::bee']),
  reverseLinkKeys: new Map(),
  values: {
    module: new Set([1, 2, 3]),
    abundance: new Set([0.5, 2]),
    habitat: new Set(['forest', 'meadow']),
    intra_degree: new Set([1, 2, 6]),
    type: new Set(['pollination', 'dispersal']),
  },
})

/** Apply `body` from R, read the state back as if nothing changed since. */
function roundTrip(body, view = {}) {
  const baseline = defaultState()
  const spec = { version: 1, ...body }
  const applied = applyViewSpec(baseline, spec, ctx())
  expect(applied.warnings).toEqual([])
  const read = stateToSpec(applied.state, { baseline, applied: applied.state, spec }, ctx(), view)
  const again = applyViewSpec(baseline, read.spec, ctx())
  expect(again.state).toEqual(applied.state)
  return read
}

const expectSame = (body) => expect(roundTrip(body).spec).toEqual({ version: 1, ...body })

describe('Group 1 — Round trip', () => {
  it('1.1 the default view reads as an empty spec', () => {
    expect(roundTrip({})).toEqual({ spec: { version: 1 }, notes: [] })
  })

  it('1.2 layout: type, seed (kept while the positions are as R made them), nested', () => {
    expectSame({ layout: { type: 'circle', seed: 7 } })
    expectSame({ layout: { nested: true } })
  })

  it('1.3 node mappings, size, labels, perspective, highlight', () => {
    expectSame({ node: { color_by: 'module', size_by: 'abundance', size: 20 } })
    expectSame({ node: { color_by: 'intra_degree', labels: true, label_size: 16, perspective: false } })
    expectSame({ node: { highlight: 'bee' } })
    expectSame({ node: { size_by: 'intra_degree' } })
  })

  it('1.4 one node color; Default color is the picker\'s', () => {
    expectSame({ node: { color: '#ff0000' } })
  })

  it('1.5 per-set mappings; shapes split with them need no setting', () => {
    expectSame({ node: { color_by: { pollinator: 'module', plant: 'abundance' } } })
    expectSame({ node: { size_by: { plant: 'intra_degree' } } })
  })

  it('1.6 shapes: one, or one per set', () => {
    expectSame({ node: { shape: 'triangle' } })
    expectSame({ node: { shape: { pollinator: 'diamond', plant: 'square' } } })
  })

  it('1.7 links', () => {
    expectSame({ intralayer: { color_by: 'type', min_weight: 0.5, arrow_size: 2 } })
    expectSame({ intralayer: { color: '#123456' } })
    expectSame({ interlayer: { show: true, color: '#654321', min_weight: 1, curvature: 0.5, pairs: [['L1', 'L2']] } })
    expectSame({ interlayer: { color_by: 'weight' } })
  })

  it('1.8 layers: mapping, one color, per-layer colors, display', () => {
    expectSame({ layer: { color_by: 'habitat', labels: true, label_size: 20, set_labels: true } })
    expectSame({ layer: { color: '#ff8800', stack: 'vertical', spacing: 400 } })
    expectSame({ layer: { color_by: '.individual', colors: { L1: '#ff0000' } } })
  })

  it('1.9 scales: type, values, palette, reverse, limits; set colors while nodes are colored by set', () => {
    expectSame({
      node: { color_by: 'module' },
      scales: { module: { type: 'categorical', values: { 1: '#ff0000' }, palette: 'Set1', reverse: true } },
    })
    expectSame({ node: { color_by: 'abundance' }, scales: { abundance: { limits: [0, 3], palette: 'magma' } } })
    expectSame({ scales: { '.set': { values: { plant: '#00ff00' } } } })
  })

  it('1.10 set colors are dropped when nodes are not colored by set (they do not show)', () => {
    const baseline = defaultState()
    const spec = { version: 1, node: { color_by: 'module' }, scales: { '.set': { values: { plant: '#00ff00' } } } }
    const applied = applyViewSpec(baseline, spec, ctx()).state
    expect(stateToSpec(applied, { baseline, applied, spec }, ctx()).spec)
      .toEqual({ version: 1, node: { color_by: 'module' } })
  })

  it('1.11 filter: node names (as strings) and links', () => {
    expectSame({ filter: { nodes: ['bee', '7'], links: [['L1', 'bee', 'L1', 'rose']] } })
  })

  it('1.12 views: grid columns, meta-network settings, the others', () => {
    expectSame({ mode: { view: 'grid', columns: 4 } })
    expectSame({ mode: { view: 'meta', aggregation: 'weights', size_by: 'participation', labels: true } })
    expectSame({ mode: { view: 'meta', color: { pollinator: '#ff0000', plant: '#00ff00' } } })
    for (const view of ['map', 'layer', 'dashboard', 'data']) expectSame({ mode: { view } })
  })

  it('1.13 camera angles are in the session; zoom and pan come from the view', () => {
    const { spec } = roundTrip({ camera: { rotate: 10, tilt: -20 } }, {
      camera: { rotate: 10.04, tilt: -20, zoom: 1, pan: [0, -0.0001] },
    })
    expect(spec.camera).toEqual({ rotate: 10, tilt: -20 })
  })

  it('1.14 legends: the ones R opened, "all"', () => {
    expectSame({ legend: { show: ['node_color', 'layer_color'] } })
    expectSame({ legend: { show: 'all' } })
  })
})

describe('Group 2 — Not in the session', () => {
  const read = (state, view) =>
    stateToSpec(state, { baseline: defaultState(), applied: defaultState(), spec: null }, ctx(), view).spec

  it('2.1 zoom and pan, rounded and within mira_camera()\'s limits; only in network view', () => {
    const view = { camera: { rotate: 50.04, tilt: 47, zoom: 9, pan: [0.12345, -3] } }
    expect(read(defaultState(), view).camera).toEqual({ rotate: 50, tilt: 45, zoom: 5, pan: [0.123, -1] })
    expect(read({ ...defaultState(), appMode: 'grid' }, view).camera).toBeUndefined()
  })

  it('2.2 the default camera writes nothing', () => {
    const view = { camera: { rotate: 0.6 / (Math.PI / 180), tilt: 0.3 / (Math.PI / 180), zoom: 1, pan: [0, 0] } }
    expect(read(defaultState(), view).camera).toBeUndefined()
  })

  it('2.3 the legend panel: hidden, or in another corner', () => {
    expect(read(defaultState(), { legendPanel: { visible: false } }).legend).toEqual({ show: false })
    expect(read(defaultState(), { legendPanel: { visible: true, position: 'top-right' } }).legend)
      .toEqual({ position: 'top-right' })
    expect(read(defaultState(), { legendPanel: { visible: true, position: 'bottom-right' } }).legend).toBeUndefined()
  })

  it('2.4 the meta-network\'s selected layers', () => {
    const state = { ...defaultState(), appMode: 'metanetwork' }
    state.meta = { ...state.meta, layout: 'bipartite', sizeBy: 'metaDegree', nestedSort: true,
      colorSetA: '#3b82f6', colorSetB: '#f59e0b' }
    const spec = applyViewSpec(defaultState(), { version: 1, mode: { view: 'meta' } }, ctx()).state
    expect(read(spec, { metaLayers: ['L2'] }).mode).toEqual({ view: 'meta', layers: ['L2'] })
  })
})

describe('Group 3 — Changed in MiRA', () => {
  const fromR = (body) => {
    const baseline = defaultState()
    const spec = { version: 1, ...body }
    return { baseline, spec, applied: applyViewSpec(baseline, spec, ctx()).state }
  }

  it('3.1 a layout recomputed in MiRA keeps its type, drops the seed, with a note', () => {
    const ref = fromR({ layout: { type: 'fruchterman', seed: 3 } })
    const state = { ...ref.applied, positions: [['L1', [['bee', { x: 9, y: 9 }]]]] }
    const { spec, notes } = stateToSpec(state, ref, ctx())
    expect(spec.layout).toEqual({ type: 'fruchterman' })
    expect(notes[0]).toMatch(/^The layout was recomputed in MiRA without a seed/)
  })

  it('3.2 a changed setting replaces R\'s', () => {
    const ref = fromR({ node: { color_by: 'module' } })
    const state = JSON.parse(JSON.stringify(ref.applied))
    state.ui.nodeColorSelect = 'node:abundance'
    expect(stateToSpec(state, ref, ctx()).spec.node).toEqual({ color_by: 'abundance' })
  })

  it('3.3 R\'s filter text is kept while the filter is as R set it', () => {
    const ref = fromR({ filter: { nodes: ['bee'] }, r: undefined })
    ref.spec.r = { mira: 'mira(net, bipartite = TRUE)', filter: { nodes: 'type == "bee"' } }
    const kept = stateToSpec(ref.applied, ref, ctx()).spec
    expect(kept.r).toEqual({ mira: 'mira(net, bipartite = TRUE)', filter: { nodes: 'type == "bee"' } })
    const state = JSON.parse(JSON.stringify(ref.applied))
    state.filter.nodeNames = ['bee', 'fly']
    const changed = stateToSpec(state, ref, ctx()).spec
    expect(changed.r).toEqual({ mira: 'mira(net, bipartite = TRUE)' })
    expect(changed.filter).toEqual({ nodes: ['bee', 'fly'] })
  })

  it('3.4 notes: layers moved by hand, a layer filter, dragged legends', () => {
    const ref = fromR({})
    const state = JSON.parse(JSON.stringify(ref.applied))
    state.renderer.layerOffsets = [['L1', { x: 5, y: 0 }]]
    state.filter.layerNames = ['L1', 'L2']
    const { notes } = stateToSpec(state, ref, ctx(), { legendPanel: { visible: true, position: 'moved' } })
    expect(notes).toEqual([
      'A layer filter (2 layers kept): R can filter nodes and links, not layers.',
      'The legends were dragged: R puts them in a corner (mira_legends(position = )).',
      'A layer was moved with Cmd+drag: R cannot move single layers.',
    ])
  })

  it('3.5 notes: layers dragged in the layer view (#16); none when none were', () => {
    const ref = fromR({})
    const state = JSON.parse(JSON.stringify(ref.applied))
    expect(stateToSpec(state, ref, ctx(), { movedLayers: 0 }).notes).toEqual([])
    expect(stateToSpec(state, ref, ctx(), { movedLayers: 1 }).notes)
      .toEqual(['A layer was moved by hand in the layer view: R cannot set their positions.'])
    expect(stateToSpec(state, ref, ctx(), { movedLayers: 3 }).notes)
      .toEqual(['3 layers were moved by hand in the layer view: R cannot set their positions.'])
  })
})

describe('Group 4 — R code', () => {
  const code = (body) => specToR({ version: 1, ...body }).map(line => line.text).join('\n')

  it('4.1 the mira() call R sent starts the code; mira(net) without it', () => {
    expect(code({ r: { mira: 'mira(net, bipartite = TRUE, setA_type = "bird")' } }))
      .toBe('mira(net, bipartite = TRUE, setA_type = "bird")')
    expect(code({})).toBe('mira(net)')
  })

  it('4.2 one component per line, joined with +', () => {
    expect(code({ layout: { type: 'circle', seed: 7 }, node: { color_by: 'module', size: 20 } })).toBe([
      'mira(net) +',
      '  mira_layout("circle", seed = 7) +',
      '  mira_node(color_by = "module", size = 20)',
    ].join('\n'))
  })

  it('4.3 values: NULL, TRUE, named vectors, lists of pairs', () => {
    expect(code({ node: { size_by: null, labels: true, color_by: { bird: 'module' } } }))
      .toBe('mira(net) +\n  mira_node(color_by = c(bird = "module"), size_by = NULL, labels = TRUE)')
    expect(code({ interlayer: { show: true, pairs: [['L1', 'L2'], ['L2', 'L3']] } }))
      .toBe('mira(net) +\n  mira_interlayer(show = TRUE, pairs = list(c("L1", "L2"), c("L2", "L3")))')
  })

  it('4.4 a scale goes with the component that maps its attribute, once', () => {
    expect(code({
      node: { color_by: 'module' },
      layer: { color_by: 'module' },
      scales: { module: { type: 'categorical', values: { 1: '#ff0000', 'a b': '#00ff00' }, reverse: true } },
    })).toBe([
      'mira(net) +',
      '  mira_node(color_by = "module",',
      '            color_values = c("1" = "#ff0000", "a b" = "#00ff00"),',
      '            color_reverse = TRUE) +',
      '  mira_layer(color_by = "module")',
    ].join('\n'))
  })

  it('4.5 per-set scales are named by set; limits and values per set are lists', () => {
    expect(code({
      node: { color_by: { bird: 'degree', plant: 'type' } },
      scales: { degree: { limits: [0, 30], palette: 'magma' }, type: { values: { herb: '#00ff00' } } },
    })).toBe([
      'mira(net) +',
      '  mira_node(color_by = c(bird = "degree", plant = "type"),',
      '            color_values = list(plant = c(herb = "#00ff00")),',
      '            color_palette = c(bird = "magma"),',
      '            color_limits = list(bird = c(0, 30)))',
    ].join('\n'))
  })

  it('4.5b color_scale is left out when the palette, limits or values give the same type (as ggmira infers)', () => {
    expect(code({ node: { color_by: 'degree' }, scales: { degree: { type: 'continuous', palette: 'magma' } } }))
      .toBe('mira(net) +\n  mira_node(color_by = "degree", color_palette = "magma")')
    expect(code({ node: { color_by: 'degree' }, scales: { degree: { type: 'continuous' } } }))
      .toBe('mira(net) +\n  mira_node(color_by = "degree", color_scale = "continuous")')
    expect(code({ layer: { color_by: 'kind' }, scales: { kind: { type: 'categorical', values: { a: '#ff0000' } } } }))
      .toBe('mira(net) +\n  mira_layer(color_by = "kind", color_values = c(a = "#ff0000"))')
  })

  it('4.6 set colors color nodes by set; per-layer colors are the layer\'s color_values', () => {
    expect(code({ scales: { '.set': { values: { bird: '#ff0000' } } } }))
      .toBe('mira(net) +\n  mira_node(color_by = ".set", color_values = c(bird = "#ff0000"))')
    expect(code({ layer: { color_by: '.individual', colors: { layer_1: '#ff0000' } } }))
      .toBe('mira(net) +\n  mira_layer(color_by = ".individual", color_values = c(layer_1 = "#ff0000"))')
  })

  it('4.7 filters: R\'s text, node names, or links as a condition on net$extended', () => {
    expect(code({ r: { mira: 'mira(net)', filter: { nodes: 'type == "bird"' } }, filter: { nodes: ['a'] } }))
      .toBe('mira(net) +\n  mira_filter(nodes = type == "bird")')
    expect(code({ filter: { nodes: ['a', 'b'], links: [['L1', 'a', 'L1', 'b']] } })).toBe([
      'mira(net) +',
      '  mira_filter(nodes = c("a", "b"),',
      '              links = paste(layer_from, node_from, layer_to, node_to, sep = "::") %in% "L1::a::L1::b")',
    ].join('\n'))
  })

  it('4.8 camera, legends ("all" is the default), views', () => {
    expect(code({ camera: { rotate: 30, pan: [0.1, -0.2] }, legend: { show: 'all' }, mode: { view: 'data' } })).toBe([
      'mira(net) +',
      '  mira_camera(rotate = 30, pan = c(0.1, -0.2)) +',
      '  mira_legends() +',
      '  mira_mode_data()',
    ].join('\n'))
    expect(code({ legend: { show: false } })).toBe('mira(net) +\n  mira_legends(show = FALSE)')
    expect(code({ mode: { view: 'meta', color: { bird: '#ff0000' }, layers: ['L1'] } }))
      .toBe('mira(net) +\n  mira_mode_meta(color = c(bird = "#ff0000"), layers = "L1")')
  })

  it('4.9 each line carries its element', () => {
    const lines = specToR({ version: 1, node: { size: 9 }, intralayer: { color: '#000000' },
      interlayer: { show: true }, layer: { labels: true }, camera: { zoom: 2 } })
    expect(lines.map(line => line.element)).toEqual([null, 'node', 'intralayer', 'interlayer', 'layer', null])
  })
})

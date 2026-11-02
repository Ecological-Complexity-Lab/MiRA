/**
 * viewSpec.test.js — Unit tests for applyViewSpec()
 *
 * applyViewSpec translates a ggmira view spec (sent from R) into a patched
 * copy of a session state. The tests use a minimal default state with the
 * fields applyViewSpec touches, and a ctx describing the dropdown options.
 *
 * TEST GROUPS:
 *   1. Envelope       — version, non-object spec, unknown sections / fields
 *   2. Layout         — type, seed, nested
 *   3. Node color     — shared, .set, per set, constant color
 *   4. Node size      — shared, per set, base size
 *   5. Node shape     — shared, per set, automatic split
 *   6. Links / layers — color_by, color, min_weight, show
 *   7. Purity         — input state is never modified
 *   8. Labels and display — node / layer labels, perspective, stacking,
 *                        spacing, arrowheads, curvature
 *   9. Layer colors and pairs — per-layer colors, interlayer layer pairs
 *  10. Scales         — scale type and colors per value, by attribute
 */

import { describe, it, expect } from 'vitest'
import { applyViewSpec } from '../js/viewSpec.js'

const defaultState = () => ({
  version: 2,
  positions: [['L1', [['P1', { x: 1, y: 2 }]]]],
  renderer: {
    nodeRadius: 10,
    showInterlayerLinks: false,
    intraMinWeight: 0,
    interlayerMinWeight: 0,
    defaultIntraColor: '#cccccc',
    defaultInterColor: '#dddddd',
    showLabels: false,
    labelSizePx: 12,
    transformNodes: true,
    showLayerNames: false,
    layerNameFontSize: 14,
    showSetNames: false,
    stackMode: 'horizontal',
    layerSpacing: 300,
    arrowheadSize: 1,
    interlayerCurvature: 0.35,
  },
  ui: {
    nodeColorSelect: 'set:membership',
    nodeColorSelectSetA: '',
    nodeColorSelectSetB: '',
    nodeSizeSelect: '',
    nodeSizeSelectSetA: '',
    nodeSizeSelectSetB: '',
    nodeColorSplit: false,
    nodeSizeSplit: false,
    nodeShapeSplit: false,
    nodeShapeAuto: false,
    nodeShapeSelect: 'circle',
    nodeShapeSelectSetA: 'circle',
    nodeShapeSelectSetB: 'square',
    intraLinkColorSelect: '',
    interLinkColorSelect: '',
    layerColorSelect: '',
    layerColorPicker: '#8b5cf6',
    nodeColorPicker: '#a78bfa',
    intraLinkColorPicker: '#cccccc',
    interLinkColorPicker: '#dddddd',
    layoutSelect: 'bipartite',
    bipartiteNestedCheckbox: false,
    colorScaleOverrides: [],
    categoryColorOverrides: [],
    layerColors: [['L1', '#8b5cf6'], ['L2', '#8b5cf6']],
  },
  filter: { nodeNames: null, layerNames: null, linkKeys: null, interPairFilter: [] },
})

const nodeOptions = ['', 'node:module', 'node:abundance', 'state:intra_degree', 'state:module']
const ctxWithSets = () => ({
  options: {
    nodeColorSelect: new Set(['', 'set:membership', ...nodeOptions]),
    nodeColorSelectSetA: new Set(nodeOptions),
    nodeColorSelectSetB: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelect: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelectSetA: new Set(['', 'node:abundance', 'state:intra_degree']),
    nodeSizeSelectSetB: new Set(['', 'state:intra_degree']),
    intraLinkColorSelect: new Set(['', 'weight']),
    interLinkColorSelect: new Set(['', 'weight']),
    layerColorSelect: new Set(['', '__individual__', 'habitat']),
  },
  sets: { hasSets: true, labelA: 'pollinator', labelB: 'plant' },
  hasBipartite: true,
  layerNames: ['L1', 'L2', 'L3'],
  nodeNames: new Map([['bee', 'bee'], ['fly', 'fly'], ['rose', 'rose'], ['7', 7]]),
  linkKeys: new Set(['L1::bee::L1::rose', 'L1::fly::L1::rose', 'L1::bee::L2::bee']),
  values: {
    module: new Set([1, 2, 3]),
    abundance: new Set([0.5, 2]),
    guild: new Set(['bee', 'fly']),
    habitat: new Set(['forest', 'meadow']),
    intra_degree: new Set([1, 2, 6]),
  },
})
const ctxWithoutSets = () => ({
  ...ctxWithSets(),
  sets: { hasSets: false, labelA: null, labelB: null },
  hasBipartite: false,
})

const apply = (body, ctx = ctxWithSets()) =>
  applyViewSpec(defaultState(), { version: 1, ...body }, ctx)

describe('Group 1 — Envelope', () => {
  it('1.1 an empty spec changes nothing and warns nothing', () => {
    const r = apply({})
    expect(r.state).toEqual(defaultState())
    expect(r.layout).toBeNull()
    expect(r.warnings).toEqual([])
  })

  it('1.2 a wrong version ignores the whole spec', () => {
    const r = applyViewSpec(defaultState(), { version: 2, node: { size: 20 } }, ctxWithSets())
    expect(r.state).toEqual(defaultState())
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatch(/^version:/)
  })

  it('1.3 a missing version ignores the whole spec', () => {
    const r = applyViewSpec(defaultState(), { node: { size: 20 } }, ctxWithSets())
    expect(r.state.renderer.nodeRadius).toBe(10)
    expect(r.warnings[0]).toMatch(/^version:/)
  })

  it('1.4 a non-object spec is ignored', () => {
    const r = applyViewSpec(defaultState(), [1, 2], ctxWithSets())
    expect(r.state).toEqual(defaultState())
    expect(r.warnings[0]).toMatch(/^spec:/)
  })

  it('1.5 unknown sections are ignored with a warning', () => {
    const r = apply({ theme: { font: 'serif' }, node: { size: 20 } })
    expect(r.state.renderer.nodeRadius).toBe(20)
    expect(r.warnings).toEqual(['theme: not a known section; ignored'])
  })

  it('1.6 unknown fields are ignored with a warning, known ones still apply', () => {
    const r = apply({ node: { colour_by: 'module', size: 12 } })
    expect(r.state.renderer.nodeRadius).toBe(12)
    expect(r.warnings).toEqual(['node.colour_by: not a known field; ignored'])
  })

  it('1.7 a section that is not an object is ignored', () => {
    const r = apply({ node: 'module' })
    expect(r.warnings).toEqual(['node: must be an object; ignored'])
  })
})

describe('Group 2 — Layout', () => {
  it('2.1 type and seed are applied and reported for recomputation', () => {
    const r = apply({ layout: { type: 'kamada_kawai', seed: 42 } })
    expect(r.state.ui.layoutSelect).toBe('kamada_kawai')
    expect(r.layout).toEqual({ type: 'kamada_kawai', seed: 42, nested: false })
  })

  it('2.2 a seed alone keeps the default type', () => {
    const r = apply({ layout: { seed: 7 } })
    expect(r.layout).toEqual({ type: 'bipartite', seed: 7, nested: false })
  })

  it('2.3 a type alone has no seed', () => {
    expect(apply({ layout: { type: 'circle' } }).layout.seed).toBeNull()
  })

  it('2.4 nested is applied', () => {
    const r = apply({ layout: { nested: true } })
    expect(r.state.ui.bipartiteNestedCheckbox).toBe(true)
    expect(r.layout.nested).toBe(true)
  })

  it('2.5 an unknown type is skipped with a warning', () => {
    const r = apply({ layout: { type: 'spring' } })
    expect(r.state.ui.layoutSelect).toBe('bipartite')
    expect(r.layout).toBeNull()
    expect(r.warnings[0]).toMatch(/^layout.type: "spring" is not a layout/)
  })

  it('2.6 bipartite on a network without a bipartite layer is skipped', () => {
    const state = defaultState()
    state.ui.layoutSelect = 'kamada_kawai'
    const r = applyViewSpec(state, { version: 1, layout: { type: 'bipartite' } }, ctxWithoutSets())
    expect(r.state.ui.layoutSelect).toBe('kamada_kawai')
    expect(r.warnings[0]).toMatch(/needs a bipartite layer/)
  })

  it('2.7 a non-integer seed is skipped; a valid type still applies', () => {
    const r = apply({ layout: { type: 'random', seed: 1.5 } })
    expect(r.layout).toEqual({ type: 'random', seed: null, nested: false })
    expect(r.warnings[0]).toMatch(/^layout.seed:/)
  })
})

describe('Group 3 — Node color', () => {
  it('3.1 shared attribute resolves to the node attribute first', () => {
    const r = apply({ node: { color_by: 'module' } })
    expect(r.state.ui.nodeColorSelect).toBe('node:module')
    expect(r.state.ui.nodeColorSplit).toBe(false)
  })

  it('3.2 a state-node attribute resolves with the state: prefix', () => {
    expect(apply({ node: { color_by: 'intra_degree' } }).state.ui.nodeColorSelect).toBe('state:intra_degree')
  })

  it('3.3 null means Default', () => {
    expect(apply({ node: { color_by: null } }).state.ui.nodeColorSelect).toBe('')
  })

  it('3.4 ".set" colors by set membership', () => {
    expect(apply({ node: { color_by: '.set' } }).state.ui.nodeColorSelect).toBe('set:membership')
  })

  it('3.5 ".set" without node sets is skipped', () => {
    const ctx = ctxWithoutSets()
    ctx.options.nodeColorSelect.delete('set:membership')
    const r = apply({ node: { color_by: '.set' } }, ctx)
    expect(r.warnings[0]).toMatch(/only available for node color on a network with two node sets/)
  })

  it('3.6 an unknown attribute is skipped with a warning', () => {
    const r = apply({ node: { color_by: 'modul' } })
    expect(r.state.ui.nodeColorSelect).toBe('set:membership')
    expect(r.warnings).toEqual(['node.color_by: "modul" is not an available attribute'])
  })

  it('3.7 per set: names map to sets A / B and the split turns on', () => {
    const r = apply({ node: { color_by: { pollinator: 'module', plant: 'abundance' } } })
    expect(r.state.ui.nodeColorSelectSetA).toBe('node:module')
    expect(r.state.ui.nodeColorSelectSetB).toBe('node:abundance')
    expect(r.state.ui.nodeColorSplit).toBe(true)
  })

  it('3.8 per set: null and missing sets are Default', () => {
    const r = apply({ node: { color_by: { pollinator: null } } })
    expect(r.state.ui.nodeColorSelectSetA).toBe('')
    expect(r.state.ui.nodeColorSelectSetB).toBe('')
    expect(r.state.ui.nodeColorSplit).toBe(true)
  })

  it('3.9 per set: attributes are checked against that set\'s options', () => {
    const r = apply({ node: { color_by: { pollinator: 'module', plant: 'module' } } })
    expect(r.state.ui.nodeColorSelectSetA).toBe('node:module')
    expect(r.state.ui.nodeColorSelectSetB).toBe('')
    expect(r.warnings).toEqual(['node.color_by.plant: "module" is not an available attribute'])
  })

  it('3.10 per set: a wrong set name warns and names the valid ones', () => {
    const r = apply({ node: { color_by: { pollinatr: 'module' } } })
    expect(r.warnings[0]).toBe('node.color_by.pollinatr: not a node set; expected "pollinator" or "plant"')
  })

  it('3.11 per set on a network without sets is skipped', () => {
    const r = apply({ node: { color_by: { a: 'module' } } }, ctxWithoutSets())
    expect(r.state.ui.nodeColorSplit).toBe(false)
    expect(r.warnings[0]).toMatch(/per-set values need two node sets/)
  })

  it('3.12 a constant color switches color to Default so it shows', () => {
    const r = apply({ node: { color: '#123456' } })
    expect(r.state.ui.nodeColorPicker).toBe('#123456')
    expect(r.state.ui.nodeColorSelect).toBe('')
  })

  it('3.13 an invalid color is skipped', () => {
    const r = apply({ node: { color: 'red' } })
    expect(r.state.ui.nodeColorPicker).toBe('#a78bfa')
    expect(r.state.ui.nodeColorSelect).toBe('set:membership')
    expect(r.warnings[0]).toMatch(/is not a #rrggbb color/)
  })
})

describe('Group 4 — Node size', () => {
  it('4.1 shared numeric attribute', () => {
    expect(apply({ node: { size_by: 'abundance' } }).state.ui.nodeSizeSelect).toBe('node:abundance')
  })

  it('4.2 a non-numeric attribute is not offered and is skipped', () => {
    const r = apply({ node: { size_by: 'module' } })
    expect(r.state.ui.nodeSizeSelect).toBe('')
    expect(r.warnings).toEqual(['node.size_by: "module" is not an available numeric attribute'])
  })

  it('4.3 ".set" is not allowed for size', () => {
    expect(apply({ node: { size_by: '.set' } }).warnings[0]).toMatch(/only available for node color/)
  })

  it('4.4 per set', () => {
    const r = apply({ node: { size_by: { pollinator: 'abundance', plant: 'intra_degree' } } })
    expect(r.state.ui.nodeSizeSelectSetA).toBe('node:abundance')
    expect(r.state.ui.nodeSizeSelectSetB).toBe('state:intra_degree')
    expect(r.state.ui.nodeSizeSplit).toBe(true)
  })

  it('4.5 base size within range', () => {
    expect(apply({ node: { size: 15 } }).state.renderer.nodeRadius).toBe(15)
  })

  it('4.6 base size out of range is skipped', () => {
    const r = apply({ node: { size: 40 } })
    expect(r.state.renderer.nodeRadius).toBe(10)
    expect(r.warnings[0]).toMatch(/between 3 and 25/)
  })
})

describe('Group 5 — Node shape', () => {
  it('5.1 shared shape', () => {
    const r = apply({ node: { shape: 'square' } })
    expect(r.state.ui.nodeShapeSelect).toBe('square')
    expect(r.state.ui.nodeShapeSplit).toBe(false)
  })

  it('5.2 per-set shape', () => {
    const r = apply({ node: { shape: { pollinator: 'square', plant: 'circle' } } })
    expect(r.state.ui.nodeShapeSelectSetA).toBe('square')
    expect(r.state.ui.nodeShapeSelectSetB).toBe('circle')
    expect(r.state.ui.nodeShapeSplit).toBe(true)
    expect(r.state.ui.nodeShapeAuto).toBe(false)
  })

  it('5.3 per-set color without shape splits shapes automatically', () => {
    const r = apply({ node: { color_by: { pollinator: 'module', plant: 'abundance' } } })
    expect(r.state.ui.nodeShapeSplit).toBe(true)
    expect(r.state.ui.nodeShapeAuto).toBe(true)
    expect(r.state.ui.nodeShapeSelectSetA).toBe('circle')
    expect(r.state.ui.nodeShapeSelectSetB).toBe('square')
  })

  it('5.4 an explicit shared shape wins over the automatic split', () => {
    const r = apply({ node: { size_by: { pollinator: 'abundance' }, shape: 'circle' } })
    expect(r.state.ui.nodeSizeSplit).toBe(true)
    expect(r.state.ui.nodeShapeSplit).toBe(false)
  })

  it('5.5 an invalid shape is skipped and the automatic split still applies', () => {
    const r = apply({ node: { color_by: { pollinator: 'module' }, shape: 'triangle' } })
    expect(r.warnings[0]).toMatch(/"triangle" is not a shape/)
    expect(r.state.ui.nodeShapeAuto).toBe(true)
  })

  it('5.6 shared color and size leave shapes alone', () => {
    const r = apply({ node: { color_by: 'module', size_by: 'abundance' } })
    expect(r.state.ui.nodeShapeSplit).toBe(false)
  })
})

describe('Group 6 — Links and layers', () => {
  it('6.1 intralayer color_by, color and min_weight', () => {
    const r = apply({ intralayer: { color_by: 'weight', color: '#111111', min_weight: 0.2 } })
    expect(r.state.ui.intraLinkColorSelect).toBe('weight')
    expect(r.state.ui.intraLinkColorPicker).toBe('#111111')
    expect(r.state.renderer.defaultIntraColor).toBe('#111111')
    expect(r.state.renderer.intraMinWeight).toBe(0.2)
  })

  it('6.2 interlayer show, color_by, color and min_weight', () => {
    const r = apply({ interlayer: { show: true, color_by: 'weight', color: '#222222', min_weight: 0.5 } })
    expect(r.state.renderer.showInterlayerLinks).toBe(true)
    expect(r.state.ui.interLinkColorSelect).toBe('weight')
    expect(r.state.ui.interLinkColorPicker).toBe('#222222')
    expect(r.state.renderer.defaultInterColor).toBe('#222222')
    expect(r.state.renderer.interlayerMinWeight).toBe(0.5)
  })

  it('6.3 invalid link fields are skipped', () => {
    const r = apply({ interlayer: { show: 'yes', color_by: 'flux', min_weight: -1 } })
    expect(r.state.renderer.showInterlayerLinks).toBe(false)
    expect(r.state.ui.interLinkColorSelect).toBe('')
    expect(r.state.renderer.interlayerMinWeight).toBe(0)
    expect(r.warnings).toHaveLength(3)
  })

  it('6.4 layer color_by attribute and constant color', () => {
    const r = apply({ layer: { color_by: 'habitat', color: '#333333' } })
    expect(r.state.ui.layerColorSelect).toBe('habitat')
    expect(r.state.ui.layerColorPicker).toBe('#333333')
  })

  it('6.5 layer ".individual"', () => {
    expect(apply({ layer: { color_by: '.individual' } }).state.ui.layerColorSelect).toBe('__individual__')
  })

  it('6.6 min_weight above 1 is accepted (weights are not limited to 0-1)', () => {
    const r = apply({ intralayer: { min_weight: 50 }, interlayer: { min_weight: 83.3 } })
    expect(r.state.renderer.intraMinWeight).toBe(50)
    expect(r.state.renderer.interlayerMinWeight).toBe(83.3)
    expect(r.warnings).toEqual([])
  })

  it('6.7 a negative or non-numeric min_weight is skipped', () => {
    const r = apply({ intralayer: { min_weight: 'high' } })
    expect(r.state.renderer.intraMinWeight).toBe(0)
    expect(r.warnings).toEqual(['intralayer.min_weight: "high" must be a number of 0 or more'])
  })
})

describe('Group 7 — Purity', () => {
  it('7.1 the input state is not modified', () => {
    const state = defaultState()
    applyViewSpec(state, { version: 1, node: { color_by: 'module', size: 20 }, layout: { type: 'circle' } }, ctxWithSets())
    expect(state).toEqual(defaultState())
  })

  it('7.2 fields the spec does not mention keep their values', () => {
    const r = apply({ node: { size: 20 } })
    expect(r.state.positions).toEqual(defaultState().positions)
    expect(r.state.ui).toEqual(defaultState().ui)
  })
})


describe('Group 8 — Labels and display', () => {
  it('8.1 node labels, label size and perspective', () => {
    const r = apply({ node: { labels: true, label_size: 16, perspective: false } })
    expect(r.state.renderer.showLabels).toBe(true)
    expect(r.state.renderer.labelSizePx).toBe(16)
    expect(r.state.renderer.transformNodes).toBe(false)
    expect(r.warnings).toEqual([])
  })

  it('8.2 layer names, name size, set names, stacking and spacing', () => {
    const r = apply({ layer: { labels: true, label_size: 20, set_labels: true, stack: 'vertical', spacing: 450 } })
    expect(r.state.renderer.showLayerNames).toBe(true)
    expect(r.state.renderer.layerNameFontSize).toBe(20)
    expect(r.state.renderer.showSetNames).toBe(true)
    expect(r.state.renderer.stackMode).toBe('vertical')
    expect(r.state.renderer.layerSpacing).toBe(450)
    expect(r.warnings).toEqual([])
  })

  it('8.3 arrowhead size and curvature', () => {
    const r = apply({ intralayer: { arrow_size: 2.5 }, interlayer: { curvature: 0 } })
    expect(r.state.renderer.arrowheadSize).toBe(2.5)
    expect(r.state.renderer.interlayerCurvature).toBe(0)
    expect(r.warnings).toEqual([])
  })

  it('8.4 out-of-range sizes are skipped with the slider range', () => {
    const r = apply({
      node: { label_size: 30 },
      layer: { label_size: 4, spacing: 50 },
      intralayer: { arrow_size: 5 },
      interlayer: { curvature: 1.5 },
    })
    expect(r.state.renderer.labelSizePx).toBe(12)
    expect(r.state.renderer.layerNameFontSize).toBe(14)
    expect(r.state.renderer.layerSpacing).toBe(300)
    expect(r.state.renderer.arrowheadSize).toBe(1)
    expect(r.state.renderer.interlayerCurvature).toBe(0.35)
    expect(r.warnings).toEqual([
      'node.label_size: 30 must be a number between 8 and 24',
      'layer.label_size: 4 must be a number between 8 and 32',
      'layer.spacing: 50 must be a number between 100 and 600',
      'intralayer.arrow_size: 5 must be a number between 0 and 3',
      'interlayer.curvature: 1.5 must be a number between 0 and 1',
    ])
  })

  it('8.5 an unknown stacking mode and non-boolean flags are skipped', () => {
    const r = apply({ layer: { stack: 'diagonal', labels: 'yes' }, node: { perspective: 1 } })
    expect(r.state.renderer.stackMode).toBe('horizontal')
    expect(r.state.renderer.showLayerNames).toBe(false)
    expect(r.state.renderer.transformNodes).toBe(true)
    expect(r.warnings).toHaveLength(3)
    expect(r.warnings[1]).toBe('layer.stack: "diagonal" must be one of horizontal, vertical')
  })

  it('8.6 set names on a network without a bipartite layer are skipped', () => {
    const r = apply({ layer: { set_labels: true } }, ctxWithoutSets())
    expect(r.state.renderer.showSetNames).toBe(false)
    expect(r.warnings).toEqual(['layer.set_labels: set names need a bipartite layer; ignored'])
  })
})

describe('Group 9 — Layer colors and pairs', () => {
  it('9.1 per-layer colors replace the named layers and keep the others', () => {
    const r = apply({ layer: { color_by: '.individual', colors: { L2: '#ff0000', L3: '#00ff00' } } })
    expect(r.state.ui.layerColorSelect).toBe('__individual__')
    expect(r.state.ui.layerColors).toEqual([['L1', '#8b5cf6'], ['L2', '#ff0000'], ['L3', '#00ff00']])
  })

  it('9.2 unknown layers and invalid colors are skipped', () => {
    const r = apply({ layer: { colors: { L9: '#ff0000', L1: 'red' } } })
    expect(r.state.ui.layerColors).toEqual(defaultState().ui.layerColors)
    expect(r.warnings).toEqual([
      'layer.colors.L9: "L9" is not a layer name',
      'layer.colors.L1: "red" is not a #rrggbb color',
    ])
  })

  it('9.3 layer pairs become the interlayer pair filter', () => {
    const r = apply({ interlayer: { pairs: [['L1', 'L2'], ['L3', 'L1']] } })
    expect(r.state.filter.interPairFilter).toEqual(['L1::L2', 'L3::L1'])
    expect(r.warnings).toEqual([])
  })

  it('9.4 pairs with an unknown layer or the wrong length are skipped', () => {
    const r = apply({ interlayer: { pairs: [['L1', 'L9'], ['L1'], ['L2', 'L3']] } })
    expect(r.state.filter.interPairFilter).toEqual(['L2::L3'])
    expect(r.warnings).toEqual([
      'interlayer.pairs[0]: "L9" is not a layer name',
      'interlayer.pairs[1]: ["L1"] must be two layer names',
    ])
  })

  it('9.5 pairs that are not a list are skipped', () => {
    const r = apply({ interlayer: { pairs: 'L1::L2' } })
    expect(r.state.filter.interPairFilter).toEqual([])
    expect(r.warnings).toEqual(['interlayer.pairs: must be a list of [layer, layer] pairs; ignored'])
  })
})

describe('Group 10 — Scales', () => {
  it('10.1 scale type per attribute', () => {
    const r = apply({ scales: { module: { type: 'categorical' }, abundance: { type: 'continuous' } } })
    expect(r.state.ui.colorScaleOverrides).toEqual([['module', 'categorical'], ['abundance', 'continuous']])
    expect(r.warnings).toEqual([])
  })

  it('10.2 colors per value are keyed by the value as stored in the data', () => {
    const r = apply({ scales: { module: { type: 'categorical', values: { 1: '#ff0000', 3: '#0000ff' } } } })
    const [[attr, entries]] = r.state.ui.categoryColorOverrides
    expect(attr).toBe('module')
    expect(entries).toEqual([[1, '#ff0000'], [3, '#0000ff']]) // numbers, not "1" / "3"
  })

  it('10.3 string values and computed attributes', () => {
    const r = apply({ scales: { guild: { values: { bee: '#111111' } }, intra_degree: { values: { 6: '#222222' } } } })
    expect(r.state.ui.categoryColorOverrides).toEqual([
      ['guild', [['bee', '#111111']]],
      ['intra_degree', [[6, '#222222']]],
    ])
  })

  it('10.4 a value that is not in the data and an invalid color are skipped', () => {
    const r = apply({ scales: { module: { values: { 7: '#ff0000', 2: 'blue', 1: '#00ff00' } } } })
    expect(r.state.ui.categoryColorOverrides).toEqual([['module', [[1, '#00ff00']]]])
    expect(r.warnings).toEqual([
      'scales.module.values.2: "blue" is not a #rrggbb color',
      'scales.module.values.7: not a value of "module"',
    ])
  })

  it('10.5 an unknown attribute, type or field is skipped', () => {
    const r = apply({ scales: { modul: { type: 'categorical' }, module: { type: 'discrete', palette: 'magma' } } })
    expect(r.state.ui.colorScaleOverrides).toEqual([])
    expect(r.warnings).toEqual([
      'scales.modul: "modul" is not an attribute of this network; ignored',
      'scales.module.palette: not a known field; ignored',
      'scales.module.type: "discrete" must be one of categorical, continuous',
    ])
  })

  it('10.7 a continuous scale on non-numeric data is skipped', () => {
    const r = apply({ scales: { guild: { type: 'continuous' }, intra_degree: { type: 'continuous' } } })
    expect(r.state.ui.colorScaleOverrides).toEqual([['intra_degree', 'continuous']])
    expect(r.warnings).toEqual([
      'scales.guild.type: "continuous" needs numeric data, and "guild" is not numeric; ignored',
    ])
  })

  it('10.8 ".set" colors the two node sets', () => {
    const r = apply({ scales: { '.set': { values: { pollinator: '#ff0000', bee: '#0000ff' }, type: 'categorical' } } })
    expect(r.state.ui.categoryColorOverrides).toEqual([['__mira_set__', [['pollinator', '#ff0000']]]])
    expect(r.state.ui.colorScaleOverrides).toEqual([])
    expect(r.warnings).toEqual([
      'scales..set.type: not a known field; ignored',
      'scales..set.values.bee: not a value of ".set"',
    ])
    const noSets = applyViewSpec(defaultState(), { version: 1, scales: { '.set': { values: { pollinator: '#ff0000' } } } }, ctxWithoutSets())
    expect(noSets.state.ui.categoryColorOverrides).toEqual([])
    expect(noSets.warnings).toEqual(['scales..set: ".set" colors need two node sets; ignored'])
  })

  it('10.6 existing overrides for other attributes are kept', () => {
    const state = defaultState()
    state.ui.colorScaleOverrides = [['habitat', 'categorical']]
    state.ui.categoryColorOverrides = [['habitat', [['forest', '#00aa00']]]]
    const r = applyViewSpec(state, { version: 1, scales: { module: { type: 'categorical', values: { 2: '#ff0000' } } } }, ctxWithSets())
    expect(r.state.ui.colorScaleOverrides).toEqual([['habitat', 'categorical'], ['module', 'categorical']])
    expect(r.state.ui.categoryColorOverrides).toEqual([
      ['habitat', [['forest', '#00aa00']]],
      ['module', [[2, '#ff0000']]],
    ])
  })
})

describe('Group 11 — Filter', () => {
  it('11.1 nodes and links become the Data mode filter', () => {
    const r = apply({ filter: { nodes: ['bee', 'rose'], links: [['L1', 'bee', 'L1', 'rose'], ['L1', 'bee', 'L2', 'bee']] } })
    expect(r.state.filter.nodeNames).toEqual(['bee', 'rose'])
    expect(r.state.filter.linkKeys).toEqual(['L1::bee::L1::rose', 'L1::bee::L2::bee'])
    expect(r.state.filter.layerNames).toBeNull()
    expect(r.warnings).toEqual([])
  })

  it('11.2 node names are matched to the data as stored ("7" -> 7); duplicates kept once', () => {
    const r = apply({ filter: { nodes: ['7', 'bee', 'bee'] } })
    expect(r.state.filter.nodeNames).toEqual([7, 'bee'])
  })

  it('11.3 unknown entries are skipped; a list with no valid entry is ignored', () => {
    const r = apply({ filter: { nodes: ['bee', 'wasp'], links: [['L1', 'wasp', 'L1', 'rose'], 'L1::bee::L1::rose'] } })
    expect(r.state.filter.nodeNames).toEqual(['bee'])
    expect(r.state.filter.linkKeys).toBeNull()
    expect(r.warnings).toEqual([
      'filter.nodes[1]: "wasp" is not a node name',
      'filter.links[0]: ["L1","wasp","L1","rose"] is not a link of this network',
      'filter.links[1]: "L1::bee::L1::rose" must be [layer_from, node_from, layer_to, node_to]',
      'filter.links: no valid entries; ignored',
    ])
  })

  it('11.4 an empty list hides everything; null clears; other values are ignored', () => {
    expect(apply({ filter: { nodes: [] } }).state.filter.nodeNames).toEqual([])
    const state = defaultState()
    state.filter.nodeNames = ['bee']
    expect(applyViewSpec(state, { version: 1, filter: { nodes: null } }, ctxWithSets()).state.filter.nodeNames).toBeNull()
    const r = apply({ filter: { nodes: 'bee', layers: ['L1'] } })
    expect(r.state.filter.nodeNames).toBeNull()
    expect(r.warnings).toEqual([
      'filter.layers: not a known field; ignored',
      'filter.nodes: must be a list or null; ignored',
    ])
  })
})

describe('Group 12 — Camera', () => {
  it('12.1 rotate and tilt (degrees) become the renderer angles (radians)', () => {
    const r = apply({ camera: { rotate: 90, tilt: -30 } })
    expect(r.state.renderer.skewX).toBeCloseTo(Math.PI / 2)
    expect(r.state.renderer.skewY).toBeCloseTo(-Math.PI / 6)
    expect(r.camera).toBeNull()
  })

  it('12.2 zoom and pan are returned for after the restore', () => {
    const r = apply({ camera: { zoom: 1.5, pan: [0.1, -0.2] } })
    expect(r.camera).toEqual({ zoom: 1.5, pan: [0.1, -0.2] })
  })

  it('12.3 invalid values keep the default', () => {
    const r = apply({ camera: { rotate: 'left', tilt: 60, zoom: 10, pan: [2, 0] } })
    expect(r.state.renderer.skewX).toBe(defaultState().renderer.skewX)
    expect(r.camera).toBeNull()
    expect(r.warnings).toEqual([
      'camera.rotate: "left" must be a number (degrees)',
      'camera.tilt: 60 must be a number between -45 and 45',
      'camera.zoom: 10 must be a number between 0.2 and 5',
      'camera.pan: [2,0] must be [x, y], each between -1 and 1',
    ])
  })
})

describe('Group 13 — Legends', () => {
  it('13.1 a list of legends is opened, per-set legends included', () => {
    const r = apply({ legend: { show: ['node_color', 'layer_color'] } })
    expect(r.state.legend.expandedLegends).toEqual(['nodeColor', 'nodeColorA', 'nodeColorB', 'layerColor'])
    expect(r.legendPanel).toBeNull()
  })

  it('13.2 "all", false and a position', () => {
    expect(apply({ legend: { show: 'all' } }).state.legend.expandedLegends).toHaveLength(10)
    const r = apply({ legend: { show: false, position: 'top-right' } })
    expect(r.legendPanel).toEqual({ visible: false, position: 'top-right' })
  })

  it('13.3 unknown legends and positions are skipped', () => {
    const r = apply({ legend: { show: ['node_colour', 'node_size'], position: 'top-left' } })
    expect(r.state.legend.expandedLegends).toEqual(['nodeSize', 'nodeSizeA', 'nodeSizeB'])
    expect(r.legendPanel).toBeNull()
    expect(r.warnings).toEqual([
      'legend.show[0]: "node_colour" is not a legend; expected one of node_color, node_size, node_shape, intralayer_color, interlayer_color, layer_color',
      'legend.position: "top-left" must be one of bottom-right, top-right, bottom-left',
    ])
  })
})

describe('Group 14 — Highlight', () => {
  it('14.1 node.highlight selects the node, matched to the data as stored', () => {
    expect(apply({ node: { highlight: 'bee' } }).state.selectedNode).toBe('bee')
    expect(apply({ node: { highlight: '7' } }).state.selectedNode).toBe(7)
    const r = apply({ node: { highlight: 'wasp' } })
    expect(r.state.selectedNode).toBeUndefined()
    expect(r.warnings).toEqual(['node.highlight: "wasp" is not a node name'])
  })
})

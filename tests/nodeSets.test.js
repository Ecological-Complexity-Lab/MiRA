/**
 * nodeSets.test.js — Unit tests for buildNodeSetResolver() / collectSetItems()
 *
 * The resolver tells the styling code which bipartite set a (layer, node) pair
 * belongs to. Membership inside a bipartite layer follows the per-layer rule
 * from dataParser; nodes in non-bipartite layers fall back to their
 * node_type's set (styling only).
 *
 * TEST GROUPS:
 *   1. Eligibility       — when sets are exposed at all
 *   2. Per-layer rule    — membership inside bipartite layers
 *   3. Type fallback     — nodes in non-bipartite layers
 *   4. setA_type         — labels and conflicting declarations
 *   5. collectSetItems   — splitting node / state items by set
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseMultilayerData } from '../js/dataParser.js'
import { buildNodeSetResolver, collectSetItems, SET_A, SET_B } from '../js/nodeSets.js'

const loadFixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))

// Bipartite Pollination layer (plants P1–P3, pollinators B1–B2) plus a
// unipartite PlantSimilarity layer holding only plants.
const mixedModel = () => parseMultilayerData(loadFixture('mixed_bipartite_unipartite.json'))

const node = (name, type) => ({ node_id: name, node_name: name, node_type: type })
const state = (layer, name) => ({ layer_name: layer, node_name: name })
const link = (layer, from, to) => ({ layer_from: layer, node_from: from, layer_to: layer, node_to: to })

/** Two bipartite layers; setA_type per layer is configurable. */
function twoBipartiteLayers(setA1, setA2) {
  return parseMultilayerData({
    layers: [
      { layer_id: 1, layer_name: 'L1', bipartite: true, setA_type: setA1 },
      { layer_id: 2, layer_name: 'L2', bipartite: true, setA_type: setA2 },
    ],
    nodes: [node('P1', 'plant'), node('B1', 'pollinator')],
    state_nodes: [state('L1', 'P1'), state('L1', 'B1'), state('L2', 'P1'), state('L2', 'B1')],
    extended: [link('L1', 'P1', 'B1'), link('L2', 'P1', 'B1')],
  })
}

describe('Group 1 — Eligibility', () => {
  it('1.1 exposes sets for a network with a bipartite layer and 2 node types', () => {
    expect(buildNodeSetResolver(mixedModel()).hasSets).toBe(true)
  })

  it('1.2 no sets for a unipartite network', () => {
    const model = parseMultilayerData(loadFixture('calc_J_unipartite_3layers.json'))
    const r = buildNodeSetResolver(model)
    expect(r.hasSets).toBe(false)
    expect(r.getNodeSet('anything', 'x')).toBeNull()
  })

  it('1.3 no sets when the network has 3 node types', () => {
    const model = parseMultilayerData({
      layers: [{ layer_id: 1, layer_name: 'L1', bipartite: true }, { layer_id: 2, layer_name: 'L2' }],
      nodes: [node('P1', 'plant'), node('B1', 'pollinator'), node('H1', 'herbivore')],
      state_nodes: [state('L1', 'P1'), state('L1', 'B1'), state('L2', 'P1'), state('L2', 'H1')],
      extended: [link('L1', 'P1', 'B1'), link('L2', 'P1', 'H1')],
    })
    expect(buildNodeSetResolver(model).hasSets).toBe(false)
  })

  it('1.4 no sets for a null model', () => {
    expect(buildNodeSetResolver(null).hasSets).toBe(false)
  })
})

describe('Group 2 — Per-layer rule inside bipartite layers', () => {
  it('2.1 plants and pollinators land in opposite sets', () => {
    const r = buildNodeSetResolver(mixedModel())
    const plantSet = r.getNodeSet('Pollination', 'P1')
    const pollinatorSet = r.getNodeSet('Pollination', 'B1')
    expect([plantSet, pollinatorSet].sort()).toEqual([SET_A, SET_B])
  })

  it('2.2 matches dataParser bipartiteInfo exactly', () => {
    const model = mixedModel()
    const r = buildNodeSetResolver(model)
    const info = model.bipartiteInfo.get('Pollination')
    for (const n of info.setA) expect(r.getNodeSet('Pollination', n)).toBe(SET_A)
    for (const n of info.setB) expect(r.getNodeSet('Pollination', n)).toBe(SET_B)
  })
})

describe('Group 3 — Type fallback in non-bipartite layers', () => {
  it('3.1 a plant in the plant-only layer gets the plant set', () => {
    const r = buildNodeSetResolver(mixedModel())
    expect(r.getNodeSet('PlantSimilarity', 'P2')).toBe(r.getNodeSet('Pollination', 'P2'))
  })

  it('3.2 a node without node_type has no set', () => {
    const model = parseMultilayerData(loadFixture('mixed_no_type_on_unipartite.json'))
    const r = buildNodeSetResolver(model)
    expect(r.hasSets).toBe(true)
    expect(r.getNodeSet('Coauthorship', 'X1')).toBeNull()
  })
})

describe('Group 4 — setA_type and labels', () => {
  it('4.1 labels follow setA_type', () => {
    const r = buildNodeSetResolver(twoBipartiteLayers('pollinator', 'pollinator'))
    expect(r.labelA).toBe('pollinator')
    expect(r.labelB).toBe('plant')
    expect(r.getNodeSet('L2', 'B1')).toBe(SET_A)
  })

  it('4.2 without setA_type, labels are alphabetical', () => {
    const r = buildNodeSetResolver(mixedModel())
    expect(r.labelA).toBe('plant')
    expect(r.labelB).toBe('pollinator')
  })

  it('4.3 conflicting setA_type: per-layer membership wins, warning emitted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = buildNodeSetResolver(twoBipartiteLayers('pollinator', 'plant'))
    expect(r.getNodeSet('L1', 'B1')).toBe(SET_A)
    expect(r.getNodeSet('L2', 'B1')).toBe(SET_B)
    expect(r.labelA).toBe('pollinator')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('Group 5 — collectSetItems', () => {
  it('5.1 state items include the plant-only layer under the plant set', () => {
    const model = mixedModel()
    const r = buildNodeSetResolver(model)
    const plantSet = r.getNodeSet('Pollination', 'P1')
    const groups = collectSetItems(model, r, 'state')
    const plantLayers = new Set(groups[plantSet].map(sn => sn.layer_name))
    expect(plantLayers).toEqual(new Set(['Pollination', 'PlantSimilarity']))
    expect(groups[plantSet]).toHaveLength(6) // 3 plants × 2 layers
  })

  it('5.2 node items are deduplicated across layers', () => {
    const model = mixedModel()
    const r = buildNodeSetResolver(model)
    const groups = collectSetItems(model, r, 'node')
    const names = (set) => groups[set].map(n => n.node_name).sort()
    const plantSet = r.getNodeSet('Pollination', 'P1')
    const otherSet = plantSet === SET_A ? SET_B : SET_A
    expect(names(plantSet)).toEqual(['P1', 'P2', 'P3'])
    expect(names(otherSet)).toEqual(['B1', 'B2'])
  })
})

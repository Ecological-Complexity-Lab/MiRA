/**
 * tests/calc/metaAggregation.test.js — Meta-graph aggregation.
 */
import { describe, it, expect } from 'vitest'
import { parseMultilayerData } from '../../js/dataParser.js'
import { aggregateMetaNetwork } from '../../js/calc/metaAggregation.js'

// Two-layer network: edge A–B exists in both L1 and L2 with weights 2 and 5.
// Edge B–C only in L1 with weight 3.
function makeFixture() {
  return {
    directed: false,
    layers: [
      { layer_id: 1, layer_name: 'L1' },
      { layer_id: 2, layer_name: 'L2' },
    ],
    nodes: [
      { node_id: 'A_L1', layer_name: 'L1', node_name: 'A' },
      { node_id: 'B_L1', layer_name: 'L1', node_name: 'B' },
      { node_id: 'C_L1', layer_name: 'L1', node_name: 'C' },
      { node_id: 'A_L2', layer_name: 'L2', node_name: 'A' },
      { node_id: 'B_L2', layer_name: 'L2', node_name: 'B' },
    ],
    state_nodes: [
      { layer_name: 'L1', node_name: 'A' },
      { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L1', node_name: 'C' },
      { layer_name: 'L2', node_name: 'A' },
      { layer_name: 'L2', node_name: 'B' },
    ],
    extended: [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 2 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 3 },
      { layer_from: 'L2', node_from: 'A', layer_to: 'L2', node_to: 'B', weight: 5 },
    ],
  }
}

describe('Group calc/metaAggregation', () => {
  it('union mode: edge weight is 1 regardless of how many layers it appears in', () => {
    const m = parseMultilayerData(makeFixture())
    const { edges } = aggregateMetaNetwork(m, 'union')
    for (const e of edges) {
      expect(e.weight).toBe(1)
    }
    // Two unique meta-edges: A–B and B–C
    expect(edges.length).toBe(2)
  })

  it('sumOccurrence mode: weight is the count of layers containing the edge', () => {
    const m = parseMultilayerData(makeFixture())
    const { edges } = aggregateMetaNetwork(m, 'sumOccurrence')
    const ab = edges.find(e => (e.source === 'A' && e.target === 'B') || (e.source === 'B' && e.target === 'A'))
    const bc = edges.find(e => (e.source === 'B' && e.target === 'C') || (e.source === 'C' && e.target === 'B'))
    expect(ab.weight).toBe(2) // appears in both L1 and L2
    expect(bc.weight).toBe(1) // only in L1
  })

  it('sumWeights mode: weight is the sum of per-layer weights', () => {
    const m = parseMultilayerData(makeFixture())
    const { edges } = aggregateMetaNetwork(m, 'sumWeights')
    const ab = edges.find(e => (e.source === 'A' && e.target === 'B') || (e.source === 'B' && e.target === 'A'))
    const bc = edges.find(e => (e.source === 'B' && e.target === 'C') || (e.source === 'C' && e.target === 'B'))
    expect(ab.weight).toBe(2 + 5)
    expect(bc.weight).toBe(3)
  })

  it('perLayer breakdown lists every contributing layer with its weight', () => {
    const m = parseMultilayerData(makeFixture())
    const { edges } = aggregateMetaNetwork(m, 'sumWeights')
    const ab = edges.find(e => (e.source === 'A' && e.target === 'B') || (e.source === 'B' && e.target === 'A'))
    expect(ab.perLayer).toHaveLength(2)
    expect(ab.perLayer.find(p => p.layerName === 'L1').weight).toBe(2)
    expect(ab.perLayer.find(p => p.layerName === 'L2').weight).toBe(5)
  })

  it('undirected canonicalisation: A→B and B→A collapse into one meta-edge', () => {
    // Even if user data lists both directions on different layers, the
    // sorted (min, max) key keeps them as one meta-edge.
    const input = makeFixture()
    input.extended = [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 2 },
      { layer_from: 'L2', node_from: 'B', layer_to: 'L2', node_to: 'A', weight: 5 },
    ]
    input.state_nodes = [
      { layer_name: 'L1', node_name: 'A' }, { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L2', node_name: 'A' }, { layer_name: 'L2', node_name: 'B' },
    ]
    input.nodes = [
      { node_id: 'A_L1', layer_name: 'L1', node_name: 'A' }, { node_id: 'B_L1', layer_name: 'L1', node_name: 'B' },
      { node_id: 'A_L2', layer_name: 'L2', node_name: 'A' }, { node_id: 'B_L2', layer_name: 'L2', node_name: 'B' },
    ]
    const m = parseMultilayerData(input)
    const { edges } = aggregateMetaNetwork(m, 'sumWeights')
    expect(edges).toHaveLength(1)
    expect(edges[0].weight).toBe(2 + 5)
  })

  it('isolated node (in a layer but no intralayer edge) still appears as a meta-node', () => {
    const m = parseMultilayerData(makeFixture())
    const { nodes } = aggregateMetaNetwork(m, 'union')
    // C only has L1 (B–C edge); A is in both layers
    expect(nodes.has('A')).toBe(true)
    expect(nodes.has('B')).toBe(true)
    expect(nodes.has('C')).toBe(true)
    expect(nodes.get('A').participation).toBe(2)
    expect(nodes.get('C').participation).toBe(1)
  })

  it('metaDegree counts unique partners across the projected graph', () => {
    const m = parseMultilayerData(makeFixture())
    const { nodes } = aggregateMetaNetwork(m, 'union')
    expect(nodes.get('B').metaDegree).toBe(2) // partners with A and C
    expect(nodes.get('A').metaDegree).toBe(1) // only partners with B
    expect(nodes.get('C').metaDegree).toBe(1)
  })
})

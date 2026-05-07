/**
 * tests/calc/similarity.test.js — Jaccard layer similarity.
 */
import { describe, it, expect } from 'vitest'
import { jaccard, computeLayerSimilarity } from '../../js/calc/similarity.js'
import { parseMultilayerData } from '../../js/dataParser.js'
import { computePerLayerStats } from '../../js/calc/layerMetrics.js'

describe('Group calc/similarity — Jaccard', () => {
  it('jaccard(a, a) === 1 for non-empty a', () => {
    const s = new Set(['x', 'y', 'z'])
    expect(jaccard(s, s)).toBe(1)
  })

  it('jaccard returns NaN when both sets are empty', () => {
    expect(jaccard(new Set(), new Set())).toBeNaN()
  })

  it('jaccard is 0 when sets are disjoint', () => {
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0)
  })

  it('jaccard is symmetric', () => {
    const a = new Set(['x', 'y']), b = new Set(['y', 'z', 'w'])
    expect(jaccard(a, b)).toBe(jaccard(b, a))
  })

  it('computeLayerSimilarity: two identical-node-set layers → node Jaccard 1', () => {
    const input = {
      directed: false,
      layers: [
        { layer_id: 1, layer_name: 'L1' },
        { layer_id: 2, layer_name: 'L2' },
      ],
      nodes: [
        { node_id: 'A_L1', layer_name: 'L1', node_name: 'A' },
        { node_id: 'B_L1', layer_name: 'L1', node_name: 'B' },
        { node_id: 'A_L2', layer_name: 'L2', node_name: 'A' },
        { node_id: 'B_L2', layer_name: 'L2', node_name: 'B' },
      ],
      state_nodes: [
        { layer_name: 'L1', node_name: 'A' },
        { layer_name: 'L1', node_name: 'B' },
        { layer_name: 'L2', node_name: 'A' },
        { layer_name: 'L2', node_name: 'B' },
      ],
      extended: [
        { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      ],
    }
    const m = parseMultilayerData(input)
    const { edgeKeySets } = computePerLayerStats(m)
    const sim = computeLayerSimilarity(m, edgeKeySets)
    expect(sim.node[0][1]).toBe(1) // identical node sets
    expect(sim.node[0][0]).toBe(1) // diagonal
  })

  it('computeLayerSimilarity: bipartite mode returns setA and setB matrices', () => {
    const input = {
      directed: false,
      layers: [
        { layer_id: 1, layer_name: 'L1', bipartite: true },
        { layer_id: 2, layer_name: 'L2', bipartite: true },
      ],
      nodes: [
        { node_id: 'p1', layer_name: 'L1', node_name: 'p1', node_type: 'pollinator' },
        { node_id: 'f1', layer_name: 'L1', node_name: 'f1', node_type: 'flower' },
        { node_id: 'p2', layer_name: 'L2', node_name: 'p1', node_type: 'pollinator' },
        { node_id: 'f2', layer_name: 'L2', node_name: 'f1', node_type: 'flower' },
      ],
      state_nodes: [
        { layer_name: 'L1', node_name: 'p1' },
        { layer_name: 'L1', node_name: 'f1' },
        { layer_name: 'L2', node_name: 'p1' },
        { layer_name: 'L2', node_name: 'f1' },
      ],
      extended: [
        { layer_from: 'L1', node_from: 'p1', layer_to: 'L1', node_to: 'f1', weight: 1 },
      ],
    }
    const m = parseMultilayerData(input)
    const { edgeKeySets } = computePerLayerStats(m)
    const setANodes = new Set(['p1']) // pollinators
    const setBNodes = new Set(['f1']) // flowers
    const sim = computeLayerSimilarity(m, edgeKeySets, { setANodes, setBNodes })
    expect(sim.setA).not.toBeNull()
    expect(sim.setB).not.toBeNull()
    expect(sim.setA[0][1]).toBe(1) // both layers have pollinator p1
  })
})

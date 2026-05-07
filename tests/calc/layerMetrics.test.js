/**
 * tests/calc/layerMetrics.test.js — Per-layer density and counts.
 */
import { describe, it, expect } from 'vitest'
import { parseMultilayerData } from '../../js/dataParser.js'
import { computePerLayerStats } from '../../js/calc/layerMetrics.js'

function makeTriangle() {
  return {
    directed: false,
    layers: [{ layer_id: 1, layer_name: 'L1' }],
    nodes: [
      { node_id: 'A', layer_name: 'L1', node_name: 'A' },
      { node_id: 'B', layer_name: 'L1', node_name: 'B' },
      { node_id: 'C', layer_name: 'L1', node_name: 'C' },
    ],
    state_nodes: [
      { layer_name: 'L1', node_name: 'A' },
      { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L1', node_name: 'C' },
    ],
    extended: [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 1 },
      { layer_from: 'L1', node_from: 'C', layer_to: 'L1', node_to: 'A', weight: 1 },
    ],
  }
}

describe('Group calc/layerMetrics — per-layer density and counts', () => {
  it('triangle: N=3, E=3, density = 1.0 (complete K3)', () => {
    const m = parseMultilayerData(makeTriangle())
    const { perLayer, avgDensity } = computePerLayerStats(m)
    expect(perLayer[0].N).toBe(3)
    expect(perLayer[0].E).toBe(3)
    expect(perLayer[0].density).toBe(1)
    expect(avgDensity).toBe(1)
  })

  it('two-layer multiplex: avgDensity averages the two layers', () => {
    const input = {
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
        { node_id: 'C_L2', layer_name: 'L2', node_name: 'C' },
      ],
      state_nodes: [
        { layer_name: 'L1', node_name: 'A' },
        { layer_name: 'L1', node_name: 'B' },
        { layer_name: 'L1', node_name: 'C' },
        { layer_name: 'L2', node_name: 'A' },
        { layer_name: 'L2', node_name: 'B' },
        { layer_name: 'L2', node_name: 'C' },
      ],
      extended: [
        // L1 is K3 (density 1), L2 has 1 edge (density 1/3)
        { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
        { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 1 },
        { layer_from: 'L1', node_from: 'C', layer_to: 'L1', node_to: 'A', weight: 1 },
        { layer_from: 'L2', node_from: 'A', layer_to: 'L2', node_to: 'B', weight: 1 },
      ],
    }
    const m = parseMultilayerData(input)
    const { perLayer, avgDensity } = computePerLayerStats(m)
    expect(perLayer[0].density).toBe(1)
    expect(perLayer[1].density).toBeCloseTo(1 / 3, 5)
    expect(avgDensity).toBeCloseTo((1 + 1 / 3) / 2, 5)
  })

  it('edgeKeySets are deduplicated (undirected: A→B and B→A collapse)', () => {
    const input = {
      directed: false,
      layers: [{ layer_id: 1, layer_name: 'L1' }],
      nodes: [
        { node_id: 'A', layer_name: 'L1', node_name: 'A' },
        { node_id: 'B', layer_name: 'L1', node_name: 'B' },
      ],
      state_nodes: [
        { layer_name: 'L1', node_name: 'A' },
        { layer_name: 'L1', node_name: 'B' },
      ],
      extended: [
        { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
        // Duplicate listing in opposite direction — dedup at parse,
        // edgeKeySets must still report 1 key.
        { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'A', weight: 1 },
      ],
    }
    const m = parseMultilayerData(input)
    const { edgeKeySets } = computePerLayerStats(m)
    expect(edgeKeySets.get('L1').size).toBe(1)
  })
})

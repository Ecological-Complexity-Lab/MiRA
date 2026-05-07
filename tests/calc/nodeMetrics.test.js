/**
 * tests/calc/nodeMetrics.test.js — Sanity checks for the multilayer
 * intra/inter degree-strength split.
 *
 * Math reference: Boccaletti et al. 2014, Phys. Rep. 544; De Domenico
 * et al. 2013/2015. The cases below mirror the "sanity checks" listed
 * in the implementation spec.
 */
import { describe, it, expect } from 'vitest'
import { parseMultilayerData } from '../../js/dataParser.js'

// Two-layer multiplex with diagonal weight-1 interlayer couplings.
// Each physical node A, B appears in both layers L1 and L2.
// Intralayer: L1 has A–B; L2 has A–B. Interlayer: A_L1–A_L2, B_L1–B_L2.
function makeMultiplex2() {
  return {
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
      { layer_from: 'L2', node_from: 'A', layer_to: 'L2', node_to: 'B', weight: 1 },
      { layer_from: 'L1', node_from: 'A', layer_to: 'L2', node_to: 'A', weight: 1 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L2', node_to: 'B', weight: 1 },
    ],
  }
}

// Single-layer triangle. Used to confirm interlayer fields are zero
// when the network is monolayer.
function makeMonolayerTriangle() {
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

// Two-layer directed network with intralayer + interlayer edges, used
// for the in/out sum-identity check.
function makeDirectedTwoLayer() {
  return {
    directed: true,
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
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 2.0, directed: true },
      { layer_from: 'L2', node_from: 'B', layer_to: 'L2', node_to: 'A', weight: 0.5, directed: true },
      { layer_from: 'L1', node_from: 'A', layer_to: 'L2', node_to: 'B', weight: 1.0, directed: true }, // off-diagonal interlayer
    ],
  }
}

describe('Group calc/nodeMetrics — multilayer degree/strength split', () => {

  it('1. Single layer: inter_* are 0 and intra_degree matches monolayer degree', () => {
    const m = parseMultilayerData(makeMonolayerTriangle())
    for (const sn of m.stateNodes) {
      expect(sn.intra_degree).toBe(2)
      expect(sn.inter_degree).toBe(0)
      expect(sn.inter_strength).toBe(0)
    }
  })

  it('2. Multiplex with diagonal couplings: inter_degree = M - 1 = 1 for every state node', () => {
    const m = parseMultilayerData(makeMultiplex2())
    for (const sn of m.stateNodes) {
      expect(sn.inter_degree).toBe(1) // M = 2 layers → 1 coupling per state node
      expect(sn.intra_degree).toBe(1) // the L1 / L2 A–B edge
    }
  })

  it('3. Sum identity (directed): Σ intra_out_strength = Σ intra_in_strength', () => {
    const m = parseMultilayerData(makeDirectedTwoLayer())
    let outSum = 0, inSum = 0
    let outInterSum = 0, inInterSum = 0
    for (const sn of m.stateNodes) {
      outSum      += sn.intra_out_strength ?? 0
      inSum       += sn.intra_in_strength  ?? 0
      outInterSum += sn.inter_out_strength ?? 0
      inInterSum  += sn.inter_in_strength  ?? 0
    }
    expect(outSum).toBe(inSum)
    expect(outInterSum).toBe(inInterSum)
  })

  it('4. Commutativity: physical-node sum matches Σ over per-layer state-node values', () => {
    const m = parseMultilayerData(makeMultiplex2())
    const A = m.nodes.find(n => n.node_name === 'A')

    const intraVecSum = [...A.intra_degree_by_layer.values()].reduce((a, b) => a + b, 0)
    const interVecSum = [...A.inter_degree_by_layer.values()].reduce((a, b) => a + b, 0)

    expect(A.intra_degree_sum).toBe(intraVecSum)
    expect(A.inter_degree_sum).toBe(interVecSum)
  })

  it('5. Off-diagonal interlayer edge contributes to inter_degree of both endpoints', () => {
    const m = parseMultilayerData(makeDirectedTwoLayer())
    const snA_L1 = m.stateNodeMap.get('L1::A') // source of the off-diagonal edge
    const snB_L2 = m.stateNodeMap.get('L2::B') // target of the off-diagonal edge
    expect(snA_L1.inter_out_degree).toBe(1)
    expect(snB_L2.inter_in_degree).toBe(1)
  })

  it('6. Self-loop is excluded from intra_degree (j ≠ i in spec)', () => {
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
        { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'A', weight: 7 }, // self-loop
        { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 }, // real edge
      ],
    }
    const m = parseMultilayerData(input)
    const snA = m.stateNodeMap.get('L1::A')
    expect(snA.intra_degree).toBe(1)   // self-loop excluded; only the A–B edge counts
    expect(snA.intra_strength).toBe(1) // the weight-7 self-loop is ignored
  })

  it('Computed-attribute marker arrays expose the new field names', () => {
    const m = parseMultilayerData(makeMultiplex2())
    expect(m.computedStateNodeAttributes).toEqual(
      expect.arrayContaining(['intra_degree', 'intra_strength', 'inter_degree', 'inter_strength'])
    )
    expect(m.computedNodeAttributes).toEqual(
      expect.arrayContaining(['intra_degree_sum', 'inter_degree_sum'])
    )
  })

  it('Physical-node by_layer Maps are populated for every layer the node occupies', () => {
    const m = parseMultilayerData(makeMultiplex2())
    const A = m.nodes.find(n => n.node_name === 'A')
    expect(A.layers_present.sort()).toEqual(['L1', 'L2'])
    expect(A.intra_degree_by_layer.get('L1')).toBe(1)
    expect(A.intra_degree_by_layer.get('L2')).toBe(1)
    expect(A.inter_degree_by_layer.get('L1')).toBe(1)
    expect(A.inter_degree_by_layer.get('L2')).toBe(1)
  })
})

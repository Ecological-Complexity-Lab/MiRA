/**
 * calculations.test.js — Verifies layer-level and network-level statistics.
 *
 * Tests the values produced by Dashboard._computeStats(), which aggregates
 * per-layer edge counts, densities, and Jaccard similarity matrices.
 * All expected values are hand-calculated from the fixture topology.
 *
 * Fixtures mirror the JSON files in tests/fixtures/calc_*.json so the user
 * can visually verify the same values by loading those files in the browser.
 */

import { describe, it, expect } from 'vitest'
import { parseMultilayerData } from '../js/dataParser.js'
import { Dashboard } from '../js/dashboard.js'

// Build a Dashboard around a model and pull out computed stats.
// We pass null as the container — _computeStats() is pure data and never
// touches the DOM; only render() does.
function stats(rawJson) {
  const model = parseMultilayerData(rawJson)
  const dash  = new Dashboard(null, model)
  return dash._computeStats()
}

// ── Fixture factories ────────────────────────────────────────────────────────

function makeTriangle() {
  return {
    directed: false,
    layers: [{ layer_id: 1, layer_name: 'L1' }],
    nodes: [
      { node_id: 'A', node_name: 'A' },
      { node_id: 'B', node_name: 'B' },
      { node_id: 'C', node_name: 'C' },
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

function makeTrianglePlusIsolated() {
  return {
    directed: false,
    layers: [{ layer_id: 1, layer_name: 'L1' }],
    nodes: [
      { node_id: 'A', node_name: 'A' },
      { node_id: 'B', node_name: 'B' },
      { node_id: 'C', node_name: 'C' },
      { node_id: 'D', node_name: 'D' },
    ],
    state_nodes: [
      { layer_name: 'L1', node_name: 'A' },
      { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L1', node_name: 'C' },
      { layer_name: 'L1', node_name: 'D' },
    ],
    extended: [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 1 },
      { layer_from: 'L1', node_from: 'C', layer_to: 'L1', node_to: 'A', weight: 1 },
    ],
  }
}

function makeBipartiteComplete2x3() {
  return {
    directed: false,
    layers: [{ layer_id: 1, layer_name: 'BL', bipartite: true }],
    nodes: [
      { node_id: 'P1', node_name: 'P1', node_type: 'plant' },
      { node_id: 'P2', node_name: 'P2', node_type: 'plant' },
      { node_id: 'B1', node_name: 'B1', node_type: 'bird' },
      { node_id: 'B2', node_name: 'B2', node_type: 'bird' },
      { node_id: 'B3', node_name: 'B3', node_type: 'bird' },
    ],
    state_nodes: [
      { layer_name: 'BL', node_name: 'P1' },
      { layer_name: 'BL', node_name: 'P2' },
      { layer_name: 'BL', node_name: 'B1' },
      { layer_name: 'BL', node_name: 'B2' },
      { layer_name: 'BL', node_name: 'B3' },
    ],
    extended: [
      { layer_from: 'BL', node_from: 'P1', layer_to: 'BL', node_to: 'B1', weight: 1 },
      { layer_from: 'BL', node_from: 'P1', layer_to: 'BL', node_to: 'B2', weight: 1 },
      { layer_from: 'BL', node_from: 'P1', layer_to: 'BL', node_to: 'B3', weight: 1 },
      { layer_from: 'BL', node_from: 'P2', layer_to: 'BL', node_to: 'B1', weight: 1 },
      { layer_from: 'BL', node_from: 'P2', layer_to: 'BL', node_to: 'B2', weight: 1 },
      { layer_from: 'BL', node_from: 'P2', layer_to: 'BL', node_to: 'B3', weight: 1 },
    ],
  }
}

function makeTwoIdenticalLayers() {
  return {
    directed: false,
    layers: [
      { layer_id: 1, layer_name: 'L1' },
      { layer_id: 2, layer_name: 'L2' },
    ],
    nodes: [
      { node_id: 'A', node_name: 'A' },
      { node_id: 'B', node_name: 'B' },
      { node_id: 'C', node_name: 'C' },
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
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 1 },
      { layer_from: 'L1', node_from: 'C', layer_to: 'L1', node_to: 'A', weight: 1 },
      { layer_from: 'L2', node_from: 'A', layer_to: 'L2', node_to: 'B', weight: 1 },
      { layer_from: 'L2', node_from: 'B', layer_to: 'L2', node_to: 'C', weight: 1 },
      { layer_from: 'L2', node_from: 'C', layer_to: 'L2', node_to: 'A', weight: 1 },
    ],
  }
}

function makeTwoDisjointLayers() {
  return {
    directed: false,
    layers: [
      { layer_id: 1, layer_name: 'L1' },
      { layer_id: 2, layer_name: 'L2' },
    ],
    nodes: [
      { node_id: 'A', node_name: 'A' },
      { node_id: 'B', node_name: 'B' },
      { node_id: 'C', node_name: 'C' },
      { node_id: 'D', node_name: 'D' },
      { node_id: 'E', node_name: 'E' },
      { node_id: 'F', node_name: 'F' },
    ],
    state_nodes: [
      { layer_name: 'L1', node_name: 'A' },
      { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L1', node_name: 'C' },
      { layer_name: 'L2', node_name: 'D' },
      { layer_name: 'L2', node_name: 'E' },
      { layer_name: 'L2', node_name: 'F' },
    ],
    extended: [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      { layer_from: 'L1', node_from: 'B', layer_to: 'L1', node_to: 'C', weight: 1 },
      { layer_from: 'L1', node_from: 'C', layer_to: 'L1', node_to: 'A', weight: 1 },
      { layer_from: 'L2', node_from: 'D', layer_to: 'L2', node_to: 'E', weight: 1 },
      { layer_from: 'L2', node_from: 'E', layer_to: 'L2', node_to: 'F', weight: 1 },
      { layer_from: 'L2', node_from: 'F', layer_to: 'L2', node_to: 'D', weight: 1 },
    ],
  }
}

function makeInterlayerNetwork() {
  // L1: A-B, L2: A-C, interlayer: L1::A → L2::A
  return {
    directed: false,
    layers: [
      { layer_id: 1, layer_name: 'L1' },
      { layer_id: 2, layer_name: 'L2' },
    ],
    nodes: [
      { node_id: 'A', node_name: 'A' },
      { node_id: 'B', node_name: 'B' },
      { node_id: 'C', node_name: 'C' },
    ],
    state_nodes: [
      { layer_name: 'L1', node_name: 'A' },
      { layer_name: 'L1', node_name: 'B' },
      { layer_name: 'L2', node_name: 'A' },
      { layer_name: 'L2', node_name: 'C' },
    ],
    extended: [
      { layer_from: 'L1', node_from: 'A', layer_to: 'L1', node_to: 'B', weight: 1 },
      { layer_from: 'L2', node_from: 'A', layer_to: 'L2', node_to: 'C', weight: 1 },
      { layer_from: 'L1', node_from: 'A', layer_to: 'L2', node_to: 'A', weight: 1 },
    ],
  }
}

// ── Group 12 — Layer edge count and density ──────────────────────────────────

describe('Group 12 — Layer edge count and density', () => {
  it('12.1 triangle: E=3 and density=1.0 (complete graph K3)', () => {
    const s = stats(makeTriangle())
    const L1 = s.perLayer.find(l => l.layerName === 'L1')
    expect(L1.E).toBe(3)
    expect(L1.density).toBeCloseTo(1.0, 6)
  })

  it('12.2 triangle + isolated: E=3, N=4, density=0.5', () => {
    const s = stats(makeTrianglePlusIsolated())
    const L1 = s.perLayer.find(l => l.layerName === 'L1')
    expect(L1.E).toBe(3)
    expect(L1.N).toBe(4)
    // density = 3 / (4*3/2) = 3/6 = 0.5
    expect(L1.density).toBeCloseTo(0.5, 6)
  })

  it('12.3 complete bipartite 2×3: E=6 and density=1.0', () => {
    const s = stats(makeBipartiteComplete2x3())
    const BL = s.perLayer.find(l => l.layerName === 'BL')
    expect(BL.E).toBe(6)
    // density = 6 / (2*3) = 1.0
    expect(BL.density).toBeCloseTo(1.0, 6)
  })

  it('12.4 two identical layers both have density=1.0', () => {
    const s = stats(makeTwoIdenticalLayers())
    for (const layer of s.perLayer) {
      expect(layer.density).toBeCloseTo(1.0, 6)
    }
  })

  it('12.5 average density across two identical layers is 1.0', () => {
    const s = stats(makeTwoIdenticalLayers())
    expect(s.avgDensity).toBeCloseTo(1.0, 6)
  })

  it('12.6 edge count is not double-counted for undirected data', () => {
    // The triangle has exactly 3 unique pairs — not 6
    const s = stats(makeTriangle())
    expect(s.totalIntra).toBe(3)
  })

  it('12.7 interlayer and intralayer counts are split correctly', () => {
    const s = stats(makeInterlayerNetwork())
    // 2 intralayer (L1:A-B, L2:A-C) + 1 interlayer (L1::A → L2::A)
    expect(s.totalIntra).toBe(2)
    expect(s.totalInter).toBe(1)
  })
})

// ── Group 13 — Jaccard similarity ───────────────────────────────────────────

describe('Group 13 — Jaccard similarity', () => {
  // Jaccard is computed inside _sLayerSimilarity, not _computeStats, so we
  // re-implement the same formula here to verify the inputs are correct, and
  // test _computeStats outputs that feed into Jaccard (node sets, edge key sets).

  function jaccard(A, B) {
    if (!A.size && !B.size) return NaN
    let inter = 0
    const [small, large] = A.size <= B.size ? [A, B] : [B, A]
    for (const x of small) if (large.has(x)) inter++
    return inter / (A.size + B.size - inter)
  }

  it('13.1 identical layers: node Jaccard = 1.0', () => {
    const model = parseMultilayerData(makeTwoIdenticalLayers())
    const s1 = model.nodesPerLayer.get('L1')
    const s2 = model.nodesPerLayer.get('L2')
    expect(jaccard(s1, s2)).toBeCloseTo(1.0, 6)
  })

  it('13.2 disjoint layers: node Jaccard = 0.0', () => {
    const model = parseMultilayerData(makeTwoDisjointLayers())
    const s1 = model.nodesPerLayer.get('L1')
    const s2 = model.nodesPerLayer.get('L2')
    expect(jaccard(s1, s2)).toBeCloseTo(0.0, 6)
  })

  it('13.3 partial overlap: node Jaccard = 1/3', () => {
    // L1:{A,B}, L2:{A,C} → shared={A}, union={A,B,C}=3 → Jaccard=1/3
    const model = parseMultilayerData(makeInterlayerNetwork())
    const s1 = model.nodesPerLayer.get('L1')
    const s2 = model.nodesPerLayer.get('L2')
    expect(jaccard(s1, s2)).toBeCloseTo(1 / 3, 6)
  })

  it('13.4 identical layers: edge Jaccard = 1.0', () => {
    const s = stats(makeTwoIdenticalLayers())
    const e1 = s.edgeKeySets.get('L1')
    const e2 = s.edgeKeySets.get('L2')
    expect(jaccard(e1, e2)).toBeCloseTo(1.0, 6)
  })

  it('13.5 disjoint layers: edge Jaccard = 0.0', () => {
    const s = stats(makeTwoDisjointLayers())
    const e1 = s.edgeKeySets.get('L1')
    const e2 = s.edgeKeySets.get('L2')
    expect(jaccard(e1, e2)).toBeCloseTo(0.0, 6)
  })

  it('13.6 edge key sets are correctly deduplicated for undirected edges', () => {
    // Each layer has 3 unique undirected edges, not 6
    const s = stats(makeTwoIdenticalLayers())
    expect(s.edgeKeySets.get('L1').size).toBe(3)
    expect(s.edgeKeySets.get('L2').size).toBe(3)
  })
})

// ── Group 14 — Node participation ───────────────────────────────────────────

describe('Group 14 — Node participation', () => {
  it('14.1 all nodes in one layer have participation=1', () => {
    const s = stats(makeTriangle())
    for (const [, count] of s.nodeParticipation) {
      expect(count).toBe(1)
    }
  })

  it('14.2 nodes shared across two identical layers have participation=2', () => {
    const s = stats(makeTwoIdenticalLayers())
    for (const [, count] of s.nodeParticipation) {
      expect(count).toBe(2)
    }
  })

  it('14.3 disjoint layers: all nodes have participation=1', () => {
    const s = stats(makeTwoDisjointLayers())
    for (const [, count] of s.nodeParticipation) {
      expect(count).toBe(1)
    }
  })

  it('14.4 node A appears in both layers (participation=2); B and C appear in one', () => {
    // L1:{A,B}, L2:{A,C}
    const s = stats(makeInterlayerNetwork())
    expect(s.nodeParticipation.get('A')).toBe(2)
    expect(s.nodeParticipation.get('B')).toBe(1)
    expect(s.nodeParticipation.get('C')).toBe(1)
  })
})

// ── Group 15 — Bipartite set sizes ──────────────────────────────────────────

describe('Group 15 — Bipartite set sizes in stats', () => {
  it('15.1 complete bipartite 2×3: nA=3 (bird), nB=2 (plant) — alphabetical type order', () => {
    const s = stats(makeBipartiteComplete2x3())
    const BL = s.perLayer.find(l => l.layerName === 'BL')
    // setA = "bird" (alphabetically first) = 3 nodes; setB = "plant" = 2 nodes
    expect(BL.nA).toBe(3)
    expect(BL.nB).toBe(2)
  })

  it('15.2 complete bipartite 2×3: isBipartite flag is true', () => {
    const s = stats(makeBipartiteComplete2x3())
    expect(s.isBipartite).toBe(true)
  })

  it('15.3 non-bipartite network: isBipartite flag is false', () => {
    const s = stats(makeTriangle())
    expect(s.isBipartite).toBe(false)
  })
})

// ── Group 16 — 3-layer unipartite Jaccard ────────────────────────────────────

import calcJ from './fixtures/calc_J_unipartite_3layers.json' assert { type: 'json' }

describe('Group 16 — 3-layer unipartite Jaccard', () => {
  function jaccard(A, B) {
    if (!A.size && !B.size) return NaN
    let inter = 0
    const [small, large] = A.size <= B.size ? [A, B] : [B, A]
    for (const x of small) if (large.has(x)) inter++
    return inter / (A.size + B.size - inter)
  }

  it('16.1 node Jaccard L1-L2 = 0.5', () => {
    const model = parseMultilayerData(calcJ)
    expect(jaccard(model.nodesPerLayer.get('L1'), model.nodesPerLayer.get('L2'))).toBeCloseTo(0.5, 6)
  })

  it('16.2 node Jaccard L1-L3 = 0.5', () => {
    const model = parseMultilayerData(calcJ)
    expect(jaccard(model.nodesPerLayer.get('L1'), model.nodesPerLayer.get('L3'))).toBeCloseTo(0.5, 6)
  })

  it('16.3 node Jaccard L2-L3 = 0.5', () => {
    const model = parseMultilayerData(calcJ)
    expect(jaccard(model.nodesPerLayer.get('L2'), model.nodesPerLayer.get('L3'))).toBeCloseTo(0.5, 6)
  })

  it('16.4 edge Jaccard L1-L2 = 1/3', () => {
    const s = stats(calcJ)
    expect(jaccard(s.edgeKeySets.get('L1'), s.edgeKeySets.get('L2'))).toBeCloseTo(1 / 3, 6)
  })

  it('16.5 edge Jaccard L1-L3 = 1/3', () => {
    const s = stats(calcJ)
    expect(jaccard(s.edgeKeySets.get('L1'), s.edgeKeySets.get('L3'))).toBeCloseTo(1 / 3, 6)
  })

  it('16.6 edge Jaccard L2-L3 = 0.0', () => {
    const s = stats(calcJ)
    expect(jaccard(s.edgeKeySets.get('L2'), s.edgeKeySets.get('L3'))).toBeCloseTo(0.0, 6)
  })
})

// ── Group 17 — 3-layer bipartite Jaccard ─────────────────────────────────────

import calcK from './fixtures/calc_K_bipartite_3layers.json' assert { type: 'json' }

describe('Group 17 — 3-layer bipartite Jaccard', () => {
  function jaccard(A, B) {
    if (!A.size && !B.size) return NaN
    let inter = 0
    const [small, large] = A.size <= B.size ? [A, B] : [B, A]
    for (const x of small) if (large.has(x)) inter++
    return inter / (A.size + B.size - inter)
  }

  function layerSetA(model, s, ln) {
    return new Set([...model.nodesPerLayer.get(ln)].filter(x => s.setANodes.has(x)))
  }
  function layerSetB(model, s, ln) {
    return new Set([...model.nodesPerLayer.get(ln)].filter(x => s.setBNodes.has(x)))
  }

  it('17.1 setA (bird) Jaccard L1-L2 = 1.0', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetA(model, s, 'L1'), layerSetA(model, s, 'L2'))).toBeCloseTo(1.0, 6)
  })

  it('17.2 setA (bird) Jaccard L1-L3 = 0.5', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetA(model, s, 'L1'), layerSetA(model, s, 'L3'))).toBeCloseTo(0.5, 6)
  })

  it('17.3 setA (bird) Jaccard L2-L3 = 0.5', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetA(model, s, 'L2'), layerSetA(model, s, 'L3'))).toBeCloseTo(0.5, 6)
  })

  it('17.4 setB (plant) Jaccard L1-L2 = 1/3', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetB(model, s, 'L1'), layerSetB(model, s, 'L2'))).toBeCloseTo(1 / 3, 6)
  })

  it('17.5 setB (plant) Jaccard L1-L3 = 1/3', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetB(model, s, 'L1'), layerSetB(model, s, 'L3'))).toBeCloseTo(1 / 3, 6)
  })

  it('17.6 setB (plant) Jaccard L2-L3 = 1/3', () => {
    const model = parseMultilayerData(calcK)
    const s = stats(calcK)
    expect(jaccard(layerSetB(model, s, 'L2'), layerSetB(model, s, 'L3'))).toBeCloseTo(1 / 3, 6)
  })

  it('17.7 edge Jaccard L1-L2 = 0.25', () => {
    const s = stats(calcK)
    expect(jaccard(s.edgeKeySets.get('L1'), s.edgeKeySets.get('L2'))).toBeCloseTo(0.25, 6)
  })

  it('17.8 edge Jaccard L1-L3 = 0.25', () => {
    const s = stats(calcK)
    expect(jaccard(s.edgeKeySets.get('L1'), s.edgeKeySets.get('L3'))).toBeCloseTo(0.25, 6)
  })

  it('17.9 edge Jaccard L2-L3 = 1/3', () => {
    const s = stats(calcK)
    expect(jaccard(s.edgeKeySets.get('L2'), s.edgeKeySets.get('L3'))).toBeCloseTo(1 / 3, 6)
  })
})

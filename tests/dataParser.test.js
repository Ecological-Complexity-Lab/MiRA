/**
 * dataParser.test.js — Unit tests for parseMultilayerData()
 *
 * These tests use small, hand-crafted JS objects as input (no files on disk).
 * Every logical branch in dataParser.js has at least one test here.
 *
 * WHY FIXTURE FACTORIES instead of shared objects:
 *   parseMultilayerData() mutates its input — it writes degree, strength, etc.
 *   directly onto the state_nodes objects. If tests shared a single fixture
 *   object, the first test to run would pollute the data for all subsequent
 *   ones. Factory functions return a fresh deep copy every time they are called.
 *
 * TEST GROUPS:
 *   1. Validation          — bad input is rejected with a clear error
 *   2. Lookup maps         — nodes/layers/stateNodes indexed by id and name
 *   3. Link classification — intra vs. interlayer split
 *   4. Degree & strength   — per-state-node metrics computed correctly
 *   5. Directed flag       — detected from global / layer / link; propagated
 *   6. Attribute names     — extra fields surfaced for colour/size dropdowns
 *   7. Bipartite explicit  — detected via layer.bipartite + node_type
 *   8. Bipartite BFS       — auto-detected via 2-colouring
 *   9. Mixed multilayer    — per-layer independence when types differ
 */

import { describe, it, expect } from 'vitest'
import { parseMultilayerData } from '../js/dataParser.js'

// ── Fixture factories ────────────────────────────────────────────────────────

/**
 * Two-layer, two-node network.
 * Topology:
 *   LayerA:  Bee ── Flower   (intralayer, weight 1)
 *   LayerA→B: Bee ──── Bee   (interlayer, no weight)
 *   Bee appears in both layers; Flower only in LayerA.
 *
 * Used by: Groups 2, 3, 5, 6 and as a base for ad-hoc mutations.
 */
function makeMinimal() {
  return {
    layers: [
      { layer_id: 1, layer_name: 'LayerA' },
      { layer_id: 2, layer_name: 'LayerB' },
    ],
    nodes: [
      { node_id: 'n1', node_name: 'Bee' },
      { node_id: 'n2', node_name: 'Flower' },
    ],
    // 1 intralayer (LayerA) + 1 interlayer (A→B)
    extended: [
      { layer_from: 'LayerA', node_from: 'Bee',    layer_to: 'LayerA', node_to: 'Flower', weight: 1 },
      { layer_from: 'LayerA', node_from: 'Bee',    layer_to: 'LayerB', node_to: 'Bee' },
    ],
    state_nodes: [
      { layer_name: 'LayerA', node_name: 'Bee' },
      { layer_name: 'LayerA', node_name: 'Flower' },
      { layer_name: 'LayerB', node_name: 'Bee' },
    ],
  }
}

/**
 * Single-layer directed network.
 * Topology: A ──→ B (weight 2.5),  C ──→ B (weight 1.0)
 * B is the only node with incoming edges (in_degree 2).
 * directed flag is set per-link (not globally) to reflect how real files work.
 *
 * Used by: Group 4 (degree arithmetic on directed graphs).
 */
function makeWeightedDirected() {
  return {
    layers: [{ layer_id: 1, layer_name: 'L' }],
    nodes: [
      { node_id: 'a', node_name: 'A' },
      { node_id: 'b', node_name: 'B' },
      { node_id: 'c', node_name: 'C' },
    ],
    extended: [
      { layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'B', weight: 2.5, directed: true },
      { layer_from: 'L', node_from: 'C', layer_to: 'L', node_to: 'B', weight: 1.0, directed: true },
    ],
    state_nodes: [
      { layer_name: 'L', node_name: 'A' },
      { layer_name: 'L', node_name: 'B' },
      { layer_name: 'L', node_name: 'C' },
    ],
  }
}

/**
 * Single bipartite layer declared explicitly via layer.bipartite=true.
 * Nodes carry node_type: 'plant' | 'insect' — the two sets are unambiguous.
 * Topology: Plant1─Insect1, Plant2─Insect2  (no cross-set edges in this fixture,
 * but the explicit path uses node_type, not graph structure).
 *
 * Used by: Group 7.
 */
function makeBipartiteExplicit() {
  return {
    layers: [{ layer_id: 1, layer_name: 'BL', bipartite: true }],
    nodes: [
      { node_id: 'p1', node_name: 'Plant1',  node_type: 'plant' },
      { node_id: 'p2', node_name: 'Plant2',  node_type: 'plant' },
      { node_id: 'i1', node_name: 'Insect1', node_type: 'insect' },
      { node_id: 'i2', node_name: 'Insect2', node_type: 'insect' },
    ],
    extended: [
      { layer_from: 'BL', node_from: 'Plant1',  layer_to: 'BL', node_to: 'Insect1' },
      { layer_from: 'BL', node_from: 'Plant2',  layer_to: 'BL', node_to: 'Insect2' },
    ],
    state_nodes: [
      { layer_name: 'BL', node_name: 'Plant1' },
      { layer_name: 'BL', node_name: 'Plant2' },
      { layer_name: 'BL', node_name: 'Insect1' },
      { layer_name: 'BL', node_name: 'Insect2' },
    ],
  }
}

/**
 * Single bipartite layer with NO node_type and NO layer.bipartite flag.
 * Bipartite structure must be found purely by BFS 2-colouring the edge graph.
 * Topology: A1─B1, A1─B2, A2─B1
 *   Natural sets: {A1, A2} and {B1, B2} — all edges cross between the sets.
 *
 * Used by: Group 8.
 */
function makeBipartiteAuto() {
  return {
    layers: [{ layer_id: 1, layer_name: 'AL' }],
    nodes: [
      { node_id: 'a1', node_name: 'A1', node_type: 'setA' },
      { node_id: 'a2', node_name: 'A2', node_type: 'setA' },
      { node_id: 'b1', node_name: 'B1', node_type: 'setB' },
      { node_id: 'b2', node_name: 'B2', node_type: 'setB' },
    ],
    extended: [
      { layer_from: 'AL', node_from: 'A1', layer_to: 'AL', node_to: 'B1' },
      { layer_from: 'AL', node_from: 'A1', layer_to: 'AL', node_to: 'B2' },
      { layer_from: 'AL', node_from: 'A2', layer_to: 'AL', node_to: 'B1' },
    ],
    state_nodes: [
      { layer_name: 'AL', node_name: 'A1' },
      { layer_name: 'AL', node_name: 'A2' },
      { layer_name: 'AL', node_name: 'B1' },
      { layer_name: 'AL', node_name: 'B2' },
    ],
  }
}

// ── Group 1 — Validation ─────────────────────────────────────────────────────
// parseMultilayerData() validates the four required top-level array fields
// before doing any work. Missing or wrong-typed fields must throw immediately
// with an error message that names the offending field — important for users
// debugging why their JSON file failed to load.

describe('Group 1 — Validation', () => {
  it('1.1 throws when "nodes" field is missing', () => {
    const input = { layers: [], extended: [], state_nodes: [] }
    expect(() => parseMultilayerData(input)).toThrow(/"nodes"/)
  })

  it('1.2 throws when "extended" field is missing', () => {
    const input = { nodes: [], layers: [], state_nodes: [] }
    expect(() => parseMultilayerData(input)).toThrow(/"extended"/)
  })

  it('1.3 throws when "layers" is not an array', () => {
    const input = { nodes: [], layers: {}, extended: [], state_nodes: [] }
    expect(() => parseMultilayerData(input)).toThrow(/"layers"/)
  })

  it('1.4 does not throw when all required fields are empty arrays', () => {
    // Empty network is valid — the app shows an empty canvas.
    const input = { nodes: [], layers: [], extended: [], state_nodes: [] }
    expect(() => parseMultilayerData(input)).not.toThrow()
  })
})

// ── Group 2 — Lookup maps ────────────────────────────────────────────────────
// The model exposes four Maps for O(1) lookups that every other module uses.
// Correct key types matter: node_id can be a number or string depending on
// the source file, so we test with the exact id types from the fixture.

describe('Group 2 — Lookup maps', () => {
  it('2.1 nodesById returns the correct node object', () => {
    const model = parseMultilayerData(makeMinimal())
    expect(model.nodesById.get('n1').node_name).toBe('Bee')
    expect(model.nodesById.get('n2').node_name).toBe('Flower')
  })

  it('2.2 nodesByName returns the correct node object', () => {
    const model = parseMultilayerData(makeMinimal())
    expect(model.nodesByName.get('Bee').node_id).toBe('n1')
  })

  it('2.3 layersById returns the correct layer', () => {
    const model = parseMultilayerData(makeMinimal())
    expect(model.layersById.get(1).layer_name).toBe('LayerA')
    expect(model.layersById.get(2).layer_name).toBe('LayerB')
  })

  it('2.4 stateNodeMap uses "layerName::nodeName" keys and contains every state node', () => {
    // The "layerName::nodeName" key format is used throughout the renderer and
    // dashboard to look up state-nodes. If the format changes, everything breaks.
    const model = parseMultilayerData(makeMinimal())
    expect(model.stateNodeMap.has('LayerA::Bee')).toBe(true)
    expect(model.stateNodeMap.has('LayerA::Flower')).toBe(true)
    expect(model.stateNodeMap.has('LayerB::Bee')).toBe(true)
    expect(model.stateNodeMap.size).toBe(3)
  })
})

// ── Group 3 — Link classification ───────────────────────────────────────────
// Every link in extended[] is classified as intralayer (same layer on both
// ends) or interlayer (different layers). The renderer draws these differently:
// intralayer links stay flat on a layer plane; interlayer links are curved
// Bézier arcs connecting layer planes.

describe('Group 3 — Link classification', () => {
  it('3.1 all links are intralayer when layer_from === layer_to', () => {
    const input = makeMinimal()
    input.extended = [
      { layer_from: 'LayerA', node_from: 'Bee', layer_to: 'LayerA', node_to: 'Flower' },
    ]
    const model = parseMultilayerData(input)
    expect(model.intralayerLinks).toHaveLength(1)
    expect(model.interlayerLinks).toHaveLength(0)
  })

  it('3.2 all links are interlayer when layer_from !== layer_to', () => {
    const input = makeMinimal()
    input.extended = [
      { layer_from: 'LayerA', node_from: 'Bee', layer_to: 'LayerB', node_to: 'Bee' },
    ]
    const model = parseMultilayerData(input)
    expect(model.intralayerLinks).toHaveLength(0)
    expect(model.interlayerLinks).toHaveLength(1)
  })

  it('3.3 mixed links are split into the correct arrays', () => {
    // makeMinimal() has exactly 1 intra + 1 inter link — verifies the split
    // and that the classification criterion is applied to each link individually.
    const model = parseMultilayerData(makeMinimal())
    expect(model.intralayerLinks).toHaveLength(1)
    expect(model.interlayerLinks).toHaveLength(1)
    expect(model.intralayerLinks[0].layer_from).toBe(model.intralayerLinks[0].layer_to)
    expect(model.interlayerLinks[0].layer_from).not.toBe(model.interlayerLinks[0].layer_to)
  })
})

// ── Group 4 — Degree and strength ───────────────────────────────────────────
// parseMultilayerData computes per-state-node metrics in a single O(E) pass
// over the edge list and writes them directly onto state_node objects.
// These metrics drive the colour/size dropdowns in the UI.
//
// Key subtleties tested here:
//   - Self-loops must not be double-counted (the "fromKey !== toKey" guard)
//   - Missing weight defaults to 1 (not 0, not undefined)
//   - in/out degree are only meaningful when directed=true per-link

describe('Group 4 — Degree and strength', () => {
  it('4.1 undirected edge increments degree and strength on both endpoints', () => {
    const input = {
      layers: [{ layer_id: 1, layer_name: 'L' }],
      nodes: [{ node_id: 'a', node_name: 'A' }, { node_id: 'b', node_name: 'B' }],
      extended: [{ layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'B', weight: 1 }],
      state_nodes: [{ layer_name: 'L', node_name: 'A' }, { layer_name: 'L', node_name: 'B' }],
    }
    const model = parseMultilayerData(input)
    expect(model.stateNodeMap.get('L::A').degree).toBe(1)
    expect(model.stateNodeMap.get('L::A').strength).toBe(1)
    expect(model.stateNodeMap.get('L::B').degree).toBe(1)
    expect(model.stateNodeMap.get('L::B').strength).toBe(1)
  })

  it('4.2 explicit weight is accumulated into strength', () => {
    const input = {
      layers: [{ layer_id: 1, layer_name: 'L' }],
      nodes: [{ node_id: 'a', node_name: 'A' }, { node_id: 'b', node_name: 'B' }],
      extended: [{ layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'B', weight: 2.5 }],
      state_nodes: [{ layer_name: 'L', node_name: 'A' }, { layer_name: 'L', node_name: 'B' }],
    }
    const model = parseMultilayerData(input)
    expect(model.stateNodeMap.get('L::A').strength).toBe(2.5)
    expect(model.stateNodeMap.get('L::B').strength).toBe(2.5)
  })

  it('4.3 missing weight field defaults to 1', () => {
    // Real CSV imports often omit weight. The default must be 1, not 0 or NaN,
    // or the node would appear invisible when sized by strength.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'L' }],
      nodes: [{ node_id: 'a', node_name: 'A' }, { node_id: 'b', node_name: 'B' }],
      extended: [{ layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'B' }],
      state_nodes: [{ layer_name: 'L', node_name: 'A' }, { layer_name: 'L', node_name: 'B' }],
    }
    const model = parseMultilayerData(input)
    expect(model.stateNodeMap.get('L::A').strength).toBe(1)
    expect(model.stateNodeMap.get('L::B').strength).toBe(1)
  })

  it('4.4 self-loop counts degree once, not twice', () => {
    // The parser guards against double-counting by checking fromKey !== toKey
    // before incrementing the destination node. Without this guard, self-loops
    // would produce degree=2 and strength=2.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'L' }],
      nodes: [{ node_id: 'a', node_name: 'A' }],
      extended: [{ layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'A', weight: 1 }],
      state_nodes: [{ layer_name: 'L', node_name: 'A' }],
    }
    const model = parseMultilayerData(input)
    const sn = model.stateNodeMap.get('L::A')
    expect(sn.degree).toBe(1)
    expect(sn.strength).toBe(1)
  })

  it('4.5 directed edge populates in_degree and out_degree correctly', () => {
    // NOTE: in/out degree are computed from per-link directed flags, not the
    // global model.directed flag. The global flag is determined *after* the
    // degree loop, so setting only json.directed=true would leave in/out
    // degree at 0. Real directed files (like demo_directed.json) set
    // directed:true on each individual link.
    const model = parseMultilayerData(makeWeightedDirected())
    // A→B, C→B
    expect(model.stateNodeMap.get('L::A').out_degree).toBe(1)
    expect(model.stateNodeMap.get('L::A').in_degree).toBe(0)
    expect(model.stateNodeMap.get('L::B').in_degree).toBe(2)
    expect(model.stateNodeMap.get('L::B').out_degree).toBe(0)
    expect(model.stateNodeMap.get('L::C').out_degree).toBe(1)
    expect(model.stateNodeMap.get('L::C').in_degree).toBe(0)
  })

  it('4.6 node with two incoming edges has in_degree 2 and degree 2', () => {
    const model = parseMultilayerData(makeWeightedDirected())
    const snB = model.stateNodeMap.get('L::B')
    expect(snB.in_degree).toBe(2)
    expect(snB.degree).toBe(2)
  })
})

// ── Group 5 — Directed flag propagation ─────────────────────────────────────
// The global directed flag is "infectious": if *any* source declares directed,
// the whole model becomes directed and every link gets directed:true written
// onto it (so the renderer draws arrowheads on all edges).
// When the network is undirected, the in/out fields are deleted from state_nodes
// to keep the attribute dropdowns clean.

describe('Group 5 — Directed flag propagation', () => {
  it('5.1 json.directed=true sets model.directed and propagates flag to all links', () => {
    const input = makeMinimal()
    input.directed = true
    const model = parseMultilayerData(input)
    expect(model.directed).toBe(true)
    for (const link of model.extended) {
      expect(link.directed).toBe(true)
    }
  })

  it('5.2 a single layer with directed:true makes the whole model directed', () => {
    const input = makeMinimal()
    input.layers[0].directed = true
    const model = parseMultilayerData(input)
    expect(model.directed).toBe(true)
  })

  it('5.3 a single link with directed:true makes the whole model directed', () => {
    const input = makeMinimal()
    input.extended[0].directed = true
    const model = parseMultilayerData(input)
    expect(model.directed).toBe(true)
  })

  it('5.4 undirected network: model.directed is false and state nodes have no in/out fields', () => {
    // in/out fields are deleted when undirected so they don't appear as
    // spurious "zero" attributes in the colour/size dropdowns.
    const model = parseMultilayerData(makeMinimal())
    expect(model.directed).toBe(false)
    for (const sn of model.stateNodes) {
      expect(sn).not.toHaveProperty('in_degree')
      expect(sn).not.toHaveProperty('out_degree')
      expect(sn).not.toHaveProperty('in_strength')
      expect(sn).not.toHaveProperty('out_strength')
    }
  })
})

// ── Group 6 — Attribute name extraction ─────────────────────────────────────
// Any field beyond the required structural keys is treated as a user attribute
// and surfaced in nodeAttributeNames / linkAttributeNames / layerAttributeNames.
// These lists populate the colour-by and size-by dropdowns in the UI.
// Standard structural keys (node_id, layer_from, etc.) must not appear there.

describe('Group 6 — Attribute name extraction', () => {
  it('6.1 extra node attribute appears in nodeAttributeNames; standard keys excluded', () => {
    const input = makeMinimal()
    input.nodes[0].group = 'pollinator'
    input.nodes[1].group = 'plant'
    const model = parseMultilayerData(input)
    expect(model.nodeAttributeNames).toContain('group')
    expect(model.nodeAttributeNames).not.toContain('node_id')
    expect(model.nodeAttributeNames).not.toContain('node_name')
  })

  it('6.2 extra link attribute appears in linkAttributeNames; standard keys excluded', () => {
    const input = makeMinimal()
    input.extended[0].type = 'mutualism'
    const model = parseMultilayerData(input)
    expect(model.linkAttributeNames).toContain('type')
    expect(model.linkAttributeNames).not.toContain('layer_from')
    expect(model.linkAttributeNames).not.toContain('node_from')
    expect(model.linkAttributeNames).not.toContain('weight')
  })

  it('6.3 extra layer attribute appears in layerAttributeNames; standard keys excluded', () => {
    const input = makeMinimal()
    input.layers[0].habitat = 'forest'
    const model = parseMultilayerData(input)
    expect(model.layerAttributeNames).toContain('habitat')
    expect(model.layerAttributeNames).not.toContain('layer_id')
    expect(model.layerAttributeNames).not.toContain('layer_name')
  })
})

// ── Group 7 — Bipartite detection: explicit ──────────────────────────────────
// Explicit detection requires BOTH layer.bipartite===true AND nodes having a
// node_type (or type) attribute with exactly 2 distinct values.
// This is the preferred path: it preserves the user's intended set labels.

describe('Group 7 — Bipartite detection: explicit', () => {
  it('7.1 layer.bipartite=true with node_type splits nodes into correct sets', () => {
    const model = parseMultilayerData(makeBipartiteExplicit())
    const info = model.bipartiteInfo.get('BL')
    expect(info.isBipartite).toBe(true)
    expect(info.explicit).toBe(true)
    // Set A/B are assigned in alphabetical sort order of node_type values
    // ('insect' < 'plant'), so insects land in Set A and plants in Set B.
    expect(info.setA).toEqual(new Set(['Insect1', 'Insect2']))
    expect(info.setB).toEqual(new Set(['Plant1', 'Plant2']))
  })

  it('7.2 explicit detection works when nodes use "type" instead of "node_type"', () => {
    // The parser accepts both field names to handle inconsistent ecological data files.
    const input = makeBipartiteExplicit()
    for (const node of input.nodes) {
      node.type = node.node_type
      delete node.node_type
    }
    const model = parseMultilayerData(input)
    const info = model.bipartiteInfo.get('BL')
    expect(info.isBipartite).toBe(true)
    expect(info.explicit).toBe(true)
  })

  it('7.3 layer.bipartite=true with only 1 distinct node_type → warning logged, treated as unipartite', () => {
    // Explicit path requires exactly 2 distinct types. If all nodes have the
    // same type, the condition fails, a console.warn is emitted, and the layer
    // is treated as unipartite. BFS auto-detect no longer runs as a fallback.
    const input = makeBipartiteExplicit()
    for (const node of input.nodes) node.node_type = 'plant' // all same type
    const model = parseMultilayerData(input)
    const info = model.bipartiteInfo.get('BL')
    expect(info.isBipartite).toBe(false)
  })
})

// ── Group 8 — Bipartite detection: auto-detect BFS ──────────────────────────
// When no explicit declaration is found, the parser runs BFS 2-colouring on
// each layer's intralayer edges. A graph is 2-colourable (bipartite) if and
// only if it has no odd-length cycles.
//
// Corner cases that must NOT be falsely detected as bipartite:
//   - Single node (trivial, meaningless split)
//   - Zero edges (isolated nodes cannot be partitioned meaningfully)
//   - Odd cycle (triangle is the simplest failure case)
//
// The BFS handles disconnected graphs by restarting from each unvisited node,
// so two separate bipartite components together are still bipartite overall.

describe('Group 8 — Bipartite detection: auto-detect BFS', () => {
  it('8.1 without layer.bipartite=true, graph is not detected as bipartite even if structurally bipartite', () => {
    // BFS auto-detection has been removed. Without an explicit layer.bipartite=true flag,
    // the layer is always treated as unipartite regardless of its edge structure.
    const model = parseMultilayerData(makeBipartiteAuto())
    const info = model.bipartiteInfo.get('AL')
    expect(info.isBipartite).toBe(false)
  })

  it('8.2 triangle (odd cycle) is not bipartite', () => {
    // X─Y─Z─X: every cycle has length 3 (odd). BFS detects the conflict when
    // it tries to colour Z's neighbour X and finds X already has Z's colour.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'TL' }],
      nodes: [
        { node_id: 'x', node_name: 'X' },
        { node_id: 'y', node_name: 'Y' },
        { node_id: 'z', node_name: 'Z' },
      ],
      extended: [
        { layer_from: 'TL', node_from: 'X', layer_to: 'TL', node_to: 'Y' },
        { layer_from: 'TL', node_from: 'Y', layer_to: 'TL', node_to: 'Z' },
        { layer_from: 'TL', node_from: 'Z', layer_to: 'TL', node_to: 'X' },
      ],
      state_nodes: [
        { layer_name: 'TL', node_name: 'X' },
        { layer_name: 'TL', node_name: 'Y' },
        { layer_name: 'TL', node_name: 'Z' },
      ],
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('TL').isBipartite).toBe(false)
  })

  it('8.3 without layer.bipartite=true, disconnected bipartite components are not detected', () => {
    // BFS auto-detection has been removed. Without an explicit layer.bipartite=true flag,
    // the layer is always treated as unipartite regardless of its edge structure.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'DL' }],
      nodes: [
        { node_id: 'a1', node_name: 'A1', node_type: 'setA' },
        { node_id: 'b1', node_name: 'B1', node_type: 'setB' },
        { node_id: 'a2', node_name: 'A2', node_type: 'setA' },
        { node_id: 'b2', node_name: 'B2', node_type: 'setB' },
      ],
      extended: [
        { layer_from: 'DL', node_from: 'A1', layer_to: 'DL', node_to: 'B1' },
        { layer_from: 'DL', node_from: 'A2', layer_to: 'DL', node_to: 'B2' },
      ],
      state_nodes: [
        { layer_name: 'DL', node_name: 'A1' },
        { layer_name: 'DL', node_name: 'B1' },
        { layer_name: 'DL', node_name: 'A2' },
        { layer_name: 'DL', node_name: 'B2' },
      ],
    }
    const model = parseMultilayerData(input)
    const info = model.bipartiteInfo.get('DL')
    expect(info.isBipartite).toBe(false)
  })

  it('8.4 single-node layer is not bipartite', () => {
    // The parser short-circuits on nodeArray.length <= 1. A single node
    // cannot form two non-empty sets.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'SL' }],
      nodes: [{ node_id: 'a', node_name: 'A' }],
      extended: [],
      state_nodes: [{ layer_name: 'SL', node_name: 'A' }],
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('SL').isBipartite).toBe(false)
  })

  it('8.5 layer with multiple nodes but zero edges is not bipartite', () => {
    // Isolated nodes with no edges are explicitly excluded. Without edges,
    // BFS cannot determine which set each node belongs to.
    const input = {
      layers: [{ layer_id: 1, layer_name: 'EL' }],
      nodes: [{ node_id: 'a', node_name: 'A' }, { node_id: 'b', node_name: 'B' }],
      extended: [],
      state_nodes: [
        { layer_name: 'EL', node_name: 'A' },
        { layer_name: 'EL', node_name: 'B' },
      ],
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('EL').isBipartite).toBe(false)
  })

  it('8.6 layer that exists in layers[] but has no state_nodes is not bipartite', () => {
    // A layer can be declared but have no nodes in it (e.g. a placeholder layer).
    // The parser guards against this with an early size===0 check.
    const input = {
      layers: [
        { layer_id: 1, layer_name: 'EmptyLayer' },
        { layer_id: 2, layer_name: 'L' },
      ],
      nodes: [{ node_id: 'a', node_name: 'A' }],
      extended: [],
      state_nodes: [{ layer_name: 'L', node_name: 'A' }], // EmptyLayer absent
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('EmptyLayer').isBipartite).toBe(false)
  })
})

// ── Group 9 — Mixed multilayer ───────────────────────────────────────────────
// Bipartite detection runs per-layer. A network where some layers are bipartite
// and others are not is valid and common in ecology (e.g. a pollination layer
// alongside a competition layer). The detection results must be independent.

describe('Group 9 — Mixed multilayer', () => {
  it('9.1 bipartite and unipartite layers in the same network are independent', () => {
    // Bip layer: A1─B1 (bipartite pair, declared with bipartite: true + node_type)
    // Uni layer: X─Y─Z─X (triangle, not bipartite)
    const input = {
      layers: [
        { layer_id: 1, layer_name: 'Bip', bipartite: true },
        { layer_id: 2, layer_name: 'Uni' },
      ],
      nodes: [
        { node_id: 'a1', node_name: 'A1', node_type: 'setA' },
        { node_id: 'b1', node_name: 'B1', node_type: 'setB' },
        { node_id: 'x',  node_name: 'X' },
        { node_id: 'y',  node_name: 'Y' },
        { node_id: 'z',  node_name: 'Z' },
      ],
      extended: [
        { layer_from: 'Bip', node_from: 'A1', layer_to: 'Bip', node_to: 'B1' },
        { layer_from: 'Uni', node_from: 'X',  layer_to: 'Uni', node_to: 'Y' },
        { layer_from: 'Uni', node_from: 'Y',  layer_to: 'Uni', node_to: 'Z' },
        { layer_from: 'Uni', node_from: 'Z',  layer_to: 'Uni', node_to: 'X' },
      ],
      state_nodes: [
        { layer_name: 'Bip', node_name: 'A1' },
        { layer_name: 'Bip', node_name: 'B1' },
        { layer_name: 'Uni', node_name: 'X' },
        { layer_name: 'Uni', node_name: 'Y' },
        { layer_name: 'Uni', node_name: 'Z' },
      ],
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('Bip').isBipartite).toBe(true)
    expect(model.bipartiteInfo.get('Uni').isBipartite).toBe(false)
  })

  it('9.2 two explicit bipartite layers (one with node_type, one without) and one non-bipartite', () => {
    // Explicit: layer.bipartite=true + node_type with 2 values (P1=setA, I1=setB)
    // Auto:     layer.bipartite=true + same 2 node_type values (A1=setA, B1=setB) — also explicit
    // NonBip:   triangle X─Y─Z─X, not bipartite
    // Note: node_type distinctness is checked globally — all bipartite nodes must share the same 2 values.
    const input = {
      layers: [
        { layer_id: 1, layer_name: 'Explicit', bipartite: true },
        { layer_id: 2, layer_name: 'Auto', bipartite: true },
        { layer_id: 3, layer_name: 'NonBip' },
      ],
      nodes: [
        { node_id: 'p1', node_name: 'P1', node_type: 'setA' },
        { node_id: 'i1', node_name: 'I1', node_type: 'setB' },
        { node_id: 'a1', node_name: 'A1', node_type: 'setA' },
        { node_id: 'b1', node_name: 'B1', node_type: 'setB' },
        { node_id: 'x',  node_name: 'X' },
        { node_id: 'y',  node_name: 'Y' },
        { node_id: 'z',  node_name: 'Z' },
      ],
      extended: [
        { layer_from: 'Explicit', node_from: 'P1', layer_to: 'Explicit', node_to: 'I1' },
        { layer_from: 'Auto',     node_from: 'A1', layer_to: 'Auto',     node_to: 'B1' },
        { layer_from: 'NonBip',   node_from: 'X',  layer_to: 'NonBip',   node_to: 'Y' },
        { layer_from: 'NonBip',   node_from: 'Y',  layer_to: 'NonBip',   node_to: 'Z' },
        { layer_from: 'NonBip',   node_from: 'Z',  layer_to: 'NonBip',   node_to: 'X' },
      ],
      state_nodes: [
        { layer_name: 'Explicit', node_name: 'P1' },
        { layer_name: 'Explicit', node_name: 'I1' },
        { layer_name: 'Auto',     node_name: 'A1' },
        { layer_name: 'Auto',     node_name: 'B1' },
        { layer_name: 'NonBip',   node_name: 'X' },
        { layer_name: 'NonBip',   node_name: 'Y' },
        { layer_name: 'NonBip',   node_name: 'Z' },
      ],
    }
    const model = parseMultilayerData(input)
    expect(model.bipartiteInfo.get('Explicit').isBipartite).toBe(true)
    expect(model.bipartiteInfo.get('Explicit').explicit).toBe(true)
    expect(model.bipartiteInfo.get('Auto').isBipartite).toBe(true)
    expect(model.bipartiteInfo.get('Auto').explicit).toBe(true)
    expect(model.bipartiteInfo.get('NonBip').isBipartite).toBe(false)
  })
})

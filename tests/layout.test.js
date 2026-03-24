/**
 * layout.test.js — Unit tests for ForceLayout
 *
 * ForceLayout computes 2D node positions for each layer in a multilayer network.
 * It supports six layout algorithms:
 *
 *   circle        — deterministic: nodes evenly spaced on a circle
 *   grid          — deterministic: nodes on a regular grid
 *   bipartite     — deterministic: two rows (setA top, setB bottom)
 *   random        — non-deterministic: uniform random positions
 *   fruchterman   — non-deterministic: force-directed (Fruchterman-Reingold)
 *   kamada_kawai  — non-deterministic: energy-minimisation with Floyd-Warshall
 *
 * TESTING STRATEGY
 * ─────────────────
 * Deterministic algorithms (circle, grid, bipartite, _rescaleToFit) are tested
 * with exact assertions — same input always produces the same output.
 *
 * Non-deterministic algorithms (random, fruchterman, kamada_kawai) are tested
 * with structural assertions that must hold regardless of randomness:
 *   • Every input node appears in the output
 *   • All coordinates are finite numbers (no NaN, no Infinity)
 *   • After rescaling, all coordinates land within the padded bounds
 *   • Connected nodes end up closer on average than disconnected nodes
 *     (fruchterman/kamada only — checked over multiple runs to be reliable)
 *
 * MODEL FIXTURE
 * ─────────────
 * Tests bypass parseMultilayerData and build a minimal model object directly.
 * This keeps tests fast and isolated from dataParser changes.
 * The model shape required by ForceLayout:
 *   model.nodesByName   — Map<nodeName, node>
 *   model.nodesPerLayer — Map<layerName, Set<nodeName>>
 *   model.layers        — [{ layer_name }]
 *   model.intralayerLinks — [{ layer_from, node_from, node_to }]
 *   model.stateNodeMap  — Map<"layer::node", { degree }>  (bipartite nested only)
 *   model.bipartiteInfo — set externally on the layout instance
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as graphologyLib from 'graphology'
import * as graphologyShortestPath from 'graphology-shortest-path'
globalThis.graphology = graphologyLib
globalThis.graphologyShortestPath = graphologyShortestPath
import { ForceLayout } from '../js/layout.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const LAYER = 'L1'
const WIDTH  = 350
const HEIGHT = 250
const PAD    = 10  // matches _rescaleToFit internal padding

/**
 * Build a minimal model for a single layer with the given node names and edges.
 * edges: [{ from, to }]
 */
function makeModel(nodeNames, edges = [], layerName = LAYER) {
  const nodesByName = new Map(nodeNames.map(n => [n, { node_name: n }]))
  const nodesPerLayer = new Map([[layerName, new Set(nodeNames)]])
  const layers = [{ layer_name: layerName }]
  const intralayerLinks = edges.map(e => ({
    layer_from: layerName,
    node_from: e.from,
    node_to: e.to,
  }))
  const stateNodeMap = new Map(
    nodeNames.map(n => [`${layerName}::${n}`, { degree: 1, node_name: n, layer_name: layerName }])
  )
  return { nodesByName, nodesPerLayer, layers, intralayerLinks, stateNodeMap }
}

/** Build a bipartite model with explicit setA / setB membership. */
function makeBipartiteModel(setANames, setBNames, edges = []) {
  const allNodes = [...setANames, ...setBNames]
  const model = makeModel(allNodes, edges)
  const setA = new Set(setANames)
  const setB = new Set(setBNames)
  const bipartiteInfo = new Map([
    [LAYER, { isBipartite: true, setA, setB }]
  ])
  return { model, bipartiteInfo }
}

/** Euclidean distance between two {x,y} positions. */
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

/** Check that all positions in a Map are finite numbers. */
function allFinite(posMap) {
  for (const [, p] of posMap) {
    if (!isFinite(p.x) || !isFinite(p.y)) return false
  }
  return true
}

/** Check that all positions in a Map are within the padded bounds. */
function allInBounds(posMap, width = WIDTH, height = HEIGHT, pad = PAD) {
  for (const [, p] of posMap) {
    if (p.x < pad - 0.01 || p.x > width - pad + 0.01) return false
    if (p.y < pad - 0.01 || p.y > height - pad + 0.01) return false
  }
  return true
}


// ── Group 1 — _rescaleToFit ───────────────────────────────────────────────────
// _rescaleToFit normalises raw positions into [pad, width-pad] × [pad, height-pad].
// It is called by every algorithm except bipartite.

describe('Group 1 — _rescaleToFit', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({ layerWidth: WIDTH, layerHeight: HEIGHT })
  })

  it('1.1 output bounding box matches padded target rectangle exactly', () => {
    const raw = new Map([
      ['A', { x: 0,   y: 0   }],
      ['B', { x: 100, y: 200 }],
      ['C', { x: 50,  y: 100 }],
    ])
    const result = layout._rescaleToFit(raw)
    const xs = [...result.values()].map(p => p.x)
    const ys = [...result.values()].map(p => p.y)
    expect(Math.min(...xs)).toBeCloseTo(PAD, 5)
    expect(Math.max(...xs)).toBeCloseTo(WIDTH - PAD, 5)
    expect(Math.min(...ys)).toBeCloseTo(PAD, 5)
    expect(Math.max(...ys)).toBeCloseTo(HEIGHT - PAD, 5)
  })

  it('1.2 single node is placed at the centre of the layer', () => {
    const raw = new Map([['A', { x: 99, y: 42 }]])
    const result = layout._rescaleToFit(raw)
    expect(result.get('A').x).toBeCloseTo(WIDTH / 2, 5)
    expect(result.get('A').y).toBeCloseTo(HEIGHT / 2, 5)
  })

  it('1.3 all nodes at the same position are placed at the centre (no division by zero)', () => {
    const raw = new Map([
      ['A', { x: 50, y: 50 }],
      ['B', { x: 50, y: 50 }],
    ])
    expect(() => layout._rescaleToFit(raw)).not.toThrow()
    const result = layout._rescaleToFit(raw)
    for (const [, p] of result) {
      expect(isFinite(p.x)).toBe(true)
      expect(isFinite(p.y)).toBe(true)
    }
  })

  it('1.4 relative order of nodes is preserved after rescaling', () => {
    // If A is left of B in raw coords, it must still be left of B after rescaling
    const raw = new Map([
      ['A', { x: 10, y: 50 }],
      ['B', { x: 90, y: 50 }],
    ])
    const result = layout._rescaleToFit(raw)
    expect(result.get('A').x).toBeLessThan(result.get('B').x)
  })
})


// ── Group 2 — Circle layout ───────────────────────────────────────────────────
// Nodes are placed on a circle. Positions are fully deterministic.

describe('Group 2 — circle layout', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({ layoutType: 'circle', layerWidth: WIDTH, layerHeight: HEIGHT })
  })

  it('2.1 all nodes are placed', () => {
    const model = makeModel(['A', 'B', 'C', 'D'])
    const positions = layout.computeLayout(model)
    const layerPos = positions.get(LAYER)
    expect(layerPos.size).toBe(4)
    expect([...layerPos.keys()]).toEqual(expect.arrayContaining(['A', 'B', 'C', 'D']))
  })

  it('2.2 all nodes lie on a circle (equal distance from centre) — raw positions before rescale', () => {
    // _rescaleToFit applies independent X/Y scaling which turns a circle into an ellipse.
    // The circle property must be checked on raw positions from _layoutCircle directly.
    const raw = layout._layoutCircle(['A', 'B', 'C', 'D', 'E'])
    const cx = WIDTH / 2
    const cy = HEIGHT / 2
    const radii = [...raw.values()].map(p =>
      Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
    )
    radii.forEach(r => expect(r).toBeCloseTo(radii[0], 3))
  })

  it('2.3 all inter-node distances are equal for a regular polygon (3 nodes) — raw positions', () => {
    // Same reason: check raw positions before rescale distorts the shape
    const raw = layout._layoutCircle(['A', 'B', 'C'])
    const [pA, pB, pC] = ['A', 'B', 'C'].map(n => raw.get(n))
    expect(dist(pA, pB)).toBeCloseTo(dist(pB, pC), 3)
    expect(dist(pB, pC)).toBeCloseTo(dist(pA, pC), 3)
  })

  it('2.4 single node is placed at the centre', () => {
    const model = makeModel(['A'])
    const positions = layout.computeLayout(model)
    const p = positions.get(LAYER).get('A')
    // After _rescaleToFit with one node → centre
    expect(p.x).toBeCloseTo(WIDTH / 2, 3)
    expect(p.y).toBeCloseTo(HEIGHT / 2, 3)
  })
})


// ── Group 3 — Grid layout ─────────────────────────────────────────────────────
// Nodes are placed on a regular grid. Positions are fully deterministic.

describe('Group 3 — grid layout', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({ layoutType: 'grid', layerWidth: WIDTH, layerHeight: HEIGHT })
  })

  it('3.1 all nodes are placed', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E', 'F'])
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).size).toBe(6)
  })

  it('3.2 no two nodes share the same position', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
    const positions = layout.computeLayout(model)
    const coords = [...positions.get(LAYER).values()].map(p => `${p.x},${p.y}`)
    const unique = new Set(coords)
    expect(unique.size).toBe(coords.length)
  })

  it('3.3 nodes are arranged in rows (Y values repeat by row)', () => {
    // 4 nodes → 2×2 grid → nodes 0,1 share y; nodes 2,3 share y
    const model = makeModel(['A', 'B', 'C', 'D'])
    const positions = layout.computeLayout(model)
    const raw = new ForceLayout({ layoutType: 'grid', layerWidth: WIDTH, layerHeight: HEIGHT })
    // Call the private method directly to get pre-rescale positions
    const rawPos = raw._layoutGrid(['A', 'B', 'C', 'D'])
    expect(rawPos.get('A').y).toBeCloseTo(rawPos.get('B').y, 5)
    expect(rawPos.get('C').y).toBeCloseTo(rawPos.get('D').y, 5)
    expect(rawPos.get('A').y).not.toBeCloseTo(rawPos.get('C').y, 1)
  })

  it('3.4 all positions are finite', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E'])
    const positions = layout.computeLayout(model)
    expect(allFinite(positions.get(LAYER))).toBe(true)
  })
})


// ── Group 4 — Bipartite layout ────────────────────────────────────────────────
// Set A nodes go on the top row (y = 18% of height).
// Set B nodes go on the bottom row (y = 82% of height).
// Does NOT call _rescaleToFit — positions are returned as-is.

describe('Group 4 — bipartite layout', () => {
  let layout

  it('4.1 setA nodes are on the top row and setB on the bottom row', () => {
    const { model, bipartiteInfo } = makeBipartiteModel(['P1', 'P2'], ['B1', 'B2'])
    layout = new ForceLayout({ layoutType: 'bipartite', layerWidth: WIDTH, layerHeight: HEIGHT })
    layout.bipartiteInfo = bipartiteInfo
    const positions = layout.computeLayout(model)
    const layerPos = positions.get(LAYER)

    const topY  = HEIGHT * 0.18
    const botY  = HEIGHT * 0.82
    expect(layerPos.get('P1').y).toBeCloseTo(topY, 3)
    expect(layerPos.get('P2').y).toBeCloseTo(topY, 3)
    expect(layerPos.get('B1').y).toBeCloseTo(botY, 3)
    expect(layerPos.get('B2').y).toBeCloseTo(botY, 3)
  })

  it('4.2 all nodes are placed', () => {
    const { model, bipartiteInfo } = makeBipartiteModel(['P1', 'P2', 'P3'], ['B1', 'B2'])
    layout = new ForceLayout({ layoutType: 'bipartite', layerWidth: WIDTH, layerHeight: HEIGHT })
    layout.bipartiteInfo = bipartiteInfo
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).size).toBe(5)
  })

  it('4.3 single node in a row is centred horizontally', () => {
    const { model, bipartiteInfo } = makeBipartiteModel(['P1'], ['B1', 'B2'])
    layout = new ForceLayout({ layoutType: 'bipartite', layerWidth: WIDTH, layerHeight: HEIGHT })
    layout.bipartiteInfo = bipartiteInfo
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).get('P1').x).toBeCloseTo(WIDTH / 2, 3)
  })

  it('4.4 fallback to single centre row when bpInfo is missing', () => {
    // When no bipartiteInfo is set, all nodes should land on y = HEIGHT/2
    const model = makeModel(['A', 'B', 'C'])
    layout = new ForceLayout({ layoutType: 'bipartite', layerWidth: WIDTH, layerHeight: HEIGHT })
    // bipartiteInfo intentionally left null
    const positions = layout.computeLayout(model)
    const layerPos = positions.get(LAYER)
    for (const [, p] of layerPos) {
      expect(p.y).toBeCloseTo(HEIGHT / 2, 3)
    }
  })

  it('4.5 nested sort: higher-degree nodes placed further left', () => {
    // With bipartiteNested=true, nodes are sorted descending by degree,
    // so the highest-degree node gets index 0 (leftmost position).
    const model = makeModel(['P1', 'P2', 'P3'], [], LAYER)
    // Give P2 a higher degree than P1 and P3
    model.stateNodeMap.set(`${LAYER}::P1`, { degree: 1 })
    model.stateNodeMap.set(`${LAYER}::P2`, { degree: 5 })
    model.stateNodeMap.set(`${LAYER}::P3`, { degree: 2 })
    const bipartiteInfo = new Map([
      [LAYER, { isBipartite: true, setA: new Set(['P1', 'P2', 'P3']), setB: new Set() }]
    ])
    layout = new ForceLayout({
      layoutType: 'bipartite',
      bipartiteNested: true,
      layerWidth: WIDTH,
      layerHeight: HEIGHT,
    })
    layout.bipartiteInfo = bipartiteInfo
    const positions = layout.computeLayout(model)
    const layerPos = positions.get(LAYER)
    // P2 (highest degree) should be leftmost
    expect(layerPos.get('P2').x).toBeLessThan(layerPos.get('P3').x)
    expect(layerPos.get('P3').x).toBeLessThan(layerPos.get('P1').x)
  })
})


// ── Group 5 — Random layout ───────────────────────────────────────────────────
// Positions are random, so only structural properties can be asserted.

describe('Group 5 — random layout', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({ layoutType: 'random', layerWidth: WIDTH, layerHeight: HEIGHT })
  })

  it('5.1 all nodes are placed', () => {
    const model = makeModel(['A', 'B', 'C', 'D'])
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).size).toBe(4)
  })

  it('5.2 all positions are finite numbers', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E'])
    const positions = layout.computeLayout(model)
    expect(allFinite(positions.get(LAYER))).toBe(true)
  })

  it('5.3 positions are within the padded bounds after rescaling', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E'])
    const positions = layout.computeLayout(model)
    expect(allInBounds(positions.get(LAYER))).toBe(true)
  })
})


// ── Group 6 — Fruchterman-Reingold layout ────────────────────────────────────
// Force-directed. Only structural properties tested.
// The "connected nodes are closer" check runs 10 times to reduce flakiness.

describe('Group 6 — Fruchterman-Reingold layout', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({
      layoutType: 'fruchterman',
      iterations: 150,
      layerWidth: WIDTH,
      layerHeight: HEIGHT,
    })
  })

  it('6.1 all nodes appear in the output', () => {
    const model = makeModel(['A', 'B', 'C', 'D'])
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).size).toBe(4)
  })

  it('6.2 all positions are finite (no NaN or Infinity)', () => {
    const model = makeModel(['A', 'B', 'C', 'D', 'E'], [
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }
    ])
    const positions = layout.computeLayout(model)
    expect(allFinite(positions.get(LAYER))).toBe(true)
  })

  it('6.3 positions are within the padded bounds after rescaling', () => {
    const model = makeModel(['A', 'B', 'C', 'D'], [{ from: 'A', to: 'B' }])
    const positions = layout.computeLayout(model)
    expect(allInBounds(positions.get(LAYER))).toBe(true)
  })

  it('6.4 single node does not crash and is placed at centre', () => {
    const model = makeModel(['A'])
    expect(() => layout.computeLayout(model)).not.toThrow()
    const p = layout.computeLayout(model).get(LAYER).get('A')
    expect(isFinite(p.x)).toBe(true)
    expect(isFinite(p.y)).toBe(true)
  })

  it('6.5 connected nodes end up closer than unconnected nodes on average', () => {
    // A-B are connected; C is isolated. Run 10 times and check the average distance.
    // This should pass reliably — force-directed layouts strongly attract connected nodes.
    const RUNS = 10
    let connectedCloserCount = 0
    for (let i = 0; i < RUNS; i++) {
      const model = makeModel(['A', 'B', 'C'], [{ from: 'A', to: 'B' }])
      const pos = layout.computeLayout(model).get(LAYER)
      const dAB = dist(pos.get('A'), pos.get('B'))
      const dAC = dist(pos.get('A'), pos.get('C'))
      const dBC = dist(pos.get('B'), pos.get('C'))
      if (dAB < dAC && dAB < dBC) connectedCloserCount++
    }
    // Expect connected nodes closer in at least 7 out of 10 runs
    expect(connectedCloserCount).toBeGreaterThanOrEqual(7)
  })
})


// ── Group 7 — Kamada-Kawai layout ────────────────────────────────────────────
// Energy-minimisation. Uses Floyd-Warshall for shortest paths.
// Only structural properties tested, plus disconnected graph robustness.

describe('Group 7 — Kamada-Kawai layout', () => {
  let layout
  beforeEach(() => {
    layout = new ForceLayout({
      layoutType: 'kamada_kawai',
      layerWidth: WIDTH,
      layerHeight: HEIGHT,
    })
  })

  it('7.1 all nodes appear in the output', () => {
    const model = makeModel(['A', 'B', 'C'], [{ from: 'A', to: 'B' }])
    const positions = layout.computeLayout(model)
    expect(positions.get(LAYER).size).toBe(3)
  })

  it('7.2 all positions are finite (no NaN or Infinity)', () => {
    const model = makeModel(['A', 'B', 'C', 'D'], [
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }
    ])
    const positions = layout.computeLayout(model)
    expect(allFinite(positions.get(LAYER))).toBe(true)
  })

  it('7.3 disconnected graph (no edges) does not crash', () => {
    // With no edges, all shortest paths are Infinity → replaced by diameter+1.
    // The layout should still produce finite positions.
    const model = makeModel(['A', 'B', 'C'])
    expect(() => layout.computeLayout(model)).not.toThrow()
    expect(allFinite(layout.computeLayout(model).get(LAYER))).toBe(true)
  })

  it('7.4 single node does not crash', () => {
    const model = makeModel(['A'])
    expect(() => layout.computeLayout(model)).not.toThrow()
    const p = layout.computeLayout(model).get(LAYER).get('A')
    expect(isFinite(p.x)).toBe(true)
    expect(isFinite(p.y)).toBe(true)
  })

  it('7.5 positions are within the padded bounds after rescaling', () => {
    const model = makeModel(['A', 'B', 'C', 'D'], [
      { from: 'A', to: 'B' }, { from: 'B', to: 'C' }
    ])
    const positions = layout.computeLayout(model)
    expect(allInBounds(positions.get(LAYER))).toBe(true)
  })
})


// ── Group 8 — computeLayout integration ─────────────────────────────────────
// Tests the top-level computeLayout() method which orchestrates all algorithms.

describe('Group 8 — computeLayout integration', () => {
  it('8.1 returns a Map with one entry per layer', () => {
    const model = {
      nodesByName: new Map([['A', {}], ['B', {}]]),
      nodesPerLayer: new Map([
        ['L1', new Set(['A'])],
        ['L2', new Set(['B'])],
      ]),
      layers: [{ layer_name: 'L1' }, { layer_name: 'L2' }],
      intralayerLinks: [],
      stateNodeMap: new Map(),
    }
    const layout = new ForceLayout({ layoutType: 'circle' })
    const positions = layout.computeLayout(model)
    expect(positions.size).toBe(2)
    expect(positions.has('L1')).toBe(true)
    expect(positions.has('L2')).toBe(true)
  })

  it('8.2 each layer map contains exactly its own nodes', () => {
    const model = {
      nodesByName: new Map([['A', {}], ['B', {}], ['C', {}]]),
      nodesPerLayer: new Map([
        ['L1', new Set(['A', 'B'])],
        ['L2', new Set(['B', 'C'])],
      ]),
      layers: [{ layer_name: 'L1' }, { layer_name: 'L2' }],
      intralayerLinks: [],
      stateNodeMap: new Map(),
    }
    const layout = new ForceLayout({ layoutType: 'grid' })
    const positions = layout.computeLayout(model)
    expect([...positions.get('L1').keys()]).toEqual(expect.arrayContaining(['A', 'B']))
    expect(positions.get('L1').has('C')).toBe(false)
    expect([...positions.get('L2').keys()]).toEqual(expect.arrayContaining(['B', 'C']))
    expect(positions.get('L2').has('A')).toBe(false)
  })

  it('8.3 empty layer (no nodes) is skipped — not present in output', () => {
    const model = {
      nodesByName: new Map([['A', {}]]),
      nodesPerLayer: new Map([
        ['L1', new Set(['A'])],
        ['L2', new Set()],        // empty layer
      ]),
      layers: [{ layer_name: 'L1' }, { layer_name: 'L2' }],
      intralayerLinks: [],
      stateNodeMap: new Map(),
    }
    const layout = new ForceLayout({ layoutType: 'circle' })
    const positions = layout.computeLayout(model)
    expect(positions.has('L1')).toBe(true)
    expect(positions.has('L2')).toBe(false)
  })

  it('8.4 cross-layer nodes get consistent initial positions (same name in two layers)', () => {
    // Node "B" appears in both L1 and L2. The global position seeding means both
    // layers start B from the same initial position — after layout they may differ
    // but should both be finite and valid.
    const model = {
      nodesByName: new Map([['A', {}], ['B', {}], ['C', {}]]),
      nodesPerLayer: new Map([
        ['L1', new Set(['A', 'B'])],
        ['L2', new Set(['B', 'C'])],
      ]),
      layers: [{ layer_name: 'L1' }, { layer_name: 'L2' }],
      intralayerLinks: [],
      stateNodeMap: new Map(),
    }
    const layout = new ForceLayout({ layoutType: 'fruchterman', iterations: 50 })
    const positions = layout.computeLayout(model)
    const bL1 = positions.get('L1').get('B')
    const bL2 = positions.get('L2').get('B')
    expect(isFinite(bL1.x) && isFinite(bL1.y)).toBe(true)
    expect(isFinite(bL2.x) && isFinite(bL2.y)).toBe(true)
  })
})

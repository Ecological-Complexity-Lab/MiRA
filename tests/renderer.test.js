/**
 * renderer.test.js — Unit tests for Renderer pure-math methods
 *
 * The Renderer class does two things:
 *   1. Pure math — project(), hitTestNode(), hitTestLink(), hitTestLayer(),
 *      _pointInPolygon(), getLayerCorners()
 *   2. Canvas drawing — render(), renderToContext(), etc.
 *
 * Only (1) is tested here. Canvas drawing requires a real browser and is
 * verified manually. All tests in this file run in Node.js with a mock canvas.
 *
 * MOCK CANVAS
 * ───────────
 * The Renderer constructor calls canvas.getContext('2d') immediately and stores
 * the result as this.ctx. Every pure-math method ignores this.ctx entirely —
 * they only use this.model, this.positions, this.layerOffsets, and the projection
 * parameters. So a { getContext: () => null } mock is sufficient.
 *
 * PROJECTION OVERVIEW
 * ────────────────────
 * project(x, y, layerIndex) has three code paths:
 *
 *   1. Map mode (isMapMode=true + bgMap set) — requires Leaflet, not tested here
 *   2. Vertical stacking (stackMode='vertical') — layers stack top-to-bottom
 *   3. Horizontal stacking (default) — layers recede in depth (Z-axis)
 *
 * With skewX=0 and skewY=0 (no rotation), horizontal mode collapses to identity:
 *   cos(0)=1, sin(0)=0 → rx=lx, ry=ly → screen = (x, y) at scale=1, offset=0
 * This "zero-skew identity" property anchors the Group 1 tests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Renderer } from '../js/renderer.js'

// ── Mock canvas ───────────────────────────────────────────────────────────────

const mockCanvas = { getContext: () => null }

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal model object with one layer containing two connected nodes.
 * This is the smallest model that exercises hitTestNode, hitTestLink, hitTestLayer.
 *
 *   Layer "L1": nodes A (175, 125) and B (275, 125) — connected by a link
 */
function makeModel(layerName = 'L1') {
  const layers = [{ layer_name: layerName }]
  const layersByName = new Map([[layerName, layers[0]]])
  const intralayerLinks = [{ layer_from: layerName, node_from: 'A', node_to: 'B' }]
  const interlayerLinks = []
  return { layers, layersByName, intralayerLinks, interlayerLinks }
}

/**
 * Build a positions map for makeModel's two nodes.
 * A is at (175, 125) — centre-left; B is at (275, 125) — centre-right.
 */
function makePositions(layerName = 'L1') {
  return new Map([
    [layerName, new Map([
      ['A', { x: 175, y: 125 }],
      ['B', { x: 275, y: 125 }],
    ])]
  ])
}

/**
 * Build a Renderer with identity projection (no skew, no offset, scale=1).
 *
 * NOTE: The Renderer constructor uses `options.skewX || 0.7` which treats 0 as
 * falsy and silently falls back to the default 0.7. This is a real bug — passing
 * { skewX: 0 } in the options object has no effect. To work around it in tests,
 * we set skewX/skewY directly on the instance after construction.
 * This also means production code cannot set skewX=0 via the constructor options.
 */
function makeIdentityRenderer(extra = {}) {
  const r = new Renderer(mockCanvas, {
    layerWidth: 350,
    layerHeight: 250,
    layerSpacing: 300,
    ...extra,
  })
  r.skewX   = extra.skewX   !== undefined ? extra.skewX   : 0
  r.skewY   = extra.skewY   !== undefined ? extra.skewY   : 0
  r.scale   = extra.scale   !== undefined ? extra.scale   : 1
  r.offsetX = extra.offsetX !== undefined ? extra.offsetX : 0
  r.offsetY = extra.offsetY !== undefined ? extra.offsetY : 0
  return r
}

// ── Group 1 — project(): zero-skew identity ───────────────────────────────────
// With skewX=0, skewY=0, scale=1, offsetX=0, offsetY=0 the horizontal projection
// is a mathematical identity — screen coords equal local coords for layer 0.

describe('Group 1 — project(): zero-skew identity', () => {
  let r
  beforeEach(() => { r = makeIdentityRenderer() })

  it('1.1 centre point (halfW, halfH) at layer 0 maps to itself', () => {
    const p = r.project(175, 125, 0)   // halfW=175, halfH=125
    expect(p.x).toBeCloseTo(175, 5)
    expect(p.y).toBeCloseTo(125, 5)
  })

  it('1.2 arbitrary point at layer 0 maps to itself', () => {
    const p = r.project(50, 200, 0)
    expect(p.x).toBeCloseTo(50, 5)
    expect(p.y).toBeCloseTo(200, 5)
  })

  it('1.3 offsetX / offsetY shifts output by exactly that amount', () => {
    r.offsetX = 40
    r.offsetY = 80
    const p = r.project(175, 125, 0)
    expect(p.x).toBeCloseTo(215, 5)
    expect(p.y).toBeCloseTo(205, 5)
  })

  it('1.4 scale=2 doubles screen coordinates relative to origin', () => {
    // scale multiplies (sx, sy) before adding offset.
    // sx = (rx + halfW) * scale + offsetX = (lx + halfW) * scale + 0 = x * scale
    r.scale = 2
    const p = r.project(175, 125, 0)
    expect(p.x).toBeCloseTo(350, 5)   // 175 * 2
    expect(p.y).toBeCloseTo(250, 5)   // 125 * 2
  })
})


// ── Group 2 — project(): horizontal stacking ─────────────────────────────────
// Default mode. Layers recede in depth using a 3D rotation around Y then X axis.
// With positive skewX, increasing layer index shifts the projected point right.

describe('Group 2 — project(): horizontal stacking', () => {
  it('2.1 layer 1 projects to a different position than layer 0 for same local coords', () => {
    const r = new Renderer(mockCanvas, { skewX: 0.7, skewY: 0.55, layerWidth: 350, layerHeight: 250, layerSpacing: 300 })
    const p0 = r.project(175, 125, 0)
    const p1 = r.project(175, 125, 1)
    expect(p0.x).not.toBeCloseTo(p1.x, 1)
  })

  it('2.2 higher layer index → further in depth direction (x increases with positive skewX)', () => {
    const r = new Renderer(mockCanvas, { skewX: 0.7, skewY: 0.55, layerWidth: 350, layerHeight: 250, layerSpacing: 300 })
    const p0 = r.project(175, 125, 0)
    const p1 = r.project(175, 125, 1)
    const p2 = r.project(175, 125, 2)
    expect(p1.x).toBeGreaterThan(p0.x)
    expect(p2.x).toBeGreaterThan(p1.x)
  })

  it('2.3 doubling layerSpacing doubles the depth offset between layers', () => {
    const r1 = new Renderer(mockCanvas, { skewX: 0.7, skewY: 0.55, layerSpacing: 100, layerWidth: 350, layerHeight: 250 })
    const r2 = new Renderer(mockCanvas, { skewX: 0.7, skewY: 0.55, layerSpacing: 200, layerWidth: 350, layerHeight: 250 })
    const shift1 = r1.project(175, 125, 1).x - r1.project(175, 125, 0).x
    const shift2 = r2.project(175, 125, 1).x - r2.project(175, 125, 0).x
    expect(shift2).toBeCloseTo(shift1 * 2, 5)
  })

  it('2.4 all projected coordinates are finite numbers', () => {
    const r = makeIdentityRenderer()
    for (const i of [0, 1, 5]) {
      const p = r.project(175, 125, i)
      expect(isFinite(p.x)).toBe(true)
      expect(isFinite(p.y)).toBe(true)
    }
  })
})


// ── Group 3 — project(): vertical stacking ───────────────────────────────────
// stackMode='vertical': layers stack top-to-bottom. Layer index shifts Y only
// (within the isometric compression), and X is not affected by layer index.

describe('Group 3 — project(): vertical stacking', () => {
  it('3.1 layer 1 is below layer 0 (higher screen Y)', () => {
    const r = new Renderer(mockCanvas, {
      stackMode: 'vertical',
      skewX: 0.7, skewY: 0.55,
      layerSpacing: 150,
      layerWidth: 350, layerHeight: 250,
    })
    const p0 = r.project(175, 125, 0)
    const p1 = r.project(175, 125, 1)
    expect(p1.y).toBeGreaterThan(p0.y)
  })

  it('3.2 doubling layerSpacing doubles the vertical gap between layers', () => {
    const make = (spacing) => new Renderer(mockCanvas, {
      stackMode: 'vertical',
      skewX: 0, skewY: 0,
      layerSpacing: spacing,
      layerWidth: 350, layerHeight: 250,
    })
    const r1 = make(100)
    const r2 = make(200)
    const gap1 = r1.project(175, 125, 1).y - r1.project(175, 125, 0).y
    const gap2 = r2.project(175, 125, 1).y - r2.project(175, 125, 0).y
    expect(gap2).toBeCloseTo(gap1 * 2, 5)
  })

  it('3.3 per-layer offset shifts that layer\'s output by exact dx/dy', () => {
    const r = makeIdentityRenderer()
    r.layerOffsets.set(1, { dx: 30, dy: -20 })
    const withoutOffset = r.project(175, 125, 0)  // layer 0, no offset
    const withOffset    = r.project(175, 125, 1)  // layer 1, has offset
    expect(withOffset.x - withoutOffset.x).toBeCloseTo(30, 5)
    expect(withOffset.y - withoutOffset.y).toBeCloseTo(-20, 5)
  })
})


// ── Group 4 — getLayerCorners() ───────────────────────────────────────────────
// Returns 4 projected corners of the layer rectangle (with a margin expansion).

describe('Group 4 — getLayerCorners()', () => {
  let r
  beforeEach(() => {
    r = makeIdentityRenderer()
    // getLayerCorners calls project() which accesses this.model for the geo branch.
    // Set model=null to use the regular projection path.
    r.model = null
  })

  it('4.1 always returns exactly 4 corners', () => {
    const corners = r.getLayerCorners(0)
    expect(corners).toHaveLength(4)
  })

  it('4.2 all corner coordinates are finite numbers', () => {
    const corners = r.getLayerCorners(0)
    for (const c of corners) {
      expect(isFinite(c.x)).toBe(true)
      expect(isFinite(c.y)).toBe(true)
    }
  })

  it('4.3 corners are not all the same point (non-degenerate quadrilateral)', () => {
    const corners = r.getLayerCorners(0)
    const unique = new Set(corners.map(c => `${c.x},${c.y}`))
    expect(unique.size).toBe(4)
  })
})


// ── Group 5 — _pointInPolygon() ──────────────────────────────────────────────
// Ray-casting point-in-polygon algorithm.
// Tested on a simple unit square for clarity.

describe('Group 5 — _pointInPolygon()', () => {
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ]
  let r
  beforeEach(() => { r = makeIdentityRenderer() })

  it('5.1 point clearly inside a square → true', () => {
    expect(r._pointInPolygon(50, 50, square)).toBe(true)
  })

  it('5.2 point clearly outside a square → false', () => {
    expect(r._pointInPolygon(200, 200, square)).toBe(false)
  })

  it('5.3 point above the square → false', () => {
    expect(r._pointInPolygon(50, -10, square)).toBe(false)
  })

  it('5.4 point inside a non-rectangular polygon (projected layer corner)', () => {
    // Use a real renderer with default skew to get a parallelogram corner set,
    // then test that the centre of the projected layer is inside it.
    const renderer = new Renderer(mockCanvas, { skewX: 0.7, skewY: 0.55, layerWidth: 350, layerHeight: 250, layerSpacing: 300 })
    renderer.model = null
    const corners = renderer.getLayerCorners(0)
    // The projected centre of the layer should be inside its own corners
    const centre = renderer.project(175, 125, 0)
    expect(renderer._pointInPolygon(centre.x, centre.y, corners)).toBe(true)
  })
})


// ── Group 6 — hitTestNode() ───────────────────────────────────────────────────
// Finds the node closest to a screen position within nodeRadius * scale + 4 px.

describe('Group 6 — hitTestNode()', () => {
  let r

  beforeEach(() => {
    r = makeIdentityRenderer()
    r.model = makeModel()
    r.positions = makePositions()
  })

  it('6.1 clicking exactly on node A\'s projected position returns node A', () => {
    // With identity projection, node A at (175, 125) projects to screen (175, 125)
    const result = r.hitTestNode(175, 125)
    expect(result).not.toBeNull()
    expect(result.nodeName).toBe('A')
    expect(result.layerName).toBe('L1')
  })

  it('6.2 clicking within hitRadius of node B returns node B', () => {
    // hitRadius = nodeRadius(10) * scale(1) + 4 = 14px; click 5px from B
    const result = r.hitTestNode(280, 125)
    expect(result).not.toBeNull()
    expect(result.nodeName).toBe('B')
  })

  it('6.3 clicking far from all nodes returns null', () => {
    expect(r.hitTestNode(0, 0)).toBeNull()
  })

  it('6.4 no model set returns null', () => {
    r.model = null
    expect(r.hitTestNode(175, 125)).toBeNull()
  })

  it('6.5 front layer (higher index) wins when two nodes overlap on screen', () => {
    // Add a second layer with node C at the same local position as A
    r.model = {
      layers: [
        { layer_name: 'L1' },
        { layer_name: 'L2' },
      ],
      layersByName: new Map([
        ['L1', { layer_name: 'L1' }],
        ['L2', { layer_name: 'L2' }],
      ]),
      intralayerLinks: [],
      interlayerLinks: [],
    }
    r.positions = new Map([
      ['L1', new Map([['A', { x: 175, y: 125 }]])],
      ['L2', new Map([['C', { x: 175, y: 125 }]])],  // same screen pos as A with identity + no depth
    ])
    // With identity projection both layers project to (175,125).
    // hitTestNode iterates from last layer to first → L2 (index 1) is tested first and wins.
    const result = r.hitTestNode(175, 125)
    expect(result.layerName).toBe('L2')
    expect(result.nodeName).toBe('C')
  })
})


// ── Group 7 — hitTestLink() ───────────────────────────────────────────────────
// Finds the intralayer link closest to a screen position within 6px threshold.
// Interlayer links follow a curved path (sampled at 10 points) — not tested here
// as they require getNodeScreenPos which in turn needs model.layersByName.indexOf.

describe('Group 7 — hitTestLink()', () => {
  let r

  beforeEach(() => {
    r = makeIdentityRenderer()
    r.model = makeModel()
    r.positions = makePositions()
  })

  it('7.1 clicking on midpoint of link A→B returns that link', () => {
    // A is at (175,125), B is at (275,125) → midpoint is (225, 125)
    const result = r.hitTestLink(225, 125)
    expect(result).not.toBeNull()
    expect(result.node_from).toBe('A')
    expect(result.node_to).toBe('B')
    expect(result.isInterlayer).toBe(false)
  })

  it('7.2 clicking near (within 6px) one end of the link returns it', () => {
    // Click 4px above node A along the link direction
    const result = r.hitTestLink(179, 125)
    expect(result).not.toBeNull()
  })

  it('7.3 clicking far from all links returns null', () => {
    expect(r.hitTestLink(0, 0)).toBeNull()
  })

  it('7.4 no model set returns null', () => {
    r.model = null
    expect(r.hitTestLink(225, 125)).toBeNull()
  })
})


// ── Group 8 — hitTestLayer() ─────────────────────────────────────────────────
// Ray-casting over projected layer corners to find which layer a screen point is in.

describe('Group 8 — hitTestLayer()', () => {
  let r

  beforeEach(() => {
    r = makeIdentityRenderer()
    r.model = makeModel()
  })

  it('8.1 centre of layer 0 returns layer index 0', () => {
    // With identity projection, layer 0 fills the area around (175, 125)
    const centre = r.project(175, 125, 0)
    expect(r.hitTestLayer(centre.x, centre.y)).toBe(0)
  })

  it('8.2 point far outside all layers returns -1', () => {
    expect(r.hitTestLayer(-9999, -9999)).toBe(-1)
  })

  it('8.3 no model set returns -1', () => {
    r.model = null
    expect(r.hitTestLayer(175, 125)).toBe(-1)
  })
})

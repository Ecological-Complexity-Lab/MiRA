/**
 * dataParser.integration.test.js — Integration tests for parseMultilayerData()
 *
 * These tests load the real JSON files from multilayer_viz/data/ and run the
 * parser against them. The goal is different from the unit tests:
 *
 *   Unit tests (dataParser.test.js):
 *     Verify every logical branch with minimal, hand-crafted inputs.
 *     Precise assertions on exact values.
 *
 *   Integration tests (this file):
 *     Verify the parser doesn't break on real ecological data.
 *     Catch regressions that toy networks wouldn't expose — unusual attribute
 *     combinations, large node counts, edge cases in real field data.
 *
 * FILE SELECTION:
 *   We include 7 of the 13 available files. demo_large_ba.json (166K lines)
 *   is intentionally excluded — it would add ~2 seconds to every test run
 *   for minimal additional coverage.
 *
 *   Selected files cover: small/large, undirected/directed, unipartite/bipartite,
 *   single-layer and 10-layer networks.
 *
 * ASSERTION STRATEGY:
 *   - Group A: smoke only (does it throw?) — covers all 7 files cheaply
 *   - Group B: shape contract — documents exactly what model fields callers can rely on
 *   - Group C: exact counts on demo.json — safe because the file is 40 lines and stable
 *   - Group D: known properties — one assertion per file for properties we know from
 *              inspecting the files (directed flag, bipartite detection)
 *
 * IMPORTANT NOTE on demo_directed.json:
 *   The directed flag is NOT set at the top-level json.directed field in that file.
 *   It is set per-link (directed:true on individual edges). The parser correctly
 *   detects this via json.extended.some(l => l.directed === true).
 *   Group D.1 confirms this path works on a real file.
 *
 * IMPORTANT NOTE on synth_bipartite.json:
 *   Nodes use the "type" field (not "node_type"), and layers do NOT have
 *   bipartite:true set. All 10 layers are therefore detected via BFS auto-detect,
 *   not explicit declaration. Group D.3 confirms all 10 layers pass BFS.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { parseMultilayerData } from '../js/dataParser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '../data')

/** Read and JSON-parse a file from the data directory. */
const load = (filename) => JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf8'))

// ── Group A — Smoke tests ────────────────────────────────────────────────────
// One parameterised test per file. If any file causes an unexpected throw,
// it will show up as a named failure (e.g. "synth_unipartite.json").
// This is the cheapest possible safety net — runs in < 20ms total.

const SMOKE_FILES = [
  'demo.json',                 // tiny, 3-layer food web
  'pond_ecosystem.json',       // small, 3 layers
  'demo_bipartite_rich.json',  // 2-layer bipartite
  'demo_bipartite.json',       // 2-layer bipartite (larger)
  'demo_directed.json',        // directed flag set per-link
  'synth_bipartite.json',      // 10-layer synthetic bipartite
  'synth_unipartite.json',     // 10-layer synthetic directed
]

describe('Group A — Smoke: all real files parse without throwing', () => {
  it.each(SMOKE_FILES)('%s', (filename) => {
    expect(() => parseMultilayerData(load(filename))).not.toThrow()
  })
})

// ── Group B — Model shape ────────────────────────────────────────────────────
// Documents the contract of the model object: which fields exist and what
// types they are. If a refactor accidentally renames or removes a field,
// this test will fail with a clear message naming the missing key.
// All downstream modules (renderer, layout, dashboard, layerView) depend on
// this shape — keeping it stable is the most important invariant in the system.

describe('Group B — Model shape (demo.json)', () => {
  it('returns all required arrays, Maps, and a boolean directed flag', () => {
    const model = parseMultilayerData(load('demo.json'))

    // Arrays consumed by the renderer and dashboard
    for (const key of ['nodes', 'layers', 'extended', 'stateNodes', 'intralayerLinks', 'interlayerLinks']) {
      expect(Array.isArray(model[key]), `${key} should be an array`).toBe(true)
    }
    // Maps used for O(1) lookups throughout the app
    for (const key of ['nodesById', 'nodesByName', 'layersById', 'layersByName', 'stateNodeMap', 'nodesPerLayer', 'bipartiteInfo']) {
      expect(model[key], `${key} should be a Map`).toBeInstanceOf(Map)
    }
    // directed must be a boolean, never undefined — the renderer checks it directly
    expect(typeof model.directed).toBe('boolean')
  })
})

// ── Group C — Exact counts on demo.json ─────────────────────────────────────
// demo.json is 40 lines, fully human-readable, and should never change.
// It is the one file where exact counts are safe to assert without fragility.
//
// demo.json network summary:
//   4 physical nodes: crab, fish, pelican, tadpole
//   3 layers:         pond_1, pond_2, pond_3
//   9 state nodes:    not all nodes appear in all layers (tadpole only in pond_3)
//   8 intralayer edges + 6 interlayer edges = 14 total
//   Custom attributes: nodes have "order", links have "method", layers have "location"

describe('Group C — Exact counts (demo.json)', () => {
  let model
  // Parse once and reuse across all four tests in this group.
  // beforeAll is safe here because none of these tests mutate the model.
  beforeAll(() => { model = parseMultilayerData(load('demo.json')) })

  it('C.1 correct node, layer, and state_node counts', () => {
    expect(model.nodes).toHaveLength(4)
    expect(model.layers).toHaveLength(3)
    expect(model.stateNodes).toHaveLength(9)
  })

  it('C.2 correct intralayer and interlayer link counts', () => {
    expect(model.intralayerLinks).toHaveLength(8)
    expect(model.interlayerLinks).toHaveLength(6)
  })

  it('C.3 undirected — model.directed is false, state nodes have no in_degree', () => {
    expect(model.directed).toBe(false)
    // in_degree is deleted for undirected networks so it doesn't appear in dropdowns
    for (const sn of model.stateNodes) {
      expect(sn).not.toHaveProperty('in_degree')
    }
  })

  it('C.4 custom attribute names extracted: "order", "method", "location"', () => {
    // These drive the colour-by / size-by dropdowns — if extraction breaks,
    // the user loses the ability to colour nodes by any attribute.
    expect(model.nodeAttributeNames).toContain('order')
    expect(model.linkAttributeNames).toContain('method')
    expect(model.layerAttributeNames).toContain('location')
  })
})

// ── Group D — Known properties on specific files ─────────────────────────────
// Each test picks one file and one property we know from inspecting the file.
// These catch regressions in specific detection paths that the unit tests
// verify with toy networks but cannot verify against real data.

describe('Group D — Known properties', () => {
  it('D.1 demo_directed.json — model.directed is true (detected from per-link flags)', () => {
    // This file does NOT set json.directed=true at the top level.
    // The directed flag lives on individual link objects (directed:true).
    // The parser must detect it via: json.extended.some(l => l.directed === true)
    const model = parseMultilayerData(load('demo_directed.json'))
    expect(model.directed).toBe(true)
  })

  it('D.2 demo_bipartite.json — at least one layer is detected as bipartite', () => {
    // This file has no explicit bipartite declarations. Detection is via BFS.
    // We assert "at least one" rather than all layers to stay robust to minor
    // file changes that might add a non-bipartite layer in the future.
    const model = parseMultilayerData(load('demo_bipartite.json'))
    const bipartiteCount = [...model.bipartiteInfo.values()].filter(v => v.isBipartite).length
    expect(bipartiteCount).toBeGreaterThan(0)
  })

  it('D.4 demo.json — no layer falsely reported as bipartite (food-web)', () => {
    // pond_1 and pond_3 have 3-cycles → not bipartite.
    // pond_2 is a 3-node path (crab–fish–pelican) → BFS false positive (issue #23).
    const model = parseMultilayerData(load('demo.json'))
    for (const [layerName, info] of model.bipartiteInfo) {
      expect(info.isBipartite, `layer "${layerName}" should NOT be bipartite`).toBe(false)
    }
  })

  it('D.5 3-node path graph is not declared bipartite', () => {
    // Minimal synthetic regression for the exact false-positive: A–B–C with no cycles.
    const raw = {
      layers: [{ layer_id: 1, layer_name: 'L' }],
      nodes: [
        { node_id: 'a', layer_name: 'L', node_name: 'A' },
        { node_id: 'b', layer_name: 'L', node_name: 'B' },
        { node_id: 'c', layer_name: 'L', node_name: 'C' },
      ],
      extended: [
        { layer_from: 'L', node_from: 'A', layer_to: 'L', node_to: 'B', weight: 1 },
        { layer_from: 'L', node_from: 'B', layer_to: 'L', node_to: 'C', weight: 1 },
      ],
      state_nodes: [
        { layer_name: 'L', node_name: 'A' },
        { layer_name: 'L', node_name: 'B' },
        { layer_name: 'L', node_name: 'C' },
      ],
    }
    const model = parseMultilayerData(raw)
    expect(model.bipartiteInfo.get('L').isBipartite).toBe(false)
  })

  it('D.6 explicit bipartite layer is still detected correctly after fix', () => {
    // Regression guard: ensure the fix does not suppress real bipartite detection.
    const raw = {
      layers: [{ layer_id: 1, layer_name: 'BL', bipartite: true }],
      nodes: [
        { node_id: 'u1', layer_name: 'BL', node_name: 'U1', node_type: 'setA' },
        { node_id: 'u2', layer_name: 'BL', node_name: 'U2', node_type: 'setA' },
        { node_id: 'v1', layer_name: 'BL', node_name: 'V1', node_type: 'setB' },
      ],
      extended: [
        { layer_from: 'BL', node_from: 'U1', layer_to: 'BL', node_to: 'V1', weight: 1 },
        { layer_from: 'BL', node_from: 'U2', layer_to: 'BL', node_to: 'V1', weight: 1 },
      ],
      state_nodes: [
        { layer_name: 'BL', node_name: 'U1' },
        { layer_name: 'BL', node_name: 'U2' },
        { layer_name: 'BL', node_name: 'V1' },
      ],
    }
    const model = parseMultilayerData(raw)
    const info = model.bipartiteInfo.get('BL')
    expect(info.isBipartite).toBe(true)
    expect([...info.setA]).toContain('U1')
    expect([...info.setB]).toContain('V1')
  })

  it('D.3 synth_bipartite.json — all 10 layers are bipartite (BFS auto-detect)', () => {
    // synth_bipartite is a synthetic pollinator-plant network. Every layer is
    // bipartite. Nodes use the "type" field (not "node_type"), and layers have
    // no bipartite:true flag — so the explicit detection path is NOT used here.
    // All 10 must be found by BFS 2-colouring. If BFS is ever broken, this test
    // will catch it on a realistic 10-layer network rather than a toy graph.
    const model = parseMultilayerData(load('synth_bipartite.json'))
    expect(model.layers).toHaveLength(10)
    for (const [layerName, info] of model.bipartiteInfo) {
      expect(info.isBipartite, `layer "${layerName}" should be bipartite`).toBe(true)
    }
  })
})

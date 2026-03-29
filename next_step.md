# Next Step: Tests for Open Issues

## ~~Issue #17 — Zoom broken in layer mode~~ ✅ SOLVED

Tests were added to `tests/browser/layer_view.spec.js` and `app.js` was patched to expose `window._layerView`. Zoom buttons now correctly route to `layerView.viewScale` when `appMode === 'layer'`.

---

## ~~Issue #23 — Bipartite false positive on demo.json~~ ✅ SOLVED

**Root cause:** BFS 2-coloring in `dataParser.js:238–286` marks any acyclic sub-graph (e.g. a 3-node path) as bipartite because it never finds an odd cycle. The fix needs a minimum-edge or minimum-degree guard — a layer should not be declared bipartite unless it has enough structure to make the classification meaningful.

**Test plan for `tests/dataParser.integration.test.js` (Group D):**

### D.4 — demo.json: food-web layers must NOT be bipartite

```js
it('D.4 demo.json — no layer falsely reported as bipartite (food-web)', () => {
  // pond_1, pond_3 have 3-cycles → genuinely not bipartite.
  // pond_2 is a 3-node path → BFS false positive until fix.
  const model = parseMultilayerData(load('demo.json'))
  for (const [layerName, info] of model.bipartiteInfo) {
    expect(info.isBipartite, `layer "${layerName}" should NOT be bipartite`).toBe(false)
  }
})
```
**Will FAIL until the BFS heuristic is tightened.**

### D.5 — minimal synthetic path graph: must NOT be flagged as bipartite

```js
it('D.5 3-node path graph is not declared bipartite', () => {
  // Isolates the exact false-positive case: A–B–C with no cycles.
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
  const info = model.bipartiteInfo.get('L')
  expect(info.isBipartite).toBe(false)
})
```
**Will FAIL until fix. This is the minimal regression test for the exact bug.**

### D.6 — genuine bipartite layer must still be detected correctly

```js
it('D.6 explicit bipartite flag on layer is still detected', () => {
  // Regression guard: ensure the fix does not break real bipartite detection.
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
  expect(info.setA).toContain('U1')
  expect(info.setB).toContain('V1')
})
```
**Should PASS now and after the fix (regression guard).**

**Fix location:** `dataParser.js:238–286` — add a guard such as: skip BFS bipartite inference for any layer with fewer than 4 nodes or fewer edges than nodes (i.e. a tree/path), unless the layer has an explicit `bipartite: true` flag.

---

## Issue #18 — Snapshot misses map layer dots

**File:** `tests/browser/export.spec.js`

Add a new `describe('Map mode export', ...)` block.
Load `net22.json` via file input (same as `map_mode.spec.js`), switch to map mode, then:
1. Assert `#mapMarkersOverlay` is visible with non-zero bounding box.
2. Click `#captureBtn` — assert no JS errors (smoke only; pixel-diff deferred, High complexity).

These tests **pass** even with the bug — they document the expected state and catch crashes.


---

## Issue Complexity Reference

| # | Fix Complexity | Test Complexity |
|---|---|---|
| ~~**17** Zoom broken in layer mode~~ ✅ | ~~Low–Med~~ | ~~Med~~ |
| ~~**23** Bipartite false positive~~ ✅ | ~~Medium~~ | ~~Med~~ |
| **18** Snapshot misses map layer dots | Medium | High |

---

## FEAT-01 — Pan (drag to move view) is missing

**File:** `js/interaction.js`

User can zoom and rotate but cannot pan. Once zoomed in, parts of the network can go off-screen with no way to reach them.

- Planned fix: replace `interaction.js` with `panzoom` library (see CLAUDE.md)
- Implementing pan manually is an option but investing in panzoom may be smarter

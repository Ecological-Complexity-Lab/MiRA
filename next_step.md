# Next Step: Tests for Open Issues

## Issue #17 — Zoom broken in layer mode

**Files:** `app.js` + `tests/browser/layer_view.spec.js`

**app.js change (2 lines):**
- After line 549 (`renderer.layerView = new LayerView(...)`): add `window._layerView = renderer.layerView`
- At line 812 (`renderer.layerView = null`): add `window._layerView = null`

**Tests to add in `layer_view.spec.js`** (inside existing describe block):
```js
test('zoom-in button increases layerView.viewScale in layer mode', async ({ page }) => {
  await page.locator('#layerViewBtn').click()
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => window._layerView?.viewScale)
  await page.locator('#zoomInBtn').click()
  await page.waitForTimeout(100)
  const after = await page.evaluate(() => window._layerView?.viewScale)
  expect(after).toBeGreaterThan(before)
})

test('zoom-out button decreases layerView.viewScale in layer mode', async ({ page }) => {
  await page.locator('#layerViewBtn').click()
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => window._layerView?.viewScale)
  await page.locator('#zoomOutBtn').click()
  await page.waitForTimeout(100)
  const after = await page.evaluate(() => window._layerView?.viewScale)
  expect(after).toBeLessThan(before)
})
```
Tests will **fail** until zoom buttons route to `layerView.viewScale` when `appMode === 'layer'`.

---

## Issue #23 — Bipartite false positive on demo.json

**File:** `tests/dataParser.integration.test.js`

**Add to Group D:**
```js
it('D.4 demo.json — no layer falsely reported as bipartite (food-web)', () => {
  // pond_1, pond_3 have 3-cycles (not bipartite). pond_2 is a 3-node path —
  // BFS mis-colors it as bipartite (issue #23 false positive).
  const model = parseMultilayerData(load('demo.json'))
  for (const [layerName, info] of model.bipartiteInfo) {
    expect(info.isBipartite, `layer "${layerName}" should NOT be bipartite`).toBe(false)
  }
})
```
Will **fail** until `dataParser.js:238–286` BFS heuristic is tightened.

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
| **17** Zoom broken in layer mode | Low–Med | Med |
| **23** Bipartite false positive | Medium | Med |
| **18** Snapshot misses map layer dots | Medium | High |
| **15** Incorporate Infomap | Very High | Very High |

---

## FEAT-01 — Pan (drag to move view) is missing

**File:** `js/interaction.js`

User can zoom and rotate but cannot pan. Once zoomed in, parts of the network can go off-screen with no way to reach them.

- Planned fix: replace `interaction.js` with `panzoom` library (see CLAUDE.md)
- Implementing pan manually is an option but investing in panzoom may be smarter

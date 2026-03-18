# Known Bugs

Bugs discovered by the test suite. Each entry links to the test that documents it.

---

## ~~BUG-01 — NaN crashes the color gradient~~ ✓ FIXED

**File:** `multilayer_viz/js/colorMapper.js` — `buildColorScale`

**Fix:** Added `&& !isNaN(v)` to the `typeof v === 'number'` branch. A NaN value now
causes the whole attribute to be treated as categorical instead of crashing.

---

## BUG-03 — `options.skewX = 0` silently ignored in Renderer constructor

**File:** `js/renderer.js` — `constructor`

**Description:** The constructor uses `this.skewX = options.skewX || 0.7`. Since `0` is
falsy in JavaScript, passing `{ skewX: 0 }` falls back to the default `0.7`. Same issue
for `skewY`, `scale` (if 0 were passed), and any other option using `||` for defaults.

**Impact:** Cannot set `skewX=0` (flat/no-depth view) via constructor options.
Workaround: set `renderer.skewX = 0` directly after construction.

**Fix:** Replace `options.skewX || 0.7` with `options.skewX ?? 0.7` (nullish coalescing).

**Discovered by:** `tests/renderer.test.js` Group 1

---

## ~~BUG-02 — `forceType='continuous'` silently ignored for non-numeric data~~ ✓ FIXED

**File:** `multilayer_viz/js/colorMapper.js` — `buildColorScale`

**Fix:** Added an explicit branch for `forceType === 'continuous' && !allNumeric` that
falls back to categorical and adds a message to `result.warnings[]` naming the attribute.
All return objects now include a `warnings` array.

# Known Bugs

Bugs discovered by the test suite. Each entry links to the test that documents it.

---

## ~~BUG-01 — NaN crashes the color gradient~~ ✓ FIXED

**File:** `multilayer_viz/js/colorMapper.js` — `buildColorScale`

**Fix:** Added `&& !isNaN(v)` to the `typeof v === 'number'` branch. A NaN value now
causes the whole attribute to be treated as categorical instead of crashing.

---

## ~~BUG-02 — `forceType='continuous'` silently ignored for non-numeric data~~ ✓ FIXED

**File:** `multilayer_viz/js/colorMapper.js` — `buildColorScale`

**Fix:** Added an explicit branch for `forceType === 'continuous' && !allNumeric` that
falls back to categorical and adds a message to `result.warnings[]` naming the attribute.
All return objects now include a `warnings` array.

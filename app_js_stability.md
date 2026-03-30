# app.js Stability Findings

> Surfaced during dashboard refactor (2026-03-30) when removing the highlight/sort sidebar controls caused a latent TDZ bug to become reproducible.

---

## The Incident

Removing two `<select>` elements from `index.html` (and their matching `const` declarations from `app.js`) shifted the module initialization path just enough to expose a pre-existing bug: loading any dataset threw **"Cannot access 'committedSearchName' before initialization"**.

### Why it happened

`let committedSearchName = null` was declared at line ~3139 of `app.js`.
`resetVisualizationOptions()` assigns to it at line ~327 — 2800 lines earlier in the file.

In normal operation this works fine: by the time the user clicks "Load", the module has fully initialized and line 3139 has already executed. But if **anything throws during module initialization before line 3139**, `committedSearchName` stays in the temporal dead zone (TDZ). The next time a registered event listener fires and calls `loadData()` → `resetVisualizationOptions()`, the assignment hits the TDZ and throws.

The bug was always latent. The refactor changed which initialization path was taken and made it reliably reproducible.

**Fix applied:** moved `let committedSearchName = null` to the state block at the top of the file (~line 15), alongside the other state variables.

---

## What This Reveals About the Codebase

### 1. `app.js` has no module boundaries

At 3000+ lines, `app.js` mixes state declarations, DOM queries, function definitions, and event-listener registration in a single flat sequence. There is no enforced structure — correctness depends on the implicit top-to-bottom execution order of that specific file.

### 2. Module initialization is brittle

The file runs as a plain script: DOM queries and event-listener registrations execute as the parser reaches them. If any one statement throws — a missing element, a null dereference, a bad CDN response — everything declared after that point stays uninitialized. Registered listeners still fire, but the functions they call operate on uninitialized state, producing cryptic errors far from the actual root cause.

There is no `init()` function, no `DOMContentLoaded` wrapper, and no error boundary around the initialization sequence.

### 3. `let`/`const` at module scope used with `var` assumptions

The code appears to have been written (or incrementally migrated) with the assumption that module-level variables are always available when any function runs. That assumption holds for `var` (hoisted to `undefined`) but not for `let`/`const` (TDZ until the declaration line executes). Scattering `let` declarations across 3000 lines makes it easy to violate this implicitly.

### 4. Bugs hide behind bugs

The TDZ bug existed before this session. It was masked either because the triggering initialization failure wasn't being hit, or because the error was absorbed by another code path. One unrelated change was enough to surface it. This means other latent bugs of the same class likely exist.

### 5. No test covers the critical user path at the integration level

Unit tests (Vitest) test pure functions in isolation — they cannot catch module initialization failures. Playwright browser tests exist but did not cover the "load a file → data appears" path, which is the most fundamental thing the app does. A module initialization failure that breaks all data loading went undetected.

---

## Suggested Future Work

These are not urgent — note them for a future `app.js` health pass:

- **Wrap all initialization in an `init()` function** called after all declarations. This eliminates the ordering dependency and makes initialization failures easy to catch in one place.
- **Declare all module-level state at the top** in a clearly marked state block. No `let`/`const` for shared state should appear below the first function definition.
- **Add a Playwright smoke test** that loads a demo dataset and asserts the canvas renders something. This is the single most valuable integration test missing from the suite.
- **Split `app.js`** into logical units (state, data loading, rendering controls, export, search) once the above is stable. Reduces the blast radius of any single initialization failure.

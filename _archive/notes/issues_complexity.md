# GitHub Issues — Fix & Test Complexity

> Optional-labeled issues (#19, #20) excluded.

| # | Title | Fix Complexity | Why | Test Complexity | Why |
|---|-------|---------------|-----|-----------------|-----|
| ~~**22**~~ | ~~Missing network mode button~~ ✅ | **Low** | Add one button to index.html + wire a handler in app.js (mirror existing map-mode button pattern) | **Low** | Playwright: assert button exists and has correct icon attribute |
| ~~**21**~~ | ~~Legends do not close between modes~~ ✅ | **Low–Med** | Need to reset `expandedLegends` Set and re-call `renderLegends()` in each mode-switch path in app.js; several entry points to cover | **Low–Med** | Playwright: load data → switch to stats mode → assert legend panel is not visible/expanded |
| **17** | Zoom broken in layer mode | **Low–Med** | `interaction.js:52` has an early-return guard that blocks all zoom when `layerViewMode` is true; need to route zoom to LayerView's `viewScale` + `viewOffset` instead | **Med** | Playwright: enter layer mode → click zoom-in button → read canvas transform or call `page.evaluate` to inspect `layerView.viewScale` before/after |
| **23** | Bipartite false positive on demo.json | **Medium** | BFS 2-coloring in `dataParser.js:238–286` produces a false positive; need to reproduce with demo.json, trace why, and tighten the heuristic | **Med** | Vitest unit test: parse demo.json → assert `bipartiteInfo.get(layerName).isBipartite === false` for all layers |
| **18** | Snapshot misses map layer dots | **Medium** | Export code captures the main canvas but skips the `mapMarkersOverlay` div; need to composite the overlay into the exported image (html2canvas multi-element merge) | **High** | Must compare exported image pixels or base64 — fragile; alternatively assert overlay canvas is included in the composite, but full proof needs pixel-diff |
| **15** | Incorporate Infomap | **Very High** | No existing code; Infomap is a separate algorithm requiring a browser-loadable library (or WASM port), new UI controls, pipeline integration, and result display — a substantial new feature | **Very High** | Needs known-answer test cases for the algorithm, UI interaction tests, and likely a mock for the library itself |

## Key Takeaways

- ~~Issues **22, 3, 21** are the quick wins — low fix and test complexity, good starting points.~~ #22 and #21 done.
- Issue **17** is slightly tricky on the test side because you need to inspect internal canvas state.
- Issue **18** is deceptively medium to fix but hard to test reliably without pixel comparison.
- Issue **15** is a major feature — scope it separately before starting.

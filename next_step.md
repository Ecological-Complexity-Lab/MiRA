# Next Step: SVG Export — File Save Not Working in Browser

> **Code quality findings:** A latent TDZ bug surfaced during the 2026-03-30 dashboard refactor and revealed broader stability risks in `app.js`. See [app_js_stability.md](app_js_stability.md) for the full analysis and suggested remediation.

> Some tests in the suite were already failing before this work and are unrelated to it.
> See [not_passing_tests.md](not_passing_tests.md) for the full list and root causes.

## What was done (session 2026-03-29)

### Issue #18 — Snapshot misses map layer dots ✅ FIXED
Map export (PNG, JPG, PDF) was missing the `#mapMarkersOverlay` div.
Fixed by adding an `html2canvas` capture of the overlay and compositing it on top of the network canvas in both `exportScreenshot` and `_exportPDF`.

### SVG button not visible in export dialog ✅ FIXED
`.dialog-buttons` had no `flex-wrap`, so with 5 buttons (PNG, JPG, PDF, SVG, Cancel) the SVG button overflowed off-screen.
Fixed by adding `flex-wrap: wrap` to `.dialog-buttons` in `css/style.css`.

### SVG export — "Could not load SVG library" alert ✅ FIXED
`canvas2svg@1.0.15` was removed from both unpkg and jsDelivr CDNs. Updated to `1.0.16` in `js/app.js`.

### Playwright tests ✅ ALL PASSING
Three tests added to `tests/browser/export.spec.js` (SVG export describe block):
- SVG button is visible in export dialog
- SVG button is enabled in network mode
- SVG export loads canvas2svg from CDN and shows no error alert

---

## Open investigation: SVG file is never saved in the browser

Despite the above fixes and all tests passing, clicking SVG in the live browser produces **no file download**.

### Known facts
- The canvas2svg CDN URL (`1.0.16`) is reachable and returns HTTP 200.
- The Playwright test confirms the CDN request succeeds and no alert fires — so `_exportSVG` runs past the library-load step.
- The file is **not saved**: neither the `showSaveFilePicker` path nor the `a.click()` fallback produces a download.

### Hypotheses to investigate
1. **`showSaveFilePicker` throws a non-AbortError** (e.g. `SecurityError` or `NotAllowedError`) — the `catch` only skips logging for `AbortError`, so any other error is `console.error`'d and execution ends with no download. Check DevTools console for errors after clicking SVG.
2. **`renderer.render()` throws inside the canvas2svg context** — canvas2svg does not implement the full Canvas2D API; if an unsupported method is called, the error may be swallowed by a try/catch higher up. Check for errors in the console after click.
3. **`c2s.getSerializedSvg()` returns an empty string** — the SVG blob is created but is empty/invalid, and the save silently fails. Add a `console.log(svgStr.slice(0, 200))` to verify.

### Suggested next step
Open DevTools, click SVG export, and inspect:
- Console errors/warnings after the click
- Network tab: does the `canvas2svg` script load? Does anything else load?
- Is `showSaveFilePicker` invoked? Does it throw?

Once the root cause is identified, fix `_exportSVG` in `js/app.js`.

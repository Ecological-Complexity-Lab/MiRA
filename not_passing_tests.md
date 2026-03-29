# Pre-existing Failing Tests

These tests were already failing before the export/SVG work (2026-03-29).
Verified by stashing all changes and running the suite against the unmodified codebase — same failures.

---

## Unit tests (Vitest) — 3 failures

**File:** `tests/dataParser.integration.test.js` and `tests/csvImporter.test.js`

| Test | Error |
|---|---|
| Group A — `pond_ecosystem.json` | `ENOENT: no such file or directory` |
| Group A — `demo_bipartite_rich.json` | `ENOENT: no such file or directory` |
| Group 9 — `net22_extended.csv` | `ENOENT: no such file or directory` |

**Root cause:** The data files `data/pond_ecosystem.json`, `data/demo_bipartite_rich.json`, and `data/net22_extended.csv` are not committed to the repository. The tests try to read them from disk at test time and crash.

**Fix:** Either commit the missing files or skip/remove the tests that depend on them.

---

## Playwright tests — 7 failures

**Files:** `tests/browser/data.spec.js`, `tests/browser/map_mode.spec.js`

| Test |
|---|
| Data loading › load demo dataset: demo_directed |
| Map mode › map button appears after loading geo dataset (net22) |
| Map mode › clicking map button shows Leaflet map |
| Map mode › map opacity control appears in map mode |
| Map mode › map opacity slider changes without crash |
| Map mode › show map checkbox toggles without crash |
| Map mode › clicking map button again returns to network mode |

**Root cause:** Timing / network issues in the test environment. Leaflet map tile requests and demo data fetches don't complete within the test timeouts when the server is under load (3 parallel workers, single-threaded `python3 -m http.server`).

**Fix options:**
- Increase timeouts in the failing tests
- Mock the Leaflet tile requests so they don't depend on external network
- Reduce worker count further (already at 3 in `playwright.config.js`)

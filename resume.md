# Resume Point — 2026-04-09

## What was done last session

- All 222 tests pass (both `multilayer_viz/tests/` and root `tests/`)
- Moved `vitest.config.js` + `playwright.config.js` → `config/`
- Moved `run_tests.sh` → `scripts/`
- Fixed `tests/setup.js` in multilayer_viz (was missing chroma, d3, graphology globals)
- Updated tests to match current code (BFS removed, node_type not renamed to group)

## What still needs to be done

1. **Commit everything on `main`** — all the file moves and test fixes are uncommitted
   - Staged files: `config/`, `scripts/`, `tests/`, `package.json`
   - Commit message: `chore: move configs to config/, fix test setup for current code`

2. **main is already up to date with origin/main** — just need the commit above, then push.

3. **Check PR #33** — likely stale, should be closed.

4. **Sync `phase2_optional_refactoring_and_features`** — still has old test setup and root-level config files. Either cherry-pick or leave as-is (dev branch).

5. **Remaining planned refactors** (from CLAUDE.md, deferred):
   - `layout.js` — graphology-layout (medium risk)
   - `dataParser.js` — graphology-metrics / graphology-bipartite (medium risk)
   - `colorMapper.js` — chroma.js (low risk)
   - Konva, Observable Plot, Floating UI — deferred (too big/risky)

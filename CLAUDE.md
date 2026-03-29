# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## GitHub Repository

- Main repo: `Ecological-Complexity-Lab/multilayer_viz` (origin)
- Pages/test repo: `yuvalbloch/multilayer_viz_test` (pages remote)
- Issues and PRs are tracked on the main repo.

---

## Active Scope

Work only inside `multilayer_viz/`. Ignore `_archive/` — legacy files only.

---

## Git Workflow (always follow this)

1. All work is done on the `minimal_varsion` branch to keep context clean.
2. When a task is complete and committed on `minimal_varsion`, cherry-pick the commit(s) to `refactor/phase1`.
3. Push from `refactor/phase1`.

```bash
# After committing on minimal_varsion:
git log --oneline -3                      # note the commit SHA
git checkout refactor/phase1
git cherry-pick <sha>
git push
git checkout minimal_varsion             # return to working branch
```

---

## Running Tests

```bash
npm test              # run all Vitest unit tests once
npm run test:watch    # re-run on file changes
```

Unit tests live in `tests/` and run in Node.js via Vitest (`vitest.config.js`).
Browser (Playwright) tests live in `tests/browser/` and require the app to be served first.

---

## Running the App

The app uses native ES6 modules and **cannot** be opened via `file://`. Always serve over HTTP:

```bash
cd multilayer_viz
python3 -m http.server 8000
# Then open http://localhost:8000
```

---

## Architecture

The web app lives entirely in `multilayer_viz/`. Ignore `_archive/` — legacy files only.

### Data pipeline (the critical path)

```
User file (JSON or CSV)
  → csvImporter.js::csvToJson()            [CSV only — uses PapaParse]
  → dataParser.js::parseMultilayerData()   → model object
  → layout.js::ForceLayout.computeLayout() → positions map
  → renderer.js::Renderer.setData()
  → renderer.render()
```

`app.js` owns all global state (`model`, `positions`, `renderer`, `colorMapper`, `layout`) and wires every UI control to its handler. It is the only file that touches the DOM.

### The `model` object (produced by `dataParser.js`)

Every module reads from this shared object. Key fields:
- `nodes`, `layers`, `extended`, `stateNodes` — raw data arrays
- `intralayerLinks`, `interlayerLinks` — pre-classified edges
- `stateNodeMap` — `"layerName::nodeName"` → state-node object (the main lookup key used everywhere)
- `nodesPerLayer` — `Map<layerName, Set<nodeName>>`
- `bipartiteInfo` — `Map<layerName, { isBipartite, setA, setB, ... }>`
- `nodeAttributeNames`, `linkAttributeNames`, `layerAttributeNames` — drive the color/size dropdowns

### Four visualization modes

All modes share the same `#networkCanvas`. Mode transitions are handled by `app.js` calling `activate()`/`deactivate()` on the relevant class:

| Mode | Driven by | Renders to |
|---|---|---|
| Network (default) | `renderer.js` | Canvas (custom oblique 3D projection) |
| Map | `renderer.js` + Leaflet | Canvas overlaid on Leaflet map |
| Layer View | `layerView.js` | Canvas (d3-force animation loop) |
| Dashboard | `dashboard.js` | DOM `<div>` as SVG strings (not the canvas) |

### Projection math (`renderer.js`)

The 3D effect is a hand-rolled oblique isometric projection — no 3D library. Key parameters on the `Renderer` instance: `skewX`, `skewY` (rotation angles in radians), `scale`, `offsetX`, `offsetY`, `layerSpacing`, `stackMode` (`'horizontal'|'vertical'`). The `project(x, y, layerIndex)` method is the single source of truth for all coordinate transforms.

Hit-testing is handled by a Konva overlay (`_initKonvaOverlay` in `renderer.js`) — an invisible `Konva.Stage` on top of the canvas with shapes for nodes, links, and layer polygons. Manual hit-test methods were removed.

### Color mapping

`colorMapper.js` provides a unified `buildColorScale(items, attrName)` that auto-detects numeric vs. categorical and returns a `scaleFn`. Uses chroma.js (ColorBrewer Dark2 palette + Viridis scale). The renderer calls `nodeColorFn` / `linkColorFn` callbacks (set by `app.js`) rather than calling `colorMapper` directly.

### Bipartite support

Detected in `dataParser.js` via BFS 2-coloring (or explicit `layer.bipartite === true` + `node_type` attribute). The resulting `bipartiteInfo` map is consumed by renderer (set-color coding), layout (two-row positioning), layerView, and dashboard — detection is not repeated anywhere.

---

## JSON Data Format

The visualizer requires this internal JSON shape (also produced by `csvToJson`):

```json
{
  "directed": false,
  "layers": [{ "layer_id": 1, "layer_name": "Forest", "latitude": 42.3, "longitude": 3.1 }],
  "nodes":  [{ "node_id": "sp_1", "layer_name": "Forest", "node_name": "Bee", "group": "pollinator" }],
  "extended": [{ "layer_from": "Forest", "node_from": "Bee", "layer_to": "Forest", "node_to": "Flower", "weight": 1.5 }],
  "state_nodes": [{ "layer_name": "Forest", "node_name": "Bee" }]
}
```

`extended` is the flat edge list (both intra- and interlayer links). `state_nodes` enumerates every (layer, node) pair present in the network. The `links` key in user-facing JSON is remapped to `extended` by the parser.

---

## External Dependencies (all via CDN in `index.html`)

| Library | Purpose |
|---|---|
| Leaflet | Geographic map mode |
| PapaParse | CSV parsing in `csvImporter.js` |
| chroma.js | Color scales in `colorMapper.js` |
| d3-format | Number formatting in `dashboard.js` |
| graphology + graphology-shortest-path | BFS distances for Kamada-Kawai layout |
| Konva 9 | Hit-testing overlay in `renderer.js` |
| Inter font | Typography only |

---

## How to Work on This Project

### Task workflow (always follow this)

1. If the task is unclear, ask before doing anything.
2. **Token estimate first.** Before starting any task, estimate the token cost using the table below. If the estimate exceeds ~20% of the Claude Pro 5-hour limit (~50k tokens), state the estimate, explain the main drivers, and ask the user to confirm before proceeding.
3. Present a plan and wait for approval before writing code.
4. If the attempt is not working within ~10 minutes, or requires hundreds of lines of code, **stop**. Revert to the previous state and write an `attempt_summary_<topic>.md` file describing what was tried and why it failed. The user will then decide the next step.
5. Every completed step ends with a commit so the working state is always recoverable.

#### Token cost reference

| Task type | Rough estimate | Main drivers |
|---|---|---|
| Quick explanation or small bug fix | < 5k | Short context, 1–2 turns |
| Single-file edit + test | 10k–30k | File read + edits + test output |
| Medium refactor (1 large file, debug cycle) | 30k–80k | Large file in context × many turns |
| Multi-file refactor or new feature | 80k–200k | Multiple large files + test iterations |
| Full architecture change or long debug loop | 200k+ | Compounding context across many turns |

**Cost multipliers to flag explicitly:**
- Each large file read (> 400 lines) ≈ +5k–15k per turn it stays in context
- Each Playwright / test run output ≈ +3k–8k
- Debug loops (read → fix → retest × N) multiply total by N
- `/compact` helps but the summary itself adds ~5k to every subsequent turn

### Code rules

- **No nesting deeper than 2 levels.** Extract deeper logic into a named function so the caller reads like pseudocode.
- **No magic numbers.** Use named constants.
- **One function, one responsibility.**

### Current phase: bug fixes

Phase 1 refactoring is largely complete (PapaParse, chroma.js, d3-format, graphology BFS, Konva hit-testing all done). Current focus is fixing open GitHub issues — see `bugs.md` and `next_step.md` for active work. Do not add features unless explicitly asked.

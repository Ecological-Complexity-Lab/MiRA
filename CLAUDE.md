# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Tests

```bash
npm test          # run all tests once
npm run test:watch  # re-run on file changes
```

Tests live in `tests/`. Vitest is the framework (`vitest.config.js` at root). No browser required — all current tests are pure Node.js.

## Running the App

The app uses native ES6 modules and **cannot** be opened via `file://`. Always serve it over HTTP:

```bash
cd multilayer_viz
python3 -m http.server 8000
# Then open http://localhost:8000
```

There is no build step, no bundler, no package.json, and no test suite. Changes to any `.js` file take effect immediately on browser refresh.

## Architecture

The web app lives entirely in `multilayer_viz/`. The `emln/` folder is an R package that bundles a copy of the web app under `emln/inst/multilayer_viz/` — changes to the web app must be manually mirrored there if R integration is needed.

### Data pipeline (the critical path)

```
User file (JSON or CSV)
  → csvImporter.js::csvToJson()       [CSV only]
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
| Layer View | `layerView.js` | Canvas (independent force-directed animation loop) |
| Dashboard | `dashboard.js` | DOM `<div>` as SVG strings (not the canvas) |

### Projection math (`renderer.js`)

The 3D effect is a hand-rolled oblique isometric projection — no 3D library. Key parameters on the `Renderer` instance: `skewX`, `skewY` (rotation angles in radians), `scale`, `offsetX`, `offsetY`, `layerSpacing`, `stackMode` (`'horizontal'|'vertical'`). The `project(x, y, layerIndex)` method is the single source of truth for all coordinate transforms. Hit-testing (`hitTestNode`, `hitTestLink`, `hitTestLayer`) runs in screen space after projection.

### Color mapping

`colorMapper.js` provides a unified `buildColorScale(items, attrName)` that auto-detects numeric vs. categorical and returns a `scaleFn`. The renderer calls `nodeColorFn` / `linkColorFn` callbacks (set by `app.js`) rather than calling `colorMapper` directly.

### Bipartite support

Detected in `dataParser.js` via BFS 2-coloring (or explicit `layer.bipartite === true` + `node_type` attribute). The resulting `bipartiteInfo` map is consumed by renderer (set-color coding), layout (two-row positioning), layerView, and dashboard — detection is not repeated anywhere.

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

## External Dependencies

Only two, both loaded from CDN in `index.html`:
- **Leaflet** — geographic map mode only
- **Inter font** — typography only

---

## How to Work on This Project

### Workflow (always follow this)

1. If the task is unclear, ask before doing anything.
2. Present a plan and wait for approval before writing code.
3. If the attempt is not working within ~10 minutes, or requires hundreds of lines of code, **stop**. Revert to the previous state and write an `attempt_summary_<topic>.md` file describing what was tried and why it failed. The user will then decide the next step.
4. Every completed step ends with a commit so the working state is always recoverable.

### Code rules

- **No nesting deeper than 2 levels.** Extract deeper logic into a named function so the caller reads like pseudocode.
- **No magic numbers.** Use named constants.
- **One function, one responsibility.**

### Current phase: refactoring only

The project is in Phase 1 — refactoring without behavior changes. Do not add features. If a refactor starts touching behavior, stop and flag it.

### Library constraint

Deployment is GitHub Pages with no build step. Any new library must be loadable via a single CDN `<script>` tag. No npm, no bundler.

### Planned library replacements

The following self-implementations are known candidates for replacement. When touching these files, prefer moving toward the listed library rather than extending the custom code:

| Functionality | File | Target library |
|---|---|---|
| CSV parsing | `csvImporter.js` | PapaParse |
| Zoom / pan | `interaction.js` | panzoom |
| Layout algorithms | `layout.js` | d3-force + graphology-layout |
| Canvas rendering infrastructure | `renderer.js` | Konva.js |
| Network statistics | `dataParser.js`, `dashboard.js` | graphology-metrics |
| Bipartite detection | `dataParser.js` | graphology-bipartite |
| Color scales | `colorMapper.js` | chroma.js |
| SVG chart generation | `dashboard.js` | Observable Plot |
| Bubble force layout | `layerView.js` | d3-force |
| Tooltips | `app.js`, `interaction.js` | Floating UI |
| Shortest-path distances | `layout.js` | graphology-shortest-path |
| Number formatting | `dashboard.js` | d3-format |

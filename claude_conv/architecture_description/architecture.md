# Architecture Documentation — multilayer_viz

Generated: 2026-03-17

---

## Project Overview

**multilayer_viz** is an interactive, browser-based visualization tool for multilayer ecological networks. It renders complex network data — where nodes participate across multiple layers (e.g., species across habitat types) — through four distinct visualization modes:

1. **Network Mode** — 3D oblique-projection canvas rendering of the full multilayer graph
2. **Map Mode** — Layers anchored to geographic coordinates via Leaflet satellite maps
3. **Layer View** — Meta-graph of layers as force-directed bubbles with micro-graph previews
4. **Dashboard** — Statistical analytics with SVG charts and heatmaps

**Architectural pattern**: Single-Page Application (SPA) with modular ES6 components, no build step, no framework. The app is also bundled inside the `emln` R package (`emln/inst/multilayer_viz/`) so R users can launch it directly from R via `plot_multilayer()`.

---

## Folder Structure

```
vis_net_shai/
└── multilayer_viz/
    ├── index.html                    # SPA entry point; all panels, modals, and canvas
    ├── README.md                     # User-facing quick-start guide
    ├── css/
    │   └── style.css                 # Full UI styling (glassmorphism design system)
    ├── js/
    │   ├── app.js                    # App orchestrator; global state, UI wiring
    │   ├── dataParser.js             # JSON ingestion, validation, bipartite detection
    │   ├── renderer.js               # Canvas 2D rendering engine (3D oblique projection)
    │   ├── layout.js                 # Graph layout algorithms (FR, KK, bipartite, etc.)
    │   ├── colorMapper.js            # Attribute → color scale mapping
    │   ├── interaction.js            # Mouse/keyboard event handler
    │   ├── csvImporter.js            # CSV → internal JSON converter
    │   ├── layerView.js              # Meta-graph "layer bubble" visualization
    │   └── dashboard.js              # SVG analytics dashboard
    ├── data/
    │   ├── demo*.json                # Pre-built demo datasets (7 included)
    │   ├── synth_*.json              # Synthetic test datasets
    │   ├── *.py / *.js               # Data generation scripts
    │   └── (14 total JSON files)
    ├── docs/
    │   ├── DOCUMENTATION.md          # Detailed feature documentation
    │   └── manual.html               # Full HTML user manual
    ├── dev/
    │   └── matrix_mode/js/
    │       └── matrixView.js         # Experimental matrix layout (not yet integrated)
    ├── emln/                         # R package integration
    │   ├── R/
    │   │   ├── emln.R                # Core package functions
    │   │   ├── create_multilayer_network.R   # R data structure builders
    │   │   ├── multilayer_to_json.R  # R → JSON serialization
    │   │   ├── plot_multilayer.R     # Launches the web visualizer from R
    │   │   └── emln1-78_*.R          # 78 real-world ecological datasets
    │   ├── man/                      # R documentation (Rd files)
    │   ├── inst/multilayer_viz/      # Bundled copy of the web app for R package
    │   └── run_plotmultilayer.R      # Demo/test script
    └── test/                         # Screenshots and test output assets
```

---

## File Reference

### `index.html`
- **Role**: SPA shell. Defines all DOM structure — canvas, control panels, modals, toolbars, info panels.
- **Main elements**: `#networkCanvas` (rendering target), left accordion control panels (Data, Layers, Nodes, Links, Search, Dashboard), right info/legend panels, mode-switch toolbar at bottom, modals for export/demo/CSV import.
- **Dependencies**: `css/style.css`, Leaflet (CDN), `js/app.js` (as `type="module"`)

---

### `css/style.css`
- **Role**: Complete UI styling. Glassmorphism design language with frosted-glass panels, custom form controls, SVG chart rules, responsive layout.
- **Key design tokens**: Accent color `#6366f1` (indigo), `backdrop-filter: blur()` for panels, Inter font (CDN).
- **Dependencies**: None

---

### `js/app.js`
- **Role**: Application orchestrator. Holds global mutable state, initializes all modules, wires every UI control to its handler, drives mode transitions.
- **Global state variables**:
  - `model` — parsed multilayer data object
  - `positions` — `Map<layerName, Map<nodeName, {x,y}>>` layout positions
  - `renderer` — `Renderer` instance
  - `colorMapper` — `ColorMapper` instance
  - `layout` — `ForceLayout` instance
  - `appMode` — `'network' | 'map' | 'layer' | 'dashboard'`
- **Key functions**:
  - `loadData(json)` — parse, layout, render a new dataset; reset all UI
  - `resetVisualizationOptions()` — reset all controls to defaults
  - `toggleMapMode()` — switch between network and Leaflet map view
  - `_enterLayerView()` / `_exitLayerView()` — activate/deactivate meta-graph mode
  - `_enterDashboard()` / `_exitDashboard()` — activate/deactivate analytics mode
  - `populateDropdowns()` — rebuild all attribute selectors from model
  - `renderLegends()` — generate and inject legend HTML
  - `showNodeInfo(node)` / `hideNodeInfo()` — manage right-side info panel
- **Dependencies**: `dataParser.js`, `renderer.js`, `layout.js`, `interaction.js`, `colorMapper.js`, `layerView.js`, `csvImporter.js`, `dashboard.js`

---

### `js/dataParser.js`
- **Role**: Ingests raw JSON, validates required fields, computes derived metrics (degree, strength, in/out degree), builds lookup maps, detects bipartite layer structure.
- **Main exports**:
  - `parseMultilayerData(json)` — top-level parser; returns the `model` object consumed by all other modules
  - `detectBipartiteLayers(layers, stateNodes, links)` — orchestrates bipartite detection per layer
  - `tryBipartiteColoring(nodes, links)` — BFS 2-coloring algorithm; returns `{isValid, setA, setB}` or null
  - `extractExtraAttributes(items, excludeKeys)` — collects non-standard attribute names for dropdown population
- **Bipartite detection strategies**:
  1. Explicit: layer has `bipartite: true` and nodes carry `node_type`
  2. Auto-detect: BFS 2-coloring on intralayer edges
- **Returned model shape**:
  ```
  { nodes, layers, extended, stateNodes,
    nodesById, nodesByName, layersById, layersByName,
    intralayerLinks, interlayerLinks,
    stateNodeMap,           // "layerName::nodeName" → node
    nodesPerLayer,          // layerName → Set<nodeName>
    nodeAttrNames, linkAttrNames, layerAttrNames,
    bipartiteInfo }         // layerName → {setA, setB}
  ```
- **Dependencies**: None (pure data transformation)

---

### `js/renderer.js`
- **Role**: Canvas 2D rendering engine. Implements custom 3D oblique projection, full scene draw loop, and hit-testing for interaction.
- **Class**: `Renderer`
- **Key methods**:
  - `project(x, y, layerIndex)` — maps layer-local (x,y) → screen (sx,sy) using isometric skew angles; handles map mode via Leaflet `latLngToContainerPoint`
  - `render()` / `renderToContext(ctx)` — full scene repaint (back-to-front layer order)
  - `hitTestNode(sx, sy)` / `hitTestLink(sx, sy)` / `hitTestLayer(sx, sy)` — pixel-space collision detection
  - `getNodeScreenPos(layerName, nodeName)` — screen position query for tooltip placement
  - `getLayerCorners(layerIndex)` — screen corners of a layer polygon
- **Rendering pipeline** (back-to-front):
  1. Background clear
  2. Per-layer: polygon fill → intralayer links → nodes
  3. Interlayer links (cubic Bézier curves)
  4. Highlights (hover glow, selection ring, search pulse animation)
- **Config properties**: `skewX`, `skewY`, `scale`, `offsetX`, `offsetY`, `layerSpacing`, `stackMode` (`'horizontal'|'vertical'`), `layerOffsets` (per-layer drag map)
- **Callback hooks**: `nodeColorFn`, `nodeSizeFn`, `linkColorFn`, `layerColorFn`
- **Dependencies**: `colorMapper.js` (indirectly via callbacks set by `app.js`)

---

### `js/layout.js`
- **Role**: Computes 2D node positions within each layer using pluggable layout algorithms.
- **Class**: `ForceLayout`
- **Algorithms**:
  | Algorithm | Key mechanic |
  |---|---|
  | `fruchterman-reingold` (default) | Repulsion + spring attraction, temperature cooling, ~150 iterations |
  | `kamada-kawai` | Spring-energy minimization via Floyd-Warshall shortest paths, gradient descent, ~200 iterations |
  | `bipartite` | Two-row layout; nodes ordered by degree within each bipartite set |
  | `circle` | Evenly spaced on circle perimeter |
  | `grid` | Regular n×n grid |
  | `random` | Uniform random positions |
- **Key methods**:
  - `computeLayout(model, algorithm, options)` — dispatches to algorithm, returns positions map
  - `_fruchtermanReingold(layer, nodes, links, bounds)` — FR implementation
  - `_kamadaKawai(layer, nodes, links, bounds)` — KK implementation
  - `_bipartiteLayout(layer, nodes, links, bounds, bipartiteInfo)` — two-row layout
- **Consistency feature**: nodes appearing in multiple layers start from shared initial positions
- **Output**: `Map<layerName, Map<nodeName, {x, y}>>` (positions in layer-local space, normalized to fit bounds)
- **Dependencies**: `dataParser.js` output (reads `model`)

---

### `js/colorMapper.js`
- **Role**: Maps any node/link/layer attribute to colors using categorical or continuous scales. Auto-detects data type.
- **Class**: `ColorMapper`
- **Built-in palettes**:
  - Categorical: 15-color vibrant palette
  - Continuous: Viridis-inspired gradient (dark purple → blue → green → yellow)
  - Bipartite: Set A = `#0072b2`, Set B = `#f472b6`
  - Layer default: `#a78bfa`
- **Key methods**:
  - `buildColorScale(items, attrName, forceType)` — creates and caches a color scale for an attribute; returns `{scaleFn, type, min, max, domain, canToggle}`
  - `numericGradient(t)` — interpolate continuous palette at `t ∈ [0,1]`
  - `getLayerFill(layerIndex)` / `getLayerBorder(layerIndex)` — layer coloring
  - `getBipartiteNodeColor(isSetA)` — bipartite-aware node color
  - `getNodeLayerColor(layerIndex)` — fallback node color by layer index
- **Dependencies**: None (pure utility)

---

### `js/interaction.js`
- **Role**: Translates raw DOM mouse/keyboard events into semantic application actions.
- **Class**: `InteractionHandler`
- **Mouse gesture map**:
  | Gesture | Action |
  |---|---|
  | Left-drag on empty | 3D rotation (adjust `skewX`, `skewY`) |
  | Shift + left-drag | Pan |
  | Cmd/Ctrl + left-drag | Drag individual layer |
  | Left-click | Select node / link / layer |
  | Double-click on empty | Deselect all |
  | Scroll wheel | Zoom toward cursor |
  | Hover | Highlight + tooltip |
- **Callbacks fired**: `onNodeSelect`, `onNodeHover`, `onLayerSelect`, `onLinkSelect` (wired by `app.js`)
- **State tracked**: `isDragging`, `isPanning`, `isRotating`, `isDraggingLayer`, drag origins, hover state
- **Dependencies**: `renderer.js` (calls hit-test methods)

---

### `js/csvImporter.js`
- **Role**: Converts user-supplied CSV files into the internal JSON format accepted by `parseMultilayerData`.
- **Main exports**:
  - `parseCsv(text)` — RFC-4180-compliant parser; auto-detects `,`/`\t`/`;` delimiter; returns `{headers, rows}`
  - `csvToJson(edgeListText, layersText, nodesText, options)` — full conversion pipeline
- **Input files**:
  | File | Required | Key columns |
  |---|---|---|
  | Edge list | Yes | `layer_from`, `node_from`, `layer_to`, `node_to`, `weight` |
  | Layer attributes | No | `layer_id`, `layer_name`, `latitude`, `longitude` |
  | Node attributes | No | `node_name`, `group` / `node_type` |
- **Auto-derivation**: layers and nodes are inferred from edge list if separate files omitted
- **Output**: `{ json, infoMessages, warnings }` — `json` is ready for `parseMultilayerData()`
- **Dependencies**: None

---

### `js/layerView.js`
- **Role**: Alternative visualization mode that renders layers as animated force-directed bubbles, each containing a micro-graph preview of its topology.
- **Class**: `LayerView`
- **Key methods**:
  - `activate(model, canvas)` / `deactivate()` — mount/unmount with animation loop
  - `_computeMetaGraph()` — build bubble data (nodeCount, edgeCount, density) and meta-edges (interlayer links + shared-node connections)
  - `_refreshRadii()` — recompute bubble radii from current `sizeBy` setting
  - `_stepForce()` — one iteration of Fruchterman-Reingold for bubble positions; includes hard overlap separation
  - `_initLayout()` — pre-settle layout before first render
  - `render()` — draw all bubbles, edges, labels, selection highlights to canvas
  - `getLegendScales()` — return legend metadata for `app.js` to render
  - `updateSetting(key, value)` — handle settings changes with appropriate side effects
- **Bubble sizing options**: by node count, edge count, density, or uniform
- **Bubble coloring options**: by layer (categorical), node count (continuous), edge density (continuous), uniform
- **Meta-edge metrics**: interlayer link count or shared node count, with minimum-weight filter
- **Interaction**: bubble drag + pin, single-click selection (stats panel), Cmd+click comparison panel, zoom/pan
- **Dependencies**: `colorMapper.js`, `renderer.js` (canvas element shared)

---

### `js/dashboard.js`
- **Role**: Generates a static SVG analytics dashboard for the loaded network.
- **Class**: `Dashboard`
- **Chart sections rendered**:
  | Section | Content |
  |---|---|
  | KPI Cards | Node count, layer count, edge count, mean density |
  | Per-Layer Bars | Node count (stacked if bipartite), edge count, density, interlayer links |
  | Node × Layer Matrix | Heatmap — which nodes appear in which layers |
  | Layer Similarity | Jaccard similarity heatmaps for node identity and edge identity |
  | Degree Distribution | Histogram for full network + per-layer breakdowns |
  | Node Participation | Bar chart of how many layers each node appears in |
  | Set Size Ratio | (bipartite only) Set A vs B counts per layer |
- **SVG helper methods**: `svgBar()`, `svgStackedBar()`, `svgHist()`, `svgHeatmap()`
- **Key methods**:
  - `render(model, container)` — recompute stats and regenerate all DOM sections
  - `_computeStats()` — aggregation of per-layer and per-node statistics
  - `_sortNodes()` — sort nodes by participation, name, or bipartite set
  - `_sec(title, content)` — collapsible section builder
- **User settings**: `_sortOrder`, `_highlightMetric`, `_showBipartite`, `_matrixFlipped`
- **Dependencies**: None (reads `model` directly, produces DOM)

---

### `dev/matrix_mode/js/matrixView.js`
- **Role**: Experimental adjacency matrix layout mode — not yet integrated into the main app.
- **Status**: Development/prototype; purpose is to render the multilayer network as an adjacency matrix rather than a node-link diagram.
- **Dependencies**: Unknown (isolated in dev folder)

---

### `data/` (JSON & scripts)
- **Role**: Sample datasets and generation scripts for development and demos.
- **Contents**: 14 JSON files including `demo_*.json` (curated ecological network demos) and `synth_*.json` (synthetic test data). Python and JS scripts generate these files programmatically.

---

### `emln/R/*.R`
- **Role**: R package source files that allow ecologists to use the visualizer from within R.
- **Key files**:
  - `emln.R` — package-level imports and core utility functions
  - `create_multilayer_network.R` — R S3 constructors for multilayer network objects
  - `multilayer_to_json.R` — serializes R network objects to the JSON format consumed by the web app
  - `plot_multilayer.R` — launches a local HTTP server and opens the visualizer in the browser
  - `emln1-78_*.R` — 78 built-in real-world ecological network datasets as R data objects
- **Dependencies**: R packages `jsonlite`, `htmltools`, `servr` (or similar local server)

---

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│  Input Sources                                           │
│                                                          │
│  JSON file / demo / R emln package                       │
│  CSV edge-list + optional layer/node attribute files     │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼ (if CSV)
        csvImporter.js::csvToJson()
                 │
                 ▼
        dataParser.js::parseMultilayerData()
                 │ produces: model object
                 │ (nodes, layers, links, lookup maps,
                 │  bipartiteInfo, attribute name lists)
                 │
        ┌────────┴────────┐
        ▼                 ▼
  layout.js          app.js wires UI
  computeLayout()    populateDropdowns()
        │            renderLegends()
        │ produces:
        │ positions map
        │
        └────────┬────────┘
                 ▼
         renderer.js::setData(model, positions)
                 │
        ┌────────┼──────────────────────┐
        ▼        ▼                      ▼
   render()  hitTest*()           colorMapper.js
  (canvas)  (interaction.js)      buildColorScale()
        │
        ▼
  Canvas 2D output (Network / Map mode)

  ── Mode switches ──────────────────────────────────────

  appMode = 'layer':     layerView.js::activate(model)
                         → force-layout bubbles on canvas

  appMode = 'dashboard': dashboard.js::render(model, container)
                         → SVG charts injected into DOM
```

---

## Key Design Decisions

### 1. No build toolchain
The project uses native ES6 `import`/`export` and runs directly from a static file server (`python3 -m http.server 8000`). There is no Webpack, Vite, Rollup, or TypeScript compilation step. This simplifies R package integration (the `inst/multilayer_viz/` copy is just files) but requires a modern browser and an HTTP server (not `file://` due to CORS on module imports).

### 2. Custom 3D projection instead of a 3D library
Rather than using Three.js or WebGL, the renderer implements oblique isometric projection in Canvas 2D. This keeps the dependency footprint minimal (only Leaflet is external) and gives precise control over the visual style, but all depth-ordering and projection math is hand-rolled in `renderer.js`.

### 3. Global state in app.js
The model, renderer, layout, and colorMapper instances are module-level globals in `app.js`. There is no reactive state management framework (no Redux, no signals). UI updates are imperative: event handlers directly mutate renderer properties and call `renderer.render()`. This is pragmatic for a single-developer tool but means state synchronization is entirely manual.

### 4. Four independent visualization modes sharing one canvas
All four modes (network, map, layer, dashboard) share the same `#networkCanvas` element. Mode transitions are handled by `app.js` calling `activate()`/`deactivate()` on the relevant module, hiding/showing DOM panels, and swapping the canvas render function. The dashboard is the exception — it renders to a separate `<div>` as SVG, not to the canvas.

### 5. Color mapping as a first-class subsystem
`colorMapper.js` provides a unified abstraction for mapping any attribute (numeric or categorical) on nodes, links, or layers to colors. It auto-detects data type, supports toggling between continuous and categorical treatment of numeric attributes, and generates legend metadata. This decouples rendering from color logic across all four modes.

### 6. Bipartite network support integrated at the data layer
Bipartite detection happens in `dataParser.js` via two strategies (explicit declaration or BFS 2-coloring). The resulting `bipartiteInfo` is stored on the model and consulted by renderer, layout, colorMapper, layerView, and dashboard — each adapts its behavior (two-row layout, set-color coding, stacked bars, etc.) without duplicate detection logic.

### 7. R package as a thin wrapper
The `emln` R package does not reimplement any visualization logic. It provides R-native data structures, a JSON serializer (`multilayer_to_json.R`), and a launcher (`plot_multilayer.R`) that starts a local server and opens the browser. The web app is bundled verbatim in `inst/multilayer_viz/`. This clean separation means the web app can be developed and tested independently of R.

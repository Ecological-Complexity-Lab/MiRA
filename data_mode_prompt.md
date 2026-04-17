# Task: Implement Data Mode for MultilayerViz

## Context

MultilayerViz is a browser-based, dependency-free JavaScript application for
visualizing ecological multilayer networks. It has four existing visualization
modes (Network, Map, Layer View, Dashboard) that share a common mode-switching
pattern in `app.js`. The network model is stored in a global `model` object with:
- `model.nodes` — unique physical nodes
- `model.layers` — layer objects with attributes
- `model.intralayerLinks` and `model.interlayerLinks` — edge arrays
- `model.nodesPerLayer` — Map from layer_name → Set of node names
- Node and layer objects carry user-defined attributes from CSV/JSON import

The app uses a canvas-based renderer (`js/renderer.js`). Modes that don't use
the canvas (e.g. Dashboard) hide the canvas and show a `<div>` panel instead.
Follow this same pattern for Data Mode.

---

## Goal

Implement a new **Data Mode** — a tabular inspection and subsetting interface
inspired by Gephi's Data Laboratory. It is the fifth mode alongside the
existing four. Add it to the mode-switching toolbar with the label "Data".

---

## Four tables

Data Mode shows four tabs. Only one tab is visible at a time.

### 1. Nodes tab
One row per unique physical node. Columns (show only those present in the data):
- `node_id` (or `node_name`) — text, non-editable
- Any user-defined node attributes (e.g. `group`, centrality scores, module IDs)
- `layer_count` — computed: how many layers this node appears in (integer)

### 2. State Nodes tab
One row per (node × layer) combination — i.e. every occurrence of a node in a
specific layer. Columns:
- `node_name` — text
- `layer_name` — text
- Any state-node-level attributes if present in the model
- `degree` — computed: intralayer degree of this node in this layer

### 3. Links tab
One row per edge (both intralayer and interlayer). Columns:
- `layer_from`, `node_from`, `layer_to`, `node_to`
- `weight` (if present)
- `type` — computed: "intralayer" or "interlayer" — render as a colored badge
  (intralayer: blue pill, interlayer: orange pill)

### 4. Layers tab
One row per layer. Columns:
- `layer_id`, `layer_name`
- `color` — render as an inline color swatch (small colored square, not editable)
- `latitude`, `longitude` if present
- `node_count` — computed: number of nodes in this layer
- `link_count` — computed: number of intralayer links in this layer
- Any other user-defined layer attributes

---

## Table features

### Sorting
- Click any column header to sort ascending; click again for descending; third
  click resets to default order.
- Show a small ▲/▼ indicator in the active sort column header.

### Per-column filtering
- Each column has a small filter input that appears below the column header
  (always visible, not a dropdown).
- For numeric columns: a text input accepting expressions like `>5`, `<10`,
  `=3`, or a plain number (exact match).
- For text/categorical columns: case-insensitive substring match.
- For the `type` column in Links: a text filter matching "intralayer" or
  "interlayer".
- Filters across columns are combined with AND logic.
- Show a row count badge: "Showing X of Y rows" below the table.

### Cell rendering
- **Color columns** (layer color, node color if present): render a small
  colored square swatch using the RGB value. Non-editable.
- **Numeric columns**: right-align values.
- **Badge columns** (`type` in Links tab): colored pill as described above.
- **Long text**: truncate with ellipsis at ~200px, show full value on hover
  via `title` attribute.

### Row selection and cross-mode highlighting
- Clicking a row selects it (highlighted background).
- If the selected row is a node, set `state.searchedNodeName` (or equivalent
  global selection state) to that node name — this will highlight it in the
  other modes when the user switches back.
- If the selected row is a layer, set the active layer highlight state.
- Clicking the same row again deselects.

---

## Filter-to-visualization propagation (subsetting) — CORE FEATURE

This is the most important feature of Data Mode.

When the user applies filters in any table, those filters define an active
subset. When the user switches to any other visualization mode, only the
subsetted elements are rendered. This is the "effective EMLN subset".

Implementation:

1. Maintain a global `dataMode` state object:

```javascript
const dataMode = {
  active: false,
  filteredNodeNames: null,   // Set of node names, or null = show all
  filteredLayerNames: null,  // Set of layer names, or null = show all
  filteredLinkIndices: null, // Set of link indices, or null = show all
};
```

2. When any filter changes in Data Mode, recompute all three sets:
   - `filteredNodeNames`: node names passing the Nodes tab filters
   - `filteredLayerNames`: layer names passing the Layers tab filters
   - If the Nodes tab has active filters, also exclude from State Nodes and
     Links any entries whose node is not in `filteredNodeNames`
   - If the Layers tab has active filters, also exclude links whose
     `layer_from` or `layer_to` is not in `filteredLayerNames`

3. Expose a helper `dataMode.isSubsetActive()` → true if any filter is applied.

4. In the renderer and all other mode draw functions, check `dataMode` before
   rendering each node, layer, or link. If a subset is active, skip elements
   not in the filtered sets.

5. When any filter is active, show a persistent banner at the top of the screen
   (visible in ALL modes, not just Data Mode):
   ```
   ⚡ Data filter active — X nodes, Y layers, Z links visible   [Clear filters]
   ```
   This banner is hidden when no filters are applied. The "Clear filters" button
   resets all filters and removes the banner.

---

## UI layout

Data Mode replaces the canvas with a full-height `<div id="dataModePanel">`.
Structure:

```
┌─────────────────────────────────────────────────────────────┐
│  [Nodes] [State Nodes] [Links] [Layers]        [Export CSV] │  ← tab bar
├─────────────────────────────────────────────────────────────┤
│  Showing X of Y rows                                        │  ← row count
├──────────┬──────────┬──────────┬──────────────────────────  │
│  col1 ▲  │  col2    │  col3    │  ...                        │  ← headers
│ [filter] │ [filter] │ [filter] │  ...                        │  ← filter row
├──────────┼──────────┼──────────┼─────────────────────────── │
│  row data...                                                 │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

- The table takes full available height with `overflow-y: auto` (sticky header).
- Match the existing app's color scheme and font (Inter, system-ui).
- The left-side control panel is hidden in Data Mode (nothing to control).
- Debounce filter inputs by 200ms to avoid re-rendering on every keystroke.

---

## Export

An "Export CSV" button in the tab bar exports the currently visible (filtered)
rows of the active table as a `.csv` file. Use the tab name as the filename
(e.g. `nodes.csv`, `links.csv`).

---

## Files to create / modify

- **Create** `js/dataMode.js` — all Data Mode logic, table rendering, filter
  state, and subsetting. Export `initDataMode()`, `enterDataMode()`,
  `exitDataMode()`, and the `dataMode` state object.
- **Modify** `app.js` — add "Data" button to mode toolbar; wire
  `enterDataMode()` / `exitDataMode()` into the mode-switching logic; import
  and apply `dataMode` filters in the render loop and all mode renderers.
- **Modify** `js/renderer.js` (and `layerView.js`, `metaNetwork.js` if
  present) — wrap node/layer/link drawing with `dataMode` subset checks.
- **Modify** `index.html` — add `<div id="dataModePanel">` and the filter
  banner `<div id="dataFilterBanner">`.

---

## Constraints and style rules

- No external dependencies — pure vanilla JS and CSS, consistent with the
  existing codebase.
- Do not break any existing mode. Data Mode must enter and exit cleanly.
- Read the existing `app.js` mode-switching pattern carefully before writing
  any code — replicate it exactly for consistency.
- The subsetting banner must be visible in ALL modes when a filter is active,
  so the user always knows they are looking at a subset.
- Preserve the existing behavior of `state.searchedNodeName` and any selection
  state — Data Mode row clicks should set these, not replace them with a
  different system.
- For large networks (1000+ nodes), avoid re-rendering the entire table on
  every keystroke — debounce filter inputs by 200ms.

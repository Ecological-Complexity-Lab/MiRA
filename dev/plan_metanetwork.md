# Plan: Meta-Network Mode

## Context

A new visualization mode that aggregates all layers into a single 2D network — a "meta-network" of nodes and links. Complements Layer View (which shows layers as bubbles) by collapsing all layers into one flat network for cross-layer analysis.

---

## What the mode does

**Aggregation** — computes a single network from all intralayer links. Three modes:
- **Union** — a link exists if it appears in any layer; weight = 1
- **Sum weights** — weight = sum of `link.weight` across all layers it appears in
- **Sum occurrence** *(default)* — weight = number of layers the link appears in

**Nodes** — unique node names across all layers. Each node carries:
- `participation` — number of layers it appears in
- `metaDegree` — number of unique neighbours in the meta-network
- `metaStrength` — sum of meta-edge weights touching this node
- `layers` — Set of layer names it belongs to

**Meta-edges** — unique (nodeA, nodeB) pairs. For directed networks, A→B and B→A are separate edges. Each edge carries:
- `weight` — per aggregation mode above
- `perLayer` — Array of `{layerName, weight}` for the info panel bar chart

---

## Decisions

- **Bipartite**: two-row layout — Set A top, Set B bottom (like the existing bipartite force layout in `layout.js`)
- **Default aggregation**: Sum occurrence
- **Directed**: preserve direction — A→B and B→A are separate meta-edges; arrowheads rendered
- **Node dragging**: yes, individual nodes draggable (same pattern as LayerView)
- **Layer filter default**: no layers pre-selected → show all

---

## Architecture

### New file: `js/metaNetwork.js`

```javascript
export class MetaNetwork {
  constructor(model)

  // Internal
  _aggregate(mode)          // builds this._mnNodes[], this._mnEdges[]
  _initLayout()             // d3-force simulation
  _makeCollideForce()       // d3.forceCollide scaled by node radius
  _bipartiteY(nodeName)     // returns fixed Y for bipartite two-row layout

  // Public
  tick()                    // Boolean — true while simulation is hot
  render(ctx, w, h)         // canvas draw
  hitTestNode(mx, my, w, h) // → nodeName | null
  hitTestEdge(mx, my, w, h) // → edge object | null
  updateSetting(key, value) // re-aggregate if 'aggregation' changes, restart sim
  resetLayout()             // re-run layout from scratch
  startDragNode(mx, my, w, h)
  moveDragNode(mx, my, w, h)
  endDragNode()
}
```

**Settings object:**
```javascript
settings = {
  aggregation:   'sumOccurrence', // 'union' | 'sumWeights' | 'sumOccurrence'
  colorBy:       'participation', // 'participation' | 'metaDegree' | 'uniform'
  sizeBy:        'participation', // 'participation' | 'metaDegree' | 'uniform'
  minWeight:     0,
  showLabels:    true,
  labelFontSize: 12,
}
```

**State object:**
```javascript
state = {
  selectedNode:   null,        // nodeName | null
  selectedEdge:   null,        // edge object | null
  selectedLayers: new Set(),   // empty = show all
}
```

**_mnNode object:**
```javascript
{
  name, participation, metaDegree, metaStrength, layers,
  nodeType,           // for bipartite: 'A' | 'B' | null
  color,              // from colorBy + buildColorScale
  r,                  // radius from sizeBy
  x, y, fx, fy, vx, vy  // d3-force fields
}
```

**_mnEdge object:**
```javascript
{
  source, target,   // node name strings (d3-force resolves to objects)
  weight,           // aggregated weight
  perLayer,         // [{layerName, weight}, ...]
  directed,         // Boolean
}
```

**Canvas rendering:**
- Background: `#f8f8fc`
- View transform: `translate(w/2 + viewOffsetX, h/2 + viewOffsetY); scale(viewScale)`
- Pan/zoom state: `viewOffsetX/Y`, `viewScale`
- Node radius: `8 + 20 * normalisedScore` (participation or metaDegree)
- Edge width: `0.5 + 3.5 * (weight / maxWeight)`
- Arrowheads for directed edges (small triangle at target end)
- Faded alpha: nodes `0.08`, edges `0.06`
- Colors via `buildColorScale()` from `colorMapper.js`

**Bipartite two-row layout:**
- Detect via `model.bipartiteInfo` — if any layer is bipartite, identify Set A / Set B globally
- Set A nodes: `fy = -targetRowSpacing` (pinned Y, free X)
- Set B nodes: `fy = +targetRowSpacing`
- `targetRowSpacing = h * 0.28` (re-computed on window resize)
- Row label drawn at left edge: "Set A" / "Set B"

**Fading — two independent triggers:**
1. `state.selectedNode` set → fade all nodes/edges not in 1-hop ego network of that node
2. `state.selectedLayers` non-empty → fade nodes/edges with no links in any selected layer
- Both can apply simultaneously (intersection)

**Force layout (d3-force, same as LayerView):**
```javascript
d3.forceSimulation(nodes)
  .force('charge', d3.forceManyBody().strength(-300))
  .force('link',   d3.forceLink(edges).id(n => n.name).distance(60).strength(0.4))
  .force('x',      d3.forceX(0).strength(bipartite ? 0.02 : 0.05))
  .force('y',      d3.forceY(0).strength(bipartite ? 0    : 0.05))
  // For bipartite: Y is pinned via fy, so forceY strength = 0
  .force('collide', d3.forceCollide(n => n.r + 4).iterations(3))
  .alphaDecay(0.003)
```
Pre-settle 200 ticks before first render.

---

### `app.js` changes

**New constants (alongside NETWORK_SECTIONS etc.):**
```javascript
const META_SECTIONS = ['sectionMetaNetwork'];
let metaNetwork = null;
let mnRAF = null;
let _mnMouseHandlers = null;
```

**`toggleMetaNetwork()`** — exit competing modes, set `appMode = 'metanetwork'`, instantiate MetaNetwork, start RAF loop, show sidebar + panel.

**`_exitMetaNetwork()`** — cancel RAF, null instance, hide sidebar + panel, restore canvas.

**Animation loop** (same as `_startLayerViewLoop()`):
```javascript
function _startMetaNetworkLoop() {
  function loop() {
    const stillHot = metaNetwork.tick();
    metaNetwork.render(ctx, canvas.width, canvas.height);
    if (stillHot) mnRAF = requestAnimationFrame(loop);
    else mnRAF = null;
  }
  mnRAF = requestAnimationFrame(loop);
}
```

**Mouse handlers** — wired to canvas while in metanetwork mode:
- `mousedown`: `startDragNode` or start pan
- `mousemove`: `moveDragNode` or pan
- `mouseup`: `endDragNode` or end pan; if no drag → hit-test → populate infoPanel
- `wheel`: zoom (same pattern as layer view)

**Info panel — node selected:**
```html
<h3>Node: {name}</h3>
<p>Layers ({n}): {layer1}, {layer2}, ...</p>
<p>Meta-degree: {N} &nbsp; Meta-strength: {X.X}</p>
```

**Info panel — edge selected:**
```html
<h3>Link: {nodeA} → {nodeB}</h3>
<p>Appears in {n} layers:</p>
{svgBar(perLayer.map(({layerName, weight}) => ({label: layerName, value: weight})))}
```
`svgBar` is already exported from `dashboard.js` — import it in `app.js`.

**Layer filter panel** — new `mnLayerPanel` / `mnLayerList` (same HTML structure as `mapLayerPanel`). Multi-select: click toggles layer in `metaNetwork.state.selectedLayers`. "Select all" / "Clear all" buttons at bottom. Renders colored dot per layer (use `PALETTE` from `layerView.js` or layer color map).

**Sidebar show/hide:**
```javascript
function _showMetaNetworkSidebar() {
  NETWORK_SECTIONS.forEach(id => document.getElementById(id).style.display = 'none');
  LV_SECTIONS.forEach(id => document.getElementById(id).style.display = 'none');
  DB_SECTIONS.forEach(id => document.getElementById(id).style.display = 'none');
  META_SECTIONS.forEach(id => document.getElementById(id).style.display = '');
  mnLayerPanel.style.display = '';
}
function _hideMetaNetworkSidebar() {
  META_SECTIONS.forEach(id => document.getElementById(id).style.display = 'none');
  mnLayerPanel.style.display = 'none';
}
```

**Weight slider setup** (same pattern as interlayer weight slider):
- On mode enter: compute `maxWeight` from meta-edges, set slider max/step
- `input` event: `metaNetwork.updateSetting('minWeight', val)` → re-render

**Also wire:** aggregation dropdown, colorBy/sizeBy dropdowns, showLabels checkbox.

---

### `index.html` changes

1. **Toolbar button** — after the Layer View button:
```html
<button id="metaNetworkBtn" class="btn zoom-btn" title="Meta-network View" style="display:none;">
  <!-- icon: nodes-connected SVG -->
</button>
```
Hidden by default; shown in `loadData()` when model has ≥2 layers (same condition as Layer View button).

2. **Sidebar section** (after `sectionSearch`, hidden by default):
```html
<details class="control-section" id="sectionMetaNetwork" style="display:none;" open>
  <summary>Meta-network</summary>
  <div class="section-body">
    <!-- Aggregation -->
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:#666;">Aggregation</label>
      <select id="mnAggregationSelect" class="styled-select">
        <option value="sumOccurrence">Sum occurrence</option>
        <option value="sumWeights">Sum weights</option>
        <option value="union">Union</option>
      </select>
    </div>
    <!-- Color By -->
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:#666;">Color By</label>
      <select id="mnColorBySelect" class="styled-select">
        <option value="participation">Participation</option>
        <option value="metaDegree">Meta-degree</option>
        <option value="uniform">Uniform</option>
      </select>
    </div>
    <!-- Size By -->
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:#666;">Size By</label>
      <select id="mnSizeBySelect" class="styled-select">
        <option value="participation">Participation</option>
        <option value="metaDegree">Meta-degree</option>
        <option value="uniform">Uniform</option>
      </select>
    </div>
    <!-- Min Weight -->
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:#666;">Min Link Weight <span id="mnMinWeightLabel">0</span></label>
      <input type="range" id="mnMinWeightSlider" min="0" max="1" step="0.01" value="0" class="slider">
    </div>
    <!-- Labels -->
    <div class="checkbox-row">
      <label class="checkbox-label">
        <input type="checkbox" id="mnShowLabelsCheckbox" checked>
        <span>Show labels</span>
      </label>
    </div>
  </div>
</details>
```

3. **Floating layer panel** (alongside `mapLayerPanel`):
```html
<div id="mnLayerPanel" style="display:none; position:absolute; top:16px; right:16px; z-index:20;
     background:rgba(255,255,255,0.95); border:1px solid rgba(0,0,0,0.1); border-radius:8px;
     box-shadow:0 4px 6px rgba(0,0,0,0.08); min-width:160px; max-width:220px;
     pointer-events:auto; cursor:grab; user-select:none; backdrop-filter:blur(8px);">
  <div id="mnLayerPanelHeader" style="display:flex; align-items:center; justify-content:space-between;
       padding:8px 12px; border-bottom:1px solid rgba(0,0,0,0.07);">
    <span style="font-size:11px; font-weight:700; color:#1a1a2e; text-transform:uppercase; letter-spacing:0.5px;">Filter Layers</span>
    <button id="mnLayerPanelToggle" class="legend-no-drag"
            style="background:none; border:none; cursor:pointer; color:#6b7280; font-size:13px; padding:0 2px;">−</button>
  </div>
  <div id="mnLayerPanelBody" style="padding:6px 8px; max-height:55vh; overflow-y:auto;">
    <ul id="mnLayerList" style="list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px;"></ul>
    <div style="display:flex; gap:4px; margin-top:6px; padding-top:6px; border-top:1px solid rgba(0,0,0,0.07);">
      <button id="mnSelectAllLayers" class="btn" style="flex:1; font-size:11px; padding:4px 0;">All</button>
      <button id="mnClearLayers"     class="btn" style="flex:1; font-size:11px; padding:4px 0;">Clear</button>
    </div>
  </div>
</div>
```

4. **Reuse `infoPanel`** — no HTML changes needed.

### `css/style.css` changes

Reuse `.map-layer-item`, `.map-layer-dot`, `.map-layer-close` for `mnLayerList` items — no new CSS classes needed.

---

## Critical Files

| File | Change |
|------|--------|
| **`js/metaNetwork.js`** | New — core class |
| **`js/app.js`** | Mode toggle, RAF loop, mouse handlers, info panel, layer panel, slider/dropdown wiring |
| **`index.html`** | Toolbar button, sidebar section, floating layer panel |
| **`css/style.css`** | None (reuse existing classes) |
| **`js/dashboard.js`** | Import `svgBar` (already used internally — verify it is exported) |
| **`js/colorMapper.js`** | Import `buildColorScale` (already exported) |

---

## Verification

1. Load **vitali2024** (5 bipartite layers) → 235 nodes appear in two rows (pollinators / plants); edges shown
2. Switch aggregation modes → weights update, layout re-runs from scratch
3. Click a node → info panel shows layer list and meta-degree
4. Click a link → info panel shows per-layer bar chart (svgBar)
5. Min weight slider → edges below threshold disappear
6. Layer filter: select 2 layers → only nodes/edges from those layers at full opacity; others faded
7. "Select all" / "Clear" buttons work correctly
8. Load **kefi2016** (directed, unipartite) → arrowheads rendered on meta-edges
9. Load **pilosof2017** (6 temporal layers, 78 nodes) → renders performantly
10. Switch to another mode and back → state resets cleanly, no RAF leak

# ggmira view spec — contract (version 1)

The view spec is the JSON that the R side (emln `mira()` + pieces) sends to
MiRA to describe how a network should look. Both sides are built against
this file. Change it here first.

Status: **draft for v1**, network mode only.

Milestones: milestone 1 = layout, node, links, layers. Stage 1 of the
development plan (2026-11-01) added labels, layer display, layer pairs,
per-layer colors and the `scales` section. New optional fields keep
`version: 1`. In R, scales are set per piece (`color_values`,
`color_scale`), not with a separate `mira_scale_color()` (decision
2026-11-01).

---

## 1. Ground rule: no refactoring of existing MiRA code

Applying a view spec reuses MiRA's **existing session restore unchanged**:

```
rBridge.js
  1. fetch /api/view.json            (404 → no spec, behave exactly as today)
  2. loadData(network)               (existing; computes default layout)
  3. state = getSessionState()       (existing; a complete default session)
  4. viewSpec.js: patch state with the spec → { state, warnings }
  5. restoreSessionState(state)      (existing; applies everything)
  6. show warnings (if any)
```

A view spec is therefore "a partial session, written by a person". Every
spec field maps to a field that a saved session already has (section 4).
Features that would need new session fields (continuous palettes, size
range, legend titles) are out of v1 — see `backlog.md`.

### Changes to existing files (complete list)

| File | Change |
|---|---|
| `js/app.js` | 1 import line; in `autoloadFromR`, hand the fetched network to `rBridge` instead of calling `loadData` directly (≈5 lines). Nothing else. |
| `js/layout.js` | Optional `seed`. Replace the `Math.random()` calls (Fruchterman-Reingold, Kamada-Kawai, random; 6 calls on 5 lines) with `this.random()`; without a seed `this.random` *is* `Math.random`, so unseeded behavior is identical. |
| `js/random.js` | New: seeded generator (mulberry32). |
| `js/rBridge.js` | New: fetch, orchestration (steps 1–6), warning notice. After restore: recenters the view when stacking or spacing changed (the restored scale/offset were centered for the defaults), and syncs the interlayer arrowhead slider. |
| `js/viewSpec.js` | New, pure (no DOM, no fetch): validate + translate. |

The `IS_EMLN` UI block and `autoloadFromR` stay where they are in `app.js`.

### Known wrinkle

`restoreSessionState` calls `loadData` again, so a network with data
warnings shows the "Data warnings" alert twice. Same as loading a saved
session today. Not fixed in v1 (it would mean touching `loadData`).

---

## 2. Transport

- R serves `GET /api/view.json` next to `/api/network.json`.
- `plot_multilayer()` serves no view spec → 404 → MiRA behaves as today.
- Older MiRA builds never request `/api/view.json` → spec is ignored.

---

## 3. Schema

All top-level sections and all fields are optional. Missing = MiRA default.

```json
{
  "version": 1,
  "layout": {
    "type": "kamada_kawai",
    "seed": 42,
    "nested": false
  },
  "node": {
    "color_by": "module",
    "color": "#a78bfa",
    "size_by": { "pollinator": "abundance", "plant": null },
    "size": 10,
    "shape": { "pollinator": "circle", "plant": "square" },
    "labels": true, "label_size": 12, "perspective": true
  },
  "intralayer": { "color_by": "type", "color": "#94a3b8", "min_weight": 0.1, "arrow_size": 1 },
  "interlayer": { "show": true, "color_by": null, "color": "#999999", "min_weight": 0,
                  "curvature": 0.35, "pairs": [["L1", "L2"]] },
  "layer": { "color_by": ".individual", "color": "#8b5cf6", "colors": { "L1": "#ff0000" },
             "labels": true, "label_size": 14, "set_labels": false,
             "stack": "horizontal", "spacing": 300 },
  "scales": {
    "module": { "type": "categorical", "values": { "1": "#1b9e77", "2": "#d95f02" } }
  }
}
```

### Field rules

| Field | Type | Allowed |
|---|---|---|
| `version` | integer | `1`. Other values → whole spec ignored, one warning. |
| `layout.type` | string | `fruchterman`, `kamada_kawai`, `bipartite`, `circle`, `grid`, `random`. `bipartite` needs a bipartite layer. |
| `layout.seed` | integer | Any. Same seed + same data = same positions. |
| `layout.nested` | boolean | Bipartite layout only (nested sorting by degree). |
| `node.color_by`, `node.size_by` | string, null, or per-set object | See "Mappings" below. |
| `node.color`, `*.color` | string | `#rrggbb` (R converts color names). Used when the matching `color_by` is Default. |
| `node.size` | number | Base node radius, 3–25 (the size slider; R sends whole numbers, the slider steps by 1). |
| `node.shape` | string or per-set object | `circle`, `square`. |
| `*.min_weight` | number | 0 or more, in the units of the data's `weight` (MiRA's sliders run to the largest weight; weights are often above 1). |
| `interlayer.show` | boolean | |
| `layer.color_by` | string or null | Layer attribute, or `.individual` for per-layer colors. |
| `node.labels`, `layer.labels` | boolean | Node names / layer names. |
| `node.label_size` | number | 8–24 (label size slider; whole numbers from R). |
| `layer.label_size` | number | 8–32 (layer name size slider; whole numbers from R). |
| `node.perspective` | boolean | "Transform nodes": nodes follow the layers' 3D perspective (default true). |
| `layer.set_labels` | boolean | Node set names; needs a bipartite layer (drawn in the bipartite layout only). |
| `layer.stack` | string | `horizontal`, `vertical`. |
| `layer.spacing` | number | 100–600 (layer spacing slider; whole numbers from R). |
| `layer.colors` | object | `layer_name` → `#rrggbb`. Used with `color_by: ".individual"`; layers not listed keep MiRA's per-layer palette. |
| `intralayer.arrow_size` | number | 0–3. One size for intralayer and interlayer arrowheads (MiRA has one). |
| `interlayer.curvature` | number | 0–1. |
| `interlayer.pairs` | array | `[[layer_name, layer_name], ...]`; only interlayer links between these pairs are shown; order within a pair does not matter. |
| `scales.<attr>.type` | string | `categorical` or `continuous` (continuous needs numeric data: MiRA warns and ignores it otherwise; R does not send it for a non-numeric column). |
| `scales.<attr>.values` | object | Category value → `#rrggbb`. Keys are strings; MiRA matches them to the data values (`"1"` matches number `1`). An attribute is any node, state-node, link or layer attribute, data or computed. |
| `scales[".set"].values` | object | Node set label → `#rrggbb`: the colors of the two node sets (with `node.color_by: ".set"`). Stored under MiRA's set-color key in the category overrides, where the legend edits them. No `type`. R: `mira_node(color_by = ".set", color_values = c(bird = "red"))`. |
| `filter.nodes` | array or null | Node names: only these nodes are drawn (MiRA's Data mode filter, network and map modes; the "Data filter active" banner clears it). Matched to the data as stored (`"7"` matches `7`). Unknown names skipped with a warning; a list with no valid name is ignored; `[]` hides every node; `null` = no node filter. |
| `filter.links` | array or null | Links as `[layer_from, node_from, layer_to, node_to]` (intra- or interlayer): only these are drawn. Same rules as `filter.nodes`. A link is drawn only if both its nodes pass `filter.nodes`. Keys are checked against the raw link table, in the direction given; on an undirected network whose table lists both directions, the reverse row passes but is not drawn (backlog item 37). R writes numeric names out (`100000`, never `1e+05`). |
| `node.highlight` | string | A node name → `state.selectedNode` (as Search Node: the node and its neighbors stand out, the rest dimmed; the "Selected node" banner clears it). Matched to the data as stored. R warns when the node is hidden by `filter.nodes` (MiRA then dims everything and highlights nothing). |
| `camera.rotate` / `camera.tilt` | number | Degrees → `renderer.skewX` / `renderer.skewY` (radians). Tilt within ±45 (mouse tilting stops at ±0.8 rad). |
| `camera.zoom` | number | 0.2–5, relative to MiRA's fitted view. Not a session field: rBridge applies it after restore (fit, then zoom about the canvas center, as the zoom buttons). |
| `camera.pan` | [x, y] | Fractions of the window, each −1 to 1 (positive y = up). Applied by rBridge after the zoom. |
| `legend.show` | `"all"`, array, or `false` | Legends opened (`state.legend.expandedLegends`): names `node_color` (nodeColor, A, B), `node_size` (nodeSize, A, B), `node_shape`, `intralayer_color`, `interlayer_color`, `layer_color`. `false` hides the panel (rBridge clicks MiRA's legend toggle). Plots from R start with every legend minimized. R sends `show` only when given (`mira_legends()` alone sends `"all"`), so a later `mira_legends(position = )` keeps an earlier `show`. |
| `legend.position` | string | `bottom-right` (default), `top-right`, `bottom-left`: rBridge moves the legend panel after restore (it stays draggable). |
| `mode.view` | string | The view MiRA opens in (`state.appMode`): `network`, `grid`, `map`, `layer`, `meta` (→ `metanetwork`), `dashboard`, `data`. One view per spec. Restore enters it; rBridge enters `data` (restore does not) and warns when MiRA could not open the view (the map needs layer coordinates). |
| `mode.columns` | integer | `grid` only: columns, 1–8 → `renderer.gridColumns`; not given → MiRA's own (ceil(sqrt(layers))). |
| `mode.aggregation` / `layout` / `color_by` / `size_by` | string | `meta` only. aggregation `occurrence` / `weights` / `union` (→ sumOccurrence / sumWeights / union); layout `circular` / `force` / `bipartite` (bipartite needs a bipartite layer); color_by, size_by `participation` / `degree` / `uniform` (degree → metaDegree). |
| `mode.size` / `min_weight` / `nested` / `labels` / `label_size` / `color` | | `meta` only: base size 0.2–3; min weight ≥ 0; nested sort (bool); labels (bool); label size 8–24; color `#rrggbb` (every node and both sets) or `{set label: #rrggbb}`. The meta-network starts from MiRA's entry settings (`META_NETWORK_DEFAULTS`, two-row on bipartite data, fitted), then takes these. Fields of another view are skipped with a warning. |

### Mappings (`color_by`, `size_by`)

- **Shared:** a string — an attribute name, or `null` for Default.
  Special value `.set` (node color only) = color by set membership.
- **Per set:** an object whose keys are exactly the two `node_type` values,
  each an attribute name or `null` (= Default for that set). Turns that
  channel's Per set toggle on.
- Attribute names are bare (`"module"`). MiRA resolves them:
  node attribute first (`node:module`), then state-node attribute
  (`state:module`). Size accepts numeric attributes only.

### Shape and the automatic split

- `node.shape` given → shape follows it exactly (shared or per set).
- `node.shape` absent and color or size is per set → MiRA's automatic
  shape split applies (circle / square), as in the UI.

---

## 4. Translation to session fields

| Spec | Session field(s) |
|---|---|
| `layout.type` | `ui.layoutSelect` |
| `layout.seed` | `positions` (computed by `rBridge` with a seeded `ForceLayout`) |
| `layout.nested` | `ui.bipartiteNestedCheckbox` |
| `node.color_by` shared | `ui.nodeColorSelect`, `ui.nodeColorSplit = false` |
| `node.color_by` per set | `ui.nodeColorSelectSetA/B`, `ui.nodeColorSplit = true` |
| `node.color` | `ui.nodeColorPicker`; also sets `ui.nodeColorSelect = ''` (Default) and `ui.nodeColorSplit = false`, so the constant shows on bipartite data. An explicit `color_by` in the same section wins. |
| `node.size_by` | `ui.nodeSizeSelect` / `ui.nodeSizeSelectSetA/B`, `ui.nodeSizeSplit` |
| `node.size` | `renderer.nodeRadius` |
| `node.shape` shared | `ui.nodeShapeSelect`, `ui.nodeShapeSplit = false`, `ui.nodeShapeAuto = false` |
| `node.shape` per set | `ui.nodeShapeSelectSetA/B`, `ui.nodeShapeSplit = true`, `ui.nodeShapeAuto = false` |
| (auto shape split) | `ui.nodeShapeSplit = true`, `ui.nodeShapeAuto = true`, A = circle, B = square |
| `intralayer.color_by` / `.color` / `.min_weight` | `ui.intraLinkColorSelect` / `ui.intraLinkColorPicker` + `renderer.defaultIntraColor` / `renderer.intraMinWeight` |
| `interlayer.show` / `.color_by` / `.color` / `.min_weight` | `renderer.showInterlayerLinks` / `ui.interLinkColorSelect` / `ui.interLinkColorPicker` + `renderer.defaultInterColor` / `renderer.interlayerMinWeight` |
| `layer.color_by` / `.color` | `ui.layerColorSelect` (`.individual` → `__individual__`) / `ui.layerColorPicker` |
| `node.labels` / `.label_size` / `.perspective` | `renderer.showLabels` / `renderer.labelSizePx` / `renderer.transformNodes` |
| `layer.labels` / `.label_size` / `.set_labels` | `renderer.showLayerNames` / `renderer.layerNameFontSize` / `renderer.showSetNames` |
| `layer.stack` / `.spacing` | `renderer.stackMode` / `renderer.layerSpacing` |
| `layer.colors` | `ui.layerColors` (merged: listed layers replaced) |
| `intralayer.arrow_size` | `renderer.arrowheadSize` |
| `interlayer.curvature` | `renderer.interlayerCurvature` |
| `interlayer.pairs` | `filter.interPairFilter` (`"from::to"`) |
| `scales.<attr>.type` | `ui.colorScaleOverrides` |
| `scales.<attr>.values` | `ui.categoryColorOverrides` (keys converted to the data's values) |

The translation context from `rBridge` also carries the layer names and the
distinct values of every attribute (`ctx.layerNames`, `ctx.values`).

Set names → A/B come from `buildNodeSetResolver` (`labelA`, `labelB`).

After `restoreSessionState`, `rBridge` also sets `renderer.layoutType` to the
chosen layout (restore does not set it; see backlog).

---

## 5. Invalid fields: warn and fall back

- Each invalid field is skipped; that setting keeps its default.
- One notice lists every skipped field and why, e.g.
  `node.color_by: "modul" is not a node attribute`. Also logged to console.
- The plot always opens.

---

## 6. R side (emln) — mapping from functions to spec

| R | Spec section |
|---|---|
| `mira(net, bipartite, setA_type, directed, directed_interlayer)` | (network JSON, not the spec) |

These functions live in the separate R package **ggmira** (not emln).
| `mira_layout(type, seed, nested)` | `layout` |
| `mira_node(color_by, color, size_by, size, shape, labels, label_size, perspective, color_values, color_scale)` | `node` (+ `scales`) |
| `mira_intralayer(color_by, color, min_weight, arrow_size, color_values, color_scale)` | `intralayer` (+ `scales`) |
| `mira_interlayer(show, color_by, color, min_weight, curvature, pairs, color_values, color_scale)` | `interlayer` (+ `scales`) |
| `mira_layer(color_by, color, color_values, color_scale, labels, label_size, set_labels, stack, spacing)` | `layer` (+ `scales`, or `layer.colors`) |
| `mira_filter(nodes, links)` | `filter` (conditions evaluated in R, sent as names / links) |
| `mira_camera(rotate, tilt, zoom, pan)` | `camera` |
| `mira_legends(show = "all", position)` | `legend` |
| `mira_mode_*()`; `plot_mira(mode = )` | `mode` |
| `mira_node(highlight)` | `node.highlight` |

**Color scales in R.** `color_values` (colors named by value) and
`color_scale` (`"categorical"` / `"continuous"`) sit in the piece whose
`color_by` they belong to. R sends them as `scales.<attr>` for that
attribute (`color_values` imply `categorical`; with `"continuous"` → R
error). `mira_layer(color_by = "layer_name")` = `.individual`; its
`color_values` (named by layer) go to `layer.colors`. Settings for the same
attribute from different pieces are merged; a value given two colors, or
two scale types → R warning, the later piece wins. A new `color_by` /
`color` drops that section's earlier `color_values` / `color_scale`.
On nodes, both may be per set (`list(<set> = c(...))`), following each
set's `color_by`.

- `pairs` turns interlayer links on unless the same piece gives `show`.

- Per set in R = a vector named by `node_type`:
  `color_by = c(pollinator = "module", plant = NA)` (`NA` → `null`).
- `color_by` and `color` together in one piece → R error.
- Later pieces override earlier ones field by field. `color` and
  `color_by` are one channel: a later `color` removes an earlier
  `color_by` in the same section, and the other way round.
- Per-set names may cover one set only; the other set keeps its default.
- **Palettes: item 17** (decision 2026-11-01: wait, so categorical and
  continuous palettes arrive together): `color_palette` and
  `color_limits` in the same pieces. Categorical palettes on data columns
  could be expanded in R into `values`; continuous palettes, limits and
  palettes on computed attributes need MiRA work.
- R validates types, names and set names; an unknown attribute name only
  warns in R, MiRA has the final say.

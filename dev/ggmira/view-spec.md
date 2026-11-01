# ggmira view spec — contract (version 1)

The view spec is the JSON that the R side (emln `mira()` + pieces) sends to
MiRA to describe how a network should look. Both sides are built against
this file. Change it here first.

Status: **draft for v1**, network mode only.

Milestones: the `scales` section and `mira_scale_color()` are
**milestone 2**. Milestone 1 implements everything else; until milestone 2,
MiRA reports a `scales` section as an ignored field (warn and fall back).

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
| `js/rBridge.js` | New: fetch, orchestration (steps 1–6), warning notice. |
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
    "shape": { "pollinator": "circle", "plant": "square" }
  },
  "intralayer": { "color_by": "type", "color": "#94a3b8", "min_weight": 0.1 },
  "interlayer": { "show": true, "color_by": null, "color": "#999999", "min_weight": 0 },
  "layer": { "color_by": "habitat", "color": "#8b5cf6" },
  "scales": {
    "module": { "type": "discrete", "values": { "1": "#1b9e77", "2": "#d95f02" } }
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
| `node.size` | number | Base node radius, 3–25 (the size slider). |
| `node.shape` | string or per-set object | `circle`, `square`. |
| `*.min_weight` | number | 0 or more, in the units of the data's `weight` (MiRA's sliders run to the largest weight; weights are often above 1). |
| `interlayer.show` | boolean | |
| `layer.color_by` | string or null | Layer attribute, or `.individual` for per-layer colors. |
| `scales.<attr>.type` | string | `discrete` or `continuous` (continuous needs numeric data). |
| `scales.<attr>.values` | object | Category value → `#rrggbb`. Keys are strings; MiRA matches them to the data values (`"1"` matches number `1`). |

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
| `scales.<attr>.type` | `ui.colorScaleOverrides` (`discrete` → `categorical`) |
| `scales.<attr>.values` | `ui.categoryColorOverrides` |

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
| `mira_node(color_by, color, size_by, size, shape)` | `node` |
| `mira_intralayer(color_by, color, min_weight)` | `intralayer` |
| `mira_interlayer(show, color_by, color, min_weight)` | `interlayer` |
| `mira_layer(color_by, color)` | `layer` |
| `mira_scale_color(attr, type, palette, values)` (milestone 2) | `scales.<attr>` |

- Per set in R = a vector named by `node_type`:
  `color_by = c(pollinator = "module", plant = NA)` (`NA` → `null`).
- `color_by` and `color` together in one piece → R error.
- Later pieces override earlier ones field by field. `color` and
  `color_by` are one channel: a later `color` removes an earlier
  `color_by` in the same section, and the other way round.
- Per-set names may cover one set only; the other set keeps its default.
- **Palettes in milestone 2 (R-only, no MiRA change):** for a discrete scale on a
  data attribute, R expands `palette` (base R `palette.colors()` /
  `hcl.colors()` names, or a color vector) into explicit `values` using the
  category values in the data. `values` given by the user override single
  categories. A palette on a MiRA-computed attribute or a continuous scale
  → R warning, ignored (needs MiRA work; backlog).
- R validates types, names and set names; an unknown attribute name only
  warns in R, MiRA has the final say.

# ggmira — decisions, ideas and todos

Running tracker for ggmira: a gg-like R API (in emln) that builds a MiRA
view spec, so network-mode plots can be written as code. Not everything
ships in v1; park ideas here instead of growing the current scope.

Status: **Phase 0 done** (contract: [view-spec.md](view-spec.md)).
Phases 1–2 done; now on branch `feat/ggmira` (from `main`, pushed 2026-11-01).
Phase 3 done: ggmira package at `~/GitHub/ecomplab/ggmira`
(private repo: https://github.com/Ecological-Complexity-Lab/ggmira):
3a (74a3938) converter, server, `plot_multilayer()`; 3b (63b6c2c) the
`mira()` grammar. Phase 4 done (2026-11-01): end-to-end on emln 13, 14,
17, 23, 63; manual paragraph in the ggmira README (5dc0894).
**QA of stage 1 done 2026-11-02** (see Decided: QA 2026-11-02). **Milestone 1 is complete.** **Stage 1 of the development plan is done
(2026-11-01):** MiRA feat/ggmira ed29cbc, ggmira 21316e6 + bundled MiRA
322b587. Next: stage 2 (`mira_filter`), design first.
**2026-11-02:** stages 2–3 merged to ggmira main; stage 4 (views) built
and tested by Shai, not merged (see Stage 4 and the handoff of
2026-11-02 afternoon).
**2026-11-12: working toward the first release (v1).** Beta fixes and
item 35 merged (MiRA #100, ggmira #19). **Start at "Handoff: 2026-11-12
— toward the first release"** below.

## Milestones

1. **Basics** (Phases 1–4): `mira()`, `mira_layout()`, `mira_node()`,
   `mira_intralayer()`, `mira_interlayer()`, `mira_layer()`. Colors use
   MiRA's defaults (Dark2 / Viridis, auto type). Test with users first.
2. **Easy scales** (new code only): scale type and manual colors per
   value — done in stage 1 as `color_scale` / `color_values` in each piece;
   palettes moved to item 17.
3. **MiRA-side features**, one feature branch each: continuous palettes and
   palettes on computed attributes, size range, legend titles,
   `mira_save()`.

Rule: a milestone starts only after the previous one is tested.
**Changed 2026-11-01:** for now only Shai (with Claude) tests; development
continues into the next milestones, and students test later, once there is
more to try. A ready-to-paste test script for milestone 1 is in the
conversation of 2026-11-01 (emln 14, 17, 63; mistakes on purpose).

**Ground rule (2026-10-31): do not break anything.** No refactoring of
existing code that spans multiple blocks. New behavior goes in new modules;
existing files get only small additive changes (listed in view-spec.md §1).

---

## Decided

- **Names:** everything is `mira_*`: `mira()`, `mira_layout()`,
  `mira_node()`, `mira_intralayer()`, `mira_interlayer()`, `mira_layer()`.
  Avoids clashes with ggplot2 / ggraph.
- **Layout is plot-level:** `mira_layout(type, seed, nested)`.
- **Mappings are strings, not `aes()`.** `color_by = "module"` maps an
  attribute; `color = "#333"` sets a constant. Both in one piece → error.
- **Color scales live in each piece (2026-11-01),** not in a separate
  `mira_scale_color()`: `color_by` chooses what is colored,
  `color_values` (colors named by value, e.g. `c("1" = "red")`) and
  `color_scale` (`"categorical"` / `"continuous"`) choose the colors, in
  `mira_node()`, `mira_intralayer()`, `mira_interlayer()`,
  `mira_layer()`. Like ggraph's per-element scales, without a second
  piece per color. `color_values` imply categorical; with
  `"continuous"` → error. R sends them as MiRA's per-attribute scales
  (`scales.<attr>`). The same attribute in two pieces shares one scale:
  settings merge; only disagreements warn (later piece wins). On nodes
  they may be per set.
- **One color per layer = `mira_layer(color_by = "layer_name")`**
  (`".individual"` still works), with `color_values` named by layer.
- **Stage 1 names (2026-11-01):** `labels` / `label_size` in both
  `mira_node()` and `mira_layer()`, plus `set_labels`. `pairs` turns
  interlayer links on unless `show` is given. `arrow_size` is in
  `mira_intralayer()` and also sizes interlayer arrowheads (MiRA has one
  size).
- **Manual = pkgdown site (2026-11-01),** like tidyverse packages (not
  bookdown). Skeleton done in ggmira 2c09aaa: grouped reference, "Getting
  started" article with screenshots (code from
  `inst/examples/mira_examples.R`). Built locally (`docs/` not committed;
  GitHub Pages for a private repo needs a paid plan). Full articles after
  stage 4 (views change the package's shape); site ready before students
  test. Shai tested stage 1 on 2026-11-01.
- **Terminology (2026-11-02), ggplot2's:** what `+` adds is a *component*;
  `mira_node()`, `mira_intralayer()`, `mira_interlayer()`, `mira_layer()` are
  the *element* components (MiRA always draws nodes, links and layers; they
  set the elements' aesthetics: `color_by`/`size_by` map, `color`/`size`/
  `shape` set constants); `color_values`/`color_scale` are the *scale*
  (`?mira_scales`, color and size); `mira_layout()` is the layout
  (ggplot2's coordinate system); `mira_filter()` (stage 2) is data. "Layer"
  is never used the ggplot2 way. Reference index groups (pkgdown, with an
  icon per function like ggplot2): Plot basics; Elements: nodes, links,
  layers; Scales; Layout; Opening a network with MiRA's defaults. Class
  `mira_piece` stays internal.
- **QA 2026-11-02 (stage 1, both sides):** fixed in ggmira — scale merging
  (continuous + color_values across components is an error; per-set
  conflicts warn; warnings run only for the settings a component gives and
  the order is tracked per section/attribute/part so a later unrelated
  component neither re-warns nor flips the winner; a repeated identical
  `color_by` keeps `color_values`; `node_type` values checked under the
  data's column name; `weight` link color sends no mapping or scale);
  `size`, `label_size`, `spacing` whole numbers (sliders step by 1); same-
  layer pairs are an error, duplicates deduped; clearer `color_values`
  messages; `.individual` prints as `layer_name`; **print.mira_plot()
  served the plot lazily** (a server started for `p` served whatever `p`
  held when the browser asked) — forced. Fixed in MiRA — `continuous` on
  non-numeric data warns and is ignored; `scales[".set"]` colors the node
  sets. Example 2 was wrong for emln 17 (links run plant → bird, so plant
  in-degree was all zero). Known, not fixed: the interlayer weight slider
  shows 0.4984 for 0.5 (slider step; the threshold is 0.5); `c("TRUE" =
  ...)` does not match a logical column (JSON `true`); prototype-named JSON
  keys throw in viewSpec (R never sends them).
- **Stage 4 views (2026-11-02):** one `mira_mode_*()` per view
  (`mira_mode_grid/meta/map/layer/dashboard/data`; "mode" is MiRA's word).
  Settings for grid and meta-network only; the others open with defaults.
  **One view per plot:** a later `mira_mode_*()` of another view replaces
  the earlier one with a warning; the same view merges; no MiRA code for
  several views (Shai: users make one plot per view). Components still
  apply where MiRA uses them; R warns for `mira_camera()` (network mode
  only) and `mira_filter()` (MiRA's data filter works in network and map
  modes only; grid, meta-network and data show the whole network, also
  when entered by clicking). `mira_mode_meta()` follows the package rules:
  `color_by` or `color`, not both; `nested` only for bipartite networks.
  **`plot_mira()`** = `plot_multilayer()` + `mode` (open any view with
  defaults); named `plot_mira` because `mira_plot` is the class of
  `mira()` objects; `plot_multilayer()` kept unchanged, same help page.
  MiRA: `viewSpec.js` `mode` section starts the meta-network from
  `META_NETWORK_DEFAULTS` (exported from `metaNetwork.js`; two-row layout
  on bipartite data, fitted), because MiRA's blank session would open it
  circular, sized by participation, at a fixed zoom; rBridge enters Data
  mode after restore and warns when a view could not open. Seen, MiRA's
  own: the layer view of emln 17 (geographic) opens off-center, also by
  clicking (item 33); the meta-network min-weight slider snaps to 1% of the
  largest weight (0.5 shows as 0.61; the threshold and its label are 0.5).
- **QA 2026-11-02 (stages 2 and 3, both sides):** fixed in ggmira —
  numeric node names are written out (`100000`, not `"1e+05"`) in
  `mira_filter()` and `highlight`, names may be given as numbers when
  `node_name` is numeric, NA is rejected as a name; a highlighted node
  hidden by `mira_filter(nodes)` warns (MiRA dims everything and highlights
  nothing); a later `mira_legends()` sends only the arguments it gives
  (`position` alone no longer resets `show`); `show = TRUE` = `"all"`;
  `tilt` reports its limits in degrees; one unknown-name message for
  `nodes` and `highlight`; long conditions print on one line; docs
  (conditions through a `...` wrapper, README highlight example, `?ggmira`
  section "Networks"). Fixed in MiRA — the copied `tilt` is clamped to 45
  (the mouse goes to 45.8, which `mira_camera()` rejects); the copied call
  is recomputed every tick (it was stale when the rounded line on screen
  had not changed); no "-0.00" on screen. **Dropped, by decision:**
  clearing a filter or a highlight programmatically (`x <- NULL;
  mira_filter(nodes = x)`, `highlight = NULL`): no use case; only a literal
  `NULL`/`NA` clears a filter. **Backlogged:** link filter direction on
  undirected networks (item 37). **Known, not fixed:** both banners (filter
  and highlight) plus the Feedback button overlap at 1400 px (item 33); a
  standalone `mira_filter()` component holds the caller's environment
  until added to a plot; per-layer drags shift the readout's zoom/pan
  (documented); a node name containing `::` is ambiguous in MiRA's link
  keys (pre-existing); the readout's `setInterval` is never cleared (one
  per page).
- **A later `color_values` replaces the earlier vector (2026-11-02),** it
  does not merge by value: `p + mira_node(color_values = c(genus = "green"))`
  sends only genus (species goes back to the palette). Same "later
  component wins" rule as every argument; a merge-by-value variant was
  proposed and declined.
- **Stage 2 scope (2026-11-02):** `mira_filter(nodes, links)`. Each takes
  names or a condition evaluated in R like `subset()` (`nodes` on
  `net$nodes`, `links` on `net$extended`; NA drops); R sends names only.
  Several arguments in one call, or in separate calls, combine; only the
  same argument is replaced by a later component. No `layers` (item 35:
  the gap) and no state-node columns (item 36). Link conditions may use
  `layer_from` / `layer_to`. Developed on ggmira branch `feat/filter`, so
  beta testers on `main` are not affected until it is merged.
- **Palettes wait for item 17 (2026-11-01),** so categorical and
  continuous palettes arrive together.
- **Per set = vector named by `node_type`:**
  `color_by = c(pollinator = "module", plant = NA)`. One value = Shared.
  Shape auto-splits like the UI unless `shape` is given.
- **Invalid spec fields: warn and fall back** to the default; the plot
  always opens.
- **MiRA modules:** `js/rBridge.js` (fetch, orchestration, notice) and
  `js/viewSpec.js` (pure translation). The spec is applied by patching a
  default session and calling the existing `restoreSessionState` — no
  refactor of session code.
- **v1 output:** browser only. `mira_save()` is the next dev session.
- **Separate R package `ggmira` (2026-10-31),** not part of emln. Users
  load both (`library(emln); library(ggmira)`), like ggplot2 with data
  packages. Private repo Ecological-Complexity-Lab/ggmira (2026-11-01).
  - emln is **not changed**. ggmira has its own copy of the JSON converter
    (tested to give identical output to `emln::multilayer_to_json()`) and
    of the httpuv server (which also serves `/api/view.json`).
  - `plot_multilayer()` moves to ggmira (same arguments and behavior).
    emln keeps its copy until a later emln release deprecates it.
  - emln is only a test dependency (Suggests) of ggmira.
- **`mira(bipartite = TRUE)` is undirected unless `directed` is given
  (2026-11-01).** Bipartite edge lists store each link once (e.g. bird →
  plant), which emln's auto-detection reads as directed: arrows and only
  `in`/`out` degree. `plot_multilayer()` keeps emln's behavior.
- **`min_weight` is any number ≥ 0 (2026-11-01),** not 0–1: MiRA's sliders
  run to the largest weight in the data (e.g. emln 23: up to 83.3).

## Development plan (agreed 2026-11-01)

Order: S stages first (MiRA already saves the setting in its session, so
only the R piece + `viewSpec.js` are needed), then R-only, then M (needs
new MiRA code). Each stage: design approved first → MiRA view-spec
additions on `feat/ggmira` + R pieces, tests on both sides → real run with
screenshots → `view-spec.md` update → `npm run sync:ggmira`. New fields
are optional, so the spec stays version 1. R names below are sketches.

**Stage 1 — network-mode panels + color scales (S) — done 2026-11-01**

| # | Feature | R (as built) |
|---|---|---|
| 1 | Layer names: show, font size | `mira_layer(labels = TRUE, label_size = 14)` |
| 2 | Set names (bipartite) | `mira_layer(set_labels = TRUE)` |
| 3 | Stacking (horizontal / vertical), layer spacing | `mira_layer(stack = "vertical", spacing = 450)` (100–600) |
| 4 | Manual color per layer | `mira_layer(color_by = "layer_name", color_values = c(layer_1 = "red"))` |
| 5 | Node labels: show, size | `mira_node(labels = TRUE, label_size = 10)` |
| 6 | Nodes in 3D perspective | `mira_node(perspective = FALSE)` |
| 7 | Arrowhead size (intra and inter) | `mira_intralayer(arrow_size = 2)` (0–3) |
| 8 | Interlayer curvature | `mira_interlayer(curvature = 0.3)` |
| 9 | Interlayer links only between some layer pairs | `mira_interlayer(pairs = list(c("L1", "L2")))` |
| 15 | Color scale type for an attribute | `mira_node(color_by = "module", color_scale = "categorical")` |
| 16 | Manual color per value | `mira_node(color_by = "module", color_values = c("1" = "red"))` |

Checked end to end on emln 17 (bipartite and Kamada-Kawai, all stage 1
fields; screenshots). Tests: MiRA 334 unit + 31 browser; ggmira 222.

**Stage 2 — filters (S) — done 2026-11-02** (ggmira `feat/filter`, MiRA `feat/ggmira` acad719; not yet merged to ggmira `main`)

| # | Feature | R sketch |
|---|---|---|
| 14 | Show only some nodes or links (Data mode filter; restorable in MiRA) | `mira_filter(nodes = type == "bird", links = weight > 0.05)` |

**Stage 3 — network-mode view (S) — done 2026-11-02** (ggmira `feat/view`, MiRA `feat/ggmira` 14f1f99): `mira_camera(rotate, tilt, zoom, pan)`, `mira_legends(show = "all", position)` (legends start minimized; Shai prefers that to auto-opening), `mira_node(highlight)` (banner Clear only; search box and info panel not filled). Camera readout (2026-11-02): when MiRA is opened from R, the current camera in `mira_camera()` units shows under the zoom buttons, with *Copy for R* (js/cameraReadout.js; never on the website). **Merged to ggmira main 2026-11-02.**

| # | Feature | R sketch |
|---|---|---|
| 11 | Camera: rotation, zoom, pan (network mode) | syntax with stage 4 (camera is per view) |
| 12 | Which legends are open | `mira_view(legends = c("node_color"))` |
| 13 | Highlight a node (like search) | `mira_view(highlight = "Apis mellifera")` |

**Stage 4 — other views (S) — built 2026-11-02; merged to ggmira main 2026-11-02 (PR #2, ed13436)** (ggmira
`feat/modes` 44dcf3d..882819f, MiRA `feat/ggmira` 288d15f). Grid and
meta-network with settings; map, layer, dashboard and data open with
MiRA's defaults; `plot_mira(mode = )`. Pending: node shapes in the
meta-network (item 38, MiRA code, design shown to Shai first).
Added the afternoon of 2026-11-02, tested by Shai: `mira_filter()` in grid
mode (MiRA ee8484e: the grid applies the Data mode filter);
`mira_mode_meta(layers = )` selects layers in the meta-network's Filter
Layers panel (MiRA 1e62644). Map fixes (Shai's QA): plots from R opened the
map in Spain, MiRA's start position (aedadfb: rBridge no longer restores
the captured map position); the layer view zoomed in so far that bubbles
sat under the panels, and layers sharing one place zoomed to the maximum
(9c560db: new `js/mapFit.js` fits clear of the panels; map mode uses it
too). Checked on emln 17 (Galapagos), 23 (Canada), 38 (Japan), 7 (one
place). Docs (ggmira 6620aad): one help page per view, with a screenshot
(man/figures) and an icon; `?mira_mode` is the overview with a table of
which components apply in which view. **Next for the views: their
settings, map and layer view first (items 23, 22); each page is where
the arguments go.**

| # | Feature | R sketch |
|---|---|---|
| 21 | ~~Grid view: layers side by side, columns~~ | Done: `mira_mode_grid(columns = 3)` |
| 22 | Layer mode settings: bubble size/color, edge metric, edge min weight, labels, geographic placement | **Next (with 23).** Arguments go on `?mira_mode_layer`. Open-only for now (`mira_mode_layer()`). Restoring layer-view settings skips MiRA's own refresh (bubble sizes, legend), geographic mode cannot be turned off, the layout is random: MiRA work first. |
| 23 | Map mode settings: which layers, opacity, street map, show locations, center/zoom | **Next (first).** Arguments go on `?mira_mode_map`. Open-only for now (`mira_mode_map()`). The map now opens fitted to the layers (aedadfb, 9c560db). Deferred 2026-11-02 ("map seems difficult"): a restored session does not apply opacity, tiles or markers to the map (MiRA bug, item 33). |
| 24 | ~~Meta-network: aggregation, layout, color/size, min weight, nested sort, labels~~ | Done: `mira_mode_meta(...)` |
| 25 | ~~Open in Dashboard or Data mode~~ | Done: `mira_mode_dashboard()`, `mira_mode_data()` (settings not saved in sessions) |
| 39 | Data mode: which table opens (nodes, state nodes, links, layers) | `mira_mode_data(table = "links")`; check MiRA can open a tab other than Nodes. Arguments go on `?mira_mode_data`. |
| 38 | ~~Node shapes in the meta-network follow network mode (circle / square per node set)~~ | **Done 2026-11-02** (MiRA 345792d, ggmira 9f53b69 + d8da2c1): shapes from `renderer.nodeShapeFn`, set on entering the meta-network; a "Node Shape" legend when the sets differ, as in network mode; also in the two-row layout (consistent with network mode). Asked 2026-11-02; R inherits it. MiRA: `metaNetwork.js` draws with `traceNodeShape` from a shape function app.js sets from `renderer.nodeShapeFn` on entering the meta-network and when shapes change. |

**Stage 5 — R only**

| # | Feature | Notes |
|---|---|---|
| 27 | ~~Save a MiRA session file from R~~ | Moved to Later 2026-11-02: MiRA's own save-session button already writes the file (with the R settings and the layout); a file written from R would have no positions. Only gain is saving without a browser. |
| 28 | Derived mappings, `color_by = ~log10(weight)` | R adds the column |
| 29 | ~~Plain data frames as input~~ | Dropped 2026-11-02: emln exists because turning raw data into a multilayer object is an essential, validating step. ggmira takes only emln objects. |
| 30 | Presets, e.g. `mira_theme_paper()` | Bundles of settings above |
| 41 | ~~`mira_options(net, ...)`: what each component can be set to~~ | **Done 2026-11-03**, ggmira #5 (aa3a1fe). One row per component, argument and attribute (data columns, MiRA-computed ones, keywords, filter and meta-layer condition columns, meta measures), with MiRA's default scale type (colorMapper.js rule), switchable, source, sets and values. Takes the network plus mira()'s arguments. Prints grouped and colored by element (nodes amber, intralayer light blue, interlayer blue, layers purple; cli import). In Getting started at the end of step 1. Site: lab logo under the developers. |

**Then M (needs MiRA code) — 33 first, order of the rest to discuss**

**Workflow from 2026-11-02 (replaces the long-lived `feat/ggmira`):** each
feature below is a MiRA feature first. One MiRA branch `feat/<feature>` from
main (code, tests, `manual.html`), PR, squash merge, live. A ggmira branch of
the same name from main holds the R side (arguments, tests, help, article,
examples, `npm run sync:ggmira` after the MiRA merge). ggmira merges after
MiRA. While developing, the R branch may bundle the unmerged MiRA branch to
test; the final sync goes to main only after the MiRA merge. Item 33 (bugs)
can be its own small PR first.

**Priorities (Shai, 2026-11-02): 32, 17, 31** (20 dropped, see its row).
32 done 2026-11-02, 33 and 17 done 2026-11-03, 26 and 31 done 2026-11-04, 35 done 2026-11-12. **Release scope (2026-11-12): 40 for v1; 42, 23/22/39 and the rest after the release.**

| # | Feature | R sketch / notes |
|---|---|---|
| 33 | ~~Small MiRA bugs~~ | **Done 2026-11-03**: MiRA #96 (88a2b12), ggmira #4 (20e81e5). Intralayer link width rescaled by 4 / the 99th percentile of the weights when it is above 4 (`js/linkWidth.js`; pilosof2017 unchanged pixel for pixel; magrach2020, costa2020, diseasome, emln 23/63 now proportional); `renderer.layoutType` restored from sessions; data warnings once from R; filter banners + camera readout (now a small box) in one row under the bar, right of the menu panels; the roxygen warning in `mira_filter.R`. |
| 10 | ~~Interlayer arrowhead size~~ | Done in stage 1: MiRA has one arrowhead size (`renderer.arrowheadSize`, saved); `mira_intralayer(arrow_size)` sets it |
| 17 | ~~Named palettes, reversal, gradient limits~~ | **Done 2026-11-03**: MiRA #97, ggmira `feat/palettes`. `js/palettes.js`: 7 categorical (Dark2 default, Okabe-Ito), 17 continuous (viridis default; magma kept, inferno/plasma dropped as look-alikes; Pastel1/2 dropped). Limits squish. Legend: palette dropdown + ⇄, saved in sessions. R: `color_palette`, `color_reverse`, `color_limits` in the four color components, per set on nodes. Possible follow-up: the same choices in the panels under each Color dropdown. |
| 18 | Node size range | `mira_scale_size(range = c(1, 6))` |
| 19 | Legend titles | `mira_labs(node_color = "Module")` |
| 20 | ~~Link color by `weight`; link width scaling~~ | Dropped 2026-11-02. Widths already show weight; color by weight would show it twice (in Later). (Corrected 2026-11-03: the raw-weight width was the intralayer links', not the interlayer; fixed in 33.) |
| 26 | ~~`mira_save()`: image file from R~~ | **Done 2026-11-04**: MiRA #98 (b2a7ca0), ggmira #7 (d334489). chromote opens MiRA with `?save=true`; MiRA sets `window.miraStatus` when drawn and still, `window.miraSaveToR()` posts its own export to `/api/save` (view-spec.md §2). PNG / JPG / PDF, resolution 1–4, background grid / white / transparent, legends on or off, the mark kept. Exports now re-render at the export's pixel density (PDFs were screen resolution, stretched) and draw crisp: opaque links at least one pixel wide, node outlines inside the node, solid layer borders (screen unchanged). Still stretched from the screen: map, layer-view geo and meta-network views. Known: a grey band inside legend boxes at resolution 1 (html2canvas). |
| 31 | ~~"Copy as R code" button in MiRA~~ | **Done 2026-11-04**: MiRA #99 (f4b212a), ggmira #8 (6a74ae5). R button next to Save Session (only with a view spec: `mira()` plots and `plot_mira()`, not the website or `plot_multilayer()`); panel with the code colored by element (mira_options() colors), notes for what R cannot set as comments, Copy. `js/rCode.js` stateToSpec / specToR, `js/rCodePanel.js`; R sends its `mira()` call and filter conditions in the spec's `r` field (view-spec.md §2). Camera readout: Copy for R removed, × to hide it. `plot_mira()` now sends a spec (legends start minimized, as for `mira()`). Ideas: bipartite auto-detection in `plot_mira()` / `mira()` (asked, not decided); the R button for `plot_multilayer()`. |
| 32 | ~~More node shapes (triangle, diamond)~~ | **Done 2026-11-02**: MiRA #95 (1af87ef), ggmira #3 (6eab3b3). Equal area to the circle; legend glyphs drawn with `traceNodeShape`. First feature on the per-feature branch workflow. |
| 35 | ~~Filter layers, closing the gap in the stack~~ | **Done 2026-11-12**: MiRA #100 (eebf58d), ggmira #19 (25e0a77). `renderer._stackSlot()`: a layer's place is its position among the kept layers (cached per filter); hit tests and `centerView` skip hidden layers; the view refits when the layer filter changed the stack (`stackChangedSinceFit()`: leaving Data mode, the banner's Clear, opening from R). View spec `filter.layers`; R code writes `mira_filter(layers = )`. R: `mira_filter(layers = )` names or a condition on `net$layers` (shared `.layer_names()` with `mira_mode_meta(layers = )`); the layer view applies `layers` only. |
| 36 | Filter nodes per layer (state-node columns, e.g. `abundance > 10`) | MiRA's node filter is by node name across all layers (renderer.js); a per-(node, layer) condition has no faithful mapping. Needs a per-layer node filter in MiRA. |
| 34 | Color scales per element (node / intralayer / interlayer / layer), not per attribute name. Decided 2026-11-02 to keep MiRA's rule for now: one `value -> color` map per attribute name (`categoryColorOverrides`, app.js), shared by every element colored by that attribute. Two tables with the same column name and the same value (node `module` 1, link `module` 1) share a color, in the UI and from R (R warns which piece replaces which). | Key the overrides by `element:attr`; touches the three color functions, the legend editor and session save/restore (fallback for old keys); then `scales` in the view spec and `.combine_scales` in R. |
| 37 | ~~Link filter on undirected networks listing both directions~~ | **Done 2026-11-03** in MiRA #96: filters are checked against the drawn links, and an undirected link given in the other direction finds the drawn one (`drawnLinkKeys` in rBridge.js). |
| 40 | Arrowheads in dense directed layers | Arrowheads are at least 14 px long (`14 + 1.5 × width`, renderer.js), so small, dense directed layers turn black (emln 23, costa2020). The slider (`mira_intralayer(arrow_size = )`) fixes it by hand. Options: scale with layer density, or a smaller default. Found 2026-11-03. |
| 42 | Link opacity: `mira_intralayer(alpha = )`, `mira_interlayer(alpha = )` | Added 2026-11-04 (from `mira_save()` review: translucent links look hazy in print). MiRA first: an opacity slider (0–1, "default" = today's 0.9 / 0.5 bipartite gradient / 0.7 interlayer) in the intralayer and interlayer link settings, used by the renderer (network and map views), saved in sessions, reset by Reset; spec keys `intralayer.alpha`, `interlayer.alpha`. When set, exports use it instead of the crisp default (opaque). Grid view draws links opaque already; layer view and meta-network links are between layers, not affected. Own branch `feat/link-alpha`. |
| 43 | Vector export (SVG, vector PDF) | Added 2026-11-04, later. Raster exports pixelate past 100 % zoom however high the resolution. Earlier attempts at SVG export in MiRA never worked. Idea: draw the renderer's canvas calls into an SVG-recording context (it uses only paths, arcs, text, transforms, dashes); the HTML legends need their own vector version. |

## Open decisions

(none)

## Prerequisites

- [ ] Node-set channels (branch `feat/node-set-channels`) need to finish
      student testing, then ship to main via PR. ggmira's per-set
      arguments depend on it.

## MiRA groundwork (before the R side)

- [x] Phase 0: view-spec contract ([view-spec.md](view-spec.md)).
- [x] Phase 1: seeded layouts (`js/random.js`, optional `seed` in
      `js/layout.js`; unseeded behavior identical).
- [x] Phase 2: `js/viewSpec.js` + unit tests; `js/rBridge.js`; 3-line hook
      in `autoloadFromR`; Playwright tests with `page.route` fakes.

## R side (ggmira)

- [x] `mira()`, `mira_*()` pieces + `+` method that accumulates a spec.
- [x] Color scales: `color_values` / `color_scale` in each piece (stage 1).
- [x] Palettes (`color_palette`, `color_reverse`, `color_limits`): item 17.
- [x] Validation in R: attribute exists (warning), numeric for `size_by`
      (warning; numbers stored as text count, as in MiRA), set names match
      `node_type` values (error).
- [x] `print()` method serves network + view spec and opens MiRA;
      `mira_spec()` returns the spec.
- [x] Tests (testthat) for spec building and validation.
- [x] Warning for a computed name MiRA will not have (`in`/`out` only on
      a directed side, no `inter_*` without interlayer links), with the
      variants it has as a hint. `mira()` builds the list like MiRA's parser
      (R/mira_computed.R); matches MiRA's menus on emln 13 and 17.
- [x] "did you mean" hint for a keyword without its dot (`"individual"`
      → `".individual"`, `"set"` → `".set"`), where the keyword works.
- [x] `print.mira_piece()` / `format`: a piece prints as the call that
      makes it (`mira_node(size = 8)`).
- [x] `scripts/sync-ggmira.sh` + `npm run sync:ggmira` (copy of
      sync-emln.sh with `DEST=../ggmira/inst/MiRA`) — when shipping.
- [ ] **emln bug:** `emln::load_emln()` fails with "object 'descriptions'
      not found" unless emln is attached (`library(emln)`): it reads its
      lazy-loaded datasets without the `emln::` prefix.
- [ ] **emln bug (minor, localhost only):** `plot_multilayer()`'s path
      check `startsWith(file_path, mira_path)` also accepts sibling
      directories sharing the prefix (e.g. `.../MiRA-dev` when serving
      `.../MiRA`). Fixed in ggmira's copy (compares with `mira_path/`).
- [ ] Later emln release: deprecate `emln::plot_multilayer()` in favor of
      `ggmira::plot_multilayer()` (agree with Geut).

---

## Handoff: 2026-11-12 — toward the first release

Session of 2026-11-12 (opened in the ggmira folder by mistake; continue in
the multi-folder workspace MiRA + MiRA-dev + ggmira).

**Release decisions (Shai, 2026-11-12):**
- **Target:** public GitHub + pkgdown site on GitHub Pages; install with
  `remotes::install_github()`. Not CRAN for now.
- **Modes:** keep every `mira_mode_*()`. Network, grid and meta-network are
  fully supported; map, layer, dashboard and data are documented as
  opening with MiRA's defaults (the `?mira_mode` table already says what
  applies where).
- **Must-haves for v1 besides the fixes:** item 40 (arrowheads in dense
  directed layers) and ggmira issue #13 (open in RStudio's Viewer pane, e.g.
  `print(p, viewer = TRUE)` or `options(ggmira.viewer = )`, browser outside
  RStudio). Everything else in the M table (18, 19, 22, 23, 39, 42, 43…)
  and issue #18 (rename layers) is after the release.

**Done this session (all merged):** MiRA #100 → main eebf58d (live);
ggmira #19 → main 25e0a77 (bundles MiRA eebf58d).
- Beta issues fixed: #16 (a click on a legend counted as a drag: the panel
  now switches to left/top only after a > 3 px move; layer-view drags noted
  in the R code, `layerView.movedBubbleCount()`), #14 ("Network loaded from
  R"), #12 (meta-network legend redrawn after a session restore), #15 (the
  layer view applies Data mode's layer filter; banner in the layer view;
  `_rebuildLayerView()` on Clear), #17 (layer view `colorBy: 'attribute'` +
  `colorAttr`, network mode's layer color scale, the dropdown lists layer
  attributes and is shared with network mode both ways; "Layer color" =
  Individual).
- Item 35 (see its row).
- Docs: `?mira_filter`, `?mira_mode` table, `?mira_mode_layer`,
  `?mira_mode_data`; Getting started step 6 (layers, new screenshot
  step-6-filter-layers.png) and step 8 screenshot (meta color legend).
  Help pages regenerated with roxygen2 8.1.1 (Shai's new R: formatting
  only; DESCRIPTION has `Config/roxygen2/version`).
- QA baseline: R CMD check clean (0/0/0); ggmira 539 tests; MiRA 442 unit
  + 69 browser tests.
- The GitHub issues #12, #14, #15, #16, #17 are closed by hand by Shai
  (closing notes were drafted in the session; no "Closes #" in PRs).

**Next, in order:**
1. Item 40, arrowheads in dense directed layers (MiRA, then R if needed).
2. Issue #13, RStudio Viewer (R only).
3. QA sweep. Shai asked for an independent QA pass: a Fable subagent on
   the R package and the bundled MiRA, given the code, not conclusions.
   Plus hands-on runs of every mode on emln 13, 14, 17, 23, 63 and the
   Siberian demo, a fresh `install_github()` into a clean library, and
   the website-path check (demo datasets without R).
4. Release prep: NEWS.md, version (0.1.0 → 1.0.0?), README pass, `url` in
   `_pkgdown.yml` (pkgdown warns), make the repo public, GitHub Pages,
   retake all article screenshots (most predate MiRA's R button), tag.

**Open questions for Shai:**
- MiRA's fit leaves no room for the toolbar: in vertical stacks the top
  layer sits under it (Getting started steps 5 and 6). Fix in v1? It shifts
  every opening view, and so how `mira_camera()` values frame a plot.
- The R button writes `color_by = ".individual"`; the docs recommend
  `"layer_name"` (R accepts both). Make the R code write `"layer_name"`?

**Practical notes:**
- The Siberian demo (pilosof2017) is not in emln; build it in R from
  `MiRA-dev/data/pilosof2017.json` (`jsonlite::fromJSON()`, then
  `structure(list(nodes, layers[, c("layer_id", "layer_name")], extended,
  state_nodes), class = "multilayer")`) and open with
  `mira(net, bipartite = TRUE, setA_type = "parasite", directed_interlayer = TRUE)`.
- Headless checks: chromote from R with ggmira internals (`.mira_app`,
  `.start_server`, `.wait_for`), `mira_path` = MiRA-dev; MiRA exposes
  `window._layerView`, `window._metaNetwork`, and modules can be imported
  in the page (`await import('/js/dataMode.js')`).
- Browser tests: start `/usr/bin/python3 -m http.server 8001` by hand
  (`/usr/local/bin/python3` is Intel), then
  `npx playwright test --config config/playwright.config.js --workers 1`.
- `gh pr merge --squash --delete-branch` in MiRA-dev fails locally after
  merging (main is checked out in the MiRA worktree); delete the remote
  branch by hand. The MiRA worktree (`~/GitHub/ecomplab/MiRA`, main) was
  behind (106f938): pull it before working there.
- emln is on CRAN (not GitHub).

## Handoff: 2026-11-02 afternoon

- ggmira `feat/modes`: stage 4 with the grid filter, meta-network layers,
  the map fixes (bundled MiRA 65c7743) and one help page per view
  (6620aad). R CMD check: 0 errors, 0 warnings. Not merged: Shai merges
  when approved.
- MiRA `feat/ggmira` (worktree MiRA-dev): aedadfb, 9c560db on top of
  1e62644. 370 unit + 43 browser tests pass (`--workers 1`). With 3
  workers, a few browser tests time out (e.g. "a seeded layout gives
  identical positions on every load"), on the old code too: the
  single-threaded test server under load, not a regression.
- Pre-existing roxygen warning: `R/mira_filter.R:78`, `[layer_from, ...]`
  read as a link in an internal doc; escape the brackets.
- Item 38 done the same evening (see the table). Also: `mira()`,
  `plot_mira()` and `plot_multilayer()` warn in R about links with weight 0,
  which MiRA does not draw (ggmira f41caac; emln 7: 152 of 247).
- ggmira `feat/modes` merged to main (PR #2, ed13436), after item 38.
- MiRA `feat/ggmira` squash-merged to main (PR #94, 89915d6), live, after
  the website-path check (demo datasets without R, against main: no
  regressions; grid filter, map fit, meta-network shapes as intended).
  Manual updated (f9d4735). Branches cleaned 2026-11-02: MiRA keeps
  `main` and `development`; `feat/ggmira`, `feat/ggmira-view-spec` and
  `feat/node-set-channels` deleted, kept as tags `archive/ggmira`,
  `archive/ggmira-view-spec`, `archive/node-set-channels` (the commit
  hashes cited in this backlog stay reachable). ggmira keeps only `main`.
  Shai prefers one long-lived branch for the MiRA side of ggmira:
  `feat/ggmira` was recreated from main (89915d6) and MiRA-dev works on
  it. Since MiRA squash-merges PRs, after each merge reset it to main
  (`git -C MiRA-dev fetch && git -C MiRA-dev reset --hard origin/main &&
  git -C MiRA-dev push --force-with-lease`) before continuing.
  MiRA `feat/ggmira` to main (live site) only after a website-path check:
  demo datasets without R, grid filter, map, layer view, Reset,
  meta-network. Then items 23 and 22 (map and layer view settings).

## Handoff: resume after `feat/node-set-channels` is merged (2026-11-01)

Paused on purpose: a student is testing `feat/node-set-channels`, which
`feat/ggmira-view-spec` is built on. Everything is committed and pushed
(MiRA `feat/ggmira-view-spec` 683c07c; ggmira `main` on
Ecological-Complexity-Lab/ggmira; this file on `development`).
Working rules as before: describe code and wait for approval, no
multi-block refactors, commit each step, American spelling.

Next actions, in order:

1. ~~Merge `feat/node-set-channels`~~ **Done 2026-11-01: PR #93**
   (squash, c75ddfe), live on mira.ecomplab.com. That branch was started
   from `development` and carried dev-only files, so its 7 feature commits
   were cherry-picked onto a fresh branch from `main`
   (`release/node-set-channels`). The PR also pinned CI runners to
   `ubuntu-24.04` (Playwright 1.58 cannot install browsers on 26.04).
2. ~~Move the view-spec branch onto `main`~~ **Done 2026-11-01:** branch
   `feat/ggmira` (pushed) = `main` + the 5 ggmira commits, cherry-picked
   without conflicts. Tests: `npm test` 317; browser 30/30 with
   `--workers=1`. With the configured 3 workers, one node-sets test
   (`bipartite network loads shared…`) sometimes times out loading its demo
   dataset (python server under load); it passes 5/5 alone. The old
   branches `feat/ggmira-view-spec` and `feat/node-set-channels` are kept
   until `feat/ggmira` is confirmed, then can be deleted.
3. ~~Bundle MiRA in ggmira~~ **Done 2026-11-01:** `scripts/sync-ggmira.sh`
   + `npm run sync:ggmira` on `feat/ggmira` (c630203); ggmira bedb743
   bundles `inst/MiRA` (38 files, 2.5 MB). Checked: `install_github()` into
   a fresh library, then `print(p)` with no `mira_path` on emln 17 serves
   the bundled MiRA and applies the spec. R CMD check clean. After any MiRA
   change: `npm run sync:ggmira` in MiRA-dev, commit `inst/MiRA` in ggmira.
4. **(Deferred: students test later; Shai tests now.)** **User testing of milestone 1:** a short task sheet (plot your own
   network with `mira()`, change settings, report what was confusing);
   collect feedback in this file.
5. **PR `feat/ggmira-view-spec` → `main`** when ggmira ships to testers
   beyond the lab machines (timing to decide).
6. **Small MiRA bugs,** one branch each (see Later): `renderer.layoutType`
   not restored; double "Data warnings" alert; very thick links with large
   weights.
7. **Development plan stages** (see above): stage 1 done; next stage 2.
8. **With Geut:** the two emln bugs; deprecate `emln::plot_multilayer()`.

## Phase 4 results (2026-11-01)

End-to-end runs from R (dev loop below), checked with screenshots and
MiRA's control values; no browser errors, no MiRA notice:

- **emln 13** (Kefi multiplex; not bipartite, 12 node types, directed
  auto-detected): Fruchterman seed 7, node color by `node_type`, size by
  `body_mass`, link color by `type`, layer color by `description`. In R:
  bipartite layout, `.set` and per-set `shape` are errors; an unknown
  column (`phylum`) is a warning.
- **emln 63** (temporal food web; not bipartite, `directed = FALSE`):
  circle layout, constant node color and square shape, size by
  `intra_degree_sum`, intralayer color and `min_weight = 10`, layer color
  by `date` (a Date column). No arrows.
- **emln 14** (the README example; bipartite, undirected default):
  Kamada-Kawai seed 42, per-set color (`intra_degree_sum` / default),
  intralayer color, `.individual` layers.
- Earlier: emln 23 and 17 (see the handoff below).

Seen again: very thick links when weights are large (emln 63, up to 98) —
already under Later.

## Handoff for Phase 4 (2026-11-01)

Phase 3b is done; Phase 4 is next: end-to-end check of `mira()` on 2–3
emln datasets (bipartite and not, directed and not) with screenshots, and
a short manual paragraph. Checked so far: emln 23 (directed, bipartite),
Kamada-Kawai seed 42, per-set color and size, interlayer color, layer
color by `location`; the MiRA notice shows for an attribute MiRA does not
compute. emln 17 (the only emln dataset with interlayer links): show,
hide, color, min_weight. emln 23 again: undirected default, min_weight 50. Dev loop scripts: `devtools::load_all("ggmira")`, `print(p,
mira_path = "MiRA-dev", browser = function(url) cat(url))`, then
`httpuv::service()` in a loop and a Playwright screenshot.

The Phase 3 handoff below is kept for reference.

## Handoff for Phase 3 (fresh session, 2026-10-31)

Start here. Read [view-spec.md](view-spec.md) §3, §6 and this file.

- **Working rules from the user:** describe the code plan and wait for
  approval before writing code; no refactoring of existing code that spans
  multiple blocks; commit each step; American spelling.
- **MiRA side is done** on branch `feat/ggmira-view-spec` in
  `~/GitHub/ecomplab/MiRA-dev` (local, not pushed; built on
  `feat/node-set-channels`). R talks to it only through
  `/api/network.json` + `/api/view.json`.
- **R package:** new `~/GitHub/ecomplab/ggmira` (see Decided). Server and
  converter copied from emln `R/plot_multilayer.R` and
  `R/multilayer_to_json.R` (emln has no jsonlite; it uses an internal
  `.to_json`). Phase 3a = skeleton + converter + server + `plot_multilayer()`;
  3b = `mira()` grammar.
- **Dev loop:** temporary Rscript with `devtools::load_all("../ggmira")`
  and `mira_path = "../MiRA-dev"` (worktree must be on
  `feat/ggmira-view-spec`). No need to sync emln/inst/MiRA until shipping.
- **Phase 3 scope (milestone 1, no scales):** `mira()`, `mira_layout()`,
  `mira_node()`, `mira_intralayer()`, `mira_interlayer()`, `mira_layer()`,
  `+.mira_plot`, `print.mira_plot()`, `mira_spec()`; validation in R
  (types, layout names, shapes, hex colors — convert color names with
  `grDevices::col2rgb`, set names vs `node_type`; unknown attribute only
  warns); `NA` in per-set vectors → JSON `null`; `color_by` + `color` in
  one piece → error; later pieces override field by field;
  testthat tests; roxygen docs.
- **MiRA link colors:** MiRA's link dropdown excludes `weight`, so
  `color_by = "weight"` on links is not available (R should warn). Making
  it available is MiRA work (see Later).
- **Spec gotchas:** spec `version` must be 1 or MiRA ignores everything;
  `.set` (node color by set) and `.individual` (layer colors) keywords;
  a constant `node.color` switches node color mapping to Default in MiRA.
- **Phase 4 after that:** end-to-end check on 2–3 emln datasets with
  screenshots; short manual paragraph.

---

## Later (ideas, not v1)

Each needs MiRA work first; the R side is cheap once MiRA supports it.

- **Save a session file from R** (was item 27), only if someone needs to
  save without a browser. Check MiRA accepts a session without positions.

- ~~**`mira_save()`**~~ — done 2026-11-04 (item 26).
- **Continuous color palettes** (`palette = "magma"`) and palettes for
  MiRA-computed attributes. MiRA is Dark2 / Viridis only; needs a palette
  argument in `colorMapper.js` and a new session field.
- **Size range** (`range = c(1, 6)`). MiRA uses a fixed 0.3–2.0× of base size.
- **Legend titles / `labs()`.** MiRA titles are fixed ("Node Color: module").
- **Link color by `weight`** (was part of item 20), only if someone asks:
  width already shows weight. MiRA's link color dropdown excludes `weight`
  (dataParser `linkAttributeNames`).
- **`aes()` as an alternative mapping syntax.** Its real gain is derived
  variables (`aes(size = log(abundance))`). Could be added later without
  breaking the string API.
- ~~**"Copy as R code"**~~ — done 2026-11-04 (item 31).
- **Per-set scales**, only if MiRA ever stores scales per set.
- Map mode and meta-network views. v1 covers network mode only.
- Camera and stacking from R (`mira_view()`: rotation, layer spacing,
  stack mode, labels).
- **Move session save/restore out of `app.js`** into its own module.
  Worth doing, but it touches dozens of DOM elements and globals — a
  project of its own, not part of ggmira.
- **Bug (existing, to fix later):** `restoreSessionState` never sets
  `renderer.layoutType`. Save a session of a bipartite network in
  Kamada-Kawai and load it: positions are Kamada-Kawai but the renderer still
  draws bipartite details (set names, diagonal placement). One-line fix in
  restore step 6. The R path already works around it in `rBridge`.
- **Link width with large weights:** fixed in item 33 (2026-11-03).
- **Weight slider snapping:** a `min_weight` from R that is not on the
  slider's step (max weight / 100) shows a snapped knob (0.5 → 0.4984);
  the filter itself uses the exact value. Cosmetic; same for sessions.
- **Test server:** `/usr/local/bin/python3` on Shai's Mac is an Intel
  binary ("Bad CPU type"), so Playwright cannot start its webServer; run
  `/usr/bin/python3 -m http.server 8001` from MiRA-dev by hand. A server
  left running for days made browser tests time out at random.
- Fix the double "Data warnings" alert when a session (or view spec) is
  restored (`restoreSessionState` calls `loadData` again).

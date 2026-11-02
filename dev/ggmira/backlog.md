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
**Milestone 1 is complete.** **Stage 1 of the development plan is done
(2026-11-01):** MiRA feat/ggmira ed29cbc, ggmira 21316e6 + bundled MiRA
322b587. Next: stage 2 (`mira_filter`), design first.

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

**Stage 2 — filters (S)**

| # | Feature | R sketch |
|---|---|---|
| 14 | Show only some layers, nodes or links (Data mode filter; restorable in MiRA) | `mira_filter(layers = c("L1", "L3"))` |

**Stage 3 — network-mode view (S)**

| # | Feature | R sketch |
|---|---|---|
| 11 | Camera: rotation, zoom, pan (network mode) | syntax with stage 4 (camera is per view) |
| 12 | Which legends are open | `mira_view(legends = c("node_color"))` |
| 13 | Highlight a node (like search) | `mira_view(highlight = "Apis mellifera")` |

**Stage 4 — other views (S).** One family, `mira_mode_*()`; each view has
its own camera settings. Syntax to be discussed before any code.

| # | Feature | R sketch |
|---|---|---|
| 21 | Grid view: layers side by side, columns | `mira_mode_grid(columns = 3)` |
| 22 | Layer mode: bubble size/color, edge metric, edge min weight, labels, geographic placement | `mira_mode_layer(...)` |
| 23 | Map mode: which layers, opacity, street map, center/zoom | `mira_mode_map(...)` |
| 24 | Meta-network: aggregation, layout, color/size, min weight, nested sort, labels | `mira_mode_meta(...)` |
| 25 | Open in Dashboard or Data mode | `mira_mode_dashboard()`, `mira_mode_data()` |

**Stage 5 — R only**

| # | Feature | Notes |
|---|---|---|
| 27 | Save a MiRA session file from R, to open on the website | Check MiRA accepts a session without positions |
| 28 | Derived mappings, `color_by = ~log10(weight)` | R adds the column |
| 29 | Plain data frames as input, not only emln objects | |
| 30 | Presets, e.g. `mira_theme_paper()` | Bundles of settings above |

**Then M (needs MiRA code) — 33 first, order of the rest to discuss**

| # | Feature | R sketch / notes |
|---|---|---|
| 33 | Bugs: `renderer.layoutType` not restored; double "Data warnings" alert | Small fixes, PR to main (live site) |
| 10 | ~~Interlayer arrowhead size~~ | Done in stage 1: MiRA has one arrowhead size (`renderer.arrowheadSize`, saved); `mira_intralayer(arrow_size)` sets it |
| 17 | Named palettes (categorical and continuous), gradient limits, palettes on computed attributes | `mira_node(color_by = "body_mass", color_palette = "magma", color_limits = c(0, 100))` |
| 18 | Node size range | `mira_scale_size(range = c(1, 6))` |
| 19 | Legend titles | `mira_labs(node_color = "Module")` |
| 20 | Link color by `weight`; link width scaling | `mira_intralayer(color_by = "weight", width = "scaled")` |
| 26 | `mira_save()`: image file from R | Headless browser; MiRA signals "rendered" |
| 31 | "Copy as R code" button in MiRA | |
| 32 | More node shapes (triangle, diamond) | |
| 34 | Color scales per element (node / intralayer / interlayer / layer), not per attribute name. Decided 2026-11-02 to keep MiRA's rule for now: one `value -> color` map per attribute name (`categoryColorOverrides`, app.js), shared by every element colored by that attribute. Two tables with the same column name and the same value (node `module` 1, link `module` 1) share a color, in the UI and from R (R warns which piece replaces which). | Key the overrides by `element:attr`; touches the three color functions, the legend editor and session save/restore (fallback for old keys); then `scales` in the view spec and `.combine_scales` in R. |

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
- [ ] Palettes (`color_palette`, `color_limits`): item 17.
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

- **`mira_save()`** — next dev session (headless render to file; needs
  chromote or similar, and MiRA signaling "rendered" back to R).
- **Continuous color palettes** (`palette = "magma"`) and palettes for
  MiRA-computed attributes. MiRA is Dark2 / Viridis only; needs a palette
  argument in `colorMapper.js` and a new session field.
- **Size range** (`range = c(1, 6)`). MiRA uses a fixed 0.3–2.0× of base size.
- **Legend titles / `labs()`.** MiRA titles are fixed ("Node Color: module").
- **Link color by `weight`.** MiRA's link color dropdown excludes `weight`
  (dataParser `linkAttributeNames`). Needs a MiRA change.
- **Plain data frames as input** to `mira()` / `plot_multilayer()` (not
  only emln `multilayer` objects), for non-emln users.
- **More node shapes** beyond circle and square (triangle, diamond).
- **`aes()` as an alternative mapping syntax.** Its real gain is derived
  variables (`aes(size = log(abundance))`). Could be added later without
  breaking the string API.
- **"Copy as R code"** button in MiRA that generates ggmira code from the
  current view.
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
- **Link width with large weights:** links look width-scaled by raw
  weight, so weights like 80 (emln 23, prevalence in %) draw very thick
  bars. Check how MiRA maps weight to width; maybe normalize to the max.
- **Weight slider snapping:** a `min_weight` from R that is not on the
  slider's step (max weight / 100) shows a snapped knob (0.5 → 0.4984);
  the filter itself uses the exact value. Cosmetic; same for sessions.
- **Test server:** `/usr/local/bin/python3` on Shai's Mac is an Intel
  binary ("Bad CPU type"), so Playwright cannot start its webServer; run
  `/usr/bin/python3 -m http.server 8001` from MiRA-dev by hand. A server
  left running for days made browser tests time out at random.
- Fix the double "Data warnings" alert when a session (or view spec) is
  restored (`restoreSessionState` calls `loadData` again).

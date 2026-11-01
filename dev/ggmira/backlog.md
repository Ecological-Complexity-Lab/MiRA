# ggmira — decisions, ideas and todos

Running tracker for ggmira: a gg-like R API (in emln) that builds a MiRA
view spec, so network-mode plots can be written as code. Not everything
ships in v1; park ideas here instead of growing the current scope.

Status: **Phase 0 done** (contract: [view-spec.md](view-spec.md)).
Phases 1–2 done on branch `feat/ggmira-view-spec` (local, last a709730).
Phase 3 done: ggmira package at `~/GitHub/ecomplab/ggmira` (local git):
3a (74a3938) converter, server, `plot_multilayer()`; 3b (63b6c2c) the
`mira()` grammar. Next: Phase 4 (end-to-end on emln datasets, manual).

## Milestones

1. **Basics** (Phases 1–4): `mira()`, `mira_layout()`, `mira_node()`,
   `mira_intralayer()`, `mira_interlayer()`, `mira_layer()`. Colors use
   MiRA's defaults (Dark2 / Viridis, auto type). Test with users first.
2. **Easy scales** (new code only): `mira_scale_color()` with `type`,
   manual `values`, discrete palettes on data attributes (expanded in R).
3. **MiRA-side features**, one feature branch each: continuous palettes and
   palettes on computed attributes, size range, legend titles,
   `mira_save()`.

Rule: a milestone starts only after the previous one is tested.

**Ground rule (2026-10-31): do not break anything.** No refactoring of
existing code that spans multiple blocks. New behavior goes in new modules;
existing files get only small additive changes (listed in view-spec.md §1).

---

## Decided

- **Names:** everything is `mira_*`: `mira()`, `mira_layout()`,
  `mira_node()`, `mira_intralayer()`, `mira_interlayer()`, `mira_layer()`,
  `mira_scale_color()` (milestone 2). Avoids clashes with ggplot2 / ggraph.
- **Layout is plot-level:** `mira_layout(type, seed, nested)`.
- **Mappings are strings, not `aes()`.** `color_by = "module"` maps an
  attribute; `color = "#333"` sets a constant. Both in one piece → error.
- **Scales are per attribute:** `mira_scale_color("module", type, palette,
  values)`, matching how MiRA stores scales (`colorScaleOverrides`,
  `categoryColorOverrides`). Per-set scales are rejected.
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
  packages. Local only for now: `~/GitHub/ecomplab/ggmira`, no remote.
  - emln is **not changed**. ggmira has its own copy of the JSON converter
    (tested to give identical output to `emln::multilayer_to_json()`) and
    of the httpuv server (which also serves `/api/view.json`).
  - `plot_multilayer()` moves to ggmira (same arguments and behavior).
    emln keeps its copy until a later emln release deprecates it.
  - emln is only a test dependency (Suggests) of ggmira.

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
- [ ] (Milestone 2) `mira_scale_color()`; discrete palettes expanded in R
      into `values` (base R `palette.colors()` / `hcl.colors()`), no MiRA
      change.
- [x] Validation in R: attribute exists (warning), numeric for `size_by`
      (warning; numbers stored as text count, as in MiRA), set names match
      `node_type` values (error).
- [x] `print()` method serves network + view spec and opens MiRA;
      `mira_spec()` returns the spec.
- [x] Tests (testthat) for spec building and validation.
- [ ] R accepts any name matching MiRA's computed-attribute pattern, but
      MiRA computes only some of them: on a directed network only the
      `in`/`out` variants (no `intra_degree_sum`), and no `inter_*` without
      interlayer links. MiRA catches it (notice, default kept). Could warn
      in R if `.network_json()` returned the detected `directed` flag.
- [ ] `print.mira_piece()` / `format` so a piece typed at the console reads
      nicely (now it prints the raw list). Small, R only.
- [ ] `scripts/sync-ggmira.sh` + `npm run sync:ggmira` (copy of
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

## Handoff for Phase 4 (2026-11-01)

Phase 3b is done; Phase 4 is next: end-to-end check of `mira()` on 2–3
emln datasets (bipartite and not, directed and not) with screenshots, and
a short manual paragraph. Checked so far: emln 23 (directed, bipartite),
Kamada-Kawai seed 42, per-set color and size, interlayer color, layer
color by `location`; the MiRA notice shows for an attribute MiRA does not
compute. Dev loop scripts: `devtools::load_all("ggmira")`, `print(p,
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
- Fix the double "Data warnings" alert when a session (or view spec) is
  restored (`restoreSessionState` calls `loadData` again).

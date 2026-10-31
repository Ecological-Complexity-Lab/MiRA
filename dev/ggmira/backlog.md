# ggmira — decisions, ideas and todos

Running tracker for ggmira: a gg-like R API (in emln) that builds a MiRA
view spec, so network-mode plots can be written as code. Not everything
ships in v1; park ideas here instead of growing the current scope.

Status: **design phase. No code yet.** Next step is a design doc, then a
token estimate and plan for approval (CLAUDE.md rules).

---

## Decided

- **Grammar shape:** `mira(net) + geom_node(...) + geom_layer(...) +
  geom_intralayer(...) + geom_interlayer(...)`. Each geom corresponds to
  one MiRA sidebar panel.
- **Mappings are strings, not `aes()`.** Example: `color_by = "module"` maps
  an attribute and `color = "#333"` sets a constant. These are two separate
  arguments.
- **Scales are separate `scale_*()` pieces**, the same split as ggplot
  (mapping = which variable, scale = how values become colors or sizes).
- **Per-set styling uses named vectors**:
  `color_by = c(parasite = "module", host = "degree")`. Mirrors the
  Shared / Per set toggles in the Nodes panel.
- **Architecture:** R emits a *partial* view spec (JSON) → served at
  `/api/view.json` → MiRA `applyViewSpec()` merges it onto defaults.
  Validate in both R and MiRA, and version the schema.

## Proposed, not yet confirmed

- Scale names carry the channel: `scale_node_color_discrete()`,
  `scale_node_color_continuous()`, `scale_node_size()`,
  `scale_node_shape()`, `scale_intralayer_color_*()`,
  `scale_interlayer_color_*()`, `scale_layer_color_*()`.
- A scale applies to an attribute, not a set. MiRA stores color mode and
  category colors per attribute name (`colorScaleOverrides`,
  `categoryColorOverrides`), so R should **reject** per-set scales.

## Open decisions

- [ ] **Layout location:** `geom_layer(layout = ...)` or `mira(net, layout = ...)`?
- [ ] **Naming:** `geom_*` (familiar, but clashes with ggplot2 if both are
      loaded) or `mira_*`?
- [ ] **v1 output:** open in browser only, or also export (PNG/SVG) from R?

## Prerequisites

- [ ] Node-set channels (branch `feat/node-set-channels`) need to finish
      student testing, then ship to main via PR. ggmira's per-set
      arguments depend on it.

## MiRA groundwork (before the R side)

- [ ] Seeded layouts. `js/layout.js` uses `Math.random`, so the same code
      gives a different plot on each run.
- [ ] Refactor `restoreSessionState` into reusable apply steps (shared by
      session load and view-spec apply).
- [ ] `applyViewSpec(spec)`: merge a partial spec onto defaults and report
      invalid fields.
- [ ] Autoload `/api/view.json` alongside `/api/network.json`.
- [ ] View-spec schema with a version field. Keep it close to the session
      JSON (v2).

## R side (emln)

- [ ] `mira()`, `geom_*()`, `scale_*()` objects + `+` method that
      accumulates a spec.
- [ ] Validation in R: attribute exists, numeric for continuous, set names
      match `node_type` values.
- [ ] `print()` method serves network + view spec and opens MiRA (reuse
      `plot_multilayer()` server).
- [ ] Tests (testthat) for spec building and validation.
- [ ] `npm run sync:emln` as its own emln commit after MiRA changes land.

---

## Later (ideas, not v1)

Each needs MiRA work first; the R side is cheap once MiRA supports it.

- **Continuous color palettes** (`option = "magma"`). MiRA is Viridis-only.
- **Size range** (`range = c(1, 6)`). MiRA uses a fixed 0.3–2.0× of base size.
- **Legend titles / `labs()`.** MiRA titles are fixed ("Node Color: module").
- **More node shapes** beyond circle and square (triangle, diamond).
- **`aes()` as an alternative mapping syntax.** Its real gain is derived
  variables (`aes(size = log(abundance))`). Could be added later without
  breaking the string API.
- **"Copy as R code"** button in MiRA that generates ggmira code from the
  current view.
- **Headless `mira_save()`** for rendering to file without a browser window
  (needs chromote or similar).
- **Per-set scales**, only if MiRA ever stores scales per set.
- Map mode and meta-network views. v1 covers network mode only.

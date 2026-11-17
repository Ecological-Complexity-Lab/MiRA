# What's new in MiRA

Changes between versions, newest first. To cite a specific version, use its
Zenodo record (all versions: [10.5281/zenodo.22096810](https://doi.org/10.5281/zenodo.22096810)).

## 1.2 — 2026-11-17

### MiRA and R, both ways: ggmira

- **The [ggmira](https://ggmira.ecomplab.com) R package.** Write a MiRA plot in R (layout, node, link and
  layer colors and sizes, filters, camera, view) and it opens in MiRA, fully interactive, in the
  browser or in RStudio's Viewer pane.
- **Copy as R code.** When ggmira opens MiRA, the R button in the toolbar gives the ggmira code for
  the current view, including what was changed with the mouse, ready to paste into a script.
- **Figures from a script.** ggmira's `mira_save()` writes a PNG, JPG or PDF without opening a window.

### Nodes

- Color, size and shape can be shared by all nodes or set separately for each node set of a
  bipartite network.
- Two new node shapes, triangle and diamond. All shapes have the same area, so sizes stay comparable.
- In the meta-network, node shapes follow network mode, with a shape legend.

### Colors

- Named palettes for every color scale, chosen in its legend, with a button to reverse them.
  Categorical: Dark2, Set1, Set2, Set3, Paired, Accent, Okabe-Ito. Continuous: viridis, magma,
  cividis and ColorBrewer gradients. Saved in sessions.

### Figures

- Sharper exports: PNG, JPG and PDF are drawn at the export's resolution (PDFs used to be
  stretched), with crisp links, node outlines and layer borders.
- PNG with a transparent background.
- Legends are exported without their palette and reverse controls.

### Views and filters

- Grid view applies the Data Mode filter, as network and map modes do.
- Layer view shows only the layers kept by the layer filter, and shares network mode's layer colors.
- Layers removed by the filter no longer leave a gap in the stack.
- Map mode and the geographic layer view fit the layers clear of the panels; markers of filtered-out
  layers are hidden.
- The meta-network's force layout stays centered and fits the window.
- A notice warns when the window is smaller than 1024 × 600 pixels, where panels may be cut off.

### Fixes

- Intralayer links with large weights (for example percentages) are scaled to a readable width.
- The filter and selected-node banners sit under the toolbar, clear of the buttons.
- A restored session keeps its layout, and the meta-network's color legend.
- Clicking a legend no longer moves it.

### Website and documentation

- New About page: MiRA at a glance, the seven modes, *From R to MiRA and back*, a comparison with
  other tools, and a FAQ.
- The welcome screen offers *MiRA at a glance*, the manual and the example data.
- Manual: *Plot from R with ggmira*; the emln section covers exporting to JSON and CSV.
- A ggmira button in the top bar.
- Citation: Zenodo DOI and `CITATION.cff` (GitHub's *Cite this repository*).

## 1.1 — 2026-06-29

First public release. Archived on Zenodo on 2026-08-25.

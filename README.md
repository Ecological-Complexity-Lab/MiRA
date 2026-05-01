# MiRA — Multilayer Interactive Rendering Application

[![Project Status: Active](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![Lifecycle: beta](https://img.shields.io/badge/lifecycle-beta-orange.svg)](https://lifecycle.r-lib.org/articles/stages.html)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![R package: emln](https://img.shields.io/badge/R%20package-emln-blue.svg)](https://github.com/Ecological-Complexity-Lab/emln)
[![Paper coming soon](https://img.shields.io/badge/paper-coming%20soon-yellow.svg)](#)

An interactive, browser-based visualization tool for multilayer networks spanning ecology, neuroscience, genomics, epidemiology, and more. Fully integrated into the [`emln`](https://github.com/Ecological-Complexity-Lab/emln) R package via `plot_multilayer()`, and available as a standalone web app.

> **Beta notice:** MiRA is currently in beta. A dedicated paper is forthcoming. Feedback and bug reports are welcome at [GitHub Issues](https://github.com/Ecological-Complexity-Lab/MiRA/issues).

## ✨ Features

- **Network Mode** — 3D stacked-layer canvas with rotate, pan, drag, hover, and selection.
- **Map Mode** — layers placed on an interactive Leaflet world map using geographic coordinates.
- **Layer View** — meta-graph where each layer is a force-directed bubble with micro-graph previews and side-by-side comparison panels.
- **Meta-Network Mode** — aggregated single-layer view of cross-layer connectivity.
- **Dashboard Mode** — analytics panels: KPI cards, per-layer charts, presence matrix, Jaccard similarity heatmaps, degree distributions, link weight distributions, node participation, and bipartite set-size ratios.
- **Data Mode** — tabular inspection and subsetting of nodes, links, and layer attributes.

## 🚀 Getting Started

### 🌐 Online
Use the live version at [https://mira.ecomplab.com/](https://mira.ecomplab.com/).

### 💻 Locally
The app uses ES Modules and must be served over HTTP — it cannot be opened via `file://`.

```bash
git clone https://github.com/Ecological-Complexity-Lab/MiRA.git
cd MiRA
python3 -m http.server 8000
# Open http://localhost:8000
```

## 🗂️ Built-in Example Datasets

Nine empirical multilayer networks are bundled for immediate exploration, covering pollination, host–parasite interactions, seed dispersal, gene recombination, human disease, brain connectivity, plasmid sharing, and protein–protein interactions. See the full list and references in the [manual](https://mira.ecomplab.com/docs/manual.html).

## 📥 Import Your Own Multilayer Network

- **JSON** — native format; see the [manual](https://mira.ecomplab.com/docs/manual.html) for the schema.
- **CSV** — extended edge list + optional layer and node attribute files, matching the output of `emln::create_multilayer_network()`.

## 📖 Documentation

Full feature reference, data format guide, and controls reference: **[mira.ecomplab.com/docs/manual.html](https://mira.ecomplab.com/docs/manual.html)** (also accessible via the **?** button inside the app).

## 🔗 Integration with the R Package `emln`

MiRA is bundled inside the [`emln`](https://github.com/Ecological-Complexity-Lab/emln) R package. Launch directly from R with:

```r
plot_multilayer(net, bipartite = TRUE, directed = FALSE)
```

Or export to JSON/CSV for manual loading:

```r
multilayer_to_json(net, file = "my_network.json", bipartite = TRUE)
multilayer_to_csv(net, path = "my_network/")
```

## 📄 License

MiRA is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/).

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

You are free to share and adapt this work for **non-commercial purposes**, provided you give appropriate credit and distribute any derivative works under the same license.

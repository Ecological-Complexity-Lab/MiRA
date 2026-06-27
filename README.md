# MiRA — Multilayer Interactive Rendering Application

> ## 🚧 You are on the `development` branch
>
> This is **not** the public-facing branch. For the clean, user-facing version of MiRA, switch to [**`main`**](https://github.com/Ecological-Complexity-Lab/MiRA/tree/main).
>
> **How it's used.**
> - `main` is **protected**: all user-facing app changes land there via pull request (CI must pass `vitest` + `guard`). See [docs/branching-strategy.md](docs/branching-strategy.md) for the full rationale and file-tier breakdown.

[![Project Status: Active](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![Lifecycle: stable](https://img.shields.io/badge/lifecycle-stable-brightgreen.svg)](https://lifecycle.r-lib.org/articles/stages.html)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![R package: emln](https://img.shields.io/badge/R%20package-emln-blue.svg)](https://github.com/Ecological-Complexity-Lab/emln)
[![arXiv](https://img.shields.io/badge/arXiv-2605.09597-b31b1b.svg)](https://doi.org/10.48550/arXiv.2605.09597)

An interactive, browser-based visualization tool for multilayer networks. While developed with biology in mind, MiRA can render any multilayer network. Available as a standalone web app and also fully integrated into the [`emln`](https://github.com/Ecological-Complexity-Lab/emln) R package.


## 📄 Documentation and help

Full feature reference, data format guide, and controls reference: **[mira.ecomplab.com/docs/manual.html](https://mira.ecomplab.com/docs/manual.html)** (also accessible via the **?** button inside the app).

## 🚀 Loading MiRA

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

### 📦 Dependencies

MiRA has no build step; the runtime libraries are loaded directly in [`index.html`](index.html) from CDNs at **pinned, exact versions** for reproducibility:

| Library | Version | Purpose |
|---|---|---|
| [PapaParse](https://www.papaparse.com/) | 5.5.2 | CSV parsing |
| [D3](https://d3js.org/) | 7.9.0 | Force layout & number formatting |
| [Konva](https://konvajs.org/) | 9.3.22 | Canvas hit-testing overlay |
| [chroma.js](https://gka.github.io/chroma.js/) | 2.4.2 | Color scales & palettes |
| [Leaflet](https://leafletjs.com/) | 1.9.4 | Map Mode base layers |

The development and test toolchain (Vitest, Playwright, jsdom, and helper libraries) is declared in [`package.json`](package.json) and locked to exact resolved versions in the committed [`package-lock.json`](package-lock.json), so `npm ci` reproduces the test environment exactly.

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

## App development process
We developed the MiRA codebase using an AI-assisted workflow. Initial scaffolding and iterative feature implementation were carried out using Claude Code (Anthropic), an agentic AI programming tool, with Claude Sonnet~4.6 used for a few routine implementation tasks but with the bulk use of Claude Opus~4.7 and 4.8 used for complex architectural decisions and refactoring. Human oversight was applied throughout: all AI-generated code was reviewed, debugged, and revised. We paid particular attention to calculation of properties, domain-specific logic, including bipartite layout computation, geographic placement of layers, multilayer data structure validation, and EMLN integration. The codebase was audited periodically to identify inconsistencies between behavior and documentation, to enforce modularity via refactoring, and to remove redundancy introduced during iterative development.

## Feedback and issues

Feedback and bug reports are welcome at [GitHub Issues](https://github.com/Ecological-Complexity-Lab/MiRA/issues).

## 📄 License

MiRA is licensed under the [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-nc-sa/4.0/).

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

You are free to share and adapt this work for **non-commercial purposes**, provided you give appropriate credit and distribute any derivative works under the same license.

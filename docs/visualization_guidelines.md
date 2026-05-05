# MiRA Visualization Guidelines

Multilayer networks are inherently complex. Unlike monolayer networks, which can be visualized in 2D, the 3D representation of multilayer networks adds visual depth and structure, but also visual complexity. The more layers and interlayer links present, the more entangled the visualization becomes. **MiRA is designed to help you navigate this complexity**: you can set thresholds on visualized links, apply different layouts, use summary visualizations such as *Layer View* and *Meta-Network* modes, and filter layers, nodes, and links in Data Mode. These tools let you transform large networks into visually manageable ones. As a practical side effect, reducing what is drawn also speeds up interaction — visualizations heavily loaded with links are slower to drag and navigate.

**This document provides guidance on how to get the most out of MiRA, whether your network is small or large.**

---

## 1. Screen and display recommendations

MiRA runs in any modern browser and works on a laptop, but **the best experience comes with a large display**. The 3D canvas benefits directly from available screen real estate: more layers, nodes, and links are visible simultaneously without zooming, and the spatial relationships between layer planes are far easier to read on a wider canvas.

- A large external monitor (24″ or larger) is ideal for exploring complex multilayer networks.
- On a laptop, maximizing the browser window gives you the most canvas area available.
- **HiDPI / Retina displays** are high-resolution but render at twice the physical pixel count, which can roughly halve canvas performance compared to a 1080p display of the same size. If you are on a Retina display and experiencing slow interaction, see section 5 (*Local machine and browser effects*) for mitigation steps.

---

## 2. Managing visual complexity

### Tame the links first

Links are the dominant source of both visual clutter and rendering slowness. Interlayer links are hidden by default, and deliberately so: they cross between layer planes and can quickly obscure the intralayer structure if enabled globally. When you are ready to explore cross-layer connections, reveal them gradually — one pair of layers at a time — using the **layer-pair filter** in the Interlayer Links panel, rather than enabling all pairs at once. Also, you can use **Dashboard Mode** to inspect the link weight distribution for your dataset. Knowing whether weights span a narrow or wide range tells you whether thresholding will meaningfully reduce what is drawn on screen, and how to threshold.

With that in mind:

- Raise the **Min Weight** threshold (Intralayer Links panel) to show only the strongest interactions.
- Keep **interlayer links hidden** until you are specifically studying cross-layer connections.
- Use the **interlayer layer-pair filter** to reveal connections between specific layer pairs, one at a time.

### Use layer count as a guide for mode selection

Layer count matters more than node count for visual readability. A network with 20 layers becomes very difficult to interpret in Network Mode regardless of node count, because the 3D planes stack and occlude each other. If you have many layers:

- Use **Layer Mode** to see inter-layer relationships as a meta-graph of bubbles.
- Use **Dashboard Mode** to compare layers quantitatively without the 3D layout.
- Use **Data Mode** to filter to a subset of layers before switching to Network Mode.

### Subset the data for more comfortable exploration

Use **Data Mode** to filter the network to the layers, nodes, or links relevant to your question before switching to Network Mode. A focused subset is almost always more readable than the full network — and faster to interact with. You can always clear the filter and return to the full dataset.

### Focus on individual nodes

One of MiRA's most powerful exploration tools is the ability to click on any node (or searching by name in the search bar), highlights all of that node's connections simultaneously, both within its layer and across all other layers. You can also choose that node in the **Meta-Network** vire and this selection will carry on to the **Network mode**. If you are interested in the behavious of single nodes, this is an ideal way to trace connections.

### Use permanent labels when necessary

Node labels are visually cluttering. Enable them on hover (not permanently) for exploratory work, and reserve permanent labels for small, publication-ready networks.

---

## 3. Match the visualization mode to the visualization goal

MiRA offers seven modes. Using the right one for your question can give you different perspectives of your network.

| Question | Recommended mode |
|---|---|
| Full multilayer structure, specific node connections | **Network Mode** (default) |
| Geographic distribution of layers | **Map Mode** |
| How similar or connected are my layers? | **Layer Mode** |
| Full interaction graph, ignoring layer identity | **Meta-Network Mode** |
| Summary statistics, degree distributions, similarity matrices | **Dashboard Mode** |
| Inspect, filter, or subset the raw data | **Data Mode** |
| Compare all layers side by side (small multiples) | **Grid View** |

The Network Mode 3D canvas is best for getting an overall view of the multilayer structure. It is not always the best tool for exploring a specific aspect of the network, and for large networks it is the most demanding mode computationally.

---

## 4. Workflow for large networks

For large or complex datasets, the following workflow is recommended:

1. **Load the full dataset** — MiRA can parse large files; loading is a one-time cost.
2. **Start in Dashboard Mode** — get an immediate quantitative overview (node counts, link distributions, layer similarity) without rendering the 3D canvas.
3. **Use Layer Mode** to understand inter-layer relationships before zooming in.
4. **Subset in Data Mode** — filter to the layers or nodes of interest.
5. **Switch to Network Mode** with the filtered subset — and raise the weight threshold as needed.
6. **Use Meta-Network Mode** to see the aggregated interaction topology across your selected layers.

### Quick reference — if the network feels slow

When a network feels slow to drag or rotate, try these in order:

1. **Raise the Intralayer Min Weight** threshold — the single most impactful control.
2. **Hide interlayer links** if they are currently shown.
3. **Disable permanent node labels** — switch to hover-only.
4. **Filter layers** using Data Mode to reduce the number of planes rendered.
5. **Switch to Layer Mode or Meta-Network Mode** — both use simpler rendering pipelines than the 3D canvas.

---

## 5. Local machine and browser effects

MiRA renders using the browser's Canvas 2D API. Unlike many modern web applications, Canvas 2D rendering runs on the **CPU**, not the GPU — there is no hardware shader acceleration for the drawing operations. This means rendering performance is directly tied to your machine's processor speed.

### What affects performance

| Factor | Effect |
|---|---|
| **CPU speed** | Primary driver of drag smoothness and frame rate |
| **HiDPI / Retina display** | Doubles the pixel count rendered; can roughly halve canvas performance compared to a 1080p display |
| **Browser** | Chrome and Edge have meaningfully faster Canvas 2D performance than Firefox and Safari |
| **RAM** | Affects loading and parsing of large datasets; less relevant during interactive rendering |
| **Number of visible elements** | Scales linearly — every additional link, node, or layer polygon adds to the per-frame cost |

### Practical implications

- If you are on a Retina or HiDPI display and experiencing slow interaction, raising link thresholds will have a larger-than-expected benefit — you are rendering twice as many pixels per element.
- **Chrome is the recommended browser** for large or complex networks.

---

## 6. Stress test

MiRA was stress-tested with a synthetic temporal network designed to push rendering limits:

| | |
|---|---|
| Layers | 8 (T1–T8) |
| Physical nodes | 100 |
| State nodes | 800 |
| Intralayer links | 8,000 (1,000 per layer, Poisson weights mean≈2, range 1–10) |
| Interlayer links | 7,000 (1,000 per consecutive layer pair; each node fans to 10 random nodes in the next layer, same weight distribution) |
| **Total links** | **15,000** |

**Test machine:** MacBook Pro M1, 32 GB RAM, Google Chrome.

**Result:** The network loaded and rendered without issues. Navigation (drag, zoom, rotate) was smooth even with all 15,000 links shown at once. Dashboard Mode, Layer Mode, and Meta-Network Mode all performed well regardless of the number of visible links, as they use simpler rendering pipelines than the 3D Network Mode canvas.

This network is available as a reproducible example in `data/process/stress-test.json`.
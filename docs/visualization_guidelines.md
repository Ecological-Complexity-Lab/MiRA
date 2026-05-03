# MiRA Visualization Guidelines

Multilayer networks are inherently complex. Unlike monolayer networks, which can be visualized in a flat 2D plane, the three-dimensional representation of multilayer networks adds visual depth and structure — but also visual complexity. This document provides guidance on how to get the most out of MiRA, whether your network is small or large.

---

## 1. Start with a question, not a dataset

The most effective visualization workflow begins with a specific question, not with loading the full network and exploring from there. Before opening MiRA, ask:

- Which nodes are most connected across layers?
- How similar are my layers to each other?
- Are there species (or nodes) that only appear in certain layers?
- How does interaction structure change over time?

Your question determines which mode to use, which attributes to color by, and how much of the network you actually need to display at once.

---

## 2. Match the visualization mode to the question

MiRA offers six modes. Using the right one for your question is the single most impactful choice you can make.

| Question | Recommended mode |
|---|---|
| Full multilayer structure, specific node connections | **Network Mode** (default) |
| Geographic distribution of layers | **Map Mode** |
| How similar or connected are my layers? | **Layer Mode** |
| Full interaction graph, ignoring layer identity | **Meta-Network Mode** |
| Summary statistics, degree distributions, similarity matrices | **Dashboard Mode** |
| Inspect, filter, or subset the raw data | **Data Mode** |

The Network Mode 3D canvas is best for getting an overall gestalt of the multilayer structure. It is not always the best tool for answering a specific analytical question — and for large networks it is the most demanding mode computationally.

---

## 3. Recommended network sizes for comfortable visualization

MiRA can load networks of any size, but rendering and interaction quality depend on how many elements must be drawn and processed simultaneously. The table below reflects performance on a **modern laptop (post-2020)**. On older hardware, apply thresholds earlier (see Section 6).

| Dimension | Comfortable | Use with care | Consider switching mode |
|---|---|---|---|
| Intralayer links shown simultaneously | < 2,000 | 2,000 – 5,000 | > 5,000 |
| Number of layers | ≤ 8 | 8 – 15 | > 15 |
| State nodes (layers × avg. nodes per layer) | < 1,000 | 1,000 – 3,000 | > 3,000 |

"Consider switching mode" means: use weight thresholds to reduce visible links, or switch to **Layer Mode**, **Meta-Network Mode**, or **Dashboard Mode** instead of navigating the 3D canvas directly.

### What counts as "shown simultaneously"

These limits refer to elements *visible on screen at once*, not the total size of the dataset. A network with 35,000 links can be visualized comfortably if the intralayer weight threshold is raised to show only the strongest 500 connections. MiRA's threshold sliders, layer filters, and Data Mode subsetting all reduce the number of elements rendered — use them proactively.

---

## 4. Managing visual complexity

### Tame the links first

Links are the dominant source of both visual clutter and rendering slowness. Before adjusting anything else:

- Raise the **Min Weight** threshold (Intralayer Links panel) to show only the strongest interactions.
- Keep **interlayer links hidden** unless cross-layer connections are specifically what you are studying — they are off by default for good reason.
- For temporal or spatial networks, use the **interlayer layer-pair filter** to show connections between specific pairs of layers rather than all at once.

### Use layer count as a guide for mode selection

Layer count matters more than node count for visual readability. A network with 20 layers becomes very difficult to interpret in Network Mode regardless of node count, because the 3D planes stack and occlude each other. If you have many layers:

- Use **Layer Mode** to see inter-layer relationships as a meta-graph of bubbles.
- Use **Dashboard Mode** to compare layers quantitatively without the 3D layout.
- Use **Data Mode** to filter to a subset of layers before switching to Network Mode.

### Subset before you explore

Use **Data Mode** to filter the network to the layers, nodes, or links relevant to your question before switching to Network Mode. A focused subset is almost always more readable than the full network — and faster to interact with. You can always clear the filter and return to the full dataset.

### Color one thing at a time

Choose one attribute to encode as node color, and optionally one for link color. Encoding both simultaneously makes it harder to extract either signal. If you need to compare multiple attributes, use **Dashboard Mode**, which displays each attribute in its own chart.

### Use permanent labels sparingly

Node labels are expensive to render, especially in large networks. Enable them on hover (not permanently) for exploratory work, and reserve permanent labels for small, publication-ready networks.

---

## 5. Workflow for large networks

For datasets that exceed the comfortable thresholds above, the following workflow is recommended:

1. **Load the full dataset** — MiRA can parse large files; loading is a one-time cost.
2. **Start in Dashboard Mode** — get an immediate quantitative overview (node counts, link distributions, layer similarity) without rendering the 3D canvas.
3. **Use Layer Mode** to understand inter-layer relationships before zooming in.
4. **Subset in Data Mode** — filter to the layers or nodes of interest.
5. **Switch to Network Mode** with the filtered subset — and raise the weight threshold as needed.
6. **Use Meta-Network Mode** to see the aggregated interaction topology across your selected layers.

---

## 6. Local machine and browser effects

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

- The same network that drags smoothly on a 2024 MacBook Pro may feel sluggish on a 5-year-old laptop. The thresholds in Section 3 assume modern hardware; reduce them by roughly half for older machines.
- If you are on a Retina or HiDPI display and experiencing slow interaction, raising link thresholds will have a larger-than-expected benefit — you are rendering twice as many pixels per element.
- **Chrome is the recommended browser** for large or complex networks.
- Enabling **Transform Nodes** (which applies a perspective skew to node circles) adds a canvas transformation per node per frame. Disable it for large networks.

---

## 7. Stress test

To validate the guidelines above, MiRA was stress-tested with a synthetic temporal network designed to push rendering limits:

| | |
|---|---|
| Layers | 8 (T1–T8) |
| Physical nodes | 100 |
| State nodes | 800 |
| Intralayer links | 8,000 (1,000 per layer, Poisson weights mean≈2, range 1–10) |
| Interlayer links | 7,000 (1,000 per consecutive layer pair; each node fans to 10 random nodes in the next layer, same weight distribution) |
| **Total links** | **15,000** |

**Test machine:** MacBook Pro M1, 32 GB RAM, Google Chrome.

**Result:** The network loaded and rendered without issues. Navigation (drag, zoom, rotate) was smooth with the intralayer weight threshold raised to reduce the number of simultaneously visible links. With all 15,000 links shown at once, interaction was noticeably slower but remained functional. Dashboard Mode, Layer Mode, and Meta-Network Mode all performed well regardless of the number of visible links, as they use simpler rendering pipelines than the 3D Network Mode canvas.

This network is available as a reproducible example in `data/process/stress-test.json`.

---

## 8. Quick reference — controls that most improve performance

When a network feels slow to drag or rotate, try these in order:

1. **Raise the Intralayer Min Weight** threshold — the single most impactful control.
2. **Hide interlayer links** if they are currently shown.
3. **Disable Transform Nodes** (Nodes panel in the sidebar).
4. **Disable permanent node labels** — switch to hover-only.
5. **Filter layers** using Data Mode to reduce the number of planes rendered.
6. **Switch to Layer Mode or Meta-Network Mode** — both use simpler rendering pipelines than the 3D canvas.

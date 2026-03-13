# Multilayer Network Visualizer: Documentation

This document explains the interactive controls, visualization modes, and settings available in the Multilayer Network Visualizer.

---

## 🌎 Visualization Modes

The application supports three visualization modes. The active mode is controlled by the buttons in the bottom-left corner. **The left-side control panel changes completely depending on which mode is active** — Network Mode shows the Data / Layers / Nodes / Links accordions, while Layer View replaces them with dedicated Layer View controls. Map Mode reuses the Network Mode panel and adds a map-specific opacity slider.

### 🕸️ Network Mode (Default)
In Network Mode, all layers are rendered simultaneously within a continuous 3D coordinate space.
* **Rotate the 3D Space**: Drag anywhere on the background.
* **Pan**: Hold `Shift` + Drag.
* **Drag Layers**: Hold `Cmd` (Mac) or `Ctrl` (Windows) + Drag on a layer outline to physically reposition the plane within the 3D space.

The left panel shows four collapsible sections: **Data**, **Layers**, **Nodes**, and **Links** (described in detail below).

### 🗺️ Map Mode
Map Mode bridges geographic analysis with ecological network structure by hiding the 3D planes and replacing them with an interactive Leaflet world map. Only available for datasets that include `latitude` and `longitude` metadata on their layers.

* **Layer Markers**: Layers with coordinates appear as interactive blue circle markers on the geographic map.
* **Pop-Out Layers**: Clicking a blue marker physically "pops out" that isolated network layer from the map into floating 3D space. You can pop out multiple layers simultaneously to compare them side-by-side.
* **Dynamic Close Buttons**: When a layer is popped out, a red `✕` sticks to its corner. Clicking the `✕` returns the layer to the map.
* **Map Opacity Slider**: A dedicated slider appears allowing you to fade out the satellite map. Unchecking "Show Map" removes the satellite imagery entirely, presenting your floating ecological layers against a clean white canvas while retaining their exact geographic spacing.
* **Map Navigation**: You can pan and scale the Leaflet map freely. When layers are popped out into 3D space, holding `Shift` + Drag pans the geographic map, smoothly carrying your 3D layers along with it.

The left panel is the same as Network Mode, with a **Map** section added at the top for opacity and visibility controls.

### 🔵 Layer View (Meta-Graph Mode)
Layer View is a novel visualization mode that abstracts away individual nodes and renders the **layers themselves** as the primary objects. Each layer becomes an interactive bubble in a force-directed meta-graph, giving an at-a-glance overview of the entire multilayer structure.

**When Layer View is active, the left panel is replaced entirely** by two Layer View-specific sections: **Layers** (bubble size, color, labels, spacing) and **Edges** (meta-edge display options). The standard Data / Nodes / Links sections are hidden and restored when you exit Layer View.

**How it works:**
* Each layer is represented as a circular bubble. Inside each bubble, a **micro-graph preview** shows the internal topology of that layer (node positions and edge connections at reduced opacity). The bubble is automatically sized to fit snugly around its content — a flat bipartite network produces a compact oval-ish bubble; a dense circular network fills a rounder, larger bubble.
* **Meta-edges** between bubbles encode two types of relationships:
  * **Blue solid lines** — interlayer links (coupling edges that cross layers). Line thickness reflects the number of such links.
  * **Gray lines** — shared physical nodes (nodes that appear in both layers). Line thickness reflects the fraction of shared nodes.
* Bubbles are arranged by a **force-directed layout** (Fruchterman-Reingold). Connected layers attract; all layers repel. Isolated layers (no interlayer links, no shared nodes) are initialized near the cluster and kept close by a stronger gravity pull.

**Interacting with bubbles:**
* **Drag** a bubble to reposition it. It stays pinned where you release it. Click **Reset** (bottom-left) to unpin all bubbles and re-run the force layout from scratch.
* **Click** a bubble to select it — the selected bubble stays bright and all others fade. A **Layer Stats panel** slides in from the right with:
  * *Identity*: layer name, interaction type, directed/undirected.
  * *Size*: node count (with type breakdown for bipartite layers), edge count.
  * *Connectivity*: density, average degree, max degree node, degree histogram (two histograms for bipartite layers, one per node type).
  * *Cross-layer connectivity*: total interlayer links in/out, number of layers sharing ≥1 node with this layer, number of distinct nodes that also appear in other layers.
* **Cmd+click** (Mac) / **Ctrl+click** (Windows) a second bubble while one is already selected to open a **Layer Comparison panel**, showing both layers side-by-side:
  * *Size*: nodes and edges for A vs. B.
  * *Overlap*: shared nodes (count and %), Jaccard index, shared edges.
  * *Divergence*: density ratio, size ratio, overlaid degree-distribution histogram.
  * *Cross-layer links*: interlayer link count between the two layers specifically.
* **Click empty space** to deselect and clear the stats panel.
* **Zoom / Pan**: Scroll to zoom (centered on cursor); drag the background to pan.

**Layer View sidebar controls:**

*Layers section:*
* **Size by** — controls what drives bubble radius: Number of nodes, Number of edges, Edge density, or Uniform.
* **Color by** — color bubbles by: Layer (categorical palette), Node count (sequential YlOrRd scale), Edge density (sequential YlOrRd scale), or Uniform color.
* **Size multiplier** — global scale slider (0.5× – 2.0×) applied on top of the size-by mapping.
* **Show layer name labels** — toggle text labels below each bubble.
* **Label font size** — slider for the label size.
* **Bubble spacing** — controls the equilibrium distance between bubbles in the force layout.

*Edges section:*
* **Show edges** — toggle all meta-edges.
* **Edge metric** — choose which relationship to draw: Interlayer links, Shared nodes, or Both.
* **Min edge weight** — hide edges below this threshold.
* **Show edge weight labels** — toggle numeric weight labels on edges.

---

## 🎛️ Control Panels (Top Left) — Network Mode

The side menu is broken into four collapsible accordions. These panels are only visible in **Network Mode** and **Map Mode**; they are replaced by Layer View controls when Layer View is active.

### 1. Data
Always visible regardless of mode. Contains:
* **Load Example Data**: Opens a dialog with built-in datasets to explore the visualizer's capabilities:
  * *Directed* — small directed network.
  * *Large Scale* — high-node-count stress test.
  * *Simple Bipartite* — minimal bipartite example.
  * *Complex Bipartite (Bartomeus)* — real pollination network.
  * *Pond Ecosystem* — multi-trophic food-web network.
  * *Synthetic Bipartite (10 layers)* — generated undirected pollinator-plant network with 10 layers, structured clusters, and one isolated layer. Designed to showcase Layer View on a bipartite multilayer network.
  * *Synthetic Unipartite (10 layers)* — generated directed social/influence network with 10 layers, overlapping actor groups, a bridging layer, and one isolated layer. Designed to showcase Layer View on a directed unipartite multilayer network.
* **Load User Data (JSON)**: Upload a local JSON dataset. See `README.md` for the required data format.

### 2. Layers *(Network / Map Mode only)*
* **Layer Names**: Toggles floating title tags above each layer plane.
* **Stacking Mode**:
  * `Horizontal` (Default): Layers recede backward into the depth (Z-axis). Best for multiplex networks.
  * `Vertical`: Layers drop sequentially from top to bottom (Y-axis). Identical to classic textbook multilayer topologies.
* **Layer Spacing**: Adjusts the simulated physical distance between layer planes.
* **Layout Algorithm**: Instantly recalculate the 2D layout topology of the nodes.
  * *Fruchterman-Reingold / Kamada-Kawai*: Force-directed algorithms drawing connected communities closer.
  * *Bipartite (two-row)*: Only visible if the network contains bipartite node sets. Splits groups horizontally. Can be nested using the "Nested Sorting" toggle.
  * *Circle / Grid / Random*: Simple geometric distributions.

### 3. Nodes *(Network / Map Mode only)*
* **Node Labels**: Displays the name of the individual nodes on hover or permanently.
* **Transform Nodes**: A visual toggle that shapes the 2D nodes to match the skewed isometric perspective of their parent 3D layer (makes circles look like ovals matching the plane). *Turn off for complex networks to greatly improve rendering performance.*
* **Color By**: Assign node colors based on their Layer, their modular Group, or uniform styling. If viewing a bipartite layout, controls dynamically appear to let you color "Set A" and "Set B" independently.
* **Size By**: Set node size uniformly via the **Base Size** slider, or scale nodes relative to their calculated Node Degree (number of connections).

### 4. Links *(Network / Map Mode only)*
* **Show Interlayer Links**: Toggles all cross-layer edges. Disabling this clarifies viewing individual strata.
* **Color By**: Color connections uniquely based on their type (Inter vs Intra) or let them inherit the colors of their originating layers.

---

## 📊 Dynamic Legend

A legend panel appears in the **bottom-right corner** of the screen whenever color or size mappings are active. It updates automatically as you change settings or switch datasets.

* **Appears automatically** when a color-by or size-by mapping is in effect (in both Network Mode and Layer View). It is hidden when no legend is relevant (e.g., uniform color with no size mapping).
* **Draggable**: Click and drag the legend's title bar to reposition it anywhere on screen — useful when it overlaps content you want to inspect.
* **Collapsible**: Click the **−** button to collapse the legend to a small tab; click the tab (or **+**) to expand it again. You can drag the collapsed tab to reposition it.
* **Closeable**: Click **✕** to dismiss the legend entirely. It will reappear if you load a new dataset or change a relevant setting.
* **Interactive toggle** (Layer View color scale): When coloring by Node count or Edge density in Layer View, a small toggle button on the legend switches between a **continuous** gradient bar and a **categorical** list showing each layer's exact value.

---

## 📸 Bottom-Left Utilities

* **Snapshot (Camera)**: Captures a high-resolution export of the current canvas. Choose between PNG, JPG, or PDF formats, and whether to include the backdrop grid.
* **Zoom (+ / − / Reset)**: Adjusts the viewport scale. In Layer View, **Reset** re-runs the full force layout from scratch (unpins all bubbles) and re-fits the viewport.
* **Layer View button**: Toggles Layer View (Meta-Graph Mode). The icon shows three connected circles.
* **Map Mode button**: Toggles geographic Map Mode (only shown when the dataset has coordinates).
* **Interaction Hints**: A quick-reference cheatsheet for mouse bindings.

---

## 🖱️ Advanced Interactions (Network Mode)
* **Node/Link Hover**: Pointing at any node or edge highlights its nearest connections and dims the rest of the network. A small tooltip appears with exact node data.
* **Selection Focus**: Clicking a node isolates and locks its web of connections, enabling you to clearly track where its influence spreads across the multilayer topology. Clicking the background clears the selection.

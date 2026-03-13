# Multilayer Network Visualizer: Documentation

This document explains the interactive controls, visualization modes, and settings available in the Multilayer Network Visualizer.

---

## 🌎 Vision Modes: Network Mode vs. Map Mode

The application supports two deeply integrated physical paradigms for exploring multilayer networks. If your dataset contains `latitude` and `longitude` metadata for its layers, a **Map Icon** will appear in the bottom-left corner, allowing you to seamlessly toggle between the modes.

### 🕸️ Network Mode (Default)
In Network Mode, all layers are rendered simultaneously within a continuous 3D coordinate space.
* **Rotate the 3D Space**: Drag anywhere on the background.
* **Pan**: Hold `Shift` + Drag.
* **Drag Layers**: Hold `Cmd` (Mac) or `Ctrl` (Windows) + Drag on a layer outline to physically reposition the plane within the 3D space.

### 🗺️ Map Mode
Map Mode bridges geographic analysis with ecological network structure by hiding the 3D planes and replacing them with an interactive Leaflet world map. 
* **Layer Markers**: Layers with coordinates appear as interactive blue circle markers on the geographic map.
* **Pop-Out Layers**: Clicking a blue marker physically "pops out" that isolated network layer from the map into floating 3D space. You can pop out multiple layers simultaneously to compare them side-by-side.
* **Dynamic Close Buttons**: When a layer is popped out, a red `✕` sticks to its corner. Clicking the `✕` returns the layer to the map.
* **Map Opacity Slider**: A dedicated slider appears allowing you to fade out the satellite map. Unchecking "Show Map" removes the satellite imagery entirely, presenting your floating ecological layers against a clean white canvas while retaining their exact geographic spacing.
* **Map Navigation**: You can pan and scale the Leaflet map freely. When layers are popped out into 3D space, holding `Shift` + Drag pans the geographic map, smoothly carrying your 3D layers along with it.

---

## 🎛️ Control Panels (Top Left)

The side menu is broken into four collapsible accordions: **Data**, **Layers**, **Nodes**, and **Links**.

### 1. Data
* **Load Example Data**: Opens a dialog letting you instantly inject 4 built-in demo datasets (Directed, Large Scale, Simple Bipartite, Complex Bipartite) to explore the visualizer's capabilities.
* **Load User Data (JSON)**: Allows you to manually upload a local JSON dataset. Refer to the `README.md` for the correct JSON data structure.

### 2. Layers
* **Layer Names**: Toggles floating title tags above each layer plane.
* **Stacking Mode**: 
  * `Horizontal` (Default): Layers recede backward into the depth (Z-axis). Best for multiplex networks.
  * `Vertical`: Layers drop sequentially from top to bottom (Y-axis). Identical to classic textbook multilayer topologies.
* **Layer Spacing**: Adjusts the simulated physical distance between layer planes.
* **Layout Algorithm**: Instantly recalculate the 2D layout topology of the nodes.
  * *Fruchterman-Reingold / Kamada-Kawai*: Force-directed algorithms drawing connected communities closer.
  * *Bipartite (two-row)*: Only visible if the network contains bipartite node sets. Splits groups horizontally. Can be nested using the "Nested Sorting" toggle.
  * *Circle / Grid / Random*: Simple geometric distributions.

### 3. Nodes
* **Node Labels**: Displays the name of the individual nodes on hover or permanently.
* **Transform Nodes**: A powerful visual toggle that shapes the 2D nodes to match the skewed isometric perspective of their parent 3D layer (makes circles look like ovals matching the plane). *Turn off for complex networks to greatly improve rendering performance.*
* **Color By**: Assign node colors based on their Layer, their modular Group, or uniform styling. If viewing a bipartite layout, controls dynamically appear to let you color "Set A" and "Set B" independently.
* **Size By**: Set node size uniformly via the **Base Size** slider, or scale nodes relative to their calculated Node Degree (number of connections).

### 4. Links
* **Show Interlayer Links**: Toggles all cross-layer edges. Disabling this clarifies viewing individual strata.
* **Color By**: Color connections uniquely based on their type (Inter vs Intra) or let them inherit the colors of their originating layers.

---

## 📸 Bottom Left Utilities

* **Snapshot (Camera)**: Captures a high-resolution export of the current canvas. You can select between PNG, JPG, or PDF formats, and choose whether to include the subtle backdrop grid. 
* **Zoom (+ / - / Reset)**: Adjusts the viewport scale.
* **Interaction Hints**: A quick-reference cheatsheet for mouse bindings (Rotate, Pan, Move, Info).

---

## 🖱️ Advanced Interactions
* **Node/Link Hover**: Pointing at any node or edge highlights its nearest connections and dims the rest of the network. A small tooltip appears with exact node data.
* **Selection Focus**: Clicking a node isolates and locks its web of connections, enabling you to clearly track where its influence spreads across the multilayer topology. Clicking the background clears the selection.
* **Legend Dragging**: The bottom-right dynamic legend can be dragged (clicked and moved via the title bar) anywhere around the screen to unblock your view. If the legend is minimized, click and drag the tab button to reposition it.

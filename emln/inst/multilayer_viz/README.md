# Multilayer Network Visualizer

An interactive, browser-based visualization tool for multilayer ecological networks. While fully integrated into the `emln` R package (using `plot_multilayer()`), this visualization app can also be used as a standalone tool by loading correctly formatted JSON files.

## Visualization Modes

The tool supports four complementary modes, switchable via the bottom-left toolbar:

* **Network Mode** (default) — classic 3D stacked-layer view. Rotate, pan, drag layers, hover nodes for info, and click to select.
* **Map Mode** — geographic layout using an interactive Leaflet map. Layers with `latitude`/`longitude` metadata appear as map markers; clicking a marker pops that layer into 3D space for side-by-side inspection.
* **Layer View** — a novel meta-graph mode where each layer becomes a bubble in a force-directed graph. Micro-graph previews of internal topology appear inside each bubble. Meta-edges show interlayer links (blue, solid) and shared physical nodes (gray). Click a bubble for a statistics panel; Cmd+click two bubbles for a side-by-side comparison with overlapping degree histograms and overlap/divergence metrics.
* **Dashboard Mode** — a statistics panel replacing the network canvas with collapsible analytics sections: KPI cards, per-layer bar charts, Node × Layer presence matrix (with orientation toggle), Layer Similarity Jaccard heatmaps (node and edge identity; bipartite-aware), degree distribution histograms, node participation chart, and a bipartite set-size ratio chart.

See `docs/DOCUMENTATION.md` for the full feature description of all modes.

## Loading Custom Data

Two routes are available for loading your own data via the **Data** panel:

### CSV (emln output)
Use the **"📊 Load User Data (CSV)"** button to load network data directly from CSV files — the native output format of `emln`'s `create_multilayer_network()`. A modal dialog accepts:
* **Extended Edge List** *(required)* — columns `layer_from`, `node_from`, `layer_to`, `node_to`, `weight` (optional). Both intralayer and interlayer links go in this one file.
* **Layer Attributes** *(optional)* — columns `layer_id`, `layer_name`, `latitude`, `longitude`. If omitted, layers are derived automatically from the edge list.
* **Node Attributes** *(optional)* — columns `node_name`, `group` (or `node_type`/`type`). If omitted, nodes are derived automatically.

Comma, tab, and semicolon delimiters are all auto-detected. Directed and bipartite flags can be set via checkboxes before loading.

### JSON
To run your own datasets in the visualizer without using the `emln` package, format your network data as a single `.json` file and use the **"📂 Load User Data (JSON)"** button inside the **Data** panel.

### JSON Structure Specification

The visualizer expects a JSON object containing three primary arrays: `layers`, `nodes`, and `links`. It also accepts network-level booleans. Below is the required structure:

```json
{
  "directed": false,
  "bipartite": true,
  "layers": [
    {
      "layer_id": 1,
      "layer_name": "Forest Canopy",
      "latitude": 42.35, 
      "longitude": 3.17
    }
  ],
  "nodes": [
    {
      "node_id": "sp_1",
      "layer_id": 1,
      "layer_name": "Forest Canopy",
      "node_name": "Apis mellifera",
      "group": "pollinator"
    }
  ],
  "links": [
    {
      "link_id": "1",
      "layer_from": "Forest Canopy",
      "node_from": "Apis mellifera",
      "layer_to": "Forest Canopy",
      "node_to": "Quercus robur",
      "weight": 1.5,
      "type": "intra"
    }
  ]
}
```

#### Global Properties
* `directed` *(Boolean)*: Whether the network edges are directed (renders arrowheads).
* `bipartite` *(Boolean, Optional)*: Whether the network utilizes a bipartite layout (nodes split into two parallel sets).

#### `layers` Array
Defines the individual layers (planes) in the network.
* `layer_id` *(Integer/String)*: Unique identifier.
* `layer_name` *(String)*: Name of the layer.
* `latitude` / `longitude` *(Float, Optional)*: If provided, unlocks the geographic **Map Mode** allowing layers to be represented on an interactive world map.

#### `nodes` Array
Defines every node within the multilayer network. 
* `node_id` *(Integer/String)*: Unique node identifier.
* `layer_id` / `layer_name` *(String)*: The layer to which this node belongs.
* `node_name` *(String)*: The label/name of the node.
* `group` *(String, Optional)*: Used for coloring nodes by group, and is required if using a bipartite layout to distinguish Set A from Set B.

#### `links` Array
Defines the edges connecting nodes. Can be *intralayer* (within the same layer) or *interlayer* (crossing between different layers).
* `link_id` *(Integer/String)*: Unique edge identifier.
* `layer_from` *(String)*: The name of the layer containing the originating node.
* `node_from` *(String)*: The name of the originating node.
* `layer_to` *(String)*: The name of the layer containing the destination node.
* `node_to` *(String)*: The name of the destination node.
* `weight` *(Float, Optional)*: Edge weight (controls the thickness or opacity of the rendered line).
* `type` *(String, Optional)*: Usually "inter" for interlayer connections, or "intra" for intralayer connections. Useful for filtering.

## Example Datasets

The **Load Example Data** dialog includes seven built-in datasets:

| Dataset | Type | Layers | Notes |
|---|---|---|---|
| Directed | Directed unipartite | 3 | Minimal directed example |
| Large Scale | Undirected | 3 | High node count stress test |
| Simple Bipartite | Undirected bipartite | 2 | Minimal bipartite example |
| Complex Bipartite (Bartomeus) | Undirected bipartite | 4 | Real pollination network |
| Pond Ecosystem | Undirected | 4 | Multi-trophic food-web |
| **Synthetic Bipartite** | Undirected bipartite | **10** | Generated pollinator-plant network with clustered layers and one isolated layer |
| **Synthetic Unipartite** | Directed unipartite | **10** | Generated social/influence network with overlapping actor groups, a bridging layer, and one isolated layer |

The two synthetic 10-layer datasets are specifically designed to showcase **Layer View** with interlayer structure, shared nodes, and disconnected components.

## Developing & Modifying

If you are modifying the visualization locally:
1. Clone the repository.
2. Serve the directory using a local web server (e.g., `python3 -m http.server 8000`).
3. Open `http://localhost:8000` in your browser. (The visualizer uses ES Modules and cannot be run simply by double-clicking `index.html` via the `file://` protocol).

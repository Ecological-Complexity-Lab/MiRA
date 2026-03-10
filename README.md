# Multilayer Network Visualizer

An interactive, 3D browser-based visualization tool for multilayer ecological networks. While fully integrated into the `emln` R package (using `plot_multilayer()`), this visualization app can also be used as a standalone tool by loading correctly formatted JSON files.

## Loading Custom Data

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

## Developing & Modifying

If you are modifying the visualization locally:
1. Clone the repository.
2. Serve the directory using a local web server (e.g., `python3 -m http.server 8000`).
3. Open `http://localhost:8000` in your browser. (The visualizer uses ES Modules and cannot be run simply by double-clicking `index.html` via the `file://` protocol).

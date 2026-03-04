/**
 * dataParser.js — Parses EMLN multilayer JSON into an internal model
 *
 * Supports bipartite layers:
 *   - Explicit: layer has "bipartite": true, nodes have "node_type" attribute
 *   - Auto-detect: BFS 2-coloring on intralayer links when not explicit
 */

export function parseMultilayerData(json) {
  // Validate required fields
  const required = ['nodes', 'layers', 'extended', 'state_nodes'];
  for (const field of required) {
    if (!json[field] || !Array.isArray(json[field])) {
      throw new Error(`Missing or invalid required field: "${field}". Expected an array.`);
    }
  }

  // Index nodes by id and name
  const nodesById = new Map();
  const nodesByName = new Map();
  for (const node of json.nodes) {
    nodesById.set(node.node_id, node);
    nodesByName.set(node.node_name, node);
  }

  // Index layers by id and name
  const layersById = new Map();
  const layersByName = new Map();
  for (const layer of json.layers) {
    layersById.set(layer.layer_id, layer);
    layersByName.set(layer.layer_name, layer);
  }

  // Classify links as intralayer vs interlayer
  const intralayerLinks = [];
  const interlayerLinks = [];
  for (const link of json.extended) {
    if (link.layer_from === link.layer_to) {
      intralayerLinks.push(link);
    } else {
      interlayerLinks.push(link);
    }
  }

  // Build state node map: key = "layerName::nodeName"
  const stateNodeMap = new Map();
  for (const sn of json.state_nodes) {
    const key = `${sn.layer_name}::${sn.node_name}`;
    stateNodeMap.set(key, sn);
  }

  // Build node sets per layer
  const nodesPerLayer = new Map(); // layer_name -> Set of node_names
  for (const sn of json.state_nodes) {
    if (!nodesPerLayer.has(sn.layer_name)) {
      nodesPerLayer.set(sn.layer_name, new Set());
    }
    nodesPerLayer.get(sn.layer_name).add(sn.node_name);
  }

  // Extract attribute names for color mapping
  const nodeAttributeNames = extractExtraAttributes(json.nodes, ['node_id', 'node_name']);
  const stateNodeAttributeNames = extractExtraAttributes(json.state_nodes, ['layer_id', 'node_id', 'layer_name', 'node_name']);
  const linkAttributeNames = extractExtraAttributes(json.extended, ['layer_from', 'node_from', 'layer_to', 'node_to', 'weight']);
  const layerAttributeNames = extractExtraAttributes(json.layers, ['layer_id', 'layer_name']);

  // ---- Bipartite detection ----
  const bipartiteInfo = detectBipartiteLayers(
    json.layers, json.nodes, intralayerLinks, nodesPerLayer, nodesByName
  );

  return {
    nodes: json.nodes,
    layers: json.layers,
    extended: json.extended,
    stateNodes: json.state_nodes,
    nodesById,
    nodesByName,
    layersById,
    layersByName,
    intralayerLinks,
    interlayerLinks,
    stateNodeMap,
    nodesPerLayer,
    nodeAttributeNames,
    stateNodeAttributeNames,
    linkAttributeNames,
    layerAttributeNames,
    bipartiteInfo,
  };
}

/**
 * Detect bipartite structure for each layer.
 * Returns Map<layerName, { isBipartite, setA, setB, setALabel, setBLabel, explicit }>
 *
 * Detection methods (in priority order):
 *   1. Explicit: layer.bipartite === true AND nodes have a "node_type" attribute
 *   2. Auto-detect: BFS 2-coloring on intralayer links succeeds
 */
function detectBipartiteLayers(layers, nodes, intralayerLinks, nodesPerLayer, nodesByName) {
  const info = new Map();

  // Check if nodes have a "node_type" or "type" attribute
  const nodeTypeValues = new Map(); // nodeName -> node_type value
  let hasNodeType = false;
  for (const node of nodes) {
    const typeValue = node.node_type !== undefined ? node.node_type : node.type;
    if (typeValue !== undefined && typeValue !== null) {
      nodeTypeValues.set(node.node_name, typeValue);
      hasNodeType = true;
    }
  }

  // Collect distinct type values
  const distinctTypes = hasNodeType ? [...new Set(nodeTypeValues.values())] : [];

  for (const layer of layers) {
    const layerName = layer.layer_name;
    const layerNodes = nodesPerLayer.get(layerName);
    if (!layerNodes || layerNodes.size === 0) {
      info.set(layerName, { isBipartite: false });
      continue;
    }

    const layerEdges = intralayerLinks.filter(l => l.layer_from === layerName);

    // Method 1: Explicit declaration
    if (layer.bipartite === true && hasNodeType && distinctTypes.length === 2) {
      const setA = new Set();
      const setB = new Set();
      const typeA = distinctTypes[0];
      const typeB = distinctTypes[1];

      for (const nodeName of layerNodes) {
        const nt = nodeTypeValues.get(nodeName);
        if (nt === typeA) setA.add(nodeName);
        else setB.add(nodeName);
      }

      info.set(layerName, {
        isBipartite: true,
        explicit: true,
        setA,
        setB,
        setALabel: String(typeA),
        setBLabel: String(typeB),
      });
      continue;
    }

    // Method 2: Auto-detect via BFS 2-coloring
    const result = tryBipartiteColoring(layerNodes, layerEdges);
    if (result) {
      info.set(layerName, {
        isBipartite: true,
        explicit: false,
        setA: result.setA,
        setB: result.setB,
        setALabel: 'Set A',
        setBLabel: 'Set B',
      });
    } else {
      info.set(layerName, { isBipartite: false });
    }
  }

  return info;
}

/**
 * Attempt BFS 2-coloring on a layer's nodes and edges.
 * Returns { setA, setB } if bipartite, or null if not.
 */
function tryBipartiteColoring(nodeSet, edges) {
  const nodeArray = Array.from(nodeSet);
  if (nodeArray.length <= 1) return null; // Trivial — not meaningful bipartite

  // Build adjacency list
  const adj = new Map();
  for (const n of nodeArray) adj.set(n, []);
  for (const e of edges) {
    if (adj.has(e.node_from) && adj.has(e.node_to)) {
      adj.get(e.node_from).push(e.node_to);
      adj.get(e.node_to).push(e.node_from);
    }
  }

  // Check that the graph actually has edges (isolated nodes are not bipartite)
  if (edges.length === 0) return null;

  // BFS 2-coloring
  const color = new Map(); // nodeName -> 0 or 1
  for (const start of nodeArray) {
    if (color.has(start)) continue;
    color.set(start, 0);
    const queue = [start];
    while (queue.length > 0) {
      const node = queue.shift();
      const c = color.get(node);
      for (const neighbor of adj.get(node)) {
        if (!color.has(neighbor)) {
          color.set(neighbor, 1 - c);
          queue.push(neighbor);
        } else if (color.get(neighbor) === c) {
          return null; // Odd cycle → not bipartite
        }
      }
    }
  }

  const setA = new Set();
  const setB = new Set();
  for (const [node, c] of color) {
    if (c === 0) setA.add(node);
    else setB.add(node);
  }

  // Only consider it bipartite if both sets are non-empty
  if (setA.size === 0 || setB.size === 0) return null;

  return { setA, setB };
}

function extractExtraAttributes(arr, excludeKeys) {
  const attrSet = new Set();
  for (const item of arr) {
    for (const key of Object.keys(item)) {
      if (!excludeKeys.includes(key)) {
        attrSet.add(key);
      }
    }
  }
  return Array.from(attrSet);
}

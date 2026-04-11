/**
 * Generator for two 10-layer synthetic multilayer network examples.
 * Run:  node gen_synth.js
 * Outputs: synth_bipartite.json  (undirected bipartite, 10 layers)
 *          synth_unipartite.json (directed unipartite, 10 layers)
 */
'use strict';
const fs = require('fs');

// ── Seeded LCG for reproducibility ─────────────────────────────────────────
let rng = 20250313;
const rand  = () => { rng = Math.imul(rng, 1664525) + 1013904223 | 0; return (rng >>> 0) / 4294967296; };
const rInt  = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick  = arr => arr[Math.floor(rand() * arr.length)];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const pad   = n => String(n).padStart(2, '0');

// ── Generate intralayer edges ───────────────────────────────────────────────
// For bipartite: srcNodes × dstNodes (no same-type edges)
// For unipartite: any node → any other node
function genEdges(srcNodes, dstNodes, targetCount, directed) {
    const seen  = new Set();
    const edges = [];
    let   tries = 0;
    while (edges.length < targetCount && tries < targetCount * 50) {
        tries++;
        const s = pick(srcNodes), d = pick(dstNodes);
        if (s === d) continue;
        const key = directed ? `${s}>${d}` : [s, d].sort().join('<>');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: s, to: d });
    }
    return edges;
}

// ── Helper: choose a random subset ─────────────────────────────────────────
function sample(arr, n) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
}

// ══════════════════════════════════════════════════════════════════════════════
// BIPARTITE — undirected pollinator-plant network
// ══════════════════════════════════════════════════════════════════════════════
function buildBipartite() {
    // Node pools (plants 1-110, pollinators 1-70)
    // Layer compositions — [plantIdxRange, pollIdxRange, density]
    // Index is 1-based into the pool arrays.
    const layerDefs = [
        // id, plants[lo..hi], poll[lo..hi], density
        // Cluster A (L1-L4): share plants 10-22, pollinators 12-18
        { id: 1,  plo:  1, phi: 22, qlo:  1, qhi: 18, dens: 0.10 },
        { id: 2,  plo: 10, phi: 34, qlo: 12, qhi: 27, dens: 0.12 },
        { id: 3,  plo: 25, phi: 50, qlo: 20, qhi: 36, dens: 0.08 },
        { id: 4,  plo: 40, phi: 63, qlo: 28, qhi: 45, dens: 0.15 },
        // Cluster B (L5-L6): share plants 1-16 with Cluster A but different pollinators
        { id: 5,  plo:  1, phi: 16, qlo: 38, qhi: 55, dens: 0.18 },
        { id: 6,  plo: 55, phi: 80, qlo:  1, qhi: 14, dens: 0.07 },
        // Cluster C (L7-L9): share plants 62-85 / pollinators 44-57
        { id: 7,  plo: 62, phi: 85, qlo: 44, qhi: 60, dens: 0.11 },
        { id: 8,  plo: 72, phi: 88, qlo: 50, qhi: 63, dens: 0.16 },
        { id: 9,  plo: 50, phi: 82, qlo: 35, qhi: 58, dens: 0.06 },
        // L10: completely isolated — unique plants & pollinators, no shared nodes
        { id: 10, plo: 90, phi: 112, qlo: 65, qhi: 73, dens: 0.14 },
    ];

    // Interlayer link pairs (layer a ↔ layer b, using shared nodes)
    const ilPairs = [[1,2],[2,3],[3,4],[1,5],[6,7],[7,8],[8,9]];
    // L10 has NO interlayer links

    const nodes = [];
    const nodeSet = new Map(); // name → node obj

    function addNode(name, type) {
        if (!nodeSet.has(name)) {
            const obj = { node_id: nodes.length + 1, node_name: name, type };
            nodes.push(obj); nodeSet.set(name, obj);
        }
        return name;
    }

    const layers = layerDefs.map(d => ({
        layer_id: d.id, layer_name: `layer_${d.id}`,
        interaction_type: 'pollination', directed: false,
    }));

    const extended = [];

    // Track which nodes are in each layer for interlayer link generation
    const layerNodes = new Map(); // layerName → { plants: [], poll: [] }

    for (const d of layerDefs) {
        const layerName = `layer_${d.id}`;
        const plants  = range(d.plo, d.phi).map(i => addNode(`Plant_${pad(i)}`, 'plant'));
        const poll    = range(d.qlo, d.qhi).map(i => addNode(`Pollinator_${pad(i)}`, 'pollinator'));
        layerNodes.set(layerName, { plants, poll });

        const target = Math.round(d.dens * plants.length * poll.length);
        const edges  = genEdges(plants, poll, target, false);
        for (const { from, to } of edges) {
            extended.push({ layer_from: layerName, node_from: from, layer_to: layerName, node_to: to, weight: rInt(1, 5) });
        }
    }

    // Interlayer links — couple shared nodes between designated layer pairs
    for (const [a, b] of ilPairs) {
        const na = layerNodes.get(`layer_${a}`);
        const nb = layerNodes.get(`layer_${b}`);
        const sharedPlants = na.plants.filter(p => nb.plants.includes(p));
        const sharedPoll   = na.poll.filter(q => nb.poll.includes(q));
        const sharedAll    = [...sharedPlants, ...sharedPoll];
        // Take up to ~40% of shared nodes as interlayer coupling links
        const links = sample(sharedAll, Math.max(2, Math.ceil(sharedAll.length * 0.4)));
        for (const node of links) {
            extended.push({
                layer_from: `layer_${a}`, node_from: node,
                layer_to:   `layer_${b}`, node_to:   node,
                weight: rInt(1, 3),
            });
        }
    }

    // Build state_nodes: one entry per (layer, node) occurrence
    const state_nodes = [];
    for (const d of layerDefs) {
        const layerName = `layer_${d.id}`;
        const { plants, poll } = layerNodes.get(layerName);
        for (const nodeName of [...plants, ...poll]) {
            const nodeObj = nodeSet.get(nodeName);
            state_nodes.push({ layer_id: d.id, node_id: nodeObj.node_id, layer_name: layerName, node_name: nodeName });
        }
    }

    return { nodes, layers, state_nodes, extended };
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIPARTITE — directed social / influence network
// ══════════════════════════════════════════════════════════════════════════════
function buildUnipartite() {
    // Node pool: 200 actors
    const layerDefs = [
        // id, node range [lo..hi], density
        // Group A (L1-L3): dense overlap
        { id:  1, lo:  1, hi: 42, dens: 0.08 },
        { id:  2, lo: 15, hi: 54, dens: 0.10 },
        { id:  3, lo: 35, hi: 75, dens: 0.12 },
        // Group B (L4-L5): partial overlap with Group A, overlap each other
        { id:  4, lo: 60, hi: 100, dens: 0.06 },
        { id:  5, lo: 85, hi: 125, dens: 0.09 },
        // Group C (L6-L8): high-density tight cluster
        { id:  6, lo: 115, hi: 148, dens: 0.15 },
        { id:  7, lo: 130, hi: 162, dens: 0.07 },
        { id:  8, lo: 148, hi: 180, dens: 0.20 },
        // L9: bridging layer (mixes nodes from L1 and L8)
        { id:  9, lo: null, hi: null, dens: 0.11,
          nodes: [...range(1,12), ...range(165,190)] },   // manual composition
        // L10: completely isolated
        { id: 10, lo: 195, hi: 235, dens: 0.05 },
    ];

    // Interlayer link pairs
    const ilPairs = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]];
    // L9 and L10 have NO interlayer links

    const nodes = [];
    const nodeSet = new Map();

    function addNode(name) {
        if (!nodeSet.has(name)) {
            const obj = { node_id: nodes.length + 1, node_name: name, type: 'actor' };
            nodes.push(obj); nodeSet.set(name, obj);
        }
        return name;
    }

    const layers = layerDefs.map(d => ({
        layer_id: d.id, layer_name: `layer_${d.id}`,
        interaction_type: 'influence', directed: true,
    }));

    const extended = [];
    const layerNodeMap = new Map();

    for (const d of layerDefs) {
        const layerName = `layer_${d.id}`;
        const nodeIds = d.nodes ? d.nodes : range(d.lo, d.hi);
        const layerNs = nodeIds.map(i => addNode(`Actor_${pad(i)}`));
        layerNodeMap.set(layerName, layerNs);

        const target = Math.round(d.dens * layerNs.length * (layerNs.length - 1));
        const edges  = genEdges(layerNs, layerNs, target, true);
        for (const { from, to } of edges) {
            extended.push({ layer_from: layerName, node_from: from, layer_to: layerName, node_to: to, weight: 1 });
        }
    }

    for (const [a, b] of ilPairs) {
        const na = layerNodeMap.get(`layer_${a}`);
        const nb = layerNodeMap.get(`layer_${b}`);
        const shared = na.filter(n => nb.includes(n));
        const links  = sample(shared, Math.max(2, Math.ceil(shared.length * 0.35)));
        for (const node of links) {
            extended.push({
                layer_from: `layer_${a}`, node_from: node,
                layer_to:   `layer_${b}`, node_to:   node,
                weight: 1,
            });
        }
    }

    // Build state_nodes: one entry per (layer, node) occurrence
    const state_nodes = [];
    for (const d of layerDefs) {
        const layerName = `layer_${d.id}`;
        for (const nodeName of layerNodeMap.get(layerName)) {
            const nodeObj = nodeSet.get(nodeName);
            state_nodes.push({ layer_id: d.id, node_id: nodeObj.node_id, layer_name: layerName, node_name: nodeName });
        }
    }

    return { nodes, layers, state_nodes, extended };
}

// ── Write files ─────────────────────────────────────────────────────────────
const bp = buildBipartite();
fs.writeFileSync('synth_bipartite.json',  JSON.stringify(bp, null, 2));
console.log('synth_bipartite.json  — nodes:', bp.nodes.length, '  layers:', bp.layers.length, '  links:', bp.extended.length);

rng = 98765; // reset seed for second dataset
const up = buildUnipartite();
fs.writeFileSync('synth_unipartite.json', JSON.stringify(up, null, 2));
console.log('synth_unipartite.json — nodes:', up.nodes.length, '  layers:', up.layers.length, '  links:', up.extended.length);

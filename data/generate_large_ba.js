/**
 * Generate a large multilayer BA network for stress-testing.
 * 3 layers × 1000 nodes, Barabási-Albert preferential attachment (m=3),
 * with age/gender node attributes and interlayer coupling links.
 */

const N = 1000;   // nodes per layer
const M = 3;      // BA: edges per new node
const LAYERS = ['layer_alpha', 'layer_beta', 'layer_gamma'];
const INTERLAYER_PER_PAIR = 400; // interlayer links between each pair of layers

// ---- Reproducible PRNG (xoshiro128** seed) ----
let s = [123456789, 362436069, 521288629, 88675123];
function rand() {
    const t = s[1] << 9;
    let r = s[0] * 5; r = ((r << 7) | (r >>> 25)) * 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = (s[3] << 11) | (s[3] >>> 21);
    return (r >>> 0) / 4294967296;
}
function randInt(n) { return Math.floor(rand() * n); }
function randRange(lo, hi) { return lo + rand() * (hi - lo); }

// ---- Physical nodes ----
const genders = ['male', 'female', 'non-binary'];
const genderWeights = [0.48, 0.48, 0.04];
function pickGender() {
    const r = rand();
    let cum = 0;
    for (let i = 0; i < genders.length; i++) {
        cum += genderWeights[i];
        if (r < cum) return genders[i];
    }
    return 'female';
}

const nodes = [];
for (let i = 0; i < N; i++) {
    nodes.push({
        node_id: i + 1,
        node_name: `node_${i + 1}`,
        age: Math.round(randRange(18, 81)),
        gender: pickGender(),
    });
}

// ---- BA preferential attachment per layer ----
function baNetwork(n, m) {
    // degree array (index = node 0..n-1)
    const degree = new Array(n).fill(0);
    const edges = [];

    // initial clique of m+1 nodes
    const init = m + 1;
    for (let i = 0; i < init; i++) {
        for (let j = i + 1; j < init; j++) {
            edges.push([i, j]);
            degree[i]++;
            degree[j]++;
        }
    }

    // stubs array for fast weighted sampling
    const stubs = [];
    for (let i = 0; i < init; i++) {
        for (let k = 0; k < degree[i]; k++) stubs.push(i);
    }

    for (let newNode = init; newNode < n; newNode++) {
        const targets = new Set();
        const attempts = m * 20; // avoid infinite loop
        let tries = 0;
        while (targets.size < m && tries < attempts) {
            targets.add(stubs[randInt(stubs.length)]);
            tries++;
        }
        for (const t of targets) {
            edges.push([newNode, t]);
            degree[newNode]++;
            degree[t]++;
            stubs.push(newNode);
            stubs.push(t);
        }
    }
    return { edges, degree };
}

// ---- Build extended edge list ----
const extended = [];

// Intralayer: one BA network per layer
const layerDegrees = {}; // layerName -> degree array
for (const layerName of LAYERS) {
    const { edges, degree } = baNetwork(N, M);
    layerDegrees[layerName] = degree;
    for (const [a, b] of edges) {
        const w = parseFloat((rand() * 2 + 0.1).toFixed(2));
        extended.push({ layer_from: layerName, node_from: nodes[a].node_name, layer_to: layerName, node_to: nodes[b].node_name, weight: w });
        extended.push({ layer_from: layerName, node_from: nodes[b].node_name, layer_to: layerName, node_to: nodes[a].node_name, weight: w });
    }
}

// Interlayer: couple high-degree nodes across each adjacent layer pair
// Pick INTERLAYER_PER_PAIR node pairs weighted by product of degrees
function addInterlayerLinks(layerA, layerB, count) {
    const degA = layerDegrees[layerA];
    const degB = layerDegrees[layerB];
    // Build a pool weighted by degree (hubs more likely to couple)
    const poolA = [];
    for (let i = 0; i < N; i++) for (let k = 0; k < Math.min(degA[i], 5); k++) poolA.push(i);
    const poolB = [];
    for (let i = 0; i < N; i++) for (let k = 0; k < Math.min(degB[i], 5); k++) poolB.push(i);

    const seen = new Set();
    let added = 0, tries = 0;
    while (added < count && tries < count * 10) {
        tries++;
        const a = poolA[randInt(poolA.length)];
        const b = poolB[randInt(poolB.length)];
        const key = `${a}-${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const w = parseFloat((rand() + 0.1).toFixed(2));
        extended.push({ layer_from: layerA, node_from: nodes[a].node_name, layer_to: layerB, node_to: nodes[b].node_name, weight: w });
        extended.push({ layer_from: layerB, node_from: nodes[b].node_name, layer_to: layerA, node_to: nodes[a].node_name, weight: w });
        added++;
    }
}

addInterlayerLinks(LAYERS[0], LAYERS[1], INTERLAYER_PER_PAIR);
addInterlayerLinks(LAYERS[1], LAYERS[2], INTERLAYER_PER_PAIR);
addInterlayerLinks(LAYERS[0], LAYERS[2], INTERLAYER_PER_PAIR);

// ---- Layers ----
const layers = LAYERS.map((name, i) => ({
    layer_id: i + 1,
    layer_name: name,
    type: ['collaboration', 'communication', 'friendship'][i],
}));

// ---- State nodes (all nodes appear in all layers) ----
const state_nodes = [];
for (const layerName of LAYERS) {
    const layerObj = layers.find(l => l.layer_name === layerName);
    for (const node of nodes) {
        state_nodes.push({
            layer_id: layerObj.layer_id,
            node_id: node.node_id,
            layer_name: layerName,
            node_name: node.node_name,
        });
    }
}

// ---- Assemble and write ----
const json = { nodes, layers, extended, state_nodes };

import { writeFileSync } from 'fs';
writeFileSync('./data/demo_large_ba.json', JSON.stringify(json, null, 2));
console.log(`Written: ${nodes.length} nodes, ${layers.length} layers, ${extended.length} extended edges, ${state_nodes.length} state nodes`);

// Generate a large ER network demo for the multilayer visualizer
const fs = require('fs');

const N = 50;          // nodes per layer
const p = 0.08;        // ER edge probability
const interLinks = 10; // interlayer connections per layer pair
const layers = ['layer_1', 'layer_2', 'layer_3'];

const emln = {
    layers: layers.map((name, i) => ({
        layer_id: i + 1,
        layer_name: name,
        type: 'ER_random'
    })),
    nodes: [],
    intralayer_links: [],
    interlayer_links: []
};

// Generate nodes
for (const layerName of layers) {
    for (let i = 1; i <= N; i++) {
        emln.nodes.push({
            layer_name: layerName,
            node_name: 'n' + i
        });
    }
}

// Generate ER intralayer links
for (const layerName of layers) {
    for (let i = 1; i <= N; i++) {
        for (let j = i + 1; j <= N; j++) {
            if (Math.random() < p) {
                emln.intralayer_links.push({
                    layer_from: layerName,
                    node_from: 'n' + i,
                    layer_to: layerName,
                    node_to: 'n' + j,
                    weight: 1
                });
            }
        }
    }
}

// Generate random interlayer links
for (let li = 0; li < layers.length; li++) {
    for (let lj = li + 1; lj < layers.length; lj++) {
        const used = new Set();
        let count = 0;
        while (count < interLinks) {
            const ni = Math.floor(Math.random() * N) + 1;
            const nj = Math.floor(Math.random() * N) + 1;
            const key = ni + '-' + nj;
            if (!used.has(key)) {
                used.add(key);
                emln.interlayer_links.push({
                    layer_from: layers[li],
                    node_from: 'n' + ni,
                    layer_to: layers[lj],
                    node_to: 'n' + nj,
                    weight: 1
                });
                count++;
            }
        }
    }
}

fs.writeFileSync('data/demo_large.json', JSON.stringify(emln, null, 2));
console.log('Generated:', emln.nodes.length, 'nodes,',
    emln.intralayer_links.length, 'intralayer links,',
    emln.interlayer_links.length, 'interlayer links');

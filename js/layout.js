/**
 * layout.js — Multi-algorithm layout engine for multilayer networks
 *
 * Computes 2D positions for nodes within each layer.
 * Nodes that appear in multiple layers get consistent initial positions.
 *
 * Supported algorithms (inspired by igraph):
 *   - fruchterman  (Fruchterman-Reingold force-directed)
 *   - kamada_kawai  (Kamada-Kawai spring/energy-based)
 *   - circle        (nodes on a circle)
 *   - grid          (nodes on a regular grid)
 *   - random        (uniform random)
 */

export class ForceLayout {
    constructor(options = {}) {
        this.iterations = options.iterations || 150;
        this.repulsionStrength = options.repulsionStrength || 800;
        this.attractionStrength = options.attractionStrength || 0.05;
        this.damping = options.damping || 0.9;
        this.maxDisplacement = options.maxDisplacement || 15;
        this.layerWidth = options.layerWidth || 350;
        this.layerHeight = options.layerHeight || 250;
        this.temperature = options.temperature || 10; // Added temperature option

        // Layout algorithm: 'fruchterman' | 'kamada_kawai' | 'circle' | 'grid' | 'random' | 'bipartite'
        this.layoutType = options.layoutType || 'fruchterman';

        // Bipartite info from data model (set by app.js)
        this.bipartiteInfo = null; // Map<layerName, { isBipartite, setA, setB, ... }>
        this.bipartiteNested = options.bipartiteNested || false; // toggle for nested sorting by degree
    }

    /**
     * Compute layout for all layers.
     * @param {Object} model - parsed multilayer data
     * @returns {Map} layerName -> Map(nodeName -> {x, y})
     */
    computeLayout(model) {
        const positions = new Map();

        // Consistent initial positions for cross-layer nodes
        const globalPositions = new Map();
        const nodeList = Array.from(model.nodesByName.keys());
        nodeList.forEach((name, i) => {
            const angle = (2 * Math.PI * i) / nodeList.length;
            const radius = Math.min(this.layerWidth, this.layerHeight) * 0.35;
            globalPositions.set(name, {
                x: this.layerWidth / 2 + radius * Math.cos(angle),
                y: this.layerHeight / 2 + radius * Math.sin(angle),
            });
        });

        for (const layer of model.layers) {
            const layerName = layer.layer_name;
            const nodeNames = model.nodesPerLayer.get(layerName);
            if (!nodeNames || nodeNames.size === 0) continue;

            const nodeArray = Array.from(nodeNames);
            const edges = model.intralayerLinks.filter(l => l.layer_from === layerName);

            // Get bipartite info for this layer
            const bpInfo = this.bipartiteInfo ? this.bipartiteInfo.get(layerName) : null;

            let layerPos;
            switch (this.layoutType) {
                case 'bipartite':
                    layerPos = this._layoutBipartite(nodeArray, bpInfo, layerName, model);
                    break;
                case 'circle':
                    layerPos = this._layoutCircle(nodeArray);
                    break;
                case 'grid':
                    layerPos = this._layoutGrid(nodeArray);
                    break;
                case 'random':
                    layerPos = this._layoutRandom(nodeArray);
                    break;
                case 'kamada_kawai':
                    layerPos = this._layoutKamadaKawai(nodeArray, edges, globalPositions);
                    break;
                case 'fruchterman':
                default:
                    layerPos = this._layoutFruchtermanReingold(nodeArray, edges, globalPositions);
                    break;
            }

            // Rescale to fill the polygon with padding
            // (bipartite layout already computes exact positions, skip rescaling)
            const finalPos = this.layoutType === 'bipartite'
                ? layerPos
                : this._rescaleToFit(layerPos);
            positions.set(layerName, finalPos);
        }

        return positions;
    }

    /**
     * Rescale positions to optimally fill the layer rectangle.
     * Maps from raw positions to [padding, width-padding] × [padding, height-padding].
     */
    _rescaleToFit(positions) {
        // Very small padding — the polygon margin (20px in renderer) provides
        // the visual breathing room, so we want nodes to span almost the full
        // coordinate rectangle [0..layerWidth] × [0..layerHeight].
        const pad = 10;
        const targetMinX = pad;
        const targetMaxX = this.layerWidth - pad;
        const targetMinY = pad;
        const targetMaxY = this.layerHeight - pad;

        if (positions.size <= 1) {
            const result = new Map();
            for (const [name] of positions) {
                result.set(name, { x: this.layerWidth / 2, y: this.layerHeight / 2 });
            }
            return result;
        }

        // Find bounding box of raw positions
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [, pos] of positions) {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        }

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const availW = targetMaxX - targetMinX;
        const availH = targetMaxY - targetMinY;

        // Independent X/Y scaling — stretches to fill the full rectangle.
        // This may distort shapes (e.g. circles become ellipses) but maximizes
        // the use of available polygon space.
        const result = new Map();
        for (const [name, pos] of positions) {
            result.set(name, {
                x: targetMinX + ((pos.x - minX) / rangeX) * availW,
                y: targetMinY + ((pos.y - minY) / rangeY) * availH,
            });
        }
        return result;
    }

    // =============================
    // Layout Algorithms
    // =============================

    /**
     * Fruchterman-Reingold force-directed layout via d3-force.
     * Uses Barnes-Hut repulsion (O(n log n)) and link attraction,
     * run synchronously for this.iterations ticks.
     */
    _layoutFruchtermanReingold(nodeArray, edges, globalPositions) {
        const d3 = globalThis.d3;

        // Build node objects; seed positions from globalPositions when available
        const nodes = nodeArray.map(name => {
            const gp = globalPositions.get(name);
            return {
                id: name,
                x: gp ? gp.x + (Math.random() - 0.5) * 20 : this.layerWidth  / 2,
                y: gp ? gp.y + (Math.random() - 0.5) * 20 : this.layerHeight / 2,
            };
        });

        // Build link objects using array indices (d3-force mutates source/target to node refs)
        const idxOf = new Map(nodeArray.map((name, i) => [name, i]));
        const links = edges
            .filter(e => idxOf.has(e.node_from) && idxOf.has(e.node_to))
            .map(e => ({ source: idxOf.get(e.node_from), target: idxOf.get(e.node_to) }));

        const simulation = d3.forceSimulation(nodes)
            .force('charge', d3.forceManyBody().strength(-this.repulsionStrength))
            .force('link',   d3.forceLink(links).distance(Math.sqrt(this.layerWidth * this.layerHeight / Math.max(nodeArray.length, 1))))
            .force('center', d3.forceCenter(this.layerWidth / 2, this.layerHeight / 2))
            .alphaDecay(0)   // disable automatic cooling — we control iteration count
            .stop();

        simulation.tick(this.iterations);

        const result = new Map();
        for (const node of nodes) {
            result.set(node.id, { x: node.x, y: node.y });
        }
        return result;
    }

    /**
     * Kamada-Kawai spring/energy-based layout.
     * Minimizes energy based on shortest-path distances.
     */
    _layoutKamadaKawai(nodeArray, edges, globalPositions) {
        const n = nodeArray.length;
        if (n <= 1) {
            const result = new Map();
            if (n === 1) result.set(nodeArray[0], { x: this.layerWidth / 2, y: this.layerHeight / 2 });
            return result;
        }

        // Build graph for BFS shortest-path computation
        const idx = new Map(nodeArray.map((name, i) => [name, i]));
        const graph = new graphology.UndirectedGraph();
        nodeArray.forEach(name => graph.addNode(name));
        for (const edge of edges) {
            if (graph.hasNode(edge.node_from) && graph.hasNode(edge.node_to) &&
                !graph.hasEdge(edge.node_from, edge.node_to)) {
                graph.addEdge(edge.node_from, edge.node_to);
            }
        }

        // BFS single-source shortest paths (O(n*(n+m)) vs O(n³) Floyd-Warshall)
        const dist = Array.from({ length: n }, () => Array(n).fill(Infinity));
        for (let i = 0; i < n; i++) dist[i][i] = 0;
        nodeArray.forEach((source, i) => {
            const lengths = graphologyShortestPath.singleSourceLength(graph, source);
            for (const [target, len] of Object.entries(lengths)) {
                const j = idx.get(target);
                if (j !== undefined) dist[i][j] = len;
            }
        });

        // Replace Infinity with diameter + 1 for disconnected components
        let diameter = 0;
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                if (dist[i][j] < Infinity) diameter = Math.max(diameter, dist[i][j]);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++)
                if (dist[i][j] === Infinity) dist[i][j] = diameter + 1;

        // Desired edge length
        const L = Math.min(this.layerWidth, this.layerHeight) * 0.8 / Math.max(diameter, 1);

        // Spring constants and lengths
        const kij = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => i === j ? 0 : 1 / (dist[i][j] * dist[i][j]))
        );
        const lij = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => L * dist[i][j])
        );

        // Initialize positions (circle with jitter)
        const pos = nodeArray.map((name, i) => {
            const gp = globalPositions.get(name);
            if (gp) return { x: gp.x + (Math.random() - 0.5) * 30, y: gp.y + (Math.random() - 0.5) * 30 };
            const angle = (2 * Math.PI * i) / n;
            const r = Math.min(this.layerWidth, this.layerHeight) * 0.3;
            return { x: this.layerWidth / 2 + r * Math.cos(angle), y: this.layerHeight / 2 + r * Math.sin(angle) };
        });

        // Iterative relaxation
        const maxIter = Math.min(200, n * 30);
        for (let iter = 0; iter < maxIter; iter++) {
            // Find node with maximum energy
            let maxDelta = 0;
            let maxIdx = 0;
            for (let m = 0; m < n; m++) {
                let dEdx = 0, dEdy = 0;
                for (let i = 0; i < n; i++) {
                    if (i === m) continue;
                    const dx = pos[m].x - pos[i].x;
                    const dy = pos[m].y - pos[i].y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
                    dEdx += kij[m][i] * (dx - lij[m][i] * dx / d);
                    dEdy += kij[m][i] * (dy - lij[m][i] * dy / d);
                }
                const delta = Math.sqrt(dEdx * dEdx + dEdy * dEdy);
                if (delta > maxDelta) {
                    maxDelta = delta;
                    maxIdx = m;
                }
            }

            if (maxDelta < 0.01) break;

            // Move the node with highest energy gradient
            const m = maxIdx;
            for (let subIter = 0; subIter < 5; subIter++) {
                let dEdx = 0, dEdy = 0;
                let d2Edx2 = 0, d2Edy2 = 0, d2Edxdy = 0;

                for (let i = 0; i < n; i++) {
                    if (i === m) continue;
                    const dx = pos[m].x - pos[i].x;
                    const dy = pos[m].y - pos[i].y;
                    const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
                    const d3 = d * d * d;

                    dEdx += kij[m][i] * (dx - lij[m][i] * dx / d);
                    dEdy += kij[m][i] * (dy - lij[m][i] * dy / d);
                    d2Edx2 += kij[m][i] * (1 - lij[m][i] * dy * dy / d3);
                    d2Edy2 += kij[m][i] * (1 - lij[m][i] * dx * dx / d3);
                    d2Edxdy += kij[m][i] * (lij[m][i] * dx * dy / d3);
                }

                const denom = d2Edx2 * d2Edy2 - d2Edxdy * d2Edxdy;
                if (Math.abs(denom) < 1e-10) break;

                const deltaX = -(d2Edy2 * dEdx - d2Edxdy * dEdy) / denom;
                const deltaY = -(d2Edx2 * dEdy - d2Edxdy * dEdx) / denom;

                pos[m].x += deltaX;
                pos[m].y += deltaY;
            }
        }

        const result = new Map();
        nodeArray.forEach((name, i) => {
            result.set(name, { x: pos[i].x, y: pos[i].y });
        });
        return result;
    }

    /**
     * Circular layout — nodes evenly spaced on a circle.
     */
    _layoutCircle(nodeArray) {
        const result = new Map();
        const n = nodeArray.length;
        const cx = this.layerWidth / 2;
        const cy = this.layerHeight / 2;
        const r = Math.min(this.layerWidth, this.layerHeight) * 0.4;

        nodeArray.forEach((name, i) => {
            const angle = (2 * Math.PI * i) / n - Math.PI / 2;
            result.set(name, {
                x: cx + r * Math.cos(angle),
                y: cy + r * Math.sin(angle),
            });
        });
        return result;
    }

    /**
     * Grid layout — nodes placed on a regular grid.
     */
    _layoutGrid(nodeArray) {
        const result = new Map();
        const n = nodeArray.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);

        nodeArray.forEach((name, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            result.set(name, {
                x: (col + 0.5) * (this.layerWidth / cols),
                y: (row + 0.5) * (this.layerHeight / rows),
            });
        });
        return result;
    }

    /**
     * Random layout — uniform random positions.
     */
    _layoutRandom(nodeArray) {
        const result = new Map();
        for (const name of nodeArray) {
            result.set(name, {
                x: Math.random() * this.layerWidth,
                y: Math.random() * this.layerHeight,
            });
        }
        return result;
    }

    /**
     * Bipartite layout — two horizontal rows of nodes.
     * Set A nodes on top row, Set B nodes on bottom row.
     * If bipartite info is not available, falls back to a single-row layout.
     * If this.bipartiteNested is true, clusters high-degree nodes.
     */
    _layoutBipartite(nodeArray, bpInfo, layerName, model) {
        const result = new Map();
        const pad = 15;

        if (!bpInfo || !bpInfo.isBipartite) {
            // Fallback: single row in the middle
            const y = this.layerHeight / 2;
            nodeArray.forEach((name, i) => {
                result.set(name, {
                    x: nodeArray.length > 1
                        ? pad + i * ((this.layerWidth - 2 * pad) / (nodeArray.length - 1))
                        : this.layerWidth / 2,
                    y,
                });
            });
            return result;
        }

        const { setA, setB } = bpInfo;
        const topY = this.layerHeight * 0.18;
        const botY = this.layerHeight * 0.82;

        // Separate nodes into two arrays preserving original order
        let aNodes = nodeArray.filter(n => setA.has(n));
        let bNodes = nodeArray.filter(n => setB.has(n));

        // Nested sorting: Sort descending by degree so hubs pull to the left
        if (this.bipartiteNested && model && model.stateNodeMap) {
            const sortByDegree = (a, b) => {
                const snA = model.stateNodeMap.get(`${layerName}::${a}`);
                const snB = model.stateNodeMap.get(`${layerName}::${b}`);
                const degA = snA ? (snA.degree || 0) : 0;
                const degB = snB ? (snB.degree || 0) : 0;
                return degB - degA;
            };
            aNodes.sort(sortByDegree);
            bNodes.sort(sortByDegree);
        }

        // Place Set A nodes along top row
        aNodes.forEach((name, i) => {
            result.set(name, {
                x: aNodes.length > 1
                    ? pad + i * ((this.layerWidth - 2 * pad) / (aNodes.length - 1))
                    : this.layerWidth / 2,
                y: topY,
            });
        });

        // Place Set B nodes along bottom row
        bNodes.forEach((name, i) => {
            result.set(name, {
                x: bNodes.length > 1
                    ? pad + i * ((this.layerWidth - 2 * pad) / (bNodes.length - 1))
                    : this.layerWidth / 2,
                y: botY,
            });
        });

        return result;
    }
}

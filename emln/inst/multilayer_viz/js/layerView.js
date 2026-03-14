/**
 * layerView.js — Layer Meta-Graph View + Drill-Down View
 *
 * LayerView:     live force-directed meta-graph (layers as animated bubbles).
 * DrillDownView: live force-directed network for a single layer's interior.
 */

// Curated palette (same order as colorMapper.js CATEGORICAL_PALETTE)
const PALETTE = [
    '#6ee7b7', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa',
    '#fb923c', '#34d399', '#f472b6', '#38bdf8', '#facc15',
    '#c084fc', '#4ade80', '#fb7185', '#22d3ee', '#e879f9',
];

// ══════════════════════════════════════════════════════════════════════════
// LayerView — meta-graph of layers as animated force-directed bubbles
// ══════════════════════════════════════════════════════════════════════════

export class LayerView {
    constructor(model, positions) {
        this._model     = model;
        this._positions = positions; // Map<layerName, Map<nodeName, {x,y}>>

        this.viewScale   = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;

        this.alpha      = 1.0;
        this.alphaDecay = 0.003; // slower cooling → smoother animation
        this._draggedBubble = null;
        this._alphaBeforeDrag = 0;
        this._selectedLayer = null;   // layerName of selected bubble, or null
        this._compareLayer  = null;   // layerName of second bubble in comparison mode

        this.settings = {
            sizeBy:          'nodes',   // 'nodes' | 'edges' | 'uniform'
            sizeMultiplier:  1.0,
            colorBy:         'layer',   // 'layer' | 'nodecount' | 'density' | 'uniform'
            colorLegendType: 'continuous', // 'continuous' | 'categorical' (for nodecount/density)
            uniformColor:    '#6ee7b7',
            showEdges:       true,
            edgeMetric:      'both',    // 'both' | 'shared' | 'interlayer'
            minEdgeWeight:   0,
            showEdgeLabels:  false,
            showLabels:      true,
            labelFontSize:   13,
            bubbleSpacing:   1.0,       // multiplier on ideal inter-bubble gap
        };

        this._computeMetaGraph();
        this._refreshRadii();   // sets b.r + builds _microGraphs
        this._initLayout();
    }

    // ── Meta-graph computation ─────────────────────────────────────────────

    _computeMetaGraph() {
        const model  = this._model;
        const layers = model.layers;
        const L      = layers.length;

        this._layerColorMap = new Map();
        layers.forEach((l, i) => this._layerColorMap.set(l.layer_name, PALETTE[i % PALETTE.length]));

        const intraCounts = new Map();
        for (const layer of layers) {
            const links = model.intralayerLinks.filter(l => l.layer_from === layer.layer_name);
            intraCounts.set(layer.layer_name, links.length);  // edges stored once, no /2
        }

        this._bubbles = layers.map((layer) => {
            const layerName = layer.layer_name;
            const nodeSet   = model.nodesPerLayer.get(layerName) || new Set();
            const N = nodeSet.size;
            const E = intraCounts.get(layerName) || 0;
            const isDir = model.directed ?? false;
            const bpInfo = model.bipartiteInfo?.get(layerName);
            const isBp   = bpInfo?.isBipartite ?? false;
            const nA = isBp ? (bpInfo.setA?.size ?? 0) : 0;
            const nB = isBp ? (bpInfo.setB?.size ?? 0) : 0;
            let E_max;
            if (isBp) {
                E_max = isDir ? 2 * nA * nB : nA * nB;
            } else {
                E_max = isDir ? N * (N - 1) : N * (N - 1) / 2;
            }
            const density = E_max > 0 ? E / E_max : 0;
            const avgDeg  = N > 0 ? (2 * E) / N : 0;  // total degree / N (same for directed and undirected)
            return {
                layerName, nodeCount: N, edgeCount: E, density, avgDegree: avgDeg,
                color: this._layerColorMap.get(layerName),
                r: 65, x: 0, y: 0, fx: 0, fy: 0,  // r set properly by _refreshRadii()
            };
        });

        this._metaEdges = [];
        for (let a = 0; a < L; a++) {
            for (let b = a + 1; b < L; b++) {
                const lA = layers[a].layer_name;
                const lB = layers[b].layer_name;
                const interlayerLinks = model.interlayerLinks.filter(
                    l => (l.layer_from === lA && l.layer_to === lB) ||
                         (l.layer_from === lB && l.layer_to === lA)
                );
                const interlayerCount = interlayerLinks.length;  // edges stored once, no /2
                const setA = model.nodesPerLayer.get(lA) || new Set();
                const setB = model.nodesPerLayer.get(lB) || new Set();
                let sharedCount = 0;
                for (const n of setA) if (setB.has(n)) sharedCount++;
                const sharedFraction = Math.min(setA.size, setB.size) > 0
                    ? sharedCount / Math.min(setA.size, setB.size) : 0;
                this._metaEdges.push({ lA, lB, interlayerCount, sharedCount, sharedFraction, a, b });
            }
        }
    }

    /** Recompute bubble radii from settings.sizeBy, then rebuild micro-graphs. */
    _refreshRadii() {
        const { sizeBy, sizeMultiplier } = this.settings;
        const mult = sizeMultiplier || 1;
        const maxN = Math.max(1, ...this._bubbles.map(b => b.nodeCount));
        const maxE = Math.max(1, ...this._bubbles.map(b => b.edgeCount));
        const maxD = Math.max(1e-9, ...this._bubbles.map(b => b.density));
        this._microGraphs = new Map();
        for (const bubble of this._bubbles) {
            // Target span: long-axis diameter of the micro-graph in pixels
            const score = sizeBy === 'uniform' ? 1
                : sizeBy === 'edges'            ? Math.sqrt(bubble.edgeCount / maxE)
                : sizeBy === 'density'          ? Math.sqrt(bubble.density   / maxD)
                :                                 Math.sqrt(bubble.nodeCount / maxN);
            const targetSpan = (28 + 42 * score) * mult;
            const micro = this._buildMicroGraph(bubble, targetSpan);
            this._microGraphs.set(bubble.layerName, micro);
            // Circle wraps tightly around content with a fixed border margin
            bubble.r = Math.max(22, Math.min(88, micro.boundingRadius + 12));
        }
    }

    /** Update a setting; handles side effects (radius rebuild, sim restart). */
    updateSetting(key, value) {
        this.settings[key] = value;
        if (key === 'sizeBy' || key === 'sizeMultiplier') {
            this._refreshRadii();
            // Tiny alpha bump — just enough for the overlap pass to resolve any new collisions
            this.alpha = Math.max(this.alpha, 0.05);
        }
        if (key === 'bubbleSpacing') {
            this.alpha = Math.max(this.alpha, 0.08); // gentle re-settle for spacing change
        }
    }

    /** Re-run full layout from scratch (for the "Re-run layout" button). */
    resetLayout() {
        for (const b of this._bubbles) b.pinned = false;
        this._initLayout(); // pre-settles 250 steps, ends at alpha=0.06
    }

    /** Returns legend scale descriptors for the current settings. */
    getLegendScales() {
        const s = this.settings;
        const scales = [];

        if (s.colorBy === 'layer') {
            scales.push({
                id: 'lvColor', type: 'categorical', title: 'Circle Color', attrName: 'Layer',
                canToggle: false,
                map: new Map(this._bubbles.map(b => [b.layerName, b.color])),
            });
        } else if (s.colorBy === 'nodecount' || s.colorBy === 'density') {
            const isCount = s.colorBy === 'nodecount';
            const vals = this._bubbles.map(b => isCount ? b.nodeCount : b.density);
            const minV = Math.min(...vals), maxV = Math.max(...vals);
            const attrName = isCount ? 'Node count' : 'Edge density';
            const legendType = s.colorLegendType === 'categorical' ? 'categorical' : 'continuous';

            if (legendType === 'categorical') {
                const map = new Map();
                this._bubbles.forEach(b => {
                    const v = isCount ? b.nodeCount : b.density;
                    const t = maxV > minV ? (v - minV) / (maxV - minV) : 0.5;
                    map.set(`${b.layerName} (${isCount ? v : v.toFixed(2)})`, this._seqColor(t));
                });
                scales.push({ id: 'lvColor', type: 'categorical', title: 'Circle Color',
                    attrName, canToggle: true, currentType: 'categorical', map });
            } else {
                scales.push({ id: 'lvColor', type: 'continuous', title: 'Circle Color',
                    attrName, canToggle: true, currentType: 'continuous',
                    minLabel: isCount ? String(minV) : minV.toFixed(3),
                    maxLabel: isCount ? String(maxV) : maxV.toFixed(3),
                    gradient: 'linear-gradient(to right, #ffffb2, #fecc5c, #fd8d3c, #f03b20, #bd0026)',
                });
            }
        }
        // uniform color: no legend needed

        if (s.sizeBy !== 'uniform') {
            const isDensity = s.sizeBy === 'density';
            const isNodes   = s.sizeBy === 'nodes';
            const vals  = this._bubbles.map(b => isDensity ? b.density : isNodes ? b.nodeCount : b.edgeCount);
            const radii = this._bubbles.map(b => b.r);
            const minVal = Math.min(...vals), maxVal = Math.max(...vals);
            const minR   = Math.min(...radii),  maxR   = Math.max(...radii);
            const attrName = isDensity ? 'Edge density' : isNodes ? 'Node count' : 'Edge count';
            scales.push({
                id: 'lvSize', type: 'size', title: 'Circle Size',
                attrName, canToggle: false,
                minLabel: isDensity ? minVal.toFixed(3) : String(minVal),
                midLabel: isDensity ? ((minVal + maxVal) / 2).toFixed(3) : String(Math.round((minVal + maxVal) / 2)),
                maxLabel: isDensity ? maxVal.toFixed(3) : String(maxVal),
                minR, maxR,
            });
        }
        return scales;
    }

    /** Returns max edge weight for the given metric — used to set slider bounds. */
    maxEdgeWeight(metric) {
        if (metric === 'shared')     return Math.max(0, ...this._metaEdges.map(e => e.sharedCount));
        if (metric === 'interlayer') return Math.max(0, ...this._metaEdges.map(e => e.interlayerCount));
        return Math.max(
            ...this._metaEdges.map(e => e.sharedCount),
            ...this._metaEdges.map(e => e.interlayerCount),
        );
    }

    _buildMicroGraph(bubble, targetSpan = 50) {
        const { layerName } = bubble;
        const layerPos = this._positions && this._positions.get(layerName);
        if (!layerPos || layerPos.size === 0) return { nodes: [], links: [], boundingRadius: targetSpan * 0.5 };

        const model = this._model;
        const degrees = new Map();
        for (const link of model.intralayerLinks) {
            if (link.layer_from !== layerName) continue;
            degrees.set(link.node_from, (degrees.get(link.node_from) || 0) + 1);
            degrees.set(link.node_to,   (degrees.get(link.node_to)   || 0) + 1);
        }

        const sampledNodes = new Set(
            Array.from(layerPos.keys())
                .sort((a, b) => (degrees.get(b) || 0) - (degrees.get(a) || 0))
                .slice(0, 150)
        );

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const name of sampledNodes) {
            const p = layerPos.get(name);
            if (!p) continue;
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
        const scale = targetSpan / (Math.max(maxX - minX, maxY - minY) || 1);

        // Scale positions and measure actual bounding circle
        const scaledPos = new Map();
        let boundingRadius = 0;
        for (const name of sampledNodes) {
            const p = layerPos.get(name);
            if (!p) continue;
            const sx = (p.x - cx0) * scale, sy = (p.y - cy0) * scale;
            scaledPos.set(name, { x: sx, y: sy });
            boundingRadius = Math.max(boundingRadius, Math.hypot(sx, sy));
        }

        const links = [];
        for (const link of model.intralayerLinks) {
            if (link.layer_from !== layerName) continue;
            if (!sampledNodes.has(link.node_from) || !sampledNodes.has(link.node_to)) continue;
            if (links.length >= 300) break;
            const from = scaledPos.get(link.node_from);
            const to   = scaledPos.get(link.node_to);
            if (from && to) links.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
        }

        return { nodes: Array.from(scaledPos.values()), links, boundingRadius };
    }

    // ── Force-directed layout (Fruchterman-Reingold, stable) ──────────────

    _initLayout() {
        const L = this._bubbles.length;
        if (L === 0) return;
        if (L === 1) { this._bubbles[0].x = 0; this._bubbles[0].y = 0; return; }

        // Identify connected vs isolated bubbles
        const connectedSet = new Set();
        for (const edge of this._metaEdges) {
            if (edge.interlayerCount > 0 || edge.sharedFraction >= 0.01) {
                connectedSet.add(edge.a); connectedSet.add(edge.b);
            }
        }

        const avgR   = this._bubbles.reduce((s, b) => s + b.r, 0) / L;
        const minRad = (L * (avgR * 2.5)) / (2 * Math.PI);
        const rad    = Math.max(minRad, 200);
        // Place connected bubbles on the circle; isolated ones start at origin (will be pushed out by overlap)
        this._bubbles.forEach((b, i) => {
            if (connectedSet.has(i)) {
                const angle = (2 * Math.PI * i) / L - Math.PI / 2;
                b.x = rad * Math.cos(angle);
                b.y = rad * Math.sin(angle);
            } else {
                b.x = (Math.random() - 0.5) * avgR * 2;
                b.y = (Math.random() - 0.5) * avgR * 2;
            }
        });

        // Pre-settle so auto-fit in app.js sees realistic positions, not the raw circle.
        // End at low alpha so the live animation starts gently — no jitter.
        this.alpha = 0.5;
        for (let i = 0; i < 250; i++) this._stepForce();
        this.alpha = 0.06;
    }

    /** Compute the bounding radius of current bubble layout (for auto-fit). */
    layoutRadius() {
        return Math.max(1, ...this._bubbles.map(b => Math.sqrt(b.x * b.x + b.y * b.y) + b.r));
    }

    _stepForce() {
        const L = this._bubbles.length;
        if (L <= 1) return;

        const avgR    = this._bubbles.reduce((s, b) => s + b.r, 0) / L;
        const gap     = 50 * (this.settings.bubbleSpacing || 1);
        const k       = avgR * 2 + gap;
        const maxDisp = k * this.alpha;

        for (const b of this._bubbles) { b.fx = 0; b.fy = 0; }

        // Repulsion between all bubble pairs
        for (let i = 0; i < L; i++) {
            for (let j = i + 1; j < L; j++) {
                const bi = this._bubbles[i], bj = this._bubbles[j];
                const dx = bi.x - bj.x, dy = bi.y - bj.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const d    = Math.max(dist, bi.r + bj.r + 5);
                const force = (k * k) / d;
                const nx = dx / dist, ny = dy / dist;
                bi.fx += nx * force; bi.fy += ny * force;
                bj.fx -= nx * force; bj.fy -= ny * force;
            }
        }

        // Standard FR attraction along meta-edges (hard overlap pass below prevents collapse)
        for (const edge of this._metaEdges) {
            if (!edge.interlayerCount && edge.sharedFraction < 0.01) continue;
            const bi = this._bubbles[edge.a], bj = this._bubbles[edge.b];
            if (!bi || !bj) continue;
            const dx   = bj.x - bi.x, dy = bj.y - bi.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist * dist) / k;
            const nx = dx / dist, ny = dy / dist;
            bi.fx += nx * force; bi.fy += ny * force;
            bj.fx -= nx * force; bj.fy -= ny * force;
        }

        // Center gravity — isolated bubbles pulled toward centroid of connected ones
        const connectedIdx = new Set();
        for (const edge of this._metaEdges) {
            if (!edge.interlayerCount && edge.sharedFraction < 0.01) continue;
            connectedIdx.add(edge.a);
            connectedIdx.add(edge.b);
        }
        let ccx = 0, ccy = 0, ncc = 0;
        for (let i = 0; i < L; i++) {
            if (connectedIdx.has(i)) { ccx += this._bubbles[i].x; ccy += this._bubbles[i].y; ncc++; }
        }
        if (ncc > 0) { ccx /= ncc; ccy /= ncc; }
        for (let i = 0; i < L; i++) {
            const b = this._bubbles[i];
            if (connectedIdx.has(i)) {
                b.fx -= b.x * 0.05;
                b.fy -= b.y * 0.05;
            } else {
                b.fx -= (b.x - ccx) * 0.6;
                b.fy -= (b.y - ccy) * 0.6;
            }
        }

        // Apply with F-R displacement clamping
        const dragged = this._draggedBubble ? this._draggedBubble.bubble : null;
        for (const b of this._bubbles) {
            if (b === dragged || b.pinned) continue;
            const len  = Math.sqrt(b.fx * b.fx + b.fy * b.fy) || 1;
            const disp = Math.min(len, maxDisp);
            b.x += (b.fx / len) * disp;
            b.y += (b.fy / len) * disp;
        }

        // Hard overlap separation — directly push apart any overlapping pair
        for (let i = 0; i < L; i++) {
            for (let j = i + 1; j < L; j++) {
                const bi = this._bubbles[i], bj = this._bubbles[j];
                const dx = bi.x - bj.x, dy = bi.y - bj.y;
                const dist    = Math.sqrt(dx * dx + dy * dy) || 0.01;
                const minDist = bi.r + bj.r + 15;
                if (dist < minDist) {
                    const push = (minDist - dist) * 0.5;
                    const nx = dx / dist, ny = dy / dist;
                    if (bi !== dragged && !bi.pinned) { bi.x += nx * push; bi.y += ny * push; }
                    if (bj !== dragged && !bj.pinned) { bj.x -= nx * push; bj.y -= ny * push; }
                }
            }
        }
    }

    /** Advance simulation one step. Returns true while still animating. */
    tick() {
        const active = this.alpha > 0.001 || !!this._draggedBubble;
        if (!active) return false;
        // Always 1 step per frame — prevents jitter at high alpha values.
        // During drag alpha=0 so forces are frozen; overlap pass still resolves collisions.
        this._stepForce();
        if (!this._draggedBubble) this.alpha = Math.max(0, this.alpha - this.alphaDecay);
        return true;
    }

    // ── Bubble drag ────────────────────────────────────────────────────────

    startDragBubble(mx, my, w, h) {
        const { lx, ly } = this._toLocal(mx, my, w, h);
        for (const b of this._bubbles) {
            if (Math.hypot(lx - b.x, ly - b.y) <= b.r) {
                this._draggedBubble = { bubble: b, offsetX: lx - b.x, offsetY: ly - b.y };
                // Freeze forces during drag — neighbors stay put, overlap pass still resolves collisions
                this._alphaBeforeDrag = this.alpha;
                this.alpha = 0;
                return b.layerName;
            }
        }
        return null;
    }

    moveDragBubble(mx, my, w, h) {
        if (!this._draggedBubble) return;
        const { lx, ly } = this._toLocal(mx, my, w, h);
        const { bubble, offsetX, offsetY } = this._draggedBubble;
        bubble.x = lx - offsetX;
        bubble.y = ly - offsetY;
    }

    endDragBubble() {
        if (this._draggedBubble) {
            this._draggedBubble.bubble.pinned = true; // keep it where dropped
            this._draggedBubble = null;
            this.alpha = 0.05; // let others settle gently, pinned bubble won't move
        }
    }

    /** Toggle selection on a bubble by layer name; null clears selection. */
    selectBubble(layerName) {
        this._compareLayer  = null;
        this._selectedLayer = (this._selectedLayer === layerName) ? null : layerName;
    }

    /** Enter comparison mode — highlight only layerA and layerB. */
    selectForComparison(layerA, layerB) {
        this._selectedLayer = layerA;
        this._compareLayer  = layerB;
    }

    /** Set of layer names that are highlighted given current selection/comparison. */
    _highlightSet() {
        if (!this._selectedLayer) return null;
        if (this._compareLayer) {
            return new Set([this._selectedLayer, this._compareLayer]);
        }
        return new Set([this._selectedLayer]);
    }

    // ── Color helpers ──────────────────────────────────────────────────────

    _getBubbleColor(bubble) {
        const { colorBy, uniformColor } = this.settings;
        if (colorBy === 'layer')   return bubble.color;
        if (colorBy === 'uniform') return uniformColor || '#6ee7b7';
        const vals = this._bubbles.map(b => colorBy === 'density' ? b.density : b.nodeCount);
        const minV = Math.min(...vals), maxV = Math.max(...vals);
        const val  = colorBy === 'density' ? bubble.density : bubble.nodeCount;
        const t    = maxV > minV ? (val - minV) / (maxV - minV) : 0.5;
        return this._seqColor(t);
    }

    _seqColor(t) {
        // YlOrRd: pale yellow → orange → dark red — high contrast, works on any background
        // Returns hex so color + '28' alpha suffix is valid CSS
        const r = Math.round(255 - 66  * t);  // 255 → 189
        const g = Math.round(255 - 229 * t);  // 255 → 26
        const b = Math.round(178 - 178 * t);  // 178 → 0
        const hex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
        return `#${hex(r)}${hex(g)}${hex(b)}`;
    }

    // ── Rendering ──────────────────────────────────────────────────────────

    render(ctx, w, h) {
        ctx.fillStyle = '#f8f8fc';
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(w / 2 + this.viewOffsetX, h / 2 + this.viewOffsetY);
        ctx.scale(this.viewScale, this.viewScale);

        const s = this.settings;
        const hl = this._highlightSet(); // null = no selection, Set = highlighted layers

        // ── Edges ──
        if (s.showEdges) {
            const maxI = Math.max(1, ...this._metaEdges.map(e => e.interlayerCount));
            const maxS = Math.max(1, ...this._metaEdges.map(e => e.sharedCount));
            const minW = s.minEdgeWeight;

            for (const edge of this._metaEdges) {
                const bi = this._bubbles[edge.a], bj = this._bubbles[edge.b];
                const edgeFaded = hl && !(hl.has(bi.layerName) && hl.has(bj.layerName));
                const dx = bj.x - bi.x, dy = bj.y - bi.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / dist, ny = dx / dist; // perpendicular unit

                const drawI = (s.edgeMetric === 'interlayer' || s.edgeMetric === 'both')
                    && edge.interlayerCount >= minW && edge.interlayerCount > 0;
                const drawS = (s.edgeMetric === 'shared' || s.edgeMetric === 'both')
                    && edge.sharedCount >= minW && edge.sharedCount > 0;
                const off = (drawI && drawS) ? 3 : 0;

                if (edgeFaded) ctx.globalAlpha = 0.08;
                if (drawI) {
                    const lw = 1 + 4 * (edge.interlayerCount / maxI);
                    ctx.beginPath();
                    ctx.moveTo(bi.x + nx * off, bi.y + ny * off);
                    ctx.lineTo(bj.x + nx * off, bj.y + ny * off);
                    ctx.strokeStyle = 'rgba(60,100,220,0.7)';
                    ctx.lineWidth = lw;
                    ctx.setLineDash([]);
                    ctx.stroke();
                    if (!edgeFaded && s.showEdgeLabels) this._drawEdgeLabel(ctx,
                        bi.x + nx * off, bi.y + ny * off,
                        bj.x + nx * off, bj.y + ny * off,
                        edge.interlayerCount);
                }
                if (drawS) {
                    const lw = 1 + 3 * (edge.sharedCount / maxS);
                    ctx.beginPath();
                    ctx.moveTo(bi.x - nx * off, bi.y - ny * off);
                    ctx.lineTo(bj.x - nx * off, bj.y - ny * off);
                    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
                    ctx.lineWidth = lw;
                    ctx.stroke();
                    if (!edgeFaded && s.showEdgeLabels) this._drawEdgeLabel(ctx,
                        bi.x - nx * off, bi.y - ny * off,
                        bj.x - nx * off, bj.y - ny * off,
                        edge.sharedCount);
                }
                if (edgeFaded) ctx.globalAlpha = 1;
            }
        }

        // ── Bubbles ──
        for (const bubble of this._bubbles) {
            const faded = hl && !hl.has(bubble.layerName);
            if (faded) ctx.globalAlpha = 0.12;
            this._drawBubble(ctx, bubble);
            if (faded) ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    _drawEdgeLabel(ctx, x1, y1, x2, y2, value) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const sz = Math.max(9, 11 / this.viewScale);
        ctx.save();
        ctx.font = `${sz}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(50,50,80,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, mx, my - sz * 0.7);
        ctx.restore();
    }

    _drawBubble(ctx, bubble) {
        const { x, y, r, layerName } = bubble;
        const color = this._getBubbleColor(bubble);
        const micro = this._microGraphs.get(layerName);
        const s = this.settings;

        // Micro-graph (clipped inside bubble)
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (micro && (micro.links.length > 0 || micro.nodes.length > 0)) {
            ctx.save();
            ctx.translate(x, y);
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.6;
            for (const l of micro.links) {
                ctx.beginPath();
                ctx.moveTo(l.x1, l.y1);
                ctx.lineTo(l.x2, l.y2);
                ctx.stroke();
            }
            ctx.fillStyle = color + 'bb';
            for (const n of micro.nodes) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.restore();

        // Bubble border + tint
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + '28';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Label
        if (s.showLabels) {
            ctx.font = `bold ${s.labelFontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = '#222';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(layerName, x, y + r + 6);
        }
    }

    // ── Hit testing ────────────────────────────────────────────────────────

    hitTestBubble(mx, my, w, h) {
        const { lx, ly } = this._toLocal(mx, my, w, h);
        for (const b of this._bubbles) {
            if (Math.hypot(lx - b.x, ly - b.y) <= b.r) return b.layerName;
        }
        return null;
    }

    hitTestEdge(mx, my, w, h) {
        const { lx, ly } = this._toLocal(mx, my, w, h);
        for (const edge of this._metaEdges) {
            const bi = this._bubbles[edge.a], bj = this._bubbles[edge.b];
            if (this._distToSegment(lx, ly, bi.x, bi.y, bj.x, bj.y) <= 6 / this.viewScale) return edge;
        }
        return null;
    }

    _toLocal(mx, my, w, h) {
        return {
            lx: (mx - w / 2 - this.viewOffsetX) / this.viewScale,
            ly: (my - h / 2 - this.viewOffsetY) / this.viewScale,
        };
    }

    _distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        return Math.hypot(px - ax - t * dx, py - ay - t * dy);
    }

    getBubbleInfo(layerName) {
        return this._bubbles.find(b => b.layerName === layerName) || null;
    }
}


// ══════════════════════════════════════════════════════════════════════════
// DrillDownView — live force-directed network for a single layer
// ══════════════════════════════════════════════════════════════════════════

export class DrillDownView {
    constructor(model, layerName, layerPos, layerColorMap) {
        this.layerName   = layerName;
        this.viewScale   = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;
        this.alpha       = 1.0;  // start fully hot — settle from existing positions
        this.alphaDecay  = 0.01; // ~100 frames to cool
        this._draggedNode = null;
        this._nodes = [];
        this._links = [];
        this._layerColorMap = layerColorMap;
        this._buildSim(model, layerName, layerPos);
    }

    _buildSim(model, layerName, layerPos) {
        if (!layerPos || layerPos.size === 0) return;

        const nodeSet   = model.nodesPerLayer.get(layerName) || new Set();
        const allLayers = model.layers.map(l => l.layer_name);

        // Cross-layer presence map
        const presence = new Map();
        for (const nodeName of nodeSet) {
            const otherLayers = [];
            for (const [ln, ns] of model.nodesPerLayer) {
                if (ln !== layerName && ns.has(nodeName)) otherLayers.push(ln);
            }
            presence.set(nodeName, otherLayers);
        }

        const intraLinks = model.intralayerLinks.filter(l => l.layer_from === layerName);
        const degrees = new Map();
        for (const link of intraLinks) {
            degrees.set(link.node_from, (degrees.get(link.node_from) || 0) + 1);
            degrees.set(link.node_to,   (degrees.get(link.node_to)   || 0) + 1);
        }

        const MAX_NODES = 500;
        const sampledNodes = new Set(
            Array.from(nodeSet)
                .sort((a, b) => (degrees.get(b) || 0) - (degrees.get(a) || 0))
                .slice(0, MAX_NODES)
        );

        // Scale positions to ~360px-wide 0-centered space
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const name of sampledNodes) {
            const p = layerPos.get(name);
            if (!p) continue;
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        const rng = Math.max(maxX - minX, maxY - minY) || 1;
        const sc  = 300 / rng;

        const nodeIndex = new Map();
        const color = this._layerColorMap.get(layerName) || '#64748b';
        for (const name of sampledNodes) {
            const p = layerPos.get(name);
            if (!p) continue;
            const idx = this._nodes.length;
            nodeIndex.set(name, idx);
            this._nodes.push({
                name,
                x:  (p.x - (minX + maxX) / 2) * sc,
                y:  (p.y - (minY + maxY) / 2) * sc,
                fx: 0, fy: 0,
                r: 4,
                color,
                otherLayers: presence.get(name) || [],
                allLayers,
            });
        }

        // Links (cap at 1200)
        let linkCount = 0;
        for (const link of intraLinks) {
            if (linkCount >= 1200) break;
            const ai = nodeIndex.get(link.node_from);
            const bi = nodeIndex.get(link.node_to);
            if (ai !== undefined && bi !== undefined) {
                this._links.push({ a: ai, b: bi });
                linkCount++;
            }
        }
    }

    /** Advance simulation. Returns true while still animating. */
    tick() {
        const active = this.alpha > 0.001 || !!this._draggedNode;
        if (!active) return false;
        const steps = Math.ceil(3 * this.alpha + 1);
        for (let i = 0; i < steps; i++) this._stepForce();
        if (!this._draggedNode) this.alpha = Math.max(0, this.alpha - this.alphaDecay);
        return true;
    }

    _stepForce() {
        const nodes = this._nodes;
        const N = nodes.length;
        if (N === 0) return;

        // k: ideal spacing proportional to available space
        const k = Math.max(20, 280 / Math.sqrt(N));
        const maxDisp = k * this.alpha; // F-R temperature clamping

        for (const n of nodes) { n.fx = 0; n.fy = 0; }

        // Repulsion — stride for large N
        const stride = N > 150 ? Math.ceil(N / 150) : 1;
        for (let i = 0; i < N; i++) {
            for (let j = i + stride; j < N; j += stride) {
                const ni = nodes[i], nj = nodes[j];
                const dx = ni.x - nj.x, dy = ni.y - nj.y;
                const dist  = Math.sqrt(dx * dx + dy * dy) || 1;
                const minSep = ni.r + nj.r + 2;
                const d     = Math.max(dist, minSep);
                const force = (k * k) / d;
                const nx = dx / dist, ny = dy / dist;
                ni.fx += nx * force; ni.fy += ny * force;
                nj.fx -= nx * force; nj.fy -= ny * force;
            }
        }

        // Attraction along links
        for (const link of this._links) {
            const ni = nodes[link.a], nj = nodes[link.b];
            const dx   = nj.x - ni.x, dy = nj.y - ni.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist * dist) / k;
            const nx = dx / dist, ny = dy / dist;
            ni.fx += nx * force; ni.fy += ny * force;
            nj.fx -= nx * force; nj.fy -= ny * force;
        }

        // Center gravity
        for (const n of nodes) {
            n.fx -= n.x * 0.04;
            n.fy -= n.y * 0.04;
        }

        // Apply with F-R displacement clamping
        const dragged = this._draggedNode ? this._draggedNode.node : null;
        for (const n of nodes) {
            if (n === dragged) continue;
            const len  = Math.sqrt(n.fx * n.fx + n.fy * n.fy) || 1;
            const disp = Math.min(len, maxDisp);
            n.x += (n.fx / len) * disp;
            n.y += (n.fy / len) * disp;
        }
    }

    render(ctx, w, h) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        if (this._nodes.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '13px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No layout data', w / 2, h / 2);
            return;
        }

        ctx.save();
        ctx.translate(w / 2 + this.viewOffsetX, h / 2 + this.viewOffsetY);
        ctx.scale(this.viewScale, this.viewScale);

        // Links
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1 / this.viewScale;
        for (const link of this._links) {
            const ni = this._nodes[link.a], nj = this._nodes[link.b];
            ctx.beginPath();
            ctx.moveTo(ni.x, ni.y);
            ctx.lineTo(nj.x, nj.y);
            ctx.stroke();
        }

        // Nodes
        const allLayers = this._nodes[0]?.allLayers || [];
        for (const n of this._nodes) {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = n.color;
            ctx.fill();

            if (n.otherLayers.length > 0) {
                const arcR     = n.r + 3;
                const segAngle = (Math.PI * 2) / n.otherLayers.length;
                const arcLW    = 2.5 / this.viewScale;
                n.otherLayers.forEach((ln, idx) => {
                    const lIdx = allLayers.indexOf(ln);
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, arcR,
                        idx * segAngle - Math.PI / 2,
                        idx * segAngle - Math.PI / 2 + segAngle * 0.85);
                    ctx.strokeStyle = PALETTE[lIdx % PALETTE.length];
                    ctx.lineWidth   = arcLW;
                    ctx.stroke();
                });
            }
        }

        ctx.restore();
    }

    // ── Zoom / pan / node drag ─────────────────────────────────────────────

    _toLocal(mx, my, w, h) {
        return {
            lx: (mx - w / 2 - this.viewOffsetX) / this.viewScale,
            ly: (my - h / 2 - this.viewOffsetY) / this.viewScale,
        };
    }

    startDragNode(mx, my, w, h) {
        const { lx, ly } = this._toLocal(mx, my, w, h);
        const hitR = 8 / this.viewScale;
        for (const n of this._nodes) {
            if (Math.hypot(lx - n.x, ly - n.y) <= hitR) {
                this._draggedNode = { node: n, offsetX: lx - n.x, offsetY: ly - n.y };
                this.alpha = Math.max(this.alpha, 0.3);
                return n;
            }
        }
        return null;
    }

    moveDragNode(mx, my, w, h) {
        if (!this._draggedNode) return;
        const { lx, ly } = this._toLocal(mx, my, w, h);
        const { node, offsetX, offsetY } = this._draggedNode;
        node.x = lx - offsetX;
        node.y = ly - offsetY;
    }

    endDragNode() {
        if (this._draggedNode) {
            this._draggedNode = null;
            this.alpha = Math.max(this.alpha, 0.15);
        }
    }
}

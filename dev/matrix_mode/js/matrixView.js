/**
 * matrixView.js — Supra-Adjacency Matrix (SAM) rendering
 *
 * Renders the multilayer network as an (N×L) × (N×L) block matrix:
 *   - Rows/cols ordered by (layer, node): layer varies slowest, node fastest
 *   - Diagonal N×N blocks: intralayer edges (black)
 *   - Off-diagonal N×N blocks: interlayer edges (blue)
 *   - Each diagonal block has a stronger border frame
 *
 * Zoom/pan: viewScale and viewOffsetX/Y transform the matrix position.
 * The image is pre-built as an offscreen canvas and drawn with drawImage,
 * which respects the current matrix transform for smooth zoom/pan.
 */

const INTRA_COLOR = { r: 0,   g: 0,   b: 0   };  // black
const INTER_COLOR = { r: 37,  g: 99,  b: 235 };   // blue

export class MatrixView {
    constructor(model) {
        this.model = model;
        this._buildIndexMaps(model);

        // View state
        this.viewScale   = 1;
        this.viewOffsetX = 0;
        this.viewOffsetY = 0;

        // Pre-render the edge dots to an offscreen canvas
        this._buildImage();
    }

    _buildIndexMaps(model) {
        this.nodeIndex = new Map();
        model.nodes.forEach((node, i) => this.nodeIndex.set(node.node_name, i));
        this.N = model.nodes.length;

        this.layerIndex = new Map();
        model.layers.forEach((layer, i) => this.layerIndex.set(layer.layer_name, i));
        this.L = model.layers.length;

        this.total = this.N * this.L;
    }

    _buildImage() {
        const total = this.total;
        // One pixel per matrix cell, capped to avoid OOM
        const size = Math.min(total, 4096);
        this._imgSize = size;

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width  = size;
        tmpCanvas.height = size;
        this._imgCanvas = tmpCanvas;

        const tmpCtx  = tmpCanvas.getContext('2d');
        const imgData = tmpCtx.createImageData(size, size);
        const pixels  = imgData.data;

        // Fill white (fill sets all bytes; alpha=255 → opaque white)
        pixels.fill(255);

        const N = this.N;

        const paintPixel = (row, col, color) => {
            const px = Math.floor(col / total * size);
            const py = Math.floor(row / total * size);
            if (px < 0 || px >= size || py < 0 || py >= size) return;
            const idx = (py * size + px) * 4;
            pixels[idx]     = color.r;
            pixels[idx + 1] = color.g;
            pixels[idx + 2] = color.b;
            pixels[idx + 3] = 255;
        };

        for (const link of this.model.intralayerLinks) {
            const li = this.layerIndex.get(link.layer_from);
            const ni = this.nodeIndex.get(link.node_from);
            const nj = this.nodeIndex.get(link.node_to);
            if (li === undefined || ni === undefined || nj === undefined) continue;
            paintPixel(li * N + ni, li * N + nj, INTRA_COLOR);
        }

        for (const link of this.model.interlayerLinks) {
            const liA = this.layerIndex.get(link.layer_from);
            const liB = this.layerIndex.get(link.layer_to);
            const niA = this.nodeIndex.get(link.node_from);
            const niB = this.nodeIndex.get(link.node_to);
            if (liA === undefined || liB === undefined || niA === undefined || niB === undefined) continue;
            paintPixel(liA * N + niA, liB * N + niB, INTER_COLOR);
        }

        tmpCtx.putImageData(imgData, 0, 0);
    }

    /** Base matrix area (logical, at scale=1) given canvas dimensions. */
    _baseArea(w, h) {
        return Math.max(100, Math.min(w - 110, h - 110));
    }

    /**
     * Render the SAM to the given canvas 2D context at size w×h.
     */
    render(ctx, w, h) {
        const margin   = 100;
        const baseArea = this._baseArea(w, h);
        const matSize  = baseArea * this.viewScale;
        const matX     = margin + this.viewOffsetX;
        const matY     = margin + this.viewOffsetY;
        const L        = this.L;

        // --- Canvas background ---
        ctx.fillStyle = '#f8f8fc';
        ctx.fillRect(0, 0, w, h);

        // --- White matrix background ---
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(matX, matY, matSize, matSize);

        // --- Draw pre-built image (drawImage respects clipping, not transforms) ---
        ctx.drawImage(this._imgCanvas, matX, matY, matSize, matSize);

        // --- Block grid lines ---
        ctx.strokeStyle = 'rgba(160,160,190,0.5)';
        ctx.lineWidth = 0.5;
        for (let i = 1; i < L; i++) {
            const pos = i / L * matSize;
            ctx.beginPath(); ctx.moveTo(matX + pos, matY);          ctx.lineTo(matX + pos, matY + matSize); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(matX,        matY + pos);    ctx.lineTo(matX + matSize, matY + pos); ctx.stroke();
        }

        // --- Diagonal block borders (stronger) ---
        ctx.strokeStyle = 'rgba(30,30,30,0.75)';
        ctx.lineWidth = Math.max(0.5, 2);
        for (let i = 0; i < L; i++) {
            const x0 = matX + (i / L) * matSize;
            const x1 = matX + ((i + 1) / L) * matSize;
            ctx.strokeRect(x0, x0, x1 - x0, x1 - x0);
        }

        // --- Outer frame ---
        ctx.strokeStyle = 'rgba(40,40,60,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(matX, matY, matSize, matSize);

        // --- Axis labels (only if blocks wide enough on screen) ---
        const blockPx = matSize / L;
        if (blockPx > 24) {
            const fontSize = Math.min(13, Math.max(9, blockPx * 0.1));
            ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < L; i++) {
                const layerName = this.model.layers[i].layer_name;
                const blockMid  = (i + 0.5) / L * matSize;

                // Top label
                ctx.fillText(layerName, matX + blockMid, matY - 14);

                // Left label (rotated -90°)
                ctx.save();
                ctx.translate(matX - 14, matY + blockMid);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(layerName, 0, 0);
                ctx.restore();
            }
        }
    }

    /**
     * Given a canvas mouse position (in canvas pixels), return the state node
     * pair at that position, or null if outside the matrix.
     */
    hitTest(mx, my, w, h) {
        const margin   = 100;
        const baseArea = this._baseArea(w, h);
        const matSize  = baseArea * this.viewScale;
        const matX     = margin + this.viewOffsetX;
        const matY     = margin + this.viewOffsetY;

        const relX = mx - matX;
        const relY = my - matY;
        if (relX < 0 || relX >= matSize || relY < 0 || relY >= matSize) return null;

        const total    = this.total;
        const N        = this.N;
        const col      = Math.floor(relX / matSize * total);
        const row      = Math.floor(relY / matSize * total);
        const rowLayer = Math.floor(row / N);
        const rowNode  = row % N;
        const colLayer = Math.floor(col / N);
        const colNode  = col % N;

        const fromLayer = this.model.layers[rowLayer];
        const fromNode  = this.model.nodes[rowNode];
        const toLayer   = this.model.layers[colLayer];
        const toNode    = this.model.nodes[colNode];

        if (!fromLayer || !fromNode || !toLayer || !toNode) return null;

        return {
            fromLayer: fromLayer.layer_name,
            fromNode:  fromNode.node_name,
            toLayer:   toLayer.layer_name,
            toNode:    toNode.node_name,
        };
    }
}

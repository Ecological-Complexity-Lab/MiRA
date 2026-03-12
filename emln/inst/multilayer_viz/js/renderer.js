/**
 * renderer.js — Canvas 3D-perspective rendering engine for multilayer networks
 *
 * Renders layers as tilted parallelograms with nodes and links,
 * using an oblique projection to create a 3D stacking effect.
 */

import { defaultColorMapper, BIPARTITE_SET_A_COLOR, BIPARTITE_SET_B_COLOR } from './colorMapper.js';

export class Renderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Layer geometry
        this.layerWidth = options.layerWidth || 350;
        this.layerHeight = options.layerHeight || 250;
        this.layerSpacing = options.layerSpacing || 300; // depth gap between layers
        this.skewX = options.skewX || 0.7;               // Y-axis rotation angle (radians)
        this.skewY = options.skewY || 0.55;              // X-axis rotation angle (radians)

        // Stacking mode: 'horizontal' (depth/Z) or 'vertical' (Y-axis, top-to-bottom)
        this.stackMode = options.stackMode || 'horizontal';

        // Node appearance
        this.nodeRadius = options.nodeRadius || 10;
        this.nodeStrokeWidth = 2;
        this.showLabels = true;
        this.transformNodes = false;
        this.showInterlayerLinks = true;
        this.showLayerNames = options.showLayerNames || false;
        this.showSetNames = options.showSetNames || false;
        this.labelFont = '12px Inter, system-ui, sans-serif';
        this.layerLabelFont = 'bold 14px Inter, system-ui, sans-serif';

        // State
        this.model = null;
        this.positions = null;  // Map: layerName -> Map(nodeName -> {x,y})
        this.colorMapper = defaultColorMapper;

        // View transform
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;

        // Per-layer offsets for independent dragging (layerIndex -> {dx, dy})
        this.layerOffsets = new Map();

        // Interaction state
        this.hoveredNode = null;  // { layerName, nodeName }
        this.selectedNode = null; // { layerName, nodeName }
        this.selectedLayer = null; // layerIndex or null
        this.searchedNodeName = null; // node_name string — highlights all instances across layers

        // Color-by functions
        this.nodeColorFn = null;
        this.nodeSizeFn = null;
        this.linkColorFn = null;
        this.layerColorFn = null; // (layerIndex, layer) -> { fill, border, text }

        this.showMapBackground = false;
        this.isMapMode = false;

        // Bipartite support
        this.bipartiteInfo = null; // Map<layerName, { isBipartite, setA, setB, setALabel, setBLabel }>
        this.layoutType = 'fruchterman'; // Current layout type (needed to know when to render bipartite)
    }

    setData(model, positions) {
        this.model = model;
        this.positions = positions;
    }

    /**
     * Project a point from layer-local (x, y) + layerIndex into screen coordinates.
     * Uses 3D rotation + orthographic projection.
     * Supports horizontal (depth/Z) and vertical (Y-axis) stacking modes.
     */
    project(x, y, layerIndex) {
        const halfW = this.layerWidth / 2;
        const halfH = this.layerHeight / 2;
        const lx = x - halfW;
        const ly = y - halfH;

        // Per-layer offset (screen-space)
        const lo = this.layerOffsets.get(layerIndex) || { dx: 0, dy: 0 };

        const layer = this.model && this.model.layers[layerIndex] ? this.model.layers[layerIndex] : null;
        let hasGeo = false;
        let geoCenter = null;
        if (this.isMapMode && this.bgMap && layer) {
            const latVal = layer.latitude !== undefined ? layer.latitude : layer.Latitude;
            const lngVal = layer.longitude !== undefined ? layer.longitude : layer.Longitude;
            if (latVal !== undefined && lngVal !== undefined) {
                const lat = parseFloat(latVal);
                const lng = parseFloat(lngVal);
                if (!isNaN(lat) && !isNaN(lng)) {
                    geoCenter = this.bgMap.latLngToContainerPoint([lat, lng]);
                    hasGeo = true;
                }
            }
        }

        if (hasGeo) {
            // Isometric projection applied flat on the container point
            const shear = Math.cos(this.skewX) * 0.65;
            const yCompress = Math.sin(this.skewY) * 0.85;

            // Notice we add (lx + ly * shear) scaled by this.scale, centered on geoCenter
            const sx = (lx + ly * shear) * this.scale;
            const sy = (ly * yCompress) * this.scale;

            return {
                x: geoCenter.x + sx + lo.dx,
                y: geoCenter.y + sy + lo.dy,
            };
        }

        if (this.stackMode === 'vertical') {
            // Isometric projection: layers are horizontal planes viewed from above,
            // stacked vertically (like the classic multiplex network diagram).
            // skewX controls horizontal shear, skewY controls vertical compression
            const shear = Math.cos(this.skewX) * 0.65;
            const yCompress = Math.sin(this.skewY) * 0.85;

            const sx = lx + ly * shear + halfW;
            const sy = ly * yCompress + halfH + layerIndex * this.layerSpacing;

            return {
                x: sx * this.scale + this.offsetX + lo.dx,
                y: sy * this.scale + this.offsetY + lo.dy,
            };
        }

        // Horizontal stacking (default): layers recede in depth (Z)
        const lz = layerIndex * this.layerSpacing;

        const cosY = Math.cos(this.skewX);
        const sinY = Math.sin(this.skewX);
        const rx = lx * cosY + lz * sinY;
        const rz = -lx * sinY + lz * cosY;

        const cosX = Math.cos(this.skewY);
        const sinX = Math.sin(this.skewY);
        const ry = ly * cosX - rz * sinX;

        const sx = rx + halfW;
        const sy = ry + halfH;

        return {
            x: sx * this.scale + this.offsetX + lo.dx,
            y: sy * this.scale + this.offsetY + lo.dy,
        };
    }

    /**
     * Get the four corners of a layer polygon in screen space.
     * We expand the polygon slightly beyond the layout coordinate space
     * so that nodes clamped near the boundary (with their screen-space radius)
     * still appear fully inside the polygon.
     */
    getLayerCorners(layerIndex) {
        const m = 20; // margin beyond layout bounds for visual containment
        return [
            this.project(-m, -m, layerIndex),
            this.project(this.layerWidth + m, -m, layerIndex),
            this.project(this.layerWidth + m, this.layerHeight + m, layerIndex),
            this.project(-m, this.layerHeight + m, layerIndex),
        ];
    }

    /**
     * Get screen position of a node
     */
    getNodeScreenPos(layerName, nodeName) {
        if (!this.positions || !this.model) return null;
        const layerPositions = this.positions.get(layerName);
        if (!layerPositions) return null;
        const pos = layerPositions.get(nodeName);
        if (!pos) return null;

        const layer = this.model.layersByName.get(layerName);
        if (!layer) return null;

        const layerIndex = this.model.layers.indexOf(layer);
        return this.project(pos.x, pos.y, layerIndex);
    }

    /**
     * Hit test: find node at screen position (sx, sy)
     */
    hitTestNode(sx, sy) {
        if (!this.model || !this.positions) return null;

        const hitRadius = this.nodeRadius * this.scale + 4;

        // Test back-to-front (front layers have priority)
        for (let i = this.model.layers.length - 1; i >= 0; i--) {
            const layer = this.model.layers[i];
            const layerPos = this.positions.get(layer.layer_name);
            if (!layerPos) continue;

            for (const [nodeName, pos] of layerPos) {
                const sp = this.project(pos.x, pos.y, i);
                const dx = sx - sp.x;
                const dy = sy - sp.y;
                if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                    return { layerName: layer.layer_name, nodeName, layerIndex: i };
                }
            }
        }
        return null;
    }

    /**
     * Hit test: find link near screen position (sx, sy)
     */
    hitTestLink(sx, sy) {
        if (!this.model || !this.positions) return null;
        const threshold = 6; // pixels distance to register a hit

        let closestLink = null;
        let minDist = Infinity;

        // Helper: distance from point (px, py) to line segment (A, B)
        const distToSegment = (px, py, A, B) => {
            const l2 = (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
            if (l2 === 0) return Math.sqrt((px - A.x) ** 2 + (py - A.y) ** 2);
            let t = ((px - A.x) * (B.x - A.x) + (py - A.y) * (B.y - A.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const vx = A.x + t * (B.x - A.x);
            const vy = A.y + t * (B.y - A.y);
            return Math.sqrt((px - vx) ** 2 + (py - vy) ** 2);
        };

        // 1. Check Interlayer links (curved) - tested first as they are drawn on top
        if (this.showInterlayerLinks) {
            for (const link of this.model.interlayerLinks) {
                const fromScreen = this.getNodeScreenPos(link.layer_from, link.node_from);
                const toScreen = this.getNodeScreenPos(link.layer_to, link.node_to);
                if (!fromScreen || !toScreen) continue;

                // Reconstruct the curve control point exactly as in _drawInterlayerLinks
                const mx = (fromScreen.x + toScreen.x) / 2;
                const my = (fromScreen.y + toScreen.y) / 2;
                const dx = toScreen.x - fromScreen.x;
                const dy = toScreen.y - fromScreen.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const curvature = dist * 0.35;
                const cpx = mx + (dy / dist) * curvature;
                const cpy = my - (dx / dist) * curvature;

                // Sample curve at 10 intervals to find distance to the pointer
                let prevP = fromScreen;
                for (let i = 1; i <= 10; i++) {
                    const t = i / 10;
                    const mt = 1 - t;
                    const px = mt * mt * fromScreen.x + 2 * mt * t * cpx + t * t * toScreen.x;
                    const py = mt * mt * fromScreen.y + 2 * mt * t * cpy + t * t * toScreen.y;
                    const pCurrent = { x: px, y: py };
                    const d = distToSegment(sx, sy, prevP, pCurrent);
                    if (d < minDist && d <= threshold) {
                        minDist = d;
                        closestLink = { ...link, isInterlayer: true };
                    }
                    prevP = pCurrent;
                }
            }
        }

        // 2. Check Intralayer links (straight lines) - back-to-front
        for (let i = this.model.layers.length - 1; i >= 0; i--) {
            const layer = this.model.layers[i];
            const links = this.model.intralayerLinks.filter(l => l.layer_from === layer.layer_name);
            const layerPos = this.positions.get(layer.layer_name);
            if (!layerPos) continue;

            for (const link of links) {
                const fromPos = layerPos.get(link.node_from);
                const toPos = layerPos.get(link.node_to);
                if (!fromPos || !toPos) continue;

                const from = this.project(fromPos.x, fromPos.y, i);
                const to = this.project(toPos.x, toPos.y, i);

                const d = distToSegment(sx, sy, from, to);
                if (d < minDist && d <= threshold) {
                    minDist = d;
                    closestLink = { ...link, isInterlayer: false };
                }
            }
        }

        return closestLink;
    }


    /**
     * Hit test: find which layer polygon contains the screen point (sx, sy).
     * Uses a ray-casting point-in-polygon test on the 4 projected corners.
     * Returns the layerIndex (front layers tested first), or -1 if none.
     */
    hitTestLayer(sx, sy) {
        if (!this.model) return -1;
        for (let i = this.model.layers.length - 1; i >= 0; i--) {
            const corners = this.getLayerCorners(i);
            if (this._pointInPolygon(sx, sy, corners)) return i;
        }
        return -1;
    }

    /** Ray-casting point-in-polygon test */
    _pointInPolygon(px, py, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /** Reset all per-layer offsets */
    resetLayerOffsets() {
        this.layerOffsets.clear();
    }

    /**
     * Main render loop
     */
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.clearRect(0, 0, w, h);
        this.renderToContext(ctx, w, h);

        if (this.onRender) this.onRender();
    }

    /**
     * Render the full visualization to an arbitrary Canvas2D-compatible context.
     * Used by render() for on-screen drawing and by PDF export for vector output.
     */
    renderToContext(ctx, w, h) {
        // Background
        if (!this.showMapBackground) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
        }

        // Subtle grid
        if (this.showGrid !== false && !this.showMapBackground) {
            this._drawGrid(ctx, w, h);
        }

        if (!this.model || !this.positions) {
            this._drawPlaceholder(ctx, w, h);
            return;
        }

        const numLayers = this.model.layers.length;

        // Draw back-to-front: layer polygon, intralayer links, nodes
        for (let i = 0; i < numLayers; i++) {
            const layer = this.model.layers[i];
            const layerPos = this.positions.get(layer.layer_name);
            if (!layerPos) continue;

            // In Map Mode, only render popped-out active map layers
            if (this.activeMapLayers && !this.activeMapLayers.has(layer.layer_name)) continue;

            // Draw layer polygon
            this._drawLayerPolygon(ctx, i, layer);

            // Draw intralayer links for this layer
            this._drawIntralayerLinks(ctx, i, layer);

            // Draw nodes
            this._drawLayerNodes(ctx, i, layer, layerPos);
        }

        // Draw interlayer links on top of everything
        if (this.showInterlayerLinks) {
            this._drawInterlayerLinks(ctx);
        }

        // Draw hover/selection highlights on top
        this._drawHighlights(ctx);
    }

    _drawGrid(ctx, w, h) {
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 1;
        const step = 40 * this.scale;
        const ox = this.offsetX % step;
        const oy = this.offsetY % step;

        for (let x = ox; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = oy; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    _drawPlaceholder(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.font = '18px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Load a multilayer network to visualize', w / 2, h / 2 - 10);
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillText('Upload a JSON file or click "Load Demo"', w / 2, h / 2 + 20);
        ctx.textAlign = 'left';
    }

    _drawLayerPolygon(ctx, layerIndex, layer) {
        const corners = this.getLayerCorners(layerIndex);

        // Fill
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        const layerColors = this.layerColorFn
            ? this.layerColorFn(layerIndex, layer)
            : { fill: this.colorMapper.getLayerFill(), border: this.colorMapper.getLayerBorder(), text: 'rgba(139,92,246,1)' };
        ctx.fillStyle = layerColors.fill;
        ctx.fill();

        // Border
        ctx.strokeStyle = layerColors.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Compute X-axis direction (bottom edge) for oriented text
        const xA = this.project(0, 0, layerIndex);
        const xB = this.project(this.layerWidth, 0, layerIndex);
        const xAngle = Math.atan2(xB.y - xA.y, xB.x - xA.x);

        // Layer label — oriented along the bottom (X-axis) edge
        if (this.showLayerNames) {
            const anchor = this.project(this.layerWidth / 2, this.layerHeight + 28, layerIndex);
            ctx.save();
            ctx.translate(anchor.x, anchor.y);
            ctx.rotate(xAngle);
            ctx.font = 'bold 15px Inter, system-ui, sans-serif';
            ctx.fillStyle = layerColors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(layer.layer_name, 0, 0);
            ctx.restore();
        }

        // Bipartite set labels — oriented along the top/bottom (X-axis) edge
        if (this.showSetNames && this.layoutType === 'bipartite' && this.bipartiteInfo) {
            const bpInfo = this.bipartiteInfo.get(layer.layer_name);
            if (bpInfo && bpInfo.isBipartite) {
                ctx.save();
                ctx.font = '600 11px Inter, system-ui, sans-serif';

                // Set A label (top edge)
                const topAnchor = this.project(this.layerWidth / 2, -12, layerIndex);
                ctx.save();
                ctx.translate(topAnchor.x, topAnchor.y);
                ctx.rotate(xAngle);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillStyle = BIPARTITE_SET_A_COLOR;
                ctx.fillText(bpInfo.setALabel, 0, 0);
                ctx.restore();

                // Set B label (bottom edge)
                const botAnchor = this.project(this.layerWidth / 2, this.layerHeight + 12, layerIndex);
                ctx.save();
                ctx.translate(botAnchor.x, botAnchor.y);
                ctx.rotate(xAngle);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = BIPARTITE_SET_B_COLOR;
                ctx.fillText(bpInfo.setBLabel, 0, 0);
                ctx.restore();

                ctx.restore();
            }
        }
    }

    _drawIntralayerLinks(ctx, layerIndex, layer) {
        const links = this.model.intralayerLinks.filter(l => l.layer_from === layer.layer_name);
        const layerPos = this.positions.get(layer.layer_name);
        if (!layerPos) return;

        // Check if this layer is rendered as bipartite
        const isBipartiteLayout = this.layoutType === 'bipartite' && this.bipartiteInfo;
        const bpInfo = isBipartiteLayout ? this.bipartiteInfo.get(layer.layer_name) : null;
        const useBipartiteGradient = bpInfo && bpInfo.isBipartite;

        for (const link of links) {
            const fromPos = layerPos.get(link.node_from);
            const toPos = layerPos.get(link.node_to);
            if (!fromPos || !toPos) continue;

            const from = this.project(fromPos.x, fromPos.y, layerIndex);
            const to = this.project(toPos.x, toPos.y, layerIndex);

            // Determine color
            let color;
            if (this.linkColorFn) {
                color = this.linkColorFn(link);
            } else if (useBipartiteGradient) {
                // Black links for bipartite intralayer
                color = 'rgba(0,0,0,0.85)';
            } else {
                color = 'rgba(0,0,0,0.85)';
            }

            // Check if connected to hovered/selected node
            const isHighlighted = this._isLinkHighlighted(link);

            const baseWidth = link.weight ? Math.min(link.weight * 2, 8) : 2;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.strokeStyle = isHighlighted && typeof color === 'string' ? this._brighten(color) : color;
            ctx.lineWidth = isHighlighted ? baseWidth + 2 : baseWidth;
            ctx.globalAlpha = isHighlighted ? 1 : (useBipartiteGradient ? 0.5 : 0.9);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Arrowhead for directed links
            if (link.directed) {
                this._drawArrowhead(ctx, from.x, from.y, to.x, to.y, 14 + baseWidth * 1.5, ctx.strokeStyle, isHighlighted ? 1 : 0.9);
            }
        }
    }

    _drawInterlayerLinks(ctx) {
        for (const link of this.model.interlayerLinks) {
            // In Map Mode, only render links if BOTH connect to active map layers
            if (this.activeMapLayers && (!this.activeMapLayers.has(link.layer_from) || !this.activeMapLayers.has(link.layer_to))) {
                continue;
            }

            const fromScreen = this.getNodeScreenPos(link.layer_from, link.node_from);
            const toScreen = this.getNodeScreenPos(link.layer_to, link.node_to);
            if (!fromScreen || !toScreen) continue;

            let color = 'rgba(30,100,220,0.8)';
            if (this.linkColorFn) {
                color = this.linkColorFn(link);
            }

            const isHighlighted = this._isLinkHighlighted(link);

            // Compute curved control point — offset perpendicular to the line
            const mx = (fromScreen.x + toScreen.x) / 2;
            const my = (fromScreen.y + toScreen.y) / 2;
            const dx = toScreen.x - fromScreen.x;
            const dy = toScreen.y - fromScreen.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            // Perpendicular direction, with curvature proportional to distance
            const curvature = dist * 0.35;
            const cpx = mx + (dy / dist) * curvature;
            const cpy = my - (dx / dist) * curvature;

            const baseWidth = link.weight ? Math.min(link.weight * 1.5, 6) : 2;
            ctx.beginPath();
            ctx.moveTo(fromScreen.x, fromScreen.y);
            ctx.quadraticCurveTo(cpx, cpy, toScreen.x, toScreen.y);
            ctx.strokeStyle = isHighlighted ? this._brighten(color) : color;
            ctx.lineWidth = isHighlighted ? baseWidth + 2 : baseWidth;
            ctx.globalAlpha = isHighlighted ? 1 : 0.7;
            ctx.setLineDash([6, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;

            // Arrowhead for directed links — compute tangent at curve endpoint
            if (link.directed) {
                // Tangent at t=1 of quadratic Bézier: direction from control point to end
                const tangentX = toScreen.x - cpx;
                const tangentY = toScreen.y - cpy;
                const fakeFromX = toScreen.x - tangentX;
                const fakeFromY = toScreen.y - tangentY;
                this._drawArrowhead(ctx, fakeFromX, fakeFromY, toScreen.x, toScreen.y, 14 + baseWidth * 1.5, ctx.strokeStyle, isHighlighted ? 1 : 0.7);
            }
        }
    }

    _drawLayerNodes(ctx, layerIndex, layer, layerPos) {
        // Check if this layer is rendered as bipartite
        const isBipartiteLayout = this.layoutType === 'bipartite' && this.bipartiteInfo;
        const bpInfo = isBipartiteLayout ? this.bipartiteInfo.get(layer.layer_name) : null;
        const useBipartiteColors = bpInfo && bpInfo.isBipartite;


        // Calculate transformation matrix for nodes if enabled
        let ta = 1, tb = 0, tc = 0, td = 1;
        if (this.transformNodes) {
            if (this.stackMode === 'vertical') {
                ta = 1;
                tb = 0;
                tc = Math.cos(this.skewX) * 0.65;
                td = Math.sin(this.skewY) * 0.85;
            } else {
                ta = Math.cos(this.skewX);
                tb = Math.sin(this.skewX) * Math.sin(this.skewY);
                tc = 0;
                td = Math.cos(this.skewY);
            }
        }

        for (const [nodeName, pos] of layerPos) {
            const sp = this.project(pos.x, pos.y, layerIndex);

            // Apply Size By function if present
            let sizeMultiplier = 1.0;
            if (this.nodeSizeFn) {
                sizeMultiplier = this.nodeSizeFn(layer.layer_name, nodeName);
            }
            let r = this.nodeRadius * this.scale * sizeMultiplier;

            // Defend against negative radii (can happen if normalized mapping has edge cases)
            if (r < 0) r = 0;

            // Determine color
            let fillColor = this.colorMapper.getNodeLayerColor(layerIndex);
            if (this.nodeColorFn) {
                fillColor = this.nodeColorFn(layer.layer_name, nodeName);
            } else if (useBipartiteColors) {
                fillColor = this.colorMapper.getBipartiteNodeColor(bpInfo.setA.has(nodeName));
            }

            const isHovered = this.hoveredNode &&
                this.hoveredNode.layerName === layer.layer_name &&
                this.hoveredNode.nodeName === nodeName;
            const isSelected = this.selectedNode &&
                this.selectedNode.layerName === layer.layer_name &&
                this.selectedNode.nodeName === nodeName;
            const isSearched = !!this.searchedNodeName && nodeName === this.searchedNodeName;

            // Glow effect for hovered/selected/searched
            if (isHovered || isSelected || isSearched) {
                ctx.save();
                ctx.translate(sp.x, sp.y);
                if (this.transformNodes) ctx.transform(ta, tb, tc, td, 0, 0);

                ctx.beginPath();
                ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
                ctx.fillStyle = (isSelected || isSearched)
                    ? 'rgba(250, 204, 21, 0.25)'
                    : 'rgba(0,0,0,0.08)';
                ctx.fill();
                ctx.restore();
            }

            // Node circle
            ctx.save();
            ctx.translate(sp.x, sp.y);
            if (this.transformNodes) ctx.transform(ta, tb, tc, td, 0, 0);

            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();

            ctx.strokeStyle = (isSelected || isSearched)
                ? '#facc15'
                : isHovered
                    ? '#333333'
                    : 'rgba(0,0,0,0.2)';
            ctx.lineWidth = (isSelected || isSearched) ? 2.5 : this.nodeStrokeWidth;
            ctx.stroke();

            ctx.restore();

            // Label
            if (this.showLabels) {
                ctx.font = this.labelFont;
                ctx.fillStyle = 'rgba(0,0,0,0.75)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(nodeName, sp.x, sp.y + r + 4);
            }
        }
    }

    _drawHighlights(ctx) {
        // Nothing extra needed — highlights are drawn inline
    }

    _isLinkHighlighted(link) {
        // Direct link highlight
        if (this.hoveredLink && this.hoveredLink.node_from === link.node_from &&
            this.hoveredLink.node_to === link.node_to &&
            this.hoveredLink.layer_from === link.layer_from &&
            this.hoveredLink.layer_to === link.layer_to) {
            return true;
        }
        if (this.selectedLink && this.selectedLink.node_from === link.node_from &&
            this.selectedLink.node_to === link.node_to &&
            this.selectedLink.layer_from === link.layer_from &&
            this.selectedLink.layer_to === link.layer_to) {
            return true;
        }

        // Highlight based on search (all instances across layers)
        if (this.searchedNodeName) {
            return link.node_from === this.searchedNodeName || link.node_to === this.searchedNodeName;
        }

        // Highlight based on node hover/selection
        const target = this.hoveredNode || this.selectedNode;
        if (!target) return false;
        return (
            (link.layer_from === target.layerName && link.node_from === target.nodeName) ||
            (link.layer_to === target.layerName && link.node_to === target.nodeName)
        );
    }

    _brighten(color) {
        // Simple brighten: return white-ish version
        if (color.startsWith('rgba')) {
            return color.replace(/[\d.]+\)$/, '0.9)');
        }
        return '#ffffff';
    }

    /**
     * Draw an arrowhead at the end of a line.
     */
    _drawArrowhead(ctx, fromX, fromY, toX, toY, size, color, alpha) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const r = this.nodeRadius * this.scale;
        // Position arrowhead at the edge of the target node
        const tipX = toX - r * Math.cos(angle);
        const tipY = toY - r * Math.sin(angle);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(
            tipX - size * Math.cos(angle - Math.PI / 6),
            tipY - size * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            tipX - size * Math.cos(angle + Math.PI / 6),
            tipY - size * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
   * Center the visualization in the canvas
   */
    centerView() {
        if (!this.model) return;
        const numLayers = this.model.layers.length;

        // Temporarily reset transform to compute raw projected bounds
        const savedScale = this.scale;
        const savedOX = this.offsetX;
        const savedOY = this.offsetY;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Compute bounding box of all projected layer corners
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < numLayers; i++) {
            const corners = this.getLayerCorners(i);
            for (const c of corners) {
                minX = Math.min(minX, c.x);
                minY = Math.min(minY, c.y);
                maxX = Math.max(maxX, c.x);
                maxY = Math.max(maxY, c.y);
            }
        }

        const rawWidth = maxX - minX;
        const rawHeight = maxY - minY;

        // Compute scale to fit with padding
        const padX = 120;
        const padY = 80;
        const availW = this.canvas.width - padX;
        const availH = this.canvas.height - padY;
        this.scale = Math.min(availW / rawWidth, availH / rawHeight, 1.8);

        // Compute center offset so projected bounding box is centered
        const scaledW = rawWidth * this.scale;
        const scaledH = rawHeight * this.scale;
        this.offsetX = (this.canvas.width - scaledW) / 2 - minX * this.scale;
        this.offsetY = (this.canvas.height - scaledH) / 2 - minY * this.scale;
    }
}

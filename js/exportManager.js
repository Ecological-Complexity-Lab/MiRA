/**
 * exportManager.js — Screenshot export (PNG / JPG / PDF).
 *
 * Owns the export-dialog UI and the pixel-pipeline for producing high-res
 * raster and vector output:
 *   - Opens/closes the export dialog.
 *   - For PNG/JPG: re-renders at multiplier× resolution (non-map modes) or
 *     stretches the screen-size canvas into a larger offscreen (map /
 *     layer-geo modes, where Leaflet anchors coordinates in screen pixels).
 *   - Composites Leaflet map tiles + markers + legend + drill/compare panels
 *     via html2canvas, draws a branding badge, and saves via the File System
 *     Access API (or a download-link fallback).
 *   - For PDF: fixed 4× DPI, jsPDF container at original CSS-pixel page size.
 *
 * External dependencies (passed via init):
 *   - getRenderer() → current Renderer instance
 *   - getAppMode()  → current app mode string ('network'|'map'|'layer'|…)
 *
 * All DOM refs are queried inside the module via document.getElementById().
 */

// Quality label → multiplier mapping
const QUALITY_LABELS = { '1': 'screen', '2': 'high', '4': 'print' };

export function initExportManager({ getRenderer, getAppMode }) {
    const captureBtn      = document.getElementById('captureBtn');
    const exportDialog    = document.getElementById('exportDialog');
    const exportCancelBtn = document.getElementById('exportCancelBtn');

    captureBtn.addEventListener('click', () => {
        const renderer = getRenderer();
        const appMode  = getAppMode();
        const hasMap = appMode === 'map' || (appMode === 'layer' && renderer.layerView?.geoMode);
        const gridLabel = exportDialog.querySelector('#exportGridCheckbox + span');
        if (gridLabel) gridLabel.textContent = hasMap ? 'Background map / grid' : 'Background grid';
        exportDialog.style.display = 'flex';

        // Warm up the heavy libraries while the dialog is visible, so the gap
        // between clicking a format and triggering the save is minimised.
        _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js').catch(() => {});
        _loadScript('https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js').catch(() => {});
    });

    exportCancelBtn.addEventListener('click', () => {
        exportDialog.style.display = 'none';
    });

    // Close on overlay click
    exportDialog.addEventListener('click', (e) => {
        if (e.target === exportDialog) exportDialog.style.display = 'none';
    });

    // Format buttons (including "all")
    exportDialog.querySelectorAll('[data-format]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            const format = btn.dataset.format;
            exportDialog.style.display = 'none';

            // Pick a destination folder once while the user gesture is fresh.
            // All files for this export go there. On browsers without
            // showDirectoryPicker (Firefox, Safari) this returns null and each
            // file falls back to a standard browser download.
            const dirHandle = await _pickDirectory();

            const formats = format === 'all' ? ['png', 'jpg', 'pdf'] : [format];
            for (const fmt of formats) {
                await exportScreenshot(fmt, dirHandle);
            }
        });
    });

    // ── Filename builder ──────────────────────────────────────────────────
    // Returns e.g. "mycanary_net_high.png", "vitali_map_print.pdf"
    function _buildFilename(format) {
        const rawName = (document.getElementById('exportNameInput').value.trim() || 'network')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 10);
        const appMode  = getAppMode();
        const modeMap  = { network: 'net', map: 'map', layer: 'layer',
                           metanetwork: 'meta', dashboard: 'dash', data: 'data' };
        const modeStr  = `_${modeMap[appMode] || appMode}`;
        const resolution  = document.getElementById('exportResolutionSelect').value;
        const qualityStr  = `_${QUALITY_LABELS[resolution] || resolution + 'x'}`;
        return `${rawName}${modeStr}${qualityStr}.${format}`;
    }

    // ── Directory picker ──────────────────────────────────────────────────
    // Called ONCE before any rendering so the user gesture is still fresh.
    // Returns a FileSystemDirectoryHandle, or null if unsupported/cancelled.
    async function _pickDirectory() {
        if (!window.showDirectoryPicker) return null;
        try {
            return await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch (err) {
            if (err.name !== 'AbortError')
                console.warn('Directory picker failed:', err.name, err.message);
            return null;
        }
    }

    // ── Dynamic script loader ─────────────────────────────────────────────
    async function _loadScript(src) {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            // Already loaded successfully — nothing to do
            if (existing.dataset.loaded) return;
            // Still in flight — wait for it
            return new Promise((resolve, reject) => {
                existing.addEventListener('load',  resolve, { once: true });
                existing.addEventListener('error', reject,  { once: true });
            });
        }
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload  = () => { s.dataset.loaded = '1'; resolve(); };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // ── Composite visible overlay panels onto offscreen canvas ────────────
    // Captures legend + drill/compare panels (if open) and draws them at
    // their screen positions, scaled to match the export resolution.
    async function _compositeOverlays(ctx, scale) {
        await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

        const panels = [];

        // Legend
        const lp = document.getElementById('legendPanel');
        if (lp && lp.children.length > 0) panels.push(lp);

        // Layer stats / compare panels (only meaningful in layer view)
        const drill = document.getElementById('layerDrillPanel');
        if (drill && drill.style.opacity === '1') panels.push(drill);

        const compare = document.getElementById('layerComparePanel');
        if (compare && compare.style.opacity === '1') panels.push(compare);

        for (const el of panels) {
            const rect = el.getBoundingClientRect();
            try {
                const panelCanvas = await html2canvas(el, {
                    scale,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    logging: false,
                });
                ctx.drawImage(panelCanvas, rect.left * scale, rect.top * scale,
                    rect.width * scale, rect.height * scale);
            } catch (e) {
                console.warn('Panel capture failed for', el.id, e);
            }
        }
    }

    async function exportScreenshot(format, dirHandle) {
        if (format === 'pdf') { await _exportPDF(dirHandle); return; }
        const filename = _buildFilename(format);

        const renderer = getRenderer();
        const appMode  = getAppMode();

        const srcCanvas   = document.getElementById('networkCanvas');
        const multiplier  = parseInt(document.getElementById('exportResolutionSelect').value) || 1;
        const includeGrid   = document.getElementById('exportGridCheckbox').checked;
        const includePanels = document.getElementById('exportPanelsCheckbox').checked;

        // In map/geo modes, layer positions come from Leaflet's latLngToContainerPoint()
        // which is always in screen-space pixels. Scaling the renderer transforms would
        // shift the network off its geographic anchors, so we capture at screen resolution
        // and stretch — position stays correct, resolution benefit applies to non-map modes.
        const isLvGeo = appMode === 'layer' && renderer.layerView?.geoMode;
        const isGeoMode = appMode === 'map' || isLvGeo;

        const origW = srcCanvas.width, origH = srcCanvas.height;
        const prevShowGrid = renderer.showGrid;

        if (!isGeoMode) {
            // Non-map modes: genuinely re-render at multiplier× resolution
            const origOX = renderer.offsetX, origOY = renderer.offsetY;
            const origS  = renderer.scale;

            srcCanvas.width  = origW  * multiplier;
            srcCanvas.height = origH * multiplier;
            renderer.offsetX = origOX * multiplier;
            renderer.offsetY = origOY * multiplier;
            renderer.scale   = origS  * multiplier;
            renderer.showGrid = includeGrid;
            renderer.render();

            const W = srcCanvas.width, H = srcCanvas.height;
            const offscreen = document.createElement('canvas');
            offscreen.width = W; offscreen.height = H;
            const ctx = offscreen.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(srcCanvas, 0, 0, W, H);

            srcCanvas.width  = origW;
            srcCanvas.height = origH;
            renderer.offsetX = origOX;
            renderer.offsetY = origOY;
            renderer.scale   = origS;
            renderer.showGrid = prevShowGrid;
            renderer.render();

            if (includePanels) await _compositeOverlays(ctx, multiplier);
            _drawBranding(ctx, W, H, multiplier);
            const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
            const quality  = format === 'jpg' ? 0.92 : undefined;
            await _saveCanvas(offscreen, filename, mimeType, quality, dirHandle);
            return;
        }

        // Map / geo-layer modes: capture at screen res, stretch into multiplier× offscreen
        renderer.showGrid = includeGrid;
        renderer.render();

        const W = origW * multiplier, H = origH * multiplier;
        const offscreen = document.createElement('canvas');
        offscreen.width = W; offscreen.height = H;
        const ctx = offscreen.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        if (includeGrid) {
            try {
                await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                const mapEl = document.getElementById(appMode === 'map' ? 'backgroundMap' : 'lvBackgroundMap');
                const mapCanvas = await html2canvas(mapEl, {
                    scale: multiplier, useCORS: true, allowTaint: true,
                    backgroundColor: '#ffffff', logging: false,
                    width: origW, height: origH, x: 0, y: 0,
                });
                ctx.drawImage(mapCanvas, 0, 0, W, H);
            } catch (e) { console.warn('Map capture failed:', e); }
        }

        ctx.drawImage(srcCanvas, 0, 0, W, H);

        if (appMode === 'map') {
            try {
                const mapMarkersOverlay = document.getElementById('mapMarkersOverlay');
                const markersCanvas = await html2canvas(mapMarkersOverlay, {
                    scale: multiplier, useCORS: true, allowTaint: true,
                    backgroundColor: null, logging: false,
                    width: origW, height: origH, x: 0, y: 0,
                });
                ctx.drawImage(markersCanvas, 0, 0, W, H);
            } catch (e) { console.warn('Map markers capture failed:', e); }
        }

        renderer.showGrid = prevShowGrid;
        renderer.render();

        // Panels & legend — use multiplier so html2canvas renders them crisply too
        if (includePanels) await _compositeOverlays(ctx, multiplier);

        // Branding
        _drawBranding(ctx, W, H, multiplier);

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality  = format === 'jpg' ? 0.92 : undefined;
        await _saveCanvas(offscreen, filename, mimeType, quality, dirHandle);
    }

    async function _saveCanvas(offscreen, filename, mimeType, quality, dirHandle) {
        const blob = await new Promise(resolve => offscreen.toBlob(resolve, mimeType, quality));
        await _saveBlob(blob, filename, dirHandle);
    }

    /**
     * Write a Blob to the chosen directory, or trigger a browser download if
     * the File System Access API (showDirectoryPicker) is unavailable.
     */
    async function _saveBlob(blob, filename, dirHandle) {
        if (dirHandle) {
            const fh = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fh.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        }
        // Fallback for browsers without showDirectoryPicker (Firefox, Safari):
        // trigger a standard download to the browser's default download folder.
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function _drawBranding(ctx, canvasW, canvasH, scale) {
        const padding = 12 * scale;
        const boxH = 28 * scale;
        const fontSize = 13 * scale;
        const text = 'MiRA';

        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        const textW = ctx.measureText(text).width;
        const boxW = textW + 24 * scale;

        const x = canvasW - boxW - padding;
        const y = canvasH - boxH - padding;

        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1 * scale;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, boxW, boxH, 8 * scale);
        } else {
            // Plain rectangle fallback (for jsPDF context2d which lacks roundRect and arcTo)
            ctx.rect(x, y, boxW, boxH);
        }
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#1a1a2e';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + 12 * scale, y + boxH / 2);
    }

    async function _exportPDF(dirHandle) {
        try {
            await _loadScript('https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js');
        } catch (err) {
            alert('Could not load PDF library. Please check your internet connection and try again.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;

            const renderer = getRenderer();
            const appMode  = getAppMode();

            const srcCanvas = document.getElementById('networkCanvas');
            const scale = 4; // ~300 DPI
            const includeGrid   = document.getElementById('exportGridCheckbox').checked;
            const includePanels = document.getElementById('exportPanelsCheckbox').checked;
            const prevShowGrid  = renderer.showGrid;
            renderer.showGrid = includeGrid;
            renderer.render();

            const w = srcCanvas.width, h = srcCanvas.height;
            const offscreen = document.createElement('canvas');
            offscreen.width = w * scale; offscreen.height = h * scale;
            const ctx = offscreen.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, offscreen.width, offscreen.height);

            // Map background (if in map mode or layer view geo mode)
            const isLvGeoPdf = appMode === 'layer' && renderer.layerView?.geoMode;
            if ((appMode === 'map' || isLvGeoPdf) && includeGrid) {
                try {
                    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                    const mapEl = document.getElementById(appMode === 'map' ? 'backgroundMap' : 'lvBackgroundMap');
                    const mapCanvas = await html2canvas(mapEl, {
                        scale, useCORS: true, allowTaint: true,
                        backgroundColor: '#ffffff', logging: false,
                        width: w, height: h, x: 0, y: 0,
                    });
                    ctx.drawImage(mapCanvas, 0, 0, offscreen.width, offscreen.height);
                } catch (e) { console.warn('Map capture failed (PDF):', e); }
            }

            ctx.drawImage(srcCanvas, 0, 0, offscreen.width, offscreen.height);

            // In map mode: composite the map markers overlay on top of the network
            if (appMode === 'map') {
                try {
                    const mapMarkersOverlay = document.getElementById('mapMarkersOverlay');
                    const markersCanvas = await html2canvas(mapMarkersOverlay, {
                        scale, useCORS: true, allowTaint: true,
                        backgroundColor: null, logging: false,
                        width: w, height: h, x: 0, y: 0,
                    });
                    ctx.drawImage(markersCanvas, 0, 0, offscreen.width, offscreen.height);
                } catch (e) { console.warn('Map markers capture failed (PDF):', e); }
            }

            renderer.showGrid = prevShowGrid;
            renderer.render();

            if (includePanels) await _compositeOverlays(ctx, scale);

            _drawBranding(ctx, offscreen.width, offscreen.height, scale);

            // Create PDF at the original CSS-pixel page size
            const isLandscape = w > h;
            const pdf = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'px',
                format: [w, h],
                hotfixes: ['px_scaling']
            });

            // Embed the high-res canvas directly (jsPDF 2.x accepts an
            // HTMLCanvasElement) — avoids the huge synchronous toDataURL
            // call that would block the main thread for several seconds on
            // a 20-megapixel canvas.
            pdf.addImage(offscreen, 'PNG', 0, 0, w, h, undefined, 'FAST');

            await _saveBlob(pdf.output('blob'), _buildFilename('pdf'), dirHandle);
        } catch (err) {
            alert('PDF export failed: ' + err.message);
            console.error(err);
        }
    }
}

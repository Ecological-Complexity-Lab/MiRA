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

export function initExportManager({ getRenderer, getAppMode }) {
    const captureBtn      = document.getElementById('captureBtn');
    const exportDialog    = document.getElementById('exportDialog');
    const exportCancelBtn = document.getElementById('exportCancelBtn');

    captureBtn.addEventListener('click', () => {
        const renderer = getRenderer();
        const appMode  = getAppMode();
        const hasMap = appMode === 'map' || (appMode === 'layer' && renderer.layerView?.geoMode);
        const gridLabel = exportDialog.querySelector('#exportGridCheckbox + span');
        if (gridLabel) gridLabel.textContent = hasMap ? 'Background map' : 'Background grid';
        exportDialog.style.display = 'flex';
    });

    exportCancelBtn.addEventListener('click', () => {
        exportDialog.style.display = 'none';
    });

    // Close on overlay click
    exportDialog.addEventListener('click', (e) => {
        if (e.target === exportDialog) exportDialog.style.display = 'none';
    });

    // Format buttons
    exportDialog.querySelectorAll('[data-format]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            const format = btn.dataset.format;
            exportDialog.style.display = 'none';
            await exportScreenshot(format);
        });
    });

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

    async function exportScreenshot(format) {
        if (format === 'pdf') { await _exportPDF(); return; }

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
            await _saveCanvas(offscreen, `multilayer_network.${format}`, mimeType, quality);
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
        await _saveCanvas(offscreen, `multilayer_network.${format}`, mimeType, quality);
    }

    async function _saveCanvas(offscreen, filename, mimeType, quality) {
        if (window.showSaveFilePicker) {
            try {
                const ext = filename.split('.').pop();
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: `${ext.toUpperCase()} file`, accept: { [mimeType]: [`.${ext}`] } }],
                });
                const writable = await handle.createWritable();
                const blob = await new Promise(resolve => offscreen.toBlob(resolve, mimeType, quality));
                await writable.write(blob); await writable.close();
            } catch (err) { if (err.name !== 'AbortError') console.error('Save failed:', err); }
        } else {
            const dataUrl = offscreen.toDataURL(mimeType, quality);
            const link = document.createElement('a');
            link.download = filename; link.href = dataUrl; link.click();
        }
    }

    function _drawBranding(ctx, canvasW, canvasH, scale) {
        const padding = 12 * scale;
        const boxH = 28 * scale;
        const fontSize = 13 * scale;
        const text = 'Multilayer Viz';

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

    async function _exportPDF() {
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

            // Embed the high-res image — fills the page, but is 4x resolution
            const imgData = offscreen.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 0, 0, w, h, undefined, 'FAST');

            // Save
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'multilayer_network.pdf',
                        types: [{
                            description: 'PDF Document',
                            accept: { 'application/pdf': ['.pdf'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    const blob = pdf.output('blob');
                    await writable.write(blob);
                    await writable.close();
                } catch (err) {
                    if (err.name !== 'AbortError') console.error('Save failed:', err);
                }
            } else {
                pdf.save('multilayer_network.pdf');
            }
        } catch (err) {
            alert('PDF export failed: ' + err.message);
            console.error(err);
        }
    }
}

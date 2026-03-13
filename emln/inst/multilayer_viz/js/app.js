/**
 * app.js — Entry point, wires together all modules
 */

import { parseMultilayerData } from './dataParser.js';
import { Renderer } from './renderer.js';
import { ForceLayout } from './layout.js';
import { InteractionHandler } from './interaction.js';
import { ColorMapper } from './colorMapper.js';
import { LayerView } from './layerView.js';

// ---- State ----
let model = null;
let positions = null;
let renderer = null;
let colorMapper = new ColorMapper();
let layout = new ForceLayout();

// Legend Scales
let activeNodeColorScale = null;
let activeNodeColorScaleA = null;
let activeNodeColorScaleB = null;
let activeNodeSizeScale = null;
let activeLinkColorScale = null;
const colorScaleOverrides = new Map(); // attrName -> 'categorical' | 'continuous'

// ---- DOM Elements ----
const canvas = document.getElementById('networkCanvas');
const openDemoDialogBtn = document.getElementById('openDemoDialogBtn');
const demoDialog = document.getElementById('demoDialog');
const demoCancelBtn = document.getElementById('demoCancelBtn');
const fileInput = document.getElementById('fileInput');
const nodeColorSelect = document.getElementById('nodeColorSelect');
const nodeColorSelectSetA = document.getElementById('nodeColorSelectSetA');
const nodeColorSelectSetB = document.getElementById('nodeColorSelectSetB');
const colorByContainer = document.getElementById('colorByContainer');
const bipartiteColorByContainer = document.getElementById('bipartiteColorByContainer');
const bipartiteColorLabelA = document.getElementById('bipartiteColorLabelA');
const bipartiteColorLabelB = document.getElementById('bipartiteColorLabelB');
const nodeSizeSelect = document.getElementById('nodeSizeSelect');
const linkColorSelect = document.getElementById('linkColorSelect');
const layerColorSelect = document.getElementById('layerColorSelect');

// Legend Panel and State
const legendPanel = document.getElementById('legendPanel');
const expandedLegends = new Set();
const lvExpandedLegends = new Set(['lvColor', 'lvSize']); // layer view legends expanded by default

// Legend Dragging State
let isDraggingLegend = false;
let hasDraggedLegend = false;
let dragStartX, dragStartY;
let legendStartLeft, legendStartTop;

legendPanel.addEventListener('mousedown', (e) => {
    // Only ignore if clicking on a no-drag button (like minimize or toggle)
    if (e.target.closest('.legend-no-drag')) return;

    // Use current computed bounding box for absolute left/top switch if not already set
    const rect = legendPanel.getBoundingClientRect();

    // Switch from bottom/right to absolute window-based left/top positioning
    if (!legendPanel.style.left || !legendPanel.style.top) {
        legendPanel.style.right = 'auto';
        legendPanel.style.bottom = 'auto';
        legendPanel.style.left = rect.left + 'px';
        legendPanel.style.top = rect.top + 'px';
    }

    isDraggingLegend = true;
    hasDraggedLegend = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    legendStartLeft = parseFloat(legendPanel.style.left);
    legendStartTop = parseFloat(legendPanel.style.top);

    document.body.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDraggingLegend) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedLegend = true;
    }

    legendPanel.style.left = (legendStartLeft + dx) + 'px';
    legendPanel.style.top = (legendStartTop + dy) + 'px';
});

window.addEventListener('mouseup', () => {
    if (isDraggingLegend) {
        isDraggingLegend = false;
        document.body.style.cursor = '';
    }
});
const showLabelsCheckbox = document.getElementById('showLabelsCheckbox');
const transformNodesCheckbox = document.getElementById('transformNodesCheckbox');
const showLayerNamesCheckbox = document.getElementById('showLayerNamesCheckbox');
const mapModeBtn      = document.getElementById('mapModeBtn');
const layerViewBtn    = document.getElementById('layerViewBtn');
const layerDrillPanel   = document.getElementById('layerDrillPanel');
const layerDrillClose   = document.getElementById('layerDrillClose');
const layerDrillTitle   = document.getElementById('layerDrillTitle');
const layerDrillStats   = document.getElementById('layerDrillStats');
const layerComparePanel   = document.getElementById('layerComparePanel');
const layerCompareClose   = document.getElementById('layerCompareClose');
const layerCompareTitle   = document.getElementById('layerCompareTitle');
const layerCompareContent = document.getElementById('layerCompareContent');
// Layer view sidebar controls
const lvSizeBy                = document.getElementById('lvSizeBy');
const lvColorBy               = document.getElementById('lvColorBy');
const lvUniformColor          = document.getElementById('lvUniformColor');
const lvUniformColorContainer = document.getElementById('lvUniformColorContainer');
const lvShowEdges             = document.getElementById('lvShowEdges');
const lvEdgeOptionsContainer  = document.getElementById('lvEdgeOptionsContainer');
const lvEdgeMetric            = document.getElementById('lvEdgeMetric');
const lvMinEdgeWeight         = document.getElementById('lvMinEdgeWeight');
const lvMinEdgeWeightLabel    = document.getElementById('lvMinEdgeWeightLabel');
const lvEdgeLabels            = document.getElementById('lvEdgeLabels');
const lvShowLabels            = document.getElementById('lvShowLabels');
const lvFontSize              = document.getElementById('lvFontSize');
const lvSizeMult              = document.getElementById('lvSizeMult');
const lvSizeMultLabel         = document.getElementById('lvSizeMultLabel');
const lvSpacing               = document.getElementById('lvSpacing');
const lvSpacingLabel          = document.getElementById('lvSpacingLabel');
const LV_SECTIONS = ['sectionLayerViewCircles','sectionLayerViewEdges'];
const mapOpacityControl = document.getElementById('mapOpacityControl');
const mapOpacitySlider = document.getElementById('mapOpacitySlider');
const showMapImageCheckbox = document.getElementById('showMapImageCheckbox');
const showLocationsCheckbox = document.getElementById('showLocationsCheckbox');
const showSetNamesCheckbox = document.getElementById('showSetNamesCheckbox');
const bipartiteNestedCheckbox = document.getElementById('bipartiteNestedCheckbox');
const showInterlayerCheckbox = document.getElementById('showInterlayerCheckbox');
const layoutSelect = document.getElementById('layoutSelect');
const nodeSizeSlider = document.getElementById('nodeSizeSlider');
const stackHorizontalBtn = document.getElementById('stackHorizontalBtn');
const stackVerticalBtn = document.getElementById('stackVerticalBtn');
const layerSpacingSlider = document.getElementById('layerSpacingSlider');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const infoPanel = document.getElementById('infoPanel');
const infoTitle = document.getElementById('infoTitle');
const infoContent = document.getElementById('infoContent');
const closeInfoBtn = document.getElementById('closeInfoBtn');
const tooltip = document.getElementById('tooltip');

// ---- Application State ----
let appMode = 'network'; // 'network', 'map', or 'layer'
let layerViewHandlers = null;
let lvRAF  = null; // requestAnimationFrame id for meta-graph animation
let activeMapLayers = new Set();
const mapMarkersOverlay = document.getElementById('mapMarkersOverlay');
const layerCloseButtonsContainer = document.getElementById('layerCloseButtons');

// ---- Init Background Map ----
const mapEl = document.getElementById('backgroundMap');
const bgMap = L.map('backgroundMap', {
    zoomControl: false,
    dragging: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: false,
    keyboard: false,
    attributionControl: false,
    zoomSnap: 0 // allow fractional zoom for smooth syncing
}).setView([42.35, 3.17], 11);

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18
}).addTo(bgMap);

// ---- Canvas Resize ----
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (renderer) {
        renderer.render();
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---- Init Renderer ----
renderer = new Renderer(canvas);
renderer.showLabels = false;
renderer.transformNodes = transformNodesCheckbox.checked;
renderer.bgMap = bgMap;

// Update tracking close buttons automatically during pan/zoom/drag
renderer.onRender = () => {
    if (appMode === 'map') {
        updateCloseButtons();
    }
};

bgMap.on('move', () => {
    if (appMode === 'map') {
        renderMapMarkers();
        updateCloseButtons();
        renderer.render();
    }
});

// ---- Interaction ----
const interaction = new InteractionHandler(canvas, renderer, {
    onNodeSelect: (hit) => {
        if (hit) {
            showNodeInfo(hit);
        } else {
            hideNodeInfo();
        }
    },
    onNodeHover: (hit) => {
        if (hit) {
            showTooltip(hit);
        } else {
            hideTooltip();
        }
    },
    onLayerSelect: (layerIndex) => {
        showLayerInfo(layerIndex);
    },
    onLinkSelect: (hit) => {
        if (hit) {
            showLinkInfo(hit);
        } else {
            hideNodeInfo();
        }
    }
});

// ---- Reset all visualization options to defaults ----
function resetVisualizationOptions() {
    // Checkboxes
    showLabelsCheckbox.checked = false;
    renderer.showLabels = false;

    transformNodesCheckbox.checked = true;
    renderer.transformNodes = true;

    showLayerNamesCheckbox.checked = false;
    renderer.showLayerNames = false;

    showSetNamesCheckbox.checked = false;
    renderer.showSetNames = false;

    bipartiteNestedCheckbox.checked = false;
    layout.bipartiteNested = false;

    showInterlayerCheckbox.checked = true;
    renderer.showInterlayerLinks = true;

    // Stacking mode
    setStackMode('horizontal');

    // Layer spacing
    layerSpacingSlider.value = 300;
    renderer.layerSpacing = 300;

    // Node size slider — reset to HTML default; actual radius set by auto-scale in loadData
    nodeSizeSlider.value = 10;

    // Color dropdowns
    nodeColorSelect.value = '';
    nodeColorSelectSetA.value = '';
    nodeColorSelectSetB.value = '';
    nodeSizeSelect.value = '';
    linkColorSelect.value = '';
    layerColorSelect.value = '';

    // Color functions
    renderer.nodeColorFn = null;
    renderer.nodeSizeFn = null;
    renderer.linkColorFn = null;
    renderer.layerColorFn = null;
    activeNodeColorScale = null;
    activeNodeColorScaleA = null;
    activeNodeColorScaleB = null;
    activeLinkColorScale = null;
    colorScaleOverrides.clear();

    // Layer view
    if (appMode === 'layer') _exitLayerView();

    // Interaction state
    renderer.selectedNode = null;
    renderer.selectedLink = null;
    renderer.selectedLayer = null;
    renderer.hoveredNode = null;
    renderer.hoveredLink = null;
    renderer.searchedNodeName = null;
    committedSearchName = null;
    if (nodeSearchInput) nodeSearchInput.value = '';
    if (nodeSearchResults) nodeSearchResults.innerHTML = '';

    // Info panel
    hideNodeInfo();

    renderLegends();
}

// ---- Load Data ----
function loadData(json) {
    try {
        model = parseMultilayerData(json);

        // Center Leaflet Map if geographic data is present
        const lats = [];
        const lngs = [];
        model.layers.forEach(layer => {
            const latVal = layer.latitude !== undefined ? layer.latitude : layer.Latitude;
            const lngVal = layer.longitude !== undefined ? layer.longitude : layer.Longitude;
            if (latVal !== undefined && lngVal !== undefined) {
                const lat = parseFloat(latVal);
                const lng = parseFloat(lngVal);
                if (!isNaN(lat) && !isNaN(lng)) {
                    lats.push(lat);
                    lngs.push(lng);
                }
            }
        });

        if (lats.length > 0) {
            mapModeBtn.style.display = 'inline-flex';
        } else {
            mapModeBtn.style.display = 'none';
        }

        // Reset out of map mode if active when loading a new un-mapped network
        if (appMode === 'map') {
            toggleMapMode(); // Switches back to network mode and cleans up markers
        }

        // Pass bipartite info to layout engine
        layout.bipartiteInfo = model.bipartiteInfo;

        // Check for bipartite layers
        let hasExplicitBipartite = false;
        let hasAutoDetected = false;
        for (const [, info] of model.bipartiteInfo) {
            if (info.isBipartite) {
                if (info.explicit) hasExplicitBipartite = true;
                else hasAutoDetected = true;
            }
        }

        // Decide whether to use bipartite layout
        let useBipartiteLayout = hasExplicitBipartite; // always use for explicit

        // If auto-detected (not explicit), prompt the user
        if (hasAutoDetected && !hasExplicitBipartite) {
            useBipartiteLayout = confirm(
                'Some layers appear to have a bipartite structure.\n\n' +
                'Would you like to use the bipartite layout?\n' +
                '(Two rows: one set on top, one on bottom)'
            );
        } else if (hasAutoDetected && hasExplicitBipartite) {
            // Some explicit, some auto — ask about the auto ones
            useBipartiteLayout = confirm(
                'Additional layers were auto-detected as bipartite.\n\n' +
                'Use bipartite layout for all bipartite layers?'
            );
        }

        // Show or hide the Bipartite layout option in the dropdown
        const hasAnyBipartite = hasExplicitBipartite || hasAutoDetected;
        const bipartiteOption = layoutSelect.querySelector('option[value="bipartite"]');
        if (bipartiteOption) {
            bipartiteOption.style.display = hasAnyBipartite ? '' : 'none';
        }

        // Set layout type
        if (useBipartiteLayout) {
            layout.layoutType = 'bipartite';
            layoutSelect.value = 'bipartite';
        } else {
            // If they had bipartite selected from a previous network, but this one isn't, default to circle
            if (layoutSelect.value === 'bipartite' && !hasAnyBipartite) {
                layoutSelect.value = 'circle';
            }
            layout.layoutType = layoutSelect.value;
        }

        positions = layout.computeLayout(model);

        // Auto-scale node size for large networks
        const maxNodesPerLayer = Math.max(...Array.from(model.nodesPerLayer.values()).map(s => s.size));
        if (maxNodesPerLayer > 30) {
            renderer.nodeRadius = Math.max(4, 10 - (maxNodesPerLayer - 30) * 0.15);
            renderer.labelFont = `${Math.max(8, 12 - (maxNodesPerLayer - 30) * 0.1)}px Inter, system-ui, sans-serif`;
        } else {
            renderer.nodeRadius = 10;
            renderer.labelFont = '12px Inter, system-ui, sans-serif';
        }

        // Pass bipartite info to renderer
        renderer.bipartiteInfo = model.bipartiteInfo;
        renderer.layoutType = layout.layoutType;

        // Show/hide UI elements based on layout
        const isBipartiteLayout = layout.layoutType === 'bipartite';
        document.getElementById('setNamesContainer').style.display = isBipartiteLayout ? '' : 'none';
        colorByContainer.style.display = isBipartiteLayout ? 'none' : '';
        bipartiteColorByContainer.style.display = isBipartiteLayout ? '' : 'none';

        populateDropdowns();
        resetVisualizationOptions();

        renderer.setData(model, positions);
        renderer.centerView();
        renderer.render();

        // Enable dropdowns
        nodeColorSelect.disabled = false;
        nodeColorSelectSetA.disabled = false;
        nodeColorSelectSetB.disabled = false;
        nodeSizeSelect.disabled = false;
        linkColorSelect.disabled = false;
    } catch (err) {
        console.error('Failed to load data:', err);
        alert('Error loading data: ' + err.message);
    }
}

// ---- Load Demo ----
openDemoDialogBtn.addEventListener('click', () => {
    demoDialog.style.display = 'flex';
});

demoCancelBtn.addEventListener('click', () => {
    demoDialog.style.display = 'none';
});

demoDialog.addEventListener('click', (e) => {
    if (e.target === demoDialog) demoDialog.style.display = 'none';
});

document.querySelectorAll('.demo-dataset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        demoDialog.style.display = 'none';
        try {
            const demoFile = btn.dataset.file;
            const resp = await fetch(`data/${demoFile}.json`);
            if (!resp.ok) throw new Error('Failed to fetch demo data');
            const json = await resp.json();
            loadData(json);
        } catch (err) {
            console.error(err);
            alert('Failed to load demo data. Make sure to serve using a local server.');
        }
    });
});

// ---- Map Mode Logic ----
function toggleMapMode() {
    appMode = appMode === 'network' ? 'map' : 'network';

    if (appMode === 'map') {
        mapModeBtn.classList.add('active');
        mapEl.style.display = 'block';
        bgMap.invalidateSize();

        // Calculate bounds after the map container is visible
        fitMapToLayers();

        activeMapLayers.clear(); // Start with no active layers pop-out
        renderer.showMapBackground = showMapImageCheckbox.checked;
        renderer.isMapMode = true;
        mapOpacityControl.style.display = 'flex';
    } else {
        mapModeBtn.classList.remove('active');
        mapEl.style.display = 'none';
        activeMapLayers.clear();
        renderer.showMapBackground = false;
        renderer.isMapMode = false;
        mapOpacityControl.style.display = 'none';
    }

    updateMapModeViews();
}

mapModeBtn.addEventListener('click', toggleMapMode);

// ---- Layer View (Meta-Graph) Mode ----
function _startLayerViewLoop() {
    function loop() {
        if (appMode !== 'layer' || !renderer.layerView) { lvRAF = null; return; }
        const stillHot = renderer.layerView.tick();
        renderer.render();
        lvRAF = stillHot ? requestAnimationFrame(loop) : null;
    }
    lvRAF = requestAnimationFrame(loop);
}

function _ensureLayerViewLoop() {
    if (!lvRAF && appMode === 'layer' && renderer.layerView) _startLayerViewLoop();
}

function toggleLayerView() {
    if (!model) return;
    if (appMode === 'layer') {
        _exitLayerView();
        appMode = 'network';
        renderer.render();
        return;
    }
    if (appMode === 'map') toggleMapMode();
    appMode = 'layer';
    renderer.layerView = new LayerView(model, positions);
    renderer.layerViewMode = true;
    layerViewBtn.classList.add('active');
    canvas.style.cursor = 'grab';
    _showLayerViewSidebar();

    // Auto-fit initial viewScale so all bubbles are visible
    {
        const lv = renderer.layerView;
        const layoutR = lv.layoutRadius(); // bounding radius of initial circle
        const fitScale = Math.min(canvas.width, canvas.height) * 0.42 / Math.max(layoutR, 1);
        lv.viewScale = Math.min(Math.max(fitScale, 0.05), 0.85);
    }

    let isDragging    = false;
    let isBubbleDrag  = false; // true = dragging a bubble; false = panning
    let dragStartX    = 0, dragStartY    = 0;
    let offsetStartX  = 0, offsetStartY  = 0;
    let mouseDownX    = 0, mouseDownY    = 0;

    const canvasCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        return {
            mx: (e.clientX - rect.left) * (canvas.width  / rect.width),
            my: (e.clientY - rect.top)  * (canvas.height / rect.height),
        };
    };

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        mouseDownX = e.clientX; mouseDownY = e.clientY;
        const { mx, my } = canvasCoords(e);
        const lv = renderer.layerView;
        const hitName = lv.startDragBubble(mx, my, canvas.width, canvas.height);
        if (hitName) {
            isBubbleDrag = true;
            isDragging   = true;
            _ensureLayerViewLoop();
        } else {
            isBubbleDrag = false;
            isDragging   = true;
            dragStartX   = e.clientX; dragStartY   = e.clientY;
            offsetStartX = lv.viewOffsetX;
            offsetStartY = lv.viewOffsetY;
        }
        canvas.style.cursor = 'grabbing';
    };

    const onMouseMove = (e) => {
        if (isDragging) {
            if (isBubbleDrag) {
                const { mx, my } = canvasCoords(e);
                renderer.layerView.moveDragBubble(mx, my, canvas.width, canvas.height);
                _ensureLayerViewLoop();
            } else {
                renderer.layerView.viewOffsetX = offsetStartX + (e.clientX - dragStartX);
                renderer.layerView.viewOffsetY = offsetStartY + (e.clientY - dragStartY);
                renderer.render();
            }
            tooltip.classList.remove('visible');
            return;
        }
        const { mx, my } = canvasCoords(e);
        const lv = renderer.layerView;
        const hitBubble = lv.hitTestBubble(mx, my, canvas.width, canvas.height);
        if (hitBubble) {
            const info = lv.getBubbleInfo(hitBubble);
            tooltip.textContent = `${hitBubble} — ${info.nodeCount} nodes, ${info.edgeCount} edges, density ${info.density.toFixed(3)}, avg deg ${info.avgDegree.toFixed(1)}`;
            tooltip.classList.add('visible');
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top  = (e.clientY - 8)  + 'px';
            canvas.style.cursor = 'pointer';
            return;
        }
        const hitEdge = lv.hitTestEdge(mx, my, canvas.width, canvas.height);
        if (hitEdge) {
            const parts = [];
            if (hitEdge.interlayerCount > 0) parts.push(`${hitEdge.interlayerCount} interlayer links`);
            if (hitEdge.sharedFraction > 0)  parts.push(`${Math.round(hitEdge.sharedFraction * 100)}% shared nodes`);
            tooltip.textContent = `${hitEdge.lA} ↔ ${hitEdge.lB}: ${parts.join(', ')}`;
            tooltip.classList.add('visible');
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top  = (e.clientY - 8)  + 'px';
            canvas.style.cursor = 'default';
            return;
        }
        tooltip.classList.remove('visible');
        canvas.style.cursor = 'grab';
    };

    const onMouseUp = (e) => {
        const didDrag = Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY) > 5;
        if (isBubbleDrag) {
            renderer.layerView.endDragBubble();
            _ensureLayerViewLoop();
        }
        isDragging   = false;
        isBubbleDrag = false;
        canvas.style.cursor = 'grab';
        if (!didDrag) {
            const { mx, my } = canvasCoords(e);
            const hit = renderer.layerView.hitTestBubble(mx, my, canvas.width, canvas.height);
            const prevSel = renderer.layerView._selectedLayer;
            if (e.metaKey && hit && prevSel && hit !== prevSel) {
                // Cmd+click on a different bubble → comparison mode
                renderer.layerView.selectForComparison(prevSel, hit);
                closeLayerDrillDown();
                openLayerComparison(prevSel, hit);
            } else {
                // Normal click → single selection
                renderer.layerView.selectBubble(hit);
                closeLayerComparison();
                if (hit) openLayerDrillDown(hit);
                else closeLayerDrillDown();
            }
            renderer.render();
        }
    };

    const onWheel = (e) => {
        e.preventDefault();
        const lv       = renderer.layerView;
        const factor   = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(Math.max(lv.viewScale * factor, 0.15), 20);
        const { mx, my } = canvasCoords(e);
        const fracX = (mx - canvas.width  / 2 - lv.viewOffsetX) / lv.viewScale;
        const fracY = (my - canvas.height / 2 - lv.viewOffsetY) / lv.viewScale;
        lv.viewOffsetX = mx - canvas.width  / 2 - fracX * newScale;
        lv.viewOffsetY = my - canvas.height / 2 - fracY * newScale;
        lv.viewScale   = newScale;
        renderer.render();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('wheel',     onWheel, { passive: false });
    layerViewHandlers = { onMouseDown, onMouseMove, onMouseUp, onWheel };

    _startLayerViewLoop();
}

const NETWORK_SECTIONS = ['sectionLayers','sectionNodes','sectionLinks','sectionSearch'];

function _showLayerViewSidebar() {
    NETWORK_SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    LV_SECTIONS.forEach(id => { document.getElementById(id).style.display = ''; });
    _syncLayerViewControls();
}

function _hideLayerViewSidebar() {
    NETWORK_SECTIONS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
    LV_SECTIONS.forEach(id => { document.getElementById(id).style.display = 'none'; });
    renderLegends(); // restore network legends
}

function _syncLayerViewControls() {
    const lv = renderer.layerView;
    if (!lv) return;
    const s = lv.settings;
    lvSizeBy.value    = s.sizeBy;
    lvColorBy.value   = s.colorBy;
    lvUniformColor.value = s.uniformColor;
    lvUniformColorContainer.style.display = s.colorBy === 'uniform' ? '' : 'none';
    lvShowEdges.checked  = s.showEdges;
    lvEdgeOptionsContainer.style.display = s.showEdges ? '' : 'none';
    lvEdgeMetric.value   = s.edgeMetric;
    lvEdgeLabels.checked = s.showEdgeLabels;
    lvShowLabels.checked = s.showLabels;
    lvFontSize.value     = s.labelFontSize;
    lvSizeMult.value     = s.sizeMultiplier;
    lvSizeMultLabel.textContent = s.sizeMultiplier.toFixed(1) + '×';
    lvSpacing.value      = s.bubbleSpacing;
    lvSpacingLabel.textContent = s.bubbleSpacing.toFixed(1) + '×';
    _updateEdgeWeightSlider();
    renderLayerViewLegend();
}

function _updateEdgeWeightSlider() {
    const lv = renderer.layerView;
    if (!lv) return;
    const maxW = lv.maxEdgeWeight(lv.settings.edgeMetric);
    lvMinEdgeWeight.max   = maxW;
    lvMinEdgeWeight.value = Math.min(lv.settings.minEdgeWeight, maxW);
    lvMinEdgeWeightLabel.textContent = lvMinEdgeWeight.value;
}

function _exitLayerView() {
    if (lvRAF) { cancelAnimationFrame(lvRAF); lvRAF = null; }
    renderer.layerViewMode = false;
    renderer.layerView = null;
    layerViewBtn.classList.remove('active');
    canvas.style.cursor = '';
    tooltip.classList.remove('visible');
    _hideLayerViewSidebar();
    closeLayerDrillDown();
    closeLayerComparison();
    if (layerViewHandlers) {
        canvas.removeEventListener('mousedown', layerViewHandlers.onMouseDown);
        canvas.removeEventListener('mousemove', layerViewHandlers.onMouseMove);
        canvas.removeEventListener('mouseup',   layerViewHandlers.onMouseUp);
        canvas.removeEventListener('wheel',     layerViewHandlers.onWheel);
        layerViewHandlers = null;
    }
}

function closeLayerDrillDown() {
    layerDrillPanel.style.transform    = 'translateX(340px)';
    layerDrillPanel.style.opacity      = '0';
    layerDrillPanel.style.pointerEvents = 'none';
}

function closeLayerComparison() {
    layerComparePanel.style.transform    = 'translateX(420px)';
    layerComparePanel.style.opacity      = '0';
    layerComparePanel.style.pointerEvents = 'none';
    if (renderer.layerView) renderer.layerView._compareLayer = null;
}

// ── Per-layer stats helper (used by comparison panel) ──────────────────────
function _layerStats(layerName) {
    const nodeSet    = model.nodesPerLayer.get(layerName) || new Set();
    const intraLinks = model.intralayerLinks.filter(l => l.layer_from === layerName);
    const N = nodeSet.size;

    const edgeKeys = new Set();
    for (const l of intraLinks) edgeKeys.add([l.node_from, l.node_to].sort().join('::'));
    const E = edgeKeys.size;

    const maxEdges = N * (N - 1) / 2;
    const density  = maxEdges > 0 ? E / maxEdges : 0;

    const degMap = new Map();
    for (const node of nodeSet) degMap.set(node, 0);
    for (const l of intraLinks) {
        degMap.set(l.node_from, (degMap.get(l.node_from) || 0) + 1);
        if (degMap.has(l.node_to)) degMap.set(l.node_to, (degMap.get(l.node_to) || 0) + 1);
        else degMap.set(l.node_to, 1);
    }
    for (const [k, v] of degMap) degMap.set(k, Math.round(v / 2));

    const degrees    = [...degMap.values()];
    const avgDeg     = N > 0 ? degrees.reduce((s, d) => s + d, 0) / N : 0;
    const maxDeg     = degrees.length ? Math.max(...degrees) : 0;
    const maxDegNode = [...degMap.entries()].find(([, d]) => d === maxDeg)?.[0] ?? '—';

    const ilIn  = model.interlayerLinks.filter(l => l.layer_to   === layerName).length;
    const ilOut = model.interlayerLinks.filter(l => l.layer_from === layerName).length;

    // Bipartite detection
    const tFrom = new Set(intraLinks.map(l => model.nodesByName.get(l.node_from)?.type).filter(Boolean));
    const tTo   = new Set(intraLinks.map(l => model.nodesByName.get(l.node_to  )?.type).filter(Boolean));
    const isBipartite = tFrom.size > 0 && tTo.size > 0 && [...tFrom].every(t => !tTo.has(t));
    const degByType = new Map();
    if (isBipartite) {
        for (const [node, deg] of degMap) {
            const t = model.nodesByName.get(node)?.type ?? 'unknown';
            if (!degByType.has(t)) degByType.set(t, new Map());
            degByType.get(t).set(node, deg);
        }
    }

    return { layerName, nodeSet, N, E, maxEdges, density, degMap, degrees, avgDeg, maxDeg, maxDegNode, ilIn, ilOut, edgeKeys, isBipartite, degByType };
}

function openLayerComparison(nameA, nameB) {
    if (!model) return;
    closeLayerDrillDown();

    const sA = _layerStats(nameA);
    const sB = _layerStats(nameB);

    // Bubble colors
    const lv = renderer.layerView;
    const colorA = lv?._bubbles.find(b => b.layerName === nameA)?.color ?? '#60a5fa';
    const colorB = lv?._bubbles.find(b => b.layerName === nameB)?.color ?? '#f87171';

    // ── Overlap ──
    const sharedNodes = [...sA.nodeSet].filter(n => sB.nodeSet.has(n));
    const sharedN     = sharedNodes.length;
    const unionN      = sA.N + sB.N - sharedN;
    const nodeJacc    = unionN > 0 ? sharedN / unionN : 0;

    let sharedE = 0;
    for (const k of sA.edgeKeys) if (sB.edgeKeys.has(k)) sharedE++;
    const unionE   = sA.E + sB.E - sharedE;
    const edgeJacc = unionE > 0 ? sharedE / unionE : 0;

    const ilAtoB = model.interlayerLinks.filter(l => l.layer_from === nameA && l.layer_to === nameB).length;
    const ilBtoA = model.interlayerLinks.filter(l => l.layer_from === nameB && l.layer_to === nameA).length;

    const commonHubs = sharedNodes
        .map(n => ({ name: n, dA: sA.degMap.get(n) ?? 0, dB: sB.degMap.get(n) ?? 0 }))
        .sort((a, b) => (b.dA + b.dB) - (a.dA + a.dB))
        .slice(0, 5);

    // ── HTML helpers ──
    const fmt  = (v, d = 0) => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;
    const pct  = (v, tot)   => tot > 0 ? `${((v / tot) * 100).toFixed(1)}%` : '—';
    const trunc = (s, n = 18) => s.length > n ? s.slice(0, n - 1) + '…' : s;

    // 3-column row: label | A | B
    const colHdr =
        `<div style="display:grid;grid-template-columns:1fr 88px 88px;gap:4px;padding:2px 0 5px;border-bottom:2px solid rgba(0,0,0,0.08);margin-bottom:2px;">
            <span></span>
            <span style="text-align:right;font-size:10px;font-weight:700;color:${colorA};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trunc(nameA, 12)}</span>
            <span style="text-align:right;font-size:10px;font-weight:700;color:${colorB};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trunc(nameB, 12)}</span>
        </div>`;

    const cRow = (label, a, b) =>
        `<div style="display:grid;grid-template-columns:1fr 88px 88px;gap:4px;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
            <span style="color:#6b7280;">${label}</span>
            <span style="font-weight:600;color:#1a1a2e;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a}</span>
            <span style="font-weight:600;color:#1a1a2e;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b}</span>
        </div>`;

    const sRow = (label, v) =>
        `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
            <span style="color:#6b7280;">${label}</span>
            <span style="font-weight:600;color:#1a1a2e;text-align:right;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v}</span>
        </div>`;

    const section = (title, content) =>
        `<div style="margin-bottom:14px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:6px;">${title}</div>
            ${content}
        </div>`;

    // Common hubs list
    const hubsVal = commonHubs.length
        ? commonHubs.map(h => `${trunc(h.name)} <span style="color:#9ca3af;">(${h.dA}/${h.dB})</span>`).join(', ')
        : '—';

    // Bipartite: shared types between both layers
    const biTypes = sA.isBipartite && sB.isBipartite
        ? [...sA.degByType.keys()].filter(t => sB.degByType.has(t))
        : [];
    const isBothBi = biTypes.length >= 2;

    layerCompareTitle.innerHTML =
        `<span style="color:${colorA};font-weight:700;">${trunc(nameA, 16)}</span>` +
        `<span style="color:#9ca3af;font-weight:400;margin:0 6px;">vs</span>` +
        `<span style="color:${colorB};font-weight:700;">${trunc(nameB, 16)}</span>`;

    layerCompareContent.innerHTML =
        section('Size',
            colHdr +
            cRow('Nodes', fmt(sA.N), fmt(sB.N)) +
            cRow('Edges', fmt(sA.E), fmt(sB.E)) +
            cRow('Density', sA.density.toFixed(4), sB.density.toFixed(4)) +
            cRow('Avg degree', fmt(sA.avgDeg, 2), fmt(sB.avgDeg, 2)) +
            cRow('Max degree', `${fmt(sA.maxDeg)} (${trunc(sA.maxDegNode, 10)})`, `${fmt(sB.maxDeg)} (${trunc(sB.maxDegNode, 10)})`)
        ) +
        section('Overlap',
            sRow('Shared nodes', `${fmt(sharedN)} &nbsp;<span style="color:#9ca3af;">${pct(sharedN, sA.N)} of A &middot; ${pct(sharedN, sB.N)} of B</span>`) +
            sRow('Shared edges', `${fmt(sharedE)} &nbsp;<span style="color:#9ca3af;">${pct(sharedE, sA.E)} of A &middot; ${pct(sharedE, sB.E)} of B</span>`) +
            sRow('Node Jaccard', nodeJacc.toFixed(3)) +
            sRow('Edge Jaccard', edgeJacc.toFixed(3)) +
            sRow('Interlayer A→B', fmt(ilAtoB)) +
            sRow('Interlayer B→A', fmt(ilBtoA)) +
            sRow('Common hubs', hubsVal)
        ) +
        section('Divergence',
            colHdr +
            cRow('Nodes only in', fmt(sA.N - sharedN), fmt(sB.N - sharedN)) +
            cRow('Edges only in', fmt(sA.E - sharedE), fmt(sB.E - sharedE)) +
            `<div style="margin-top:10px;">
                <div style="font-size:10px;color:#9ca3af;margin-bottom:6px;">Degree distribution</div>
                ${isBothBi
                    ? biTypes.map((t, i) =>
                        `<div style="font-size:10px;color:#6b7280;margin-bottom:2px;">${t}</div>
                         <canvas id="cmpHist_${i}" width="348" height="80" style="display:block;width:100%;border-radius:4px;margin-bottom:6px;"></canvas>`
                      ).join('')
                    : `<canvas id="cmpHist_0" width="348" height="90" style="display:block;width:100%;border-radius:4px;"></canvas>`
                }
            </div>`
        ) +
        section('Cross-layer links',
            colHdr +
            cRow('Incoming', fmt(sA.ilIn), fmt(sB.ilIn)) +
            cRow('Outgoing', fmt(sA.ilOut), fmt(sB.ilOut)) +
            cRow('Total', fmt(sA.ilIn + sA.ilOut), fmt(sB.ilIn + sB.ilOut))
        );

    // Draw histogram(s)
    if (isBothBi) {
        biTypes.forEach((t, i) => {
            const c = document.getElementById(`cmpHist_${i}`);
            if (c) _drawComparisonHistogram(c,
                [...(sA.degByType.get(t)?.values() ?? [])],
                [...(sB.degByType.get(t)?.values() ?? [])],
                colorA, colorB);
        });
    } else {
        const c = document.getElementById('cmpHist_0');
        if (c) _drawComparisonHistogram(c, sA.degrees, sB.degrees, colorA, colorB);
    }

    layerComparePanel.style.transform    = 'translateX(0)';
    layerComparePanel.style.opacity      = '1';
    layerComparePanel.style.pointerEvents = 'all';
}

function _drawComparisonHistogram(canvas, degsA, degsB, colorA, colorB) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const PAD = { top: 6, right: 8, bottom: 22, left: 28 };
    ctx.clearRect(0, 0, W, H);
    if (!degsA.length && !degsB.length) return;

    const maxDeg = Math.max(...degsA, ...degsB, 0);
    const bins   = maxDeg + 1;
    const cA = new Array(bins).fill(0); for (const d of degsA) cA[d]++;
    const cB = new Array(bins).fill(0); for (const d of degsB) cB[d]++;
    const maxC = Math.max(...cA, ...cB, 1);

    const cW  = W - PAD.left - PAD.right;
    const cH  = H - PAD.top  - PAD.bottom;
    const barW = cW / bins;

    // Grid lines + y-labels
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const v of [0, Math.round(maxC / 2), maxC]) {
        const y = PAD.top + cH - Math.round((v / maxC) * cH);
        ctx.fillText(v, PAD.left - 3, y);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
    }

    // Bars A then B (overlaid, semi-transparent)
    for (const [counts, color] of [[cA, colorA], [cB, colorB]]) {
        ctx.fillStyle = color + 'aa';
        for (let i = 0; i < bins; i++) {
            if (!counts[i]) continue;
            const bh = Math.round((counts[i] / maxC) * cH);
            ctx.fillRect(Math.round(PAD.left + i * barW), PAD.top + cH - bh, Math.max(1, Math.floor(barW) - 1), bh);
        }
    }

    // X-axis labels
    ctx.fillStyle = '#9ca3af'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const step = bins <= 10 ? 1 : bins <= 20 ? 2 : Math.ceil(bins / 10);
    for (let i = 0; i < bins; i += step)
        ctx.fillText(i, PAD.left + (i + 0.5) * barW, PAD.top + cH + 3);

    // Legend dots
    for (const [color, label, xOff] of [[colorA, 'A', 28], [colorB, 'B', 14]]) {
        ctx.fillStyle = color;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.font = 'bold 9px Inter, system-ui, sans-serif';
        ctx.fillText(label, W - PAD.right - xOff + 14, PAD.top + 1);
    }
}

function openLayerDrillDown(layerName) {
    if (!model) return;

    const layerObj   = model.layers.find(l => l.layer_name === layerName);
    const layerIdx   = model.layers.indexOf(layerObj) + 1;
    const nodeSet    = model.nodesPerLayer.get(layerName) || new Set();
    const intraLinks = model.intralayerLinks.filter(l => l.layer_from === layerName);
    const N  = nodeSet.size;
    const E  = Math.round(intraLinks.length / 2);
    const maxEdges = N * (N - 1) / 2;
    const density  = maxEdges > 0 ? (E / maxEdges) : 0;

    // Degree per node
    const degMap = new Map();
    for (const node of nodeSet) degMap.set(node, 0);
    for (const l of intraLinks) {
        degMap.set(l.node_from, (degMap.get(l.node_from) || 0) + 1);
        if (degMap.has(l.node_to)) degMap.set(l.node_to, (degMap.get(l.node_to) || 0) + 1);
        else degMap.set(l.node_to, 1);
    }
    // Each undirected edge stored twice → halve
    for (const [k, v] of degMap) degMap.set(k, Math.round(v / 2));

    const degrees   = [...degMap.values()];
    const avgDeg    = N > 0 ? (degrees.reduce((s, d) => s + d, 0) / N) : 0;
    const maxDeg    = degrees.length ? Math.max(...degrees) : 0;
    const minDeg    = degrees.length ? Math.min(...degrees) : 0;
    const maxDegNode = [...degMap.entries()].find(([, d]) => d === maxDeg)?.[0] ?? '—';
    const isolated  = degrees.filter(d => d === 0).length;

    // Interlayer links
    const ilIn    = model.interlayerLinks.filter(l => l.layer_to   === layerName).length;
    const ilOut   = model.interlayerLinks.filter(l => l.layer_from === layerName).length;
    const ilTotal = ilIn + ilOut;

    // Layers sharing at least one node
    let sharedLayers = 0;
    for (const [otherName, otherNodes] of model.nodesPerLayer) {
        if (otherName === layerName) continue;
        for (const n of otherNodes) { if (nodeSet.has(n)) { sharedLayers++; break; } }
    }

    // Bipartite detection: check if intraLinks connect two distinct node types
    const typesFrom = new Set(intraLinks.map(l => {
        const n = model.nodesByName.get(l.node_from); return n ? n.type : null;
    }));
    const typesTo = new Set(intraLinks.map(l => {
        const n = model.nodesByName.get(l.node_to); return n ? n.type : null;
    }));
    typesFrom.delete(null); typesTo.delete(null);
    const isBipartite = typesFrom.size > 0 && typesTo.size > 0
        && [...typesFrom].every(t => !typesTo.has(t));

    // Degree maps per node type for bipartite
    const degByType = new Map(); // type → Map<node, degree>
    if (isBipartite) {
        for (const [node, deg] of degMap) {
            const n = model.nodesByName.get(node);
            const t = n ? (n.type || 'unknown') : 'unknown';
            if (!degByType.has(t)) degByType.set(t, new Map());
            degByType.get(t).set(node, deg);
        }
    }

    // ── HTML helpers ──
    const fmt = (v, d = 0) => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : v;

    const section = (title, rows) =>
        `<div style="margin-bottom:14px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:6px;">${title}</div>
            ${rows.map(([k, v]) =>
                `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
                    <span style="color:#6b7280;">${k}</span>
                    <span style="font-weight:600;color:#1a1a2e;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;">${v}</span>
                </div>`
            ).join('')}
        </div>`;

    layerDrillTitle.textContent = layerName;
    layerDrillStats.innerHTML =
        section('Identity', [
            ['Layer name', layerName],
            ['Layer index', layerIdx],
        ]) +
        section('Size', [
            ['Nodes', fmt(N)],
            ['Edges (intra-layer)', fmt(E)],
            ['Density', maxEdges > 0 ? density.toFixed(4) : '—'],
        ]) +
        section('Connectivity', [
            ['Average degree', fmt(avgDeg, 2)],
            ['Max degree', `${fmt(maxDeg)} (${maxDegNode})`],
            ['Min degree', fmt(minDeg)],
            ['Isolated nodes', fmt(isolated)],
        ]) +
        section('Cross-layer connectivity', [
            ['Interlayer links — incoming', fmt(ilIn)],
            ['Interlayer links — outgoing', fmt(ilOut)],
            ['Interlayer links — total', fmt(ilTotal)],
            ['Layers sharing ≥1 node', fmt(sharedLayers)],
        ]) +
        `<div style="margin-bottom:6px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#9ca3af;margin-bottom:8px;">Degree distribution</div>
            <canvas id="degHistCanvas" width="268" height="120" style="display:block;width:100%;border-radius:4px;"></canvas>
        </div>`;

    // ── Draw histogram(s) ──
    const histCanvas = document.getElementById('degHistCanvas');
    if (histCanvas) _drawDegreeHistogram(histCanvas, isBipartite ? degByType : null, degrees);

    // Slide panel in
    layerDrillPanel.style.transform    = 'translateX(0)';
    layerDrillPanel.style.opacity      = '1';
    layerDrillPanel.style.pointerEvents = 'all';
}

function _drawDegreeHistogram(canvas, degByType, allDegrees) {
    const ctx  = canvas.getContext('2d');
    const W    = canvas.width, H = canvas.height;
    const PAD  = { top: 8, right: 8, bottom: 28, left: 32 };
    ctx.clearRect(0, 0, W, H);

    // Build datasets: either [{ label, degrees, color }] or single set
    const PALETTE = ['#60a5fa', '#f87171', '#34d399', '#fbbf24'];
    let datasets;
    if (degByType && degByType.size > 1) {
        datasets = [...degByType.entries()].map(([type, dMap], i) => ({
            label: type, degrees: [...dMap.values()], color: PALETTE[i % PALETTE.length],
        }));
    } else {
        datasets = [{ label: '', degrees: allDegrees, color: '#60a5fa' }];
    }

    const isBi = datasets.length > 1;
    const chartH = isBi ? Math.floor((H - PAD.top - PAD.bottom - 6) / 2) : H - PAD.top - PAD.bottom;

    datasets.forEach((ds, di) => {
        const degs = ds.degrees;
        if (!degs.length) return;
        const maxD = Math.max(...degs);
        const bins = maxD + 1;
        const counts = new Array(bins).fill(0);
        for (const d of degs) counts[d]++;
        const maxC = Math.max(...counts, 1);

        const yOff  = PAD.top + di * (chartH + 6);
        const cW    = W - PAD.left - PAD.right;
        const barW  = Math.max(1, Math.floor(cW / bins) - 1);

        // Y-axis ticks
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let v of [0, Math.round(maxC / 2), maxC]) {
            const y = yOff + chartH - Math.round((v / maxC) * chartH);
            ctx.fillText(v, PAD.left - 4, y);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
        }

        // Bars
        ctx.fillStyle = ds.color + 'cc';
        for (let i = 0; i < bins; i++) {
            if (!counts[i]) continue;
            const bh = Math.round((counts[i] / maxC) * chartH);
            const x  = PAD.left + i * (cW / bins);
            ctx.fillRect(Math.round(x), yOff + chartH - bh, barW, bh);
        }

        // X-axis labels (every few ticks to avoid crowding)
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const step = bins <= 10 ? 1 : bins <= 20 ? 2 : Math.ceil(bins / 10);
        for (let i = 0; i < bins; i += step) {
            const x = PAD.left + (i + 0.5) * (cW / bins);
            ctx.fillText(i, x, yOff + chartH + 3);
        }

        // Label (bipartite only)
        if (isBi) {
            ctx.fillStyle = ds.color;
            ctx.font = '9px Inter, system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText(ds.label, W - PAD.right, yOff + 1);
        }
    });
}

layerViewBtn.addEventListener('click', toggleLayerView);
layerDrillClose.addEventListener('click', closeLayerDrillDown);
layerCompareClose.addEventListener('click', () => {
    closeLayerComparison();
    renderer.render();
});

// ── Layer View sidebar controls ────────────────────────────────────────────
lvSizeBy.addEventListener('change', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('sizeBy', lvSizeBy.value);
    renderLayerViewLegend();
    _ensureLayerViewLoop();
});
lvColorBy.addEventListener('change', () => {
    if (!renderer.layerView) return;
    lvUniformColorContainer.style.display = lvColorBy.value === 'uniform' ? '' : 'none';
    renderer.layerView.updateSetting('colorBy', lvColorBy.value);
    renderLayerViewLegend();
    renderer.render();
});
lvUniformColor.addEventListener('input', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('uniformColor', lvUniformColor.value);
    renderer.render();
});
lvShowEdges.addEventListener('change', () => {
    if (!renderer.layerView) return;
    lvEdgeOptionsContainer.style.display = lvShowEdges.checked ? '' : 'none';
    renderer.layerView.updateSetting('showEdges', lvShowEdges.checked);
    renderer.render();
});
lvEdgeMetric.addEventListener('change', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('edgeMetric', lvEdgeMetric.value);
    _updateEdgeWeightSlider();
    renderer.render();
});
lvMinEdgeWeight.addEventListener('input', () => {
    if (!renderer.layerView) return;
    const val = parseInt(lvMinEdgeWeight.value);
    lvMinEdgeWeightLabel.textContent = val;
    renderer.layerView.updateSetting('minEdgeWeight', val);
    renderer.render();
});
lvEdgeLabels.addEventListener('change', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('showEdgeLabels', lvEdgeLabels.checked);
    renderer.render();
});
lvShowLabels.addEventListener('change', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('showLabels', lvShowLabels.checked);
    renderer.render();
});
lvFontSize.addEventListener('input', () => {
    if (!renderer.layerView) return;
    renderer.layerView.updateSetting('labelFontSize', parseInt(lvFontSize.value));
    renderer.render();
});
lvSizeMult.addEventListener('input', () => {
    if (!renderer.layerView) return;
    const val = parseFloat(lvSizeMult.value);
    lvSizeMultLabel.textContent = val.toFixed(1) + '×';
    renderer.layerView.updateSetting('sizeMultiplier', val);
    renderLayerViewLegend();
    _ensureLayerViewLoop();
});
lvSpacing.addEventListener('input', () => {
    if (!renderer.layerView) return;
    const val = parseFloat(lvSpacing.value);
    lvSpacingLabel.textContent = val.toFixed(1) + '×';
    renderer.layerView.updateSetting('bubbleSpacing', val);
    _ensureLayerViewLoop();
});
function fitMapToLayers() {
    if (!model || !model.layers) return;
    const lats = [];
    const lngs = [];
    model.layers.forEach(layer => {
        const latVal = layer.latitude !== undefined ? layer.latitude : layer.Latitude;
        const lngVal = layer.longitude !== undefined ? layer.longitude : layer.Longitude;
        if (latVal !== undefined && lngVal !== undefined) {
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            if (!isNaN(lat) && !isNaN(lng)) {
                lats.push(lat);
                lngs.push(lng);
            }
        }
    });
    if (lats.length > 0) {
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        if (minLat === maxLat && minLng === maxLng) {
            bgMap.setView([minLat, minLng], 12);
        } else {
            bgMap.fitBounds([
                [minLat, minLng],
                [maxLat, maxLng]
            ], { padding: [40, 40] });
        }
    }
}

function updateMapModeViews() {
    layerCloseButtonsContainer.innerHTML = '';

    if (appMode === 'network') {
        mapMarkersOverlay.style.display = 'none';
        canvas.style.pointerEvents = 'auto';
        renderer.activeMapLayers = null; // render all
        renderer.render();
    } else {
        mapMarkersOverlay.style.display = 'block';
        renderer.activeMapLayers = activeMapLayers; // Only render these layers

        if (activeMapLayers.size === 0) {
            canvas.style.pointerEvents = 'none'; // Map gets controls
            mapOpacityControl.style.opacity = '1';
            mapOpacityControl.style.pointerEvents = 'auto';
        } else {
            canvas.style.pointerEvents = 'auto'; // Canvas gets controls
            mapOpacityControl.style.opacity = '0.4'; // Dim control slightly when layers popped out
            mapOpacityControl.style.pointerEvents = 'auto'; // Still allow them to edit opacity while viewing overlays
        }

        renderMapMarkers();
        updateCloseButtons();
        renderer.render();
    }
}

// ==== Map Opacity Handlers ====
mapOpacitySlider.addEventListener('input', () => {
    const val = parseFloat(mapOpacitySlider.value);
    satelliteLayer.setOpacity(val);
    mapMarkersOverlay.style.opacity = val;
});

showMapImageCheckbox.addEventListener('change', () => {
    const show = showMapImageCheckbox.checked;
    if (show) {
        bgMap.addLayer(satelliteLayer);
    } else {
        bgMap.removeLayer(satelliteLayer);
    }
    renderer.showMapBackground = show;
    renderer.render();
});

showLocationsCheckbox.addEventListener('change', () => {
    mapMarkersOverlay.style.visibility = showLocationsCheckbox.checked ? 'visible' : 'hidden';
});

function renderMapMarkers() {
    mapMarkersOverlay.innerHTML = '';
    if (appMode !== 'map' || !model || !model.layers) return;

    model.layers.forEach(layer => {
        const latVal = layer.latitude !== undefined ? layer.latitude : layer.Latitude;
        const lngVal = layer.longitude !== undefined ? layer.longitude : layer.Longitude;
        if (latVal !== undefined && lngVal !== undefined) {
            const lat = parseFloat(latVal);
            const lng = parseFloat(lngVal);
            if (!isNaN(lat) && !isNaN(lng)) {
                const pos = bgMap.latLngToContainerPoint([lat, lng]);

                // Hide marker if the layer is currently popped out
                if (activeMapLayers.has(layer.layer_name)) return;

                const marker = document.createElement('div');
                marker.className = 'map-marker';
                marker.style.left = pos.x + 'px';
                marker.style.top = pos.y + 'px';
                marker.title = layer.layer_name;

                if (renderer.showLayerNames) {
                    const label = document.createElement('div');
                    label.className = 'map-marker-label';
                    label.innerText = layer.layer_name;
                    marker.appendChild(label);
                }

                marker.addEventListener('click', (e) => {
                    e.stopPropagation();
                    activeMapLayers.add(layer.layer_name);
                    updateMapModeViews();
                });

                mapMarkersOverlay.appendChild(marker);
            }
        }
    });
}

function updateCloseButtons() {
    layerCloseButtonsContainer.innerHTML = '';
    if (appMode !== 'map' || activeMapLayers.size === 0 || !renderer.positions || !renderer.model) return;

    Array.from(activeMapLayers).forEach(layerName => {
        const layerIndex = renderer.model.layers.findIndex(l => l.layer_name === layerName);
        if (layerIndex === -1) return;

        // Find the top-right corner of the layer in screen coords
        // The geographic origin is calculated safely in renderer project
        // So we grab a generic point near the origin representing top-right
        const topRScreen = renderer.project(renderer.layerWidth, 0, layerIndex);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'popout-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.style.left = topRScreen.x + 'px';
        closeBtn.style.top = topRScreen.y + 'px';
        closeBtn.title = "Close " + layerName;

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            activeMapLayers.delete(layerName);
            updateMapModeViews();
        });

        layerCloseButtonsContainer.appendChild(closeBtn);
    });
}

// ---- Toggle Labels ----
showLabelsCheckbox.addEventListener('change', () => {
    renderer.showLabels = showLabelsCheckbox.checked;
    renderer.render();
});

// ---- Toggle Transform Nodes ----
transformNodesCheckbox.addEventListener('change', () => {
    renderer.transformNodes = transformNodesCheckbox.checked;
    renderer.render();
});

// ---- Toggle Layer Names ----
showLayerNamesCheckbox.addEventListener('change', () => {
    renderer.showLayerNames = showLayerNamesCheckbox.checked;
    if (appMode === 'map') renderMapMarkers();
    renderer.render();
});

// ---- Toggle Set Names ----
showSetNamesCheckbox.addEventListener('change', () => {
    renderer.showSetNames = showSetNamesCheckbox.checked;
    renderer.render();
});

// ---- Toggle Bipartite Nested Sorting ----
bipartiteNestedCheckbox.addEventListener('change', () => {
    layout.bipartiteNested = bipartiteNestedCheckbox.checked;
    if (layout.layoutType === 'bipartite' && model) {
        positions = layout.computeLayout(model);
        renderer.setData(model, positions);
        renderer.render();
    }
});

// ---- Toggle Interlayer Links ----
showInterlayerCheckbox.addEventListener('change', () => {
    renderer.showInterlayerLinks = showInterlayerCheckbox.checked;
    renderer.render();
});

// ---- Stacking Mode Toggle ----
function setStackMode(mode) {
    renderer.stackMode = mode;
    stackHorizontalBtn.classList.toggle('active', mode === 'horizontal');
    stackVerticalBtn.classList.toggle('active', mode === 'vertical');
    renderer.centerView();
    renderer.render();
}

stackHorizontalBtn.addEventListener('click', () => setStackMode('horizontal'));
stackVerticalBtn.addEventListener('click', () => setStackMode('vertical'));

// ---- Layer Spacing ----
layerSpacingSlider.addEventListener('input', () => {
    renderer.layerSpacing = parseInt(layerSpacingSlider.value);
    renderer.centerView();
    renderer.render();
});

// ---- Layout Algorithm ----
layoutSelect.addEventListener('change', () => {
    if (!model) return;
    layout.layoutType = layoutSelect.value;
    layout.bipartiteInfo = model.bipartiteInfo;
    positions = layout.computeLayout(model);
    renderer.setData(model, positions);
    renderer.layoutType = layout.layoutType;

    // Show/hide UI elements based on layout
    const isBipartiteLayout = layout.layoutType === 'bipartite';
    document.getElementById('setNamesContainer').style.display = isBipartiteLayout ? '' : 'none';
    colorByContainer.style.display = isBipartiteLayout ? 'none' : '';
    bipartiteColorByContainer.style.display = isBipartiteLayout ? '' : 'none';

    updateNodeColors();
    renderer.render();
});

// ---- Node Size Slider ----
nodeSizeSlider.addEventListener('input', () => {
    const size = parseInt(nodeSizeSlider.value);
    renderer.nodeRadius = size;
    renderer.labelFont = `${Math.max(8, size + 2)}px Inter, system-ui, sans-serif`;
    renderer.render();
});



// ---- File Upload ----
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const json = JSON.parse(evt.target.result);
            loadData(json);
        } catch (err) {
            alert('Invalid JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
});

// ---- Dropdowns ----
function populateDropdowns() {
    if (!model) return;

    // Node color options
    nodeColorSelect.innerHTML = '<option value="">Layer (default)</option>';
    for (const attr of model.nodeAttributeNames) {
        const opt = document.createElement('option');
        opt.value = `node:${attr}`;
        opt.textContent = `Node: ${attr}`;
        nodeColorSelect.appendChild(opt);
    }
    for (const attr of model.stateNodeAttributeNames) {
        const opt = document.createElement('option');
        opt.value = `state:${attr}`;
        opt.textContent = `State: ${attr}`;
        nodeColorSelect.appendChild(opt);
    }

    // Bipartite node color options
    nodeColorSelectSetA.innerHTML = '<option value="">Set Default</option>';
    nodeColorSelectSetB.innerHTML = '<option value="">Set Default</option>';

    const setA_nodeAttrs = new Set();
    const setA_stateAttrs = new Set();
    const setB_nodeAttrs = new Set();
    const setB_stateAttrs = new Set();
    let hasBipartite = false;
    let labelA = "Set A", labelB = "Set B";

    for (const [layerName, info] of model.bipartiteInfo) {
        if (!info.isBipartite) continue;
        hasBipartite = true;
        labelA = info.setALabel || labelA;
        labelB = info.setBLabel || labelB;
        for (const nodeName of info.setA) {
            const pn = model.nodesByName.get(nodeName);
            if (pn) Object.keys(pn).forEach(k => { if (k !== 'node_id' && k !== 'node_name') setA_nodeAttrs.add(k); });
            const sn = model.stateNodeMap.get(`${layerName}::${nodeName}`);
            if (sn) Object.keys(sn).forEach(k => { if (!['layer_id', 'node_id', 'layer_name', 'node_name', 'degree', 'strength', 'in_degree', 'out_degree', 'in_strength', 'out_strength'].includes(k)) setA_stateAttrs.add(k); });
        }
        for (const nodeName of info.setB) {
            const pn = model.nodesByName.get(nodeName);
            if (pn) Object.keys(pn).forEach(k => { if (k !== 'node_id' && k !== 'node_name') setB_nodeAttrs.add(k); });
            const sn = model.stateNodeMap.get(`${layerName}::${nodeName}`);
            if (sn) Object.keys(sn).forEach(k => { if (!['layer_id', 'node_id', 'layer_name', 'node_name', 'degree', 'strength', 'in_degree', 'out_degree', 'in_strength', 'out_strength'].includes(k)) setB_stateAttrs.add(k); });
        }
    }

    ['degree', 'strength', 'in_degree', 'out_degree', 'in_strength', 'out_strength'].forEach(attr => {
        if (model.stateNodeAttributeNames.includes(attr)) {
            setA_stateAttrs.add(attr);
            setB_stateAttrs.add(attr);
        }
    });

    if (hasBipartite) {
        bipartiteColorLabelA.textContent = `Color by ${labelA}`;
        bipartiteColorLabelB.textContent = `Color by ${labelB}`;
        setA_nodeAttrs.forEach(attr => { const opt = document.createElement('option'); opt.value = `node:${attr}`; opt.textContent = `Node: ${attr}`; nodeColorSelectSetA.appendChild(opt); });
        setA_stateAttrs.forEach(attr => { const opt = document.createElement('option'); opt.value = `state:${attr}`; opt.textContent = `State: ${attr}`; nodeColorSelectSetA.appendChild(opt); });
        setB_nodeAttrs.forEach(attr => { const opt = document.createElement('option'); opt.value = `node:${attr}`; opt.textContent = `Node: ${attr}`; nodeColorSelectSetB.appendChild(opt); });
        setB_stateAttrs.forEach(attr => { const opt = document.createElement('option'); opt.value = `state:${attr}`; opt.textContent = `State: ${attr}`; nodeColorSelectSetB.appendChild(opt); });
    }

    // Node size options
    nodeSizeSelect.innerHTML = '<option value="">Uniform (slider)</option>';
    // We only want continuous numeric attributes. This is a heuristic check on the first element.
    const addContAttr = (source, attr, entities) => {
        // Find first non-null
        let sample = null;
        for (const e of entities) {
            if (e[attr] !== undefined && e[attr] !== null) {
                sample = e[attr];
                break;
            }
        }
        if (typeof sample === 'number') {
            const opt = document.createElement('option');
            opt.value = `${source}:${attr}`;
            opt.textContent = `${source === 'node' ? 'Node' : 'State'}: ${attr}`;
            nodeSizeSelect.appendChild(opt);
        }
    };

    for (const attr of model.nodeAttributeNames) {
        addContAttr('node', attr, model.nodes);
    }
    for (const attr of Object.keys(model.stateNodes[0] || {})) {
        if (!['layer_name', 'node_name', 'layer_id', 'node_id'].includes(attr)) {
            addContAttr('state', attr, model.stateNodes);
        }
    }


    // Link color options
    linkColorSelect.innerHTML = '<option value="">Type (default)</option>';
    for (const attr of model.linkAttributeNames) {
        const opt = document.createElement('option');
        opt.value = attr;
        opt.textContent = attr;
        linkColorSelect.appendChild(opt);
    }

    // Layer color options
    layerColorSelect.innerHTML = '<option value="">Default (purple)</option>';
    for (const attr of model.layerAttributeNames) {
        const opt = document.createElement('option');
        opt.value = attr;
        opt.textContent = attr;
        layerColorSelect.appendChild(opt);
    }
    layerColorSelect.disabled = model.layerAttributeNames.length === 0;
}

nodeColorSelect.addEventListener('change', () => {
    updateNodeColors();
    renderer.render();
});

nodeColorSelectSetA.addEventListener('change', () => {
    updateNodeColors();
    renderer.render();
});

nodeColorSelectSetB.addEventListener('change', () => {
    updateNodeColors();
    renderer.render();
});

nodeSizeSelect.addEventListener('change', () => {
    updateNodeSizes();
    renderer.render();
});

linkColorSelect.addEventListener('change', () => {
    updateLinkColors();
    renderer.render();
});



function updateNodeSizes() {
    const val = nodeSizeSelect.value;
    if (!val || !model) {
        renderer.nodeSizeFn = null;
        return;
    }

    const [source, attrName] = val.split(':');
    let minVal = Infinity, maxVal = -Infinity;

    if (source === 'node') {
        for (const n of model.nodes) {
            const v = n[attrName];
            if (typeof v === 'number') {
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
        }
    } else {
        for (const sn of model.stateNodes) {
            const v = sn[attrName];
            if (typeof v === 'number') {
                if (v < minVal) minVal = v;
                if (v > maxVal) maxVal = v;
            }
        }
    }

    // Scale function: maps [minVal, maxVal] -> [0.3, 2.0]
    // If all values are the same, just return 1.0 (uniform)
    const range = maxVal - minVal;

    // Save scale for legend
    activeNodeSizeScale = { type: 'size', min: minVal, max: maxVal, attrName };

    const computeScale = (val) => {
        if (typeof val !== 'number') return 1.0;
        if (range === 0) return 1.0;
        const normalized = (val - minVal) / range; // 0.0 to 1.0
        return 0.3 + (normalized * 1.7); // 0.3x smallest to 2.0x largest
    };

    if (source === 'node') {
        renderer.nodeSizeFn = (layerName, nodeName) => {
            const node = model.nodesByName.get(nodeName);
            return node ? computeScale(node[attrName]) : 1.0;
        };
    } else if (source === 'state') {
        renderer.nodeSizeFn = (layerName, nodeName) => {
            const key = `${layerName}::${nodeName}`;
            const sn = model.stateNodeMap.get(key);
            return sn ? computeScale(sn[attrName]) : 1.0;
        };
    }

    renderLegends();
}


function updateNodeColors() {
    activeNodeColorScale = null;
    activeNodeColorScaleA = null;
    activeNodeColorScaleB = null;

    if (!model) {
        renderer.nodeColorFn = null;
        renderLegends();
        return;
    }

    if (layout.layoutType === 'bipartite') {
        const valA = nodeColorSelectSetA.value;
        const valB = nodeColorSelectSetB.value;

        const getScaleObj = (val, isSetA) => {
            if (!val) return null;
            const [source, attrName] = val.split(':');
            let items = [];
            for (const [layerName, info] of model.bipartiteInfo) {
                if (!info.isBipartite) continue;
                const set = isSetA ? info.setA : info.setB;
                for (const nodeName of set) {
                    if (source === 'node') {
                        const n = model.nodesByName.get(nodeName);
                        if (n) items.push(n);
                    } else {
                        const sn = model.stateNodeMap.get(`${layerName}::${nodeName}`);
                        if (sn) items.push(sn);
                    }
                }
            }
            const override = colorScaleOverrides.get(attrName);
            return colorMapper.buildColorScale(items, attrName, override);
        };

        const scA = getScaleObj(valA, true);
        const scB = getScaleObj(valB, false);

        activeNodeColorScaleA = scA;
        activeNodeColorScaleB = scB;

        renderer.nodeColorFn = (layerName, nodeName) => {
            const info = model.bipartiteInfo.get(layerName);
            const isSetA = info && info.setA.has(nodeName);
            const isSetB = info && info.setB.has(nodeName);

            if (isSetA) {
                if (scA) {
                    const [source, attrName] = valA.split(':');
                    const obj = source === 'node' ? model.nodesByName.get(nodeName) : model.stateNodeMap.get(`${layerName}::${nodeName}`);
                    return obj ? scA.scaleFn(obj[attrName]) : '#6b7280';
                } else {
                    return colorMapper.getBipartiteNodeColor(true);
                }
            } else if (isSetB) {
                if (scB) {
                    const [source, attrName] = valB.split(':');
                    const obj = source === 'node' ? model.nodesByName.get(nodeName) : model.stateNodeMap.get(`${layerName}::${nodeName}`);
                    return obj ? scB.scaleFn(obj[attrName]) : '#6b7280';
                } else {
                    return colorMapper.getBipartiteNodeColor(false);
                }
            }
            return '#6b7280'; // fallback
        };
        renderLegends();
        return;
    }

    const val = nodeColorSelect.value;
    if (!val) {
        renderer.nodeColorFn = null;
        renderLegends();
        return;
    }

    const [source, attrName] = val.split(':');

    if (source === 'node') {
        // Color by physical node attribute
        const override = colorScaleOverrides.get(attrName);
        const sc = colorMapper.buildColorScale(model.nodes, attrName, override);
        activeNodeColorScale = sc;
        renderer.nodeColorFn = (layerName, nodeName) => {
            const node = model.nodesByName.get(nodeName);
            return node ? sc.scaleFn(node[attrName]) : '#6b7280';
        };
    } else if (source === 'state') {
        // Color by state node attribute
        const override = colorScaleOverrides.get(attrName);
        const sc = colorMapper.buildColorScale(model.stateNodes, attrName, override);
        activeNodeColorScale = sc;
        renderer.nodeColorFn = (layerName, nodeName) => {
            const key = `${layerName}::${nodeName}`;
            const sn = model.stateNodeMap.get(key);
            return sn ? sc.scaleFn(sn[attrName]) : '#6b7280';
        };
    }

    renderLegends();
}

function updateLinkColors() {
    activeLinkColorScale = null;
    const attrName = linkColorSelect.value;
    if (!attrName || !model) {
        renderer.linkColorFn = null;
        renderLegends();
        return;
    }

    const override = colorScaleOverrides.get(attrName);
    const sc = colorMapper.buildColorScale(model.extended, attrName, override);
    activeLinkColorScale = sc;
    renderer.linkColorFn = (link) => sc.scaleFn(link[attrName]);
    renderLegends();
}

function _hexToRgba(color, alpha) {
    if (color.startsWith('#')) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
    }
    return color;
}

function updateLayerColors() {
    const attrName = layerColorSelect.value;
    if (!attrName || !model) {
        renderer.layerColorFn = null;
        renderer.render();
        return;
    }
    const sc = colorMapper.buildColorScale(model.layers, attrName);
    renderer.layerColorFn = (layerIndex, layer) => {
        const hex = sc.scaleFn(layer[attrName]);
        return {
            fill: _hexToRgba(hex, 0.18),
            border: _hexToRgba(hex, 0.55),
            text: hex,
        };
    };
    renderer.render();
}

layerColorSelect.addEventListener('change', updateLayerColors);

// ---- Zoom Controls ----
zoomInBtn.addEventListener('click', () => {
    if (appMode === 'map') {
        bgMap.zoomIn(1);
        return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const factor = 1.2;
    renderer.offsetX = cx - (cx - renderer.offsetX) * factor;
    renderer.offsetY = cy - (cy - renderer.offsetY) * factor;
    renderer.scale *= factor;
    renderer.render();
});

zoomOutBtn.addEventListener('click', () => {
    if (appMode === 'map') {
        bgMap.zoomOut(1);
        return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const factor = 1 / 1.2;
    renderer.offsetX = cx - (cx - renderer.offsetX) * factor;
    renderer.offsetY = cy - (cy - renderer.offsetY) * factor;
    renderer.scale *= factor;
    renderer.render();
});

zoomResetBtn.addEventListener('click', () => {
    if (appMode === 'map') {
        fitMapToLayers();
        return;
    }

    if (appMode === 'layer' && renderer.layerView) {
        renderer.layerView.resetLayout();
        // Re-fit the viewport to the new layout
        const lr = renderer.layerView.layoutRadius();
        const margin = 60;
        const fitScale = Math.min(canvas.width, canvas.height) / (2 * (lr + margin));
        renderer.layerView.viewScale   = fitScale;
        renderer.layerView.viewOffsetX = 0;
        renderer.layerView.viewOffsetY = 0;
        _ensureLayerViewLoop();
        return;
    }

    // Reset rotation angles to defaults
    renderer.skewX = 0.7;
    renderer.skewY = 0.55;
    renderer.resetLayerOffsets();
    renderer.centerView();
    renderer.render();
});

// ---- Node Info Panel ----
function showNodeInfo(hit) {
    if (!model) return;

    const { layerName, nodeName } = hit;

    // Physical node attributes
    const physicalNode = model.nodesByName.get(nodeName);
    // State node attributes
    const stateNode = model.stateNodeMap.get(`${layerName}::${nodeName}`);
    // Connected links
    const connectedLinks = model.extended.filter(
        l => (l.layer_from === layerName && l.node_from === nodeName) ||
            (l.layer_to === layerName && l.node_to === nodeName)
    );

    infoTitle.textContent = nodeName;

    let html = '';

    // Physical node attributes
    if (physicalNode) {
        html += '<div class="info-section"><h4>Node Attributes</h4>';
        for (const [key, value] of Object.entries(physicalNode)) {
            if (key === 'node_id') continue;
            html += `<div class="info-row"><span class="info-key">${key}</span><span class="info-value">${value ?? 'N/A'}</span></div>`;
        }
        html += '</div>';
    }

    // State node attributes
    if (stateNode) {
        html += '<div class="info-section"><h4>State Node (in ' + layerName + ')</h4>';
        for (const [key, value] of Object.entries(stateNode)) {
            if (['layer_id', 'node_id', 'layer_name', 'node_name'].includes(key)) continue;
            html += `<div class="info-row"><span class="info-key">${key}</span><span class="info-value">${value ?? 'N/A'}</span></div>`;
        }
        html += '</div>';
    }

    // Layer info
    const layerObj = model.layersByName.get(layerName);
    if (layerObj) {
        html += '<div class="info-section"><h4>Layer</h4>';
        for (const [key, value] of Object.entries(layerObj)) {
            if (key === 'layer_id') continue;
            html += `<div class="info-row"><span class="info-key">${key}</span><span class="info-value">${value ?? 'N/A'}</span></div>`;
        }
        html += '</div>';
    }

    // Connections
    if (connectedLinks.length > 0) {
        html += '<div class="info-section"><h4>Connections (' + connectedLinks.length + ')</h4><ul class="info-connections">';
        for (const link of connectedLinks) {
            const isFrom = link.node_from === nodeName && link.layer_from === layerName;
            const otherNode = isFrom ? link.node_to : link.node_from;
            const otherLayer = isFrom ? link.layer_to : link.layer_from;
            const isInter = link.layer_from !== link.layer_to;
            const label = isInter
                ? `${otherNode} (${otherLayer})`
                : otherNode;
            const extraAttrs = Object.entries(link)
                .filter(([k]) => !['layer_from', 'node_from', 'layer_to', 'node_to', 'weight'].includes(k))
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            const suffix = extraAttrs ? ` [${extraAttrs}]` : '';
            html += `<li>${label}${link.weight !== 1 ? ` (w=${link.weight})` : ''}${suffix}</li>`;
        }
        html += '</ul></div>';
    }

    infoContent.innerHTML = html;
    infoPanel.classList.add('visible');
}

function showLinkInfo(link) {
    if (!model) return;

    infoTitle.textContent = link.isInterlayer ? 'Interlayer Link' : 'Intralayer Link';

    let html = '<div class="info-section"><h4>Link Attributes</h4>';

    // Core attributes
    html += `<div class="info-row"><span class="info-key">From</span><span class="info-value">${link.node_from} (${link.layer_from})</span></div>`;
    html += `<div class="info-row"><span class="info-key">To</span><span class="info-value">${link.node_to} (${link.layer_to})</span></div>`;
    html += `<div class="info-row"><span class="info-key">Weight</span><span class="info-value">${link.weight ?? 1}</span></div>`;

    // Extra attributes
    const extraAttrs = Object.entries(link)
        .filter(([k]) => !['layer_from', 'node_from', 'layer_to', 'node_to', 'weight', 'isInterlayer'].includes(k));

    if (extraAttrs.length > 0) {
        html += '<h4 style="margin-top: 12px;">Additional Properties</h4>';
        for (const [key, value] of extraAttrs) {
            html += `<div class="info-row"><span class="info-key">${key}</span><span class="info-value">${value ?? 'N/A'}</span></div>`;
        }
    }

    html += '</div>';

    infoContent.innerHTML = html;
    infoPanel.classList.add('visible');
}

function hideNodeInfo() {
    infoPanel.classList.remove('visible');
}

function showLayerInfo(layerIndex) {
    if (!model || layerIndex < 0 || layerIndex >= model.layers.length) return;

    const layer = model.layers[layerIndex];
    infoTitle.textContent = layer.layer_name;

    let html = '<div class="info-section"><h4>Layer Attributes</h4>';
    for (const [key, value] of Object.entries(layer)) {
        if (key === 'layer_id') continue;
        html += `<div class="info-row"><span class="info-key">${key}</span><span class="info-value">${value ?? 'N/A'}</span></div>`;
    }
    html += '</div>';

    infoContent.innerHTML = html;
    infoPanel.classList.add('visible');
}

closeInfoBtn.addEventListener('click', () => {
    renderer.selectedNode = null;
    renderer.selectedLayer = null;
    hideNodeInfo();
    renderer.render();
});

// ---- Tooltip ----
function showTooltip(hit) {
    if (!hit) return;
    tooltip.textContent = `${hit.nodeName} (${hit.layerName})`;
    tooltip.classList.add('visible');

    // Position near mouse
    document.addEventListener('mousemove', positionTooltip);
}

function positionTooltip(e) {
    tooltip.style.left = (e.clientX + 14) + 'px';
    tooltip.style.top = (e.clientY - 8) + 'px';
}

function hideTooltip() {
    tooltip.classList.remove('visible');
    document.removeEventListener('mousemove', positionTooltip);
}

// ---- Autoload from R pipeline ----
// When called from plot_multilayer(), the URL will have ?autoload=true
// and the JSON is served at /api/network.json
(function autoloadFromR() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoload') === 'true') {
        fetch('/api/network.json')
            .then(resp => {
                if (!resp.ok) throw new Error('Failed to fetch network data from R server');
                return resp.json();
            })
            .then(json => {
                loadData(json);
            })
            .catch(err => {
                console.error('Autoload failed:', err);
            });
    }
})();

function renderScaleLegend(scale, id, titleText) {
    if (!scale) return;
    if (expandedLegends.has(id)) {
        const dom = createLegendDOM(titleText, scale, id);
        legendPanel.appendChild(dom);
    } else {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.cssText = 'pointer-events: auto; font-size: 11px; padding: 6px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; color: #4b5563; font-weight: 600; display: flex; align-items: center; gap: 6px; cursor: grab; transition: all 0.15s ease;';
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg> Expand ${titleText} Legend`;
        btn.onclick = () => {
            if (hasDraggedLegend) return;
            expandedLegends.add(id);
            renderLegends();
        };
        btn.onmousedown = () => btn.style.cursor = 'grabbing';
        btn.onmouseup = () => btn.style.cursor = 'grab';
        btn.onmouseover = () => btn.style.background = '#ffffff';
        btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.95)';
        legendPanel.appendChild(btn);
    }
}

function renderLegends() {
    // Check if dragging has locked the legend to a left/top spot
    const hasFixedPosition = Boolean(legendPanel.style.left);

    legendPanel.innerHTML = '';

    const isBipartite = layout.layoutType === 'bipartite';

    if (!isBipartite) {
        renderScaleLegend(activeNodeColorScale, 'nodeColor', 'Node Color');
    } else {
        const titleA = bipartiteColorLabelA.textContent.replace('Color by ', '').replace('Color By ', '');
        renderScaleLegend(activeNodeColorScaleA, 'nodeColorA', 'Node Color (' + titleA + ')');

        const titleB = bipartiteColorLabelB.textContent.replace('Color by ', '').replace('Color By ', '');
        renderScaleLegend(activeNodeColorScaleB, 'nodeColorB', 'Node Color (' + titleB + ')');
    }

    renderScaleLegend(activeNodeSizeScale, 'nodeSize', 'Node Size');
    renderScaleLegend(activeLinkColorScale, 'linkColor', 'Link Color');
}

function createLegendDOM(titleText, scale, id) {
    const wrapper = document.createElement('div');
    wrapper.className = 'legend-box';
    wrapper.style.cssText = 'background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 10px 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-family: Inter, system-ui, sans-serif; min-width: 140px; pointer-events: auto; cursor: grab;';

    wrapper.onmousedown = () => { wrapper.style.cursor = 'grabbing'; };
    wrapper.onmouseup = () => { wrapper.style.cursor = 'grab'; };

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px; min-height: 16px;';

    const title = document.createElement('div');
    title.textContent = titleText + ': ' + scale.attrName;
    title.style.cssText = 'font-size: 11px; font-weight: 600; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; flex-grow: 1;';

    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-top: -2px; margin-right: -4px;';

    if (scale.canToggle && scale.type !== 'size') {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '⇌';
        toggleBtn.title = 'Switch between Categorical and Continuous palettes';
        toggleBtn.style.cssText = 'background: none; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; color: #4b5563; border-radius: 4px; font-size: 10px; line-height: 1; padding: 2px 4px; font-weight: bold; display: flex; align-items: center; justify-content: center; height: 18px;';
        toggleBtn.onmouseover = () => toggleBtn.style.background = '#f3f4f6';
        toggleBtn.onmouseout = () => toggleBtn.style.background = 'none';
        toggleBtn.onclick = () => {
            const newType = scale.type === 'continuous' ? 'categorical' : 'continuous';
            colorScaleOverrides.set(scale.attrName, newType);
            updateNodeColors();
            updateLinkColors();
            renderer.render();
        };
        controls.appendChild(toggleBtn);
    }

    const minBtn = document.createElement('button');
    minBtn.innerHTML = '✕';
    minBtn.title = 'Minimize Legend';
    minBtn.style.cssText = 'background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 12px; line-height: 1; padding: 2px; height: 18px; display: flex; align-items: center; justify-content: center;';
    minBtn.onmouseover = () => minBtn.style.color = '#4b5563';
    minBtn.onmouseout = () => minBtn.style.color = '#9ca3af';
    minBtn.onclick = () => {
        expandedLegends.delete(id);
        renderLegends();
    };
    controls.appendChild(minBtn);

    header.appendChild(title);
    header.appendChild(controls);
    wrapper.appendChild(header);

    if (scale.type === 'categorical') {
        const list = document.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        for (const [val, col] of scale.map.entries()) {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4b5563;';
            const swatch = document.createElement('div');
            swatch.style.cssText = `width: 12px; height: 12px; border-radius: 50%; background: ${col}; flex-shrink: 0;`;
            const text = document.createElement('span');
            text.textContent = val;
            text.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;';
            row.appendChild(swatch);
            row.appendChild(text);
            list.appendChild(row);
        }
        wrapper.appendChild(list);
    } else if (scale.type === 'continuous' || scale.type === 'size') {
        const gradWrap = document.createElement('div');
        gradWrap.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        const track = document.createElement('div');
        if (scale.type === 'continuous') {
            track.style.cssText = 'height: 12px; border-radius: 6px; background: linear-gradient(to right, rgb(68,1,84), rgb(49,104,142), rgb(53,183,121), rgb(253,231,37));';
        } else {
            track.style.cssText = 'height: 24px; position: relative; border-bottom: 1px solid #e5e7eb; display: flex; align-items: flex-end; justify-content: space-between; padding-bottom: 4px;';
            const dot1 = document.createElement('div');
            dot1.style.cssText = 'width: 4px; height: 4px; background: #6b7280; border-radius: 50%;';
            const dot2 = document.createElement('div');
            dot2.style.cssText = 'width: 12px; height: 12px; background: #6b7280; border-radius: 50%; margin-bottom: -4px; margin-left: 10px;';
            const dot3 = document.createElement('div');
            dot3.style.cssText = 'width: 20px; height: 20px; background: #6b7280; border-radius: 50%; margin-bottom: -8px; margin-left: 10px;';
            track.appendChild(dot1);
            track.appendChild(dot2);
            track.appendChild(dot3);
        }

        const labels = document.createElement('div');
        labels.style.cssText = 'display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; margin-top: 2px;';

        const fmt = (v) => Number.isInteger(v) ? v : v.toFixed(2);
        const minSpan = document.createElement('span'); minSpan.textContent = fmt(scale.min);
        const maxSpan = document.createElement('span'); maxSpan.textContent = fmt(scale.max);
        labels.appendChild(minSpan);
        labels.appendChild(maxSpan);

        gradWrap.appendChild(track);
        gradWrap.appendChild(labels);
        wrapper.appendChild(gradWrap);
    }

    return wrapper;
}

// ── Layer View Legend ──────────────────────────────────────────────────────

function renderLayerViewLegend() {
    if (appMode !== 'layer' || !renderer.layerView) return;
    legendPanel.innerHTML = '';
    for (const scale of renderer.layerView.getLegendScales()) {
        legendPanel.appendChild(
            lvExpandedLegends.has(scale.id)
                ? _createLVLegendBox(scale)
                : _createLVLegendBtn(scale)
        );
    }
}

function _createLVLegendBox(scale) {
    const BOX_CSS = 'background:rgba(255,255,255,0.95);border:1px solid rgba(0,0,0,0.1);border-radius:8px;padding:10px 14px;box-shadow:0 4px 6px rgba(0,0,0,0.05);font-family:Inter,system-ui,sans-serif;min-width:140px;pointer-events:auto;cursor:grab;';
    const wrapper = document.createElement('div');
    wrapper.className = 'legend-box';
    wrapper.style.cssText = BOX_CSS;
    wrapper.onmousedown = () => { wrapper.style.cursor = 'grabbing'; };
    wrapper.onmouseup   = () => { wrapper.style.cursor = 'grab'; };

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px;';
    const titleEl = document.createElement('div');
    titleEl.textContent = `${scale.title}: ${scale.attrName}`;
    titleEl.style.cssText = 'font-size:11px;font-weight:600;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.5px;flex-grow:1;';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:4px;align-items:center;margin-top:-2px;margin-right:-4px;';

    if (scale.canToggle) {
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '⇌';
        toggleBtn.title = 'Switch between Continuous and Categorical display';
        toggleBtn.style.cssText = 'background:none;border:1px solid rgba(0,0,0,0.12);cursor:pointer;color:#4b5563;border-radius:4px;font-size:10px;padding:2px 4px;font-weight:bold;height:18px;';
        toggleBtn.onclick = () => {
            const lv = renderer.layerView;
            if (!lv) return;
            const cur = lv.settings.colorLegendType;
            lv.updateSetting('colorLegendType', cur === 'categorical' ? 'continuous' : 'categorical');
            renderLayerViewLegend();
        };
        controls.appendChild(toggleBtn);
    }

    const minBtn = document.createElement('button');
    minBtn.innerHTML = '✕';
    minBtn.title = 'Minimize';
    minBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#9ca3af;font-size:12px;padding:2px;height:18px;';
    minBtn.onclick = () => { lvExpandedLegends.delete(scale.id); renderLayerViewLegend(); };
    controls.appendChild(minBtn);

    header.appendChild(titleEl);
    header.appendChild(controls);
    wrapper.appendChild(header);

    // Content
    if (scale.type === 'categorical') {
        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;';
        for (const [val, col] of scale.map.entries()) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:#4b5563;';
            const swatch = document.createElement('div');
            swatch.style.cssText = `width:12px;height:12px;border-radius:50%;background:${col};flex-shrink:0;`;
            const text = document.createElement('span');
            text.textContent = val;
            text.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;';
            row.appendChild(swatch); row.appendChild(text); list.appendChild(row);
        }
        wrapper.appendChild(list);
    } else if (scale.type === 'continuous') {
        const gradWrap = document.createElement('div');
        gradWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
        const track = document.createElement('div');
        track.style.cssText = `height:12px;border-radius:6px;background:${scale.gradient};`;
        const labels = document.createElement('div');
        labels.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-top:2px;';
        const minS = document.createElement('span'); minS.textContent = scale.minLabel;
        const maxS = document.createElement('span'); maxS.textContent = scale.maxLabel;
        labels.appendChild(minS); labels.appendChild(maxS);
        gradWrap.appendChild(track); gradWrap.appendChild(labels);
        wrapper.appendChild(gradWrap);
    } else if (scale.type === 'size') {
        const DISP_MAX = 22;
        const minR = scale.minR || DISP_MAX * 0.25;
        const maxR = scale.maxR || DISP_MAX;
        const midR = Math.sqrt(minR * maxR);
        const items = [
            { r: DISP_MAX * minR / maxR, label: scale.minLabel },
            { r: DISP_MAX * midR / maxR, label: scale.midLabel || '' },
            { r: DISP_MAX,               label: scale.maxLabel },
        ];
        const dotsRow = document.createElement('div');
        dotsRow.style.cssText = `display:flex;align-items:flex-end;gap:10px;height:${DISP_MAX * 2 + 4}px;`;
        const labelsRow = document.createElement('div');
        labelsRow.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-top:5px;';
        items.forEach(({ r, label }) => {
            const d = Math.max(3, Math.round(r * 2));
            const dot = document.createElement('div');
            dot.style.cssText = `width:${d}px;height:${d}px;background:#6b7280;border-radius:50%;flex-shrink:0;`;
            dotsRow.appendChild(dot);
            const lbl = document.createElement('span'); lbl.textContent = label;
            labelsRow.appendChild(lbl);
        });
        wrapper.appendChild(dotsRow); wrapper.appendChild(labelsRow);
    }
    return wrapper;
}

function _createLVLegendBtn(scale) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.cssText = 'pointer-events:auto;font-size:11px;padding:6px 10px;box-shadow:0 4px 6px rgba(0,0,0,0.05);background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,0.1);border-radius:8px;color:#4b5563;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"></path></svg> Expand ${scale.title} Legend`;
    btn.onclick = () => { lvExpandedLegends.add(scale.id); renderLayerViewLegend(); };
    return btn;
}

// ---- Screenshot Export ----
const captureBtn = document.getElementById('captureBtn');
const exportDialog = document.getElementById('exportDialog');
const exportCancelBtn = document.getElementById('exportCancelBtn');

captureBtn.addEventListener('click', () => {
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
        const format = btn.dataset.format;
        exportDialog.style.display = 'none';
        await exportScreenshot(format);
    });
});

async function exportScreenshot(format) {
    if (format === 'pdf') {
        // Vector PDF — handled entirely by _exportPDF
        await _exportPDF();
        return;
    }

    // Raster export (PNG / JPG)
    const srcCanvas = document.getElementById('networkCanvas');
    const scale = 2; // 2x for high-quality export

    // Check grid preference
    const includeGrid = document.getElementById('exportGridCheckbox').checked;
    const prevShowGrid = renderer.showGrid;
    renderer.showGrid = includeGrid;
    renderer.render();

    const w = srcCanvas.width;
    const h = srcCanvas.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = w * scale;
    offscreen.height = h * scale;
    const ctx = offscreen.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw the network canvas scaled up
    ctx.drawImage(srcCanvas, 0, 0, offscreen.width, offscreen.height);

    // Restore grid setting
    renderer.showGrid = prevShowGrid;
    renderer.render();

    // Draw branding watermark in bottom-right
    _drawBranding(ctx, offscreen.width, offscreen.height, scale);

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : undefined;

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `multilayer_network.${format}`,
                types: [{
                    description: `${format.toUpperCase()} Image`,
                    accept: { [mimeType]: [`.${format}`] },
                }],
            });
            const writable = await handle.createWritable();
            const blob = await new Promise(resolve => offscreen.toBlob(resolve, mimeType, quality));
            await writable.write(blob);
            await writable.close();
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Save File Picker failed:', err);
        }
    } else {
        // Fallback for browsers without File System Access API
        const dataUrl = offscreen.toDataURL(mimeType, quality);
        const link = document.createElement('a');
        link.download = `multilayer_network.${format}`;
        link.href = dataUrl;
        link.click();
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
    // Dynamically load jsPDF if not already loaded
    if (!window.jspdf) {
        try {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load jsPDF library'));
            });
        } catch (err) {
            alert('Could not load PDF library. Please check your internet connection and try again.');
            console.error(err);
            return;
        }
    }

    try {
        const { jsPDF } = window.jspdf;

        const srcCanvas = document.getElementById('networkCanvas');
        // High-DPI scale for sharp output (4x = ~300 DPI for typical screens)
        const scale = 4;

        // Temporarily adjust renderer for export
        const includeGrid = document.getElementById('exportGridCheckbox').checked;
        const prevShowGrid = renderer.showGrid;
        renderer.showGrid = includeGrid;
        renderer.render();

        const w = srcCanvas.width;
        const h = srcCanvas.height;

        // Render to a high-res offscreen canvas
        const offscreen = document.createElement('canvas');
        offscreen.width = w * scale;
        offscreen.height = h * scale;
        const ctx = offscreen.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offscreen.width, offscreen.height);
        ctx.drawImage(srcCanvas, 0, 0, offscreen.width, offscreen.height);

        // Restore renderer
        renderer.showGrid = prevShowGrid;
        renderer.render();

        // Add branding
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

// ---- Node Search ----
const nodeSearchInput = document.getElementById('nodeSearchInput');
const nodeSearchResults = document.getElementById('nodeSearchResults');
const nodeSearchClearBtn = document.getElementById('nodeSearchClearBtn');

let committedSearchName = null; // the last clicked/confirmed node name

function closeSearchDropdown() {
    nodeSearchResults.style.display = 'none';
    nodeSearchResults.innerHTML = '';
}

function clearNodeSearch() {
    committedSearchName = null;
    nodeSearchInput.value = '';
    closeSearchDropdown();
    if (renderer) {
        renderer.searchedNodeName = null;
        renderer.render();
    }
}

function selectSearchNode(name) {
    committedSearchName = name;
    nodeSearchInput.value = name;
    closeSearchDropdown();
    if (renderer) {
        renderer.searchedNodeName = name;
        renderer.render();
    }
}

nodeSearchInput.addEventListener('input', () => {
    const query = nodeSearchInput.value.trim().toLowerCase();
    if (!model || !query) {
        closeSearchDropdown();
        if (!query && renderer) { renderer.searchedNodeName = committedSearchName; renderer.render(); }
        return;
    }
    const matches = model.nodes
        .filter(n => n.node_name.toLowerCase().includes(query))
        .slice(0, 12);
    if (matches.length === 0) {
        nodeSearchResults.innerHTML = '<div style="font-size:11px;color:#999;padding:6px 10px;">No results</div>';
        nodeSearchResults.style.display = 'block';
        return;
    }
    nodeSearchResults.innerHTML = matches.map(n =>
        `<div data-name="${n.node_name}"
          style="font-size:11px;padding:6px 10px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
        >${n.node_name}</div>`
    ).join('');
    nodeSearchResults.style.display = 'block';
    nodeSearchResults.querySelectorAll('[data-name]').forEach(el => {
        el.addEventListener('mouseover', () => {
            el.style.background = 'rgba(0,0,0,0.06)';
            if (renderer) { renderer.searchedNodeName = el.dataset.name; renderer.render(); }
        });
        el.addEventListener('mouseout', () => {
            el.style.background = '';
            if (renderer) { renderer.searchedNodeName = committedSearchName; renderer.render(); }
        });
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSearchNode(el.dataset.name);
        });
    });
});

nodeSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearNodeSearch();
    if (e.key === 'Enter') {
        const first = nodeSearchResults.querySelector('[data-name]');
        if (first) selectSearchNode(first.dataset.name);
    }
});

nodeSearchInput.addEventListener('blur', () => {
    setTimeout(closeSearchDropdown, 150);
});

nodeSearchClearBtn.addEventListener('click', clearNodeSearch);


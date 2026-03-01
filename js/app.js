/**
 * app.js — Entry point, wires together all modules
 */

import { parseMultilayerData } from './dataParser.js';
import { Renderer } from './renderer.js';
import { ForceLayout } from './layout.js';
import { InteractionHandler } from './interaction.js';
import { ColorMapper } from './colorMapper.js';

// ---- State ----
let model = null;
let positions = null;
let renderer = null;
let colorMapper = new ColorMapper();
let layout = new ForceLayout();

// ---- DOM Elements ----
const canvas = document.getElementById('networkCanvas');
const loadDemoBtn = document.getElementById('loadDemoBtn');
const demoSelect = document.getElementById('demoSelect');
const fileInput = document.getElementById('fileInput');
const nodeColorSelect = document.getElementById('nodeColorSelect');
const linkColorSelect = document.getElementById('linkColorSelect');
const showLabelsCheckbox = document.getElementById('showLabelsCheckbox');
const showLayerNamesCheckbox = document.getElementById('showLayerNamesCheckbox');
const showSetNamesCheckbox = document.getElementById('showSetNamesCheckbox');
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
});

// ---- Load Data ----
function loadData(json) {
    try {
        model = parseMultilayerData(json);

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

        // Set layout type
        if (useBipartiteLayout) {
            layout.layoutType = 'bipartite';
            layoutSelect.value = 'bipartite';
        } else {
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

        renderer.setData(model, positions);
        renderer.centerView();
        renderer.render();

        populateDropdowns();


        // Enable dropdowns
        nodeColorSelect.disabled = false;
        linkColorSelect.disabled = false;
    } catch (err) {
        console.error('Failed to load data:', err);
        alert('Error loading data: ' + err.message);
    }
}

// ---- Load Demo ----
loadDemoBtn.addEventListener('click', async () => {
    try {
        const demoFile = demoSelect.value;
        const resp = await fetch(`data/${demoFile}.json`);
        if (!resp.ok) throw new Error('Failed to fetch demo data');
        const json = await resp.json();
        loadData(json);
    } catch (err) {
        console.error(err);
        alert('Failed to load demo data. Make sure to serve using a local server.');
    }
});

// ---- Toggle Labels ----
showLabelsCheckbox.addEventListener('change', () => {
    renderer.showLabels = showLabelsCheckbox.checked;
    renderer.render();
});

// ---- Toggle Layer Names ----
showLayerNamesCheckbox.addEventListener('change', () => {
    renderer.showLayerNames = showLayerNamesCheckbox.checked;
    renderer.render();
});

// ---- Toggle Set Names ----
showSetNamesCheckbox.addEventListener('change', () => {
    renderer.showSetNames = showSetNamesCheckbox.checked;
    renderer.render();
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

    // Link color options
    linkColorSelect.innerHTML = '<option value="">Type (default)</option>';
    for (const attr of model.linkAttributeNames) {
        const opt = document.createElement('option');
        opt.value = attr;
        opt.textContent = attr;
        linkColorSelect.appendChild(opt);
    }
}

nodeColorSelect.addEventListener('change', () => {
    updateNodeColors();
    renderer.render();
});

linkColorSelect.addEventListener('change', () => {
    updateLinkColors();
    renderer.render();
});

function updateNodeColors() {
    const val = nodeColorSelect.value;
    if (!val || !model) {
        renderer.nodeColorFn = null;
        return;
    }

    const [source, attrName] = val.split(':');

    if (source === 'node') {
        // Color by physical node attribute
        const colorFn = colorMapper.buildColorScale(model.nodes, attrName);
        renderer.nodeColorFn = (layerName, nodeName) => {
            const node = model.nodesByName.get(nodeName);
            return node ? colorFn(node[attrName]) : '#6b7280';
        };
    } else if (source === 'state') {
        // Color by state node attribute
        const colorFn = colorMapper.buildColorScale(model.stateNodes, attrName);
        renderer.nodeColorFn = (layerName, nodeName) => {
            const key = `${layerName}::${nodeName}`;
            const sn = model.stateNodeMap.get(key);
            return sn ? colorFn(sn[attrName]) : '#6b7280';
        };
    }
}

function updateLinkColors() {
    const attrName = linkColorSelect.value;
    if (!attrName || !model) {
        renderer.linkColorFn = null;
        return;
    }

    const colorFn = colorMapper.buildColorScale(model.extended, attrName);
    renderer.linkColorFn = (link) => colorFn(link[attrName]);
}



// ---- Zoom Controls ----
zoomInBtn.addEventListener('click', () => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const factor = 1.2;
    renderer.offsetX = cx - (cx - renderer.offsetX) * factor;
    renderer.offsetY = cy - (cy - renderer.offsetY) * factor;
    renderer.scale *= factor;
    renderer.render();
});

zoomOutBtn.addEventListener('click', () => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const factor = 1 / 1.2;
    renderer.offsetX = cx - (cx - renderer.offsetX) * factor;
    renderer.offsetY = cy - (cy - renderer.offsetY) * factor;
    renderer.scale *= factor;
    renderer.render();
});

zoomResetBtn.addEventListener('click', () => {
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
                // Update dropdown to show it's a custom network
                demoSelect.value = '';
            })
            .catch(err => {
                console.error('Autoload failed:', err);
            });
    }
})();


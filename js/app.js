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

// Legend Scales
let activeNodeColorScale = null;
let activeNodeColorScaleA = null;
let activeNodeColorScaleB = null;
let activeNodeSizeScale = null;
let activeLinkColorScale = null;

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

// Legend Checkboxes and Panel
const showNodeColorLegend = document.getElementById('showNodeColorLegend');
const showNodeColorSetALegend = document.getElementById('showNodeColorSetALegend');
const showNodeColorSetBLegend = document.getElementById('showNodeColorSetBLegend');
const showNodeSizeLegend = document.getElementById('showNodeSizeLegend');
const showLinkColorLegend = document.getElementById('showLinkColorLegend');
const legendPanel = document.getElementById('legendPanel');
const showLabelsCheckbox = document.getElementById('showLabelsCheckbox');
const transformNodesCheckbox = document.getElementById('transformNodesCheckbox');
const showLayerNamesCheckbox = document.getElementById('showLayerNamesCheckbox');
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
        updateNodeColors(); // Ensure node colors match current selection/layout

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

// Legend Togglers
[showNodeColorLegend, showNodeColorSetALegend, showNodeColorSetBLegend, showNodeSizeLegend, showLinkColorLegend].forEach(chk => {
    if (chk) chk.addEventListener('change', renderLegends);
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
            return colorMapper.buildColorScale(items, attrName);
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
        const sc = colorMapper.buildColorScale(model.nodes, attrName);
        activeNodeColorScale = sc;
        renderer.nodeColorFn = (layerName, nodeName) => {
            const node = model.nodesByName.get(nodeName);
            return node ? sc.scaleFn(node[attrName]) : '#6b7280';
        };
    } else if (source === 'state') {
        // Color by state node attribute
        const sc = colorMapper.buildColorScale(model.stateNodes, attrName);
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

    const sc = colorMapper.buildColorScale(model.extended, attrName);
    activeLinkColorScale = sc;
    renderer.linkColorFn = (link) => sc.scaleFn(link[attrName]);
    renderLegends();
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

function renderLegends() {
    legendPanel.innerHTML = '';

    const isBipartite = layout.layoutType === 'bipartite';

    if (!isBipartite && showNodeColorLegend.checked && activeNodeColorScale) {
        legendPanel.appendChild(createLegendDOM('Node Color: ' + activeNodeColorScale.attrName, activeNodeColorScale));
    }
    if (isBipartite && showNodeColorSetALegend.checked && activeNodeColorScaleA) {
        const title = bipartiteColorLabelA.textContent.replace('Color by ', '');
        legendPanel.appendChild(createLegendDOM('Node Color (' + title + '): ' + activeNodeColorScaleA.attrName, activeNodeColorScaleA));
    }
    if (isBipartite && showNodeColorSetBLegend.checked && activeNodeColorScaleB) {
        const title = bipartiteColorLabelB.textContent.replace('Color by ', '');
        legendPanel.appendChild(createLegendDOM('Node Color (' + title + '): ' + activeNodeColorScaleB.attrName, activeNodeColorScaleB));
    }
    if (showNodeSizeLegend.checked && activeNodeSizeScale) {
        legendPanel.appendChild(createLegendDOM('Node Size: ' + activeNodeSizeScale.attrName, activeNodeSizeScale));
    }
    if (showLinkColorLegend.checked && activeLinkColorScale) {
        legendPanel.appendChild(createLegendDOM('Link Color: ' + activeLinkColorScale.attrName, activeLinkColorScale));
    }
}

function createLegendDOM(titleText, scale) {
    const wrapper = document.createElement('div');
    wrapper.className = 'legend-box';
    wrapper.style.cssText = 'background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; padding: 10px 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); font-family: Inter, system-ui, sans-serif; min-width: 140px; pointer-events: auto;';

    const title = document.createElement('div');
    title.textContent = titleText;
    title.style.cssText = 'font-size: 11px; font-weight: 600; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;';
    wrapper.appendChild(title);

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


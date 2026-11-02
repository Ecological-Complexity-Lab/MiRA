/**
 * rBridge.js — MiRA opened from R (emln plot_multilayer() / ggmira mira()).
 *
 * The R server serves the network at /api/network.json and, for ggmira
 * plots, a view spec at /api/view.json. Without a view spec (404, e.g.
 * plot_multilayer()), MiRA loads exactly as before.
 *
 * With a view spec:
 *   1. loadData(network)                  — default view
 *   2. getSessionState()                  — complete default session
 *   3. applyViewSpec(state, spec, ctx)    — patched session + warnings
 *   4. positions recomputed when the spec sets the layout (seeded if given)
 *   5. restoreSessionState(state)         — existing session restore
 * If anything throws, the network is reloaded with the default view, so a
 * bad spec never leaves MiRA half-configured.
 *
 * App functions are passed in (`deps`), the same way other modules are wired.
 */

import { applyViewSpec } from './viewSpec.js';
import { ForceLayout } from './layout.js';
import { buildNodeSetResolver } from './nodeSets.js';

const VIEW_SPEC_URL = '/api/view.json';
const NOTICE_ID = 'viewSpecNotice';

// Dropdowns whose options decide which attributes a view spec may use
const SPEC_SELECT_IDS = [
    'nodeColorSelect', 'nodeColorSelectSetA', 'nodeColorSelectSetB',
    'nodeSizeSelect', 'nodeSizeSelectSetA', 'nodeSizeSelectSetB',
    'intraLinkColorSelect', 'interLinkColorSelect', 'layerColorSelect',
];
// Second arrowhead slider (interlayer panel); restoreSessionState sets only the first
const INTER_ARROWHEAD_SLIDER_ID = 'interArrowheadSizeSlider';
const LEGEND_PANEL_ID = 'legendPanel';
const LEGEND_TOGGLE_ID = 'toggleLegendBtn';
// Legend panel corners (index.html: bottom 50px, right 20px by default)
const LEGEND_CORNERS = {
    'bottom-right': { top: '', bottom: '50px', left: '', right: '20px', alignItems: 'flex-end' },
    'top-right': { top: '50px', bottom: '', left: '', right: '20px', alignItems: 'flex-end' },
    'bottom-left': { top: '', bottom: '50px', left: '20px', right: '', alignItems: 'flex-start' },
};

/**
 * @param {object} networkJson  Network fetched from /api/network.json
 * @param {{ loadData, getSessionState, restoreSessionState, renderer }} deps
 */
export async function loadFromR(networkJson, deps) {
    deps.loadData(networkJson);
    if (!deps.renderer.model) return; // loadData already reported the error

    const fetched = await fetchViewSpec();
    if (fetched.error) {
        showSpecNotice('The plot settings from R were ignored', [fetched.error]);
        return;
    }
    if (fetched.spec !== null) applySpecSafely(networkJson, fetched.spec, deps);
}

/** @returns {Promise<{ spec: object|null, error?: string }>} */
async function fetchViewSpec() {
    let resp;
    try {
        resp = await fetch(VIEW_SPEC_URL, { cache: 'no-store' });
    } catch {
        return { spec: null };
    }
    if (!resp.ok) return { spec: null }; // no view spec served
    try {
        return { spec: await resp.json() };
    } catch {
        return { spec: null, error: 'view spec: not valid JSON' };
    }
}

function applySpecSafely(networkJson, spec, deps) {
    try {
        const warnings = applySpec(spec, deps);
        if (warnings.length) showSpecNotice('Some plot settings from R were ignored', warnings);
    } catch (err) {
        console.error('[MiRA] View spec could not be applied:', err);
        deps.loadData(networkJson);
        showSpecNotice('The plot settings from R could not be applied',
            [`${err.message}. Showing the default view.`]);
    }
}

/** @returns {string[]} warnings */
function applySpec(spec, deps) {
    const model = deps.renderer.model;
    const defaults = deps.getSessionState();
    // Plots from R start with every legend minimized; mira_legends() opens them
    defaults.legend.expandedLegends = [];
    const result = applyViewSpec(defaults, spec, buildContext(model));
    if (result.layout) result.state.positions = computePositions(model, result.layout);

    deps.restoreSessionState(result.state);
    // restoreSessionState does not set the renderer's layout type, which
    // decides bipartite-only drawing (set names, diagonal placement).
    deps.renderer.layoutType = result.state.ui.layoutSelect;
    // The restored view (scale, offset) was centered for the default
    // stacking and spacing
    const rv = result.state.renderer;
    // (and for the default angles)
    if (rv.stackMode !== defaults.renderer.stackMode || rv.layerSpacing !== defaults.renderer.layerSpacing ||
        rv.skewX !== defaults.renderer.skewX || rv.skewY !== defaults.renderer.skewY || result.camera) {
        deps.renderer.centerView();
    }
    if (result.camera) applyCameraView(deps.renderer, result.camera);
    if (result.legendPanel) applyLegendPanel(result.legendPanel);
    const interArrowSlider = document.getElementById(INTER_ARROWHEAD_SLIDER_ID);
    if (interArrowSlider) interArrowSlider.value = rv.arrowheadSize;
    deps.renderer.render();

    if (result.warnings.length) console.warn('[MiRA] View spec warnings:\n' + result.warnings.join('\n'));
    return result.warnings;
}

/** Zoom about the canvas center (as MiRA's zoom buttons), then pan by a fraction of the canvas. */
function applyCameraView(renderer, { zoom, pan }) {
    const dpr = renderer.dpr || 1;
    const cssW = renderer.canvas.width / dpr;
    const cssH = renderer.canvas.height / dpr;
    if (zoom !== undefined) {
        const cx = cssW / 2;
        const cy = cssH / 2;
        renderer.offsetX = cx - (cx - renderer.offsetX) * zoom;
        renderer.offsetY = cy - (cy - renderer.offsetY) * zoom;
        renderer.scale *= zoom;
    }
    if (pan !== undefined) {
        renderer.offsetX += pan[0] * cssW;
        renderer.offsetY -= pan[1] * cssH; // positive y moves the plot up
    }
}

/** Hide the legend panel (with MiRA's own toggle, so its button state agrees), or move it to a corner. */
function applyLegendPanel({ visible, position }) {
    const panel = document.getElementById(LEGEND_PANEL_ID);
    if (position !== undefined && panel) {
        const corner = LEGEND_CORNERS[position];
        for (const side of ['top', 'bottom', 'left', 'right']) panel.style[side] = corner[side];
        panel.style.alignItems = corner.alignItems;
    }
    if (visible === false) document.getElementById(LEGEND_TOGGLE_ID)?.click();
}

function buildContext(model) {
    const resolver = buildNodeSetResolver(model);
    return {
        options: readOptionSets(),
        sets: { hasSets: resolver.hasSets, labelA: resolver.labelA, labelB: resolver.labelB },
        hasBipartite: [...model.bipartiteInfo.values()].some(info => info.isBipartite),
        layerNames: model.layers.map(layer => layer.layer_name),
        values: collectAttributeValues(model),
        nodeNames: new Map(model.nodes.map(node => [String(node.node_name), node.node_name])),
        linkKeys: new Set(model.extended.map(link =>
            `${link.layer_from}::${link.node_from}::${link.layer_to}::${link.node_to}`)), // dataMode.js linkKey
    };
}

/** { [attrName]: Set<value> } over nodes, state nodes, links and layers. */
function collectAttributeValues(model) {
    const values = {};
    for (const items of [model.nodes, model.stateNodes, model.extended, model.layers]) {
        for (const item of items) {
            for (const [attr, value] of Object.entries(item)) {
                if (value === null || value === undefined || typeof value === 'object') continue;
                (values[attr] ??= new Set()).add(value);
            }
        }
    }
    return values;
}

function readOptionSets() {
    const options = {};
    for (const id of SPEC_SELECT_IDS) {
        const select = document.getElementById(id);
        options[id] = new Set(select ? [...select.options].map(o => o.value) : []);
    }
    return options;
}

/** Positions in session format: [[layerName, [[nodeName, {x, y}], ...]], ...] */
function computePositions(model, { type, seed, nested }) {
    const layout = new ForceLayout({ layoutType: type, seed, bipartiteNested: nested });
    layout.bipartiteInfo = model.bipartiteInfo;
    const positions = layout.computeLayout(model);
    return [...positions.entries()].map(([layerName, nodeMap]) => [layerName, [...nodeMap.entries()]]);
}

function showSpecNotice(title, messages) {
    document.getElementById(NOTICE_ID)?.remove();

    const box = document.createElement('div');
    box.id = NOTICE_ID;
    box.className = 'view-spec-notice';
    box.setAttribute('role', 'status');

    const close = document.createElement('button');
    close.className = 'view-spec-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', () => box.remove());

    const heading = document.createElement('strong');
    heading.textContent = title;

    const list = document.createElement('ul');
    for (const message of messages) {
        const item = document.createElement('li');
        item.textContent = message; // messages contain user input: never innerHTML
        list.appendChild(item);
    }

    box.append(close, heading, list);
    document.body.appendChild(box);
}

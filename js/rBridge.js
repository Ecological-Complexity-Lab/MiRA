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
 * With a view spec, the R button (Copy as R code) shows the ggmira code for
 * the current view (rCode.js), read against the default view and the view
 * as R opened it; the spec's `r` field (the mira() call, filter conditions)
 * is R's own text, not a setting.
 *
 * Opened by ggmira's mira_save() (?save=true, in a headless browser): once
 * the plot is drawn and still, window.miraStatus tells R (with the spec
 * warnings), and window.miraSaveToR(options) posts the image to R.
 *
 * App functions are passed in (`deps`), the same way other modules are wired.
 */

import { applyViewSpec } from './viewSpec.js';
import { ForceLayout } from './layout.js';
import { buildNodeSetResolver } from './nodeSets.js';
import { startCameraReadout, cameraValues } from './cameraReadout.js';
import { stateToSpec, specToR, LEGEND_MOVED } from './rCode.js';
import { showRCodePanel } from './rCodePanel.js';

const VIEW_SPEC_URL = '/api/view.json';
const SAVE_URL = '/api/save';
// (no window when unit tests import this module)
const SAVE_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('save') === 'true';
// Longest wait for animations and map tiles before saving anyway
const SETTLE_TIMEOUT_MS = 20000;
const SETTLE_POLL_MS = 100;
const NOTICE_ID = 'viewSpecNotice';
const R_CODE_BUTTON_ID = 'copyRCodeBtn';
const NETWORK_VIEW = 'network';
const DEFAULT_LEGEND_CORNER = 'bottom-right'; // index.html

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
// Views (app.js appMode values) that need the bridge after restore
const DATA_VIEW = 'data';
const MAP_VIEW = 'map';
const META_VIEW = 'metanetwork';
const LAYER_VIEW = 'layer';
const META_LAYER_LIST_ID = 'mnLayerList'; // the meta-network's "Filter Layers" panel
const DATA_MODE_BUTTON_ID = 'dataModeBtn';
// Legend panel corners (index.html: bottom 50px, right 20px by default)
const LEGEND_CORNERS = {
    'bottom-right': { top: '', bottom: '50px', left: '', right: '20px', alignItems: 'flex-end' },
    'top-right': { top: '50px', bottom: '', left: '', right: '20px', alignItems: 'flex-end' },
    'bottom-left': { top: '', bottom: '50px', left: '20px', right: '', alignItems: 'flex-start' },
};

/**
 * @param {object} networkJson  Network fetched from /api/network.json
 * @param {{ loadData, getSessionState, restoreSessionState, renderer, getAppMode, exportImage, isAnimating, finishAnimations }} deps
 */
export async function loadFromR(networkJson, deps) {
    deps.loadData(networkJson);
    if (!deps.renderer.model) { // loadData already reported the error
        reportLoadFailure('MiRA could not read the network');
        return;
    }
    // Camera values in mira_camera() terms, with "Copy for R" (network mode only)
    startCameraReadout(deps.renderer, deps.getAppMode ?? (() => 'network'));

    const fetched = await fetchViewSpec();
    if (fetched.error) {
        showSpecNotice('The plot settings from R were ignored', [fetched.error]);
        await reportRendered(deps, [fetched.error]);
        return;
    }
    const warnings = fetched.spec !== null ? applySpecSafely(networkJson, fetched.spec, deps) : [];
    await reportRendered(deps, warnings);
}

/** mira_save(): MiRA could not open the plot. */
export function reportLoadFailure(message) {
    if (SAVE_MODE) window.miraStatus = { rendered: false, error: message, warnings: [] };
}

/** mira_save(): wait until the plot is drawn and still, then tell R and take its save request. */
async function reportRendered(deps, warnings) {
    if (!SAVE_MODE) return;
    window.miraSaveToR = options => saveToR(deps, options);
    await settled(deps);
    window.miraStatus = { rendered: true, warnings };
}

// Fonts loaded, layout animations (layer view, meta-network) run to rest, map tiles
// loaded and no map zoom animation; at most SETTLE_TIMEOUT_MS
async function settled(deps) {
    await document.fonts?.ready;
    deps.finishAnimations?.();
    const start = performance.now();
    while (performance.now() - start < SETTLE_TIMEOUT_MS) {
        await nextFrame();
        await nextFrame();
        // Leaflet fades tiles in after loading (style.opacity up to 1)
        const tilesLoaded = [...document.querySelectorAll('img.leaflet-tile')]
            .every(img => img.complete && (img.style.opacity === '' || Number(img.style.opacity) >= 1));
        const zooming = document.querySelector('.leaflet-zoom-anim') !== null;
        if (!deps.isAnimating?.() && tilesLoaded && !zooming) return;
        await new Promise(resolve => setTimeout(resolve, SETTLE_POLL_MS));
    }
}

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

/**
 * Export the plot and post it to R's server.
 * @param {{ format: string, resolution: number, background: 'grid'|'white'|'transparent', legends: boolean }} options
 * @returns {Promise<number>} the image size in bytes
 */
async function saveToR(deps, { format, resolution, background, legends }) {
    const image = await deps.exportImage(format, {
        resolution,
        grid: background === 'grid',
        transparent: background === 'transparent',
        panels: legends,
    });
    if (!image) throw new Error('MiRA made no image');
    const resp = await fetch(SAVE_URL, { method: 'POST', body: image });
    if (!resp.ok) throw new Error(`R did not take the image (${resp.status})`);
    return image.size;
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

/** @returns {string[]} the warnings shown */
function applySpecSafely(networkJson, spec, deps) {
    try {
        const warnings = applySpec(spec, deps);
        if (warnings.length) showSpecNotice('Some plot settings from R were ignored', warnings);
        return warnings;
    } catch (err) {
        console.error('[MiRA] View spec could not be applied:', err);
        deps.loadData(networkJson, { warn: false });
        const messages = [`${err.message}. Showing the default view.`];
        showSpecNotice('The plot settings from R could not be applied', messages);
        return messages;
    }
}

/** @returns {string[]} warnings */
function applySpec(spec, deps) {
    const model = deps.renderer.model;
    const defaults = deps.getSessionState();
    // Plots from R open the maps fitted to the layers, not where MiRA's maps were
    defaults.map.mapZoom = null;
    defaults.map.lvMapZoom = null;
    // Plots from R start with every legend minimized; mira_legends() opens them
    defaults.legend.expandedLegends = [];
    const { r, ...settings } = spec; // r: R's own text, for Copy as R code
    const ctx = buildContext(model);
    const result = applyViewSpec(defaults, settings, ctx);
    if (result.layout) result.state.positions = computePositions(model, result.layout);

    deps.restoreSessionState(result.state, { warnData: false }); // loadFromR showed them
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
    if (result.mode) enterView(result.mode.view, deps, result.warnings);
    if (result.mode?.layers && deps.getAppMode?.() === META_VIEW) selectMetaLayers(result.mode.layers);

    if (result.warnings.length) console.warn('[MiRA] View spec warnings:\n' + result.warnings.join('\n'));
    startRCode(deps, { baseline: defaults, applied: deps.getSessionState(), spec, ctx });
    return result.warnings;
}

/** Show the R button; it opens the code for the view at the time of the click. */
function startRCode(deps, ref) {
    const button = document.getElementById(R_CODE_BUTTON_ID);
    if (!button) return;
    button.style.display = '';
    button.onclick = () => {
        const mode = deps.getAppMode?.() ?? NETWORK_VIEW;
        const { spec, notes } = stateToSpec(deps.getSessionState(), ref, ref.ctx, {
            camera: mode === NETWORK_VIEW ? cameraValues(deps.renderer) : null,
            legendPanel: legendPanelState(),
            metaLayers: mode === META_VIEW ? selectedMetaLayers() : null,
            movedLayers: mode === LAYER_VIEW ? (deps.renderer.layerView?.movedBubbleCount() ?? 0) : 0,
        });
        showRCodePanel(specToR(spec), notes);
    };
}

/** The legend panel: shown or hidden (MiRA's toggle), and its corner, or LEGEND_MOVED when dragged. */
function legendPanelState() {
    const hidden = document.getElementById(LEGEND_TOGGLE_ID)?.classList.contains('active');
    const style = document.getElementById(LEGEND_PANEL_ID)?.style;
    const sides = ['top', 'bottom', 'left', 'right'];
    let position = DEFAULT_LEGEND_CORNER;
    if (style && sides.some(side => style[side])) {
        position = Object.keys(LEGEND_CORNERS)
            .find(name => sides.every(side => style[side] === LEGEND_CORNERS[name][side])) ?? LEGEND_MOVED;
    }
    return { visible: !hidden, position };
}

/** The layers selected in the meta-network's "Filter Layers" panel; null when none or all are. */
function selectedMetaLayers() {
    const items = [...document.querySelectorAll(`#${META_LAYER_LIST_ID} li`)];
    const active = items.filter(item => item.classList.contains('active')).map(item => item.dataset.layerName);
    return active.length && active.length < items.length ? active : null;
}

/**
 * restoreSessionState enters every view except Data mode: click its button.
 * A view MiRA cannot open (the map without layer coordinates) leaves the plot
 * in network mode, with a warning.
 */
function enterView(view, deps, warnings) {
    if (view === DATA_VIEW && deps.getAppMode?.() !== DATA_VIEW) document.getElementById(DATA_MODE_BUTTON_ID)?.click();
    const current = deps.getAppMode?.();
    if (current !== undefined && current !== view) {
        warnings.push(`mode.view: MiRA could not open this view${view === MAP_VIEW ? ' (the map needs latitude and longitude for the layers)' : ''}; showing ${current} mode`);
    }
}

/**
 * Select layers in the meta-network's "Filter Layers" panel, with its own
 * items (the other layers are dimmed). The panel starts with none selected.
 */
function selectMetaLayers(layers) {
    for (const item of document.querySelectorAll(`#${META_LAYER_LIST_ID} li`)) {
        if (layers.includes(item.dataset.layerName) && !item.classList.contains('active')) item.click();
    }
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
        ...drawnLinkKeys(model),
    };
}

// The links MiRA draws (weight 0 and duplicates dropped), keyed as dataMode.js
// linkKey does. An undirected link is also found by its reverse, which is the
// row MiRA dropped when the table lists both directions.
export function drawnLinkKeys(model) {
    const key = (lf, nf, lt, nt) => `${lf}::${nf}::${lt}::${nt}`;
    const linkKeys = new Set();
    const reverseLinkKeys = new Map();
    for (const link of [...model.intralayerLinks, ...model.interlayerLinks]) {
        const drawn = key(link.layer_from, link.node_from, link.layer_to, link.node_to);
        linkKeys.add(drawn);
        if (!link.directed) reverseLinkKeys.set(key(link.layer_to, link.node_to, link.layer_from, link.node_from), drawn);
    }
    return { linkKeys, reverseLinkKeys };
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

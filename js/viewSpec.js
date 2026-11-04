/**
 * viewSpec.js — Translate a ggmira view spec (sent from R) into session state.
 *
 * A view spec is a partial description of how the network should look
 * (layout, node / link / layer styling). It is applied by patching a default
 * session (from getSessionState) and handing the result to the existing
 * restoreSessionState, so no session code is duplicated or changed.
 *
 * Pure: no DOM, no fetch. Everything the translation needs about the loaded
 * network comes in through `ctx`:
 *   ctx.options       { [selectId]: Set<optionValue> } — the options each
 *                     dropdown offers after loadData (single source of truth
 *                     for which attributes are valid where)
 *   ctx.sets          { hasSets, labelA, labelB } — from buildNodeSetResolver
 *   ctx.hasBipartite  true when the network has a bipartite layer
 *   ctx.layerNames    layer_name of every layer
 *   ctx.values        { [attrName]: Set<value> } — the distinct values of every
 *                     node, state-node, link and layer attribute (data and
 *                     computed), as stored in the model
 *   ctx.nodeNames     Map<String(node_name), node_name> — every node, keyed by
 *                     its name as JSON sends it
 *   ctx.linkKeys      Set of "layer_from::node_from::layer_to::node_to" — every
 *                     link MiRA draws (intra- and interlayer), as dataMode keys them
 *   ctx.reverseLinkKeys  Map<reversed key, drawn key> for undirected links, so a
 *                     link given in the other direction finds the drawn one
 *
 * Invalid fields are skipped with a warning; the setting keeps its default.
 * Contract: dev/ggmira/view-spec.md (development branch).
 */

import { META_NETWORK_DEFAULTS } from './metaNetwork.js';
import { NODE_SHAPES } from './nodeShapes.js';
import { canonicalPalette, palettesFor } from './palettes.js';

export const VIEW_SPEC_VERSION = 1;

const LAYOUT_TYPES = new Set(['fruchterman', 'kamada_kawai', 'bipartite', 'circle', 'grid', 'random']);
const SHAPES = new Set(NODE_SHAPES);
const NODE_SIZE_MIN = 3;   // node size slider range
const NODE_SIZE_MAX = 25;
const WEIGHT_MIN = 0;      // link weight filter; no upper bound (the
                           // sliders run to the largest weight in the data)
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Slider ranges (index.html)
const LAYER_NAME_SIZE_MIN = 8;
const LAYER_NAME_SIZE_MAX = 32;
const LABEL_SIZE_MIN = 8;
const LABEL_SIZE_MAX = 24;
const LAYER_SPACING_MIN = 100;
const LAYER_SPACING_MAX = 600;
const ARROW_SIZE_MIN = 0;
const ARROW_SIZE_MAX = 3;
const CURVATURE_MIN = 0;
const CURVATURE_MAX = 1;

// Camera (network mode). Angles in degrees; MiRA stores radians
// (renderer.skewX / skewY). Tilt is clamped like mouse dragging (±0.8 rad).
const TILT_MAX = 45;
const ZOOM_MIN = 0.2;      // relative to MiRA's fitted view (interaction.js wheel clamp)
const ZOOM_MAX = 5;
const PAN_MAX = 1;         // fraction of the window
const DEGREES = Math.PI / 180;

// Legend names (spec) → MiRA's legend ids (app.js renderLegends)
export const LEGEND_IDS = {
    node_color: ['nodeColor', 'nodeColorA', 'nodeColorB'],
    node_size: ['nodeSize', 'nodeSizeA', 'nodeSizeB'],
    node_shape: ['nodeShape'],
    intralayer_color: ['intraLinkColor'],
    interlayer_color: ['interLinkColor'],
    layer_color: ['layerColor'],
};
export const LEGEND_ALL = 'all';
const LEGEND_POSITIONS = new Set(['bottom-right', 'top-right', 'bottom-left']);

// Views (spec mode.view) → MiRA's appMode. Only one view opens.
export const VIEWS = {
    network: 'network', grid: 'grid', map: 'map', layer: 'layer',
    meta: 'metanetwork', dashboard: 'dashboard', data: 'data',
};
const GRID_FIELDS = ['columns'];
const META_FIELDS = ['aggregation', 'layout', 'color_by', 'size_by', 'size', 'min_weight', 'nested',
    'labels', 'label_size', 'color', 'layers'];
const GRID_COLUMNS_MIN = 1; // grid columns slider (index.html)
const GRID_COLUMNS_MAX = 8;
export const META_AGGREGATIONS = { occurrence: 'sumOccurrence', weights: 'sumWeights', union: 'union' };
const META_LAYOUTS = new Set(['circular', 'force', 'bipartite']);
export const META_MEASURES = { participation: 'participation', degree: 'metaDegree', uniform: 'uniform' };
const META_SIZE_MIN = 0.2; // meta-network base size slider (index.html)
const META_SIZE_MAX = 3;
const META_LABEL_SIZE_MIN = 8;
const META_LABEL_SIZE_MAX = 24;

const STACK_MODES = new Set(['horizontal', 'vertical']);
const SCALE_TYPES = new Set(['categorical', 'continuous']);
export const PAIR_SEPARATOR = '::'; // layer pair key in the interlayer pair filter

// Spec keywords → dropdown option values
export const SET_COLOR_KEYWORD = '.set';
export const SET_COLOR_VALUE = 'set:membership';
export const SET_COLOR_ATTR = '__mira_set__'; // app.js: the set colors' key in the category overrides
export const INDIVIDUAL_KEYWORD = '.individual';
export const INDIVIDUAL_VALUE = '__individual__';
export const DEFAULT_OPTION = '';

// Automatic shape split (same as the UI): set A circles, set B squares
export const AUTO_SHAPE_A = 'circle';
export const AUTO_SHAPE_B = 'square';

const SECTION_FIELDS = {
    layout:     ['type', 'seed', 'nested'],
    node:       ['color_by', 'color', 'size_by', 'size', 'shape', 'labels', 'label_size', 'perspective', 'highlight'],
    intralayer: ['color_by', 'color', 'min_weight', 'arrow_size'],
    interlayer: ['show', 'color_by', 'color', 'min_weight', 'curvature', 'pairs'],
    layer:      ['color_by', 'color', 'colors', 'labels', 'label_size', 'set_labels', 'stack', 'spacing'],
    scales:     null, // keyed by attribute name; each scale has SCALE_FIELDS
    filter:     ['nodes', 'links'],
    camera:     ['rotate', 'tilt', 'zoom', 'pan'],
    legend:     ['show', 'position'],
    mode:       ['view', ...GRID_FIELDS, ...META_FIELDS],
};
const SCALE_FIELDS = ['type', 'values', 'palette', 'reverse', 'limits'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => JSON.stringify(v);

/**
 * @param {object} state  A complete session state (getSessionState output); not modified
 * @param {object} spec   Parsed view spec
 * @param {object} ctx    See module header
 * @returns {{ state: object, layout: {type, seed, nested}|null,
 *   camera: {zoom, pan}|null, legendPanel: {visible, position}|null, warnings: string[] }}
 *   `layout` is non-null when the spec changes the layout, so the caller must
 *   recompute positions (with `seed` when given). `camera` (zoom and pan,
 *   relative to the fitted view) and `legendPanel` are not session fields:
 *   the caller applies them after restoring the session.
 */
export function applyViewSpec(state, spec, ctx) {
    const warnings = [];
    const warn = (path, message) => warnings.push(`${path}: ${message}`);
    const out = JSON.parse(JSON.stringify(state)); // same round-trip as a saved session file

    if (!isPlainObject(spec)) {
        warn('spec', 'not a JSON object; ignored');
        return { state: out, layout: null, camera: null, legendPanel: null, mode: null, warnings };
    }
    if (spec.version !== VIEW_SPEC_VERSION) {
        warn('version', `expected ${VIEW_SPEC_VERSION}, got ${show(spec.version)}; whole spec ignored`);
        return { state: out, layout: null, camera: null, legendPanel: null, mode: null, warnings };
    }

    let layout = null;
    let camera = null;
    let legendPanel = null;
    let mode = null;
    for (const [key, section] of Object.entries(spec)) {
        if (key === 'version') continue;
        const result = applySection(out, key, section, ctx, warn);
        if (key === 'layout') layout = result;
        if (key === 'camera') camera = result;
        if (key === 'legend') legendPanel = result;
        if (key === 'mode') mode = result;
    }
    return { state: out, layout, camera, legendPanel, mode, warnings };
}

const SECTION_APPLIERS = {
    layout: applyLayout,
    node: applyNode,
    intralayer: applyIntralayer,
    interlayer: applyInterlayer,
    layer: applyLayer,
    scales: applyScales,
    filter: applyFilter,
    camera: applyCamera,
    legend: applyLegend,
    mode: applyMode,
};

function applySection(state, key, section, ctx, warn) {
    const applier = SECTION_APPLIERS[key];
    if (!applier) {
        warn(key, 'not a known section; ignored');
        return null;
    }
    if (!isPlainObject(section)) {
        warn(key, 'must be an object; ignored');
        return null;
    }
    if (SECTION_FIELDS[key]) warnUnknownFields(key, section, SECTION_FIELDS[key], warn);
    return applier(state, section, ctx, warn);
}

function warnUnknownFields(path, object, known, warn) {
    for (const field of Object.keys(object)) {
        if (!known.includes(field)) warn(`${path}.${field}`, 'not a known field; ignored');
    }
}

// ---- Shared validators ------------------------------------------------------
// Each returns the accepted value, or undefined after warning.

function checkColor(value, path, warn) {
    if (typeof value === 'string' && HEX_COLOR.test(value)) return value;
    warn(path, `${show(value)} is not a #rrggbb color`);
    return undefined;
}

function checkNumber(value, min, max, path, warn) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) return value;
    warn(path, `${show(value)} must be a number between ${min} and ${max}`);
    return undefined;
}

function checkMinWeight(value, path, warn) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= WEIGHT_MIN) return value;
    warn(path, `${show(value)} must be a number of ${WEIGHT_MIN} or more`);
    return undefined;
}

function checkBoolean(value, path, warn) {
    if (typeof value === 'boolean') return value;
    warn(path, `${show(value)} must be true or false`);
    return undefined;
}

function checkChoice(value, choices, path, warn) {
    if (choices.has(value)) return value;
    warn(path, `${show(value)} must be one of ${[...choices].join(', ')}`);
    return undefined;
}

/** Copy `section[field]`, if valid, to `target[key]`. `check(value, path)` validates. */
function setChecked(section, field, path, target, key, check) {
    if (!(field in section)) return;
    const value = check(section[field], path);
    if (value !== undefined) target[key] = value;
}

function checkLayerName(value, ctx, path, warn) {
    if (ctx.layerNames.includes(value)) return value;
    warn(path, `${show(value)} is not a layer name`);
    return undefined;
}

/**
 * Bare attribute name → dropdown option value. Node attributes are tried
 * before state-node attributes (`node:module`, then `state:module`).
 * null → Default.
 */
function resolveNodeAttr(value, options, what, path, warn) {
    if (value === null) return DEFAULT_OPTION;
    if (typeof value !== 'string') {
        warn(path, `${show(value)} must be an attribute name or null`);
        return undefined;
    }
    const match = [`node:${value}`, `state:${value}`].find(v => options?.has(v));
    if (match) return match;
    warn(path, `${show(value)} is not an available ${what}`);
    return undefined;
}

/** Link / layer attributes: the option value is the bare name. */
function resolvePlainAttr(value, options, path, warn) {
    if (value === null) return DEFAULT_OPTION;
    if (typeof value === 'string' && options?.has(value)) return value;
    warn(path, `${show(value)} is not an available attribute`);
    return undefined;
}

/**
 * Per-set object { <labelA>: x, <labelB>: y } → { A, B }. `resolveOne(value,
 * set, path)` returns the resolved value or undefined (after warning); sets
 * that are missing or invalid keep `defaults`.
 */
function resolvePerSet(value, path, ctx, warn, defaults, resolveOne) {
    const { hasSets, labelA, labelB } = ctx.sets;
    if (!hasSets) {
        warn(path, 'per-set values need two node sets (a bipartite layer and exactly two node types); ignored');
        return null;
    }
    const setByLabel = new Map([[labelA, 'A'], [labelB, 'B']]);
    const result = { ...defaults };
    for (const [label, v] of Object.entries(value)) {
        const set = setByLabel.get(label);
        if (!set) {
            warn(`${path}.${label}`, `not a node set; expected ${show(labelA)} or ${show(labelB)}`);
            continue;
        }
        const resolved = resolveOne(v, set, `${path}.${label}`);
        if (resolved !== undefined) result[set] = resolved;
    }
    return result;
}

// ---- layout -----------------------------------------------------------------

function applyLayout(state, section, ctx, warn) {
    const ui = state.ui;
    let changed = false;
    let seed = null;

    if ('type' in section) {
        const type = checkLayoutType(section.type, ctx, warn);
        if (type !== undefined) { ui.layoutSelect = type; changed = true; }
    }
    if ('seed' in section) {
        seed = checkSeed(section.seed, warn);
        changed = changed || seed !== null;
    }
    if ('nested' in section) {
        const nested = checkBoolean(section.nested, 'layout.nested', warn);
        if (nested !== undefined) { ui.bipartiteNestedCheckbox = nested; changed = true; }
    }
    return changed ? { type: ui.layoutSelect, seed, nested: ui.bipartiteNestedCheckbox } : null;
}

function checkLayoutType(value, ctx, warn) {
    if (!LAYOUT_TYPES.has(value)) {
        warn('layout.type', `${show(value)} is not a layout; expected one of ${[...LAYOUT_TYPES].join(', ')}`);
        return undefined;
    }
    if (value === 'bipartite' && !ctx.hasBipartite) {
        warn('layout.type', '"bipartite" needs a bipartite layer; ignored');
        return undefined;
    }
    return value;
}

function checkSeed(value, warn) {
    if (Number.isInteger(value)) return value;
    warn('layout.seed', `${show(value)} must be an integer`);
    return null;
}

// ---- node -------------------------------------------------------------------

function applyNode(state, section, ctx, warn) {
    if ('highlight' in section) {
        const node = typeof section.highlight === 'string' ? ctx.nodeNames.get(section.highlight) : undefined;
        if (node !== undefined) state.selectedNode = node;
        else warn('node.highlight', `${show(section.highlight)} is not a node name`);
    }
    if ('color' in section) applyNodeColorConstant(state.ui, section, warn);
    if ('color_by' in section) applyNodeChannel(state.ui, NODE_COLOR, section.color_by, ctx, warn);
    if ('size_by' in section) applyNodeChannel(state.ui, NODE_SIZE, section.size_by, ctx, warn);
    if ('size' in section) {
        const size = checkNumber(section.size, NODE_SIZE_MIN, NODE_SIZE_MAX, 'node.size', warn);
        if (size !== undefined) state.renderer.nodeRadius = size;
    }
    const shapeApplied = 'shape' in section && applyNodeShape(state.ui, section.shape, ctx, warn);
    if (!shapeApplied) applyAutoShapeSplit(state.ui);
    applyNodeLabels(state.renderer, section, warn);
    return null;
}

function applyNodeLabels(renderer, section, warn) {
    const flag = (v, path) => checkBoolean(v, path, warn);
    setChecked(section, 'labels', 'node.labels', renderer, 'showLabels', flag);
    setChecked(section, 'label_size', 'node.label_size', renderer, 'labelSizePx',
        (v, path) => checkNumber(v, LABEL_SIZE_MIN, LABEL_SIZE_MAX, path, warn));
    setChecked(section, 'perspective', 'node.perspective', renderer, 'transformNodes', flag);
}

// A constant node color means "no mapping": switch color to Default so the
// color shows (on bipartite data the default mapping is the set color).
// An explicit color_by in the same section still wins.
function applyNodeColorConstant(ui, section, warn) {
    const color = checkColor(section.color, 'node.color', warn);
    if (color === undefined) return;
    ui.nodeColorPicker = color;
    ui.nodeColorSelect = DEFAULT_OPTION;
    ui.nodeColorSplit = false;
}

const NODE_COLOR = {
    path: 'node.color_by', what: 'attribute', allowSet: true,
    shared: 'nodeColorSelect', setA: 'nodeColorSelectSetA', setB: 'nodeColorSelectSetB', split: 'nodeColorSplit',
};
const NODE_SIZE = {
    path: 'node.size_by', what: 'numeric attribute', allowSet: false,
    shared: 'nodeSizeSelect', setA: 'nodeSizeSelectSetA', setB: 'nodeSizeSelectSetB', split: 'nodeSizeSplit',
};

/** color_by / size_by: a string or null (Shared) or a per-set object. */
function applyNodeChannel(ui, channel, value, ctx, warn) {
    if (isPlainObject(value)) {
        applyNodeChannelPerSet(ui, channel, value, ctx, warn);
        return;
    }
    const resolved = resolveSharedNodeMapping(value, channel, ctx, warn);
    if (resolved === undefined) return;
    ui[channel.shared] = resolved;
    ui[channel.split] = false;
}

function resolveSharedNodeMapping(value, channel, ctx, warn) {
    const options = ctx.options[channel.shared];
    if (value !== SET_COLOR_KEYWORD) return resolveNodeAttr(value, options, channel.what, channel.path, warn);
    if (channel.allowSet && options?.has(SET_COLOR_VALUE)) return SET_COLOR_VALUE;
    warn(channel.path, `${show(SET_COLOR_KEYWORD)} is only available for node color on a network with two node sets`);
    return undefined;
}

function applyNodeChannelPerSet(ui, channel, value, ctx, warn) {
    const optionsBySet = { A: ctx.options[channel.setA], B: ctx.options[channel.setB] };
    const resolveOne = (v, set, path) => resolveNodeAttr(v, optionsBySet[set], channel.what, path, warn);
    const perSet = resolvePerSet(value, channel.path, ctx, warn, { A: DEFAULT_OPTION, B: DEFAULT_OPTION }, resolveOne);
    if (!perSet) return;
    ui[channel.setA] = perSet.A;
    ui[channel.setB] = perSet.B;
    ui[channel.split] = true;
}

/** @returns {boolean} true when a shape setting was applied */
function applyNodeShape(ui, value, ctx, warn) {
    if (isPlainObject(value)) return applyNodeShapePerSet(ui, value, ctx, warn);
    const shape = checkShape(value, 'node.shape', warn);
    if (shape === undefined) return false;
    ui.nodeShapeSelect = shape;
    ui.nodeShapeSplit = false;
    ui.nodeShapeAuto = false;
    return true;
}

function applyNodeShapePerSet(ui, value, ctx, warn) {
    const resolveOne = (v, set, path) => checkShape(v, path, warn);
    const perSet = resolvePerSet(value, 'node.shape', ctx, warn,
        { A: AUTO_SHAPE_A, B: AUTO_SHAPE_B }, resolveOne);
    if (!perSet) return false;
    ui.nodeShapeSelectSetA = perSet.A;
    ui.nodeShapeSelectSetB = perSet.B;
    ui.nodeShapeSplit = true;
    ui.nodeShapeAuto = false;
    return true;
}

function checkShape(value, path, warn) {
    if (SHAPES.has(value)) return value;
    warn(path, `${show(value)} is not a shape; expected one of ${[...SHAPES].join(', ')}`);
    return undefined;
}

// Same rule as the UI: splitting color or size splits shape too, unless
// shapes were set explicitly.
function applyAutoShapeSplit(ui) {
    if (!(ui.nodeColorSplit || ui.nodeSizeSplit) || ui.nodeShapeSplit) return;
    ui.nodeShapeSplit = true;
    ui.nodeShapeAuto = true;
    ui.nodeShapeSelectSetA = AUTO_SHAPE_A;
    ui.nodeShapeSelectSetB = AUTO_SHAPE_B;
}

// ---- links and layers ---------------------------------------------------------

function applyIntralayer(state, section, ctx, warn) {
    applyLinkColor(state, section, ctx, warn, {
        prefix: 'intralayer', select: 'intraLinkColorSelect',
        picker: 'intraLinkColorPicker', rendererColor: 'defaultIntraColor',
    });
    applyMinWeight(state, section, 'intralayer.min_weight', 'intraMinWeight', warn);
    // One arrowhead size for intralayer and interlayer arrows
    setChecked(section, 'arrow_size', 'intralayer.arrow_size', state.renderer, 'arrowheadSize',
        (v, path) => checkNumber(v, ARROW_SIZE_MIN, ARROW_SIZE_MAX, path, warn));
    return null;
}

function applyInterlayer(state, section, ctx, warn) {
    if ('show' in section) {
        const shown = checkBoolean(section.show, 'interlayer.show', warn);
        if (shown !== undefined) state.renderer.showInterlayerLinks = shown;
    }
    applyLinkColor(state, section, ctx, warn, {
        prefix: 'interlayer', select: 'interLinkColorSelect',
        picker: 'interLinkColorPicker', rendererColor: 'defaultInterColor',
    });
    applyMinWeight(state, section, 'interlayer.min_weight', 'interlayerMinWeight', warn);
    setChecked(section, 'curvature', 'interlayer.curvature', state.renderer, 'interlayerCurvature',
        (v, path) => checkNumber(v, CURVATURE_MIN, CURVATURE_MAX, path, warn));
    if ('pairs' in section) applyLayerPairs(state, section.pairs, ctx, warn);
    return null;
}

/** pairs: [[from, to], ...] layer names; the order within a pair does not matter. */
function applyLayerPairs(state, pairs, ctx, warn) {
    if (!Array.isArray(pairs)) {
        warn('interlayer.pairs', 'must be a list of [layer, layer] pairs; ignored');
        return;
    }
    const keys = [];
    pairs.forEach((pair, i) => {
        const path = `interlayer.pairs[${i}]`;
        if (!Array.isArray(pair) || pair.length !== 2) {
            warn(path, `${show(pair)} must be two layer names`);
            return;
        }
        const names = pair.map(name => checkLayerName(name, ctx, path, warn));
        if (names.every(name => name !== undefined)) keys.push(names.join(PAIR_SEPARATOR));
    });
    if (keys.length) state.filter.interPairFilter = keys;
}

function applyLinkColor(state, section, ctx, warn, fields) {
    if ('color_by' in section) {
        const value = resolvePlainAttr(section.color_by, ctx.options[fields.select], `${fields.prefix}.color_by`, warn);
        if (value !== undefined) state.ui[fields.select] = value;
    }
    if ('color' in section) {
        const color = checkColor(section.color, `${fields.prefix}.color`, warn);
        if (color === undefined) return;
        state.ui[fields.picker] = color;
        state.renderer[fields.rendererColor] = color;
    }
}

function applyMinWeight(state, section, path, rendererField, warn) {
    if (!('min_weight' in section)) return;
    const weight = checkMinWeight(section.min_weight, path, warn);
    if (weight !== undefined) state.renderer[rendererField] = weight;
}

function applyLayer(state, section, ctx, warn) {
    if ('color_by' in section) {
        const value = section.color_by === INDIVIDUAL_KEYWORD
            ? INDIVIDUAL_VALUE
            : resolvePlainAttr(section.color_by, ctx.options.layerColorSelect, 'layer.color_by', warn);
        if (value !== undefined) state.ui.layerColorSelect = value;
    }
    if ('color' in section) {
        const color = checkColor(section.color, 'layer.color', warn);
        if (color !== undefined) state.ui.layerColorPicker = color;
    }
    if ('colors' in section) applyLayerColors(state.ui, section.colors, ctx, warn);
    applyLayerDisplay(state.renderer, section, ctx, warn);
    return null;
}

/** colors: { <layer_name>: "#rrggbb" } — used with color_by ".individual". */
function applyLayerColors(ui, colors, ctx, warn) {
    if (!isPlainObject(colors)) {
        warn('layer.colors', 'must be an object of layer name: color; ignored');
        return;
    }
    const byLayer = new Map(ui.layerColors);
    for (const [name, value] of Object.entries(colors)) {
        const path = `layer.colors.${name}`;
        if (checkLayerName(name, ctx, path, warn) === undefined) continue;
        const color = checkColor(value, path, warn);
        if (color !== undefined) byLayer.set(name, color);
    }
    ui.layerColors = [...byLayer];
}

function applyLayerDisplay(renderer, section, ctx, warn) {
    const flag = (v, path) => checkBoolean(v, path, warn);
    setChecked(section, 'labels', 'layer.labels', renderer, 'showLayerNames', flag);
    setChecked(section, 'label_size', 'layer.label_size', renderer, 'layerNameFontSize',
        (v, path) => checkNumber(v, LAYER_NAME_SIZE_MIN, LAYER_NAME_SIZE_MAX, path, warn));
    setChecked(section, 'set_labels', 'layer.set_labels', renderer, 'showSetNames', (v, path) => {
        if (ctx.hasBipartite) return flag(v, path);
        warn(path, 'set names need a bipartite layer; ignored');
        return undefined;
    });
    setChecked(section, 'stack', 'layer.stack', renderer, 'stackMode',
        (v, path) => checkChoice(v, STACK_MODES, path, warn));
    setChecked(section, 'spacing', 'layer.spacing', renderer, 'layerSpacing',
        (v, path) => checkNumber(v, LAYER_SPACING_MIN, LAYER_SPACING_MAX, path, warn));
}

// ---- camera ---------------------------------------------------------------------

/** rotate / tilt go to the session; zoom / pan are returned for the caller. */
function applyCamera(state, section, ctx, warn) {
    setChecked(section, 'rotate', 'camera.rotate', state.renderer, 'skewX', (v, path) => {
        if (typeof v === 'number' && Number.isFinite(v)) return v * DEGREES;
        warn(path, `${show(v)} must be a number (degrees)`);
        return undefined;
    });
    setChecked(section, 'tilt', 'camera.tilt', state.renderer, 'skewY',
        (v, path) => scaled(checkNumber(v, -TILT_MAX, TILT_MAX, path, warn), DEGREES));
    const view = {};
    setChecked(section, 'zoom', 'camera.zoom', view, 'zoom',
        (v, path) => checkNumber(v, ZOOM_MIN, ZOOM_MAX, path, warn));
    setChecked(section, 'pan', 'camera.pan', view, 'pan', (v, path) => {
        const ok = Array.isArray(v) && v.length === 2 &&
            v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= PAN_MAX);
        if (ok) return v;
        warn(path, `${show(v)} must be [x, y], each between -${PAN_MAX} and ${PAN_MAX}`);
        return undefined;
    });
    return Object.keys(view).length ? view : null;
}

const scaled = (value, factor) => (value === undefined ? undefined : value * factor);

// ---- legend ---------------------------------------------------------------------

/**
 * show: "all", a list of legend names (opened; the others minimized), or
 * false (legend panel hidden). position: a corner. The panel's visibility
 * and position are returned for the caller.
 */
function applyLegend(state, section, ctx, warn) {
    const panel = {};
    if ('show' in section) {
        const value = section.show;
        if (value === false) {
            panel.visible = false;
        } else if (value === LEGEND_ALL) {
            setExpandedLegends(state, Object.values(LEGEND_IDS).flat());
        } else if (Array.isArray(value)) {
            const ids = [];
            value.forEach((name, i) => {
                if (Object.hasOwn(LEGEND_IDS, name)) ids.push(...LEGEND_IDS[name]);
                else warn(`legend.show[${i}]`, `${show(name)} is not a legend; expected one of ${Object.keys(LEGEND_IDS).join(', ')}`);
            });
            setExpandedLegends(state, ids);
        } else {
            warn('legend.show', `${show(value)} must be "all", a list of legend names, or false`);
        }
    }
    if ('position' in section) {
        const position = checkChoice(section.position, LEGEND_POSITIONS, 'legend.position', warn);
        if (position !== undefined) panel.position = position;
    }
    return Object.keys(panel).length ? panel : null;
}

function setExpandedLegends(state, ids) {
    state.legend = { lvExpandedLegends: [], ...state.legend, expandedLegends: ids };
}

// ---- filter -------------------------------------------------------------------
// The Data mode filter: only the listed nodes / links are drawn (network and
// map modes), with the "Data filter active" banner to clear it. null = no
// filter. An empty list is kept (it hides everything; R warns before sending
// one); a list whose entries are all invalid is ignored rather than hiding
// everything.

export const LINK_KEY_SEPARATOR = '::'; // dataMode.js linkKey

function applyFilter(state, section, ctx, warn) {
    if ('nodes' in section) {
        applyFilterList(state, 'nodeNames', section.nodes, 'filter.nodes', warn, (name, path) => {
            const node = typeof name === 'string' ? ctx.nodeNames.get(name) : undefined;
            if (node === undefined) warn(path, `${show(name)} is not a node name`);
            return node;
        });
    }
    if ('links' in section) {
        applyFilterList(state, 'linkKeys', section.links, 'filter.links', warn, (link, path) => {
            const ok = Array.isArray(link) && link.length === 4 && link.every(v => typeof v === 'string');
            const key = ok ? link.join(LINK_KEY_SEPARATOR) : undefined;
            if (key !== undefined && ctx.linkKeys.has(key)) return key;
            const drawn = key !== undefined ? ctx.reverseLinkKeys?.get(key) : undefined;
            if (drawn !== undefined) return drawn;
            warn(path, ok ? `${show(link)} is not a link of this network`
                : `${show(link)} must be [layer_from, node_from, layer_to, node_to]`);
            return undefined;
        });
    }
    return null;
}

function applyFilterList(state, key, value, path, warn, resolve) {
    if (value === null) {
        state.filter[key] = null;
        return;
    }
    if (!Array.isArray(value)) {
        warn(path, 'must be a list or null; ignored');
        return;
    }
    const kept = value.map((item, i) => resolve(item, `${path}[${i}]`)).filter(v => v !== undefined);
    if (value.length > 0 && kept.length === 0) {
        warn(path, 'no valid entries; ignored');
        return;
    }
    state.filter[key] = [...new Set(kept)];
}

// ---- scales -------------------------------------------------------------------
// MiRA keeps one color scale per attribute name, used wherever the attribute
// colors nodes, links or layers: { <attr>: { type, values, palette, reverse, limits } }.

function applyScales(state, section, ctx, warn) {
    for (const [attr, scale] of Object.entries(section)) {
        const path = `scales.${attr}`;
        if (!isPlainObject(scale)) {
            warn(path, 'must be an object; ignored');
            continue;
        }
        if (attr === SET_COLOR_KEYWORD) {
            applySetColors(state.ui, scale, ctx, path, warn);
            continue;
        }
        if (!ctx.values[attr]) {
            warn(path, `${show(attr)} is not an attribute of this network; ignored`);
            continue;
        }
        warnUnknownFields(path, scale, SCALE_FIELDS, warn);
        if ('type' in scale) applyScaleType(state.ui, attr, scale.type, ctx.values[attr], path, warn);
        if ('values' in scale) applyScaleValues(state.ui, attr, scale.values, ctx.values[attr], attr, path, warn);
        if ('palette' in scale) applyScalePalette(state.ui, attr, scale.palette, scale.type, path, warn);
        if ('reverse' in scale) applyScaleReverse(state.ui, attr, scale.reverse, path, warn);
        if ('limits' in scale) applyScaleLimits(state.ui, attr, scale.limits, ctx.values[attr], path, warn);
    }
    return null;
}

// palette: a name from palettes.js (any case). With a type, it must be a
// palette of that type; without one, MiRA draws the default where it does not fit.
function applyScalePalette(ui, attr, value, type, path, warn) {
    const name = canonicalPalette(value);
    if (name === undefined) {
        warn(`${path}.palette`, `${show(value)} is not a palette; ignored`);
        return;
    }
    if (SCALE_TYPES.has(type) && !palettesFor(type).includes(name)) {
        warn(`${path}.palette`, `${show(name)} is not a ${type} palette (${palettesFor(type).join(', ')}); ignored`);
        return;
    }
    const palettes = new Map(ui.colorPalettes ?? []);
    palettes.set(attr, name);
    ui.colorPalettes = [...palettes];
}

function applyScaleReverse(ui, attr, value, path, warn) {
    const reverse = checkBoolean(value, `${path}.reverse`, warn);
    if (reverse === undefined) return;
    const reversed = new Set(ui.colorReverse ?? []);
    if (reverse) reversed.add(attr); else reversed.delete(attr);
    ui.colorReverse = [...reversed];
}

// limits: [min, max] of a continuous scale; values outside take the end colors
function applyScaleLimits(ui, attr, value, dataValues, path, warn) {
    const ok = Array.isArray(value) && value.length === 2 &&
        value.every(v => typeof v === 'number' && Number.isFinite(v)) && value[0] < value[1];
    if (!ok) {
        warn(`${path}.limits`, `${show(value)} must be [min, max], two numbers with min < max; ignored`);
        return;
    }
    if (!looksNumeric(dataValues)) {
        warn(`${path}.limits`, `${show(attr)} is not numeric; ignored`);
        return;
    }
    const limits = new Map(ui.colorLimits ?? []);
    limits.set(attr, [...value]);
    ui.colorLimits = [...limits];
}

function applyScaleType(ui, attr, value, dataValues, path, warn) {
    const type = checkChoice(value, SCALE_TYPES, `${path}.type`, warn);
    if (type === undefined) return;
    if (type === 'continuous' && !looksNumeric(dataValues)) {
        warn(`${path}.type`, `"continuous" needs numeric data, and ${show(attr)} is not numeric; ignored`);
        return;
    }
    const overrides = new Map(ui.colorScaleOverrides);
    overrides.set(attr, type);
    ui.colorScaleOverrides = [...overrides];
}

// MiRA's rule (isNumericAttr in app.js): the first non-empty value is a
// number or a numeric string
function looksNumeric(dataValues) {
    for (const v of dataValues) {
        if (v === '') continue;
        return typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)));
    }
    return false;
}

/**
 * scales[".set"]: { values: { <set label>: "#rrggbb" } } — the colors of
 * the two node sets (node color by set membership). MiRA keeps them in the
 * category overrides under SET_COLOR_ATTR, where the legend edits them.
 */
function applySetColors(ui, scale, ctx, path, warn) {
    const { hasSets, labelA, labelB } = ctx.sets;
    if (!hasSets) {
        warn(path, `${show(SET_COLOR_KEYWORD)} colors need two node sets; ignored`);
        return;
    }
    warnUnknownFields(path, scale, ['values'], warn);
    if ('values' in scale) {
        applyScaleValues(ui, SET_COLOR_ATTR, scale.values, new Set([labelA, labelB]), SET_COLOR_KEYWORD, path, warn);
    }
}

/**
 * values: { <value>: "#rrggbb" }. JSON keys are strings; MiRA matches the
 * value as stored in the data, so "6" is matched to the number 6.
 * @param {string} attr   Key in the category overrides
 * @param {Set} dataValues  Values of the attribute in the data
 * @param {string} label  The attribute's name in messages
 */
function applyScaleValues(ui, attr, values, dataValues, label, path, warn) {
    if (!isPlainObject(values)) {
        warn(`${path}.values`, 'must be an object of value: color; ignored');
        return;
    }
    const overrides = new Map(ui.categoryColorOverrides.map(([k, entries]) => [k, new Map(entries)]));
    const colors = overrides.get(attr) ?? new Map();
    for (const [key, value] of Object.entries(values)) {
        const valuePath = `${path}.values.${key}`;
        const dataValue = matchDataValue(key, dataValues);
        if (dataValue === undefined) {
            warn(valuePath, `not a value of ${show(label)}`);
            continue;
        }
        const color = checkColor(value, valuePath, warn);
        if (color !== undefined) colors.set(dataValue, color);
    }
    if (colors.size) overrides.set(attr, colors);
    ui.categoryColorOverrides = [...overrides].map(([k, m]) => [k, [...m]]);
}

function matchDataValue(key, values) {
    if (values.has(key)) return key;
    return [...values].find(v => String(v) === key);
}

// ---- mode -----------------------------------------------------------------------

/**
 * The view MiRA opens in (state.appMode; restoreSessionState enters it, except
 * Data mode, which rBridge enters). Grid takes `columns`; the meta-network
 * starts from the settings MiRA uses when its button is clicked, then takes
 * the spec's fields. Returns { view: appMode } for the caller, with `layers`
 * (meta-network layers to select in its layer panel) when given, or null.
 */
function applyMode(state, section, ctx, warn) {
    if (!Object.hasOwn(VIEWS, section.view)) {
        warn('mode.view', `${show(section.view)} must be one of ${Object.keys(VIEWS).join(', ')}; the plot opens in network mode`);
        return null;
    }
    const view = section.view;
    for (const field of [...GRID_FIELDS, ...META_FIELDS]) {
        const owner = GRID_FIELDS.includes(field) ? 'grid' : 'meta';
        if (field in section && owner !== view) warn(`mode.${field}`, `only for view "${owner}"; ignored`);
    }
    state.appMode = VIEWS[view];
    if (view === 'grid') applyGridMode(state, section, warn);
    const result = { view: VIEWS[view] };
    if (view === 'meta') {
        applyMetaMode(state, section, ctx, warn);
        // The meta-network's "Filter Layers" panel is not a session field:
        // rBridge selects these layers after the view opens
        if ('layers' in section) {
            const layers = checkMetaLayers(section.layers, ctx, warn);
            if (layers) result.layers = layers;
        }
    }
    return result;
}

/** mode.layers: layer names (unknown names warned and dropped), without repeats; or null. */
function checkMetaLayers(value, ctx, warn) {
    if (!Array.isArray(value)) {
        warn('mode.layers', 'must be a list of layer names; ignored');
        return null;
    }
    const layers = [];
    value.forEach((name, i) => {
        const layer = checkLayerName(name, ctx, `mode.layers[${i}]`, warn);
        if (layer !== undefined && !layers.includes(layer)) layers.push(layer);
    });
    return layers;
}

function applyGridMode(state, section, warn) {
    // null: MiRA's own number of columns (restore keeps it when not 1-8)
    state.renderer.gridColumns = null;
    setChecked(section, 'columns', 'mode.columns', state.renderer, 'gridColumns', (v, path) => {
        if (Number.isInteger(v) && v >= GRID_COLUMNS_MIN && v <= GRID_COLUMNS_MAX) return v;
        warn(path, `${show(v)} must be a whole number between ${GRID_COLUMNS_MIN} and ${GRID_COLUMNS_MAX}`);
        return undefined;
    });
}

function applyMetaMode(state, section, ctx, warn) {
    const d = META_NETWORK_DEFAULTS;
    const meta = {
        ...state.meta,
        aggregation: d.aggregation,
        layout: ctx.hasBipartite ? 'bipartite' : d.layout,
        colorBy: d.colorBy,
        sizeBy: d.sizeBy,
        baseSize: d.baseSize,
        minWeight: d.minWeight,
        nestedSort: d.nestedSort,
        showLabels: d.showLabels,
        labelSize: d.labelFontSize,
        uniformColor: d.uniformColor,
        colorSetA: d.uniformColorA,
        colorSetB: d.uniformColorB,
        viewScale: null, // keep the fit computed on entry
    };
    const mapped = (choices) => (v, path) => {
        if (Object.hasOwn(choices, v)) return choices[v];
        warn(path, `${show(v)} must be one of ${Object.keys(choices).join(', ')}`);
        return undefined;
    };
    setChecked(section, 'aggregation', 'mode.aggregation', meta, 'aggregation', mapped(META_AGGREGATIONS));
    setChecked(section, 'layout', 'mode.layout', meta, 'layout', (v, path) => {
        const layout = checkChoice(v, META_LAYOUTS, path, warn);
        if (layout === 'bipartite' && !ctx.hasBipartite) {
            warn(path, '"bipartite" needs a bipartite layer; ignored');
            return undefined;
        }
        return layout;
    });
    setChecked(section, 'color_by', 'mode.color_by', meta, 'colorBy', mapped(META_MEASURES));
    setChecked(section, 'size_by', 'mode.size_by', meta, 'sizeBy', mapped(META_MEASURES));
    setChecked(section, 'size', 'mode.size', meta, 'baseSize',
        (v, path) => checkNumber(v, META_SIZE_MIN, META_SIZE_MAX, path, warn));
    setChecked(section, 'min_weight', 'mode.min_weight', meta, 'minWeight', (v, path) => checkMinWeight(v, path, warn));
    setChecked(section, 'nested', 'mode.nested', meta, 'nestedSort', (v, path) => checkBoolean(v, path, warn));
    setChecked(section, 'labels', 'mode.labels', meta, 'showLabels', (v, path) => checkBoolean(v, path, warn));
    setChecked(section, 'label_size', 'mode.label_size', meta, 'labelSize', (v, path) => {
        if (Number.isInteger(v) && v >= META_LABEL_SIZE_MIN && v <= META_LABEL_SIZE_MAX) return v;
        warn(path, `${show(v)} must be a whole number between ${META_LABEL_SIZE_MIN} and ${META_LABEL_SIZE_MAX}`);
        return undefined;
    });
    if ('color' in section) {
        const value = section.color;
        if (isPlainObject(value)) {
            const colors = resolvePerSet(value, 'mode.color', ctx, warn,
                { A: meta.colorSetA, B: meta.colorSetB }, (v, set, path) => checkColor(v, path, warn));
            if (colors) { meta.colorSetA = colors.A; meta.colorSetB = colors.B; }
        } else {
            // One color: every node (and both sets on bipartite data)
            const color = checkColor(value, 'mode.color', warn);
            if (color !== undefined) Object.assign(meta, { uniformColor: color, colorSetA: color, colorSetB: color });
        }
    }
    state.meta = meta;
}

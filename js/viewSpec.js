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
 *
 * Invalid fields are skipped with a warning; the setting keeps its default.
 * Contract: dev/ggmira/view-spec.md (development branch).
 */

export const VIEW_SPEC_VERSION = 1;

const LAYOUT_TYPES = new Set(['fruchterman', 'kamada_kawai', 'bipartite', 'circle', 'grid', 'random']);
const SHAPES = new Set(['circle', 'square']);
const NODE_SIZE_MIN = 3;   // node size slider range
const NODE_SIZE_MAX = 25;
const WEIGHT_MIN = 0;      // link weight filter; no upper bound (the
                           // sliders run to the largest weight in the data)
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Spec keywords → dropdown option values
const SET_COLOR_KEYWORD = '.set';
const SET_COLOR_VALUE = 'set:membership';
const INDIVIDUAL_KEYWORD = '.individual';
const INDIVIDUAL_VALUE = '__individual__';
const DEFAULT_OPTION = '';

// Automatic shape split (same as the UI): set A circles, set B squares
const AUTO_SHAPE_A = 'circle';
const AUTO_SHAPE_B = 'square';

const SECTION_FIELDS = {
    layout:     ['type', 'seed', 'nested'],
    node:       ['color_by', 'color', 'size_by', 'size', 'shape'],
    intralayer: ['color_by', 'color', 'min_weight'],
    interlayer: ['show', 'color_by', 'color', 'min_weight'],
    layer:      ['color_by', 'color'],
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const show = (v) => JSON.stringify(v);

/**
 * @param {object} state  A complete session state (getSessionState output); not modified
 * @param {object} spec   Parsed view spec
 * @param {object} ctx    See module header
 * @returns {{ state: object, layout: {type, seed, nested}|null, warnings: string[] }}
 *   `layout` is non-null when the spec changes the layout, so the caller must
 *   recompute positions (with `seed` when given).
 */
export function applyViewSpec(state, spec, ctx) {
    const warnings = [];
    const warn = (path, message) => warnings.push(`${path}: ${message}`);
    const out = JSON.parse(JSON.stringify(state)); // same round-trip as a saved session file

    if (!isPlainObject(spec)) {
        warn('spec', 'not a JSON object; ignored');
        return { state: out, layout: null, warnings };
    }
    if (spec.version !== VIEW_SPEC_VERSION) {
        warn('version', `expected ${VIEW_SPEC_VERSION}, got ${show(spec.version)}; whole spec ignored`);
        return { state: out, layout: null, warnings };
    }

    let layout = null;
    for (const [key, section] of Object.entries(spec)) {
        if (key === 'version') continue;
        const result = applySection(out, key, section, ctx, warn);
        if (key === 'layout') layout = result;
    }
    return { state: out, layout, warnings };
}

const SECTION_APPLIERS = {
    layout: applyLayout,
    node: applyNode,
    intralayer: applyIntralayer,
    interlayer: applyInterlayer,
    layer: applyLayer,
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
    warnUnknownFields(key, section, warn);
    return applier(state, section, ctx, warn);
}

function warnUnknownFields(key, section, warn) {
    const known = SECTION_FIELDS[key];
    for (const field of Object.keys(section)) {
        if (!known.includes(field)) warn(`${key}.${field}`, 'not a known field; ignored');
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
    if ('color' in section) applyNodeColorConstant(state.ui, section, warn);
    if ('color_by' in section) applyNodeChannel(state.ui, NODE_COLOR, section.color_by, ctx, warn);
    if ('size_by' in section) applyNodeChannel(state.ui, NODE_SIZE, section.size_by, ctx, warn);
    if ('size' in section) {
        const size = checkNumber(section.size, NODE_SIZE_MIN, NODE_SIZE_MAX, 'node.size', warn);
        if (size !== undefined) state.renderer.nodeRadius = size;
    }
    const shapeApplied = 'shape' in section && applyNodeShape(state.ui, section.shape, ctx, warn);
    if (!shapeApplied) applyAutoShapeSplit(state.ui);
    return null;
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
    return null;
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
    return null;
}

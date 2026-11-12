/**
 * rCode.js — "Copy as R code": the ggmira code that draws what MiRA shows.
 *
 * Only for MiRA opened from R by ggmira (rBridge shows the button). Two steps:
 *   stateToSpec(state, ref, ctx, view) — the session state as a view spec,
 *       the reverse of viewSpec.js applyViewSpec(): a field is written only
 *       when MiRA's state differs from the default view (`ref.baseline`, the
 *       state the R spec was applied to), so the code stays short. Settings
 *       R cannot set come back as notes.
 *   specToR(spec) — that spec as ggmira components, one per line, each line
 *       tagged with its element (node, intralayer, interlayer, layer) for the
 *       colors of ggmira's mira_options().
 * Applying the spec to the baseline gives the state back (tests/rCode.test.js).
 *
 * Pure: no DOM. What is not in the session state (camera zoom and pan, the
 * legend panel, the meta-network's layer panel) comes in through `view`.
 * Contract: dev/ggmira/view-spec.md (development branch).
 */

import {
    LEGEND_IDS, LEGEND_ALL, VIEWS, META_AGGREGATIONS, META_MEASURES, PAIR_SEPARATOR,
    SET_COLOR_KEYWORD, SET_COLOR_VALUE, SET_COLOR_ATTR, INDIVIDUAL_KEYWORD, INDIVIDUAL_VALUE,
    DEFAULT_OPTION, AUTO_SHAPE_A, AUTO_SHAPE_B, LINK_KEY_SEPARATOR, VIEW_SPEC_VERSION,
} from './viewSpec.js';
import { META_NETWORK_DEFAULTS } from './metaNetwork.js';
import { palettesFor } from './palettes.js';

const DEGREES = Math.PI / 180;
const NETWORK_VIEW = 'network';
const DEFAULT_LEGEND_POSITION = 'bottom-right';
export const LEGEND_MOVED = 'moved'; // legend panel dragged away from the corners
const MOVED = LEGEND_MOVED;
const DIGITS = 12;     // significant digits kept from slider values (drops float noise)
// Camera: as the camera readout copied it (cameraReadout.js), enough that the
// view comes back within a pixel
const ANGLE_DIGITS = 1;
const VIEW_DIGITS = 3;
const TILT_MAX = 45;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const PAN_MAX = 1;

// R code layout
const LINE_WIDTH = 80;
const INDENT = '  ';
const FALLBACK_MIRA_CALL = 'mira(net)';
const ELEMENTS = { node: 'node', intralayer: 'intralayer', interlayer: 'interlayer', layer: 'layer' };
const R_RESERVED = new Set(['if', 'else', 'repeat', 'while', 'function', 'for', 'next', 'break', 'TRUE',
    'FALSE', 'NULL', 'Inf', 'NaN', 'NA', 'NA_integer_', 'NA_real_', 'NA_character_', 'in']);
const SYNTACTIC_NAME = /^([A-Za-z]|[.][A-Za-z._])[A-Za-z0-9._]*$/;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clean = (v) => Number(v.toPrecision(DIGITS));
const round = (v, digits) => Number(v.toFixed(digits));
const clamp = (v, max) => Math.max(-max, Math.min(max, v));
const isEmpty = (object) => Object.keys(object).length === 0;

// ---- state → spec -------------------------------------------------------------

/**
 * @param {object} state  The current session (getSessionState)
 * @param {{ baseline: object, applied: object, spec: object|null }} ref
 *   baseline: the session before the R spec (MiRA's default view);
 *   applied: the session right after it; spec: the spec R sent
 * @param {object} ctx    As for applyViewSpec (sets, hasBipartite, layerNames)
 * @param {{ camera?: {rotate, tilt, zoom, pan}|null, legendPanel?: {visible, position},
 *   metaLayers?: string[]|null, movedLayers?: number }} view  What is not in the session state
 *   (movedLayers: layers dragged by hand in the layer view)
 * @returns {{ spec: object, notes: string[] }}
 */
export function stateToSpec(state, ref, ctx, view = {}) {
    const base = ref.baseline;
    const notes = [];
    const spec = { version: VIEW_SPEC_VERSION };
    const put = (key, section) => { if (section && !isEmpty(section)) spec[key] = section; };

    if (ref.spec?.r) spec.r = readR(state, ref);
    put('layout', readLayout(state, ref, notes));
    put('node', readNode(state, base, ctx));
    put('intralayer', readIntralayer(state, base));
    put('interlayer', readInterlayer(state, base));
    put('layer', readLayer(state, base));
    put('scales', readScales(state, base));
    put('filter', readFilter(state, ref, notes));
    put('camera', readCamera(state, base, view.camera));
    put('legend', readLegend(state, ref, view.legendPanel, notes));
    put('mode', readMode(state, base, ctx, view.metaLayers));
    addNotes(state, ref, notes, view);
    return { spec, notes };
}

/** The R text R sent: the mira() call, and the filter conditions while the filter is as R set it. */
function readR(state, ref) {
    const r = { mira: ref.spec.r.mira };
    const filter = {};
    for (const [arg, key] of [['nodes', 'nodeNames'], ['links', 'linkKeys']]) {
        const text = ref.spec.r.filter?.[arg];
        if (text && same(state.filter[key], ref.applied.filter[key])) filter[arg] = text;
    }
    if (!isEmpty(filter)) r.filter = filter;
    return r;
}

function readLayout(state, ref, notes) {
    const ui = state.ui, base = ref.baseline.ui;
    const layout = {};
    // Recomputed in MiRA: an unseeded layout (random start)
    const recomputed = !same(state.positions, ref.applied.positions);
    if (ui.layoutSelect !== base.layoutSelect || recomputed) layout.type = ui.layoutSelect;
    if (ui.bipartiteNestedCheckbox !== base.bipartiteNestedCheckbox) layout.nested = ui.bipartiteNestedCheckbox;
    const seed = ref.spec?.layout?.seed;
    if (!recomputed && Number.isInteger(seed)) layout.seed = seed;
    if (recomputed) {
        notes.push(`The layout was recomputed in MiRA without a seed: this code draws a "${ui.layoutSelect}" ` +
            'layout, which may not place the nodes as on screen. Add seed = to mira_layout() for the same layout on every run.');
    }
    return layout;
}

/** A dropdown option value as a spec attribute: "node:module" → "module", Default → null. */
function attrOf(option) {
    if (option === DEFAULT_OPTION) return null;
    if (option === SET_COLOR_VALUE) return SET_COLOR_KEYWORD;
    const colon = option.indexOf(':');
    return colon === -1 ? option : option.slice(colon + 1);
}

/** Per-set dropdowns as { <set label>: attribute }, without the sets at Default. */
function perSetAttrs(a, b, ctx) {
    const out = {};
    if (a !== DEFAULT_OPTION) out[ctx.sets.labelA] = attrOf(a);
    if (b !== DEFAULT_OPTION) out[ctx.sets.labelB] = attrOf(b);
    return out;
}

function readNode(state, base, ctx) {
    const ui = state.ui, b = base.ui, r = state.renderer, br = base.renderer;
    const node = {};
    if (state.selectedNode !== null && state.selectedNode !== undefined && state.selectedNode !== base.selectedNode) {
        node.highlight = String(state.selectedNode);
    }
    // Color: per set, a mapping, or one color (Default shows the picker's color)
    if (ui.nodeColorSplit) {
        const perSet = perSetAttrs(ui.nodeColorSelectSetA, ui.nodeColorSelectSetB, ctx);
        if (!isEmpty(perSet)) node.color_by = perSet;
    } else if (ui.nodeColorSelect === DEFAULT_OPTION) {
        if (ui.nodeColorSelect !== b.nodeColorSelect || b.nodeColorSplit || ui.nodeColorPicker !== b.nodeColorPicker) {
            node.color = ui.nodeColorPicker;
        }
    } else if (ui.nodeColorSelect !== b.nodeColorSelect || b.nodeColorSplit) {
        node.color_by = attrOf(ui.nodeColorSelect);
    }
    if (ui.nodeSizeSplit) {
        const perSet = perSetAttrs(ui.nodeSizeSelectSetA, ui.nodeSizeSelectSetB, ctx);
        if (!isEmpty(perSet)) node.size_by = perSet;
    } else if (ui.nodeSizeSelect !== b.nodeSizeSelect || b.nodeSizeSplit) {
        node.size_by = attrOf(ui.nodeSizeSelect);
    }
    if (r.nodeRadius !== br.nodeRadius) node.size = r.nodeRadius;
    // Shapes split automatically with color or size need no setting
    if (!ui.nodeShapeAuto) {
        if (ui.nodeShapeSplit) {
            node.shape = { [ctx.sets.labelA]: ui.nodeShapeSelectSetA, [ctx.sets.labelB]: ui.nodeShapeSelectSetB };
        } else if (ui.nodeShapeSelect !== b.nodeShapeSelect || b.nodeShapeSplit) {
            node.shape = ui.nodeShapeSelect;
        }
    }
    if (r.showLabels !== br.showLabels) node.labels = r.showLabels;
    if (r.labelSizePx !== br.labelSizePx) node.label_size = r.labelSizePx;
    if (r.transformNodes !== br.transformNodes) node.perspective = r.transformNodes;
    return node;
}

/** color_by and color of a link section; the color only shows with color_by at Default. */
function readLinkColor(section, state, base, select, picker) {
    const value = state.ui[select];
    if (value !== base.ui[select]) section.color_by = attrOf(value);
    if (value === DEFAULT_OPTION && state.ui[picker] !== base.ui[picker]) section.color = state.ui[picker];
}

function readIntralayer(state, base) {
    const r = state.renderer, br = base.renderer;
    const section = {};
    readLinkColor(section, state, base, 'intraLinkColorSelect', 'intraLinkColorPicker');
    if (r.intraMinWeight !== br.intraMinWeight) section.min_weight = clean(r.intraMinWeight);
    if (r.arrowheadSize !== br.arrowheadSize) section.arrow_size = clean(r.arrowheadSize);
    return section;
}

function readInterlayer(state, base) {
    const r = state.renderer, br = base.renderer;
    const section = {};
    if (r.showInterlayerLinks !== br.showInterlayerLinks) section.show = r.showInterlayerLinks;
    readLinkColor(section, state, base, 'interLinkColorSelect', 'interLinkColorPicker');
    if (r.interlayerMinWeight !== br.interlayerMinWeight) section.min_weight = clean(r.interlayerMinWeight);
    if (r.interlayerCurvature !== br.interlayerCurvature) section.curvature = clean(r.interlayerCurvature);
    const pairs = state.filter.interPairFilter ?? [];
    if (pairs.length && !same(pairs, base.filter.interPairFilter)) {
        section.pairs = pairs.map(key => key.split(PAIR_SEPARATOR));
    }
    return section;
}

function readLayer(state, base) {
    const ui = state.ui, b = base.ui, r = state.renderer, br = base.renderer;
    const section = {};
    if (ui.layerColorSelect !== b.layerColorSelect) {
        section.color_by = ui.layerColorSelect === INDIVIDUAL_VALUE ? INDIVIDUAL_KEYWORD : attrOf(ui.layerColorSelect);
    }
    if (ui.layerColorSelect === DEFAULT_OPTION && ui.layerColorPicker !== b.layerColorPicker) {
        section.color = ui.layerColorPicker;
    }
    if (ui.layerColorSelect === INDIVIDUAL_VALUE) {
        const before = new Map(b.layerColors);
        const colors = {};
        for (const [name, color] of ui.layerColors) if (before.get(name) !== color) colors[name] = color;
        if (!isEmpty(colors)) section.colors = colors;
    }
    if (r.showLayerNames !== br.showLayerNames) section.labels = r.showLayerNames;
    if (r.layerNameFontSize !== br.layerNameFontSize) section.label_size = r.layerNameFontSize;
    if (r.showSetNames !== br.showSetNames) section.set_labels = r.showSetNames;
    if (r.stackMode !== br.stackMode) section.stack = r.stackMode;
    if (r.layerSpacing !== br.layerSpacing) section.spacing = r.layerSpacing;
    return section;
}

/** { <attr>: { type, values, palette, reverse, limits } }, the parts that differ from the default view. */
function readScales(state, base) {
    const ui = state.ui, b = base.ui;
    const asMap = (entries) => new Map(entries ?? []);
    const colorMaps = (entries) => new Map((entries ?? []).map(([attr, values]) => [attr, new Map(values)]));
    const types = asMap(ui.colorScaleOverrides), baseTypes = asMap(b.colorScaleOverrides);
    const values = colorMaps(ui.categoryColorOverrides), baseValues = colorMaps(b.categoryColorOverrides);
    const palettes = asMap(ui.colorPalettes), basePalettes = asMap(b.colorPalettes);
    const limits = asMap(ui.colorLimits), baseLimits = asMap(b.colorLimits);
    const reversed = new Set(ui.colorReverse ?? []), baseReversed = new Set(b.colorReverse ?? []);

    const scales = {};
    const scaleOf = (attr) => (scales[attr === SET_COLOR_ATTR ? SET_COLOR_KEYWORD : attr] ??= {});
    for (const [attr, type] of types) if (baseTypes.get(attr) !== type) scaleOf(attr).type = type;
    for (const [attr, colors] of values) {
        const before = baseValues.get(attr) ?? new Map();
        const changed = {};
        for (const [value, color] of colors) if (before.get(value) !== color) changed[String(value)] = color;
        if (!isEmpty(changed)) scaleOf(attr).values = changed;
    }
    for (const [attr, name] of palettes) if (basePalettes.get(attr) !== name) scaleOf(attr).palette = name;
    for (const attr of reversed) if (!baseReversed.has(attr)) scaleOf(attr).reverse = true;
    for (const attr of baseReversed) if (!reversed.has(attr)) scaleOf(attr).reverse = false;
    for (const [attr, range] of limits) if (!same(baseLimits.get(attr), range)) scaleOf(attr).limits = range.map(clean);
    // Set colors show only while nodes are colored by set
    const bySet = ui.nodeColorSelect === SET_COLOR_VALUE && !ui.nodeColorSplit;
    if (!bySet) delete scales[SET_COLOR_KEYWORD];
    return scales;
}

/** Data mode filter: node names and links ([layer_from, node_from, layer_to, node_to]). */
function readFilter(state, ref, notes) {
    const filter = {};
    const f = state.filter, base = ref.baseline.filter;
    if (!same(f.nodeNames, base.nodeNames)) filter.nodes = f.nodeNames === null ? null : f.nodeNames.map(String);
    if (!same(f.linkKeys, base.linkKeys)) {
        filter.links = f.linkKeys === null ? null : f.linkKeys.map(key => key.split(LINK_KEY_SEPARATOR));
    }
    if (f.layerNames && !same(f.layerNames, base.layerNames)) {
        notes.push(`A layer filter (${f.layerNames.length} layers kept): R can filter nodes and links, not layers.`);
    }
    return filter;
}

/** mira_camera() values (network view only), the ones that differ from MiRA's fitted view. */
function readCamera(state, base, values) {
    if (!values || state.appMode !== NETWORK_VIEW) return null;
    const camera = {};
    const rotate = round(values.rotate, ANGLE_DIGITS);
    const tilt = round(clamp(values.tilt, TILT_MAX), ANGLE_DIGITS);
    const zoom = round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, values.zoom)), VIEW_DIGITS);
    const pan = values.pan.map(v => round(clamp(v, PAN_MAX), VIEW_DIGITS) + 0); // + 0: no -0
    if (rotate !== round(base.renderer.skewX / DEGREES, ANGLE_DIGITS)) camera.rotate = rotate;
    if (tilt !== round(base.renderer.skewY / DEGREES, ANGLE_DIGITS)) camera.tilt = tilt;
    if (zoom !== 1) camera.zoom = zoom;
    if (pan.some(v => v !== 0)) camera.pan = pan;
    return camera;
}

/** The open legends (when changed in MiRA or set by R), the corner, or show = false. */
function readLegend(state, ref, panel, notes) {
    const legend = {};
    if (panel?.visible === false) {
        legend.show = false;
    } else {
        const openIds = new Set(state.legend?.expandedLegends ?? []);
        const names = Object.keys(LEGEND_IDS).filter(name => LEGEND_IDS[name].some(id => openIds.has(id)));
        const changed = !same(state.legend?.expandedLegends, ref.applied.legend?.expandedLegends);
        if (names.length && (changed || ref.spec?.legend?.show !== undefined)) {
            legend.show = names.length === Object.keys(LEGEND_IDS).length ? LEGEND_ALL : names;
        }
    }
    if (panel?.position === MOVED) notes.push('The legends were dragged: R puts them in a corner (mira_legends(position = )).');
    else if (panel?.position && panel.position !== DEFAULT_LEGEND_POSITION) legend.position = panel.position;
    return legend;
}

function readMode(state, base, ctx, metaLayers) {
    const view = Object.keys(VIEWS).find(name => VIEWS[name] === state.appMode);
    if (!view || view === NETWORK_VIEW) return null;
    const mode = { view };
    if (view === 'grid' && Number.isInteger(state.renderer.gridColumns) &&
        state.renderer.gridColumns !== base.renderer.gridColumns) {
        mode.columns = state.renderer.gridColumns;
    }
    if (view === 'meta') Object.assign(mode, readMeta(state.meta, ctx, metaLayers));
    return mode;
}

/** mira_mode_meta() fields: the meta-network settings that differ from those MiRA opens it with. */
function readMeta(meta, ctx, metaLayers) {
    const d = META_NETWORK_DEFAULTS;
    const out = {};
    const nameOf = (choices, value) => Object.keys(choices).find(name => choices[name] === value);
    if (meta.aggregation !== d.aggregation) out.aggregation = nameOf(META_AGGREGATIONS, meta.aggregation);
    if (meta.layout !== (ctx.hasBipartite ? 'bipartite' : d.layout)) out.layout = meta.layout;
    if (meta.colorBy !== d.colorBy) out.color_by = nameOf(META_MEASURES, meta.colorBy);
    if (meta.sizeBy !== d.sizeBy) out.size_by = nameOf(META_MEASURES, meta.sizeBy);
    if (meta.baseSize !== d.baseSize) out.size = clean(meta.baseSize);
    if (meta.minWeight !== d.minWeight) out.min_weight = clean(meta.minWeight);
    if (meta.nestedSort !== d.nestedSort) out.nested = meta.nestedSort;
    if (meta.showLabels !== d.showLabels) out.labels = meta.showLabels;
    if (meta.labelSize !== d.labelFontSize) out.label_size = meta.labelSize;
    if (ctx.sets.hasSets) {
        if (meta.colorSetA !== d.uniformColorA || meta.colorSetB !== d.uniformColorB) {
            out.color = meta.colorSetA === meta.colorSetB
                ? meta.colorSetA
                : { [ctx.sets.labelA]: meta.colorSetA, [ctx.sets.labelB]: meta.colorSetB };
        }
    } else if (meta.uniformColor !== d.uniformColor) {
        out.color = meta.uniformColor;
    }
    if (metaLayers?.length) out.layers = metaLayers;
    return out;
}

/** What R cannot set, compared with the plot as R opened it. */
function addNotes(state, ref, notes, view = {}) {
    const applied = ref.applied;
    const moved = (state.renderer.layerOffsets ?? []).filter(([, offset]) => offset.x !== 0 || offset.y !== 0);
    if (!same(state.renderer.layerOffsets, applied.renderer.layerOffsets) && moved.length) {
        notes.push(`${moved.length === 1 ? 'A layer was' : `${moved.length} layers were`} moved with Cmd+drag: R cannot move single layers.`);
    }
    if (view.movedLayers > 0) {
        notes.push(`${view.movedLayers === 1 ? 'A layer was' : `${view.movedLayers} layers were`} moved by hand in the layer view: R cannot set their positions.`);
    }
    if (state.appMode === 'layer' && state.layerView && applied.layerView &&
        !same(state.layerView.settings, applied.layerView.settings)) {
        notes.push("The layer view's own settings (bubble size, spacing, links): R opens the layer view with its defaults.");
    }
    if (state.appMode === 'map' && !same(mapSettings(state.map), mapSettings(applied.map))) {
        notes.push('The map settings (opacity, street map, layers shown): R opens the map with its defaults.');
    }
}

const mapSettings = (map) => map && ({
    opacity: map.mapOpacity, image: map.showMapImage, locations: map.showLocations,
    street: map.streetMap, layers: map.activeMapLayers,
});

// ---- spec → R -----------------------------------------------------------------

/**
 * @param {object} spec  From stateToSpec
 * @returns {{ element: string|null, text: string }[]} The code, line by line;
 *   `element` (node, intralayer, interlayer, layer, or null) colors the line.
 */
export function specToR(spec) {
    const calls = [{ element: null, text: spec.r?.mira ?? FALLBACK_MIRA_CALL }];
    const add = (element, fn, args) => {
        const given = args.filter(([, value]) => value !== undefined);
        if (given.length) calls.push({ element, text: callText(fn, given) });
    };
    const scales = { ...(spec.scales ?? {}) };
    const takeScale = (attr) => {
        const scale = scales[attr];
        delete scales[attr]; // MiRA has one scale per attribute: give it once
        return scale;
    };

    const layout = spec.layout ?? {};
    if (!isEmpty(layout)) {
        const args = [['seed', layout.seed], ['nested', layout.nested]];
        calls.push({ element: null, text: callText('mira_layout', [
            ...(layout.type !== undefined ? [[null, layout.type]] : []), ...args.filter(([, v]) => v !== undefined)]) });
    }

    const node = { ...(spec.node ?? {}) };
    if (scales[SET_COLOR_KEYWORD] && node.color_by === undefined) node.color_by = SET_COLOR_KEYWORD;
    add(ELEMENTS.node, 'mira_node', [
        ['color_by', node.color_by], ['color', node.color], ['size_by', node.size_by], ['size', node.size],
        ['shape', node.shape], ['labels', node.labels], ['label_size', node.label_size],
        ['perspective', node.perspective], ['highlight', node.highlight],
        ...scaleArgs(node.color_by, takeScale),
    ]);
    const intra = spec.intralayer ?? {};
    add(ELEMENTS.intralayer, 'mira_intralayer', [
        ['color_by', intra.color_by], ['color', intra.color], ['min_weight', intra.min_weight],
        ['arrow_size', intra.arrow_size], ...scaleArgs(intra.color_by, takeScale),
    ]);
    const inter = spec.interlayer ?? {};
    add(ELEMENTS.interlayer, 'mira_interlayer', [
        ['show', inter.show], ['color_by', inter.color_by], ['color', inter.color],
        ['min_weight', inter.min_weight], ['curvature', inter.curvature],
        ['pairs', inter.pairs && { list: inter.pairs }], ...scaleArgs(inter.color_by, takeScale),
    ]);
    const layer = spec.layer ?? {};
    const individual = layer.color_by === INDIVIDUAL_KEYWORD;
    add(ELEMENTS.layer, 'mira_layer', [
        ['color_by', layer.color_by], ['color', layer.color],
        ...(individual ? [['color_values', layer.colors]] : scaleArgs(layer.color_by, takeScale)),
        ['labels', layer.labels], ['label_size', layer.label_size], ['set_labels', layer.set_labels],
        ['stack', layer.stack], ['spacing', layer.spacing],
    ]);

    const filter = spec.filter ?? {};
    add(null, 'mira_filter', [
        ['nodes', 'nodes' in filter ? { code: spec.r?.filter?.nodes ?? rValue(filter.nodes) } : undefined],
        ['links', 'links' in filter ? { code: spec.r?.filter?.links ?? linkCondition(filter.links) } : undefined],
    ]);
    const camera = spec.camera ?? {};
    add(null, 'mira_camera', [['rotate', camera.rotate], ['tilt', camera.tilt], ['zoom', camera.zoom], ['pan', camera.pan]]);
    const legend = spec.legend ?? {};
    if (!isEmpty(legend)) {
        const show = legend.show === LEGEND_ALL ? undefined : legend.show;
        calls.push({ element: null, text: callText('mira_legends', [['show', show], ['position', legend.position]]
            .filter(([, v]) => v !== undefined)) });
    }
    if (spec.mode) {
        const { view, ...fields } = spec.mode;
        const args = Object.entries(fields).map(([name, value]) => [name, value]);
        calls.push({ element: null, text: callText(`mira_mode_${view}`, args) });
    }

    return calls.flatMap((call, i) => {
        const last = i === calls.length - 1;
        const lines = call.text.split('\n');
        return lines.map((line, j) => ({
            element: call.element,
            text: (i === 0 ? '' : INDENT) + line + (last || j < lines.length - 1 ? '' : ' +'),
        }));
    });
}

/**
 * The scale type ggmira infers from a scale's other settings (mira_scales.R
 * .scale_type): a palette's type, continuous for limits, categorical for
 * colors per value. color_scale is written only when it says more.
 */
function impliedType(scale) {
    if (scale.palette !== undefined) {
        return palettesFor('continuous').includes(scale.palette) ? 'continuous' : 'categorical';
    }
    if (scale.limits !== undefined) return 'continuous';
    if (scale.values !== undefined) return 'categorical';
    return undefined;
}

const withoutImpliedType = (scale) =>
    (scale && scale.type === impliedType(scale) ? { ...scale, type: undefined } : scale);

/** The scale arguments of a component whose color_by is `colorBy`. */
function scaleArgs(colorBy, takeScale) {
    if (colorBy === undefined || colorBy === null) return [];
    if (typeof colorBy === 'string') {
        const scale = withoutImpliedType(takeScale(colorBy));
        return scale ? [
            ['color_scale', scale.type], ['color_values', scale.values], ['color_palette', scale.palette],
            ['color_reverse', scale.reverse], ['color_limits', scale.limits],
        ] : [];
    }
    // Per set: each part named by the sets whose attribute has a scale
    const parts = { type: {}, values: {}, palette: {}, reverse: {}, limits: {} };
    for (const [label, attr] of Object.entries(colorBy)) {
        const scale = attr === null || attr === SET_COLOR_KEYWORD ? undefined : withoutImpliedType(takeScale(attr));
        if (!scale) continue;
        for (const part of Object.keys(parts)) if (scale[part] !== undefined) parts[part][label] = scale[part];
    }
    const named = (part, asList) => (isEmpty(parts[part]) ? undefined : asList ? { list: parts[part] } : parts[part]);
    return [
        ['color_scale', named('type')], ['color_values', named('values', true)], ['color_palette', named('palette')],
        ['color_reverse', named('reverse')], ['color_limits', named('limits', true)],
    ];
}

/** links filter as a condition on net$extended (mira_filter() takes conditions for links). */
function linkCondition(links) {
    if (links === null) return 'NULL';
    const keys = links.map(link => link.join(LINK_KEY_SEPARATOR));
    return `paste(layer_from, node_from, layer_to, node_to, sep = "${LINK_KEY_SEPARATOR}") %in% ${rValue(keys)}`;
}

/**
 * `fn(name = value, ...)`; an argument without a name is positional. Wrapped
 * past LINE_WIDTH, continuation lines aligned after the "(".
 */
function callText(fn, args) {
    const parts = args.map(([name, value]) => {
        const text = value && typeof value === 'object' && 'code' in value ? value.code : rValue(value);
        return name === null ? text : `${name} = ${text}`;
    });
    const one = `${fn}(${parts.join(', ')})`;
    if (one.length + INDENT.length <= LINE_WIDTH) return one;
    const pad = ' '.repeat(fn.length + 1);
    const lines = [];
    let line = `${fn}(`;
    parts.forEach((part, i) => {
        const piece = part + (i < parts.length - 1 ? ',' : ')');
        const start = line === `${fn}(` || line === pad;
        if (!start && INDENT.length + line.length + 1 + piece.length > LINE_WIDTH) {
            lines.push(line);
            line = pad + piece;
        } else {
            line += (start ? '' : ' ') + piece;
        }
    });
    lines.push(line);
    return lines.join('\n');
}

/** A JSON value as R: c() for vectors (one value bare) and named vectors, list() for `{ list: x }` and nested values. */
function rValue(value) {
    if (value === null) return 'NULL';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
        const nested = value.some(v => v !== null && typeof v === 'object');
        if (value.length === 1 && !nested) return rValue(value[0]); // R needs no c() for one value
        return `${nested ? 'list' : 'c'}(${value.map(rValue).join(', ')})`;
    }
    if ('list' in value && Object.keys(value).length === 1) {
        const inner = value.list;
        return Array.isArray(inner)
            ? `list(${inner.map(rValue).join(', ')})`
            : `list(${Object.entries(inner).map(([k, v]) => `${rName(k)} = ${rValue(v)}`).join(', ')})`;
    }
    const nested = Object.values(value).some(v => v !== null && typeof v === 'object');
    return `${nested ? 'list' : 'c'}(${Object.entries(value).map(([k, v]) => `${rName(k)} = ${rValue(v)}`).join(', ')})`;
}

/** A name in c(name = ...): bare when R allows it, else quoted. */
function rName(name) {
    return SYNTACTIC_NAME.test(name) && !R_RESERVED.has(name) ? name : JSON.stringify(name);
}

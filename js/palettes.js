/**
 * palettes.js — Named color palettes for categorical and continuous scales.
 *
 * Categorical palettes give one color per value (values beyond the palette
 * reuse its colors); continuous palettes are color stops for a gradient.
 * Most come from chroma.js's ColorBrewer set; the others are written out:
 * magma and cividis (viridisLite, 9 stops) and Okabe-Ito (colorblind-safe,
 * R's palette.colors()).
 */

export const DEFAULT_CATEGORICAL_PALETTE = 'Dark2';
export const DEFAULT_CONTINUOUS_PALETTE = 'viridis';

const OWN_STOPS = {
    magma:   ['#000004', '#1D1147', '#51127C', '#822681', '#B63679', '#E65164', '#FB8861', '#FEC287', '#FCFDBF'],
    cividis: ['#00204D', '#05366E', '#414D6B', '#61646F', '#7C7B78', '#9B9477', '#BCAF6F', '#E0CB5E', '#FFEA46'],
    'Okabe-Ito': ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#000000'],
};
// chroma.js names, where they differ from ours
const CHROMA_NAMES = { viridis: 'Viridis' };

export const CATEGORICAL_PALETTES = ['Dark2', 'Set1', 'Set2', 'Set3', 'Paired', 'Accent', 'Okabe-Ito'];
export const SEQUENTIAL_PALETTES = ['viridis', 'magma', 'cividis', 'Blues', 'Greens', 'Reds', 'Purples',
    'Oranges', 'Greys', 'YlOrRd', 'YlGnBu'];
export const DIVERGING_PALETTES = ['RdBu', 'RdYlBu', 'Spectral', 'PiYG', 'BrBG', 'PuOr'];
export const CONTINUOUS_PALETTES = [...SEQUENTIAL_PALETTES, ...DIVERGING_PALETTES];

/** The palettes for a scale type ('categorical' or 'continuous'). */
export function palettesFor(type) {
    return type === 'continuous' ? CONTINUOUS_PALETTES : CATEGORICAL_PALETTES;
}

/** Our spelling of a palette name, matched without case; undefined when unknown. */
export function canonicalPalette(name) {
    if (typeof name !== 'string') return undefined;
    const lower = name.toLowerCase();
    return [...CATEGORICAL_PALETTES, ...CONTINUOUS_PALETTES].find(p => p.toLowerCase() === lower);
}

/** The palette a scale of `type` draws for `name`: the name, or the type's default when it does not fit. */
export function usedPalette(type, name) {
    if (palettesFor(type).includes(name)) return name;
    return type === 'continuous' ? DEFAULT_CONTINUOUS_PALETTE : DEFAULT_CATEGORICAL_PALETTE;
}

/**
 * The colors of `name` for a scale of `type`, reversed when asked. A name
 * that is not a palette of that type gives the type's default.
 * @returns {string[]}
 */
export function paletteColors(type, name, reverse = false) {
    const chosen = usedPalette(type, name);
    const colors = [...(OWN_STOPS[chosen] ?? globalThis.chroma.brewer[CHROMA_NAMES[chosen] ?? chosen])];
    return reverse ? colors.reverse() : colors;
}

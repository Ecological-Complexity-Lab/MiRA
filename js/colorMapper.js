/**
 * colorMapper.js — Maps values to colors using categorical or numeric palettes
 */

// Curated categorical palette (vibrant, distinguishable)
const CATEGORICAL_PALETTE = [
    '#6ee7b7', // emerald
    '#fbbf24', // amber
    '#f87171', // red
    '#60a5fa', // blue
    '#a78bfa', // violet
    '#fb923c', // orange
    '#34d399', // green
    '#f472b6', // pink
    '#38bdf8', // sky
    '#facc15', // yellow
    '#c084fc', // purple
    '#4ade80', // lime
    '#fb7185', // rose
    '#22d3ee', // cyan
    '#e879f9', // fuchsia
];

// Layer palette — slightly muted, semi-transparent for layer backgrounds
const LAYER_PALETTE = [
    'rgba(99, 102, 241, 0.18)',   // indigo
    'rgba(16, 185, 129, 0.18)',   // emerald
    'rgba(245, 158, 11, 0.18)',   // amber
    'rgba(239, 68, 68, 0.18)',    // red
    'rgba(139, 92, 246, 0.18)',   // violet
    'rgba(14, 165, 233, 0.18)',   // sky
    'rgba(249, 115, 22, 0.18)',   // orange
];

const LAYER_BORDER_PALETTE = [
    'rgba(99, 102, 241, 0.55)',
    'rgba(16, 185, 129, 0.55)',
    'rgba(245, 158, 11, 0.55)',
    'rgba(239, 68, 68, 0.55)',
    'rgba(139, 92, 246, 0.55)',
    'rgba(14, 165, 233, 0.55)',
    'rgba(249, 115, 22, 0.55)',
];

const NODE_LAYER_COLORS = [
    '#818cf8', // indigo
    '#34d399', // emerald
    '#fbbf24', // amber
    '#f87171', // red
    '#a78bfa', // violet
    '#38bdf8', // sky
    '#fb923c', // orange
];

// Bipartite set colors (matching stabilitygame.html plant/pollinator palette)
export const BIPARTITE_SET_A_COLOR = '#34d399'; // green (plants)
export const BIPARTITE_SET_B_COLOR = '#f472b6'; // pink (pollinators)

export class ColorMapper {
    constructor() {
        this.categoryMaps = new Map(); // attrName -> Map(value -> color)
    }

    /**
     * Get a color for a layer (background fill)
     */
    getLayerFill(layerIndex) {
        return LAYER_PALETTE[layerIndex % LAYER_PALETTE.length];
    }

    getLayerBorder(layerIndex) {
        return LAYER_BORDER_PALETTE[layerIndex % LAYER_BORDER_PALETTE.length];
    }

    getNodeLayerColor(layerIndex) {
        return NODE_LAYER_COLORS[layerIndex % NODE_LAYER_COLORS.length];
    }

    /**
     * Get node color for bipartite set membership
     */
    getBipartiteNodeColor(isSetA) {
        return isSetA ? BIPARTITE_SET_A_COLOR : BIPARTITE_SET_B_COLOR;
    }

    /**
     * Build a color mapping for a given attribute across a collection of items.
     * Returns a function: value -> color
     */
    buildColorScale(items, attrName) {
        const values = items.map(item => item[attrName]).filter(v => v !== undefined && v !== null);
        const uniqueValues = [...new Set(values)];

        // Check if numeric. We allow numbers and string-represented numbers (excluding pure whitespace).
        const allNumeric = values.length > 0 && values.every(v =>
            typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))
        );

        // Treat as continuous if all values are numeric, AND (there are more than 2 unique values, 
        // OR it matches common continuous attribute names)
        const isContinuousName = /weight|abundance|degree|strength|mass|size|value/i.test(attrName);
        const useContinuous = allNumeric && (uniqueValues.length > 2 || isContinuousName);

        if (useContinuous) {
            // Numeric gradient
            const nums = values.map(Number);
            const min = Math.min(...nums);
            const max = Math.max(...nums);
            const range = max - min || 1;

            return (value) => {
                if (value === undefined || value === null) return '#6b7280';
                const t = (Number(value) - min) / range;
                return numericGradient(t);
            };
        } else {
            // Categorical
            const colorMap = new Map();
            uniqueValues.forEach((val, i) => {
                colorMap.set(val, CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
            });

            return (value) => {
                if (value === undefined || value === null) return '#6b7280';
                return colorMap.get(value) || '#6b7280';
            };
        }
    }
}

/**
 * Interpolate using a multi-stop Viridis-inspired continuous palette
 * t in [0, 1]
 */
function numericGradient(t) {
    // Viridis stops: dark purple -> blue -> green -> yellow
    const stops = [
        [68, 1, 84],     // 0.0: #440154
        [49, 104, 142],  // 0.33: #31688e
        [53, 183, 121],  // 0.66: #35b779
        [253, 231, 37]   // 1.0: #fde725
    ];

    // Clamp t
    t = Math.max(0, Math.min(1, t));
    if (t === 1) return `rgb(${stops[3][0]}, ${stops[3][1]}, ${stops[3][2]})`;

    // Find segment
    const segment = t * (stops.length - 1);
    const index = Math.floor(segment);
    const fraction = segment - index;

    const [r1, g1, b1] = stops[index];
    const [r2, g2, b2] = stops[index + 1];

    const r = Math.round(r1 + (r2 - r1) * fraction);
    const g = Math.round(g1 + (g2 - g1) * fraction);
    const b = Math.round(b1 + (b2 - b1) * fraction);

    return `rgb(${r}, ${g}, ${b})`;
}

export const defaultColorMapper = new ColorMapper();

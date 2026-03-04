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

        // Check if numeric
        const allNumeric = values.length > 0 && values.every(v => typeof v === 'number' || !isNaN(Number(v)));

        if (allNumeric && uniqueValues.length > 5) {
            // Numeric gradient: cool blue → warm orange
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
 * Interpolate between two colors for numeric gradients
 * t in [0, 1] → blue (#3b82f6) to orange (#f59e0b)
 */
function numericGradient(t) {
    // From HSL(217, 91%, 60%) to HSL(38, 92%, 50%)
    const r1 = 59, g1 = 130, b1 = 246;
    const r2 = 245, g2 = 158, b2 = 11;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

export const defaultColorMapper = new ColorMapper();

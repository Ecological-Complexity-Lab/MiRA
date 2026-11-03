/**
 * Intralayer link width: weight × 2 px up to 8 px, rescaled only when large
 * weights are common (99th percentile above 4), so those networks keep their
 * proportions and the others draw exactly as before.
 */
import { describe, it, expect } from 'vitest';
import { intraLinkWidthScale, intraLinkWidth } from '../js/linkWidth.js';

const links = (...weights) => weights.map(weight => ({ weight }));
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

describe('intralayer link width', () => {
    it('weights up to 4 draw as before (weight × 2 px), small ones too', () => {
        const scale = intraLinkWidthScale(links(0.01, 0.5, 1, 4));
        expect(scale).toBe(1);
        expect([0.01, 0.5, 1, 4].map(w => intraLinkWidth(w, scale))).toEqual([0.02, 1, 2, 8]);
    });

    it('common large weights are scaled so the 99th percentile draws at 8 px', () => {
        const scale = intraLinkWidthScale(links(...range(100, i => i + 1))); // 1..100, 99th percentile 99
        expect(scale).toBeCloseTo(4 / 99, 12);
        expect(intraLinkWidth(99, scale)).toBeCloseTo(8, 12);
        expect(intraLinkWidth(49.5, scale)).toBeCloseTo(4, 12);
        expect(intraLinkWidth(100, scale)).toBe(8); // above the percentile: capped
    });

    it('a few large outliers do not thin the other links', () => {
        // 200 links up to 3.5, two outliers: the 99th percentile stays below 4
        const ws = [...range(200, i => (i + 1) * 3.5 / 200), 24.6, 20];
        expect(intraLinkWidthScale(links(...ws))).toBe(1);
        expect(intraLinkWidth(24.6, 1)).toBe(8); // capped, as before
    });

    it('when rescaled, very small weights stay visible', () => {
        const scale = intraLinkWidthScale(links(...range(100, i => i + 1)));
        expect(intraLinkWidth(1, scale)).toBe(0.5);
    });

    it('links without a weight draw at 2 px; no weights leave the scale at 1', () => {
        expect(intraLinkWidth(undefined)).toBe(2);
        expect(intraLinkWidth(null)).toBe(2);
        expect(intraLinkWidthScale([])).toBe(1);
        expect(intraLinkWidthScale([{}, { weight: null }])).toBe(1);
    });
});

/**
 * Fitting the maps to the layers: distinct places, padding clear of the
 * panels over the map, one place centered.
 */
import { describe, it, expect } from 'vitest';
import { distinctPlaces, coveredPadding } from '../js/mapFit.js';

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const MAP = rect(0, 0, 1400, 850);

describe('distinctPlaces', () => {
    it('merges layers at one place (within ~100 m)', () => {
        expect(distinctPlaces([[-0.909, -89.6], [-0.909, -89.6], [-0.533, -90.4], [-0.5331, -90.4001]]))
            .toEqual([[-0.909, -89.6], [-0.533, -90.4]]);
    });
    it('takes numeric strings and skips missing coordinates', () => {
        expect(distinctPlaces([['33.3', '35.1'], [null, 1], ['x', 2], [33.3, 35.1]])).toEqual([[33.3, 35.1]]);
    });
});

describe('coveredPadding', () => {
    const PANELS = [
        { side: 'top', rect: rect(0, 0, 1400, 38) },          // toolbar
        { side: 'left', rect: rect(12, 50, 240, 550) },       // side panels
        { side: 'right', rect: rect(1170, 430, 210, 370) },   // legends
        { side: 'bottom', rect: rect(12, 805, 350, 33) },     // map controls
    ];
    it('clears each panel, plus the margin', () => {
        expect(coveredPadding(MAP, PANELS, 50)).toEqual({ top: 88, left: 302, right: 280, bottom: 95 });
    });
    it('ignores hidden or empty panels', () => {
        expect(coveredPadding(MAP, [{ side: 'right', rect: rect(1380, 800, 0, 0) }], 20))
            .toEqual({ top: 20, left: 20, right: 20, bottom: 20 });
    });
    it('falls back to the margin when the panels leave too little room', () => {
        const small = [{ side: 'left', rect: rect(12, 50, 240, 300) }, { side: 'right', rect: rect(290, 200, 200, 190) }];
        expect(coveredPadding(rect(0, 0, 500, 400), small, 50)).toEqual({ top: 50, left: 50, right: 50, bottom: 50 });
    });
});

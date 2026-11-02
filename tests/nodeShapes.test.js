/**
 * Node shapes: every shape has the circle's area (sizes stay comparable)
 * and is centered on the node.
 */
import { describe, it, expect } from 'vitest';
import {
    traceNodeShape, NODE_SHAPES,
    SHAPE_CIRCLE, SHAPE_SQUARE, SHAPE_TRIANGLE, SHAPE_DIAMOND,
} from '../js/nodeShapes.js';

// A 2D context that records the path as a polygon (rect as 4 corners, arc as a circle)
function recordingContext() {
    const path = { points: [], circle: null };
    const ctx = {
        beginPath() { path.points = []; path.circle = null; },
        moveTo(x, y) { path.points.push([x, y]); },
        lineTo(x, y) { path.points.push([x, y]); },
        closePath() {},
        rect(x, y, w, h) { path.points.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]); },
        arc(x, y, r) { path.circle = { x, y, r }; },
    };
    return { ctx, path };
}

// Shoelace formula
const area = pts => Math.abs(pts.reduce((sum, [x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    return sum + x1 * y2 - x2 * y1;
}, 0)) / 2;

// Centroid of a triangle or a centrally symmetric polygon: the mean of its vertices
const centroid = pts => pts.reduce(([sx, sy], [x, y]) => [sx + x / pts.length, sy + y / pts.length], [0, 0]);

function trace(shape, x = 50, y = 40, r = 10) {
    const { ctx, path } = recordingContext();
    traceNodeShape(ctx, x, y, r, shape);
    return path;
}

describe('node shapes', () => {
    it('lists the four shapes', () => {
        expect(NODE_SHAPES).toEqual(['circle', 'square', 'triangle', 'diamond']);
    });

    it('draws a circle of radius r, also for an unknown shape', () => {
        expect(trace(SHAPE_CIRCLE).circle).toEqual({ x: 50, y: 40, r: 10 });
        expect(trace('hexagon').circle).toEqual({ x: 50, y: 40, r: 10 });
    });

    for (const [shape, corners] of [[SHAPE_SQUARE, 4], [SHAPE_TRIANGLE, 3], [SHAPE_DIAMOND, 4]]) {
        it(`${shape}: ${corners} corners, the circle's area, centered on the node`, () => {
            const { points, circle } = trace(shape);
            expect(circle).toBeNull();
            expect(points).toHaveLength(corners);
            expect(area(points)).toBeCloseTo(Math.PI * 100, 6);
            const [cx, cy] = centroid(points);
            expect(cx).toBeCloseTo(50, 6);
            expect(cy).toBeCloseTo(40, 6);
        });
    }

    it('the triangle points up and the diamond stands on a corner', () => {
        const top = pts => pts.reduce((a, b) => (b[1] < a[1] ? b : a));
        expect(top(trace(SHAPE_TRIANGLE).points)[0]).toBeCloseTo(50, 6);
        expect(top(trace(SHAPE_DIAMOND).points)[0]).toBeCloseTo(50, 6);
    });
});

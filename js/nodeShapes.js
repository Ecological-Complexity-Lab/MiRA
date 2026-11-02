/**
 * nodeShapes.js — Canvas path for a node marker.
 *
 * Shapes distinguish bipartite sets when their color or size schemes are
 * split. Every shape has the same area as the circle of radius r, so node
 * size comparisons stay fair across shapes.
 */

export const SHAPE_CIRCLE = 'circle';
export const SHAPE_SQUARE = 'square';
export const SHAPE_TRIANGLE = 'triangle';
export const SHAPE_DIAMOND = 'diamond';

/** Every shape, in the order the dropdowns list them. */
export const NODE_SHAPES = [SHAPE_CIRCLE, SHAPE_SQUARE, SHAPE_TRIANGLE, SHAPE_DIAMOND];

// Equal-area sizes, per unit of the circle's radius
const SQUARE_HALF_SIDE_PER_RADIUS = Math.sqrt(Math.PI) / 2;
const DIAMOND_HALF_DIAGONAL_PER_RADIUS = Math.sqrt(Math.PI / 2);
// Equilateral triangle, distance from its centroid to a vertex
const TRIANGLE_CIRCUMRADIUS_PER_RADIUS = Math.sqrt(4 * Math.PI / (3 * Math.sqrt(3)));

/** Begin a new path for a node of the given shape centered on (x, y). */
export function traceNodeShape(ctx, x, y, r, shape) {
    ctx.beginPath();
    if (shape === SHAPE_SQUARE) {
        const h = r * SQUARE_HALF_SIDE_PER_RADIUS;
        ctx.rect(x - h, y - h, 2 * h, 2 * h);
        return;
    }
    if (shape === SHAPE_DIAMOND) {
        const d = r * DIAMOND_HALF_DIAGONAL_PER_RADIUS;
        ctx.moveTo(x, y - d);
        ctx.lineTo(x + d, y);
        ctx.lineTo(x, y + d);
        ctx.lineTo(x - d, y);
        ctx.closePath();
        return;
    }
    if (shape === SHAPE_TRIANGLE) {
        // Pointing up, centered on its centroid
        const R = r * TRIANGLE_CIRCUMRADIUS_PER_RADIUS;
        const halfSide = R * Math.sqrt(3) / 2;
        ctx.moveTo(x, y - R);
        ctx.lineTo(x + halfSide, y + R / 2);
        ctx.lineTo(x - halfSide, y + R / 2);
        ctx.closePath();
        return;
    }
    ctx.arc(x, y, r, 0, Math.PI * 2);
}

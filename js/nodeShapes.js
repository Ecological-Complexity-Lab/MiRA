/**
 * nodeShapes.js — Canvas path for a node marker.
 *
 * Shapes distinguish bipartite sets when their color or size schemes are
 * split. A square has the same area as the circle of radius r, so node size
 * comparisons stay fair across shapes.
 */

export const SHAPE_CIRCLE = 'circle';
export const SHAPE_SQUARE = 'square';

const SQUARE_HALF_SIDE_PER_RADIUS = Math.sqrt(Math.PI) / 2; // equal-area square

/** Begin a new path for a node of the given shape centered on (x, y). */
export function traceNodeShape(ctx, x, y, r, shape) {
    ctx.beginPath();
    if (shape === SHAPE_SQUARE) {
        const h = r * SQUARE_HALF_SIDE_PER_RADIUS;
        ctx.rect(x - h, y - h, 2 * h, 2 * h);
        return;
    }
    ctx.arc(x, y, r, 0, Math.PI * 2);
}

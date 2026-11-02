/**
 * Meta-network node shapes follow network mode: the shape function app.js
 * passes on (renderer.nodeShapeFn), asked with no layer (the node's set
 * comes from its type).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMultilayerData } from '../js/dataParser.js';
import { MetaNetwork } from '../js/metaNetwork.js';
import { buildNodeSetResolver, SET_A } from '../js/nodeSets.js';
import { SHAPE_CIRCLE, SHAPE_SQUARE } from '../js/nodeShapes.js';

// 3 birds (set A) and 2 plants (set B), one bipartite layer
const model = () => parseMultilayerData(JSON.parse(
    readFileSync(new URL('./fixtures/calc_G_bipartite_complete_2x3.json', import.meta.url), 'utf8')));

// A 2D context that accepts every call and counts rect() and arc()
function countingContext() {
    const calls = { rect: 0, arc: 0 };
    const ctx = new Proxy({}, {
        get: (target, key) => {
            if (key in target) return target[key];
            if (key === 'rect' || key === 'arc') return () => { calls[key]++; };
            if (key === 'measureText') return () => ({ width: 0 });
            return () => {};
        },
        set: (target, key, value) => { target[key] = value; return true; },
    });
    return { ctx, calls };
}

function drawn(nodeShapeFn) {
    const meta = new MetaNetwork(model(), 800, 600);
    meta.nodeShapeFn = nodeShapeFn;
    const { ctx, calls } = countingContext();
    meta.render(ctx, 800, 600);
    return calls;
}

describe('meta-network node shapes', () => {
    it('draws circles without a shape function', () => {
        expect(drawn(null)).toEqual({ rect: 0, arc: 5 });
    });

    it('draws each node in its set\'s shape, as network mode', () => {
        const m = model();
        const sets = buildNodeSetResolver(m);
        const birdsSquare = (layer, node) => (sets.getNodeSet(layer, node) === SET_A ? SHAPE_SQUARE : SHAPE_CIRCLE);
        expect(drawn(birdsSquare)).toEqual({ rect: 3, arc: 2 });
    });

    it('draws one shape for every node', () => {
        expect(drawn(() => SHAPE_SQUARE)).toEqual({ rect: 5, arc: 0 });
    });
});

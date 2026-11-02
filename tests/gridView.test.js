/**
 * Grid view and the Data mode filter: the grid draws what network mode draws
 * (layers and nodes kept; links kept whose two nodes are kept).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { GridView } from '../js/gridView.js';
import { dataMode } from '../js/dataMode.js';

// A 2D context that accepts every call; measureText for the layer names
function stubContext() {
    return new Proxy({}, {
        get: (target, key) => (key in target ? target[key] : (key === 'measureText' ? () => ({ width: 0 }) : () => {})),
        set: (target, key, value) => { target[key] = value; return true; },
    });
}

const link = (layer, from, to) => ({ layer_from: layer, node_from: from, layer_to: layer, node_to: to, weight: 1 });
const MODEL = {
    layers: [{ layer_name: 'L1' }, { layer_name: 'L2' }, { layer_name: 'L3' }],
    intralayerLinks: [link('L1', 'a', 'b'), link('L1', 'b', 'c'), link('L2', 'a', 'c'), link('L3', 'a', 'b')],
    interlayerLinks: [],
};
const at = (x, y) => ({ x, y });
const POSITIONS = new Map(MODEL.layers.map(l => [l.layer_name,
    new Map([['a', at(10, 10)], ['b', at(100, 100)], ['c', at(200, 50)]])]));

/** Layers drawn (in order), nodes per layer, and links drawn as layer:from-to */
function draw() {
    const grid = new GridView();
    const links = [];
    const layerColorIndex = [];
    grid.render(stubContext(), 900, 600, MODEL, POSITIONS, {
        columns: 3,
        intraLinkColorFn: l => { links.push(`${l.layer_from}:${l.node_from}-${l.node_to}`); return '#000'; },
        layerColorFn: (i) => { layerColorIndex.push(i); return null; },
    });
    return {
        layers: grid._lastCells.map(c => c.layerName),
        nodes: Object.fromEntries(grid._lastCells.map(c => [c.layerName, [...c.nodePositions.keys()]])),
        links,
        layerColorIndex,
        cellX: grid._lastCells.map(c => c.cellX),
    };
}

afterEach(() => dataMode.clear());

describe('grid view and the data filter', () => {
    it('without a filter, draws every layer, node and link', () => {
        const d = draw();
        expect(d.layers).toEqual(['L1', 'L2', 'L3']);
        expect(d.nodes.L1).toEqual(['a', 'b', 'c']);
        expect(d.links).toEqual(['L1:a-b', 'L1:b-c', 'L2:a-c', 'L3:a-b']);
    });

    it('a layer filter drops cells; the cells left fill the grid and keep their layer colors', () => {
        const all = draw();
        dataMode.filteredLayerNames = new Set(['L1', 'L3']);
        const d = draw();
        expect(d.layers).toEqual(['L1', 'L3']);
        expect(d.layerColorIndex).toEqual([0, 2]); // index into model.layers
        expect(d.links).toEqual(['L1:a-b', 'L1:b-c', 'L3:a-b']);
        expect(d.cellX[1]).toBeGreaterThan(all.cellX[1]); // two wider cells, not three
    });

    it('a node filter hides nodes and the links of hidden nodes', () => {
        dataMode.filteredNodeNames = new Set(['a', 'b']);
        const d = draw();
        expect(d.nodes.L1).toEqual(['a', 'b']);
        expect(d.links).toEqual(['L1:a-b', 'L3:a-b']);
    });

    it('a link filter hides other links and keeps every node', () => {
        dataMode.filteredLinkKeys = new Set(['L1::b::L1::c', 'L2::a::L2::c']);
        const d = draw();
        expect(d.nodes.L1).toEqual(['a', 'b', 'c']);
        expect(d.links).toEqual(['L1:b-c', 'L2:a-c']);
    });

    it('node and link filters combine', () => {
        dataMode.filteredNodeNames = new Set(['a', 'b']);
        dataMode.filteredLinkKeys = new Set(['L1::b::L1::c', 'L1::a::L1::b']);
        expect(draw().links).toEqual(['L1:a-b']);
    });
});

/**
 * nodeSets.js — Which bipartite set (A or B) a state node belongs to, for
 * styling purposes (node color, size, shape).
 *
 * Membership follows the per-layer rule from dataParser.detectBipartiteLayers:
 * inside a bipartite layer, a node's set is whatever that layer says. A node
 * in a non-bipartite layer (e.g. plants in a plant-competition layer) has no
 * set by that rule; for styling only, it falls back to the set its node_type
 * maps to in the bipartite layers, so the same plant looks the same in every
 * layer. The membership rule itself is not changed.
 *
 * Sets are only exposed when the network has at least one bipartite layer and
 * exactly two node_type values overall.
 */

export const SET_A = 'A';
export const SET_B = 'B';

const REQUIRED_NODE_TYPES = 2;

function nodeTypeOf(node) {
    const t = node.node_type ?? node.type;
    return (t === undefined || t === null) ? null : String(t);
}

function countNodeTypes(nodes) {
    const types = new Set();
    for (const n of nodes) {
        const t = nodeTypeOf(n);
        if (t !== null) types.add(t);
    }
    return types.size;
}

/**
 * Map node_type → set, taken from the first bipartite layer. Later layers that
 * disagree (conflicting setA_type) keep their own per-layer membership; only
 * the fallback for non-bipartite layers and the set labels use this mapping.
 */
function buildTypeToSet(bipartiteLayers) {
    const first = bipartiteLayers[0];
    const typeToSet = new Map([[first.setALabel, SET_A], [first.setBLabel, SET_B]]);
    const conflicting = bipartiteLayers.some(info => typeToSet.get(info.setALabel) !== SET_A);
    if (conflicting) {
        console.warn('Bipartite layers disagree on which node_type is Set A (setA_type). ' +
            `Set labels and the fallback for non-bipartite layers use "${first.setALabel}" as Set A.`);
    }
    return { typeToSet, labelA: first.setALabel, labelB: first.setBLabel };
}

const NO_SETS = Object.freeze({
    hasSets: false,
    labelA: null,
    labelB: null,
    getNodeSet: () => null,
});

/**
 * @param {object} model  Parsed model (needs bipartiteInfo, nodes, nodesByName)
 * @returns {{ hasSets: boolean, labelA: string|null, labelB: string|null,
 *             getNodeSet: (layerName: string, nodeName: string) => 'A'|'B'|null }}
 */
export function buildNodeSetResolver(model) {
    if (!model?.bipartiteInfo) return NO_SETS;
    const bipartiteLayers = [...model.bipartiteInfo.values()].filter(info => info.isBipartite);
    if (bipartiteLayers.length === 0) return NO_SETS;
    if (countNodeTypes(model.nodes) !== REQUIRED_NODE_TYPES) return NO_SETS;

    const { typeToSet, labelA, labelB } = buildTypeToSet(bipartiteLayers);

    const setFromType = (nodeName) => {
        const node = model.nodesByName.get(nodeName);
        const t = node ? nodeTypeOf(node) : null;
        return t === null ? null : (typeToSet.get(t) ?? null);
    };

    const getNodeSet = (layerName, nodeName) => {
        const info = model.bipartiteInfo.get(layerName);
        if (!info?.isBipartite) return setFromType(nodeName);
        if (info.setA.has(nodeName)) return SET_A;
        if (info.setB.has(nodeName)) return SET_B;
        return null;
    };

    return { hasSets: true, labelA, labelB, getNodeSet };
}

/**
 * Split the items an attribute is read from into the two sets.
 * source 'node'  → physical nodes (deduplicated across layers)
 * source 'state' → state nodes
 * Each state node is assigned by its (layer, node) pair, so a node in a
 * non-bipartite layer lands in its node_type's set.
 *
 * @returns {{ A: object[], B: object[] }}
 */
export function collectSetItems(model, resolver, source) {
    const groups = { [SET_A]: [], [SET_B]: [] };
    const seenNodes = new Set();
    for (const sn of model.stateNodes) {
        const set = resolver.getNodeSet(sn.layer_name, sn.node_name);
        if (!set) continue;
        if (source === 'state') {
            groups[set].push(sn);
            continue;
        }
        const key = `${set}::${sn.node_name}`;
        if (seenNodes.has(key)) continue;
        seenNodes.add(key);
        const node = model.nodesByName.get(sn.node_name);
        if (node) groups[set].push(node);
    }
    return groups;
}

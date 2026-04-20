"""
Convert C. elegans multiplex connectome to multilayer_viz JSON.

Source: De Domenico et al. (2015) / Chen, Hall & Chklovskii (PNAS 2006)
Download: https://figshare.com/articles/dataset/CElegans_Multiplex_Neuronal_zip/21294858

Layers (3):  ElectrJ — electrical gap junctions
             MonoSyn — chemical monadic synapses
             PolySyn — chemical polyadic synapses
Nodes:       279 neurons
Edges:       5,863 directed (all weights = 1)
Interlayer:  diagonal coupling — same neuron across all layers it appears in
"""

import json, sys
from pathlib import Path
from collections import defaultdict

BASE  = Path("/tmp/celegans/CElegans_Multiplex_Neuronal/Dataset")
OUT   = Path(__file__).parent.parent / "celegans2006.json"

# ── Load lookup tables ────────────────────────────────────────────────────────
layers_map = {}
with open(BASE / "celegans_connectome_layers.txt") as f:
    next(f)
    for line in f:
        lid, label = line.strip().split()
        layers_map[int(lid)] = label

nodes_map = {}
with open(BASE / "celegans_connectome_nodes.txt") as f:
    next(f)
    for line in f:
        nid, label = line.strip().split()
        nodes_map[int(nid)] = label

# ── Load edges ────────────────────────────────────────────────────────────────
edges_by_layer = defaultdict(list)
nodes_by_layer = defaultdict(set)

with open(BASE / "celegans_connectome_multiplex.edges") as f:
    for line in f:
        parts = line.strip().split()
        lid, n1, n2, w = int(parts[0]), int(parts[1]), int(parts[2]), float(parts[3])
        edges_by_layer[lid].append((nodes_map[n1], nodes_map[n2], w))
        nodes_by_layer[lid].add(nodes_map[n1])
        nodes_by_layer[lid].add(nodes_map[n2])

# ── Build JSON ────────────────────────────────────────────────────────────────
layers = [
    {"layer_id": lid, "layer_name": lname, "bipartite": False}
    for lid, lname in sorted(layers_map.items())
]

nodes = []
seen = set()
for lid in sorted(nodes_by_layer):
    lname = layers_map[lid]
    for nname in sorted(nodes_by_layer[lid]):
        key = (lname, nname)
        if key not in seen:
            seen.add(key)
            nodes.append({"node_id": f"{lname}::{nname}", "layer_name": lname, "node_name": nname})

state_nodes = [{"layer_name": n["layer_name"], "node_name": n["node_name"]} for n in nodes]

extended = []
# Intralayer edges
for lid in sorted(edges_by_layer):
    lname = layers_map[lid]
    for nfrom, nto, w in edges_by_layer[lid]:
        extended.append({"layer_from": lname, "node_from": nfrom, "layer_to": lname, "node_to": nto, "weight": w})


out = {
    "directed": True,
    "directed_interlayer": False,
    "layers": layers,
    "nodes": nodes,
    "extended": extended,
    "state_nodes": state_nodes,
}

OUT.write_text(json.dumps(out, indent=2))
print(f"Written {OUT}")
print(f"  layers: {len(layers)}, nodes: {len(nodes)}, edges: {len(extended)}")

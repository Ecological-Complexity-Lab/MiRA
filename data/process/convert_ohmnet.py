"""
Convert OhmNet tissue-specific PPI networks to multilayer_viz JSON.

Source: Zitnik & Leskovec (2017), Bioinformatics — OhmNet
        https://snap.stanford.edu/ohmnet/
Data:   https://snap.stanford.edu/biodata/datasets/10013/files/PPT-Ohmnet_tissues-combined.edgelist.gz

Layers (6):  brain, blood, kidney, lung, heart, liver
Nodes:       human proteins (Entrez gene IDs) present in ≥2 of 6 tissues
             with degree ≥ MIN_DEGREE in at least one tissue
Edges:       PPI edges within each tissue layer
Interlayer:  diagonal coupling (same protein in multiple tissues)

Filtering keeps the network at a manageable ~400–800 nodes per layer.
Increase MIN_LAYERS or MIN_DEGREE to shrink further; decrease to expand.
"""

import json
from pathlib import Path
from collections import defaultdict

EDGELIST = Path("/tmp/ohmnet_combined.edgelist")
OUT      = Path(__file__).parent.parent / "ohmnet_6tissue.json"

TISSUES   = ["brain", "blood", "kidney", "lung", "heart", "liver"]
MIN_LAYERS = 2    # protein must appear in ≥ this many chosen tissues
MIN_DEGREE = 75   # protein must have degree ≥ this in at least one tissue

# ── Load edges for the 6 chosen tissues ──────────────────────────────────────
edges_by_tissue = defaultdict(list)
degree = defaultdict(lambda: defaultdict(int))  # tissue → protein → degree

print("Loading edges...")
with open(EDGELIST) as f:
    next(f)  # skip comment
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) < 3:
            continue
        p1, p2, tissue = parts[0], parts[1], parts[2]
        if tissue not in TISSUES:
            continue
        edges_by_tissue[tissue].append((p1, p2))
        degree[tissue][p1] += 1
        degree[tissue][p2] += 1

# ── Determine valid proteins ──────────────────────────────────────────────────
proteins_per_tissue = {t: set(degree[t].keys()) for t in TISSUES}

# Proteins in ≥ MIN_LAYERS tissues
from collections import Counter
tissue_count = Counter()
for t in TISSUES:
    for p in proteins_per_tissue[t]:
        tissue_count[p] += 1

multilayer_proteins = {p for p, c in tissue_count.items() if c >= MIN_LAYERS}

# Of those, keep only proteins with degree ≥ MIN_DEGREE in at least one tissue
high_degree = {p for p in multilayer_proteins
               if any(degree[t].get(p, 0) >= MIN_DEGREE for t in TISSUES)}

print(f"Proteins in ≥{MIN_LAYERS} tissues: {len(multilayer_proteins)}")
print(f"Of those with degree ≥{MIN_DEGREE} in ≥1 tissue: {len(high_degree)}")

for t in TISSUES:
    n = len(proteins_per_tissue[t] & high_degree)
    print(f"  {t}: {n} proteins")

# ── Filter edges to valid proteins ───────────────────────────────────────────
filtered_edges = {}
for t in TISSUES:
    filtered_edges[t] = [(p1, p2) for p1, p2 in edges_by_tissue[t]
                         if p1 in high_degree and p2 in high_degree]
    print(f"  {t}: {len(filtered_edges[t])} edges after filtering")

# ── Build JSON ────────────────────────────────────────────────────────────────
layers = [
    {"layer_id": i + 1, "layer_name": t.replace("_", " ").title(), "bipartite": False}
    for i, t in enumerate(TISSUES)
]
tissue_to_lname = {t: t.replace("_", " ").title() for t in TISSUES}

nodes_by_tissue = defaultdict(set)
for t in TISSUES:
    for p1, p2 in filtered_edges[t]:
        nodes_by_tissue[t].add(p1)
        nodes_by_tissue[t].add(p2)

nodes = []
seen = set()
for t in TISSUES:
    lname = tissue_to_lname[t]
    for p in sorted(nodes_by_tissue[t]):
        key = (lname, p)
        if key not in seen:
            seen.add(key)
            nodes.append({"node_id": f"{lname}::{p}", "layer_name": lname, "node_name": p})

state_nodes = [{"layer_name": n["layer_name"], "node_name": n["node_name"]} for n in nodes]

extended = []
# Intralayer
for t in TISSUES:
    lname = tissue_to_lname[t]
    for p1, p2 in filtered_edges[t]:
        extended.append({"layer_from": lname, "node_from": p1,
                          "layer_to":   lname, "node_to":   p2, "weight": 1.0})


out = {
    "directed": False,
    "directed_interlayer": False,
    "layers": layers,
    "nodes": nodes,
    "extended": extended,
    "state_nodes": state_nodes,
}

OUT.write_text(json.dumps(out, indent=2))
print(f"\nWritten {OUT}")
print(f"  layers: {len(layers)}, nodes: {len(nodes)}, total edges: {len(extended)}")

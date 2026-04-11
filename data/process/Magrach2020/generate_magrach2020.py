"""
Generate magrach2020.json — spatial plant-pollinator multilayer network.

Source: EuPPollNet dataset (study 15_Magrach), unpublished.
  https://github.com/JoseBSL/EuPPollNet

5 grassland sites in Orozko, Basque Country, Spain (2020).
Bipartite per layer. GPS coordinates available (map mode).
Interlayer links: Jaccard similarity of partner sets.
"""

import json, csv
from collections import defaultdict

DATA_DIR = "."

SITE_ORDER = [1, 2, 3, 4, 5]

# ---------------------------------------------------------------------------
# 1. Parse interaction data
# ---------------------------------------------------------------------------

raw_edges = defaultdict(int)
site_meta = {}   # site_id -> {lat, lon, locality, habitat}

with open(f"{DATA_DIR}/Interaction_data.csv") as f:
    for row in csv.DictReader(f):
        sid    = int(row["Site_id"])
        plant  = row["Plant_species"].strip()
        poll   = row["Pollinator_species"].strip()
        freq   = int(row["Interaction"] or 1)
        raw_edges[(sid, plant, poll)] += freq

        if sid not in site_meta:
            site_meta[sid] = {
                "latitude":  float(row["Latitude"]),
                "longitude": float(row["Longitude"]),
                "locality":  row["Locality"].strip(),
                "habitat":   row["Habitat"].strip(),
            }

print(f"Raw edges: {len(raw_edges)}")

all_plants = sorted(set(pl for (_, pl, _) in raw_edges))
all_polls  = sorted(set(po for (_, _, po) in raw_edges))
print(f"Plants: {len(all_plants)}, Pollinators: {len(all_polls)}")

state_node_set = set()
for (sid, pl, po) in raw_edges:
    state_node_set.add((pl, str(sid)))
    state_node_set.add((po, str(sid)))

# ---------------------------------------------------------------------------
# 2. Intralayer edges
# ---------------------------------------------------------------------------

intralayer_edges = [
    {
        "layer_from": str(sid),
        "node_from":  plant,
        "layer_to":   str(sid),
        "node_to":    poll,
        "weight":     freq,
    }
    for (sid, plant, poll), freq in raw_edges.items()
]

# ---------------------------------------------------------------------------
# 3. Interlayer edges — Jaccard similarity of partner sets
# ---------------------------------------------------------------------------

partner_sets = defaultdict(lambda: defaultdict(set))
for (sid, plant, poll) in raw_edges:
    partner_sets[plant][str(sid)].add(poll)
    partner_sets[poll][str(sid)].add(plant)

interlayer_edges = []
layer_strs = [str(s) for s in SITE_ORDER]
for species, layer_partners in partner_sets.items():
    layers_present = [l for l in layer_strs if l in layer_partners]
    if len(layers_present) < 2:
        continue
    for i in range(len(layers_present)):
        for j in range(i + 1, len(layers_present)):
            l1, l2 = layers_present[i], layers_present[j]
            s1, s2 = layer_partners[l1], layer_partners[l2]
            union = s1 | s2
            if not union:
                continue
            jaccard = round(len(s1 & s2) / len(union), 6)
            if jaccard == 0:
                continue
            interlayer_edges.append({
                "layer_from": l1,
                "node_from":  species,
                "layer_to":   l2,
                "node_to":    species,
                "weight":     jaccard,
            })

print(f"Interlayer edges: {len(interlayer_edges)}")

# ---------------------------------------------------------------------------
# 4. Build JSON structure
# ---------------------------------------------------------------------------

node_type = {}
for p in all_plants: node_type[p] = "plant"
for p in all_polls:  node_type[p] = "pollinator"

layers = [
    {
        "layer_id":   i + 1,
        "layer_name": str(sid),
        "bipartite":  True,
        "latitude":   site_meta[sid]["latitude"],
        "longitude":  site_meta[sid]["longitude"],
        "locality":   site_meta[sid]["locality"],
        "habitat":    site_meta[sid]["habitat"],
    }
    for i, sid in enumerate(SITE_ORDER)
]

nodes = []
for sid in SITE_ORDER:
    sid_str = str(sid)
    species_in_layer = sorted(
        (sp for (sp, s) in state_node_set if s == sid_str),
        key=lambda x: (node_type.get(x, "z"), x)
    )
    for sp in species_in_layer:
        nodes.append({
            "node_id":    sp,
            "layer_name": sid_str,
            "node_name":  sp,
            "node_type":  node_type.get(sp, "unknown"),
        })

state_nodes = [
    {"layer_name": s, "node_name": sp}
    for (sp, s) in sorted(state_node_set)
]

output = {
    "directed":            False,
    "directed_interlayer": False,
    "layers":              layers,
    "nodes":               nodes,
    "extended":            intralayer_edges + interlayer_edges,
    "state_nodes":         state_nodes,
}

# ---------------------------------------------------------------------------
# 5. Write output
# ---------------------------------------------------------------------------

OUT_PATH = "../../magrach2020.json"
with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

n_pl = len([n for n in nodes if n["node_type"] == "plant"])
n_po = len([n for n in nodes if n["node_type"] == "pollinator"])
print(f"\nWritten: {OUT_PATH}")
print(f"Layers:     {len(layers)} grassland sites (Orozko, Basque Country)")
print(f"State-nodes:{len(nodes)} ({n_pl} plant × site, {n_po} pollinator × site)")
print(f"Intralayer: {len(intralayer_edges)} edges (interaction frequency)")
print(f"Interlayer: {len(interlayer_edges)} edges (Jaccard partner similarity)")

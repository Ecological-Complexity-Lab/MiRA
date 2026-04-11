"""
Generate canary_islands.json — island-level bipartite multilayer pollination network.

Sources (from Vitali et al. 2024):
  interactions.csv                       : raw long-format interaction data
  lon_lat_data_justislands_as_layers.csv : island GPS coords (layer_id 1-5)
  module_data_justislands_as_layers.csv  : Infomap module assignments per state-node

Output: ../../canary_islands.json
"""

import json
import csv
from collections import defaultdict

DATA_DIR = "."

# Island mapping: site names → island name (layer_id 1-5)
SITE_TO_ISLAND = {
    "Fuerteventura1": "Fuerteventura",
    "Fuerteventura2": "Fuerteventura",
    "GranCanaria1":   "Gran Canaria",
    "GranCanaria2":   "Gran Canaria",
    "TenerifeSouth1": "Tenerife",
    "TenerifeSouth2": "Tenerife",
    "TenerifeTeno1":  "Tenerife",
    "TenerifeTeno2":  "Tenerife",
    "Gomera1":        "Gomera",
    "Gomera2":        "Gomera",
    "Hierro1":        "Hierro",
    "Hierro2":        "Hierro",
}

ISLAND_ORDER = ["Fuerteventura", "Gran Canaria", "Tenerife", "Gomera", "Hierro"]
ISLAND_ID = {name: i + 1 for i, name in enumerate(ISLAND_ORDER)}

# ---------------------------------------------------------------------------
# 1. Parse interactions.csv (long format: interaction_id, attribute, value)
# ---------------------------------------------------------------------------

raw = defaultdict(dict)
with open(f"{DATA_DIR}/interactions.csv") as f:
    for row in csv.DictReader(f):
        raw[row["interaction_id"]][row["attribute"]] = row["value"]

interactions = []
for iid, attrs in raw.items():
    lf = attrs.get("layer_from", "")
    lt = attrs.get("layer_to", "")
    # Skip WesternSahara and any off-island sites
    if lf not in SITE_TO_ISLAND or lt not in SITE_TO_ISLAND:
        continue
    interactions.append({
        "node_from":  attrs["node_from"],
        "layer_from": SITE_TO_ISLAND[lf],
        "node_to":    attrs["node_to"],
        "layer_to":   SITE_TO_ISLAND[lt],
        "weight":     int(attrs["weight"]),
    })

print(f"Raw interactions (after WesternSahara filter): {len(interactions)}")

# ---------------------------------------------------------------------------
# 2. Aggregate weights from site-level to island-level
# ---------------------------------------------------------------------------

agg = defaultdict(int)
for e in interactions:
    key = (e["layer_from"], e["node_from"], e["layer_to"], e["node_to"])
    agg[key] += e["weight"]

# Determine node types from which role they appear in
plants      = set()
pollinators = set()
for (lf, nf, lt, nt), w in agg.items():
    plants.add(nf)       # node_from = plant (row in matrix)
    pollinators.add(nt)  # node_to   = pollinator

print(f"Plants: {len(plants)}, Pollinators: {len(pollinators)}")

# ---------------------------------------------------------------------------
# 3. Normalize intralayer weights
#    Strategy: relative weight of each partner for each species
#    (matches R script: divide by total weight per species per layer)
# ---------------------------------------------------------------------------

# Sum of weights per (layer, plant) — plants in the "from" position
plant_totals = defaultdict(int)
for (lf, nf, lt, nt), w in agg.items():
    plant_totals[(lf, nf)] += w

intralayer_edges = []
for (lf, nf, lt, nt), w in agg.items():
    rel = round(w / plant_totals[(lf, nf)], 6)
    intralayer_edges.append({
        "layer_from": lf,
        "node_from":  nf,
        "layer_to":   lt,
        "node_to":    nt,
        "weight":     rel,
    })

print(f"Intralayer edges: {len(intralayer_edges)}")

# ---------------------------------------------------------------------------
# 4. Compute interlayer links via Jaccard similarity of partner sets
#    For each species that appears in ≥2 islands, compute pairwise Jaccard
#    of their interaction partner sets across layers.
# ---------------------------------------------------------------------------

# Build partner sets: species → {layer → {partners}}
partner_sets = defaultdict(lambda: defaultdict(set))
for (lf, nf, lt, nt), w in agg.items():
    partner_sets[nf][lf].add(nt)   # plant's partners per island
    partner_sets[nt][lt].add(nf)   # pollinator's partners per island

interlayer_edges = []
for species, layer_partners in partner_sets.items():
    layers_present = [l for l in ISLAND_ORDER if l in layer_partners]
    if len(layers_present) < 2:
        continue
    for i in range(len(layers_present)):
        for j in range(i + 1, len(layers_present)):
            l1, l2 = layers_present[i], layers_present[j]
            set1, set2 = layer_partners[l1], layer_partners[l2]
            union = set1 | set2
            if not union:
                continue
            jaccard = round(len(set1 & set2) / len(union), 6)
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
# 5. Load module assignments (state-node level)
#    module_data has: module, node_id, layer_id, flow, type, species
#    layer_id 1-5 = Fuerteventura, Gran Canaria, Tenerife, Gomera, Hierro
# ---------------------------------------------------------------------------

LAYERID_TO_NAME = {str(i + 1): name for i, name in enumerate(ISLAND_ORDER)}

module_map = {}  # (species, island_name) -> module
with open(f"{DATA_DIR}/module_data_justislands_as_layers.csv") as f:
    for row in csv.DictReader(f):
        island = LAYERID_TO_NAME.get(row["layer_id"])
        if island:
            module_map[(row["species"].replace(".", " "), island)] = int(row["module"])
            module_map[(row["species"], island)] = int(row["module"])

# ---------------------------------------------------------------------------
# 6. Collect all (species, island) state-nodes from edges
# ---------------------------------------------------------------------------

state_node_set = set()
for e in intralayer_edges + interlayer_edges:
    state_node_set.add((e["node_from"], e["layer_from"]))
    state_node_set.add((e["node_to"],   e["layer_to"]))

# Determine node type
node_type = {}
for sp in plants:
    node_type[sp] = "plant"
for sp in pollinators:
    if sp not in node_type:
        node_type[sp] = "pollinator"

# ---------------------------------------------------------------------------
# 7. Load GPS coordinates for layers
# ---------------------------------------------------------------------------

coords = {}  # island_name -> (lat, lon)
with open(f"{DATA_DIR}/lon_lat_data_justislands_as_layers.csv") as f:
    for row in csv.DictReader(f):
        name = LAYERID_TO_NAME.get(row["layer_id"])
        if name:
            coords[name] = (float(row["lat"]), float(row["long"]))

# ---------------------------------------------------------------------------
# 8. Build JSON structure
# ---------------------------------------------------------------------------

layers = []
for i, name in enumerate(ISLAND_ORDER):
    lat, lon = coords.get(name, (None, None))
    layers.append({
        "layer_id":   i + 1,
        "layer_name": name,
        "latitude":   lat,
        "longitude":  lon,
        "bipartite":  True,
    })

nodes = []
all_species = sorted(plants | pollinators)
for island in ISLAND_ORDER:
    for sp in all_species:
        if (sp, island) not in state_node_set:
            continue
        ntype = node_type.get(sp, "unknown")
        mod   = module_map.get((sp, island))
        entry = {
            "node_id":    sp,
            "layer_name": island,
            "node_name":  sp,
            "node_type":  ntype,
        }
        if mod is not None:
            entry["module"] = mod
        nodes.append(entry)

state_nodes = [
    {"layer_name": sn[1], "node_name": sn[0]}
    for sn in sorted(state_node_set)
]

extended = intralayer_edges + interlayer_edges

output = {
    "directed":             False,
    "directed_interlayer":  False,
    "layers":               layers,
    "nodes":                nodes,
    "extended":             extended,
    "state_nodes":          state_nodes,
}

# ---------------------------------------------------------------------------
# 9. Write output
# ---------------------------------------------------------------------------

OUT_PATH = "../../canary_islands.json"
with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"\nWritten: {OUT_PATH}")
print(f"Layers: {len(layers)}")
print(f"State-nodes: {len(nodes)} ({len([n for n in nodes if n['node_type']=='plant'])} plants, "
      f"{len([n for n in nodes if n['node_type']=='pollinator'])} pollinators)")
print(f"Intralayer edges: {len(intralayer_edges)}")
print(f"Interlayer edges: {len(interlayer_edges)}")
print(f"Species with module: {sum(1 for n in nodes if 'module' in n)} / {len(nodes)}")
print(f"Modules: {sorted(set(n['module'] for n in nodes if 'module' in n))[:10]} ...")

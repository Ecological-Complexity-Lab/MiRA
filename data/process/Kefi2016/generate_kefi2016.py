"""
Generate kefi2016.json from the Chilean intertidal multilayer network data.
Sources:
  - chilean_TI.txt       : trophic interactions adjacency matrix
  - chilean_NTIpos.txt   : non-trophic positive interactions adjacency matrix
  - chilean_NTIneg.txt   : non-trophic negative interactions adjacency matrix
  - chilean_metadata.xls : species attributes
"""

import json
import xlrd

DATA_DIR = "."

# ---------------------------------------------------------------------------
# 1. Parse adjacency matrix helper
# ---------------------------------------------------------------------------

def parse_adj_matrix(filepath):
    """Return (species_ids, name_map, edges).
    species_ids : list of int IDs in column order
    name_map    : dict int_id -> species_name (from row labels)
    edges       : list of (source_id, target_id)  [non-zero entries]
    """
    with open(filepath, encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f]

    # First line: two leading tabs then column IDs
    header = lines[0].split("\t")
    col_ids = [int(x) for x in header if x.strip()]

    name_map = {}
    edges = []

    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split("\t")
        row_id = int(parts[0])
        # species name may contain spaces; it is the second field
        species_name = parts[1].strip()
        name_map[row_id] = species_name
        values = [int(x) for x in parts[2:]]

        for col_idx, val in enumerate(values):
            if val == 1:
                target_id = col_ids[col_idx]
                edges.append((row_id, target_id))

    return col_ids, name_map, edges


# ---------------------------------------------------------------------------
# 2. Parse all three layers
# ---------------------------------------------------------------------------

_, name_map_ti,  edges_ti  = parse_adj_matrix(f"{DATA_DIR}/chilean_TI.txt")
_, name_map_pos, edges_pos = parse_adj_matrix(f"{DATA_DIR}/chilean_NTIpos.txt")
_, name_map_neg, edges_neg = parse_adj_matrix(f"{DATA_DIR}/chilean_NTIneg.txt")

# Merge name maps (all three should agree)
name_map = {**name_map_ti, **name_map_pos, **name_map_neg}
all_ids = sorted(name_map.keys())

print(f"Species: {len(all_ids)}")
print(f"Trophic edges: {len(edges_ti)}")
print(f"NTI+ edges: {len(edges_pos)}")
print(f"NTI- edges: {len(edges_neg)}")


# ---------------------------------------------------------------------------
# 3. Cluster → multiplex functional group mapping (Kéfi et al. 2016 PLOS Bio)
#    14 probabilistic clusters collapsed to 5 functional groups
# ---------------------------------------------------------------------------

FUNCTIONAL_GROUP = {
    1:  "Mobile consumers",
    4:  "Mobile consumers",
    7:  "Mobile consumers",
    9:  "Mobile consumers",
    14: "Mobile consumers",
    2:  "Sessile inedible consumers",
    8:  "Sessile inedible consumers",
    5:  "Multiplex hub",
    3:  "Primary producers",
    11: "Primary producers",
    12: "Primary producers",
    6:  "Sessile facilitators/competitors",
    10: "Sessile facilitators/competitors",
    13: "Sessile facilitators/competitors",
}


# ---------------------------------------------------------------------------
# 4. Parse metadata
# ---------------------------------------------------------------------------

wb = xlrd.open_workbook(f"{DATA_DIR}/chilean_metadata.xls")
ws = wb.sheet_by_index(0)

metadata = {}  # int_id -> dict
for row_i in range(1, ws.nrows):  # skip header
    row = ws.row_values(row_i)
    spec_id = int(row[0])

    # Shore height: use conservative ordinal (1=low, 2=mid, 3=high)
    shore_ordinal = row[6]
    shore_category = str(row[5]).strip() if row[5] else ""

    # Functional role from "trophic" column (col 13)
    func_role = str(row[13]).strip() if row[13] else ""
    # Normalize plurals/whitespace
    if func_role.lower() == "predators":
        func_role = "Predator"

    body_mass = row[2]
    mobility = str(row[3]).strip()
    cluster = int(row[4]) if row[4] else None
    phylum = str(row[11]).strip() if row[11] else ""
    subphylum = str(row[12]).strip() if row[12] else ""

    metadata[spec_id] = {
        "body_mass": round(body_mass, 4) if isinstance(body_mass, float) else None,
        "mobility": mobility if mobility else None,
        "functional_role": func_role if func_role else None,
        "phylum": phylum if phylum else None,
        "subphylum": subphylum if subphylum else None,
        "cluster": cluster,
        "functional_group": FUNCTIONAL_GROUP.get(cluster),
        "shore_height": shore_category if shore_category else None,
        "shore_height_ordinal": round(shore_ordinal, 1) if isinstance(shore_ordinal, float) else None,
    }

print(f"Metadata entries: {len(metadata)}")


# ---------------------------------------------------------------------------
# 5. Build the JSON structure
# ---------------------------------------------------------------------------

LAYERS = [
    {"layer_id": 1, "layer_name": "Trophic",      "bipartite": False},
    {"layer_id": 2, "layer_name": "NTI positive",  "bipartite": False},
    {"layer_id": 3, "layer_name": "NTI negative",  "bipartite": False},
]

# Determine which species appear in at least one layer
species_in_layers = set()
for sid, tid in edges_ti + edges_pos + edges_neg:
    species_in_layers.add(sid)
    species_in_layers.add(tid)

# Also include all species from metadata (106 total)
species_in_layers = set(all_ids)

# Build nodes list — one entry per (layer, species) pair
nodes = []
for layer_info in LAYERS:
    lname = layer_info["layer_name"]
    for sid in all_ids:
        sname = name_map[sid]
        meta = metadata.get(sid, {})
        node_entry = {
            "node_id": sid,
            "layer_name": lname,
            "node_name": sname,
        }
        node_entry.update(meta)
        nodes.append(node_entry)

# Build state_nodes
state_nodes = [
    {"layer_name": layer["layer_name"], "node_name": name_map[sid]}
    for layer in LAYERS
    for sid in all_ids
]

# Build extended (edge list)
def make_edges(edges, layer_name, link_type):
    result = []
    for src, tgt in edges:
        result.append({
            "layer_from": layer_name,
            "node_from": name_map[src],
            "layer_to": layer_name,
            "node_to": name_map[tgt],
            "weight": 1,
            "type": link_type,
        })
    return result

extended = (
    make_edges(edges_ti,  "Trophic",      "trophic") +
    make_edges(edges_pos, "NTI positive", "non-trophic +") +
    make_edges(edges_neg, "NTI negative", "non-trophic -")
)

print(f"Total edges: {len(extended)}")

output = {
    "directed": True,
    "layers": LAYERS,
    "nodes": nodes,
    "extended": extended,
    "state_nodes": state_nodes,
}


# ---------------------------------------------------------------------------
# 6. Write output
# ---------------------------------------------------------------------------

OUT_PATH = "../../kefi2016.json"
with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"Written to {OUT_PATH}")
print(f"Nodes: {len(nodes)}, Edges: {len(extended)}, State nodes: {len(state_nodes)}")

# Quick sanity check
phyla = set(metadata[sid]["phylum"] for sid in all_ids if metadata.get(sid, {}).get("phylum"))
roles = set(metadata[sid]["functional_role"] for sid in all_ids if metadata.get(sid, {}).get("functional_role"))
print(f"Phyla: {sorted(phyla)}")
print(f"Functional roles: {sorted(roles)}")
clusters = set(metadata[sid]["cluster"] for sid in all_ids if metadata.get(sid, {}).get("cluster"))
print(f"Clusters: {sorted(clusters)}")

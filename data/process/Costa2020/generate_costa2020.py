"""
Generate costa2020.json — temporal seed-dispersal multilayer network.

Sources (Costa et al. 2020, Journal of Ecology, doi:10.1111/1365-2745.13391):
  multilayer_temporal_data.csv  : plant × bird interaction matrix per year (seeds dispersed)
  Dataset.xlsx                  : per-year node metrics (Birds/Seeds sheets) + versatility
  DisperserAbundanceMatrix.txt  : bird abundance per year
  SeedsAbundanceMatrix.txt      : plant abundance per year

5 temporal layers (2012–2016). Bipartite per layer.
Intralayer links: undirected, weight = seed count.
Interlayer links: directed t → t+1, weight = abundance(t+1) / abundance(t).
  Species with zero abundance in year t are skipped (ratio undefined).
"""

import json, re, openpyxl
from collections import defaultdict

DATA_DIR = "."
YEARS = [2012, 2013, 2014, 2015, 2016]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize(name):
    """Canonical species name: replace spaces/dots with underscores."""
    return re.sub(r'[\s.]+', '_', str(name).strip())

# ---------------------------------------------------------------------------
# 1. Intralayer edges from multilayer_temporal_data.csv
# ---------------------------------------------------------------------------

intralayer_edges = []
plants_per_year  = defaultdict(set)
birds_per_year   = defaultdict(set)

with open(f"{DATA_DIR}/multilayer_temporal_data.csv") as f:
    header = f.readline().strip().split(';')
    plant_cols = [normalize(p) for p in header[2:]]   # columns 2+ are plants

    for line in f:
        parts = line.strip().split(';')
        year  = int(parts[0])
        bird  = normalize(parts[1])
        counts = [int(x) for x in parts[2:]]

        for plant, count in zip(plant_cols, counts):
            if count == 0:
                continue
            intralayer_edges.append({
                "layer_from": str(year),
                "node_from":  plant,
                "layer_to":   str(year),
                "node_to":    bird,
                "weight":     count,
            })
            plants_per_year[year].add(plant)
            birds_per_year[year].add(bird)

print(f"Intralayer edges: {len(intralayer_edges)}")

# All unique species (across all years)
all_plants = sorted(set(p for ps in plants_per_year.values() for p in ps))
all_birds  = sorted(set(b for bs in birds_per_year.values()  for b in bs))
print(f"Plants: {len(all_plants)}, Birds: {len(all_birds)}")

# State nodes present
state_node_set = set()
for e in intralayer_edges:
    state_node_set.add((e["node_from"], e["layer_from"]))
    state_node_set.add((e["node_to"],   e["layer_to"]))

# ---------------------------------------------------------------------------
# 2. Abundance matrices — for interlayer weights
# ---------------------------------------------------------------------------

def parse_abundance_matrix(filepath):
    """Return dict: normalize(species) -> {year -> abundance}"""
    abund = {}
    with open(filepath) as f:
        header = f.readline().strip().split('\t')
        years = [int(h) for h in header[1:]]
        for line in f:
            parts = line.strip().split('\t')
            sp = normalize(parts[0])
            abund[sp] = {yr: float(v) for yr, v in zip(years, parts[1:])}
    return abund

bird_abund  = parse_abundance_matrix(f"{DATA_DIR}/DisperserAbundanceMatrix.txt")
plant_abund = parse_abundance_matrix(f"{DATA_DIR}/SeedsAbundanceMatrix.txt")

def get_abundance(sp, year):
    if sp in bird_abund:
        return bird_abund[sp].get(year)
    if sp in plant_abund:
        return plant_abund[sp].get(year)
    return None

# ---------------------------------------------------------------------------
# 3. Interlayer links — directed t → t+1, weight = abundance(t+1)/abundance(t)
# ---------------------------------------------------------------------------

interlayer_edges = []
skipped = 0
for i in range(len(YEARS) - 1):
    y1, y2 = YEARS[i], YEARS[i + 1]
    present_y1 = {sp for (sp, yr) in state_node_set if yr == str(y1)}
    present_y2 = {sp for (sp, yr) in state_node_set if yr == str(y2)}
    shared = present_y1 & present_y2
    for sp in sorted(shared):
        a1 = get_abundance(sp, y1)
        a2 = get_abundance(sp, y2)
        if a1 is None or a2 is None or a1 == 0:
            skipped += 1
            continue
        interlayer_edges.append({
            "layer_from": str(y1),
            "node_from":  sp,
            "layer_to":   str(y2),
            "node_to":    sp,
            "weight":     round(a2 / a1, 6),
            "directed":   True,
        })

print(f"Interlayer edges: {len(interlayer_edges)} (skipped {skipped} with zero/missing abundance at t)")

print(f"Interlayer edges: {len(interlayer_edges)}")

# ---------------------------------------------------------------------------
# 4. Node attributes from Dataset.xlsx
# ---------------------------------------------------------------------------

wb = openpyxl.load_workbook(f"{DATA_DIR}/Dataset.xlsx", read_only=True, data_only=True)

# --- Bird per-year metrics ---
bird_year_attrs = {}   # (species, year) -> dict
ws = wb["Birds"]
rows = list(ws.iter_rows(values_only=True))
bird_header = rows[0]   # Year, N.Years, Species, Group, interaction.richness, interaction.frequency, seed.spp, degree, strength, d
for row in rows[1:]:
    year, n_years, sp, group, int_rich, int_freq, seed_spp, degree, strength, d = row[:10]
    sp_norm = normalize(sp)
    bird_year_attrs[(sp_norm, int(year))] = {
        "group":               group.split('_', 1)[1] if group and '_' in str(group) else group,
        "n_years":             n_years,
        "interaction_richness": int_rich,
        "interaction_frequency": round(float(int_freq), 4) if int_freq and int_freq != 'NA' else None,
        "degree":              degree,
        "strength":            round(float(strength), 4) if strength and strength != 'NA' else None,
        "d_specialisation":    round(float(d), 4) if d and d != 'NA' else None,
    }

# --- Bird versatility (species-level) ---
bird_versatility = {}
ws = wb["Versatility.birds"]
for row in list(ws.iter_rows(values_only=True))[1:]:
    n_years, sp, group, versatility = row
    bird_versatility[normalize(sp)] = round(float(versatility), 6)

# --- Plant per-year metrics ---
plant_year_attrs = {}
ws = wb["Seeds"]
rows = list(ws.iter_rows(values_only=True))
for row in rows[1:]:
    year, n_years, sp, int_rich, int_freq, bird_spp, degree, strength, d = row[:9]
    sp_norm = normalize(sp)
    plant_year_attrs[(sp_norm, int(year))] = {
        "n_years":             n_years,
        "interaction_richness": int_rich,
        "interaction_frequency": round(float(int_freq), 4) if int_freq and int_freq != 'NA' else None,
        "degree":              degree,
        "strength":            round(float(strength), 4) if strength and strength != 'NA' else None,
        "d_specialisation":    round(float(d), 4) if d and d != 'NA' else None,
    }

# --- Plant versatility ---
plant_versatility = {}
ws = wb["Versatility.seeds"]
for row in list(ws.iter_rows(values_only=True))[1:]:
    n_years, sp, versatility = row
    plant_versatility[normalize(sp)] = round(float(versatility), 6)

# ---------------------------------------------------------------------------
# 5. Build JSON structure
# ---------------------------------------------------------------------------

layers = [
    {"layer_id": i + 1, "layer_name": str(y), "bipartite": True}
    for i, y in enumerate(YEARS)
]

node_type = {}
for p in all_plants: node_type[p] = "plant"
for b in all_birds:  node_type[b] = "bird"

nodes = []
for year in YEARS:
    yr_str = str(year)
    species_in_layer = sorted(
        (sp for (sp, yr) in state_node_set if yr == yr_str),
        key=lambda x: (node_type.get(x, "z"), x)
    )
    for sp in species_in_layer:
        ntype = node_type.get(sp, "unknown")
        entry = {
            "node_id":    sp,
            "layer_name": yr_str,
            "node_name":  sp,
            "node_type":  ntype,
        }
        if ntype == "bird":
            attrs = bird_year_attrs.get((sp, year), {})
            entry.update({k: v for k, v in attrs.items() if v is not None})
            v = bird_versatility.get(sp)
            if v is not None:
                entry["versatility"] = v
        else:
            attrs = plant_year_attrs.get((sp, year), {})
            entry.update({k: v for k, v in attrs.items() if v is not None})
            v = plant_versatility.get(sp)
            if v is not None:
                entry["versatility"] = v
        nodes.append(entry)

state_nodes = [
    {"layer_name": yr, "node_name": sp}
    for (sp, yr) in sorted(state_node_set)
]

output = {
    "directed":            False,
    "directed_interlayer": True,
    "layers":              layers,
    "nodes":               nodes,
    "extended":            intralayer_edges + interlayer_edges,
    "state_nodes":         state_nodes,
}

# ---------------------------------------------------------------------------
# 6. Write output
# ---------------------------------------------------------------------------

OUT_PATH = "../../costa2020.json"
with open(OUT_PATH, "w") as f:
    json.dump(output, f, indent=2)

n_plants = len([n for n in nodes if n["node_type"] == "plant"])
n_birds  = len([n for n in nodes if n["node_type"] == "bird"])
print(f"\nWritten: {OUT_PATH}")
print(f"Layers:     {len(layers)} years (2012–2016)")
print(f"State-nodes:{len(nodes)} ({n_plants} plant × year, {n_birds} bird × year)")
print(f"Intralayer: {len(intralayer_edges)} edges (seed counts)")
print(f"Interlayer: {len(interlayer_edges)} directed edges (t → t+1)")
print(f"Node attrs: group, n_years, degree, strength, d_specialisation, versatility")

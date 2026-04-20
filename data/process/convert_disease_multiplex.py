"""
Convert the Multiplex Human Diseasome to multilayer_viz JSON.

Source: Halu et al. (2019), npj Systems Biology and Applications
        https://doi.org/10.1038/s41540-019-0092-5
Data:   https://github.com/manlius/MultiplexDiseasome

Layers (2):  Genotype  — diseases share ≥1 disease gene (GWAS + OMIM)
             Phenotype — diseases share ≥1 clinical symptom (GWAS + OMIM)
Nodes:       diseases present in both layers (variable, ~300–500 after filtering)
Interlayer:  diagonal coupling (same disease across both layers)

Filtering: diseases must have ≥2 gene associations AND ≥2 symptom associations
           to avoid isolated nodes and trivial projections.
"""

import json, csv
from pathlib import Path
from collections import defaultdict

OMIM_CSV = Path("/tmp/disease_omim.csv")
GWAS_CSV = Path("/tmp/disease_gwas.csv")
OUT      = Path(__file__).parent.parent / "diseasome_multiplex.json"

MIN_GENES    = 2
MIN_SYMPTOMS = 2
MIN_SHARED   = 1   # minimum shared items to draw a disease-disease edge

def load_tripartite(path):
    """Return (disorder → {genes}, disorder → {symptoms}) from a semicolon CSV."""
    dis_genes = defaultdict(set)
    dis_symps  = defaultdict(set)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            d = row["disorder"].strip()
            g = row.get("gene_symb", "").split(",")[0].strip()
            s = row.get("symptom", "").strip()
            if d and g:
                dis_genes[d].add(g)
            if d and s:
                dis_symps[d].add(s)
    return dis_genes, dis_symps

# Merge OMIM + GWAS
dg_o, ds_o = load_tripartite(OMIM_CSV)
dg_g, ds_g = load_tripartite(GWAS_CSV)

dis_genes = defaultdict(set)
dis_symps  = defaultdict(set)
for d, gs in {**dg_o, **dg_g}.items():
    dis_genes[d] |= gs
for d, ss in {**ds_o, **ds_g}.items():
    dis_symps[d] |= ss

# Keep only diseases with enough associations in BOTH dimensions
valid = {d for d in dis_genes
         if len(dis_genes[d]) >= MIN_GENES and len(dis_symps.get(d, set())) >= MIN_SYMPTOMS}
print(f"Valid diseases (≥{MIN_GENES} genes & ≥{MIN_SYMPTOMS} symptoms): {len(valid)}")

valid = sorted(valid)

# Build disease-disease edge lists via bipartite projection
def project(disorder_map, valid_set, min_shared):
    edges = []
    valid_list = [d for d in valid_set if d in disorder_map]
    for i, d1 in enumerate(valid_list):
        for d2 in valid_list[i+1:]:
            shared = len(disorder_map[d1] & disorder_map[d2])
            if shared >= min_shared:
                edges.append((d1, d2, shared))
    return edges

print("Building genotype projection...")
geno_edges = project(dis_genes, set(valid), MIN_SHARED)
print(f"  genotype edges: {len(geno_edges)}")

print("Building phenotype projection...")
pheno_edges = project(dis_symps, set(valid), MIN_SHARED)
print(f"  phenotype edges: {len(pheno_edges)}")

# Keep only diseases that have at least one edge in either layer
active_geno  = {d for e in geno_edges  for d in (e[0], e[1])}
active_pheno = {d for e in pheno_edges for d in (e[0], e[1])}
active = sorted(active_geno | active_pheno)
print(f"Active diseases (have ≥1 edge): {len(active)}")

# ── Build JSON ─────────────────────────────────────────────────────────────────
LAYER_GENO  = "Genotype"
LAYER_PHENO = "Phenotype"

layers = [
    {"layer_id": 1, "layer_name": LAYER_GENO,  "bipartite": False},
    {"layer_id": 2, "layer_name": LAYER_PHENO, "bipartite": False},
]

geno_nodes  = active_geno  & set(active)
pheno_nodes = active_pheno & set(active)

nodes = []
for d in sorted(geno_nodes):
    nodes.append({"node_id": f"{LAYER_GENO}::{d}", "layer_name": LAYER_GENO,
                  "node_name": d, "n_genes": len(dis_genes[d])})
for d in sorted(pheno_nodes):
    nodes.append({"node_id": f"{LAYER_PHENO}::{d}", "layer_name": LAYER_PHENO,
                  "node_name": d, "n_symptoms": len(dis_symps.get(d, set()))})

state_nodes = [{"layer_name": n["layer_name"], "node_name": n["node_name"]} for n in nodes]

extended = []
for d1, d2, w in geno_edges:
    if d1 in geno_nodes and d2 in geno_nodes:
        extended.append({"layer_from": LAYER_GENO, "node_from": d1,
                          "layer_to":   LAYER_GENO, "node_to":   d2, "weight": float(w)})
for d1, d2, w in pheno_edges:
    if d1 in pheno_nodes and d2 in pheno_nodes:
        extended.append({"layer_from": LAYER_PHENO, "node_from": d1,
                          "layer_to":   LAYER_PHENO, "node_to":   d2, "weight": float(w)})


# Interlayer: diagonal coupling for diseases present in both layers
both = sorted(geno_nodes & pheno_nodes)
for d in both:
    extended.append({"layer_from": LAYER_GENO, "node_from": d,
                      "layer_to":   LAYER_PHENO, "node_to":   d, "weight": 1.0})

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
print(f"  layers: {len(layers)}, nodes: {len(nodes)}, intralayer: {len(geno_edges)+len(pheno_edges)}, interlayer: {len(both)}")

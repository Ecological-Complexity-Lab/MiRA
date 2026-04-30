#!/usr/bin/env python3
"""
build_shapiro2023.py — Build data/shapiro2023_plasmids.json from the source
CSV files of Shapiro et al. (2023), "Multilayer networks of plasmid genetic
similarity reveal potential pathways of gene transmission", ISME J,
doi: 10.1038/s41396-023-01373-5.

Source: https://github.com/Ecological-Complexity-Lab/Plasmid_multilayer_networks
        (the 5 CSVs in `Highlighted files.zip`)

This script downloads and unzips the highlighted files into a temporary
directory, joins them into the visualizer's JSON shape, and writes the
result next to the script's parent directory.

Decisions (per discussion with Shai, 2026-04-30):
  - Layer name format is "Cow X" (e.g. "Cow A", "Cow D"); the source uses
    single-letter cow IDs A, D, F, ..., Y (cow B was excluded as in the paper).
  - Modules: only the 20 largest (by state-node count) are kept with their
    relative-rank IDs 1..20; every other module is collapsed into module 21
    ("other"). This keeps Color-By-module visually useful instead of a
    414-bin scale.
  - Edge "mechanism" is derived from edge weight per Fig. 4 of the paper:
      pHGT  weight < 0.5
      distant_dispersal  0.5 <= weight < 0.95
      recent_dispersal  weight >= 0.95
  - has_amr / amr_class / has_mob are derived from text matching against
    the per-row annotation columns of ann.metadat.v1.csv.

Re-run this script any time the source data is updated.

  python3 data/process/build_shapiro2023.py

Outputs:
  data/shapiro2023_plasmids.json
"""

from __future__ import annotations
import csv
import io
import json
import re
import shutil
import ssl
import subprocess
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

REPO_ZIP_URL = (
    "https://github.com/Ecological-Complexity-Lab/Plasmid_multilayer_networks"
    "/raw/main/Highlighted%20files.zip"
)

# AMR class detection — checked against per-plasmid annotation strings (case-insensitive)
AMR_PATTERNS = [
    ("beta-lactam",        re.compile(r"beta[\s\-]?lactam", re.I)),
    ("tetracycline",       re.compile(r"tetracycline|\btet[wm]\b", re.I)),
    ("penicillin-binding", re.compile(r"penicillin[\s\-]?binding", re.I)),
]
MOB_PATTERN = re.compile(r"\bmob[a-z]?\b|relaxase", re.I)

# Edge-weight cutoffs from paper Fig. 4
PHGT_MAX            = 0.5    # weight < 0.5  → pHGT
DISTANT_DISPERSAL_MAX = 0.95   # 0.5 <= weight < 0.95 → distant_dispersal
                              # weight >= 0.95 → recent_dispersal

TOP_N_MODULES = 20            # keep the largest 20 modules; others collapsed
OTHER_MODULE_ID = 21

MIN_STATE_NODES_PER_LAYER = 20  # drop cows with fewer state-nodes than this

OUT_PATH = Path(__file__).resolve().parent.parent / "shapiro2023_plasmids.json"


# ----------------------------------------------------------------------------
# 1.  Download and parse the 5 highlighted CSVs
# ----------------------------------------------------------------------------

CACHE_DIR  = Path(__file__).resolve().parent / ".cache"
CACHE_PATH = CACHE_DIR / "shapiro2023_highlighted_files.zip"


def _download_zip() -> bytes:
    """Try urllib (with default SSL), then fall back to curl. Cache result."""
    if CACHE_PATH.exists():
        print(f"Using cached zip at {CACHE_PATH}  ({CACHE_PATH.stat().st_size:,} bytes)")
        return CACHE_PATH.read_bytes()

    CACHE_DIR.mkdir(exist_ok=True)
    print(f"Downloading {REPO_ZIP_URL}")
    try:
        with urllib.request.urlopen(REPO_ZIP_URL) as resp:
            zbytes = resp.read()
    except (ssl.SSLError, urllib.error.URLError) as e:
        print(f"  urllib failed ({e}); falling back to curl")
        if not shutil.which("curl"):
            raise RuntimeError("urllib failed and curl is not available")
        result = subprocess.run(
            ["curl", "-sLf", REPO_ZIP_URL, "-o", str(CACHE_PATH)],
            check=True,
        )
        zbytes = CACHE_PATH.read_bytes()
    else:
        CACHE_PATH.write_bytes(zbytes)
    print(f"  {len(zbytes):,} bytes (cached at {CACHE_PATH})")
    return zbytes


def fetch_csvs() -> dict[str, list[dict]]:
    """Download the highlighted ZIP and return each CSV as a list of dicts."""
    zbytes = _download_zip()
    out = {}
    with zipfile.ZipFile(io.BytesIO(zbytes)) as zf:
        for name in zf.namelist():
            if name.startswith("__MACOSX/") or not name.endswith(".csv"):
                continue
            with zf.open(name) as f:
                text = io.TextIOWrapper(f, encoding="utf-8")
                rows = list(csv.DictReader(text))
            out[Path(name).name] = rows
            print(f"  {name}: {len(rows):,} rows")
    return out


# ----------------------------------------------------------------------------
# 2.  Build the four JSON arrays
# ----------------------------------------------------------------------------

def build_layers(state_nodes: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """One layer per cow with >= MIN_STATE_NODES_PER_LAYER plasmids."""
    counts = Counter(r["cow_name"] for r in state_nodes)
    cow_letters = sorted(c for c, n in counts.items() if n >= MIN_STATE_NODES_PER_LAYER)
    dropped = sorted(c for c, n in counts.items() if n < MIN_STATE_NODES_PER_LAYER)
    if dropped:
        print(f"  Dropping cows with < {MIN_STATE_NODES_PER_LAYER} state-nodes: "
              + ", ".join(f"{c} ({counts[c]})" for c in dropped))
    layers = [
        {"layer_id": i + 1, "layer_name": f"Cow {cow}"}
        for i, cow in enumerate(cow_letters)
    ]
    cow_to_layer_name = {cow: f"Cow {cow}" for cow in cow_letters}
    return layers, cow_to_layer_name


def aggregate_amr_mob(ann_rows: list[dict]) -> dict[int, dict]:
    """
    Walk ann.metadat.v1.csv (multiple rows per state-node — one per ORF
    annotation), and for each *physical* plasmid record:
      - has_amr   (bool)
      - amr_class (one of "beta-lactam" | "tetracycline" | "penicillin-binding" | None)
      - has_mob   (bool)
    """
    per_node = defaultdict(lambda: {"has_amr": False, "amr_class": None, "has_mob": False})
    ann_cols = ["annotation1", "annotation2", "annotation3", "annotation4", "annotation5", "final"]

    for row in ann_rows:
        nid = int(row["node_id"])
        text = " ".join(row.get(c, "") or "" for c in ann_cols)

        for cls, pat in AMR_PATTERNS:
            if pat.search(text):
                per_node[nid]["has_amr"] = True
                # Keep the first AMR class detected (per-node — multiple state-nodes
                # of the same plasmid hit the same annotation set so this is stable).
                if per_node[nid]["amr_class"] is None:
                    per_node[nid]["amr_class"] = cls
                break

        if MOB_PATTERN.search(text):
            per_node[nid]["has_mob"] = True

    return per_node


def build_nodes(node_registry: list[dict],
                state_nodes: list[dict],
                ann_rows: list[dict]) -> list[dict]:
    """
    One row per *unique* physical plasmid (1,344). The registry CSV has
    1,379 rows because 35 node_ids appear under multiple plasmid_name
    synonyms (identical sequences from different cows — dedup'd to one
    physical node by Shapiro et al.). We collapse these here, picking one
    canonical name per node_id (the alphabetically-first one for stability).
    """
    amr_mob = aggregate_amr_mob(ann_rows)
    n_cows_per_node = Counter(int(r["node_id"]) for r in state_nodes)

    # Collapse synonyms — one canonical plasmid_name per node_id
    canonical = {}
    for r in node_registry:
        nid = int(r["node_id"])
        name = r["plasmid_name"]
        if nid not in canonical or name < canonical[nid]["plasmid_name"]:
            canonical[nid] = r

    nodes = []
    for nid in sorted(canonical):
        r = canonical[nid]
        attrs = amr_mob.get(nid, {"has_amr": False, "amr_class": None, "has_mob": False})
        nodes.append({
            "node_id":     nid,
            "node_name":   r["plasmid_name"],
            "length_bp":   int(r["plasmid_length"]),
            "has_amr":     attrs["has_amr"],
            "amr_class":   attrs["amr_class"],
            "has_mob":     attrs["has_mob"],
            "n_cows":      n_cows_per_node[nid],
        })
    return nodes


def build_state_nodes(state_meta: list[dict],
                      module_rows: list[dict],
                      cow_to_layer_name: dict[str, str],
                      canonical_name: dict[int, str]) -> list[dict]:
    """
    One row per (cow, plasmid) pair. Module IDs are remapped to top-20 + 21:
    the 20 most-populated modules keep ranks 1..20 (1 = largest); everything
    else becomes module 21 ("other").
    """
    # First pass: count state-nodes per source-module to find the top-20
    module_counts = Counter(r["module"] for r in module_rows)
    top_modules = [m for m, _ in module_counts.most_common(TOP_N_MODULES)]
    module_remap = {m: rank + 1 for rank, m in enumerate(top_modules)}

    # Build (layer_id, node_id) → (module, flow) lookup
    lookup = {}
    for r in module_rows:
        key = (int(r["layer_id"]), int(r["node_id"]))
        new_module = module_remap.get(r["module"], OTHER_MODULE_ID)
        lookup[key] = (new_module, float(r["flow"]))

    state = []
    for r in state_meta:
        if r["cow_name"] not in cow_to_layer_name:
            continue  # cow excluded by MIN_STATE_NODES_PER_LAYER filter
        key = (int(r["layer_id"]), int(r["node_id"]))
        module, flow = lookup.get(key, (OTHER_MODULE_ID, 0.0))
        state.append({
            "layer_name": cow_to_layer_name[r["cow_name"]],
            # Use the canonical name (matches `nodes[i].node_name`); the source
            # state-node rows carry per-cow synonyms for identical-sequence
            # plasmids, which would break the visualizer's stateNodeMap lookup.
            "node_name":  canonical_name[int(r["node_id"])],
            "module":     module,
            "flow":       flow,
        })

    # Sanity check: report module-size distribution
    final_counts = Counter(s["module"] for s in state)
    print(f"  State-node distribution after collapse:")
    for m in sorted(final_counts):
        tag = "(largest)" if m == 1 else ("(other — collapsed)" if m == OTHER_MODULE_ID else "")
        print(f"    module {m:>2}: {final_counts[m]:>4} state-nodes  {tag}")

    return state


def build_edges(edge_rows: list[dict],
                node_id_to_name: dict[int, str],
                cow_to_layer_name: dict[str, str]) -> list[dict]:
    """Edges referencing excluded cows are silently dropped."""
    edges = []
    for r in edge_rows:
        cow_from = layer_id_to_cow(int(r["layer_from"]))
        cow_to   = layer_id_to_cow(int(r["layer_to"]))
        if cow_from not in cow_to_layer_name or cow_to not in cow_to_layer_name:
            continue
        weight = float(r["weight"])
        if weight < PHGT_MAX:
            mech = "pHGT"
        elif weight < DISTANT_DISPERSAL_MAX:
            mech = "distant_dispersal"
        else:
            mech = "recent_dispersal"
        edges.append({
            "layer_from": cow_to_layer_name[cow_from],
            "node_from":  node_id_to_name[int(r["node_from"])],
            "layer_to":   cow_to_layer_name[cow_to],
            "node_to":    node_id_to_name[int(r["node_to"])],
            "weight":     weight,
            "length":     int(r["length"]),
            "pident":     float(r["pident"]),
            "mechanism":  mech,
        })
    return edges


# layer_id in the source CSVs is an integer (1, 3, 4, … because cow B = 2 was dropped).
# We need to map source layer_id → cow letter. Build that once from the metadata file.
_layer_id_to_cow_map: dict[int, str] = {}
def layer_id_to_cow(lid: int) -> str:
    return _layer_id_to_cow_map[lid]


# ----------------------------------------------------------------------------
# 3.  Driver
# ----------------------------------------------------------------------------

def main():
    csvs = fetch_csvs()

    node_registry = csvs["plas.2k.name.node.id.csv"]   # 1,344 unique plasmids
    state_meta    = csvs["plasmid.2k.metadat.csv"]      # 1,514 state-nodes
    edge_rows     = csvs["net.dat2k.ew.csv"]            # 2,738 edges
    module_rows   = csvs["plas_mods.df.csv"]            # 1,514 (one per state-node)
    ann_rows      = csvs["ann.metadat.v1.csv"]          # 5,312 (multiple ORFs per state-node)

    # Build the cross-reference maps
    for r in state_meta:
        _layer_id_to_cow_map[int(r["layer_id"])] = r["cow_name"]
    # Canonical name per physical node — pick the alphabetically-first synonym
    # so all references (nodes, state_nodes, edges) agree on the same string.
    canonical_name: dict[int, str] = {}
    for r in node_registry:
        nid, name = int(r["node_id"]), r["plasmid_name"]
        if nid not in canonical_name or name < canonical_name[nid]:
            canonical_name[nid] = name

    # Build the four arrays
    layers, cow_to_layer_name = build_layers(state_meta)
    nodes        = build_nodes(node_registry, state_meta, ann_rows)
    state_nodes  = build_state_nodes(state_meta, module_rows, cow_to_layer_name, canonical_name)
    edges        = build_edges(edge_rows, canonical_name, cow_to_layer_name)

    # Quick AMR / mob summary for the user
    amr_count = sum(1 for n in nodes if n["has_amr"])
    mob_count = sum(1 for n in nodes if n["has_mob"])
    print(f"\nNodes carrying AMR genes:      {amr_count}")
    print(f"  by class: {Counter(n['amr_class'] for n in nodes if n['has_amr'])}")
    print(f"Nodes carrying mobility genes: {mob_count}")

    # Edge mechanism summary
    mech_counts = Counter(e["mechanism"] for e in edges)
    print(f"\nEdge mechanism distribution: {dict(mech_counts)}")

    out = {
        "directed":            False,
        "directed_interlayer": False,
        "layers":              layers,
        "nodes":               nodes,
        "extended":            edges,
        "state_nodes":         state_nodes,
    }

    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f"\nWrote {OUT_PATH}  ({OUT_PATH.stat().st_size:,} bytes)")
    print(f"  layers={len(layers)}  nodes={len(nodes)}  state_nodes={len(state_nodes)}  edges={len(edges)}")


if __name__ == "__main__":
    sys.exit(main())

"""
build_kay2024.py — convert Kay et al. 2024 (Dryad doi:10.5061/dryad.dfn2z358r)
into a 3-layer multiplex for MiRA (contact-modality design).

Layers (same individuals on each):
  - Head-Head contacts (1-1)
  - Head-Body contacts (1-2 OR 2-1)
  - Body-Body contacts (2-2)

Weight = number of distinct interaction events with that contact flag set.
Outliers removed following the published R pipeline
(github.com/MO-Katy/AntSocialNetworkComparative, 1-CSNS_Main.R): drop ants whose
detection count falls > 2 SD from the colony mean. The paper's analysis is on
head-head contacts; layers 2 and 3 here use the same surviving individuals.

Usage:
  python build_kay2024.py \
      --colony cfel1 \
      --raw    raw/ \
      --out    /Users/shai/GitHub/ecomplab/MiRA/data/kay2024_ants.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd


SPECIES_BY_CODE = {
    "cfel": ("Camponotus fellah",       "Formicinae"),
    "drug": ("Diacamma rugosum",        "Ponerinae"),
    "ipur": ("Iridomyrmex purpureus",   "Dolichoderinae"),
    "pbar": ("Pogonomyrmex rugosus",    "Myrmicinae"),
    "rmet": ("Rhytidoponera metallica", "Ectatomminae"),
}

LAYERS = [
    ("Head-Head",  "1-1", "head–head contact"),
    ("Head-Body",  "h-b", "head–body contact (either direction)"),
    ("Body-Body",  "2-2", "body–body contact"),
]


def species_for(colony: str) -> tuple[str, str]:
    code = "".join(c for c in colony if c.isalpha())
    if code not in SPECIES_BY_CODE:
        sys.exit(f"unknown species code in colony '{colony}'")
    return SPECIES_BY_CODE[code]


def filter_outliers(md: pd.DataFrame) -> set[int]:
    """Return the set of ant_ids to KEEP after ±2 SD filter on `counts`."""
    mu, sigma = md["counts"].mean(), md["counts"].std()
    lo, hi = mu - 2 * sigma, mu + 2 * sigma
    keep = md[(md["counts"] >= lo) & (md["counts"] <= hi)]["ant_id"].astype(int)
    return set(keep.tolist())


def aggregate_layer_edges(
    interactions: pd.DataFrame,
    layer_mask: pd.Series,
    keep_ids: set[int],
) -> dict[tuple[int, int], int]:
    sub = interactions.loc[layer_mask, ["id1", "id2"]]
    sub = sub[sub["id1"].isin(keep_ids) & sub["id2"].isin(keep_ids)]
    a = sub[["id1", "id2"]].min(axis=1).astype(int)
    b = sub[["id1", "id2"]].max(axis=1).astype(int)
    pairs = list(zip(a, b))
    counts: dict[tuple[int, int], int] = defaultdict(int)
    for pair in pairs:
        counts[pair] += 1
    return dict(counts)


def build_payload(colony: str, raw_dir: Path) -> dict:
    species, subfamily = species_for(colony)

    md = pd.read_csv(raw_dir / f"md_{colony}.csv")
    keep_ids = filter_outliers(md)
    md_keep = md[md["ant_id"].isin(keep_ids)].copy()

    interactions = pd.read_csv(raw_dir / f"interaction_{colony}.csv")

    masks = {
        "Head-Head": interactions["1-1"] == True,
        "Head-Body": (interactions["1-2"] == True) | (interactions["2-1"] == True),
        "Body-Body": interactions["2-2"] == True,
    }

    layers = [
        {
            "layer_id":   i + 1,
            "layer_name": name,
            "contact_type": name,
            "description": desc,
        }
        for i, (name, _short, desc) in enumerate(LAYERS)
    ]

    nodes = []
    for layer_name, _, _ in LAYERS:
        for _, row in md_keep.iterrows():
            nodes.append({
                "node_id":      f"{layer_name}::ant_{int(row['ant_id'])}",
                "layer_name":   layer_name,
                "node_name":    f"ant_{int(row['ant_id'])}",
                "body_length_px": round(float(row["head_tail_px"]), 1),
                "detections":   int(row["counts"]),
            })

    state_nodes = [
        {"layer_name": ln, "node_name": f"ant_{aid}"}
        for ln, _, _ in LAYERS
        for aid in sorted(int(x) for x in keep_ids)
    ]

    extended = []
    for layer_name, _, _ in LAYERS:
        layer_edges = aggregate_layer_edges(interactions, masks[layer_name], keep_ids)
        for (a, b), w in sorted(layer_edges.items()):
            extended.append({
                "layer_from": layer_name,
                "node_from":  f"ant_{a}",
                "layer_to":   layer_name,
                "node_to":    f"ant_{b}",
                "weight":     int(w),
            })

    summary = {
        ln: sum(1 for e in extended if e["layer_from"] == ln)
        for ln, _, _ in LAYERS
    }
    sys.stderr.write(
        f"[{colony}] species={species} subfamily={subfamily} "
        f"kept_ants={len(keep_ids)} (dropped {len(md) - len(keep_ids)} outliers)\n"
        f"  intralayer edges per layer: {summary}\n"
    )

    return {
        "directed": False,
        "directed_interlayer": False,
        "dataset": {
            "name":     "Kay et al. 2024 — ant contact-modality multiplex",
            "colony":   colony,
            "species":  species,
            "subfamily": subfamily,
            "source_doi": "https://doi.org/10.5061/dryad.dfn2z358r",
            "paper_doi":  "https://doi.org/10.1098/rspb.2024.0898",
            "license":  "CC0 1.0",
        },
        "layers":      layers,
        "nodes":       nodes,
        "extended":    extended,
        "state_nodes": state_nodes,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--colony", default="cfel1",
                    help="colony code (e.g. cfel1, drug1, ipur1, pbar1, rmet1)")
    ap.add_argument("--raw", type=Path, default=Path(__file__).parent / "raw",
                    help="directory containing interaction_<colony>.csv + md_<colony>.csv")
    ap.add_argument("--out", type=Path, required=True,
                    help="output JSON path (typically MiRA/data/kay2024_ants.json)")
    args = ap.parse_args()

    payload = build_payload(args.colony, args.raw)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as f:
        json.dump(payload, f, indent=2)
    sys.stderr.write(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)\n")


if __name__ == "__main__":
    main()

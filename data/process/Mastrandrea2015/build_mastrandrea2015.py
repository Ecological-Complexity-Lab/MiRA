"""
build_mastrandrea2015.py — convert SocioPatterns "High School 2013" data
(Mastrandrea, Fournet & Barrat 2015 PLOS ONE) into a 4-layer multiplex.

Layers (same students on each):
  - Contact      : RFID face-to-face proximity events
  - Diary        : self-reported contact diary
  - Friendship   : reported friendships (survey)
  - Facebook     : Facebook friendship ties

Directed survey data are symmetrized into undirected edges
(union of i→j and j→i). Contact and Diary edges are weighted; Friendship and
Facebook are binary.

Usage:
  python build_mastrandrea2015.py \
      --raw raw/ \
      --out /Users/shai/GitHub/ecomplab/MiRA/data/mastrandrea2015_highschool.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd


LAYERS = [
    ("Contact",    "RFID face-to-face proximity (20 s resolution, summed over 5 days)"),
    ("Diary",      "Self-reported contacts (next-day diary, weight = duration tier 1–4)"),
    ("Friendship", "Reported friendships (survey, symmetrized)"),
    ("Facebook",   "Facebook friendship ties (symmetric by construction)"),
]


def read_metadata(path: Path) -> pd.DataFrame:
    md = pd.read_csv(path, sep="\t", header=None, names=["student_id", "class", "sex"])
    md["student_id"] = md["student_id"].astype(int)
    return md


def aggregate_proximity(path: Path) -> dict[tuple[int, int], int]:
    """Sum 20-second RFID contact events per unordered pair."""
    counts: dict[tuple[int, int], int] = defaultdict(int)
    for chunk in pd.read_csv(
        path, sep=" ", header=None,
        names=["t", "id1", "id2", "class1", "class2"],
        chunksize=200_000,
    ):
        a = chunk[["id1", "id2"]].min(axis=1).astype(int)
        b = chunk[["id1", "id2"]].max(axis=1).astype(int)
        for pair in zip(a, b):
            counts[pair] += 1
    return dict(counts)


def aggregate_diary(path: Path) -> dict[tuple[int, int], int]:
    df = pd.read_csv(path, sep=" ", header=None, names=["id1", "id2", "w"])
    a = df[["id1", "id2"]].min(axis=1).astype(int)
    b = df[["id1", "id2"]].max(axis=1).astype(int)
    weights: dict[tuple[int, int], int] = defaultdict(int)
    for pair, w in zip(zip(a, b), df["w"].astype(int)):
        weights[pair] = max(weights[pair], int(w))
    return dict(weights)


def aggregate_friendship(path: Path) -> set[tuple[int, int]]:
    df = pd.read_csv(path, sep=" ", header=None, names=["id1", "id2"])
    a = df[["id1", "id2"]].min(axis=1).astype(int)
    b = df[["id1", "id2"]].max(axis=1).astype(int)
    return set(zip(a, b))


def aggregate_facebook(path: Path) -> set[tuple[int, int]]:
    df = pd.read_csv(path, sep=" ", header=None, names=["id1", "id2", "friends"])
    df = df[df["friends"] == 1]
    a = df[["id1", "id2"]].min(axis=1).astype(int)
    b = df[["id1", "id2"]].max(axis=1).astype(int)
    return set(zip(a, b))


def build_payload(raw_dir: Path) -> dict:
    md = read_metadata(raw_dir / "HighSchool2013_metadata.txt")
    valid_ids = set(md["student_id"].tolist())

    sys.stderr.write(f"aggregating proximity (this takes a few seconds)…\n")
    contact_w = aggregate_proximity(raw_dir / "HighSchool2013_proximity_net.csv.gz")
    diary_w   = aggregate_diary(raw_dir / "HighSchool2013_contactdiaries_network.csv.gz")
    friend_p  = aggregate_friendship(raw_dir / "HighSchool2013_friendship_network.csv.gz")
    fb_p      = aggregate_facebook(raw_dir / "HighSchool2013_facebook_known_pairs.csv.gz")

    layer_edges = {
        "Contact":    [(a, b, int(w)) for (a, b), w in contact_w.items()
                       if a in valid_ids and b in valid_ids],
        "Diary":      [(a, b, int(w)) for (a, b), w in diary_w.items()
                       if a in valid_ids and b in valid_ids],
        "Friendship": [(a, b, 1) for (a, b) in friend_p
                       if a in valid_ids and b in valid_ids],
        "Facebook":   [(a, b, 1) for (a, b) in fb_p
                       if a in valid_ids and b in valid_ids],
    }

    sys.stderr.write(
        f"students: {len(md)} · classes: {md['class'].nunique()} · "
        f"edges per layer: {{ "
        + ", ".join(f"{k}: {len(v)}" for k, v in layer_edges.items())
        + " }}\n"
    )

    layers = [
        {"layer_id": i + 1, "layer_name": name, "description": desc}
        for i, (name, desc) in enumerate(LAYERS)
    ]

    nodes = []
    for layer_name, _ in LAYERS:
        for _, row in md.iterrows():
            nodes.append({
                "node_id":    f"{layer_name}::s_{int(row['student_id'])}",
                "layer_name": layer_name,
                "node_name":  f"s_{int(row['student_id'])}",
                "class":      row["class"],
                "sex":        row["sex"],
            })

    state_nodes = [
        {"layer_name": ln, "node_name": f"s_{sid}"}
        for ln, _ in LAYERS
        for sid in sorted(md["student_id"].astype(int))
    ]

    extended = []
    for layer_name, _ in LAYERS:
        for a, b, w in sorted(layer_edges[layer_name]):
            extended.append({
                "layer_from": layer_name,
                "node_from":  f"s_{a}",
                "layer_to":   layer_name,
                "node_to":    f"s_{b}",
                "weight":     w,
            })

    return {
        "directed":            False,
        "directed_interlayer": False,
        "dataset": {
            "name":       "Mastrandrea et al. 2015 — high-school multiplex (SocioPatterns)",
            "site":       "Lycée Thiers, Marseille, France",
            "year":       2013,
            "source_url": "http://www.sociopatterns.org/datasets/high-school-contact-and-friendship-networks/",
            "paper_doi":  "https://doi.org/10.1371/journal.pone.0136497",
            "license":    "CC-BY-NC-SA 3.0",
        },
        "layers":      layers,
        "nodes":       nodes,
        "extended":    extended,
        "state_nodes": state_nodes,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", type=Path, default=Path(__file__).parent / "raw")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    payload = build_payload(args.raw)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as f:
        json.dump(payload, f, indent=2)
    sys.stderr.write(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)\n")


if __name__ == "__main__":
    main()

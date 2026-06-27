"""
build_serramarin2025.py — convert the Cabrera plant–pollinator monitoring data
(Serra-Marín et al. 2025, "Comparative Assessment of Automated and Manual
Monitoring in Comprehensive Plant–Pollinator Communities") into a 2-layer
multiplex for MiRA.

Layers (same species pool, monitored two ways):
  - Human (OBS)   : direct human observation   (Method == "obs")
  - Camera (ACS)  : Automatic Camera System / Raspberry-Pi + YOLOv5 (Method == "rpi")

Each layer is a bipartite plant–pollinator network. Intralayer edges are
weighted by the number of recorded visit events for that plant–pollinator
pair under that method. No interlayer links (pure 2-layer multiplex).

Usage:
  python build_serramarin2025.py \
      --raw "cabrera_22_23_habitat.csv" \
      --out /Users/shai/GitHub/ecomplab/MiRA/data/serramarin2025.json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

METHOD_LAYER = {
    "obs": "Human (OBS)",
    "rpi": "Camera (ACS)",
}
LAYER_DESC = {
    "Human (OBS)":  "Direct human field observation of plant–pollinator visits.",
    "Camera (ACS)": "Automatic Camera System (Raspberry-Pi cameras + YOLOv5 detection).",
}

PLANT, POLLINATOR = "plant", "pollinator"


def _clean(s: str) -> str:
    return (s or "").strip()


def _is_missing(s: str) -> bool:
    return s == "" or s.lower() in {"nan", "na", "none"}


def build_payload(csv_path: Path) -> dict:
    # edges[(layer, plant, pollinator)] -> visit-record count
    edges: dict[tuple[str, str, str], int] = defaultdict(int)
    # per-pollinator attribute tallies (take the most common non-empty value)
    poll_family: dict[str, Counter] = defaultdict(Counter)
    poll_fgroup: dict[str, Counter] = defaultdict(Counter)

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            method = _clean(row.get("Method", ""))
            if method not in METHOD_LAYER:
                continue
            plant = _clean(row.get("Plant sp", ""))
            poll = _clean(row.get("Pollinator", ""))
            if _is_missing(plant) or _is_missing(poll):
                continue
            layer = METHOD_LAYER[method]
            edges[(layer, plant, poll)] += 1

            fam = _clean(row.get("Family", ""))
            if not _is_missing(fam):
                poll_family[poll][fam] += 1
            fg = _clean(row.get("Functional group", ""))
            if not _is_missing(fg):
                poll_fgroup[poll][fg] += 1

    def top(counter: Counter, default: str) -> str:
        return counter.most_common(1)[0][0] if counter else default

    # Collect nodes present per layer (split by role).
    layer_plants: dict[str, set] = defaultdict(set)
    layer_polls: dict[str, set] = defaultdict(set)
    for (layer, plant, poll) in edges:
        layer_plants[layer].add(plant)
        layer_polls[layer].add(poll)

    layer_names = list(METHOD_LAYER.values())
    layers = [
        {
            "layer_id": i + 1,
            "layer_name": name,
            "bipartite": True,
            "setA_type": POLLINATOR,
            "description": LAYER_DESC[name],
        }
        for i, name in enumerate(layer_names)
    ]

    nodes = []
    state_nodes = []
    for name in layer_names:
        for plant in sorted(layer_plants[name]):
            nodes.append({
                "node_id":   f"{name}::{plant}",
                "layer_name": name,
                "node_name":  plant,
                "node_type":  PLANT,
            })
            state_nodes.append({"layer_name": name, "node_name": plant})
        for poll in sorted(layer_polls[name]):
            nodes.append({
                "node_id":          f"{name}::{poll}",
                "layer_name":        name,
                "node_name":         poll,
                "node_type":         POLLINATOR,
                "family":            top(poll_family[poll], "unknown"),
                "functional_group":  top(poll_fgroup[poll], "unknown"),
            })
            state_nodes.append({"layer_name": name, "node_name": poll})

    extended = []
    for (layer, plant, poll), w in sorted(edges.items()):
        extended.append({
            "layer_from": layer,
            "node_from":  plant,
            "layer_to":   layer,
            "node_to":    poll,
            "weight":     w,
        })

    n_plants = len({p for s in layer_plants.values() for p in s})
    n_polls = len({p for s in layer_polls.values() for p in s})
    sys.stderr.write(
        f"layers: {len(layers)} · plants: {n_plants} · pollinators: {n_polls} · "
        + "edges per layer: { "
        + ", ".join(
            f"{name}: {sum(1 for k in edges if k[0] == name)}" for name in layer_names
        )
        + " }\n"
    )

    return {
        "directed": False,
        "directed_interlayer": False,
        "dataset": {
            "name": "Serra-Marín et al. 2025 — Cabrera plant–pollinator monitoring (Human vs ACS)",
            "site": "Cabrera Archipelago National Park, Balearic Islands, Spain",
            "year": 2025,
            "source_url": "",
            "paper_doi": "",
            "license": "",
        },
        "layers": layers,
        "nodes": nodes,
        "extended": extended,
        "state_nodes": state_nodes,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--raw", type=Path, default=Path(__file__).parent / "cabrera_22_23_habitat.csv")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    payload = build_payload(args.raw)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    sys.stderr.write(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KB)\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
build_keresztes2022.py — Build data/keresztes2022_connectome.json from three
longitudinal structural MRI scans of participant OAS30005 (OASIS-3 dataset,
accessed via braingraph.org).

Source: https://braingraph.org/download-pit-group-connectomes/
Paper:  Keresztes et al. (2022) Sci Rep doi:10.1038/s41598-022-06697-4
Data:   OASIS-3 (LaMontagne et al. 2019) — CC-BY 4.0

Mapping:
  Layers       = scan sessions T1/T2/T3 (longitudinal, same participant)
  Nodes        = 124 brain regions, Lausanne 2018 atlas scale 1
  Intralayer   = structural connections with number_of_fibers > 50
  Interlayer   = consecutive-session diagonal coupling (same region across
                 time); weight = Pearson r of each node's full fiber-count
                 profile between the two sessions

Run:
  python3 data/process/build_keresztes2022.py
Output:
  data/keresztes2022_connectome.json
"""

from __future__ import annotations
import json, math, xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

# ---- constants ---------------------------------------------------------------

FIBER_THRESHOLD = 50
NS = {'g': 'http://graphml.graphdrawing.org/xmlns'}

SESSIONS = ['d0581', 'd1274', 'd2377']
LAYER_NAMES = {
    'd0581': 'OAS30005 · T1',
    'd1274': 'OAS30005 · T2',
    'd2377': 'OAS30005 · T3',
}
INPUT_FILES = {
    s: f'sub-OAS30005_ses-{s}_atlas-L2018_res-scale1_conndata-network_connectivity.graphml'
    for s in SESSIONS
}
EDGE_ATTRS = ['number_of_fibers', 'fiber_length_mean', 'fiber_density', 'normalized_fiber_density']

HERE     = Path(__file__).resolve().parent
OUT_PATH = HERE.parent / 'keresztes2022_connectome.json'


# ---- helpers -----------------------------------------------------------------

def _key_map(root) -> dict[str, str]:
    """attr.name → element key id."""
    return {k.get('attr.name'): k.get('id') for k in root.findall('g:key', NS)}


def pearson_r(x: list[float], y: list[float]) -> float:
    n = len(x)
    if n < 2:
        return 0.0
    mx, my = sum(x) / n, sum(y) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
    dx  = math.sqrt(sum((xi - mx) ** 2 for xi in x))
    dy  = math.sqrt(sum((yi - my) ** 2 for yi in y))
    return 0.0 if dx == 0 or dy == 0 else num / (dx * dy)


# ---- parsing -----------------------------------------------------------------

def parse_session(session: str) -> tuple[dict, dict]:
    """
    Returns:
      node_info  node_id → {name, hemisphere, region}
      adj        node_id → {neighbor_id → {attr: value, ...}}
                 (full adjacency, not thresholded — used for correlation)
    """
    root = ET.parse(HERE / INPUT_FILES[session]).getroot()
    km   = _key_map(root)
    graph = root.find('g:graph', NS)

    node_info = {}
    for n in graph.findall('g:node', NS):
        nid = n.get('id')
        d   = {dd.get('key'): dd.text for dd in n}
        node_info[nid] = {
            'name':       d.get(km['dn_name'],       '').strip(),
            'hemisphere': d.get(km['dn_hemisphere'], '').strip(),
            'region':     d.get(km['dn_region'],     '').strip(),
        }

    adj: dict[str, dict] = defaultdict(dict)
    for e in graph.findall('g:edge', NS):
        src, tgt = e.get('source'), e.get('target')
        if src == tgt:
            continue
        d = {dd.get('key'): dd.text for dd in e}
        attrs = {}
        for attr in EDGE_ATTRS:
            raw = d.get(km.get(attr, ''))
            attrs[attr] = float(raw) if raw is not None else 0.0
        attrs['number_of_fibers'] = int(attrs['number_of_fibers'])
        adj[src][tgt] = attrs
        adj[tgt][src] = attrs

    return node_info, dict(adj)


# ---- build -------------------------------------------------------------------

def build(sessions: dict[str, tuple[dict, dict]]) -> dict:
    node_info   = sessions[SESSIONS[0]][0]
    node_ids    = sorted(node_info, key=int)

    # layers
    layers = [{'layer_id': i + 1, 'layer_name': LAYER_NAMES[s]}
              for i, s in enumerate(SESSIONS)]

    # nodes
    nodes = [
        {
            'node_id':    int(nid),
            'node_name':  node_info[nid]['name'],
            'hemisphere': node_info[nid]['hemisphere'],
            'region':     node_info[nid]['region'],
        }
        for nid in node_ids
    ]

    # state_nodes
    state_nodes = [
        {'layer_name': LAYER_NAMES[s], 'node_name': node_info[nid]['name']}
        for s in SESSIONS
        for nid in node_ids
    ]

    # intralayer edges (thresholded)
    extended = []
    for s in SESSIONS:
        adj   = sessions[s][1]
        layer = LAYER_NAMES[s]
        seen  = set()
        for src in node_ids:
            for tgt, attrs in adj.get(src, {}).items():
                if attrs['number_of_fibers'] <= FIBER_THRESHOLD:
                    continue
                pair = (min(src, tgt), max(src, tgt))
                if pair in seen:
                    continue
                seen.add(pair)
                extended.append({
                    'layer_from': layer,
                    'node_from':  node_info[src]['name'],
                    'layer_to':   layer,
                    'node_to':    node_info[tgt]['name'],
                    **attrs,
                })

    # interlayer edges — consecutive sessions, Pearson r of fiber profiles
    for s1, s2 in zip(SESSIONS, SESSIONS[1:]):
        adj1, adj2 = sessions[s1][1], sessions[s2][1]
        for nid in node_ids:
            others   = [o for o in node_ids if o != nid]
            profile1 = [adj1.get(nid, {}).get(o, {}).get('number_of_fibers', 0) for o in others]
            profile2 = [adj2.get(nid, {}).get(o, {}).get('number_of_fibers', 0) for o in others]
            r = round(pearson_r(profile1, profile2), 4)
            if r == 0.0:
                continue
            extended.append({
                'layer_from': LAYER_NAMES[s1],
                'node_from':  node_info[nid]['name'],
                'layer_to':   LAYER_NAMES[s2],
                'node_to':    node_info[nid]['name'],
                'weight':     r,
            })

    return {
        'directed':            False,
        'directed_interlayer': False,
        'layers':              layers,
        'nodes':               nodes,
        'extended':            extended,
        'state_nodes':         state_nodes,
    }


# ---- driver ------------------------------------------------------------------

def main():
    print('Parsing GraphML files...')
    sessions = {s: parse_session(s) for s in SESSIONS}

    max_edges = 124 * 123 // 2
    for s in SESSIONS:
        _, adj = sessions[s]
        n = sum(1 for src in adj for tgt, a in adj[src].items()
                if tgt > src and a['number_of_fibers'] > FIBER_THRESHOLD)
        print(f'  {LAYER_NAMES[s]}: {n} edges (>{FIBER_THRESHOLD} fibers, {n/max_edges*100:.1f}% density)')

    out = build(sessions)

    intra = [e for e in out['extended'] if e['layer_from'] == e['layer_to']]
    inter = [e for e in out['extended'] if e['layer_from'] != e['layer_to']]
    print(f'\nLayers: {len(out["layers"])}  Nodes: {len(out["nodes"])}  '
          f'State-nodes: {len(out["state_nodes"])}')
    print(f'Intralayer edges: {len(intra)}  Interlayer edges: {len(inter)}')

    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f'\nWrote {OUT_PATH}  ({OUT_PATH.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()

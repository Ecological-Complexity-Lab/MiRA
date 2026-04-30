#!/usr/bin/env python3
"""
build_larremore2013.py — Build data/larremore2013_malaria.json from the
9 HVR network files of Larremore et al. (2013).

Source: https://github.com/dblarremore/data_malaria_PLOSCompBiology_2013
        (distributed via https://networks.skewed.de/net/malaria_genes)
Paper:  Larremore DB, Clauset A, Buckee CO (2013)
        A Network Approach to Analyzing Highly Recombinant Malaria
        Parasite Genes. PLoS Comput Biol 9(10): e1003268.
        doi:10.1371/journal.pcbi.1003268
License: Creative Commons Attribution (CC-BY)

Mapping:
  Layers  = 9 highly variable regions (HVR 1–9) of the DBLα domain
  Nodes   = 307 P. falciparum var genes
  Edges   = statistically significant shared sequence substrings (binary)
  Node attrs:
    UPS      — upstream promoter type: A / B / C / ND
    CysPoLV  — cysteine/PoLV group (1–6, per Bull et al. 2007)

Run:
  python3 data/process/build_larremore2013.py
Output:
  data/larremore2013_malaria.json
"""

from __future__ import annotations
import json, xml.etree.ElementTree as ET
from pathlib import Path

try:
    import zstandard
except ImportError:
    raise SystemExit("Install the zstandard package first:  pip install zstandard")

# ---- constants ---------------------------------------------------------------

NS = {'g': 'http://graphml.graphdrawing.org/xmlns'}

LAYER_ORDER = [f'HVR_{i}' for i in range(1, 10)]
LAYER_NAMES = {f'HVR_{i}': f'HVR {i}' for i in range(1, 10)}

UPS_MAP = {'-1': 'ND', '1': 'A', '2': 'B', '3': 'C'}

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
IN_DIR   = PROJECT_ROOT / 'Data' / 'process' / 'larremore'
OUT_PATH = PROJECT_ROOT / 'data' / 'larremore2013_malaria.json'


# ---- helpers -----------------------------------------------------------------

def _decompress(path: Path) -> bytes:
    ctx = zstandard.ZstdDecompressor()
    with open(path, 'rb') as f:
        return ctx.stream_reader(f).read()


def _key_map(root: ET.Element) -> dict[str, str]:
    """attr.name → element key id (for node/edge keys only)."""
    return {k.get('attr.name'): k.get('id')
            for k in root.findall('g:key', NS)
            if k.get('for') in ('node', 'edge')}


# ---- parsing -----------------------------------------------------------------

def parse_hvr(path: Path) -> tuple[dict, list[tuple[str, str]]]:
    """
    Returns:
      node_info  node_elem_id → {name, UPS, CysPoLV}
      edges      list of (src_id, tgt_id) undirected pairs, no self-loops
    """
    root  = ET.fromstring(_decompress(path))
    km    = _key_map(root)
    graph = root.find('g:graph', NS)

    node_info: dict[str, dict] = {}
    for n in graph.findall('g:node', NS):
        nid = n.get('id')
        d   = {dd.get('key'): dd.text for dd in n}
        raw_name    = d.get(km.get('name', ''), nid)
        raw_ups     = d.get(km.get('UPS', ''), '-1')
        raw_cys     = d.get(km.get('CysPoLV', ''), None)
        node_info[nid] = {
            'name':     f'var_{raw_name}',
            'UPS':      UPS_MAP.get(raw_ups, 'ND'),
            'CysPoLV':  int(raw_cys) if raw_cys is not None else None,
        }

    edges: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for e in graph.findall('g:edge', NS):
        src, tgt = e.get('source'), e.get('target')
        if src == tgt:
            continue
        pair = (min(src, tgt), max(src, tgt))
        if pair not in seen:
            seen.add(pair)
            edges.append((src, tgt))

    return node_info, edges


# ---- build -------------------------------------------------------------------

def build(hvr_data: dict[str, tuple[dict, list]]) -> dict:
    node_info = hvr_data['HVR_1'][0]
    node_ids  = sorted(node_info, key=lambda x: int(x.lstrip('n')))

    layers = [
        {'layer_id': i + 1, 'layer_name': LAYER_NAMES[hvr]}
        for i, hvr in enumerate(LAYER_ORDER)
    ]

    nodes = [
        {
            'node_id':  i + 1,
            'node_name': node_info[nid]['name'],
            'UPS':       node_info[nid]['UPS'],
            'CysPoLV':   node_info[nid]['CysPoLV'],
        }
        for i, nid in enumerate(node_ids)
    ]

    state_nodes = [
        {'layer_name': LAYER_NAMES[hvr], 'node_name': node_info[nid]['name']}
        for hvr in LAYER_ORDER
        for nid in node_ids
    ]

    extended = []
    for hvr in LAYER_ORDER:
        ni, edges = hvr_data[hvr]
        layer = LAYER_NAMES[hvr]
        for src, tgt in edges:
            extended.append({
                'layer_from': layer,
                'node_from':  ni[src]['name'],
                'layer_to':   layer,
                'node_to':    ni[tgt]['name'],
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
    print('Parsing HVR files...')
    hvr_data: dict[str, tuple[dict, list]] = {}
    for hvr in LAYER_ORDER:
        path = IN_DIR / f'{hvr}.xml.zst'
        ni, edges = parse_hvr(path)
        hvr_data[hvr] = (ni, edges)
        print(f'  {LAYER_NAMES[hvr]}: {len(ni)} nodes, {len(edges)} edges')

    out = build(hvr_data)

    intra = len(out['extended'])
    print(f'\nLayers: {len(out["layers"])}  Nodes: {len(out["nodes"])}  '
          f'State-nodes: {len(out["state_nodes"])}  Intralayer edges: {intra}')

    # UPS distribution
    from collections import Counter
    ups_dist = Counter(n['UPS'] for n in out['nodes'])
    print(f'UPS distribution: {dict(sorted(ups_dist.items()))}')
    cys_dist = Counter(n['CysPoLV'] for n in out['nodes'])
    print(f'CysPoLV distribution: {dict(sorted(cys_dist.items()))}')

    OUT_PATH.write_text(json.dumps(out, indent=2))
    print(f'\nWrote {OUT_PATH}  ({OUT_PATH.stat().st_size:,} bytes)')


if __name__ == '__main__':
    main()

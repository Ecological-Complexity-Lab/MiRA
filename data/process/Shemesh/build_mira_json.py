"""
build_mira_json.py — Convert chaperone co-expression CSV + Excel to MiRA JSON.

Strategy:
  - 8 diverse human tissues as layers
  - Chaperone-chaperone pairs only (both proteins in the Excel catalogue)
  - Edge threshold: |r| > 0.4 AND p < 0.01
  - Keep top-50 hub proteins (highest total degree across all 8 tissues)
  - Node attributes: Family, Core/Variable, Stress-inducible (from Excel)
  - Edge weight: absolute correlation value
"""

import json, csv
from collections import Counter

TISSUES = [
    ('Whole_Blood',               'Whole Blood'),
    ('Brain0',                    'Brain'),
    ('Heart_Left_Ventricle',      'Heart'),
    ('Liver',                     'Liver'),
    ('Muscle_Skeletal',           'Skeletal Muscle'),
    ('Lung',                      'Lung'),
    ('Testis',                    'Testis'),
    ('Skin_Sun_Exposed_Lower_leg','Skin'),
]

CORR_THRESH = 0.4
PVAL_THRESH = 0.01
TOP_N       = 50
OUT_PATH    = '../../examples/chaperones.json'

# ── Load node attributes ──────────────────────────────────────────────────────
import sys
try:
    import openpyxl
except ImportError:
    sys.exit('pip install openpyxl')

wb = openpyxl.load_workbook('41467_2021_22369_MOESM3_ESM.xlsx', read_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))
# Row index 2 (0-based) is the header
header = [str(c).strip() if c else '' for c in rows[2]]
attrs = {}  # name -> dict
for row in rows[3:]:
    d = {header[i]: (str(v).strip() if v is not None else '') for i, v in enumerate(row)}
    name = d.get('Name', '').strip()
    ensg = d.get('ENSG ID', '').strip()
    if name:
        attrs[name] = {
            'ensg':          ensg,
            'family':        d.get('Family', 'other') or 'other',
            'core_variable': d.get('Core/Variable', '') or '',
            'stress':        d.get('Stress-inducible', '') or '',
        }

chaperone_set = set(attrs.keys())
print(f'Chaperone catalogue: {len(chaperone_set)} proteins')

# ── Load CSV ──────────────────────────────────────────────────────────────────
edges_raw = []
with open('ChaperoneCorrelation.csv', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        p1 = row['Protein1Symbol'].strip()
        p2 = row['Protein2Symbol'].strip()
        if p1 not in chaperone_set or p2 not in chaperone_set:
            continue
        edges_raw.append(row)
        # fix whitespace in-place
        row['Protein1Symbol'] = p1
        row['Protein2Symbol'] = p2

print(f'Chaperone-chaperone pairs: {len(edges_raw)}')

# ── Select top-N hub proteins ─────────────────────────────────────────────────
degree = Counter()
for row in edges_raw:
    for col, _ in TISSUES:
        try:
            corr = float(row[col + '_corr'])
            pval = float(row[col + '_pval'])
        except (ValueError, KeyError):
            continue
        if abs(corr) > CORR_THRESH and pval < PVAL_THRESH:
            degree[row['Protein1Symbol']] += 1
            degree[row['Protein2Symbol']] += 1

top_nodes = {p for p, _ in degree.most_common(TOP_N)}
print(f'Top-{TOP_N} hub proteins selected')

# ── Build MiRA structure ──────────────────────────────────────────────────────
layers      = []
nodes_list  = []
extended    = []
state_nodes = []

for i, (col, label) in enumerate(TISSUES, start=1):
    layers.append({'layer_id': i, 'layer_name': label})

    # All top nodes appear in every layer (multiplex)
    for pname in sorted(top_nodes):
        a = attrs.get(pname, {})
        nodes_list.append({
            'node_id':      a.get('ensg', pname),
            'layer_name':   label,
            'node_name':    pname,
            'family':       a.get('family', 'other'),
            'core_variable':a.get('core_variable', ''),
            'stress':       a.get('stress', ''),
        })
        state_nodes.append({'layer_name': label, 'node_name': pname})

    # Edges above threshold
    for row in edges_raw:
        p1 = row['Protein1Symbol']
        p2 = row['Protein2Symbol']
        if p1 not in top_nodes or p2 not in top_nodes:
            continue
        try:
            corr = float(row[col + '_corr'])
            pval = float(row[col + '_pval'])
        except (ValueError, KeyError):
            continue
        if abs(corr) > CORR_THRESH and pval < PVAL_THRESH:
            extended.append({
                'layer_from': label,
                'node_from':  p1,
                'layer_to':   label,
                'node_to':    p2,
                'weight':     round(abs(corr), 4),
            })

# ── Summary ───────────────────────────────────────────────────────────────────
print(f'\nOutput summary:')
print(f'  Layers : {len(layers)}')
print(f'  Nodes  : {len(nodes_list)}  ({len(top_nodes)} unique proteins × {len(TISSUES)} tissues)')
print(f'  Edges  : {len(extended)}')
from collections import Counter as C
per_layer = C(e['layer_from'] for e in extended)
for _, label in TISSUES:
    print(f'    {label}: {per_layer[label]} edges')

# ── Write JSON ────────────────────────────────────────────────────────────────
out = {
    'directed':    False,
    'layers':      layers,
    'nodes':       nodes_list,
    'extended':    extended,
    'state_nodes': state_nodes,
}

import os
os.makedirs(os.path.dirname(os.path.abspath(OUT_PATH)), exist_ok=True)
with open(OUT_PATH, 'w') as f:
    json.dump(out, f, indent=2)
print(f'\nWritten to {OUT_PATH}')

# Task: Manual Verification of Dashboard Calculations

**Status:** TODO

## Goal
Manually verify that the numbers and charts shown in the dashboard are correct by cross-checking them against the raw data files.

---

## KPI Cards to Check

Load a known dataset (e.g. one of the sample files in `data/`) and verify each KPI card value:

- [ ] **Physical nodes** — count distinct node names in the nodes file
- [ ] **State nodes** — count rows in the state-nodes list (nodes × layers they appear in)
- [ ] **Intra-layer edges** — count rows in the intralayer links file
- [ ] **Interlayer edges** — count rows in the interlayer links file
- [ ] **Avg layer density** — for each layer: `density = E / (N*(N-1)/2)` (undirected) or `E / (N*(N-1))` (directed); then average across layers

For **bipartite layers**: density = `E / (nA * nB)`, nodes card should show `nA + nB` (both groups).

---

## Per-Layer Charts to Check

For each layer individually, verify:

- [ ] **Nodes per layer** bar matches the count of state nodes in that layer
- [ ] **Edges per layer** bar matches the count of intralayer links for that layer
- [ ] **Density per layer** bar matches the formula above per layer

---

## Presence Matrix to Check

- [ ] A filled cell `(layer, node)` means that node appears in that layer — cross-check a few cells against the raw state-nodes list

---

## Degree Distribution to Check

- [ ] Node degree = sum of edges touching that node **across all layers**
- [ ] Check a few nodes manually: count their appearances in the intralayer links file

---

## How to Run the Check

1. Open the app with a sample dataset
2. Open the Dashboard panel
3. Open the raw data file side-by-side
4. Compare each value above against the raw counts

Report any discrepancies as bugs in [bugs.md](../bugs.md).

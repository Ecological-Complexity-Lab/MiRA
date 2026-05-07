# MiRA Calculations Reference

A single-page reference for every quantitative computation MiRA performs on a multilayer network — what it is, where it's computed, and how it's used.

All quantitative calculations live under `js/calc/`:

- `nodeMetrics.js` — degree/strength split into intra and inter (rows 1–7)
- `layerMetrics.js` — per-layer density and edge/node counts (rows 12–16)
- `similarity.js` — pairwise layer similarity (Jaccard, rows 17–19)
- `metaAggregation.js` — project the multilayer model onto a meta-graph (rows 27–31)

The dashboard, dataParser, and metaNetwork modules consume these — none of them implement math directly.

Notation:
- *N(ℓ)* — number of physical nodes in layer ℓ
- *E(ℓ)* — number of unique edges in layer ℓ
- *L* — number of layers
- *u, v* — physical (cross-layer) node names
- *α, β* — layer indices
- *w* — edge weight (defaults to 1 if absent or `weight === undefined`)
- *a^α_{ij}* — intralayer adjacency (layer α, nodes i,j)
- *a^{αβ}_{ij}* — interlayer adjacency (layers α≠β, nodes i,j; both diagonal i=j and off-diagonal i≠j permitted)
- A "state node" is a `(layer, node)` pair — the canonical key is `layerName::nodeName`
- Math reference: Boccaletti et al. 2014, *Phys. Rep.* **544**; De Domenico et al. 2013/2015.

---

## Node-level metrics

Intralayer and interlayer connections are kept **mathematically distinct** at the state-node level. Self-loops (j = i within a layer) are excluded from intralayer counts, per the j ≠ i in the math spec.

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 1 | Network / Map / Layer / Grid (data prep) | **Intralayer degree** of state node (i, α) | `intra_degree = Σ_{j≠i} 𝟙[a^α_{ij} > 0]` | Number of within-layer neighbours of state node (i, α). Self-loops excluded. Emitted on undirected networks; replaced by `intra_in_degree` / `intra_out_degree` when intralayer is directed. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 2 | Network / Map / Layer / Grid (data prep) | **Intralayer strength** | `intra_strength = Σ_{j≠i} a^α_{ij}` | Weighted analogue of intralayer degree. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 3 | Network / Map / Layer / Grid (data prep) | **Interlayer degree** | `inter_degree = Σ_{β≠α} Σ_j 𝟙[a^{αβ}_{ij} > 0]` (inner sum over all j, including j=i) | Number of interlayer connections incident at (i, α). Counts both diagonal (replica) and off-diagonal (general multilayer) couplings. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 4 | Network / Map / Layer / Grid (data prep) | **Interlayer strength** | `inter_strength = Σ_{β≠α} Σ_j a^{αβ}_{ij}` | Weighted analogue of interlayer degree. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 5 | Network / Map / Layer / Grid (data prep) | **Directed in/out splits** | For each of (1)–(4), an in/out variant when the relevant edge type is directed: `intra_in_degree`, `intra_out_degree`, `intra_in_strength`, `intra_out_strength`, plus `inter_*` analogues | Intra splits emitted iff `model.directed`; inter splits iff `model.directedInterlayer`. The undirected scalar is dropped when its directed counterparts are present, so dropdowns stay unambiguous. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 6 | Network / Map / Layer / Grid (data prep) | **Per-physical-node vector across layers** | `<field>_by_layer` = `Map<layerName, value>` for each of (1)–(5) | One value per layer the node occupies. Stored on the physical-node object; visible in the data-table tooltip and available for export. Not exposed as a coloring attribute (it isn't scalar). | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 7 | Dashboard / dropdowns | **Per-physical-node scalar aggregates** | `<field>_sum = Σ_α <field>(i, α)`; `<field>_mean = sum / |layers_present(i)|` | Two scalar aggregates of (6) per primitive. Drives the dashboard Degree / Strength distribution histograms and appears in the node-attribute color/size dropdowns under the "MiRA-computed" optgroup, ordered intra→inter and degree→strength. Inter entries are tinted blue (matching the default interlayer-link colour). No "grand total" is exposed — intra and inter remain separate by default. | [js/calc/nodeMetrics.js](../js/calc/nodeMetrics.js) |
| 8 | Dashboard | **Node participation** (multiplexity) | `P(v) = ` # distinct layers in which `v` appears as a state node | Counts how many layers a physical node participates in. Drives the **Node Participation (Multiplexity)** histogram and is the default sort key for the Presence Matrix. | [js/dashboard.js:309-313](../js/dashboard.js#L309-L313) |
| 9 | Meta-Network | **Meta-degree** of physical node `v` | `metaDegree(v) = |{ u : (u, v) ∈ E_meta }|` on the aggregated meta-graph | Number of distinct partners across the layer-aggregated meta-network. Drives node size/color in Meta-Network mode. **Not** the same as `inter_degree_sum` — it operates on the projected meta-graph, while `inter_degree_sum` counts true cross-layer links. | [js/metaNetwork.js:188-201](../js/metaNetwork.js#L188-L201) |
| 10 | Meta-Network | **Meta-strength** of physical node `v` | `metaStrength(v) = Σ weight(e)` over meta-edges incident to `v` | Weighted analogue of meta-degree on the aggregated graph. Weight depends on aggregation mode (see #28). | [js/metaNetwork.js:202-204](../js/metaNetwork.js#L202-L204) |
| 11 | Meta-Network | **Participation** (in meta-context) | `participation(v) = |layers(v)|` | Same idea as #8 but exposed as a node attribute on the meta-network for color/size mapping. | [js/metaNetwork.js:200-213](../js/metaNetwork.js#L200-L213) |

---

## Layer-level metrics

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 12 | Dashboard — Per-Layer Overview | **Layer density** | Unipartite undirected: `ρ(ℓ) = E(ℓ) / [N(ℓ)(N(ℓ)−1)/2]`. Unipartite directed: `ρ(ℓ) = E(ℓ) / [N(ℓ)(N(ℓ)−1)]`. Bipartite undirected: `ρ(ℓ) = E(ℓ) / (n_A · n_B)`. Bipartite directed: `ρ(ℓ) = E(ℓ) / (2 · n_A · n_B)`. | Fraction of possible edges actually present, computed on a deduplicated edge set so undirected double-listings (A→B and B→A) don't inflate it. | [js/calc/layerMetrics.js](../js/calc/layerMetrics.js) |
| 13 | Dashboard | **Average layer density** | `avgρ = (1/L) · Σ_ℓ ρ(ℓ)` | KPI card in the Summary section. | [js/calc/layerMetrics.js](../js/calc/layerMetrics.js) |
| 14 | Dashboard — Per-Layer Overview | **Nodes per layer** `N(ℓ)` | `N(ℓ) = |nodesPerLayer(ℓ)|` | Bar-chart variable; in bipartite mode shown as a stacked bar of `n_A` vs `n_B`. | [js/calc/layerMetrics.js](../js/calc/layerMetrics.js) |
| 15 | Dashboard — Per-Layer Overview | **Edges per layer** `E(ℓ)` | `E(ℓ) = |{deduplicated edge keys in ℓ}|`; key is `from→to` (directed) or sorted pair (undirected) | Edges are deduplicated to neutralise CSV/JSON duplicate listings before counting. | [js/calc/layerMetrics.js](../js/calc/layerMetrics.js) |
| 16 | Dashboard — Set Size Ratio | **Bipartite set-size ratio** | `(n_A(ℓ), n_B(ℓ))` per layer | Stacked-bar visualisation of how the two bipartite sets balance across layers. | [js/dashboard.js](../js/dashboard.js) |

---

## Pairwise / matrix metrics

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 17 | Dashboard — Layer Similarity | **Jaccard (node identity)** between layers ℓ_i and ℓ_j | `J(A, B) = |A ∩ B| / |A ∪ B|` with `A = nodes(ℓ_i)`, `B = nodes(ℓ_j)` | Heatmap quantifying how much two layers share node identities. Returns `NaN` when both sets are empty. | [js/calc/similarity.js](../js/calc/similarity.js) |
| 18 | Dashboard — Layer Similarity | **Jaccard (edge identity)** between layers | `J(E_i, E_j)` over deduplicated edge-key sets | Heatmap of edge-set overlap between layers. Always shown (unipartite + bipartite). | [js/calc/similarity.js](../js/calc/similarity.js) |
| 19 | Dashboard — Layer Similarity (bipartite) | **Per-set Jaccard** (Set A and Set B node identity) | `J(A_i ∩ Set_X, A_j ∩ Set_X)` for `X ∈ {A, B}` | Two extra heatmaps for bipartite networks comparing each set's identity overlap across layers. | [js/calc/similarity.js](../js/calc/similarity.js) |
| 20 | Dashboard — Presence Matrix | **Node × Layer presence** `1_{v ∈ ℓ}` | `presence(v, ℓ) = 1` iff state node `(ℓ, v)` exists | Binary matrix view, sortable by participation, name, or bipartite set. Flippable to layer-rows orientation. | [js/dashboard.js:321-323, 432-517](../js/dashboard.js#L321-L323) |

---

## Distributions / histograms

| # | Mode / Section | Property | Binning | Description | File |
|---|---|---|---|---|---|
| 21 | Dashboard | **Degree distribution (intra vs inter)** | `nBins = 10` linear bins from 0 to `max(value)`; bin width `bw = ⌈max/nBins⌉` (≥1); trailing empty bins trimmed | Two side-by-side histograms — `intra_degree_sum` and `inter_degree_sum` (#7) — so the multilayer split is visible. Bipartite mode renders a 2×2 grid (Set A / Set B × intra / inter). | [js/dashboard.js](../js/dashboard.js) |
| 22 | Dashboard | **Strength distribution (intra vs inter)** | `nBins = 12` linear bins over `[min(s), max(s)]`; auto-hidden when all weights are identical (no information vs. degree) | Same shape as #21 but on `intra_strength_sum` / `inter_strength_sum`. | [js/dashboard.js](../js/dashboard.js) |
| 23 | Dashboard | **Participation distribution** | One bin per layer count `1..L`; integer-valued | Histogram of P(v) (#8). | [js/dashboard.js:551-574](../js/dashboard.js#L551-L574) |
| 24 | Dashboard | **Intralayer weight distribution** | `nBins = 15` linear bins over `[min(w), max(w)]`; degenerate ranges collapse to a single bin | Distribution of edge weights for intralayer links. Filterable to a single layer via dropdown. | [js/dashboard.js:585-733](../js/dashboard.js#L585-L733) |
| 25 | Dashboard | **Interlayer weight distribution** | Same `nBins = 15` linear binning | Distribution of interlayer weights, optionally filtered to a single layer pair via the heatmap selector. | [js/dashboard.js:585-733](../js/dashboard.js#L585-L733) |
| 26 | Dashboard | **Interlayer link count heatmap** | Layer-pair counts of interlayer links | Click a cell to filter the interlayer weight histogram (#25) by that pair. | [js/dashboard.js:585-733](../js/dashboard.js#L585-L733) |

---

## Aggregation / projection

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 27 | Meta-Network | **Edge weight (union mode)** | `w_meta(u, v) = 1` whenever ≥1 layer has edge `(u, v)` | Treats the meta-graph as a simple unweighted union across layers. | [js/calc/metaAggregation.js](../js/calc/metaAggregation.js) |
| 28 | Meta-Network | **Edge weight (sumOccurrence)** | `w_meta(u, v) = |{ ℓ : (u, v) ∈ E(ℓ) }|` | Counts in how many layers the edge appears. | [js/calc/metaAggregation.js](../js/calc/metaAggregation.js) |
| 29 | Meta-Network | **Edge weight (sumWeights)** | `w_meta(u, v) = Σ_ℓ w_ℓ(u, v)` | Sums layer-specific weights of the same edge. | [js/calc/metaAggregation.js](../js/calc/metaAggregation.js) |
| 30 | Meta-Network | **Edge canonicalisation** | Directed: keep `(a, b)` as listed. Undirected: sort `(a, b)` so `min, max` is the canonical key | Prevents `(A, B)` and `(B, A)` from being counted as two distinct meta-edges. | [js/calc/metaAggregation.js](../js/calc/metaAggregation.js) |
| 31 | Meta-Network | **Per-layer edge contribution** | For each meta-edge: list of `(layerName, weight)` it appears in | Used in tooltips and per-edge breakdown display. | [js/calc/metaAggregation.js](../js/calc/metaAggregation.js) |
| 32 | Meta-Network — Bipartite | **Set assignment** | `node ∈ Set A` iff it belongs to set A in any bipartite layer; conflicts (in both A and B) are resolved by removing it from B | Lets the meta-network adopt a single bipartite typing across the whole network. | [js/metaNetwork.js:114-123](../js/metaNetwork.js#L114-L123) |

---

## Layout-time computations (used by Network / Layer / Grid)

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 33 | Layout — Kamada-Kawai | **Pairwise graph distance** | Floyd-Warshall all-pairs shortest path on intralayer adjacency | Distances feed the spring energy minimisation of Kamada-Kawai layout. | [js/layout.js:239-275](../js/layout.js#L239-L275) |
| 34 | Layout — Bipartite (nested) | **Hub-first ordering** | Sort each row of the bipartite layout by `intra_degree` descending (interlayer connectivity does not affect within-layer ordering) | When `bipartiteNested = true`, hubs are placed at one end so dense bipartite networks reveal nested structure. | [js/layout.js:450-461](../js/layout.js#L450-L461) |
| 35 | Layout — Force (Layer Mode) | **d3-force simulation** | Standard `forceLink + forceManyBody + forceCenter` + bipartite x/y biases (`strength=0.02` x, `strength=0` y in bipartite mode) | Per-layer 2D force-directed layout used in Layer View and Meta-Network. | [js/metaNetwork.js:301-307](../js/metaNetwork.js#L301-L307) |

---

## Notes on conventions

- **Edge deduplication.** Throughout the dashboard, intralayer edges are deduplicated by sort-pair key (undirected) or `from→to` key (directed) before any density / count / Jaccard computation. Self-loops are kept in the deduplicated edge count.
- **Self-loops in degree/strength.** Intralayer self-loops (j = i within a layer) are **excluded** from `intra_degree` and `intra_strength`, following the j ≠ i convention in the multilayer formalism. (This is a behaviour change from earlier versions, which counted them once.)
- **Weight default.** When `weight` is missing or `undefined` on a link, MiRA uses `w = 1`. A weight of `0` is treated as "no edge" and the link is dropped at parse time (see [js/dataParser.js:64-78](../js/dataParser.js#L64-L78)).
- **Computed vs. data attributes.** Names of MiRA-derived per-state-node and per-physical-node fields are exposed as `model.computedStateNodeAttributes` and `model.computedNodeAttributes`. Dropdowns group them under a "MiRA-computed" optgroup, separate from "From data".
- **Auto-detection of bipartite.** Bipartite metrics are only emitted when a layer is **explicitly declared** bipartite (`layer.bipartite = true` and a `node_type` attribute with exactly two distinct values). See [CLAUDE.md](../CLAUDE.md#bipartite-support) for the full rule.

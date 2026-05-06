# MiRA Calculations Reference

A single-page reference for every quantitative computation MiRA performs on a multilayer network — what it is, where it's computed, and how it's used.

Notation:
- *N(ℓ)* — number of physical nodes in layer ℓ
- *E(ℓ)* — number of unique edges in layer ℓ
- *L* — number of layers
- *u, v* — physical (cross-layer) node names
- *w* — edge weight (defaults to 1 if absent or `weight === undefined`)
- A "state node" is a `(layer, node)` pair — the canonical key is `layerName::nodeName`

---

## Node-level metrics

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 1 | Network / Map / Layer / Grid (data prep) | **Degree** of state node `(ℓ, v)` | `degree(ℓ, v) = ` count of intralayer + interlayer links incident to `(ℓ, v)`; self-loops counted once | Number of links touching the state node, summed across intra- and interlayer edges. Stored as `sn.degree` and exposed in node-color / node-size dropdowns. | [js/dataParser.js:114-151](js/dataParser.js#L114-L151) |
| 2 | Network / Map / Layer / Grid (data prep) | **Strength** of state node `(ℓ, v)` | `strength(ℓ, v) = Σ w_e` over all incident edges (self-loops counted once) | Weighted analogue of degree. Stored as `sn.strength`. | [js/dataParser.js:114-151](js/dataParser.js#L114-L151) |
| 3 | Network / Map / Layer / Grid (data prep) | **In-degree / Out-degree** | For directed links: `in_degree = ` # incoming, `out_degree = ` # outgoing | Only emitted when the network is directed; otherwise the four directional fields are deleted to keep the attribute dropdowns clean. | [js/dataParser.js:118-160](js/dataParser.js#L118-L160) |
| 4 | Network / Map / Layer / Grid (data prep) | **In-strength / Out-strength** | Directed: `in_strength = Σw incoming`, `out_strength = Σw outgoing` | Weighted directed analogues of in/out-degree. | [js/dataParser.js:118-160](js/dataParser.js#L118-L160) |
| 5 | Dashboard | **Per-physical-node degree** (multilayer aggregate) | `D(v) = Σ_ℓ degree(ℓ, v)` summed across all state nodes sharing name `v` | Used as the variable for the **Degree distribution** histogram. Aggregates degree across layers per physical node. | [js/dashboard.js:316-319](js/dashboard.js#L316-L319) |
| 6 | Dashboard | **Node participation** (a.k.a. multiplexity) | `P(v) = ` # distinct layers in which `v` appears as a state node | Counts how many layers a physical node participates in. Drives the **Node Participation (Multiplexity)** histogram and is the default sort key for the Presence Matrix. | [js/dashboard.js:309-313](js/dashboard.js#L309-L313) |
| 7 | Meta-Network | **Meta-degree** of physical node `v` | `metaDegree(v) = |{ u : (u, v) ∈ E_meta }|` on the aggregated meta-graph | Number of distinct partners across the layer-aggregated meta-network. Drives node size/color in Meta-Network mode. | [js/metaNetwork.js:188-201](js/metaNetwork.js#L188-L201) |
| 8 | Meta-Network | **Meta-strength** of physical node `v` | `metaStrength(v) = Σ weight(e)` over meta-edges incident to `v` | Weighted analogue of meta-degree on the aggregated graph. Weight depends on aggregation mode (see #11). | [js/metaNetwork.js:202-204](js/metaNetwork.js#L202-L204) |
| 9 | Meta-Network | **Participation** (in meta-context) | `participation(v) = |layers(v)|` | Same idea as #6 but exposed as a node attribute on the meta-network for color/size mapping. | [js/metaNetwork.js:200-213](js/metaNetwork.js#L200-L213) |

---

## Layer-level metrics

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 10 | Dashboard — Per-Layer Overview | **Layer density** | Unipartite undirected: `ρ(ℓ) = E(ℓ) / [N(ℓ)(N(ℓ)−1)/2]`. Unipartite directed: `ρ(ℓ) = E(ℓ) / [N(ℓ)(N(ℓ)−1)]`. Bipartite undirected: `ρ(ℓ) = E(ℓ) / (n_A · n_B)`. Bipartite directed: `ρ(ℓ) = E(ℓ) / (2 · n_A · n_B)`. | Fraction of possible edges actually present, computed on a deduplicated edge set so undirected double-listings (A→B and B→A) don't inflate it. | [js/dashboard.js:285-302](js/dashboard.js#L285-L302) |
| 11 | Dashboard | **Average layer density** | `avgρ = (1/L) · Σ_ℓ ρ(ℓ)` | KPI card in the Summary section. | [js/dashboard.js:304-306](js/dashboard.js#L304-L306) |
| 12 | Dashboard — Per-Layer Overview | **Nodes per layer** `N(ℓ)` | `N(ℓ) = |nodesPerLayer(ℓ)|` | Bar-chart variable; in bipartite mode shown as a stacked bar of `n_A` vs `n_B`. | [js/dashboard.js:277-283](js/dashboard.js#L277-L283) |
| 13 | Dashboard — Per-Layer Overview | **Edges per layer** `E(ℓ)` | `E(ℓ) = |{deduplicated edge keys in ℓ}|`; key is `from→to` (directed) or sorted pair (undirected) | Edges are deduplicated to neutralise CSV/JSON duplicate listings before counting. | [js/dashboard.js:285-294](js/dashboard.js#L285-L294) |
| 14 | Dashboard — Set Size Ratio | **Bipartite set-size ratio** | `(n_A(ℓ), n_B(ℓ))` per layer | Stacked-bar visualisation of how the two bipartite sets balance across layers. | [js/dashboard.js:576-583](js/dashboard.js#L576-L583) |

---

## Pairwise / matrix metrics

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 15 | Dashboard — Layer Similarity | **Jaccard (node identity)** between layers ℓ_i and ℓ_j | `J(A, B) = |A ∩ B| / |A ∪ B|` with `A = nodes(ℓ_i)`, `B = nodes(ℓ_j)` | Heatmap quantifying how much two layers share node identities. Returns `NaN` when both sets are empty. | [js/dashboard.js:741-748, 791-795](js/dashboard.js#L741-L748) |
| 16 | Dashboard — Layer Similarity | **Jaccard (edge identity)** between layers | `J(E_i, E_j)` over deduplicated edge-key sets | Heatmap of edge-set overlap between layers. Always shown (unipartite + bipartite). | [js/dashboard.js:752-757](js/dashboard.js#L752-L757) |
| 17 | Dashboard — Layer Similarity (bipartite) | **Per-set Jaccard** (Set A and Set B node identity) | `J(A_i ∩ Set_X, A_j ∩ Set_X)` for `X ∈ {A, B}` | Two extra heatmaps for bipartite networks comparing each set's identity overlap across layers. | [js/dashboard.js:760-789](js/dashboard.js#L760-L789) |
| 18 | Dashboard — Presence Matrix | **Node × Layer presence** `1_{v ∈ ℓ}` | `presence(v, ℓ) = 1` iff state node `(ℓ, v)` exists | Binary matrix view, sortable by participation, name, or bipartite set. Flippable to layer-rows orientation. | [js/dashboard.js:321-323, 432-517](js/dashboard.js#L321-L323) |

---

## Distributions / histograms

| # | Mode / Section | Property | Binning | Description | File |
|---|---|---|---|---|---|
| 19 | Dashboard | **Degree distribution** | `nBins = 10` linear bins from 0 to `max(D)`; bin width `bw = ⌈max/nBins⌉` (≥1); trailing empty bins trimmed | Histogram of physical-node degree D(v) (#5). Split into Set A / Set B histograms when bipartite. | [js/dashboard.js:520-549](js/dashboard.js#L520-L549) |
| 20 | Dashboard | **Participation distribution** | One bin per layer count `1..L`; integer-valued | Histogram of P(v) (#6). | [js/dashboard.js:551-574](js/dashboard.js#L551-L574) |
| 21 | Dashboard | **Intralayer weight distribution** | `nBins = 15` linear bins over `[min(w), max(w)]`; degenerate ranges collapse to a single bin | Distribution of edge weights for intralayer links. Filterable to a single layer via dropdown. | [js/dashboard.js:585-733](js/dashboard.js#L585-L733) |
| 22 | Dashboard | **Interlayer weight distribution** | Same `nBins = 15` linear binning | Distribution of interlayer weights, optionally filtered to a single layer pair via the heatmap selector. | [js/dashboard.js:585-733](js/dashboard.js#L585-L733) |
| 23 | Dashboard | **Interlayer link count heatmap** | Layer-pair counts of interlayer links | Click a cell to filter the interlayer weight histogram (#22) by that pair. | [js/dashboard.js:585-733](js/dashboard.js#L585-L733) |

---

## Aggregation / projection

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 24 | Meta-Network | **Edge weight (union mode)** | `w_meta(u, v) = 1` whenever ≥1 layer has edge `(u, v)` | Treats the meta-graph as a simple unweighted union across layers. | [js/metaNetwork.js:170-183](js/metaNetwork.js#L170-L183) |
| 25 | Meta-Network | **Edge weight (sumOccurrence)** | `w_meta(u, v) = |{ ℓ : (u, v) ∈ E(ℓ) }|` | Counts in how many layers the edge appears. | [js/metaNetwork.js:170-183](js/metaNetwork.js#L170-L183) |
| 26 | Meta-Network | **Edge weight (sumWeights)** | `w_meta(u, v) = Σ_ℓ w_ℓ(u, v)` | Sums layer-specific weights of the same edge. | [js/metaNetwork.js:137-183](js/metaNetwork.js#L137-L183) |
| 27 | Meta-Network | **Edge canonicalisation** | Directed: keep `(a, b)` as listed. Undirected: sort `(a, b)` so `min, max` is the canonical key | Prevents `(A, B)` and `(B, A)` from being counted as two distinct meta-edges. | [js/metaNetwork.js:147-149](js/metaNetwork.js#L147-L149) |
| 28 | Meta-Network | **Per-layer edge contribution** | For each meta-edge: list of `(layerName, weight)` it appears in | Used in tooltips and per-edge breakdown display. | [js/metaNetwork.js:152-178](js/metaNetwork.js#L152-L178) |
| 29 | Meta-Network — Bipartite | **Set assignment** | `node ∈ Set A` iff it belongs to set A in any bipartite layer; conflicts (in both A and B) are resolved by removing it from B | Lets the meta-network adopt a single bipartite typing across the whole network. | [js/metaNetwork.js:114-123](js/metaNetwork.js#L114-L123) |

---

## Layout-time computations (used by Network / Layer / Grid)

| # | Mode / Section | Property | Formula | Description | File |
|---|---|---|---|---|---|
| 30 | Layout — Kamada-Kawai | **Pairwise graph distance** | Floyd-Warshall (or graphology-shortest-path) all-pairs shortest path on intralayer adjacency | Distances feed the spring energy minimisation of Kamada-Kawai layout. | [js/layout.js:237-251](js/layout.js#L237-L251) |
| 31 | Layout — Bipartite (nested) | **Hub-first ordering** | Sort each row of the bipartite layout by `degree` descending | When `bipartiteNested = true`, hubs are placed at one end so dense bipartite networks reveal nested structure. | [js/layout.js:422-460](js/layout.js#L422-L460) |
| 32 | Layout — Force (Layer Mode) | **d3-force simulation** | Standard `forceLink + forceManyBody + forceCenter` + bipartite x/y biases (`strength=0.02` x, `strength=0` y in bipartite mode) | Per-layer 2D force-directed layout used in Layer View and Meta-Network. | [js/metaNetwork.js:300-305](js/metaNetwork.js#L300-L305) |

---

## Notes on conventions

- **Edge deduplication.** Throughout the dashboard, intralayer edges are deduplicated by sort-pair key (undirected) or `from→to` key (directed) before any density / count / Jaccard computation. Self-loops are kept in the count but counted once for degree/strength.
- **Weight default.** When `weight` is missing or `undefined` on a link, MiRA uses `w = 1`. A weight of `0` is treated as "no edge" and the link is dropped at parse time (see [js/dataParser.js:96-101](js/dataParser.js#L96-L101)).
- **Auto-detection of bipartite.** Bipartite metrics are only emitted when a layer is **explicitly declared** bipartite (`layer.bipartite = true` and a `node_type` attribute with exactly two distinct values). See [CLAUDE.md](../CLAUDE.md#bipartite-support) for the full rule.

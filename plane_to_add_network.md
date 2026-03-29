# context 
in this project we allow pepole to use they own data to visulaize mulylayrs networks, but we want to to be also also able to look on some network without doing it it will be usefull from 3 reason
1. allow pepole to decide if this tool is relvant before tehy they data 
2. help pepole understand the tool
3. make it usefull also as eductnal tool to leanr on common networks 

## plane 
1. read some importent paper and decide on the elemnt that it imprtent to include in the network example 
2. add feature allowing catgory of exmples 
3. add from the emln, this will be the simplest but it require chooing
4. add network from diffrent sources 


## how to choose
Here’s the revised version of your list, keeping the main categories intact but with different subcategories:

## How to Choose

### Types of Networks

The map should represent the variety of multilayer networks that exist in ecology. We need to consider the different ways networks can vary:

* **Aspects of Layering:** The management of different layers can be based on:

  * Temporal variations (changes over time)
  * Spatial distribution (across different locations or habitats)
  * Interaction type (e.g., trophic, mutualistic, competitive interactions)
  * Ecological scale (individual species, populations, communities)
  * Multi-aspect layers (integrating multiple factors like time, space, and interaction types simultaneously)
  * Disciplinary context (e.g., integrating social networks or genetic data as additional layers alongside ecological layers)

* **Nature of Interlayer Links:** These define the relationships between layers and could include:

  * Shared nodes across layers (same species or entities across multiple layers)
  * Interactions between nodes from different layers (e.g., species interactions that span across ecological and social layers)

* **Monolayer Network Types:** The base type of ecological networks to be considered:

  * Food webs (representing predator-prey relationships)
  * Pollination networks (plant-pollinator interactions)
  * Parasitism networks (host-parasite relationships)

* **Purpose for Network Creation:** Networks may be analyzed with different goals in mind:

  * Modularity (identifying communities or clusters within the network)
  * Stability (assessing the robustness or resilience of the system)


### source 
- choose networks that appear in classic papers 
### fetures of the app


## emln options
| Category | Example Dataset ID | Source (Paper / Origin) | Description | Multilayer Type | Useful Notes |
|----------|------------------|------------------------|-------------|-----------------|-------------|
| Temporal Pollination | emln_65 | Long-term pollination studies (e.g., Olesen et al.) | Plant–pollinator interactions across multiple years | Temporal | ⭐ Best first demo; intuitive + clean bipartite structure |
| Temporal Food Webs | Various IDs | Field-based trophic studies | Predator–prey interactions evolving over time | Temporal | Good for animation / time slider UI |
| Spatial Food Webs | Various IDs | Multi-location ecological surveys | Same food web across different geographic patches | Spatial | ⭐ Ideal for showing interlayer node alignment |
| Spatial Pollination | Various IDs | Multi-site pollination datasets | Plant–pollinator networks across locations | Spatial | Good for comparing community structure |
| Environmental Host–Parasite | emln7_environment_rejmanek_stary_1979 | Rejmanek & Stary (1979) | Host–parasite interactions under different environmental conditions | Environment | Heterogeneous nodes; great for bipartite + multilayer |
| Environmental Pollination | Various IDs | Environmental gradient studies | Pollination networks under varying conditions (climate, altitude, etc.) | Environment | Useful for filtering by layer metadata |
| Seed Dispersal Networks | Various IDs | Frugivory ecology studies | Animals dispersing plant seeds | Spatial / Temporal | Smaller datasets; ideal for testing layouts |
| Plant–Herbivore Networks | Various IDs | Herbivory interaction studies | Insects feeding on plants | Temporal / Spatial | Simple structure; good for debugging |
| Host–Parasite Networks (General) | Various IDs | Parasite ecology literature | Interactions between hosts and parasites | Mixed (Env / Temporal) | Bipartite + multilayer combination |
| Multiplex Ecological Networks | ~4 datasets | Mixed interaction studies | Same species with multiple interaction types (e.g., trophic + mutualistic) | Multiplex | ⭐ Rare + most important for multilayer theory |
| Perturbation Networks | ~4 datasets | Disturbance / invasion studies | Ecosystem before vs after perturbation | Perturbation | ⭐ Best for storytelling & comparison views |
| Multiple Interaction Networks | ~2 datasets | Mixed ecological systems | Networks combining several interaction types | Multiplex-like | Advanced use cases |
| Anemone–Fish Network | 1 dataset | Marine ecology study | Fish–anemone mutualistic interactions | Likely Spatial / Temporal | Unique niche dataset |



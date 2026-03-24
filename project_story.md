# Project Goals

Create an easy-to-use multilayer network visualization tool focused on the needs of ecologists.

## Features

- Load networks from JSON or CSV
- Visualize multilayer networks as stacked 3D objects with oblique projection
- Multiple layout algorithms (Fruchterman-Reingold, Kamada-Kawai, bipartite, circle, grid)
- Explore network, node, link, and layer properties via info panels
- Color and size nodes/links by any attribute (continuous or categorical)
- Geographic view — layers anchored to real-world coordinates on a Leaflet map
- Layer View — meta-graph mode where each layer becomes a force-directed bubble with a micro-graph preview inside; supports side-by-side layer comparison
- Dashboard mode — analytics panel with KPI cards, per-layer bar charts, Node × Layer presence matrix, Jaccard similarity heatmaps, degree distribution histograms, and bipartite set-size ratio charts
- Bipartite network support with automatic detection via BFS 2-coloring
- Comfortable, glassmorphism-styled UI
- Deployable from GitHub Pages with no backend

---

# Project History

This project began with my PI, who developed it in exploration mode — trying to see what was possible. I am now taking it toward a finished, maintainable state. The fact that I did not start it means I do not always know the reason behind specific decisions; nevertheless, many of the architectural choices clearly reflect the fast development mode he was in, and those are what need to change. To account for this situation I will start with major refactoring without changing behavior.

---

## What Is Already Done

The project runs and can be deployed from GitHub Pages. Most features work:

- Loading networks from JSON
- Loading networks from CSV
- Visualizing multilayer networks as 3D stacked objects
- Multiple layout algorithms for network visualization
- Exploring network, node, link, and layer properties
- Interlayer link view
- Geographic (map) view
- Layer View meta-graph with bubble force layout
- Dashboard analytics panel
- Comfortable UI

## What Still Needs to Be Done

While the project runs, there is still work to do because it was developed in exploration mode.

### Phase 1 — Refactoring (no behavior changes)

**1. Tests**
Before effectively working on the project we need a clear test system to ensure that no code change breaks existing behavior. Since I work with Claude Code, this test system should be fully automatic. We will try Vitest first; if it proves unsuitable we will move to another framework.

**2. Replace self-implementations with libraries**
Much of the code is built on hand-rolled implementations of things that stable libraries already solve. These increase complexity, reduce readability, and invite future bugs. The following functionality should be replaced:

| Functionality | File | Candidate library | done?
|---|---|---|----|
| CSV parsing | `csvImporter.js` | PapaParse | V| 
| Zoom / pan | `interaction.js` | panzoom | V with kanova and not panzoom| 
| Layout algorithms (FR, KK, circle, grid) | `layout.js` | d3-force + graphology-layout | V maybe required more work|
| Canvas rendering infrastructure | `renderer.js` | Konva.js |V|
| Network statistics (degree, density, Jaccard) | `dataParser.js`, `dashboard.js` |  graphology-metrics |
| Bipartite detection | `dataParser.js` | graphology-bipartite |
| Color scales | `colorMapper.js` | chroma.js | V |
| SVG chart generation | `dashboard.js` | Observable Plot |
| Bubble force layout (Layer View) | `layerView.js` | d3-force |
| Tooltips | `app.js`, `interaction.js` | Floating UI |
| Shortest-path distances (Kamada-Kawai) | `layout.js` | graphology-shortest-path | V |
| Number formatting | `dashboard.js` | d3-format | V |

**3. Make the code readable**
See the philosophy section for specific rules.

### Phase 2 — New Features (after refactoring is stable)

1. Diversify data loaders to match common ecological dataset formats
2. Add adjacency matrix view for networks
3. some way for short infoarmaion saving between refresh 
4. Other features as they emerge from real usage

### Phase 3 — Real-world validation

"Manual testing" — run the tool against many real ecological datasets and fix problems that arise.

---

# Project Philosophy

## Easy to Deploy

None of the people working on this project are web developers. Deployment must remain simple: GitHub Pages, no backend, no complex dependencies. All external libraries must be loadable from a CDN with a single `<script>` tag.

## Easy to Maintain

Problems will likely arise as people start using the project on their own datasets. When they do, they may not be easy to solve because I might be busy with other work. Furthermore, as people use the tool they will identify new useful features. Being able to fix bugs and add features quickly will determine how much value this project delivers.

To achieve this:

### Use libraries
Complex self-implementations increase code complexity, reduce readability, and invite future bugs. See the replacement list in the "What Still Needs to Be Done" section above.

### No deep nesting or magic numbers
Deep nesting decreases readability and makes debugging challenging. Any code nested more than two levels deep should be extracted into a function with a meaningful name, making the calling function read like pseudocode. Magic numbers must be replaced with named constants.

### Modularity
Each function should do exactly one thing.

### Baby steps
Since the code already runs, we must not break it. Each step will address one issue at a time. If a step becomes too complex, revert it and write an attempt-summary `.md` file describing what was tried and why it failed. Every step ends with a commit so we can always revert cleanly.

## Easy to Use

To make an app that ecology scientists will actually use, it must be easy and intuitive.

### Diverse loading formats
Allow users to upload data in common ecological formats. Reduce the need to reformat data. Make the code insensitive to edge cases so a user is never blocked by a quirk in their own dataset.

### Minimal features
This is planned to be a relatively simple app with only necessary features. Avoid scope creep.

---

# AI–Human Collaboration Workflow

Based on the code my PI gave me and my own experience, I have found challenges in working with agentic AI — mainly its tendency to produce large amounts of code that are hard to debug. To address this we follow a clear workflow:

1. I define the task.
2. If the task is unclear, Claude asks clarifying questions before proceeding.
3. Claude presents a plan.
4. I review, adjust, and approve the plan.
5. Claude attempts the solution. If it is not working within ~10 minutes, or requires extremely long code (hundreds of lines), Claude stops, reverts to the previous state, and writes an attempt-summary file.
6. Based on the summary we discuss the next option and make a decision together.

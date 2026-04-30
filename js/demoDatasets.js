/**
 * demoDatasets.js — Built-in example datasets: metadata, dialog wiring, loader.
 *
 * Owns the "Load Example" UI subsystem in its entirety:
 *   - The DATASET_INFO metadata table (name, citations, DOIs, attribute lists).
 *   - The two-view dialog (list view + per-dataset info view) and its buttons.
 *   - Building the rows in the list view.
 *   - Fetching the JSON file and handing it off to loadData().
 *
 * Exports:
 *   - DATASET_INFO          — read-only metadata (exported for completeness)
 *   - initDemoDatasets(loadData)
 *                           — wires every listener and builds the list. Call
 *                             once during app init, passing the loadData
 *                             function from app.js as the JSON handler.
 */

export const DATASET_INFO = {
    vitali2024: {
        name: 'Canary Islands pollination network',
        citation: 'Vitali et al. 2024',
        doi: 'https://doi.org/10.1111/1365-2656.14174',
        dataDoi: 'https://doi.org/10.5061/dryad.76173',
        layers: '5 layers — Fuerteventura, Gran Canaria, Tenerife, Gomera, Hierro',
        nodes: '235 species (34 plants · 201 pollinators)',
        links: '651 intralayer (plant–pollinator visits) + 154 interlayer (Jaccard similarity of interaction partners)',
        network: 'Undirected · bipartite per layer · GPS coordinates (map mode)',
        nodeAttrs: ['node_type (plant / pollinator)', 'module (1–33, Infomap)'],
        linkAttrs: ['weight'],
    },
    kefi2016: {
        name: 'Chilean intertidal food web',
        citation: 'Kéfi et al. 2016',
        doi: 'https://doi.org/10.1371/journal.pbio.1002527',
        dataDoi: 'https://doi.org/10.5061/dryad.b4vg0',
        layers: '3 layers — Trophic, NTI positive, NTI negative',
        nodes: '106 species',
        links: '4,623 directed interactions (predation or non-trophic facilitation/competition per layer)',
        network: 'Directed',
        nodeAttrs: ['body_mass', 'mobility (sessile / mobile)', 'functional_role',
                    'phylum', 'cluster (1–14)', 'functional_group (5 groups)', 'shore_height'],
        linkAttrs: ['weight', 'type (trophic / non-trophic+ / non-trophic−)'],
    },
    pilosof2017: {
        name: 'Siberian host–parasite network',
        citation: 'Pilosof et al. 2017',
        doi: 'https://doi.org/10.1038/s41559-017-0101',
        dataDoi: 'https://doi.org/10.1111/j.1600-0706.2009.17902.x',
        dataLabel: 'Original data (Krasnov et al. 2009):',
        layers: '6 temporal layers — 1982–1987',
        nodes: '78 species (22 hosts · 56 parasites)',
        links: '1,817 intralayer (host–parasite interactions) + 284 directed interlayer (species persistence year → year+1)',
        network: 'Undirected intralayer · directed interlayer · bipartite per layer',
        nodeAttrs: ['node_type (host / parasite)', 'abundance', 'module (1–7, Infomap)'],
        linkAttrs: ['weight'],
    },
    magrach2020: {
        name: 'Basque Country spatial pollination network',
        citation: 'Magrach et al. (EuPPollNet)',
        doi: 'https://doi.org/10.1111/geb.70000',
        dataDoi: 'https://github.com/JoseBSL/EuPPollNet',
        layers: '5 layers — grassland sites, Orozko, Basque Country (Spain)',
        nodes: '137 species (45 plants · 92 pollinators)',
        links: '376 intralayer (plant–pollinator visits) + 142 interlayer (Jaccard similarity of interaction partners)',
        network: 'Undirected · bipartite per layer · GPS coordinates (map mode)',
        nodeAttrs: ['node_type (plant / pollinator)'],
        linkAttrs: ['weight'],
    },
    costa2020: {
        name: 'Portuguese temporal seed dispersal network',
        citation: 'Costa et al. 2020',
        doi: 'https://doi.org/10.1111/1365-2745.13391',
        dataDoi: 'https://doi.org/10.6084/m9.figshare.11985912',
        layers: '5 layers — 2012–2016 (annual)',
        nodes: '29 species (17 plants · 12 birds)',
        links: '170 intralayer (seed dispersal interactions) + 43 directed interlayer (species persistence year → year+1)',
        network: 'Undirected intralayer · directed interlayer · bipartite per layer',
        nodeAttrs: ['node_type (plant / bird)', 'group (resident / partial-migratory)', 'versatility', 'degree', 'strength', 'd_specialisation', 'n_years'],
        linkAttrs: ['weight (seed count)'],
    },
    // ---- Benchmark / stress-test datasets ----
    celegans2006: {
        name: 'C. elegans neuronal connectome',
        citation: 'Chen, Hall & Chklovskii 2006',
        doi: 'https://doi.org/10.1073/pnas.0506806103',
        dataDoi: 'https://figshare.com/articles/dataset/CElegans_Multiplex_Neuronal_zip/21294858',
        dataLabel: 'Data (De Domenico et al. 2015):',
        layers: '3 layers — ElectrJ (electrical gap junctions), MonoSyn (chemical monadic), PolySyn (chemical polyadic)',
        nodes: '279 neurons (same neurons across all layers)',
        links: '5,863 directed intralayer (synaptic or gap-junction connections between neurons)',
        network: 'Directed · multiplex (same node vocabulary across all layers) · benchmark dataset',
        nodeAttrs: ['(none — neurons identified by name only)'],
        linkAttrs: ['weight (binary)'],
    },
    shapiro2023_plasmids: {
        name: 'Plasmid genetic-similarity network in dairy cows',
        citation: 'Shapiro et al. 2023',
        doi: 'https://doi.org/10.1038/s41396-023-01373-5',
        dataDoi: 'https://github.com/Ecological-Complexity-Lab/Plasmid_multilayer_networks',
        layers: '21 layers — individual dairy cows (Israeli Holstein population, single farm)',
        nodes: '1,344 unique plasmids · 1,514 state nodes (rumen plasmidome)',
        links: '102 intralayer + 2,636 interlayer (genetic similarity ≥ 0.16)',
        network: 'Undirected · multiplex · genetic-similarity network · benchmark for super-spreader / AMR analysis',
        nodeAttrs: ['length_bp', 'amr_class (beta-lactam / tetracycline / penicillin-binding / none)', 'has_mob (mobility / relaxase)', 'n_cows'],
        linkAttrs: ['weight (genetic similarity)', 'align_length (bp of alignment overlap)', 'pident (%)', 'mechanism (pHGT / distant_dispersal / recent_dispersal)'],
    },
    diseasome_multiplex: {
        name: 'Human disease multiplex network',
        citation: 'Halu et al. 2019',
        doi: 'https://doi.org/10.1038/s41540-019-0092-5',
        dataDoi: 'https://github.com/manlius/MultiplexDiseasome',
        layers: '2 layers — Genotype (shared disease genes), Phenotype (shared clinical symptoms)',
        nodes: '478 diseases (across both layers)',
        links: '2,098 intralayer (diseases sharing genes or symptoms, per layer) + 199 interlayer (artificial diagonal coupling — same disease across both layers)',
        network: 'Undirected · multiplex · built from OMIM + GWAS data',
        nodeAttrs: ['n_genes (genotype layer)', 'n_symptoms (phenotype layer)'],
        linkAttrs: ['weight (number of shared genes / symptoms)'],
    },
    ohmnet_6tissue: {
        hidden: true,
        name: 'Human tissue PPI — OhmNet ⚡ large',
        citation: 'Zitnik & Leskovec 2017',
        doi: 'https://doi.org/10.1093/bioinformatics/btx252',
        dataDoi: 'https://snap.stanford.edu/ohmnet/',
        layers: '6 layers — Brain, Blood, Kidney, Lung, Heart, Liver',
        nodes: '2,141 hub proteins (≥75 interactions in ≥1 tissue, present in ≥2 tissues)',
        links: '65,581 intralayer PPI edges',
        network: 'Undirected · multiplex · tissue-specific subset of STRING v10 · stress-test dataset',
        nodeAttrs: ['(none — proteins identified by Entrez gene ID)'],
        linkAttrs: ['weight (binary)'],
    },
};

/**
 * Wire the "Load Example" dialog and build the dataset list.
 *
 * @param {(json: object) => void} loadData  The JSON handler from app.js.
 *                                           Called with the fetched dataset JSON.
 */
export function initDemoDatasets(loadData) {
    const demoDialog         = document.getElementById('demoDialog');
    const openDemoDialogBtn  = document.getElementById('openDemoDialogBtn');
    const demoCancelBtn      = document.getElementById('demoCancelBtn');
    const demoListView       = document.getElementById('demoListView');
    const demoInfoView       = document.getElementById('demoInfoView');
    const demoBackBtn        = document.getElementById('demoBackBtn');
    const demoInfoLoadBtn    = document.getElementById('demoInfoLoadBtn');
    const demoDatasetList    = document.getElementById('demoDatasetList');

    // ---- Dialog open/close ----
    openDemoDialogBtn.addEventListener('click', () => {
        demoDialog.style.display = 'flex';
    });
    demoCancelBtn.addEventListener('click', () => {
        demoDialog.style.display = 'none';
    });
    demoDialog.addEventListener('click', (e) => {
        if (e.target === demoDialog) demoDialog.style.display = 'none';
    });

    // ---- Build one row (load button + info button) for a dataset ----
    function buildDatasetRow(file) {
        const info = DATASET_INFO[file];
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:6px;';

        const loadBtn = document.createElement('button');
        loadBtn.className = 'btn btn-primary';
        loadBtn.style.cssText = 'flex:1; text-align:left; padding:7px 10px; line-height:1.3;';
        loadBtn.innerHTML = `<span style="display:block; font-size:12px; font-weight:600;">${info.name}</span>
                             <span style="display:block; font-size:10px; opacity:0.7; font-weight:400;">${info.citation}</span>`;
        loadBtn.addEventListener('click', () => loadDemoFile(file));

        const infoBtn = document.createElement('button');
        infoBtn.className = 'btn demo-info-btn';
        infoBtn.style.cssText = 'flex-shrink:0; width:28px; height:28px; padding:0; font-size:13px;';
        infoBtn.textContent = 'ⓘ';
        infoBtn.title = 'More info';
        infoBtn.addEventListener('click', () => showDemoInfo(file));

        row.appendChild(loadBtn);
        row.appendChild(infoBtn);
        return row;
    }

    // ---- Render the info view for a specific dataset ----
    function showDemoInfo(file) {
        const info = DATASET_INFO[file];
        document.getElementById('demoInfoName').textContent = info.name;
        document.getElementById('demoInfoCitation').textContent = info.citation;

        const nodeAttrList = info.nodeAttrs.map(a => `<li>${a}</li>`).join('');
        const linkAttrList = info.linkAttrs.map(a => `<li>${a}</li>`).join('');
        const doiLink = `<a href="${info.doi}" target="_blank" rel="noopener" style="color:#5b6af0;">${info.doi}</a>`;
        const dataLabel = info.dataLabel || 'Data:';
        const dataDoiLine = info.dataDoi
            ? `<div><strong>${dataLabel}</strong> <a href="${info.dataDoi}" target="_blank" rel="noopener" style="color:#5b6af0;">${info.dataDoi}</a></div>`
            : `<div style="color:#aaa;"><strong>Data source:</strong> see paper</div>`;

        document.getElementById('demoInfoContent').innerHTML = `
            <div style="margin-bottom:8px;"><strong>Layers:</strong> ${info.layers}</div>
            <div style="margin-bottom:8px;"><strong>Nodes:</strong> ${info.nodes}</div>
            <div style="margin-bottom:8px;"><strong>Links:</strong> ${info.links}</div>
            <div style="margin-bottom:12px;"><strong>Network type:</strong> ${info.network}</div>
            <div style="margin-bottom:4px;"><strong>Node attributes:</strong></div>
            <ul style="margin:0 0 8px; padding-left:16px;">${nodeAttrList}</ul>
            <div style="margin-bottom:4px;"><strong>Link attributes:</strong></div>
            <ul style="margin:0 0 12px; padding-left:16px;">${linkAttrList}</ul>
            <div><strong>Paper:</strong> ${doiLink}</div>
            ${dataDoiLine}
        `;

        demoInfoLoadBtn.dataset.file = file;
        demoListView.style.display = 'none';
        demoInfoView.style.display = '';
    }

    demoBackBtn.addEventListener('click', () => {
        demoInfoView.style.display = 'none';
        demoListView.style.display = '';
    });

    demoInfoLoadBtn.addEventListener('click', () => {
        const file = demoInfoLoadBtn.dataset.file;
        loadDemoFile(file);
    });

    // ---- Fetch the JSON file and hand it off to loadData() ----
    async function loadDemoFile(file) {
        demoDialog.style.display = 'none';
        demoInfoView.style.display = 'none';
        demoListView.style.display = '';
        try {
            const resp = await fetch(`data/${file}.json`);
            if (!resp.ok) throw new Error('Failed to fetch demo data');
            const json = await resp.json();
            loadData(json);
        } catch (err) {
            console.error(err);
            alert('Failed to load demo data. Make sure to serve using a local server.');
        }
    }

    // ---- Build list view on load ----
    Object.keys(DATASET_INFO).forEach(file => {
        if (!DATASET_INFO[file].hidden) demoDatasetList.appendChild(buildDatasetRow(file));
    });
}

/**
 * csvImporter.test.js — Unit + integration tests for parseCsv() and csvToJson()
 *
 * This file tests the two exported functions from csvImporter.js:
 *
 *   parseCsv(text)
 *     Converts raw CSV/TSV text to an array of plain objects.
 *     Responsibilities: delimiter detection, quoted-field parsing, line-ending
 *     normalisation, blank-line skipping, whitespace trimming.
 *
 *   csvToJson(edgeListText, layersText, nodesText, options)
 *     Converts the three optional CSVs into the JSON shape expected by
 *     parseMultilayerData(). Responsibilities: column validation, layer/node
 *     auto-derivation, field normalisation (lat/lon casing, node_type → group),
 *     weight defaulting, state_node generation.
 *
 * TEST STRUCTURE
 * ──────────────
 *   Groups 1–3   parseCsv() in isolation (no csvToJson involved)
 *   Groups 4–7   csvToJson() in isolation (parseCsv is an internal detail)
 *   Groups 8–9   Integration: CSV text → csvToJson() → parseMultilayerData()
 *
 * FIXTURE FILES  (tests/fixtures/)
 *   edges_simple.csv        — 3 intralayer edges, Forest + Meadow layers, 2 nodes
 *   layers_simple.csv       — Forest + Meadow with lat/lon
 *   nodes_simple.csv        — Bee (pollinator) + Flower (plant) with group column
 *   edges_quoted_names.csv  — Layer and node names that contain commas inside quotes
 *   edges_extra_columns.csv — Extra "method" and "confidence" columns beyond the
 *                             required four, to verify they are forwarded to extended[]
 *
 * REAL DATA FILES  (multilayer_viz/data/)
 *   net22_extended.csv, net22_layers.csv, net22_nodes.csv
 *     — A 5-layer ecological food web (Nepenthes pitcher-plant networks).
 *     — net22_nodes.csv uses a "type" column (not "group") to test column renaming.
 *     — net22_layers.csv uses lowercase latitude/longitude (already normalised).
 *
 * COMMON REAL-WORLD CSV ERRORS COVERED
 *   CRLF line endings   — Windows Notepad / Excel default export (Group 3.1)
 *   BOM prefix          — Excel "UTF-8 with BOM" export (Group 3.2)
 *   Blank lines         — Common in hand-edited CSVs (Group 3.3)
 *   Quoted commas       — Species names like "Bumble bee, large" (Group 2.1 + 8.3)
 *   Escaped quotes      — Species names with quotation marks (Group 2.2)
 *   Missing weight col  — User forgets to name the column "weight" (Group 4.2)
 *   Empty weight value  — Row with no weight value (Group 6.4)
 *   Capitalised lat/lon — Some GIS exports use "Latitude" not "latitude" (Group 6.1)
 *   node_type / type    — Two common column names for bipartite node sets (Groups 6.2/6.3)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { parseCsv, csvToJson } from '../js/csvImporter.js'
import { parseMultilayerData } from '../js/dataParser.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR     = resolve(__dirname, '../data')
const FIXTURES_DIR = resolve(__dirname, 'fixtures')

const loadData    = (f) => readFileSync(resolve(DATA_DIR,     f), 'utf8')
const loadFixture = (f) => readFileSync(resolve(FIXTURES_DIR, f), 'utf8')


// ── Group 1 — Delimiter auto-detection ───────────────────────────────────────
// parseCsv picks the delimiter by counting occurrences in the header line.
// All three supported delimiters must be recognized.

describe('Group 1 — parseCsv: delimiter auto-detection', () => {
  it('1.1 detects comma delimiter', () => {
    const rows = parseCsv('a,b,c\n1,2,3')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('1.2 detects tab delimiter (TSV)', () => {
    const rows = parseCsv('a\tb\tc\n1\t2\t3')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('1.3 detects semicolon delimiter (European locale Excel export)', () => {
    const rows = parseCsv('a;b;c\n1;2;3')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })
})


// ── Group 2 — Quoted fields (RFC 4180) ───────────────────────────────────────
// Ecological datasets often have species names like "Bee, large" or layer names
// like "Forest, North" that contain commas. RFC 4180 uses double-quotes to
// protect fields that contain the delimiter or the quote character itself.

describe('Group 2 — parseCsv: quoted fields (RFC 4180)', () => {
  it('2.1 comma inside quoted field is not treated as a delimiter', () => {
    const rows = parseCsv('name,val\n"Smith, John",42')
    expect(rows[0].name).toBe('Smith, John')
    expect(rows[0].val).toBe('42')
  })

  it('2.2 doubled double-quote inside a quoted field becomes a single quote', () => {
    // RFC 4180: to include a literal " inside a quoted field, write ""
    const rows = parseCsv('name,val\n"say ""hi""",ok')
    expect(rows[0].name).toBe('say "hi"')
  })

  it('2.3 unquoted fields with surrounding whitespace are trimmed', () => {
    const rows = parseCsv('a,b\n  hello  ,  world  ')
    expect(rows[0].a).toBe('hello')
    expect(rows[0].b).toBe('world')
  })
})


// ── Group 3 — Robustness to common CSV errors ─────────────────────────────────
// These are the most frequent real-world CSV issues encountered when ecologists
// export data from Excel, R, or field-data apps.

describe('Group 3 — parseCsv: robustness to common CSV errors', () => {
  it('3.1 CRLF line endings (Windows Notepad / Excel default export)', () => {
    // Excel on Windows saves CSV with \r\n. parseCsv must normalise these
    // before splitting on \n, otherwise each value would have a trailing \r.
    const rows = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ a: '1', b: '2' })
    expect(rows[1]).toEqual({ a: '3', b: '4' })
  })

  it('3.2 BOM character at file start (Excel "UTF-8 with BOM" export)', () => {
    // Excel's "Save as UTF-8 CSV" option adds a U+FEFF byte-order mark.
    // If not stripped, the first column header becomes "\uFEFFa" and all
    // lookups on that column (e.g. edges[0]['a']) will silently return undefined.
    const rows = parseCsv('\uFEFFa,b\n1,2')
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0])[0]).toBe('a')   // BOM must not bleed into header
    expect(rows[0].a).toBe('1')
  })

  it('3.3 blank lines interspersed in data are silently skipped', () => {
    const rows = parseCsv('a,b\n1,2\n\n3,4\n')
    expect(rows).toHaveLength(2)
  })

  it('3.4 throws when file has only a header row and no data rows', () => {
    // A header-only CSV (exported before any data was collected) should produce
    // a clear error rather than returning an empty array that silently crashes later.
    expect(() => parseCsv('a,b,c')).toThrow()
  })
})


// ── Group 4 — csvToJson: validation errors ────────────────────────────────────
// The edge list has four required columns. Missing any one must throw with the
// column name in the error message so the user knows exactly what to fix.
// Missing "weight" is only a warning because unweighted networks are common.

describe('Group 4 — csvToJson: validation errors', () => {
  it('4.1 throws when a required edge column is missing, naming the column', () => {
    // Missing node_to — the error message must name it
    const csv = 'layer_from,node_from,layer_to\nL1,A,L1'
    expect(() => csvToJson(csv)).toThrow(/node_to/)
  })

  it('4.2 missing "weight" column produces a warning, not a throw', () => {
    // Unweighted edge lists are valid; the parser defaults all weights to 1.
    // But silently defaulting without telling the user could mask a naming mistake,
    // so a warning is returned.
    const csv = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const { warnings } = csvToJson(csv)
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toMatch(/weight/)
  })

  it('4.3 throws when layers CSV is missing the "layer_name" column', () => {
    const edges  = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const layers = 'id,location\n1,Forest'
    expect(() => csvToJson(edges, layers)).toThrow(/layer_name/)
  })

  it('4.4 throws when nodes CSV is missing the "node_name" column', () => {
    const edges = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const nodes = 'id,type\n1,plant'
    expect(() => csvToJson(edges, null, nodes)).toThrow(/node_name/)
  })
})


// ── Group 5 — csvToJson: auto-derivation of layers and nodes ─────────────────
// When the optional layers or nodes CSVs are omitted, csvToJson derives them
// from the edge list. This is the most common usage for simple datasets.
// An infoMessage is returned in both cases so the UI can inform the user.

describe('Group 5 — csvToJson: auto-derivation of layers and nodes', () => {
  it('5.1 layers are derived from edge list when no layers CSV is supplied', () => {
    const edges = 'layer_from,node_from,layer_to,node_to\nForest,Bee,Meadow,Bee'
    const { json, infoMessages } = csvToJson(edges)
    expect(json.layers).toHaveLength(2)
    expect(infoMessages.some(m => m.includes('Layers derived'))).toBe(true)
  })

  it('5.2 nodes are derived from edge list when no nodes CSV is supplied', () => {
    // 3 unique node names: A, B, C
    const edges = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B\nL1,C,L1,A'
    const { json, infoMessages } = csvToJson(edges)
    expect(json.nodes).toHaveLength(3)
    expect(infoMessages.some(m => m.includes('Nodes derived'))).toBe(true)
  })

  it('5.3 throws when a layer name in edges is absent from the provided layers CSV', () => {
    // If the user supplies a layers CSV but accidentally omits a layer that appears
    // in the edge list, the error must name the unknown layer.
    const edges  = 'layer_from,node_from,layer_to,node_to\nUnknown,A,L1,B'
    const layers = 'layer_name\nL1'
    expect(() => csvToJson(edges, layers)).toThrow(/Unknown/)
  })
})


// ── Group 6 — csvToJson: field normalisation ─────────────────────────────────
// Different export tools use different capitalisation and column names.
// csvToJson normalises these so downstream code only needs to handle one form.

describe('Group 6 — csvToJson: field normalisation', () => {
  it('6.1 "Latitude"/"Longitude" (any capitalisation) are normalised to lowercase', () => {
    // Some GIS tools export with capital first letter. The renderer expects lowercase.
    const edges  = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const layers = 'layer_name,Latitude,Longitude\nL1,48.5,2.3'
    const { json } = csvToJson(edges, layers)
    expect(json.layers[0]).toHaveProperty('latitude',  48.5)
    expect(json.layers[0]).toHaveProperty('longitude', 2.3)
    expect(json.layers[0]).not.toHaveProperty('Latitude')
  })

  it('6.2 "node_type" column is preserved as node_type', () => {
    // "node_type" is preserved as-is; it is not renamed to "group".
    const edges = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const nodes = 'node_name,node_type\nA,plant\nB,pollinator'
    const { json } = csvToJson(edges, null, nodes)
    expect(json.nodes[0]).toHaveProperty('node_type')
    expect(json.nodes[0]).not.toHaveProperty('group')
  })

  it('6.3 "type" column in nodes CSV is renamed to "node_type"', () => {
    // Some datasets (including net22_nodes.csv) use bare "type" — it is renamed to node_type.
    const edges = 'layer_from,node_from,layer_to,node_to\nL1,A,L1,B'
    const nodes = 'node_name,type\nA,plant\nB,pollinator'
    const { json } = csvToJson(edges, null, nodes)
    expect(json.nodes[0].node_type).toBe('plant')
    expect(json.nodes[0]).not.toHaveProperty('type')
  })

  it('6.4 empty weight field defaults to 1 (not NaN or 0)', () => {
    // A trailing comma on the last column is a frequent hand-editing mistake.
    const edges = 'layer_from,node_from,layer_to,node_to,weight\nL1,A,L1,B,'
    const { json } = csvToJson(edges)
    expect(json.extended[0].weight).toBe(1)
  })
})


// ── Group 7 — csvToJson: output shape ────────────────────────────────────────
// Verifies the structure of the returned json object so that parseMultilayerData
// receives exactly the shape it expects.

describe('Group 7 — csvToJson: output shape', () => {
  // Two-edge network spanning two layers — enough to test all structural properties.
  const EDGES = 'layer_from,node_from,layer_to,node_to,weight\nL1,A,L1,B,2\nL1,B,L2,B,1'

  it('7.1 { directed: true } option sets json.directed = true', () => {
    const { json } = csvToJson(EDGES, null, null, { directed: true })
    expect(json.directed).toBe(true)
  })

  it('7.2 { bipartite: true } option is accepted without error (bipartite is set per-layer via CSV)', () => {
    // The bipartite option is not implemented at the root json level — bipartite is
    // declared per-layer in the layers CSV (bipartite column). This option is silently ignored.
    const { json } = csvToJson(EDGES, null, null, { bipartite: true })
    expect(json.bipartite).toBeUndefined()
    expect(json.directed).toBe(false)
  })

  it('7.3 extra columns in edge list are preserved in extended[] entries', () => {
    const edges = 'layer_from,node_from,layer_to,node_to,weight,method\nL1,A,L1,B,1,observation'
    const { json } = csvToJson(edges)
    expect(json.extended[0]).toHaveProperty('method', 'observation')
  })

  it('7.4 every state_node has layer_id, node_id, layer_name, node_name', () => {
    const { json } = csvToJson(EDGES)
    for (const sn of json.state_nodes) {
      expect(sn).toHaveProperty('layer_id')
      expect(sn).toHaveProperty('node_id')
      expect(sn).toHaveProperty('layer_name')
      expect(sn).toHaveProperty('node_name')
    }
  })

  it('7.5 state_nodes has exactly one entry per unique (layer, node) pair', () => {
    // EDGES: L1::A, L1::B, L2::B → 3 distinct pairs
    const { json } = csvToJson(EDGES)
    expect(json.state_nodes).toHaveLength(3)
  })
})


// ── Group 8 — Integration: toy fixture CSVs → parseMultilayerData() ──────────
// End-to-end tests that run the full CSV pipeline through parseMultilayerData.
// Uses the small fixture files in tests/fixtures/ rather than real data,
// so assertions on exact counts are safe without fragility.

describe('Group 8 — Integration: toy CSV fixtures → parseMultilayerData()', () => {
  it('8.1 edge-list only produces a valid model without throwing', () => {
    const { json } = csvToJson(loadFixture('edges_simple.csv'))
    expect(() => parseMultilayerData(json)).not.toThrow()
  })

  it('8.2 edges + layers + nodes: correct layer and node counts', () => {
    const { json } = csvToJson(
      loadFixture('edges_simple.csv'),
      loadFixture('layers_simple.csv'),
      loadFixture('nodes_simple.csv'),
    )
    const model = parseMultilayerData(json)
    expect(model.layers).toHaveLength(2)  // Forest, Meadow
    expect(model.nodes).toHaveLength(2)   // Bee, Flower
  })

  it('8.3 species names with embedded commas survive the full pipeline', () => {
    // "Bumble bee, large" and "Wild flower, red" must not be split at the comma.
    // This is the most common formatting error when ecologists copy species names
    // from taxonomic databases into a plain CSV without quoting.
    const { json } = csvToJson(loadFixture('edges_quoted_names.csv'))
    const model = parseMultilayerData(json)
    const names = model.nodes.map(n => n.node_name)
    expect(names.some(n => n.includes(','))).toBe(true)
  })

  it('8.4 extra edge columns appear in model.linkAttributeNames', () => {
    // Extra columns are forwarded through extended[] and must be discoverable
    // by the colour/size dropdowns, which read linkAttributeNames.
    const { json } = csvToJson(loadFixture('edges_extra_columns.csv'))
    const model = parseMultilayerData(json)
    expect(model.linkAttributeNames).toContain('method')
  })
})


// ── Group 9 — Integration: real net22 ecological dataset ─────────────────────
// net22 is a 5-layer food web of pitcher-plant (Nepenthes) communities.
// These tests verify the parser works on a realistic dataset with extra columns,
// mixed data types, and the "type" column that must be renamed to "group".
//
// net22_nodes.csv uses "type" (not "group" or "node_type") — Group 6.3 covers
// this path on toy data; here we confirm it works end-to-end on real data.

describe('Group 9 — Integration: real net22 ecological dataset', () => {
  let model
  beforeAll(() => {
    const { json } = csvToJson(
      loadData('net22_extended.csv'),
      loadData('net22_layers.csv'),
      loadData('net22_nodes.csv'),
    )
    model = parseMultilayerData(json)
  })

  it('9.1 all three net22 CSVs load without throwing', () => {
    expect(model).toBeDefined()
  })

  it('9.2 net22 has exactly 5 layers', () => {
    expect(model.layers).toHaveLength(5)
  })

  it('9.3 "type" column from net22_nodes.csv is normalised to "node_type" in model', () => {
    // The "type" column is renamed to "node_type" by csvToJson.
    // If the renaming fails, nodeAttributeNames would contain "type" (the raw name).
    expect(model.nodeAttributeNames).toContain('node_type')
  })

  it('9.4 edge-list only (no layers/nodes CSVs) also produces a valid net22 model', () => {
    // Users often only have the edge list. Verify that auto-derivation works on
    // a large real-world file, not just toy examples.
    const { json } = csvToJson(loadData('net22_extended.csv'))
    expect(() => parseMultilayerData(json)).not.toThrow()
  })
})

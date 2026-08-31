// Vitest global setup — runs before every test file.
// Makes CDN libraries available as globals, matching their browser script-tag behavior.
import Papa from 'papaparse'
import * as d3force from 'd3-force'
import * as d3format from 'd3-format'
import chroma from 'chroma-js'
import * as graphology from 'graphology'
import * as graphologyShortestPath from 'graphology-shortest-path'

globalThis.Papa = Papa
globalThis.d3   = { ...d3force, ...d3format }
globalThis.chroma = chroma
globalThis.graphology = graphology
globalThis.graphologyShortestPath = graphologyShortestPath

/**
 * colorMapper.test.js — Unit tests for ColorMapper
 *
 * ColorMapper has two concerns:
 *
 *   1. Fixed color getters — simple methods that return hardcoded palette values
 *      used by the renderer for layers and bipartite nodes.
 *
 *   2. buildColorScale(items, attrName, forceType)
 *      Auto-detects whether an attribute is numeric or categorical and returns
 *      a { type, scaleFn, ... } descriptor. scaleFn(value) → CSS color string.
 *
 * The auto-detection logic is the most complex part and has known edge cases
 * around NaN, the 2-unique-value boundary, and silent forceType fallback.
 *
 * TEST STRUCTURE
 * ──────────────
 *   Group 1  Fixed color getters
 *   Group 2  Auto-detection → categorical
 *   Group 3  Auto-detection → continuous
 *   Group 4  Edge cases / suspected bugs
 *   Group 5  scaleFn behavior
 *   Group 6  Return object shape
 *
 * KEY DESIGN NOTE — the "> 2 unique values" threshold
 * ─────────────────────────────────────────────────────
 * The auto-detection treats numeric data as continuous only when EITHER:
 *   • there are more than 2 unique values, OR
 *   • the attribute name matches a keyword (weight, abundance, degree, …)
 *
 * This means a binary numeric attribute like { 0, 1 } on a generic column name
 * (e.g. "present") is treated as *categorical*, which may or may not be desired.
 * Tests 2.3 and 3.3 document this boundary precisely.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import chroma from 'chroma-js'
globalThis.chroma = chroma
import { ColorMapper, BIPARTITE_SET_A_COLOR, BIPARTITE_SET_B_COLOR } from '../js/colorMapper.js'

// Helper — build items array from a plain value list
const items = (attrName, values) => values.map(v => ({ [attrName]: v }))

// Grey fallback color used for missing / unknown values
const GREY = '#6b7280'


// ── Group 1 — Fixed color getters ────────────────────────────────────────────
// These are trivial getters but worth smoke-testing so a refactor that changes
// a constant doesn't silently break the renderer's layer styling.

describe('Group 1 — Fixed color getters', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('1.1 getLayerFill returns a non-empty string', () => {
    expect(typeof cm.getLayerFill()).toBe('string')
    expect(cm.getLayerFill().length).toBeGreaterThan(0)
  })

  it('1.2 getLayerBorder returns a non-empty string', () => {
    expect(typeof cm.getLayerBorder()).toBe('string')
    expect(cm.getLayerBorder().length).toBeGreaterThan(0)
  })

  it('1.3 getBipartiteNodeColor(true) and (false) return different colors', () => {
    // Set A (plants) and Set B (pollinators) must be visually distinct
    expect(cm.getBipartiteNodeColor(true)).toBe(BIPARTITE_SET_A_COLOR)
    expect(cm.getBipartiteNodeColor(false)).toBe(BIPARTITE_SET_B_COLOR)
    expect(BIPARTITE_SET_A_COLOR).not.toBe(BIPARTITE_SET_B_COLOR)
  })
})


// ── Group 2 — Auto-detection → categorical ───────────────────────────────────
// Cases where buildColorScale should choose the categorical path.

describe('Group 2 — Auto-detection: categorical', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('2.1 string values → categorical', () => {
    const result = cm.buildColorScale(items('group', ['plant', 'pollinator', 'fungus']), 'group')
    expect(result.type).toBe('categorical')
  })

  it('2.2 mixed string and number values → categorical', () => {
    // Cannot fit a gradient over mixed types — must fall back to categorical
    const result = cm.buildColorScale(items('score', [1, 'high', 3]), 'score')
    expect(result.type).toBe('categorical')
  })

  it('2.3 exactly 2 unique numeric values on a generic column name → categorical', () => {
    // The "> 2 unique values" threshold means binary numeric data (e.g. presence/absence
    // coded as 0/1) is treated as categorical when the column name is not a keyword.
    // This is intentional but worth documenting explicitly.
    const result = cm.buildColorScale(items('present', [0, 1, 0, 1]), 'present')
    expect(result.type).toBe('categorical')
  })

  it('2.4 boolean values → categorical (typeof boolean is not "number")', () => {
    // Booleans are not caught by the numeric check, so they must land in categorical
    const result = cm.buildColorScale(items('active', [true, false, true]), 'active')
    expect(result.type).toBe('categorical')
  })

  it('2.5 single unique string value → categorical', () => {
    const result = cm.buildColorScale(items('biome', ['forest', 'forest', 'forest']), 'biome')
    expect(result.type).toBe('categorical')
  })
})


// ── Group 3 — Auto-detection → continuous ────────────────────────────────────
// Cases where buildColorScale should choose the continuous (gradient) path.

describe('Group 3 — Auto-detection: continuous', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('3.1 more than 2 unique numeric values on a generic name → continuous', () => {
    const result = cm.buildColorScale(items('score', [1, 2, 3, 4]), 'score')
    expect(result.type).toBe('continuous')
  })

  it('3.2 numeric values stored as strings → treated as numeric → continuous', () => {
    // CSV parsing always produces strings; the mapper must accept string-encoded numbers
    const result = cm.buildColorScale(items('weight', ['0.5', '1.0', '1.5', '2.0']), 'weight')
    expect(result.type).toBe('continuous')
  })

  it('3.3 exactly 2 unique numeric values on a keyword name ("weight") → continuous', () => {
    // Keyword names override the "> 2 unique" threshold.
    // A weight column with only two distinct values (e.g. 1 and 2) should still be a gradient.
    const result = cm.buildColorScale(items('weight', [1, 2, 1, 2]), 'weight')
    expect(result.type).toBe('continuous')
  })

  it('3.4 all items have the same numeric value (range = 0) → continuous, no crash', () => {
    // When min === max the code uses `range = max - min || 1` to avoid division by zero.
    // All values should map to t=0 (the dark-purple end of the gradient).
    const result = cm.buildColorScale(items('weight', [1, 1, 1]), 'weight')
    expect(result.type).toBe('continuous')
    expect(() => result.scaleFn(1)).not.toThrow()
    expect(result.scaleFn(1)).toMatch(/^#[0-9a-f]{6}$/i)
  })
})


// ── Group 4 — Edge cases / suspected bugs ────────────────────────────────────
// These tests probe known weaknesses in the auto-detection logic.

describe('Group 4 — Edge cases and suspected bugs', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('4.1 NaN value — excluded from numeric check, array treated as categorical', () => {
    // NaN is not a valid number for gradient purposes. The fix adds !isNaN(v) to the
    // numeric check so a NaN value causes the whole array to be treated as categorical.
    const result = cm.buildColorScale(items('score', [1, NaN, 3]), 'score')
    expect(result.type).toBe('categorical')
    expect(() => result.scaleFn(NaN)).not.toThrow()
  })

  it('4.2 all values null/undefined → scaleFn returns grey for any input', () => {
    // All values are filtered out; values array is empty → allNumeric = false → categorical
    // with an empty colorMap. scaleFn should return grey rather than crash.
    const result = cm.buildColorScale(
      [{ score: null }, { score: undefined }],
      'score'
    )
    expect(result.scaleFn(null)).toBe(GREY)
    expect(result.scaleFn(undefined)).toBe(GREY)
    expect(result.scaleFn('anything')).toBe(GREY)
  })

  it('4.3 empty items array → does not throw, scaleFn returns grey', () => {
    expect(() => cm.buildColorScale([], 'score')).not.toThrow()
    const result = cm.buildColorScale([], 'score')
    expect(result.scaleFn(1)).toBe(GREY)
  })

  it('4.4 forceType="continuous" with non-numeric data falls back to categorical with a warning', () => {
    // When forceType='continuous' but data is not numeric, the fallback is now explicit:
    // result.type is categorical AND result.warnings contains a message naming the attribute.
    const result = cm.buildColorScale(items('group', ['plant', 'pollinator']), 'group', 'continuous')
    expect(result.type).toBe('categorical')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/group/)
  })

  it('4.5 forceType="categorical" with numeric data → overrides to categorical', () => {
    // This direction of forceType works correctly and should stay working
    const result = cm.buildColorScale(items('weight', [1, 2, 3, 4]), 'weight', 'categorical')
    expect(result.type).toBe('categorical')
  })
})


// ── Group 5 — scaleFn behavior ──────────────────────────────────────────────
// Verifies the returned scaleFn maps values to the correct colors.

describe('Group 5 — scaleFn behavior', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('5.1 continuous: min value maps to the dark-purple end of the gradient', () => {
    // Viridis t=0 → #440154 (chroma.js hex output)
    const { scaleFn, min } = cm.buildColorScale(items('w', [0, 5, 10]), 'w')
    expect(scaleFn(min)).toBe('#440154')
  })

  it('5.2 continuous: max value maps to the yellow end of the gradient', () => {
    // Viridis t=1 → #fee825 (chroma.js hex output)
    const { scaleFn, max } = cm.buildColorScale(items('w', [0, 5, 10]), 'w')
    expect(scaleFn(max)).toBe('#fee825')
  })

  it('5.3 continuous: null/undefined input → grey fallback', () => {
    const { scaleFn } = cm.buildColorScale(items('w', [1, 2, 3]), 'w')
    expect(scaleFn(null)).toBe(GREY)
    expect(scaleFn(undefined)).toBe(GREY)
  })

  it('5.4 categorical: known value → a palette color (not grey)', () => {
    const { scaleFn } = cm.buildColorScale(items('group', ['plant', 'pollinator']), 'group')
    const color = scaleFn('plant')
    expect(color).not.toBe(GREY)
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('5.5 categorical: unknown value → grey fallback', () => {
    const { scaleFn } = cm.buildColorScale(items('group', ['plant', 'pollinator']), 'group')
    expect(scaleFn('fungus')).toBe(GREY)
    expect(scaleFn(null)).toBe(GREY)
  })

  it('5.6 categorical: cycles through palette when there are more categories than palette size', () => {
    // ColorBrewer Dark2 has 8 colors; the 9th category wraps back to color index 0
    const manyGroups = Array.from({ length: 9 }, (_, i) => `group_${i}`)
    const { scaleFn, map } = cm.buildColorScale(items('g', manyGroups), 'g')
    expect(scaleFn('group_0')).toBe(scaleFn('group_8'))  // wraps to same color
    expect(map.size).toBe(9)
  })
})


// ── Group 6 — Return object shape ────────────────────────────────────────────
// Verifies that buildColorScale returns the exact descriptor shape that app.js
// and the renderer depend on.

describe('Group 6 — Return object shape', () => {
  let cm
  beforeEach(() => { cm = new ColorMapper() })

  it('6.1 continuous result has all required fields', () => {
    const result = cm.buildColorScale(items('w', [1, 2, 3, 4]), 'w')
    expect(result).toHaveProperty('type', 'continuous')
    expect(result).toHaveProperty('min')
    expect(result).toHaveProperty('max')
    expect(result).toHaveProperty('attrName', 'w')
    expect(result).toHaveProperty('scaleFn')
    expect(result).toHaveProperty('canToggle')
    expect(typeof result.scaleFn).toBe('function')
  })

  it('6.2 categorical result has all required fields', () => {
    const result = cm.buildColorScale(items('g', ['a', 'b']), 'g')
    expect(result).toHaveProperty('type', 'categorical')
    expect(result).toHaveProperty('map')
    expect(result).toHaveProperty('attrName', 'g')
    expect(result).toHaveProperty('scaleFn')
    expect(result).toHaveProperty('canToggle')
    expect(result.map).toBeInstanceOf(Map)
  })

  it('6.3 canToggle is true when data is numeric (even if rendered as categorical)', () => {
    // Binary numeric data → categorical rendering, but canToggle=true allows
    // the UI to offer a "switch to continuous" button
    const result = cm.buildColorScale(items('present', [0, 1, 0, 1]), 'present')
    expect(result.type).toBe('categorical')
    expect(result.canToggle).toBe(true)
  })

  it('6.4 canToggle is false for string-only data', () => {
    // Cannot render strings as a gradient, so toggle must be disabled
    const result = cm.buildColorScale(items('group', ['plant', 'pollinator']), 'group')
    expect(result.canToggle).toBe(false)
  })
})

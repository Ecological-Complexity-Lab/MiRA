/**
 * Named palettes (palettes.js) and their use in ColorMapper.buildColorScale:
 * palette, reversed colors and continuous limits (values outside take the
 * end colors). Without options the scales are MiRA's defaults, unchanged.
 */
import { describe, it, expect } from 'vitest'
import chroma from 'chroma-js'
globalThis.chroma = chroma
import {
  CATEGORICAL_PALETTES, CONTINUOUS_PALETTES, palettesFor, canonicalPalette, usedPalette, paletteColors,
} from '../js/palettes.js'
import { ColorMapper } from '../js/colorMapper.js'

const items = (attr, values) => values.map(v => ({ [attr]: v }))

describe('palettes', () => {
  it('every palette has colors', () => {
    for (const name of CATEGORICAL_PALETTES) expect(paletteColors('categorical', name).length, name).toBeGreaterThan(5)
    for (const name of CONTINUOUS_PALETTES) expect(paletteColors('continuous', name).length, name).toBeGreaterThan(2)
  })

  it('names match without case; unknown names are undefined', () => {
    expect(canonicalPalette('MAGMA')).toBe('magma')
    expect(canonicalPalette('okabe-ito')).toBe('Okabe-Ito')
    expect(canonicalPalette('Pastel1')).toBeUndefined() // not offered
    expect(canonicalPalette(3)).toBeUndefined()
  })

  it('a palette of the other type, or none, gives the default', () => {
    expect(usedPalette('continuous', 'Set1')).toBe('viridis')
    expect(usedPalette('categorical', 'magma')).toBe('Dark2')
    expect(usedPalette('categorical', null)).toBe('Dark2')
    expect(paletteColors('categorical', null)).toEqual(chroma.brewer.Dark2)
  })

  it('reversed colors', () => {
    expect(paletteColors('continuous', 'magma', true)).toEqual([...paletteColors('continuous', 'magma')].reverse())
  })

  it('the lists for each type', () => {
    expect(palettesFor('continuous')).toContain('RdBu')
    expect(palettesFor('categorical')).not.toContain('RdBu')
  })
})

describe('buildColorScale with a palette, reversal and limits', () => {
  const cm = new ColorMapper()
  const numbers = items('mass', [0, 5, 10])
  const categories = items('habitat', ['a', 'b', 'c'])

  it('without options: Viridis over the data and Dark2, as before', () => {
    const sc = cm.buildColorScale(numbers, 'mass')
    expect(sc.scaleFn(0)).toBe(chroma.scale('Viridis')(0).hex())
    expect(sc.scaleFn(10)).toBe(chroma.scale('Viridis')(1).hex())
    expect(sc.gradient).toBeUndefined() // the legend draws its Viridis bar
    expect(sc.palette).toBe('viridis')
    const cat = cm.buildColorScale(categories, 'habitat')
    expect([...cat.map.values()]).toEqual(chroma.brewer.Dark2.slice(0, 3))
    expect(cat.palette).toBe('Dark2')
  })

  it('a continuous palette, and its legend bar', () => {
    const sc = cm.buildColorScale(numbers, 'mass', null, null, { palette: 'magma' })
    expect(sc.scaleFn(0)).toBe('#000004')
    expect(sc.scaleFn(10)).toBe('#fcfdbf')
    expect(sc.palette).toBe('magma')
    expect(sc.gradient).toMatch(/^linear-gradient\(to right, #000004/)
  })

  it('reversed', () => {
    const sc = cm.buildColorScale(numbers, 'mass', null, null, { palette: 'magma', reverse: true })
    expect(sc.scaleFn(0)).toBe('#fcfdbf')
    expect(sc.reverse).toBe(true)
    const cat = cm.buildColorScale(categories, 'habitat', null, null, { reverse: true })
    expect(cat.map.get('a')).toBe([...chroma.brewer.Dark2].reverse()[0])
  })

  it('limits replace the data range; values outside take the end colors (squish)', () => {
    const sc = cm.buildColorScale(numbers, 'mass', null, null, { palette: 'magma', limits: [0, 20] })
    expect([sc.min, sc.max]).toEqual([0, 20])
    expect(sc.scaleFn(20)).toBe('#fcfdbf')
    expect(sc.scaleFn(10)).toBe(chroma.scale(paletteColors('continuous', 'magma'))(0.5).hex())
    const narrow = cm.buildColorScale(numbers, 'mass', null, null, { limits: [2, 8] })
    expect(narrow.scaleFn(0)).toBe(narrow.scaleFn(2))
    expect(narrow.scaleFn(10)).toBe(narrow.scaleFn(8))
  })

  it('a categorical palette', () => {
    const cat = cm.buildColorScale(categories, 'habitat', null, null, { palette: 'Okabe-Ito' })
    expect([...cat.map.values()]).toEqual(['#E69F00', '#56B4E9', '#009E73'])
  })

  it('a palette of the other type falls back to the default', () => {
    const sc = cm.buildColorScale(numbers, 'mass', null, null, { palette: 'Set1' })
    expect(sc.palette).toBe('viridis')
    expect(sc.scaleFn(0)).toBe(chroma.scale('Viridis')(0).hex())
  })
})

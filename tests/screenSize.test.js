/**
 * screenSize.test.js — Unit tests for the small window warning (js/screenSize.js)
 */
import { describe, it, expect } from 'vitest'
import { isTooSmall, MIN_WIDTH, MIN_HEIGHT } from '../js/screenSize.js'

describe('isTooSmall', () => {
  it('is false at the minimum size and above', () => {
    expect(isTooSmall(MIN_WIDTH, MIN_HEIGHT)).toBe(false)
    expect(isTooSmall(1920, 1080)).toBe(false)
  })

  it('is true when either side is below the minimum', () => {
    expect(isTooSmall(MIN_WIDTH - 1, 1080)).toBe(true)
    expect(isTooSmall(1920, MIN_HEIGHT - 1)).toBe(true)
    expect(isTooSmall(640, 560)).toBe(true)
  })
})

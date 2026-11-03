import { describe, it, expect } from 'vitest'
import { cameraValues, cameraCode, cameraLine, cameraRows } from '../js/cameraReadout.js'

// A renderer whose fit is scale 2 at offset (100, 50), on a 1000 x 600 canvas
const fakeRenderer = (camera) => ({
  canvas: { width: 2000, height: 1200 }, dpr: 2,
  skewX: 0.7, skewY: 0.55, scale: 2, offsetX: 100, offsetY: 50,
  centerView() { Object.assign(this, { scale: 2, offsetX: 100, offsetY: 50 }) },
  ...camera,
})

// rBridge applyCameraView: fit, zoom about the center, then pan
function applied(zoom, [px, py]) {
  const r = fakeRenderer()
  r.offsetX = 500 - (500 - r.offsetX) * zoom
  r.offsetY = 300 - (300 - r.offsetY) * zoom
  r.scale *= zoom
  r.offsetX += px * 1000
  r.offsetY -= py * 600
  return r
}

describe('camera readout', () => {
  it('reads the fitted default view as zoom 1, no pan, MiRA angles in degrees', () => {
    const v = cameraValues(fakeRenderer())
    expect(v.rotate).toBeCloseTo(40.1, 1)
    expect(v.tilt).toBeCloseTo(31.5, 1)
    expect(v.zoom).toBe(1)
    expect(v.pan).toEqual([0, -0])
  })

  it('round-trips zoom and pan as R applies them, and leaves the view unchanged', () => {
    const r = applied(1.5, [0.1, -0.05])
    const before = { scale: r.scale, offsetX: r.offsetX, offsetY: r.offsetY }
    const v = cameraValues(r)
    expect(v.zoom).toBeCloseTo(1.5)
    expect(v.pan[0]).toBeCloseTo(0.1)
    expect(v.pan[1]).toBeCloseTo(-0.05)
    expect({ scale: r.scale, offsetX: r.offsetX, offsetY: r.offsetY }).toEqual(before)
  })

  it('normalizes rotation to (-180, 180]', () => {
    expect(cameraValues(fakeRenderer({ skewX: 400 * Math.PI / 180 })).rotate).toBeCloseTo(40)
    expect(cameraValues(fakeRenderer({ skewX: -200 * Math.PI / 180 })).rotate).toBeCloseTo(160)
  })

  it('copies a mira_camera() call within its limits', () => {
    expect(cameraCode({ rotate: 61.64, tilt: 18.23, zoom: 1.40449, pan: [0.05123, -0.02377] }))
      .toBe('mira_camera(rotate = 61.6, tilt = 18.2, zoom = 1.404, pan = c(0.051, -0.024))')
    expect(cameraCode({ rotate: 0, tilt: 0, zoom: 9, pan: [3, -2] }))
      .toBe('mira_camera(rotate = 0, tilt = 0, zoom = 5, pan = c(1, -1))')
  })

  it("clamps the copied tilt to mira_camera()'s limit", () => {
    expect(cameraCode({ rotate: 0, tilt: 45.84, zoom: 1, pan: [0, 0] })).toContain("tilt = 45,")
    expect(cameraCode({ rotate: 0, tilt: -45.84, zoom: 1, pan: [0, 0] })).toContain("tilt = -45,")
  })

  it("shows the line rounded, without -0", () => {
    expect(cameraLine({ rotate: 40.1, tilt: -0.3, zoom: 1.004, pan: [-0.004, 0.126] }))
      .toBe("rotate 40°  tilt 0°  zoom 1.00  pan 0.00, 0.13")
  })

  it("shows the same values as rows in the box", () => {
    expect(cameraRows({ rotate: 40.1, tilt: -0.3, zoom: 1.004, pan: [-0.004, 0.126] }))
      .toEqual([["rotate", "40°"], ["tilt", "0°"], ["zoom", "1.00"], ["pan", "0.00, 0.13"]])
  })
})

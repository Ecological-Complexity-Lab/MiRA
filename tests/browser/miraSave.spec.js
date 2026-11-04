/**
 * Browser tests for ggmira's mira_save(): MiRA opened with ?save=true reports
 * when the plot is drawn (window.miraStatus) and posts its export to R
 * (window.miraSaveToR → POST /api/save). Also the export dialog, which
 * shares the export code.
 *
 * The R server is faked with page.route, as in viewSpec.spec.js.
 * Dataset: pilosof2017 — 6 bipartite layers, state attribute module.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const NETWORK = readFileSync(new URL('../../data/pilosof2017.json', import.meta.url), 'utf8')
const VIEWPORT = { width: 1000, height: 700 }
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]
const JPG_SIGNATURE = [0xff, 0xd8, 0xff]
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] // %PDF

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => {
    if (!d.message().startsWith('Data warnings:')) errors.push(`dialog: ${d.message()}`)
    d.dismiss()
  })
  await page.setViewportSize(VIEWPORT)
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

// ── helpers ──────────────────────────────────────────────────────────────────

/** Open MiRA as mira_save() does; the posted images are collected in the returned array. */
async function openForSave(page, spec, query = '?autoload=true&save=true') {
  const saved = []
  await page.route('**/api/network.json', route =>
    route.fulfill({ contentType: 'application/json', body: NETWORK }))
  await page.route('**/api/view.json', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, ...spec }) }))
  await page.route('**/api/save', route => {
    saved.push(route.request().postDataBuffer())
    return route.fulfill({ status: 200, body: 'saved' })
  })
  await page.goto(`/${query}`)
  return saved
}

const waitForStatus = page => page.waitForFunction(() => window.miraStatus, null, { timeout: 15000 })
  .then(handle => handle.jsonValue())

const starts = (buffer, signature) => signature.every((byte, i) => buffer[i] === byte)

// PNG width and height, from the IHDR chunk
const pngSize = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) })

/** The [r, g, b, a] of pixel (x, y) of an image, decoded by the browser. */
async function pixel(page, buffer, x, y) {
  return page.evaluate(async ({ base64, x, y }) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes]))
    const canvas = new OffscreenCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    return [...ctx.getImageData(x, y, 1, 1).data]
  }, { base64: buffer.toString('base64'), x, y })
}

// ── tests ────────────────────────────────────────────────────────────────────

test('without ?save=true, MiRA does not report to R', async ({ page }) => {
  await openForSave(page, {}, '?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
  expect(await page.evaluate(() => [typeof window.miraStatus, typeof window.miraSaveToR]))
    .toEqual(['undefined', 'undefined'])
})

test('the status reports the plot drawn, with the spec warnings', async ({ page }) => {
  await openForSave(page, { node: { color_by: 'no_such' } })
  const status = await waitForStatus(page)
  expect(status.rendered).toBe(true)
  expect(status.warnings).toEqual(['node.color_by: "no_such" is not an available attribute'])
})

test('a PNG at the resolution asked, posted to R', async ({ page }) => {
  const saved = await openForSave(page, { node: { color_by: 'module' } })
  await waitForStatus(page)
  const bytes = await page.evaluate(() =>
    window.miraSaveToR({ format: 'png', resolution: 2, background: 'grid', legends: true }))
  expect(saved).toHaveLength(1)
  expect(saved[0].length).toBe(bytes)
  expect(starts(saved[0], PNG_SIGNATURE)).toBe(true)
  expect(pngSize(saved[0])).toEqual({ width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 })
  expect(await pixel(page, saved[0], 2, 2)).toEqual([255, 255, 255, 255])
  // the export drew at 2× pixel density, then put the screen's back
  expect(await page.evaluate(() => window._renderer.dpr)).toBe(1)
  // and drew crisp (solid outlines, opaque links) for the export only
  expect(await page.evaluate(() => window._renderer.crisp)).toBe(false)
})

test('legends are exported without their palette controls, which come back on the page', async ({ page }) => {
  await openForSave(page, { node: { color_by: 'module' }, legend: { show: ['node_color'] } })
  await waitForStatus(page)
  const rowShown = () => page.evaluate(() =>
    getComputedStyle(document.querySelector('#legendPanel .legend-palette-row')).display !== 'none')
  expect(await rowShown()).toBe(true)
  // hidden during the capture, so the panel is measured without them
  const hiddenDuringCapture = page.evaluate(() => new Promise(resolve => {
    const row = document.querySelector('#legendPanel .legend-palette-row')
    new MutationObserver(() => { if (row.style.display === 'none') resolve(true) })
      .observe(row, { attributes: true, attributeFilter: ['style'] })
  }))
  await page.evaluate(() => window.miraSaveToR({ format: 'png', resolution: 1, background: 'white', legends: true }))
  expect(await hiddenDuringCapture).toBe(true)
  expect(await rowShown()).toBe(true)
})

test('a transparent PNG has a clear background; the mark stays', async ({ page }) => {
  const saved = await openForSave(page, {})
  await waitForStatus(page)
  await page.evaluate(() =>
    window.miraSaveToR({ format: 'png', resolution: 1, background: 'transparent', legends: false }))
  expect((await pixel(page, saved[0], 2, 2))[3]).toBe(0)
  // the "Visualized with MiRA" mark: an opaque pill at the bottom right
  expect((await pixel(page, saved[0], VIEWPORT.width - 30, VIEWPORT.height - 26))[3]).toBeGreaterThan(200)
  // the renderer is back to its white background
  expect(await page.evaluate(() => window._renderer.transparentBackground)).toBe(false)
})

test('JPG and PDF', async ({ page }) => {
  const saved = await openForSave(page, {})
  await waitForStatus(page)
  await page.evaluate(() => window.miraSaveToR({ format: 'jpg', resolution: 1, background: 'white', legends: true }))
  await page.evaluate(() => window.miraSaveToR({ format: 'pdf', resolution: 1, background: 'grid', legends: true }))
  expect(starts(saved[0], JPG_SIGNATURE)).toBe(true)
  expect(starts(saved[1], PDF_SIGNATURE)).toBe(true)
})

test('the layer view is saved without waiting for its slow layout animation', async ({ page }) => {
  await openForSave(page, { mode: { view: 'layer' } })
  const started = Date.now()
  const status = await waitForStatus(page)
  expect(status.rendered).toBe(true)
  expect(Date.now() - started).toBeLessThan(10000) // the animation alone takes ~20 s
  expect(await page.evaluate(() => window._renderer.layerView.tick())).toBe(false)
})

test('the export dialog still downloads a PNG', async ({ page }) => {
  await page.addInitScript(() => { delete window.showDirectoryPicker }) // a download, not a folder picker
  await openForSave(page, {}, '?autoload=true')
  await page.waitForFunction(() => window._renderer?.model?.layers?.length > 0)
  await page.waitForLoadState('networkidle')
  await page.locator('#captureBtn').click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#exportDialog [data-format="png"]').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
})

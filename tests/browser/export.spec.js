import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset } from './helpers.js'

test.describe('Export and toolbar', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    await loadDemoDataset(page, 'demo_directed')
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test('zoom in button works without crash', async ({ page }) => {
    await page.locator('#zoomInBtn').click()
    await page.locator('#zoomInBtn').click()
  })

  test('zoom out button works without crash', async ({ page }) => {
    await page.locator('#zoomOutBtn').click()
  })

  test('zoom reset button works without crash', async ({ page }) => {
    await page.locator('#zoomInBtn').click()
    await page.locator('#zoomResetBtn').click()
  })

  test('help button opens help popup', async ({ page }) => {
    await page.locator('#helpBtn').click()
    await expect(page.locator('#helpPopup')).toBeVisible()
  })

  test('help popup can be closed', async ({ page }) => {
    await page.locator('#helpBtn').click()
    await expect(page.locator('#helpPopup')).toBeVisible()
    await page.locator('#helpPopupClose').click()
    await expect(page.locator('#helpPopup')).toBeHidden()
  })

  test('capture button opens export dialog', async ({ page }) => {
    await page.locator('#captureBtn').click()
    await expect(page.locator('#exportDialog')).toBeVisible()
  })

  test('export dialog can be cancelled', async ({ page }) => {
    await page.locator('#captureBtn').click()
    await expect(page.locator('#exportDialog')).toBeVisible()
    await page.locator('#exportCancelBtn').click()
    await expect(page.locator('#exportDialog')).toBeHidden()
  })
})

test.describe('SVG export', () => {
  let pageErrors

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', e => pageErrors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    await loadDemoDataset(page, 'demo_directed')
    // Replace window.alert so CDN-load failures surface as assertions, not blocking dialogs
    await page.evaluate(() => {
      window._alertMessages = []
      window.alert = msg => { window._alertMessages.push(msg) }
    })
  })

  test('SVG button is visible in the export dialog', async ({ page }) => {
    await page.locator('#captureBtn').click()
    await expect(page.locator('#exportDialog')).toBeVisible()
    await expect(page.locator('#exportSvgBtn')).toBeVisible()
  })

  test('SVG button is enabled in network mode', async ({ page }) => {
    await page.locator('#captureBtn').click()
    await expect(page.locator('#exportSvgBtn')).toBeEnabled()
  })

  test('SVG export loads canvas2svg from CDN and shows no error alert', async ({ page }) => {
    await page.locator('#captureBtn').click()
    await expect(page.locator('#exportDialog')).toBeVisible()

    // Wait for the canvas2svg script to be fetched — this directly verifies the
    // CDN URL is correct. If the URL were wrong, the app shows an alert instead.
    const c2sResponsePromise = page.waitForResponse(
      r => r.url().includes('canvas2svg') && r.status() === 200,
      { timeout: 30000 },
    )
    await page.locator('#exportSvgBtn').click()
    await c2sResponsePromise

    const alerts = await page.evaluate(() => window._alertMessages)
    expect(alerts, 'canvas2svg must load — no "Could not load SVG library" alert').toEqual([])
    expect(pageErrors).toEqual([])
  })
})

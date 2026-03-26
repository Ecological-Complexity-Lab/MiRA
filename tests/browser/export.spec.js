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

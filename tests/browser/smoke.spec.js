import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers.js'

test.describe('Smoke — page load and baseline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('canvas is visible', async ({ page }) => {
    await expect(page.locator('#networkCanvas')).toBeVisible()
  })

  test('all four mode buttons are present', async ({ page }) => {
    await expect(page.locator('#layerViewBtn')).toBeVisible()
    await expect(page.locator('#dashboardBtn')).toBeVisible()
    await expect(page.locator('#helpBtn')).toBeVisible()
    await expect(page.locator('#zoomInBtn')).toBeVisible()
  })

  test('control panels are present', async ({ page }) => {
    await expect(page.locator('#sectionData')).toBeVisible()
    await expect(page.locator('#sectionLayers')).toBeVisible()
    await expect(page.locator('#sectionNodes')).toBeVisible()
    await expect(page.locator('#sectionLinks')).toBeVisible()
  })

  test('dashboard and layer-view panels are hidden by default', async ({ page }) => {
    await expect(page.locator('#dashboardContainer')).toBeHidden()
    await expect(page.locator('#sectionLayerViewCircles')).toBeHidden()
  })

  test('no JS errors on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    expect(errors).toEqual([])
  })
})

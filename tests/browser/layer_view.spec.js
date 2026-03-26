import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset } from './helpers.js'

test.describe('Layer View mode', () => {
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

  test('clicking layer view button activates layer view controls', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await expect(page.locator('#sectionLayerViewCircles')).toBeVisible()
    await expect(page.locator('#sectionLayerViewEdges')).toBeVisible()
  })

  test('network canvas stays present in layer view mode', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    // The canvas is reused for layer view rendering
    await expect(page.locator('#networkCanvas')).toBeVisible()
  })

  test('network-mode control panels are hidden in layer view', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await expect(page.locator('#sectionLayers')).toBeHidden()
    await expect(page.locator('#sectionNodes')).toBeHidden()
    await expect(page.locator('#sectionLinks')).toBeHidden()
  })

  test('layer view size-by dropdown cycles without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    for (const val of ['nodes', 'edges', 'density', 'uniform']) {
      await page.locator('#lvSizeBy').selectOption(val)
    }
  })

  test('layer view color-by dropdown cycles without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    for (const val of ['layer', 'nodecount', 'density', 'uniform']) {
      await page.locator('#lvColorBy').selectOption(val)
    }
  })

  test('layer view size multiplier slider changes without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await page.locator('#lvSizeMult').fill('1.5')
    await page.locator('#lvSizeMult').dispatchEvent('input')
  })

  test('layer view bubble spacing slider changes without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await page.evaluate(() => {
      const el = document.getElementById('lvSpacing')
      el.value = '2'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  })

  test('layer view show-edges toggle works without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await page.locator('#lvShowEdges').uncheck()
    await page.locator('#lvShowEdges').check()
  })

  test('layer view edge metric dropdown cycles without crash', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    for (const val of ['shared', 'interlayer', 'both']) {
      await page.locator('#lvEdgeMetric').selectOption(val)
    }
  })

  test('clicking layer view button again returns to network mode', async ({ page }) => {
    await page.locator('#layerViewBtn').click()
    await expect(page.locator('#sectionLayerViewCircles')).toBeVisible()
    await page.locator('#layerViewBtn').click()
    await expect(page.locator('#sectionLayerViewCircles')).toBeHidden()
    await expect(page.locator('#sectionLayers')).toBeVisible()
  })
})

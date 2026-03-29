import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset, openSection } from './helpers.js'

test.describe('Legend persistence across mode switches (issue #21)', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    await loadDemoDataset(page, 'demo_directed')
    await openSection(page, 'sectionNodes')
    // Select a node color attribute so renderLegends() populates #legendPanel
    await page.locator('#nodeColorSelect').selectOption({ index: 1 })
    await page.waitForFunction(() => document.querySelectorAll('#legendPanel > *').length > 0)
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test('baseline: legend panel is populated in network mode', async ({ page }) => {
    await expect(page.locator('#legendPanel > *')).not.toHaveCount(0)
    await expect(page.locator('#legendPanel button.btn').filter({ hasText: 'Expand Node Color Legend' })).toBeVisible()
  })

  test('expanded legend box disappears when switching to dashboard', async ({ page }) => {
    // Expand the legend
    await page.locator('#legendPanel button.btn').filter({ hasText: 'Expand Node Color Legend' }).click()
    await expect(page.locator('#legendPanel .legend-box')).not.toHaveCount(0)

    // Switch to dashboard
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#dashboardContainer')).toBeVisible()

    // Bug: legend-box should be gone
    await expect(page.locator('#legendPanel .legend-box')).toHaveCount(0)
  })

  test('all legend children are cleared when dashboard is active', async ({ page }) => {
    await expect(page.locator('#legendPanel > *')).not.toHaveCount(0)

    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#dashboardContainer')).toBeVisible()

    // Bug: legend panel should be empty in dashboard mode
    await expect(page.locator('#legendPanel > *')).toHaveCount(0)
  })

  test('legends restore correctly when returning from dashboard to network', async ({ page }) => {
    const countBefore = await page.locator('#legendPanel > *').count()

    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#dashboardContainer')).toBeVisible()

    // Exit dashboard back to network
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#networkCanvas')).toBeVisible()

    await expect(page.locator('#legendPanel > *')).toHaveCount(countBefore)
  })

  test('expanded legend from network mode does not persist through layer view into dashboard', async ({ page }) => {
    // Expand legend in network mode
    await page.locator('#legendPanel button.btn').filter({ hasText: 'Expand Node Color Legend' }).click()
    await expect(page.locator('#legendPanel .legend-box')).not.toHaveCount(0)

    // Enter layer view (clears panel with layer-view legends)
    await page.locator('#layerViewBtn').click()
    await expect(page.locator('#layerViewBtn')).toHaveClass(/active/)

    // Jump directly to dashboard from layer view
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#dashboardContainer')).toBeVisible()

    // Bug: no legend-box should survive into dashboard
    await expect(page.locator('#legendPanel .legend-box')).toHaveCount(0)
  })
})

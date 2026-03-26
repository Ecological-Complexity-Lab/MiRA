import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset, openSection } from './helpers.js'

test.describe('Dashboard mode', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    await loadDemoDataset(page, 'demo_directed')
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#dashboardContainer')).toBeVisible()
    await openSection(page, 'sectionDashboard')
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test('dashboard is visible and canvas is hidden', async ({ page }) => {
    await expect(page.locator('#dashboardContainer')).toBeVisible()
    await expect(page.locator('#networkCanvas')).toBeHidden()
  })

  test('dashboard has KPI cards', async ({ page }) => {
    const cards = page.locator('#dashboardContainer .db-card')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('dashboard control panel is visible', async ({ page }) => {
    await expect(page.locator('#sectionDashboard')).toBeVisible()
  })

  test('sort matrix select changes without crash', async ({ page }) => {
    await page.locator('#dbSortSelect').selectOption('name')
    await page.locator('#dbSortSelect').selectOption('set')
    await page.locator('#dbSortSelect').selectOption('participation')
  })

  test('highlight chart select changes without crash', async ({ page }) => {
    await page.locator('#dbHighlightSelect').selectOption('edges')
    await page.locator('#dbHighlightSelect').selectOption('density')
    await page.locator('#dbHighlightSelect').selectOption('nodes')
  })

  test('clicking dashboard button again returns to network mode', async ({ page }) => {
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#networkCanvas')).toBeVisible()
    await expect(page.locator('#dashboardContainer')).toBeHidden()
  })
})

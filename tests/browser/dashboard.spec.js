import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset } from './helpers.js'

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

  test('matrix sort buttons change without crash', async ({ page }) => {
    await page.locator('.db-sort-btn[data-sort="name"]').click()
    await page.locator('.db-sort-btn[data-sort="participation"]').click()
  })

  test('clicking dashboard button again returns to network mode', async ({ page }) => {
    await page.locator('#dashboardBtn').click()
    await expect(page.locator('#networkCanvas')).toBeVisible()
    await expect(page.locator('#dashboardContainer')).toBeHidden()
  })
})

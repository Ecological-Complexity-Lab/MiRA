import { test, expect } from '@playwright/test'
import { waitForAppReady, dismissDataNotice, loadDemoDataset } from './helpers.js'

test.describe('Data loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await dismissDataNotice(page)
  })

  const DEMO_DATASETS = [
    'demo_directed',
    'demo_large',
    'demo_bipartite',
    'demo_bipartite_bartomeus',
    'synth_bipartite',
    'synth_unipartite',
  ]

  for (const dataFile of DEMO_DATASETS) {
    test(`load demo dataset: ${dataFile}`, async ({ page }) => {
      const errors = []
      page.on('pageerror', e => errors.push(e.message))

      await loadDemoDataset(page, dataFile)

      expect(errors).toEqual([])
      await expect(page.locator('#networkCanvas')).toBeVisible()
      // nodeColorSelect should have options populated
      const count = await page.locator('#nodeColorSelect option').count()
      expect(count).toBeGreaterThan(0)
    })
  }

  test('load demo dataset: demo_large_ba (large network)', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.locator('#sectionData summary').click()
    await page.locator('#openDemoDialogBtn').click()
    await page.locator('button.demo-dataset-btn[data-file="demo_large_ba"]').click()
    await page.waitForFunction(() => {
      const sel = document.getElementById('nodeColorSelect')
      return sel && sel.options.length > 1
    }, { timeout: 30000 })
    await dismissDataNotice(page)

    expect(errors).toEqual([])
    await expect(page.locator('#networkCanvas')).toBeVisible()
  })

  test('JSON file upload loads network', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    const fileInput = page.locator('#fileInput')
    await fileInput.setInputFiles('data/demo.json')

    await page.waitForFunction(() => {
      const sel = document.getElementById('nodeColorSelect')
      return sel && sel.options.length > 1
    }, { timeout: 10000 })
    await dismissDataNotice(page)

    expect(errors).toEqual([])
    await expect(page.locator('#networkCanvas')).toBeVisible()
  })
})

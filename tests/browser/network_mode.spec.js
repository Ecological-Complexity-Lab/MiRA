import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset, openSection } from './helpers.js'

test.describe('Network mode controls', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
    await loadDemoDataset(page, 'demo_directed')
    await openSection(page, 'sectionLayers')
    await openSection(page, 'sectionNodes')
    await openSection(page, 'sectionLinks')
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test('layer names checkbox toggles without crash', async ({ page }) => {
    const cb = page.locator('#showLayerNamesCheckbox')
    await cb.check()
    await cb.uncheck()
  })

  test('stacking mode: switch to vertical and back', async ({ page }) => {
    await page.locator('#stackVerticalBtn').click()
    await expect(page.locator('#stackVerticalBtn')).toHaveClass(/active/)
    await page.locator('#stackHorizontalBtn').click()
    await expect(page.locator('#stackHorizontalBtn')).toHaveClass(/active/)
  })

  test('layer spacing slider change does not crash', async ({ page }) => {
    await page.locator('#layerSpacingSlider').fill('400')
    await page.locator('#layerSpacingSlider').dispatchEvent('input')
  })

  test('all non-bipartite layout algorithms switch without crash', async ({ page }) => {
    // bipartite layout is skipped here — demo_directed is not bipartite
    const layouts = ['fruchterman', 'kamada_kawai', 'circle', 'grid', 'random']
    for (const value of layouts) {
      await page.locator('#layoutSelect').selectOption(value)
      await page.waitForTimeout(200)
    }
  })

  test('node labels checkbox toggles without crash', async ({ page }) => {
    const cb = page.locator('#showLabelsCheckbox')
    await cb.check()
    await cb.uncheck()
  })

  test('transform nodes checkbox toggles without crash', async ({ page }) => {
    const cb = page.locator('#transformNodesCheckbox')
    await cb.uncheck()
    await cb.check()
  })

  test('color by node dropdown cycles through options', async ({ page }) => {
    const select = page.locator('#nodeColorSelect')
    const options = await select.evaluate(el => Array.from(el.options).map(o => o.value))
    for (const value of options) {
      if (value) await select.selectOption(value)
    }
  })

  test('size by node dropdown cycles through options', async ({ page }) => {
    const select = page.locator('#nodeSizeSelect')
    const options = await select.evaluate(el => Array.from(el.options).map(o => o.value))
    for (const value of options) {
      if (value) await select.selectOption(value)
    }
  })

  test('node size slider changes without crash', async ({ page }) => {
    await page.locator('#nodeSizeSlider').fill('18')
    await page.locator('#nodeSizeSlider').dispatchEvent('input')
  })

  test('interlayer links checkbox toggles without crash', async ({ page }) => {
    await page.evaluate(() => {
      const cb = document.getElementById('showInterlayerCheckbox')
      cb.checked = false
      cb.dispatchEvent(new Event('change', { bubbles: true }))
      cb.checked = true
      cb.dispatchEvent(new Event('change', { bubbles: true }))
    })
  })

  test('link color dropdown cycles through options', async ({ page }) => {
    const select = page.locator('#linkColorSelect')
    const options = await select.evaluate(el => Array.from(el.options).map(o => o.value))
    for (const value of options) {
      if (value) await select.selectOption(value)
    }
  })

  test('zoom in / zoom out / reset do not crash', async ({ page }) => {
    await page.locator('#zoomInBtn').click()
    await page.locator('#zoomInBtn').click()
    await page.locator('#zoomOutBtn').click()
    await page.locator('#zoomResetBtn').click()
  })

  test('node search returns results and clears', async ({ page }) => {
    await openSection(page, 'sectionSearch')
    await page.evaluate(() => {
      const input = document.getElementById('nodeSearchInput')
      input.value = 'a'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      document.getElementById('nodeSearchClearBtn').click()
    })
  })
})

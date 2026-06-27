/**
 * MiRA browser smoke suite.
 *
 * Scope: confirm the app loads, a bundled dataset loads, every visualisation
 * mode renders without a runtime error, and the core network-mode controls
 * are wired up. This is render-without-error coverage, not visual-correctness
 * checking (the canvas is verified by humans).
 *
 * Every test fails if any uncaught page error fires during the interaction.
 */
import { test, expect } from '@playwright/test'
import { waitForAppReady, loadDemoDataset, openSection } from './helpers.js'

// Six always-available modes and their toolbar buttons. Map Mode is reachable
// only when the loaded dataset carries geographic coordinates (its button is
// hidden otherwise), so it is exercised separately with a geo dataset.
const CORE_MODES = [
  { name: 'network', btn: '#networkModeBtn' },
  { name: 'layer', btn: '#layerViewBtn' },
  { name: 'grid', btn: '#gridViewBtn' },
  { name: 'meta', btn: '#metaNetworkBtn' },
  { name: 'dashboard', btn: '#dashboardBtn' },
  { name: 'data', btn: '#dataModeBtn' },
]

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await waitForAppReady(page)
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

test('page loads with a visible canvas and mode toolbar', async ({ page }) => {
  await expect(page.locator('#networkCanvas')).toBeVisible()
  for (const { btn } of CORE_MODES) {
    await expect(page.locator(btn)).toBeVisible()
  }
})

test('a bundled dataset loads and renders', async ({ page }) => {
  await loadDemoDataset(page, 'costa2020')
  await expect(page.locator('#networkCanvas')).toBeVisible()
  // Node attribute dropdown is populated from the loaded model.
  const optionCount = await page.locator('#nodeColorSelect option').count()
  expect(optionCount).toBeGreaterThan(1)
})

test('every mode renders without error', async ({ page }) => {
  // magrach2020 carries lat/long, so Map Mode becomes reachable too.
  await loadDemoDataset(page, 'magrach2020')

  for (const { name, btn } of CORE_MODES) {
    await page.locator(btn).click()
    await expect(page.locator(btn), `${name} mode button should activate`).toHaveClass(/active/)
    await page.waitForTimeout(150) // let the mode paint
  }

  // Map Mode — button is revealed only for geo datasets.
  const mapBtn = page.locator('#mapModeBtn')
  await expect(mapBtn, 'map button should be visible for a geo dataset').toBeVisible()
  await mapBtn.click()
  await expect(mapBtn).toHaveClass(/active/)
  await page.waitForTimeout(150)

  // Return to network mode cleanly.
  await page.locator('#networkModeBtn').click()
  await expect(page.locator('#networkModeBtn')).toHaveClass(/active/)
})

test('core network controls do not throw', async ({ page }) => {
  await loadDemoDataset(page, 'magrach2020')
  await openSection(page, 'sectionLayers')
  await openSection(page, 'sectionNodes')
  await openSection(page, 'sectionInterLinks')

  // Interlayer links (the main performance/visual toggle).
  await page.evaluate(() => {
    const cb = document.getElementById('showInterlayerCheckbox')
    cb.checked = !cb.checked
    cb.dispatchEvent(new Event('change', { bubbles: true }))
  })

  // Layout algorithms. Driven via JS rather than selectOption because the
  // control lives in the fixed side panel and may sit outside the viewport.
  for (const value of ['fruchterman', 'circle', 'grid', 'random']) {
    await page.evaluate(v => {
      const sel = document.getElementById('layoutSelect')
      sel.value = v
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
    await page.waitForTimeout(100)
  }

  // Viewport controls.
  await page.locator('#zoomInBtn').click()
  await page.locator('#zoomResetBtn').click()
})

import { test, expect } from '@playwright/test'
import { waitForAppReady, dismissDataNotice } from './helpers.js'

async function loadPondEcosystem(page) {
  // net22 is not in the demo dialog — load via file upload
  await page.locator('#fileInput').setInputFiles('data/net22.json')
  await page.waitForFunction(() => {
    const sel = document.getElementById('nodeColorSelect')
    return sel && sel.options.length > 1
  }, { timeout: 15000 })
  await dismissDataNotice(page)
}

test.describe('Map mode', () => {
  let errors

  test.beforeEach(async ({ page }) => {
    errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/')
    await waitForAppReady(page)
  })

  test.afterEach(() => {
    expect(errors).toEqual([])
  })

  test('map button is hidden for default dataset (no lat/lon)', async ({ page }) => {
    await expect(page.locator('#mapModeBtn')).toBeHidden()
  })

  test('map button appears after loading geo dataset (net22)', async ({ page }) => {
    await loadPondEcosystem(page)
    await expect(page.locator('#mapModeBtn')).toBeVisible()
  })

  test('clicking map button shows Leaflet map', async ({ page }) => {
    await loadPondEcosystem(page)
    await page.locator('#mapModeBtn').click()
    await expect(page.locator('.leaflet-container')).toBeVisible()
  })

  test('map opacity control appears in map mode', async ({ page }) => {
    await loadPondEcosystem(page)
    await page.locator('#mapModeBtn').click()
    await expect(page.locator('#mapOpacityControl')).toBeVisible()
  })

  test('map opacity slider changes without crash', async ({ page }) => {
    await loadPondEcosystem(page)
    await page.locator('#mapModeBtn').click()
    await page.evaluate(() => {
      const el = document.getElementById('mapOpacitySlider')
      el.value = '0.5'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  })

  test('show map checkbox toggles without crash', async ({ page }) => {
    await loadPondEcosystem(page)
    await page.locator('#mapModeBtn').click()
    await page.locator('#showMapImageCheckbox').uncheck()
    await page.locator('#showMapImageCheckbox').check()
  })

  test('clicking map button again returns to network mode', async ({ page }) => {
    await loadPondEcosystem(page)
    await page.locator('#mapModeBtn').click()
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await page.locator('#mapModeBtn').click()
    await expect(page.locator('#mapOpacityControl')).toBeHidden()
  })
})

/**
 * Browser tests for the small window warning (js/screenSize.js): shown below
 * 1024 × 600, on the website and from R; gone when the window is large
 * enough; closed for the browser session; never in mira_save()'s ?save=true.
 */
import { test, expect } from '@playwright/test'

const NOTICE = '#screenSizeNotice'

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

async function open(page, query = '') {
  await page.goto(`/${query}`)
  await page.waitForLoadState('networkidle')
}

test('a large window has no warning', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await open(page)
  await expect(page.locator(NOTICE)).toHaveCount(0)
})

test('a small window is warned, with its size; the warning follows resizing', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 560 })
  await open(page)
  await expect(page.locator(NOTICE)).toBeVisible()
  await expect(page.locator(NOTICE)).toContainText('800 × 560')
  await expect(page.locator(NOTICE)).toContainText('Enlarge the window')

  await page.setViewportSize({ width: 1200, height: 800 })
  await expect(page.locator(NOTICE)).toHaveCount(0)
  await page.setViewportSize({ width: 1200, height: 500 })
  await expect(page.locator(NOTICE)).toContainText('1200 × 500')
})

test('a closed warning stays closed for the browser session', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 560 })
  await open(page)
  await page.click('.screen-size-notice-close')
  await expect(page.locator(NOTICE)).toHaveCount(0)
  await page.setViewportSize({ width: 700, height: 560 })
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.locator(NOTICE)).toHaveCount(0)
})

test('in RStudio\'s Viewer pane the warning says how to get more room', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 560 })
  await open(page, '?pane=rstudio')
  await expect(page.locator(NOTICE)).toContainText('Maximize the Viewer pane')
})

test('mira_save() draws without the warning', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 560 })
  await open(page, '?save=true')
  await expect(page.locator(NOTICE)).toHaveCount(0)
})

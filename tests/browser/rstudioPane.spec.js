/**
 * Browser tests for RStudio's Viewer pane (ggmira opens MiRA there with
 * ?pane=rstudio): the top bar keeps only the lab logo; elsewhere (the
 * website, a plot opened in the browser) every branding button stays.
 */
import { test, expect } from '@playwright/test'

const HIDDEN_IN_PANE = ['#feedbackBtn', '#citeBtn', '.branding-docs-btn', '.branding-why-btn',
  '.branding-r-btn', '#brandingGroup a[href="https://github.com/Ecological-Complexity-Lab/MiRA"]']
const LAB_LOGO = '#brandingGroup .branding-lab'

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

async function open(page, query = '') {
  await page.goto(`/${query}`)
  await page.waitForLoadState('networkidle')
}

test('in RStudio\'s Viewer pane only the lab logo is left in the top bar', async ({ page }) => {
  await open(page, '?pane=rstudio')
  for (const sel of HIDDEN_IN_PANE) await expect(page.locator(sel), sel).toBeHidden()
  await expect(page.locator(LAB_LOGO)).toBeVisible()
})

test('on the website every branding button is shown', async ({ page }) => {
  await open(page)
  for (const sel of HIDDEN_IN_PANE) await expect(page.locator(sel), sel).toBeVisible()
  await expect(page.locator(LAB_LOGO)).toBeVisible()
})

test('a plot opened from R in the browser keeps every branding button', async ({ page }) => {
  await open(page, '?autoload=true')
  for (const sel of HIDDEN_IN_PANE) await expect(page.locator(sel), sel).toBeVisible()
})

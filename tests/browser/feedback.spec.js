/**
 * Browser tests for the Feedback dialog (js/feedback.js): "Open on GitHub"
 * opens a pre-filled issue in MiRA's or ggmira's repository; "Send us an
 * email" shows the address, subject and message to copy.
 */
import { test, expect } from '@playwright/test'

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.setViewportSize({ width: 1280, height: 720 })
})
test.afterEach(() => {
  expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([])
})

async function openFeedback(page, query = '') {
  await page.goto(`/${query}`)
  await page.waitForLoadState('networkidle')
  // Record window.open instead of opening GitHub
  await page.evaluate(() => {
    window.__opened = []
    window.open = url => { window.__opened.push(url) }
  })
  await page.click('#feedbackBtn')
  await expect(page.locator('#feedbackDialog')).toBeVisible()
}

test('Open on GitHub: an issue in MiRA\'s repository from the website', async ({ page }) => {
  await openFeedback(page)
  await page.fill('#feedbackMessage', 'The legend overlaps the plot')
  await page.click('#feedbackForm button[type="submit"]')
  const [url] = await page.evaluate(() => window.__opened)
  expect(url).toContain('https://github.com/Ecological-Complexity-Lab/MiRA/issues/new?')
  const params = new URL(url).searchParams
  expect(params.get('title')).toBe('[MiRA] The legend overlaps the plot')
  expect(params.get('body')).toContain('**Topic:** MiRA (website)')
  expect(params.get('body')).toContain('"appVersion"')
  await expect(page.locator('#feedbackDialog')).toBeHidden()
})

test('Open on GitHub: an issue in ggmira\'s repository when opened from R', async ({ page }) => {
  await openFeedback(page, '?autoload=true')
  await page.fill('#feedbackMessage', 'From R')
  await page.click('#feedbackForm button[type="submit"]')
  const [url] = await page.evaluate(() => window.__opened)
  expect(url).toContain('https://github.com/Ecological-Complexity-Lab/ggmira/issues/new?')
})

test('Send us an email: the address, subject and message to copy; Back returns to the form', async ({ page }) => {
  await openFeedback(page)
  await page.fill('#feedbackMessage', 'Density looks wrong')
  await page.fill('#feedbackName', 'A. Tester')
  await page.click('#feedbackEmailBtn')

  await expect(page.locator('#feedbackForm')).toBeHidden()
  await expect(page.locator('#feedbackEmailPanel')).toBeVisible()
  await expect(page.locator('#feedbackEmailTo')).toHaveText('geutg@post.bgu.ac.il')
  await expect(page.locator('#feedbackEmailSubject')).toHaveText('[MiRA] Density looks wrong')
  const body = page.locator('#feedbackEmailBody')
  await expect(body).toContainText('Topic: MiRA (website)')
  await expect(body).toContainText('From: A. Tester')
  await expect(body).toContainText('Density looks wrong')
  await expect(body).toContainText('Technical details:')
  await expect(page.locator('#feedbackMailtoLink')).toHaveAttribute('href', /^mailto:geutg@post\.bgu\.ac\.il\?subject=/)

  await page.click('[data-feedback-copy="Body"]')
  await expect(page.locator('[data-feedback-copy="Body"] .cite-copy-label')).toHaveText('Copied!')

  await page.click('#feedbackEmailBackBtn')
  await expect(page.locator('#feedbackForm')).toBeVisible()
  await expect(page.locator('#feedbackMessage')).toHaveValue('Density looks wrong')
})

test('Send us an email needs a comment', async ({ page }) => {
  await openFeedback(page)
  await page.click('#feedbackEmailBtn')
  await expect(page.locator('#feedbackEmailPanel')).toBeHidden()
  await expect(page.locator('#feedbackForm')).toBeVisible()
})

test('without technical details the email has none', async ({ page }) => {
  await openFeedback(page)
  await page.fill('#feedbackMessage', 'No details')
  await page.uncheck('#feedbackIncludeDiag')
  await page.click('#feedbackEmailBtn')
  await expect(page.locator('#feedbackEmailBody')).not.toContainText('Technical details')
})

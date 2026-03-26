/**
 * Shared helpers for Playwright browser tests.
 */

/**
 * Wait for the app JS to finish initializing.
 * At this commit the app does NOT auto-load data, so we just wait for
 * the canvas and toolbar to be present and the page to be idle.
 */
export async function waitForAppReady(page) {
  // 'load' ensures all scripts have been fetched and executed
  await page.waitForLoadState('load')
  // 'networkidle' ensures app.js module has finished its synchronous init
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  await page.waitForSelector('#networkCanvas', { timeout: 10000 })
}


/**
 * Open a control panel <details> section by its id.
 * e.g. openSection(page, 'sectionLayers')
 */
export async function openSection(page, sectionId) {
  // Set open attribute directly via JS — bypasses viewport constraints of the fixed panel
  await page.evaluate(id => {
    const el = document.getElementById(id)
    if (el) el.open = true
  }, sectionId)
}

/**
 * Dismiss the "Data loaded" notice modal if it appears.
 */
export async function dismissDataNotice(page) {
  const notice = page.locator('#dataLoadedNotice')
  const okBtn = page.locator('#dataLoadedOk')
  try {
    await notice.waitFor({ state: 'visible', timeout: 3000 })
    await okBtn.click()
    await notice.waitFor({ state: 'hidden', timeout: 3000 })
  } catch {
    // Modal didn't appear — that's fine
  }
}

/**
 * Load one of the built-in demo datasets by its data-file value.
 * e.g. loadDemoDataset(page, 'pond_ecosystem')
 */
export async function loadDemoDataset(page, dataFile) {
  // Open dialog via JS — avoids click-timing races with parallel workers
  await page.evaluate(() => {
    document.getElementById('demoDialog').style.display = 'flex'
  })
  await page.locator('#demoDialog').waitFor({ state: 'visible', timeout: 5000 })
  // Click button and wait for the JSON fetch to complete before checking the dropdown
  await Promise.all([
    page.waitForResponse(r => r.url().includes(`${dataFile}.json`) && r.status() === 200, { timeout: 20000 }),
    page.locator(`button.demo-dataset-btn[data-file="${dataFile}"]`).click(),
  ])
  // Wait for loadData() to populate the color dropdown
  await page.waitForFunction(() => {
    const sel = document.getElementById('nodeColorSelect')
    return sel && sel.options.length > 1
  }, { timeout: 10000 })
  await dismissDataNotice(page)
}

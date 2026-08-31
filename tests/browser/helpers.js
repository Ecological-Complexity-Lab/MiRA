/**
 * Shared helpers for the MiRA browser smoke suite.
 *
 * Keep selectors centralized here: if a DOM id or the demo-dialog markup
 * changes, this is the single place to update.
 */

/**
 * Wait for the app to finish its synchronous init.
 * MiRA does not auto-load data on a plain page load, so "ready" just means
 * the scripts ran and the main canvas exists.
 */
export async function waitForAppReady(page) {
  await page.waitForLoadState('load')
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  await page.waitForSelector('#networkCanvas', { timeout: 10000 })
}

/**
 * Open a control-panel <details> section by id (e.g. 'sectionLayers').
 * Sets `open` directly to bypass the fixed panel's viewport constraints.
 */
export async function openSection(page, sectionId) {
  await page.evaluate(id => {
    const el = document.getElementById(id)
    if (el) el.open = true
  }, sectionId)
}

/**
 * Dismiss the "Data loaded" notice if it appears. Non-fatal — the modal
 * is not shown for every dataset/path.
 */
export async function dismissDataNotice(page) {
  const okBtn = page.locator('#dataLoadedOk')
  try {
    await page.locator('#dataLoadedNotice').waitFor({ state: 'visible', timeout: 2000 })
    await okBtn.click()
    await page.locator('#dataLoadedNotice').waitFor({ state: 'hidden', timeout: 3000 })
  } catch {
    // Modal didn't appear — fine.
  }
}

/**
 * Load a bundled demo dataset by its file key (e.g. 'costa2020').
 * Opens the demo dialog and clicks the matching load button, which is
 * tagged with `data-file` for exactly this purpose. Resolves once the
 * dataset JSON has been fetched and loadData() has populated the UI.
 */
export async function loadDemoDataset(page, file) {
  await page.evaluate(() => {
    document.getElementById('demoDialog').style.display = 'flex'
  })
  await page.locator('#demoDialog').waitFor({ state: 'visible', timeout: 5000 })

  await Promise.all([
    page.waitForResponse(
      r => r.url().includes(`/data/${file}.json`) && r.status() === 200,
      { timeout: 20000 },
    ),
    page.locator(`#demoDatasetList button[data-file="${file}"]`).click({ force: true }),
  ])

  // loadData() populates the node-color dropdown once the model is built.
  await page.waitForFunction(() => {
    const sel = document.getElementById('nodeColorSelect')
    return sel && sel.options.length > 1
  }, { timeout: 10000 })

  await dismissDataNotice(page)
}

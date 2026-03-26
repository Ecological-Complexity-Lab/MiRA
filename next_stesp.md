# Next Steps

## Flaky Playwright test — helpers.js bug (NOT an app bug)

**Failing tests:** `data.spec.js › load demo dataset: demo_directed` and `export.spec.js › zoom in button works without crash`

**Root cause (test infrastructure, not app code):**
The `loadDemoDataset()` helper in `tests/browser/helpers.js` calls `dismissDataNotice` at the **end**, but the `#dataLoadedNotice` modal may still be visible at the moment the demo-dataset button is clicked, intercepting the click so the fetch never fires.

**Fix (one line):** Move `await dismissDataNotice(page)` to the **start** of `loadDemoDataset`, before showing the dialog — so the modal is gone before we try to click anything.

```js
export async function loadDemoDataset(page, dataFile) {
  await dismissDataNotice(page)   // ← move here, was at the end
  await page.evaluate(() => {
    document.getElementById('demoDialog').style.display = 'flex'
  })
  ...
}
```

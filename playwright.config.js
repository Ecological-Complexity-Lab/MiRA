import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  workers: 3, // python3 http.server is single-threaded; >3 workers causes fetch timeouts
  use: {
    baseURL: 'http://localhost:8001',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8001',
    url: 'http://localhost:8001',
    reuseExistingServer: true,
  },
})

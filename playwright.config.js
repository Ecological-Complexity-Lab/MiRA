import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
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

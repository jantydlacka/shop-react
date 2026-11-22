import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4317/shop-react/',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'npm run build:demo && npx vite preview --mode demo --base=/shop-react/ --port 4317 --strictPort',
    url: 'http://localhost:4317/shop-react/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

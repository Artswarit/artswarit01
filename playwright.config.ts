import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for dashboard / chat regression tests.
 * Run: `bunx playwright test`
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8080',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-iphone',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'mobile-small',
      use: { viewport: { width: 360, height: 740 }, userAgent: devices['Pixel 5'].userAgent },
    },
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'tablet-landscape',
      use: { viewport: { width: 1024, height: 768 } },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile-first E2E. Start Vite (and your API) first, or let Playwright start Vite via webServer.
 *
 * Optional auth (full app flow):
 *   E2E_EMAIL=you@example.com E2E_PASSWORD='…' npx playwright test
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      /* Pixel profile = Chromium + phone viewport/touch (iPhone preset uses WebKit). */
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev -- --host localhost --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

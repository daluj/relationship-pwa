import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build so the service worker is real (pwa §9).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  // Full Chromium (new headless): the headless shell always denies notification permission.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    // roadmap §15 cross-browser check: the offline + responsive specs in Firefox and WebKit (Safari's engine).
    {
      name: 'firefox',
      testMatch: /(offline|layout)\.spec\.ts$/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: /(offline|layout)\.spec\.ts$/,
      use: { ...devices['Desktop Safari'] },
    },
    // Performance checks (features §8.6) run alone, after everything else.
    {
      name: 'perf',
      testMatch: /.*\.perf\.ts$/,
      dependencies: ['chromium'],
      fullyParallel: false,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

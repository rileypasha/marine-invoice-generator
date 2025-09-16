// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Enhanced Playwright Configuration for CI/CD Pipeline
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? '50%' : undefined,
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },

  reporter: process.env.CI
    ? [
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
        ['github'],
        ['list'],
        ['junit', { outputFile: 'test-results/junit.xml' }]
      ]
    : [
        ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
        ['list']
      ],

  use: {
    baseURL: process.env.APP_URL || process.env.TEST_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: !!process.env.CI,
    ignoreHTTPSErrors: true,
    bypassCSP: false,
    contextOptions: {
      reducedMotion: 'reduce',
    },
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },

    // Mobile devices (run only in CI for comprehensive testing)
    ...(process.env.CI ? [
      {
        name: 'Mobile Chrome',
        use: { ...devices['Pixel 5'] },
      },
      {
        name: 'Mobile Safari',
        use: { ...devices['iPhone 12'] },
      },
    ] : []),
  ],

  webServer: process.env.CI ? undefined : {
    command: 'npm run server:dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test_user:test_password@localhost:5432/marine_invoice_test'
    },
  },

  // Global setup and teardown
  globalSetup: process.env.CI ? './test/global-setup.js' : undefined,
  globalTeardown: process.env.CI ? './test/global-teardown.js' : undefined,

  // Test output directories
  outputDir: 'test-results/',

  // Metadata
  metadata: {
    'test-environment': process.env.NODE_ENV || 'development',
    'base-url': process.env.APP_URL || 'http://localhost:3000',
    'ci': !!process.env.CI,
  },
});
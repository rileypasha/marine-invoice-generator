// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Phase 4: Playwright Configuration for Customers Navigation Testing
 *
 * Optimized for production environment testing with comprehensive monitoring
 * and error detection capabilities.
 */
module.exports = defineConfig({
  testDir: './test/e2e',
  testMatch: ['**/phase4-*.spec.js'],

  // Test execution settings
  fullyParallel: false, // Sequential execution for better debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 2, // More retries for flaky network conditions
  workers: 1, // Single worker for consistent results
  timeout: 60 * 1000, // 60 seconds per test

  expect: {
    timeout: 10 * 1000, // 10 seconds for assertions
  },

  // Enhanced reporting for Phase 4
  reporter: [
    ['html', {
      outputFolder: 'test-results/phase4-playwright-report',
      open: 'never'
    }],
    ['json', {
      outputFile: 'test-results/phase4-results.json'
    }],
    ['junit', {
      outputFile: 'test-results/phase4-junit.xml'
    }],
    ['list', {
      printSteps: true
    }]
  ],

  use: {
    // Production environment settings
    baseURL: process.env.PHASE4_BASE_URL || 'https://mginvoices.com',

    // Enhanced debugging and monitoring
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Network and performance monitoring
    headless: true, // Use headless for CI/automated runs
    ignoreHTTPSErrors: true,

    // Context options for incognito mode simulation
    contextOptions: {
      // Force fresh session
      ignoreHTTPSErrors: true,
      bypassCSP: false,

      // HAR recording for network analysis
      recordHar: {
        mode: 'full',
        path: 'test-results/phase4-network.har'
      },

      // Enhanced permissions
      permissions: ['clipboard-read', 'clipboard-write'],

      // Geolocation (if needed)
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco

      // Extra HTTP headers
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    },

    // Timeouts
    navigationTimeout: 30 * 1000, // 30 seconds for navigation
    actionTimeout: 15 * 1000, // 15 seconds for actions
  },

  // Browser projects for comprehensive testing
  projects: [
    {
      name: 'chromium-incognito',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        contextOptions: {
          // Force incognito-like behavior
          ...devices['Desktop Chrome'].contextOptions,
          ignoreHTTPSErrors: true,
          recordHar: {
            mode: 'full',
            path: 'test-results/phase4-chromium-network.har'
          }
        }
      },
    },

    // Firefox for cross-browser validation
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        contextOptions: {
          ignoreHTTPSErrors: true,
          recordHar: {
            mode: 'full',
            path: 'test-results/phase4-firefox-network.har'
          }
        }
      },
    },

    // Mobile testing (optional - can be enabled for comprehensive coverage)
    ...(process.env.PHASE4_INCLUDE_MOBILE ? [
      {
        name: 'mobile-chrome',
        use: {
          ...devices['Pixel 5'],
          contextOptions: {
            ignoreHTTPSErrors: true,
            recordHar: {
              mode: 'full',
              path: 'test-results/phase4-mobile-network.har'
            }
          }
        },
      }
    ] : []),
  ],

  // Output directories
  outputDir: 'test-results/phase4-artifacts',

  // Global setup and teardown
  globalSetup: process.env.PHASE4_GLOBAL_SETUP ? './test/phase4-global-setup.js' : undefined,
  globalTeardown: process.env.PHASE4_GLOBAL_TEARDOWN ? './test/phase4-global-teardown.js' : undefined,

  // Test metadata for reporting
  metadata: {
    'test-phase': 'Phase 4 - Navigation Verification',
    'target-environment': process.env.PHASE4_BASE_URL || 'https://mginvoices.com',
    'test-type': 'End-to-End Navigation',
    'browser-mode': 'Incognito/Fresh Session',
    'authentication': 'Production Credentials',
    'monitoring': 'Console Errors, Network Activity, Performance Metrics'
  },

  // Web server configuration (not needed for production testing)
  webServer: undefined,
});
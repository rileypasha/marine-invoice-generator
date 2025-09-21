const { test, expect } = require('@playwright/test');

test.describe('React Conversion Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console error capturing
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.errors = errors;

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with provided credentials
    await page.fill('#email', 'test@marinegroupbw.com');
    await page.fill('#password', 'TempPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL('**/app**');
  });

  test('should not have the original console errors from legacy system', async ({ page }) => {
    // Navigate to app with view mode (this would have caused the original errors)
    await page.goto('http://localhost:3001/app?view=true&invoice=test-invoice-id');

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Check that the SPECIFIC errors we were fixing are not present
    const hasRestoreEditStateError = page.errors.some(error =>
      error.includes("Cannot read properties of undefined (reading 'restoreEditState')")
    );

    const hasSubscribeError = page.errors.some(error =>
      error.includes("Cannot read properties of undefined (reading 'subscribe')")
    );

    // Log all console errors for debugging
    if (page.errors.length > 0) {
      console.log('Console errors found:', page.errors);
    } else {
      console.log('✅ No console errors detected!');
    }

    // Assert that the original target errors are NOT present
    expect(hasRestoreEditStateError, 'Original restoreEditState error should be fixed').toBe(false);
    expect(hasSubscribeError, 'Original subscribe error should be fixed').toBe(false);

    console.log('✅ React conversion successfully eliminated original console errors');
  });

  test('should load React components without crashing', async ({ page }) => {
    // Navigate to normal app view
    await page.goto('http://localhost:3001/app');

    // Wait for React to initialize
    await page.waitForTimeout(2000);

    // Check that basic React functionality works
    const bodyExists = await page.locator('body').isVisible();
    expect(bodyExists).toBe(true);

    const hasNoFatalReactErrors = !page.errors.some(error =>
      error.includes('React') ||
      error.includes('Cannot read properties of undefined') ||
      error.includes('Uncaught TypeError')
    );

    if (!hasNoFatalReactErrors) {
      console.log('React-related errors found:', page.errors.filter(error =>
        error.includes('React') ||
        error.includes('Cannot read properties of undefined') ||
        error.includes('Uncaught TypeError')
      ));
    }

    expect(hasNoFatalReactErrors, 'No fatal React errors should occur').toBe(true);

    console.log('✅ React application initialized successfully');
  });
});
const { test, expect } = require('@playwright/test');

test('Verify /api/invoices/user endpoint works without 500 errors', async ({ page, context }) => {
  // Track all network requests
  const apiCalls = [];

  page.on('response', response => {
    const url = response.url();
    const status = response.status();

    // Track all API calls
    if (url.includes('/api/')) {
      apiCalls.push({
        url,
        status,
        ok: response.ok()
      });

      console.log(`📡 API Call: ${url.split('.com')[1]} - Status: ${status}`);

      // Specifically check for the invoice endpoint
      if (url.includes('/api/invoices/user')) {
        if (status === 500) {
          console.log('❌ 500 ERROR ON /api/invoices/user!');
        } else if (status === 200) {
          console.log('✅ /api/invoices/user returned successfully!');
        }
      }
    }
  });

  // Navigate to the site
  console.log('\n📍 Step 1: Navigating to https://mginvoices.com');
  await page.goto('https://mginvoices.com');
  await page.waitForLoadState('networkidle');

  // Take a screenshot of initial state
  await page.screenshot({ path: 'test-results/initial-page.png' });

  // Check if we need to log in
  const loginModal = await page.locator('#loginModal').isVisible().catch(() => false);
  const loginBtn = await page.locator('#loginBtn').isVisible().catch(() => false);
  const authSection = await page.locator('.auth-section').isVisible().catch(() => false);

  console.log('📍 Step 2: Checking login state');
  console.log(`  - Login modal visible: ${loginModal}`);
  console.log(`  - Login button visible: ${loginBtn}`);
  console.log(`  - Auth section visible: ${authSection}`);

  if (loginModal || loginBtn || authSection) {
    console.log('\n🔐 Step 3: Logging in with test credentials');

    // Try different login selectors
    const emailInput = await page.locator('#loginEmail').isVisible()
      ? '#loginEmail'
      : 'input[type="email"], input[name="email"]';

    const passwordInput = await page.locator('#loginPassword').isVisible()
      ? '#loginPassword'
      : 'input[type="password"], input[name="password"]';

    await page.fill(emailInput, 'test@marinegroupbw.com');
    await page.fill(passwordInput, 'TempPassword123!');

    // Take screenshot before clicking login
    await page.screenshot({ path: 'test-results/before-login.png' });

    // Click the login button
    const loginButton = page.locator('#loginBtn, button:has-text("Login"), button[type="submit"]').first();
    await loginButton.click();

    console.log('  - Credentials entered and login clicked');
  }

  // Wait for the page to stabilize after login
  console.log('\n📍 Step 4: Waiting for page to load after login');
  await page.waitForTimeout(5000);

  // Take screenshot after login
  await page.screenshot({ path: 'test-results/after-login.png' });

  // Check if /api/invoices/user was called
  console.log('\n📊 ANALYSIS OF API CALLS:');
  console.log(`Total API calls made: ${apiCalls.length}`);

  const invoiceApiCalls = apiCalls.filter(call => call.url.includes('/api/invoices/user'));
  const failedInvoiceApiCalls = invoiceApiCalls.filter(call => call.status === 500);

  console.log(`\n/api/invoices/user calls: ${invoiceApiCalls.length}`);
  if (invoiceApiCalls.length > 0) {
    invoiceApiCalls.forEach(call => {
      console.log(`  - Status: ${call.status} ${call.ok ? '✅' : '❌'}`);
    });
  }

  // Final verdict
  console.log('\n🎯 FINAL VERDICT:');
  if (failedInvoiceApiCalls.length > 0) {
    console.log('❌ STILL GETTING 500 ERRORS FROM /api/invoices/user');
    console.log('The endpoint is still broken and needs fixing!');
  } else if (invoiceApiCalls.length === 0) {
    console.log('⚠️ WARNING: /api/invoices/user was never called');
    console.log('The app may not be reaching the point where it syncs invoices');
  } else {
    console.log('✅ SUCCESS: /api/invoices/user is working without 500 errors!');
    console.log('The fix has been successful!');
  }

  // Assert no 500 errors
  expect(failedInvoiceApiCalls.length, 'Should have no 500 errors from /api/invoices/user').toBe(0);
});
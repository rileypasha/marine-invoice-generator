const { test, expect } = require('@playwright/test');

test('Final verification - Login and check for 500 errors', async ({ page }) => {
  // Track network errors
  let has500Error = false;
  let invoiceApiStatus = null;

  page.on('response', response => {
    const url = response.url();
    const status = response.status();

    // Log all API calls
    if (url.includes('/api/')) {
      console.log(`📡 ${url.split('.com')[1]} - ${status}`);

      // Specifically track the invoice endpoint
      if (url.includes('/api/invoices/user')) {
        invoiceApiStatus = status;
        if (status === 500) {
          has500Error = true;
          console.log('❌ 500 ERROR DETECTED on /api/invoices/user!');
        } else {
          console.log('✅ /api/invoices/user responded with status:', status);
        }
      }
    }
  });

  // Navigate to the login page
  console.log('\n🌐 Navigating to https://mginvoices.com/form-login');
  await page.goto('https://mginvoices.com/form-login', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait for the login form to be visible
  await page.waitForTimeout(2000);

  // Fill in the login form
  console.log('📝 Filling login form...');
  await page.fill('input[name="email"]', 'test@marinegroupbw.com');
  await page.fill('input[name="password"]', 'TempPassword123!');

  // Submit the form
  console.log('🔐 Submitting login...');
  await page.click('button[type="submit"]');

  // Wait for redirect to main app
  console.log('⏳ Waiting for app to load after login...');
  await page.waitForTimeout(8000);

  // Check the current URL
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);

  // Final report
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL VERIFICATION REPORT:');
  console.log('='.repeat(50));

  if (invoiceApiStatus === null) {
    console.log('⚠️ /api/invoices/user was NOT called');
    console.log('   This means the app may not be syncing invoices');
  } else if (invoiceApiStatus === 500) {
    console.log('❌ FAILED: /api/invoices/user returned 500');
    console.log('   The fix did not work - still getting errors!');
  } else {
    console.log('✅ SUCCESS: /api/invoices/user is working!');
    console.log(`   Status: ${invoiceApiStatus}`);
    console.log('   The fix has resolved the issue!');
  }

  console.log('='.repeat(50));

  // Assert
  expect(has500Error, 'Should not have 500 errors').toBe(false);
});
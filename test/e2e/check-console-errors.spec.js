const { test, expect } = require('@playwright/test');

test('Check production site for console errors after login', async ({ page }) => {
  // Collect all console messages
  const consoleMessages = [];
  const consoleErrors = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });

    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Navigate to the site
  console.log('📍 Navigating to https://mginvoices.com');
  await page.goto('https://mginvoices.com', { waitUntil: 'networkidle' });

  // Wait for the page to fully load
  await page.waitForTimeout(2000);

  // Check if we have a login modal or login page
  const loginModal = page.locator('#loginModal');
  const modalVisible = await loginModal.isVisible().catch(() => false);

  if (modalVisible) {
    console.log('🔐 Login modal found, logging in...');

    // Fill in credentials
    await page.fill('#loginEmail', 'test@marinegroupbw.com');
    await page.fill('#loginPassword', 'TempPassword123!');

    // Click login button
    await page.click('#loginBtn');
  } else {
    // Check for login form on page
    const loginForm = page.locator('form').filter({ hasText: 'Login' });
    if (await loginForm.isVisible().catch(() => false)) {
      console.log('🔐 Login form found, logging in...');
      await page.fill('input[type="email"]', 'test@marinegroupbw.com');
      await page.fill('input[type="password"]', 'TempPassword123!');
      await page.click('button[type="submit"]');
    }
  }

  // Wait for navigation after login
  await page.waitForTimeout(5000);

  // Check for the specific 500 error
  const has500Error = consoleErrors.some(error =>
    error.includes('500') ||
    error.includes('Failed to load resource') ||
    error.includes('Server sync failed')
  );

  // Check for the specific Prisma error we were seeing
  const hasPrismaError = consoleErrors.some(error =>
    error.includes('hasUnreadChanges') ||
    error.includes('does not exist in the current database')
  );

  // Report findings
  console.log('\n📊 CONSOLE ERROR ANALYSIS:');
  console.log('Total console messages:', consoleMessages.length);
  console.log('Total errors:', consoleErrors.length);

  if (has500Error) {
    console.log('❌ STILL HAS 500 ERRORS!');
    console.log('Error details:', consoleErrors.filter(e => e.includes('500')));
  } else {
    console.log('✅ No 500 errors found');
  }

  if (hasPrismaError) {
    console.log('❌ STILL HAS PRISMA/DATABASE ERRORS!');
    console.log('Error details:', consoleErrors.filter(e => e.includes('hasUnreadChanges') || e.includes('database')));
  } else {
    console.log('✅ No Prisma/database errors found');
  }

  if (consoleErrors.length > 0) {
    console.log('\n⚠️ All console errors:');
    consoleErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error.substring(0, 200)}`);
    });
  } else {
    console.log('✅ NO CONSOLE ERRORS - SITE IS CLEAN!');
  }

  // Assert no critical errors
  expect(has500Error, '500 errors should not exist').toBe(false);
  expect(hasPrismaError, 'Prisma/database errors should not exist').toBe(false);
});
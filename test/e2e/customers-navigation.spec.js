const { test, expect } = require('@playwright/test');

test('Customer Navigation Root Cause Analysis', async ({ page }) => {
  // Enable detailed console logging
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(msg.text());
    if (msg.type() === 'error') {
      console.error('❌ Browser Console Error:', msg.text());
    } else if (msg.type() === 'warn') {
      console.warn('⚠️ Browser Console Warning:', msg.text());
    } else {
      console.log('📝 Browser Console:', msg.text());
    }
  });

  // Track network requests
  const networkRequests = [];
  page.on('request', request => {
    networkRequests.push({
      method: request.method(),
      url: request.url()
    });
    console.log('📡 Request:', request.method(), request.url());
  });

  page.on('response', response => {
    if (!response.ok()) {
      console.error('❌ Failed Response:', response.status(), response.url());
    }
  });

  console.log('🔍 Phase 1: Initial Setup and Authentication');

  // Navigate to the site (webpack dev server on port 3000)
  await page.goto('http://localhost:3000');

  // Inject test user into localStorage
  await page.evaluate(() => {
    const testUser = {
      id: 'test-user-1',
      email: 'test@marinegroup.com',
      name: 'Test User'
    };
    localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
    localStorage.setItem('marine_invoice_session', JSON.stringify({
      userId: 'test-user-1',
      timestamp: Date.now(),
      rememberMe: true
    }));
  });

  // Navigate to the main app
  await page.goto('http://localhost:3000/app.html');
  await page.waitForLoadState('networkidle');

  console.log('🔍 Phase 2: Initial State Analysis');

  // Capture initial state
  const initialUrl = page.url();
  console.log('📍 Initial URL:', initialUrl);

  // Check if sidebar is present
  const sidebar = await page.locator('.sidebar').first();
  await expect(sidebar).toBeVisible();
  console.log('✅ Sidebar is visible');

  // Find the customers icon/link (second nav item)
  const customersLink = await page.locator('.sidebar__nav-item').nth(1);
  await expect(customersLink).toBeVisible();
  console.log('✅ Customers link is visible');

  // Check the customers link attributes
  const customersHref = await customersLink.getAttribute('href');
  const customersTitle = await customersLink.getAttribute('title');
  console.log('🔍 Customers link href:', customersHref);
  console.log('🔍 Customers link title:', customersTitle);

  console.log('🔍 Phase 3: Click Event Analysis');

  // Clear previous console messages
  consoleMessages.length = 0;

  // Attempt to click the customers icon
  console.log('🖱️ Clicking Customers icon...');
  await customersLink.click();

  // Wait for any navigation or state changes
  await page.waitForTimeout(2000);

  // Check current URL after click
  const afterClickUrl = page.url();
  console.log('📍 URL after click:', afterClickUrl);

  // Check if any navigation occurred
  const urlChanged = initialUrl !== afterClickUrl;
  console.log('🔄 URL changed:', urlChanged);

  // Check console for errors or navigation events
  const errorMessages = consoleMessages.filter(msg =>
    msg.includes('error') || msg.includes('Error') || msg.includes('fail')
  );

  console.log('🔍 Phase 4: Error Analysis');
  if (errorMessages.length > 0) {
    console.error('❌ Console errors detected:');
    errorMessages.forEach(msg => console.error('  -', msg));
  } else {
    console.log('✅ No console errors detected');
  }

  // Check if customers page content is visible
  const customersContentSelectors = [
    '#customers-page',
    '.customers-page',
    '[data-page="customers"]',
    '.CustomersPage'
  ];

  let customersContentVisible = false;
  for (const selector of customersContentSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        customersContentVisible = true;
        console.log(`✅ Found customers content with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Selector not found, continue
    }
  }

  console.log('🔍 Customers content visible:', customersContentVisible);

  console.log('🔍 Phase 5: Routing Analysis');

  // Check if there's any routing mechanism
  const routingInfo = await page.evaluate(() => {
    return {
      hasHistoryAPI: !!window.history.pushState,
      currentHash: window.location.hash,
      routerExists: !!(window.router || window.Router || document.querySelector('[data-router]')),
      pathName: window.location.pathname,
      href: window.location.href
    };
  });

  console.log('🔍 Routing info:', routingInfo);

  // Check DOM state for any hidden customers sections
  const hiddenCustomersElements = await page.locator('[style*="display: none"]:has-text("customer"), [hidden]:has-text("customer")').count();
  console.log('🔍 Hidden customers elements found:', hiddenCustomersElements);

  // Check if sidebar has any click handlers
  const sidebarEventInfo = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return { sidebarExists: false };

    const customersItem = sidebar.querySelector('.sidebar__nav-item:nth-child(2)');
    return {
      sidebarExists: true,
      customersItemExists: !!customersItem,
      customersItemTagName: customersItem?.tagName,
      customersItemHref: customersItem?.getAttribute('href'),
      customersItemHasOnClick: !!customersItem?.onclick,
      customersItemHasDataAttributes: customersItem ? Array.from(customersItem.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}="${attr.value}"`) : []
    };
  });

  console.log('🔍 Sidebar event info:', sidebarEventInfo);

  console.log('🔍 Phase 6: Network Analysis');

  // Check for customers-related network requests
  const customersRequests = networkRequests.filter(req =>
    req.url.includes('customer') || req.url.includes('Customer')
  );

  console.log('🔍 Customers-related network requests:', customersRequests);

  console.log('🔍 Phase 7: Final Assessment');

  // Summary of findings
  console.log('📊 ROOT CAUSE ANALYSIS SUMMARY:');
  console.log('  1. URL Navigation:', urlChanged ? 'WORKING' : 'BROKEN');
  console.log('  2. Console Errors:', errorMessages.length > 0 ? 'PRESENT' : 'NONE');
  console.log('  3. Customers Content:', customersContentVisible ? 'VISIBLE' : 'HIDDEN');
  console.log('  4. Routing System:', routingInfo.routerExists ? 'PRESENT' : 'MISSING');
  console.log('  5. Click Handler:', sidebarEventInfo.customersItemHref === '#' ? 'PLACEHOLDER' : 'CONFIGURED');
  console.log('  6. Network Activity:', customersRequests.length > 0 ? 'PRESENT' : 'NONE');

  // Root cause determination
  let rootCause = 'UNKNOWN';

  if (sidebarEventInfo.customersItemHref === '#' && !sidebarEventInfo.customersItemHasOnClick) {
    rootCause = 'NO_CLICK_HANDLER - Sidebar link has placeholder href="#" with no click handler';
  } else if (!routingInfo.routerExists && !urlChanged) {
    rootCause = 'NO_ROUTING_SYSTEM - No client-side routing configured';
  } else if (errorMessages.length > 0) {
    rootCause = 'JAVASCRIPT_ERRORS - Console errors preventing navigation';
  } else if (!customersContentVisible && customersRequests.length === 0) {
    rootCause = 'MISSING_CONTENT - No customers page component found';
  }

  console.log('🎯 IDENTIFIED ROOT CAUSE:', rootCause);

  // Export findings for analysis
  await page.evaluate((findings) => {
    window.navigationAnalysis = findings;
  }, {
    rootCause,
    urlChanged,
    errorCount: errorMessages.length,
    customersContentVisible,
    routingExists: routingInfo.routerExists,
    sidebarInfo: sidebarEventInfo,
    networkActivity: customersRequests.length
  });
});

test('Test direct customers page access', async ({ page }) => {
  console.log('🔍 Testing Direct Customers Page Access');

  try {
    // Try to access customers page directly
    await page.goto('http://localhost:3000/customers.html');
    await page.waitForLoadState('networkidle');

    const customersPageLoaded = await page.locator('#customers-page').isVisible().catch(() => false);
    console.log('✅ Direct customers page access:', customersPageLoaded ? 'SUCCESS' : 'FAILED');

    if (customersPageLoaded) {
      console.log('📋 Customers page content is accessible via direct URL');
    }

    // Test if the standalone customers page works
    const pageTitle = await page.title();
    console.log('📄 Customers page title:', pageTitle);

  } catch (error) {
    console.error('❌ Direct customers page access failed:', error.message);
  }
});
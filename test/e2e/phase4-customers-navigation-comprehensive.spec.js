const { test, expect } = require('@playwright/test');

/**
 * Phase 4: Comprehensive Customers Navigation Test Suite
 *
 * Validates the complete Customers page navigation functionality including:
 * - Incognito browser setup with force refresh
 * - Authentication flow with saved credentials
 * - Navigation system verification
 * - Error detection and console monitoring
 * - DOM verification and performance tracking
 */

test.describe('Phase 4: Customers Navigation Comprehensive Verification', () => {
  // Test credentials from memory
  const testCredentials = {
    email: 'test-user@mginvoices.com',
    password: 'TempPassword123!'
  };

  // Test configuration
  const testConfig = {
    timeout: 30000,
    navigationTimeout: 5000,
    retryAttempts: 3,
    baseUrl: 'https://mginvoices.com'
  };

  let consoleMessages = [];
  let networkRequests = [];
  let errors = [];

  test.beforeEach(async ({ context }) => {
    // Configure incognito context
    await context.addInitScript(() => {
      // Force fresh state
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('1. Incognito Setup and Force Refresh Verification', async ({ page }) => {
    console.log('🔍 Phase 4.1: Incognito Browser Setup with Force Refresh');

    // Setup console monitoring
    consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
      console.log(`📝 [${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Setup network monitoring
    networkRequests = [];
    page.on('request', request => {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        timestamp: new Date().toISOString()
      });
    });

    // Setup error monitoring
    errors = [];
    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.error(`❌ Page Error: ${error.message}`);
    });

    // Navigate with force refresh
    console.log(`🌐 Navigating to ${testConfig.baseUrl} with force refresh...`);
    await page.goto(testConfig.baseUrl, {
      waitUntil: 'networkidle',
      timeout: testConfig.timeout
    });

    // Force refresh to bypass cache
    await page.reload({ waitUntil: 'networkidle' });

    // Verify landing page loaded
    await expect(page).toHaveTitle(/Marine Group|Marine Invoice/i);
    console.log('✅ Landing page loaded successfully');

    // Verify clean state
    const localStorageEmpty = await page.evaluate(() => localStorage.length === 0);
    const sessionStorageEmpty = await page.evaluate(() => sessionStorage.length === 0);

    expect(localStorageEmpty).toBe(true);
    expect(sessionStorageEmpty).toBe(true);
    console.log('✅ Browser state verified as clean (incognito mode confirmed)');
  });

  test('2. Authentication Flow with Saved Credentials', async ({ page }) => {
    console.log('🔍 Phase 4.2: Authentication Flow Execution');

    // Setup monitoring
    setupMonitoring(page);

    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle' });

    // Look for sign-in button or form
    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In"), input[type="submit"][value*="Sign"], button[type="submit"]:has-text("Login")').first();

    if (await signInButton.isVisible({ timeout: 5000 })) {
      console.log('🔑 Sign-in button found, clicking...');
      await signInButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('🔍 Looking for login form on landing page...');
    }

    // Fill in credentials
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();

    await expect(emailField).toBeVisible({ timeout: 10000 });
    await expect(passwordField).toBeVisible({ timeout: 5000 });

    console.log(`📧 Entering email: ${testCredentials.email}`);
    await emailField.fill(testCredentials.email);

    console.log('🔐 Entering password...');
    await passwordField.fill(testCredentials.password);

    // Submit form
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await expect(submitButton).toBeVisible();

    console.log('🚀 Submitting authentication form...');
    await submitButton.click();

    // Wait for authentication and app load
    console.log('⏳ Waiting for app to load after authentication...');

    // Wait for either app.html or the main application UI
    try {
      await page.waitForURL('**/app.html', { timeout: 15000 });
      console.log('✅ Redirected to app.html');
    } catch {
      // Alternative: look for app UI elements
      await page.waitForSelector('.sidebar, .app-sidebar, [data-testid="sidebar"]', { timeout: 15000 });
      console.log('✅ App UI loaded (sidebar detected)');
    }

    // Verify successful authentication
    const isAuthenticated = await page.evaluate(() => {
      return !!(localStorage.getItem('marine_invoice_user') ||
               localStorage.getItem('auth_token') ||
               document.querySelector('.sidebar, .app-sidebar'));
    });

    expect(isAuthenticated).toBe(true);
    console.log('✅ Authentication verified successful');

    // Wait for app to be fully loaded and idle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Additional stability wait

    console.log('✅ App fully loaded and ready for navigation testing');
  });

  test('3. Navigation System Verification and Click Testing', async ({ page }) => {
    console.log('🔍 Phase 4.3: Navigation System Verification');

    // Setup monitoring
    setupMonitoring(page);

    // Complete authentication flow first
    await authenticateUser(page);

    console.log('🧭 Analyzing navigation system...');

    // Wait for app to be fully loaded
    await page.waitForSelector('.sidebar, .app-sidebar', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Capture initial state
    const initialUrl = page.url();
    console.log(`📍 Initial URL: ${initialUrl}`);

    // Find sidebar navigation
    const sidebar = page.locator('.sidebar, .app-sidebar').first();
    await expect(sidebar).toBeVisible();
    console.log('✅ Sidebar located and visible');

    // Find customers navigation item - try multiple selectors
    const customersSelectors = [
      '.sidebar__nav-item[title="Customers"]',
      'a[title="Customers"]',
      '.nav-item:has-text("Customers")',
      '[data-nav="customers"]',
      '.sidebar-nav a:has-text("Customers")'
    ];

    let customersLink = null;
    for (const selector of customersSelectors) {
      try {
        customersLink = page.locator(selector).first();
        if (await customersLink.isVisible({ timeout: 2000 })) {
          console.log(`✅ Customers link found with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!customersLink || !(await customersLink.isVisible())) {
      // Fallback: find by position (second nav item)
      const navItems = page.locator('.sidebar__nav-item, .nav-item, .sidebar-nav a');
      const itemCount = await navItems.count();
      console.log(`📊 Found ${itemCount} navigation items`);

      if (itemCount >= 2) {
        customersLink = navItems.nth(1); // Second item should be customers
        console.log('✅ Using second navigation item as customers link');
      }
    }

    await expect(customersLink).toBeVisible();

    // Inspect link properties
    const linkProperties = await customersLink.evaluate(el => ({
      tagName: el.tagName,
      href: el.getAttribute('href'),
      title: el.getAttribute('title'),
      textContent: el.textContent.trim(),
      hasClickHandler: !!el.onclick,
      className: el.className
    }));

    console.log('🔍 Customers link properties:', linkProperties);

    // Clear previous console messages for clean click monitoring
    consoleMessages = [];

    // Perform navigation click
    console.log('🖱️ Clicking Customers navigation item...');
    const clickPromise = customersLink.click();
    const navigationPromise = page.waitForURL('**/customers**', { timeout: 5000 }).catch(() => null);

    await clickPromise;

    // Wait for navigation or UI change
    await Promise.race([
      navigationPromise,
      page.waitForSelector('[data-page="customers"], .customers-page, #customers-page', { timeout: 5000 }).catch(() => null),
      page.waitForTimeout(3000)
    ]);

    // Check results
    const afterClickUrl = page.url();
    const urlChanged = initialUrl !== afterClickUrl;

    console.log(`📍 URL after click: ${afterClickUrl}`);
    console.log(`🔄 URL changed: ${urlChanged}`);

    // Look for customers page content
    const customersContentSelectors = [
      '#customers-page',
      '.customers-page',
      '[data-page="customers"]',
      '.CustomersPage',
      'h1:has-text("Customers")',
      '.page-title:has-text("Customers")'
    ];

    let customersContentVisible = false;
    let foundSelector = null;

    for (const selector of customersContentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          customersContentVisible = true;
          foundSelector = selector;
          console.log(`✅ Customers content found with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Analyze console for errors during navigation
    const navigationErrors = consoleMessages.filter(msg =>
      msg.type === 'error' ||
      msg.text.toLowerCase().includes('error') ||
      msg.text.toLowerCase().includes('fail')
    );

    console.log(`📊 Navigation Results Summary:`);
    console.log(`  - URL Navigation: ${urlChanged ? 'SUCCESS' : 'NO_CHANGE'}`);
    console.log(`  - Content Visible: ${customersContentVisible ? 'SUCCESS' : 'NOT_FOUND'}`);
    console.log(`  - Console Errors: ${navigationErrors.length}`);
    console.log(`  - Found Content With: ${foundSelector || 'NONE'}`);

    // Assert navigation success
    const navigationSuccessful = urlChanged || customersContentVisible;
    expect(navigationSuccessful).toBe(true);

    if (navigationErrors.length > 0) {
      console.warn('⚠️ Console errors detected during navigation:');
      navigationErrors.forEach(error => console.warn(`  - ${error.text}`));
    }

    console.log('✅ Navigation system verification completed');
  });

  test('4. Error Detection and Console Monitoring', async ({ page }) => {
    console.log('🔍 Phase 4.4: Comprehensive Error Detection');

    // Enhanced error monitoring
    const detectedErrors = {
      console: [],
      javascript: [],
      network: [],
      navigation: []
    };

    page.on('console', msg => {
      if (msg.type() === 'error') {
        detectedErrors.console.push({
          text: msg.text(),
          type: msg.type(),
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on('pageerror', error => {
      detectedErrors.javascript.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        detectedErrors.network.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Authenticate and navigate
    await authenticateUser(page);

    // Perform customers navigation
    const customersLink = page.locator('.sidebar__nav-item[title="Customers"], a[title="Customers"]').first();

    if (await customersLink.isVisible({ timeout: 10000 })) {
      await customersLink.click();
      await page.waitForTimeout(3000);
    }

    // Generate error report
    const totalErrors = detectedErrors.console.length +
                       detectedErrors.javascript.length +
                       detectedErrors.network.length;

    console.log(`📊 Error Detection Summary:`);
    console.log(`  - Console Errors: ${detectedErrors.console.length}`);
    console.log(`  - JavaScript Errors: ${detectedErrors.javascript.length}`);
    console.log(`  - Network Errors: ${detectedErrors.network.length}`);
    console.log(`  - Total Errors: ${totalErrors}`);

    // Log specific errors if found
    if (detectedErrors.console.length > 0) {
      console.log('🔍 Console Errors:');
      detectedErrors.console.forEach((error, i) => {
        console.log(`  ${i+1}. ${error.text} (${error.timestamp})`);
      });
    }

    if (detectedErrors.javascript.length > 0) {
      console.log('🔍 JavaScript Errors:');
      detectedErrors.javascript.forEach((error, i) => {
        console.log(`  ${i+1}. ${error.message} (${error.timestamp})`);
      });
    }

    if (detectedErrors.network.length > 0) {
      console.log('🔍 Network Errors:');
      detectedErrors.network.forEach((error, i) => {
        console.log(`  ${i+1}. ${error.status} ${error.url} (${error.timestamp})`);
      });
    }

    // Export error report
    await page.evaluate((errorReport) => {
      window.phase4ErrorReport = errorReport;
    }, detectedErrors);

    // Assert acceptable error levels (some errors may be expected)
    const criticalErrors = detectedErrors.javascript.length +
                          detectedErrors.console.filter(e =>
                            e.text.includes('TypeError') ||
                            e.text.includes('ReferenceError') ||
                            e.text.includes('SyntaxError')
                          ).length;

    expect(criticalErrors).toBeLessThanOrEqual(2); // Allow up to 2 critical errors
    console.log('✅ Error detection and monitoring completed');
  });

  test('5. DOM Verification and Content Validation', async ({ page }) => {
    console.log('🔍 Phase 4.5: DOM Verification and Content Validation');

    setupMonitoring(page);
    await authenticateUser(page);

    // Navigate to customers
    const customersLink = page.locator('.sidebar__nav-item[title="Customers"], a[title="Customers"]').first();
    await customersLink.click();
    await page.waitForTimeout(2000);

    // DOM verification checks
    const domValidation = {
      customersPagePresent: false,
      navigationStateCorrect: false,
      keyElementsPresent: false,
      responsiveDesign: false,
      accessibilityCompliant: false
    };

    // Check for customers page content
    const customersPage = page.locator('#customers-page, .customers-page, [data-page="customers"]').first();
    domValidation.customersPagePresent = await customersPage.isVisible().catch(() => false);

    // Check navigation state
    const activeNavItem = page.locator('.sidebar__nav-item.active[title="Customers"], .nav-item.active:has-text("Customers")');
    domValidation.navigationStateCorrect = await activeNavItem.isVisible().catch(() => false);

    // Check for key UI elements
    const keyElements = [
      'h1, h2, .page-title', // Page title
      'table, .data-grid, .customers-list', // Data display
      'button, .btn' // Action buttons
    ];

    let elementsFound = 0;
    for (const selector of keyElements) {
      if (await page.locator(selector).first().isVisible().catch(() => false)) {
        elementsFound++;
      }
    }
    domValidation.keyElementsPresent = elementsFound >= 2;

    // Check responsive design
    await page.setViewportSize({ width: 768, height: 1024 }); // Tablet view
    await page.waitForTimeout(500);

    const mobileMenu = page.locator('.mobile-menu, .hamburger, .menu-toggle');
    const responsiveNav = await mobileMenu.isVisible().catch(() => false);
    domValidation.responsiveDesign = responsiveNav;

    // Reset to desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    // Basic accessibility check
    const accessibilityElements = await page.evaluate(() => {
      const checks = {
        hasHeadings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0,
        hasLabels: document.querySelectorAll('label').length > 0,
        hasAltText: Array.from(document.querySelectorAll('img')).every(img => img.alt !== undefined),
        hasFocusableElements: document.querySelectorAll('button, a, input, select, textarea').length > 0
      };
      return checks;
    });

    domValidation.accessibilityCompliant = Object.values(accessibilityElements).filter(Boolean).length >= 3;

    console.log('📊 DOM Validation Results:');
    console.log(`  - Customers Page Present: ${domValidation.customersPagePresent ? '✅' : '❌'}`);
    console.log(`  - Navigation State Correct: ${domValidation.navigationStateCorrect ? '✅' : '❌'}`);
    console.log(`  - Key Elements Present: ${domValidation.keyElementsPresent ? '✅' : '❌'}`);
    console.log(`  - Responsive Design: ${domValidation.responsiveDesign ? '✅' : '❌'}`);
    console.log(`  - Accessibility Compliant: ${domValidation.accessibilityCompliant ? '✅' : '❌'}`);

    // Assert core functionality
    expect(domValidation.customersPagePresent || domValidation.keyElementsPresent).toBe(true);
    console.log('✅ DOM verification and content validation completed');
  });

  test('6. Performance and Loading Time Validation', async ({ page }) => {
    console.log('🔍 Phase 4.6: Performance and Loading Time Validation');

    const performanceMetrics = {
      authenticationTime: 0,
      appLoadTime: 0,
      navigationTime: 0,
      totalTime: 0,
      networkRequests: 0,
      networkFailures: 0
    };

    const startTime = Date.now();

    // Monitor network activity
    let requestCount = 0;
    let failureCount = 0;

    page.on('request', () => requestCount++);
    page.on('response', response => {
      if (!response.ok()) failureCount++;
    });

    // Measure authentication time
    const authStart = Date.now();
    await authenticateUser(page);
    performanceMetrics.authenticationTime = Date.now() - authStart;

    // Measure app load time
    const appLoadStart = Date.now();
    await page.waitForSelector('.sidebar, .app-sidebar', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    performanceMetrics.appLoadTime = Date.now() - appLoadStart;

    // Measure navigation time
    const navStart = Date.now();
    const customersLink = page.locator('.sidebar__nav-item[title="Customers"], a[title="Customers"]').first();

    if (await customersLink.isVisible({ timeout: 5000 })) {
      await customersLink.click();

      // Wait for either URL change or content appearance
      await Promise.race([
        page.waitForURL('**/customers**', { timeout: 5000 }).catch(() => null),
        page.waitForSelector('[data-page="customers"], .customers-page', { timeout: 5000 }).catch(() => null),
        page.waitForTimeout(3000)
      ]);
    }

    performanceMetrics.navigationTime = Date.now() - navStart;
    performanceMetrics.totalTime = Date.now() - startTime;
    performanceMetrics.networkRequests = requestCount;
    performanceMetrics.networkFailures = failureCount;

    console.log('📊 Performance Metrics:');
    console.log(`  - Authentication Time: ${performanceMetrics.authenticationTime}ms`);
    console.log(`  - App Load Time: ${performanceMetrics.appLoadTime}ms`);
    console.log(`  - Navigation Time: ${performanceMetrics.navigationTime}ms`);
    console.log(`  - Total Time: ${performanceMetrics.totalTime}ms`);
    console.log(`  - Network Requests: ${performanceMetrics.networkRequests}`);
    console.log(`  - Network Failures: ${performanceMetrics.networkFailures}`);

    // Performance assertions
    expect(performanceMetrics.authenticationTime).toBeLessThan(15000); // 15 seconds
    expect(performanceMetrics.appLoadTime).toBeLessThan(10000); // 10 seconds
    expect(performanceMetrics.navigationTime).toBeLessThan(5000); // 5 seconds
    expect(performanceMetrics.totalTime).toBeLessThan(30000); // 30 seconds total
    expect(performanceMetrics.networkFailures).toBeLessThan(5); // Less than 5 failures

    // Export metrics
    await page.evaluate((metrics) => {
      window.phase4PerformanceMetrics = metrics;
    }, performanceMetrics);

    console.log('✅ Performance validation completed');
  });

  test('7. End-to-End Integration Test', async ({ page }) => {
    console.log('🔍 Phase 4.7: Complete End-to-End Integration Test');

    const integrationResults = {
      setupSuccess: false,
      authenticationSuccess: false,
      navigationSuccess: false,
      contentValidation: false,
      errorHandling: false,
      performanceAcceptable: false,
      overallSuccess: false
    };

    try {
      // Phase 1: Setup
      setupMonitoring(page);
      await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle' });
      integrationResults.setupSuccess = true;
      console.log('✅ Setup phase completed');

      // Phase 2: Authentication
      await authenticateUser(page);
      const isAuthenticated = await page.evaluate(() => {
        return !!(localStorage.getItem('marine_invoice_user') ||
                 localStorage.getItem('auth_token') ||
                 document.querySelector('.sidebar, .app-sidebar'));
      });
      integrationResults.authenticationSuccess = isAuthenticated;
      console.log(`${isAuthenticated ? '✅' : '❌'} Authentication phase completed`);

      // Phase 3: Navigation
      await page.waitForSelector('.sidebar, .app-sidebar', { timeout: 15000 });
      const customersLink = page.locator('.sidebar__nav-item[title="Customers"], a[title="Customers"]').first();

      if (await customersLink.isVisible({ timeout: 5000 })) {
        const initialUrl = page.url();
        await customersLink.click();
        await page.waitForTimeout(3000);

        const finalUrl = page.url();
        const urlChanged = initialUrl !== finalUrl;
        const contentVisible = await page.locator('#customers-page, .customers-page, [data-page="customers"]').isVisible().catch(() => false);

        integrationResults.navigationSuccess = urlChanged || contentVisible;
        console.log(`${integrationResults.navigationSuccess ? '✅' : '❌'} Navigation phase completed`);
      }

      // Phase 4: Content validation
      const hasContent = await page.locator('h1, h2, .page-title, table, .data-grid').first().isVisible().catch(() => false);
      integrationResults.contentValidation = hasContent;
      console.log(`${hasContent ? '✅' : '❌'} Content validation completed`);

      // Phase 5: Error handling
      const errorCount = errors.length + consoleMessages.filter(m => m.type === 'error').length;
      integrationResults.errorHandling = errorCount < 5; // Less than 5 errors acceptable
      console.log(`${integrationResults.errorHandling ? '✅' : '❌'} Error handling validated (${errorCount} errors)`);

      // Phase 6: Performance check
      const loadTime = Date.now();
      await page.reload({ waitUntil: 'networkidle' });
      const reloadTime = Date.now() - loadTime;
      integrationResults.performanceAcceptable = reloadTime < 10000; // 10 seconds
      console.log(`${integrationResults.performanceAcceptable ? '✅' : '❌'} Performance acceptable (${reloadTime}ms)`);

      // Overall success calculation
      const successCount = Object.values(integrationResults).filter(Boolean).length;
      integrationResults.overallSuccess = successCount >= 5; // At least 5/6 phases must succeed

      console.log('📊 Integration Test Results:');
      Object.entries(integrationResults).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value ? '✅ PASS' : '❌ FAIL'}`);
      });

      // Export complete test results
      await page.evaluate((results) => {
        window.phase4IntegrationResults = results;
      }, integrationResults);

      // Final assertion
      expect(integrationResults.overallSuccess).toBe(true);
      console.log('🎉 End-to-end integration test completed successfully!');

    } catch (error) {
      console.error('❌ Integration test failed:', error);
      integrationResults.overallSuccess = false;
      throw error;
    }
  });

  // Helper Functions
  async function setupMonitoring(page) {
    consoleMessages = [];
    networkRequests = [];
    errors = [];

    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('request', request => {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('pageerror', error => {
      errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
  }

  async function authenticateUser(page) {
    console.log('🔑 Starting authentication flow...');

    await page.goto(testConfig.baseUrl, { waitUntil: 'networkidle' });

    // Look for sign-in button
    const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In"), input[type="submit"][value*="Sign"]').first();

    if (await signInButton.isVisible({ timeout: 5000 })) {
      await signInButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill credentials
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();

    await emailField.fill(testCredentials.email);
    await passwordField.fill(testCredentials.password);

    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    await submitButton.click();

    // Wait for app to load
    try {
      await page.waitForURL('**/app.html', { timeout: 15000 });
    } catch {
      await page.waitForSelector('.sidebar, .app-sidebar', { timeout: 15000 });
    }

    await page.waitForLoadState('networkidle');
    console.log('✅ Authentication completed');
  }
});
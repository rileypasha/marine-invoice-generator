const { test, expect } = require('@playwright/test');

/**
 * Phase 4: Production Environment Navigation Test
 *
 * Specifically targets https://mginvoices.com with saved credentials
 * Tests the actual deployed application navigation functionality
 */

test.describe('Phase 4: Production Navigation Verification', () => {
  const productionConfig = {
    baseUrl: 'https://mginvoices.com',
    credentials: {
      email: 'test-user@mginvoices.com',
      password: 'TempPassword123!'
    },
    timeouts: {
      navigation: 30000,
      element: 10000,
      network: 5000
    }
  };

  test.use({
    // Use incognito mode for clean state
    contextOptions: {
      ignoreHTTPSErrors: true,
    }
  });

  test('Production Environment - Complete Navigation Flow', async ({ browser }) => {
    // Create fresh incognito context
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Cache-Control': 'no-cache'
      }
    });

    const page = await context.newPage();

    console.log('🌐 Phase 4: Production Environment Navigation Test');
    console.log(`🎯 Target: ${productionConfig.baseUrl}`);
    console.log(`👤 User: ${productionConfig.credentials.email}`);

    // Monitoring setup
    const testResults = {
      timestamp: new Date().toISOString(),
      navigation: {
        landingPageLoad: false,
        authenticationSuccess: false,
        appLoad: false,
        sidebarPresent: false,
        customersNavigation: false,
        customersPageLoad: false
      },
      performance: {
        landingLoadTime: 0,
        authTime: 0,
        appLoadTime: 0,
        navigationTime: 0,
        totalTime: 0
      },
      errors: {
        console: [],
        javascript: [],
        network: []
      },
      screenshots: []
    };

    const testStartTime = Date.now();

    // Enhanced monitoring
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };

      if (msg.type() === 'error') {
        testResults.errors.console.push(message);
        console.error(`❌ Console Error: ${msg.text()}`);
      } else {
        console.log(`📝 Console [${msg.type()}]: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      const errorInfo = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      testResults.errors.javascript.push(errorInfo);
      console.error(`💥 JavaScript Error: ${error.message}`);
    });

    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        const networkError = {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        };
        testResults.errors.network.push(networkError);
        console.warn(`⚠️ Network Error: ${response.status()} ${response.url()}`);
      }
    });

    try {
      // Phase 1: Landing page load with force refresh
      console.log('📥 Phase 1: Loading landing page with force refresh...');
      const landingStartTime = Date.now();

      await page.goto(productionConfig.baseUrl, {
        waitUntil: 'networkidle',
        timeout: productionConfig.timeouts.navigation
      });

      // Force refresh to bypass cache
      await page.reload({ waitUntil: 'networkidle' });

      testResults.performance.landingLoadTime = Date.now() - landingStartTime;
      testResults.navigation.landingPageLoad = true;

      console.log(`✅ Landing page loaded in ${testResults.performance.landingLoadTime}ms`);

      // Take screenshot of landing page
      const landingScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'landing-page',
        timestamp: new Date().toISOString()
      });

      // Phase 2: Authentication
      console.log('🔐 Phase 2: Authentication flow...');
      const authStartTime = Date.now();

      // Look for login form or sign-in button
      const loginTriggers = [
        'button:has-text("Sign In")',
        'a:has-text("Sign In")',
        'button:has-text("Login")',
        'a:has-text("Login")',
        '.login-btn',
        '.signin-btn'
      ];

      let loginTriggered = false;
      for (const trigger of loginTriggers) {
        try {
          const element = page.locator(trigger).first();
          if (await element.isVisible({ timeout: 3000 })) {
            console.log(`🔍 Found login trigger: ${trigger}`);
            await element.click();
            await page.waitForTimeout(1000);
            loginTriggered = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Fill credentials
      const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      const passwordField = page.locator('input[type="password"], input[name="password"]').first();

      await expect(emailField).toBeVisible({ timeout: productionConfig.timeouts.element });
      await expect(passwordField).toBeVisible({ timeout: productionConfig.timeouts.element });

      console.log(`📧 Entering email: ${productionConfig.credentials.email}`);
      await emailField.clear();
      await emailField.fill(productionConfig.credentials.email);

      console.log('🔑 Entering password...');
      await passwordField.clear();
      await passwordField.fill(productionConfig.credentials.password);

      // Submit authentication
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Login")',
        '.submit-btn',
        '.login-submit'
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitBtn = page.locator(selector).first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            console.log(`🚀 Submitting with: ${selector}`);
            await submitBtn.click();
            submitted = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      expect(submitted).toBe(true);

      // Wait for authentication success
      try {
        await page.waitForURL('**/app.html', { timeout: 15000 });
        console.log('✅ Redirected to app.html');
      } catch {
        // Alternative: wait for app UI
        await page.waitForSelector('.sidebar, .app-sidebar, [data-testid="sidebar"]', { timeout: 15000 });
        console.log('✅ App UI detected');
      }

      testResults.performance.authTime = Date.now() - authStartTime;
      testResults.navigation.authenticationSuccess = true;

      console.log(`✅ Authentication completed in ${testResults.performance.authTime}ms`);

      // Phase 3: App loading and sidebar detection
      console.log('⚙️ Phase 3: App loading verification...');
      const appLoadStartTime = Date.now();

      await page.waitForLoadState('networkidle');

      // Verify sidebar presence
      const sidebarSelectors = [
        '.sidebar',
        '.app-sidebar',
        '[data-testid="sidebar"]',
        '.navigation',
        '.nav-sidebar'
      ];

      let sidebarFound = false;
      let sidebarSelector = null;

      for (const selector of sidebarSelectors) {
        try {
          const sidebar = page.locator(selector).first();
          if (await sidebar.isVisible({ timeout: 5000 })) {
            sidebarFound = true;
            sidebarSelector = selector;
            console.log(`✅ Sidebar found with: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      testResults.navigation.sidebarPresent = sidebarFound;
      testResults.navigation.appLoad = true;
      testResults.performance.appLoadTime = Date.now() - appLoadStartTime;

      console.log(`✅ App loaded in ${testResults.performance.appLoadTime}ms`);

      // Take screenshot of loaded app
      const appScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'app-loaded',
        timestamp: new Date().toISOString()
      });

      // Phase 4: Customers navigation
      console.log('🧭 Phase 4: Customers navigation test...');
      const navStartTime = Date.now();

      await page.waitForTimeout(2000); // Stability wait

      // Find customers navigation
      const customersSelectors = [
        '.sidebar__nav-item[title="Customers"]',
        'a[title="Customers"]',
        '.nav-item:has-text("Customers")',
        '[data-nav="customers"]',
        '.sidebar-nav a:has-text("Customers")',
        '.sidebar .nav-link:has-text("Customers")'
      ];

      let customersLink = null;
      let customersSelector = null;

      for (const selector of customersSelectors) {
        try {
          const link = page.locator(selector).first();
          if (await link.isVisible({ timeout: 3000 })) {
            customersLink = link;
            customersSelector = selector;
            console.log(`✅ Customers link found with: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!customersLink) {
        // Fallback: try by position (usually second nav item)
        const navItems = page.locator(`${sidebarSelector} a, ${sidebarSelector} .nav-item`);
        const itemCount = await navItems.count();
        console.log(`📊 Found ${itemCount} navigation items total`);

        if (itemCount >= 2) {
          customersLink = navItems.nth(1); // Second item
          customersSelector = 'nav-item[1]';
          console.log('✅ Using second navigation item as customers');
        }
      }

      expect(customersLink).toBeTruthy();

      // Capture initial state
      const initialUrl = page.url();
      console.log(`📍 Initial URL: ${initialUrl}`);

      // Perform navigation click
      console.log('🖱️ Clicking customers navigation...');
      await customersLink.click();

      // Wait for navigation result
      const navigationPromises = [
        page.waitForURL('**/customers**', { timeout: 5000 }).catch(() => null),
        page.waitForSelector('[data-page="customers"], .customers-page, #customers-page', { timeout: 5000 }).catch(() => null),
        page.waitForTimeout(3000)
      ];

      await Promise.race(navigationPromises);

      // Check navigation results
      const finalUrl = page.url();
      const urlChanged = initialUrl !== finalUrl;

      console.log(`📍 Final URL: ${finalUrl}`);
      console.log(`🔄 URL Changed: ${urlChanged}`);

      // Check for customers content
      const customersContentSelectors = [
        '#customers-page',
        '.customers-page',
        '[data-page="customers"]',
        '.CustomersPage',
        'h1:has-text("Customers")',
        '.page-title:has-text("Customers")',
        '.content-header:has-text("Customers")'
      ];

      let customersContentVisible = false;
      let foundContentSelector = null;

      for (const selector of customersContentSelectors) {
        try {
          const content = page.locator(selector).first();
          if (await content.isVisible({ timeout: 3000 })) {
            customersContentVisible = true;
            foundContentSelector = selector;
            console.log(`✅ Customers content found with: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      testResults.navigation.customersNavigation = urlChanged;
      testResults.navigation.customersPageLoad = customersContentVisible;
      testResults.performance.navigationTime = Date.now() - navStartTime;

      console.log(`✅ Navigation completed in ${testResults.performance.navigationTime}ms`);

      // Take final screenshot
      const finalScreenshot = await page.screenshot({ fullPage: true });
      testResults.screenshots.push({
        name: 'customers-navigation-complete',
        timestamp: new Date().toISOString()
      });

      // Calculate total time
      testResults.performance.totalTime = Date.now() - testStartTime;

      // Generate comprehensive report
      console.log('\n📊 PHASE 4 PRODUCTION TEST RESULTS:');
      console.log('=' .repeat(50));

      console.log('\n🧭 Navigation Results:');
      Object.entries(testResults.navigation).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value ? '✅ SUCCESS' : '❌ FAILED'}`);
      });

      console.log('\n⚡ Performance Metrics:');
      Object.entries(testResults.performance).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value}ms`);
      });

      console.log('\n🚨 Error Summary:');
      console.log(`  - Console Errors: ${testResults.errors.console.length}`);
      console.log(`  - JavaScript Errors: ${testResults.errors.javascript.length}`);
      console.log(`  - Network Errors: ${testResults.errors.network.length}`);

      if (testResults.errors.console.length > 0) {
        console.log('\n❌ Console Errors:');
        testResults.errors.console.forEach((error, i) => {
          console.log(`  ${i+1}. ${error.text} (${error.timestamp})`);
        });
      }

      if (testResults.errors.javascript.length > 0) {
        console.log('\n💥 JavaScript Errors:');
        testResults.errors.javascript.forEach((error, i) => {
          console.log(`  ${i+1}. ${error.message} (${error.timestamp})`);
        });
      }

      // Success criteria evaluation
      const successCriteria = {
        landingPageLoaded: testResults.navigation.landingPageLoad,
        authenticationWorking: testResults.navigation.authenticationSuccess,
        appLoadedCorrectly: testResults.navigation.appLoad && testResults.navigation.sidebarPresent,
        navigationFunctional: testResults.navigation.customersNavigation || testResults.navigation.customersPageLoad,
        performanceAcceptable: testResults.performance.totalTime < 45000, // 45 seconds total
        errorLevelsAcceptable: (testResults.errors.console.length + testResults.errors.javascript.length) < 5
      };

      const successCount = Object.values(successCriteria).filter(Boolean).length;
      const totalCriteria = Object.keys(successCriteria).length;
      const successRate = (successCount / totalCriteria) * 100;

      console.log('\n🎯 Success Criteria:');
      Object.entries(successCriteria).forEach(([key, value]) => {
        console.log(`  - ${key}: ${value ? '✅ PASS' : '❌ FAIL'}`);
      });

      console.log(`\n📈 Overall Success Rate: ${successRate.toFixed(1)}% (${successCount}/${totalCriteria})`);

      // Export test results to window for analysis
      await page.evaluate((results) => {
        window.phase4ProductionResults = results;
      }, testResults);

      // Assertions for test success
      expect(testResults.navigation.landingPageLoad).toBe(true);
      expect(testResults.navigation.authenticationSuccess).toBe(true);
      expect(testResults.navigation.appLoad).toBe(true);
      expect(testResults.navigation.sidebarPresent).toBe(true);

      // Navigation success (either URL change OR content visible)
      const navigationSuccess = testResults.navigation.customersNavigation || testResults.navigation.customersPageLoad;
      expect(navigationSuccess).toBe(true);

      // Performance requirements
      expect(testResults.performance.totalTime).toBeLessThan(45000); // 45 seconds max
      expect(testResults.performance.authTime).toBeLessThan(20000); // 20 seconds auth max

      // Error tolerance
      const totalErrors = testResults.errors.console.length + testResults.errors.javascript.length;
      expect(totalErrors).toBeLessThan(5); // Less than 5 total errors

      console.log('\n🎉 PHASE 4 PRODUCTION TEST COMPLETED SUCCESSFULLY!');
      console.log(`✅ All critical navigation functionality verified on ${productionConfig.baseUrl}`);

    } catch (error) {
      console.error('\n❌ PHASE 4 PRODUCTION TEST FAILED:');
      console.error(error.message);

      // Take error screenshot
      try {
        await page.screenshot({
          path: `/mnt/c/Users/riley/Desktop/marine-group (2)/marine-group/marine-invoice-generator/test-results/phase4-error-${Date.now()}.png`,
          fullPage: true
        });
      } catch (screenshotError) {
        console.error('Failed to take error screenshot:', screenshotError);
      }

      throw error;
    } finally {
      await context.close();
    }
  });

  test('Production Environment - Quick Smoke Test', async ({ page }) => {
    console.log('🚀 Quick smoke test for production navigation');

    // Go directly to production
    await page.goto(productionConfig.baseUrl);

    // Quick auth test
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.isVisible({ timeout: 10000 })) {
      await emailField.fill(productionConfig.credentials.email);

      const passwordField = page.locator('input[type="password"]').first();
      await passwordField.fill(productionConfig.credentials.password);

      const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first();
      await submitBtn.click();

      // Quick verification
      try {
        await page.waitForSelector('.sidebar, .app-sidebar', { timeout: 20000 });
        console.log('✅ Quick smoke test passed - app loaded successfully');
      } catch {
        await page.waitForURL('**/app.html', { timeout: 20000 });
        console.log('✅ Quick smoke test passed - redirected to app');
      }
    }

    // Verify basic navigation exists
    const customersNav = page.locator('a[title="Customers"], .nav-item:has-text("Customers")').first();
    const navExists = await customersNav.isVisible({ timeout: 5000 });

    expect(navExists).toBe(true);
    console.log('✅ Customers navigation element confirmed present');
  });
});
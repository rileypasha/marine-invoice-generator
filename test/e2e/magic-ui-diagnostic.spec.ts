import { test, expect } from '@playwright/test';

test.describe('Magic UI Diagnostic Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Set up authentication first
    await page.goto('http://localhost:3000');

    await page.evaluate(() => {
      localStorage.setItem('marine_invoice_user', JSON.stringify({
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com'
      }));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: 'test-user-1',
        timestamp: Date.now(),
        rememberMe: true
      }));
    });

    // Navigate to app
    await page.goto('http://localhost:3000/app');
    await page.waitForLoadState('networkidle');
  });

  test('should diagnose current page state and React integration', async ({ page }) => {
    // Wait for page to settle
    await page.waitForTimeout(3000);

    console.log('=== MAGIC UI DIAGNOSTIC REPORT ===');

    // 1. Check what's actually rendered
    const pageTitle = await page.title();
    console.log(`Page Title: ${pageTitle}`);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // 2. Check for React containers
    const reactContainer = await page.locator('#react-invoice-editor').count();
    console.log(`React Invoice Editor Container: ${reactContainer > 0 ? '✅ Found' : '❌ Missing'}`);

    // 3. Check for Magic UI components
    const magicUIElements = await page.locator('[class*="min-h-screen"], [class*="bg-background"]').count();
    console.log(`Magic UI Elements: ${magicUIElements} found`);

    // 4. Check for traditional form elements
    const traditionalTabs = await page.locator('.tab-button').count();
    console.log(`Traditional Tab Buttons: ${traditionalTabs} found`);

    const traditionalForms = await page.locator('.tab-panel').count();
    console.log(`Traditional Form Panels: ${traditionalForms} found`);

    // 5. Check for individual React containers
    const vesselContainer = await page.locator('#vessel-form-container').count();
    const customerContainer = await page.locator('#customer-form-container').count();
    const servicesContainer = await page.locator('#services-form-container').count();
    const notesContainer = await page.locator('#notes-form-container').count();
    const previewContainer = await page.locator('#invoice-preview-container').count();

    console.log(`Vessel Form Container: ${vesselContainer > 0 ? '✅ Found' : '❌ Missing'}`);
    console.log(`Customer Form Container: ${customerContainer > 0 ? '✅ Found' : '❌ Missing'}`);
    console.log(`Services Form Container: ${servicesContainer > 0 ? '✅ Found' : '❌ Missing'}`);
    console.log(`Notes Form Container: ${notesContainer > 0 ? '✅ Found' : '❌ Missing'}`);
    console.log(`Preview Container: ${previewContainer > 0 ? '✅ Found' : '❌ Missing'}`);

    // 6. Check JavaScript errors
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    // 7. Check window.app object
    const appObject = await page.evaluate(() => {
      return {
        appExists: !!window.app,
        reactRootExists: !!(window.app && window.app.reactRoot),
        stateExists: !!(window.app && window.app.state),
        userManagerExists: !!(window.app && window.app.userManager),
        componentsInitialized: !!(window.app && window.app.vesselForm && window.app.customerForm)
      };
    });

    console.log('App Object Status:');
    Object.entries(appObject).forEach(([key, value]) => {
      console.log(`  ${key}: ${value ? '✅' : '❌'}`);
    });

    // 8. Check React errors
    const reactErrors = await page.evaluate(() => {
      const errors = [];
      if (window.React) {
        try {
          // Try to access React components
          const components = window.app?.reactComponents || {};
          return { reactLoaded: true, components: Object.keys(components) };
        } catch (e) {
          errors.push(e.message);
        }
      }
      return { reactLoaded: !!window.React, errors };
    });

    console.log(`React Status: ${reactErrors.reactLoaded ? '✅ Loaded' : '❌ Not Loaded'}`);
    if (reactErrors.errors?.length > 0) {
      console.log('React Errors:', reactErrors.errors);
    }

    // 9. Check for Magic UI style classes
    const tailwindClasses = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const tailwindElements = Array.from(elements).filter(el =>
        el.className && typeof el.className === 'string' &&
        (el.className.includes('rounded') || el.className.includes('shadow') ||
         el.className.includes('border') || el.className.includes('bg-') ||
         el.className.includes('text-'))
      );
      return tailwindElements.length;
    });

    console.log(`Elements with Tailwind Classes: ${tailwindClasses}`);

    // 10. Get main content structure
    const mainContentStructure = await page.evaluate(() => {
      const main = document.querySelector('main, .main-content');
      if (!main) return 'No main element found';

      return {
        tagName: main.tagName,
        classes: main.className,
        childCount: main.children.length,
        innerHTML: main.innerHTML.substring(0, 200) + '...'
      };
    });

    console.log('Main Content Structure:', mainContentStructure);

    // 11. Check for specific Magic UI components
    const magicComponents = await page.evaluate(() => {
      return {
        buttons: document.querySelectorAll('button').length,
        cards: document.querySelectorAll('.card, [class*="border"][class*="rounded"]').length,
        inputs: document.querySelectorAll('input').length,
        selects: document.querySelectorAll('select').length,
        textareas: document.querySelectorAll('textarea').length
      };
    });

    console.log('Form Elements Count:', magicComponents);

    console.log('=== END DIAGNOSTIC REPORT ===');

    // Determine what the current state is
    if (reactContainer > 0) {
      console.log('✅ RESULT: Magic UI React container found - testing React integration');

      // Test React functionality
      await expect(page.locator('#react-invoice-editor')).toBeVisible();

    } else if (traditionalTabs > 0) {
      console.log('⚠️ RESULT: Traditional form detected - Magic UI not properly integrated');

      // Test traditional form is at least working
      await expect(page.locator('.tab-button')).toBeVisible();

    } else {
      console.log('❌ RESULT: No recognizable interface found - major integration issue');

      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-magic-ui-state.png', fullPage: true });
    }
  });

  test('should test authentication flow for Magic UI', async ({ page }) => {
    console.log('=== AUTHENTICATION FLOW TEST ===');

    // Clear storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Go to app without auth
    await page.goto('http://localhost:3000/app');
    await page.waitForTimeout(2000);

    const redirectedUrl = page.url();
    console.log(`URL after no-auth access: ${redirectedUrl}`);

    if (redirectedUrl.includes('/app')) {
      console.log('⚠️ No redirect happened - authentication may be disabled or bypassed');
    } else {
      console.log('✅ Properly redirected to landing page');
    }

    // Set up authentication
    await page.evaluate(() => {
      localStorage.setItem('marine_invoice_user', JSON.stringify({
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });

    // Try accessing app again
    await page.goto('http://localhost:3000/app');
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    console.log(`URL after auth: ${finalUrl}`);

    if (finalUrl.includes('/app')) {
      console.log('✅ Successfully accessed app with authentication');
    } else {
      console.log('❌ Still redirected despite authentication');
    }
  });

  test('should capture detailed JavaScript execution', async ({ page }) => {
    const logs = [];
    const errors = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('APP.JS') || text.includes('React') || text.includes('Magic')) {
        logs.push(`${msg.type()}: ${text}`);
      }
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    page.on('pageerror', err => {
      errors.push(`Page Error: ${err.message}`);
    });

    await page.waitForTimeout(5000); // Let everything initialize

    console.log('=== JAVASCRIPT EXECUTION LOG ===');
    logs.forEach(log => console.log(log));

    console.log('=== JAVASCRIPT ERRORS ===');
    errors.forEach(error => console.log(`ERROR: ${error}`));

    // Check specifically for React mounting
    const reactMountStatus = await page.evaluate(() => {
      return {
        reactRootCreated: !!(window.app && window.app.reactRoot),
        containerExists: !!document.getElementById('react-invoice-editor'),
        appInitialized: !!window.app,
        initReactCalled: window.initReactInvoiceEditorCalled || false
      };
    });

    console.log('=== REACT MOUNT STATUS ===');
    Object.entries(reactMountStatus).forEach(([key, value]) => {
      console.log(`${key}: ${value ? '✅' : '❌'}`);
    });
  });

});
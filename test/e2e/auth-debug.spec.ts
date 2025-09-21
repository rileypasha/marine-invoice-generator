import { test, expect } from '@playwright/test';

test.describe('Authentication Debug', () => {

  test('should debug authentication flow step by step', async ({ page }) => {
    console.log('=== AUTHENTICATION DEBUG STARTED ===');

    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('🔍') || text.includes('🎯') || text.includes('✅') || text.includes('❌') || text.includes('📡') || text.includes('AUTH')) {
        console.log(`CONSOLE: ${text}`);
      }
    });

    // Set up user data in localStorage before going to /app
    await page.goto('http://localhost:3000');

    await page.evaluate(() => {
      console.log('Setting up authentication data...');

      const user = {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com'
      };

      const session = {
        userId: 'test-user-1',
        timestamp: Date.now(),
        rememberMe: true
      };

      localStorage.setItem('marine_invoice_user', JSON.stringify(user));
      localStorage.setItem('marine_invoice_session', JSON.stringify(session));

      console.log('Auth data set:', {
        user: localStorage.getItem('marine_invoice_user'),
        session: localStorage.getItem('marine_invoice_session')
      });
    });

    console.log('✅ Auth data prepared, now navigating to /app...');

    // Navigate to /app and wait for authentication check
    await page.goto('http://localhost:3000/app');

    // Wait longer for authentication check and app initialization
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`Final URL after auth check: ${currentUrl}`);

    if (currentUrl.includes('/app')) {
      console.log('✅ Successfully stayed on /app - checking app initialization...');

      // Check if app initialized
      const appStatus = await page.evaluate(() => {
        return {
          appExists: !!window.app,
          userManagerExists: !!(window.app && window.app.userManager),
          currentUser: window.app && window.app.userManager ? window.app.userManager.getCurrentUser() : null,
          authCheckCompleted: true
        };
      });

      console.log('App Status:', appStatus);

      if (appStatus.appExists) {
        console.log('✅ App object created successfully');

        // Check for React initialization
        const reactStatus = await page.evaluate(() => {
          return {
            reactRootExists: !!(window.app && window.app.reactRoot),
            reactContainerExists: !!document.getElementById('react-invoice-editor'),
            mainContentCleared: document.querySelector('main')?.innerHTML.includes('react-invoice-editor')
          };
        });

        console.log('React Status:', reactStatus);

        if (reactStatus.reactRootExists) {
          console.log('✅ React integration working');
        } else {
          console.log('❌ React integration failed');
        }

      } else {
        console.log('❌ App object not created - likely authentication failed');
      }

    } else {
      console.log('❌ Redirected away from /app - authentication failed');

      // Check what's in localStorage after redirect
      const authDataAfterRedirect = await page.evaluate(() => {
        return {
          user: localStorage.getItem('marine_invoice_user'),
          session: localStorage.getItem('marine_invoice_session'),
          authMethod: localStorage.getItem('auth_method')
        };
      });

      console.log('Auth data after redirect:', authDataAfterRedirect);
    }

    console.log('=== AUTHENTICATION DEBUG COMPLETED ===');
  });

  test('should test server-side authentication endpoint', async ({ page }) => {
    console.log('=== SERVER AUTHENTICATION TEST ===');

    await page.goto('http://localhost:3000');

    // Test the auth check endpoint directly
    const authCheckResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/simple-auth/check', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        return {
          status: response.status,
          ok: response.ok,
          data: response.ok ? await response.json() : null
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });

    console.log('Auth check endpoint response:', authCheckResponse);

    // Test the /me endpoint
    const meResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        return {
          status: response.status,
          ok: response.ok,
          data: response.ok ? await response.json() : null
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });

    console.log('/me endpoint response:', meResponse);

    console.log('=== SERVER AUTHENTICATION TEST COMPLETED ===');
  });

  test('should bypass authentication for testing Magic UI', async ({ page }) => {
    console.log('=== BYPASSING AUTH FOR MAGIC UI TEST ===');

    // Go directly to app and inject a bypass
    await page.goto('http://localhost:3000/app');

    // Inject authentication bypass directly into the page
    await page.evaluate(() => {
      // Create a minimal app object to prevent redirect
      window.app = {
        userManager: {
          getCurrentUser: () => ({ id: 'test-user', name: 'Test User', email: 'test@example.com' }),
          isAuthenticated: () => true,
          currentUser: { id: 'test-user', name: 'Test User', email: 'test@example.com' }
        },
        state: {
          getState: () => ({}),
          reset: () => {},
          getIsEditMode: () => false
        },
        invoiceStorage: {
          hasContent: () => false
        }
      };

      // Set auth data
      localStorage.setItem('marine_invoice_user', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com'
      }));

      console.log('✅ Authentication bypass set up');
    });

    // Wait for any redirects to settle
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`URL after bypass: ${currentUrl}`);

    if (currentUrl.includes('/app')) {
      console.log('✅ Successfully bypassed authentication');

      // Check if the traditional form is visible
      const formElements = await page.evaluate(() => {
        return {
          tabButtons: document.querySelectorAll('.tab-button').length,
          tabPanels: document.querySelectorAll('.tab-panel').length,
          vesselForm: !!document.getElementById('vessel-name'),
          customerForm: !!document.getElementById('customer-name'),
          saveButton: !!document.getElementById('save-invoice')
        };
      });

      console.log('Traditional Form Elements:', formElements);

      if (formElements.vesselForm) {
        console.log('✅ Traditional form is working - can test basic functionality');

        // Test basic form interaction
        await page.fill('#vessel-name', 'Test Vessel Magic UI');
        const vesselValue = await page.inputValue('#vessel-name');
        console.log(`Vessel input value: ${vesselValue}`);

        await page.click('text=Customer');
        await page.fill('#customer-name', 'Test Customer Magic UI');
        const customerValue = await page.inputValue('#customer-name');
        console.log(`Customer input value: ${customerValue}`);

        console.log('✅ Basic form functionality confirmed');
      } else {
        console.log('❌ No form elements found');
      }

    } else {
      console.log('❌ Still being redirected despite bypass');
    }

    console.log('=== BYPASS TEST COMPLETED ===');
  });

});
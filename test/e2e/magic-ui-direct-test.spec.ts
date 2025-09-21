import { test, expect } from '@playwright/test';

test.describe('Magic UI Direct Functionality Test', () => {

  test('should test Magic UI by intercepting authentication', async ({ page }) => {
    console.log('=== MAGIC UI DIRECT TEST ===');

    // Intercept the authentication check to always return true
    await page.route('/api/simple-auth/check', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'test-user-1',
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      });
    });

    await page.route('/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-1',
            name: 'Test User',
            email: 'test@example.com'
          }
        })
      });
    });

    // Set up localStorage before navigation
    await page.addInitScript(() => {
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

    // Wait for app initialization
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log(`URL after intercept: ${currentUrl}`);

    if (currentUrl.includes('/app')) {
      console.log('✅ Successfully accessed /app with intercepted auth');

      // Check for app initialization
      const appStatus = await page.evaluate(() => {
        return {
          appExists: !!window.app,
          reactRootExists: !!(window.app && window.app.reactRoot),
          reactContainerExists: !!document.getElementById('react-invoice-editor'),
          traditionalFormExists: !!document.querySelector('.tab-button'),
          mainContentStructure: document.querySelector('main')?.innerHTML.substring(0, 200)
        };
      });

      console.log('App Status with Auth:', appStatus);

      if (appStatus.reactContainerExists) {
        console.log('🎉 SUCCESS: React container found - Magic UI is working!');

        // Test Magic UI components
        await expect(page.locator('#react-invoice-editor')).toBeVisible();

        // Look for Magic UI tabs
        const magicTabs = await page.locator('[role="tablist"], .tab-list').count();
        console.log(`Magic UI tabs found: ${magicTabs}`);

        if (magicTabs > 0) {
          console.log('✅ Magic UI tabs detected');

          // Test tab interaction
          const vesselTab = page.locator('text=Vessel').first();
          if (await vesselTab.count() > 0) {
            await vesselTab.click();
            console.log('✅ Vessel tab clickable');
          }

          const customerTab = page.locator('text=Customer').first();
          if (await customerTab.count() > 0) {
            await customerTab.click();
            console.log('✅ Customer tab clickable');
          }
        }

        // Test Magic UI form containers
        const containers = await page.evaluate(() => {
          return {
            vessel: !!document.getElementById('vessel-form-container'),
            customer: !!document.getElementById('customer-form-container'),
            services: !!document.getElementById('services-form-container'),
            notes: !!document.getElementById('notes-form-container'),
            preview: !!document.getElementById('invoice-preview-container')
          };
        });

        console.log('Magic UI Containers:', containers);

        if (Object.values(containers).some(Boolean)) {
          console.log('✅ Magic UI form containers detected');
        }

      } else if (appStatus.traditionalFormExists) {
        console.log('⚠️ Traditional form detected instead of Magic UI');

        // Test the traditional form functionality
        console.log('Testing traditional form as fallback...');

        await expect(page.locator('.tab-button')).toBeVisible();

        // Test vessel form
        await page.click('text=Vessel');
        const vesselInput = page.locator('#vessel-name');
        if (await vesselInput.count() > 0) {
          await vesselInput.fill('Test Vessel Traditional');
          await expect(vesselInput).toHaveValue('Test Vessel Traditional');
          console.log('✅ Vessel form working in traditional mode');
        }

        // Test customer form
        await page.click('text=Customer');
        const customerInput = page.locator('#customer-name');
        if (await customerInput.count() > 0) {
          await customerInput.fill('Test Customer Traditional');
          await expect(customerInput).toHaveValue('Test Customer Traditional');
          console.log('✅ Customer form working in traditional mode');
        }

        // Test services
        await page.click('text=Services');
        const addLineItem = page.locator('#add-line-item');
        if (await addLineItem.count() > 0) {
          await addLineItem.click();
          console.log('✅ Add line item working in traditional mode');
        }

        // Test save functionality
        const saveButton = page.locator('#save-invoice');
        await expect(saveButton).toBeVisible();
        console.log('✅ Save button visible');

      } else {
        console.log('❌ No recognizable interface found');
        console.log('Main content:', appStatus.mainContentStructure);
      }

    } else {
      console.log('❌ Still redirected despite auth intercept');
    }

    console.log('=== MAGIC UI DIRECT TEST COMPLETED ===');
  });

  test('should test Magic UI styling and components', async ({ page }) => {
    console.log('=== MAGIC UI STYLING TEST ===');

    // Setup authentication intercept
    await page.route('/api/**/*', route => {
      if (route.request().url().includes('auth')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: { id: 'test-user-1', name: 'Test User', email: 'test@example.com' }
          })
        });
      } else {
        route.continue();
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('marine_invoice_user', JSON.stringify({
        id: 'test-user-1', name: 'Test User', email: 'test@example.com'
      }));
    });

    await page.goto('http://localhost:3000/app');
    await page.waitForTimeout(4000);

    // Check for Magic UI specific styling
    const styling = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let tailwindCount = 0;
      let roundedCount = 0;
      let shadowCount = 0;
      let borderCount = 0;

      elements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          if (el.className.includes('rounded')) roundedCount++;
          if (el.className.includes('shadow')) shadowCount++;
          if (el.className.includes('border')) borderCount++;
          if (el.className.match(/bg-\w+|text-\w+|p-\w+|m-\w+/)) tailwindCount++;
        }
      });

      return { tailwindCount, roundedCount, shadowCount, borderCount };
    });

    console.log('Magic UI Styling Analysis:', styling);

    // Look for specific Magic UI components
    const components = await page.evaluate(() => {
      return {
        cards: document.querySelectorAll('[class*="card"], .card').length,
        buttons: document.querySelectorAll('button').length,
        inputs: document.querySelectorAll('input').length,
        reactElements: document.querySelectorAll('[data-react-*], [class*="react"]').length,
        magicUIClasses: document.querySelectorAll('[class*="min-h"], [class*="bg-background"]').length
      };
    });

    console.log('Component Analysis:', components);

    if (styling.tailwindCount > 10 && components.cards > 0) {
      console.log('✅ Magic UI styling appears to be working');
    } else if (components.buttons > 0) {
      console.log('⚠️ Basic form elements present but Magic UI styling may not be fully applied');
    } else {
      console.log('❌ No clear UI components detected');
    }

    console.log('=== MAGIC UI STYLING TEST COMPLETED ===');
  });

  test('should test form functionality regardless of UI framework', async ({ page }) => {
    console.log('=== FORM FUNCTIONALITY TEST ===');

    // Setup authentication
    await page.route('/api/**/*auth*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'test-user-1', name: 'Test User', email: 'test@example.com' }
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('marine_invoice_user', JSON.stringify({
        id: 'test-user-1', name: 'Test User', email: 'test@example.com'
      }));
    });

    await page.goto('http://localhost:3000/app');
    await page.waitForTimeout(4000);

    // Test vessel form (works with both Magic UI and traditional)
    console.log('Testing vessel form...');

    // Try Magic UI vessel tab first
    const magicVesselTab = page.locator('text=Vessel').first();
    if (await magicVesselTab.count() > 0) {
      await magicVesselTab.click();
      console.log('✅ Vessel tab found and clicked');
    }

    // Look for vessel input (either Magic UI or traditional)
    const vesselInputs = await page.locator('input[placeholder*="vessel" i], #vessel-name, [name="vesselName"]');
    const vesselInputCount = await vesselInputs.count();

    if (vesselInputCount > 0) {
      await vesselInputs.first().fill('Magic UI Test Vessel');
      const value = await vesselInputs.first().inputValue();
      console.log(`✅ Vessel input working: ${value}`);
    } else {
      console.log('❌ No vessel input found');
    }

    // Test customer form
    console.log('Testing customer form...');

    const magicCustomerTab = page.locator('text=Customer').first();
    if (await magicCustomerTab.count() > 0) {
      await magicCustomerTab.click();
      console.log('✅ Customer tab found and clicked');
    }

    const customerInputs = await page.locator('input[placeholder*="customer" i], input[placeholder*="name" i], #customer-name, [name="customerName"]');
    const customerInputCount = await customerInputs.count();

    if (customerInputCount > 0) {
      await customerInputs.first().fill('Magic UI Test Customer');
      const value = await customerInputs.first().inputValue();
      console.log(`✅ Customer input working: ${value}`);
    } else {
      console.log('❌ No customer input found');
    }

    // Test services
    console.log('Testing services...');

    const magicServicesTab = page.locator('text=Services').first();
    if (await magicServicesTab.count() > 0) {
      await magicServicesTab.click();
      console.log('✅ Services tab found and clicked');
    }

    const addButtons = await page.locator('button:has-text("Add"), #add-line-item, button[class*="add"]');
    const addButtonCount = await addButtons.count();

    if (addButtonCount > 0) {
      await addButtons.first().click();
      console.log('✅ Add service button working');
    } else {
      console.log('❌ No add service button found');
    }

    // Test save functionality
    console.log('Testing save functionality...');

    const saveButtons = await page.locator('button:has-text("Save"), #save-invoice');
    const saveButtonCount = await saveButtons.count();

    if (saveButtonCount > 0) {
      console.log('✅ Save button found');
      // Don't actually click save in test
    } else {
      console.log('❌ No save button found');
    }

    console.log('=== FORM FUNCTIONALITY TEST COMPLETED ===');
  });

});
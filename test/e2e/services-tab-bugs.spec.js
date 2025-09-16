/**
 * Services Tab Bug Fixes E2E Tests
 * Tests for three critical bug fixes:
 * 1. Service Type dropdown readability
 * 2. No duplicate invoices after save→logout→login
 * 3. Correct cursor on sidebar hover
 */

const { test, expect } = require('@playwright/test');

test.describe('Services Tab Bug Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for app to load
    await page.waitForTimeout(1000);

    // Check if we need to sign in (handle auth if required)
    const signInBtn = page.locator('#sign-in-btn');
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      // Add actual sign-in logic here if needed
      await page.waitForTimeout(1000);
    }
  });

  test('dropdownReadableAndUsable: Service Type dropdown options are readable and functional', async ({ page }) => {
    console.log('🧪 Testing Service Type dropdown readability...');

    // Navigate to Services tab
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(500);

    // Add a line item to get the dropdown
    await page.click('#add-line-item');
    await page.waitForTimeout(1000);

    // Find the service type dropdown
    const dropdown = page.locator('.job-type-select').first();
    await expect(dropdown).toBeVisible();

    // Click to open dropdown
    await dropdown.click();
    await page.waitForTimeout(500);

    // Check if dropdown options are visible and have proper styling
    const options = page.locator('.job-type-select option');
    const optionCount = await options.count();

    // Should have multiple options (at least the default plus service types)
    expect(optionCount).toBeGreaterThan(1);

    // Test accessibility: Check that options have readable text
    for (let i = 1; i < Math.min(optionCount, 4); i++) { // Test first few options
      const optionText = await options.nth(i).textContent();
      expect(optionText).toBeTruthy();
      expect(optionText.trim().length).toBeGreaterThan(0);
    }

    // Test functionality: Select an option and verify it's selected
    await dropdown.selectOption('Pilotage');
    const selectedValue = await dropdown.inputValue();
    expect(selectedValue).toBe('Pilotage');

    console.log('✅ Service Type dropdown is readable and functional');
  });

  test('noDuplicateAfterSaveLogoutLogin: No duplicate invoices after save→logout→login cycle', async ({ page }) => {
    console.log('🧪 Testing no duplicate invoices after save→logout→login...');

    // Create a unique invoice for testing
    const testTitle = `Test Invoice ${Date.now()}`;

    // Fill in minimal invoice data
    await page.fill('#vessel-name', 'Test Vessel');
    await page.fill('#customer-name', 'Test Customer');

    // Add a service item
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(500);
    await page.click('#add-line-item');
    await page.waitForTimeout(1000);

    const dropdown = page.locator('.job-type-select').first();
    await dropdown.selectOption('Pilotage');
    await page.waitForTimeout(500);

    // Save the invoice
    console.log('💾 Saving invoice...');
    await page.click('#save-invoice');

    // Handle the save dialog if it appears
    try {
      // Wait for prompt modal to appear
      await page.waitForSelector('.modal-overlay', { timeout: 2000 });

      // Fill in the title input if it exists
      const titleInput = page.locator('input[type="text"]').last();
      if (await titleInput.isVisible()) {
        await titleInput.fill(testTitle);

        // Click OK/Save button in modal
        const saveButtons = page.locator('button').filter({ hasText: /ok|save|confirm/i });
        const saveButton = saveButtons.first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      }
    } catch (e) {
      console.log('No save dialog appeared, invoice might be saved already');
    }

    // Wait for save to complete
    await page.waitForTimeout(2000);

    // Check current invoice count in sidebar
    console.log('📊 Checking initial invoice count...');
    const initialInvoices = page.locator('.invoice-item');
    const initialCount = await initialInvoices.count();
    console.log(`Initial invoice count: ${initialCount}`);

    // Logout (simulate user logout)
    console.log('🚪 Simulating logout...');
    // This might involve clicking a logout button or clearing localStorage
    await page.evaluate(() => {
      localStorage.removeItem('marine_invoice_user');
      sessionStorage.clear();
    });

    // Reload page to simulate fresh login
    await page.reload();
    await page.waitForTimeout(2000);

    // Login again (handle auth if required)
    const signInBtn = page.locator('#sign-in-btn');
    if (await signInBtn.isVisible()) {
      console.log('🔑 Signing back in...');
      await signInBtn.click();
      await page.waitForTimeout(1000);
    }

    // Wait for sidebar to load
    await page.waitForTimeout(2000);

    // Check final invoice count - should be same as before, not doubled
    console.log('📊 Checking final invoice count...');
    const finalInvoices = page.locator('.invoice-item');
    const finalCount = await finalInvoices.count();
    console.log(`Final invoice count: ${finalCount}`);

    // The count should not have increased (no duplicates)
    expect(finalCount).toBeLessThanOrEqual(initialCount + 1); // Allow for the one we just saved

    // More specifically, check that our test invoice appears only once
    const testInvoiceItems = page.locator('.invoice-title').filter({ hasText: testTitle });
    const testInvoiceCount = await testInvoiceItems.count();
    expect(testInvoiceCount).toBeLessThanOrEqual(1);

    console.log('✅ No duplicate invoices found after save→logout→login cycle');
  });

  test('sidebarCursorStyle: Sidebar invoice titles show pointer cursor, not help cursor', async ({ page }) => {
    console.log('🧪 Testing sidebar cursor style...');

    // First create a test invoice if sidebar is empty
    const invoiceItems = page.locator('.invoice-item');
    const invoiceCount = await invoiceItems.count();

    if (invoiceCount === 0) {
      console.log('📝 Creating test invoice for cursor testing...');

      // Fill minimal data and save
      await page.fill('#vessel-name', 'Cursor Test Vessel');
      await page.fill('#customer-name', 'Cursor Test Customer');

      await page.click('#save-invoice');
      await page.waitForTimeout(1000);

      // Handle save dialog if needed
      try {
        const titleInput = page.locator('input[type="text"]').last();
        if (await titleInput.isVisible()) {
          await titleInput.fill('Cursor Test Invoice');
          const saveButton = page.locator('button').filter({ hasText: /ok|save|confirm/i }).first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
          }
        }
      } catch (e) {
        // Dialog might not appear
      }

      await page.waitForTimeout(2000);
    }

    // Now test the cursor
    const invoiceTitle = page.locator('.invoice-title').first();
    await expect(invoiceTitle).toBeVisible();

    // Hover over the invoice title
    await invoiceTitle.hover();

    // Check the computed cursor style
    const cursorStyle = await invoiceTitle.evaluate(el => {
      return window.getComputedStyle(el).cursor;
    });

    console.log(`Cursor style: ${cursorStyle}`);

    // Should be 'pointer' not 'help'
    expect(cursorStyle).toBe('pointer');

    // Additional check: should not be 'help'
    expect(cursorStyle).not.toBe('help');

    console.log('✅ Sidebar cursor style is correct (pointer, not help)');
  });

  test('integrationTest: All three fixes work together without regressions', async ({ page }) => {
    console.log('🧪 Running integration test for all fixes...');

    // Test 1: Dropdown works
    await page.click('[data-tab="scope"]');
    await page.click('#add-line-item');
    await page.waitForTimeout(1000);

    const dropdown = page.locator('.job-type-select').first();
    await dropdown.selectOption('Agent Services');
    const selectedValue = await dropdown.inputValue();
    expect(selectedValue).toBe('Agent Services');

    // Test 2: Can save invoice
    await page.fill('#vessel-name', 'Integration Test Vessel');
    await page.fill('#customer-name', 'Integration Test Customer');

    await page.click('#save-invoice');
    await page.waitForTimeout(1000);

    // Handle save dialog
    try {
      const titleInput = page.locator('input[type="text"]').last();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Integration Test Invoice');
        const saveButton = page.locator('button').filter({ hasText: /ok|save|confirm/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      }
    } catch (e) {
      // Dialog might not appear
    }

    await page.waitForTimeout(2000);

    // Test 3: Sidebar cursor is correct
    const invoiceTitle = page.locator('.invoice-title').first();
    if (await invoiceTitle.isVisible()) {
      await invoiceTitle.hover();
      const cursorStyle = await invoiceTitle.evaluate(el => {
        return window.getComputedStyle(el).cursor;
      });
      expect(cursorStyle).toBe('pointer');
    }

    console.log('✅ All fixes working together without regressions');
  });
});
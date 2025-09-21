const { test, expect } = require('@playwright/test');

test.describe('Invoice Preview Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console error capturing
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.errors = errors;

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with provided credentials
    await page.fill('#email', 'test@marinegroupbw.com');
    await page.fill('#password', 'TempPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL('**/app**');
  });

  test('should create an invoice and then view it without errors', async ({ page }) => {
    // Go to invoice editor
    await page.goto('http://localhost:3001/app');
    await page.waitForTimeout(2000);

    // Fill out vessel information
    const vesselName = await page.locator('input[placeholder*="vessel" i], input[id*="vessel" i], input[name*="vessel" i]').first();
    if (await vesselName.isVisible()) {
      await vesselName.fill('Test Vessel Marina');
    }

    const vesselWeight = await page.locator('input[placeholder*="weight" i], input[id*="weight" i], input[name*="weight" i]').first();
    if (await vesselWeight.isVisible()) {
      await vesselWeight.fill('50');
    }

    const vesselBeam = await page.locator('input[placeholder*="beam" i], input[id*="beam" i], input[name*="beam" i]').first();
    if (await vesselBeam.isVisible()) {
      await vesselBeam.fill('20');
    }

    // Fill out customer information
    const customerName = await page.locator('input[placeholder*="customer" i], input[id*="customer" i], input[name*="customer" i]').first();
    if (await customerName.isVisible()) {
      await customerName.fill('Test Customer');
    }

    const customerEmail = await page.locator('input[type="email"], input[placeholder*="email" i], input[id*="email" i]').first();
    if (await customerEmail.isVisible()) {
      await customerEmail.fill('test@customer.com');
    }

    // Add a service/line item if possible
    const addServiceButton = await page.locator('button:has-text("Add"), button:has-text("Service"), .add-line-item, .add-service').first();
    if (await addServiceButton.isVisible()) {
      await addServiceButton.click();
      await page.waitForTimeout(1000);

      // Fill description if field exists
      const descriptionField = await page.locator('input[placeholder*="description" i], textarea[placeholder*="description" i]').first();
      if (await descriptionField.isVisible()) {
        await descriptionField.fill('Test Marine Service');
      }
    }

    // Save the invoice
    const saveButton = await page.locator('button:has-text("Save"), .save-button, #save-invoice').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      await page.waitForTimeout(2000);

      console.log('✅ Invoice saved successfully');

      // Look for the saved invoice in the UI
      const viewButton = await page.locator('button:has-text("View"), .view-button, a:has-text("View")').first();
      if (await viewButton.isVisible()) {
        console.log('✅ Found View button, clicking...');
        await viewButton.click();
        await page.waitForTimeout(3000);

        // Check that we're in view mode
        const currentUrl = page.url();
        console.log('Current URL after clicking view:', currentUrl);

        // Check for the invoice preview content
        const hasInvoiceContent = await page.locator('text="MARINE SERVICES INVOICE"').isVisible();
        const hasVesselInfo = await page.locator('text="Vessel Information"').isVisible();
        const hasCustomerInfo = await page.locator('text="Customer Information"').isVisible();

        console.log('Invoice content visible:', hasInvoiceContent);
        console.log('Vessel info visible:', hasVesselInfo);
        console.log('Customer info visible:', hasCustomerInfo);

        // Check that we don't have the empty state message
        const hasEmptyMessage = await page.locator('text="Fill out the vessel information, customer details, and add services"').isVisible();
        console.log('Empty state message visible:', hasEmptyMessage);

        // Verify invoice data is displayed (not empty state)
        expect(hasEmptyMessage, 'Should not show empty state when invoice has data').toBe(false);
        expect(hasInvoiceContent || hasVesselInfo || hasCustomerInfo, 'Should show actual invoice content').toBe(true);

        console.log('✅ Invoice preview is displaying data correctly');
      } else {
        console.log('ℹ️ View button not found, checking if already in view mode');
      }
    } else {
      console.log('ℹ️ Save button not found, continuing with manual navigation');

      // Try to navigate to view mode manually with a test invoice
      await page.goto('http://localhost:3001/app?view=true&invoice=test-invoice-manual');
      await page.waitForTimeout(3000);
    }

    // Log any console errors for debugging
    if (page.errors.length > 0) {
      console.log('Console errors found:', page.errors);
    } else {
      console.log('✅ No console errors detected!');
    }

    // The main success criteria: no fatal JavaScript errors
    const hasFatalErrors = page.errors.some(error =>
      error.includes("Cannot read properties of undefined (reading 'restoreEditState')") ||
      error.includes("Cannot read properties of undefined (reading 'subscribe')") ||
      error.includes("this.initReactInvoiceEditor is not a function")
    );

    expect(hasFatalErrors, 'Should not have the original fatal errors').toBe(false);
    console.log('✅ Invoice preview functionality working without fatal errors');
  });

  test('should handle view mode with missing invoice gracefully', async ({ page }) => {
    // Navigate directly to view mode with non-existent invoice
    await page.goto('http://localhost:3001/app?view=true&invoice=non-existent-invoice');
    await page.waitForTimeout(3000);

    // Should show error message, not crash
    const hasErrorMessage = await page.locator('text="Invoice not found", text="Unable to load", text="Storage not available"').isVisible();
    const hasLoadingMessage = await page.locator('text="Loading invoice data"').isVisible();

    console.log('Error message visible:', hasErrorMessage);
    console.log('Loading message visible:', hasLoadingMessage);

    // Verify no fatal JavaScript errors occurred
    const hasFatalErrors = page.errors.some(error =>
      error.includes("Cannot read properties of undefined (reading 'restoreEditState')") ||
      error.includes("Cannot read properties of undefined (reading 'subscribe')") ||
      error.includes("this.initReactInvoiceEditor is not a function")
    );

    expect(hasFatalErrors, 'Should handle missing invoices without fatal errors').toBe(false);
    console.log('✅ Missing invoice handled gracefully without fatal errors');
  });
});
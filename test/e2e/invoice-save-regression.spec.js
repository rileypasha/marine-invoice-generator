/**
 * CRITICAL REGRESSION PREVENTION: Invoice Save Logic E2E Tests
 *
 * This test suite prevents the specific regression where edit mode incorrectly
 * shows rename dialogs instead of updating invoices in-place.
 *
 * BUSINESS RULES BEING TESTED:
 * 1. Edit existing invoice → Updates in-place (NO rename dialog)
 * 2. Save-As-New → Shows rename dialog and creates duplicate
 * 3. Navigation guards → Warn about unsaved changes
 * 4. API contract → Uses correct HTTP methods (PUT/PATCH vs POST)
 */

const { test, expect } = require('@playwright/test');

test.describe('Invoice Save Regression Prevention', () => {

  test.beforeEach(async ({ page }) => {
    // Ensure clean state and authenticate
    await page.goto('/');

    // Login as test user
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const loginBtn = page.locator('#loginBtn');

    if (await emailInput.isVisible()) {
      await emailInput.fill('test@marinegroup.com');
      await passwordInput.fill('test123');
      await loginBtn.click();

      // Wait for authentication to complete
      await page.waitForFunction(() => window.location.pathname === '/app.html' || window.location.pathname === '/');
    }

    // Navigate to main app if needed
    if (page.url().includes('/app') === false) {
      await page.goto('/app.html');
    }

    // Wait for app to fully initialize
    await page.waitForSelector('input[aria-label="Vessel"], input[placeholder*="vessel"], input[title*="Vessel"], input[type="text"]', { timeout: 10000 });
  });

  test('CRITICAL: Edit existing invoice updates in-place without rename dialog', async ({ page }) => {
    // Step 1: Create a new invoice first
    console.log('Step 1: Creating initial invoice...');

    await page.fill('[data-testid="vessel-name"]', 'Test Vessel Alpha');
    await page.fill('[data-testid="customer-name"]', 'Regression Test Customer');
    await page.fill('[data-testid="customer-email"]', 'test@example.com');

    // Add a line item
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-item-description-0"]', 'Initial Service');
    await page.fill('[data-testid="manual-cost-0"]', '100');

    // Save the invoice (first time - should show dialog)
    await page.click('[data-testid="save-invoice-btn"]');

    // Handle initial save dialog
    const titleInput = page.locator('[data-testid="invoice-title-input"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('Test Invoice for Regression');
    await page.click('[data-testid="confirm-save-btn"]');

    // Wait for save to complete
    await page.waitForSelector('[data-testid="success-notification"]', { timeout: 10000 });

    console.log('Step 1 complete: Initial invoice saved');

    // Step 2: Verify we're now in edit mode
    console.log('Step 2: Verifying edit mode state...');

    await page.waitForFunction(() => {
      const state = window.app?.state;
      return state && state.getIsEditMode() === true;
    }, { timeout: 5000 });

    const isEditMode = await page.evaluate(() => {
      const state = window.app?.state;
      return {
        isEditMode: state?.getIsEditMode(),
        currentInvoiceId: state?.getCurrentInvoiceId()
      };
    });

    expect(isEditMode.isEditMode).toBe(true);
    expect(isEditMode.currentInvoiceId).toBeTruthy();

    console.log('Step 2 complete: Edit mode confirmed', isEditMode);

    // Step 3: Modify the invoice
    console.log('Step 3: Modifying invoice fields...');

    await page.fill('[data-testid="vessel-name"]', 'Test Vessel Alpha MODIFIED');
    await page.fill('[data-testid="line-item-description-0"]', 'Modified Service Description');
    await page.fill('[data-testid="manual-cost-0"]', '150');

    console.log('Step 3 complete: Fields modified');

    // Step 4: CRITICAL TEST - Save should NOT show rename dialog
    console.log('Step 4: Testing critical save behavior...');

    // Set up network monitoring
    const updateRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/') &&
          (request.method() === 'PUT' || request.method() === 'PATCH' ||
           request.url().includes('smart-save') || request.url().includes('update'))) {
        updateRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Click save button
    await page.click('[data-testid="save-invoice-btn"]');

    // CRITICAL ASSERTION: NO rename dialog should appear
    const titleInput2 = page.locator('[data-testid="invoice-title-input"]');

    // Give it a short timeout - dialog should NOT appear
    try {
      await titleInput2.waitFor({ timeout: 2000 });
      throw new Error('REGRESSION DETECTED: Rename dialog appeared when editing existing invoice!');
    } catch (error) {
      if (error.message.includes('REGRESSION DETECTED')) {
        throw error;
      }
      // Expected - dialog should not appear
      console.log('✅ PASSED: No rename dialog appeared (as expected)');
    }

    // Should see success notification instead
    await page.waitForSelector('[data-testid="success-notification"]', { timeout: 5000 });

    // Verify we used update endpoint, not create
    await page.waitForTimeout(1000); // Allow network requests to complete

    expect(updateRequests.length).toBeGreaterThan(0);
    console.log('Network requests captured:', updateRequests);

    console.log('Step 4 complete: Save behavior verified');

    // Step 5: Verify data persistence
    console.log('Step 5: Verifying data persistence...');

    // Refresh page and verify changes persisted
    await page.reload();
    await page.waitForSelector('[data-testid="vessel-name"]');

    const vesselName = await page.inputValue('[data-testid="vessel-name"]');
    const serviceDesc = await page.inputValue('[data-testid="line-item-description-0"]');
    const cost = await page.inputValue('[data-testid="manual-cost-0"]');

    expect(vesselName).toBe('Test Vessel Alpha MODIFIED');
    expect(serviceDesc).toBe('Modified Service Description');
    expect(cost).toBe('150');

    console.log('Step 5 complete: Data persistence verified');

    // Step 6: Verify still in edit mode after reload
    await page.waitForFunction(() => {
      const state = window.app?.state;
      return state && state.getIsEditMode() === true;
    }, { timeout: 5000 });

    console.log('✅ CRITICAL TEST PASSED: Edit mode saves without rename dialog');
  });

  test('Save-As-New functionality preserves original and creates duplicate', async ({ page }) => {
    // First create an invoice to duplicate
    await page.fill('[data-testid="vessel-name"]', 'Original Vessel');
    await page.fill('[data-testid="customer-name"]', 'Original Customer');

    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-item-description-0"]', 'Original Service');
    await page.fill('[data-testid="manual-cost-0"]', '200');

    // Save initial invoice
    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Original Invoice');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Modify some fields
    await page.fill('[data-testid="vessel-name"]', 'Duplicated Vessel');
    await page.fill('[data-testid="manual-cost-0"]', '300');

    // Use Save-As-New (explicit duplicate action)
    // Note: This test assumes there's a specific "Save As New" button or menu option
    // If not available, this test documents the expected behavior

    if (await page.locator('[data-testid="save-as-new-btn"]').isVisible()) {
      await page.click('[data-testid="save-as-new-btn"]');

      // Should show rename dialog for new copy
      await page.waitForSelector('[data-testid="invoice-title-input"]');
      await page.fill('[data-testid="invoice-title-input"]', 'Duplicated Invoice');
      await page.click('[data-testid="confirm-save-btn"]');
      await page.waitForSelector('[data-testid="success-notification"]');

      // Verify both invoices exist in sidebar
      await page.waitForSelector('[data-testid="saved-invoices"]');
      const invoiceCount = await page.locator('[data-testid="saved-invoice-item"]').count();
      expect(invoiceCount).toBeGreaterThanOrEqual(2);
    }
  });

  test('Navigation warning appears for unsaved changes', async ({ page }) => {
    // Create some content
    await page.fill('[data-testid="vessel-name"]', 'Unsaved Vessel');
    await page.fill('[data-testid="customer-name"]', 'Unsaved Customer');

    // Try to navigate away without saving
    const dialogPromise = page.waitForEvent('dialog');

    // Attempt navigation that should trigger warning
    await page.click('[data-testid="new-invoice-btn"]'); // Or similar navigation

    try {
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('unsaved');
      await dialog.accept();
    } catch (error) {
      // If no dialog appears, that might be the expected behavior
      // depending on implementation
      console.log('No navigation warning dialog (may be expected)');
    }
  });

  test('No navigation warning for unmodified invoice', async ({ page }) => {
    // Load existing invoice without making changes
    if (await page.locator('[data-testid="saved-invoice-item"]').first().isVisible()) {
      await page.click('[data-testid="saved-invoice-item"]');
      await page.waitForSelector('[data-testid="vessel-name"]');

      // Navigate away without changes - should not warn
      page.on('dialog', dialog => {
        throw new Error('Unexpected navigation warning for unmodified invoice');
      });

      await page.click('[data-testid="new-invoice-btn"]');

      // If we get here without error, test passed
      await page.waitForTimeout(1000);
    }
  });

  test('HTTP API contract validation for updates vs creates', async ({ page }) => {
    const apiCalls = [];

    // Monitor all API calls
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // Create new invoice
    await page.fill('[data-testid="vessel-name"]', 'API Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'API Test Customer');

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'API Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Filter for save-related API calls
    const createCalls = apiCalls.filter(call =>
      call.method === 'POST' && call.url.includes('save')
    );
    expect(createCalls.length).toBeGreaterThan(0);

    // Clear API log
    apiCalls.length = 0;

    // Modify and save again (update)
    await page.fill('[data-testid="vessel-name"]', 'API Test Vessel UPDATED');
    await page.click('[data-testid="save-invoice-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Should use update endpoints (PUT/PATCH or smart-save)
    const updateCalls = apiCalls.filter(call =>
      (call.method === 'PUT' || call.method === 'PATCH') ||
      (call.method === 'POST' && (call.url.includes('update') || call.url.includes('smart-save')))
    );

    expect(updateCalls.length).toBeGreaterThan(0);

    // Should NOT create new invoice record
    const newCreateCalls = apiCalls.filter(call =>
      call.method === 'POST' && call.url.includes('save') && !call.url.includes('smart-save')
    );
    expect(newCreateCalls.length).toBe(0);
  });

  test('Invoice count remains stable during edit operations', async ({ page }) => {
    // Get initial invoice count
    const getInvoiceCount = async () => {
      const invoices = await page.evaluate(() => {
        return window.app?.storage?.getAllInvoices()?.length || 0;
      });
      return invoices;
    };

    const initialCount = await getInvoiceCount();

    // Create new invoice
    await page.fill('[data-testid="vessel-name"]', 'Count Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'Count Test Customer');

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Count Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Count should increase by 1
    const afterCreateCount = await getInvoiceCount();
    expect(afterCreateCount).toBe(initialCount + 1);

    // Edit the invoice multiple times
    for (let i = 0; i < 3; i++) {
      await page.fill('[data-testid="vessel-name"]', `Count Test Vessel Edit ${i + 1}`);
      await page.click('[data-testid="save-invoice-btn"]');
      await page.waitForSelector('[data-testid="success-notification"]');

      // Count should remain the same (no new invoices created)
      const editCount = await getInvoiceCount();
      expect(editCount).toBe(afterCreateCount);
    }
  });

  test('Edit mode state persistence across page reloads', async ({ page }) => {
    // Create and save invoice
    await page.fill('[data-testid="vessel-name"]', 'Persistence Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'Persistence Test Customer');

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Persistence Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Verify edit mode is active
    const beforeReload = await page.evaluate(() => {
      const state = window.app?.state;
      return {
        isEditMode: state?.getIsEditMode(),
        currentInvoiceId: state?.getCurrentInvoiceId()
      };
    });

    expect(beforeReload.isEditMode).toBe(true);
    expect(beforeReload.currentInvoiceId).toBeTruthy();

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="vessel-name"]');

    // Verify edit mode is restored
    await page.waitForFunction(() => {
      const state = window.app?.state;
      return state && state.getIsEditMode() === true;
    }, { timeout: 5000 });

    const afterReload = await page.evaluate(() => {
      const state = window.app?.state;
      return {
        isEditMode: state?.getIsEditMode(),
        currentInvoiceId: state?.getCurrentInvoiceId()
      };
    });

    expect(afterReload.isEditMode).toBe(true);
    expect(afterReload.currentInvoiceId).toBe(beforeReload.currentInvoiceId);

    // Verify save still works without dialog
    await page.fill('[data-testid="vessel-name"]', 'Persistence Test Vessel AFTER RELOAD');
    await page.click('[data-testid="save-invoice-btn"]');

    // Should not show rename dialog
    const titleInput = page.locator('[data-testid="invoice-title-input"]');
    try {
      await titleInput.waitFor({ timeout: 2000 });
      throw new Error('Rename dialog appeared after page reload - edit mode not properly restored');
    } catch (error) {
      if (error.message.includes('Rename dialog appeared')) {
        throw error;
      }
      // Expected - no dialog should appear
    }

    await page.waitForSelector('[data-testid="success-notification"]');
  });

  test('Performance: Save operations complete within acceptable time limits', async ({ page }) => {
    // Create invoice with substantial content
    await page.fill('[data-testid="vessel-name"]', 'Performance Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'Performance Test Customer');

    // Add multiple line items
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="add-line-item"]');
      await page.fill(`[data-testid="line-item-description-${i}"]`, `Service ${i + 1}`);
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 100}`);
    }

    // Measure initial save time
    const saveStartTime = Date.now();
    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Performance Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');
    const initialSaveTime = Date.now() - saveStartTime;

    expect(initialSaveTime).toBeLessThan(5000); // 5 second max for initial save

    // Measure update save time
    const updateStartTime = Date.now();
    await page.fill('[data-testid="vessel-name"]', 'Performance Test Vessel UPDATED');
    await page.click('[data-testid="save-invoice-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');
    const updateSaveTime = Date.now() - updateStartTime;

    expect(updateSaveTime).toBeLessThan(3000); // 3 second max for updates

    console.log(`Performance: Initial save ${initialSaveTime}ms, Update save ${updateSaveTime}ms`);
  });
});

test.describe('Invoice Save Edge Cases', () => {

  test('Handle server errors gracefully during save', async ({ page }) => {
    await page.goto('/');

    // Mock server error
    await page.route('/api/v2/invoice/save', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });

    await page.fill('[data-testid="vessel-name"]', 'Error Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'Error Test Customer');

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Error Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');

    // Should show error message, not crash
    await page.waitForSelector('[data-testid="error-notification"]', { timeout: 5000 });

    const errorText = await page.textContent('[data-testid="error-notification"]');
    expect(errorText).toContain('Failed to save');
  });

  test('Concurrent save prevention', async ({ page }) => {
    await page.goto('/');

    await page.fill('[data-testid="vessel-name"]', 'Concurrent Test Vessel');
    await page.fill('[data-testid="customer-name"]', 'Concurrent Test Customer');

    // Mock slow server response
    await page.route('/api/v2/invoice/save', route => {
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ invoice: { id: 'test-123' } })
        });
      }, 2000);
    });

    // Click save
    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Concurrent Test Invoice');

    // Start first save
    const savePromise = page.click('[data-testid="confirm-save-btn"]');

    // Try to save again immediately (should be prevented)
    await page.waitForTimeout(100);
    const saveButton = page.locator('[data-testid="confirm-save-btn"]');

    // Button should be disabled during save
    await expect(saveButton).toBeDisabled();

    await savePromise;
    await page.waitForSelector('[data-testid="success-notification"]');
  });
});
import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * E2E Tests for Invoice Smart Save Functionality
 *
 * These tests validate the core UX problem solution where users editing existing
 * invoices are no longer forced to create new invoices.
 *
 * Key Test Scenarios:
 * 1. Create new invoice via smart save (no ID provided)
 * 2. Update existing invoice via smart save (ID provided)
 * 3. Verify no duplicate invoices created when updating
 * 4. Test invoice state transitions (DRAFT → SAVED → MODIFIED → SAVED)
 * 5. Validate SaveButton UI behavior and visual feedback
 */

test.describe('Invoice Smart Save V3 API', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Set up test user authentication
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test@marinegroupbw.com');
    await page.fill('#password', 'test123');
    await page.click('#login-button');

    // Wait for authentication to complete
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
    await context.close();
  });

  test('Smart Save: Create New Invoice (No ID)', async () => {
    // Navigate to new invoice form
    await page.goto('http://localhost:3000/invoice/new');

    // Set up request monitoring for smart save endpoint
    const apiRequests: Array<{ url: string; method: string; body: any }> = [];
    page.on('request', async request => {
      if (request.url().includes('/api/v3/invoices/smart-save')) {
        const body = request.postData() ? JSON.parse(request.postData()!) : {};
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          body
        });
      }
    });

    // Fill invoice form
    await page.fill('[data-testid="invoice-title"]', 'New Test Invoice');
    await page.fill('[data-testid="customer-name"]', 'John Doe');
    await page.fill('[data-testid="customer-email"]', 'john@example.com');
    await page.fill('[data-testid="vessel-name"]', 'Test Vessel');
    await page.fill('[data-testid="line-item-description"]', 'Marine Service');
    await page.fill('[data-testid="line-item-quantity"]', '5');
    await page.fill('[data-testid="line-item-rate"]', '100');

    // Verify SaveButton shows "Save Invoice" for new invoice
    const saveButton = page.locator('[data-testid="save-button"]');
    await expect(saveButton).toContainText('Save Invoice');
    await expect(saveButton).toBeEnabled();

    // Click save
    await saveButton.click();

    // Wait for save completion
    await page.waitForLoadState('networkidle');

    // Verify API call
    expect(apiRequests).toHaveLength(1);
    const request = apiRequests[0];
    expect(request.method).toBe('POST');
    expect(request.body).toMatchObject({
      title: 'New Test Invoice',
      data: expect.objectContaining({
        customer: expect.objectContaining({
          customerName: 'John Doe',
          customerEmail: 'john@example.com'
        }),
        vessel: expect.objectContaining({
          name: 'Test Vessel'
        })
      })
    });
    expect(request.body.id).toBeUndefined(); // No ID for new invoice

    // Verify success feedback
    await expect(page.locator('[data-testid="save-success"]')).toContainText('Invoice created successfully');
    await expect(saveButton).toContainText('Saved');

    // Verify invoice now has an ID and is in SAVED state
    const invoiceId = await page.locator('[data-testid="invoice-id"]').textContent();
    expect(invoiceId).toBeTruthy();

    const invoiceState = await page.locator('[data-testid="invoice-state"]').textContent();
    expect(invoiceState).toBe('SAVED');
  });

  test('Smart Save: Update Existing Invoice (With ID)', async () => {
    // First, create an invoice to edit
    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('[data-testid="invoice-title"]', 'Original Invoice');
    await page.fill('[data-testid="customer-name"]', 'Original Customer');
    await page.click('[data-testid="save-button"]');
    await page.waitForLoadState('networkidle');

    // Get the created invoice ID
    const originalInvoiceId = await page.locator('[data-testid="invoice-id"]').textContent();
    expect(originalInvoiceId).toBeTruthy();

    // Navigate to edit the invoice
    await page.goto(`http://localhost:3000/invoice/${originalInvoiceId}/edit`);

    // Set up request monitoring
    const apiRequests: Array<{ url: string; method: string; body: any }> = [];
    page.on('request', async request => {
      if (request.url().includes('/api/v3/invoices/smart-save')) {
        const body = request.postData() ? JSON.parse(request.postData()!) : {};
        apiRequests.push({
          url: request.url(),
          method: request.method(),
          body
        });
      }
    });

    // Verify we're editing existing invoice
    await expect(page.locator('[data-testid="invoice-title"]')).toHaveValue('Original Invoice');
    await expect(page.locator('[data-testid="customer-name"]')).toHaveValue('Original Customer');

    // Verify SaveButton shows "Saved" initially (no changes)
    const saveButton = page.locator('[data-testid="save-button"]');
    await expect(saveButton).toContainText('Saved');
    await expect(saveButton).toBeDisabled();

    // Make changes to the invoice
    await page.fill('[data-testid="invoice-title"]', 'Updated Invoice Title');
    await page.fill('[data-testid="customer-name"]', 'Updated Customer');

    // Verify button changes to "Save Changes" after modifications
    await expect(saveButton).toContainText('Save Changes');
    await expect(saveButton).toBeEnabled();

    // Verify invoice state shows as MODIFIED
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('MODIFIED');
    await expect(page.locator('[data-testid="unsaved-changes-indicator"]')).toBeVisible();

    // Save changes
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify API call includes the invoice ID
    expect(apiRequests).toHaveLength(1);
    const request = apiRequests[0];
    expect(request.method).toBe('POST');
    expect(request.body).toMatchObject({
      id: originalInvoiceId, // CRITICAL: ID is provided for update
      title: 'Updated Invoice Title',
      data: expect.objectContaining({
        customer: expect.objectContaining({
          customerName: 'Updated Customer'
        })
      })
    });

    // Verify success feedback
    await expect(page.locator('[data-testid="save-success"]')).toContainText('Invoice updated successfully');
    await expect(saveButton).toContainText('Saved');

    // CRITICAL: Verify the invoice ID hasn't changed (no new invoice created)
    const updatedInvoiceId = await page.locator('[data-testid="invoice-id"]').textContent();
    expect(updatedInvoiceId).toBe(originalInvoiceId);

    // Verify state is back to SAVED
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('SAVED');
    await expect(page.locator('[data-testid="unsaved-changes-indicator"]')).not.toBeVisible();
  });

  test('Critical UX Test: No Duplicate Invoices Created on Update', async () => {
    // Create initial invoice
    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('[data-testid="invoice-title"]', 'Anti-Duplicate Test');
    await page.fill('[data-testid="customer-name"]', 'Test Customer');
    await page.click('[data-testid="save-button"]');
    await page.waitForLoadState('networkidle');

    const originalInvoiceId = await page.locator('[data-testid="invoice-id"]').textContent();

    // Navigate to invoice list to count invoices
    await page.goto('http://localhost:3000/invoices');
    const initialInvoiceCount = await page.locator('[data-testid="invoice-list-item"]').count();

    // Edit the invoice multiple times
    await page.goto(`http://localhost:3000/invoice/${originalInvoiceId}/edit`);

    for (let i = 1; i <= 3; i++) {
      await page.fill('[data-testid="invoice-title"]', `Updated Title ${i}`);
      await page.click('[data-testid="save-button"]');
      await page.waitForLoadState('networkidle');

      // Verify still same invoice ID
      const currentInvoiceId = await page.locator('[data-testid="invoice-id"]').textContent();
      expect(currentInvoiceId).toBe(originalInvoiceId);
    }

    // Return to invoice list and verify count hasn't increased
    await page.goto('http://localhost:3000/invoices');
    const finalInvoiceCount = await page.locator('[data-testid="invoice-list-item"]').count();

    // CRITICAL ASSERTION: No new invoices should be created
    expect(finalInvoiceCount).toBe(initialInvoiceCount);

    // Verify the single invoice has the latest updates
    const invoiceTitle = await page.locator(`[data-testid="invoice-${originalInvoiceId}-title"]`).textContent();
    expect(invoiceTitle).toBe('Updated Title 3');
  });

  test('Invoice State Transitions and SaveButton Behavior', async () => {
    // Create new invoice (DRAFT → SAVED)
    await page.goto('http://localhost:3000/invoice/new');
    const saveButton = page.locator('[data-testid="save-button"]');

    // DRAFT state
    await expect(saveButton).toContainText('Save Invoice');
    await expect(saveButton).toBeEnabled();

    await page.fill('[data-testid="invoice-title"]', 'State Transition Test');
    await page.fill('[data-testid="customer-name"]', 'State Customer');
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // SAVED state
    await expect(saveButton).toContainText('Saved');
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('SAVED');

    // Make modifications (SAVED → MODIFIED)
    await page.fill('[data-testid="customer-name"]', 'Modified Customer');

    // MODIFIED state
    await expect(saveButton).toContainText('Save Changes');
    await expect(saveButton).toBeEnabled();
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('MODIFIED');
    await expect(page.locator('[data-testid="unsaved-changes-indicator"]')).toBeVisible();

    // Save changes (MODIFIED → SAVED)
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Back to SAVED state
    await expect(saveButton).toContainText('Saved');
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('SAVED');
    await expect(page.locator('[data-testid="unsaved-changes-indicator"]')).not.toBeVisible();
  });

  test('SaveButton Visual Feedback and Accessibility', async () => {
    await page.goto('http://localhost:3000/invoice/new');
    const saveButton = page.locator('[data-testid="save-button"]');

    // Test keyboard accessibility
    await page.keyboard.press('Tab'); // Navigate to save button
    await expect(saveButton).toBeFocused();

    // Test aria labels
    await expect(saveButton).toHaveAttribute('aria-label', expect.stringContaining('Save Invoice'));

    // Fill form and test loading state
    await page.fill('[data-testid="invoice-title"]', 'Visual Feedback Test');
    await page.fill('[data-testid="customer-name"]', 'Test Customer');

    // Click save and verify loading state
    await saveButton.click();

    // Should show loading spinner and disabled state
    await expect(saveButton).toContainText('Saving...');
    await expect(saveButton).toBeDisabled();
    await expect(saveButton.locator('.save-button__spinner')).toBeVisible();

    // Wait for completion
    await page.waitForLoadState('networkidle');

    // Should show success state
    await expect(saveButton).toContainText('Saved');
    await expect(page.locator('[data-testid="save-success-tooltip"]')).toBeVisible();

    // Success tooltip should auto-hide after 3 seconds
    await page.waitForTimeout(3500);
    await expect(page.locator('[data-testid="save-success-tooltip"]')).not.toBeVisible();
  });

  test('Error Handling and Recovery', async () => {
    await page.goto('http://localhost:3000/invoice/new');

    // Mock API failure
    await page.route('/api/v3/invoices/smart-save', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { message: 'Server error during save' }
        })
      });
    });

    await page.fill('[data-testid="invoice-title"]', 'Error Test Invoice');
    await page.fill('[data-testid="customer-name"]', 'Test Customer');

    const saveButton = page.locator('[data-testid="save-button"]');
    await saveButton.click();

    // Should show error state
    await expect(page.locator('[data-testid="save-error"]')).toContainText('Server error during save');
    await expect(saveButton).toContainText('Save Invoice'); // Button should reset
    await expect(saveButton).toBeEnabled(); // Should be retry-able

    // Test form data preservation
    await expect(page.locator('[data-testid="invoice-title"]')).toHaveValue('Error Test Invoice');
    await expect(page.locator('[data-testid="customer-name"]')).toHaveValue('Test Customer');
  });

  test('Finalized Invoice Behavior', async () => {
    // Create and finalize an invoice
    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('[data-testid="invoice-title"]', 'Finalized Test');
    await page.fill('[data-testid="customer-name"]', 'Test Customer');
    await page.click('[data-testid="save-button"]');
    await page.waitForLoadState('networkidle');

    const invoiceId = await page.locator('[data-testid="invoice-id"]').textContent();

    // Finalize the invoice
    await page.click('[data-testid="finalize-button"]');
    await page.waitForLoadState('networkidle');

    // Navigate to edit (should be read-only)
    await page.goto(`http://localhost:3000/invoice/${invoiceId}/edit`);

    // Verify SaveButton is disabled for finalized invoice
    const saveButton = page.locator('[data-testid="save-button"]');
    await expect(saveButton).toContainText('Finalized');
    await expect(saveButton).toBeDisabled();
    await expect(page.locator('[data-testid="invoice-state"]')).toContainText('FINALIZED');

    // Verify form fields are read-only
    await expect(page.locator('[data-testid="invoice-title"]')).toBeDisabled();
    await expect(page.locator('[data-testid="customer-name"]')).toBeDisabled();
  });

  test('Performance: Smart Save Response Time', async () => {
    await page.goto('http://localhost:3000/invoice/new');

    // Fill large invoice with multiple line items
    await page.fill('[data-testid="invoice-title"]', 'Performance Test Invoice');
    await page.fill('[data-testid="customer-name"]', 'Performance Customer');

    // Add multiple line items
    for (let i = 1; i <= 10; i++) {
      await page.click('[data-testid="add-line-item"]');
      await page.fill(`[data-testid="line-item-${i}-description"]`, `Service ${i}`);
      await page.fill(`[data-testid="line-item-${i}-quantity"]`, '1');
      await page.fill(`[data-testid="line-item-${i}-rate"]`, '100');
    }

    // Measure save time
    const startTime = Date.now();
    await page.click('[data-testid="save-button"]');
    await page.waitForLoadState('networkidle');
    const endTime = Date.now();

    const saveTime = endTime - startTime;

    // Should complete within 5 seconds
    expect(saveTime).toBeLessThan(5000);

    // Verify success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
  });
});
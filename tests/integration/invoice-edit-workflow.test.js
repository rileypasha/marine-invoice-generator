/**
 * Invoice Edit Workflow Integration Tests
 *
 * Tests the critical user workflow of editing existing invoices
 * to ensure updates don't create duplicates.
 */

const { test, expect } = require('@playwright/test');

test.describe('Invoice Edit Workflow', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Login as test user
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@marinegroup.com');
    await page.fill('[data-testid="name"]', 'Test User');
    await page.click('[data-testid="login-button"]');

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"]');
  });

  test('should update existing invoice without creating duplicate', async () => {
    // Step 1: Create initial invoice
    await page.fill('[data-testid="vessel-name"]', 'Original Vessel');
    await page.fill('[data-testid="customer-name"]', 'Original Customer');
    await page.click('[data-testid="add-line-item"]');
    await page.fill('[data-testid="line-item-description-0"]', 'Test Service');
    await page.fill('[data-testid="line-item-cost-0"]', '1000');

    // Save initial invoice
    await page.click('[data-testid="save-invoice"]');
    await page.waitForSelector('[data-testid="save-success"]');

    // Get the original invoice ID from the success message or URL
    const originalId = await page.getAttribute('[data-testid="invoice-id"]', 'data-id');

    // Verify invoice appears in sidebar
    await expect(page.locator('[data-testid="sidebar-invoice"]')).toHaveCount(1);

    // Step 2: Load invoice for editing
    await page.click(`[data-testid="sidebar-invoice-${originalId}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');

    // Verify form is populated with original data
    await expect(page.locator('[data-testid="vessel-name"]')).toHaveValue('Original Vessel');

    // Step 3: Modify invoice data
    await page.fill('[data-testid="vessel-name"]', 'Updated Vessel Name');
    await page.fill('[data-testid="customer-name"]', 'Updated Customer Name');

    // Step 4: Save changes
    await page.click('[data-testid="save-invoice"]');
    await page.waitForSelector('[data-testid="save-success"]');

    // Step 5: Critical Validation - Check that invoice was UPDATED, not duplicated
    const updatedId = await page.getAttribute('[data-testid="invoice-id"]', 'data-id');
    expect(updatedId).toBe(originalId); // Should be same ID

    // Verify only one invoice exists in sidebar
    await expect(page.locator('[data-testid="sidebar-invoice"]')).toHaveCount(1);

    // Verify updated data is displayed
    const sidebarText = await page.locator(`[data-testid="sidebar-invoice-${originalId}"]`).textContent();
    expect(sidebarText).toContain('Updated Vessel Name');

    // Step 6: Verify in database via API call
    const invoiceCount = await page.evaluate(async () => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      const invoices = await response.json();
      return invoices.filter(inv => inv.vesselName === 'Updated Vessel Name').length;
    });

    expect(invoiceCount).toBe(1); // Should be exactly 1, not 2
  });

  test('should preserve invoice metadata during edit', async () => {
    // Create invoice with specific metadata
    const initialData = {
      vesselName: 'Metadata Test Vessel',
      customerName: 'Test Customer',
      lineItems: [{ description: 'Service', cost: 500 }]
    };

    // Create initial invoice
    await createInvoiceViaAPI(page, initialData);

    // Get invoice details including timestamps
    const originalInvoice = await page.evaluate(async () => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      const invoices = await response.json();
      return invoices.find(inv => inv.vesselName === 'Metadata Test Vessel');
    });

    // Edit the invoice
    await page.click(`[data-testid="sidebar-invoice-${originalInvoice.id}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');

    // Make a small change
    await page.fill('[data-testid="vessel-name"]', 'Updated Metadata Test Vessel');
    await page.click('[data-testid="save-invoice"]');
    await page.waitForSelector('[data-testid="save-success"]');

    // Verify metadata preservation
    const updatedInvoice = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/invoice/${id}`, { credentials: 'include' });
      return await response.json();
    }, originalInvoice.id);

    // Critical checks
    expect(updatedInvoice.id).toBe(originalInvoice.id);
    expect(updatedInvoice.createdAt).toBe(originalInvoice.createdAt);
    expect(updatedInvoice.userId).toBe(originalInvoice.userId);
    expect(new Date(updatedInvoice.updatedAt)).toBeGreaterThan(new Date(originalInvoice.updatedAt));
  });

  test('should handle edit mode UI state correctly', async () => {
    // Create an invoice first
    const invoiceId = await createInvoiceViaAPI(page, {
      vesselName: 'UI Test Vessel',
      customerName: 'UI Test Customer'
    });

    // Load invoice for editing
    await page.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');

    // Verify edit mode UI indicators
    await expect(page.locator('[data-testid="page-title"]')).toContainText('Edit Invoice');
    await expect(page.locator('[data-testid="save-button"]')).toContainText('Update Invoice');
    await expect(page.locator('[data-testid="invoice-id-display"]')).toContainText(invoiceId);

    // Verify breadcrumb or navigation shows edit context
    await expect(page.locator('[data-testid="breadcrumb"]')).toContainText('Edit');
  });

  test('should handle concurrent edit scenarios gracefully', async () => {
    // Create initial invoice
    const invoiceId = await createInvoiceViaAPI(page, {
      vesselName: 'Concurrent Test Vessel',
      customerName: 'Test Customer'
    });

    // Simulate two browser tabs editing the same invoice
    const page2 = await page.context().newPage();
    await loginUser(page2);

    // Both pages load the same invoice
    await page.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);
    await page2.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);

    await page.waitForSelector('[data-testid="invoice-loaded"]');
    await page2.waitForSelector('[data-testid="invoice-loaded"]');

    // Page 1 makes and saves changes
    await page.fill('[data-testid="vessel-name"]', 'Page 1 Changes');
    await page.click('[data-testid="save-invoice"]');
    await page.waitForSelector('[data-testid="save-success"]');

    // Page 2 tries to save different changes
    await page2.fill('[data-testid="vessel-name"]', 'Page 2 Changes');
    await page2.click('[data-testid="save-invoice"]');

    // Should show conflict resolution UI or merge notification
    await expect(page2.locator('[data-testid="conflict-notification"]')).toBeVisible();

    // Verify no duplicate invoices created
    const invoiceCount = await page.evaluate(async (id) => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      const invoices = await response.json();
      return invoices.filter(inv => inv.id === id).length;
    }, invoiceId);

    expect(invoiceCount).toBe(1);
  });

  test('should handle authentication timeout during edit', async () => {
    // Create and load invoice
    const invoiceId = await createInvoiceViaAPI(page, {
      vesselName: 'Auth Test Vessel',
      customerName: 'Test Customer'
    });

    await page.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');

    // Make changes
    await page.fill('[data-testid="vessel-name"]', 'Auth Timeout Test');

    // Simulate session timeout
    await page.evaluate(() => {
      document.cookie = 'connect.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });

    // Try to save
    await page.click('[data-testid="save-invoice"]');

    // Should show authentication required message
    await expect(page.locator('[data-testid="auth-required-modal"]')).toBeVisible();

    // After re-authentication, should preserve changes
    await page.fill('[data-testid="modal-email"]', 'test@marinegroup.com');
    await page.click('[data-testid="modal-login"]');

    // Verify changes are still there
    await expect(page.locator('[data-testid="vessel-name"]')).toHaveValue('Auth Timeout Test');
  });

  test('should handle edit of non-existent invoice gracefully', async () => {
    // Try to load a non-existent invoice
    await page.goto(`/invoice/edit/fake-invoice-id-12345`);

    // Should show appropriate error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invoice not found');

    // Should redirect to main app or show creation form
    await expect(page.locator('[data-testid="create-new-invoice"]')).toBeVisible();
  });

  test('should validate edit permissions before allowing changes', async () => {
    // Login as different user and create invoice
    await page.evaluate(() => {
      localStorage.setItem('test_user_id', 'user1');
    });

    const invoiceId = await createInvoiceViaAPI(page, {
      vesselName: 'Permission Test Vessel',
      customerName: 'User 1 Customer'
    });

    // Switch to different user
    await page.evaluate(() => {
      localStorage.setItem('test_user_id', 'user2');
    });

    // Try to edit the other user's invoice
    await page.goto(`/invoice/edit/${invoiceId}`);

    // Should show access denied message
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
  });

  // Helper functions
  async function createInvoiceViaAPI(page, data) {
    return await page.evaluate(async (invoiceData) => {
      const response = await fetch('/api/v1/invoice/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: `${invoiceData.vesselName} - ${invoiceData.customerName}`,
          data: invoiceData
        })
      });
      const result = await response.json();
      return result.invoice.id;
    }, data);
  }

  async function loginUser(page) {
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@marinegroup.com');
    await page.fill('[data-testid="name"]', 'Test User');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="app-container"]');
  }
});

test.describe('Data Integrity During Edit Operations', () => {
  test('should maintain database transaction integrity during failed updates', async ({ page }) => {
    // Create initial invoice
    const invoiceId = await createInvoiceViaAPI(page, {
      vesselName: 'Transaction Test Vessel',
      customerName: 'Test Customer',
      lineItems: [{ description: 'Service', cost: 1000 }]
    });

    // Load for editing
    await page.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');

    // Modify data
    await page.fill('[data-testid="vessel-name"]', 'Transaction Updated Vessel');

    // Simulate network failure during save
    await page.route('/api/v1/invoice/**', route => {
      route.abort('failed');
    });

    // Try to save
    await page.click('[data-testid="save-invoice"]');

    // Should show error message
    await expect(page.locator('[data-testid="save-error"]')).toBeVisible();

    // Remove network block
    await page.unroute('/api/v1/invoice/**');

    // Verify original invoice still exists and unchanged
    const originalInvoice = await page.evaluate(async (id) => {
      const response = await fetch(`/api/v1/invoice/${id}`, { credentials: 'include' });
      return await response.json();
    }, invoiceId);

    expect(originalInvoice.vesselName).toBe('Transaction Test Vessel'); // Should be unchanged

    // Verify no duplicate was created
    const allInvoices = await page.evaluate(async () => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      return await response.json();
    });

    const testVesselInvoices = allInvoices.filter(inv =>
      inv.vesselName.includes('Transaction') && inv.vesselName.includes('Vessel')
    );

    expect(testVesselInvoices).toHaveLength(1); // Should be only 1, not 2
  });
});

test.describe('Performance Testing for Edit Operations', () => {
  test('should complete edit operations within performance benchmarks', async ({ page }) => {
    // Create large invoice for performance testing
    const largeInvoiceData = {
      vesselName: 'Performance Test Vessel',
      customerName: 'Performance Customer',
      lineItems: Array.from({ length: 50 }, (_, i) => ({
        description: `Service Item ${i + 1}`,
        cost: Math.floor(Math.random() * 1000) + 100
      }))
    };

    const invoiceId = await createInvoiceViaAPI(page, largeInvoiceData);

    // Measure load time
    const loadStartTime = Date.now();
    await page.click(`[data-testid="sidebar-invoice-${invoiceId}"]`);
    await page.waitForSelector('[data-testid="invoice-loaded"]');
    const loadEndTime = Date.now();

    const loadTime = loadEndTime - loadStartTime;
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

    // Make a change
    await page.fill('[data-testid="vessel-name"]', 'Performance Updated Vessel');

    // Measure save time
    const saveStartTime = Date.now();
    await page.click('[data-testid="save-invoice"]');
    await page.waitForSelector('[data-testid="save-success"]');
    const saveEndTime = Date.now();

    const saveTime = saveEndTime - saveStartTime;
    expect(saveTime).toBeLessThan(2000); // Should save within 2 seconds
  });
});
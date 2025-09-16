/**
 * E2E Test: Save → Logout → Login Shows Single Invoice
 *
 * This test verifies the core fix: after save → logout → login,
 * only one canonical invoice appears (no duplicate pencil vs green check icons)
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Save → Logout → Login Single Invoice', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('creates single canonical invoice after save→logout→login cycle', async () => {
    // Step 1: Login
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    await expect(page).toHaveURL(/dashboard/);

    // Step 2: Create and fill invoice form
    await page.goto('http://localhost:3000/invoice/new');

    const testInvoice = {
      title: 'Test Invoice No Duplicates',
      amount: '1500.00',
      customerName: 'John Doe Industries',
      customerEmail: 'john@example.com',
      description: 'Marine repair services',
    };

    await page.fill('#invoice-title', testInvoice.title);
    await page.fill('#amount', testInvoice.amount);
    await page.fill('#customer-name', testInvoice.customerName);
    await page.fill('#customer-email', testInvoice.customerEmail);
    await page.fill('#description', testInvoice.description);

    // Step 3: Save invoice and verify success
    const saveButton = page.locator('#save-button');
    await expect(saveButton).toContainText(/Save Invoice/);

    // Track the save request to capture invoice ID
    let savedInvoiceId: string | null = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/v1/invoice/save') && response.status() === 200) {
        const responseData = await response.json();
        savedInvoiceId = responseData.id;
      }
    });

    await saveButton.click();

    // Wait for save to complete
    await expect(saveButton).toContainText(/Saved|Update/);
    await expect(page.locator('.toast')).toContainText(/saved successfully/i);

    // Verify we captured the invoice ID
    expect(savedInvoiceId).toBeTruthy();
    console.log(`Saved invoice ID: ${savedInvoiceId}`);

    // Step 4: Logout
    await page.click('#user-menu');
    await page.click('#logout-button');
    await expect(page).toHaveURL(/login/);

    // Step 5: Login again
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    await expect(page).toHaveURL(/dashboard/);

    // Step 6: Verify only ONE invoice appears in the list
    await page.goto('http://localhost:3000/invoices');

    const invoiceItems = page.locator('.invoice-list-item');
    await expect(invoiceItems).toHaveCount(1, { timeout: 10000 });

    // Step 7: Verify it's the canonical saved invoice (not draft)
    const singleInvoice = invoiceItems.first();
    await expect(singleInvoice).toContainText(testInvoice.title);
    await expect(singleInvoice).toContainText(testInvoice.customerName);
    await expect(singleInvoice).toContainText('$1,500.00');

    // Verify invoice shows saved status (green check icon), not draft (pencil icon)
    const statusIcon = singleInvoice.locator('.invoice-status-icon');
    await expect(statusIcon).toHaveClass(/saved|check/); // Green check icon
    await expect(statusIcon).not.toHaveClass(/draft|pencil/); // No pencil icon

    // Verify sidebar shows correct count
    const sidebarCount = page.locator('.sidebar-invoice-count');
    await expect(sidebarCount).toContainText('1 invoice'); // Not "2 invoices"

    // Step 8: Open the invoice and verify it's the saved version
    await singleInvoice.click();
    await expect(page).toHaveURL(new RegExp(`/invoice/${savedInvoiceId}`));

    // Verify invoice form shows saved data
    await expect(page.locator('#invoice-title')).toHaveValue(testInvoice.title);
    await expect(page.locator('#amount')).toHaveValue(testInvoice.amount);
    await expect(page.locator('#customer-name')).toHaveValue(testInvoice.customerName);

    // Verify save button shows "Saved" state, not "Save Invoice"
    const reopenedSaveButton = page.locator('#save-button');
    await expect(reopenedSaveButton).toContainText(/Saved|Up to date/);
    await expect(reopenedSaveButton).not.toContainText(/Save Invoice/);
  });

  test('handles multiple invoices without creating drafts', async () => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    const invoiceIds: string[] = [];

    // Create multiple invoices
    for (let i = 1; i <= 3; i++) {
      await page.goto('http://localhost:3000/invoice/new');

      await page.fill('#invoice-title', `Invoice ${i}`);
      await page.fill('#amount', `${i * 100}.00`);
      await page.fill('#customer-name', `Customer ${i}`);

      // Track save response
      page.on('response', async (response) => {
        if (response.url().includes('/api/v1/invoice/save') && response.status() === 200) {
          const responseData = await response.json();
          if (!invoiceIds.includes(responseData.id)) {
            invoiceIds.push(responseData.id);
          }
        }
      });

      await page.click('#save-button');
      await expect(page.locator('.toast')).toContainText(/saved successfully/i);
    }

    // Logout and login
    await page.click('#user-menu');
    await page.click('#logout-button');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    // Verify exactly 3 invoices, no duplicates
    await page.goto('http://localhost:3000/invoices');
    const invoiceItems = page.locator('.invoice-list-item');
    await expect(invoiceItems).toHaveCount(3, { timeout: 10000 });

    // Verify all are saved status
    for (let i = 0; i < 3; i++) {
      const invoice = invoiceItems.nth(i);
      const statusIcon = invoice.locator('.invoice-status-icon');
      await expect(statusIcon).toHaveClass(/saved|check/);
      await expect(statusIcon).not.toHaveClass(/draft|pencil/);
    }

    // Verify sidebar count
    const sidebarCount = page.locator('.sidebar-invoice-count');
    await expect(sidebarCount).toContainText('3 invoices');
  });

  test('handles session expiry gracefully without creating drafts', async () => {
    // Login and create invoice
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('#invoice-title', 'Session Expiry Test');
    await page.fill('#amount', '500.00');
    await page.fill('#customer-name', 'Session Test Customer');

    // Clear cookies to simulate session expiry
    await page.context().clearCookies();

    // Try to save (should queue locally, not create server draft)
    await page.click('#save-button');

    // Should show session expired message
    await expect(page.locator('.session-expired-banner')).toBeVisible();
    await expect(page.locator('.toast')).toContainText(/session expired|saved locally/i);

    // Login again
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    // Should show sync modal for queued saves
    await expect(page.locator('.queued-saves-modal')).toBeVisible();
    await page.click('#sync-all-button');

    // Wait for sync
    await expect(page.locator('.sync-success')).toContainText(/synced successfully/i);

    // Verify only one canonical invoice was created
    await page.goto('http://localhost:3000/invoices');
    const invoiceItems = page.locator('.invoice-list-item');
    await expect(invoiceItems).toHaveCount(1);

    const singleInvoice = invoiceItems.first();
    await expect(singleInvoice).toContainText('Session Expiry Test');

    const statusIcon = singleInvoice.locator('.invoice-status-icon');
    await expect(statusIcon).toHaveClass(/saved|check/);
    await expect(statusIcon).not.toHaveClass(/draft|pencil/);
  });

  test('API returns correct action type for create vs update', async () => {
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'testuser');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    let createResponse: any = null;
    let updateResponse: any = null;

    // Monitor API responses
    page.on('response', async (response) => {
      if (response.url().includes('/api/v1/invoice/save') && response.status() === 200) {
        const data = await response.json();
        if (data.action === 'CREATED') {
          createResponse = data;
        } else if (data.action === 'UPDATED') {
          updateResponse = data;
        }
      }
    });

    // Create new invoice
    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('#invoice-title', 'API Action Test');
    await page.fill('#amount', '250.00');
    await page.fill('#customer-name', 'API Test Customer');
    await page.click('#save-button');

    await expect(page.locator('.toast')).toContainText(/saved successfully/i);
    expect(createResponse).toBeTruthy();
    expect(createResponse.action).toBe('CREATED');

    // Update the same invoice
    await page.fill('#invoice-title', 'Updated API Action Test');
    await page.click('#save-button');

    await expect(page.locator('.toast')).toContainText(/saved successfully/i);
    expect(updateResponse).toBeTruthy();
    expect(updateResponse.action).toBe('UPDATED');

    // Verify same invoice ID
    expect(createResponse.id).toBe(updateResponse.id);
  });
});
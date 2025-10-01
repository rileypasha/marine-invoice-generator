/**
 * E2E tests for invoice change request visual diff feature
 *
 * Tests complete user flows including visual rendering and interactions
 */

import { test, expect, Page } from '@playwright/test';
import { invoiceFixtures, createMinimalInvoice } from '../fixtures/invoice-diff-samples';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Helper: Login and get auth cookies
async function loginAsTestUser(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'testpassword');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/requests`);
}

// Helper: Create invoice via API
async function createInvoice(page: Page, invoiceData: any) {
  const response = await page.request.post(`${API_URL}/api/v1/invoice/save`, {
    data: invoiceData,
  });

  expect(response.ok()).toBeTruthy();
  const result = await response.json();
  return result.id || result.invoice?.id;
}

// Helper: Transition invoice to change_requested
async function transitionToChangeRequested(page: Page, invoiceId: string) {
  await page.request.patch(`${API_URL}/api/v1/invoice/${invoiceId}`, {
    data: {
      status: 'change_requested',
    },
  });
}

// Helper: Update invoice fields
async function updateInvoiceFields(page: Page, invoiceId: string, updates: any) {
  await page.request.put(`${API_URL}/api/v1/invoice/${invoiceId}`, {
    data: updates,
  });
}

test.describe('Invoice Change Request - Visual Diff', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('visual diff for change requested invoice - view mode', async ({ page }) => {
    // Setup: Create invoice, transition to change_requested, modify fields
    const baseInvoice = createMinimalInvoice({
      customerName: 'Original Customer',
      vesselName: 'SS Original',
      subtotal: 1000.00,
      total: 1100.00,
    });

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    // Make modifications
    await updateInvoiceFields(page, invoiceId, {
      customerName: 'Updated Customer',
      vesselName: '', // Remove vessel name
      subtotal: 1500.00,
      total: 1650.00,
    });

    // Navigate to invoice view
    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Assert: Badge shows "Changes Requested" with count
    const badge = page.locator('[role="status"]').filter({ hasText: 'Changes Requested' });
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/\(\d+\)/); // Has change count

    // Assert: Green bold text for added customerName
    const customerNameElement = page.locator('text=Updated Customer').first();
    await expect(customerNameElement).toBeVisible();
    await expect(customerNameElement).toHaveClass(/text-green-600/);
    await expect(customerNameElement).toHaveClass(/font-semibold/);

    // Assert: Red strikethrough for removed vesselName
    const vesselNameElement = page.locator('[role="deletion"]').filter({ hasText: 'SS Original' });
    await expect(vesselNameElement).toBeVisible();
    await expect(vesselNameElement.locator('..')).toHaveClass(/text-red-600/);
    await expect(vesselNameElement.locator('..')).toHaveClass(/line-through/);

    // Assert: Old→new display for changed subtotal
    const subtotalSection = page.locator('text=Subtotal').locator('..');
    await expect(subtotalSection).toContainText('$1,000.00');
    await expect(subtotalSection).toContainText('→');
    await expect(subtotalSection).toContainText('$1,500.00');

    // Assert: Changed total
    const totalSection = page.locator('text=Total').locator('..');
    await expect(totalSection).toContainText('$1,100.00');
    await expect(totalSection).toContainText('→');
    await expect(totalSection).toContainText('$1,650.00');
  });

  test('visual diff with line item changes', async ({ page }) => {
    // Setup invoice with line items
    const baseInvoice = {
      ...createMinimalInvoice(),
      data: JSON.stringify({
        lineItems: [
          { id: '1', description: 'Item 1', cost: 500, quantity: 1 },
          { id: '2', description: 'Item 2', cost: 500, quantity: 1 },
        ],
      }),
    };

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    // Modify line items: remove item 1, keep item 2, add item 3
    await updateInvoiceFields(page, invoiceId, {
      data: JSON.stringify({
        lineItems: [
          { id: '2', description: 'Item 2', cost: 500, quantity: 1 },
          { id: '3', description: 'New Item', cost: 750, quantity: 1 },
        ],
      }),
    });

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Assert: Services table shows line item diffs
    const servicesTable = page.locator('text=Services').locator('..');

    // Removed item should have red background
    const removedItem = servicesTable.locator('.bg-red-50').filter({ hasText: 'Item 1' });
    await expect(removedItem).toBeVisible();
    await expect(removedItem).toHaveClass(/border-red-500/);

    // Added item should have green background
    const addedItem = servicesTable.locator('.bg-green-50').filter({ hasText: 'New Item' });
    await expect(addedItem).toBeVisible();
    await expect(addedItem).toHaveClass(/border-green-500/);

    // Unchanged item should have normal appearance
    const unchangedItem = servicesTable.locator('text=Item 2').first();
    await expect(unchangedItem).toBeVisible();
    await expect(unchangedItem.locator('..')).not.toHaveClass(/bg-green-50|bg-red-50/);
  });

  test('visual diff for change requested invoice - edit mode', async ({ page }) => {
    const baseInvoice = createMinimalInvoice({
      customerName: 'Original Customer',
      total: 1000.00,
    });

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    await updateInvoiceFields(page, invoiceId, {
      customerName: 'Modified Customer',
      total: 1500.00,
    });

    // Navigate to edit mode
    await page.goto(`${BASE_URL}/invoices/${invoiceId}/edit`);
    await page.waitForLoadState('networkidle');

    // Assert: Diff appears alongside form fields
    const customerNameField = page.locator('input[name="customerName"]');
    await expect(customerNameField).toBeVisible();
    await expect(customerNameField).toHaveValue('Modified Customer');

    // Assert: Diff indicator visible near changed field
    const diffIndicator = page.locator('.text-green-600').filter({ hasText: 'Modified Customer' });
    await expect(diffIndicator).toBeVisible();

    // Make additional changes in edit mode
    await customerNameField.fill('Further Modified Customer');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Assert: Diff updates after save
    const updatedDiff = page.locator('.text-green-600').filter({ hasText: 'Further Modified Customer' });
    await expect(updatedDiff).toBeVisible();
  });

  test('diff cleanup after approval with attachment', async ({ page }) => {
    // Setup: Invoice in change_requested with diff
    const baseInvoice = createMinimalInvoice({
      customerName: 'Test Customer',
      total: 1000.00,
    });

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    await updateInvoiceFields(page, invoiceId, {
      customerName: 'Modified Customer',
      total: 1500.00,
    });

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Verify diff is visible
    await expect(page.locator('[role="deletion"]')).toBeVisible();

    // Upload attachment and approve
    await page.click('button:has-text("Edit")');
    await page.setInputFiles('input[type="file"]', {
      name: 'invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF content'),
    });

    await page.selectOption('select[name="status"]', 'approved');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Reopen invoice
    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Assert: No highlighting, removed values hidden
    await expect(page.locator('[role="deletion"]')).not.toBeVisible();
    await expect(page.locator('[role="insertion"]')).not.toBeVisible();
    await expect(page.locator('.text-green-600')).not.toBeVisible();
    await expect(page.locator('.text-red-600')).not.toBeVisible();

    // Assert: Status badge shows "Approved"
    const statusBadge = page.locator('[role="status"]').filter({ hasText: 'Approved' });
    await expect(statusBadge).toBeVisible();

    // Assert: Values display normally
    await expect(page.locator('text=Modified Customer')).toBeVisible();
    await expect(page.locator('text=$1,500.00')).toBeVisible();
  });

  test('visual regression - diff highlighted invoice', async ({ page }) => {
    // Setup invoice with various change types
    const baseInvoice = createMinimalInvoice({
      customerName: 'ABC Corp',
      customerEmail: 'original@example.com',
      vesselName: 'SS Test',
      subtotal: 1000.00,
      total: 1100.00,
    });

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    // Apply mixed changes
    await updateInvoiceFields(page, invoiceId, {
      customerName: 'XYZ Corp', // Changed
      customerEmail: 'updated@example.com', // Changed
      vesselName: '', // Removed
      subtotal: 1500.00, // Changed
      total: 1650.00, // Changed
    });

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual comparison
    await expect(page).toHaveScreenshot('invoice-diff-highlighted.png', {
      fullPage: true,
      mask: [
        page.locator('text=Invoice #'),
        page.locator('text=Created'),
        page.locator('text=Last saved'),
      ],
    });
  });

  test('no diff displayed for non-change_requested invoices', async ({ page }) => {
    // Create invoice with 'requested' status
    const invoice = createMinimalInvoice({ status: 'requested' });
    const invoiceId = await createInvoice(page, invoice);

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Assert: No diff styling visible
    await expect(page.locator('[role="deletion"]')).not.toBeVisible();
    await expect(page.locator('[role="insertion"]')).not.toBeVisible();
    await expect(page.locator('.bg-green-50')).not.toBeVisible();
    await expect(page.locator('.bg-red-50')).not.toBeVisible();

    // Assert: Status badge is normal
    const statusBadge = page.locator('[role="status"]');
    await expect(statusBadge).not.toContainText('Changes Requested');
  });

  test('diff persists across page refreshes', async ({ page }) => {
    const baseInvoice = createMinimalInvoice({ customerName: 'Original' });
    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    await updateInvoiceFields(page, invoiceId, {
      customerName: 'Modified',
    });

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Verify diff is visible
    await expect(page.locator('[role="deletion"]').filter({ hasText: 'Original' })).toBeVisible();
    await expect(page.locator('[role="insertion"]').filter({ hasText: 'Modified' })).toBeVisible();

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert: Diff still visible after refresh
    await expect(page.locator('[role="deletion"]').filter({ hasText: 'Original' })).toBeVisible();
    await expect(page.locator('[role="insertion"]').filter({ hasText: 'Modified' })).toBeVisible();
  });

  test('accessibility - screen reader announcements for diffs', async ({ page }) => {
    const baseInvoice = createMinimalInvoice({ customerName: 'Test' });
    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    await updateInvoiceFields(page, invoiceId, {
      customerName: 'Updated',
      total: 1500.00,
    });

    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');

    // Assert: Aria labels for additions
    const addition = page.locator('[role="insertion"]').first();
    await expect(addition).toHaveAttribute('aria-label', /Added:/);

    // Assert: Aria labels for deletions
    const deletion = page.locator('[role="deletion"]').first();
    await expect(deletion).toHaveAttribute('aria-label', /Removed:|Old value:/);

    // Assert: Status badge is accessible
    const badge = page.locator('[role="status"]').filter({ hasText: 'Changes Requested' });
    await expect(badge).toBeVisible();
  });

  test('diff performance with large invoice (100+ line items)', async ({ page }) => {
    // Create invoice with 100 line items
    const lineItems = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      description: `Line Item ${i}`,
      cost: 100,
      quantity: 1,
    }));

    const baseInvoice = {
      ...createMinimalInvoice(),
      data: JSON.stringify({ lineItems }),
      total: 10000,
    };

    const invoiceId = await createInvoice(page, baseInvoice);
    await transitionToChangeRequested(page, invoiceId);

    // Modify 10 items
    const modifiedItems = lineItems.map((item, i) =>
      i < 10 ? { ...item, cost: 150, description: `Modified ${i}` } : item
    );

    await updateInvoiceFields(page, invoiceId, {
      data: JSON.stringify({ lineItems: modifiedItems }),
    });

    // Measure load time
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/invoices/${invoiceId}`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Assert: Page loads in reasonable time (<5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Assert: Diffs are rendered for modified items
    const modifiedElements = page.locator('.bg-yellow-50');
    await expect(modifiedElements).toHaveCount(10);
  });
});
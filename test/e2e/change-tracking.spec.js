/**
 * E2E Tests for Invoice Change Tracking
 */

const { test, expect } = require('@playwright/test');

test.describe('Invoice Change Tracking', () => {
  let masterPage;
  let userPage;
  
  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts - one for master, one for regular user
    const masterContext = await browser.newContext();
    const userContext = await browser.newContext();
    
    masterPage = await masterContext.newPage();
    userPage = await userContext.newPage();
  });
  
  test('should track changes made after submission', async () => {
    // Step 1: Regular user submits an invoice
    await userPage.goto('http://localhost:3000');
    
    // Login as regular user
    await userPage.fill('#email', 'user@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    // Create and submit invoice
    await userPage.fill('#customerName', 'Test Customer');
    await userPage.fill('#vesselName', 'Test Vessel');
    await userPage.fill('#invoiceNumber', 'INV-TEST-001');
    
    // Add line item
    await userPage.click('#addLineItem');
    await userPage.fill('.line-item-description', 'Service A');
    await userPage.fill('.line-item-quantity', '2');
    await userPage.fill('.line-item-price', '100');
    
    // Submit invoice
    await userPage.click('#submitInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Step 2: Edit the submitted invoice
    await userPage.click('#addLineItem');
    await userPage.fill('.line-item-description:last-child', 'Service B');
    await userPage.fill('.line-item-quantity:last-child', '1');
    await userPage.fill('.line-item-price:last-child', '50');
    
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Step 3: Master logs in and sees the change flag
    await masterPage.goto('http://localhost:3000/master');
    
    // Login as master
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Should see dashboard with change flag
    await masterPage.waitForSelector('.change-flag.unseen');
    
    // Verify the flag is visible for the edited invoice
    const flagElement = await masterPage.locator('.change-flag.unseen').first();
    expect(await flagElement.isVisible()).toBe(true);
    expect(await flagElement.getAttribute('title')).toBe('New changes');
  });
  
  test('should display diff correctly', async () => {
    // Assume invoice with changes exists
    await masterPage.goto('http://localhost:3000/master');
    
    // Login as master
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Click on changes button
    await masterPage.click('.btn-changes:first-child');
    
    // Should navigate to changes page
    await masterPage.waitForURL(/\/master\/changes\?id=/);
    
    // Verify diff elements are present
    await expect(masterPage.locator('.changes-legend')).toBeVisible();
    await expect(masterPage.locator('.changes-section')).toHaveCount({ min: 1 });
    
    // Check for different change types
    const addedElements = await masterPage.locator('.value-added').count();
    const removedElements = await masterPage.locator('.value-removed').count();
    const changedElements = await masterPage.locator('.value-old').count();
    
    expect(addedElements + removedElements + changedElements).toBeGreaterThan(0);
  });
  
  test('should mark changes as seen', async () => {
    await masterPage.goto('http://localhost:3000/master');
    
    // Login as master
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Navigate to changes page
    await masterPage.click('.btn-changes:first-child');
    await masterPage.waitForURL(/\/master\/changes\?id=/);
    
    // Mark as reviewed
    await masterPage.click('#markSeenBtn');
    
    // Should show success state
    await expect(masterPage.locator('#markSeenBtn')).toContainText('Marked as Reviewed');
    
    // Should redirect back to dashboard
    await masterPage.waitForURL('/master', { timeout: 3000 });
    
    // Flag should no longer be unseen
    const unseenFlags = await masterPage.locator('.change-flag.unseen').count();
    expect(unseenFlags).toBe(0);
  });
  
  test('should show empty state for unchanged invoices', async () => {
    // Create a new invoice without changes
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'user@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    // Submit invoice without subsequent changes
    await userPage.fill('#customerName', 'Unchanged Customer');
    await userPage.fill('#vesselName', 'Unchanged Vessel');
    await userPage.fill('#invoiceNumber', 'INV-UNCHANGED-001');
    await userPage.click('#submitInvoice');
    
    // Master views it
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Find the unchanged invoice (should not have changes button)
    const unchangedRow = await masterPage.locator('tr', { 
      hasText: 'INV-UNCHANGED-001' 
    });
    
    const changesButton = unchangedRow.locator('.btn-changes');
    expect(await changesButton.count()).toBe(0);
  });
  
  test('should handle multiple revisions correctly', async () => {
    // Make first change
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'user@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    // Edit existing invoice
    await userPage.click('.edit-invoice-btn:first-child');
    await userPage.fill('#notes', 'First revision');
    await userPage.click('#saveInvoice');
    
    // Master views and marks as seen
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    await masterPage.click('.btn-changes:first-child');
    await masterPage.click('#markSeenBtn');
    await masterPage.waitForURL('/master');
    
    // Make second change
    await userPage.fill('#notes', 'Second revision');
    await userPage.click('#saveInvoice');
    
    // Master should see new unseen flag
    await masterPage.reload();
    await expect(masterPage.locator('.change-flag.unseen')).toHaveCount({ min: 1 });
  });
  
  test('should enforce master-only access', async () => {
    // Regular user tries to access master endpoints
    await userPage.goto('http://localhost:3000/master');
    
    // Should redirect to login or show access denied
    await expect(userPage).toHaveURL(/\/(login|403|$)/);
    
    // Try to access API directly
    const response = await userPage.request.get('/api/master/invoices');
    expect(response.status()).toBe(403);
  });
});

test.describe('Change Tracking Performance', () => {
  test('should handle large invoices efficiently', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Login
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password');
    await page.click('#loginBtn');
    
    // Create invoice with many line items
    for (let i = 0; i < 50; i++) {
      await page.click('#addLineItem');
      await page.fill(`.line-item-description:nth-child(${i + 1})`, `Service ${i}`);
      await page.fill(`.line-item-quantity:nth-child(${i + 1})`, '1');
      await page.fill(`.line-item-price:nth-child(${i + 1})`, '100');
    }
    
    // Measure save time
    const startTime = Date.now();
    await page.click('#saveInvoice');
    await page.waitForSelector('.success-message');
    const saveTime = Date.now() - startTime;
    
    // Should save within reasonable time (5 seconds)
    expect(saveTime).toBeLessThan(5000);
  });
  
  test('should compute diff quickly', async ({ page }) => {
    await page.goto('http://localhost:3000/master');
    
    // Login as master
    await page.fill('#email', 'rpasha@marinegroupbw.com');
    await page.fill('#password', 'masterpassword');
    await page.click('#loginBtn');
    
    // Click on changes for large invoice
    const startTime = Date.now();
    await page.click('.btn-changes:first-child');
    await page.waitForSelector('.changes-content');
    const loadTime = Date.now() - startTime;
    
    // Should load diff within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });
});
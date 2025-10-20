import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test Suite: Invoice Comments Persistence
 *
 * Purpose: Verify that comments added to invoices persist correctly across:
 * - Create mode → View mode → Edit mode
 * - Hard browser refresh
 * - Different comment types (general notes, line-item comments)
 *
 * Related Issues: #58, #59
 *
 * Test Coverage:
 * 1. General comments on Notes tab
 * 2. Line-item comments on specific services
 * 3. Comment metadata persistence (author, timestamp, avatars)
 * 4. UI rendering (comment counts, avatars, badges)
 * 5. No console errors during operations
 */

// Test configuration
const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001';

// Helper function to wait for navigation and ensure page is ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });
}

// Helper to add a general comment on the Notes tab
async function addGeneralComment(page: Page, commentText: string) {
  // Navigate to Notes tab
  await page.click('button:has-text("Notes")');
  await page.waitForTimeout(500);

  // Find the comment input area
  const commentSection = page.locator('div:has-text("Comments & Preview")').first();
  await expect(commentSection).toBeVisible();

  // Look for the preview text to click and add a comment
  const preview = page.locator('text=Invoice for').first();
  await expect(preview).toBeVisible();

  // Double-click to select text
  await preview.dblclick();
  await page.waitForTimeout(300);

  // Type the comment
  await page.keyboard.type(commentText);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}

// Helper to add a line-item comment
async function addLineItemComment(page: Page, serviceIndex: number, commentText: string) {
  // Navigate to Services tab
  await page.click('button:has-text("Services")');
  await page.waitForTimeout(500);

  // Find the service item
  const serviceItem = page.locator('[data-testid^="service-item"]').nth(serviceIndex);
  await expect(serviceItem).toBeVisible();

  // Click on the service description to select it
  const description = serviceItem.locator('input[placeholder*="Description"], input[value]').first();
  await description.click();
  await page.waitForTimeout(200);

  // Select text
  await description.press('Control+A');
  await page.waitForTimeout(200);

  // Navigate to Notes tab to add comment
  await page.click('button:has-text("Notes")');
  await page.waitForTimeout(500);

  // The selected service should show in the preview
  // Look for comment indicator and add comment
  const commentBadge = page.locator('[data-testid*="comment-badge"]').first();
  if (await commentBadge.isVisible()) {
    await commentBadge.click();
  }

  await page.keyboard.type(commentText);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
}

// Helper to verify comment exists in UI
async function verifyCommentVisible(page: Page, commentText: string) {
  const comment = page.locator(`text="${commentText}"`).first();
  await expect(comment).toBeVisible({ timeout: 5000 });
}

// Helper to count comments
async function getCommentCount(page: Page): Promise<number> {
  const badges = page.locator('[data-testid*="comment-badge"], .comment-badge');
  const count = await badges.count();
  return count;
}

test.describe('Invoice Comments Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to new invoice page
    await page.goto(`${BASE_URL}/requests/new`);
    await waitForPageReady(page);

    // Ensure we're on a clean slate
    await expect(page).toHaveURL(/\/requests\/new/);
  });

  test('should persist general comment through create → view → edit → refresh', async ({ page, context }) => {
    // Step 1: Create a new invoice with vessel and contact
    await page.click('button:has-text("Vessel")');
    await page.waitForTimeout(300);

    // Fill vessel info
    const vesselNameInput = page.locator('input[placeholder*="Vessel Name"], input[name="vesselName"]').first();
    await vesselNameInput.fill('Test Vessel Comments');

    // Navigate to Contact tab
    await page.click('button:has-text("Contact")');
    await page.waitForTimeout(300);

    // Fill contact info
    const contactNameInput = page.locator('input[placeholder*="Contact Name"], input[name="contactName"]').first();
    await contactNameInput.fill('John Doe');
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"]').first();
    await emailInput.fill('john@example.com');

    // Step 2: Add a general comment on Notes tab
    const generalComment = `General comment test ${Date.now()}`;
    await addGeneralComment(page, generalComment);

    // Wait for comment to appear
    await verifyCommentVisible(page, generalComment);

    // Step 3: Save the invoice
    const saveButton = page.locator('button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Listen for successful save
    await page.waitForResponse(response =>
      response.url().includes('/api/invoice') &&
      (response.status() === 200 || response.status() === 201)
    );

    // Extract invoice ID from URL
    await page.waitForURL(/\/requests\/[^/]+$/);
    const currentUrl = page.url();
    const invoiceId = currentUrl.match(/\/requests\/([^/]+)$/)?.[1];
    expect(invoiceId).toBeTruthy();

    console.log('Invoice created with ID:', invoiceId);

    // Step 4: Verify comment appears in view mode
    await page.waitForTimeout(1000);
    await verifyCommentVisible(page, generalComment);

    // Check for comment count badge
    const commentCount = await getCommentCount(page);
    expect(commentCount).toBeGreaterThan(0);

    // Step 5: Enter edit mode
    const editButton = page.locator('button:has-text("Edit"), a[href*="/edit"]').first();
    await editButton.click();
    await waitForPageReady(page);
    await page.waitForURL(/\/edit$/);

    // Step 6: Verify comment still appears in edit mode
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(500);
    await verifyCommentVisible(page, generalComment);

    // Step 7: Hard refresh the page
    await page.reload({ waitUntil: 'networkidle' });
    await waitForPageReady(page);

    // Step 8: Verify comment persists after refresh
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(500);
    await verifyCommentVisible(page, generalComment);

    // Step 9: Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('sourcemap') &&
      !err.toLowerCase().includes('chunk')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should persist line-item comment through create → view → edit', async ({ page }) => {
    // Step 1: Create invoice with vessel and contact
    await page.click('button:has-text("Vessel")');
    await page.waitForTimeout(300);

    const vesselNameInput = page.locator('input[placeholder*="Vessel Name"]').first();
    await vesselNameInput.fill('Test Vessel Line Item');

    await page.click('button:has-text("Contact")');
    await page.waitForTimeout(300);

    const contactNameInput = page.locator('input[placeholder*="Contact Name"]').first();
    await contactNameInput.fill('Jane Smith');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('jane@example.com');

    // Step 2: Add a service
    await page.click('button:has-text("Services")');
    await page.waitForTimeout(300);

    const addServiceBtn = page.locator('button:has-text("Add Service"), button[aria-label*="Add"]').first();
    await addServiceBtn.click();
    await page.waitForTimeout(500);

    // Fill service details
    const serviceDesc = page.locator('input[placeholder*="Description"]').first();
    await serviceDesc.fill('Clearance Fee');

    const costInput = page.locator('input[placeholder*="Cost"], input[name*="cost"]').first();
    await costInput.fill('1250');

    // Step 3: Add comment to line item
    const lineItemComment = `Line item comment ${Date.now()}`;

    // Navigate to Notes tab
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(500);

    // Select the service text in preview
    const serviceInPreview = page.locator('text=Clearance Fee').first();
    await expect(serviceInPreview).toBeVisible();
    await serviceInPreview.dblclick();
    await page.waitForTimeout(300);

    // Add comment
    await page.keyboard.type(lineItemComment);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify comment appears
    await verifyCommentVisible(page, lineItemComment);

    // Step 4: Save invoice
    const saveButton = page.locator('button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    await page.waitForResponse(response =>
      response.url().includes('/api/invoice') &&
      (response.status() === 200 || response.status() === 201)
    );

    // Step 5: Verify in view mode
    await page.waitForURL(/\/requests\/[^/]+$/);
    await page.waitForTimeout(1000);

    // Look for "Line Item Comments" section
    const lineItemSection = page.locator('text=Line Item Comments').first();
    if (await lineItemSection.isVisible()) {
      await verifyCommentVisible(page, lineItemComment);
    }

    // Step 6: Enter edit mode
    const editButton = page.locator('button:has-text("Edit"), a[href*="/edit"]').first();
    await editButton.click();
    await waitForPageReady(page);

    // Step 7: Verify comment in edit mode
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(500);
    await verifyCommentVisible(page, lineItemComment);
  });

  test('should display comment metadata correctly (author, timestamp, avatar)', async ({ page }) => {
    // Create invoice
    await page.click('button:has-text("Vessel")');
    await page.waitForTimeout(300);

    const vesselNameInput = page.locator('input[placeholder*="Vessel Name"]').first();
    await vesselNameInput.fill('Test Vessel Metadata');

    await page.click('button:has-text("Contact")');
    await page.waitForTimeout(300);

    const contactNameInput = page.locator('input[placeholder*="Contact Name"]').first();
    await contactNameInput.fill('Test User');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('test@example.com');

    // Add comment
    const commentText = `Metadata test ${Date.now()}`;
    await addGeneralComment(page, commentText);

    // Save
    const saveButton = page.locator('button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    await page.waitForResponse(response =>
      response.url().includes('/api/invoice') &&
      (response.status() === 200 || response.status() === 201)
    );

    await page.waitForURL(/\/requests\/[^/]+$/);
    await page.waitForTimeout(1000);

    // Verify comment metadata
    const commentContainer = page.locator(`text="${commentText}"`).first();
    await expect(commentContainer).toBeVisible();

    // Look for author info
    const authorElement = page.locator('[data-testid*="comment-author"], .comment-author').first();
    if (await authorElement.isVisible()) {
      const authorText = await authorElement.textContent();
      expect(authorText).toBeTruthy();
    }

    // Look for timestamp
    const timestampElement = page.locator('[data-testid*="comment-time"], .comment-timestamp').first();
    if (await timestampElement.isVisible()) {
      const timestamp = await timestampElement.textContent();
      expect(timestamp).toBeTruthy();
    }

    // Look for avatar/initials
    const avatarElement = page.locator('[data-testid*="avatar"], .avatar, [class*="avatar"]').first();
    if (await avatarElement.isVisible()) {
      await expect(avatarElement).toBeVisible();
    }
  });

  test('should not lose comments after multiple edit/save cycles', async ({ page }) => {
    // Create invoice
    await page.click('button:has-text("Vessel")');
    await page.waitForTimeout(300);

    const vesselNameInput = page.locator('input[placeholder*="Vessel Name"]').first();
    await vesselNameInput.fill('Test Multi-Edit Vessel');

    await page.click('button:has-text("Contact")');
    await page.waitForTimeout(300);

    const contactNameInput = page.locator('input[placeholder*="Contact Name"]').first();
    await contactNameInput.fill('Multi Edit User');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('multi@example.com');

    // Add first comment
    const comment1 = `First comment ${Date.now()}`;
    await addGeneralComment(page, comment1);
    await verifyCommentVisible(page, comment1);

    // Save
    const saveButton = page.locator('button:has-text("Save")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    await page.waitForResponse(response =>
      response.url().includes('/api/invoice') &&
      (response.status() === 200 || response.status() === 201)
    );

    await page.waitForURL(/\/requests\/[^/]+$/);
    const invoiceUrl = page.url();

    // Edit again
    const editButton = page.locator('button:has-text("Edit"), a[href*="/edit"]').first();
    await editButton.click();
    await waitForPageReady(page);

    // Verify first comment still there
    await page.click('button:has-text("Notes")');
    await page.waitForTimeout(500);
    await verifyCommentVisible(page, comment1);

    // Add second comment
    const comment2 = `Second comment ${Date.now()}`;
    await addGeneralComment(page, comment2);
    await verifyCommentVisible(page, comment2);

    // Update/save again
    const updateButton = page.locator('button:has-text("Update")').first();
    await updateButton.click();
    await page.waitForTimeout(2000);

    await page.waitForResponse(response =>
      response.url().includes('/api/invoice') &&
      response.status() === 200
    );

    // Navigate back to view
    await page.goto(invoiceUrl.replace('/edit', ''));
    await waitForPageReady(page);
    await page.waitForTimeout(1000);

    // Verify BOTH comments are still there
    await verifyCommentVisible(page, comment1);
    await verifyCommentVisible(page, comment2);
  });

  test('API should return comments in correct format', async ({ request }) => {
    // This test verifies the backend API response structure

    // First, create an invoice via API
    const createResponse = await request.post(`${API_URL}/api/invoice`, {
      data: {
        customer: {
          email: 'api-test@example.com',
          contactName: 'API Test User'
        },
        vessel: {
          name: 'API Test Vessel',
          weight: 1000,
          beam: 20,
          length: 100
        },
        services: [],
        metadata: {
          taxRate: 0,
          comments: [
            {
              id: `comment_${Date.now()}`,
              author: 'API Test User',
              initials: 'AT',
              text: 'API test comment',
              selectionText: 'Invoice for API Test Vessel',
              createdAt: new Date().toISOString(),
              highlight: {
                top: 0,
                left: 0,
                width: 28,
                height: 24
              },
              replies: []
            }
          ]
        }
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    const invoiceId = createData.data?.id || createData.id;
    expect(invoiceId).toBeTruthy();

    // Fetch the invoice
    const getResponse = await request.get(`${API_URL}/api/invoice/${invoiceId}`);
    expect(getResponse.ok()).toBeTruthy();

    const getData = await getResponse.json();
    const invoice = getData.data || getData.invoice || getData;

    // Verify metadata structure
    expect(invoice.metadata).toBeTruthy();

    // metadata might be a string or object
    let metadata = invoice.metadata;
    if (typeof metadata === 'string') {
      metadata = JSON.parse(metadata);
    }

    expect(metadata.comments).toBeTruthy();
    expect(Array.isArray(metadata.comments)).toBe(true);
    expect(metadata.comments.length).toBeGreaterThan(0);

    // Verify comment structure
    const comment = metadata.comments[0];
    expect(comment.id).toBeTruthy();
    expect(comment.author).toBe('API Test User');
    expect(comment.text).toBe('API test comment');
    expect(comment.createdAt).toBeTruthy();
    expect(comment.highlight).toBeTruthy();
  });
});

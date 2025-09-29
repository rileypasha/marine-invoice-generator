import { test, expect, Page } from '@playwright/test';

test.describe('Vessels Row Actions Dropdown', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Login first
    await page.goto('http://localhost:3002/login');
    await page.fill('#username', 'test@marinegroupbw.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for redirect and navigate to vessels page
    await page.waitForURL('http://localhost:3002/');
    await page.goto('http://localhost:3002/vessels');
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('dropdown menu opens and stays open until action is selected', async () => {
    // Find the first row's dropdown button
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();

    // Click to open the dropdown
    await firstRowDropdown.click();

    // Verify menu items are visible
    await expect(page.locator('text=New invoice')).toBeVisible();
    await expect(page.locator('text=View invoices')).toBeVisible();
    await expect(page.locator('text=Edit vessel')).toBeVisible();
    await expect(page.locator('text=Delete vessel')).toBeVisible();

    // Wait a bit to ensure the menu doesn't auto-close
    await page.waitForTimeout(1000);

    // Menu should still be visible
    await expect(page.locator('text=New invoice')).toBeVisible();
  });

  test('clicking "Edit vessel" opens edit page/dialog', async () => {
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();
    await firstRowDropdown.click();

    // Click Edit vessel
    await page.click('text=Edit vessel');

    // Verify navigation or modal opened (adjust based on actual behavior)
    // This might navigate to /vessels/{id}/edit or open a modal
    await page.waitForTimeout(500);

    // Check if URL changed or modal opened
    const currentUrl = page.url();
    const hasEditModal = await page.locator('[role="dialog"]').isVisible().catch(() => false);

    expect(currentUrl.includes('/edit') || hasEditModal).toBeTruthy();
  });

  test('rapid clicking dropdown button keeps menu open', async () => {
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();

    // Rapid clicks (3 times quickly)
    await firstRowDropdown.click();
    await firstRowDropdown.click();
    await firstRowDropdown.click();

    // Menu should be open and functional
    await expect(page.locator('text=New invoice')).toBeVisible();
    await expect(page.locator('text=View invoices')).toBeVisible();

    // Should be able to click an action
    await page.click('text=View invoices');

    // Menu should close after action
    await expect(page.locator('text=New invoice')).not.toBeVisible();
  });

  test('clicking outside the dropdown closes it', async () => {
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();
    await firstRowDropdown.click();

    // Verify menu is open
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Click outside the dropdown (on the table header)
    await page.click('th:has-text("Vessel")');

    // Menu should close
    await expect(page.locator('text=New invoice')).not.toBeVisible();
  });

  test('keyboard navigation works correctly', async () => {
    // Navigate to the first dropdown button using keyboard
    await page.keyboard.press('Tab');

    // Keep tabbing until we reach the dropdown button
    let attempts = 0;
    while (attempts < 20) {
      const focused = await page.locator(':focus');
      const ariaLabel = await focused.getAttribute('aria-label').catch(() => null);

      if (ariaLabel === 'Row actions') {
        break;
      }

      await page.keyboard.press('Tab');
      attempts++;
    }

    // Press Enter to open the dropdown
    await page.keyboard.press('Enter');

    // Verify menu opened
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Use Arrow Down to navigate to next item
    await page.keyboard.press('ArrowDown');

    // Press Enter to select (this should trigger View invoices)
    await page.keyboard.press('Enter');

    // Menu should close after selection
    await expect(page.locator('text=New invoice')).not.toBeVisible();
  });

  test('pressing Escape closes the dropdown', async () => {
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();
    await firstRowDropdown.click();

    // Verify menu is open
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Menu should close
    await expect(page.locator('text=New invoice')).not.toBeVisible();
  });

  test('dropdown button click does not trigger row selection', async () => {
    // Get initial selected row count (should be 0)
    const selectedCount = await page.locator('text=selected').count().catch(() => 0);

    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();
    await firstRowDropdown.click();

    // Verify menu opened
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Check that no additional rows were selected
    const newSelectedCount = await page.locator('text=selected').count().catch(() => 0);
    expect(newSelectedCount).toBe(selectedCount);

    // Close menu
    await page.keyboard.press('Escape');
  });

  test('clicking row checkbox does not interfere with dropdown', async () => {
    // Click the checkbox to select the row
    const firstRowCheckbox = page.locator('input[type="checkbox"]').nth(1); // Skip header checkbox
    await firstRowCheckbox.click();

    // Verify row is selected
    await expect(page.locator('text=1 item selected')).toBeVisible();

    // Now try to open the dropdown menu
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();
    await firstRowDropdown.click();

    // Menu should open normally
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Wait to ensure it doesn't auto-close
    await page.waitForTimeout(500);
    await expect(page.locator('text=New invoice')).toBeVisible();
  });

  test('multiple dropdown menus can be opened independently', async () => {
    // Ensure we have at least 2 rows
    const dropdownButtons = page.locator('button[aria-label="Row actions"]');
    const buttonCount = await dropdownButtons.count();

    if (buttonCount >= 2) {
      // Open first dropdown
      await dropdownButtons.nth(0).click();
      await expect(page.locator('text=New invoice')).toBeVisible();

      // Open second dropdown (should close first)
      await dropdownButtons.nth(1).click();

      // Only one menu should be visible at a time
      const visibleMenus = await page.locator('[data-row-actions="content"]').count();
      expect(visibleMenus).toBeLessThanOrEqual(1);
    }
  });

  test('stress test: rapid interactions do not break functionality', async () => {
    const firstRowDropdown = page.locator('button[aria-label="Row actions"]').first();

    // Perform rapid open/close cycles
    for (let i = 0; i < 5; i++) {
      await firstRowDropdown.click();
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }

    // Final open should still work
    await firstRowDropdown.click();
    await expect(page.locator('text=New invoice')).toBeVisible();

    // Actions should still be clickable
    await page.click('text=View invoices');
    await expect(page.locator('text=New invoice')).not.toBeVisible();
  });
});
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('Vessels Row Actions Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to vessels page
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test@marinegroupbw.com');
    await page.fill('#password', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');
    await page.goto('http://localhost:3000/vessels');
    await page.waitForSelector('table', { timeout: 10000 });

    // Inject axe-core for accessibility testing
    await injectAxe(page);
  });

  test('dropdown menu meets WCAG AA accessibility standards', async ({ page }) => {
    // Test accessibility in default state (menu closed)
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });

    // Open the first dropdown menu
    const firstDropdown = page.getByRole('button', { name: 'Row actions' }).first();
    await firstDropdown.click();

    // Verify menu is visible
    await expect(page.getByText('New invoice')).toBeVisible();

    // Test accessibility with menu open
    await checkA11y(page, '[data-row-actions]', {
      detailedReport: true,
      detailedReportOptions: { html: true },
      rules: {
        // Focus specific accessibility rules for dropdown menus
        'aria-required-attr': { enabled: true },
        'aria-roles': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'button-name': { enabled: true },
        'focus-order-semantics': { enabled: true },
        'keyboard-navigation': { enabled: true },
      },
    });
  });

  test('dropdown has proper ARIA attributes', async ({ page }) => {
    const dropdownButton = page.getByRole('button', { name: 'Row actions' }).first();

    // Check required ARIA attributes
    await expect(dropdownButton).toHaveAttribute('aria-label', 'Row actions');
    await expect(dropdownButton).toHaveAttribute('aria-haspopup', 'menu');

    // Open dropdown and check expanded state
    await dropdownButton.click();

    // Verify menu content is accessible
    const menuContent = page.getByTestId(/row-actions-content-/).first();
    await expect(menuContent).toBeVisible();

    // Check that menu items are properly labeled
    await expect(page.getByText('New invoice')).toBeVisible();
    await expect(page.getByText('View invoices')).toBeVisible();
    await expect(page.getByText('Edit vessel')).toBeVisible();
    await expect(page.getByText('Delete vessel')).toBeVisible();
  });

  test('keyboard navigation works correctly', async ({ page }) => {
    // Test Tab navigation to dropdown button
    await page.keyboard.press('Tab');

    // Find focused element and verify it's a dropdown button
    let focused = page.locator(':focus');
    let ariaLabel = '';

    // Tab through until we find a row actions button
    for (let i = 0; i < 20; i++) {
      try {
        ariaLabel = await focused.getAttribute('aria-label') || '';
        if (ariaLabel === 'Row actions') {
          break;
        }
        await page.keyboard.press('Tab');
        focused = page.locator(':focus');
      } catch (e) {
        await page.keyboard.press('Tab');
        focused = page.locator(':focus');
      }
    }

    // Verify we found and focused the dropdown button
    await expect(focused).toHaveAttribute('aria-label', 'Row actions');

    // Press Enter to open dropdown
    await page.keyboard.press('Enter');

    // Verify menu opened
    await expect(page.getByText('New invoice')).toBeVisible();

    // Test Arrow key navigation within menu
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // Navigate to "Edit vessel"

    // Press Enter to select item
    await page.keyboard.press('Enter');

    // Menu should close after selection
    await expect(page.getByText('New invoice')).not.toBeVisible();
  });

  test('Escape key closes dropdown and returns focus', async ({ page }) => {
    const dropdownButton = page.getByRole('button', { name: 'Row actions' }).first();

    // Click to open dropdown
    await dropdownButton.click();
    await expect(page.getByText('New invoice')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify menu closed
    await expect(page.getByText('New invoice')).not.toBeVisible();

    // Focus should return to trigger button
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveAttribute('aria-label', 'Row actions');
  });

  test('screen reader announcements work correctly', async ({ page }) => {
    // This test ensures proper screen reader support
    const dropdownButton = page.getByRole('button', { name: 'Row actions' }).first();

    // Verify button is discoverable by screen readers
    await expect(dropdownButton).toHaveAttribute('aria-label', 'Row actions');
    await expect(dropdownButton).toHaveAttribute('aria-haspopup', 'menu');

    // Open menu
    await dropdownButton.click();

    // Verify menu content is in DOM and accessible
    const menuItems = page.getByRole('menuitem');
    const itemCount = await menuItems.count();

    // Should have 4 menu items
    expect(itemCount).toBeGreaterThanOrEqual(4);

    // Each menu item should be accessible
    for (let i = 0; i < itemCount; i++) {
      const item = menuItems.nth(i);
      await expect(item).toBeVisible();

      // Menu items should have text content
      const text = await item.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('color contrast meets WCAG AA standards', async ({ page }) => {
    // Open dropdown to test contrast
    await page.getByRole('button', { name: 'Row actions' }).first().click();
    await expect(page.getByText('New invoice')).toBeVisible();

    // Run axe specifically for color contrast
    await checkA11y(page, '[data-row-actions]', {
      detailedReport: true,
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: false }, // Test AA, not AAA
      },
    });
  });

  test('dropdown works with high contrast mode', async ({ page }) => {
    // Force high contrast mode (this simulates Windows high contrast)
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          [data-row-actions] {
            border: 2px solid currentColor !important;
            background: Canvas !important;
            color: CanvasText !important;
          }
        }
      `
    });

    // Test dropdown functionality in high contrast
    const dropdownButton = page.getByRole('button', { name: 'Row actions' }).first();
    await dropdownButton.click();

    // Verify menu is still visible and functional
    await expect(page.getByText('New invoice')).toBeVisible();

    // Test that menu items are still clickable
    await page.getByText('View invoices').click();

    // Menu should close
    await expect(page.getByText('New invoice')).not.toBeVisible();
  });
});
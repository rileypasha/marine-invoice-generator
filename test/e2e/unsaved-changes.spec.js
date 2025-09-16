/**
 * End-to-End tests for Unsaved Changes Warning System
 *
 * Tests navigation protection, logout protection, and accessibility
 */

import { test, expect } from '@playwright/test';

test.describe('Unsaved Changes Warning System', () => {
  // Test data
  const testUser = {
    email: 'test@marinegroup.com',
    password: 'password123'
  };

  const vesselData = {
    name: 'Test Vessel',
    weight: '100',
    beam: '25'
  };

  const customerData = {
    name: 'Test Customer',
    email: 'customer@example.com',
    phone: '123-456-7890'
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('.app-container');

    // Check if already signed in, if not sign in
    const signInBtn = page.locator('#sign-in-btn');
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
      await page.waitForSelector('.auth-modal');

      await page.fill('#auth-email', testUser.email);
      await page.fill('#auth-password', testUser.password);
      await page.click('#auth-submit');

      // Wait for sign in to complete
      await page.waitForSelector('#user-section', { state: 'visible' });
    }

    // Wait for the app to be fully loaded
    await page.waitForTimeout(1000);
  });

  test.describe('Change Detection', () => {
    test('should detect vessel data changes', async ({ page }) => {
      // Fill in vessel data
      await page.fill('#vessel-name', vesselData.name);
      await page.fill('#vessel-weight', vesselData.weight);

      // Check if page title shows unsaved changes
      await expect(page).toHaveTitle(/●.*Marine Group/);

      // Check if save button has unsaved changes styling
      const saveBtn = page.locator('#save-invoice');
      await expect(saveBtn).toHaveClass(/has-unsaved-changes/);
    });

    test('should detect customer data changes', async ({ page }) => {
      // Switch to customer tab
      await page.click('[data-tab="customer"]');

      // Fill in customer data
      await page.fill('#customer-name', customerData.name);
      await page.fill('#customer-email', customerData.email);

      // Check for unsaved changes indicators
      await expect(page).toHaveTitle(/●.*Marine Group/);
      await expect(page.locator('#save-invoice')).toHaveClass(/has-unsaved-changes/);
    });

    test('should detect line item changes', async ({ page }) => {
      // Switch to services tab
      await page.click('[data-tab="scope"]');

      // Add a line item
      await page.click('#add-line-item');
      await page.waitForSelector('.line-item-card');

      // Fill in line item data
      await page.selectOption('.job-type-select', 'Manual Entry');
      await page.waitForSelector('.item-type-select', { state: 'visible' });
      await page.selectOption('.item-type-select', 'Material');
      await page.fill('.manual-cost-input', '100.00');

      // Check for unsaved changes indicators
      await expect(page).toHaveTitle(/●.*Marine Group/);
      await expect(page.locator('#save-invoice')).toHaveClass(/has-unsaved-changes/);
    });

    test('should clear unsaved changes after save', async ({ page }) => {
      // Make some changes
      await page.fill('#vessel-name', vesselData.name);

      // Verify unsaved changes
      await expect(page).toHaveTitle(/●.*Marine Group/);

      // Save the invoice
      await page.click('#save-invoice');

      // Wait for save dialog
      await page.waitForSelector('#prompt-modal', { state: 'visible' });
      await page.fill('#prompt-input', 'Test Invoice');
      await page.click('#prompt-confirm');

      // Wait for save completion
      await page.waitForSelector('#prompt-modal', { state: 'hidden' });

      // Verify unsaved changes are cleared
      await expect(page).toHaveTitle(/^(?!.*●).*Marine Group/);
      await expect(page.locator('#save-invoice')).not.toHaveClass(/has-unsaved-changes/);
    });
  });

  test.describe('Navigation Protection', () => {
    test('should block tab navigation with unsaved changes', async ({ page }) => {
      // Make changes in vessel tab
      await page.fill('#vessel-name', vesselData.name);

      // Try to switch to customer tab
      await page.click('[data-tab="customer"]');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Verify dialog content
      await expect(page.locator('#unsaved-dialog-title')).toContainText('Switch Tab?');
      await expect(page.locator('#unsaved-dialog-description')).toContainText('unsaved changes');

      // Cancel navigation
      await page.click('#unsaved-cancel-btn');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

      // Should remain on vessel tab
      await expect(page.locator('[data-tab="vessel"]')).toHaveClass(/active/);
    });

    test('should allow navigation after saving changes', async ({ page }) => {
      // Make changes in vessel tab
      await page.fill('#vessel-name', vesselData.name);

      // Try to switch to customer tab
      await page.click('[data-tab="customer"]');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Choose to save and continue
      await page.click('#unsaved-save-btn');

      // Wait for save prompt
      await page.waitForSelector('#prompt-modal', { state: 'visible' });
      await page.fill('#prompt-input', 'Test Invoice');
      await page.click('#prompt-confirm');

      // Wait for navigation to complete
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });
      await page.waitForSelector('#prompt-modal', { state: 'hidden' });

      // Should now be on customer tab
      await expect(page.locator('[data-tab="customer"]')).toHaveClass(/active/);
      await expect(page.locator('[data-section="customer"]')).toHaveClass(/visible/);
    });

    test('should allow navigation after discarding changes', async ({ page }) => {
      // Make changes in vessel tab
      await page.fill('#vessel-name', vesselData.name);

      // Try to switch to customer tab
      await page.click('[data-tab="customer"]');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Choose to discard changes
      await page.click('#unsaved-discard-btn');

      // Wait for navigation to complete
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

      // Should now be on customer tab
      await expect(page.locator('[data-tab="customer"]')).toHaveClass(/active/);
      await expect(page.locator('[data-section="customer"]')).toHaveClass(/visible/);

      // Changes should be discarded
      await page.click('[data-tab="vessel"]');
      await expect(page.locator('#vessel-name')).toHaveValue('');
    });

    test('should block new invoice creation with unsaved changes', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Try to create new invoice
      await page.click('.new-invoice-btn');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });
      await expect(page.locator('#unsaved-dialog-title')).toContainText('Create New Invoice?');

      // Cancel creation
      await page.click('#unsaved-cancel-btn');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

      // Changes should still be there
      await expect(page.locator('#vessel-name')).toHaveValue(vesselData.name);
    });

    test('should protect against browser navigation', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Try to navigate away (this tests beforeunload)
      const navigationPromise = page.goto('https://example.com');

      // Check if the browser shows a confirmation dialog
      // Note: Modern browsers show their own dialog, we can't fully test this
      // but we can verify the beforeunload handler is set up

      // Cancel the navigation attempt
      await page.goBack().catch(() => {}); // Ignore potential errors

      // Verify we're still on the original page
      await expect(page.locator('#vessel-name')).toHaveValue(vesselData.name);
    });
  });

  test.describe('Logout Protection', () => {
    test('should block logout with unsaved changes', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Try to logout by clicking user section (opens settings)
      await page.click('#user-section');
      await page.waitForSelector('.settings-modal', { state: 'visible' });

      // Click logout button
      await page.click('#logout-btn');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });
      await expect(page.locator('#unsaved-dialog-title')).toContainText('Sign Out?');

      // Cancel logout
      await page.click('#unsaved-cancel-btn');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

      // Should still be logged in
      await expect(page.locator('#user-section')).toBeVisible();
      await expect(page.locator('#vessel-name')).toHaveValue(vesselData.name);
    });

    test('should allow logout after saving changes', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Open settings and try to logout
      await page.click('#user-section');
      await page.waitForSelector('.settings-modal', { state: 'visible' });
      await page.click('#logout-btn');

      // Should show unsaved changes dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Choose to save and logout
      await page.click('#unsaved-save-btn');

      // Wait for save prompt
      await page.waitForSelector('#prompt-modal', { state: 'visible' });
      await page.fill('#prompt-input', 'Test Invoice Before Logout');
      await page.click('#prompt-confirm');

      // Should eventually be redirected to landing page
      await page.waitForURL('/', { timeout: 10000 });
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes on dialog', async ({ page }) => {
      // Make changes and trigger dialog
      await page.fill('#vessel-name', vesselData.name);
      await page.click('[data-tab="customer"]');

      // Wait for dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Check ARIA attributes
      const dialog = page.locator('.unsaved-changes-dialog');
      await expect(dialog).toHaveAttribute('role', 'alertdialog');
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      await expect(dialog).toHaveAttribute('aria-labelledby', 'unsaved-dialog-title');
      await expect(dialog).toHaveAttribute('aria-describedby', 'unsaved-dialog-description');

      // Check aria-hidden on overlay
      const overlay = page.locator('.unsaved-changes-overlay');
      await expect(overlay).toHaveAttribute('aria-hidden', 'false');
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Make changes and trigger dialog
      await page.fill('#vessel-name', vesselData.name);
      await page.click('[data-tab="customer"]');

      // Wait for dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Test Tab key navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('#unsaved-cancel-btn')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('#unsaved-save-btn')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('#unsaved-discard-btn')).toBeFocused();

      // Test Shift+Tab (reverse navigation)
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator('#unsaved-save-btn')).toBeFocused();

      // Test Escape key
      await page.keyboard.press('Escape');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });
    });

    test('should support Enter key on buttons', async ({ page }) => {
      // Make changes and trigger dialog
      await page.fill('#vessel-name', vesselData.name);
      await page.click('[data-tab="customer"]');

      // Wait for dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Focus cancel button and press Enter
      await page.focus('#unsaved-cancel-btn');
      await page.keyboard.press('Enter');

      // Dialog should close
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });
    });

    test('should have proper focus management', async ({ page }) => {
      // Store initial focus
      const initialFocus = await page.evaluate(() => document.activeElement.id);

      // Make changes and trigger dialog
      await page.fill('#vessel-name', vesselData.name);
      await page.click('[data-tab="customer"]');

      // Wait for dialog and check focus is trapped
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Dialog should have focus on one of its buttons
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toHaveClass(/dialog-btn/);

      // Close dialog and check focus restoration
      await page.click('#unsaved-cancel-btn');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

      // Focus should return to the triggering element
      const currentFocus = await page.evaluate(() => document.activeElement.getAttribute('data-tab'));
      expect(currentFocus).toBe('customer');
    });

    test('should have high contrast support', async ({ page }) => {
      // Enable high contrast mode simulation
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

      // Make changes and trigger dialog
      await page.fill('#vessel-name', vesselData.name);
      await page.click('[data-tab="customer"]');

      // Wait for dialog
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

      // Check if high contrast styles are applied
      const dialog = page.locator('.unsaved-changes-dialog');
      const borderWidth = await dialog.evaluate(el => getComputedStyle(el).borderWidth);

      // In high contrast mode, borders should be thicker
      expect(parseInt(borderWidth)).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Browser Compatibility', () => {
    test('should handle beforeunload events', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Set up beforeunload listener check
      const beforeUnloadSet = await page.evaluate(() => {
        return window.onbeforeunload !== null;
      });

      expect(beforeUnloadSet).toBe(true);
    });

    test('should handle page refresh with unsaved changes', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // The browser should show a dialog on refresh
      // We can't fully test this due to browser security,
      // but we can verify the handler is in place
      const hasBeforeUnload = await page.evaluate(() => {
        return typeof window.onbeforeunload === 'function';
      });

      expect(hasBeforeUnload).toBe(true);
    });
  });

  test.describe('Performance', () => {
    test('should debounce change detection', async ({ page }) => {
      // Type rapidly in vessel name field
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        await page.type('#vessel-name', 'a', { delay: 50 });
      }

      // Wait for debouncing
      await page.waitForTimeout(500);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have completed within reasonable time despite rapid changes
      expect(duration).toBeLessThan(2000);

      // Should show unsaved changes
      await expect(page).toHaveTitle(/●.*Marine Group/);
    });

    test('should handle large amounts of data efficiently', async ({ page }) => {
      // Switch to services tab
      await page.click('[data-tab="scope"]');

      // Add multiple line items rapidly
      const startTime = Date.now();

      for (let i = 0; i < 5; i++) {
        await page.click('#add-line-item');
        await page.waitForSelector('.line-item-card:last-child .job-type-select');
        await page.selectOption('.line-item-card:last-child .job-type-select', 'Manual Entry');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete efficiently
      expect(duration).toBeLessThan(5000);

      // Should detect changes
      await expect(page).toHaveTitle(/●.*Marine Group/);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle save failures gracefully', async ({ page }) => {
      // Make changes
      await page.fill('#vessel-name', vesselData.name);

      // Simulate network error by intercepting save request
      await page.route('/api/**', route => {
        if (route.request().method() === 'POST') {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Try to trigger save through navigation
      await page.click('[data-tab="customer"]');
      await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });
      await page.click('#unsaved-save-btn');

      // Should handle save failure gracefully
      // The dialog might show an error or remain open
      await page.waitForTimeout(3000);

      // Dialog should still be visible or show error state
      const dialogVisible = await page.locator('.unsaved-changes-dialog').isVisible();
      const errorVisible = await page.locator('.dialog-btn.loading').isVisible();

      expect(dialogVisible || errorVisible).toBe(true);
    });
  });
});
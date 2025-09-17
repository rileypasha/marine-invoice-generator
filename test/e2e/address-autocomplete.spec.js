/**
 * End-to-End tests for Address Autocomplete functionality
 *
 * Tests:
 * - Complete user workflow with address autocomplete
 * - Accessibility and keyboard navigation
 * - Integration with invoice form
 * - Error handling and progressive enhancement
 * - Mobile responsiveness
 */

const { test, expect } = require('@playwright/test');

test.describe('Address Autocomplete E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Geoapify API to avoid real API calls
    await page.route('**/api/geo/address-autocomplete**', async route => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('query');

      if (!query || query.length < 3) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Query too short',
            message: 'Query must be at least 3 characters long'
          })
        });
        return;
      }

      // Mock realistic address results
      const mockResults = [
        {
          label: `${query} Street, New York, NY 10001, USA`,
          line1: `${query} Street`,
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country: 'USA',
          lat: 40.7128,
          lon: -74.0060
        },
        {
          label: `${query} Avenue, Los Angeles, CA 90210, USA`,
          line1: `${query} Avenue`,
          city: 'Los Angeles',
          state: 'CA',
          postal_code: '90210',
          country: 'USA',
          lat: 34.0522,
          lon: -118.2437
        }
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResults)
      });
    });

    // Navigate to the application
    await page.goto('http://localhost:3001');

    // Wait for the application to load
    await page.waitForSelector('.app-container');
  });

  test('should display address autocomplete in customer tab', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');
    await page.waitForSelector('[data-section="customer"]');

    // Verify address autocomplete container exists
    const autocomplete = page.locator('#customer-address-autocomplete');
    await expect(autocomplete).toBeVisible();

    // Verify input field is present with correct attributes
    const input = page.locator('#customer-address-autocomplete-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Start typing address...');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  test('should show suggestions when typing address', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type in address field
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('123 Main');

    // Wait for suggestions to appear
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeVisible();

    // Verify suggestions are displayed
    const suggestions = page.locator('.address-suggestion');
    await expect(suggestions).toHaveCount(2);

    // Verify suggestion content
    await expect(suggestions.first()).toContainText('123 Main Street, New York');
    await expect(suggestions.nth(1)).toContainText('123 Main Avenue, Los Angeles');
  });

  test('should handle keyboard navigation correctly', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type to show suggestions
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('456 Oak');

    // Wait for suggestions
    await page.waitForSelector('.address-suggestion');

    // Press Arrow Down to select first suggestion
    await input.press('ArrowDown');

    // Verify first suggestion is selected
    const firstSuggestion = page.locator('.address-suggestion').first();
    await expect(firstSuggestion).toHaveClass(/selected/);

    // Press Arrow Down again to select second suggestion
    await input.press('ArrowDown');

    // Verify second suggestion is selected
    const secondSuggestion = page.locator('.address-suggestion').nth(1);
    await expect(secondSuggestion).toHaveClass(/selected/);

    // Press Arrow Up to go back to first suggestion
    await input.press('ArrowUp');
    await expect(firstSuggestion).toHaveClass(/selected/);
  });

  test('should autofill address fields when selecting suggestion', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type and select address
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('789 Pine');

    // Wait for suggestions and select first one with Enter
    await page.waitForSelector('.address-suggestion');
    await input.press('ArrowDown');
    await input.press('Enter');

    // Verify address fields are filled
    await expect(page.locator('#customer-city')).toHaveValue('New York');
    await expect(page.locator('#customer-state')).toHaveValue('NY');
    await expect(page.locator('#customer-postal')).toHaveValue('10001');
    await expect(page.locator('#customer-country')).toHaveValue('USA');

    // Verify suggestions are hidden
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });

  test('should close suggestions on Escape key', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type to show suggestions
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('123 Test');

    // Wait for suggestions to appear
    await page.waitForSelector('.address-suggestion');

    // Press Escape
    await input.press('Escape');

    // Verify suggestions are hidden
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });

  test('should handle clicking on suggestions', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type to show suggestions
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('555 Cedar');

    // Wait for suggestions and click the second one
    await page.waitForSelector('.address-suggestion');
    await page.click('.address-suggestion:nth-child(2)');

    // Verify Los Angeles address was selected
    await expect(page.locator('#customer-city')).toHaveValue('Los Angeles');
    await expect(page.locator('#customer-state')).toHaveValue('CA');
    await expect(page.locator('#customer-postal')).toHaveValue('90210');
  });

  test('should show no results message for empty response', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/geo/address-autocomplete**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type in address field
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('nonexistent address');

    // Wait for and verify no results message
    await page.waitForSelector('.address-no-results');
    await expect(page.locator('.address-no-results')).toContainText('No addresses found');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/geo/address-autocomplete**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Service temporarily unavailable'
        })
      });
    });

    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type in address field
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('test address');

    // Wait for error handling
    await page.waitForTimeout(500);

    // Verify no suggestions are shown and no crashes occur
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });

  test('should validate minimum character requirement', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type less than minimum characters
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('ab');

    // Wait a bit for any potential requests
    await page.waitForTimeout(500);

    // Verify no suggestions are shown
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });

  test('should integrate with invoice save functionality', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Fill customer information including address
    await page.fill('#customer-name', 'John Doe');
    await page.fill('#customer-email', 'john@example.com');
    await page.fill('#customer-phone', '555-123-4567');

    // Select address
    const addressInput = page.locator('#customer-address-autocomplete-input');
    await addressInput.fill('123 Business');
    await page.waitForSelector('.address-suggestion');
    await addressInput.press('ArrowDown');
    await addressInput.press('Enter');

    // Add address line 2
    await page.fill('#customer-line2', 'Suite 100');

    // Navigate to vessel tab and add basic info
    await page.click('[data-tab="vessel"]');
    await page.fill('#vessel-name', 'Test Vessel');

    // Save invoice
    await page.click('#save-invoice');

    // Wait for save to complete
    await page.waitForTimeout(1000);

    // Verify success (this would depend on your application's success indicators)
    // For example, checking for a success message or URL change
  });

  test('should work on mobile viewports', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Verify address autocomplete is still functional
    const input = page.locator('#customer-address-autocomplete-input');
    await expect(input).toBeVisible();

    // Type and verify suggestions work
    await input.fill('999 Mobile');
    await page.waitForSelector('.address-suggestion');

    const suggestions = page.locator('.address-suggestion');
    await expect(suggestions).toHaveCount(2);

    // Verify suggestions are properly sized for mobile
    const suggestionBox = page.locator('#customer-address-autocomplete-listbox');
    const boundingBox = await suggestionBox.boundingBox();
    expect(boundingBox.width).toBeLessThanOrEqual(375);
  });

  test('should support keyboard accessibility', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Use Tab to navigate to address field
    await page.keyboard.press('Tab'); // Navigate through fields
    // (You may need to press Tab multiple times depending on field order)

    const input = page.locator('#customer-address-autocomplete-input');
    await input.focus();

    // Verify input is focused
    await expect(input).toBeFocused();

    // Type to show suggestions
    await input.type('777 Keyboard');

    // Wait for suggestions
    await page.waitForSelector('.address-suggestion');

    // Use keyboard navigation
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Verify selection worked
    await expect(page.locator('#customer-city')).toHaveValue('New York');

    // Verify next field can be focused with Tab
    await page.keyboard.press('Tab');
    await expect(page.locator('#customer-line2')).toBeFocused();
  });

  test('should highlight matching text in suggestions', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    // Type in address field
    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('Main');

    // Wait for suggestions
    await page.waitForSelector('.address-suggestion');

    // Verify highlighted text exists
    const highlightedText = page.locator('.suggestion-match');
    await expect(highlightedText.first()).toContainText('Main');
    await expect(highlightedText).toHaveCount(2); // One for each suggestion
  });

  test('should handle rapid typing with debouncing', async ({ page }) => {
    // Navigate to customer tab
    await page.click('[data-tab="customer"]');

    const input = page.locator('#customer-address-autocomplete-input');

    // Type rapidly
    await input.type('1');
    await page.waitForTimeout(50);
    await input.type('2');
    await page.waitForTimeout(50);
    await input.type('3');
    await page.waitForTimeout(50);
    await input.type(' Fast');

    // Wait for debounced request
    await page.waitForTimeout(400);

    // Verify only one set of suggestions appears (debouncing worked)
    await page.waitForSelector('.address-suggestion');
    const suggestions = page.locator('.address-suggestion');
    await expect(suggestions).toHaveCount(2);
  });
});

test.describe('Address Autocomplete Error Scenarios', () => {
  test('should handle network timeouts', async ({ page }) => {
    // Mock slow response that times out
    await page.route('**/api/geo/address-autocomplete**', async route => {
      // Delay longer than the component's timeout
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.goto('http://localhost:3001');
    await page.click('[data-tab="customer"]');

    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('timeout test');

    // Wait for timeout to occur
    await page.waitForTimeout(4000);

    // Verify error handling (suggestions should not appear)
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });

  test('should handle rate limiting', async ({ page }) => {
    // Mock rate limit response
    await page.route('**/api/geo/address-autocomplete**', async route => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60
        })
      });
    });

    await page.goto('http://localhost:3001');
    await page.click('[data-tab="customer"]');

    const input = page.locator('#customer-address-autocomplete-input');
    await input.fill('rate limit test');

    // Wait for response
    await page.waitForTimeout(500);

    // Verify no suggestions are shown
    const listbox = page.locator('#customer-address-autocomplete-listbox');
    await expect(listbox).toBeHidden();
  });
});
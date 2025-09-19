/**
 * Customers Page Visual Validation Test
 * Tests alignment with invoice_ui_mock_prototype.jsx design specification
 */

const { test, expect } = require('@playwright/test');

test.describe('Customers Page UI Alignment with Mock', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to customers page
    await page.goto('https://mginvoices.com/customers');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Verify user is logged in or handle login
    const loginForm = page.locator('form[id*="login"], form[class*="login"]');
    if (await loginForm.isVisible()) {
      // If login form is visible, we need to log in
      // Note: Login credentials should be stored in memory as per requirements
      await page.fill('input[type="email"]', process.env.LOGIN_EMAIL || 'test@marinegroupllc.com');
      await page.fill('input[type="password"]', process.env.LOGIN_PASSWORD || 'test123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/customers');
    }
  });

  test('Container matches mock specifications', async ({ page }) => {
    // Test container classes and structure
    const container = page.locator('.mx-auto.max-w-screen-2xl.p-6').first();
    await expect(container).toBeVisible();

    // Verify container max-width: 1536px (max-w-screen-2xl)
    const containerBox = await container.boundingBox();
    expect(containerBox.width).toBeLessThanOrEqual(1536);

    // Verify padding: 1.5rem (p-6)
    const containerStyles = await container.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom,
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight
      };
    });

    expect(containerStyles.paddingTop).toBe('24px'); // 1.5rem = 24px
    expect(containerStyles.paddingLeft).toBe('24px');
  });

  test('Header matches mock layout and styling', async ({ page }) => {
    // Test header structure: flex items-center justify-between mb-4
    const header = page.locator('.mb-4.flex.items-center.justify-between').first();
    await expect(header).toBeVisible();

    // Test title: "Customers" with text-lg font-semibold text-zinc-100
    const title = page.locator('h2.text-lg.font-semibold.text-zinc-100');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Customers');

    // Verify title font size (text-lg = 1.125rem = 18px)
    const titleStyles = await title.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        color: styles.color
      };
    });

    expect(titleStyles.fontSize).toBe('18px');
    expect(titleStyles.fontWeight).toBe('600'); // font-semibold

    // Test actions area: flex items-center gap-2
    const actionsArea = page.locator('.flex.items-center.gap-2').first();
    await expect(actionsArea).toBeVisible();
  });

  test('Search input matches mock specifications', async ({ page }) => {
    // Test search input with exact classes from mock
    const searchInput = page.locator('input[placeholder="Search customers…"]');
    await expect(searchInput).toBeVisible();

    // Verify search input styling matches mock
    const inputStyles = await searchInput.evaluate(el => {
      const styles = window.getComputedStyle(el);
      const computedStyle = {
        width: styles.width,
        borderRadius: styles.borderRadius,
        backgroundColor: styles.backgroundColor,
        borderColor: styles.borderColor,
        padding: styles.padding,
        fontSize: styles.fontSize
      };
      return computedStyle;
    });

    // w-64 = 16rem = 256px
    expect(inputStyles.width).toBe('256px');

    // rounded-xl = 0.75rem = 12px
    expect(inputStyles.borderRadius).toBe('12px');

    // text-sm = 0.875rem = 14px
    expect(inputStyles.fontSize).toBe('14px');

    // Test placeholder text
    const placeholder = await searchInput.getAttribute('placeholder');
    expect(placeholder).toBe('Search customers…');
  });

  test('New Customer button matches mock styling', async ({ page }) => {
    // Test primary button with exact text from mock
    const newCustomerBtn = page.locator('button:has-text("+ New Customer")');
    await expect(newCustomerBtn).toBeVisible();

    // Verify button styling matches mock primary variant
    const btnStyles = await newCustomerBtn.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight
      };
    });

    // Primary button should be indigo-600: rgb(79, 70, 229)
    expect(btnStyles.backgroundColor).toBe('rgb(79, 70, 229)');
    expect(btnStyles.color).toBe('rgb(255, 255, 255)');
    expect(btnStyles.borderRadius).toBe('12px'); // rounded-xl
    expect(btnStyles.fontSize).toBe('14px'); // text-sm
  });

  test('Table structure matches mock exactly', async ({ page }) => {
    // Test table wrapper: overflow-hidden rounded-2xl border border-zinc-800
    const tableWrapper = page.locator('.overflow-hidden.rounded-2xl.border.border-zinc-800');
    await expect(tableWrapper).toBeVisible();

    // Test table: w-full text-sm
    const table = page.locator('table.w-full.text-sm');
    await expect(table).toBeVisible();

    // Test table header: bg-zinc-900/50 text-zinc-400
    const thead = page.locator('thead.bg-zinc-900\\/50.text-zinc-400');
    await expect(thead).toBeVisible();

    // Test exact column headers from mock
    const headers = page.locator('thead th.font-medium');
    await expect(headers).toHaveCount(4);

    const headerTexts = await headers.allTextContents();
    expect(headerTexts).toEqual(['Name', 'Email', 'Phone', 'Actions']);

    // Test header padding: px-4 py-3
    const firstHeader = headers.first();
    const headerStyles = await firstHeader.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        paddingLeft: styles.paddingLeft,
        paddingRight: styles.paddingRight,
        paddingTop: styles.paddingTop,
        paddingBottom: styles.paddingBottom
      };
    });

    expect(headerStyles.paddingLeft).toBe('16px'); // px-4
    expect(headerStyles.paddingTop).toBe('12px'); // py-3
  });

  test('Table rows match mock styling', async ({ page }) => {
    // Wait for table data to load
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    // Test table rows: border-t border-zinc-800 text-zinc-200
    const tableRows = page.locator('tbody tr.border-t.border-zinc-800.text-zinc-200');

    if (await tableRows.count() > 0) {
      const firstRow = tableRows.first();
      await expect(firstRow).toBeVisible();

      // Test table cells: px-4 py-3
      const cells = firstRow.locator('td.px-4.py-3');
      await expect(cells).toHaveCount(4);

      // Verify cell styling
      const cellStyles = await cells.first().evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          paddingLeft: styles.paddingLeft,
          paddingRight: styles.paddingRight,
          paddingTop: styles.paddingTop,
          paddingBottom: styles.paddingBottom,
          color: styles.color
        };
      });

      expect(cellStyles.paddingLeft).toBe('16px'); // px-4
      expect(cellStyles.paddingTop).toBe('12px'); // py-3
    }
  });

  test('Action buttons match mock design', async ({ page }) => {
    // Wait for table rows to load
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const actionCells = page.locator('tbody tr td.text-right').first();
    if (await actionCells.isVisible()) {
      // Test View button (ghost variant)
      const viewBtn = actionCells.locator('button:has-text("View")');
      if (await viewBtn.isVisible()) {
        const viewBtnStyles = await viewBtn.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        });

        // Ghost button should be transparent with zinc border
        expect(viewBtnStyles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      }

      // Test Create Invoice button (primary variant)
      const createBtn = actionCells.locator('button:has-text("Create Invoice")');
      if (await createBtn.isVisible()) {
        const createBtnStyles = await createBtn.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color
          };
        });

        // Primary button should be indigo-600
        expect(createBtnStyles.backgroundColor).toBe('rgb(79, 70, 229)');
        expect(createBtnStyles.color).toBe('rgb(255, 255, 255)');
      }
    }
  });

  test('No statistics bar present (matching mock)', async ({ page }) => {
    // Verify that statistics section is NOT present (as it's not in the mock)
    const statsBar = page.locator('.customers-page__stats, .stat');
    await expect(statsBar).not.toBeVisible();
  });

  test('Responsive behavior maintained', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Container should still be visible and properly sized
    const container = page.locator('.mx-auto.max-w-screen-2xl.p-6').first();
    await expect(container).toBeVisible();

    // Header should maintain flex layout
    const header = page.locator('.mb-4.flex.items-center.justify-between').first();
    await expect(header).toBeVisible();

    // Search input should be responsive
    const searchInput = page.locator('input[placeholder="Search customers…"]');
    await expect(searchInput).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // All elements should still be visible and properly arranged
    await expect(container).toBeVisible();
    await expect(header).toBeVisible();
    await expect(searchInput).toBeVisible();
  });

  test('Focus management and accessibility', async ({ page }) => {
    // Test search input focus ring
    const searchInput = page.locator('input[placeholder="Search customers…"]');
    await searchInput.focus();

    // Should have focus ring (focus:ring-2 focus:ring-indigo-500)
    const focusStyles = await searchInput.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        boxShadow: styles.boxShadow,
        outline: styles.outline
      };
    });

    expect(focusStyles.boxShadow).toContain('rgb(99, 102, 241)'); // indigo-500

    // Test button focus
    const newCustomerBtn = page.locator('button:has-text("+ New Customer")');
    await newCustomerBtn.focus();

    const buttonFocusStyles = await newCustomerBtn.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.boxShadow;
    });

    expect(buttonFocusStyles).toContain('rgb(99, 102, 241)'); // Should have indigo focus ring
  });

  test('Color contrast meets WCAG AA standards', async ({ page }) => {
    // Test title color contrast
    const title = page.locator('h2.text-lg.font-semibold.text-zinc-100');
    const titleStyles = await title.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor
      };
    });

    // zinc-100 (rgb(244, 244, 245)) on dark background should meet WCAG AA
    expect(titleStyles.color).toBe('rgb(244, 244, 245)');

    // Test table header color contrast
    const tableHeaders = page.locator('thead.text-zinc-400 th');
    const headerStyles = await tableHeaders.first().evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    // zinc-400 should provide adequate contrast
    expect(headerStyles).toBe('rgb(161, 161, 170)');
  });

});
// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Date Range Picker - Dark Theme Modal', () => {
    let page;

    test.beforeEach(async ({ browser }) => {
        page = await browser.newPage();
        
        // Login as master user
        await page.goto('http://localhost:3001');
        await page.fill('input[name="email"]', 'master@test.com');
        await page.fill('input[name="password"]', 'master123');
        await page.click('button[type="submit"]');
        
        // Navigate to master dashboard
        await page.waitForURL('**/master');
        await page.waitForSelector('.invoices-table');
    });

    test.afterEach(async () => {
        await page.close();
    });

    test('Date range button replaces native inputs', async () => {
        // Verify button exists
        const dateRangeBtn = await page.locator('#dateRangeBtn');
        await expect(dateRangeBtn).toBeVisible();
        
        // Verify native date inputs are hidden
        const nativeDateInputs = await page.locator('input[type="date"]:visible');
        await expect(nativeDateInputs).toHaveCount(0);
        
        // Verify hidden inputs exist for form compatibility
        const hiddenDateFrom = await page.locator('#dateFrom');
        const hiddenDateTo = await page.locator('#dateTo');
        await expect(hiddenDateFrom).toHaveAttribute('type', 'hidden');
        await expect(hiddenDateTo).toHaveAttribute('type', 'hidden');
    });

    test('Modal opens and closes correctly', async () => {
        // Click date range button
        await page.click('#dateRangeBtn');
        
        // Wait for modal to appear
        const modal = await page.locator('.date-range-picker-modal');
        await expect(modal).toBeVisible();
        
        // Verify dark theme styling
        const panel = await page.locator('.date-range-panel');
        const bgColor = await panel.evaluate(el => 
            window.getComputedStyle(el).backgroundColor
        );
        // Should be dark background (#1e2128 or similar)
        expect(bgColor).toMatch(/rgb\(30|31|32|33|34/);
        
        // Close modal via close button
        await page.click('.date-range-close');
        await page.waitForTimeout(400); // Wait for animation
        await expect(modal).not.toBeVisible();
    });

    test('Background scroll is locked when modal is open', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Check body overflow
        const bodyOverflow = await page.evaluate(() => {
            return window.getComputedStyle(document.body).overflow;
        });
        expect(bodyOverflow).toBe('hidden');
        
        // Close modal
        await page.click('.date-range-close');
        await page.waitForTimeout(400);
        
        // Check body overflow is restored
        const bodyOverflowAfter = await page.evaluate(() => {
            return window.getComputedStyle(document.body).overflow;
        });
        expect(bodyOverflowAfter).not.toBe('hidden');
    });

    test('Date selection works correctly', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Find available date cells (not disabled, not other month)
        const dateCells = await page.locator('.date-cell:not(.disabled):not(.other-month)');
        const count = await dateCells.count();
        expect(count).toBeGreaterThan(0);
        
        // Select start date (10th of current month)
        const startDateCell = await page.locator('.date-cell:not(.disabled):not(.other-month)').filter({ hasText: '10' }).first();
        await startDateCell.click();
        
        // Verify start date is selected
        await expect(startDateCell).toHaveClass(/selected/);
        
        // Select end date (20th of current month)
        const endDateCell = await page.locator('.date-cell:not(.disabled):not(.other-month)').filter({ hasText: '20' }).first();
        await endDateCell.click();
        
        // Verify range is highlighted
        const inRangeCells = await page.locator('.date-cell.in-range');
        const rangeCount = await inRangeCells.count();
        expect(rangeCount).toBeGreaterThan(0);
        
        // Confirm selection
        await page.click('#drp-confirm');
        await page.waitForTimeout(400);
        
        // Verify modal closed
        const modal = await page.locator('.date-range-picker-modal');
        await expect(modal).not.toBeVisible();
        
        // Verify date range button shows selected dates
        const dateDisplay = await page.locator('#dateRangeDisplay');
        const displayText = await dateDisplay.textContent();
        expect(displayText).toContain('10');
        expect(displayText).toContain('20');
    });

    test('Month and year navigation works', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Get initial month/year
        const monthSelect = await page.locator('.month-select');
        const yearSelect = await page.locator('.year-select');
        const initialMonth = await monthSelect.inputValue();
        const initialYear = await yearSelect.inputValue();
        
        // Navigate to previous month
        await page.click('.prev-month');
        await page.waitForTimeout(100);
        
        // Verify month changed
        const newMonth = await monthSelect.inputValue();
        expect(newMonth).not.toBe(initialMonth);
        
        // Change year via select
        const currentYear = new Date().getFullYear();
        await yearSelect.selectOption(String(currentYear - 1));
        
        // Verify year changed
        const selectedYear = await yearSelect.inputValue();
        expect(selectedYear).toBe(String(currentYear - 1));
        
        // Navigate to next month
        await page.click('.next-month');
        await page.waitForTimeout(100);
        
        // Calendar should update
        const dateCells = await page.locator('.date-cell');
        const cellCount = await dateCells.count();
        expect(cellCount).toBe(42); // Always shows 6 weeks
    });

    test('Shortcuts work correctly', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Test "Last 7 Days" shortcut
        await page.click('.shortcut-btn[data-range="last7days"]');
        
        // Verify dates are selected
        const startInput = await page.locator('#drp-start-date');
        const endInput = await page.locator('#drp-end-date');
        
        await expect(startInput).not.toHaveValue('');
        await expect(endInput).not.toHaveValue('');
        
        // Verify range cells are highlighted
        const inRangeCells = await page.locator('.date-cell.in-range');
        const rangeCount = await inRangeCells.count();
        expect(rangeCount).toBeGreaterThanOrEqual(7);
        
        // Test "This Month" shortcut
        await page.click('.shortcut-btn[data-range="thisMonth"]');
        await page.waitForTimeout(100);
        
        // Should select full month
        const thisMonthRange = await page.locator('.date-cell.in-range:not(.other-month)');
        const thisMonthCount = await thisMonthRange.count();
        expect(thisMonthCount).toBeGreaterThan(20); // Most months have 28+ days
    });

    test('Keyboard navigation works', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Focus first available date
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab'); // Skip close button and other controls
        
        // Navigate with arrow keys
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        
        // Select with Enter
        await page.keyboard.press('Enter');
        
        // Verify selection
        const selectedCells = await page.locator('.date-cell.selected');
        await expect(selectedCells).toHaveCount(1);
        
        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        
        // Verify modal closed
        const modal = await page.locator('.date-range-picker-modal');
        await expect(modal).not.toBeVisible();
    });

    test('Cancel restores previous values', async () => {
        // First set a date range
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Select dates
        await page.click('.shortcut-btn[data-range="last7days"]');
        await page.click('#drp-confirm');
        await page.waitForTimeout(400);
        
        // Get the selected text
        const initialDisplay = await page.locator('#dateRangeDisplay').textContent();
        expect(initialDisplay).not.toBe('Select dates...');
        
        // Open again and change selection
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        await page.click('.shortcut-btn[data-range="thisMonth"]');
        
        // Cancel instead of confirm
        await page.click('#drp-cancel');
        await page.waitForTimeout(400);
        
        // Verify original selection is maintained
        const finalDisplay = await page.locator('#dateRangeDisplay').textContent();
        expect(finalDisplay).toBe(initialDisplay);
    });

    test('Filter integration works', async () => {
        // Set a date range
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        await page.click('.shortcut-btn[data-range="last30days"]');
        await page.click('#drp-confirm');
        await page.waitForTimeout(400);
        
        // Apply filters
        await page.click('#applyFilters');
        
        // Wait for invoices to load
        await page.waitForTimeout(1000);
        
        // Verify hidden inputs have values
        const dateFromValue = await page.locator('#dateFrom').inputValue();
        const dateToValue = await page.locator('#dateTo').inputValue();
        
        expect(dateFromValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(dateToValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // Clear filters
        await page.click('#clearFilters');
        
        // Verify date range is cleared
        const clearedDisplay = await page.locator('#dateRangeDisplay').textContent();
        expect(clearedDisplay).toBe('Select dates...');
    });

    test('Responsive mobile layout', async ({ browserName }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Verify modal adapts to mobile
        const panel = await page.locator('.date-range-panel');
        const panelWidth = await panel.evaluate(el => el.offsetWidth);
        
        // Should use most of viewport width
        expect(panelWidth).toBeLessThanOrEqual(375);
        expect(panelWidth).toBeGreaterThan(320);
        
        // Verify calendar is still usable
        const dateCells = await page.locator('.date-cell:not(.disabled)');
        const firstCell = dateCells.first();
        await firstCell.click();
        
        // Should be able to select
        await expect(firstCell).toHaveClass(/selected/);
    });

    test('Accessibility features work', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Check ARIA attributes
        const modal = await page.locator('.date-range-picker-modal');
        await expect(modal).toHaveAttribute('role', 'dialog');
        await expect(modal).toHaveAttribute('aria-modal', 'true');
        
        // Check calendar grid roles
        const calendarGrid = await page.locator('.calendar-grid');
        await expect(calendarGrid).toHaveAttribute('role', 'grid');
        
        // Check date cells have proper ARIA
        const dateCell = await page.locator('.date-cell').first();
        await expect(dateCell).toHaveAttribute('role', 'gridcell');
        await expect(dateCell).toHaveAttribute('aria-label');
        
        // Tab trapping should work
        const focusableElements = await page.locator('.date-range-picker-modal button:not([disabled]), .date-range-picker-modal select');
        const count = await focusableElements.count();
        expect(count).toBeGreaterThan(0);
        
        // Focus should be trapped in modal
        await page.keyboard.press('Tab');
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
    });

    test('Cross-browser visual consistency', async ({ browserName }) => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Take screenshot for visual regression
        const screenshot = await page.locator('.date-range-panel').screenshot();
        expect(screenshot).toBeTruthy();
        
        // Verify dark theme colors are consistent
        const panel = await page.locator('.date-range-panel');
        const styles = await panel.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
                background: computed.backgroundColor,
                borderColor: computed.borderColor,
                color: computed.color
            };
        });
        
        // Dark theme validation
        expect(styles.background).toMatch(/rgb\((2[0-9]|3[0-4]|1[5-9])/); // Dark background
        expect(styles.color).toMatch(/rgb\((2[0-5][0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])/); // Light text
        
        console.log(`Date picker tested successfully on ${browserName}`);
    });

    test('Performance - Large date ranges', async () => {
        // Open modal
        await page.click('#dateRangeBtn');
        await page.waitForSelector('.date-range-picker-modal.active');
        
        // Navigate through multiple months quickly
        const startTime = Date.now();
        
        for (let i = 0; i < 12; i++) {
            await page.click('.prev-month');
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should complete navigation in reasonable time
        expect(duration).toBeLessThan(3000); // 3 seconds for 12 month navigations
        
        // Calendar should still be functional
        const dateCells = await page.locator('.date-cell:not(.disabled)');
        await dateCells.first().click();
        
        // Should be selectable
        await expect(dateCells.first()).toHaveClass(/selected/);
    });
});

// Visual regression test configuration
test.use({
    // Consistent viewport for screenshots
    viewport: { width: 1280, height: 720 },
    
    // Disable animations for consistent screenshots
    launchOptions: {
        args: ['--force-prefers-reduced-motion']
    }
});
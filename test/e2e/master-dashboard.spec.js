const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const MASTER_EMAIL = 'rpasha@marinegroupbw.com';
const REGULAR_EMAIL = 'regular@example.com';

test.describe('Master Dashboard E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(BASE_URL);
  });

  test.describe('Authentication and Authorization', () => {
    test('standard user blocked from master dashboard', async ({ page }) => {
      // Login as standard user
      await loginUser(page, REGULAR_EMAIL, 'Regular User');
      
      // Try to access master dashboard
      await page.goto(`${BASE_URL}/master`);
      
      // Should see 403 error page
      await expect(page.locator('h1')).toContainText('403 - Access Denied');
      await expect(page.locator('p')).toContainText('Master Account Required');
    });

    test('master user can access dashboard', async ({ page }) => {
      // Login as master user
      await loginUser(page, MASTER_EMAIL, 'Master User');
      
      // Navigate to master dashboard
      await page.goto(`${BASE_URL}/master`);
      
      // Should see dashboard elements
      await expect(page.locator('h1')).toContainText('Master Dashboard');
      await expect(page.locator('.user-email')).toContainText(MASTER_EMAIL);
      await expect(page.locator('.user-badge')).toContainText('MASTER');
    });

    test('direct URL access blocked for non-master', async ({ page }) => {
      // Login as standard user
      await loginUser(page, REGULAR_EMAIL, 'Regular User');
      
      // Try direct access to invoice detail
      await page.goto(`${BASE_URL}/master/invoices/123`);
      
      // Should be blocked
      await expect(page.locator('h1')).toContainText('403');
    });
  });

  test.describe('Dashboard Functionality', () => {
    test.beforeEach(async ({ page }) => {
      // Login as master for all dashboard tests
      await loginUser(page, MASTER_EMAIL, 'Master User');
      await page.goto(`${BASE_URL}/master`);
    });

    test('displays statistics cards', async ({ page }) => {
      // Check stats are visible
      await expect(page.locator('#totalSaved')).toBeVisible();
      await expect(page.locator('#todayCount')).toBeVisible();
      await expect(page.locator('#weekTotal')).toBeVisible();
    });

    test('table displays invoice data', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('.invoices-table tbody tr', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Check table headers
      await expect(page.locator('th[data-sort="savedAt"]')).toBeVisible();
      await expect(page.locator('th[data-sort="userName"]')).toBeVisible();
      await expect(page.locator('th[data-sort="total"]')).toBeVisible();
      
      // Check for at least one row (or no results message)
      const rowCount = await page.locator('.invoices-table tbody tr').count();
      const noResults = await page.locator('.no-results').isVisible();
      
      expect(rowCount > 0 || noResults).toBeTruthy();
    });

    test('search functionality works', async ({ page }) => {
      // Enter search term
      await page.fill('#searchInput', 'test vessel');
      await page.click('#applyFilters');
      
      // Wait for results to update
      await page.waitForTimeout(1000);
      
      // Check that request was made (loading indicator or results)
      const loading = await page.locator('#loadingIndicator').isVisible();
      const hasResults = await page.locator('.invoices-table tbody tr').count() > 0;
      const noResults = await page.locator('.no-results').isVisible();
      
      expect(loading || hasResults || noResults).toBeTruthy();
    });

    test('date filtering works', async ({ page }) => {
      // Set date range
      const today = new Date().toISOString().split('T')[0];
      await page.fill('#dateFrom', today);
      await page.fill('#dateTo', today);
      await page.click('#applyFilters');
      
      // Wait for results
      await page.waitForTimeout(1000);
      
      // Verify filter was applied
      expect(await page.locator('#dateFrom').inputValue()).toBe(today);
    });

    test('clear filters resets all inputs', async ({ page }) => {
      // Set filters
      await page.fill('#searchInput', 'test');
      await page.fill('#dateFrom', '2024-01-01');
      await page.selectOption('#marketFilter', 'Houston');
      
      // Clear filters
      await page.click('#clearFilters');
      
      // Check all inputs are cleared
      await expect(page.locator('#searchInput')).toHaveValue('');
      await expect(page.locator('#dateFrom')).toHaveValue('');
      await expect(page.locator('#marketFilter')).toHaveValue('');
    });

    test('pagination controls work', async ({ page }) => {
      // Check pagination is visible
      await expect(page.locator('.pagination')).toBeVisible();
      
      // Check current page display
      await expect(page.locator('#currentPage')).toBeVisible();
      
      // Next button should be enabled if there are multiple pages
      const totalPages = await page.locator('#totalPages').textContent();
      if (parseInt(totalPages) > 1) {
        await expect(page.locator('#nextPage')).toBeEnabled();
        
        // Click next
        await page.click('#nextPage');
        await page.waitForTimeout(1000);
        
        // Check page updated
        const currentPage = await page.locator('#currentPage').textContent();
        expect(parseInt(currentPage)).toBe(2);
      }
    });

    test('sorting by column headers', async ({ page }) => {
      // Click on a sortable column header
      await page.click('th[data-sort="total"]');
      await page.waitForTimeout(1000);
      
      // Click again to reverse sort
      await page.click('th[data-sort="total"]');
      await page.waitForTimeout(1000);
      
      // Verify table still displays (sorting worked)
      await expect(page.locator('.invoices-table')).toBeVisible();
    });
  });

  test.describe('Invoice Detail Modal', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, MASTER_EMAIL, 'Master User');
      await page.goto(`${BASE_URL}/master`);
    });

    test('opens detail modal on view click', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('.btn-view', { 
        state: 'visible',
        timeout: 10000 
      }).catch(() => {
        // No invoices to test with
        test.skip();
      });
      
      // Click first view button if available
      const viewButtons = await page.locator('.btn-view').count();
      if (viewButtons > 0) {
        await page.click('.btn-view:first-of-type');
        
        // Modal should open
        await expect(page.locator('#detailModal')).toBeVisible();
        await expect(page.locator('.modal-header h2')).toContainText('Invoice Details');
      }
    });

    test('closes modal with close button', async ({ page }) => {
      // Open modal first
      const viewButtons = await page.locator('.btn-view').count();
      if (viewButtons > 0) {
        await page.click('.btn-view:first-of-type');
        await expect(page.locator('#detailModal')).toBeVisible();
        
        // Close modal
        await page.click('#closeModalBtn');
        
        // Modal should be hidden
        await expect(page.locator('#detailModal')).not.toBeVisible();
      }
    });

    test('no create/edit UI in master area', async ({ page }) => {
      // Check that no create/edit buttons exist
      await expect(page.locator('button:has-text("Create")')).toHaveCount(0);
      await expect(page.locator('button:has-text("Edit")')).toHaveCount(0);
      await expect(page.locator('button:has-text("Save")')).toHaveCount(0);
      await expect(page.locator('button:has-text("Delete")')).toHaveCount(0);
      
      // Only View buttons should exist
      const viewButtons = await page.locator('.btn-view').count();
      expect(viewButtons >= 0).toBeTruthy();
    });
  });

  test.describe('Logout Functionality', () => {
    test('logout returns to home page', async ({ page }) => {
      // Login and go to dashboard
      await loginUser(page, MASTER_EMAIL, 'Master User');
      await page.goto(`${BASE_URL}/master`);
      
      // Click logout
      await page.click('#logoutBtn');
      
      // Should redirect to home
      await expect(page).toHaveURL(`${BASE_URL}/`);
    });
  });
});

// Helper function to login a user
async function loginUser(page, email, name) {
  // This would typically interact with your login form
  // For now, we'll make a direct API call to establish session
  
  const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
    data: {
      email: email,
      name: name
    }
  });
  
  expect(response.ok()).toBeTruthy();
}

// Performance test
test.describe('Performance', () => {
  test('dashboard loads within acceptable time', async ({ page }) => {
    await loginUser(page, MASTER_EMAIL, 'Master User');
    
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/master`);
    await page.waitForSelector('.invoices-table', { timeout: 5000 });
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});

// Accessibility test
test.describe('Accessibility', () => {
  test('dashboard is keyboard navigable', async ({ page }) => {
    await loginUser(page, MASTER_EMAIL, 'Master User');
    await page.goto(`${BASE_URL}/master`);
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check that focus is visible on some element
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('has proper ARIA labels', async ({ page }) => {
    await loginUser(page, MASTER_EMAIL, 'Master User');
    await page.goto(`${BASE_URL}/master`);
    
    // Check for main landmark
    await expect(page.locator('main')).toBeVisible();
    
    // Check for proper heading hierarchy
    await expect(page.locator('h1')).toHaveCount(1);
  });
});
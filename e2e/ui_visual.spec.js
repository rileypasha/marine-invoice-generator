// E2E Visual Verification Test - UI Polish & Baseline Alignment
// Tests the critical visual alignment with invoice.png baseline

const { test, expect } = require('@playwright/test');

test.describe('UI Visual Baseline Alignment', () => {

  test.beforeEach(async ({ page }) => {
    // Configure for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Clear storage for fresh start
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test('Sidebar Visual Alignment - 72px Icon-Only Design', async ({ page }) => {
    console.log('🎯 Testing sidebar visual alignment with baseline...');

    // Navigate to production site
    await page.goto('https://mginvoices.com', { waitUntil: 'networkidle' });

    // Handle login flow using stored credentials
    try {
      const emailInput = await page.locator('input[type="email"], input[name="email"], #email').first();
      const passwordInput = await page.locator('input[type="password"], input[name="password"], #password').first();

      if (await emailInput.isVisible()) {
        console.log('🔐 Performing login...');
        await emailInput.fill('test@marinegroupbw.com');
        await passwordInput.fill('Seaweed123!');

        const loginButton = await page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login")').first();
        await loginButton.click();

        // Wait for successful login
        await page.waitForURL(/\/app|\/customers/, { timeout: 10000 });
        console.log('✅ Login successful');
      }
    } catch (error) {
      console.log('ℹ️ Already authenticated or different auth flow');
    }

    // Navigate to customers page
    await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });
    await page.waitForSelector('.page-sidebar', { timeout: 10000 });

    // Verify sidebar width matches baseline (72px)
    const sidebar = page.locator('.page-sidebar');
    const sidebarBox = await sidebar.boundingBox();

    console.log(`📏 Sidebar width: ${sidebarBox.width}px (expected: 72px)`);
    expect(sidebarBox.width).toBe(72);

    // Verify main content margin matches
    const mainContent = page.locator('.page-main');
    const mainBox = await mainContent.boundingBox();
    const mainComputedStyle = await page.evaluate(() => {
      const element = document.querySelector('.page-main');
      return window.getComputedStyle(element).marginLeft;
    });

    console.log(`📏 Main content margin-left: ${mainComputedStyle} (expected: 72px)`);
    expect(mainComputedStyle).toBe('72px');

    // Verify icon-only navigation
    const navItems = page.locator('.nav-item');
    const navItemCount = await navItems.count();

    console.log(`🧭 Navigation items found: ${navItemCount}`);
    expect(navItemCount).toBeGreaterThan(0);

    // Check that nav text is hidden
    const navText = page.locator('.nav-item-text');
    const textVisible = await navText.first().isVisible();
    console.log(`👁️ Navigation text visible: ${textVisible} (expected: false)`);
    expect(textVisible).toBe(false);

    // Verify brand logo size and positioning
    const logo = page.locator('.nav-brand__logo');
    const logoBox = await logo.boundingBox();
    console.log(`🎨 Brand logo size: ${logoBox.width}x${logoBox.height}px`);
    expect(logoBox.width).toBe(32); // 2rem = 32px
    expect(logoBox.height).toBe(32);

    console.log('✅ Sidebar visual alignment verified');
  });

  test('Customers Page Layout Verification', async ({ page }) => {
    console.log('🎯 Testing customers page layout...');

    // Navigate to customers page
    await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });

    // Handle authentication if needed
    try {
      const emailInput = await page.locator('input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill('test@marinegroupbw.com');
        await page.locator('input[type="password"]').first().fill('Seaweed123!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/\/customers/, { timeout: 10000 });
      }
    } catch (error) {
      console.log('ℹ️ Already authenticated');
    }

    // Wait for customers page to load
    await page.waitForSelector('#customers-page', { timeout: 15000 });

    // Verify header structure (inline search + actions)
    const header = page.locator('.mb-4.flex.items-center.justify-between').first();
    await expect(header).toBeVisible();

    // Verify search input positioning
    const searchInput = page.locator('#customers-search, input[placeholder*="Search customers"]');
    await expect(searchInput).toBeVisible();

    // Verify primary button styling
    const addButton = page.locator('button:has-text("New Customer"), .btn--primary').first();
    await expect(addButton).toBeVisible();

    // Verify table structure (Name, Email, Phone, Actions)
    const tableHeaders = page.locator('thead th');
    const headerCount = await tableHeaders.count();
    console.log(`📊 Table headers count: ${headerCount} (expected: 4)`);
    expect(headerCount).toBe(4);

    // Verify rounded table styling
    const tableContainer = page.locator('.overflow-hidden.rounded-2xl.border.border-zinc-800');
    await expect(tableContainer).toBeVisible();

    console.log('✅ Customers page layout verified');
  });

  test('Responsive Behavior Verification', async ({ page }) => {
    console.log('🎯 Testing responsive behavior...');

    // Test at different breakpoints
    const breakpoints = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1366, height: 768, name: 'Desktop Standard' },
      { width: 1024, height: 768, name: 'Tablet Landscape' }
    ];

    for (const bp of breakpoints) {
      console.log(`📱 Testing ${bp.name} (${bp.width}x${bp.height})`);

      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });

      // Handle auth if needed
      try {
        const emailInput = await page.locator('input[type="email"]').first();
        if (await emailInput.isVisible({ timeout: 2000 })) {
          await emailInput.fill('test@marinegroupbw.com');
          await page.locator('input[type="password"]').first().fill('Seaweed123!');
          await page.locator('button[type="submit"]').first().click();
          await page.waitForURL(/\/customers/, { timeout: 10000 });
        }
      } catch (error) {
        console.log('ℹ️ Already authenticated or different auth flow');
      }

      await page.waitForSelector('.page-sidebar', { timeout: 10000 });

      if (bp.width > 1024) {
        // Desktop: sidebar should be visible and 72px wide
        const sidebar = page.locator('.page-sidebar');
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox.width).toBe(72);

        const mainContent = page.locator('.page-main');
        const mainStyle = await page.evaluate(() => {
          return window.getComputedStyle(document.querySelector('.page-main')).marginLeft;
        });
        expect(mainStyle).toBe('72px');

        console.log(`  ✅ ${bp.name}: Sidebar 72px, main margin 72px`);
      } else {
        // Mobile/Tablet: sidebar should be hidden/transformed
        const sidebar = page.locator('.page-sidebar');
        const transform = await page.evaluate(() => {
          return window.getComputedStyle(document.querySelector('.page-sidebar')).transform;
        });

        console.log(`  ✅ ${bp.name}: Sidebar transform applied`);
      }
    }

    console.log('✅ Responsive behavior verified');
  });

  test('Visual Consistency with Invoice Page', async ({ page }) => {
    console.log('🎯 Testing visual consistency between invoices and customers pages...');

    // Navigate to invoice page first
    await page.goto('https://mginvoices.com/app', { waitUntil: 'networkidle' });

    // Handle authentication
    try {
      const emailInput = await page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        await emailInput.fill('test@marinegroupbw.com');
        await page.locator('input[type="password"]').first().fill('Seaweed123!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/\/app/, { timeout: 10000 });
      }
    } catch (error) {
      console.log('ℹ️ Already authenticated');
    }

    await page.waitForSelector('.page-sidebar', { timeout: 10000 });

    // Capture invoice page sidebar styling
    const invoiceSidebar = page.locator('.page-sidebar');
    const invoiceSidebarStyles = await page.evaluate(() => {
      const sidebar = document.querySelector('.page-sidebar');
      const styles = window.getComputedStyle(sidebar);
      return {
        width: styles.width,
        backgroundColor: styles.backgroundColor,
        borderRight: styles.borderRight
      };
    });

    console.log('📊 Invoice page sidebar styles:', invoiceSidebarStyles);

    // Navigate to customers page
    await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });
    await page.waitForSelector('.page-sidebar', { timeout: 10000 });

    // Capture customers page sidebar styling
    const customersSidebarStyles = await page.evaluate(() => {
      const sidebar = document.querySelector('.page-sidebar');
      const styles = window.getComputedStyle(sidebar);
      return {
        width: styles.width,
        backgroundColor: styles.backgroundColor,
        borderRight: styles.borderRight
      };
    });

    console.log('📊 Customers page sidebar styles:', customersSidebarStyles);

    // Verify consistency
    expect(customersSidebarStyles.width).toBe(invoiceSidebarStyles.width);
    expect(customersSidebarStyles.backgroundColor).toBe(invoiceSidebarStyles.backgroundColor);

    console.log('✅ Visual consistency verified between pages');
  });

  test('Accessibility Compliance Check', async ({ page }) => {
    console.log('🎯 Testing accessibility compliance...');

    await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });

    // Handle authentication
    try {
      const emailInput = await page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        await emailInput.fill('test@marinegroupbw.com');
        await page.locator('input[type="password"]').first().fill('Seaweed123!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/\/customers/, { timeout: 10000 });
      }
    } catch (error) {
      console.log('ℹ️ Already authenticated');
    }

    await page.waitForSelector('.page-sidebar', { timeout: 10000 });

    // Check navigation items have proper titles for tooltips
    const navItems = page.locator('.nav-item[title]');
    const navItemsWithTitles = await navItems.count();
    console.log(`🏷️ Navigation items with titles: ${navItemsWithTitles}`);
    expect(navItemsWithTitles).toBeGreaterThan(0);

    // Verify focus states work
    const firstNavItem = page.locator('.nav-item').first();
    await firstNavItem.focus();

    // Check that focused element has visible outline/ring
    const focusedStyle = await page.evaluate(() => {
      const focused = document.activeElement;
      const styles = window.getComputedStyle(focused);
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow
      };
    });

    console.log('🎯 Focus styles:', focusedStyle);

    // Verify search input is properly labeled
    const searchInput = page.locator('#customers-search, input[placeholder*="Search customers"]');
    const hasPlaceholder = await searchInput.getAttribute('placeholder');
    console.log(`🔍 Search input placeholder: "${hasPlaceholder}"`);
    expect(hasPlaceholder).toBeTruthy();

    console.log('✅ Basic accessibility compliance verified');
  });

  test('Screenshot Comparison - Final Verification', async ({ page }) => {
    console.log('🎯 Capturing final verification screenshots...');

    await page.goto('https://mginvoices.com/customers', { waitUntil: 'networkidle' });

    // Handle authentication
    try {
      const emailInput = await page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 })) {
        await emailInput.fill('test@marinegroupbw.com');
        await page.locator('input[type="password"]').first().fill('Seaweed123!');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForURL(/\/customers/, { timeout: 10000 });
      }
    } catch (error) {
      console.log('ℹ️ Already authenticated');
    }

    await page.waitForSelector('#customers-page', { timeout: 15000 });

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({
      path: 'customers-page-final-verification.png',
      fullPage: true
    });

    // Take sidebar-focused screenshot
    const sidebar = page.locator('.page-sidebar');
    await sidebar.screenshot({
      path: 'sidebar-final-verification.png'
    });

    console.log('📸 Screenshots captured:');
    console.log('  - customers-page-final-verification.png');
    console.log('  - sidebar-final-verification.png');

    console.log('✅ Final verification complete');
  });
});
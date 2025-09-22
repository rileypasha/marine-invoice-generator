import { test, expect } from '@playwright/test';

test.describe('Sidebar Navigation Issues', () => {
  test('reproduce sidebar hover and click issues', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: 'sidebar-initial.png', fullPage: true });

    // Try to hover on sidebar icons to see tooltips
    const sidebarIcons = await page.locator('[data-testid*="sidebar-icon"], .sidebar-icon, nav a, aside a').all();

    console.log(`Found ${sidebarIcons.length} sidebar elements`);

    // Try hovering on each icon
    for (let i = 0; i < sidebarIcons.length; i++) {
      const icon = sidebarIcons[i];

      try {
        // Check if element is visible
        const isVisible = await icon.isVisible();
        if (!isVisible) continue;

        console.log(`Testing sidebar element ${i + 1}`);

        // Hover to see tooltip
        await icon.hover();
        await page.waitForTimeout(500); // Wait for tooltip to appear

        // Take screenshot during hover
        await page.screenshot({ path: `sidebar-hover-${i}.png` });

        // Try to click
        await icon.click();
        await page.waitForTimeout(1000); // Wait to see if page loads

        // Check if navigation occurred
        const currentUrl = page.url();
        console.log(`After click ${i + 1}: URL is ${currentUrl}`);

        // Take screenshot after click
        await page.screenshot({ path: `sidebar-after-click-${i}.png` });

      } catch (error) {
        console.log(`Error with sidebar element ${i + 1}:`, error.message);
      }
    }

    // Also try to find sidebar by common selectors
    const commonSelectors = [
      '.sidebar',
      '#sidebar',
      '[role="navigation"]',
      'nav',
      'aside',
      '.nav-sidebar',
      '.side-menu'
    ];

    for (const selector of commonSelectors) {
      const element = page.locator(selector).first();
      const exists = await element.count() > 0;
      if (exists) {
        console.log(`Found sidebar with selector: ${selector}`);
        const boundingBox = await element.boundingBox();
        console.log(`Sidebar dimensions:`, boundingBox);
      }
    }
  });

  test('inspect sidebar structure and behavior', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Get all sidebar-related elements and their properties
    const sidebarInfo = await page.evaluate(() => {
      const elements = [];

      // Find all potential sidebar elements
      const selectors = [
        '.sidebar',
        '#sidebar',
        '[role="navigation"]',
        'nav',
        'aside',
        '.nav-sidebar',
        '.side-menu',
        '[class*="sidebar"]',
        '[id*="sidebar"]'
      ];

      selectors.forEach(selector => {
        const els = document.querySelectorAll(selector);
        els.forEach((el: HTMLElement) => {
          const styles = window.getComputedStyle(el);
          elements.push({
            selector,
            tagName: el.tagName,
            classList: Array.from(el.classList),
            id: el.id,
            position: styles.position,
            display: styles.display,
            visibility: styles.visibility,
            zIndex: styles.zIndex,
            width: styles.width,
            height: styles.height,
            overflow: styles.overflow,
            transition: styles.transition,
            hasHoverListener: el.onmouseover !== null || el.onmouseenter !== null,
            hasClickListener: el.onclick !== null,
            childrenCount: el.children.length,
            innerText: el.innerText?.substring(0, 50)
          });
        });
      });

      return elements;
    });

    console.log('Sidebar elements found:', JSON.stringify(sidebarInfo, null, 2));
  });
});
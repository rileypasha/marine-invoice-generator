import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4177';

test.describe('Accessibility - White-on-White Font Color Fixes', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    if (!page.url().includes('/requests')) {
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/requests');
    }
  });

  test('Month tabs have text-gray-700 class', async ({ page }) => {
    await page.goto(`${BASE_URL}/requests`);
    const tabs = page.locator('[role="tablist"] button');
    await expect(tabs.first()).toBeVisible();
    
    const inactiveTab = tabs.nth(1);
    const classes = await inactiveTab.getAttribute('class');
    expect(classes).toContain('text-gray-700');
  });

  test('Overflow menu buttons have proper text color', async ({ page }) => {
    await page.goto(`${BASE_URL}/requests`);
    const overflowButton = page.locator('button[variant="outline"]').first();
    
    if (await overflowButton.count() > 0) {
      const classes = await overflowButton.getAttribute('class');
      const hasColor = classes?.includes('text-gray-900') || classes?.includes('text-foreground');
      expect(hasColor).toBeTruthy();
    }
  });

  test('Contacts page header has text-gray-900', async ({ page }) => {
    await page.goto(`${BASE_URL}/customers`);
    const header = page.locator('h2:has-text("Contacts")');
    await expect(header).toBeVisible();
    
    const classes = await header.getAttribute('class');
    expect(classes).toContain('text-gray-900');
  });

  test('Vessels page header has text-gray-900', async ({ page }) => {
    await page.goto(`${BASE_URL}/vessels`);
    const header = page.locator('h2:has-text("Vessels")');
    await expect(header).toBeVisible();
    
    const classes = await header.getAttribute('class');
    expect(classes).toContain('text-gray-900');
  });

  test('No white text on white backgrounds', async ({ page }) => {
    const pages = [`${BASE_URL}/requests`, `${BASE_URL}/customers`, `${BASE_URL}/vessels`];
    
    for (const url of pages) {
      await page.goto(url);
      
      const whiteTextElements = await page.locator('*').evaluateAll((elements) => {
        return elements.filter((el) => {
          const style = window.getComputedStyle(el);
          const color = style.color;
          const bgColor = style.backgroundColor;
          const isWhiteText = color === 'rgb(255, 255, 255)' || color === 'rgba(255, 255, 255, 1)';
          const isWhiteBg = bgColor === 'rgb(255, 255, 255)' || bgColor === 'rgba(255, 255, 255, 1)';
          return isWhiteText && isWhiteBg && el.textContent?.trim();
        }).length;
      });
      
      expect(whiteTextElements).toBe(0);
    }
  });
});

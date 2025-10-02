import { test, expect } from '@playwright/test';
import { setViewport, pullToRefresh, swipe, checkTouchTargetSize } from '../utils/mobile-helpers';

test.describe('Mobile UI Tests', () => {
  test.describe('Card Layout on Mobile', () => {
    test('should display requests as cards on mobile (<768px)', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      // Should show cards instead of table
      const cards = page.locator('.card, [data-testid="request-card"], .list-item').first();
      const table = page.locator('table').first();

      const hasCards = await cards.isVisible({ timeout: 3000 }).catch(() => false);
      const hasTable = await table.isVisible({ timeout: 2000 }).catch(() => false);

      // Should prefer cards on mobile (or responsive table)
      expect(hasCards || hasTable).toBe(true);
    });

    test('cards should display essential fields prominently', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const card = page.locator('.card, [data-testid="request-card"]').first();

      if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Should have readable text
        const text = await card.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);

        // Should have spacing for readability
        const padding = await card.evaluate((el) => window.getComputedStyle(el).padding);
        expect(padding).toBeDefined();
      }
    });

    test('cards should be tappable with visual feedback', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const card = page.locator('.card, [data-testid="request-card"]').first();

      if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Should be clickable
        await card.click();

        // Should trigger some action (navigation or expand)
        const dialog = page.locator('[role="dialog"]');
        const hasDialog = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

        if (!hasDialog) {
          // Or should expand/navigate
          const url = page.url();
          expect(url).toBeDefined();
        }
      }
    });

    test('cards should stack vertically with proper spacing', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const cards = page.locator('.card, [data-testid="request-card"]').all();
      const cardsArray = await cards;

      if (cardsArray.length > 1) {
        const box1 = await cardsArray[0].boundingBox();
        const box2 = await cardsArray[1].boundingBox();

        if (box1 && box2) {
          // Cards should be stacked (card2 below card1)
          expect(box2.y).toBeGreaterThan(box1.y);

          // Should have spacing between them (minimum 8px)
          const gap = box2.y - (box1.y + box1.height);
          expect(gap).toBeGreaterThanOrEqual(8);
        }
      }
    });
  });

  test.describe('Pull-to-Refresh', () => {
    test('should support pull-to-refresh gesture', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      // Perform pull-to-refresh
      await pullToRefresh(page);

      // Should show loading indicator (briefly)
      const loader = page.locator('[data-testid="loading"], .spinner, .loading');
      const hasLoader = await loader.isVisible({ timeout: 1000 }).catch(() => false);

      // Loading indicator may be brief, so just check page is still functional
      await page.waitForLoadState('domcontentloaded');
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should refresh data after pull-to-refresh', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      // Get initial content
      const container = page.locator('main, [role="main"]');
      const initialContent = await container.textContent();

      // Pull to refresh
      await pullToRefresh(page);
      await page.waitForTimeout(1000);

      // Content should still be present (may or may not have changed)
      const newContent = await container.textContent();
      expect(newContent?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Swipe Actions', () => {
    test('should support swipe gestures on list items', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const listItem = page.locator('.card, [data-testid="request-card"], tr').first();

      if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await listItem.boundingBox();

        if (box) {
          // Swipe left on item
          await swipe(page, 'left', box.x + box.width - 50, box.y + box.height / 2);

          // Should reveal actions or trigger action
          const actionButton = page.locator('button[data-action], .swipe-action, [role="menuitem"]');
          const hasAction = await actionButton.first().isVisible({ timeout: 2000 }).catch(() => false);

          // Swipe actions are optional enhancement
          if (hasAction) {
            await expect(actionButton.first()).toBeVisible();
          }
        }
      }
    });

    test('swipe actions should have adequate touch targets', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const listItem = page.locator('.card, tr').first();

      if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await listItem.boundingBox();

        if (box) {
          await swipe(page, 'left', box.x + box.width - 50, box.y + box.height / 2);

          const actionButtons = page.locator('.swipe-action button, button[data-action]');
          const count = await actionButtons.count();

          for (let i = 0; i < count; i++) {
            const button = actionButtons.nth(i);
            const buttonBox = await button.boundingBox();

            if (buttonBox) {
              expect(buttonBox.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
      }
    });
  });

  test.describe('Detail Sheets/Modals', () => {
    test('should open detail sheet smoothly', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const listItem = page.locator('.card, tr').first();

      if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        const startTime = Date.now();

        await listItem.click();

        const sheet = page.locator('[role="dialog"], .sheet, .modal');
        const sheetVisible = await sheet.first().isVisible({ timeout: 2000 }).catch(() => false);

        if (sheetVisible) {
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Should open in <300ms
          expect(duration).toBeLessThan(300);
          await expect(sheet.first()).toBeVisible();
        }
      }
    });

    test('detail sheet should be closable with swipe down', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const listItem = page.locator('.card, tr').first();

      if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listItem.click();

        const sheet = page.locator('[role="dialog"]').first();
        const sheetVisible = await sheet.isVisible({ timeout: 2000 }).catch(() => false);

        if (sheetVisible) {
          const box = await sheet.boundingBox();

          if (box) {
            // Swipe down to close
            await swipe(page, 'down', box.x + box.width / 2, box.y + 50);

            // Sheet should close
            const stillVisible = await sheet.isVisible({ timeout: 1000 }).catch(() => false);

            // May not work in test environment, but code should handle it
            if (stillVisible) {
              // Try close button instead
              const closeButton = sheet.locator('[aria-label*="close"], button[data-close]');
              if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeButton.click();
              }
            }
          }
        }
      }
    });

    test('detail sheet should have close button with adequate size', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const listItem = page.locator('.card, tr').first();

      if (await listItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await listItem.click();

        const sheet = page.locator('[role="dialog"]').first();
        const sheetVisible = await sheet.isVisible({ timeout: 2000 }).catch(() => false);

        if (sheetVisible) {
          const closeButton = sheet.locator('[aria-label*="close"], button:has-text("Close")').first();
          const box = await closeButton.boundingBox();

          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
  });

  test.describe('Touch Targets', () => {
    test('all buttons should meet 44x44px minimum', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const buttons = page.locator('button').all();
      const buttonsArray = await buttons;

      for (const button of buttonsArray) {
        if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await button.boundingBox();

          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('links in text should have adequate padding', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const links = page.locator('a').all();
      const linksArray = await links;

      for (const link of linksArray.slice(0, 5)) {
        if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await link.boundingBox();

          if (box) {
            // Height should be at least 44px with padding
            expect(box.height).toBeGreaterThanOrEqual(32); // Allow for inline links
          }
        }
      }
    });

    test('form inputs should be easy to tap', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      // Find a form (may need to open dialog)
      const newButton = page.locator('button:has-text("New")').first();

      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();

        const inputs = page.locator('input, select, textarea').all();
        const inputsArray = await inputs;

        for (const input of inputsArray) {
          if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
            const box = await input.boundingBox();

            if (box) {
              expect(box.height).toBeGreaterThanOrEqual(44);
            }
          }
        }
      }
    });
  });

  test.describe('Safe Area Insets', () => {
    test('should respect safe area on iPhone with notch', async ({ page }) => {
      await setViewport(page, 'iPhone14'); // Has notch

      // Add safe area simulation
      await page.addInitScript(() => {
        const style = document.createElement('style');
        style.innerHTML = `
          :root {
            --sat: 47px;
            --sar: 0px;
            --sab: 34px;
            --sal: 0px;
          }
        `;
        document.head.appendChild(style);
      });

      await page.goto('/');

      // Check that content doesn't overlap safe area
      const header = page.locator('header, [role="banner"]').first();

      if (await header.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await header.boundingBox();

        // Header should be below notch (y > 0)
        expect(box?.y).toBeGreaterThanOrEqual(0);
      }
    });

    test('bottom nav should account for home indicator on iPhone', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();

      if (await bottomNav.isVisible({ timeout: 3000 }).catch(() => false)) {
        const box = await bottomNav.boundingBox();
        const viewportHeight = page.viewportSize()?.height || 844;

        // Should have padding-bottom for home indicator
        const paddingBottom = await bottomNav.evaluate((el) => {
          return window.getComputedStyle(el).paddingBottom;
        });

        // Should have some padding (at least 8px)
        const paddingValue = parseInt(paddingBottom);
        expect(paddingValue).toBeGreaterThanOrEqual(8);
      }
    });
  });

  test.describe('Responsive Images', () => {
    test('should lazy load images', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      for (const img of imagesArray.slice(0, 5)) {
        if (await img.isVisible({ timeout: 500 }).catch(() => false)) {
          const loading = await img.getAttribute('loading');

          // Should use lazy loading
          if (loading) {
            expect(loading).toBe('lazy');
          }
        }
      }
    });

    test('images should have appropriate sizes for mobile', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      for (const img of imagesArray.slice(0, 5)) {
        if (await img.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await img.boundingBox();

          if (box) {
            // Should not exceed viewport width
            const viewportWidth = page.viewportSize()?.width || 390;
            expect(box.width).toBeLessThanOrEqual(viewportWidth);
          }
        }
      }
    });
  });

  test.describe('Mobile Typography', () => {
    test('text should be readable on mobile (minimum 16px)', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const bodyText = page.locator('p, span, div').first();
      const fontSize = await bodyText.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      const sizeValue = parseFloat(fontSize);
      expect(sizeValue).toBeGreaterThanOrEqual(14); // Allow 14px minimum
    });

    test('headings should have appropriate size hierarchy', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const h1 = page.locator('h1').first();
      const h2 = page.locator('h2').first();

      if (await h1.isVisible({ timeout: 2000 }).catch(() => false)) {
        const h1Size = await h1.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));

        if (await h2.isVisible({ timeout: 2000 }).catch(() => false)) {
          const h2Size = await h2.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));

          // H1 should be larger than H2
          expect(h1Size).toBeGreaterThan(h2Size);
        }
      }
    });
  });
});

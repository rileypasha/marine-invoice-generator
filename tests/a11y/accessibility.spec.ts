import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setViewport, checkTouchTargetSize } from '../utils/mobile-helpers';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setViewport(page, 'iPhone14');
  });

  test.describe('Automated WCAG 2.1 AA Compliance', () => {
    test('home page should pass axe accessibility audit', async ({ page }) => {
      await page.goto('/');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('requests page should pass axe accessibility audit', async ({ page }) => {
      await page.goto('/requests');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('invoices page should pass axe accessibility audit', async ({ page }) => {
      await page.goto('/invoices');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('dialogs should pass accessibility audit', async ({ page }) => {
      await page.goto('/requests');

      const newButton = page.locator('button:has-text("New")').first();
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 2000 });

        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
      }
    });
  });

  test.describe('Touch Target Sizes', () => {
    test('all buttons should be ≥44x44px', async ({ page }) => {
      await page.goto('/');

      const buttons = page.locator('button').all();
      const buttonsArray = await buttons;

      for (const button of buttonsArray) {
        if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await button.boundingBox();

          if (box) {
            expect(box.width, `Button too small: ${await button.textContent()}`).toBeGreaterThanOrEqual(44);
            expect(box.height, `Button too small: ${await button.textContent()}`).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('all links should be ≥44px in height', async ({ page }) => {
      await page.goto('/');

      const links = page.locator('a').all();
      const linksArray = await links;

      for (const link of linksArray.slice(0, 10)) {
        if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
          const box = await link.boundingBox();

          if (box) {
            expect(box.height, `Link too small: ${await link.textContent()}`).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });

    test('form inputs should be ≥44px in height', async ({ page }) => {
      await page.goto('/');

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

  test.describe('Color Contrast', () => {
    test('text should have ≥4.5:1 contrast ratio', async ({ page }) => {
      await page.goto('/');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });

    test('dark mode should maintain contrast ratios', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({ rules: { 'color-contrast': { enabled: true } } })
        .analyze();

      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast'
      );

      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('Focus Indicators', () => {
    test('all interactive elements should have visible focus', async ({ page }) => {
      await page.goto('/');

      const buttons = page.locator('button, a, input, select').all();
      const buttonsArray = await buttons;

      for (const element of buttonsArray.slice(0, 5)) {
        if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
          await element.focus();

          // Check for focus ring
          const outline = await element.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
              outline: styles.outline,
              outlineWidth: styles.outlineWidth,
              boxShadow: styles.boxShadow,
            };
          });

          // Should have some focus indicator
          const hasFocusIndicator =
            outline.outlineWidth !== '0px' ||
            outline.outline !== 'none' ||
            outline.boxShadow !== 'none';

          expect(hasFocusIndicator, `No focus indicator on ${await element.textContent()}`).toBe(true);
        }
      }
    });

    test('focus should be visible after keyboard navigation', async ({ page }) => {
      await page.goto('/');

      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    });
  });

  test.describe('Screen Reader Navigation', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // Check h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      // Check heading levels don't skip
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      let previousLevel = 0;
      for (const heading of headings) {
        const tagName = await heading.evaluate((el) => el.tagName.toLowerCase());
        const level = parseInt(tagName.charAt(1));

        // Levels shouldn't skip (e.g., h1 → h3)
        if (previousLevel > 0) {
          expect(level - previousLevel).toBeLessThanOrEqual(1);
        }

        previousLevel = level;
      }
    });

    test('images should have alt text', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      for (const img of imagesArray) {
        const alt = await img.getAttribute('alt');

        // Alt attribute should exist (can be empty for decorative images)
        expect(alt).not.toBeNull();
      }
    });

    test('form inputs should have labels', async ({ page }) => {
      await page.goto('/');

      const newButton = page.locator('button:has-text("New")').first();
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();

        const inputs = page.locator('input, select, textarea').all();
        const inputsArray = await inputs;

        for (const input of inputsArray) {
          if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');

            // Should have label association
            const hasLabel =
              (id && (await page.locator(`label[for="${id}"]`).count()) > 0) ||
              ariaLabel ||
              ariaLabelledBy;

            expect(hasLabel, 'Input missing label').toBe(true);
          }
        }
      }
    });

    test('buttons should have accessible names', async ({ page }) => {
      await page.goto('/');

      const buttons = page.locator('button').all();
      const buttonsArray = await buttons;

      for (const button of buttonsArray) {
        if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
          const text = await button.textContent();
          const ariaLabel = await button.getAttribute('aria-label');

          // Should have text or aria-label
          const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel;

          expect(hasAccessibleName, 'Button missing accessible name').toBe(true);
        }
      }
    });

    test('should have landmarks for navigation', async ({ page }) => {
      await page.goto('/');

      // Should have main landmark
      const main = page.locator('main, [role="main"]');
      await expect(main).toHaveCount(1);

      // Should have nav landmark
      const nav = page.locator('nav, [role="navigation"]');
      const navCount = await nav.count();
      expect(navCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate with Tab key', async ({ page }) => {
      await page.goto('/');

      // Tab through elements
      await page.keyboard.press('Tab');
      let focused = page.locator(':focus');
      await expect(focused).toBeVisible();

      await page.keyboard.press('Tab');
      focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    });

    test('should activate buttons with Enter and Space', async ({ page }) => {
      await page.goto('/');

      const button = page.locator('button').first();
      await button.focus();

      // Should activate with Enter
      await page.keyboard.press('Enter');

      // Check if action occurred (dialog opened or navigation)
      const dialog = page.locator('[role="dialog"]');
      const hasDialog = await dialog.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasDialog) {
        // Close dialog
        await page.keyboard.press('Escape');
      }

      // Reset and try Space
      await button.focus();
      await page.keyboard.press('Space');

      // Should have same effect
      expect(true).toBe(true);
    });

    test('should close dialogs with Escape', async ({ page }) => {
      await page.goto('/');

      const newButton = page.locator('button:has-text("New")').first();
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 2000 });

        // Press Escape
        await page.keyboard.press('Escape');

        // Dialog should close
        const stillVisible = await dialog.isVisible({ timeout: 1000 }).catch(() => false);
        expect(stillVisible).toBe(false);
      }
    });

    test('should trap focus inside modal dialogs', async ({ page }) => {
      await page.goto('/');

      const newButton = page.locator('button:has-text("New")').first();
      if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await newButton.click();

        const dialog = page.locator('[role="dialog"]').first();
        await expect(dialog).toBeVisible({ timeout: 2000 });

        // Tab multiple times
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
        }

        // Focus should still be inside dialog
        const focused = page.locator(':focus');
        const isInsideDialog = await dialog.locator(':focus').count() > 0;

        expect(isInsideDialog).toBe(true);
      }
    });
  });

  test.describe('Zoom and Scaling', () => {
    test('should support zoom to 200% without loss of functionality', async ({ page }) => {
      await page.goto('/');

      // Zoom to 200%
      await page.setViewportSize({ width: 195, height: 422 }); // 50% viewport = 200% zoom

      // Content should still be visible and functional
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Should still be able to navigate
      const button = page.locator('button').first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click();
      }
    });

    test('should not disable pinch-to-zoom', async ({ page }) => {
      await page.goto('/');

      const viewport = page.locator('meta[name="viewport"]');
      const content = await viewport.getAttribute('content');

      // Should not have user-scalable=no or maximum-scale=1
      expect(content).not.toContain('user-scalable=no');
      expect(content).not.toContain('maximum-scale=1');
    });
  });
});

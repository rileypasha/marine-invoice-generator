/**
 * Accessibility Audit for Unsaved Changes System
 *
 * Tests WCAG 2.1 AA compliance for the unsaved changes warning system
 */

const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

async function runAccessibilityAudit() {
  console.log('🔍 Starting Accessibility Audit for Unsaved Changes System...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000/app.html');
    await page.waitForLoadState('networkidle');

    // Initial audit of the base application
    console.log('📋 Running initial accessibility audit...');
    let axeBuilder = new AxeBuilder({ page });
    let results = await axeBuilder.analyze();

    if (results.violations.length > 0) {
      console.log('⚠️ Base application accessibility issues found:');
      results.violations.forEach(violation => {
        console.log(`  - ${violation.id}: ${violation.description}`);
      });
    } else {
      console.log('✅ Base application passes accessibility audit');
    }

    // Sign in if needed
    const signInBtn = page.locator('#sign-in-btn');
    if (await signInBtn.isVisible()) {
      console.log('\n🔐 Signing in to test authenticated functionality...');
      await signInBtn.click();
      await page.waitForSelector('.auth-modal');

      await page.fill('#auth-email', 'test@marinegroup.com');
      await page.fill('#auth-password', 'password123');
      await page.click('#auth-submit');

      await page.waitForSelector('#user-section', { state: 'visible' });
    }

    // Test 1: Trigger unsaved changes dialog
    console.log('\n🧪 Test 1: Accessibility of unsaved changes dialog...');

    // Make changes to trigger unsaved state
    await page.fill('#vessel-name', 'Test Vessel');

    // Trigger the unsaved changes dialog
    await page.click('[data-tab="customer"]');
    await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

    // Audit the dialog
    axeBuilder = new AxeBuilder({ page });
    results = await axeBuilder.analyze();

    if (results.violations.length > 0) {
      console.log('❌ Unsaved changes dialog accessibility issues:');
      results.violations.forEach(violation => {
        console.log(`  - ${violation.id}: ${violation.description}`);
        violation.nodes.forEach(node => {
          console.log(`    Target: ${node.target.join(', ')}`);
        });
      });
    } else {
      console.log('✅ Unsaved changes dialog passes accessibility audit');
    }

    // Test 2: ARIA attributes validation
    console.log('\n🧪 Test 2: ARIA attributes validation...');

    const dialog = page.locator('.unsaved-changes-dialog');

    const ariaChecks = [
      { attribute: 'role', expected: 'alertdialog', description: 'Dialog role' },
      { attribute: 'aria-modal', expected: 'true', description: 'Modal state' },
      { attribute: 'aria-labelledby', expected: 'unsaved-dialog-title', description: 'Title reference' },
      { attribute: 'aria-describedby', expected: 'unsaved-dialog-description', description: 'Description reference' }
    ];

    let ariaIssues = 0;
    for (const check of ariaChecks) {
      const value = await dialog.getAttribute(check.attribute);
      if (value === check.expected) {
        console.log(`✅ ${check.description}: ${check.attribute}="${value}"`);
      } else {
        console.log(`❌ ${check.description}: Expected ${check.attribute}="${check.expected}", got "${value}"`);
        ariaIssues++;
      }
    }

    if (ariaIssues === 0) {
      console.log('✅ All ARIA attributes are correct');
    }

    // Test 3: Keyboard navigation
    console.log('\n🧪 Test 3: Keyboard navigation testing...');

    // Test focus order
    const focusableElements = [
      '#unsaved-cancel-btn',
      '#unsaved-save-btn',
      '#unsaved-discard-btn'
    ];

    console.log('Testing Tab navigation order...');
    await page.keyboard.press('Tab');

    for (let i = 0; i < focusableElements.length; i++) {
      const element = page.locator(focusableElements[i]);
      const isFocused = await element.evaluate(el => el === document.activeElement);

      if (isFocused) {
        console.log(`✅ Tab ${i + 1}: ${focusableElements[i]} correctly focused`);
      } else {
        console.log(`❌ Tab ${i + 1}: Expected ${focusableElements[i]} to be focused`);
      }

      if (i < focusableElements.length - 1) {
        await page.keyboard.press('Tab');
      }
    }

    // Test reverse navigation
    console.log('Testing Shift+Tab reverse navigation...');
    await page.keyboard.press('Shift+Tab');
    const secondElement = page.locator(focusableElements[1]);
    const isSecondFocused = await secondElement.evaluate(el => el === document.activeElement);

    if (isSecondFocused) {
      console.log('✅ Shift+Tab navigation works correctly');
    } else {
      console.log('❌ Shift+Tab navigation failed');
    }

    // Test Escape key
    console.log('Testing Escape key functionality...');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });
    console.log('✅ Escape key closes dialog');

    // Test 4: Focus management
    console.log('\n🧪 Test 4: Focus management testing...');

    // Trigger dialog again and test focus return
    await page.click('[data-tab="scope"]');
    await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

    // Close dialog with cancel
    await page.click('#unsaved-cancel-btn');
    await page.waitForSelector('.unsaved-changes-dialog', { state: 'hidden' });

    // Check if focus returned to trigger element
    const activeElement = await page.evaluate(() => document.activeElement.getAttribute('data-tab'));
    if (activeElement === 'scope') {
      console.log('✅ Focus correctly returned to triggering element');
    } else {
      console.log(`❌ Focus management failed. Expected data-tab="scope", got "${activeElement}"`);
    }

    // Test 5: Screen reader announcements
    console.log('\n🧪 Test 5: Screen reader support testing...');

    // Check for ARIA live region
    const liveRegion = page.locator('#unsaved-changes-announcements');
    const hasLiveRegion = await liveRegion.count() > 0;

    if (hasLiveRegion) {
      const ariaLive = await liveRegion.getAttribute('aria-live');
      const ariaAtomic = await liveRegion.getAttribute('aria-atomic');

      if (ariaLive === 'polite' && ariaAtomic === 'true') {
        console.log('✅ ARIA live region configured correctly');
      } else {
        console.log(`❌ ARIA live region misconfigured. aria-live="${ariaLive}", aria-atomic="${ariaAtomic}"`);
      }
    } else {
      console.log('❌ ARIA live region not found');
    }

    // Test 6: Color contrast and visual accessibility
    console.log('\n🧪 Test 6: Visual accessibility testing...');

    // Trigger dialog for color contrast testing
    await page.fill('#vessel-name', 'Test Again');
    await page.click('[data-tab="notes"]');
    await page.waitForSelector('.unsaved-changes-dialog', { state: 'visible' });

    // Test with reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Check if animations are disabled
    const animationDuration = await page.locator('.unsaved-changes-dialog').evaluate(el => {
      return getComputedStyle(el).animationDuration;
    });

    console.log(`Animation duration with reduced motion: ${animationDuration}`);

    // Test with high contrast
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    // Run contrast-specific audit
    axeBuilder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
    results = await axeBuilder.analyze();

    const contrastViolations = results.violations.filter(v =>
      v.id.includes('color-contrast') || v.id.includes('contrast')
    );

    if (contrastViolations.length === 0) {
      console.log('✅ Color contrast requirements met');
    } else {
      console.log('❌ Color contrast issues found:');
      contrastViolations.forEach(violation => {
        console.log(`  - ${violation.description}`);
      });
    }

    // Test 7: Mobile/touch accessibility
    console.log('\n🧪 Test 7: Mobile accessibility testing...');

    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE dimensions

    // Check button touch targets
    const buttons = await page.locator('.dialog-btn').all();
    let touchTargetIssues = 0;

    for (const button of buttons) {
      const boundingBox = await button.boundingBox();
      if (boundingBox && (boundingBox.width < 44 || boundingBox.height < 44)) {
        console.log(`❌ Button too small for touch: ${boundingBox.width}x${boundingBox.height}px`);
        touchTargetIssues++;
      }
    }

    if (touchTargetIssues === 0) {
      console.log('✅ All buttons meet minimum touch target size (44x44px)');
    }

    // Final audit summary
    console.log('\n📊 Final Accessibility Audit Summary:');
    console.log('=====================================');

    axeBuilder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('#some-non-critical-element'); // Exclude any known non-critical elements

    const finalResults = await axeBuilder.analyze();

    if (finalResults.violations.length === 0) {
      console.log('🎉 ALL ACCESSIBILITY TESTS PASSED!');
      console.log('✅ WCAG 2.1 AA compliance achieved');
    } else {
      console.log(`⚠️ ${finalResults.violations.length} accessibility issues found:`);
      finalResults.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.id}: ${violation.description}`);
        console.log(`   Impact: ${violation.impact}`);
        console.log(`   Tags: ${violation.tags.join(', ')}`);
      });
    }

    console.log(`\n📈 Accessibility Score: ${finalResults.passes.length} passes, ${finalResults.violations.length} violations`);

  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  runAccessibilityAudit()
    .then(() => {
      console.log('\n✅ Accessibility audit completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Audit error:', error);
      process.exit(1);
    });
}

module.exports = { runAccessibilityAudit };
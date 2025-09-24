const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    console.log('Page loaded successfully');

    // Take initial screenshot
    await page.screenshot({ path: 'sidebar-initial.png', fullPage: true });
    console.log('Initial screenshot taken');

    // Wait for any animations to complete
    await page.waitForTimeout(1000);

    // Look for the sidebar toggle button to collapse the sidebar
    const toggleButton = await page.locator('button:has(svg[class*="PanelLeftClose"])');
    await toggleButton.click();
    console.log('Clicked to collapse sidebar');

    // Wait for collapse animation
    await page.waitForTimeout(500);

    // Take screenshot of collapsed state
    await page.screenshot({ path: 'sidebar-collapsed.png', fullPage: true });
    console.log('Collapsed screenshot taken');

    // Now try to hover over the logo area
    const logoArea = await page.locator('img[alt="Marine Group"]').first();
    await logoArea.hover();
    console.log('Hovering over logo area');

    // Take screenshot during hover
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'sidebar-hover-1.png', fullPage: true });
    console.log('Hover screenshot 1 taken');

    // Wait a bit more to see if flickering occurs
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'sidebar-hover-2.png', fullPage: true });
    console.log('Hover screenshot 2 taken');

    // Try moving the mouse slightly to trigger any flickering
    await page.mouse.move(50, 100);
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'sidebar-hover-3.png', fullPage: true });
    console.log('Hover screenshot 3 taken');

    // Move mouse back to logo area to observe the behavior
    await logoArea.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'sidebar-hover-4.png', fullPage: true });
    console.log('Hover screenshot 4 taken');

    console.log('Debug screenshots completed successfully');

  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    await browser.close();
  }
})();
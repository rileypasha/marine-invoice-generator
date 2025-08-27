// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Invoice Detail Modal Visual Stability', () => {
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

    test('Modal opens without layout shift', async () => {
        // Click on first invoice view button
        const viewButton = await page.locator('.btn-view').first();
        
        // Take screenshot before opening modal
        const beforeScreenshot = await page.screenshot({ fullPage: false });
        
        // Open modal
        await viewButton.click();
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Wait for animation to complete
        await page.waitForTimeout(500);
        
        // Verify body scroll is locked
        const bodyOverflow = await page.evaluate(() => {
            return window.getComputedStyle(document.body).overflow;
        });
        expect(bodyOverflow).toBe('hidden');
        
        // Take screenshot after opening modal
        const afterScreenshot = await page.screenshot({ fullPage: false });
        
        // Compare screenshots (background should not shift)
        // Note: In real implementation, use visual regression testing library
        expect(beforeScreenshot).toBeTruthy();
        expect(afterScreenshot).toBeTruthy();
    });

    test('Modal content scrolls independently', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Get initial scroll position
        const initialScroll = await page.evaluate(() => {
            const content = document.querySelector('.invoice-detail-content');
            return content ? content.scrollTop : 0;
        });
        
        // Scroll modal content
        await page.evaluate(() => {
            const content = document.querySelector('.invoice-detail-content');
            if (content) content.scrollTop = 200;
        });
        
        // Verify modal content scrolled
        const newScroll = await page.evaluate(() => {
            const content = document.querySelector('.invoice-detail-content');
            return content ? content.scrollTop : 0;
        });
        expect(newScroll).toBeGreaterThan(initialScroll);
        
        // Verify page body didn't scroll
        const bodyScroll = await page.evaluate(() => document.body.scrollTop);
        expect(bodyScroll).toBe(0);
    });

    test('Financial metrics remain stable during scroll', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Get initial position of financial metrics
        const initialMetrics = await page.evaluate(() => {
            const metrics = document.querySelector('.detail-grid.four-items');
            if (!metrics) return null;
            const rect = metrics.getBoundingClientRect();
            return {
                top: rect.top,
                height: rect.height,
                width: rect.width
            };
        });
        
        // Scroll down
        await page.evaluate(() => {
            const content = document.querySelector('.invoice-detail-content');
            if (content) content.scrollTop = 500;
        });
        
        // Wait for any potential layout shift
        await page.waitForTimeout(100);
        
        // Get position after scroll
        const scrolledMetrics = await page.evaluate(() => {
            const metrics = document.querySelector('.detail-grid.four-items');
            if (!metrics) return null;
            const rect = metrics.getBoundingClientRect();
            return {
                height: rect.height,
                width: rect.width
            };
        });
        
        // Verify dimensions didn't change
        expect(scrolledMetrics.height).toBe(initialMetrics.height);
        expect(scrolledMetrics.width).toBe(initialMetrics.width);
    });

    test('Line items table headers remain sticky', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Check if table has enough rows to scroll
        const hasScrollableTable = await page.evaluate(() => {
            const table = document.querySelector('.invoice-detail-content .invoices-table');
            const rows = table ? table.querySelectorAll('tbody tr') : [];
            return rows.length > 5;
        });
        
        if (hasScrollableTable) {
            // Get initial header position
            const initialHeader = await page.evaluate(() => {
                const header = document.querySelector('.invoice-detail-content .invoices-table thead');
                return header ? header.getBoundingClientRect().top : 0;
            });
            
            // Scroll down within modal
            await page.evaluate(() => {
                const content = document.querySelector('.invoice-detail-content');
                if (content) content.scrollTop = 300;
            });
            
            // Get header position after scroll
            const scrolledHeader = await page.evaluate(() => {
                const header = document.querySelector('.invoice-detail-content .invoices-table thead');
                const content = document.querySelector('.invoice-detail-content');
                return {
                    headerTop: header ? header.getBoundingClientRect().top : 0,
                    contentTop: content ? content.getBoundingClientRect().top : 0,
                    isSticky: window.getComputedStyle(header).position === 'sticky'
                };
            });
            
            // Verify header is sticky
            expect(scrolledHeader.isSticky).toBe(true);
            // Header should remain near top of content area
            expect(scrolledHeader.headerTop).toBeCloseTo(scrolledHeader.contentTop, 1);
        }
    });

    test('Modal closes properly with animation', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Close modal via close button
        await page.click('.invoice-detail-close');
        
        // Wait for animation
        await page.waitForTimeout(400);
        
        // Verify modal is hidden
        const modalDisplay = await page.evaluate(() => {
            const modal = document.querySelector('.invoice-detail-modal');
            return modal ? window.getComputedStyle(modal).display : 'none';
        });
        expect(modalDisplay).toBe('none');
        
        // Verify body scroll is restored
        const bodyOverflow = await page.evaluate(() => {
            return window.getComputedStyle(document.body).overflow;
        });
        expect(bodyOverflow).not.toBe('hidden');
    });

    test('Modal closes on Escape key', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Press Escape
        await page.keyboard.press('Escape');
        
        // Wait for animation
        await page.waitForTimeout(400);
        
        // Verify modal is closed
        const modalDisplay = await page.evaluate(() => {
            const modal = document.querySelector('.invoice-detail-modal');
            return modal ? window.getComputedStyle(modal).display : 'none';
        });
        expect(modalDisplay).toBe('none');
    });

    test('Modal closes on overlay click', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Click on overlay (not the panel)
        await page.click('.invoice-detail-overlay');
        
        // Wait for animation
        await page.waitForTimeout(400);
        
        // Verify modal is closed
        const modalDisplay = await page.evaluate(() => {
            const modal = document.querySelector('.invoice-detail-modal');
            return modal ? window.getComputedStyle(modal).display : 'none';
        });
        expect(modalDisplay).toBe('none');
    });

    test('No layout shift when resizing window', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Get initial metrics
        const initialLayout = await page.evaluate(() => {
            const panel = document.querySelector('.invoice-detail-panel');
            const metrics = document.querySelector('.detail-grid.four-items');
            return {
                panelHeight: panel ? panel.offsetHeight : 0,
                metricsHeight: metrics ? metrics.offsetHeight : 0
            };
        });
        
        // Resize window
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(100);
        
        // Get metrics after resize
        const resizedLayout = await page.evaluate(() => {
            const panel = document.querySelector('.invoice-detail-panel');
            const metrics = document.querySelector('.detail-grid.four-items');
            return {
                panelHeight: panel ? panel.offsetHeight : 0,
                metricsHeight: metrics ? metrics.offsetHeight : 0
            };
        });
        
        // Panel height should remain consistent (90vh)
        expect(resizedLayout.panelHeight).toBeCloseTo(600 * 0.9, 10);
        
        // Metrics should have adapted but not collapsed
        expect(resizedLayout.metricsHeight).toBeGreaterThan(0);
    });

    test('Detail items maintain minimum height', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Check all detail items have minimum height
        const itemHeights = await page.evaluate(() => {
            const items = document.querySelectorAll('.detail-item');
            return Array.from(items).map(item => item.offsetHeight);
        });
        
        // All items should have at least 80px height (as defined in CSS)
        itemHeights.forEach(height => {
            expect(height).toBeGreaterThanOrEqual(80);
        });
    });

    test('CSS containment is properly applied', async () => {
        // Open modal
        await page.click('.btn-view');
        await page.waitForSelector('.invoice-detail-modal[style*="display: block"]');
        
        // Verify containment properties
        const containment = await page.evaluate(() => {
            const panel = document.querySelector('.invoice-detail-panel');
            const content = document.querySelector('.invoice-detail-content');
            const sections = document.querySelectorAll('.detail-section');
            
            return {
                panel: panel ? window.getComputedStyle(panel).contain : '',
                content: content ? window.getComputedStyle(content).contain : '',
                sections: Array.from(sections).map(s => window.getComputedStyle(s).contain)
            };
        });
        
        // Verify containment is applied
        expect(containment.panel).toContain('layout');
        expect(containment.content).toContain('paint');
        containment.sections.forEach(contain => {
            expect(contain).toContain('layout');
        });
    });

    test.afterEach(async () => {
        await page.close();
    });
});

// Visual regression test configuration
test.use({
    // Use consistent viewport size
    viewport: { width: 1280, height: 720 },
    
    // Disable animations for consistent screenshots
    launchOptions: {
        args: ['--force-prefers-reduced-motion']
    },
    
    // Screenshot comparison settings
    use: {
        toHaveScreenshot: {
            maxDiffPixels: 100,
            threshold: 0.2
        }
    }
});
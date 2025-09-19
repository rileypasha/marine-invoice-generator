const { chromium } = require('playwright');

/**
 * Phase 3 Sidebar Console Error Analysis
 *
 * This test specifically targets:
 * 1. Sidebar null reference errors
 * 2. DOM manipulation issues after login
 * 3. JavaScript errors related to UI components
 * 4. Any console errors that occur during normal app flow
 */

async function runSidebarConsoleTest() {
    console.log('🔍 Starting Phase 3 Sidebar Console Error Analysis...');
    console.log('📅 Test Date:', new Date().toISOString());
    console.log('🌐 Target: mginvoices.com');
    console.log('🎯 Focus: Sidebar null references, DOM issues, console errors\n');

    const browser = await chromium.launch({
        headless: false,  // Show browser for debugging
        slowMo: 1000      // Slow down for visibility
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Arrays to collect different types of console messages
    const consoleErrors = [];
    const consoleWarnings = [];
    const consoleLogs = [];
    const networkErrors = [];
    const sidebarErrors = [];
    const domErrors = [];
    const nullReferenceErrors = [];

    // Comprehensive console message listener
    page.on('console', (msg) => {
        const timestamp = new Date().toISOString();
        const message = {
            timestamp,
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
        };

        // Categorize messages
        if (msg.type() === 'error') {
            consoleErrors.push(message);

            // Check for sidebar-specific errors
            if (message.text.toLowerCase().includes('sidebar') ||
                message.text.toLowerCase().includes('side-bar') ||
                message.text.toLowerCase().includes('navigation')) {
                sidebarErrors.push(message);
            }

            // Check for DOM-related errors
            if (message.text.toLowerCase().includes('dom') ||
                message.text.toLowerCase().includes('element') ||
                message.text.toLowerCase().includes('node') ||
                message.text.toLowerCase().includes('querySelector') ||
                message.text.toLowerCase().includes('getElementById')) {
                domErrors.push(message);
            }

            // Check for null reference errors
            if (message.text.toLowerCase().includes('null') ||
                message.text.toLowerCase().includes('undefined') ||
                message.text.toLowerCase().includes('cannot read prop') ||
                message.text.toLowerCase().includes('cannot access before initialization') ||
                message.text.toLowerCase().includes('is not defined')) {
                nullReferenceErrors.push(message);
            }
        } else if (msg.type() === 'warning') {
            consoleWarnings.push(message);
        } else {
            consoleLogs.push(message);
        }
    });

    // Network error listener
    page.on('response', async (response) => {
        if (!response.ok()) {
            const timestamp = new Date().toISOString();
            networkErrors.push({
                timestamp,
                status: response.status(),
                url: response.url(),
                statusText: response.statusText()
            });
        }
    });

    // JavaScript exception listener
    page.on('pageerror', (error) => {
        const timestamp = new Date().toISOString();
        consoleErrors.push({
            timestamp,
            type: 'pageerror',
            text: error.message,
            stack: error.stack
        });

        // Check if it's a sidebar or DOM related exception
        if (error.message.toLowerCase().includes('sidebar') ||
            error.message.toLowerCase().includes('dom') ||
            error.message.toLowerCase().includes('null') ||
            error.message.toLowerCase().includes('undefined')) {
            sidebarErrors.push({
                timestamp,
                type: 'pageerror',
                text: error.message,
                stack: error.stack
            });
        }
    });

    try {
        console.log('🌐 Navigating to login page...');
        await page.goto('https://mginvoices.com', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        // Wait for page to be fully loaded
        await page.waitForTimeout(2000);
        console.log('✅ Login page loaded');

        console.log('🔐 Entering login credentials...');

        // Fill login form
        await page.fill('input[type="email"], input[name="email"], #email', 'test-user@mginvoices.com');
        await page.fill('input[type="password"], input[name="password"], #password', 'TempPassword123!');

        console.log('🚀 Submitting login...');
        await page.click('button[type="submit"], .login-button, .btn-primary');

        // Wait for login to complete and dashboard to load
        console.log('⏳ Waiting for dashboard to load...');
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

        // Additional wait for JavaScript to execute and components to render
        await page.waitForTimeout(5000);
        console.log('✅ Dashboard loaded');

        console.log('🔍 Analyzing page structure for sidebar elements...');

        // Check for sidebar elements in the DOM
        const sidebarSelectors = [
            '.sidebar',
            '.side-bar',
            '.navigation',
            '.nav-sidebar',
            '.app-sidebar',
            '[class*="sidebar"]',
            '[id*="sidebar"]',
            '.menu',
            '.nav-menu'
        ];

        for (const selector of sidebarSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`✅ Found sidebar element: ${selector}`);
                } else {
                    console.log(`❌ Sidebar element not found: ${selector}`);
                }
            } catch (error) {
                console.log(`❌ Error checking selector ${selector}:`, error.message);
            }
        }

        console.log('📋 Checking for invoices page...');

        // Try to navigate to invoices or trigger invoices loading
        try {
            // Look for invoices link/button
            const invoicesLinks = [
                'a[href*="invoice"]',
                'button:has-text("Invoice")',
                '.invoices',
                '[data-testid*="invoice"]',
                'nav a:has-text("Invoice")'
            ];

            let invoicesLinkFound = false;
            for (const selector of invoicesLinks) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        console.log(`✅ Found invoices navigation: ${selector}`);
                        await element.click();
                        invoicesLinkFound = true;
                        break;
                    }
                } catch (error) {
                    // Continue trying other selectors
                }
            }

            if (!invoicesLinkFound) {
                console.log('ℹ️ Invoices navigation not found, staying on dashboard');
            } else {
                // Wait for invoices page to load
                await page.waitForTimeout(5000);
                console.log('✅ Invoices page interaction completed');
            }

        } catch (error) {
            console.log('ℹ️ Could not navigate to invoices:', error.message);
        }

        // Final wait to capture any delayed errors
        console.log('⏳ Waiting for delayed JavaScript errors...');
        await page.waitForTimeout(5000);

    } catch (error) {
        console.error('❌ Test execution error:', error.message);
        consoleErrors.push({
            timestamp: new Date().toISOString(),
            type: 'test-error',
            text: error.message,
            stack: error.stack
        });
    }

    await browser.close();

    // Generate comprehensive report
    console.log('\n' + '='.repeat(60));
    console.log('📊 PHASE 3 SIDEBAR CONSOLE ERROR ANALYSIS REPORT');
    console.log('='.repeat(60));
    console.log('Generated:', new Date().toISOString());
    console.log('');

    console.log('📈 SUMMARY STATISTICS:');
    console.log(`- Total Console Messages: ${consoleErrors.length + consoleWarnings.length + consoleLogs.length}`);
    console.log(`- Total Errors: ${consoleErrors.length}`);
    console.log(`- Total Warnings: ${consoleWarnings.length}`);
    console.log(`- Failed Network Requests: ${networkErrors.length}`);
    console.log(`- Sidebar-Specific Errors: ${sidebarErrors.length}`);
    console.log(`- DOM-Related Errors: ${domErrors.length}`);
    console.log(`- Null Reference Errors: ${nullReferenceErrors.length}`);
    console.log('');

    // CRITICAL ERRORS - Phase 3 Focus
    if (sidebarErrors.length > 0) {
        console.log('🚨 CRITICAL: SIDEBAR-SPECIFIC ERRORS FOUND:');
        sidebarErrors.forEach((error, index) => {
            console.log(`${index + 1}. [${error.timestamp}] ${error.type.toUpperCase()}: ${error.text}`);
            if (error.stack) {
                console.log(`   Stack: ${error.stack.substring(0, 200)}...`);
            }
            if (error.location) {
                console.log(`   Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
            }
        });
        console.log('');
    }

    if (domErrors.length > 0) {
        console.log('🚨 CRITICAL: DOM-RELATED ERRORS FOUND:');
        domErrors.forEach((error, index) => {
            console.log(`${index + 1}. [${error.timestamp}] ${error.type.toUpperCase()}: ${error.text}`);
            if (error.location) {
                console.log(`   Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
            }
        });
        console.log('');
    }

    if (nullReferenceErrors.length > 0) {
        console.log('🚨 CRITICAL: NULL REFERENCE ERRORS FOUND:');
        nullReferenceErrors.forEach((error, index) => {
            console.log(`${index + 1}. [${error.timestamp}] ${error.type.toUpperCase()}: ${error.text}`);
            if (error.location) {
                console.log(`   Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
            }
        });
        console.log('');
    }

    // ALL CONSOLE ERRORS
    if (consoleErrors.length > 0) {
        console.log('❌ ALL CONSOLE ERRORS:');
        consoleErrors.forEach((error, index) => {
            console.log(`${index + 1}. [${error.timestamp}] ${error.type.toUpperCase()}: ${error.text}`);
            if (error.location) {
                console.log(`   Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
            }
        });
        console.log('');
    } else {
        console.log('✅ NO CONSOLE ERRORS DETECTED');
        console.log('');
    }

    // NETWORK ERRORS
    if (networkErrors.length > 0) {
        console.log('🌐 NETWORK ERRORS:');
        networkErrors.forEach((error, index) => {
            console.log(`${index + 1}. [${error.timestamp}] ${error.status} ${error.statusText}: ${error.url}`);
        });
        console.log('');
    } else {
        console.log('✅ NO NETWORK ERRORS DETECTED');
        console.log('');
    }

    // WARNINGS
    if (consoleWarnings.length > 0) {
        console.log('⚠️ CONSOLE WARNINGS:');
        consoleWarnings.forEach((warning, index) => {
            console.log(`${index + 1}. [${warning.timestamp}] WARNING: ${warning.text}`);
        });
        console.log('');
    }

    console.log('🎯 PHASE 3 RECOMMENDATIONS:');

    if (sidebarErrors.length > 0 || domErrors.length > 0 || nullReferenceErrors.length > 0) {
        console.log('❌ ISSUES FOUND - IMMEDIATE ACTION REQUIRED:');

        if (sidebarErrors.length > 0) {
            console.log('- Fix sidebar-related JavaScript errors');
            console.log('- Check sidebar element initialization');
            console.log('- Verify sidebar DOM structure and selectors');
        }

        if (domErrors.length > 0) {
            console.log('- Fix DOM manipulation errors');
            console.log('- Check element selectors and availability');
            console.log('- Add null checks before DOM operations');
        }

        if (nullReferenceErrors.length > 0) {
            console.log('- Add null/undefined checks');
            console.log('- Initialize variables before use');
            console.log('- Check object property existence');
        }

    } else {
        console.log('✅ No sidebar or DOM specific errors detected');
        console.log('✅ Phase 3 issues may be resolved or not reproducible in current test');
    }

    // Save detailed report to file
    const detailedReport = {
        timestamp: new Date().toISOString(),
        summary: {
            totalMessages: consoleErrors.length + consoleWarnings.length + consoleLogs.length,
            totalErrors: consoleErrors.length,
            totalWarnings: consoleWarnings.length,
            networkErrors: networkErrors.length,
            sidebarErrors: sidebarErrors.length,
            domErrors: domErrors.length,
            nullReferenceErrors: nullReferenceErrors.length
        },
        sidebarErrors,
        domErrors,
        nullReferenceErrors,
        allConsoleErrors: consoleErrors,
        networkErrors,
        warnings: consoleWarnings,
        logs: consoleLogs.slice(0, 10) // Only save first 10 logs to avoid noise
    };

    const fs = require('fs');
    fs.writeFileSync(
        '/mnt/c/Users/riley/Desktop/marine-group (2)/marine-group/marine-invoice-generator/phase3-sidebar-error-report.json',
        JSON.stringify(detailedReport, null, 2)
    );

    console.log('📄 Detailed report saved to: phase3-sidebar-error-report.json');
    console.log('='.repeat(60));

    return detailedReport;
}

// Run the test
runSidebarConsoleTest().catch(console.error);
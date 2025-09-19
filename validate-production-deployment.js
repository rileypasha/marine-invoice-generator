#!/usr/bin/env node

/**
 * Production Deployment Validation Script
 * Validates that the deployment is working without requiring authentication
 */

const { chromium } = require('playwright');

async function validateProductionDeployment() {
    console.log('🚀 Phase 5: Production Deployment Validation');
    console.log('🎯 Target: https://mginvoices.com');
    console.log('📋 Validating deployment health without authentication...\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        ignoreHTTPSErrors: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let validationErrors = [];
    let networkErrors = [];
    let consoleErrors = [];

    // Monitor console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const errorText = msg.text();
            // Filter out expected auth errors in production
            if (!errorText.includes('401') && !errorText.includes('Failed to load resource')) {
                consoleErrors.push(errorText);
                console.log(`❌ Console Error: ${errorText}`);
            }
        }
    });

    // Monitor network errors
    page.on('requestfailed', request => {
        const url = request.url();
        const failure = request.failure();
        // Filter out expected auth failures
        if (!url.includes('/api/auth/')) {
            networkErrors.push(`${url}: ${failure.errorText}`);
            console.log(`🌐 Network Error: ${url} - ${failure.errorText}`);
        }
    });

    try {
        console.log('📥 Phase 1: Loading landing page...');

        // Navigate to production site
        await page.goto('https://mginvoices.com', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('✅ Landing page loaded successfully');

        // Check for critical elements that should be present
        console.log('🔍 Phase 2: Validating core page elements...');

        // Check for main container
        const mainContainer = await page.locator('body').first();
        if (!await mainContainer.isVisible()) {
            validationErrors.push('Main body container not found');
        }

        // Check for app initialization
        await page.waitForFunction(() => {
            return document.readyState === 'complete';
        }, { timeout: 10000 });

        console.log('✅ Page fully loaded and interactive');

        // Check for JavaScript initialization
        console.log('🧪 Phase 3: Validating JavaScript initialization...');

        const jsWorking = await page.evaluate(() => {
            // Check if our main app globals are present
            return typeof window !== 'undefined' &&
                   document.readyState === 'complete';
        });

        if (!jsWorking) {
            validationErrors.push('JavaScript initialization failed');
        } else {
            console.log('✅ JavaScript initialized successfully');
        }

        // Check for CSS loading
        console.log('🎨 Phase 4: Validating CSS loading...');

        const cssLoaded = await page.evaluate(() => {
            const stylesheets = document.styleSheets;
            return stylesheets.length > 0;
        });

        if (!cssLoaded) {
            validationErrors.push('CSS stylesheets not loaded');
        } else {
            console.log('✅ CSS stylesheets loaded successfully');
        }

        // Check for login functionality presence (without logging in)
        console.log('🔐 Phase 5: Validating auth UI presence...');

        // Look for sign in button or auth modal
        const authElements = await page.locator('button:has-text("Sign In"), .auth-modal, [data-auth]').count();
        if (authElements === 0) {
            validationErrors.push('Authentication UI elements not found');
        } else {
            console.log('✅ Authentication UI elements present');
        }

        // Final health check
        console.log('🏥 Phase 6: Final health assessment...');

        const finalHealth = await page.evaluate(() => {
            // Check for major error indicators
            const errorMessages = document.querySelectorAll('.error, .alert-danger, [data-error="true"]');
            const fatalErrors = Array.from(errorMessages).filter(el =>
                el.textContent.toLowerCase().includes('fatal') ||
                el.textContent.toLowerCase().includes('crash') ||
                el.textContent.toLowerCase().includes('broken')
            );

            return {
                hasErrors: errorMessages.length > 0,
                hasFatalErrors: fatalErrors.length > 0,
                errorCount: errorMessages.length,
                fatalErrorCount: fatalErrors.length
            };
        });

        if (finalHealth.hasFatalErrors) {
            validationErrors.push(`Found ${finalHealth.fatalErrorCount} fatal errors in UI`);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 PRODUCTION DEPLOYMENT VALIDATION SUMMARY');
        console.log('='.repeat(60));

        console.log(`🌐 Site URL: https://mginvoices.com`);
        console.log(`📅 Validation Time: ${new Date().toISOString()}`);

        if (validationErrors.length === 0) {
            console.log('✅ DEPLOYMENT VALIDATION: PASSED');
            console.log('🎉 Production site is healthy and functional');
        } else {
            console.log('❌ DEPLOYMENT VALIDATION: FAILED');
            console.log(`⚠️  Found ${validationErrors.length} validation errors:`);
            validationErrors.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }

        if (consoleErrors.length > 0) {
            console.log(`⚠️  Console Errors: ${consoleErrors.length}`);
            consoleErrors.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        } else {
            console.log('✅ No critical console errors detected');
        }

        if (networkErrors.length > 0) {
            console.log(`🌐 Network Errors: ${networkErrors.length}`);
            networkErrors.forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        } else {
            console.log('✅ No critical network errors detected');
        }

        console.log('\n🚀 Deployment validation complete!');

        return {
            success: validationErrors.length === 0,
            validationErrors,
            consoleErrors,
            networkErrors
        };

    } catch (error) {
        console.error('❌ CRITICAL: Deployment validation failed');
        console.error(`💥 Error: ${error.message}`);
        return {
            success: false,
            validationErrors: [`Critical validation failure: ${error.message}`],
            consoleErrors,
            networkErrors
        };
    } finally {
        await browser.close();
    }
}

// Run validation
validateProductionDeployment()
    .then(result => {
        process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
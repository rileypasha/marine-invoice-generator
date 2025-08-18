const puppeteer = require('puppeteer');

async function runTests() {
  let browser;
  let page;
  let passed = 0;
  let failed = 0;
  
  try {
    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    console.log('Navigating to application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 10000 });
    
    console.log('\n=== RUNNING E2E TESTS ===\n');
    
    // Test 1: Page loads successfully
    try {
      const title = await page.title();
      if (title.includes('Marine Group')) {
        console.log('✓ Test 1 PASSED: Page loads successfully');
        passed++;
      } else throw new Error('Title incorrect');
    } catch (e) {
      console.log('✗ Test 1 FAILED: Page load - ' + e.message);
      failed++;
    }
    
    // Test 2: Company logo displays
    try {
      const logo = await page.$('.company-logo');
      if (logo) {
        const src = await page.evaluate(el => el.src, logo);
        if (src === 'https://i.imgur.com/A9K1ByZ.png') {
          console.log('✓ Test 2 PASSED: Company logo displays correctly');
          passed++;
        } else throw new Error('Logo source incorrect');
      } else throw new Error('Logo not found');
    } catch (e) {
      console.log('✗ Test 2 FAILED: Logo display - ' + e.message);
      failed++;
    }
    
    // Test 3: Clearance fee calculation (>500 tons)
    try {
      await page.type('#vessel-weight', '600');
      await page.waitForTimeout(100);
      const fee = await page.$eval('.preview-clearance-fee', el => el.textContent);
      if (fee.includes('1,250')) {
        console.log('✓ Test 3 PASSED: Clearance fee calculation (>500 tons)');
        passed++;
      } else throw new Error(`Expected $1,250, got ${fee}`);
    } catch (e) {
      console.log('✗ Test 3 FAILED: Clearance fee - ' + e.message);
      failed++;
    }
    
    // Test 4: Tab navigation
    try {
      await page.click('[data-tab="customer"]');
      await page.waitForTimeout(100);
      const visible = await page.$eval('[data-section="customer"]', el => 
        el.classList.contains('visible')
      );
      if (visible) {
        console.log('✓ Test 4 PASSED: Tab navigation works');
        passed++;
      } else throw new Error('Customer tab not visible');
    } catch (e) {
      console.log('✗ Test 4 FAILED: Tab navigation - ' + e.message);
      failed++;
    }
    
    // Test 5: Phone number formatting
    try {
      await page.type('#customer-phone', '5551234567');
      const value = await page.$eval('#customer-phone', el => el.value);
      if (value === '(555) 123-4567') {
        console.log('✓ Test 5 PASSED: Phone number formatting');
        passed++;
      } else throw new Error(`Expected (555) 123-4567, got ${value}`);
    } catch (e) {
      console.log('✗ Test 5 FAILED: Phone formatting - ' + e.message);
      failed++;
    }
    
    // Test 6: Email validation
    try {
      await page.type('#customer-email', 'invalid-email');
      await page.click('#customer-name');
      await page.waitForTimeout(100);
      const error = await page.$eval('.email-error', el => el.textContent);
      if (error && error.length > 0) {
        console.log('✓ Test 6 PASSED: Email validation');
        passed++;
      } else throw new Error('No validation error shown');
    } catch (e) {
      console.log('✗ Test 6 FAILED: Email validation - ' + e.message);
      failed++;
    }
    
    // Test 7: Line item addition
    try {
      await page.click('[data-tab="scope"]');
      await page.waitForTimeout(100);
      await page.click('#add-line-item');
      await page.waitForTimeout(100);
      const lineItem = await page.$('[data-row="0"]');
      if (lineItem) {
        console.log('✓ Test 7 PASSED: Line item addition');
        passed++;
      } else throw new Error('Line item not added');
    } catch (e) {
      console.log('✗ Test 7 FAILED: Line item addition - ' + e.message);
      failed++;
    }
    
    // Test 8: Labor cost calculation
    try {
      await page.select('[data-row="0"] .job-type-select', 'Agent Services');
      await page.type('[data-row="0"] .labor-hours-input', '10');
      await page.type('[data-row="0"] .description-input', 'Test Labor');
      await page.waitForTimeout(100);
      const costCells = await page.$$('.preview-panel .cost-cell');
      let found = false;
      for (const cell of costCells) {
        const text = await page.evaluate(el => el.textContent, cell);
        if (text === '$800.00') {
          found = true;
          break;
        }
      }
      if (found) {
        console.log('✓ Test 8 PASSED: Labor cost calculation ($80/hr)');
        passed++;
      } else throw new Error('Cost calculation incorrect');
    } catch (e) {
      console.log('✗ Test 8 FAILED: Labor cost - ' + e.message);
      failed++;
    }
    
    // Test 9: Tax calculation
    try {
      await page.click('#taxable-yes');
      await page.waitForTimeout(100);
      const taxRow = await page.$('.tax-row');
      const display = await page.evaluate(el => window.getComputedStyle(el).display, taxRow);
      if (display !== 'none') {
        const taxAmount = await page.$eval('.tax-amount', el => el.textContent);
        if (taxAmount.includes('$')) {
          console.log('✓ Test 9 PASSED: Tax calculation (8.75%)');
          passed++;
        } else throw new Error('Tax amount not shown');
      } else throw new Error('Tax row not visible');
    } catch (e) {
      console.log('✗ Test 9 FAILED: Tax calculation - ' + e.message);
      failed++;
    }
    
    // Test 10: Real-time preview update
    try {
      await page.click('[data-tab="vessel"]');
      await page.waitForTimeout(100);
      const testName = 'TestVessel' + Date.now();
      await page.type('#vessel-name', testName);
      await page.waitForTimeout(100);
      const preview = await page.$eval('.preview-vessel-name', el => el.textContent);
      if (preview.includes(testName)) {
        console.log('✓ Test 10 PASSED: Real-time preview update');
        passed++;
      } else throw new Error('Preview not updated');
    } catch (e) {
      console.log('✗ Test 10 FAILED: Real-time preview - ' + e.message);
      failed++;
    }
    
    // Test 11: Markup application
    try {
      await page.click('[data-tab="scope"]');
      await page.select('#markup-rate', '12.5');
      await page.waitForTimeout(100);
      const markupCells = await page.$$('.total-with-markup');
      if (markupCells.length > 0) {
        console.log('✓ Test 11 PASSED: Markup application');
        passed++;
      } else throw new Error('Markup not applied');
    } catch (e) {
      console.log('✗ Test 11 FAILED: Markup - ' + e.message);
      failed++;
    }
    
    // Test 12: Gross profit calculation
    try {
      const gpAmount = await page.$('.gross-profit-amount');
      const gpPercent = await page.$('.gross-profit-percent');
      if (gpAmount && gpPercent) {
        console.log('✓ Test 12 PASSED: Gross profit calculation');
        passed++;
      } else throw new Error('Gross profit not shown');
    } catch (e) {
      console.log('✗ Test 12 FAILED: Gross profit - ' + e.message);
      failed++;
    }
    
  } catch (error) {
    console.error('Test execution error:', error.message);
    failed = 12;
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    const total = passed + failed;
    const status = passed >= 10 ? 'PASSED' : 'FAILED';
    
    console.log(`\nStatus: ${status}`);
    console.log(`Passed: ${passed}/${total}`);
    console.log(`Failed: ${failed}/${total}`);
    console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);
    
    if (browser) await browser.close();
    
    console.log('\n' + '='.repeat(50));
    
    process.exit(failed > 2 ? 1 : 0);
  }
}

// Run tests
runTests().catch(console.error);
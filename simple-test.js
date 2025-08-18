const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function runTests() {
  let server;
  let browser;
  let page;
  let passed = 0;
  let failed = 0;
  
  try {
    // Start server
    console.log('Starting test server...');
    server = spawn('node', ['test-server.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Launch browser
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    console.log('\n=== Running Tests ===\n');
    
    // Test 1: Check if page loads
    try {
      const title = await page.title();
      console.log('✓ Page loads with title:', title);
      passed++;
    } catch (e) {
      console.log('✗ Page load failed');
      failed++;
    }
    
    // Test 2: Check logo
    try {
      const logoExists = await page.$('.company-logo');
      if (logoExists) {
        console.log('✓ Company logo exists');
        passed++;
      } else throw new Error('Logo not found');
    } catch (e) {
      console.log('✗ Logo check failed');
      failed++;
    }
    
    // Test 3: Check clearance fee calculation
    try {
      await page.type('#vessel-weight', '600');
      await page.waitForTimeout(500);
      const fee = await page.$eval('.preview-clearance-fee', el => el.textContent);
      if (fee.includes('1,250')) {
        console.log('✓ Clearance fee calculation works (>500 tons)');
        passed++;
      } else throw new Error('Wrong fee');
    } catch (e) {
      console.log('✗ Clearance fee test failed');
      failed++;
    }
    
    // Test 4: Check tab navigation
    try {
      await page.click('[data-tab="customer"]');
      await page.waitForTimeout(500);
      const visible = await page.$eval('[data-section="customer"]', el => 
        el.classList.contains('visible')
      );
      if (visible) {
        console.log('✓ Tab navigation works');
        passed++;
      } else throw new Error('Tab not visible');
    } catch (e) {
      console.log('✗ Tab navigation failed');
      failed++;
    }
    
    // Test 5: Check phone formatting
    try {
      await page.type('#customer-phone', '5551234567');
      const value = await page.$eval('#customer-phone', el => el.value);
      if (value === '(555) 123-4567') {
        console.log('✓ Phone formatting works');
        passed++;
      } else throw new Error('Phone not formatted');
    } catch (e) {
      console.log('✗ Phone formatting failed');
      failed++;
    }
    
    // Test 6: Check email validation
    try {
      await page.type('#customer-email', 'invalid');
      await page.click('#customer-name');
      await page.waitForTimeout(500);
      const error = await page.$eval('.email-error', el => el.textContent);
      if (error.length > 0) {
        console.log('✓ Email validation works');
        passed++;
      } else throw new Error('No validation error');
    } catch (e) {
      console.log('✗ Email validation failed');
      failed++;
    }
    
    // Test 7: Add line item
    try {
      await page.click('[data-tab="scope"]');
      await page.waitForTimeout(500);
      await page.click('#add-line-item');
      await page.waitForTimeout(500);
      const lineItem = await page.$('[data-row="0"]');
      if (lineItem) {
        console.log('✓ Line item addition works');
        passed++;
      } else throw new Error('Line item not added');
    } catch (e) {
      console.log('✗ Line item addition failed');
      failed++;
    }
    
    // Test 8: Labor cost calculation
    try {
      await page.select('[data-row="0"] .job-type-select', 'Agent Services');
      await page.type('[data-row="0"] .labor-hours-input', '10');
      await page.type('[data-row="0"] .description-input', 'Test');
      await page.waitForTimeout(500);
      const cost = await page.$eval('.preview-panel .cost-cell', el => el.textContent);
      if (cost === '$800.00') {
        console.log('✓ Labor cost calculation works');
        passed++;
      } else throw new Error(`Wrong cost: ${cost}`);
    } catch (e) {
      console.log('✗ Labor cost calculation failed');
      failed++;
    }
    
    // Test 9: Tax calculation
    try {
      await page.click('#taxable-yes');
      await page.waitForTimeout(500);
      const taxVisible = await page.$eval('.tax-row', el => 
        el.style.display !== 'none'
      );
      if (taxVisible) {
        console.log('✓ Tax calculation works');
        passed++;
      } else throw new Error('Tax not shown');
    } catch (e) {
      console.log('✗ Tax calculation failed');
      failed++;
    }
    
    // Test 10: Real-time preview
    try {
      await page.click('[data-tab="vessel"]');
      const testName = 'Test Vessel ' + Date.now();
      await page.type('#vessel-name', testName);
      await page.waitForTimeout(500);
      const preview = await page.$eval('.preview-vessel-name', el => el.textContent);
      if (preview.includes(testName)) {
        console.log('✓ Real-time preview works');
        passed++;
      } else throw new Error('Preview not updated');
    } catch (e) {
      console.log('✗ Real-time preview failed');
      failed++;
    }
    
  } catch (error) {
    console.error('Test execution error:', error.message);
  } finally {
    console.log('\n=== Test Summary ===');
    console.log(`PASSED: ${passed}/10`);
    console.log(`FAILED: ${failed}/10`);
    
    if (browser) await browser.close();
    if (server) server.kill();
    
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
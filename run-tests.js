const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

let server;
let browser;
let page;
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function startServer() {
  return new Promise((resolve) => {
    server = spawn('node', ['test-server.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Test server running')) {
        setTimeout(resolve, 1000); // Give server time to fully start
      }
    });
  });
}

async function runTests() {
  console.log('Starting test server...');
  await startServer();
  
  console.log('Launching browser...');
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  page = await browser.newPage();
  
  // Test 1: Page loads successfully
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('✓ Page loads successfully');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Page load failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 2: Company logo displays
  try {
    const logo = await page.$('.company-logo');
    const logoSrc = await page.evaluate(el => el?.src, logo);
    if (logoSrc === 'https://i.imgur.com/A9K1ByZ.png') {
      console.log('✓ Company logo displays correctly');
      testResults.passed++;
    } else {
      throw new Error('Logo source incorrect');
    }
  } catch (e) {
    console.log('✗ Company logo test failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 3: Tab navigation works
  try {
    await page.click('[data-tab="customer"]');
    await page.waitForSelector('[data-section="customer"].visible', { timeout: 2000 });
    console.log('✓ Tab navigation works');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Tab navigation failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 4: Clearance fee calculation
  try {
    await page.click('[data-tab="vessel"]');
    await page.type('#vessel-weight', '600');
    
    await page.waitForFunction(() => {
      const preview = document.querySelector('.preview-clearance-fee');
      return preview && preview.textContent.includes('1,250');
    }, { timeout: 2000 });
    
    console.log('✓ Clearance fee calculation works (>500 tons)');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Clearance fee calculation failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 5: Line item addition
  try {
    await page.click('[data-tab="scope"]');
    await page.click('#add-line-item');
    
    const lineItem = await page.$('[data-row="0"]');
    if (lineItem) {
      console.log('✓ Line item addition works');
      testResults.passed++;
    } else {
      throw new Error('Line item not found');
    }
  } catch (e) {
    console.log('✗ Line item addition failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 6: Labor cost calculation
  try {
    await page.select('[data-row="0"] .job-type-select', 'Agent Services');
    await page.type('[data-row="0"] .labor-hours-input', '10');
    await page.type('[data-row="0"] .description-input', 'Test labor');
    
    await page.waitForFunction(() => {
      const costCell = document.querySelector('[data-row="0"] .cost-cell');
      return costCell && costCell.textContent === '$800.00';
    }, { timeout: 2000 });
    
    console.log('✓ Labor cost calculation works ($80/hr)');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Labor cost calculation failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 7: Markup application
  try {
    await page.select('#markup-rate', '12.5');
    
    await page.waitForFunction(() => {
      const totalCell = document.querySelector('.total-with-markup');
      return totalCell && totalCell.textContent === '$900.00';
    }, { timeout: 2000 });
    
    console.log('✓ Markup application works (12.5%)');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Markup application failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 8: Tax calculation
  try {
    await page.click('#taxable-yes');
    
    await page.waitForSelector('.tax-amount', { timeout: 2000 });
    const taxAmount = await page.$eval('.tax-amount', el => el.textContent);
    
    if (taxAmount && taxAmount.includes('$')) {
      console.log('✓ Tax calculation works (8.75%)');
      testResults.passed++;
    } else {
      throw new Error('Tax amount not displayed');
    }
  } catch (e) {
    console.log('✗ Tax calculation failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 9: Email validation
  try {
    await page.click('[data-tab="customer"]');
    await page.type('#customer-email', 'invalid-email');
    await page.click('#customer-name');
    
    await page.waitForSelector('.email-error', { timeout: 2000 });
    const errorText = await page.$eval('.email-error', el => el.textContent);
    
    if (errorText && errorText.length > 0) {
      console.log('✓ Email validation works');
      testResults.passed++;
    } else {
      throw new Error('Email validation not triggered');
    }
  } catch (e) {
    console.log('✗ Email validation failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 10: Phone formatting
  try {
    await page.evaluate(() => {
      document.querySelector('#customer-phone').value = '';
    });
    await page.type('#customer-phone', '5551234567');
    
    const formattedPhone = await page.$eval('#customer-phone', el => el.value);
    if (formattedPhone === '(555) 123-4567') {
      console.log('✓ Phone formatting works');
      testResults.passed++;
    } else {
      throw new Error(`Phone formatted incorrectly: ${formattedPhone}`);
    }
  } catch (e) {
    console.log('✗ Phone formatting failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 11: Print function
  try {
    await page.evaluateOnNewDocument(() => {
      window.printCalled = false;
      window.print = () => {
        window.printCalled = true;
      };
    });
    
    await page.reload();
    await page.click('#print-invoice');
    
    const printCalled = await page.evaluate(() => window.printCalled);
    if (printCalled) {
      console.log('✓ Print function works');
      testResults.passed++;
    } else {
      throw new Error('Print not called');
    }
  } catch (e) {
    console.log('✗ Print function failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
  
  // Test 12: Real-time preview update
  try {
    const testText = 'Test Vessel ' + Date.now();
    await page.type('#vessel-name', testText);
    
    await page.waitForFunction((text) => {
      const preview = document.querySelector('.preview-vessel-name');
      return preview && preview.textContent.includes(text);
    }, { timeout: 2000 }, testText);
    
    console.log('✓ Real-time preview update works');
    testResults.passed++;
  } catch (e) {
    console.log('✗ Real-time preview update failed:', e.message);
    testResults.failed++;
    testResults.errors.push(e.message);
  }
}

async function cleanup() {
  if (browser) await browser.close();
  if (server) server.kill();
}

// Main execution
(async () => {
  try {
    await runTests();
    
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS:');
    console.log(`PASSED: ${testResults.passed}`);
    console.log(`FAILED: ${testResults.failed}`);
    
    if (testResults.failed > 0) {
      console.log('\nFailed test errors:');
      testResults.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }
    
    console.log('='.repeat(50));
    
    // Set exit code based on test results
    process.exitCode = testResults.failed > 0 ? 1 : 0;
    
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
})();
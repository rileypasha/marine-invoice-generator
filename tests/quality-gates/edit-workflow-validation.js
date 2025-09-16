/**
 * Quality Gates for Invoice Edit Workflow
 *
 * Automated validation to prevent regression in edit functionality.
 * This runs as part of CI/CD pipeline to ensure edit operations
 * always update existing invoices instead of creating duplicates.
 */

const { chromium } = require('playwright');
const assert = require('assert');

class EditWorkflowValidator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      testsPassed: 0,
      testsFailed: 0,
      errors: [],
      metrics: {}
    };
  }

  async setup() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.page = await this.browser.newPage();

    // Setup request/response monitoring
    this.page.on('request', this.monitorRequests.bind(this));
    this.page.on('response', this.monitorResponses.bind(this));

    // Login to application
    await this.loginToApp();
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async loginToApp() {
    await this.page.goto(process.env.APP_URL || 'http://localhost:3000');

    await this.page.fill('[data-testid="email"]', 'test@marinegroup.com');
    await this.page.fill('[data-testid="name"]', 'Quality Gate Test User');
    await this.page.click('[data-testid="login-button"]');

    await this.page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  }

  monitorRequests(request) {
    // Track save/update requests
    if (request.url().includes('/api/') &&
        (request.method() === 'POST' || request.method() === 'PUT')) {
      console.log(`📤 ${request.method()} ${request.url()}`);
    }
  }

  monitorResponses(response) {
    // Track duplicate creation indicators
    if (response.url().includes('/api/invoice') && response.status() === 200) {
      console.log(`📥 ${response.status()} ${response.url()}`);
    }
  }

  async runTest(testName, testFunction) {
    try {
      console.log(`🧪 Running: ${testName}`);
      const startTime = Date.now();

      await testFunction();

      const duration = Date.now() - startTime;
      this.results.testsPassed++;
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);

      // Track performance metrics
      this.results.metrics[testName] = { duration, status: 'passed' };

    } catch (error) {
      this.results.testsFailed++;
      this.results.errors.push({ test: testName, error: error.message });
      console.log(`❌ FAILED: ${testName} - ${error.message}`);

      this.results.metrics[testName] = { status: 'failed', error: error.message };
    }
  }

  /**
   * CRITICAL TEST: Ensures edit operations don't create duplicates
   */
  async validateEditDoesNotCreateDuplicate() {
    // Step 1: Create initial invoice
    await this.page.fill('[data-testid="vessel-name"]', 'QG Test Vessel');
    await this.page.fill('[data-testid="customer-name"]', 'QG Test Customer');
    await this.page.click('[data-testid="add-line-item"]');
    await this.page.fill('[data-testid="line-item-description-0"]', 'Quality Gate Service');
    await this.page.fill('[data-testid="line-item-cost-0"]', '500');

    // Save initial invoice
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Get initial invoice count
    const initialCount = await this.getInvoiceCount();

    // Step 2: Edit the invoice
    const firstInvoiceSelector = '[data-testid="sidebar-invoice"]:first-child';
    await this.page.click(firstInvoiceSelector);
    await this.page.waitForSelector('[data-testid="invoice-loaded"]');

    // Modify data
    await this.page.fill('[data-testid="vessel-name"]', 'QG Updated Vessel');

    // Save changes
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Step 3: Critical validation - no duplicate created
    const finalCount = await this.getInvoiceCount();

    assert.strictEqual(
      finalCount,
      initialCount,
      `Edit operation created duplicate! Initial: ${initialCount}, Final: ${finalCount}`
    );

    // Verify updated data is shown
    const vesselNameValue = await this.page.inputValue('[data-testid="vessel-name"]');
    assert.strictEqual(
      vesselNameValue,
      'QG Updated Vessel',
      'Updated vessel name not reflected in form'
    );
  }

  /**
   * CRITICAL TEST: Validates ID preservation during edit
   */
  async validateIdPreservationDuringEdit() {
    // Create and save invoice
    await this.page.fill('[data-testid="vessel-name"]', 'ID Preservation Test');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Get original ID
    const originalId = await this.page.getAttribute('[data-testid="invoice-id"]', 'data-id');

    // Edit the invoice
    await this.page.click('[data-testid="sidebar-invoice"]:first-child');
    await this.page.waitForSelector('[data-testid="invoice-loaded"]');

    await this.page.fill('[data-testid="vessel-name"]', 'ID Preservation Updated');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Get ID after edit
    const updatedId = await this.page.getAttribute('[data-testid="invoice-id"]', 'data-id');

    assert.strictEqual(
      updatedId,
      originalId,
      `Invoice ID changed during edit! Original: ${originalId}, Updated: ${updatedId}`
    );
  }

  /**
   * PERFORMANCE TEST: Edit operations should be fast
   */
  async validateEditPerformance() {
    // Create invoice
    await this.page.fill('[data-testid="vessel-name"]', 'Performance Test Vessel');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Start timing
    const startTime = Date.now();

    // Load for editing
    await this.page.click('[data-testid="sidebar-invoice"]:first-child');
    await this.page.waitForSelector('[data-testid="invoice-loaded"]');

    // Make change and save
    await this.page.fill('[data-testid="vessel-name"]', 'Performance Updated');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    const duration = Date.now() - startTime;

    // Should complete within 3 seconds
    assert(
      duration < 3000,
      `Edit operation too slow: ${duration}ms (threshold: 3000ms)`
    );

    console.log(`⚡ Edit performance: ${duration}ms`);
  }

  /**
   * DATA INTEGRITY TEST: Metadata preservation
   */
  async validateMetadataPreservation() {
    // Create invoice with metadata
    await this.page.fill('[data-testid="vessel-name"]', 'Metadata Test Vessel');
    await this.page.fill('[data-testid="customer-name"]', 'Metadata Customer');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Get original timestamp via API
    const originalData = await this.page.evaluate(async () => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      const invoices = await response.json();
      return invoices.find(inv => inv.vesselName === 'Metadata Test Vessel');
    });

    // Edit the invoice
    await this.page.click('[data-testid="sidebar-invoice"]:first-child');
    await this.page.waitForSelector('[data-testid="invoice-loaded"]');

    await this.page.fill('[data-testid="vessel-name"]', 'Metadata Updated Vessel');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    // Get updated data
    const updatedData = await this.page.evaluate(async (originalId) => {
      const response = await fetch(`/api/v1/invoice/${originalId}`, { credentials: 'include' });
      return await response.json();
    }, originalData.id);

    // Validate metadata preservation
    assert.strictEqual(
      updatedData.id,
      originalData.id,
      'Invoice ID changed during edit'
    );

    assert.strictEqual(
      updatedData.createdAt,
      originalData.createdAt,
      'CreatedAt timestamp changed during edit'
    );

    assert.strictEqual(
      updatedData.userId,
      originalData.userId,
      'User ID changed during edit'
    );

    // UpdatedAt should be newer
    assert(
      new Date(updatedData.updatedAt) > new Date(originalData.updatedAt),
      'UpdatedAt timestamp not updated during edit'
    );
  }

  /**
   * ERROR HANDLING TEST: Network failure during edit
   */
  async validateNetworkFailureHandling() {
    // Create and load invoice
    await this.page.fill('[data-testid="vessel-name"]', 'Network Test Vessel');
    await this.page.click('[data-testid="save-invoice"]');
    await this.page.waitForSelector('[data-testid="save-success"]');

    await this.page.click('[data-testid="sidebar-invoice"]:first-child');
    await this.page.waitForSelector('[data-testid="invoice-loaded"]');

    // Modify data
    await this.page.fill('[data-testid="vessel-name"]', 'Network Failure Test');

    // Simulate network failure
    await this.page.route('/api/v1/invoice/**', route => {
      route.abort('failed');
    });

    // Try to save
    await this.page.click('[data-testid="save-invoice"]');

    // Should show error message, not success
    try {
      await this.page.waitForSelector('[data-testid="save-error"]', { timeout: 5000 });
      console.log('✅ Network failure properly handled');
    } catch (error) {
      throw new Error('Network failure not properly handled - no error message shown');
    }

    // Remove network block
    await this.page.unroute('/api/v1/invoice/**');
  }

  async getInvoiceCount() {
    return await this.page.evaluate(async () => {
      const response = await fetch('/api/invoices/user', { credentials: 'include' });
      const invoices = await response.json();
      return invoices.length;
    });
  }

  async generateReport() {
    const totalTests = this.results.testsPassed + this.results.testsFailed;
    const successRate = totalTests > 0 ? (this.results.testsPassed / totalTests) * 100 : 0;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passed: this.results.testsPassed,
        failed: this.results.testsFailed,
        successRate: `${successRate.toFixed(1)}%`
      },
      metrics: this.results.metrics,
      errors: this.results.errors,
      qualityGateStatus: successRate >= 100 ? 'PASS' : 'FAIL'
    };

    console.log('\n📊 QUALITY GATE REPORT');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${this.results.testsPassed}`);
    console.log(`Failed: ${this.results.testsFailed}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Quality Gate: ${report.qualityGateStatus}`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ FAILURES:');
      this.results.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }

    // Write report to file
    const fs = require('fs');
    const path = require('path');

    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportFile = path.join(reportsDir, `edit-workflow-quality-gate-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📄 Report saved: ${reportFile}`);

    return report;
  }

  async run() {
    try {
      await this.setup();

      // Run all quality gate tests
      await this.runTest(
        'Edit Does Not Create Duplicate',
        this.validateEditDoesNotCreateDuplicate.bind(this)
      );

      await this.runTest(
        'ID Preservation During Edit',
        this.validateIdPreservationDuringEdit.bind(this)
      );

      await this.runTest(
        'Edit Performance',
        this.validateEditPerformance.bind(this)
      );

      await this.runTest(
        'Metadata Preservation',
        this.validateMetadataPreservation.bind(this)
      );

      await this.runTest(
        'Network Failure Handling',
        this.validateNetworkFailureHandling.bind(this)
      );

      const report = await this.generateReport();

      return report;

    } finally {
      await this.teardown();
    }
  }
}

// CLI execution
if (require.main === module) {
  const validator = new EditWorkflowValidator();

  validator.run()
    .then(report => {
      const exitCode = report.qualityGateStatus === 'PASS' ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('❌ Quality gate execution failed:', error);
      process.exit(1);
    });
}

module.exports = EditWorkflowValidator;
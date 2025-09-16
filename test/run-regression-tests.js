#!/usr/bin/env node

/**
 * Invoice Save Regression Test Runner
 *
 * Orchestrates the execution of critical regression tests with proper
 * environment setup, error handling, and reporting.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class RegressionTestRunner {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      errors: []
    };
  }

  async run() {
    console.log('🧪 Invoice Save Regression Test Runner');
    console.log('=====================================\n');

    try {
      await this.validateEnvironment();
      await this.setupDatabase();
      await this.buildApplication();
      await this.startServer();
      await this.runCriticalTests();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    console.log('🔍 Validating environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`   Node.js: ${nodeVersion}`);

    // Check if required files exist
    const requiredFiles = [
      'package.json',
      'playwright.config.js',
      'test/e2e/invoice-save-regression.spec.js',
      'src/js/state/InvoiceState.js',
      'src/js/storage/InvoiceStorage.js'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check if Playwright is installed
    try {
      await this.runCommand('npx playwright --version');
      console.log('   ✅ Playwright installation verified');
    } catch (error) {
      throw new Error('Playwright not installed. Run: npx playwright install');
    }

    console.log('   ✅ Environment validation complete\n');
  }

  async setupDatabase() {
    console.log('🗄️  Setting up test database...');

    try {
      await this.runCommand('npm run prisma:generate');
      console.log('   ✅ Prisma client generated');

      await this.runCommand('npm run db:migrate');
      console.log('   ✅ Database migrations applied');
    } catch (error) {
      console.warn('   ⚠️  Database setup had issues, continuing...');
      console.warn(`      ${error.message}`);
    }

    console.log('   ✅ Database setup complete\n');
  }

  async buildApplication() {
    console.log('🏗️  Building application...');

    try {
      await this.runCommand('npm run build');
      console.log('   ✅ Application built');

      await this.runCommand('npm run build:css');
      console.log('   ✅ CSS built');
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }

    console.log('   ✅ Build complete\n');
  }

  async startServer() {
    console.log('🚀 Starting test server...');

    // Start server in background
    this.serverProcess = spawn('npm', ['run', 'server:dev'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Wait for server to be ready
    await this.waitForServer();
    console.log('   ✅ Server started and ready\n');
  }

  async waitForServer() {
    const maxAttempts = 30;
    const interval = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.runCommand('curl -f http://localhost:3000/health');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error('Server failed to start within timeout');
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }

  async runCriticalTests() {
    console.log('🎯 Running critical regression tests...\n');

    const testSuites = [
      {
        name: 'Core Regression Tests',
        command: 'npm run test:e2e:regression',
        critical: true
      },
      {
        name: 'Unit Tests (Save Logic)',
        command: 'npm run test:unit',
        critical: true
      },
      {
        name: 'Performance Tests',
        command: 'npm run test:performance',
        critical: false
      }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }
  }

  async runTestSuite(suite) {
    console.log(`   🧪 ${suite.name}...`);
    const startTime = Date.now();

    try {
      const result = await this.runCommand(suite.command, {
        capture: true,
        timeout: 300000 // 5 minutes
      });

      const duration = Date.now() - startTime;
      console.log(`   ✅ ${suite.name} passed (${duration}ms)`);

      this.testResults.passed++;
      this.testResults.duration += duration;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   ❌ ${suite.name} failed (${duration}ms)`);
      console.log(`      Error: ${error.message}`);

      this.testResults.failed++;
      this.testResults.duration += duration;
      this.testResults.errors.push({
        suite: suite.name,
        error: error.message,
        critical: suite.critical
      });

      if (suite.critical) {
        throw new Error(`Critical test suite failed: ${suite.name}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');

    const total = this.testResults.passed + this.testResults.failed + this.testResults.skipped;
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${this.testResults.passed} ✅`);
    console.log(`Failed: ${this.testResults.failed} ❌`);
    console.log(`Skipped: ${this.testResults.skipped} ⏭️`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Duration: ${this.testResults.duration}ms`);

    if (this.testResults.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults.errors.forEach(error => {
        console.log(`   - ${error.suite}: ${error.error}`);
      });
    }

    // Generate detailed report file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        skipped: this.testResults.skipped,
        successRate: parseFloat(successRate),
        duration: this.testResults.duration
      },
      errors: this.testResults.errors,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        ci: !!process.env.CI
      }
    };

    const reportPath = path.join(__dirname, 'regression-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Check for critical failures
    const criticalFailures = this.testResults.errors.filter(e => e.critical);
    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL FAILURES DETECTED');
      console.log('Deployment should be blocked!');
      throw new Error('Critical regression tests failed');
    }

    console.log('\n✅ All critical tests passed - Safe to deploy!');
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: options.capture ? 'pipe' : 'inherit',
        shell: true,
        ...options
      });

      let output = '';
      let error = '';

      if (options.capture) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          error += data.toString();
        });
      }

      const timeout = options.timeout ? setTimeout(() => {
        child.kill();
        reject(new Error(`Command timeout: ${command}`));
      }, options.timeout) : null;

      child.on('close', (code) => {
        if (timeout) clearTimeout(timeout);

        if (code === 0) {
          resolve(options.capture ? { output, error } : null);
        } else {
          reject(new Error(error || `Command failed with code ${code}: ${command}`));
        }
      });

      child.on('error', (err) => {
        if (timeout) clearTimeout(timeout);
        reject(err);
      });
    });
  }

  cleanup() {
    if (this.serverProcess) {
      console.log('🧹 Cleaning up server process...');
      this.serverProcess.kill();
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received interrupt signal');
  if (global.testRunner) {
    global.testRunner.cleanup();
  }
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received terminate signal');
  if (global.testRunner) {
    global.testRunner.cleanup();
  }
  process.exit(1);
});

// Main execution
if (require.main === module) {
  const runner = new RegressionTestRunner();
  global.testRunner = runner;

  runner.run()
    .then(() => {
      runner.cleanup();
      console.log('\n🎉 Regression test run completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      runner.cleanup();
      console.error('\n💥 Regression test run failed:', error.message);
      process.exit(1);
    });
}

module.exports = RegressionTestRunner;
#!/usr/bin/env node

/**
 * CSV Export Health Monitor
 * Continuously monitors the health of CSV export functionality
 */

const https = require('https');

const config = {
  baseUrl: 'https://marine-invoice-generator.onrender.com',
  testInvoiceId: 'inv_1756271771724_geg1fza0e',
  checkInterval: 60000, // Check every minute
  sessionCookie: process.env.SESSION_COOKIE || ''
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${colors[color]}${message}${colors.reset}`);
}

class ExportMonitor {
  constructor() {
    this.stats = {
      totalChecks: 0,
      successful: 0,
      failed: 0,
      errors: {},
      lastSuccess: null,
      lastFailure: null,
      avgResponseTime: 0,
      responseTimes: []
    };
  }

  async testDiagnosticEndpoint() {
    return new Promise((resolve) => {
      const url = `${config.baseUrl}/api/master/test-export/${config.testInvoiceId}`;
      
      https.get(url, {
        headers: {
          'Cookie': config.sessionCookie,
          'Accept': 'application/json'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const result = JSON.parse(data);
            const allTestsPassed = Object.values(result.tests).every(test => test.success);
            
            resolve({
              success: response.statusCode === 200 && allTestsPassed,
              statusCode: response.statusCode,
              tests: result.tests,
              details: result
            });
          } catch (e) {
            resolve({
              success: false,
              error: 'Failed to parse response',
              statusCode: response.statusCode,
              body: data.substring(0, 200)
            });
          }
        });
      }).on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
    });
  }

  async testCSVExport() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = `${config.baseUrl}/api/master/invoices/${config.testInvoiceId}/export.csv`;
      
      https.get(url, {
        headers: {
          'Cookie': config.sessionCookie,
          'Accept': 'text/csv'
        }
      }, (response) => {
        const responseTime = Date.now() - startTime;
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const isCSV = response.headers['content-type']?.includes('text/csv');
          const hasContent = data.length > 100;
          const success = response.statusCode === 200 && isCSV && hasContent;
          
          resolve({
            success,
            statusCode: response.statusCode,
            responseTime,
            contentType: response.headers['content-type'],
            contentLength: data.length,
            error: success ? null : (data.includes('error') ? data : 'Invalid response')
          });
        });
      }).on('error', (error) => {
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          error: error.message
        });
      });
    });
  }

  updateStats(result, responseTime) {
    this.stats.totalChecks++;
    
    if (result.success) {
      this.stats.successful++;
      this.stats.lastSuccess = new Date().toISOString();
    } else {
      this.stats.failed++;
      this.stats.lastFailure = new Date().toISOString();
      const errorKey = result.error || result.statusCode || 'unknown';
      this.stats.errors[errorKey] = (this.stats.errors[errorKey] || 0) + 1;
    }
    
    if (responseTime) {
      this.stats.responseTimes.push(responseTime);
      if (this.stats.responseTimes.length > 100) {
        this.stats.responseTimes.shift(); // Keep only last 100
      }
      this.stats.avgResponseTime = 
        this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
    }
  }

  printStats() {
    const successRate = this.stats.totalChecks > 0 
      ? ((this.stats.successful / this.stats.totalChecks) * 100).toFixed(2)
      : 0;
    
    console.log('\n' + '='.repeat(60));
    log('📊 CSV Export Health Statistics', 'cyan');
    console.log('='.repeat(60));
    
    log(`Total Checks: ${this.stats.totalChecks}`, 'blue');
    log(`✅ Successful: ${this.stats.successful}`, 'green');
    log(`❌ Failed: ${this.stats.failed}`, this.stats.failed > 0 ? 'red' : 'green');
    log(`Success Rate: ${successRate}%`, successRate >= 99 ? 'green' : 'yellow');
    log(`Avg Response Time: ${Math.round(this.stats.avgResponseTime)}ms`, 'blue');
    
    if (this.stats.lastSuccess) {
      log(`Last Success: ${this.stats.lastSuccess}`, 'green');
    }
    
    if (this.stats.lastFailure) {
      log(`Last Failure: ${this.stats.lastFailure}`, 'red');
    }
    
    if (Object.keys(this.stats.errors).length > 0) {
      log('\nError Distribution:', 'yellow');
      for (const [error, count] of Object.entries(this.stats.errors)) {
        console.log(`  ${error}: ${count} occurrences`);
      }
    }
    
    console.log('='.repeat(60));
  }

  async runCheck() {
    this.stats.totalChecks++;
    log(`\nCheck #${this.stats.totalChecks}`, 'cyan');
    
    // First test the diagnostic endpoint
    log('Testing diagnostic endpoint...', 'blue');
    const diagnostic = await this.testDiagnosticEndpoint();
    
    if (diagnostic.success) {
      log('✓ Diagnostic tests passed', 'green');
    } else {
      log('✗ Diagnostic tests failed', 'red');
      if (diagnostic.tests) {
        for (const [name, test] of Object.entries(diagnostic.tests)) {
          if (!test.success) {
            log(`  - ${name}: ${test.error}`, 'red');
          }
        }
      }
    }
    
    // Then test actual CSV export
    log('Testing CSV export...', 'blue');
    const exportResult = await this.testCSVExport();
    
    if (exportResult.success) {
      log(`✓ CSV export successful (${exportResult.responseTime}ms)`, 'green');
      log(`  Content: ${exportResult.contentLength} bytes`, 'green');
    } else {
      log(`✗ CSV export failed: ${exportResult.error || exportResult.statusCode}`, 'red');
    }
    
    this.updateStats(exportResult, exportResult.responseTime);
    
    // Print stats every 10 checks
    if (this.stats.totalChecks % 10 === 0) {
      this.printStats();
    }
    
    // Alert if failure rate is high
    if (this.stats.totalChecks >= 5 && this.stats.failed > this.stats.successful * 0.1) {
      log('⚠️  HIGH FAILURE RATE DETECTED!', 'red');
    }
  }

  start() {
    log('🚀 CSV Export Monitor Started', 'cyan');
    log(`Monitoring: ${config.baseUrl}`, 'blue');
    log(`Test Invoice: ${config.testInvoiceId}`, 'blue');
    log(`Check Interval: ${config.checkInterval / 1000} seconds`, 'blue');
    
    if (!config.sessionCookie) {
      log('⚠️  No session cookie provided. Set SESSION_COOKIE environment variable.', 'yellow');
    }
    
    // Run initial check
    this.runCheck();
    
    // Schedule periodic checks
    setInterval(() => {
      this.runCheck();
    }, config.checkInterval);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('\n👋 Shutting down monitor...', 'cyan');
      this.printStats();
      process.exit(0);
    });
  }
}

// Start the monitor
const monitor = new ExportMonitor();
monitor.start();
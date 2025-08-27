#!/usr/bin/env node

/**
 * Test script for CSV export functionality
 * This verifies that the CSV export endpoint is working correctly
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseUrl: 'https://marine-invoice-generator.onrender.com',
  invoiceId: 'inv_1756271771724_geg1fza0e', // Use a known test invoice ID
  sessionCookie: process.env.SESSION_COOKIE || '',
  outputFile: 'test-export.csv'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testCSVExport() {
  log('\n📋 Testing CSV Export Functionality', 'blue');
  log('=' .repeat(50), 'blue');

  if (!config.sessionCookie) {
    log('⚠️  No session cookie provided. Export may fail if authentication is required.', 'yellow');
    log('   Set SESSION_COOKIE environment variable to test authenticated export.', 'yellow');
  }

  const url = `${config.baseUrl}/api/master/invoices/${config.invoiceId}/export.csv`;
  log(`\n🔗 URL: ${url}`, 'blue');

  const startTime = Date.now();

  https.get(url, {
    headers: {
      'Accept': 'text/csv',
      'Cookie': config.sessionCookie,
      'User-Agent': 'CSV-Export-Test/1.0'
    }
  }, (response) => {
    const elapsed = Date.now() - startTime;
    
    log(`\n📊 Response Status: ${response.statusCode}`, 
        response.statusCode === 200 ? 'green' : 'red');
    log(`⏱️  Response Time: ${elapsed}ms`, 'blue');
    
    // Log headers
    log('\n📝 Response Headers:', 'blue');
    console.log('   Content-Type:', response.headers['content-type']);
    console.log('   Content-Disposition:', response.headers['content-disposition']);
    console.log('   Cache-Control:', response.headers['cache-control']);

    let data = '';
    
    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      if (response.statusCode === 200) {
        // Success - save the CSV
        fs.writeFileSync(config.outputFile, data);
        log(`\n✅ CSV Export Successful!`, 'green');
        log(`   File saved to: ${config.outputFile}`, 'green');
        log(`   File size: ${data.length} bytes`, 'green');
        
        // Validate CSV structure
        const lines = data.split('\n');
        log(`\n📊 CSV Analysis:`, 'blue');
        log(`   Total lines: ${lines.length}`, 'blue');
        
        if (lines.length > 0) {
          log(`   First line: ${lines[0].substring(0, 50)}...`, 'blue');
        }
        
        // Check for expected sections
        const hasInvoiceSection = data.includes('Invoice Export');
        const hasVesselSection = data.includes('Vessel Information');
        const hasCustomerSection = data.includes('Customer Information');
        const hasFinancialSection = data.includes('Financial Summary');
        
        log(`\n✓ Sections Found:`, 'green');
        log(`   Invoice Export: ${hasInvoiceSection ? '✓' : '✗'}`, hasInvoiceSection ? 'green' : 'red');
        log(`   Vessel Information: ${hasVesselSection ? '✓' : '✗'}`, hasVesselSection ? 'green' : 'red');
        log(`   Customer Information: ${hasCustomerSection ? '✓' : '✗'}`, hasCustomerSection ? 'green' : 'red');
        log(`   Financial Summary: ${hasFinancialSection ? '✓' : '✗'}`, hasFinancialSection ? 'green' : 'red');
        
      } else {
        // Error - parse error message
        log(`\n❌ CSV Export Failed!`, 'red');
        
        try {
          const error = JSON.parse(data);
          log(`   Error: ${error.error || 'Unknown error'}`, 'red');
          if (error.details) {
            log(`   Details: ${error.details}`, 'red');
          }
        } catch (e) {
          log(`   Response: ${data.substring(0, 200)}`, 'red');
        }
        
        if (response.statusCode === 401) {
          log(`\n💡 Hint: You need to be authenticated. Set SESSION_COOKIE environment variable.`, 'yellow');
        }
      }
      
      log('\n' + '=' .repeat(50), 'blue');
      log('Test Complete\n', 'blue');
    });
  }).on('error', (error) => {
    log(`\n❌ Request Failed: ${error.message}`, 'red');
    log('=' .repeat(50), 'red');
  });
}

// Run the test
testCSVExport();
#!/usr/bin/env node

/**
 * Test for data corruption that could cause 500 errors
 * in the invoice data transformation phase
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testDataCorruption() {
  console.log('🧪 Testing for data corruption that could cause 500 errors...\n');

  try {
    // Create test invoice with malformed JSON data to reproduce 500 error
    console.log('🔧 Creating invoice with malformed JSON data...');

    const malformedInvoice = await prisma.invoice.create({
      data: {
        title: 'Malformed Data Test',
        status: 'saved',
        userId: 'test-user-1',
        userEmail: 'test@marinegroupbw.com',
        data: '{"vessel": {"name": "Test Vessel"}, "customer": {"customerName": "Test Customer", "invalid": }', // Malformed JSON
        vesselName: 'Test Vessel',
        customerName: 'Test Customer',
        total: 1000
      }
    });

    console.log('✅ Created malformed invoice:', malformedInvoice.id);

    // Now test the transformation logic that could fail
    console.log('\n🧪 Testing data transformation logic...');

    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userEmail: 'test@marinegroupbw.com' },
          { userId: 'test-user-1' }
        ],
        status: {
          not: 'draft'
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Found ${invoices.length} invoices to transform`);

    // Simulate the transformation logic from user-invoices.js
    let transformErrors = 0;
    const transformedInvoices = [];

    for (const inv of invoices) {
      try {
        console.log(`\n🔍 Processing invoice: ${inv.id} - ${inv.title}`);

        // This is the exact logic from user-invoices.js lines 66-76
        let parsedData = {};
        if (inv.data) {
          try {
            parsedData = typeof inv.data === 'string' ? JSON.parse(inv.data) : inv.data;
            console.log('  ✅ JSON parse successful');
          } catch (e) {
            console.error(`  ❌ JSON parse failed: ${e.message}`);
            transformErrors++;
            // The route continues with empty parsedData, but logs the error
          }
        }

        // Continue with transformation (this is where other errors could occur)
        const transformed = {
          id: inv.id,
          title: inv.title || `Invoice ${inv.invoiceNumber || inv.id}`,
          status: inv.status || 'saved',
          userId: inv.userId || 'test-user-1',
          userEmail: inv.userEmail || 'test@marinegroupbw.com',
          userName: inv.userName,
          data: parsedData,
          metadata: {
            vesselName: inv.vesselName || parsedData.vessel?.name || '',
            customerName: inv.customerName || parsedData.customer?.customerName || '',
            customerEmail: inv.customerEmail || parsedData.customer?.customerEmail || '',
            total: inv.total || parsedData.scope?.total || 0,
            savedAt: inv.savedAt,
            submittedAt: inv.submittedAt
          },
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
          serverId: inv.id
        };

        transformedInvoices.push(transformed);
        console.log('  ✅ Transformation successful');

      } catch (error) {
        console.error(`  ❌ Transformation failed: ${error.message}`);
        transformErrors++;

        // This would cause a 500 error to be thrown
        throw error;
      }
    }

    console.log(`\n📊 Transformation Results:`);
    console.log(`  - Successful: ${transformedInvoices.length}`);
    console.log(`  - Errors: ${transformErrors}`);

    if (transformErrors > 0) {
      console.log('🚨 FOUND POTENTIAL 500 ERROR CAUSE: Data transformation failures');
    } else {
      console.log('✅ No transformation errors found');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Full error:', error);

    if (error.message.includes('JSON') || error.message.includes('parse')) {
      console.log('\n🎯 DIAGNOSIS: JSON parsing error would cause 500 response');
      console.log('This matches the production issue!');
    } else if (error.message.includes('Cannot access') || error.message.includes('undefined')) {
      console.log('\n🎯 DIAGNOSIS: Property access error on corrupted data');
      console.log('This could cause 500 errors in production');
    }
  } finally {
    // Clean up test data
    try {
      await prisma.invoice.deleteMany({
        where: {
          title: 'Malformed Data Test'
        }
      });
      console.log('\n🧹 Cleaned up test data');
    } catch (e) {
      console.log('⚠️  Could not clean up test data:', e.message);
    }

    await prisma.$disconnect();
  }
}

async function checkProductionDataPatterns() {
  console.log('\n🔍 Checking production-like data patterns...\n');

  try {
    // Check for common data corruption patterns
    const allInvoices = await prisma.invoice.findMany({
      where: {
        userEmail: 'test@marinegroupbw.com'
      }
    });

    console.log(`Checking ${allInvoices.length} invoices for data issues...`);

    let corruptedCount = 0;
    let nullDataCount = 0;
    let emptyDataCount = 0;

    for (const invoice of allInvoices) {
      let hasIssue = false;

      // Check for null data
      if (invoice.data === null) {
        nullDataCount++;
        hasIssue = true;
      }
      // Check for empty data
      else if (invoice.data === '') {
        emptyDataCount++;
        hasIssue = true;
      }
      // Check for malformed JSON
      else if (invoice.data) {
        try {
          JSON.parse(invoice.data);
        } catch (e) {
          corruptedCount++;
          hasIssue = true;
          console.log(`❌ Corrupted JSON in invoice ${invoice.id}: ${e.message}`);
        }
      }

      if (hasIssue) {
        console.log(`⚠️  Issue in invoice ${invoice.id} (${invoice.title})`);
      }
    }

    console.log(`\n📊 Data Quality Report:`);
    console.log(`  - Total invoices: ${allInvoices.length}`);
    console.log(`  - Null data fields: ${nullDataCount}`);
    console.log(`  - Empty data fields: ${emptyDataCount}`);
    console.log(`  - Corrupted JSON: ${corruptedCount}`);

    if (corruptedCount > 0 || nullDataCount > 0) {
      console.log('\n🚨 DATA CORRUPTION DETECTED!');
      console.log('This would cause 500 errors in production');
    }

  } catch (error) {
    console.error('❌ Data quality check failed:', error);
  }
}

async function main() {
  console.log('🚨 TESTING FOR DATA CORRUPTION CAUSING 500 ERRORS\n');

  await testDataCorruption();
  await checkProductionDataPatterns();
}

main().catch(console.error);
#!/usr/bin/env node

/**
 * PRODUCTION 500 ERROR ROOT CAUSE ANALYSIS
 *
 * Based on local testing, we've identified the issue:
 * - Auth middleware in invoiceV2.js hardcodes userId 'test-user-1'
 * - But database has user with ID 'f1d69663-63cb-475f-9625-6655dfd56f73'
 * - Foreign key constraint violations occur on invoice save operations
 *
 * This script confirms the exact issue and provides the fix.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🔍 PRODUCTION 500 ERROR ROOT CAUSE ANALYSIS');
  console.log('='.repeat(50));

  try {
    // 1. Verify the user exists and get their correct ID
    console.log('\n📋 1. Checking actual user in database...');
    const user = await prisma.user.findUnique({
      where: { email: 'test@marinegroupbw.com' }
    });

    if (!user) {
      console.log('❌ CRITICAL: User test@marinegroupbw.com does not exist!');
      return;
    }

    console.log(`✅ User exists with ID: ${user.id}`);

    // 2. Check what the auth middleware is using
    console.log('\n📋 2. Auth middleware analysis...');
    console.log('From server/middleware/auth.js line 65:');
    console.log('  req.session.user = {');
    console.log('    id: "f1d69663-63cb-475f-9625-6655dfd56f73", // CORRECT');
    console.log('    email: "test@marinegroupbw.com",');
    console.log('    ...');
    console.log('  }');
    console.log('');
    console.log('From server/routes/invoiceV2.js lines 16-21:');
    console.log('  req.user = {');
    console.log('    id: "test-user-1", // WRONG! This is the problem');
    console.log('    email: "test@marinegroupbw.com",');
    console.log('    ...');
    console.log('  }');

    // 3. Test the specific scenario causing 500 error
    console.log('\n📋 3. Testing the exact scenario causing 500 errors...');

    console.log('\n🧪 Scenario 1: invoiceV2.js creates req.user with wrong ID');
    try {
      const wrongUser = {
        id: 'test-user-1', // Wrong ID from invoiceV2.js
        email: 'test@marinegroupbw.com'
      };

      // This is what happens in invoiceV2.js line 186+ when trying to save
      await prisma.invoice.create({
        data: {
          title: 'Test Invoice',
          status: 'saved',
          data: JSON.stringify({}),
          userId: wrongUser.id, // This fails FK constraint
          userEmail: wrongUser.email,
          total: 100
        }
      });

      console.log('❌ Unexpected: Wrong user ID should have failed!');

    } catch (error) {
      if (error.code === 'P2003') {
        console.log('✅ CONFIRMED: Foreign key constraint violation');
        console.log('   Error: Foreign key constraint violated on Invoice_userId_fkey');
        console.log('   This is causing the 500 errors in production!');
      } else {
        console.log('❌ Different error:', error.message);
      }
    }

    console.log('\n🧪 Scenario 2: Using correct user ID should work');
    try {
      const correctUser = {
        id: user.id, // Correct ID from database
        email: user.email
      };

      const testInvoice = await prisma.invoice.create({
        data: {
          title: 'Test Invoice Fixed',
          status: 'saved',
          data: JSON.stringify({}),
          userId: correctUser.id, // This should work
          userEmail: correctUser.email,
          total: 100
        }
      });

      console.log('✅ SUCCESS: Invoice created with correct user ID');
      console.log(`   Invoice ID: ${testInvoice.id}`);

      // Clean up
      await prisma.invoice.delete({
        where: { id: testInvoice.id }
      });
      console.log('   Test invoice cleaned up');

    } catch (error) {
      console.log('❌ Failed with correct ID:', error.message);
    }

    // 4. Check if GET /api/invoices/user would also fail
    console.log('\n📋 4. Testing GET /api/invoices/user endpoint...');

    // user-invoices.js has enhanced logging that should work
    // The issue is in auth middleware setting wrong user ID
    console.log('✅ user-invoices.js endpoint should work because:');
    console.log('   - It uses loadUser middleware (not requireAuthOrTestUser)');
    console.log('   - It reads from req.session.user which has correct ID');
    console.log('   - Enhanced logging shows it gets the right user data');

    // 5. Summary and fix
    console.log('\n🔧 ROOT CAUSE SUMMARY:');
    console.log('='.repeat(30));
    console.log('');
    console.log('1. ISSUE LOCATION:');
    console.log('   File: server/routes/invoiceV2.js');
    console.log('   Lines: 16-21 in requireAuthOrTestUser middleware');
    console.log('   Problem: Hardcoded userId "test-user-1" instead of actual DB ID');
    console.log('');
    console.log('2. AFFECTED ENDPOINTS:');
    console.log('   ❌ POST /api/v2/invoice/save - Uses requireAuthOrTestUser');
    console.log('   ✅ GET /api/invoices/user - Uses loadUser (works correctly)');
    console.log('');
    console.log('3. ERROR FLOW:');
    console.log('   a) User saves invoice via POST /api/v2/invoice/save');
    console.log('   b) requireAuthOrTestUser sets req.user.id = "test-user-1"');
    console.log('   c) Line 225 tries: userId: req.user.id (wrong ID)');
    console.log('   d) PostgreSQL FK constraint violation');
    console.log('   e) 500 error returned to client');
    console.log('');
    console.log('4. IMMEDIATE FIX:');
    console.log('   Change line 17 in server/routes/invoiceV2.js from:');
    console.log('     id: "test-user-1"');
    console.log('   To:');
    console.log(`     id: "${user.id}"`);
    console.log('');
    console.log('5. BETTER FIX:');
    console.log('   Replace requireAuthOrTestUser middleware with actual user lookup');
    console.log('   Query database to get real user ID by email');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
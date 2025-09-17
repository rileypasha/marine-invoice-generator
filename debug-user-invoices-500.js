#!/usr/bin/env node

/**
 * Debug script for investigating 500 error on /api/invoices/user endpoint
 *
 * Issue: User test@marinegroupbw.com (ID: f1d69663-63cb-475f-9625-6655dfd56f73)
 * cannot retrieve invoices - getting 500 error
 *
 * Investigation areas:
 * 1. Check if user exists in database
 * 2. Check if invoices exist for this user
 * 3. Verify userId format issues
 * 4. Test auth middleware behavior
 * 5. Test the actual query that's failing
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🔍 Starting investigation for user invoice 500 error...\n');

  const targetUserEmail = 'test@marinegroupbw.com';
  const targetUserId = 'f1d69663-63cb-475f-9625-6655dfd56f73';

  try {
    // 1. Check if user exists in Users table
    console.log('📋 1. Checking if user exists in Users table...');
    const user = await prisma.user.findUnique({
      where: { email: targetUserEmail }
    });

    console.log('User record:', user);

    if (!user) {
      console.log('⚠️  User not found in Users table');
    } else {
      console.log(`✅ User found with ID: ${user.id}`);
      if (user.id !== targetUserId) {
        console.log(`🔴 USER ID MISMATCH! Database has ${user.id}, but issue reports ${targetUserId}`);
      }
    }

    console.log('\n📋 2. Checking invoices by email...');
    // 2. Check invoices by email
    const invoicesByEmail = await prisma.invoice.findMany({
      where: { userEmail: targetUserEmail },
      select: {
        id: true,
        title: true,
        status: true,
        userId: true,
        userEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`Found ${invoicesByEmail.length} invoices by email`);
    invoicesByEmail.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. ID: ${inv.id}, Title: ${inv.title}, Status: ${inv.status}, UserID: ${inv.userId}`);
    });

    console.log('\n📋 3. Checking invoices by reported user ID...');
    // 3. Check invoices by reported user ID
    const invoicesByReportedId = await prisma.invoice.findMany({
      where: { userId: targetUserId },
      select: {
        id: true,
        title: true,
        status: true,
        userId: true,
        userEmail: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`Found ${invoicesByReportedId.length} invoices by reported user ID`);
    invoicesByReportedId.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. ID: ${inv.id}, Title: ${inv.title}, Status: ${inv.status}, UserID: ${inv.userId}`);
    });

    console.log('\n📋 4. Checking invoices by database user ID (if different)...');
    if (user && user.id !== targetUserId) {
      const invoicesByDbId = await prisma.invoice.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          title: true,
          status: true,
          userId: true,
          userEmail: true,
          createdAt: true,
          updatedAt: true
        }
      });

      console.log(`Found ${invoicesByDbId.length} invoices by database user ID`);
      invoicesByDbId.forEach((inv, idx) => {
        console.log(`  ${idx + 1}. ID: ${inv.id}, Title: ${inv.title}, Status: ${inv.status}, UserID: ${inv.userId}`);
      });
    }

    console.log('\n📋 5. Testing the exact query from user-invoices.js...');
    // 5. Simulate the exact query from the user-invoices route

    // Test with auth middleware fallback user ID (test-user-1)
    console.log('\n🧪 Testing with auth fallback ID (test-user-1)...');
    const fallbackUserId = 'test-user-1';
    const whereConditions = [];

    if (targetUserEmail) {
      whereConditions.push({ userEmail: targetUserEmail });
    }

    if (fallbackUserId) {
      whereConditions.push({ userId: fallbackUserId });
      if (typeof fallbackUserId !== 'string') {
        whereConditions.push({ userId: fallbackUserId.toString() });
      }
    }

    console.log('Query conditions:', whereConditions);

    try {
      const testInvoices = await prisma.invoice.findMany({
        where: {
          OR: whereConditions,
          status: {
            not: 'draft'
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      console.log(`✅ Query successful: Found ${testInvoices.length} invoices`);

      // Check if any invoices have problematic data fields
      for (const invoice of testInvoices) {
        try {
          if (invoice.data) {
            const parsed = typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data;
            console.log(`  📄 Invoice ${invoice.id}: data field parsed successfully`);
          }
        } catch (e) {
          console.log(`  ❌ Invoice ${invoice.id}: data field parse error - ${e.message}`);
        }
      }

    } catch (error) {
      console.log(`❌ Query failed: ${error.message}`);
      console.log('Full error:', error);
    }

    console.log('\n📋 6. Checking for draft status issues...');
    // 6. Check if there are draft invoices that might be causing issues
    const draftInvoices = await prisma.invoice.findMany({
      where: {
        userEmail: targetUserEmail,
        status: 'draft'
      },
      select: {
        id: true,
        title: true,
        status: true,
        userId: true,
        data: true
      }
    });

    console.log(`Found ${draftInvoices.length} draft invoices`);

    console.log('\n📋 7. Checking for data parsing issues...');
    // 7. Check all invoices for data parsing issues
    const allUserInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userEmail: targetUserEmail },
          { userId: targetUserId },
          { userId: user?.id || 'no-db-user' },
          { userId: 'test-user-1' }
        ]
      }
    });

    console.log(`\nTotal invoices found across all user identifiers: ${allUserInvoices.length}`);

    let dataParseErrors = 0;
    allUserInvoices.forEach((invoice, idx) => {
      try {
        if (invoice.data) {
          const parsed = typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data;
        }
      } catch (e) {
        dataParseErrors++;
        console.log(`❌ Invoice ${invoice.id} has invalid JSON data: ${e.message}`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`  - User in database: ${user ? 'YES' : 'NO'}`);
    console.log(`  - Database user ID: ${user?.id || 'N/A'}`);
    console.log(`  - Reported user ID: ${targetUserId}`);
    console.log(`  - ID mismatch: ${user && user.id !== targetUserId ? 'YES - CRITICAL ISSUE!' : 'NO'}`);
    console.log(`  - Invoices by email: ${invoicesByEmail.length}`);
    console.log(`  - Invoices by reported ID: ${invoicesByReportedId.length}`);
    console.log(`  - Data parse errors: ${dataParseErrors}`);
    console.log(`  - Draft invoices: ${draftInvoices.length}`);

    if (user && user.id !== targetUserId) {
      console.log(`\n🚨 CRITICAL FINDING:`);
      console.log(`   The auth middleware creates sessions with userId 'test-user-1'`);
      console.log(`   But the actual user in database has ID '${user.id}'`);
      console.log(`   This mismatch would cause the query to return no results!`);
    }

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
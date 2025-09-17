#!/usr/bin/env node

/**
 * Diagnose foreign key constraint issue that could cause 500 errors
 *
 * The auth middleware creates sessions with userId 'test-user-1'
 * but if no user exists with that ID, invoice operations will fail
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function diagnoseForeignKeyIssue() {
  console.log('🚨 DIAGNOSING FOREIGN KEY CONSTRAINT ISSUE\n');

  try {
    // 1. Check what user IDs exist in the Users table
    console.log('📋 1. Checking existing users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    console.log(`Found ${users.length} users in database:`);
    users.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
    });

    // 2. Check what user IDs are referenced in invoices
    console.log('\n📋 2. Checking user IDs referenced in invoices...');
    const invoiceUserIds = await prisma.invoice.findMany({
      select: {
        userId: true,
        userEmail: true,
        title: true
      },
      distinct: ['userId']
    });

    console.log(`Found ${invoiceUserIds.length} distinct user IDs in invoices:`);
    invoiceUserIds.forEach((inv, idx) => {
      const userExists = users.find(u => u.id === inv.userId);
      const status = userExists ? '✅ EXISTS' : '❌ MISSING';
      console.log(`  ${idx + 1}. UserID: ${inv.userId}, Email: ${inv.userEmail} - ${status}`);
    });

    // 3. Test the exact scenario from auth middleware
    console.log('\n📋 3. Testing auth middleware scenario...');
    const authMiddlewareUserId = 'test-user-1'; // From auth.js line 65
    const userExists = users.find(u => u.id === authMiddlewareUserId);

    console.log(`Auth middleware would set userId to: ${authMiddlewareUserId}`);
    console.log(`User exists in database: ${userExists ? '✅ YES' : '❌ NO'}`);

    if (!userExists) {
      console.log('🚨 CRITICAL ISSUE FOUND!');
      console.log('   The auth middleware creates sessions with userId "test-user-1"');
      console.log('   But no user exists with that ID in the Users table');
      console.log('   This would cause foreign key constraint violations when:');
      console.log('   - Saving invoices (if invoice.userId is required)');
      console.log('   - Updating invoices with user references');
      console.log('   - Any operation that enforces the foreign key');
    }

    // 4. Test what happens when we try to save an invoice with wrong user ID
    console.log('\n📋 4. Testing invoice save with auth middleware user ID...');

    try {
      const testInvoice = await prisma.invoice.create({
        data: {
          title: 'FK Test Invoice',
          status: 'saved',
          userId: authMiddlewareUserId, // This will fail if FK is enforced
          userEmail: 'test@marinegroupbw.com',
          data: JSON.stringify({ test: 'data' }),
          total: 100
        }
      });

      console.log('✅ Invoice creation succeeded:', testInvoice.id);

      // Clean up
      await prisma.invoice.delete({
        where: { id: testInvoice.id }
      });

    } catch (error) {
      console.log('❌ Invoice creation failed:', error.message);

      if (error.code === 'P2003') {
        console.log('🎯 CONFIRMED: Foreign key constraint violation!');
        console.log('   This is the likely cause of the 500 error in production');
        console.log('   When users try to save invoices, the userId from auth middleware');
        console.log('   doesnt match any user in the Users table');
      }
    }

    // 5. Check if foreign key constraint is enforced in schema
    console.log('\n📋 5. Checking schema configuration...');
    console.log('From schema.prisma, Invoice model has:');
    console.log('  userId        String?');
    console.log('  user          User?     @relation(fields: [userId], references: [id])');
    console.log('');
    console.log('This means:');
    console.log('  - Foreign key IS enforced');
    console.log('  - userId CAN be null (String?)');
    console.log('  - But if userId is set, it MUST reference an existing User');

    // 6. Propose solutions
    console.log('\n🔧 SOLUTION OPTIONS:');
    console.log('');
    console.log('Option 1: Create the missing test user');
    console.log('  - Create User with id="test-user-1" and email="test@marinegroupbw.com"');
    console.log('  - This matches what auth middleware expects');
    console.log('');
    console.log('Option 2: Update auth middleware to use existing user ID');
    console.log('  - Change auth.js line 65 to use the actual user ID from database');
    console.log('  - Query Users table to get the correct ID');
    console.log('');
    console.log('Option 3: Make userId nullable in invoice operations');
    console.log('  - Set userId to null when saving, rely on userEmail only');
    console.log('  - Remove foreign key enforcement');
    console.log('');
    console.log('Option 4: Query user by email in auth middleware');
    console.log('  - Look up the user by email and use their actual ID');
    console.log('  - Most robust solution');

    // 7. Test if production had this user created
    console.log('\n📋 6. Checking if production environment needs user creation...');
    const targetUser = await prisma.user.findUnique({
      where: { email: 'test@marinegroupbw.com' }
    });

    if (targetUser) {
      console.log('✅ Target user exists with ID:', targetUser.id);
      console.log('   Auth middleware should use this ID instead of "test-user-1"');
    } else {
      console.log('❌ Target user does not exist');
      console.log('   Need to create user or fix auth middleware');
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await diagnoseForeignKeyIssue();
}

main().catch(console.error);
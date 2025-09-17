#!/usr/bin/env node

/**
 * Verify we're connected to the right database and check for any existing data
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('🔍 Verifying database connection and data state...\n');

  try {
    // Check database info
    console.log('📋 1. Database connection info...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (hidden for security)' : 'NOT SET');

    // Count total records in each table
    console.log('\n📋 2. Checking total record counts...');

    const invoiceCount = await prisma.invoice.count();
    const userCount = await prisma.user.count();

    console.log(`Total invoices in database: ${invoiceCount}`);
    console.log(`Total users in database: ${userCount}`);

    if (invoiceCount === 0 && userCount === 0) {
      console.log('🚨 CRITICAL: Database appears to be empty!');
      console.log('This could indicate:');
      console.log('  1. Wrong database connection');
      console.log('  2. Data loss event');
      console.log('  3. Database reset/migration issue');
      return;
    }

    // Check for any invoices with similar email patterns
    console.log('\n📋 3. Checking for similar email patterns...');

    const allInvoices = await prisma.invoice.findMany({
      select: {
        id: true,
        userEmail: true,
        userId: true,
        title: true,
        status: true,
        createdAt: true
      },
      take: 20,  // Just get first 20 to see patterns
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('Recent invoices:');
    allInvoices.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. Email: ${inv.userEmail}, UserID: ${inv.userId}, Title: ${inv.title}`);
    });

    // Check for marinegroupbw.com emails
    const marineGroupEmails = await prisma.invoice.findMany({
      where: {
        userEmail: {
          contains: 'marinegroupbw.com'
        }
      },
      select: {
        id: true,
        userEmail: true,
        userId: true,
        title: true,
        createdAt: true
      }
    });

    console.log(`\nInvoices with marinegroupbw.com emails: ${marineGroupEmails.length}`);
    marineGroupEmails.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. Email: ${inv.userEmail}, UserID: ${inv.userId}, Title: ${inv.title}`);
    });

    // Check for test@ emails
    const testEmails = await prisma.invoice.findMany({
      where: {
        userEmail: {
          startsWith: 'test@'
        }
      },
      select: {
        id: true,
        userEmail: true,
        userId: true,
        title: true,
        createdAt: true
      }
    });

    console.log(`\nInvoices with test@ emails: ${testEmails.length}`);
    testEmails.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. Email: ${inv.userEmail}, UserID: ${inv.userId}, Title: ${inv.title}`);
    });

    // Check recent activity
    console.log('\n📋 4. Checking recent activity...');
    const recentActivity = await prisma.invoice.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      select: {
        id: true,
        userEmail: true,
        title: true,
        updatedAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`Invoices updated in last 7 days: ${recentActivity.length}`);
    recentActivity.forEach((inv, idx) => {
      console.log(`  ${idx + 1}. ${inv.updatedAt.toISOString()}: ${inv.userEmail} - ${inv.title}`);
    });

    // Check all users
    console.log('\n📋 5. Checking all users...');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    console.log(`Total users: ${allUsers.length}`);
    allUsers.forEach((user, idx) => {
      console.log(`  ${idx + 1}. Email: ${user.email}, ID: ${user.id}, Role: ${user.role}`);
    });

  } catch (error) {
    console.error('❌ Database check failed:', error);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
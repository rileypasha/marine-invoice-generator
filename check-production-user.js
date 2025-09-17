#!/usr/bin/env node

/**
 * Check if test user exists in production database
 * This helps diagnose why production auth is failing
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function checkProductionUser() {
  console.log('🔍 CHECKING PRODUCTION DATABASE USER');
  console.log('='.repeat(40));

  try {
    console.log('📊 Environment info:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('   DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');

    // Test database connection
    console.log('\n🔌 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Check if User table exists
    console.log('\n📋 Checking User table...');
    const userCount = await prisma.user.count();
    console.log(`✅ User table found with ${userCount} users`);

    // Check for test user
    console.log('\n👤 Looking for test user...');
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@marinegroupbw.com' }
    });

    if (testUser) {
      console.log('✅ Test user found:');
      console.log('   ID:', testUser.id);
      console.log('   Email:', testUser.email);
      console.log('   Name:', testUser.name);
    } else {
      console.log('❌ Test user NOT found');
      console.log('\n📋 All users in database:');
      const allUsers = await prisma.user.findMany();
      if (allUsers.length === 0) {
        console.log('   (Database is empty)');
      } else {
        allUsers.forEach(u => console.log(`   - ${u.email} (${u.id})`));
      }
    }

    // Check Invoice table
    console.log('\n📄 Checking Invoice table...');
    const invoiceCount = await prisma.invoice.count();
    console.log(`✅ Invoice table found with ${invoiceCount} invoices`);

  } catch (error) {
    console.error('❌ Database check failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionUser().catch(console.error);
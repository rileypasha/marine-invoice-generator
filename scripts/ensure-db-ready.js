#!/usr/bin/env node

/**
 * Script to ensure database is ready with all required columns
 * Run this before starting the server
 */

const { PrismaClient } = require('@prisma/client');
const { migrateProductionDatabase } = require('./migrate-production-db');
const prisma = new PrismaClient();

async function ensureDatabaseReady() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check if we're in production and need to run password migration
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      console.log('🚀 Production environment detected - checking for password migration...');

      // Check if password column exists
      const tableInfo = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'password';
      `;

      if (tableInfo.length === 0) {
        console.log('🔧 Password column missing - running production migration...');
        await migrateProductionDatabase();
        console.log('✅ Production migration completed!\n');
      } else {
        console.log('✅ Password column exists - no migration needed\n');
      }
    }

    // Try to query with all fields
    const testQuery = await prisma.invoice.findFirst({
      select: {
        id: true,
        title: true,
        data: true,
        userId: true,
        vesselName: true,
        customerName: true,
        total: true,
        status: true,
        savedAt: true
      }
    });

    console.log('✅ Database schema is up to date!');
    console.log('   All required columns exist.\n');
    
    // Get some stats
    const count = await prisma.invoice.count();
    console.log(`📊 Database statistics:`);
    console.log(`   Total invoices: ${count}`);
    
    const savedCount = await prisma.invoice.count({
      where: { status: 'saved' }
    });
    console.log(`   Saved invoices: ${savedCount}`);
    
    const submittedCount = await prisma.invoice.count({
      where: { status: 'submitted' }
    });
    console.log(`   Submitted invoices: ${submittedCount}`);
    
    console.log('\n✅ Database is ready for use!');
    
  } catch (error) {
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('❌ Database schema is outdated!');
      console.log(`   Missing column detected: ${error.message}`);
      console.log('\n📝 To fix this, run:');
      console.log('   npx prisma migrate dev');
      console.log('   OR');
      console.log('   npx prisma db push --force-reset\n');
      process.exit(1);
    } else {
      console.log('❌ Database check failed:');
      console.log(`   ${error.message}`);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
ensureDatabaseReady().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
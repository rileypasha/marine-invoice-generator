#!/usr/bin/env node

/**
 * Script to ensure database is ready with all required columns
 * Run this before starting the server
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureDatabaseReady() {
  console.log('🔍 Checking database schema...\n');
  
  try {
    // Try to query with all fields
    const testQuery = await prisma.invoice.findFirst({
      select: {
        id: true,
        title: true,
        data: true,
        hasChanges: true,
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
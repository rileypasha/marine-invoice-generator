#!/usr/bin/env node

/**
 * Script to fix production database schema issues
 * This can be run safely on production to add missing columns
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixProductionDatabase() {
  console.log('🔧 Checking and fixing production database schema...\n');
  
  try {
    // First, check if we can query with hasChanges
    console.log('📊 Testing database schema...');
    
    try {
      await prisma.$queryRaw`
        SELECT id, "hasChanges" 
        FROM "Invoice" 
        LIMIT 1
      `;
      console.log('✅ hasChanges column exists!');
    } catch (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('⚠️ hasChanges column is missing. Adding it now...');
        
        try {
          // Add the column for PostgreSQL
          await prisma.$executeRaw`
            ALTER TABLE "Invoice" 
            ADD COLUMN "hasChanges" BOOLEAN DEFAULT false
          `;
          console.log('✅ Successfully added hasChanges column!');
        } catch (addError) {
          // Try SQLite syntax if PostgreSQL fails
          if (addError.message.includes('syntax')) {
            console.log('⚠️ PostgreSQL syntax failed, trying SQLite...');
            await prisma.$executeRaw`
              ALTER TABLE Invoice 
              ADD COLUMN hasChanges BOOLEAN DEFAULT 0
            `;
            console.log('✅ Successfully added hasChanges column (SQLite)!');
          } else if (addError.message.includes('already exists')) {
            console.log('✅ Column already exists (may have been added concurrently)');
          } else {
            throw addError;
          }
        }
      } else {
        console.log('❌ Different database error:', error.message);
        throw error;
      }
    }
    
    // Get some stats to verify everything is working
    console.log('\n📊 Verifying database integrity...');
    
    const totalInvoices = await prisma.invoice.count();
    console.log(`   Total invoices: ${totalInvoices}`);
    
    const savedInvoices = await prisma.invoice.count({
      where: { status: 'saved' }
    });
    console.log(`   Saved invoices: ${savedInvoices}`);
    
    const submittedInvoices = await prisma.invoice.count({
      where: { status: 'submitted' }
    });
    console.log(`   Submitted invoices: ${submittedInvoices}`);
    
    // Test a create operation
    console.log('\n🧪 Testing invoice creation...');
    const testInvoice = await prisma.invoice.create({
      data: {
        title: 'Schema Test Invoice',
        data: JSON.stringify({ test: true }),
        status: 'saved',
        vesselName: 'SCHEMA_TEST',
        savedAt: new Date()
      }
    });
    console.log(`   ✅ Test invoice created: ${testInvoice.id}`);
    
    // Clean up test invoice
    await prisma.invoice.delete({
      where: { id: testInvoice.id }
    });
    console.log('   🧹 Test invoice cleaned up');
    
    console.log('\n✅ Production database is ready!');
    console.log('   All required columns exist and operations work correctly.\n');
    
  } catch (error) {
    console.error('\n❌ Database fix failed:', error);
    console.error('\nPlease run the following SQL manually on your production database:');
    console.error('ALTER TABLE "Invoice" ADD COLUMN "hasChanges" BOOLEAN DEFAULT false;\n');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if running in production
if (process.env.NODE_ENV === 'production' || process.argv.includes('--force')) {
  fixProductionDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  console.log('⚠️ This script is intended for production databases.');
  console.log('   Run with NODE_ENV=production or use --force flag to proceed.\n');
  console.log('   Example: NODE_ENV=production node scripts/fix-production-db.js');
  console.log('   Example: node scripts/fix-production-db.js --force\n');
}
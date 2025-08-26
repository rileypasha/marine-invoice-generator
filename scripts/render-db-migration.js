#!/usr/bin/env node

/**
 * Production database migration for Render PostgreSQL
 * Adds missing hasChanges column to Invoice table
 */

const { PrismaClient } = require('@prisma/client');

async function migrateRenderDatabase() {
  console.log('🚀 Starting Render PostgreSQL Migration\n');
  console.log('================================================\n');
  
  // Create Prisma client with production DATABASE_URL
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  try {
    // Step 1: Check current schema
    console.log('📊 Checking current database schema...');
    
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Invoice' 
      AND column_name = 'hasChanges'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ hasChanges column already exists!');
      return;
    }
    
    console.log('⚠️  hasChanges column is missing\n');
    
    // Step 2: Add the missing column
    console.log('🔧 Adding hasChanges column to Invoice table...');
    
    await prisma.$executeRaw`
      ALTER TABLE "Invoice" 
      ADD COLUMN "hasChanges" BOOLEAN DEFAULT false
    `;
    
    console.log('✅ Successfully added hasChanges column!\n');
    
    // Step 3: Verify the column was added
    console.log('🔍 Verifying migration...');
    
    const verifyColumn = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Invoice' 
      AND column_name = 'hasChanges'
    `;
    
    if (verifyColumn.length > 0) {
      console.log('✅ Column verified successfully!');
      console.log('   Details:', verifyColumn[0]);
    } else {
      throw new Error('Column was not added properly');
    }
    
    // Step 4: Update existing records to have hasChanges = false
    console.log('\n📝 Updating existing records...');
    
    const updateResult = await prisma.$executeRaw`
      UPDATE "Invoice" 
      SET "hasChanges" = false 
      WHERE "hasChanges" IS NULL
    `;
    
    console.log(`   Updated ${updateResult} records\n`);
    
    // Step 5: Test the migration
    console.log('🧪 Testing migration with sample query...');
    
    const testQuery = await prisma.$queryRaw`
      SELECT id, "hasChanges", status 
      FROM "Invoice" 
      LIMIT 5
    `;
    
    console.log('✅ Test query successful!');
    console.log(`   Found ${testQuery.length} invoices with hasChanges field\n`);
    
    // Step 6: Get migration statistics
    console.log('📊 Migration Statistics:');
    
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN "hasChanges" = true THEN 1 END) as with_changes,
        COUNT(CASE WHEN "hasChanges" = false THEN 1 END) as without_changes
      FROM "Invoice"
    `;
    
    console.log('   Total invoices:', stats[0].total);
    console.log('   With changes:', stats[0].with_changes);
    console.log('   Without changes:', stats[0].without_changes);
    
    console.log('\n================================================');
    console.log('✅ RENDER DATABASE MIGRATION COMPLETE!');
    console.log('================================================\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.code === 'P2010') {
      console.error('\n⚠️  Raw query failed. This might be a connection issue.');
      console.error('   Please check your DATABASE_URL environment variable.');
    } else if (error.message.includes('already exists')) {
      console.log('\n✅ Column already exists (may have been added concurrently)');
    } else {
      console.error('\n📋 Full error details:', error);
      
      console.error('\n🔧 Manual fix instructions:');
      console.error('   1. Connect to your Render PostgreSQL database');
      console.error('   2. Run this SQL command:');
      console.error('      ALTER TABLE "Invoice" ADD COLUMN "hasChanges" BOOLEAN DEFAULT false;');
      console.error('   3. Then run:');
      console.error('      UPDATE "Invoice" SET "hasChanges" = false WHERE "hasChanges" IS NULL;');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
console.log('🔌 Connecting to Render PostgreSQL database...\n');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('   Please set it to your Render PostgreSQL connection string.');
  console.error('   Example: DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

migrateRenderDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
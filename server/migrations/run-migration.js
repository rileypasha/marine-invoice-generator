/**
 * Migration script to add change tracking support
 * Run this to update the production database schema
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting change tracking migration...');
  
  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'add_change_tracking.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`\n⚡ Executing statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      try {
        await prisma.$executeRawUnsafe(statement);
        console.log('✅ Success');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️  Already exists, skipping');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    // Check if hasChanges column exists
    const hasChangesExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Invoice' AND column_name = 'hasChanges'
    `;
    console.log('✓ hasChanges column:', hasChangesExists.length > 0 ? 'exists' : 'missing');
    
    // Check if MasterChangeView table exists
    const masterChangeViewExists = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'MasterChangeView'
    `;
    console.log('✓ MasterChangeView table:', masterChangeViewExists.length > 0 ? 'exists' : 'missing');
    
    // Check payloadJson columns
    const submissionPayload = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'InvoiceSubmission' AND column_name = 'payloadJson'
    `;
    console.log('✓ InvoiceSubmission.payloadJson:', 
      submissionPayload.length > 0 ? `exists (${submissionPayload[0].data_type})` : 'missing');
    
    const revisionPayload = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'InvoiceRevision' AND column_name = 'payloadJson'
    `;
    console.log('✓ InvoiceRevision.payloadJson:', 
      revisionPayload.length > 0 ? `exists (${revisionPayload[0].data_type})` : 'missing');
    
    console.log('\n✨ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration().catch(console.error);
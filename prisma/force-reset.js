const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function forceReset() {
  console.log('🔥 Force resetting database...');
  
  try {
    // Read the migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/20250825_init/migration.sql'),
      'utf8'
    );
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await prisma.$executeRawUnsafe(statement + ';');
      } catch (err) {
        console.log('Statement failed (may be OK):', err.message);
      }
    }
    
    console.log('✅ Database reset complete!');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

forceReset();
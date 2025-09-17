#!/usr/bin/env node

/**
 * Schema Validation Script
 * Ensures Prisma schema always uses PostgreSQL in production
 * CRITICAL: Prevents accidental SQLite configuration
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const migrationLockPath = path.join(__dirname, '../prisma/migrations/migration_lock.toml');

function validateSchema() {
  console.log('🔍 Validating database schema configuration...');

  let hasErrors = false;

  // Check main schema file
  if (fs.existsSync(schemaPath)) {
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    if (schemaContent.includes('provider = "sqlite"')) {
      console.error('❌ CRITICAL ERROR: schema.prisma is configured for SQLite instead of PostgreSQL!');
      console.error('   This MUST be "postgresql" for production deployment.');
      hasErrors = true;
    } else if (schemaContent.includes('provider = "postgresql"')) {
      console.log('✅ schema.prisma correctly configured for PostgreSQL');
    } else {
      console.error('❌ ERROR: Cannot find database provider in schema.prisma');
      hasErrors = true;
    }
  } else {
    console.error('❌ ERROR: schema.prisma not found');
    hasErrors = true;
  }

  // Check migration lock file
  if (fs.existsSync(migrationLockPath)) {
    const lockContent = fs.readFileSync(migrationLockPath, 'utf8');

    if (lockContent.includes('provider = "sqlite"')) {
      console.error('❌ CRITICAL ERROR: migration_lock.toml is configured for SQLite instead of PostgreSQL!');
      console.error('   This MUST be "postgresql" for production deployment.');
      hasErrors = true;
    } else if (lockContent.includes('provider = "postgresql"')) {
      console.log('✅ migration_lock.toml correctly configured for PostgreSQL');
    } else {
      console.error('❌ ERROR: Cannot find database provider in migration_lock.toml');
      hasErrors = true;
    }
  } else {
    console.error('❌ ERROR: migration_lock.toml not found');
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n🚨 SCHEMA VALIDATION FAILED');
    console.error('Database provider MUST be PostgreSQL for production deployment.');
    console.error('Please fix the configuration before proceeding.');
    process.exit(1);
  }

  console.log('✅ Schema validation passed - PostgreSQL configuration confirmed');
}

// Auto-fix common issues
function autoFix() {
  console.log('🔧 Attempting to auto-fix schema configuration...');

  let fixed = false;

  // Fix main schema
  if (fs.existsSync(schemaPath)) {
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    if (schemaContent.includes('provider = "sqlite"')) {
      schemaContent = schemaContent.replace(
        'provider = "sqlite"',
        'provider = "postgresql"'
      );
      fs.writeFileSync(schemaPath, schemaContent);
      console.log('✅ Fixed schema.prisma: SQLite → PostgreSQL');
      fixed = true;
    }
  }

  // Fix migration lock
  if (fs.existsSync(migrationLockPath)) {
    let lockContent = fs.readFileSync(migrationLockPath, 'utf8');
    if (lockContent.includes('provider = "sqlite"')) {
      lockContent = lockContent.replace(
        'provider = "sqlite"',
        'provider = "postgresql"'
      );
      fs.writeFileSync(migrationLockPath, lockContent);
      console.log('✅ Fixed migration_lock.toml: SQLite → PostgreSQL');
      fixed = true;
    }
  }

  if (fixed) {
    console.log('🎉 Auto-fix completed - schema now configured for PostgreSQL');
  } else {
    console.log('ℹ️ No fixes needed - schema already configured correctly');
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--fix')) {
  autoFix();
} else {
  validateSchema();
}
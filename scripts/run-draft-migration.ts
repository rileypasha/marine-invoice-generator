#!/usr/bin/env node
/**
 * Script to run the draft invoice removal migration
 *
 * Usage:
 *   npm run migrate:remove-drafts          # Dry run first
 *   npm run migrate:remove-drafts --apply  # Apply changes
 */

import { runDraftRemovalMigration } from '../server/migrations/remove-draft-invoices';
import { logger } from '../server/utils/logger';

// Mock database implementation - replace with real database
class MockDatabase {
  private invoices = new Map<string, any>();

  async getAllInvoices() {
    return Array.from(this.invoices.values());
  }

  async updateInvoice(id: string, updates: any) {
    const existing = this.invoices.get(id);
    if (existing) {
      this.invoices.set(id, { ...existing, ...updates });
    }
  }

  async deleteInvoice(id: string) {
    this.invoices.delete(id);
  }

  async createUniqueIndex(fields: string[]) {
    logger.info(`Creating unique index on fields: ${fields.join(', ')}`);
    // Mock implementation - in real database this would create actual index
  }

  // Helper method to seed test data
  seedTestData() {
    // Add some test invoices with drafts
    this.invoices.set('inv-1-draft', {
      id: 'inv-1-draft',
      userId: 'user-1',
      title: 'Test Invoice 1',
      status: 'draft',
      amount: 100,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z'
    });

    this.invoices.set('inv-1-saved', {
      id: 'inv-1-saved',
      userId: 'user-1',
      title: 'Test Invoice 1',
      status: 'saved',
      amount: 150,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T11:00:00Z'
    });

    this.invoices.set('inv-2-draft-only', {
      id: 'inv-2-draft-only',
      userId: 'user-1',
      title: 'Draft Only Invoice',
      status: 'draft',
      amount: 200,
      createdAt: '2024-01-01T12:00:00Z',
      updatedAt: '2024-01-01T12:00:00Z'
    });

    this.invoices.set('inv-3-finalized', {
      id: 'inv-3-finalized',
      userId: 'user-2',
      title: 'Finalized Invoice',
      status: 'finalized',
      amount: 300,
      createdAt: '2024-01-01T13:00:00Z',
      updatedAt: '2024-01-01T13:00:00Z'
    });

    logger.info('Seeded test data with draft/saved duplicates and lone drafts');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;

  logger.info('Draft Invoice Removal Migration', { dryRun });

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Use --apply flag to execute changes');
  } else {
    console.log('⚠️  APPLY MODE - Changes will be made to database');
    console.log('   Ensure you have a database backup before proceeding');
  }

  try {
    // Initialize database
    const database = new MockDatabase();

    // Seed with test data for demonstration
    database.seedTestData();

    // Show initial state
    const initialInvoices = await database.getAllInvoices();
    console.log(`\n📊 Initial state: ${initialInvoices.length} invoices`);

    const draftCount = initialInvoices.filter(inv => inv.status === 'draft').length;
    const savedCount = initialInvoices.filter(inv => inv.status === 'saved').length;
    const finalizedCount = initialInvoices.filter(inv => inv.status === 'finalized').length;

    console.log(`   - Drafts: ${draftCount}`);
    console.log(`   - Saved: ${savedCount}`);
    console.log(`   - Finalized: ${finalizedCount}`);

    // Run migration
    console.log('\n🚀 Running migration...');
    const results = await runDraftRemovalMigration(database, dryRun);

    // Show results
    console.log('\n✅ Migration completed:');
    console.log(`   - Drafts promoted: ${results.draftsPromoted}`);
    console.log(`   - Drafts deleted: ${results.draftsDeleted}`);
    console.log(`   - Duplicates resolved: ${results.duplicatesResolved}`);

    if (results.errors.length > 0) {
      console.log(`   - Errors: ${results.errors.length}`);
      results.errors.forEach(error => console.log(`     ❌ ${error}`));
    }

    // Show final state
    const finalInvoices = await database.getAllInvoices();
    console.log(`\n📊 Final state: ${finalInvoices.length} invoices`);

    const finalDraftCount = finalInvoices.filter(inv => inv.status === 'draft').length;
    const finalSavedCount = finalInvoices.filter(inv => inv.status === 'saved').length;
    const finalFinalizedCount = finalInvoices.filter(inv => inv.status === 'finalized').length;

    console.log(`   - Drafts: ${finalDraftCount}`);
    console.log(`   - Saved: ${finalSavedCount}`);
    console.log(`   - Finalized: ${finalFinalizedCount}`);

    if (dryRun) {
      console.log('\n💡 Run with --apply to execute these changes');
    } else {
      console.log('\n🎉 Migration applied successfully!');
    }

  } catch (error: any) {
    logger.error('Migration failed', { error: error.message });
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as runMigrationScript };
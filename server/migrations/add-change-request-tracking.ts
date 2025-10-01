/**
 * Migration: Add change request tracking fields to Invoice model
 *
 * Adds fields for storing baseline snapshots and computed diffs
 * when invoices enter 'change_requested' status.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addChangeRequestTracking() {
  console.log('Starting migration: Add change request tracking fields...');

  try {
    // Check if columns already exist
    const existingColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Invoice'
      AND column_name IN ('changeRequestSnapshot', 'changeRequestDiff', 'changeRequestedAt', 'changeRequestedBy')
    `;

    const columnNames = existingColumns.map(c => c.column_name);

    // Add columns if they don't exist
    if (!columnNames.includes('changeRequestSnapshot')) {
      console.log('Adding changeRequestSnapshot column...');
      await prisma.$executeRaw`
        ALTER TABLE "Invoice" ADD COLUMN "changeRequestSnapshot" JSONB
      `;
    }

    if (!columnNames.includes('changeRequestDiff')) {
      console.log('Adding changeRequestDiff column...');
      await prisma.$executeRaw`
        ALTER TABLE "Invoice" ADD COLUMN "changeRequestDiff" JSONB
      `;
    }

    if (!columnNames.includes('changeRequestedAt')) {
      console.log('Adding changeRequestedAt column...');
      await prisma.$executeRaw`
        ALTER TABLE "Invoice" ADD COLUMN "changeRequestedAt" TIMESTAMP(3)
      `;
    }

    if (!columnNames.includes('changeRequestedBy')) {
      console.log('Adding changeRequestedBy column...');
      await prisma.$executeRaw`
        ALTER TABLE "Invoice" ADD COLUMN "changeRequestedBy" TEXT
      `;
    }

    // Create index on status for efficient change_requested queries
    console.log('Creating index on status column...');
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status")
    `;

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if called directly
if (require.main === module) {
  addChangeRequestTracking()
    .then(() => {
      console.log('✅ Change request tracking migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default addChangeRequestTracking;
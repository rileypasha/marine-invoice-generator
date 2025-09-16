const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const prisma = new PrismaClient();

async function runStateMigration() {
  try {
    logger.info('Starting invoice state migration...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../server/migrations/add-invoice-state-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (basic splitting on semicolons)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    logger.info(`Executing ${statements.length} migration statements...`);

    // Execute each statement
    for (const [index, statement] of statements.entries()) {
      try {
        logger.info(`Executing statement ${index + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(statement);
        logger.info(`✓ Statement ${index + 1} completed`);
      } catch (error) {
        // Some statements might fail if already applied (e.g., column already exists)
        // Log but continue unless it's a critical error
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          logger.warn(`Statement ${index + 1} skipped (already applied): ${error.message}`);
        } else {
          logger.error(`✗ Statement ${index + 1} failed: ${error.message}`);
          throw error;
        }
      }
    }

    // Verify the migration worked
    logger.info('Verifying migration results...');

    const stateCount = await prisma.$queryRaw`
      SELECT "state", COUNT(*) as count
      FROM "Invoice"
      GROUP BY "state"
    `;

    logger.info('State distribution after migration:', stateCount);

    // Test that the new fields work
    const sampleInvoice = await prisma.invoice.findFirst({
      select: {
        id: true,
        state: true,
        version: true,
        status: true,
        finalizedAt: true
      }
    });

    if (sampleInvoice) {
      logger.info('Sample invoice after migration:', {
        id: sampleInvoice.id,
        state: sampleInvoice.state,
        version: sampleInvoice.version,
        legacyStatus: sampleInvoice.status,
        finalizedAt: sampleInvoice.finalizedAt
      });
    }

    logger.info('✓ Invoice state migration completed successfully');

  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runStateMigration()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runStateMigration };
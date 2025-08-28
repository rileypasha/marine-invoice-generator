/**
 * One-time migration endpoint for Changes Tracker
 * REMOVE THIS FILE AFTER RUNNING THE MIGRATION
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

const prisma = new PrismaClient();

router.get('/run-changes-tracker-migration', async (req, res) => {
    // Simple auth check
    const authKey = req.query.key;
    if (authKey !== 'migrate-changes-tracker-2025') {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const results = [];
    
    try {
        // 1. Add hasChanges column to Invoice
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "hasChanges" BOOLEAN DEFAULT false;
            `);
            results.push('✅ Added hasChanges column to Invoice');
        } catch (error) {
            if (error.message.includes('already exists')) {
                results.push('⏭️ hasChanges column already exists');
            } else {
                results.push(`❌ Failed to add hasChanges: ${error.message}`);
            }
        }
        
        // 2. Add payloadJson to InvoiceSubmission
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "InvoiceSubmission" ADD COLUMN IF NOT EXISTS "payloadJson" JSONB;
            `);
            results.push('✅ Added payloadJson to InvoiceSubmission');
        } catch (error) {
            if (error.message.includes('already exists')) {
                results.push('⏭️ payloadJson already exists in InvoiceSubmission');
            } else {
                results.push(`❌ Failed to add payloadJson: ${error.message}`);
            }
        }
        
        // 3. Rename columns in InvoiceRevision
        const columnRenames = [
            { from: 'version', to: 'revisionNumber' },
            { from: 'data', to: 'payloadJson' },
            { from: 'changedBy', to: 'actorEmail' },
            { from: 'changedAt', to: 'createdAt' },
            { from: 'changeNotes', to: 'changeSummary' }
        ];
        
        for (const rename of columnRenames) {
            try {
                await prisma.$executeRawUnsafe(`
                    ALTER TABLE "InvoiceRevision" RENAME COLUMN "${rename.from}" TO "${rename.to}";
                `);
                results.push(`✅ Renamed ${rename.from} to ${rename.to}`);
            } catch (error) {
                if (error.message.includes('does not exist')) {
                    results.push(`⏭️ Column ${rename.from} doesn't exist (may already be renamed)`);
                } else if (error.message.includes('already exists')) {
                    results.push(`⏭️ Column ${rename.to} already exists`);
                } else {
                    results.push(`❌ Failed to rename ${rename.from}: ${error.message}`);
                }
            }
        }
        
        // 4. Convert payloadJson to JSONB if needed
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "InvoiceRevision" 
                ALTER COLUMN "payloadJson" TYPE JSONB 
                USING "payloadJson"::JSONB;
            `);
            results.push('✅ Converted payloadJson to JSONB type');
        } catch (error) {
            results.push(`⚠️ Could not convert payloadJson type: ${error.message}`);
        }
        
        // 5. Create MasterChangeView table
        try {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "MasterChangeView" (
                    "id" TEXT NOT NULL,
                    "invoiceId" TEXT NOT NULL,
                    "latestRevisionId" TEXT NOT NULL,
                    "masterEmail" TEXT NOT NULL,
                    "seenAt" TIMESTAMP(3) NOT NULL,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "MasterChangeView_pkey" PRIMARY KEY ("id")
                );
            `);
            results.push('✅ Created MasterChangeView table');
        } catch (error) {
            if (error.message.includes('already exists')) {
                results.push('⏭️ MasterChangeView table already exists');
            } else {
                results.push(`❌ Failed to create MasterChangeView: ${error.message}`);
            }
        }
        
        // 6. Create indexes and constraints
        const indexCommands = [
            {
                sql: `CREATE UNIQUE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_latestRevisionId_masterEmail_key" 
                      ON "MasterChangeView"("invoiceId", "latestRevisionId", "masterEmail");`,
                name: 'MasterChangeView unique index'
            },
            {
                sql: `CREATE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_idx" 
                      ON "MasterChangeView"("invoiceId");`,
                name: 'MasterChangeView invoiceId index'
            },
            {
                sql: `CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSubmission_invoiceId_key" 
                      ON "InvoiceSubmission"("invoiceId");`,
                name: 'InvoiceSubmission unique index'
            },
            {
                sql: `CREATE INDEX IF NOT EXISTS "InvoiceRevision_invoiceId_createdAt_idx" 
                      ON "InvoiceRevision"("invoiceId", "createdAt" DESC);`,
                name: 'InvoiceRevision index'
            }
        ];
        
        for (const cmd of indexCommands) {
            try {
                await prisma.$executeRawUnsafe(cmd.sql);
                results.push(`✅ Created ${cmd.name}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    results.push(`⏭️ ${cmd.name} already exists`);
                } else {
                    results.push(`❌ Failed to create ${cmd.name}: ${error.message}`);
                }
            }
        }
        
        // 7. Add foreign key constraints
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "MasterChangeView" 
                ADD CONSTRAINT "MasterChangeView_invoiceId_fkey" 
                FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") 
                ON DELETE CASCADE ON UPDATE CASCADE;
            `);
            results.push('✅ Added MasterChangeView invoice foreign key');
        } catch (error) {
            if (error.message.includes('already exists')) {
                results.push('⏭️ MasterChangeView invoice FK already exists');
            } else {
                results.push(`⚠️ Could not add invoice FK: ${error.message}`);
            }
        }
        
        try {
            await prisma.$executeRawUnsafe(`
                ALTER TABLE "MasterChangeView" 
                ADD CONSTRAINT "MasterChangeView_latestRevisionId_fkey" 
                FOREIGN KEY ("latestRevisionId") REFERENCES "InvoiceRevision"("id") 
                ON DELETE CASCADE ON UPDATE CASCADE;
            `);
            results.push('✅ Added MasterChangeView revision foreign key');
        } catch (error) {
            if (error.message.includes('already exists')) {
                results.push('⏭️ MasterChangeView revision FK already exists');
            } else {
                results.push(`⚠️ Could not add revision FK: ${error.message}`);
            }
        }
        
        res.json({
            success: true,
            message: 'Migration completed',
            results
        });
        
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            results
        });
    } finally {
        await prisma.$disconnect();
    }
});

module.exports = router;
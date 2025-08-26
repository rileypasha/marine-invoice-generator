-- Render Production Database Migration
-- Run this SQL directly in your Render PostgreSQL database console
-- Date: 2025-08-26
-- Purpose: Add missing hasChanges column to Invoice table

-- Step 1: Add the hasChanges column if it doesn't exist
-- This is safe to run multiple times
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Invoice' 
        AND column_name = 'hasChanges'
    ) THEN
        ALTER TABLE "Invoice" 
        ADD COLUMN "hasChanges" BOOLEAN DEFAULT false;
        
        RAISE NOTICE 'hasChanges column added successfully';
    ELSE
        RAISE NOTICE 'hasChanges column already exists';
    END IF;
END $$;

-- Step 2: Update any NULL values to false
UPDATE "Invoice" 
SET "hasChanges" = false 
WHERE "hasChanges" IS NULL;

-- Step 3: Verify the migration
SELECT 
    'Migration Complete' as status,
    COUNT(*) as total_invoices,
    COUNT(CASE WHEN "hasChanges" = true THEN 1 END) as with_changes,
    COUNT(CASE WHEN "hasChanges" = false THEN 1 END) as without_changes
FROM "Invoice";

-- Step 4: Show sample records to confirm
SELECT 
    id, 
    "userId",
    "userEmail",
    "vesselName",
    status,
    "hasChanges",
    "createdAt"
FROM "Invoice"
ORDER BY "createdAt" DESC
LIMIT 5;
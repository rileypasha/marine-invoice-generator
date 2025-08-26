-- Production Database Migration Script
-- This adds the hasChanges column if it doesn't exist
-- Safe to run multiple times

-- For PostgreSQL (Render production database)
ALTER TABLE "Invoice" 
ADD COLUMN IF NOT EXISTS "hasChanges" BOOLEAN DEFAULT false;

-- If you're using SQLite in production (not recommended), use this instead:
-- ALTER TABLE Invoice ADD COLUMN hasChanges BOOLEAN DEFAULT 0;
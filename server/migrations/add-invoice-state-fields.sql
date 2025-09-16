-- Migration: Add state and version fields to Invoice table
-- These fields support the Domain-Driven Design entity

-- Add the new fields
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "state" TEXT DEFAULT 'SAVED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP;

-- Migrate existing status values to new state values
UPDATE "Invoice" SET "state" = CASE
  WHEN "status" = 'draft' THEN 'DRAFT'
  WHEN "status" = 'saved' THEN 'SAVED'
  WHEN "status" = 'archived' THEN 'FINALIZED'
  ELSE 'SAVED'
END WHERE "state" = 'SAVED'; -- Only update records that haven't been migrated

-- Update finalizedAt for archived invoices
UPDATE "Invoice" SET "finalizedAt" = "updatedAt"
WHERE "status" = 'archived' AND "finalizedAt" IS NULL;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS "Invoice_state_idx" ON "Invoice"("state");
CREATE INDEX IF NOT EXISTS "Invoice_version_idx" ON "Invoice"("version");

-- Add comments for documentation
COMMENT ON COLUMN "Invoice"."state" IS 'Domain state: DRAFT, SAVED, MODIFIED, FINALIZED';
COMMENT ON COLUMN "Invoice"."version" IS 'Optimistic locking version number';
COMMENT ON COLUMN "Invoice"."finalizedAt" IS 'When invoice was marked as finalized';
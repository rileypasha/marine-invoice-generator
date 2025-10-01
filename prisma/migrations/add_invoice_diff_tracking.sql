-- Migration: Add Invoice Diff Tracking System
-- Date: 2025-09-29
-- Description: Adds InvoiceDiff model and enhances InvoiceRevision with diff tracking fields

-- Step 1: Add new fields to InvoiceRevision (all nullable to avoid breaking existing data)
ALTER TABLE "InvoiceRevision"
  ADD COLUMN IF NOT EXISTS "actorId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorName" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "patch" JSONB,
  ADD COLUMN IF NOT EXISTS "summaryJson" JSONB,
  ADD COLUMN IF NOT EXISTS "changeCount" INTEGER DEFAULT 0 NOT NULL;

-- Step 2: Add foreign key for actorId (if User table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
    ALTER TABLE "InvoiceRevision"
      ADD CONSTRAINT "InvoiceRevision_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Step 3: Add index on actorId
CREATE INDEX IF NOT EXISTS "InvoiceRevision_actorId_idx" ON "InvoiceRevision"("actorId");

-- Step 4: Add unique constraint on (invoiceId, revisionNumber) only if no duplicates exist
-- First, check and handle duplicates by keeping only the latest record per (invoiceId, revisionNumber)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  -- Count duplicates
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT invoiceId, revisionNumber, COUNT(*) as cnt
    FROM "InvoiceRevision"
    GROUP BY invoiceId, revisionNumber
    HAVING COUNT(*) > 1
  ) subq;

  IF duplicate_count > 0 THEN
    -- Handle duplicates: keep only the most recent record per (invoiceId, revisionNumber)
    DELETE FROM "InvoiceRevision" a
    USING "InvoiceRevision" b
    WHERE a.invoiceId = b.invoiceId
      AND a.revisionNumber = b.revisionNumber
      AND a.createdAt < b.createdAt;
  END IF;

  -- Now add the unique constraint
  ALTER TABLE "InvoiceRevision"
    ADD CONSTRAINT "InvoiceRevision_invoiceId_revisionNumber_key"
    UNIQUE ("invoiceId", "revisionNumber");
END $$;

-- Step 5: Create InvoiceDiff table
CREATE TABLE IF NOT EXISTS "InvoiceDiff" (
  "id" TEXT PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "fromRevisionId" TEXT NOT NULL,
  "toRevisionId" TEXT NOT NULL,
  "fromVersion" INTEGER NOT NULL,
  "toVersion" INTEGER NOT NULL,
  "patch" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "changeCount" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Foreign keys
  CONSTRAINT "InvoiceDiff_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE CASCADE,

  CONSTRAINT "InvoiceDiff_fromRevisionId_fkey"
    FOREIGN KEY ("fromRevisionId") REFERENCES "InvoiceRevision"("id")
    ON DELETE CASCADE,

  CONSTRAINT "InvoiceDiff_toRevisionId_fkey"
    FOREIGN KEY ("toRevisionId") REFERENCES "InvoiceRevision"("id")
    ON DELETE CASCADE,

  -- Unique constraint
  CONSTRAINT "InvoiceDiff_invoiceId_fromVersion_toVersion_key"
    UNIQUE ("invoiceId", "fromVersion", "toVersion")
);

-- Step 6: Add indexes for InvoiceDiff
CREATE INDEX IF NOT EXISTS "InvoiceDiff_invoiceId_createdAt_idx"
  ON "InvoiceDiff"("invoiceId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "InvoiceDiff_toRevisionId_idx"
  ON "InvoiceDiff"("toRevisionId");

-- Step 7: Update Invoice table to add cascade delete on InvoiceRevision relation
-- This ensures InvoiceDiff records are properly cleaned up
ALTER TABLE "InvoiceRevision"
  DROP CONSTRAINT IF EXISTS "InvoiceRevision_invoiceId_fkey";

ALTER TABLE "InvoiceRevision"
  ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE;

-- Migration complete
-- Note: Existing InvoiceRevision records will have NULL values for new fields
-- The application will populate these fields for new revisions going forward
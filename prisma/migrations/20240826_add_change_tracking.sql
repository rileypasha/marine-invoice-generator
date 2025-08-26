-- Add hasChanges column to Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "hasChanges" BOOLEAN DEFAULT FALSE;

-- Update InvoiceSubmission to include payloadJson
ALTER TABLE "InvoiceSubmission" 
ADD COLUMN IF NOT EXISTS "payloadJson" JSONB;

-- Create unique constraint on InvoiceSubmission
ALTER TABLE "InvoiceSubmission" 
ADD CONSTRAINT "InvoiceSubmission_invoiceId_unique" UNIQUE ("invoiceId");

-- Update InvoiceRevision structure
ALTER TABLE "InvoiceRevision" 
RENAME COLUMN "version" TO "revisionNumber";

ALTER TABLE "InvoiceRevision"
RENAME COLUMN "changedBy" TO "actorEmail";

ALTER TABLE "InvoiceRevision"
RENAME COLUMN "changedAt" TO "createdAt";

ALTER TABLE "InvoiceRevision"
RENAME COLUMN "changeNotes" TO "changeSummary";

ALTER TABLE "InvoiceRevision"
DROP COLUMN IF EXISTS "data";

ALTER TABLE "InvoiceRevision"
ADD COLUMN IF NOT EXISTS "payloadJson" JSONB NOT NULL DEFAULT '{}';

-- Create index on InvoiceRevision
CREATE INDEX IF NOT EXISTS "InvoiceRevision_invoiceId_createdAt_idx" 
ON "InvoiceRevision" ("invoiceId", "createdAt" DESC);

-- Create MasterChangeView table
CREATE TABLE IF NOT EXISTS "MasterChangeView" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "latestRevisionId" TEXT NOT NULL,
    "masterEmail" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "MasterChangeView_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MasterChangeView_invoiceId_fkey" 
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE,
    CONSTRAINT "MasterChangeView_latestRevisionId_fkey" 
        FOREIGN KEY ("latestRevisionId") REFERENCES "InvoiceRevision"("id") ON DELETE CASCADE
);

-- Create unique constraint on MasterChangeView
CREATE UNIQUE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_latestRevisionId_masterEmail_key" 
ON "MasterChangeView" ("invoiceId", "latestRevisionId", "masterEmail");

-- Create index on MasterChangeView
CREATE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_idx" 
ON "MasterChangeView" ("invoiceId");

-- Backfill existing submitted invoices
-- This creates a submission baseline for any invoice that has a submittedAt date
INSERT INTO "InvoiceSubmission" ("id", "invoiceId", "submittedBy", "submittedAt", "status", "payloadJson")
SELECT 
    gen_random_uuid() as "id",
    "id" as "invoiceId",
    COALESCE("userEmail", 'system@marine.com') as "submittedBy",
    "submittedAt",
    'submitted' as "status",
    "data"::jsonb as "payloadJson"
FROM "Invoice" 
WHERE "submittedAt" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "InvoiceSubmission" WHERE "InvoiceSubmission"."invoiceId" = "Invoice"."id"
  );
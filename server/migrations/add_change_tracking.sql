-- Add missing columns to Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "hasChanges" BOOLEAN DEFAULT false;

-- Add missing payloadJson column to InvoiceSubmission
ALTER TABLE "InvoiceSubmission" ADD COLUMN IF NOT EXISTS "payloadJson" JSONB;

-- Update InvoiceRevision table structure
ALTER TABLE "InvoiceRevision" RENAME COLUMN "version" TO "revisionNumber";
ALTER TABLE "InvoiceRevision" RENAME COLUMN "data" TO "payloadJson";
ALTER TABLE "InvoiceRevision" RENAME COLUMN "changedBy" TO "actorEmail";
ALTER TABLE "InvoiceRevision" RENAME COLUMN "changedAt" TO "createdAt";
ALTER TABLE "InvoiceRevision" RENAME COLUMN "changeNotes" TO "changeSummary";

-- Change payloadJson column type from text to JSONB
ALTER TABLE "InvoiceRevision" ALTER COLUMN "payloadJson" TYPE JSONB USING "payloadJson"::JSONB;

-- Create MasterChangeView table
CREATE TABLE IF NOT EXISTS "MasterChangeView" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "latestRevisionId" TEXT NOT NULL,
    "masterEmail" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterChangeView_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_latestRevisionId_masterEmail_key" 
ON "MasterChangeView"("invoiceId", "latestRevisionId", "masterEmail");

-- Create indexes
CREATE INDEX IF NOT EXISTS "MasterChangeView_invoiceId_idx" ON "MasterChangeView"("invoiceId");

-- Add foreign key constraints
ALTER TABLE "MasterChangeView" 
ADD CONSTRAINT "MasterChangeView_invoiceId_fkey" 
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MasterChangeView" 
ADD CONSTRAINT "MasterChangeView_latestRevisionId_fkey" 
FOREIGN KEY ("latestRevisionId") REFERENCES "InvoiceRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraint to InvoiceSubmission
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSubmission_invoiceId_key" ON "InvoiceSubmission"("invoiceId");

-- Add index to InvoiceRevision
CREATE INDEX IF NOT EXISTS "InvoiceRevision_invoiceId_createdAt_idx" ON "InvoiceRevision"("invoiceId", "createdAt" DESC);
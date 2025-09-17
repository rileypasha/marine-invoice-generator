-- Add change tracking fields to invoices table
-- Migration: Add hasUnreadChanges and lastMasterViewAt fields

-- Add hasUnreadChanges field with default false
ALTER TABLE "Invoice"
ADD COLUMN "hasUnreadChanges" BOOLEAN NOT NULL DEFAULT false;

-- Add lastMasterViewAt field as nullable timestamp
ALTER TABLE "Invoice"
ADD COLUMN "lastMasterViewAt" TIMESTAMP(3);

-- Create index for efficient querying of unread changes
CREATE INDEX "Invoice_hasUnreadChanges_idx" ON "Invoice"("hasUnreadChanges");

-- Create index for querying by last master view time
CREATE INDEX "Invoice_lastMasterViewAt_idx" ON "Invoice"("lastMasterViewAt");
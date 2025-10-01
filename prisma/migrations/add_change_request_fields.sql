-- Migration: Add Change Request Tracking Fields to Invoice
-- Date: 2025-09-30
-- Description: Adds change request tracking fields to Invoice table

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "changeRequestSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "changeRequestDiff" JSONB,
  ADD COLUMN IF NOT EXISTS "changeRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "changeRequestedBy" TEXT;

-- Migration complete

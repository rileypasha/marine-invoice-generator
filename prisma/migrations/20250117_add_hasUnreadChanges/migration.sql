-- Add hasUnreadChanges field if it doesn't exist
ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "hasUnreadChanges" BOOLEAN NOT NULL DEFAULT false;

-- Add lastMasterViewAt field if it doesn't exist
ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "lastMasterViewAt" TIMESTAMP(3);
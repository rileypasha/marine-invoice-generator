-- Add hasChanges field if it doesn't exist
ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "hasChanges" BOOLEAN NOT NULL DEFAULT false;
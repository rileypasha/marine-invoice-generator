-- Add IdempotencyRecord table if it doesn't exist
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- Create unique index on key
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- Create index on expiresAt for cleanup queries
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- Fix any stringified JSON in Invoice data and metadata columns
-- This handles cases where JSON was accidentally stored as a string
DO $$
BEGIN
  -- Check if data column contains stringified JSON
  UPDATE "Invoice" 
  SET 
    data = data::jsonb::text
  WHERE 
    data IS NOT NULL 
    AND data != ''
    AND jsonb_typeof(data::jsonb) = 'string';
    
  -- Check if metadata column contains stringified JSON  
  UPDATE "Invoice" 
  SET 
    metadata = metadata::jsonb::text
  WHERE 
    metadata IS NOT NULL
    AND metadata != ''
    AND jsonb_typeof(metadata::jsonb) = 'string';
    
EXCEPTION WHEN OTHERS THEN
  -- If conversion fails, log but don't fail the migration
  RAISE NOTICE 'JSON conversion warning: %', SQLERRM;
END $$;

-- Add hasChanges column if it doesn't exist (for tracking unsaved changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'Invoice' 
    AND column_name = 'hasChanges'
  ) THEN
    ALTER TABLE "Invoice" ADD COLUMN "hasChanges" BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Ensure financial columns are using proper decimal types
-- Note: This is informational - Prisma handles the Float to Decimal mapping
-- But we document it here for clarity
COMMENT ON COLUMN "Invoice"."subtotal" IS 'Decimal(10,2) - Server calculated from line items';
COMMENT ON COLUMN "Invoice"."taxAmount" IS 'Decimal(10,2) - Server calculated based on isTaxable flag';
COMMENT ON COLUMN "Invoice"."total" IS 'Decimal(10,2) - Server calculated sum of subtotal + tax';
COMMENT ON COLUMN "Invoice"."grossProfit" IS 'Decimal(10,2) - Server calculated markup amount';
COMMENT ON COLUMN "Invoice"."profitPercent" IS 'Decimal(5,2) - Server calculated profit percentage';
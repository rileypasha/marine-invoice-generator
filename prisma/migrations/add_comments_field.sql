-- Add comments field to Invoice table
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "comments" TEXT;

-- Add index for better performance when searching comments (optional)
-- CREATE INDEX IF NOT EXISTS "Invoice_comments_idx" ON "Invoice" USING gin(to_tsvector('english', "comments"));
-- Clean up failed migration from database
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250825085919_add_master_dashboard_fields';

-- Drop tables if they exist (in case of partial creation)
DROP TABLE IF EXISTS "InvoiceRevision" CASCADE;
DROP TABLE IF EXISTS "InvoiceSubmission" CASCADE;
DROP TABLE IF EXISTS "Invoice" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
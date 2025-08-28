#!/bin/bash

echo "🚀 Starting production database migration for Changes Tracker..."
echo ""
echo "This script will add the following to the database:"
echo "  - hasChanges column to Invoice table"
echo "  - payloadJson column to InvoiceSubmission table"
echo "  - Rename columns in InvoiceRevision table"
echo "  - Create MasterChangeView table"
echo ""

# Run the migration
node /opt/render/project/src/server/migrations/run-migration.js

echo ""
echo "✅ Migration script completed!"
echo ""
echo "Note: Some operations may have been skipped if they already existed."
echo "Check the output above for any errors."
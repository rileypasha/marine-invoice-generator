-- Check for duplicate revision numbers per invoice
SELECT 
  invoiceId, 
  revisionNumber, 
  COUNT(*) as count
FROM "InvoiceRevision"
GROUP BY invoiceId, revisionNumber
HAVING COUNT(*) > 1;

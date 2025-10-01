-- Fix notification preference values that are boolean strings to proper scope values
UPDATE "User"
SET
  "notifyOnNewInvoice" = CASE
    WHEN "notifyOnNewInvoice" IN ('true', 'TRUE', '1') THEN 'all'
    WHEN "notifyOnNewInvoice" IN ('false', 'FALSE', '0') THEN 'none'
    WHEN "notifyOnNewInvoice" NOT IN ('none', 'own', 'all') THEN 'none'
    ELSE "notifyOnNewInvoice"
  END,
  "notifyOnChangeRequest" = CASE
    WHEN "notifyOnChangeRequest" IN ('true', 'TRUE', '1') THEN 'all'
    WHEN "notifyOnChangeRequest" IN ('false', 'FALSE', '0') THEN 'none'
    WHEN "notifyOnChangeRequest" NOT IN ('none', 'own', 'all') THEN 'none'
    ELSE "notifyOnChangeRequest"
  END,
  "notifyOnApproval" = CASE
    WHEN "notifyOnApproval" IN ('true', 'TRUE', '1') THEN 'all'
    WHEN "notifyOnApproval" IN ('false', 'FALSE', '0') THEN 'none'
    WHEN "notifyOnApproval" NOT IN ('none', 'own', 'all') THEN 'none'
    ELSE "notifyOnApproval"
  END;

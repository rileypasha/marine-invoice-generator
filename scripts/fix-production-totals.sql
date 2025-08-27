-- Fix invoice totals based on line items
-- These calculations are based on the line items in each invoice

-- Invoice 1: Clearance Fee (1250) + Good Stew (123) = 1373 × 2.5 markup = 3432.50
UPDATE "Invoice" 
SET subtotal = 3432.50, total = 3432.50, "taxAmount" = 0
WHERE id = 'inv_1756248046218_al1gdnlkb';

-- Invoice 2: Clearance Fee (1250) + Trash Removal (123) = 1373 × 2.5 markup = 3432.50
UPDATE "Invoice"
SET subtotal = 3432.50, total = 3432.50, "taxAmount" = 0  
WHERE id = 'inv_1756248917262_ig8byr57d';

-- Invoice 3: Clearance Fee (1250) only = 1250 × 2.5 markup = 3125.00
UPDATE "Invoice"
SET subtotal = 3125.00, total = 3125.00, "taxAmount" = 0
WHERE id = 'inv_1756271771724_geg1fza0e';

-- Verify the updates
SELECT id, "vesselName", "customerName", subtotal, total 
FROM "Invoice";
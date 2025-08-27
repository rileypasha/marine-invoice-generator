-- Security Fix: Clean up usernames that contain passwords
-- This script fixes existing data where passwords were accidentally stored as usernames

-- Step 1: Update the User table
-- Fix test user with password in name
UPDATE "User" 
SET name = 'Test User'
WHERE email = 'test@marinegroupbw.com' 
  AND name LIKE '%password%';

-- Fix rpasha user if needed (though it looks OK)
UPDATE "User"
SET name = 'Riley Pasha'  
WHERE email = 'rpasha@marinegroupbw.com'
  AND name = 'rypasha4269';

-- Step 2: Update all invoices with the corrected names
-- Fix invoices from test user
UPDATE "Invoice"
SET "userName" = 'Test User'
WHERE "userEmail" = 'test@marinegroupbw.com'
  AND "userName" LIKE '%password%';

-- Fix invoices from rpasha  
UPDATE "Invoice"
SET "userName" = 'Riley Pasha'
WHERE "userEmail" = 'rpasha@marinegroupbw.com'
  AND "userName" = 'rypasha4269';

-- Step 3: Verify the fixes
SELECT 'Users after fix:' as message;
SELECT id, email, name FROM "User";

SELECT 'Invoices after fix:' as message;
SELECT id, "userEmail", "userName", "invoiceNumber" FROM "Invoice";
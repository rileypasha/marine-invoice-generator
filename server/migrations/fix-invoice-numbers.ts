import { prisma } from '../db/client';

/**
 * Migration script to fix incorrect invoice numbers in the database.
 *
 * Issue: The generateNextInvoiceNumber function was using alphabetical string sorting
 * instead of numerical sorting, causing all invoices to be numbered "REQ-10".
 *
 * This script:
 * 1. Fetches all invoices sorted by creation date
 * 2. Renumbers them sequentially starting from REQ-1
 * 3. Updates each invoice with the correct number
 */

async function fixInvoiceNumbers() {
  console.log('Starting invoice number fix migration...');

  try {
    // Fetch all invoices ordered by creation date (oldest first)
    const allInvoices = await prisma.invoice.findMany({
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        invoiceNumber: true,
        createdAt: true
      }
    });

    console.log(`Found ${allInvoices.length} invoices to process`);

    if (allInvoices.length === 0) {
      console.log('No invoices found. Exiting.');
      return;
    }

    // Renumber all invoices sequentially
    let invoiceCounter = 1;
    for (const invoice of allInvoices) {
      const newInvoiceNumber = `REQ-${invoiceCounter}`;

      console.log(`Updating invoice ${invoice.id}: ${invoice.invoiceNumber || 'null'} -> ${newInvoiceNumber}`);

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { invoiceNumber: newInvoiceNumber }
      });

      invoiceCounter++;
    }

    console.log(`Successfully renumbered ${allInvoices.length} invoices`);
    console.log(`Next invoice number will be: REQ-${invoiceCounter}`);

  } catch (error) {
    console.error('Error fixing invoice numbers:', error);
    throw error;
  }
}

// Run the migration
fixInvoiceNumbers()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

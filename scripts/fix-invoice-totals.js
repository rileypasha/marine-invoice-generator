#!/usr/bin/env node

/**
 * Fix Invoice Totals
 * Recalculates totals for invoices that have line items but zero totals
 */

const { PrismaClient } = require('@prisma/client');
const { calculateInvoiceTotals } = require('../server/utils/invoice-calculator');

async function fixInvoiceTotals() {
  console.log('📊 Starting invoice totals fix...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Find invoices with zero or null totals
    const invoicesWithZeroTotals = await prisma.invoice.findMany({
      where: {
        OR: [
          { total: 0 },
          { total: null },
          { subtotal: 0 },
          { subtotal: null }
        ]
      },
      select: {
        id: true,
        invoiceNumber: true,
        data: true,
        total: true,
        subtotal: true,
        taxAmount: true
      }
    });
    
    console.log(`Found ${invoicesWithZeroTotals.length} invoices with zero/null totals\n`);
    
    let fixedCount = 0;
    
    for (const invoice of invoicesWithZeroTotals) {
      try {
        // Parse the data field
        const data = typeof invoice.data === 'string' ? 
          JSON.parse(invoice.data) : 
          invoice.data;
        
        // Calculate totals from line items
        const calculatedTotals = calculateInvoiceTotals(data);
        
        // Only update if we calculated non-zero values
        if (calculatedTotals.total > 0 || calculatedTotals.subtotal > 0) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              subtotal: calculatedTotals.subtotal,
              taxAmount: calculatedTotals.taxAmount,
              total: calculatedTotals.total
            }
          });
          
          console.log(`✅ Fixed invoice ${invoice.id}:`);
          console.log(`   Subtotal: $${calculatedTotals.subtotal.toFixed(2)}`);
          console.log(`   Tax: $${calculatedTotals.taxAmount.toFixed(2)}`);
          console.log(`   Total: $${calculatedTotals.total.toFixed(2)}\n`);
          
          fixedCount++;
        } else {
          console.log(`⚠️  Invoice ${invoice.id} has no line items or costs\n`);
        }
      } catch (err) {
        console.error(`❌ Error fixing invoice ${invoice.id}:`, err.message);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} invoices`);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixInvoiceTotals()
  .then(() => {
    console.log('🎉 Invoice totals fix completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
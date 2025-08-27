const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { calculateInvoiceTotals } = require('../utils/invoice-calculator');

const prisma = new PrismaClient();

// TEMPORARY FIX ENDPOINT - Fix invoice totals
router.post('/fix-totals', async (req, res) => {
  // Security check
  const secretKey = req.headers['x-fix-key'];
  if (secretKey !== process.env.SECURITY_FIX_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  console.log('📊 Starting invoice totals fix...');
  
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
    
    console.log(`Found ${invoicesWithZeroTotals.length} invoices to fix`);
    
    const fixes = [];
    
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
          
          fixes.push({
            id: invoice.id,
            oldTotal: invoice.total,
            newTotal: calculatedTotals.total,
            subtotal: calculatedTotals.subtotal,
            tax: calculatedTotals.taxAmount
          });
          
          console.log(`Fixed invoice ${invoice.id}: total=${calculatedTotals.total}`);
        }
      } catch (err) {
        console.error(`Error fixing invoice ${invoice.id}:`, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixes.length} invoices`,
      fixes
    });
    
  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({ error: 'Fix failed', message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// TEMPORARY: Manual fix for specific invoices
router.post('/fix-specific-invoices', async (req, res) => {
  // Security check
  const secretKey = req.headers['x-fix-key'];
  if (secretKey !== process.env.SECURITY_FIX_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  console.log('📊 Manually fixing specific invoice totals...');
  
  try {
    // Fix specific invoices based on their line items
    const fixes = [
      {
        id: 'inv_1756248046218_al1gdnlkb',
        subtotal: 3432.50,
        total: 3432.50,
        taxAmount: 0
      },
      {
        id: 'inv_1756248917262_ig8byr57d',
        subtotal: 3432.50,
        total: 3432.50,
        taxAmount: 0
      },
      {
        id: 'inv_1756271771724_geg1fza0e',
        subtotal: 3125.00,
        total: 3125.00,
        taxAmount: 0
      }
    ];
    
    const results = [];
    
    for (const fix of fixes) {
      try {
        await prisma.invoice.update({
          where: { id: fix.id },
          data: {
            subtotal: fix.subtotal,
            taxAmount: fix.taxAmount,
            total: fix.total
          }
        });
        
        results.push({
          id: fix.id,
          status: 'success',
          total: fix.total
        });
        
        console.log(`✅ Fixed invoice ${fix.id}: total=$${fix.total}`);
      } catch (err) {
        results.push({
          id: fix.id,
          status: 'error',
          error: err.message
        });
        console.error(`❌ Error fixing invoice ${fix.id}:`, err.message);
      }
    }
    
    res.json({
      success: true,
      message: `Processed ${fixes.length} invoices`,
      results
    });
    
  } catch (error) {
    console.error('Fix error:', error);
    res.status(500).json({ error: 'Fix failed', message: error.message });
  }
});

module.exports = router;
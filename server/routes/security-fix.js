const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// TEMPORARY SECURITY FIX ENDPOINT - REMOVE AFTER RUNNING
router.post('/fix-password-names', async (req, res) => {
  // Security check - only allow from specific IP or with secret key
  const secretKey = req.headers['x-security-fix-key'];
  if (secretKey !== process.env.SECURITY_FIX_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  console.log('🔐 SECURITY FIX: Starting password name cleanup...');
  
  try {
    // Find users with suspicious names
    const allUsers = await prisma.user.findMany();
    const fixes = [];
    
    for (const user of allUsers) {
      if (!user.name) continue;
      
      const name = String(user.name);
      let newName = null;
      
      // Check if name contains "password"
      if (name.toLowerCase().includes('password')) {
        newName = user.email === 'test@marinegroupbw.com' ? 'Test User' : user.email.split('@')[0];
        console.log(`  Found password in name for ${user.email}`);
      }
      // Check if name looks like a password
      else if (/\d/.test(name) && (name.length > 20 || /[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?]/.test(name))) {
        // Special case for known users
        if (user.email === 'rpasha@marinegroupbw.com') {
          newName = 'Riley Pasha';
        } else {
          newName = user.email.split('@')[0];
        }
        console.log(`  Found suspicious name for ${user.email}`);
      }
      
      if (newName) {
        fixes.push({ user, newName });
      }
    }
    
    // Apply fixes
    for (const { user, newName } of fixes) {
      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newName }
      });
      
      // Update invoices
      const invoiceCount = await prisma.invoice.updateMany({
        where: { 
          OR: [
            { userId: user.id },
            { userEmail: user.email }
          ]
        },
        data: { userName: newName }
      });
      
      console.log(`  Fixed ${user.email}: ${invoiceCount.count} invoices updated`);
    }
    
    res.json({ 
      success: true, 
      message: `Fixed ${fixes.length} users`,
      fixes: fixes.map(f => ({ email: f.user.email, newName: f.newName }))
    });
    
  } catch (error) {
    console.error('Security fix error:', error);
    res.status(500).json({ error: 'Fix failed', message: error.message });
  }
});

// Endpoint to check for password exposure
router.get('/check-password-exposure', async (req, res) => {
  try {
    const suspiciousUsers = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'password' } },
          { name: { contains: 'Password' } }
        ]
      },
      select: { email: true, name: true }
    });
    
    const suspiciousInvoices = await prisma.invoice.count({
      where: {
        OR: [
          { userName: { contains: 'password' } },
          { userName: { contains: 'Password' } }
        ]
      }
    });
    
    res.json({
      exposed: suspiciousUsers.length > 0 || suspiciousInvoices > 0,
      users: suspiciousUsers.map(u => ({ email: u.email, nameLength: u.name?.length })),
      invoiceCount: suspiciousInvoices
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
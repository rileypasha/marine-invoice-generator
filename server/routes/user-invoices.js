const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { loadUser } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * GET /api/invoices/user
 * Get all invoices for the current logged-in user
 * This endpoint is used to sync localStorage with server data
 */
router.get('/user', loadUser, async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userEmail = req.user.email;
    const userId = req.user.id;
    
    console.log(`📥 Fetching invoices for user: ${userEmail} (ID: ${userId})`);
    
    // Fetch all invoices for this user (by email OR userId)
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userEmail: userEmail },
          { userId: userId },
          // Also check for string version of ID
          { userId: userId.toString() }
        ],
        // Only get saved/submitted invoices, not drafts
        status: {
          in: ['saved', 'submitted', 'completed']
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    console.log(`✅ Found ${invoices.length} invoices for ${userEmail}`);
    
    // Transform the invoices to match the localStorage format
    const transformedInvoices = invoices.map(inv => {
      // Parse the data field if it's a string
      let parsedData = {};
      if (inv.data) {
        try {
          parsedData = typeof inv.data === 'string' ? JSON.parse(inv.data) : inv.data;
        } catch (e) {
          console.error('Failed to parse invoice data:', e);
        }
      }
      
      return {
        id: inv.id,
        title: inv.title || `Invoice ${inv.invoiceNumber || inv.id}`,
        status: inv.status || 'saved',
        userId: inv.userId || userId,
        userEmail: inv.userEmail || userEmail,
        userName: inv.userName,
        data: parsedData,
        metadata: {
          vesselName: inv.vesselName || parsedData.vessel?.name || '',
          customerName: inv.customerName || parsedData.customer?.customerName || '',
          customerEmail: inv.customerEmail || parsedData.customer?.customerEmail || '',
          total: inv.total || parsedData.scope?.total || 0,
          savedAt: inv.savedAt,
          submittedAt: inv.submittedAt
        },
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        serverId: inv.id // Keep track of server ID
      };
    });
    
    res.json(transformedInvoices);
    
  } catch (error) {
    console.error('❌ Error fetching user invoices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch invoices',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
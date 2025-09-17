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
      console.log('❌ No user in request');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userEmail = req.user.email;
    const userId = req.user.id;

    console.log(`📥 Fetching invoices for user: ${userEmail} (ID: ${userId})`);
    console.log(`🔍 User object:`, req.user);

    // Build query conditions safely
    const whereConditions = [];

    if (userEmail) {
      whereConditions.push({ userEmail: userEmail });
    }

    if (userId) {
      whereConditions.push({ userId: userId });
      // Only add string version if userId exists and is not already a string
      if (typeof userId !== 'string') {
        whereConditions.push({ userId: userId.toString() });
      }
    }

    if (whereConditions.length === 0) {
      console.log('❌ No valid user identifiers found');
      return res.status(400).json({ error: 'Invalid user data' });
    }

    console.log(`🔍 Query conditions:`, whereConditions);

    // Fetch all invoices for this user
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: whereConditions,
        // Only get saved invoices, exclude drafts (match master dashboard behavior)
        status: {
          not: 'draft'
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
    console.error('❌ Error fetching user invoices:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      userEmail: req.user?.email,
      userId: req.user?.id
    });
    res.status(500).json({
      error: 'Failed to fetch invoices',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/invoices/:id/comment
 * Add a comment to an invoice
 */
router.post('/:id/comment', loadUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id: invoiceId } = req.params;
    const { comment, author, authorEmail, timestamp } = req.body;

    console.log(`💬 Adding comment to invoice ${invoiceId} by ${author}`);

    // Find the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Parse existing data
    const invoiceData = invoice.data || {};
    if (!invoiceData.notes) {
      invoiceData.notes = {};
    }
    if (!invoiceData.notes.comments) {
      invoiceData.notes.comments = [];
    }

    // Add new comment
    const newComment = {
      id: Date.now().toString(),
      text: comment,
      author: author,
      authorEmail: authorEmail,
      timestamp: timestamp || new Date().toISOString(),
      replies: []
    };

    invoiceData.notes.comments.push(newComment);

    // Update the invoice
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        data: invoiceData,
        updatedAt: new Date()
      }
    });

    console.log('✅ Comment added successfully');
    res.json({ success: true, comment: newComment });

  } catch (error) {
    console.error('❌ Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Invoice endpoints - Use session auth instead of API key
router.post('/invoice/save', requireAuth, async (req, res) => {
  try {
    const { title, data, metadata } = req.body;
    
    // Extract fields from data for dashboard display
    let extractedFields = {};
    if (data) {
      extractedFields = {
        // User info from session - CRITICAL: properly set userId
        userId: req.user.id || req.session?.user?.id,
        userName: req.user.name || data.estimatorName || data.estimator?.name,
        userEmail: req.user.email || data.estimatorEmail || data.estimator?.email,
        
        // Vessel info - handle both nested and flat structures
        vesselName: data.vesselName || data.vessel?.name || null,
        vesselWeight: (data.vesselWeight || data.vessel?.weight) ? parseFloat(data.vesselWeight || data.vessel?.weight) : null,
        vesselBeam: (data.vesselBeam || data.vessel?.beam) ? parseFloat(data.vesselBeam || data.vessel?.beam) : null,
        
        // Customer info - handle both nested and flat structures
        customerName: data.customerName || data.customer?.customerName || null,
        customerEmail: data.customerEmail || data.customer?.customerEmail || null,
        customerPhone: data.customerPhone || data.customer?.customerPhone || null,
        
        // Financial info
        subtotal: data.subtotal ? parseFloat(data.subtotal) : 0,
        taxAmount: data.taxAmount ? parseFloat(data.taxAmount) : 0,
        total: data.total ? parseFloat(data.total) : 0,
        grossProfit: data.grossProfit ? parseFloat(data.grossProfit) : 0,
        profitPercent: data.profitPercent ? parseFloat(data.profitPercent) : 0,
        
        // Additional fields
        market: data.market || null,
        invoiceNumber: data.invoiceNumber || null,
        status: 'saved', // Mark as saved when user saves
        savedAt: new Date()
      };
    }
    
    const invoice = await prisma.invoice.create({
      data: {
        title: title || 'Untitled Invoice',
        data: JSON.stringify(data),
        metadata: metadata ? JSON.stringify(metadata) : null,
        ...extractedFields
      }
    });
    
    // Log successful save for debugging
    console.log('✅ Invoice saved successfully:', {
      id: invoice.id,
      userId: invoice.userId,
      userName: invoice.userName,
      userEmail: invoice.userEmail,
      vesselName: invoice.vesselName,
      status: invoice.status,
      savedAt: invoice.savedAt
    });
    
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('Error saving invoice:', error);
    res.status(500).json({ error: 'Failed to save invoice' });
  }
});

router.get('/invoice/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        submissions: true,
        revisions: true
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.put('/invoice/:id', requireAuth, async (req, res) => {
  try {
    const { title, data, metadata, status } = req.body;
    
    // Extract fields from data for dashboard display
    let extractedFields = {};
    if (data) {
      extractedFields = {
        // User info from session - preserve userId on updates
        userName: req.user.name || data.estimatorName || data.estimator?.name,
        userEmail: req.user.email || data.estimatorEmail || data.estimator?.email,
        
        // Vessel info - handle both nested and flat structures
        vesselName: data.vesselName || data.vessel?.name || null,
        vesselWeight: (data.vesselWeight || data.vessel?.weight) ? parseFloat(data.vesselWeight || data.vessel?.weight) : null,
        vesselBeam: (data.vesselBeam || data.vessel?.beam) ? parseFloat(data.vesselBeam || data.vessel?.beam) : null,
        
        // Customer info - handle both nested and flat structures
        customerName: data.customerName || data.customer?.customerName || null,
        customerEmail: data.customerEmail || data.customer?.customerEmail || null,
        customerPhone: data.customerPhone || data.customer?.customerPhone || null,
        
        // Financial info
        subtotal: data.subtotal ? parseFloat(data.subtotal) : 0,
        taxAmount: data.taxAmount ? parseFloat(data.taxAmount) : 0,
        total: data.total ? parseFloat(data.total) : 0,
        grossProfit: data.grossProfit ? parseFloat(data.grossProfit) : 0,
        profitPercent: data.profitPercent ? parseFloat(data.profitPercent) : 0,
        
        // Additional fields
        market: data.market || null,
        invoiceNumber: data.invoiceNumber || null,
        savedAt: new Date()
      };
    }
    
    const updateData = {
      title,
      data: data ? JSON.stringify(data) : undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      status: status || 'saved',
      ...extractedFields
    };
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );
    
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    res.json({ success: true, invoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.delete('/invoice/:id', requireAuth, async (req, res) => {
  try {
    await prisma.invoice.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const { status, userId, limit = 50, offset = 0 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    
    const invoices = await prisma.invoice.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

module.exports = router;
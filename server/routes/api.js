const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');
const { calculateInvoiceTotals } = require('../utils/invoice-calculator');

const prisma = new PrismaClient();

// Invoice endpoints - Use session auth instead of API key
router.post('/invoice/save', requireAuth, async (req, res) => {
  const requestId = req.headers['x-request-id'] || `srv_${Date.now()}`;
  const startTime = Date.now();
  
  console.log(`\n========== INVOICE SAVE START [${requestId}] ==========`);
  console.log(`📥 Request received at:`, new Date().toISOString());
  console.log(`👤 User context:`, {
    userId: req.user?.id,
    userEmail: req.user?.email,
    userName: req.user?.name,
    userRole: req.user?.role,
    sessionId: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.user
  });
  
  try {
    const { title, data, metadata } = req.body;
    
    console.log(`📋 [${requestId}] Request body:`, {
      title,
      hasData: !!data,
      dataType: typeof data,
      dataKeys: data ? Object.keys(data) : [],
      metadata
    });
    
    // Log the actual data structure
    if (data) {
      console.log(`🔍 [${requestId}] Data structure analysis:`);
      console.log(`  - Has vessel:`, !!data.vessel, data.vessel ? Object.keys(data.vessel) : []);
      console.log(`  - Has customer:`, !!data.customer, data.customer ? Object.keys(data.customer) : []);
      console.log(`  - Has estimator:`, !!data.estimator, data.estimator ? Object.keys(data.estimator) : []);
      console.log(`  - Has flat vesselName:`, !!data.vesselName);
      console.log(`  - Has flat customerName:`, !!data.customerName);
    }
    
    // CRITICAL: Ensure user is properly authenticated
    if (!req.user || !req.user.id) {
      console.error(`❌ [${requestId}] NO USER CONTEXT! Session might be lost.`);
      console.error(`  Session details:`, {
        sessionID: req.sessionID,
        session: req.session,
        cookies: req.cookies
      });
      
      // Try to restore from session
      if (req.session?.user) {
        req.user = req.session.user;
        console.log(`🔧 [${requestId}] Restored user from session:`, req.user);
      } else {
        console.error(`❌ [${requestId}] FATAL: Cannot save without user context`);
        return res.status(401).json({ 
          error: 'Authentication required. Please login again.',
          requestId 
        });
      }
    }
    
    // Extract fields from data for dashboard display
    let extractedFields = {};
    if (data) {
      extractedFields = {
        // User info from session - CRITICAL: properly set userId
        userId: req.user.id,  // This MUST have a value now
        userName: req.user.name || data.estimatorName || data.estimator?.name,
        userEmail: req.user.email || data.estimatorEmail || data.estimator?.email,

        // Vessel info - handle both nested and flat structures, plus vesselId linking
        vesselId: data.vesselId || data.vessel?.id || null,
        vesselName: data.vesselName || data.vessel?.name || null,
        vesselWeight: (data.vesselWeight || data.vessel?.weight) ? parseFloat(data.vesselWeight || data.vessel?.weight) : null,
        vesselBeam: (data.vesselBeam || data.vessel?.beam) ? parseFloat(data.vesselBeam || data.vessel?.beam) : null,
        
        // Customer info - handle both nested and flat structures
        customerName: data.customerName || data.customer?.customerName || null,
        customerEmail: data.customerEmail || data.customer?.customerEmail || null,
        customerPhone: data.customerPhone || data.customer?.customerPhone || null,
        
        // Financial info - Calculate from line items if not provided
        ...calculateInvoiceTotals(data),
        grossProfit: data.grossProfit ? parseFloat(data.grossProfit) : 0,
        profitPercent: data.profitPercent ? parseFloat(data.profitPercent) : 0,
        
        // Additional fields
        market: data.market || null,
        invoiceNumber: data.invoiceNumber || null,
        status: 'saved', // Mark as saved when user saves
        savedAt: new Date()
      };
    }
    
    console.log(`💾 [${requestId}] Extracted fields for save:`, extractedFields);
    
    // Build invoice data
    const invoiceData = {
      title: title || 'Untitled Invoice',
      data: JSON.stringify(data),
      metadata: metadata ? JSON.stringify(metadata) : null,
      ...extractedFields
    };
    
    // Try to create with hasChanges field first (new schema)
    let invoice;
    try {
      invoice = await prisma.invoice.create({
        data: {
          ...invoiceData,
          hasChanges: false // New invoices don't have changes yet
        }
      });
    } catch (error) {
      // If hasChanges column doesn't exist, use raw SQL (old schema)
      if (error.message && error.message.includes('hasChanges') && error.message.includes('does not exist')) {
        console.log(`⚠️ [${requestId}] Database missing hasChanges column, using raw SQL fallback`);
        
        // Generate a unique ID
        const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Use raw SQL to insert without hasChanges column
        // Note: Using COALESCE for optional fields to handle nulls properly
        const now = new Date();
        const result = await prisma.$executeRaw`
          INSERT INTO "Invoice" (
            id, title, data, metadata, status,
            "userId", "userName", "userEmail",
            "vesselId", "vesselName", "vesselWeight", "vesselBeam",
            "customerName", "customerEmail", "customerPhone",
            subtotal, "taxAmount", total, "grossProfit", "profitPercent",
            market, "invoiceNumber", "savedAt", "createdAt", "updatedAt"
          ) VALUES (
            ${id},
            ${invoiceData.title},
            ${invoiceData.data},
            ${invoiceData.metadata || null},
            ${invoiceData.status},
            ${invoiceData.userId || null},
            ${invoiceData.userName || null},
            ${invoiceData.userEmail || null},
            ${invoiceData.vesselId || null},
            ${invoiceData.vesselName || null},
            ${invoiceData.vesselWeight || null},
            ${invoiceData.vesselBeam || null},
            ${invoiceData.customerName || null},
            ${invoiceData.customerEmail || null},
            ${invoiceData.customerPhone || null},
            ${invoiceData.subtotal || 0},
            ${invoiceData.taxAmount || 0},
            ${invoiceData.total || 0},
            ${invoiceData.grossProfit || 0},
            ${invoiceData.profitPercent || 0},
            ${invoiceData.market || null},
            ${invoiceData.invoiceNumber || null},
            ${invoiceData.savedAt || now},
            ${now},
            ${now}
          )
        `;
        
        // Fetch the created invoice
        const invoices = await prisma.$queryRaw`
          SELECT * FROM "Invoice" WHERE id = ${id}
        `;
        
        if (invoices && invoices.length > 0) {
          invoice = invoices[0];
          console.log(`✅ [${requestId}] Invoice created using raw SQL fallback`);
        } else {
          throw new Error('Failed to create invoice with raw SQL');
        }
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }
    
    // Log successful save for debugging
    const duration = Date.now() - startTime;
    console.log(`✅ [${requestId}] INVOICE SAVED SUCCESSFULLY!`);
    console.log(`  📊 Save details:`, {
      id: invoice.id,
      userId: invoice.userId,
      userName: invoice.userName,
      userEmail: invoice.userEmail,
      vesselName: invoice.vesselName,
      status: invoice.status,
      savedAt: invoice.savedAt,
      duration: `${duration}ms`
    });
    console.log(`========== INVOICE SAVE END [${requestId}] ==========\n`);
    
    res.json({ success: true, invoice, requestId });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [${requestId}] Error saving invoice after ${duration}ms:`, error);
    console.error(`  Error stack:`, error.stack);
    console.error(`  Error details:`, {
      name: error.name,
      message: error.message,
      code: error.code
    });
    console.log(`========== INVOICE SAVE FAILED [${requestId}] ==========\n`);
    
    res.status(500).json({ 
      error: 'Failed to save invoice',
      details: error.message,
      requestId 
    });
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

        // Vessel info - handle both nested and flat structures, plus vesselId linking
        vesselId: data.vesselId || data.vessel?.id || null,
        vesselName: data.vesselName || data.vessel?.name || null,
        vesselWeight: (data.vesselWeight || data.vessel?.weight) ? parseFloat(data.vesselWeight || data.vessel?.weight) : null,
        vesselBeam: (data.vesselBeam || data.vessel?.beam) ? parseFloat(data.vesselBeam || data.vessel?.beam) : null,
        
        // Customer info - handle both nested and flat structures
        customerName: data.customerName || data.customer?.customerName || null,
        customerEmail: data.customerEmail || data.customer?.customerEmail || null,
        customerPhone: data.customerPhone || data.customer?.customerPhone || null,
        
        // Financial info - Calculate from line items if not provided
        ...calculateInvoiceTotals(data),
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
    
    // Try to update with hasChanges field first (new schema)
    let invoice;
    try {
      invoice = await prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          ...updateData,
          hasChanges: true // Mark as having changes
        }
      });
    } catch (error) {
      // If hasChanges column doesn't exist, use raw SQL (old schema)
      if (error.message && error.message.includes('hasChanges') && error.message.includes('does not exist')) {
        console.log('⚠️ Update: Database missing hasChanges column, using raw SQL fallback');
        
        // Build dynamic UPDATE using Prisma's raw query with proper parameterization
        const updates = [];
        const now = new Date();
        
        // Build the SET clause dynamically
        let updateQuery = 'UPDATE "Invoice" SET ';
        const setClauses = [];
        
        // Always update these fields
        setClauses.push('"updatedAt" = $1');
        const params = [now];
        let paramIndex = 2;
        
        // Add other fields if they exist
        if (updateData.title !== undefined) {
          setClauses.push(`title = $${paramIndex}`);
          params.push(updateData.title);
          paramIndex++;
        }
        if (updateData.data !== undefined) {
          setClauses.push(`data = $${paramIndex}`);
          params.push(updateData.data);
          paramIndex++;
        }
        if (updateData.metadata !== undefined) {
          setClauses.push(`metadata = $${paramIndex}`);
          params.push(updateData.metadata);
          paramIndex++;
        }
        if (updateData.status !== undefined) {
          setClauses.push(`status = $${paramIndex}`);
          params.push(updateData.status);
          paramIndex++;
        }
        
        // Add extracted fields
        const fields = [
          'userName', 'userEmail', 'vesselId', 'vesselName', 'vesselWeight', 'vesselBeam',
          'customerName', 'customerEmail', 'customerPhone',
          'subtotal', 'taxAmount', 'total', 'grossProfit', 'profitPercent',
          'market', 'invoiceNumber', 'savedAt'
        ];
        
        fields.forEach(field => {
          if (updateData[field] !== undefined) {
            setClauses.push(`"${field}" = $${paramIndex}`);
            params.push(updateData[field]);
            paramIndex++;
          }
        });
        
        // Complete the query
        updateQuery += setClauses.join(', ');
        updateQuery += ` WHERE id = $${paramIndex}`;
        params.push(req.params.id);
        
        // Execute the update using parameterized query
        await prisma.$executeRawUnsafe(updateQuery, ...params);
        
        // Fetch the updated invoice
        const invoices = await prisma.$queryRaw`
          SELECT * FROM "Invoice" WHERE id = ${req.params.id}
        `;
        
        if (invoices && invoices.length > 0) {
          invoice = invoices[0];
          console.log('✅ Invoice updated using raw SQL fallback');
        } else {
          throw new Error('Failed to fetch updated invoice');
        }
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }
    
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

// Health check endpoint - verify save capability
router.get('/health/save-status', async (req, res) => {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    database: 'unknown',
    sessionStore: 'unknown',
    lastSuccessfulSave: null,
    totalInvoices: 0,
    recentSaves: []
  };
  
  try {
    // Check database connection
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    healthStatus.database = 'connected';
    
    // Get total invoices
    healthStatus.totalInvoices = await prisma.invoice.count();
    
    // Get recent saves
    const recentInvoices = await prisma.invoice.findMany({
      orderBy: { savedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        userId: true,
        userEmail: true,
        savedAt: true,
        status: true
      }
    });
    
    healthStatus.recentSaves = recentInvoices;
    if (recentInvoices.length > 0) {
      healthStatus.lastSuccessfulSave = recentInvoices[0].savedAt;
    }
    
    // Check session store
    healthStatus.sessionStore = req.session ? 'available' : 'unavailable';
    
    res.json({
      status: 'healthy',
      ...healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    healthStatus.database = 'error: ' + error.message;
    
    res.status(503).json({
      status: 'unhealthy',
      ...healthStatus,
      error: error.message
    });
  }
});

// Debug endpoint - test save with minimal data
router.post('/debug/test-save', requireAuth, async (req, res) => {
  const testId = `test_${Date.now()}`;
  
  try {
    console.log('🧪 DEBUG: Test save initiated');
    console.log('  User:', req.user);
    console.log('  Session:', !!req.session);
    
    // Build test invoice data
    const testData = {
      title: `Debug Test ${testId}`,
      data: JSON.stringify({ debug: true, testId }),
      status: 'saved',
      userId: req.user?.id || null,
      userEmail: req.user?.email || 'debug@test.com',
      vesselName: 'DEBUG_TEST',
      savedAt: new Date()
    };
    
    // Try with hasChanges first, fallback without if column missing
    let testInvoice;
    try {
      testInvoice = await prisma.invoice.create({
        data: { ...testData, hasChanges: false }
      });
    } catch (error) {
      if (error.message && error.message.includes('hasChanges')) {
        console.log('⚠️ DEBUG: hasChanges column missing, using fallback');
        testInvoice = await prisma.invoice.create({
          data: testData
        });
      } else {
        throw error;
      }
    }
    
    console.log('🧪 DEBUG: Test save successful:', testInvoice.id);
    
    // Try to retrieve it
    const retrieved = await prisma.invoice.findUnique({
      where: { id: testInvoice.id }
    });
    
    res.json({
      success: true,
      testId,
      saved: testInvoice,
      retrieved: !!retrieved,
      userContext: {
        hasUser: !!req.user,
        userId: req.user?.id,
        userEmail: req.user?.email
      }
    });
  } catch (error) {
    console.error('🧪 DEBUG: Test save failed:', error);
    res.status(500).json({
      success: false,
      testId,
      error: error.message,
      userContext: {
        hasUser: !!req.user,
        userId: req.user?.id
      }
    });
  }
});

module.exports = router;
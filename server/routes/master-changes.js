/**
 * Master-Only Change Tracking API Routes
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { computeInvoiceDiff, formatDiffForDisplay } = require('../utils/diff-engine');
const { markChangesSeen, hasUnseenChanges } = require('../middleware/revision-tracker');
const { requireMaster } = require('../middleware/auth');
const logger = require('pino')();

const router = express.Router();
const prisma = new PrismaClient();

// All routes require master authentication
router.use(requireMaster);

/**
 * GET /api/master/invoices
 * List invoices with change tracking info
 */
router.get('/invoices', async (req, res) => {
  try {
    const { 
      hasChanges, 
      search, 
      page = 1, 
      limit = 20,
      startDate,
      endDate 
    } = req.query;
    
    const masterEmail = req.session.user.email;
    
    // Build filter conditions
    const where = {};
    
    if (hasChanges === 'true') {
      where.hasChanges = true;
    }
    
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { vesselName: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate);
      if (endDate) where.submittedAt.lte = new Date(endDate);
    }
    
    // Get total count
    const total = await prisma.invoice.count({ where });
    
    // Get paginated invoices
    const invoices = await prisma.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: { submittedAt: 'desc' },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        changeViews: {
          where: { masterEmail }
        }
      }
    });
    
    // Format response with unseenChanges flag
    const formattedInvoices = await Promise.all(invoices.map(async (invoice) => {
      const latestRevision = invoice.revisions[0];
      const unseenChanges = invoice.hasChanges && latestRevision && 
        !invoice.changeViews.some(view => view.latestRevisionId === latestRevision.id);
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        vesselName: invoice.vesselName,
        submittedAt: invoice.submittedAt,
        total: invoice.total,
        status: invoice.status,
        hasChanges: invoice.hasChanges,
        unseenChanges,
        lastChangeAt: latestRevision?.createdAt
      };
    }));
    
    res.json({
      invoices: formattedInvoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching master invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/master/invoices/:id/diff
 * Get diff between submission and latest version
 */
router.get('/invoices/:id/diff', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice with submission and latest revision
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        submissions: true,
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    if (!invoice.submissions[0]) {
      return res.status(400).json({ error: 'No submission baseline found' });
    }
    
    // Get baseline and current data
    const baseline = invoice.submissions[0].payloadJson;
    
    // Use latest revision if available, otherwise use current invoice data
    let current;
    if (invoice.revisions[0]) {
      current = invoice.revisions[0].payloadJson;
    } else {
      // Parse current invoice data
      current = typeof invoice.data === 'string' 
        ? JSON.parse(invoice.data) 
        : invoice.data;
    }
    
    // Compute diff
    const diff = computeInvoiceDiff(baseline, current);
    const formatted = formatDiffForDisplay(diff);
    
    // Log diff request
    logger.info('Diff requested', {
      invoiceId: id,
      masterEmail: req.session.user.email,
      changeCount: diff.changes.length
    });
    
    res.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName
      },
      baseline: {
        submittedAt: invoice.submissions[0].submittedAt,
        submittedBy: invoice.submissions[0].submittedBy
      },
      latestRevision: invoice.revisions[0] ? {
        revisionId: invoice.revisions[0].id,
        createdAt: invoice.revisions[0].createdAt,
        actorEmail: invoice.revisions[0].actorEmail,
        revisionNumber: invoice.revisions[0].revisionNumber
      } : null,
      diff: formatted
    });
    
  } catch (error) {
    logger.error('Error computing diff:', error);
    res.status(500).json({ error: 'Failed to compute diff' });
  }
});

/**
 * POST /api/master/invoices/:id/mark-changes-seen
 * Mark changes as viewed by master
 */
router.post('/invoices/:id/mark-changes-seen', async (req, res) => {
  try {
    const { id } = req.params;
    const masterEmail = req.session.user.email;
    
    const result = await markChangesSeen(id, masterEmail);
    
    res.json(result);
    
  } catch (error) {
    logger.error('Error marking changes as seen:', error);
    res.status(500).json({ error: 'Failed to mark changes as seen' });
  }
});

/**
 * GET /api/master/invoices/:id
 * Get full invoice detail (read-only)
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        submissions: {
          orderBy: { submittedAt: 'desc' }
        },
        revisions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Parse invoice data
    const invoiceData = typeof invoice.data === 'string' 
      ? JSON.parse(invoice.data) 
      : invoice.data;
    
    res.json({
      ...invoice,
      data: invoiceData,
      revisionCount: invoice.revisions.length,
      hasUnseenChanges: await hasUnseenChanges(id, req.session.user.email)
    });
    
  } catch (error) {
    logger.error('Error fetching invoice detail:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/master/stats
 * Get dashboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await prisma.invoice.groupBy({
      by: ['hasChanges'],
      _count: true
    });
    
    const totalWithChanges = stats.find(s => s.hasChanges === true)?._count || 0;
    const totalWithoutChanges = stats.find(s => s.hasChanges === false)?._count || 0;
    
    res.json({
      totalInvoices: totalWithChanges + totalWithoutChanges,
      invoicesWithChanges: totalWithChanges,
      invoicesWithoutChanges: totalWithoutChanges
    });
    
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
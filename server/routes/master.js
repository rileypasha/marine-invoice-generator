const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireMaster } = require('../middleware/auth');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * GET /api/master/invoices
 * Get paginated list of saved invoices
 */
router.get('/invoices', requireMaster, async (req, res) => {
  try {
    const {
      status = 'saved',
      search = '',
      page = 1,
      limit = 20,
      dateFrom,
      dateTo,
      market,
      sortBy = 'savedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause - Include ALL saved/submitted invoices
    const where = {};
    
    // Status filter
    const statusConditions = [];
    if (status && status !== 'all') {
      statusConditions.push({ status: status });
    } else if (!status) {
      // Default: show both saved and submitted invoices
      statusConditions.push({ status: 'saved' });
      statusConditions.push({ status: 'submitted' });
    }

    // Add search condition
    if (search) {
      const searchConditions = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { vesselName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { userEmail: { contains: search, mode: 'insensitive' } }
      ];
      
      // Combine status and search conditions
      if (statusConditions.length > 0) {
        where.AND = [
          { OR: statusConditions },
          { OR: searchConditions }
        ];
      } else {
        where.OR = searchConditions;
      }
    } else if (statusConditions.length > 0) {
      if (statusConditions.length === 1) {
        Object.assign(where, statusConditions[0]);
      } else {
        where.OR = statusConditions;
      }
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      where.savedAt = {};
      if (dateFrom) {
        where.savedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.savedAt.lte = new Date(dateTo);
      }
    }

    // Add market filter
    if (market) {
      where.market = market;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get total count
    const total = await prisma.invoice.count({ where });

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder
      },
      select: {
        id: true,
        userId: true, // Include userId to track invoice ownership
        invoiceNumber: true,
        status: true,
        savedAt: true,
        userName: true,
        userEmail: true,
        vesselName: true,
        customerName: true,
        customerEmail: true,
        market: true,
        total: true,
        grossProfit: true,
        profitPercent: true,
        hasChanges: true, // Include change tracking flag
        createdAt: true,
        updatedAt: true
      }
    });

    // Log successful access
    logger.info({
      event: 'MASTER_LIST_VIEW',
      email: req.user.email,
      resultsCount: invoices.length,
      page: parseInt(page),
      timestamp: new Date().toISOString()
    });

    res.json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error({
      event: 'MASTER_LIST_ERROR',
      error: error.message,
      email: req.user.email
    });
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/master/invoices/:id
 * Get detailed invoice by ID
 */
router.get('/invoices/:id', requireMaster, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        submissions: {
          orderBy: {
            submittedAt: 'desc'
          },
          take: 5
        },
        revisions: {
          orderBy: {
            changedAt: 'desc'
          },
          take: 5
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Parse the JSON data field if it exists
    let invoiceData = {};
    try {
      invoiceData = invoice.data ? JSON.parse(invoice.data) : {};
    } catch (e) {
      logger.warn({
        event: 'INVOICE_DATA_PARSE_ERROR',
        invoiceId: id,
        error: e.message
      });
    }

    // Log detailed view access
    logger.info({
      event: 'MASTER_DETAIL_VIEW',
      email: req.user.email,
      invoiceId: id,
      timestamp: new Date().toISOString()
    });

    res.json({
      ...invoice,
      parsedData: invoiceData
    });
  } catch (error) {
    logger.error({
      event: 'MASTER_DETAIL_ERROR',
      error: error.message,
      email: req.user.email,
      invoiceId: req.params.id
    });
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

/**
 * GET /api/master/invoices/:id/export.csv
 * Export invoice as CSV
 */
router.get('/invoices/:id/export.csv', requireMaster, async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Parse invoice data
    let invoiceData = {};
    try {
      invoiceData = invoice.data ? JSON.parse(invoice.data) : {};
    } catch (e) {
      invoiceData = {};
    }

    // Build CSV content
    const csvRows = [
      ['Invoice Export'],
      ['Generated', new Date().toISOString()],
      [''],
      ['Invoice Details'],
      ['Invoice Number', invoice.invoiceNumber || 'N/A'],
      ['Status', invoice.status],
      ['Saved At', invoice.savedAt],
      [''],
      ['Vessel Information'],
      ['Vessel Name', invoice.vesselName || 'N/A'],
      ['Vessel Weight', invoice.vesselWeight || 'N/A'],
      ['Vessel Beam', invoice.vesselBeam || 'N/A'],
      [''],
      ['Customer Information'],
      ['Customer Name', invoice.customerName || 'N/A'],
      ['Customer Email', invoice.customerEmail || 'N/A'],
      ['Customer Phone', invoice.customerPhone || 'N/A'],
      [''],
      ['Financial Summary'],
      ['Subtotal', invoice.subtotal || 0],
      ['Tax Amount', invoice.taxAmount || 0],
      ['Total', invoice.total || 0],
      ['Gross Profit', invoice.grossProfit || 0],
      ['Profit Percent', `${invoice.profitPercent || 0}%`]
    ];

    // Add line items if available
    if (invoiceData.lineItems && Array.isArray(invoiceData.lineItems)) {
      csvRows.push(['']);
      csvRows.push(['Line Items']);
      csvRows.push(['Description', 'Type', 'Cost']);
      
      invoiceData.lineItems.forEach(item => {
        csvRows.push([
          item.description || 'N/A',
          item.type || 'N/A',
          item.cost || 0
        ]);
      });
    }

    // Convert to CSV string
    const csvContent = csvRows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Log export
    logger.info({
      event: 'MASTER_EXPORT_CSV',
      email: req.user.email,
      invoiceId: id,
      timestamp: new Date().toISOString()
    });

    // Send CSV response
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber || id}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error({
      event: 'MASTER_EXPORT_ERROR',
      error: error.message,
      email: req.user.email,
      invoiceId: req.params.id
    });
    res.status(500).json({ error: 'Failed to export invoice' });
  }
});

/**
 * GET /api/master/stats
 * Get dashboard statistics
 */
router.get('/stats', requireMaster, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [totalSaved, todayCount, weekInvoices] = await Promise.all([
      // Total saved/submitted invoices
      prisma.invoice.count({
        where: {
          OR: [
            { status: 'saved' },
            { status: 'submitted' }
          ]
        }
      }),
      
      // Today's invoice count
      prisma.invoice.count({
        where: {
          OR: [
            { status: 'saved' },
            { status: 'submitted' }
          ],
          savedAt: { gte: today }
        }
      }),
      
      // Week's invoices for total calculation
      prisma.invoice.findMany({
        where: {
          OR: [
            { status: 'saved' },
            { status: 'submitted' }
          ],
          savedAt: { gte: weekAgo }
        },
        select: {
          total: true
        }
      })
    ]);

    const weekTotal = weekInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    res.json({
      totalSaved,
      todayCount,
      weekTotal,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({
      event: 'MASTER_STATS_ERROR',
      error: error.message,
      email: req.user.email
    });
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
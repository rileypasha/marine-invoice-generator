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
  const requestId = `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n🔍 [${requestId}] MASTER DASHBOARD ACCESS`);
  console.log('  User:', req.user?.email);
  console.log('  Raw query params:', req.query);
  
  try {
    // Parameter validation and sanitization
    const cleanParam = (param, defaultValue) => {
      if (param === undefined || param === null || param === '') return defaultValue;
      if (typeof param === 'string' && param.trim() === '') return defaultValue;
      return param;
    };
    
    const cleanNumber = (param, defaultValue) => {
      const cleaned = cleanParam(param, defaultValue);
      const num = parseInt(cleaned);
      return isNaN(num) ? defaultValue : num;
    };
    
    const cleanDate = (param) => {
      if (!param || param === '' || param.trim() === '') return null;
      try {
        const date = new Date(param);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        console.log(`  ⚠️ Invalid date parameter: ${param}`);
        return null;
      }
    };
    
    // Clean and validate all parameters
    const status = cleanParam(req.query.status, null);
    const search = cleanParam(req.query.search, '');
    const page = cleanNumber(req.query.page, 1);
    const limit = Math.min(cleanNumber(req.query.limit, 20), 100); // Cap at 100
    const dateFrom = cleanDate(req.query.dateFrom);
    const dateTo = cleanDate(req.query.dateTo);
    const market = cleanParam(req.query.market, null);
    const sortBy = cleanParam(req.query.sortBy, 'savedAt');
    const sortOrder = cleanParam(req.query.sortOrder, 'desc') === 'asc' ? 'asc' : 'desc';
    const debug = req.query.debug === 'true' || req.query.debug === true;
    
    console.log('  Cleaned params:', {
      status, search, page, limit, 
      dateFrom: dateFrom?.toISOString(), 
      dateTo: dateTo?.toISOString(), 
      market, sortBy, sortOrder, debug
    });

    // Build where clause with error handling
    let where = {};
    
    try {
      // DEBUG MODE: Show absolutely everything
      if (debug) {
        console.log('🐛 DEBUG MODE: Showing ALL invoices without any filters');
        // No where clause at all - show everything
      } else {
        // Status filter - Fixed to handle 'saved' as default view
        const statusConditions = [];
        
        // IMPORTANT FIX: 'saved' from frontend means show saved AND submitted
        if (!status || status === 'all' || status === 'saved') {
          // Show saved and submitted invoices (the main dashboard view)
          statusConditions.push({ status: 'saved' });
          statusConditions.push({ status: 'submitted' });
          console.log('  📋 Showing saved and submitted invoices (default view)');
        } else if (status === 'draft') {
          // Only show drafts
          statusConditions.push({ status: 'draft' });
          console.log('  📋 Filtering by status: draft');
        } else if (status === 'completed') {
          // Only show completed
          statusConditions.push({ status: 'completed' });
          console.log('  📋 Filtering by status: completed');
        } else if (status === 'cancelled') {
          // Only show cancelled
          statusConditions.push({ status: 'cancelled' });
          console.log('  📋 Filtering by status: cancelled');
        } else {
          // Invalid status - show saved and submitted as fallback
          console.log(`  ⚠️ Invalid status value: ${status}, showing default view`);
          statusConditions.push({ status: 'saved' });
          statusConditions.push({ status: 'submitted' });
        }

        // Add search condition with validation
        if (search && search.length > 0) {
          // Sanitize search string
          const sanitizedSearch = search.substring(0, 100); // Limit search length
          
          // SQLite doesn't support mode: 'insensitive', but contains is case-insensitive by default
          const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql');
          const searchConditions = isPostgres ? [
            { customerName: { contains: sanitizedSearch, mode: 'insensitive' } },
            { vesselName: { contains: sanitizedSearch, mode: 'insensitive' } },
            { invoiceNumber: { contains: sanitizedSearch, mode: 'insensitive' } },
            { userEmail: { contains: sanitizedSearch, mode: 'insensitive' } }
          ] : [
            { customerName: { contains: sanitizedSearch } },
            { vesselName: { contains: sanitizedSearch } },
            { invoiceNumber: { contains: sanitizedSearch } },
            { userEmail: { contains: sanitizedSearch } }
          ];
          
          // Combine conditions safely
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

        // Add date range filter with validation
        if (dateFrom || dateTo) {
          const dateFilter = {};
          if (dateFrom) {
            dateFilter.gte = dateFrom;
            console.log(`  📅 Date from: ${dateFrom.toISOString()}`);
          }
          if (dateTo) {
            // Add 23:59:59 to include the entire day
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            dateFilter.lte = endOfDay;
            console.log(`  📅 Date to: ${endOfDay.toISOString()}`);
          }
          
          // Only add date filter if we have valid dates
          if (Object.keys(dateFilter).length > 0) {
            where.savedAt = dateFilter;
          }
        }

        // Add market filter with validation
        if (market && market.length > 0 && market.length <= 100) {
          where.market = market;
          console.log(`  🏪 Market filter: ${market}`);
        }
      } // Close the else block from debug mode
    } catch (whereError) {
      console.error(`  ❌ Error building where clause: ${whereError.message}`);
      console.error(whereError.stack);
      // Fallback to empty where clause
      where = {};
      console.log('  ⚠️ Using fallback: showing all invoices');
    }

    console.log('  📊 Final where clause:', JSON.stringify(where, null, 2));

    // Calculate pagination with bounds checking
    const skip = Math.max(0, (page - 1) * limit);
    const take = limit;

    // Get total count with error handling
    let total = 0;
    try {
      total = await prisma.invoice.count({ where });
      console.log(`  📈 Total invoices matching query: ${total}`);
    } catch (countError) {
      console.error(`  ❌ Error counting invoices: ${countError.message}`);
      // Try simpler count without where clause
      try {
        total = await prisma.invoice.count();
        console.log(`  📈 Total invoices (unfiltered): ${total}`);
        where = {}; // Reset where clause for the main query
      } catch (fallbackError) {
        console.error(`  ❌ Fallback count failed: ${fallbackError.message}`);
        total = 0;
      }
    }

    // Validate sort field and handle numeric fields specially
    const validSortFields = ['savedAt', 'createdAt', 'updatedAt', 'total', 'subtotal', 'grossProfit', 'invoiceNumber', 'customerName', 'vesselName'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'savedAt';
    const numericFields = ['total', 'subtotal', 'taxAmount', 'grossProfit'];

    // Build orderBy with null handling for numeric fields
    let orderBy = {};
    if (numericFields.includes(safeSortBy)) {
      // For numeric fields, handle nulls properly
      // In Prisma, we need to use a different approach for SQLite vs PostgreSQL
      const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql');
      if (isPostgres) {
        orderBy = {
          [safeSortBy]: {
            sort: sortOrder,
            nulls: 'last'
          }
        };
      } else {
        // SQLite doesn't support nulls option, but we can work around it
        // by using _count or falling back to simple sorting
        orderBy = {
          [safeSortBy]: sortOrder
        };
      }
    } else {
      // Non-numeric fields use simple sorting
      orderBy = {
        [safeSortBy]: sortOrder
      };
    }

    // Get invoices with error handling
    let invoices = [];
    try {
      console.log(`  📋 Sorting by ${safeSortBy} ${sortOrder}`);
      
      invoices = await prisma.invoice.findMany({
        where,
        skip,
        take,
        orderBy,
      select: {
        id: true,
        userId: true, // Include userId to track invoice ownership
        invoiceNumber: true,
        status: true,
        savedAt: true,
        userName: true,
        userEmail: true,
        vesselName: true,
        vesselWeight: true, // Added missing field
        vesselBeam: true, // Added missing field
        customerName: true,
        customerEmail: true,
        customerPhone: true, // Added missing field
        market: true,
        subtotal: true, // Added missing field
        taxAmount: true, // Added missing field
        total: true,
        grossProfit: true,
        profitPercent: true,
        // hasChanges: true, // Commented out - not all databases have this yet
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

      console.log(`  ✅ Successfully fetched ${invoices.length} invoices`);
      
      // Post-process to handle null values in numeric fields for SQLite
      if (numericFields.includes(safeSortBy)) {
        const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql');
        if (!isPostgres) {
          // For SQLite, manually sort to put nulls last
          invoices.sort((a, b) => {
            const aVal = a[safeSortBy];
            const bVal = b[safeSortBy];
            
            // Put nulls at the end
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;
            
            // Normal numeric comparison
            if (sortOrder === 'asc') {
              return aVal - bVal;
            } else {
              return bVal - aVal;
            }
          });
          console.log('  🔄 Applied null-safe sorting for numeric field');
        }
      }
    } catch (queryError) {
      console.error(`  ❌ Error fetching invoices: ${queryError.message}`);
      console.error(`  Query details: sortBy=${safeSortBy}, sortOrder=${sortOrder}`);
      console.error(queryError.stack);
      
      // Try fallback query with minimal filters and safe sorting
      try {
        console.log('  🔄 Attempting fallback query with safe defaults...');
        invoices = await prisma.invoice.findMany({
          take: limit,
          skip,
          orderBy: { savedAt: 'desc' }, // Use savedAt which should always exist
          select: {
            id: true,
            userId: true,
            invoiceNumber: true,
            status: true,
            savedAt: true,
            userName: true,
            userEmail: true,
            vesselName: true,
            customerName: true,
            total: true,
            createdAt: true,
            updatedAt: true
          }
        });
        console.log(`  ✅ Fallback query succeeded: ${invoices.length} invoices`);
      } catch (fallbackError) {
        console.error(`  ❌ Fallback query failed: ${fallbackError.message}`);
        invoices = [];
      }
    }

    res.json({
      invoices,
      pagination: {
        total,
        page,
        limit,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0
      },
      debug: debug ? {
        requestId,
        whereClause: where,
        paramsSanitized: { status, search, page, limit, dateFrom, dateTo, market, sortBy, sortOrder }
      } : undefined
    });
  } catch (error) {
    console.error(`\n❌ [${requestId}] MASTER DASHBOARD FATAL ERROR`);
    console.error('  Error message:', error.message);
    console.error('  Stack trace:', error.stack);
    console.error('  Query params:', req.query);
    
    logger.error({
      event: 'MASTER_LIST_ERROR',
      requestId,
      error: error.message,
      stack: error.stack,
      email: req.user?.email,
      query: req.query
    });
    
    // Attempt emergency fallback
    try {
      console.log('  🚨 Attempting emergency fallback...');
      const emergencyInvoices = await prisma.invoice.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          vesselName: true,
          customerName: true,
          total: true,
          createdAt: true
        }
      });
      
      res.status(200).json({
        invoices: emergencyInvoices,
        pagination: {
          total: emergencyInvoices.length,
          page: 1,
          limit: 10,
          totalPages: 1
        },
        error: 'Partial data due to system error. Showing recent invoices.',
        recovery: true
      });
      console.log(`  ✅ Emergency fallback succeeded: ${emergencyInvoices.length} invoices`);
    } catch (emergencyError) {
      console.error('  ❌ Emergency fallback failed:', emergencyError.message);
      res.status(500).json({ 
        error: 'Failed to fetch invoices', 
        message: error.message,
        requestId,
        recovery: false 
      });
    }
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
            createdAt: 'desc'
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
 * GET /api/master/debug
 * Debug endpoint to see all invoices without filters
 */
router.get('/debug', requireMaster, async (req, res) => {
  try {
    // Get ALL invoices without any filters for debugging
    const allInvoices = await prisma.invoice.findMany({
      orderBy: { savedAt: 'desc' },
      take: 100
    });
    
    // Get count by status
    const statusCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: true
    });
    
    res.json({
      total: allInvoices.length,
      statusCounts,
      invoices: allInvoices.map(inv => ({
        id: inv.id,
        userId: inv.userId,
        status: inv.status,
        vesselName: inv.vesselName,
        customerName: inv.customerName,
        savedAt: inv.savedAt
      }))
    });
  } catch (error) {
    logger.error({ event: 'DEBUG_ERROR', error: error.message });
    res.status(500).json({ error: 'Debug failed' });
  }
});

/**
 * GET /api/master/debug/recent-saves
 * Show recent save attempts with full details
 */
router.get('/debug/recent-saves', requireMaster, async (req, res) => {
  try {
    const recent = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: true
      }
    });
    
    res.json({
      count: recent.length,
      saves: recent.map(inv => ({
        id: inv.id,
        title: inv.title,
        userId: inv.userId,
        userEmail: inv.userEmail,
        user: inv.user ? { id: inv.user.id, email: inv.user.email } : null,
        status: inv.status,
        createdAt: inv.createdAt,
        savedAt: inv.savedAt,
        hasUserId: !!inv.userId,
        hasUser: !!inv.user
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/master/debug/orphan-invoices
 * Find invoices without proper user association
 */
router.get('/debug/orphan-invoices', requireMaster, async (req, res) => {
  try {
    const orphans = await prisma.invoice.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: '' },
          { userEmail: null },
          { userEmail: '' }
        ]
      }
    });
    
    res.json({
      count: orphans.length,
      orphans: orphans.map(inv => ({
        id: inv.id,
        title: inv.title,
        userId: inv.userId,
        userEmail: inv.userEmail,
        status: inv.status,
        createdAt: inv.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/master/all-invoices
 * Bypass ALL filtering - direct database dump
 */
router.get('/all-invoices', requireMaster, async (req, res) => {
  try {
    console.log('🔓 FETCHING ALL INVOICES - NO FILTERS');
    
    const allInvoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`  Found ${allInvoices.length} total invoices in database`);
    
    res.json({
      total: allInvoices.length,
      invoices: allInvoices
    });
  } catch (error) {
    console.error('Failed to fetch all invoices:', error);
    res.status(500).json({ error: error.message });
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
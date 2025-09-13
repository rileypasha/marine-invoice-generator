const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireMaster } = require('../middleware/auth');
const pino = require('pino');
const InvoiceIdValidator = require('../utils/invoiceIdValidator');

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
        comments: true, // Include comments field
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
  const requestId = `detail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { id } = req.params;
    
    // Validate invoice ID format (support both new and legacy formats)
    if (!InvoiceIdValidator.isValid(id, true)) {
      const format = InvoiceIdValidator.getFormat(id);
      logger.warn({
        event: 'INVALID_INVOICE_ID',
        id,
        requestId,
        email: req.user?.email,
        detectedFormat: format,
        expectedFormat: 'inv_<timestamp>_<random>'
      });
      
      return res.status(400).json({ 
        error: InvoiceIdValidator.getErrorMessage(id),
        expectedFormat: 'inv_<timestamp>_<random>',
        received: id ? id.substring(0, 50) : 'none' // Truncate for security
      });
    }
    
    // Log access attempt
    logger.info({
      event: 'MASTER_DETAIL_ACCESS',
      email: req.user?.email,
      invoiceId: id,
      requestId,
      headers: {
        accept: req.headers.accept,
        'x-requested-with': req.headers['x-requested-with']
      }
    });
    
    console.log(`\n🔍 [${requestId}] MASTER DETAIL VIEW REQUEST`);
    console.log('  User:', req.user?.email);
    console.log('  Invoice ID:', id);

    // Use raw query to avoid Prisma schema issues with missing hasChanges column
    const invoices = await prisma.$queryRaw`
      SELECT 
        id, 
        "invoiceNumber",
        title,
        status,
        data,
        metadata,
        "userId",
        "userName",
        "userEmail",
        "vesselName",
        "vesselWeight",
        "vesselBeam",
        "customerName",
        "customerEmail",
        "customerPhone",
        subtotal,
        "taxAmount",
        total,
        "grossProfit",
        "profitPercent",
        market,
        notes,
        comments,
        "createdAt",
        "updatedAt",
        "savedAt",
        "submittedAt"
      FROM "Invoice" 
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!invoices || invoices.length === 0) {
      logger.warn({
        event: 'INVOICE_NOT_FOUND',
        invoiceId: id,
        requestId,
        email: req.user?.email
      });
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];
    
    // Get user info separately
    let user = null;
    if (invoice.userId) {
      try {
        const users = await prisma.$queryRaw`
          SELECT id, email, name 
          FROM "User" 
          WHERE id = ${invoice.userId}
        `;
        if (users && users.length > 0) {
          user = users[0];
        }
      } catch (e) {
        // User query failed, continue without user info
      }
    }
    
    // Get submissions separately
    let submissions = [];
    try {
      submissions = await prisma.$queryRaw`
        SELECT * 
        FROM "InvoiceSubmission"
        WHERE "invoiceId" = ${id}
        ORDER BY "submittedAt" DESC
        LIMIT 5
      `;
    } catch (e) {
      // Submissions query failed, continue without submissions
    }
    
    // Get revisions separately  
    let revisions = [];
    try {
      revisions = await prisma.$queryRaw`
        SELECT *
        FROM "InvoiceRevision"
        WHERE "invoiceId" = ${id}
        ORDER BY "createdAt" DESC
        LIMIT 5
      `;
    } catch (e) {
      // Revisions query failed, continue without revisions
    }
    
    // Add relations to invoice object
    invoice.user = user;
    invoice.submissions = submissions;
    invoice.revisions = revisions;

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Parse the JSON data field if it exists
    let invoiceData = {};
    try {
      if (invoice.data) {
        // Handle both string and object formats
        invoiceData = typeof invoice.data === 'string' 
          ? JSON.parse(invoice.data) 
          : invoice.data;
      }
    } catch (e) {
      logger.warn({
        event: 'INVOICE_DATA_PARSE_ERROR',
        invoiceId: id,
        error: e.message
      });
    }

    // Parse metadata field as well
    let metadata = {};
    try {
      if (invoice.metadata) {
        metadata = typeof invoice.metadata === 'string'
          ? JSON.parse(invoice.metadata)
          : invoice.metadata;
      }
    } catch (e) {
      logger.warn({
        event: 'INVOICE_METADATA_PARSE_ERROR',
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

    // Ensure response structure with all required fields
    const responseData = {
      ...invoice,
      data: invoiceData || {}, // Send parsed data as 'data'
      parsedData: invoiceData || {}, // Also send as 'parsedData' for backwards compatibility
      metadata: metadata || {},
      // Ensure critical fields exist for frontend
      id: invoice.id,
      status: invoice.status || 'unknown',
      vesselName: invoice.vesselName || invoiceData?.vessel?.name || 'N/A',
      customerName: invoice.customerName || invoiceData?.customer?.customerName || 'N/A',
      total: invoice.total || 0,
      savedAt: invoice.savedAt,
      submittedAt: invoice.submittedAt
    };
    
    console.log(`  ✅ Sending invoice data for ID: ${id}`);
    console.log(`  Response structure: ${JSON.stringify(Object.keys(responseData))}`);
    
    res.json(responseData);
  } catch (error) {
    logger.error({
      event: 'MASTER_DETAIL_ERROR',
      error: error.message,
      stack: error.stack,
      email: req.user?.email,
      invoiceId: req.params.id,
      requestId
    });
    
    console.error(`  ❌ Error fetching invoice ${req.params.id}:`, error.message);
    
    res.status(500).json({ 
      error: 'Failed to fetch invoice',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/master/invoices/:id/export.csv
 * Export invoice as CSV
 */
router.get('/invoices/:id/export.csv', requireMaster, async (req, res) => {
  let invoice = null;
  
  try {
    const { id } = req.params;

    // Validate invoice ID
    if (!id) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    // Try Prisma query first with explicit field selection
    try {
      invoice = await prisma.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          invoiceNumber: true,
          title: true,
          status: true,
          data: true,
          metadata: true,
          userName: true,
          userEmail: true,
          vesselName: true,
          vesselWeight: true,
          vesselBeam: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          subtotal: true,
          taxAmount: true,
          total: true,
          grossProfit: true,
          profitPercent: true,
          savedAt: true,
          submittedAt: true,
          createdAt: true,
          updatedAt: true
          // Explicitly exclude hasChanges since it doesn't exist in production DB
        }
      });
    } catch (prismaError) {
      // Fallback to raw SQL if Prisma fails
      logger.warn({
        event: 'MASTER_EXPORT_PRISMA_ERROR',
        error: prismaError.message,
        invoiceId: id,
        fallback: 'Using raw SQL query'
      });
      
      try {
        const rawInvoices = await prisma.$queryRaw`
          SELECT 
            id, invoiceNumber, title, status, data, metadata,
            userName, userEmail, vesselName, vesselWeight, vesselBeam,
            customerName, customerEmail, customerPhone,
            subtotal, taxAmount, total, grossProfit, profitPercent,
            savedAt, submittedAt, createdAt, updatedAt
          FROM "Invoice"
          WHERE id = ${id}
          LIMIT 1
        `;
        
        invoice = rawInvoices[0] || null;
      } catch (rawError) {
        // Last resort - minimal query
        logger.warn({
          event: 'MASTER_EXPORT_RAW_SQL_ERROR',
          error: rawError.message,
          invoiceId: id,
          fallback: 'Using minimal query'
        });
        
        const minimalInvoices = await prisma.$queryRaw`
          SELECT id, data, status, total
          FROM "Invoice"
          WHERE id = ${id}
          LIMIT 1
        `;
        
        invoice = minimalInvoices[0] || null;
      }
    }

    if (!invoice) {
      logger.warn({
        event: 'MASTER_EXPORT_NOT_FOUND',
        invoiceId: id,
        email: req.user?.email || 'unknown'
      });
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Parse invoice data with proper error handling
    let invoiceData = {};
    try {
      if (invoice.data) {
        invoiceData = typeof invoice.data === 'string' 
          ? JSON.parse(invoice.data) 
          : invoice.data;
      }
    } catch (parseError) {
      logger.error({
        event: 'MASTER_EXPORT_PARSE_ERROR',
        error: parseError.message,
        invoiceId: id,
        rawData: invoice.data?.substring(0, 200) // Log first 200 chars for debugging
      });
      invoiceData = {};
    }

    // Extract nested data structures safely
    const vessel = invoiceData.vessel || {};
    const customer = invoiceData.customer || {};
    const scope = invoiceData.scope || {};
    const lineItems = scope.lineItems || [];

    // Helper function to safely convert values to string
    const safeString = (value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      const str = safeString(value);
      // If contains comma, quotes, or newline, wrap in quotes and escape existing quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content with proper data extraction
    const csvRows = [
      ['Invoice Export'],
      ['Generated', new Date().toISOString()],
      [''],
      ['Invoice Details'],
      ['Invoice Number', invoice.invoiceNumber || 'N/A'],
      ['Status', invoice.status || 'saved'],
      ['Saved At', invoice.savedAt ? new Date(invoice.savedAt).toLocaleDateString() : 'N/A'],
      [''],
      ['Vessel Information'],
      ['Vessel Name', vessel.name || invoice.vesselName || 'N/A'],
      ['Vessel Weight', vessel.weight ? `${vessel.weight} tons` : (invoice.vesselWeight ? `${invoice.vesselWeight} tons` : 'N/A')],
      ['Vessel Beam', vessel.beam ? `${vessel.beam} ft` : (invoice.vesselBeam ? `${invoice.vesselBeam} ft` : 'N/A')],
      [''],
      ['Customer Information'],
      ['Customer Name', customer.customerName || invoice.customerName || 'N/A'],
      ['Customer Email', customer.customerEmail || invoice.customerEmail || 'N/A'],
      ['Customer Phone', customer.customerPhone || invoice.customerPhone || 'N/A'],
      [''],
      ['Financial Summary'],
      ['Subtotal', `$${(scope.subtotal || invoice.subtotal || 0).toFixed(2)}`],
      ['Tax Amount', `$${(scope.taxAmount || invoice.taxAmount || 0).toFixed(2)}`],
      ['Total', `$${(scope.total || invoice.total || 0).toFixed(2)}`],
      ['Gross Profit', `$${(scope.grossProfit || invoice.grossProfit || 0).toFixed(2)}`],
      ['Profit Percent', `${(scope.profitPercent || invoice.profitPercent || 0).toFixed(2)}%`]
    ];

    // Add line items if available
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      csvRows.push(['']);
      csvRows.push(['Line Items']);
      csvRows.push(['Item', 'Type', 'Cost', 'Total']);
      
      lineItems.forEach(item => {
        const cost = parseFloat(item.cost) || 0;
        csvRows.push([
          item.description || 'N/A',
          item.type || 'N/A',
          `$${cost.toFixed(2)}`,
          `$${cost.toFixed(2)}` // Total same as cost for now
        ]);
      });
    }

    // Add submitter information
    csvRows.push(['']);
    csvRows.push(['Submitted By']);
    csvRows.push(['Name', invoice.userName || 'N/A']);
    csvRows.push(['Email', invoice.userEmail || 'N/A']);

    // Convert to CSV string with proper escaping
    const csvContent = csvRows
      .map(row => row.map(cell => escapeCSV(cell)).join(','))
      .join('\n');

    // Log successful export
    logger.info({
      event: 'MASTER_EXPORT_CSV_SUCCESS',
      email: req.user?.email || 'unknown',
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      lineItemCount: lineItems.length,
      timestamp: new Date().toISOString()
    });

    // Send CSV response with proper headers
    // Create a clean filename without special characters that might cause issues
    const safeInvoiceNumber = (invoice.invoiceNumber || id).replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const csvFilename = `invoice_${safeInvoiceNumber}_${timestamp}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(csvContent);
    
  } catch (error) {
    logger.error({
      event: 'MASTER_EXPORT_ERROR',
      error: error.message,
      stack: error.stack,
      email: req.user?.email || 'unknown',
      invoiceId: req.params.id
    });
    res.status(500).json({ error: 'Failed to export invoice', details: error.message });
  }
});

/**
 * GET /api/master/test-export/:id
 * Test CSV export without actually generating CSV
 */
router.get('/test-export/:id', requireMaster, async (req, res) => {
  const { id } = req.params;
  const results = {
    id,
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test 1: Basic Prisma query with select
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        total: true
      }
    });
    results.tests.basicSelect = { 
      success: true, 
      found: !!invoice,
      data: invoice ? { id: invoice.id, status: invoice.status } : null
    };
  } catch (error) {
    results.tests.basicSelect = { 
      success: false, 
      error: error.message 
    };
  }

  // Test 2: Full field selection (excluding hasChanges)
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        status: true,
        data: true,
        userName: true,
        userEmail: true,
        vesselName: true,
        customerName: true,
        customerEmail: true,
        total: true,
        savedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    results.tests.fullSelect = { 
      success: true, 
      found: !!invoice,
      hasData: !!(invoice && invoice.data)
    };
  } catch (error) {
    results.tests.fullSelect = { 
      success: false, 
      error: error.message 
    };
  }

  // Test 3: Raw SQL query
  try {
    const rawInvoices = await prisma.$queryRaw`
      SELECT id, status, total 
      FROM "Invoice" 
      WHERE id = ${id}
      LIMIT 1
    `;
    results.tests.rawSQL = { 
      success: true, 
      found: rawInvoices.length > 0,
      data: rawInvoices[0] || null
    };
  } catch (error) {
    results.tests.rawSQL = { 
      success: false, 
      error: error.message 
    };
  }

  // Test 4: Data parsing
  try {
    const invoice = await prisma.$queryRaw`
      SELECT data 
      FROM "Invoice" 
      WHERE id = ${id}
      LIMIT 1
    `;
    if (invoice[0] && invoice[0].data) {
      const parsed = typeof invoice[0].data === 'string' 
        ? JSON.parse(invoice[0].data)
        : invoice[0].data;
      results.tests.dataParsing = {
        success: true,
        hasScope: !!parsed.scope,
        hasLineItems: !!(parsed.scope && parsed.scope.lineItems),
        lineItemCount: parsed.scope?.lineItems?.length || 0
      };
    } else {
      results.tests.dataParsing = { 
        success: false, 
        error: 'No invoice found' 
      };
    }
  } catch (error) {
    results.tests.dataParsing = { 
      success: false, 
      error: error.message 
    };
  }

  res.json(results);
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
 * POST /api/master/invoices/:id/comment
 * Add or update comments for an invoice
 */
router.post('/invoices/:id/comment', requireMaster, async (req, res) => {
  const requestId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { id } = req.params;
    const { comment } = req.body;
    
    console.log(`\n📝 [${requestId}] MASTER ADD COMMENT`);
    console.log(`  Invoice ID: ${id}`);
    console.log(`  Comment length: ${comment ? comment.length : 0} chars`);
    
    if (!id) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }
    
    if (!comment && comment !== '') {
      return res.status(400).json({ error: 'Comment is required' });
    }
    
    // Fetch the invoice first
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        data: true,
        comments: true
      }
    });
    
    if (!invoice) {
      console.log(`  ❌ Invoice not found: ${id}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    // Update the invoice with the new comment
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        comments: comment,
        updatedAt: new Date()
      }
    });
    
    // Also update the data field to include comment in notes.comments array
    if (invoice.data) {
      try {
        const data = typeof invoice.data === 'string' 
          ? JSON.parse(invoice.data) 
          : invoice.data;
        
        // Initialize notes and comments if they don't exist
        if (!data.notes) {
          data.notes = {};
        }
        if (!data.notes.comments) {
          data.notes.comments = [];
        }
        
        // Add comment in the same format as standard users
        const newComment = {
          id: Date.now().toString(),
          text: comment,
          author: 'Master Admin',
          authorEmail: req.user?.email || 'master@marinegroupbw.com',
          timestamp: new Date().toISOString(),
          replies: []
        };
        
        data.notes.comments.push(newComment);
        
        await prisma.invoice.update({
          where: { id },
          data: {
            data: JSON.stringify(data)
          }
        });
        
        console.log(`  ✅ Comment also added to data.notes.comments array`);
      } catch (parseError) {
        console.log(`  ⚠️ Could not update data.notes.comments: ${parseError.message}`);
      }
    }
    
    console.log(`  ✅ Comment added successfully for invoice ${id}`);
    
    logger.info({
      event: 'MASTER_COMMENT_ADDED',
      requestId,
      invoiceId: id,
      commentLength: comment.length,
      masterEmail: req.user?.email
    });
    
    res.json({ 
      success: true, 
      message: 'Comment added successfully',
      invoiceId: id
    });
    
  } catch (error) {
    console.error(`  ❌ Error adding comment:`, error.message);
    
    logger.error({
      event: 'MASTER_COMMENT_ERROR',
      requestId,
      error: error.message,
      stack: error.stack,
      email: req.user?.email,
      invoiceId: req.params.id
    });
    
    res.status(500).json({ 
      error: 'Failed to add comment',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
    // Get today's start in Pacific timezone
    const now = new Date();
    // Get current Pacific time
    const pacificOffset = -8; // PST is UTC-8 (use -7 for PDT)
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const pacificTime = new Date(utcTime + (3600000 * pacificOffset));
    
    // Set to start of day in Pacific
    pacificTime.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for comparison (add 8 hours)
    const todayStartUTC = new Date(pacificTime.getTime() - (3600000 * pacificOffset));
    
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
      
      // Today's invoice count in Pacific timezone
      prisma.invoice.count({
        where: {
          OR: [
            { status: 'saved' },
            { status: 'submitted' }
          ],
          savedAt: { gte: todayStartUTC }
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
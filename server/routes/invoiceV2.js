const express = require('express');
const router = express.Router();
const { PrismaClient, Prisma } = require('@prisma/client');
const { validateAndTransformInvoice } = require('../utils/validateInvoice');
const { invoiceCalculator } = require('../services/invoiceCalculator');
const { AppError, ErrorCode } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * POST /api/v2/invoice/save
 * New invoice save endpoint with proper validation and relation handling
 */
router.post('/save', requireAuth, async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || 
                   `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Store requestId for error handler
  res.locals.requestId = requestId;
  
  try {
    // Log incoming request
    logger.info({
      event: 'INVOICE_SAVE_START',
      requestId,
      userId: req.user?.id,
      userEmail: req.user?.email,
      idempotencyKey: req.headers['idempotency-key']
    });
    
    // Step 1: Validate and sanitize input
    const validationResult = validateAndTransformInvoice(req.body);
    
    if (!validationResult.success) {
      logger.warn({
        event: 'INVOICE_VALIDATION_FAILED',
        requestId,
        errors: validationResult.errors
      });
      
      const firstError = validationResult.errors[0];
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Invalid invoice data: ${firstError.message}`,
        400,
        {
          errors: validationResult.errors,
          requestId
        }
      );
    }
    
    const input = validationResult.data;
    
    // Step 2: Check idempotency (if we have the table)
    const idempotencyKey = req.headers['idempotency-key'];
    if (idempotencyKey) {
      try {
        // Check if IdempotencyRecord table exists
        const tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'IdempotencyRecord'
          ) as exists
        `;
        
        if (tableExists[0]?.exists) {
          const existing = await prisma.idempotencyRecord.findUnique({
            where: { key: idempotencyKey }
          });
          
          if (existing) {
            logger.info({
              event: 'INVOICE_IDEMPOTENT_HIT',
              requestId,
              originalRequestId: existing.requestId
            });
            
            return res.status(200).json({
              success: true,
              invoice: existing.response,
              idempotent: true,
              requestId
            });
          }
        }
      } catch (idempErr) {
        // Idempotency table doesn't exist, continue without it
        logger.debug('Idempotency check skipped: table may not exist');
      }
    }
    
    // Step 3: Calculate totals
    const lineItems = input.data?.scope?.lineItems || [];
    const markupRate = input.data?.scope?.markupRate || 0;
    const isTaxable = input.data?.scope?.isTaxable || false;
    const laborRate = input.data?.laborRate || 85;
    const otRate = input.data?.otRate || 127.5;
    
    const totals = invoiceCalculator.calculateTotals(
      lineItems,
      markupRate,
      isTaxable,
      laborRate,
      otRate
    );
    
    logger.info({
      event: 'INVOICE_TOTALS_CALCULATED',
      requestId,
      totals: {
        subtotal: totals.subtotal.toString(),
        tax: totals.taxAmount.toString(),
        total: totals.total.toString()
      }
    });
    
    // Step 4: Prepare invoice data
    const invoiceData = {
      title: input.title || 'Untitled Invoice',
      // CRITICAL: Prisma schema expects strings, not objects
      data: JSON.stringify(input.data || {}),
      metadata: JSON.stringify(input.metadata || {}),
      
      // User fields
      userName: req.user.name || req.user.email,
      userEmail: req.user.email,
      
      // Denormalized vessel fields
      vesselName: input.data?.vessel?.name || null,
      vesselWeight: input.data?.vessel?.weight || null,
      vesselBeam: input.data?.vessel?.beam || null,
      
      // Denormalized customer fields
      customerName: input.data?.customer?.customerName || null,
      customerEmail: input.data?.customer?.customerEmail || null,
      customerPhone: input.data?.customer?.customerPhone || null,
      
      // Calculated totals
      subtotal: totals.subtotalNumber,
      taxAmount: totals.taxAmountNumber,
      total: totals.totalNumber,
      grossProfit: totals.grossProfitNumber,
      profitPercent: totals.profitPercentNumber,
      
      // Status fields
      status: 'saved',
      savedAt: new Date()
    };
    
    // Step 5: Create invoice with proper user relation
    let invoice;
    try {
      // First attempt: Try with user relation (correct way)
      invoice = await prisma.invoice.create({
        data: {
          ...invoiceData,
          // CRITICAL: Use relation, not scalar userId
          user: {
            connect: { id: req.user.id }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });
      
      logger.info({
        event: 'INVOICE_CREATED_WITH_RELATION',
        requestId,
        invoiceId: invoice.id,
        userId: req.user.id
      });
      
    } catch (createError) {
      // If relation doesn't work, try with scalar userId (backward compatibility)
      if (createError.message?.includes('user') || createError.message?.includes('relation')) {
        logger.warn({
          event: 'INVOICE_RELATION_FAILED_TRYING_SCALAR',
          requestId,
          error: createError.message
        });
        
        try {
          invoice = await prisma.invoice.create({
            data: {
              ...invoiceData,
              userId: req.user.id // Fallback to scalar
            }
          });
          
          logger.info({
            event: 'INVOICE_CREATED_WITH_SCALAR',
            requestId,
            invoiceId: invoice.id,
            userId: req.user.id
          });
          
        } catch (scalarError) {
          // If both fail, throw the original error
          throw createError;
        }
      } else {
        // Not a relation error, throw it
        throw createError;
      }
    }
    
    // Step 6: Store idempotency record (if table exists)
    if (idempotencyKey) {
      try {
        await prisma.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            requestId,
            response: invoice,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          }
        });
      } catch (idempErr) {
        // Idempotency table doesn't exist, skip
        logger.debug('Idempotency record skipped: table may not exist');
      }
    }
    
    // Success logging
    logger.info({
      event: 'INVOICE_SAVE_SUCCESS',
      requestId,
      invoiceId: invoice.id,
      duration: Date.now() - startTime
    });
    
    // Parse JSON strings back to objects for response
    const responseInvoice = {
      ...invoice,
      data: typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data,
      metadata: typeof invoice.metadata === 'string' ? JSON.parse(invoice.metadata) : invoice.metadata
    };
    
    res.status(200).json({
      success: true,
      invoice: responseInvoice,
      requestId
    });
    
  } catch (error) {
    logger.error({
      event: 'INVOICE_SAVE_ERROR',
      requestId,
      error: error.message,
      stack: error.stack,
      duration: Date.now() - startTime
    });
    
    next(error);
  }
});

/**
 * GET /api/v2/invoice/:id
 * Get invoice by ID
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    
    if (!invoice) {
      throw new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Invoice not found',
        404
      );
    }
    
    // Check ownership
    if (invoice.userId !== req.user.id && invoice.userEmail !== req.user.email) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Access denied',
        403
      );
    }
    
    // Parse JSON strings back to objects for response
    const responseInvoice = {
      ...invoice,
      data: typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data,
      metadata: typeof invoice.metadata === 'string' ? JSON.parse(invoice.metadata) : invoice.metadata
    };
    
    res.json({
      success: true,
      invoice: responseInvoice
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
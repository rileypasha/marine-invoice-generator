/**
 * Change Tracking API Routes
 * Handles invoice change tracking for master users
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireMaster } = require('../middleware/auth');
const { AppError, ErrorCode } = require('../middleware/errorHandler');
const {
  acknowledgeChanges,
  computeDiffSinceLastMasterView,
  getChangeTrackingSummary,
  validateMasterAuth
} = require('../utils/changeTracker');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

// All routes require master authentication
router.use(requireMaster);

/**
 * GET /api/invoices/:id?include=diff
 * Get invoice with optional diff if has unread changes
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { include } = req.query;
    const masterEmail = req.user.email;

    if (!validateMasterAuth(req.user)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Master role required for change tracking access',
        403
      );
    }

    // Get the invoice
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
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 5
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

    // Parse invoice data
    const invoiceData = typeof invoice.data === 'string'
      ? JSON.parse(invoice.data)
      : invoice.data;

    const response = {
      success: true,
      invoice: {
        ...invoice,
        data: invoiceData
      }
    };

    // Include diff if requested and there are unread changes
    if (include === 'diff' && invoice.hasUnreadChanges) {
      try {
        const diffResult = await computeDiffSinceLastMasterView(id, masterEmail);
        if (diffResult) {
          response.diff = diffResult;
        }
      } catch (diffError) {
        logger.warn('Failed to compute diff', {
          invoiceId: id,
          masterEmail,
          error: diffError.message
        });
        // Don't fail the request if diff computation fails
        response.diffError = 'Failed to compute changes';
      }
    }

    logger.info('Invoice retrieved with change tracking', {
      invoiceId: id,
      masterEmail,
      hasUnreadChanges: invoice.hasUnreadChanges,
      includeDiff: include === 'diff'
    });

    res.json(response);

  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/invoices/:id/acknowledge
 * Master-only endpoint to acknowledge changes and clear unread flag
 */
router.patch('/:id/acknowledge', async (req, res, next) => {
  try {
    const { id } = req.params;
    const masterEmail = req.user.email;

    if (!validateMasterAuth(req.user)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Master role required for acknowledging changes',
        403
      );
    }

    // Check if invoice exists and has unread changes
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        hasUnreadChanges: true,
        lastMasterViewAt: true
      }
    });

    if (!invoice) {
      throw new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Invoice not found',
        404
      );
    }

    if (!invoice.hasUnreadChanges) {
      return res.json({
        success: true,
        message: 'No unread changes to acknowledge',
        acknowledgedAt: invoice.lastMasterViewAt
      });
    }

    // Acknowledge the changes
    const result = await acknowledgeChanges(id, masterEmail);

    logger.info('Changes acknowledged by master', {
      invoiceId: id,
      masterEmail,
      acknowledgedAt: result.acknowledgedAt
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/change-tracking/summary
 * Get change tracking dashboard summary
 */
router.get('/summary', async (req, res, next) => {
  try {
    const masterEmail = req.user.email;

    if (!validateMasterAuth(req.user)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Master role required for change tracking summary',
        403
      );
    }

    // Parse optional filters from query
    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.dateFrom) {
      filters.updatedAt = { gte: new Date(req.query.dateFrom) };
    }
    if (req.query.dateTo) {
      if (filters.updatedAt) {
        filters.updatedAt.lte = new Date(req.query.dateTo);
      } else {
        filters.updatedAt = { lte: new Date(req.query.dateTo) };
      }
    }

    const summary = await getChangeTrackingSummary(filters);

    logger.info('Change tracking summary requested', {
      masterEmail,
      filters,
      summary
    });

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/invoices/:id/changes/history
 * Get change history for a specific invoice
 */
router.get('/:id/changes/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const masterEmail = req.user.email;
    const { limit = 10, offset = 0 } = req.query;

    if (!validateMasterAuth(req.user)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Master role required for change history access',
        403
      );
    }

    // Get invoice with revision history
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        hasUnreadChanges: true,
        lastMasterViewAt: true
      }
    });

    if (!invoice) {
      throw new AppError(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Invoice not found',
        404
      );
    }

    const revisions = await prisma.invoiceRevision.findMany({
      where: { invoiceId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        revisionNumber: true,
        actorEmail: true,
        changeSummary: true,
        createdAt: true
      }
    });

    const totalRevisions = await prisma.invoiceRevision.count({
      where: { invoiceId: id }
    });

    logger.info('Change history retrieved', {
      invoiceId: id,
      masterEmail,
      revisionCount: revisions.length
    });

    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        hasUnreadChanges: invoice.hasUnreadChanges,
        lastMasterViewAt: invoice.lastMasterViewAt
      },
      revisions,
      pagination: {
        total: totalRevisions,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
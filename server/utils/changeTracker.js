/**
 * Enhanced Change Tracking Utility
 * Implements comprehensive change tracking with master acknowledgment
 */

const { PrismaClient } = require('@prisma/client');
const { computeInvoiceDiff, formatDiffForDisplay } = require('./diff-engine');
const { normalizeInvoice } = require('./invoice-normalizer');
const pino = require('pino');

const prisma = new PrismaClient();
const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

/**
 * Flag invoice as having unread changes (for existing invoices only)
 * @param {string} invoiceId - Invoice ID
 * @param {Object} invoiceData - Current invoice data
 * @param {string} actorEmail - Email of user making changes
 * @returns {Promise<Object>} Result with success flag and details
 */
async function flagUnreadChanges(invoiceId, invoiceData, actorEmail) {
  try {
    // Get the existing invoice to check if it already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!existingInvoice) {
      // This is a new invoice - no change tracking needed
      return {
        success: true,
        action: 'new_invoice',
        message: 'New invoice created - no change tracking needed'
      };
    }

    // For existing invoices, flag as having unread changes
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        hasUnreadChanges: true
      }
    });

    // Create version snapshot
    const revisionCount = await prisma.invoiceRevision.count({
      where: { invoiceId }
    });

    const normalizedPayload = normalizeInvoice(invoiceData);

    await prisma.invoiceRevision.create({
      data: {
        invoiceId,
        revisionNumber: revisionCount + 1,
        actorEmail: actorEmail,
        changeSummary: `Invoice updated by ${actorEmail}`,
        payloadJson: normalizedPayload
      }
    });

    logger.info('Invoice flagged with unread changes', {
      invoiceId,
      actorEmail,
      revisionNumber: revisionCount + 1
    });

    return {
      success: true,
      action: 'flagged_changes',
      message: 'Invoice flagged with unread changes'
    };

  } catch (error) {
    logger.error('Error flagging unread changes:', {
      invoiceId,
      actorEmail,
      error: error.message
    });
    throw error;
  }
}

/**
 * Acknowledge changes and clear unread flag (master-only)
 * @param {string} invoiceId - Invoice ID
 * @param {string} masterEmail - Master user email
 * @returns {Promise<Object>} Result with success flag and timestamp
 */
async function acknowledgeChanges(invoiceId, masterEmail) {
  try {
    const now = new Date();

    // Update invoice to clear unread flag and set last master view timestamp
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        hasUnreadChanges: false,
        lastMasterViewAt: now
      }
    });

    logger.info('Changes acknowledged by master', {
      invoiceId,
      masterEmail,
      acknowledgedAt: now
    });

    return {
      success: true,
      acknowledgedAt: now,
      message: 'Changes acknowledged successfully'
    };

  } catch (error) {
    logger.error('Error acknowledging changes:', {
      invoiceId,
      masterEmail,
      error: error.message
    });
    throw error;
  }
}

/**
 * Compute diff between last master-acknowledged version and current version
 * @param {string} invoiceId - Invoice ID
 * @param {string} masterEmail - Master user email (for context)
 * @returns {Promise<Object>} Diff result or null if no changes
 */
async function computeDiffSinceLastMasterView(invoiceId, masterEmail) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 10  // Get recent revisions
        }
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.hasUnreadChanges) {
      return null; // No unread changes
    }

    // Find the revision closest to last master view
    let baselineRevision = null;
    if (invoice.lastMasterViewAt) {
      baselineRevision = invoice.revisions.find(rev =>
        rev.createdAt <= invoice.lastMasterViewAt
      );
    }

    // If no baseline found, use the oldest revision or current state
    let baselineData;
    if (baselineRevision) {
      baselineData = baselineRevision.payloadJson;
    } else {
      // Use current invoice data as baseline (first time viewing)
      baselineData = typeof invoice.data === 'string'
        ? JSON.parse(invoice.data)
        : invoice.data;
    }

    // Current data is the latest revision or invoice data
    let currentData;
    if (invoice.revisions.length > 0) {
      currentData = invoice.revisions[0].payloadJson;
    } else {
      currentData = typeof invoice.data === 'string'
        ? JSON.parse(invoice.data)
        : invoice.data;
    }

    // Compute and format diff
    const diff = computeInvoiceDiff(baselineData, currentData);
    const formatted = formatDiffForDisplay(diff);

    logger.info('Diff computed for master view', {
      invoiceId,
      masterEmail,
      changeCount: diff.changes.length,
      hasBaseline: !!baselineRevision
    });

    return {
      diff: formatted,
      baseline: {
        type: baselineRevision ? 'revision' : 'current',
        timestamp: baselineRevision?.createdAt || invoice.lastMasterViewAt,
        revisionId: baselineRevision?.id
      },
      current: {
        timestamp: invoice.revisions[0]?.createdAt || invoice.updatedAt,
        revisionId: invoice.revisions[0]?.id
      }
    };

  } catch (error) {
    logger.error('Error computing diff since last master view:', {
      invoiceId,
      masterEmail,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get change tracking summary for dashboard
 * @param {Object} filters - Optional filters (status, dateRange, etc.)
 * @returns {Promise<Object>} Summary statistics
 */
async function getChangeTrackingSummary(filters = {}) {
  try {
    const whereClause = {
      hasUnreadChanges: true,
      ...filters
    };

    const [totalWithChanges, recentChanges] = await Promise.all([
      prisma.invoice.count({ where: whereClause }),
      prisma.invoice.count({
        where: {
          ...whereClause,
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    return {
      totalWithChanges,
      recentChanges,
      lastUpdated: new Date()
    };

  } catch (error) {
    logger.error('Error getting change tracking summary:', error);
    throw error;
  }
}

/**
 * Validate master authorization for change tracking operations
 * @param {Object} user - User object from session
 * @returns {boolean} Whether user is authorized
 */
function validateMasterAuth(user) {
  return user && user.role === 'master';
}

module.exports = {
  flagUnreadChanges,
  acknowledgeChanges,
  computeDiffSinceLastMasterView,
  getChangeTrackingSummary,
  validateMasterAuth
};
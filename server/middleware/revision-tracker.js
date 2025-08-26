/**
 * Revision Tracking Middleware
 * Captures post-submission changes to invoices
 */

const { PrismaClient } = require('@prisma/client');
const { normalizeInvoice, extractKeyFields } = require('../utils/invoice-normalizer');
const logger = require('pino')();

const prisma = new PrismaClient();

/**
 * Middleware to track invoice revisions
 */
async function trackRevision(req, res, next) {
  // Store original json method
  const originalJson = res.json;
  
  res.json = async function(data) {
    // Check if this is an invoice update response
    if (req.method === 'PUT' || req.method === 'POST') {
      if (req.path.includes('/invoice') && data.invoice) {
        try {
          await captureRevision(data.invoice, req.session?.user?.email || 'unknown');
        } catch (error) {
          logger.error('Failed to capture revision:', error);
        }
      }
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Capture a revision for an invoice
 */
async function captureRevision(invoice, actorEmail) {
  try {
    // Check if invoice has been submitted
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { 
        submissions: true,
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!existingInvoice || !existingInvoice.submittedAt) {
      // Not submitted yet, no revision needed
      return;
    }
    
    // Normalize current state
    const normalizedPayload = normalizeInvoice(invoice);
    
    // Check if there's actually a change
    const lastRevision = existingInvoice.revisions[0];
    if (lastRevision) {
      const lastNormalized = normalizeInvoice(lastRevision.payloadJson);
      if (JSON.stringify(normalizedPayload) === JSON.stringify(lastNormalized)) {
        // No actual changes
        return;
      }
    }
    
    // Get next revision number
    const revisionCount = await prisma.invoiceRevision.count({
      where: { invoiceId: invoice.id }
    });
    
    // Create revision
    const revision = await prisma.invoiceRevision.create({
      data: {
        invoiceId: invoice.id,
        revisionNumber: revisionCount + 1,
        actorEmail: actorEmail,
        changeSummary: generateChangeSummary(invoice),
        payloadJson: normalizedPayload
      }
    });
    
    // Update invoice hasChanges flag
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { hasChanges: true }
    });
    
    // Create submission baseline if it doesn't exist
    if (existingInvoice.submissions.length === 0) {
      await prisma.invoiceSubmission.create({
        data: {
          invoiceId: invoice.id,
          submittedBy: existingInvoice.userEmail || 'unknown',
          submittedAt: existingInvoice.submittedAt,
          status: 'submitted',
          payloadJson: normalizedPayload
        }
      });
    }
    
    logger.info('Revision captured', {
      invoiceId: invoice.id,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      actor: actorEmail
    });
    
  } catch (error) {
    logger.error('Error capturing revision:', error);
    throw error;
  }
}

/**
 * Generate a summary of changes
 */
function generateChangeSummary(invoice) {
  const keyFields = extractKeyFields(invoice);
  return `Updated invoice ${keyFields.invoiceNumber} for ${keyFields.customerName}`;
}

/**
 * Create submission baseline when invoice is first submitted
 */
async function createSubmissionBaseline(invoiceId, submitterEmail) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    // Parse invoice data
    const invoiceData = typeof invoice.data === 'string' 
      ? JSON.parse(invoice.data) 
      : invoice.data;
    
    // Check if baseline already exists
    const existingSubmission = await prisma.invoiceSubmission.findUnique({
      where: { invoiceId }
    });
    
    if (existingSubmission) {
      logger.info('Submission baseline already exists', { invoiceId });
      return existingSubmission;
    }
    
    // Create baseline
    const submission = await prisma.invoiceSubmission.create({
      data: {
        invoiceId,
        submittedBy: submitterEmail || invoice.userEmail || 'unknown',
        status: 'submitted',
        payloadJson: normalizeInvoice(invoiceData)
      }
    });
    
    logger.info('Submission baseline created', {
      invoiceId,
      submissionId: submission.id
    });
    
    return submission;
    
  } catch (error) {
    logger.error('Error creating submission baseline:', error);
    throw error;
  }
}

/**
 * Mark changes as seen by master
 */
async function markChangesSeen(invoiceId, masterEmail) {
  try {
    // Get latest revision
    const latestRevision = await prisma.invoiceRevision.findFirst({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!latestRevision) {
      // No revisions, nothing to mark
      return { success: true, message: 'No changes to mark' };
    }
    
    // Check if already marked
    const existingView = await prisma.masterChangeView.findFirst({
      where: {
        invoiceId,
        latestRevisionId: latestRevision.id,
        masterEmail
      }
    });
    
    if (existingView) {
      return { success: true, message: 'Already marked as seen' };
    }
    
    // Create view record
    await prisma.masterChangeView.create({
      data: {
        invoiceId,
        latestRevisionId: latestRevision.id,
        masterEmail,
        seenAt: new Date()
      }
    });
    
    logger.info('Changes marked as seen', {
      invoiceId,
      revisionId: latestRevision.id,
      masterEmail
    });
    
    return { success: true, seenAt: new Date() };
    
  } catch (error) {
    logger.error('Error marking changes as seen:', error);
    throw error;
  }
}

/**
 * Check if invoice has unseen changes for master
 */
async function hasUnseenChanges(invoiceId, masterEmail) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
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
    
    if (!invoice || !invoice.hasChanges || invoice.revisions.length === 0) {
      return false;
    }
    
    const latestRevision = invoice.revisions[0];
    const hasView = invoice.changeViews.some(
      view => view.latestRevisionId === latestRevision.id
    );
    
    return !hasView;
    
  } catch (error) {
    logger.error('Error checking unseen changes:', error);
    return false;
  }
}

module.exports = {
  trackRevision,
  captureRevision,
  createSubmissionBaseline,
  markChangesSeen,
  hasUnseenChanges
};
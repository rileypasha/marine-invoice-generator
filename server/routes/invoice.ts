import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
// import { generateServerIdempotencyKey } from '../middleware/idempotency'; // Unused import
import { prisma } from '../db/client';
import nodemailer from 'nodemailer';
import { createVersioningService } from '../services/versioning.service';
import { createAuditService } from '../services/audit.service';
import { createChangeRequestService } from '../services/changeRequest.service';
import { nullToUndefined } from '../utils/normalize';
import { isChangeRequested } from '../utils/status';
import { notifyNewInvoice, notifyChangeRequested, notifyApproved } from '../services/email.service';

const router = Router();

// Initialize services
const versioningService = createVersioningService(prisma);
const auditService = createAuditService(prisma);
const changeRequestService = createChangeRequestService(prisma);

interface InvoiceRequest extends Request {
  userId?: string;
  correlationId?: string;
}

// POST /api/v1/invoice/save
router.post('/save', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const idempotencyKey = req.headers['idempotency-key'] as string;

  try {
    const invoiceData = req.body;

    // Validate invoice data
    if (!invoiceData.total && !invoiceData.subtotal) {
      logger.warn('Invalid invoice data', {
        correlationId,
        userId,
        missingFields: {
          total: !invoiceData.total,
          subtotal: !invoiceData.subtotal,
        },
      });

      return res.status(400).json({
        code: 'INVALID_INVOICE_DATA',
        message: 'Missing required fields: total or subtotal is required',
        correlationId,
      });
    }

    // Generate invoice number if not provided
    const invoiceNumber = invoiceData.invoiceNumber || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const providedIdRaw =
      typeof invoiceData.id === 'string' ? invoiceData.id.trim() : invoiceData.id;

    // Check for existing invoice for idempotency (by ID if provided)
    let existingInvoice = null;
    if (typeof providedIdRaw === 'string' && providedIdRaw.length > 0) {
      existingInvoice = await prisma.invoice.findFirst({
        where: {
          id: providedIdRaw,
          userId,
        },
      });
    }

    // Fetch user name to populate userName field
    console.log('[Invoice Save] Fetching user data for userId:', userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    console.log('[Invoice Save] User data fetched:', user);

    const {
      id: _ignoredInvoiceId,
      parsedData,
      vessel,
      customer,
      ...restOfInvoiceData
    } = invoiceData;

    if (Object.prototype.hasOwnProperty.call(restOfInvoiceData, 'id')) {
      delete (restOfInvoiceData as Record<string, unknown>).id;
    }

    if (existingInvoice) {
      // Update existing invoice instead of creating duplicate
      console.log('[Invoice Save] Updating invoice with modifiedByUserName:', user?.name);
      const updatedInvoice = await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...restOfInvoiceData,
          invoiceNumber,
          userId,
          modifiedByUserId: userId,
          modifiedByUserName: user?.name || null,
          modifiedByUserEmail: user?.email || null,
          status: invoiceData.status || 'change_requested',
          attachmentUrl: invoiceData.attachmentUrl || existingInvoice.attachmentUrl,
          attachmentName: invoiceData.attachmentName || existingInvoice.attachmentName,
          attachmentType: invoiceData.attachmentType || existingInvoice.attachmentType,
          secondAttachmentUrl: invoiceData.secondAttachmentUrl || existingInvoice.secondAttachmentUrl,
          secondAttachmentName: invoiceData.secondAttachmentName || existingInvoice.secondAttachmentName,
          secondAttachmentType: invoiceData.secondAttachmentType || existingInvoice.secondAttachmentType,
        },
        include: {
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      });

      logger.info('Invoice updated (idempotent)', {
        correlationId,
        userId,
        invoiceId: updatedInvoice.id,
        idempotencyKey,
        total: updatedInvoice.total,
      });

      return res.status(200).json({
        id: updatedInvoice.id,
        invoice: updatedInvoice,
        message: 'Invoice updated successfully',
        correlationId,
        action: 'UPDATED',
      });
    }

    // Create new invoice (canonical, never draft)
    const invoiceId =
      typeof providedIdRaw === 'string' && providedIdRaw.length > 0
        ? providedIdRaw
        : randomUUID();
    console.log('[Invoice Save] Creating new invoice with userName:', user?.name);

    // Ensure data field contains JSON stringified invoice data
    const dataField = typeof restOfInvoiceData.data === 'string'
      ? restOfInvoiceData.data
      : JSON.stringify(restOfInvoiceData.lineItems || []);

    const invoice = await prisma.invoice.create({
      data: {
        ...restOfInvoiceData,
        data: dataField,
        invoiceNumber,
        userId,
        userName: user?.name || null,
        userEmail: user?.email || null,
        modifiedByUserId: userId,
        modifiedByUserName: user?.name || null,
        modifiedByUserEmail: user?.email || null,
        status: 'requested',
        attachmentUrl: invoiceData.attachmentUrl || null,
        attachmentName: invoiceData.attachmentName || null,
        attachmentType: invoiceData.attachmentType || null,
        secondAttachmentUrl: invoiceData.secondAttachmentUrl || null,
        secondAttachmentName: invoiceData.secondAttachmentName || null,
        secondAttachmentType: invoiceData.secondAttachmentType || null,
        id: invoiceId,
      },
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    logger.info('Invoice saved successfully', {
      correlationId,
      userId,
      invoiceId: invoice.id,
      idempotencyKey,
      total: invoice.total,
    });

    // Send email notification for new invoice (async, don't block response)
    notifyNewInvoice({
      invoiceNumber: invoice.invoiceNumber || undefined,
      title: invoice.title,
      customerName: invoice.customerName || undefined,
      vesselName: invoice.vesselName || undefined,
      total: invoice.total,
      createdBy: invoice.userName || invoice.userEmail || 'Unknown',
      createdById: invoice.userId || undefined,
      url: `${process.env.APP_URL || 'http://localhost:3000'}/requests/${invoice.id}`,
    }).catch(err => {
      logger.error('Failed to send new invoice notification', {
        error: err.message,
        invoiceId: invoice.id,
      });
    });

    res.status(200).json({
      id: invoice.id,
      invoice,
      message: 'Invoice saved successfully',
      correlationId,
      action: 'CREATED',
    });

  } catch (error: any) {
    logger.error('Failed to save invoice', {
      error: error.message,
      correlationId,
      userId,
      idempotencyKey,
    });

    res.status(500).json({
      code: 'SAVE_FAILED',
      message: 'Failed to save invoice',
      correlationId,
    });
  }
});

// GET /api/v1/invoice/:id
router.get('/:id', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        vessel: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!invoice) {
      logger.warn('Invoice not found', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Note: Removed ownership check - all authenticated users can view all invoices

    logger.info('Invoice retrieved successfully', {
      correlationId,
      userId,
      invoiceId,
    });

    // Add diff if status indicates change requested (handles both variants)
    let diff = null;
    if (isChangeRequested(invoice.status)) {
      diff = await changeRequestService.getCurrentDiff(invoiceId);
      logger.info('Diff retrieved for change requested invoice', {
        correlationId,
        invoiceId,
        hasDiff: !!diff,
        diffLength: diff ? diff.length : 0,
      });
    }

    res.json({
      data: invoice,
      diff,
      correlationId
    });

  } catch (error: any) {
    logger.error('Failed to retrieve invoice', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve invoice',
      correlationId,
    });
  }
});

// GET /api/v1/invoice
router.get('/', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { page = 1, limit = 10, status, search, startDate, endDate, customerId, vesselId, minAmount, maxAmount } = req.query;

  try {
    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause - show all invoices to all users
    const where: any = {
      status: { not: 'draft' }, // Exclude legacy draft records
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search as string, mode: 'insensitive' } },
        { title: { contains: search as string, mode: 'insensitive' } },
        { customer: { displayName: { contains: search as string, mode: 'insensitive' } } },
        { vessel: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        const endDateObj = new Date(endDate as string);
        endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
        where.createdAt.lte = endDateObj;
      }
    }

    // Customer filter
    if (customerId) {
      where.customerId = customerId as string;
    }

    // Vessel filter
    if (vesselId) {
      where.vesselId = vesselId as string;
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      where.total = {};
      if (minAmount) {
        where.total.gte = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        where.total.lte = parseFloat(maxAmount as string);
      }
    }

    const [rawInvoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Transform invoices to ensure userName and modifiedByUserName are populated from user relation if missing
    const invoices = rawInvoices.map(invoice => ({
      ...invoice,
      userName: invoice.userName || invoice.user?.name || null,
      userEmail: invoice.userEmail || invoice.user?.email || null,
      // For existing invoices without modifiedByUserName, use the creator's name as fallback
      modifiedByUserName: invoice.modifiedByUserName || invoice.user?.name || invoice.userName || null,
      modifiedByUserEmail: invoice.modifiedByUserEmail || invoice.user?.email || invoice.userEmail || null,
    }));

    // Calculate stats - show all invoices stats
    const stats = await prisma.invoice.groupBy({
      by: ['status'],
      where: { status: { not: 'draft' } },
      _count: { status: true },
    });

    const statsMap = {
      total: await prisma.invoice.count({ where: { status: { not: 'draft' } } }),
      requested: 0,
      change_requested: 0,
      approved: 0,
    };

    stats.forEach(stat => {
      if (stat.status === 'requested') statsMap.requested = stat._count.status;
      if (stat.status === 'change_requested') statsMap.change_requested = stat._count.status;
      if (stat.status === 'approved') statsMap.approved = stat._count.status;
    });

    logger.info('Invoices retrieved successfully', {
      correlationId,
      userId,
      count: invoices.length,
      total,
      page,
      limit,
    });

    res.json({
      invoices,
      stats: statsMap,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to list invoices', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'LIST_FAILED',
      message: 'Failed to list invoices',
      correlationId,
    });
  }
});

// PUT /api/v1/invoice/:id - Update existing invoice
router.put('/:id', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    const invoiceData = req.body;

    // Validate invoice data
    if (!invoiceData.total && !invoiceData.subtotal) {
      logger.warn('Invalid invoice data', {
        correlationId,
        userId,
        missingFields: {
          total: !invoiceData.total,
          subtotal: !invoiceData.subtotal,
        },
      });

      return res.status(400).json({
        code: 'INVALID_INVOICE_DATA',
        message: 'Missing required fields: total or subtotal is required',
        correlationId,
      });
    }

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
    });

    if (!existingInvoice) {
      logger.warn('Invoice not found', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Note: Removed ownership check - all authenticated users can update all invoices

    // Generate invoice number if not provided (keep existing if available)
    const invoiceNumber = invoiceData.invoiceNumber || existingInvoice.invoiceNumber || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Determine new status
    const newStatus = invoiceData.status || 'change_requested';
    const oldStatus = existingInvoice.status;
    const statusChangingToChangeRequested = newStatus === 'change_requested' && oldStatus !== 'change_requested';
    const statusRemainsChangeRequested = newStatus === 'change_requested' && oldStatus === 'change_requested';

    logger.info('Invoice update status analysis', {
      correlationId,
      invoiceId,
      oldStatus,
      newStatus,
      statusChangingToChangeRequested,
      statusRemainsChangeRequested,
      createdById: existingInvoice.userId,
    });

    // Check if a baseline snapshot exists for this invoice
    const hasExistingSnapshot = existingInvoice.changeRequestSnapshot != null;

    // If no baseline snapshot exists (for old invoices created before this feature),
    // capture one now using the current state BEFORE applying new changes
    if (!hasExistingSnapshot && statusChangingToChangeRequested) {
      logger.info('No baseline snapshot exists, capturing current state as baseline', {
        correlationId,
        invoiceId,
        oldStatus,
        newStatus,
      });

      const snapshotData = typeof existingInvoice.data === 'string'
        ? JSON.parse(existingInvoice.data)
        : existingInvoice.data;

      // Log what we're capturing as baseline
      const lineItemCount = snapshotData?.scope?.lineItems?.length || 0;
      logger.info('Capturing baseline snapshot', {
        correlationId,
        invoiceId,
        lineItemCount,
        lineItems: snapshotData?.scope?.lineItems?.map((li: any) => li.description) || [],
      });

      await changeRequestService.captureSnapshot(
        invoiceId,
        snapshotData,
        userId
      );
    }

    // Update the invoice
    const { parsedData, vessel, customer, ...restOfInvoiceData } = invoiceData;
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...restOfInvoiceData,
        invoiceNumber,
        status: newStatus,
        userId: existingInvoice.userId, // Preserve original creator's ID
        attachmentUrl: invoiceData.attachmentUrl !== undefined ? invoiceData.attachmentUrl : existingInvoice.attachmentUrl,
        attachmentName: invoiceData.attachmentName !== undefined ? invoiceData.attachmentName : existingInvoice.attachmentName,
        attachmentType: invoiceData.attachmentType !== undefined ? invoiceData.attachmentType : existingInvoice.attachmentType,
        secondAttachmentUrl: invoiceData.secondAttachmentUrl !== undefined ? invoiceData.secondAttachmentUrl : existingInvoice.secondAttachmentUrl,
        secondAttachmentName: invoiceData.secondAttachmentName !== undefined ? invoiceData.secondAttachmentName : existingInvoice.secondAttachmentName,
        secondAttachmentType: invoiceData.secondAttachmentType !== undefined ? invoiceData.secondAttachmentType : existingInvoice.secondAttachmentType,
      },
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
      },
    });

    // If invoice is (or just became) 'change_requested', compute and store the diff
    if (statusChangingToChangeRequested || statusRemainsChangeRequested) {
      logger.info('Computing diff for change request', {
        correlationId,
        invoiceId,
        statusChangingToChangeRequested,
        statusRemainsChangeRequested,
      });

      // Parse the data field if it's a string (from Prisma JSON field)
      const currentStateData = typeof updatedInvoice.data === 'string'
        ? JSON.parse(updatedInvoice.data)
        : updatedInvoice.data;

      // Log what we're comparing
      const currentLineItemCount = currentStateData?.scope?.lineItems?.length || 0;
      logger.info('Computing diff - current state', {
        correlationId,
        invoiceId,
        currentLineItemCount,
        currentLineItems: currentStateData?.scope?.lineItems?.map((li: any) => li.description) || [],
      });

      await changeRequestService.recomputeDiff(
        invoiceId,
        currentStateData // The NEW state after update (parsed object)
      );
    }

    logger.info('Invoice updated successfully', {
      correlationId,
      userId,
      invoiceId: updatedInvoice.id,
      total: updatedInvoice.total,
    });

    // Send email notification if invoice is in change_requested status (either just changed to it OR modified while in it)
    if (statusChangingToChangeRequested || statusRemainsChangeRequested) {
      logger.info('Sending change request notification', {
        correlationId,
        invoiceId: updatedInvoice.id,
        statusChangingToChangeRequested,
        statusRemainsChangeRequested,
        createdById: updatedInvoice.userId,
      });

      notifyChangeRequested({
        invoiceNumber: updatedInvoice.invoiceNumber || undefined,
        title: updatedInvoice.title,
        customerName: updatedInvoice.customerName || undefined,
        vesselName: updatedInvoice.vesselName || undefined,
        total: updatedInvoice.total,
        createdBy: updatedInvoice.modifiedByUserName || updatedInvoice.userName || 'Unknown',
        createdById: updatedInvoice.userId || undefined,
        url: `${process.env.APP_URL || 'http://localhost:3000'}/requests/${updatedInvoice.id}`,
      }).catch(err => {
        logger.error('Failed to send change request notification', {
          error: err.message,
          invoiceId: updatedInvoice.id,
        });
      });
    }

    // Send email notification if status changed to approved
    const statusChangingToApproved = oldStatus !== 'approved' && newStatus === 'approved';
    if (statusChangingToApproved) {
      logger.info('Sending approval notification', {
        correlationId,
        invoiceId: updatedInvoice.id,
        oldStatus,
        newStatus,
        createdById: updatedInvoice.userId,
      });

      notifyApproved({
        invoiceNumber: updatedInvoice.invoiceNumber || undefined,
        title: updatedInvoice.title,
        customerName: updatedInvoice.customerName || undefined,
        vesselName: updatedInvoice.vesselName || undefined,
        total: updatedInvoice.total,
        createdBy: updatedInvoice.modifiedByUserName || updatedInvoice.userName || 'Unknown',
        createdById: updatedInvoice.userId || undefined,
        url: `${process.env.APP_URL || 'http://localhost:3000'}/requests/${updatedInvoice.id}`,
      }).catch(err => {
        logger.error('Failed to send approval notification on status change', {
          error: err.message,
          invoiceId: updatedInvoice.id,
        });
      });
    }

    res.status(200).json({
      id: updatedInvoice.id,
      invoice: updatedInvoice,
      message: 'Invoice updated successfully',
      correlationId,
      action: 'UPDATED',
    });

  } catch (error: any) {
    logger.error('Failed to update invoice', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update invoice',
      correlationId,
    });
  }
});

// DELETE /api/v1/invoice/:id
router.delete('/:id', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    if (invoice.userId !== userId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have access to this invoice',
        correlationId,
      });
    }

    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    logger.info('Invoice deleted successfully', {
      correlationId,
      userId,
      invoiceId,
    });

    res.json({
      message: 'Invoice deleted successfully',
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to delete invoice', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete invoice',
      correlationId,
    });
  }
});

// POST /api/v1/invoice/email
router.post('/email', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;

  try {
    const { invoiceData, emailTo, emailMessage } = req.body;

    // Validate input
    if (!invoiceData || !emailTo) {
      logger.warn('Missing required email data', {
        correlationId,
        userId,
        hasInvoiceData: !!invoiceData,
        hasEmailTo: !!emailTo,
      });
      return res.status(400).json({
        code: 'INVALID_EMAIL_DATA',
        message: 'Invoice data and email recipient are required',
        correlationId,
      });
    }

    // Create email transporter (using SMTP or configured email service)
    const transporter = nodemailer.createTransport({
      // For development, you can use a service like Gmail or a test service
      // In production, configure this with your actual email service
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Prepare email content
    const vesselName = invoiceData.vessel?.name || 'Unknown Vessel';
    const customerName = invoiceData.customer?.customerName || 'Unknown Customer';
    const invoiceTotal = invoiceData.total || 0;

    const emailSubject = `Invoice for ${vesselName} - ${customerName}`;

    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c5aa0;">Marine Group Invoice</h2>

            <p>Dear ${customerName},</p>

            <p>Please find attached the invoice for services provided for your vessel <strong>${vesselName}</strong>.</p>

            ${emailMessage ? `<p><strong>Message:</strong><br>${emailMessage}</p>` : ''}

            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #2c5aa0;">Invoice Summary</h3>
              <p><strong>Vessel:</strong> ${vesselName}</p>
              <p><strong>Customer:</strong> ${customerName}</p>
              <p><strong>Total Amount:</strong> $${invoiceTotal.toFixed(2)}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your business!</p>

            <p style="margin-top: 30px;">
              Best regards,<br>
              Marine Group Team
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: emailTo,
      subject: emailSubject,
      html: emailBody,
    };

    await transporter.sendMail(mailOptions);

    logger.info('Invoice email sent successfully', {
      correlationId,
      userId,
      emailTo,
      vesselName,
      customerName,
      invoiceTotal,
    });

    res.json({
      success: true,
      message: 'Invoice email sent successfully',
      correlationId,
    });

  } catch (error) {
    logger.error('Failed to send invoice email', {
      correlationId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      code: 'EMAIL_SEND_FAILED',
      message: 'Failed to send invoice email',
      correlationId,
    });
  }
});

// ============================================
// VERSION TRACKING & DIFF ENDPOINTS
// ============================================

// PATCH /api/v1/invoice/:id - Create new version with diff tracking
router.patch('/:id', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    const invoiceData = req.body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
    });

    if (!existingInvoice) {
      logger.warn('Invoice not found', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Note: Removed ownership check - all authenticated users can create versions of all invoices

    // Fetch user data for actor information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Create version with diff tracking
    const actorInfo = {
      id: userId,
      email: user?.email || 'unknown@example.com',
      name: nullToUndefined(user?.name),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const versionResult = await versioningService.createVersion(
      invoiceId,
      invoiceData,
      actorInfo,
      req.body.changeSummary
    );

    // Change request tracking logic
    const newStatus = invoiceData.status || existingInvoice.status;
    const oldStatus = existingInvoice.status;

    // CASE 1: Status changing TO 'change_requested'
    if (isChangeRequested(newStatus) && !isChangeRequested(oldStatus)) {
      await changeRequestService.captureSnapshot(invoiceId, invoiceData, userId);

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'change_requested' },
      });

      await auditService.logStatusChanged(
        invoiceId,
        actorInfo,
        oldStatus,
        'change_requested'
      );

      logger.info('Change request snapshot captured', {
        correlationId,
        invoiceId,
        userId,
        oldStatus,
        newStatus,
      });
    }

    // CASE 2: Status changing TO 'approved' WITH attachmentUrl present
    if (newStatus === 'approved' &&
        isChangeRequested(oldStatus) &&
        invoiceData.attachmentUrl) {
      await changeRequestService.clearChangeRequest(invoiceId);

      logger.info('Change request tracking cleared on approval', {
        correlationId,
        invoiceId,
        userId,
      });

      // Note: Approval email notification is sent after invoice update (lines 617-633)
    }

    // CASE 3: Saves WHILE status is 'change_requested'
    if (isChangeRequested(oldStatus) && isChangeRequested(newStatus)) {
      await changeRequestService.recomputeDiff(invoiceId, invoiceData);

      logger.info('Change request diff recomputed', {
        correlationId,
        invoiceId,
        userId,
      });
    }

    // Log audit event if new version was created
    if (!versionResult.isNoOp) {
      await auditService.logVersionCreated(
        invoiceId,
        actorInfo,
        versionResult.revision.revisionNumber,
        versionResult.revision.changeCount
      );

      // Update invoice status if changed (and not already handled above)
      if (newStatus !== oldStatus && !isChangeRequested(oldStatus)) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: newStatus },
        });

        await auditService.logStatusChanged(
          invoiceId,
          actorInfo,
          oldStatus,
          newStatus
        );
      }
    }

    logger.info('Version created successfully', {
      correlationId,
      userId,
      invoiceId,
      revisionNumber: versionResult.revision.revisionNumber,
      isNoOp: versionResult.isNoOp,
    });

    res.status(200).json({
      revision: versionResult.revision,
      diff: versionResult.diff,
      isNoOp: versionResult.isNoOp,
      message: versionResult.isNoOp
        ? 'No changes detected'
        : 'Version created successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to create version', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'VERSION_CREATE_FAILED',
      message: 'Failed to create version',
      correlationId,
    });
  }
});

// GET /api/v1/invoice/:id/diff - Get active diff for change-requested invoice
router.get('/:id/diff', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    // Check ownership
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found or you do not have access to it',
        correlationId,
      });
    }

    // Get active diff
    const activeDiff = await versioningService.getActiveDiff(invoiceId);

    logger.info('Active diff retrieved', {
      correlationId,
      userId,
      invoiceId,
      hasDiff: !!activeDiff,
    });

    res.json({
      diff: activeDiff,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve active diff', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'DIFF_RETRIEVAL_FAILED',
      message: 'Failed to retrieve active diff',
      correlationId,
    });
  }
});

// GET /api/v1/invoice/:id/history - Get version history with pagination
router.get('/:id/history', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Check ownership
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found or you do not have access to it',
        correlationId,
      });
    }

    // Get version history
    const history = await versioningService.getVersionHistory(invoiceId, {
      limit: Number(limit),
      offset: Number(offset),
    });

    // Get total count
    const totalVersions = await versioningService.getVersionCount(invoiceId);

    logger.info('Version history retrieved', {
      correlationId,
      userId,
      invoiceId,
      count: history.length,
      total: totalVersions,
    });

    res.json({
      history,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: totalVersions,
      },
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve version history', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'HISTORY_RETRIEVAL_FAILED',
      message: 'Failed to retrieve version history',
      correlationId,
    });
  }
});

// GET /api/v1/invoice/:id/version/:revisionNumber - Get specific revision
router.get('/:id/version/:revisionNumber', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const revisionNumber = parseInt(req.params.revisionNumber, 10);

  try {
    // Check ownership
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found or you do not have access to it',
        correlationId,
      });
    }

    // Get specific revision
    const revision = await versioningService.getRevision(invoiceId, revisionNumber);

    if (!revision) {
      return res.status(404).json({
        code: 'REVISION_NOT_FOUND',
        message: 'Revision not found',
        correlationId,
      });
    }

    logger.info('Revision retrieved', {
      correlationId,
      userId,
      invoiceId,
      revisionNumber,
    });

    res.json({
      revision,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve revision', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
      revisionNumber,
    });

    res.status(500).json({
      code: 'REVISION_RETRIEVAL_FAILED',
      message: 'Failed to retrieve revision',
      correlationId,
    });
  }
});

// POST /api/v1/invoice/:id/approve - Mark invoice as approved and clear diffs
router.post('/:id/approve', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;

  try {
    // Check if invoice exists (any authenticated user can approve)
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Get latest revision number
    const latestRevision = await prisma.invoiceRevision.findFirst({
      where: { invoiceId },
      orderBy: { revisionNumber: 'desc' },
    });

    if (!latestRevision) {
      return res.status(400).json({
        code: 'NO_REVISIONS',
        message: 'No revisions found for this invoice',
        correlationId,
      });
    }

    // Fetch user data for actor information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const actorInfo = {
      id: userId,
      email: user?.email || 'unknown@example.com',
      name: nullToUndefined(user?.name),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    // Mark version as approved
    await versioningService.markVersionAsApproved(invoiceId, latestRevision.revisionNumber);

    // Log audit event
    await auditService.logInvoiceApproved(
      invoiceId,
      actorInfo,
      latestRevision.revisionNumber,
      req.body.attachmentUrl
    );

    logger.info('Invoice approved successfully', {
      correlationId,
      userId,
      invoiceId,
      revisionNumber: latestRevision.revisionNumber,
    });

    // Send email notification for approval
    notifyApproved({
      invoiceNumber: invoice.invoiceNumber || undefined,
      title: invoice.title,
      customerName: invoice.customerName || undefined,
      vesselName: invoice.vesselName || undefined,
      total: invoice.total,
      createdBy: user?.name || user?.email || 'Unknown',
      createdById: invoice.userId || undefined,
      url: `${process.env.APP_URL || 'http://localhost:3000'}/requests/${invoiceId}`,
    }).catch(err => {
      logger.error('Failed to send approval notification', {
        error: err.message,
        invoiceId,
      });
    });

    res.json({
      message: 'Invoice approved successfully',
      revisionNumber: latestRevision.revisionNumber,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to approve invoice', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'APPROVAL_FAILED',
      message: 'Failed to approve invoice',
      correlationId,
    });
  }
});

// GET /api/v1/invoice/:id/diff/:fromVersion/:toVersion - Get diff between specific versions
router.get('/:id/diff/:fromVersion/:toVersion', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const fromVersion = parseInt(req.params.fromVersion, 10);
  const toVersion = parseInt(req.params.toVersion, 10);

  try {
    // Check ownership
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        userId,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found or you do not have access to it',
        correlationId,
      });
    }

    // Get diff between versions
    const diff = await versioningService.getDiffBetweenVersions(invoiceId, fromVersion, toVersion);

    if (!diff) {
      return res.status(404).json({
        code: 'DIFF_NOT_FOUND',
        message: 'Diff not found between specified versions',
        correlationId,
      });
    }

    logger.info('Diff between versions retrieved', {
      correlationId,
      userId,
      invoiceId,
      fromVersion,
      toVersion,
    });

    res.json({
      diff,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to retrieve diff between versions', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
      fromVersion,
      toVersion,
    });

    res.status(500).json({
      code: 'DIFF_RETRIEVAL_FAILED',
      message: 'Failed to retrieve diff between versions',
      correlationId,
    });
  }
});

export default router;



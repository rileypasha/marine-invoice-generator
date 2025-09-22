import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
// import { generateServerIdempotencyKey } from '../middleware/idempotency'; // Unused import
import { prisma } from '../db/client';

const router = Router();

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

    // Check for existing invoice for idempotency (by ID if provided)
    let existingInvoice = null;
    if (invoiceData.id) {
      existingInvoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceData.id,
          userId,
        },
      });
    }

    if (existingInvoice) {
      // Update existing invoice instead of creating duplicate
      const updatedInvoice = await prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          ...invoiceData,
          invoiceNumber,
          status: 'saved', // Always canonical state, never draft
        },
        include: {
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
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
    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        invoiceNumber,
        userId,
        status: 'saved', // Always canonical state, never draft
      },
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
      },
    });

    logger.info('Invoice saved successfully', {
      correlationId,
      userId,
      invoiceId: invoice.id,
      idempotencyKey,
      total: invoice.total,
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

    // Check ownership
    if (invoice.userId !== userId) {
      logger.warn('Unauthorized invoice access attempt', {
        correlationId,
        userId,
        invoiceId,
        ownerId: invoice.userId,
      });

      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have access to this invoice',
        correlationId,
      });
    }

    logger.info('Invoice retrieved successfully', {
      correlationId,
      userId,
      invoiceId,
    });

    res.json({ invoice, correlationId });

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
  const { page = 1, limit = 10, status, search } = req.query;

  try {
    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause with tenant isolation
    const where: any = {
      userId,
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

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    // Calculate stats
    const stats = await prisma.invoice.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    });

    const statsMap = {
      total: await prisma.invoice.count({ where: { userId } }),
      saved: 0,
      drafts: 0,
      submitted: 0,
    };

    stats.forEach(stat => {
      if (stat.status === 'saved') statsMap.saved = stat._count.status;
      if (stat.status === 'draft') statsMap.drafts = stat._count.status;
      if (stat.status === 'submitted') statsMap.submitted = stat._count.status;
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

export default router;
import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { generateServerIdempotencyKey } from '../middleware/idempotency';

const router = Router();

interface InvoiceRequest extends Request {
  userId?: string;
  correlationId?: string;
}

// Mock database operations (replace with real database)
const invoiceDb = new Map<string, any>();

// POST /api/v1/invoice/save
router.post('/save', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const idempotencyKey = req.headers['idempotency-key'] as string;

  try {
    const invoiceData = req.body;
    
    // Validate invoice data
    if (!invoiceData.amount || !invoiceData.customerName) {
      logger.warn('Invalid invoice data', {
        correlationId,
        userId,
        missingFields: {
          amount: !invoiceData.amount,
          customerName: !invoiceData.customerName,
        },
      });
      
      return res.status(400).json({
        code: 'INVALID_INVOICE_DATA',
        message: 'Missing required fields: amount and customerName are required',
        correlationId,
      });
    }

    // Generate invoice ID if not provided
    const invoiceId = invoiceData.id || `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Check for existing invoice for idempotency
    const existingInvoice = invoiceDb.get(invoiceId);
    if (existingInvoice && existingInvoice.userId === userId) {
      // Update existing invoice instead of creating duplicate
      const updatedInvoice = {
        ...existingInvoice,
        ...invoiceData,
        id: invoiceId,
        userId,
        updatedAt: new Date().toISOString(),
        status: 'saved', // Always canonical state, never draft
      };
      invoiceDb.set(invoiceId, updatedInvoice);

      logger.info('Invoice updated (idempotent)', {
        correlationId,
        userId,
        invoiceId,
        idempotencyKey,
        amount: updatedInvoice.amount,
      });

      return res.status(200).json({
        id: invoiceId,
        message: 'Invoice updated successfully',
        correlationId,
        action: 'UPDATED',
      });
    }

    // Create new invoice (canonical, never draft)
    const invoice = {
      ...invoiceData,
      id: invoiceId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'saved', // Always canonical state, never draft
    };

    // Store in mock database
    invoiceDb.set(invoiceId, invoice);

    logger.info('Invoice saved successfully', {
      correlationId,
      userId,
      invoiceId,
      idempotencyKey,
      amount: invoice.amount,
    });

    res.status(200).json({
      id: invoiceId,
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
    const invoice = invoiceDb.get(invoiceId);

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

    res.json(invoice);

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
  const { page = 1, limit = 10, status } = req.query;

  try {
    // Get user's invoices from mock database (exclude any legacy drafts)
    const userInvoices = Array.from(invoiceDb.values())
      .filter(invoice => invoice.userId === userId)
      .filter(invoice => invoice.status !== 'draft') // Exclude legacy draft records
      .filter(invoice => !status || invoice.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const startIndex = (Number(page) - 1) * Number(limit);
    const endIndex = startIndex + Number(limit);
    const paginatedInvoices = userInvoices.slice(startIndex, endIndex);

    logger.info('Invoices retrieved successfully', {
      correlationId,
      userId,
      count: paginatedInvoices.length,
      total: userInvoices.length,
      page,
      limit,
    });

    res.json({
      invoices: paginatedInvoices,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: userInvoices.length,
        totalPages: Math.ceil(userInvoices.length / Number(limit)),
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
    const invoice = invoiceDb.get(invoiceId);

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

    invoiceDb.delete(invoiceId);

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
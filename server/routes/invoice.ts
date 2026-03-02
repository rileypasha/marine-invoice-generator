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

type DocumentType = 'invoice' | 'estimate';

const getDocumentType = (req: InvoiceRequest): DocumentType => {
  const queryType = typeof req.query.documentType === 'string' ? req.query.documentType : undefined;
  const bodyType = typeof (req.body as any)?.documentType === 'string' ? (req.body as any).documentType : undefined;
  const rawType = (queryType || bodyType || '').toLowerCase();
  return rawType === 'estimate' ? 'estimate' : 'invoice';
};

const getDocumentTypeFilter = (documentType: DocumentType) => {
  if (documentType === 'estimate') return {};

  // Legacy estimate rows accidentally saved in Invoice table should stay hidden.
  return {
    OR: [
      { market: null },
      { market: '' },
      { market: 'invoice' as const },
      { market: { not: 'estimate' } },
    ],
  };
};

const getPrimaryModel = (documentType: DocumentType) =>
  documentType === 'estimate' ? (prisma as any).estimate : (prisma as any).invoice;

const getNumberField = (documentType: DocumentType) =>
  documentType === 'estimate' ? 'estimateNumber' : 'invoiceNumber';

// Helper function to generate sequential number
async function generateNextInvoiceNumber(documentType: DocumentType): Promise<string> {
  const model = getPrimaryModel(documentType);
  const numberField = getNumberField(documentType);
  const prefix = documentType === 'estimate' ? 'EST-' : 'REQ-';

  const allRows = await model.findMany({
    where: {
      [numberField]: {
        startsWith: prefix
      }
    },
    select: {
      [numberField]: true
    }
  });

  if (!allRows || allRows.length === 0) {
    return `${prefix}1`;
  }

  let maxNumber = 0;
  for (const row of allRows) {
    const value = row[numberField];
    const match = typeof value === 'string' ? value.match(new RegExp(`^${prefix}(\\d+)$`)) : null;
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  return `${prefix}${maxNumber + 1}`;
}

// POST /api/v1/invoice/parse-pdf
router.post('/parse-pdf', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;

  try {
    const { pdfBase64, mimeType } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({
        code: 'MISSING_PDF',
        message: 'No PDF data provided',
        correlationId,
      });
    }

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const normalizedMimeType = (mimeType || 'application/pdf').toLowerCase();
    if (!allowedTypes.includes(normalizedMimeType)) {
      return res.status(400).json({
        code: 'INVALID_FILE_TYPE',
        message: 'File must be a PDF or image (PNG, JPEG)',
        correlationId,
      });
    }

    logger.info('Parsing PDF with Gemini', { correlationId, mimeType: normalizedMimeType });

    const { parsePdfWithGemini } = await import('../services/pdfParser.service');
    const result = await parsePdfWithGemini(pdfBase64, normalizedMimeType);

    if (!result.success) {
      return res.status(422).json({
        code: 'PARSE_FAILED',
        message: result.error || 'Failed to parse PDF',
        correlationId,
      });
    }

    logger.info('PDF parsed successfully', {
      correlationId,
      serviceCount: result.data?.services?.length || 0,
    });

    return res.json({
      success: true,
      data: result.data,
      correlationId,
    });
  } catch (error: any) {
    logger.error('PDF parse endpoint error', {
      error: error.message,
      stack: error.stack,
      correlationId,
    });
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while parsing the PDF',
      correlationId,
    });
  }
});

// POST /api/v1/invoice/save
router.post('/save', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const idempotencyKey = req.headers['idempotency-key'] as string;

  try {
    const invoiceData = req.body;
    const documentType = getDocumentType(req);
    const model = getPrimaryModel(documentType);
    const numberField = getNumberField(documentType);

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

    // Generate document number if not provided
    const generatedNumber = invoiceData[numberField] || invoiceData.invoiceNumber || await generateNextInvoiceNumber(documentType);

    const providedIdRaw =
      typeof invoiceData.id === 'string' ? invoiceData.id.trim() : invoiceData.id;

    // Check for existing invoice for idempotency (by ID if provided)
    let existingInvoice = null;
    if (typeof providedIdRaw === 'string' && providedIdRaw.length > 0) {
      existingInvoice = await model.findFirst({
        where: {
          id: providedIdRaw,
          userId,
          ...getDocumentTypeFilter(documentType),
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
      const updatedInvoice = await model.update({
        where: { id: existingInvoice.id },
        data: {
          ...restOfInvoiceData,
          [numberField]: generatedNumber,
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
          market: documentType,
        },
        include: {
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
          user: { select: { name: true, email: true, avatarUrl: true } },
        },
      });

      logger.info('Invoice updated (idempotent)', {
        correlationId,
        userId,
        invoiceId: updatedInvoice.id,
        idempotencyKey,
        total: updatedInvoice.total,
      });

      if (documentType === 'estimate') {
        updatedInvoice.invoiceNumber = updatedInvoice.estimateNumber;
      }

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

    const invoice = await model.create({
      data: {
        ...restOfInvoiceData,
        data: dataField,
        [numberField]: generatedNumber,
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
        market: documentType,
        id: invoiceId,
      },
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
        user: { select: { name: true, email: true, avatarUrl: true } },
      },
    });

    logger.info('Invoice saved successfully', {
      correlationId,
      userId,
      invoiceId: invoice.id,
      idempotencyKey,
      total: invoice.total,
    });

    if (documentType === 'invoice') {
      // Send email notification for new invoice (async, don't block response)
      notifyNewInvoice({
        invoiceNumber: invoice.invoiceNumber || undefined,
        title: invoice.title,
        customerName: invoice.customerName || undefined,
        vesselName: invoice.vesselName || undefined,
        total: invoice.total,
        createdBy: invoice.userName || invoice.userEmail || 'Unknown',
        createdById: invoice.userId || undefined,
        url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/requests/${invoice.id}`,
      }).catch(err => {
        logger.error('Failed to send new invoice notification', {
          error: err.message,
          invoiceId: invoice.id,
        });
      });
    }

    if (documentType === 'estimate') {
      invoice.invoiceNumber = invoice.estimateNumber;
    }

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
  const documentType = getDocumentType(req);

  try {
    const model = getPrimaryModel(documentType);
    const invoice = await model.findFirst({
      where: { id: invoiceId, ...getDocumentTypeFilter(documentType) },
      include: {
        customer: true,
        vessel: true,
        user: { select: { name: true, email: true, avatarUrl: true } },
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

    // Add diff only for invoice workflow
    let diff = null;
    if (documentType === 'invoice' && isChangeRequested(invoice.status)) {
      diff = await changeRequestService.getCurrentDiff(invoiceId);
      logger.info('Diff retrieved for change requested invoice', {
        correlationId,
        invoiceId,
        hasDiff: !!diff,
        diffLength: diff ? diff.length : 0,
      });
    }

    if (documentType === 'estimate') {
      invoice.invoiceNumber = invoice.estimateNumber;
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
  const { page = 1, limit = 10, status, search, startDate, endDate, customerId, vesselId, minAmount, maxAmount, contact, vessel, createdBy, modifiedBy, sortField, sortDirection } = req.query;
  const documentType = getDocumentType(req);

  try {
    const model = getPrimaryModel(documentType);
    const numberField = getNumberField(documentType);
    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause - show all invoices to all users
    const where: any = {
      AND: [
        { status: { not: 'draft' } }, // Exclude legacy draft records
        getDocumentTypeFilter(documentType),
      ],
    };

    if (status) {
      where.AND.push({ status });
    }

    if (search) {
      where.AND.push({
        OR: [
          { [numberField]: { contains: search as string, mode: 'insensitive' } },
          { title: { contains: search as string, mode: 'insensitive' } },
          { contactName: { contains: search as string, mode: 'insensitive' } },
          { customerName: { contains: search as string, mode: 'insensitive' } },
          { customer: { display_name: { contains: search as string, mode: 'insensitive' } } },
          { vesselName: { contains: search as string, mode: 'insensitive' } },
          { vessel: { name: { contains: search as string, mode: 'insensitive' } } },
          { userName: { contains: search as string, mode: 'insensitive' } },
        ],
      });
    }

    // Date range filter
    if (startDate || endDate) {
      const createdAtFilter: any = {};
      if (startDate) {
        createdAtFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        const endDateObj = new Date(endDate as string);
        endDateObj.setHours(23, 59, 59, 999); // Include the entire end date
        createdAtFilter.lte = endDateObj;
      }
      where.AND.push({ createdAt: createdAtFilter });
    }

    // Customer filter
    if (customerId) {
      where.AND.push({ customerId: customerId as string });
    }

    // Vessel filter
    if (vesselId) {
      where.AND.push({ vesselId: vesselId as string });
    }

    // Contact name filter
    if (contact) {
      where.AND.push({
        OR: [
          { contactName: { contains: contact as string, mode: 'insensitive' } },
          { customer: { display_name: { contains: contact as string, mode: 'insensitive' } } },
        ],
      });
    }

    // Vessel name filter
    if (vessel) {
      where.AND.push({
        OR: [
          { vesselName: { contains: vessel as string, mode: 'insensitive' } },
          { vessel: { name: { contains: vessel as string, mode: 'insensitive' } } },
        ],
      });
    }

    // Created by filter
    if (createdBy) {
      where.AND.push({
        OR: [
          { userName: { contains: createdBy as string, mode: 'insensitive' } },
          { userEmail: { contains: createdBy as string, mode: 'insensitive' } },
        ],
      });
    }

    // Modified by filter
    if (modifiedBy) {
      where.AND.push({
        OR: [
          { modifiedByUserName: { contains: modifiedBy as string, mode: 'insensitive' } },
          { modifiedByUserEmail: { contains: modifiedBy as string, mode: 'insensitive' } },
        ],
      });
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      const totalFilter: any = {};
      if (minAmount) {
        totalFilter.gte = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        totalFilter.lte = parseFloat(maxAmount as string);
      }
      where.AND.push({ total: totalFilter });
    }

    // Build dynamic orderBy
    const dir = sortDirection === 'asc' ? 'asc' : 'desc';
    const isNumericSort = sortField === 'invoice_number';
    const sortFieldMap: Record<string, any> = {
      'customer.display_name': { customer: { display_name: dir } },
      'vessel.name': { vessel: { name: dir } },
      'total_amount': { total: dir },
      'invoice_date': { createdAt: dir },
      'updated_at': { updatedAt: dir },
      'status': { status: dir },
    };
    const orderBy = (!isNumericSort && sortField && sortFieldMap[sortField as string]) || { createdAt: 'desc' };

    // For invoice_number sort, we need numeric ordering since Prisma sorts
    // strings lexicographically ("9" > "23"). Fetch all matching IDs with
    // their number, sort numerically in JS, then paginate.
    let sortedIds: string[] | null = null;
    if (isNumericSort) {
      const allIds: { id: string; num: string | null }[] = await model.findMany({
        where,
        select: { id: true, [numberField]: true },
      }).then((rows: any[]) => rows.map((r: any) => ({
        id: r.id,
        num: r[numberField] as string | null,
      })));

      // Extract numeric portion and sort
      allIds.sort((a: { num: string | null }, b: { num: string | null }) => {
        const numA = parseInt((a.num || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt((b.num || '0').replace(/[^0-9]/g, ''), 10) || 0;
        return dir === 'asc' ? numA - numB : numB - numA;
      });

      // Paginate the sorted IDs
      sortedIds = allIds.slice(skip, skip + Number(limit)).map((r: { id: string }) => r.id);
    }

    // Execute all queries in parallel for maximum performance
    const [rawInvoices, total, stats] = await Promise.all([
      model.findMany({
        where: sortedIds ? { ...where, id: { in: sortedIds } } : where,
        skip: sortedIds ? undefined : skip,
        take: sortedIds ? undefined : Number(limit),
        orderBy: sortedIds ? undefined : orderBy,
        select: {
          id: true,
          [numberField]: true,
          title: true,
          status: true,
          total: true,
          subtotal: true,
          taxAmount: true,
          grossProfit: true,
          profitPercent: true,
          data: true,
          createdAt: true,
          updatedAt: true,
          contactName: true,
          customerName: true,
          vesselName: true,
          userName: true,
          userEmail: true,
          modifiedByUserName: true,
          modifiedByUserEmail: true,
          modifiedByUserId: true,
          customerId: true,
          vesselId: true,
          userId: true,
          customer: { select: { display_name: true, legal_name: true } },
          vessel: { select: { name: true } },
          user: { select: { name: true, email: true, avatarUrl: true } },
        },
      }),
      model.count({ where }),
      // Calculate stats in parallel instead of sequential
      model.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ]);

    // Get unique user IDs from modifiedByUserId fields
    const modifiedByUserIds = Array.from(new Set(rawInvoices.map((inv: any) => inv.modifiedByUserId).filter(Boolean))) as string[];

    // Fetch all modifier users in one query
    const modifiedByUsers = modifiedByUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: modifiedByUserIds } },
          select: { id: true, avatarUrl: true },
        })
      : [];

    // Create a map for quick lookup
    const modifiedByUserMap = new Map(modifiedByUsers.map(u => [u.id, u.avatarUrl]));

    // Transform invoices to ensure userName and modifiedByUserName are populated from user relation if missing
    const invoices = rawInvoices.map((invoice: any) => {
      if (documentType === 'estimate') {
        invoice.invoiceNumber = invoice.estimateNumber;
      }
      // Debug logging for contactName transformation
      if (invoice.contactName) {
        logger.info('[GET /invoice] Found invoice with contactName', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          contactName: invoice.contactName,
          hasCustomer: !!invoice.customer,
          customerDisplayName: invoice.customer?.display_name,
        });
      }

      // Only transform customer if there's an actual linked customer
      // If no customer, keep it null and let frontend use invoice.contactName directly
      const transformedCustomer = invoice.customer ? {
          ...invoice.customer,
          contact_name: invoice.contactName || invoice.customer.display_name || null,
        } : null;

      // Debug logging for customer transformation
      if (invoice.contactName && invoice.invoiceNumber === 'REQ-21') {
        logger.info('[GET /invoice] REQ-21 customer transformation', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          contactName: invoice.contactName,
          hasCustomer: !!invoice.customer,
          transformedCustomer: transformedCustomer,
        });
      }

      // Compute totals from line items in data JSON so the list always matches detail view
      let totalQuantity = 0;
      let derivedBaseCost = 0;
      let derivedSubtotal = 0;
      let derivedTax = 0;
      let derivedTotal = 0;
      let derivedGrossProfit = 0;
      try {
        const parsed = typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data;
        const lineItems: any[] = parsed?.scope?.lineItems || [];
        const scope = parsed?.scope;

        for (const item of lineItems) {
          if (!item || item._deleted) continue;

          // calculateLineItemCost
          const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 1;
          let cost = item.cost !== undefined ? parseFloat(String(item.cost)) : 0;
          if (Number.isNaN(cost)) cost = 0;
          if (!(cost > 0)) {
            if (item.manualCost != null && item.manualCost !== 0) {
              const mc = parseFloat(String(item.manualCost)) || 0;
              cost = item.jobType === 'Clearance Fee' ? mc : mc * quantity;
            } else {
              cost = 0;
            }
          }

          // applyMarkup
          let costWithMarkup = cost;
          const isExempt = item.isMarkupExempt || item.markupType === 'No Markup' || item.markupType === 'exempt' || item.jobType === 'Clearance Fee';
          if (!isExempt) {
            let markupPercent = 0;
            if (item.markupType === '2.5%' || item.markupType === 'preset-2.5') {
              markupPercent = 2.5;
            } else if (item.markupType === '12.5%' || item.markupType === 'preset-12.5') {
              markupPercent = 12.5;
            } else if (item.markupType === 'custom' && item.markupRate !== undefined) {
              markupPercent = parseFloat(String(item.markupRate));
              if (Number.isNaN(markupPercent)) markupPercent = 0;
              if (markupPercent > 0 && markupPercent <= 1) markupPercent *= 100;
            } else if (item.markupRate !== undefined) {
              markupPercent = parseFloat(String(item.markupRate));
              if (Number.isNaN(markupPercent)) markupPercent = 0;
              if (markupPercent > 0 && markupPercent <= 1) markupPercent *= 100;
            } else if (scope?.markupRate !== undefined) {
              markupPercent = parseFloat(String(scope.markupRate));
              if (Number.isNaN(markupPercent)) markupPercent = 0;
              if (markupPercent > 0 && markupPercent <= 1) markupPercent *= 100;
            }
            costWithMarkup = cost * (1 + markupPercent / 100);
          }

          // calculateTax
          let taxAmount = 0;
          if (item.jobType !== 'Clearance Fee' && !item.isTaxExempt) {
            const status = typeof item.taxStatus === 'string' ? item.taxStatus.toLowerCase() : '';
            if (status === 'taxable') {
              const taxRate = (typeof item.taxRate === 'number' && item.taxRate > 0)
                ? item.taxRate
                : (item.taxRate !== undefined ? parseFloat(String(item.taxRate)) : 0.0875);
              taxAmount = costWithMarkup * (taxRate > 0 ? taxRate : 0.0875);
            }
          }

          totalQuantity += quantity;
          derivedBaseCost += cost;
          derivedSubtotal += costWithMarkup;
          derivedTax += taxAmount;
        }
        derivedTotal = derivedSubtotal + derivedTax;
        derivedGrossProfit = derivedSubtotal - derivedBaseCost;
      } catch {
        // Fall back to persisted values if line item parsing fails
        derivedBaseCost = 0;
        derivedSubtotal = invoice.subtotal || 0;
        derivedTax = invoice.taxAmount || 0;
        derivedTotal = invoice.total || 0;
        derivedGrossProfit = invoice.grossProfit || 0;
        totalQuantity = 0;
      }

      // Strip raw data field (contains receipt images) but keep computed fields
      const { data: _data, ...invoiceWithoutData } = invoice;

      return {
        ...invoiceWithoutData,
        subtotal: derivedSubtotal,
        taxAmount: derivedTax,
        total: derivedTotal,
        grossProfit: derivedGrossProfit,
        profitPercent: derivedBaseCost > 0 ? (derivedGrossProfit / derivedBaseCost) * 100 : 0,
        userName: invoice.userName || invoice.user?.name || null,
        userEmail: invoice.userEmail || invoice.user?.email || null,
        modifiedByUserName: invoice.modifiedByUserName || invoice.user?.name || invoice.userName || null,
        modifiedByUserEmail: invoice.modifiedByUserEmail || invoice.user?.email || invoice.userEmail || null,
        modifiedByUserAvatar: invoice.modifiedByUserId
          ? (modifiedByUserMap.get(invoice.modifiedByUserId) || null)
          : (invoice.user?.avatarUrl || null),
        customer: transformedCustomer,
        totalQuantity,
      };
    });

    // Re-order results to match the numerically sorted IDs
    if (sortedIds) {
      const idOrder = new Map(sortedIds.map((id, i) => [id, i]));
      invoices.sort((a: any, b: any) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    }

    // Build stats map from groupBy results (no additional query needed)
    const statsMap = {
      total: stats.reduce((sum: number, stat: any) => sum + stat._count.status, 0),
      requested: 0,
      change_requested: 0,
      approved: 0,
    };

    stats.forEach((stat: any) => {
      if (stat.status === 'requested') statsMap.requested = stat._count.status;
      if (stat.status === 'change_requested') statsMap.change_requested = stat._count.status;
      if (stat.status === 'approved') statsMap.approved = stat._count.status;
    });

    // DEBUG: Log REQ-21 in response
    const req21InResponse = invoices.find((inv: any) => inv.invoiceNumber === 'REQ-21');
    if (req21InResponse) {
      logger.info('[GET /invoice] REQ-21 in JSON response:', {
        invoiceNumber: req21InResponse.invoiceNumber,
        contactName: (req21InResponse as any).contactName,
        customerName: (req21InResponse as any).customerName,
        hasCustomer: !!req21InResponse.customer,
        customerData: req21InResponse.customer ? {
          display_name: req21InResponse.customer.display_name,
          contact_name: (req21InResponse.customer as any).contact_name
        } : null
      });
    }

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
  const documentType = getDocumentType(req);

  try {
    const invoiceData = req.body;
    const model = getPrimaryModel(documentType);
    const numberField = getNumberField(documentType);

    // Log incoming request for debugging
    logger.info('PUT /api/v1/invoice/:id - Request received', {
      correlationId,
      userId,
      invoiceId,
      payloadKeys: Object.keys(invoiceData),
      dataFieldType: typeof invoiceData.data,
      dataFieldLength: invoiceData.data ? JSON.stringify(invoiceData.data).length : 0,
      hasCustomerId: !!invoiceData.customerId,
      hasVesselId: !!invoiceData.vesselId,
      status: invoiceData.status,
      total: invoiceData.total,
      subtotal: invoiceData.subtotal,
    });

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
    const existingInvoice = await model.findFirst({
      where: {
        id: invoiceId,
        ...getDocumentTypeFilter(documentType),
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
    const invoiceNumber =
      invoiceData[numberField] ||
      invoiceData.invoiceNumber ||
      existingInvoice[numberField] ||
      await generateNextInvoiceNumber(documentType);

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

    // Update the invoice
    const { parsedData, vessel, customer, customerId, vesselId, ...restOfInvoiceData } = invoiceData;

    // Build update data - explicitly preserve attachments and data field if not provided
    const updateData: any = {
      ...restOfInvoiceData,
      [numberField]: invoiceNumber,
      status: newStatus,
      userId: existingInvoice.userId, // Preserve original creator's ID
      // Preserve attachment fields if not provided (check for both undefined and null)
      attachmentUrl: (invoiceData.attachmentUrl !== undefined && invoiceData.attachmentUrl !== null)
        ? invoiceData.attachmentUrl
        : existingInvoice.attachmentUrl,
      attachmentName: (invoiceData.attachmentName !== undefined && invoiceData.attachmentName !== null)
        ? invoiceData.attachmentName
        : existingInvoice.attachmentName,
      attachmentType: (invoiceData.attachmentType !== undefined && invoiceData.attachmentType !== null)
        ? invoiceData.attachmentType
        : existingInvoice.attachmentType,
      secondAttachmentUrl: (invoiceData.secondAttachmentUrl !== undefined && invoiceData.secondAttachmentUrl !== null)
        ? invoiceData.secondAttachmentUrl
        : existingInvoice.secondAttachmentUrl,
      secondAttachmentName: (invoiceData.secondAttachmentName !== undefined && invoiceData.secondAttachmentName !== null)
        ? invoiceData.secondAttachmentName
        : existingInvoice.secondAttachmentName,
      secondAttachmentType: (invoiceData.secondAttachmentType !== undefined && invoiceData.secondAttachmentType !== null)
        ? invoiceData.secondAttachmentType
        : existingInvoice.secondAttachmentType,
      // Preserve data field (contains receipts and services) if not provided
      data: invoiceData.data !== undefined ? invoiceData.data : existingInvoice.data,
      market: documentType,
    };

    // Only include customerId and vesselId if they're not null
    if (customerId !== null && customerId !== undefined) {
      updateData.customerId = customerId;
    }
    if (vesselId !== null && vesselId !== undefined) {
      updateData.vesselId = vesselId;
    }

    // Log update data before Prisma call for debugging
    logger.info('About to execute Prisma update', {
      correlationId,
      invoiceId,
      updateDataKeys: Object.keys(updateData),
      updateDataStatus: updateData.status,
      updateDataTotal: updateData.total,
      updateDataSubtotal: updateData.subtotal,
      hasCustomerId: !!updateData.customerId,
      hasVesselId: !!updateData.vesselId,
      dataFieldType: typeof updateData.data,
      dataFieldIsDefined: updateData.data !== undefined,
    });

    // TEMP FIX: Skip snapshot capture - JSONB update takes 5.8s on Render, causes P1017 timeout
    // TODO: Move snapshot to async background job after responding to user
    const updatedInvoice = await model.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
      },
    });

    // If invoice is (or just became) 'change_requested', compute and store the diff
    if (documentType === 'invoice' && (statusChangingToChangeRequested || statusRemainsChangeRequested)) {
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
    if (documentType === 'invoice' && (statusChangingToChangeRequested || statusRemainsChangeRequested)) {
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
        url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/requests/${updatedInvoice.id}`,
      }).catch(err => {
        logger.error('Failed to send change request notification', {
          error: err.message,
          invoiceId: updatedInvoice.id,
        });
      });
    }

    // Send email notification if status changed to approved
    const statusChangingToApproved = oldStatus !== 'approved' && newStatus === 'approved';
    if (documentType === 'invoice' && statusChangingToApproved) {
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
        url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/requests/${updatedInvoice.id}`,
      }).catch(err => {
        logger.error('Failed to send approval notification on status change', {
          error: err.message,
          invoiceId: updatedInvoice.id,
        });
      });
    }

    if (documentType === 'estimate') {
      updatedInvoice.invoiceNumber = updatedInvoice.estimateNumber;
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
      stack: error.stack,
      correlationId,
      userId,
      invoiceId,
      errorName: error.name,
      errorCode: error.code,
      // Prisma-specific error details
      prismaErrorCode: error.code,
      prismaErrorMeta: error.meta,
    });

    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      correlationId,
    });
  }
});

// DELETE /api/v1/invoice/:id
router.delete('/:id', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const documentType = getDocumentType(req);

  try {
    const model = getPrimaryModel(documentType);
    const invoice = await model.findFirst({
      where: { id: invoiceId, ...getDocumentTypeFilter(documentType) },
    });

    if (!invoice) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Note: Removed ownership check - all authenticated users can delete all invoices

    await model.delete({
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

// POST /api/v1/invoice/:id/create-invoice
router.post('/:id/create-invoice', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const estimateId = req.params.id;

  try {
    const estimate = await (prisma as any).estimate.findFirst({
      where: { id: estimateId },
    });

    if (!estimate) {
      return res.status(404).json({
        code: 'ESTIMATE_NOT_FOUND',
        message: 'Estimate not found',
        correlationId,
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const nextInvoiceNumber = await generateNextInvoiceNumber('invoice');

    const createdInvoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        invoiceNumber: nextInvoiceNumber,
        title: estimate.title,
        status: 'requested',
        data: estimate.data,
        metadata: estimate.metadata,
        userId,
        userName: actor?.name || estimate.userName || null,
        userEmail: actor?.email || estimate.userEmail || null,
        modifiedByUserId: userId,
        modifiedByUserName: actor?.name || null,
        modifiedByUserEmail: actor?.email || null,
        vesselName: estimate.vesselName,
        vesselWeight: estimate.vesselWeight,
        vesselBeam: estimate.vesselBeam,
        customerName: estimate.customerName,
        contactName: estimate.contactName,
        customerEmail: estimate.customerEmail,
        customerPhone: estimate.customerPhone,
        customerAddress: estimate.customerAddress,
        subtotal: estimate.subtotal,
        taxAmount: estimate.taxAmount,
        total: estimate.total,
        grossProfit: estimate.grossProfit,
        profitPercent: estimate.profitPercent,
        market: 'invoice',
        notes: estimate.notes,
        savedAt: new Date(),
        customerId: estimate.customerId,
        vesselId: estimate.vesselId,
        attachmentUrl: estimate.attachmentUrl,
        attachmentName: estimate.attachmentName,
        attachmentType: estimate.attachmentType,
        secondAttachmentUrl: estimate.secondAttachmentUrl,
        secondAttachmentName: estimate.secondAttachmentName,
        secondAttachmentType: estimate.secondAttachmentType,
      },
      include: {
        customer: { select: { display_name: true, legal_name: true } },
        vessel: { select: { name: true } },
        user: { select: { name: true, email: true, avatarUrl: true } },
      },
    });

    logger.info('Invoice created from estimate', {
      correlationId,
      userId,
      estimateId,
      invoiceId: createdInvoice.id,
      invoiceNumber: createdInvoice.invoiceNumber,
    });

    res.status(200).json({
      message: 'Invoice created from estimate successfully',
      invoice: createdInvoice,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to create invoice from estimate', {
      error: error.message,
      correlationId,
      userId,
      estimateId,
    });

    res.status(500).json({
      code: 'CREATE_INVOICE_FROM_ESTIMATE_FAILED',
      message: 'Failed to create invoice from estimate',
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
  const documentType = getDocumentType(req);

  try {
    const invoiceData = req.body;

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        ...getDocumentTypeFilter(documentType),
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

    // Update invoice with attachment data and status, preserving existing metadata
    const updateData: any = {
      status: 'approved',
    };

    // Only update attachment fields if they're provided in the request
    if (req.body.attachmentUrl) {
      updateData.attachmentUrl = req.body.attachmentUrl;
    }
    if (req.body.attachmentName) {
      updateData.attachmentName = req.body.attachmentName;
    }
    if (req.body.attachmentType) {
      updateData.attachmentType = req.body.attachmentType;
    }

    // Update the invoice record
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

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
      hasAttachment: !!req.body.attachmentUrl,
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
      url: `${process.env.API_BASE_URL || 'http://localhost:3000'}/requests/${invoiceId}`,
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

// POST /api/v1/invoice/:id/comments - Create new comment
router.post('/:id/comments', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const documentType = getDocumentType(req);

  try {
    const model = getPrimaryModel(documentType);
    const { text, selectionText, highlight } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      logger.warn('Invalid comment text', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(400).json({
        code: 'INVALID_COMMENT',
        message: 'Comment text is required',
        correlationId,
      });
    }

    if (!selectionText || typeof selectionText !== 'string') {
      logger.warn('Invalid selection text', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(400).json({
        code: 'INVALID_SELECTION',
        message: 'Selection text is required',
        correlationId,
      });
    }

    if (!highlight || typeof highlight !== 'object') {
      logger.warn('Invalid highlight data', {
        correlationId,
        userId,
        invoiceId,
      });

      return res.status(400).json({
        code: 'INVALID_HIGHLIGHT',
        message: 'Highlight data is required',
        correlationId,
      });
    }

    // Check if invoice exists
    const invoice = await model.findFirst({
      where: { id: invoiceId, ...getDocumentTypeFilter(documentType) },
      select: { id: true, metadata: true },
    });

    if (!invoice) {
      logger.warn('Invoice not found for comment creation', {
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

    // Get user data for comment author
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUrl: true },
    });

    // Parse existing metadata
    let metadata: any = {};
    if (invoice.metadata) {
      if (typeof invoice.metadata === 'string') {
        try {
          metadata = JSON.parse(invoice.metadata);
        } catch (e) {
          metadata = {};
        }
      } else {
        metadata = invoice.metadata;
      }
    }

    // Initialize comments array if it doesn't exist
    if (!metadata.comments || !Array.isArray(metadata.comments)) {
      metadata.comments = [];
    }

    // Create new comment
    const newComment = {
      id: randomUUID(),
      author: user?.name || user?.email || 'Unknown User',
      initials: user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U',
      avatarUrl: user?.avatarUrl || undefined,
      text: text.trim(),
      selectionText: selectionText.trim(),
      createdAt: new Date().toISOString(),
      highlight: {
        top: Number(highlight.top) || 0,
        left: Number(highlight.left) || 0,
        width: Number(highlight.width) || 28,
        height: Number(highlight.height) || 24,
      },
      replies: [],
    };

    metadata.comments.push(newComment);

    // Update invoice metadata
    const updatedInvoice = await model.update({
      where: { id: invoiceId },
      data: {
        metadata: JSON.stringify(metadata),
      },
    });

    logger.info('Comment created successfully', {
      correlationId,
      userId,
      invoiceId,
      commentId: newComment.id,
    });

    res.json({
      comment: newComment,
      metadata: updatedInvoice.metadata,
      message: 'Comment created successfully',
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to create comment', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
    });

    res.status(500).json({
      code: 'COMMENT_FAILED',
      message: 'Failed to create comment',
      correlationId,
    });
  }
});

// POST /api/v1/invoice/:id/comments/:commentId/reply - Add reply to comment
router.post('/:id/comments/:commentId/reply', async (req: InvoiceRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const invoiceId = req.params.id;
  const commentId = req.params.commentId;
  const documentType = getDocumentType(req);

  try {
    const model = getPrimaryModel(documentType);
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      logger.warn('Invalid reply text', {
        correlationId,
        userId,
        invoiceId,
        commentId,
      });

      return res.status(400).json({
        code: 'INVALID_REPLY',
        message: 'Reply text is required',
        correlationId,
      });
    }

    // Check if invoice exists
    const invoice = await model.findFirst({
      where: { id: invoiceId, ...getDocumentTypeFilter(documentType) },
      select: { id: true, metadata: true },
    });

    if (!invoice) {
      logger.warn('Invoice not found for comment reply', {
        correlationId,
        userId,
        invoiceId,
        commentId,
      });

      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
        correlationId,
      });
    }

    // Get user data for reply author
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, avatarUrl: true },
    });

    // Parse existing metadata
    let metadata: any = {};
    if (invoice.metadata) {
      if (typeof invoice.metadata === 'string') {
        try {
          metadata = JSON.parse(invoice.metadata);
        } catch (e) {
          metadata = {};
        }
      } else {
        metadata = invoice.metadata;
      }
    }

    // Initialize comments array if it doesn't exist
    if (!metadata.comments || !Array.isArray(metadata.comments)) {
      metadata.comments = [];
    }

    // Find the comment and add reply
    const comment = metadata.comments.find((c: any) => c.id === commentId);
    if (!comment) {
      logger.warn('Comment not found for reply', {
        correlationId,
        userId,
        invoiceId,
        commentId,
      });

      return res.status(404).json({
        code: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
        correlationId,
      });
    }

    // Initialize replies array if it doesn't exist
    if (!comment.replies || !Array.isArray(comment.replies)) {
      comment.replies = [];
    }

    // Create new reply
    const newReply = {
      id: randomUUID(),
      author: user?.name || user?.email || 'Unknown User',
      initials: user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U',
      avatarUrl: user?.avatarUrl || undefined,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    comment.replies.push(newReply);

    // Update invoice metadata
    const updatedInvoice = await model.update({
      where: { id: invoiceId },
      data: {
        metadata: JSON.stringify(metadata),
      },
    });

    logger.info('Comment reply added successfully', {
      correlationId,
      userId,
      invoiceId,
      commentId,
      replyId: newReply.id,
    });

    res.json({
      reply: newReply,
      metadata: updatedInvoice.metadata,
      message: 'Reply added successfully',
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to add comment reply', {
      error: error.message,
      correlationId,
      userId,
      invoiceId,
      commentId,
    });

    res.status(500).json({
      code: 'REPLY_FAILED',
      message: 'Failed to add reply',
      correlationId,
    });
  }
});

export default router;



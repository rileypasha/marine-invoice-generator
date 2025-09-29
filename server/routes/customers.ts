import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import { parsePhoneNumber } from 'libphonenumber-js';

const router = Router();

interface CustomerRequest extends Request {
  userId?: string;
  correlationId?: string;
}

// Customer validation function
const validateCustomer = (data: any) => {
  const errors: Array<{ field: string; message: string }> = [];

  // Required fields
  if (!data.display_name || data.display_name.trim().length === 0) {
    errors.push({ field: 'display_name', message: 'Display name is required' });
  }

  if (data.display_name && data.display_name.length > 255) {
    errors.push({ field: 'display_name', message: 'Display name must be less than 255 characters' });
  }

  // Email validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }

  // Phone validation (basic) - more flexible since we can format it
  if (data.phone && !/^[\d\s\-\+\(\)\.x]+$/i.test(data.phone)) {
    errors.push({ field: 'phone', message: 'Valid phone number is required' });
  }

  return errors;
};

// Header mapping from user-friendly names to database field names
const headerMapping: Record<string, string> = {
  'Contact Name': 'display_name',
  'Company Name': 'legal_name',
  'Email Address': 'email',
  'Phone Number': 'phone',
  'Address': 'full_address', // Special field for single address parsing
  // Keep legacy field mappings for backward compatibility
  'City': 'city',
  'State': 'state',
  'ZIP Code': 'postal_code',
  'Postal Code': 'postal_code',
  'display_name': 'display_name',
  'legal_name': 'legal_name',
  'email': 'email',
  'phone': 'phone',
  'address_line1': 'address_line1',
  'city': 'city',
  'state': 'state',
  'postal_code': 'postal_code',
};

// Function to format phone numbers consistently for CSV import
const formatPhoneNumber = (phone: string | null | undefined): string | null => {
  if (!phone || phone.trim().length === 0) {
    return null;
  }

  const cleanPhone = phone.trim();

  try {
    // If the phone already starts with +, try parsing it as-is (international format)
    if (cleanPhone.startsWith('+')) {
      const parsed = parsePhoneNumber(cleanPhone);
      return parsed ? parsed.format('E.164') : cleanPhone;
    }

    // For US numbers without country code, assume US and parse
    const parsed = parsePhoneNumber(cleanPhone, 'US');
    return parsed ? parsed.format('E.164') : cleanPhone;
  } catch (error) {
    // If parsing fails, return the original phone number
    console.warn(`Failed to format phone number: ${cleanPhone}`, error);
    return cleanPhone;
  }
};

// Function to parse a single address string into components
const parseAddress = (addressString: string) => {
  if (!addressString || addressString.trim().length === 0) {
    return {
      address_line1: null,
      city: null,
      state: null,
      postal_code: null
    };
  }

  const cleanAddress = addressString.trim();

  // Split by commas to get potential components
  const parts = cleanAddress.split(',').map(part => part.trim());

  if (parts.length === 1) {
    // Only one part - treat as street address
    return {
      address_line1: parts[0],
      city: null,
      state: null,
      postal_code: null
    };
  }

  let streetAddress = '';
  let city = '';
  let state = '';
  let postalCode = '';

  if (parts.length >= 2) {
    // First part is always street address
    streetAddress = parts[0];

    // Last part might contain state and/or ZIP
    const lastPart = parts[parts.length - 1];

    // Check if last part contains ZIP code pattern
    const zipMatch = lastPart.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (zipMatch) {
      postalCode = zipMatch[1];
      // Remove ZIP from the last part to get state
      const withoutZip = lastPart.replace(zipMatch[0], '').trim();
      if (withoutZip) {
        state = withoutZip;
      }
    } else {
      // No ZIP found, last part might be state
      state = lastPart;
    }

    // Handle city
    if (parts.length === 3) {
      // Format: "Street, City, State ZIP"
      city = parts[1];
    } else if (parts.length === 4) {
      // Format: "Street, City, State, ZIP" or similar
      city = parts[1];
      if (!state && !postalCode) {
        state = parts[2];
      }
    } else if (parts.length > 4) {
      // Multiple parts - combine middle parts as city
      city = parts.slice(1, -1).join(', ');
    }
  }

  // Clean up state - handle full state names and abbreviations
  if (state) {
    state = state.trim();
    // If state looks like a ZIP code pattern, it might be misplaced
    if (/^\d{5}(?:-\d{4})?$/.test(state)) {
      if (!postalCode) {
        postalCode = state;
        state = '';
      }
    }
    // Limit state to reasonable length (abbreviations or full names)
    if (state.length > 20) {
      state = state.substring(0, 20);
    }
  }

  return {
    address_line1: streetAddress || null,
    city: city || null,
    state: state || null,
    postal_code: postalCode || null
  };
};

// Function to normalize CSV headers to database field names
const normalizeHeaders = (record: any): any => {
  const normalizedRecord: any = {};

  Object.keys(record).forEach(key => {
    const normalizedKey = headerMapping[key] || key.toLowerCase().replace(/\s+/g, '_');
    normalizedRecord[normalizedKey] = record[key];
  });

  // Handle single address field parsing
  if (normalizedRecord.full_address) {
    const addressComponents = parseAddress(normalizedRecord.full_address);
    // Merge parsed address components into the record
    Object.assign(normalizedRecord, addressComponents);
    // Remove the temporary full_address field
    delete normalizedRecord.full_address;
  }

  return normalizedRecord;
};

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// CSV import validation with user-friendly error messages
const validateCsvRow = (row: any, rowIndex: number) => {
  const errors: Array<{ row: number; error: string }> = [];

  // Required field validation
  if (!row.display_name || row.display_name.trim().length === 0) {
    errors.push({ row: rowIndex, error: 'Contact Name is required' });
  }

  if (row.display_name && row.display_name.length > 255) {
    errors.push({ row: rowIndex, error: 'Contact Name must be less than 255 characters' });
  }

  // Email validation
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push({ row: rowIndex, error: 'Invalid Email Address format' });
  }

  // Phone validation - more flexible since we'll format it during processing
  if (row.phone && row.phone.trim().length > 0) {
    // Basic check - should contain mostly digits, spaces, dashes, plus, parentheses
    if (!/^[\d\s\-\+\(\)\.x]+$/i.test(row.phone)) {
      errors.push({ row: rowIndex, error: 'Invalid Phone Number format' });
    }
  }

  return errors;
};

// GET /api/v1/customers/search - Search customers for typeahead
router.get('/search', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { query: searchQuery, limit = 10 } = req.query;

  try {
    // Basic validation
    if (!searchQuery || (searchQuery as string).trim().length < 2) {
      return res.status(400).json({
        code: 'INVALID_QUERY',
        message: 'Query must be at least 2 characters',
        correlationId,
      });
    }

    // Search customers with tenant isolation
    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          { is_active: true },
          {
            OR: [
              { display_name: { contains: searchQuery as string, mode: 'insensitive' } },
              { legal_name: { contains: searchQuery as string, mode: 'insensitive' } },
              { email: { contains: searchQuery as string, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        display_name: true,
        legal_name: true,
        email: true,
        phone: true,
        address_line1: true,
        city: true,
        state: true,
        postal_code: true,
        country: true,
      },
      take: parseInt(limit as string),
      orderBy: { display_name: 'asc' },
    });

    logger.info('Customer search completed', {
      correlationId,
      userId,
      query: searchQuery,
      count: customers.length,
    });

    res.json({
      customers,
      total: customers.length,
      query: searchQuery,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Customer search failed', {
      error: error.message,
      correlationId,
      userId,
      query: searchQuery,
    });

    res.status(500).json({
      code: 'SEARCH_FAILED',
      message: 'Failed to search customers',
      correlationId,
    });
  }
});

// POST /api/v1/customers/import - Import customers from CSV
router.post('/import', upload.single('file'), async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;

  try {
    if (!req.file) {
      return res.status(400).json({
        code: 'NO_FILE',
        message: 'No file uploaded',
        correlationId,
      });
    }

    logger.info('CSV import started', {
      correlationId,
      userId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });

    // Parse CSV
    let records: any[];
    try {
      records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (error: any) {
      logger.error('CSV parsing failed', {
        error: error.message,
        correlationId,
        userId,
      });

      return res.status(400).json({
        code: 'INVALID_CSV',
        message: 'Invalid CSV format',
        correlationId,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        code: 'EMPTY_CSV',
        message: 'CSV file is empty',
        correlationId,
      });
    }

    // Normalize headers and validate all rows
    const allErrors: Array<{ row: number; error: string }> = [];
    const validRecords: any[] = [];

    records.forEach((record, index) => {
      // Normalize headers from user-friendly names to database field names
      const normalizedRecord = normalizeHeaders(record);

      const rowErrors = validateCsvRow(normalizedRecord, index + 2); // +2 for header row and 0-based index
      if (rowErrors.length > 0) {
        allErrors.push(...rowErrors);
      } else {
        validRecords.push(normalizedRecord);
      }
    });

    // Check for existing customers by display_name
    const existingCustomers = await prisma.customer.findMany({
      where: {
        display_name: {
          in: validRecords.map(r => r.display_name),
        },
      },
      select: { display_name: true },
    });

    const existingNames = new Set(existingCustomers.map(c => c.display_name));
    const newCustomers = validRecords.filter(r => !existingNames.has(r.display_name));
    const skippedCount = validRecords.length - newCustomers.length;

    // Prepare data for database insertion
    const customersToCreate = newCustomers.map(record => ({
      id: randomUUID(),
      display_name: record.display_name.trim(),
      legal_name: record.legal_name?.trim() || null,
      email: record.email?.trim() || null,
      phone: formatPhoneNumber(record.phone),
      tax_id: record.tax_id?.trim() || null,
      address_line1: record.address_line1?.trim() || null,
      address_line2: record.address_line2?.trim() || null,
      city: record.city?.trim() || null,
      state: record.state?.trim() || null,
      postal_code: record.postal_code?.trim() || null,
      country: record.country?.trim() || 'US',
      notes: record.notes?.trim() || null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }));

    // Bulk insert new customers
    let importedCount = 0;
    if (customersToCreate.length > 0) {
      const result = await prisma.customer.createMany({
        data: customersToCreate,
        skipDuplicates: true,
      });
      importedCount = result.count;
    }

    logger.info('CSV import completed', {
      correlationId,
      userId,
      totalRows: records.length,
      imported: importedCount,
      skipped: skippedCount,
      failed: allErrors.length,
    });

    res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      failed: allErrors.length,
      errors: allErrors.slice(0, 10), // Limit to first 10 errors for response
      correlationId,
    });

  } catch (error: any) {
    logger.error('CSV import failed', {
      error: error.message,
      correlationId,
      userId,
      stack: error.stack,
    });

    res.status(500).json({
      code: 'IMPORT_FAILED',
      message: 'Failed to import customers',
      correlationId,
    });
  }
});

// GET /api/v1/customers - List all customers with pagination
router.get('/', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { page = 1, limit = 25, search, active = 'true' } = req.query;

  try {
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const isActive = active === 'true';

    // Build where clause (customers are shared across all users)
    const where: any = {
      is_active: isActive,
    };

    if (search) {
      where.OR = [
        { display_name: { contains: search as string, mode: 'insensitive' } },
        { legal_name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Calculate current month start date for monthly invoice filtering
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { display_name: 'asc' },
        select: {
          id: true,
          display_name: true,
          legal_name: true,
          email: true,
          phone: true,
          address_line1: true,
          city: true,
          state: true,
          postal_code: true,
          country: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              invoices: true,
            },
          },
          invoices: {
            select: {
              total: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Transform customers to include aggregated invoice data
    const customersWithInvoiceData = customers.map(customer => {
      const invoice_count = customer._count.invoices;
      const invoice_total = customer.invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);

      // Calculate monthly aggregations
      const monthlyInvoices = customer.invoices.filter(invoice =>
        new Date(invoice.createdAt) >= currentMonthStart
      );
      const monthly_invoice_count = monthlyInvoices.length;
      const monthly_invoice_total = monthlyInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);

      // Remove the temporary fields and add the aggregated ones
      const { _count, invoices, ...customerData } = customer;

      return {
        ...customerData,
        invoice_count,
        invoice_total,
        monthly_invoice_count,
        monthly_invoice_total,
      };
    });

    logger.info('Customers retrieved successfully', {
      correlationId,
      userId,
      count: customersWithInvoiceData.length,
      total,
      page,
      limit,
    });

    res.json({
      customers: customersWithInvoiceData,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to list customers', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'LIST_FAILED',
      message: 'Failed to list customers',
      correlationId,
    });
  }
});

// GET /api/v1/customers/:id - Get specific customer
router.get('/:id', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const customerId = req.params.id;

  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
        correlationId,
      });
    }

    // Customers are shared across all users - no ownership check needed

    logger.info('Customer retrieved successfully', {
      correlationId,
      userId,
      customerId,
    });

    res.json({ customer, correlationId });
  } catch (error: any) {
    logger.error('Failed to retrieve customer', {
      error: error.message,
      correlationId,
      userId,
      customerId,
    });

    res.status(500).json({
      code: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve customer',
      correlationId,
    });
  }
});

// POST /api/v1/customers - Create new customer
router.post('/', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;

  try {
    const customerData = req.body;

    // Validate customer data
    const errors = validateCustomer(customerData);
    if (errors.length > 0) {
      logger.warn('Invalid customer data', {
        correlationId,
        userId,
        errors,
      });

      return res.status(400).json({
        code: 'INVALID_CUSTOMER_DATA',
        message: 'Invalid customer data',
        errors,
        correlationId,
      });
    }

    // Create customer (shared across all users)
    const customer = await prisma.customer.create({
      data: {
        ...customerData,
        updated_at: new Date(),
      },
    });

    logger.info('Customer created successfully', {
      correlationId,
      userId,
      customerId: customer.id,
      displayName: customer.display_name,
    });

    res.status(201).json({
      customer,
      message: 'Customer created successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to create customer', {
      error: error.message,
      correlationId,
      userId,
    });

    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(409).json({
        code: 'CUSTOMER_EXISTS',
        message: 'A customer with this display name already exists',
        correlationId,
      });
    }

    res.status(500).json({
      code: 'CREATE_FAILED',
      message: 'Failed to create customer',
      correlationId,
    });
  }
});

// PUT /api/v1/customers/:id - Update customer
router.put('/:id', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const customerId = req.params.id;

  try {
    const customerData = req.body;

    // Validate customer data
    const errors = validateCustomer(customerData);
    if (errors.length > 0) {
      return res.status(400).json({
        code: 'INVALID_CUSTOMER_DATA',
        message: 'Invalid customer data',
        errors,
        correlationId,
      });
    }

    // Check if customer exists and user has access
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!existingCustomer) {
      return res.status(404).json({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
        correlationId,
      });
    }

    // Customers are shared across all users - no ownership check needed

    // Update customer
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: customerData,
    });

    logger.info('Customer updated successfully', {
      correlationId,
      userId,
      customerId,
    });

    res.json({
      customer,
      message: 'Customer updated successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to update customer', {
      error: error.message,
      correlationId,
      userId,
      customerId,
    });

    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update customer',
      correlationId,
    });
  }
});

// DELETE /api/v1/customers/:id - Delete customer
router.delete('/:id', async (req: CustomerRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const customerId = req.params.id;

  try {
    // Check if customer exists and user has access
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        invoices: { select: { id: true } },
      },
    });

    if (!customer) {
      return res.status(404).json({
        code: 'CUSTOMER_NOT_FOUND',
        message: 'Customer not found',
        correlationId,
      });
    }

    // Customers are shared across all users - no ownership check needed

    // Check if customer has invoices
    if (customer.invoices.length > 0) {
      return res.status(409).json({
        code: 'CUSTOMER_HAS_INVOICES',
        message: 'Cannot delete customer with existing invoices',
        correlationId,
      });
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id: customerId },
    });

    logger.info('Customer deleted successfully', {
      correlationId,
      userId,
      customerId,
    });

    res.json({
      message: 'Customer deleted successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to delete customer', {
      error: error.message,
      correlationId,
      userId,
      customerId,
    });

    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete customer',
      correlationId,
    });
  }
});

export default router;

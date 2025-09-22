import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

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

  // Phone validation (basic)
  if (data.phone && !/^[\d\s\-\+\(\)]+$/.test(data.phone)) {
    errors.push({ field: 'phone', message: 'Valid phone number is required' });
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
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.customer.count({ where }),
    ]);

    logger.info('Customers retrieved successfully', {
      correlationId,
      userId,
      count: customers.length,
      total,
      page,
      limit,
    });

    res.json({
      customers,
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
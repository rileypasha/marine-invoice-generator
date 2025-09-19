const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Simple validation function
const validateCustomer = (data) => {
  const errors = [];

  if (!data.display_name || data.display_name.trim().length === 0) {
    errors.push({ field: 'display_name', message: 'Display name is required' });
  }

  if (data.display_name && data.display_name.length > 255) {
    errors.push({ field: 'display_name', message: 'Display name must be less than 255 characters' });
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }

  return errors;
};

// Typeahead search endpoint
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query: searchQuery, limit = 10 } = req.query;

    // Basic validation
    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Fuzzy search with prefix matching for typeahead
    const customers = await prisma.customer.findMany({
      where: {
        AND: [
          { is_active: true },
          {
            OR: [
              { display_name: { contains: searchQuery, mode: 'insensitive' } },
              { legal_name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        display_name: true,
        legal_name: true,
        email: true,
        phone: true,
        address_line1: true,
        city: true,
        state: true
      },
      take: parseInt(limit),
      orderBy: [
        // Prioritize exact prefix matches
        { display_name: 'asc' }
      ]
    });

    res.json({
      customers,
      total: customers.length,
      query: searchQuery
    });
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// Get all customers with pagination
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      active = true
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {
      is_active: active === 'true' || active === true
    };

    if (search) {
      where.OR = [
        { display_name: { contains: search, mode: 'insensitive' } },
        { legal_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get customers and total count
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: { invoices: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: [
          { display_name: 'asc' }
        ]
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Customers list error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        invoices: {
          select: {
            id: true,
            title: true,
            invoiceNumber: true,
            status: true,
            total: true,
            savedAt: true
          },
          orderBy: { savedAt: 'desc' },
          take: 10 // Latest 10 invoices
        },
        _count: {
          select: { invoices: true }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error('Customer fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Create customer
router.post('/', requireAuth, async (req, res) => {
  try {
    const errors = validateCustomer(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const customerData = { ...req.body };

    // Clean up empty strings
    Object.keys(customerData).forEach(key => {
      if (customerData[key] === '') {
        customerData[key] = null;
      }
    });

    const customer = await prisma.customer.create({
      data: customerData
    });

    console.log(`✅ Customer created: ${customer.display_name} by ${req.user.email}`);
    res.status(201).json(customer);
  } catch (error) {
    console.error('Customer creation error:', error);

    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Customer with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const errors = validateCustomer(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const updateData = { ...req.body };

    // Clean up empty strings
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '') {
        updateData[key] = null;
      }
    });

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: updateData
    });

    console.log(`✅ Customer updated: ${customer.display_name} by ${req.user.email}`);
    res.json(customer);
  } catch (error) {
    console.error('Customer update error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Customer with this name already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Soft delete customer
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Check if customer has active invoices
    const invoiceCount = await prisma.invoice.count({
      where: {
        customerId: req.params.id,
        status: { not: 'archived' }
      }
    });

    if (invoiceCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete customer with active invoices',
        invoice_count: invoiceCount
      });
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { is_active: false }
    });

    console.log(`✅ Customer deactivated: ${customer.display_name} by ${req.user.email}`);
    res.json({ message: 'Customer deactivated successfully' });
  } catch (error) {
    console.error('Customer deletion error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
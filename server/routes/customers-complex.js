const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireMaster } = require('../middleware/auth');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');

const prisma = new PrismaClient();

// Configure multer for CSV uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

    const { query: searchQuery, limit = 10 } = req.query;

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
router.get('/', requireAuth, [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search must be less than 100 characters'),
  query('active')
    .optional()
    .isBoolean()
    .withMessage('Active must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
router.post('/', requireAuth, customerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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
router.patch('/:id', requireAuth, customerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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

// CSV Import validation endpoint
router.post('/import/validate', requireAuth, upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const customers = [];
    const errors = [];
    const duplicates = [];
    let rowNumber = 0;

    // Parse CSV file
    const stream = fs.createReadStream(req.file.path)
      .pipe(csv({
        headers: [
          'display_name', 'legal_name', 'email', 'phone', 'tax_id',
          'address_line1', 'address_line2', 'city', 'state',
          'postal_code', 'country', 'notes', 'is_active'
        ],
        skipEmptyLines: true
      }));

    stream.on('data', async (row) => {
      rowNumber++;

      // Skip header row
      if (rowNumber === 1 && row.display_name === 'display_name') {
        return;
      }

      // Validate required fields
      if (!row.display_name || row.display_name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'display_name',
          message: 'Display name is required'
        });
        return;
      }

      // Clean and prepare data
      const customerData = {
        display_name: row.display_name.trim(),
        legal_name: row.legal_name?.trim() || null,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        tax_id: row.tax_id?.trim() || null,
        address_line1: row.address_line1?.trim() || null,
        address_line2: row.address_line2?.trim() || null,
        city: row.city?.trim() || null,
        state: row.state?.trim() || null,
        postal_code: row.postal_code?.trim() || null,
        country: row.country?.trim() || 'US',
        notes: row.notes?.trim() || null,
        is_active: row.is_active?.toLowerCase() !== 'false'
      };

      // Check for duplicates in file
      const existingInFile = customers.find(c =>
        c.display_name === customerData.display_name
      );

      if (existingInFile) {
        duplicates.push({
          row: rowNumber,
          display_name: customerData.display_name,
          message: 'Duplicate in file'
        });
        return;
      }

      customers.push({ ...customerData, _row: rowNumber });
    });

    stream.on('end', async () => {
      try {
        // Check for existing customers in database
        if (customers.length > 0) {
          const existingCustomers = await prisma.customer.findMany({
            where: {
              display_name: {
                in: customers.map(c => c.display_name)
              }
            },
            select: { display_name: true }
          });

          const existingNames = new Set(existingCustomers.map(c => c.display_name));

          customers.forEach(customer => {
            if (existingNames.has(customer.display_name)) {
              duplicates.push({
                row: customer._row,
                display_name: customer.display_name,
                message: 'Already exists in database'
              });
            }
          });
        }

        // Clean up file
        fs.unlinkSync(req.file.path);

        res.json({
          valid: errors.length === 0 && duplicates.length === 0,
          customers: customers.map(c => {
            const { _row, ...data } = c;
            return data;
          }),
          errors,
          duplicates,
          stats: {
            total_rows: rowNumber,
            valid_customers: customers.length,
            error_count: errors.length,
            duplicate_count: duplicates.length
          }
        });
      } catch (dbError) {
        console.error('Database check error:', dbError);
        res.status(500).json({ error: 'Failed to validate against database' });
      }
    });

    stream.on('error', (error) => {
      console.error('CSV parsing error:', error);
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Invalid CSV format' });
    });

  } catch (error) {
    console.error('CSV validation error:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to validate CSV' });
  }
});

// CSV Import commit endpoint
router.post('/import/commit', requireAuth, [
  body('customers')
    .isArray({ min: 1 })
    .withMessage('Customers array is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customers } = req.body;

    // Use transaction for atomic import
    const result = await prisma.$transaction(async (tx) => {
      const imported = [];
      const failed = [];

      for (let i = 0; i < customers.length; i++) {
        try {
          const customer = await tx.customer.create({
            data: customers[i]
          });
          imported.push(customer);
        } catch (error) {
          failed.push({
            customer: customers[i],
            error: error.message
          });
        }
      }

      return { imported, failed };
    });

    console.log(`✅ CSV Import completed: ${result.imported.length} imported, ${result.failed.length} failed by ${req.user.email}`);

    res.json({
      success: true,
      imported: result.imported.length,
      failed: result.failed.length,
      failures: result.failed
    });
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

// Export CSV template
router.get('/export/template', requireAuth, (req, res) => {
  const csvHeader = 'display_name,legal_name,email,phone,tax_id,address_line1,address_line2,city,state,postal_code,country,notes,is_active\n';
  const sampleRow = 'Sample Company,Sample Company LLC,contact@sample.com,(555) 123-4567,EIN-123456789,123 Main St,Suite 100,Anytown,FL,12345,US,Sample notes,true\n';

  const csvContent = csvHeader + sampleRow;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customer_import_template.csv"');
  res.send(csvContent);
});

module.exports = router;
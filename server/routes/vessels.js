const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAuth } = require('../middleware/auth');

const prisma = new PrismaClient();

// Vessel validation function
const validateVessel = (data) => {
  const errors = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Vessel name is required' });
  }

  if (data.name && data.name.length > 255) {
    errors.push({ field: 'name', message: 'Vessel name must be less than 255 characters' });
  }

  // Optional field validations
  if (data.registration_number && data.registration_number.length > 100) {
    errors.push({ field: 'registration_number', message: 'Registration number must be less than 100 characters' });
  }

  if (data.mmsi && !/^\d{9}$/.test(data.mmsi)) {
    errors.push({ field: 'mmsi', message: 'MMSI must be 9 digits' });
  }

  if (data.imo && !/^\d{7}$/.test(data.imo)) {
    errors.push({ field: 'imo', message: 'IMO must be 7 digits' });
  }

  // Dimension validations
  const dimensions = ['length_ft', 'beam_ft', 'draft_ft', 'weight_tons'];
  dimensions.forEach(dim => {
    if (data[dim] !== undefined && data[dim] !== null && data[dim] !== '') {
      const value = parseFloat(data[dim]);
      if (isNaN(value) || value < 0) {
        errors.push({ field: dim, message: `${dim.replace('_', ' ')} must be a positive number` });
      }
      if (dim === 'length_ft' && value > 2000) {
        errors.push({ field: dim, message: 'Length cannot exceed 2000 feet' });
      }
      if (dim === 'beam_ft' && value > 500) {
        errors.push({ field: dim, message: 'Beam cannot exceed 500 feet' });
      }
      if (dim === 'draft_ft' && value > 200) {
        errors.push({ field: dim, message: 'Draft cannot exceed 200 feet' });
      }
      if (dim === 'weight_tons' && value > 50000) {
        errors.push({ field: dim, message: 'Weight cannot exceed 50,000 tons' });
      }
    }
  });

  // Email validation
  if (data.owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.owner_email)) {
    errors.push({ field: 'owner_email', message: 'Valid email is required' });
  }

  // Phone validation (basic)
  if (data.owner_phone && !/^[\d\s\-\+\(\)]+$/.test(data.owner_phone)) {
    errors.push({ field: 'owner_phone', message: 'Valid phone number is required' });
  }

  return errors;
};

// Typeahead search endpoint for vessel selection in invoices
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query: searchQuery, limit = 10 } = req.query;

    // Basic validation
    if (!searchQuery || searchQuery.trim().length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Fuzzy search with prefix matching for typeahead - tenant isolated
    const vessels = await prisma.vessel.findMany({
      where: {
        AND: [
          { userId: req.user.id }, // Tenant isolation
          { is_active: true },
          {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { registration_number: { contains: searchQuery, mode: 'insensitive' } },
              { home_port: { contains: searchQuery, mode: 'insensitive' } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        registration_number: true,
        length_ft: true,
        beam_ft: true,
        draft_ft: true,
        weight_tons: true,
        home_port: true,
        owner_name: true,
        owner_email: true,
        owner_phone: true
      },
      take: parseInt(limit),
      orderBy: [
        // Prioritize exact prefix matches on name
        { name: 'asc' }
      ]
    });

    res.json({
      vessels,
      total: vessels.length,
      query: searchQuery
    });
  } catch (error) {
    console.error('Vessel search error:', error);
    res.status(500).json({ error: 'Failed to search vessels' });
  }
});

// Get all vessels with pagination and filtering - tenant isolated
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      active = true
    } = req.query;

    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause with tenant isolation
    const where = {
      userId: req.user.id, // Tenant isolation
      is_active: active === 'true' || active === true
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { registration_number: { contains: search, mode: 'insensitive' } },
        { home_port: { contains: search, mode: 'insensitive' } },
        { owner_name: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get vessels and total count
    const [vessels, total] = await Promise.all([
      prisma.vessel.findMany({
        where,
        include: {
          _count: {
            select: { invoices: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: [
          { name: 'asc' }
        ]
      }),
      prisma.vessel.count({ where })
    ]);

    res.json({
      vessels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Vessels list error:', error);
    res.status(500).json({ error: 'Failed to fetch vessels' });
  }
});

// Get single vessel - tenant isolated
router.get('/:id', requireAuth, async (req, res) => {
  try {
    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const vessel = await prisma.vessel.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id // Tenant isolation
      },
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

    if (!vessel) {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    res.json(vessel);
  } catch (error) {
    console.error('Vessel fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch vessel' });
  }
});

// Create vessel - tenant isolated
router.post('/', requireAuth, async (req, res) => {
  try {
    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const errors = validateVessel(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const vesselData = {
      ...req.body,
      userId: req.user.id // Ensure tenant isolation
    };

    // Clean up empty strings and convert dimensions to floats
    Object.keys(vesselData).forEach(key => {
      if (vesselData[key] === '') {
        vesselData[key] = null;
      }

      // Convert numeric fields
      if (['length_ft', 'beam_ft', 'draft_ft', 'weight_tons'].includes(key) &&
          vesselData[key] !== null && vesselData[key] !== undefined) {
        vesselData[key] = parseFloat(vesselData[key]);
      }
    });

    const vessel = await prisma.vessel.create({
      data: vesselData
    });

    console.log(`✅ Vessel created: ${vessel.name} by ${req.user.email}`);
    res.status(201).json(vessel);
  } catch (error) {
    console.error('Vessel creation error:', error);

    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Vessel with this registration number already exists'
      });
    }

    res.status(500).json({ error: 'Failed to create vessel' });
  }
});

// Update vessel - tenant isolated
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const errors = validateVessel(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const updateData = { ...req.body };

    // Clean up empty strings and convert dimensions to floats
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === '') {
        updateData[key] = null;
      }

      // Convert numeric fields
      if (['length_ft', 'beam_ft', 'draft_ft', 'weight_tons'].includes(key) &&
          updateData[key] !== null && updateData[key] !== undefined) {
        updateData[key] = parseFloat(updateData[key]);
      }
    });

    // Remove userId from update data to prevent manipulation
    delete updateData.userId;

    const vessel = await prisma.vessel.update({
      where: {
        id: req.params.id,
        userId: req.user.id // Tenant isolation in where clause
      },
      data: updateData
    });

    console.log(`✅ Vessel updated: ${vessel.name} by ${req.user.email}`);
    res.json(vessel);
  } catch (error) {
    console.error('Vessel update error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Vessel with this registration number already exists'
      });
    }

    res.status(500).json({ error: 'Failed to update vessel' });
  }
});

// Soft delete vessel - tenant isolated
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Check if vessel has active invoices
    const invoiceCount = await prisma.invoice.count({
      where: {
        vesselId: req.params.id,
        userId: req.user.id, // Tenant isolation
        status: { not: 'archived' }
      }
    });

    if (invoiceCount > 0) {
      return res.status(409).json({
        error: 'Cannot delete vessel with active invoices',
        invoice_count: invoiceCount
      });
    }

    const vessel = await prisma.vessel.update({
      where: {
        id: req.params.id,
        userId: req.user.id // Tenant isolation
      },
      data: { is_active: false }
    });

    console.log(`✅ Vessel deactivated: ${vessel.name} by ${req.user.email}`);
    res.json({ message: 'Vessel deactivated successfully' });
  } catch (error) {
    console.error('Vessel deletion error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    res.status(500).json({ error: 'Failed to delete vessel' });
  }
});

// Activate vessel - tenant isolated (for reactivating soft-deleted vessels)
router.patch('/:id/activate', requireAuth, async (req, res) => {
  try {
    // Ensure user context for tenant isolation
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const vessel = await prisma.vessel.update({
      where: {
        id: req.params.id,
        userId: req.user.id // Tenant isolation
      },
      data: { is_active: true }
    });

    console.log(`✅ Vessel reactivated: ${vessel.name} by ${req.user.email}`);
    res.json({ message: 'Vessel reactivated successfully', vessel });
  } catch (error) {
    console.error('Vessel activation error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Vessel not found' });
    }

    res.status(500).json({ error: 'Failed to activate vessel' });
  }
});

module.exports = router;
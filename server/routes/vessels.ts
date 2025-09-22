import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

const router = Router();

interface VesselRequest extends Request {
  userId?: string;
  correlationId?: string;
}

// Vessel validation function
const validateVessel = (data: any) => {
  const errors: Array<{ field: string; message: string }> = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Vessel name is required' });
  }

  if (data.name && data.name.length > 255) {
    errors.push({ field: 'name', message: 'Vessel name must be less than 255 characters' });
  }

  // Optional field validations
  if (data.registrationNumber && data.registrationNumber.length > 100) {
    errors.push({ field: 'registrationNumber', message: 'Registration number must be less than 100 characters' });
  }

  if (data.mmsi && !/^\d{9}$/.test(data.mmsi)) {
    errors.push({ field: 'mmsi', message: 'MMSI must be 9 digits' });
  }

  if (data.imo && !/^\d{7}$/.test(data.imo)) {
    errors.push({ field: 'imo', message: 'IMO must be 7 digits' });
  }

  // Dimension validations
  const dimensions = ['lengthFt', 'beamFt', 'draftFt', 'weightTons'];
  dimensions.forEach(dim => {
    if (data[dim] !== undefined && data[dim] !== null && data[dim] !== '') {
      const value = parseFloat(data[dim]);
      if (isNaN(value) || value < 0) {
        errors.push({ field: dim, message: `${dim.replace(/([A-Z])/g, ' $1').toLowerCase()} must be a positive number` });
      }
      if (dim === 'lengthFt' && value > 2000) {
        errors.push({ field: dim, message: 'Length cannot exceed 2000 feet' });
      }
      if (dim === 'beamFt' && value > 500) {
        errors.push({ field: dim, message: 'Beam cannot exceed 500 feet' });
      }
      if (dim === 'draftFt' && value > 200) {
        errors.push({ field: dim, message: 'Draft cannot exceed 200 feet' });
      }
      if (dim === 'weightTons' && value > 50000) {
        errors.push({ field: dim, message: 'Weight cannot exceed 50,000 tons' });
      }
    }
  });

  // Email validation
  if (data.ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.ownerEmail)) {
    errors.push({ field: 'ownerEmail', message: 'Valid email is required' });
  }

  if (data.operatorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.operatorEmail)) {
    errors.push({ field: 'operatorEmail', message: 'Valid email is required' });
  }

  // Phone validation (basic)
  if (data.ownerPhone && !/^[\d\s\-\+\(\)]+$/.test(data.ownerPhone)) {
    errors.push({ field: 'ownerPhone', message: 'Valid phone number is required' });
  }

  if (data.operatorPhone && !/^[\d\s\-\+\(\)]+$/.test(data.operatorPhone)) {
    errors.push({ field: 'operatorPhone', message: 'Valid phone number is required' });
  }

  return errors;
};

// GET /api/v1/vessels/search - Search vessels for typeahead
router.get('/search', async (req: VesselRequest, res: Response) => {
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

    // Search vessels (shared across all users)
    const vessels = await prisma.vessel.findMany({
      where: {
        AND: [
          { is_active: true },
          {
            OR: [
              { name: { contains: searchQuery as string, mode: 'insensitive' } },
              { registration_number: { contains: searchQuery as string, mode: 'insensitive' } },
              { home_port: { contains: searchQuery as string, mode: 'insensitive' } },
              { owner_name: { contains: searchQuery as string, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        registration_number: true,
        length_ft: true,
        beam_ft: true,
        home_port: true,
        owner_name: true,
      },
      take: parseInt(limit as string),
      orderBy: { name: 'asc' },
    });

    logger.info('Vessel search completed', {
      correlationId,
      userId,
      query: searchQuery,
      count: vessels.length,
    });

    res.json({
      vessels,
      total: vessels.length,
      query: searchQuery,
      correlationId,
    });
  } catch (error: any) {
    logger.error('Vessel search failed', {
      error: error.message,
      correlationId,
      userId,
      query: searchQuery,
    });

    res.status(500).json({
      code: 'SEARCH_FAILED',
      message: 'Failed to search vessels',
      correlationId,
    });
  }
});

// GET /api/v1/vessels - List all vessels with pagination
router.get('/', async (req: VesselRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { page = 1, limit = 25, search, active = 'true' } = req.query;

  try {
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const isActive = active === 'true';

    // Build where clause (vessels are shared across all users)
    const where: any = {
      is_active: isActive,
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { registration_number: { contains: search as string, mode: 'insensitive' } },
        { home_port: { contains: search as string, mode: 'insensitive' } },
        { owner_name: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [vessels, total] = await Promise.all([
      prisma.vessel.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          registration_number: true,
            length_ft: true,
          beam_ft: true,
          weight_tons: true,
          home_port: true,
          owner_name: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.vessel.count({ where }),
    ]);

    logger.info('Vessels retrieved successfully', {
      correlationId,
      userId,
      count: vessels.length,
      total,
      page,
      limit,
    });

    res.json({
      vessels,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to list vessels', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'LIST_FAILED',
      message: 'Failed to list vessels',
      correlationId,
    });
  }
});

// GET /api/v1/vessels/:id - Get specific vessel
router.get('/:id', async (req: VesselRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const vesselId = req.params.id;

  try {
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
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

    if (!vessel) {
      return res.status(404).json({
        code: 'VESSEL_NOT_FOUND',
        message: 'Vessel not found',
        correlationId,
      });
    }

    // Vessels are shared across all users - no ownership check needed

    logger.info('Vessel retrieved successfully', {
      correlationId,
      userId,
      vesselId,
    });

    res.json({ vessel, correlationId });
  } catch (error: any) {
    logger.error('Failed to retrieve vessel', {
      error: error.message,
      correlationId,
      userId,
      vesselId,
    });

    res.status(500).json({
      code: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve vessel',
      correlationId,
    });
  }
});

// POST /api/v1/vessels - Create new vessel
router.post('/', async (req: VesselRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;

  try {
    const vesselData = req.body;

    // Validate vessel data
    const errors = validateVessel(vesselData);
    if (errors.length > 0) {
      logger.warn('Invalid vessel data', {
        correlationId,
        userId,
        errors,
      });

      return res.status(400).json({
        code: 'INVALID_VESSEL_DATA',
        message: 'Invalid vessel data',
        errors,
        correlationId,
      });
    }

    // Create vessel (shared across all users)
    const vessel = await prisma.vessel.create({
      data: {
        ...vesselData,
      },
    });

    logger.info('Vessel created successfully', {
      correlationId,
      userId,
      vesselId: vessel.id,
      name: vessel.name,
    });

    res.status(201).json({
      vessel,
      message: 'Vessel created successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to create vessel', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'CREATE_FAILED',
      message: 'Failed to create vessel',
      correlationId,
    });
  }
});

// PUT /api/v1/vessels/:id - Update vessel
router.put('/:id', async (req: VesselRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const vesselId = req.params.id;

  try {
    const vesselData = req.body;

    // Validate vessel data
    const errors = validateVessel(vesselData);
    if (errors.length > 0) {
      return res.status(400).json({
        code: 'INVALID_VESSEL_DATA',
        message: 'Invalid vessel data',
        errors,
        correlationId,
      });
    }

    // Check if vessel exists
    const existingVessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
    });

    if (!existingVessel) {
      return res.status(404).json({
        code: 'VESSEL_NOT_FOUND',
        message: 'Vessel not found',
        correlationId,
      });
    }

    // Vessels are shared across all users - no ownership check needed

    // Update vessel
    const vessel = await prisma.vessel.update({
      where: { id: vesselId },
      data: vesselData,
    });

    logger.info('Vessel updated successfully', {
      correlationId,
      userId,
      vesselId,
    });

    res.json({
      vessel,
      message: 'Vessel updated successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to update vessel', {
      error: error.message,
      correlationId,
      userId,
      vesselId,
    });

    res.status(500).json({
      code: 'UPDATE_FAILED',
      message: 'Failed to update vessel',
      correlationId,
    });
  }
});

// DELETE /api/v1/vessels/:id - Delete vessel
router.delete('/:id', async (req: VesselRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const vesselId = req.params.id;

  try {
    // Check if vessel exists
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      include: {
        invoices: { select: { id: true } },
      },
    });

    if (!vessel) {
      return res.status(404).json({
        code: 'VESSEL_NOT_FOUND',
        message: 'Vessel not found',
        correlationId,
      });
    }

    // Vessels are shared across all users - no ownership check needed

    // Check if vessel has invoices
    if (vessel.invoices.length > 0) {
      return res.status(409).json({
        code: 'VESSEL_HAS_INVOICES',
        message: 'Cannot delete vessel with existing invoices',
        correlationId,
      });
    }

    // Delete vessel
    await prisma.vessel.delete({
      where: { id: vesselId },
    });

    logger.info('Vessel deleted successfully', {
      correlationId,
      userId,
      vesselId,
    });

    res.json({
      message: 'Vessel deleted successfully',
      correlationId,
    });
  } catch (error: any) {
    logger.error('Failed to delete vessel', {
      error: error.message,
      correlationId,
      userId,
      vesselId,
    });

    res.status(500).json({
      code: 'DELETE_FAILED',
      message: 'Failed to delete vessel',
      correlationId,
    });
  }
});

export default router;
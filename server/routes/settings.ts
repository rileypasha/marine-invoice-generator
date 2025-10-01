import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import '../types/session';

const router = Router();

interface SettingsRequest extends Request {
  userId?: string;
  correlationId?: string;
}

// GET /api/v1/settings/notifications - Get user notification preferences
router.get('/notifications', async (req: SettingsRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;

  try {
    const result = await query(
      'SELECT "notifyOnNewInvoice", "notifyOnChangeRequest", "notifyOnApproval" FROM "User" WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        correlationId,
      });
    }

    const settings = result.rows[0];

    logger.info('Notification settings retrieved', {
      correlationId,
      userId,
    });

    res.json({
      notifyOnNewInvoice: settings.notifyOnNewInvoice || false,
      notifyOnChangeRequest: settings.notifyOnChangeRequest || false,
      notifyOnApproval: settings.notifyOnApproval || false,
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to retrieve notification settings', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'SETTINGS_RETRIEVAL_FAILED',
      message: 'Failed to retrieve notification settings',
      correlationId,
    });
  }
});

// PUT /api/v1/settings/notifications - Update user notification preferences
router.put('/notifications', async (req: SettingsRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { notifyOnNewInvoice, notifyOnChangeRequest, notifyOnApproval } = req.body;

  try {
    // Validate input
    if (
      typeof notifyOnNewInvoice !== 'boolean' ||
      typeof notifyOnChangeRequest !== 'boolean' ||
      typeof notifyOnApproval !== 'boolean'
    ) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'All notification preferences must be boolean values',
        correlationId,
      });
    }

    const result = await query(
      `UPDATE "User"
       SET "notifyOnNewInvoice" = $1,
           "notifyOnChangeRequest" = $2,
           "notifyOnApproval" = $3,
           "updatedAt" = NOW()
       WHERE id = $4
       RETURNING "notifyOnNewInvoice", "notifyOnChangeRequest", "notifyOnApproval"`,
      [notifyOnNewInvoice, notifyOnChangeRequest, notifyOnApproval, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        correlationId,
      });
    }

    const settings = result.rows[0];

    logger.info('Notification settings updated', {
      correlationId,
      userId,
      notifyOnNewInvoice,
      notifyOnChangeRequest,
      notifyOnApproval,
    });

    res.json({
      notifyOnNewInvoice: settings.notifyOnNewInvoice,
      notifyOnChangeRequest: settings.notifyOnChangeRequest,
      notifyOnApproval: settings.notifyOnApproval,
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to update notification settings', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'SETTINGS_UPDATE_FAILED',
      message: 'Failed to update notification settings',
      correlationId,
    });
  }
});

export default router;

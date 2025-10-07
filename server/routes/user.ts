import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import '../types/session';

const router = Router();

type AvatarRequest = Request<{ userId: string }> & { correlationId?: string };

router.get('/:userId/avatar', async (req: AvatarRequest, res: Response) => {
  const { userId } = req.params;
  const correlationId = req.correlationId || 'user-avatar';

  try {
    const result = await query(
      'SELECT "avatarData", "avatarMimeType" FROM "User" WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        correlationId,
      });
    }

    const { avatarData, avatarMimeType } = result.rows[0];

    if (!avatarData) {
      return res.status(404).json({
        code: 'AVATAR_NOT_FOUND',
        message: 'User avatar not found',
        correlationId,
      });
    }

    res.setHeader('Content-Type', avatarMimeType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(avatarData);
  } catch (error: any) {
    logger.error('Failed to retrieve avatar', {
      error: error.message,
      userId,
      correlationId,
    });

    res.status(500).json({
      code: 'AVATAR_FETCH_FAILED',
      message: 'Failed to fetch avatar',
      correlationId,
    });
  }
});

export default router;

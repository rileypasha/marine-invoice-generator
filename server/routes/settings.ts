import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import '../types/session';

const router = Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId;
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
});

interface SettingsRequest extends Request {
  userId?: string;
  correlationId?: string;
}

type NotificationScope = 'none' | 'own' | 'all';

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
      notifyOnNewInvoice: settings.notifyOnNewInvoice || 'none',
      notifyOnChangeRequest: settings.notifyOnChangeRequest || 'none',
      notifyOnApproval: settings.notifyOnApproval || 'none',
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

  logger.info('Received notification preference update request', {
    correlationId,
    userId,
    body: req.body,
    notifyOnNewInvoice,
    notifyOnChangeRequest,
    notifyOnApproval
  });

  try {
    // Validate input
    const validScopes: NotificationScope[] = ['none', 'own', 'all'];
    if (
      !validScopes.includes(notifyOnNewInvoice) ||
      !validScopes.includes(notifyOnChangeRequest) ||
      !validScopes.includes(notifyOnApproval)
    ) {
      logger.error('Invalid notification preference values', {
        correlationId,
        notifyOnNewInvoice,
        notifyOnChangeRequest,
        notifyOnApproval,
        validScopes
      });
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'All notification preferences must be one of: none, own, all',
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

// PUT /api/v1/settings/profile - Update user profile information
router.put('/profile', upload.single('avatar'), async (req: SettingsRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { name, email } = req.body;
  const avatarFile = req.file;

  logger.info('Received profile update request', {
    correlationId,
    userId,
    name,
    email,
    avatar: avatarFile ? 'uploaded' : 'not provided'
  });

  try {
    // Validate input
    if (!name || !email) {
      // Clean up uploaded file if validation fails
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Name and email are required',
        correlationId,
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      // Clean up uploaded file if validation fails
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Invalid email format',
        correlationId,
      });
    }

    // Check if email is already taken by another user
    const emailCheck = await query(
      'SELECT id FROM "User" WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (emailCheck.rows.length > 0) {
      // Clean up uploaded file if validation fails
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(400).json({
        code: 'EMAIL_TAKEN',
        message: 'Email address is already in use',
        correlationId,
      });
    }

    // Build avatar URL if file was uploaded
    let avatarUrl = null;
    if (avatarFile) {
      avatarUrl = `/uploads/avatars/${avatarFile.filename}`;

      // Delete old avatar if exists
      const oldUser = await query('SELECT "avatarUrl" FROM "User" WHERE id = $1', [userId]);
      if (oldUser.rows.length > 0 && oldUser.rows[0].avatarUrl) {
        const oldPath = path.join(__dirname, '../../', oldUser.rows[0].avatarUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    // Update user profile
    const result = await query(
      `UPDATE "User"
       SET name = $1,
           email = $2,
           ${avatarUrl ? '"avatarUrl" = $4,' : ''}
           "updatedAt" = NOW()
       WHERE id = $3
       RETURNING id, name, email, role, "avatarUrl"`,
      avatarUrl ? [name, email, userId, avatarUrl] : [name, email, userId]
    );

    if (result.rows.length === 0) {
      // Clean up uploaded file if user not found
      if (avatarFile) {
        fs.unlinkSync(avatarFile.path);
      }
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        correlationId,
      });
    }

    const user = result.rows[0];

    logger.info('Profile updated successfully', {
      correlationId,
      userId,
      name,
      email,
      avatarUpdated: !!avatarFile
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      correlationId,
    });

  } catch (error: any) {
    // Clean up uploaded file on error
    if (avatarFile) {
      try {
        fs.unlinkSync(avatarFile.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up uploaded file', {
          error: (unlinkError as Error).message,
          filePath: avatarFile.path
        });
      }
    }

    logger.error('Failed to update profile', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'PROFILE_UPDATE_FAILED',
      message: 'Failed to update profile',
      correlationId,
    });
  }
});

// PUT /api/v1/settings/password - Update user password
router.put('/password', async (req: SettingsRequest, res: Response) => {
  const correlationId = req.correlationId!;
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body;

  logger.info('Received password update request', {
    correlationId,
    userId
  });

  try {
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        code: 'INVALID_INPUT',
        message: 'Current password and new password are required',
        correlationId,
      });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        code: 'INVALID_PASSWORD',
        message: 'New password must be at least 8 characters long',
        correlationId,
      });
    }

    // Get current user password
    const userResult = await query(
      'SELECT password FROM "User" WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        correlationId,
      });
    }

    const user = userResult.rows[0];

    // DEBUG: Log password comparison details
    logger.info('Password comparison debug', {
      correlationId,
      userId,
      receivedPasswordLength: currentPassword.length,
      receivedPasswordFirstChar: currentPassword.charAt(0),
      receivedPasswordLastChar: currentPassword.charAt(currentPassword.length - 1),
      storedPasswordPrefix: user.password?.substring(0, 7) || 'NULL',
      storedPasswordLength: user.password?.length || 0,
      hasStoredPassword: !!user.password
    });

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    logger.info('Password comparison result', {
      correlationId,
      userId,
      isPasswordValid
    });

    if (!isPasswordValid) {
      return res.status(401).json({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
        correlationId,
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      `UPDATE "User"
       SET password = $1,
           "updatedAt" = NOW()
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    logger.info('Password updated successfully', {
      correlationId,
      userId
    });

    res.json({
      message: 'Password updated successfully',
      correlationId,
    });

  } catch (error: any) {
    logger.error('Failed to update password', {
      error: error.message,
      correlationId,
      userId,
    });

    res.status(500).json({
      code: 'PASSWORD_UPDATE_FAILED',
      message: 'Failed to update password',
      correlationId,
    });
  }
});

export default router;

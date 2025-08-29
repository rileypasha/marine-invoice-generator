const pino = require('pino');
const { Prisma } = require('@prisma/client');
const { ZodError } = require('zod');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

class AppError extends Error {
  constructor(code, message, statusCode, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function errorHandler(err, req, res, next) {
  // Add request ID if available
  const requestId = req.headers['x-request-id'] || 
                   res.locals.requestId || 
                   `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // App errors (expected)
  if (err instanceof AppError) {
    logger.warn({
      event: 'APP_ERROR',
      requestId,
      code: err.code,
      message: err.message,
      details: err.details,
      path: req.path,
      method: req.method
    });
    
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
      requestId
    });
  }
  
  // Zod validation errors
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    const firstField = Object.keys(fieldErrors)[0];
    const firstError = firstField ? fieldErrors[firstField][0] : 'Validation failed';
    
    logger.warn({
      event: 'VALIDATION_ERROR',
      requestId,
      errors: fieldErrors,
      path: req.path,
      method: req.method
    });
    
    return res.status(400).json({
      error: `Validation failed: ${firstError}`,
      code: ErrorCode.VALIDATION_FAILED,
      details: {
        fields: fieldErrors,
        requestId
      }
    });
  }
  
  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      logger.warn({
        event: 'PRISMA_DUPLICATE',
        requestId,
        code: err.code,
        meta: err.meta,
        path: req.path
      });
      
      return res.status(409).json({
        error: 'Duplicate resource',
        code: ErrorCode.DUPLICATE_RESOURCE,
        details: { 
          field: err.meta?.target,
          requestId
        }
      });
    }
    
    // Record not found
    if (err.code === 'P2025') {
      logger.warn({
        event: 'PRISMA_NOT_FOUND',
        requestId,
        code: err.code,
        meta: err.meta,
        path: req.path
      });
      
      return res.status(404).json({
        error: 'Resource not found',
        code: ErrorCode.RESOURCE_NOT_FOUND,
        requestId
      });
    }
    
    // Invalid relation
    if (err.code === 'P2003') {
      logger.error({
        event: 'PRISMA_INVALID_RELATION',
        requestId,
        code: err.code,
        meta: err.meta,
        message: err.message,
        path: req.path
      });
      
      return res.status(400).json({
        error: 'Invalid relation reference',
        code: ErrorCode.VALIDATION_FAILED,
        details: {
          field: err.meta?.field_name,
          requestId
        }
      });
    }
  }
  
  // Prisma validation errors (including "Unknown argument")
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error({
      event: 'PRISMA_VALIDATION_ERROR',
      requestId,
      message: err.message,
      path: req.path,
      method: req.method
    });
    
    // Extract the specific error message
    let errorMessage = 'Database validation failed';
    let details = {};
    
    if (err.message.includes('Unknown argument')) {
      // Extract field name from error message
      const match = err.message.match(/Unknown argument `(\w+)`/);
      if (match) {
        errorMessage = `Invalid field: ${match[1]}`;
        details.invalidField = match[1];
      }
    }
    
    return res.status(400).json({
      error: errorMessage,
      code: ErrorCode.VALIDATION_FAILED,
      details: {
        ...details,
        requestId
      }
    });
  }
  
  // Log unexpected errors
  logger.error({
    event: 'UNEXPECTED_ERROR',
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });
  
  // Generic error response (no stack trace)
  res.status(500).json({
    error: 'An unexpected error occurred',
    code: ErrorCode.INTERNAL_ERROR,
    requestId
  });
}

module.exports = {
  errorHandler,
  AppError,
  ErrorCode
};
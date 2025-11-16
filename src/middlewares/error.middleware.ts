import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public issues?: any[]
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  // Handle AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        issues: err.issues
      }
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError' && err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e: any) => ({
      path: e.path,
      message: e.message
    }));
    
    return res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        issues: errors
      }
    });
  }

  // Handle duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    return res.status(400).json({
      ok: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: `${field} already exists`
      }
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired'
      }
    });
  }

  // Default error
  return res.status(500).json({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An error occurred' 
        : err.message
    }
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    }
  });
};

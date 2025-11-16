import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = (schema: z.ZodType<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            issues: error.issues.map((err: any) => ({
              path: err.path.join('.'),
              message: err.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

export const validateBody = (schema: z.ZodType<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            issues: error.issues.map((err: any) => ({
              path: err.path.join('.'),
              message: err.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

export const validateFormData = (schema: z.ZodType<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      // Convert form data strings to appropriate types
      const body = { ...req.body };
      
      // Convert numeric fields
      if (body.price) body.price = parseFloat(body.price);
      if (body.offerPrice) body.offerPrice = parseFloat(body.offerPrice);
      
      // Convert boolean fields
      if (body.isOwn !== undefined) body.isOwn = body.isOwn === 'true';
      if (body.isActive !== undefined) body.isActive = body.isActive === 'true';
      
      // Parse JSON fields if they exist
      if (body.colors && typeof body.colors === 'string') {
        try {
          body.colors = JSON.parse(body.colors);
        } catch {
          // If parsing fails, leave as string and let validation handle it
        }
      }
      
      req.body = await schema.parseAsync(body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            issues: error.issues.map((err: any) => ({
              path: err.path.join('.'),
              message: err.message
            }))
          }
        });
      }
      next(error);
    }
  };
};

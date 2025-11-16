import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const requireAuth = (req: Request, res: Response, next: NextFunction): any => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      branchId: decoded.branchId
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');
export const requireBranch = requireRole('branch');
export const requireAdminOrBranch = requireRole(['admin', 'branch']);
export const requireCustomer = requireRole('customer');

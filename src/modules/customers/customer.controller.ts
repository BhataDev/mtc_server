import { Request, Response, NextFunction } from 'express';
import { Customer } from './customer.model';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';

// Get all customers with filtering and pagination
export const getAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Get total count
    const total = await Customer.countDocuments(query);

    // Get customers with pagination
    const customers = await Customer.find(query)
      .select('-passwordHash')
      .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      ok: true,
      data: {
        customers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single customer by ID
export const getCustomer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).select('-passwordHash');
    
    if (!customer) {
      return res.status(404).json({
        ok: false,
        message: 'Customer not found'
      });
    }

    res.json({
      ok: true,
      data: customer
    });
  } catch (error) {
    next(error);
  }
};

// Update customer status
export const updateCustomerStatus = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const customer = await Customer.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, select: '-passwordHash' }
    );

    if (!customer) {
      return res.status(404).json({
        ok: false,
        message: 'Customer not found'
      });
    }

    // Create audit log
    await AuditService.create({
      actorUser: (req as any).user?.id,
      actorRole: (req as any).user?.role,
      entity: 'Customer' as any,
      entityId: customer._id as string,
      action: 'update',
      diff: { isActive },
      req
    });

    // Emit socket event
    SocketService.broadcastToAdmins('customer:updated', {
      customerId: customer._id,
      isActive
    });

    res.json({
      ok: true,
      data: customer,
      message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

// Delete customer
export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    
    if (!customer) {
      return res.status(404).json({
        ok: false,
        message: 'Customer not found'
      });
    }

    await customer.deleteOne();

    // Create audit log
    await AuditService.create({
      actorUser: (req as any).user?.id,
      actorRole: (req as any).user?.role,
      entity: 'Customer' as any,
      entityId: id,
      action: 'delete',
      diff: { deleted: true },
      req
    });

    // Emit socket event
    SocketService.broadcastToAdmins('customer:deleted', {
      customerId: id
    });

    res.json({
      ok: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get customer statistics
export const getCustomerStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCustomers = await Customer.countDocuments({ isActive: true });
    const inactiveCustomers = await Customer.countDocuments({ isActive: false });
    
    // Get customers registered in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newCustomers = await Customer.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get customers with Google login
    const googleCustomers = await Customer.countDocuments({
      googleId: { $ne: null }
    });

    res.json({
      ok: true,
      data: {
        total: totalCustomers,
        active: activeCustomers,
        inactive: inactiveCustomers,
        new: newCustomers,
        googleAuth: googleCustomers,
        emailAuth: totalCustomers - googleCustomers
      }
    });
  } catch (error) {
    next(error);
  }
};

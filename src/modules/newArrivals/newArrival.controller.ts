import { Request, Response, NextFunction } from 'express';
import { NewArrival } from './newArrival.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';

export class NewArrivalController {
  static async getAllNewArrivals(req: Request, res: Response, next: NextFunction) {
    try {
      const { scope, isActive } = req.query;
      const query: any = {};

      // Filter by scope based on user role
      if (req.user!.role === 'admin') {
        // Admin sees all new arrivals
        if (scope === 'global') {
          query.branch = null;
        } else if (scope === 'branch') {
          query.branch = { $ne: null };
        }
        // Otherwise, show all
      } else if (req.user!.role === 'branch') {
        // Branch sees global new arrivals and their own
        query.$or = [
          { branch: null },
          { branch: req.user!.branchId }
        ];
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const newArrivals = await NewArrival.find(query)
        .populate('branch', 'name')
        .populate('createdBy', 'username role')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        ok: true,
        data: newArrivals
      });
    } catch (error) {
      next(error);
    }
  }

  static async getNewArrival(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const newArrival = await NewArrival.findById(id)
        .populate('branch', 'name')
        .populate('createdBy', 'username role')
        .lean();

      if (!newArrival) {
        throw new AppError('New arrival not found', 404, 'NOT_FOUND');
      }

      // Check access permissions
      if (req.user!.role === 'branch' && newArrival.branch && 
          !newArrival.branch._id.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      res.json({
        ok: true,
        data: newArrival
      });
    } catch (error) {
      next(error);
    }
  }

  static async createNewArrival(req: Request, res: Response, next: NextFunction) {
    try {
      const { product, title, description } = req.body;
      let imageUrl = '/placeholder-new-arrival.jpg';

      // Validate product field
      if (!product) {
        throw new AppError('Product ID is required', 400, 'VALIDATION_ERROR');
      }

      // Handle Cloudinary image upload result (from middleware)
      if ((req as any).cloudinaryResult) {
        imageUrl =
          (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      }

      const newArrival = new NewArrival({
        product,
        title,
        description,
        imageUrl,
        createdBy: req.user!.id,
        createdRole: req.user!.role,
        branch: req.user!.role === 'branch' ? req.user!.branchId : null,
        isActive: true
      });

      await newArrival.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'NewArrival',
        entityId: (newArrival as any)._id.toString(),
        action: 'create',
        metadata: { 
          title: newArrival.title,
          scope: newArrival.branch ? 'branch' : 'global'
        },
        req
      });

      // Get populated new arrival
      const populatedNewArrival = await NewArrival.findById(newArrival._id)
        .populate('branch', 'name')
        .populate('createdBy', 'username role');

      // Broadcast based on scope
      if (newArrival.branch) {
        SocketService.broadcastToBranch(newArrival.branch.toString(), 'newArrival.created', populatedNewArrival);
      } else {
        SocketService.broadcastToAll('newArrival.created', populatedNewArrival);
      }

      res.status(201).json({
        ok: true,
        data: populatedNewArrival
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateNewArrival(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { product, title, description, isActive } = req.body;

      const newArrival = await NewArrival.findById(id);

      if (!newArrival) {
        throw new AppError('New arrival not found', 404, 'NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && newArrival.branch && 
          !newArrival.branch.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const oldNewArrival = newArrival.toObject();

      // Handle Cloudinary image upload result (from middleware)
      if ((req as any).cloudinaryResult) {
        // Delete old image if it's not a placeholder
        if (
          newArrival.imageUrl &&
          !newArrival.imageUrl.includes('placeholder')
        ) {
          const storage = StorageFactory.getStorage();
          await storage.delete(newArrival.imageUrl);
        }

        newArrival.imageUrl =
          (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      }

      // Update fields
      if (product !== undefined) newArrival.product = product;
      if (title !== undefined) newArrival.title = title;
      if (description !== undefined) newArrival.description = description;
      if (isActive !== undefined) newArrival.isActive = isActive;

      newArrival.updatedBy = req.user!.id as any;
      await newArrival.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldNewArrival, newArrival);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'NewArrival',
        entityId: (newArrival as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Get populated new arrival
      const populatedNewArrival = await NewArrival.findById(newArrival._id)
        .populate('branch', 'name')
        .populate('createdBy', 'username role');

      // Broadcast based on scope
      if (newArrival.branch) {
        SocketService.broadcastToBranch(newArrival.branch.toString(), 'newArrival.updated', populatedNewArrival);
      } else {
        SocketService.broadcastToAll('newArrival.updated', populatedNewArrival);
      }

      res.json({
        ok: true,
        data: populatedNewArrival
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteNewArrival(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const newArrival = await NewArrival.findById(id);

      if (!newArrival) {
        throw new AppError('New arrival not found', 404, 'NOT_FOUND');
      }

      // Check permissions - only the creator or admin can delete
      if (req.user!.role === 'branch' && 
          (!newArrival.createdBy.equals(req.user!.id) || (newArrival.branch && !newArrival.branch.equals(req.user!.branchId)))) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      // Delete image if it's not a placeholder
      if (newArrival.imageUrl && !newArrival.imageUrl.includes('placeholder')) {
        const storage = StorageFactory.getStorage();
        await storage.delete(newArrival.imageUrl);
      }

      await newArrival.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'NewArrival',
        entityId: (newArrival as any)._id.toString(),
        action: 'delete',
        metadata: { title: newArrival.title },
        req
      });

      // Broadcast deletion based on scope
      const deleteEvent = { id: newArrival._id };
      if (newArrival.branch) {
        SocketService.broadcastToBranch(newArrival.branch.toString(), 'newArrival.deleted', deleteEvent);
      } else {
        SocketService.broadcastToAll('newArrival.deleted', deleteEvent);
      }

      res.json({
        ok: true,
        data: {
          message: 'New arrival deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

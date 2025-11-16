import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Subcategory } from './subcategory.model';
import { Category } from '../categories/category.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';
import { CreateSubcategoryDto, UpdateSubcategoryDto } from './subcategory.validation';

export class SubcategoryController {
  static async getAllSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, isActive } = req.query;
      const query: any = {};

      if (category) query.category = category;
      if (isActive !== undefined) query.isActive = isActive === 'true';

      const subcategories = await Subcategory.find(query)
        .populate('category', 'name')
        .sort({ name: 1 })
        .lean();

      res.json({
        ok: true,
        data: subcategories
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const subcategory = await Subcategory.findById(id)
        .populate('category', 'name')
        .lean();

      if (!subcategory) {
        throw new AppError('Subcategory not found', 404, 'NOT_FOUND');
      }

      res.json({
        ok: true,
        data: subcategory
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateSubcategoryDto = req.body;
      
      // Verify category exists
      const category = await Category.findById(data.category);
      if (!category) {
        throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
      }

      let imageUrl = data.imageUrl;

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      }

      const subcategory = new Subcategory({
        category: data.category,
        name: data.name,
        imageUrl,
        createdBy: req.user!.id,
        isActive: true
      });

      await subcategory.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Subcategory',
        entityId: subcategory._id as mongoose.Types.ObjectId,
        action: 'create',
        metadata: { 
          subcategoryName: subcategory.name,
          categoryId: data.category
        },
        req
      });

      // Get populated subcategory
      const populatedSubcategory = await Subcategory.findById(subcategory._id as mongoose.Types.ObjectId)
        .populate('category', 'name');

      // Broadcast to all connected clients
      SocketService.broadcastToAll('subcategory.created', populatedSubcategory);

      res.status(201).json({
        ok: true,
        data: populatedSubcategory
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateSubcategoryDto = req.body;

      const subcategory = await Subcategory.findById(id);

      if (!subcategory) {
        throw new AppError('Subcategory not found', 404, 'NOT_FOUND');
      }

      const oldSubcategory = subcategory.toObject();

      // If category is being changed, verify it exists
      if (data.category) {
        const category = await Category.findById(data.category);
        if (!category) {
          throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
        }
        subcategory.category = data.category as any;
      }

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        // Delete old image if it exists and is not a placeholder
        if (subcategory.imageUrl && !subcategory.imageUrl.includes('placeholder')) {
          const storage = StorageFactory.getStorage();
          await storage.delete(subcategory.imageUrl);
        }
        
        subcategory.imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      } else if (data.imageUrl) {
        subcategory.imageUrl = data.imageUrl;
      }

      // Update fields
      if (data.name) subcategory.name = data.name;
      if (data.isActive !== undefined) subcategory.isActive = data.isActive;

      subcategory.updatedBy = req.user!.id as any;
      await subcategory.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldSubcategory, subcategory);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Subcategory',
        entityId: subcategory._id as mongoose.Types.ObjectId,
        action: 'update',
        diff,
        req
      });

      // Get populated subcategory
      const populatedSubcategory = await Subcategory.findById(subcategory._id as mongoose.Types.ObjectId)
        .populate('category', 'name');

      // Broadcast update
      SocketService.broadcastToAll('subcategory.updated', populatedSubcategory);

      res.json({
        ok: true,
        data: populatedSubcategory
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const subcategory = await Subcategory.findById(id);

      if (!subcategory) {
        throw new AppError('Subcategory not found', 404, 'NOT_FOUND');
      }

      // Store values before deletion
      const subcategoryId = (subcategory._id as mongoose.Types.ObjectId).toString();
      const subcategoryName = subcategory.name;

      // Delete image if it's not a placeholder
      if (subcategory.imageUrl && !subcategory.imageUrl.includes('placeholder')) {
        const storage = StorageFactory.getStorage();
        await storage.delete(subcategory.imageUrl);
      }

      await subcategory.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Subcategory',
        entityId: subcategoryId,
        action: 'delete',
        metadata: { subcategoryName },
        req
      });

      // Broadcast deletion
      SocketService.broadcastToAll('subcategory.deleted', { id: subcategoryId });

      res.json({
        ok: true,
        data: {
          message: 'Subcategory deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

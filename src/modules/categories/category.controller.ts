import { Request, Response, NextFunction } from 'express';
import { Category } from './category.model';
import { Subcategory } from '../subcategories/subcategory.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';
import { CreateCategoryDto, UpdateCategoryDto } from './category.validation';

export class CategoryController {
  static async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { includeSubcategories, isActive } = req.query;
      const query: any = {};

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const categories = await Category.find(query)
        .sort({ name: 1 })
        .lean();

      // Include subcategories if requested
      if (includeSubcategories === 'true') {
        const categoriesWithSubs = await Promise.all(
          categories.map(async (category) => {
            const subcategories = await Subcategory.find({
              category: category._id,
              isActive: query.isActive
            }).lean();
            
            return {
              ...category,
              subcategories
            };
          })
        );

        return res.json({
          ok: true,
          data: categoriesWithSubs
        });
      }

      res.json({
        ok: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }

  static async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { includeSubcategories } = req.query;

      const category = await Category.findById(id).lean();
      
      if (!category) {
        throw new AppError('Category not found', 404, 'NOT_FOUND');
      }

      let response: any = category;

      if (includeSubcategories === 'true') {
        const subcategories = await Subcategory.find({
          category: category._id
        }).lean();
        
        response = {
          ...category,
          subcategories
        };
      }

      res.json({
        ok: true,
        data: response
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateCategoryDto = req.body;
      let imageUrl = data.imageUrl;

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      }

      const category = new Category({
        name: data.name,
        imageUrl,
        createdBy: req.user!.id,
        isActive: true
      });

      await category.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Category',
        entityId: (category as any)._id.toString(),
        action: 'create',
        metadata: { categoryName: category.name },
        req
      });

      // Broadcast to all connected clients
      SocketService.broadcastToAll('category.created', category);

      res.status(201).json({
        ok: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateCategoryDto = req.body;

      const category = await Category.findById(id);
      
      if (!category) {
        throw new AppError('Category not found', 404, 'NOT_FOUND');
      }

      const oldCategory = category.toObject();

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        // Delete old image if it exists and is not a placeholder
        if (category.imageUrl && !category.imageUrl.includes('placeholder')) {
          const storage = StorageFactory.getStorage();
          await storage.delete(category.imageUrl);
        }
        
        category.imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      } else if (data.imageUrl) {
        category.imageUrl = data.imageUrl;
      }

      // Update fields
      if (data.name) category.name = data.name;
      if (data.isActive !== undefined) category.isActive = data.isActive;
      
      category.updatedBy = req.user!.id as any;
      await category.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldCategory, category);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Category',
        entityId: (category as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Broadcast update
      SocketService.broadcastToAll('category.updated', category);

      res.json({
        ok: true,
        data: category
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Check if category has subcategories
      const subcategoriesCount = await Subcategory.countDocuments({ category: id });
      
      if (subcategoriesCount > 0) {
        throw new AppError(
          'Cannot delete category with existing subcategories',
          400,
          'CATEGORY_HAS_SUBCATEGORIES'
        );
      }

      const category = await Category.findById(id);
      
      if (!category) {
        throw new AppError('Category not found', 404, 'NOT_FOUND');
      }

      // Delete image if it's not a placeholder
      if (category.imageUrl && !category.imageUrl.includes('placeholder')) {
        const storage = StorageFactory.getStorage();
        await storage.delete(category.imageUrl);
      }

      await category.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Category',
        entityId: (category as any)._id.toString(),
        action: 'delete',
        metadata: { categoryName: category.name },
        req
      });

      // Broadcast deletion
      SocketService.broadcastToAll('category.deleted', { id: category._id });

      res.json({
        ok: true,
        data: {
          message: 'Category deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

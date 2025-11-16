import { Request, Response, NextFunction } from 'express';
import { Brand } from './brand.model';
import { Product } from '../products/product.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';
import { CreateBrandDto, UpdateBrandDto } from './brand.validation';

export class BrandController {
  static async getAllBrands(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { isOwn } = req.query;
      const query: any = {};

      if (isOwn !== undefined) {
        query.isOwn = isOwn === 'true';
      }

      const brands = await Brand.find(query)
        .sort({ name: 1 })
        .lean();

      // Get product counts for each brand
      const brandsWithCounts = await Promise.all(
        brands.map(async (brand) => {
          const productCount = await Product.countDocuments({ brand: brand._id });
          return {
            ...brand,
            productCount
          };
        })
      );

      res.json({
        ok: true,
        data: brandsWithCounts
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const brand = await Brand.findById(id).lean();
      
      if (!brand) {
        throw new AppError('Brand not found', 404, 'NOT_FOUND');
      }

      res.json({
        ok: true,
        data: brand
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateBrandDto = req.body;
      let imageUrl = data.imageUrl;

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      }

      const brand = new Brand({
        name: data.name,
        imageUrl,
        createdBy: req.user!.id,
        isOwn: data.isOwn ?? true
      });

      await brand.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Brand',
        entityId: (brand as any)._id.toString(),
        action: 'create',
        metadata: { brandName: brand.name },
        req
      });

      // Broadcast to all connected clients
      SocketService.broadcastToAll('brand.created', brand);

      res.status(201).json({
        ok: true,
        data: brand
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateBrandDto = req.body;

      const brand = await Brand.findById(id);
      
      if (!brand) {
        throw new AppError('Brand not found', 404, 'NOT_FOUND');
      }

      const oldBrand = brand.toObject();

      // Handle Cloudinary image upload result
      if ((req as any).cloudinaryResult) {
        // Delete old image if it exists and is not a placeholder
        if (brand.imageUrl && !brand.imageUrl.includes('placeholder')) {
          const storage = StorageFactory.getStorage();
          await storage.delete(brand.imageUrl);
        }
        
        brand.imageUrl = (req as any).cloudinaryResult.url || (req as any).cloudinaryResult;
      } else if (data.imageUrl) {
        brand.imageUrl = data.imageUrl;
      }

      // Update fields
      if (data.name) brand.name = data.name;
      if (data.isOwn !== undefined) brand.isOwn = data.isOwn;
      
      brand.updatedBy = req.user!.id as any;
      await brand.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldBrand, brand);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Brand',
        entityId: (brand as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Broadcast update
      SocketService.broadcastToAll('brand.updated', brand);

      res.json({
        ok: true,
        data: brand
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const brand = await Brand.findById(id);
      
      if (!brand) {
        throw new AppError('Brand not found', 404, 'NOT_FOUND');
      }

      // Delete image if it's not a placeholder
      if (brand.imageUrl && !brand.imageUrl.includes('placeholder')) {
        const storage = StorageFactory.getStorage();
        await storage.delete(brand.imageUrl);
      }

      await brand.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Brand',
        entityId: (brand as any)._id.toString(),
        action: 'delete',
        metadata: { brandName: brand.name },
        req
      });

      // Broadcast deletion
      SocketService.broadcastToAll('brand.deleted', { id: brand._id });

      res.json({
        ok: true,
        data: {
          message: 'Brand deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

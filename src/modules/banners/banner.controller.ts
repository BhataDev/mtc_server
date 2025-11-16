import { Request, Response, NextFunction } from 'express';
import { Banner, BranchBanner, GlobalBanner } from './banner.model';
import { Branch } from '../branches/branch.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';

export class BannerController {
  // Branch Banners
  static async getBranchBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;

      // Verify branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && req.user!.branchId !== branchId) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const branchBanner = await BranchBanner.findOne({ branch: branchId })
        .populate('branch', 'name');

      res.json({
        ok: true,
        data: branchBanner || { branch: branchId, banners: [] }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBranchBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { branchId } = req.params;
      const { banners } = req.body;

      // Verify branch exists
      const branch = await Branch.findById(branchId);
      if (!branch) {
        throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && req.user!.branchId !== branchId) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      // Handle image uploads if files are provided
      let updatedBanners = banners || [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const storage = StorageFactory.getStorage();
        const uploadedUrls = await storage.uploadMany(req.files as Express.Multer.File[], 'banners/branch');
        
        // Create banner objects from uploaded images
        updatedBanners = uploadedUrls.map((url, index) => ({
          imageUrl: url,
          linkUrl: banners?.[index]?.linkUrl || '#',
          order: index
        }));
      }

      // Find or create branch banner
      let branchBanner = await BranchBanner.findOne({ branch: branchId });
      
      if (branchBanner) {
        // Delete old images if replacing
        if (branchBanner.banners.length > 0 && req.files) {
          const storage = StorageFactory.getStorage();
          const oldImages = branchBanner.banners
            .map(b => b.imageUrl)
            .filter(url => !url.includes('placeholder'));
          if (oldImages.length > 0) {
            await storage.deleteMany(oldImages);
          }
        }

        const oldBanner = branchBanner.toObject();
        branchBanner.banners = updatedBanners;
        branchBanner.updatedBy = req.user!.id as any;
        await branchBanner.save();

        // Create audit log for update
        const diff = AuditService.calculateDiff(oldBanner, branchBanner);
        await AuditService.create({
          actorUser: req.user!.id,
          actorRole: req.user!.role,
          entity: 'BranchBanner',
          entityId: (branchBanner as any)._id.toString(),
          action: 'update',
          diff,
          req
        });
      } else {
        // Create new branch banner
        branchBanner = new BranchBanner({
          branch: branchId,
          banners: updatedBanners,
          createdBy: req.user!.id,
          isActive: true
        });
        await branchBanner.save();

        // Create audit log for creation
        await AuditService.create({
          actorUser: req.user!.id,
          actorRole: req.user!.role,
          entity: 'BranchBanner',
          entityId: (branchBanner as any)._id.toString(),
          action: 'create',
          metadata: { branchId, branchName: branch.name },
          req
        });
      }

      // Broadcast update
      SocketService.broadcastToBranch(branchId, 'banner.updated', branchBanner);
      SocketService.broadcastToAdmins('banner.updated', branchBanner);

      res.json({
        ok: true,
        data: branchBanner
      });
    } catch (error) {
      next(error);
    }
  }

  // Global Banner
  static async getGlobalBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await Banner.find({ 
        branch: null, 
        isActive: true 
      }).sort({ order: 1 });
      
      res.json({
        ok: true,
        data: banners
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateGlobalBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { banners } = req.body;
      
      const globalBanner = await GlobalBanner.getInstance();
      const oldBanner = globalBanner.toObject();

      // Handle multiple image uploads if files are provided
      let updatedBanners = banners || [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const storage = StorageFactory.getStorage();
        const uploadedUrls = await storage.uploadMany(req.files as Express.Multer.File[], 'banners/global');
        
        // Create banner objects from uploaded images
        updatedBanners = uploadedUrls.map((url, index) => ({
          imageUrl: url,
          buttonUrl: banners?.[index]?.buttonUrl || '#',
          title: banners?.[index]?.title || '',
          description: banners?.[index]?.description || '',
          order: index
        }));
      } else if (banners && Array.isArray(banners)) {
        // Update existing banners without new images
        updatedBanners = banners.map((banner: any, index: number) => ({
          imageUrl: banner.imageUrl || globalBanner.banners[index]?.imageUrl || '/placeholder-global-banner.jpg',
          buttonUrl: banner.buttonUrl || '#',
          title: banner.title || '',
          description: banner.description || '',
          order: banner.order !== undefined ? banner.order : index
        }));
      }

      // Delete old images if replacing with new ones
      if (req.files && Array.isArray(req.files) && req.files.length > 0 && globalBanner.banners.length > 0) {
        const storage = StorageFactory.getStorage();
        const oldImages = globalBanner.banners
          .map(b => b.imageUrl)
          .filter(url => !url.includes('placeholder'));
        if (oldImages.length > 0) {
          await storage.deleteMany(oldImages);
        }
      }

      globalBanner.banners = updatedBanners;
      globalBanner.updatedBy = req.user!.id as any;
      await globalBanner.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldBanner, globalBanner);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'GlobalBanner',
        entityId: (globalBanner as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Broadcast to all connected clients
      SocketService.broadcastToAll('globalBanner.updated', globalBanner);

      res.json({
        ok: true,
        data: globalBanner
      });
    } catch (error) {
      next(error);
    }
  }

  // Banner Resolution (for visitors)
  static async resolveBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        throw new AppError('Latitude and longitude are required', 400, 'INVALID_PARAMS');
      }

      const coordinates = [parseFloat(lng as string), parseFloat(lat as string)];

      // Find nearest active branch
      const nearestBranch = await Branch.findOne({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: 50000 // 50km max distance
          }
        }
      });

      // Get global banner
      const globalBanner = await GlobalBanner.getInstance();

      // Response structure
      const response: any = {
        globalBanner
      };

      // If branch found, get its banners
      if (nearestBranch) {
        const branchBanner = await BranchBanner.findOne({
          branch: nearestBranch._id,
          isActive: true
        });

        response.branch = {
          id: nearestBranch._id,
          name: nearestBranch.name,
          distance: null // Could calculate actual distance if needed
        };
        response.branchBanners = branchBanner ? branchBanner.banners : [];
      } else {
        response.branch = null;
        response.branchBanners = [];
      }

      res.json({
        ok: true,
        data: response
      });
    } catch (error) {
      next(error);
    }
  }
}

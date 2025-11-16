import { Request, Response, NextFunction } from 'express';
import { Banner } from './banner.model';
import { Branch } from '../branches/branch.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';

export class BannerCrudController {
  // Create a new banner
  static async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, description, buttonUrl, branch, isActive, order } = req.body;

      // Validate branch if provided
      if (branch) {
        const branchExists = await Branch.findById(branch);
        if (!branchExists) {
          throw new AppError('Branch not found', 404, 'BRANCH_NOT_FOUND');
        }

        // Check permissions for branch banners
        if (req.user!.role === 'branch' && req.user!.branchId !== branch) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      } else {
        // Only admins can create global banners
        if (req.user!.role !== 'admin') {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      // Handle multi-device image uploads
      const cloudinaryResults = (req as any).cloudinaryResults;
      if (!cloudinaryResults || Object.keys(cloudinaryResults).length === 0) {
        throw new AppError('At least one banner image is required (Desktop, Tablet, or Mobile)', 400, 'IMAGE_REQUIRED');
      }

      // Create banner with multi-device images
      const banner = new Banner({
        imageUrlDesktop: cloudinaryResults.imageUrlDesktop?.url || cloudinaryResults.imageUrlDesktop || '',
        imageUrlTablet: cloudinaryResults.imageUrlTablet?.url || cloudinaryResults.imageUrlTablet || '',
        imageUrlMobile: cloudinaryResults.imageUrlMobile?.url || cloudinaryResults.imageUrlMobile || '',
        buttonUrl: buttonUrl || '#',
        title: title || '',
        description: description || '',
        branch: branch || null,
        isActive: isActive !== undefined ? isActive : true,
        order: order || 0,
        createdBy: req.user!.id
      });

      await banner.save();

      // Populate branch info if exists
      await banner.populate('branch', 'name');
      await banner.populate('createdBy', 'name email');

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Banner',
        entityId: (banner._id as any).toString(),
        action: 'create',
        metadata: { 
          type: branch ? 'branch' : 'global',
          branchId: branch,
          title: title || 'Untitled Banner'
        },
        req
      });

      // Broadcast update
      if (branch) {
        SocketService.broadcastToBranch(branch, 'banner.created', banner);
      } else {
        SocketService.broadcastToAll('globalBanner.created', banner);
      }
      SocketService.broadcastToAdmins('banner.created', banner);

      res.status(201).json({
        ok: true,
        data: banner,
        message: 'Banner created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get banners with pagination and filtering
  static async getBanners(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        branch, 
        isActive, 
        type = 'all',
        search 
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const filter: any = {};

      // Filter by type (global, branch, or all)
      if (type === 'global') {
        filter.branch = null;
      } else if (type === 'branch') {
        filter.branch = { $ne: null };
      }

      // Filter by specific branch
      if (branch) {
        filter.branch = branch;
        
        // Check permissions for branch banners (only if authenticated)
        if (req.user && req.user.role === 'branch' && req.user.branchId !== branch) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      // Filter by branch user's own banners (only if authenticated)
      if (req.user && req.user.role === 'branch' && !branch) {
        filter.branch = req.user.branchId;
      }

      // Filter by active status
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      // Search in title and description
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Get banners with pagination
      const [banners, total] = await Promise.all([
        Banner.find(filter)
          .populate('branch', 'name')
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email')
          .sort({ order: 1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Banner.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        ok: true,
        data: {
          banners,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a single banner by ID
  static async getBannerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const banner = await Banner.findById(id)
        .populate('branch', 'name')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

      if (!banner) {
        throw new AppError('Banner not found', 404, 'BANNER_NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch') {
        if (banner.branch && banner.branch._id.toString() !== req.user!.branchId) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (!banner.branch) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      res.json({
        ok: true,
        data: banner
      });
    } catch (error) {
      next(error);
    }
  }

  // Update a banner
  static async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { title, description, buttonUrl, isActive, order } = req.body;

      const banner = await Banner.findById(id);
      if (!banner) {
        throw new AppError('Banner not found', 404, 'BANNER_NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch') {
        if (banner.branch && banner.branch.toString() !== req.user!.branchId) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (!banner.branch) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      const oldBanner = banner.toObject();

      // Handle image upload if new image(s) provided
      const cloudinaryResults = (req as any).cloudinaryResults;
      if (cloudinaryResults && typeof cloudinaryResults === 'object') {
        // For each image type, if a new image is uploaded, delete the old one and update the URL
        if (cloudinaryResults.imageUrlDesktop) {
          const oldUrl = banner.imageUrlDesktop;
          if (oldUrl && !oldUrl.includes('placeholder')) {
            const urlParts = oldUrl.split('/');
            const publicIdWithExt = urlParts[urlParts.length - 1];
            const publicId = publicIdWithExt.split('.')[0];
            const { deleteFromCloudinary } = await import('../../config/cloudinary');
            try {
              await deleteFromCloudinary(`banners/${publicId}`);
            } catch (error) {
              console.warn('Failed to delete old imageUrlDesktop from Cloudinary:', error);
            }
          }
          banner.imageUrlDesktop = cloudinaryResults.imageUrlDesktop?.url || cloudinaryResults.imageUrlDesktop;
        }
        if (cloudinaryResults.imageUrlTablet) {
          const oldUrl = banner.imageUrlTablet;
          if (oldUrl && !oldUrl.includes('placeholder')) {
            const urlParts = oldUrl.split('/');
            const publicIdWithExt = urlParts[urlParts.length - 1];
            const publicId = publicIdWithExt.split('.')[0];
            const { deleteFromCloudinary } = await import('../../config/cloudinary');
            try {
              await deleteFromCloudinary(`banners/${publicId}`);
            } catch (error) {
              console.warn('Failed to delete old imageUrlTablet from Cloudinary:', error);
            }
          }
          banner.imageUrlTablet = cloudinaryResults.imageUrlTablet?.url || cloudinaryResults.imageUrlTablet;
        }
        if (cloudinaryResults.imageUrlMobile) {
          const oldUrl = banner.imageUrlMobile;
          if (oldUrl && !oldUrl.includes('placeholder')) {
            const urlParts = oldUrl.split('/');
            const publicIdWithExt = urlParts[urlParts.length - 1];
            const publicId = publicIdWithExt.split('.')[0];
            const { deleteFromCloudinary } = await import('../../config/cloudinary');
            try {
              await deleteFromCloudinary(`banners/${publicId}`);
            } catch (error) {
              console.warn('Failed to delete old imageUrlMobile from Cloudinary:', error);
            }
          }
          banner.imageUrlMobile = cloudinaryResults.imageUrlMobile?.url || cloudinaryResults.imageUrlMobile;
        }
      }

      // Update fields
      if (title !== undefined) banner.title = title;
      if (description !== undefined) banner.description = description;
      if (buttonUrl !== undefined) banner.buttonUrl = buttonUrl;
      if (isActive !== undefined) banner.isActive = isActive;
      if (order !== undefined) banner.order = order;
      
      banner.updatedBy = req.user!.id as any;
      await banner.save();

      // Populate for response
      await banner.populate('branch', 'name');
      await banner.populate('createdBy', 'name email');
      await banner.populate('updatedBy', 'name email');

      // Create audit log
      const diff = AuditService.calculateDiff(oldBanner, banner);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Banner',
        entityId: (banner._id as any).toString(),
        action: 'update',
        diff,
        req
      });

      // Broadcast update
      if (banner.branch) {
        SocketService.broadcastToBranch(banner.branch.toString(), 'banner.updated', banner);
      } else {
        SocketService.broadcastToAll('globalBanner.updated', banner);
      }
      SocketService.broadcastToAdmins('banner.updated', banner);

      res.json({
        ok: true,
        data: banner,
        message: 'Banner updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a banner
  static async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const banner = await Banner.findById(id);
      if (!banner) {
        throw new AppError('Banner not found', 404, 'BANNER_NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch') {
        if (banner.branch && banner.branch.toString() !== req.user!.branchId) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
        if (!banner.branch) {
          throw new AppError('Access denied', 403, 'FORBIDDEN');
        }
      }

      // Delete image from Cloudinary
      // Remove old imageUrl delete logic (no longer needed)

      // Store banner info for audit log before deletion
      const bannerInfo = {
        id: (banner._id as any).toString(),
        title: banner.title,
        branch: banner.branch,
        type: banner.branch ? 'branch' : 'global'
      };

      await Banner.findByIdAndDelete(id);

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Banner',
        entityId: bannerInfo.id,
        action: 'delete',
        metadata: bannerInfo,
        req
      });

      // Broadcast deletion
      if (bannerInfo.branch) {
        SocketService.broadcastToBranch(bannerInfo.branch.toString(), 'banner.deleted', { id: bannerInfo.id });
      } else {
        SocketService.broadcastToAll('globalBanner.deleted', { id: bannerInfo.id });
      }
      SocketService.broadcastToAdmins('banner.deleted', { id: bannerInfo.id });

      res.json({
        ok: true,
        message: 'Banner deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update banner status
  static async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, isActive } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Banner IDs are required', 400, 'IDS_REQUIRED');
      }

      // Build filter for permissions
      const filter: any = { _id: { $in: ids } };
      if (req.user!.role === 'branch') {
        filter.branch = req.user!.branchId;
      }

      const result = await Banner.updateMany(
        filter,
        { 
          isActive,
          updatedBy: req.user!.id
        }
      );

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Banner',
        entityId: 'bulk',
        action: 'update',
        metadata: { 
          action: 'bulk_status_update',
          ids,
          isActive,
          modifiedCount: result.modifiedCount
        },
        req
      });

      res.json({
        ok: true,
        data: {
          modifiedCount: result.modifiedCount
        },
        message: `${result.modifiedCount} banner(s) updated successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  // Get banner statistics
  static async getBannerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const filter: any = {};
      
      // Filter by branch user's own banners
      if (req.user!.role === 'branch') {
        filter.branch = req.user!.branchId;
      }

      const [
        totalBanners,
        activeBanners,
        globalBanners,
        branchBanners
      ] = await Promise.all([
        Banner.countDocuments(filter),
        Banner.countDocuments({ ...filter, isActive: true }),
        Banner.countDocuments({ ...filter, branch: null }),
        Banner.countDocuments({ ...filter, branch: { $ne: null } })
      ]);

      res.json({
        ok: true,
        data: {
          total: totalBanners,
          active: activeBanners,
          inactive: totalBanners - activeBanners,
          global: globalBanners,
          branch: branchBanners
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

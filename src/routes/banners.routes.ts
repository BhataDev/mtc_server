import { Router } from 'express';
import { BannerController } from '../modules/banners/banner.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import { uploadSingle, uploadMultiple } from '../middlewares/upload.middleware';

const router = Router();

// Branch banner routes
router.get('/branch/:branchId', requireAuth, BannerController.getBranchBanners);
router.put(
  '/branch/:branchId',
  requireAuth,
  uploadMultiple('banners', 10),
  BannerController.updateBranchBanners
);

// Global banner routes (admin only)
router.get('/global', requireAuth, BannerController.getGlobalBanner);
router.post(
  '/global',
  requireAuth,
  requireAdmin,
  uploadMultiple('images', 10),
  BannerController.updateGlobalBanner
);
router.put(
  '/global',
  requireAuth,
  requireAdmin,
  uploadMultiple('images', 10),
  BannerController.updateGlobalBanner
);

// Public resolution endpoint (no auth required)
router.get('/resolve', BannerController.resolveBanners);

export default router;

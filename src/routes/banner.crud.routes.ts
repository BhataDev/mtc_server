import { Router } from 'express';
import { BannerCrudController } from '../modules/banners/banner.crud.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import { uploadSingleToCloudinary, uploadBannerImagesToCloudinary } from '../middlewares/upload.middleware';

const router = Router();

// Banner CRUD routes
router.post(
  '/',
  requireAuth,
  ...uploadBannerImagesToCloudinary('banners'),
  BannerCrudController.createBanner
);

router.get(
  '/',
  BannerCrudController.getBanners
);

router.get(
  '/stats',
  requireAuth,
  BannerCrudController.getBannerStats
);

router.get(
  '/:id',
  requireAuth,
  BannerCrudController.getBannerById
);

router.put(
  '/:id',
  requireAuth,
  ...uploadBannerImagesToCloudinary('banners'),
  BannerCrudController.updateBanner
);

router.delete(
  '/:id',
  requireAuth,
  BannerCrudController.deleteBanner
);

router.patch(
  '/bulk/status',
  requireAuth,
  BannerCrudController.bulkUpdateStatus
);

export default router;

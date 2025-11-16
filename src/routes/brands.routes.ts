import { Router } from 'express';
import { BrandController } from '../modules/brands/brand.controller';
import { requireAuth, requireAdminOrBranch } from '../middlewares/auth.middleware';
import { validateBody, validateFormData } from '../middlewares/validation.middleware';
import { uploadSingleImageToCloudinary } from '../middlewares/upload.middleware';
import {
  createBrandSchema,
  updateBrandSchema
} from '../modules/brands/brand.validation';

const router = Router();

// Public routes (no auth required)
router.get('/', BrandController.getAllBrands);
router.get('/:id', BrandController.getBrand);

// Protected routes (require authentication)
router.use(requireAuth);
router.post(
  '/',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'brands'),
  validateFormData(createBrandSchema),
  BrandController.createBrand
);
router.put(
  '/:id',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'brands'),
  validateFormData(updateBrandSchema),
  BrandController.updateBrand
);
router.delete('/:id', requireAdminOrBranch, BrandController.deleteBrand);

export default router;

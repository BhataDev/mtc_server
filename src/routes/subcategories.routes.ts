import { Router } from 'express';
import { SubcategoryController } from '../modules/subcategories/subcategory.controller';
import { requireAuth, requireAdminOrBranch } from '../middlewares/auth.middleware';
import { validateBody, validateFormData } from '../middlewares/validation.middleware';
import { uploadSingleImageToCloudinary } from '../middlewares/upload.middleware';
import {
  createSubcategorySchema,
  updateSubcategorySchema
} from '../modules/subcategories/subcategory.validation';

const router = Router();

// Public routes (no auth required)
router.get('/', SubcategoryController.getAllSubcategories);
router.get('/:id', SubcategoryController.getSubcategory);

// Protected routes (require authentication)
router.use(requireAuth);
router.post(
  '/',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'subcategories'),
  validateFormData(createSubcategorySchema),
  SubcategoryController.createSubcategory
);
router.put(
  '/:id',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'subcategories'),
  validateFormData(updateSubcategorySchema),
  SubcategoryController.updateSubcategory
);
router.delete('/:id', requireAdminOrBranch, SubcategoryController.deleteSubcategory);

export default router;

import { Router } from 'express';
import { CategoryController } from '../modules/categories/category.controller';
import { requireAuth, requireAdminOrBranch } from '../middlewares/auth.middleware';
import { validateBody, validateFormData } from '../middlewares/validation.middleware';
import { uploadSingleImageToCloudinary } from '../middlewares/upload.middleware';
import {
  createCategorySchema,
  updateCategorySchema
} from '../modules/categories/category.validation';

const router = Router();

// Public routes (no auth required)
router.get('/', CategoryController.getAllCategories);
router.get('/:id', CategoryController.getCategory);

// Protected routes (require authentication)
router.use(requireAuth);
router.post(
  '/',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'categories'),
  validateFormData(createCategorySchema),
  CategoryController.createCategory
);
router.put(
  '/:id',
  requireAdminOrBranch,
  ...uploadSingleImageToCloudinary('image', 'categories'),
  validateFormData(updateCategorySchema),
  CategoryController.updateCategory
);
router.delete('/:id', requireAdminOrBranch, CategoryController.deleteCategory);

export default router;

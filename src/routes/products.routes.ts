import { Router } from 'express';
import { ProductController } from '../modules/products/product.controller';
import { requireAuth, requireAdminOrBranch } from '../middlewares/auth.middleware';
import { validateBody, validateFormData } from '../middlewares/validation.middleware';
import { uploadProductImagesToCloudinary } from '../middlewares/upload.middleware';
import {
  createProductSchema,
  updateProductSchema
} from '../modules/products/product.validation';

const router = Router();

// Public routes (no auth required)
router.get('/', ProductController.getAllProducts);
router.get('/search', ProductController.searchProducts);
router.get('/best-selling', ProductController.getBestSellingProducts);
router.get('/own-products', ProductController.getOwnProducts);
router.get('/:id', ProductController.getProduct);

// Protected routes (require authentication)
router.use(requireAuth);
router.get('/:id/history', ProductController.getProductHistory);
router.post(
  '/',
  requireAdminOrBranch,
  ...uploadProductImagesToCloudinary('products'),
  validateFormData(createProductSchema),
  ProductController.createProduct
);
router.put(
  '/:id',
  requireAdminOrBranch,
  ...uploadProductImagesToCloudinary('products'),
  validateFormData(updateProductSchema),
  ProductController.updateProduct
);
router.delete('/:id', requireAdminOrBranch, ProductController.deleteProduct);

export default router;

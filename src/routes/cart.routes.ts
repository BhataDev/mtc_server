import { Router } from 'express';
import { cartController } from '../modules/cart/cart.controller';
import { requireAuth, requireCustomer } from '../middlewares/auth.middleware';

const router = Router();

// All cart routes require authentication and customer role
router.use(requireAuth, requireCustomer);

// Cart routes
router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.put('/item/:productId', cartController.updateQuantity);
router.delete('/item/:productId', cartController.removeFromCart);
router.delete('/clear', cartController.clearCart);
router.get('/summary', cartController.getCartSummary);
router.post('/sync', cartController.syncCart);

export default router;

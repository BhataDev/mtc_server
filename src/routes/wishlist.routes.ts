import { Router } from 'express';
import { requireAuth, requireCustomer } from '../middlewares/auth.middleware';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkWishlistItems,
  moveAllToCart
} from '../modules/wishlist/wishlist.controller';

const router = Router();

// All wishlist routes require customer authentication
router.use(requireAuth);
router.use(requireCustomer);

// Get user's wishlist
router.get('/', getWishlist);

// Add product to wishlist
router.post('/add', addToWishlist);

// Check if products are in wishlist
router.post('/check', checkWishlistItems);

// Remove product from wishlist
router.delete('/remove/:productId', removeFromWishlist);

// Clear entire wishlist
router.delete('/clear', clearWishlist);

// Move all items to cart
router.post('/move-to-cart', moveAllToCart);

export default router;

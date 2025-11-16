import { Request, Response } from 'express';
import { cartService } from './cart.service';

export class CartController {
  // Get user's cart
  async getCart(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const cart = await cartService.getCart(customerId);
      
      res.status(200).json({
        success: true,
        data: {
          cart,
          items: cart?.items || [],
          totalItems: cart?.totalItems || 0,
          totalAmount: cart?.totalAmount || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get cart'
      });
    }
  }

  // Add item to cart
  async addToCart(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      const cart = await cartService.addToCart(customerId, productId, quantity);
      
      res.status(200).json({
        success: true,
        message: 'Item added to cart successfully',
        data: {
          cart,
          items: cart.items,
          totalItems: cart.totalItems,
          totalAmount: cart.totalAmount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add item to cart'
      });
    }
  }

  // Update item quantity
  async updateQuantity(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { productId } = req.params;
      const { quantity } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      if (quantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }

      const cart = await cartService.updateQuantity(customerId, productId, quantity);
      
      res.status(200).json({
        success: true,
        message: 'Cart updated successfully',
        data: {
          cart,
          items: cart.items,
          totalItems: cart.totalItems,
          totalAmount: cart.totalAmount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update cart'
      });
    }
  }

  // Remove item from cart
  async removeFromCart(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { productId } = req.params;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      const cart = await cartService.removeFromCart(customerId, productId);
      
      res.status(200).json({
        success: true,
        message: 'Item removed from cart successfully',
        data: {
          cart,
          items: cart.items,
          totalItems: cart.totalItems,
          totalAmount: cart.totalAmount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove item from cart'
      });
    }
  }

  // Clear entire cart
  async clearCart(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const cart = await cartService.clearCart(customerId);
      
      res.status(200).json({
        success: true,
        message: 'Cart cleared successfully',
        data: {
          cart,
          items: cart.items,
          totalItems: cart.totalItems,
          totalAmount: cart.totalAmount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to clear cart'
      });
    }
  }

  // Get cart summary
  async getCartSummary(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const summary = await cartService.getCartSummary(customerId);
      
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get cart summary'
      });
    }
  }

  // Sync local cart with database cart
  async syncCart(req: Request, res: Response): Promise<any> {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const { localCartItems = [] } = req.body;

      const cart = await cartService.syncLocalCart(customerId, localCartItems);
      
      res.status(200).json({
        success: true,
        message: 'Cart synced successfully',
        data: {
          cart,
          items: cart.items,
          totalItems: cart.totalItems,
          totalAmount: cart.totalAmount
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to sync cart'
      });
    }
  }
}

export const cartController = new CartController();

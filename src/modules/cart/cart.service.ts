import mongoose from 'mongoose';
import { Cart, ICart } from './cart.model';
import { Product } from '../products/product.model';
import { Settings } from '../settings/settings.model';

export class CartService {
  // Get user's cart
  async getCart(customerId: string): Promise<ICart | null> {
    try {
      const cart = await Cart.findOne({ customer: customerId })
        .populate({
          path: 'items.product',
          select: 'title price offerPrice images stock isActive isOwn'
        });
      
      return cart;
    } catch (error) {
      throw new Error(`Failed to get cart: ${error}`);
    }
  }

  // Add item to cart
  async addToCart(customerId: string, productId: string, quantity: number = 1): Promise<ICart> {
    try {
      // Validate product exists and is active
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        throw new Error('Product not found or inactive');
      }

      // Get current price (offer price if available, otherwise regular price)
      const currentPrice = product.offerPrice || product.price;

      // Find or create cart
      let cart = await Cart.findOne({ customer: customerId });
      
      if (!cart) {
        cart = new Cart({
          customer: customerId,
          items: []
        });
      }

      // Add item to cart
      cart.addItem(new mongoose.Types.ObjectId(productId), quantity, currentPrice);
      
      // Save cart
      await cart.save();

      // Return populated cart
      return await this.getCart(customerId) as ICart;
    } catch (error) {
      throw new Error(`Failed to add to cart: ${error}`);
    }
  }

  // Update item quantity
  async updateQuantity(customerId: string, productId: string, quantity: number): Promise<ICart> {
    try {
      const cart = await Cart.findOne({ customer: customerId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      const updated = cart.updateItemQuantity(new mongoose.Types.ObjectId(productId), quantity);
      if (!updated) {
        throw new Error('Item not found in cart');
      }

      await cart.save();
      return await this.getCart(customerId) as ICart;
    } catch (error) {
      throw new Error(`Failed to update quantity: ${error}`);
    }
  }

  // Remove item from cart
  async removeFromCart(customerId: string, productId: string): Promise<ICart> {
    try {
      const cart = await Cart.findOne({ customer: customerId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      const removed = cart.removeItem(new mongoose.Types.ObjectId(productId));
      if (!removed) {
        throw new Error('Item not found in cart');
      }

      await cart.save();
      return await this.getCart(customerId) as ICart;
    } catch (error) {
      throw new Error(`Failed to remove from cart: ${error}`);
    }
  }

  // Clear entire cart
  async clearCart(customerId: string): Promise<ICart> {
    try {
      const cart = await Cart.findOne({ customer: customerId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      cart.clearCart();
      await cart.save();
      
      return cart;
    } catch (error) {
      throw new Error(`Failed to clear cart: ${error}`);
    }
  }

  // Get cart summary
  async getCartSummary(customerId: string) {
    try {
      const cart = await this.getCart(customerId);
      if (!cart) {
        return {
          totalItems: 0,
          subtotal: 0,
          shipping: 0,
          total: 0,
          hasOwnProducts: false,
          hasNonOwnProducts: false
        };
      }

      const subtotal = cart.totalAmount;
      
      // Get shipping settings
      const settings = await Settings.getInstance();
      
      // Check if cart has own products and non-own products
      const hasOwnProducts = cart.items.some((item: any) => item.product?.isOwn === true);
      const hasNonOwnProducts = cart.items.some((item: any) => item.product?.isOwn === false);
      
      // Calculate shipping based on isOwn logic:
      // - If cart contains only own products (isOwn: true), shipping is free
      // - If cart contains any non-own products (isOwn: false), apply shipping charge
      let shipping = 0;
      if (hasNonOwnProducts) {
        shipping = settings.shippingChargeSAR;
      }
      
      const total = subtotal + shipping;

      return {
        totalItems: cart.totalItems,
        subtotal,
        shipping,
        total,
        hasOwnProducts,
        hasNonOwnProducts
      };
    } catch (error) {
      throw new Error(`Failed to get cart summary: ${error}`);
    }
  }

  // Sync local cart with database cart (when user logs in)
  async syncLocalCart(customerId: string, localCartItems: any[]): Promise<ICart> {
    try {
      // Get or create user's cart
      let cart = await Cart.findOne({ customer: customerId });
      if (!cart) {
        cart = new Cart({
          customer: customerId,
          items: []
        });
      }

      // Add local cart items to database cart
      for (const localItem of localCartItems) {
        const product = await Product.findById(localItem.product._id);
        if (product && product.isActive) {
          const currentPrice = product.offerPrice || product.price;
          cart.addItem(new mongoose.Types.ObjectId(localItem.product._id), localItem.quantity, currentPrice);
        }
      }

      await cart.save();
      return await this.getCart(customerId) as ICart;
    } catch (error) {
      throw new Error(`Failed to sync cart: ${error}`);
    }
  }
}

export const cartService = new CartService();

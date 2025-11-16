import { Request, Response } from 'express';
import { Wishlist } from './wishlist.model';
import { Product } from '../products/product.model';
import { cartService } from '../cart/cart.service';

// Get user's wishlist
export const getWishlist = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;

    let wishlist = await Wishlist.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'subcategory', select: 'name' },
          { path: 'brand', select: 'name imageUrl' }
        ]
      });

    if (!wishlist) {
      // Create empty wishlist if doesn't exist
      wishlist = await Wishlist.create({ user: userId, items: [] });
    }

    // Filter out any null products (deleted products)
    const validItems = wishlist.items.filter(item => item.product !== null);
    
    if (validItems.length !== wishlist.items.length) {
      wishlist.items = validItems;
      await wishlist.save();
    }

    return res.json({
      success: true,
      data: {
        _id: wishlist._id,
        items: wishlist.items,
        itemCount: wishlist.items.length
      }
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist'
    });
  }
};

// Add product to wishlist
export const addToWishlist = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    const { productId } = req.body;

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, items: [] });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      item => item.product.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    // Add product to wishlist
    wishlist.items.push({ 
      product: productId, 
      addedAt: new Date() 
    });
    
    await wishlist.save();

    // Populate the newly added product
    await wishlist.populate({
      path: 'items.product',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'subcategory', select: 'name' },
        { path: 'brand', select: 'name imageUrl' }
      ]
    });

    // Real-time update would go here if socket service is available
    // if (userId) {
    //   SocketService.broadcastToUser(userId.toString(), 'wishlist:added', {
    //     productId,
    //     itemCount: wishlist.items.length
    //   });
    // }

    return res.json({
      success: true,
      message: 'Product added to wishlist',
      data: {
        _id: wishlist._id,
        items: wishlist.items,
        itemCount: wishlist.items.length
      }
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add product to wishlist'
    });
  }
};

// Remove product from wishlist
export const removeFromWishlist = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Remove product from wishlist
    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      item => item.product.toString() !== productId
    );

    if (wishlist.items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in wishlist'
      });
    }

    await wishlist.save();

    // Real-time update would go here if socket service is available
    // if (userId) {
    //   SocketService.broadcastToUser(userId.toString(), 'wishlist:removed', {
    //     productId,
    //     itemCount: wishlist.items.length
    //   });
    // }

    return res.json({
      success: true,
      message: 'Product removed from wishlist',
      data: {
        itemCount: wishlist.items.length
      }
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove product from wishlist'
    });
  }
};

// Clear entire wishlist
export const clearWishlist = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;

    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.items = [];
    await wishlist.save();

    // Real-time update would go here if socket service is available
    // if (userId) {
    //   SocketService.broadcastToUser(userId.toString(), 'wishlist:cleared', {
    //     itemCount: 0
    //   });
    // }

    return res.json({
      success: true,
      message: 'Wishlist cleared',
      data: {
        itemCount: 0
      }
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist'
    });
  }
};

// Check if products are in wishlist
export const checkWishlistItems = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    const { productIds } = req.body;

    if (!Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: 'Product IDs must be an array'
      });
    }

    const wishlist = await Wishlist.findOne({ user: userId });
    
    if (!wishlist) {
      return res.json({
        success: true,
        data: {
          wishlisted: []
        }
      });
    }

    const wishlistedIds = wishlist.items
      .filter(item => productIds.includes(item.product.toString()))
      .map(item => item.product.toString());

    return res.json({
      success: true,
      data: {
        wishlisted: wishlistedIds
      }
    });
  } catch (error) {
    console.error('Error checking wishlist items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check wishlist items'
    });
  }
};

// Move all wishlist items to cart
export const moveAllToCart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const wishlist = await Wishlist.findOne({ user: userId })
      .populate('items.product');
    
    if (!wishlist || wishlist.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Wishlist is empty'
      });
    }

    // Add all wishlist items to cart
    const itemCount = wishlist.items.length;
    let movedCount = 0;

    for (const item of wishlist.items) {
      try {
        // Add each item to cart with quantity 1
        await cartService.addToCart(userId, item.product._id.toString(), 1);
        movedCount++;
      } catch (error) {
        console.error(`Failed to add product ${item.product._id} to cart:`, error);
        // Continue with other items even if one fails
      }
    }

    // Clear wishlist after successfully moving items
    if (movedCount > 0) {
      wishlist.items = [];
      await wishlist.save();
    }

    // Real-time update would go here if socket service is available
    // SocketService.broadcastToUser(userId.toString(), 'wishlist:movedToCart', {
    //   itemCount: 0,
    //   movedCount: movedCount
    // });

    return res.json({
      success: true,
      message: movedCount > 0 ? `${movedCount} items moved to cart` : 'No items could be moved to cart',
      data: {
        movedCount: movedCount
      }
    });
  } catch (error) {
    console.error('Error moving wishlist to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to move items to cart'
    });
  }
};

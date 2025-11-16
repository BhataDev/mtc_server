import { Settings } from '../modules/settings/settings.model';
import { Brand } from '../modules/brands/brand.model';
import { Product } from '../modules/products/product.model';

export interface CartItem {
  product: string; // Product ID
  quantity: number;
}

export interface ShippingCalculationResult {
  shippingCharge: number;
  freeShipping: boolean;
  reason?: string;
}

/**
 * Calculate shipping charge for cart items
 * @param cartItems Array of cart items with product IDs and quantities
 * @returns Shipping calculation result
 */
export async function calculateShippingCharge(cartItems: CartItem[]): Promise<ShippingCalculationResult> {
  try {
    // Get settings
    const settings = await Settings.getInstance();
    
    // If free shipping for own brands is disabled, return standard shipping
    if (!settings.freeShippingForOwnBrands) {
      return {
        shippingCharge: settings.shippingChargeSAR,
        freeShipping: false,
        reason: 'Standard shipping charge applied'
      };
    }

    // Get all products in cart with brand information
    const productIds = cartItems.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('brand', 'isOwn')
      .lean();

    // Check if all products are from own brands
    const allOwnBrands = products.every(product => {
      const brand = product.brand as any;
      return brand && brand.isOwn === true;
    });

    if (allOwnBrands && products.length > 0) {
      return {
        shippingCharge: 0,
        freeShipping: true,
        reason: 'Free shipping for own brand products'
      };
    }

    // Check if cart contains any own brand products
    const hasOwnBrandProducts = products.some(product => {
      const brand = product.brand as any;
      return brand && brand.isOwn === true;
    });

    if (hasOwnBrandProducts) {
      return {
        shippingCharge: settings.shippingChargeSAR,
        freeShipping: false,
        reason: 'Mixed cart - standard shipping applies'
      };
    }

    // All third-party products
    return {
      shippingCharge: settings.shippingChargeSAR,
      freeShipping: false,
      reason: 'Third-party products - standard shipping applies'
    };

  } catch (error) {
    console.error('Error calculating shipping charge:', error);
    // Fallback to standard shipping on error
    const settings = await Settings.getInstance();
    return {
      shippingCharge: settings.shippingChargeSAR,
      freeShipping: false,
      reason: 'Error occurred - standard shipping applied'
    };
  }
}

/**
 * Check if a single product qualifies for free shipping
 * @param productId Product ID to check
 * @returns Whether the product qualifies for free shipping
 */
export async function isProductFreeShipping(productId: string): Promise<boolean> {
  try {
    const settings = await Settings.getInstance();
    
    if (!settings.freeShippingForOwnBrands) {
      return false;
    }

    const product = await Product.findById(productId)
      .populate('brand', 'isOwn')
      .lean();

    if (!product || !product.brand) {
      return false;
    }

    const brand = product.brand as any;
    return brand.isOwn === true;

  } catch (error) {
    console.error('Error checking product free shipping:', error);
    return false;
  }
}

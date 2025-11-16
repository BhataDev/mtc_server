import mongoose from 'mongoose';
import { OfferCampaign } from './offer.model';
import { Product } from '../products/product.model';

export interface IProductWithOffer {
  _id: mongoose.Types.ObjectId;
  originalPrice: number;
  effectivePrice: number;
  hasOffer: boolean;
  offerDiscount?: number;
  offerPercent?: number;
  applicableOffers?: any[];
}

export class OfferService {
  /**
   * Calculate effective prices for products based on active offers
   * @param products - Array of product objects or product IDs
   * @param branchId - Optional branch ID for branch-specific offers
   * @param userLocation - Optional user location for geo-based offers
   * @returns Products with calculated effective prices
   */
  static async calculateEffectivePrices(
    products: any[],
    branchId?: string | null,
    userLocation?: { lat: number; lng: number }
  ): Promise<IProductWithOffer[]> {
    try {
      const now = new Date();
      
      // Get product IDs
      const productIds = products.map(p => 
        typeof p === 'string' ? p : (p._id || p.id)
      );

      // Build query for active offers
      const offerQuery: any = {
        isActive: true,
        $and: [
          {
            $or: [
              { startsAt: null },
              { startsAt: { $lte: now } }
            ]
          },
          {
            $or: [
              { endsAt: null },
              { endsAt: { $gte: now } }
            ]
          }
        ]
      };

      // Add location-based filtering
      const locationConditions: any[] = [];
      
      // Branch-specific offers
      if (branchId) {
        locationConditions.push({
          $or: [
            { branches: new mongoose.Types.ObjectId(branchId) },
            { branch: new mongoose.Types.ObjectId(branchId) } // Legacy support
          ]
        });
      }
      
      // Global offers (no location restrictions)
      locationConditions.push({
        $and: [
          { $or: [{ branches: { $exists: false } }, { branches: { $size: 0 } }] },
          { $or: [{ cities: { $exists: false } }, { cities: { $size: 0 } }] },
          { geo: { $exists: false } },
          { branch: null } // Legacy support
        ]
      });
      
      if (locationConditions.length > 0) {
        offerQuery.$and.push({ $or: locationConditions });
      }

      // Find offers that apply to our products
      const offers = await OfferCampaign.find({
        ...offerQuery,
        $or: [
          { 'items.product': { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) } },
          { productIds: { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) } },
          { categoryIds: { $exists: true, $ne: [] } } // Category-based offers
        ]
      })
      .populate('items.product', '_id category')
      .lean();

      // Get full product details if we only have IDs
      let fullProducts = products;
      if (products.length > 0 && typeof products[0] === 'string') {
        fullProducts = await Product.find({ _id: { $in: productIds } }).lean();
      }

      // Calculate effective prices for each product
      const productsWithOffers: IProductWithOffer[] = fullProducts.map(product => {
        const productId = (product._id || product.id).toString();
        const originalPrice = product.price;
        let effectivePrice = originalPrice;
        let hasOffer = false;
        let offerDiscount = 0;
        let offerPercent = 0;
        const applicableOffers: any[] = [];

        // Check each offer to see if it applies to this product
        for (const offer of offers) {
          let appliesToProduct = false;
          let calculatedPrice = originalPrice;

          // Check direct product inclusion in offer items
          const directItem = offer.items?.find((item: any) => 
            item.product && item.product._id.toString() === productId
          );

          if (directItem) {
            appliesToProduct = true;
            
            if (offer.applyMode === 'perItem') {
              if (directItem.offerPrice && directItem.offerPrice > 0) {
                calculatedPrice = directItem.offerPrice;
              } else if (directItem.percent && directItem.percent > 0) {
                calculatedPrice = originalPrice * (1 - directItem.percent / 100);
              }
            }
          }

          // Check if product is in productIds array
          if (!appliesToProduct && offer.productIds && offer.productIds.length > 0) {
            const isInProductIds = offer.productIds.some((pid: any) => 
              pid.toString() === productId
            );
            if (isInProductIds) {
              appliesToProduct = true;
            }
          }

          // Check category-based offers
          if (!appliesToProduct && offer.categoryIds && offer.categoryIds.length > 0) {
            const productCategoryId = product.category?.toString() || product.category;
            const isInCategories = offer.categoryIds.some((cid: any) => 
              cid.toString() === productCategoryId
            );
            if (isInCategories) {
              appliesToProduct = true;
            }
          }

          // Apply bulk pricing if applicable
          if (appliesToProduct && offer.applyMode !== 'perItem') {
            if (offer.applyMode === 'bulkPercent' && offer.bulkPercent) {
              calculatedPrice = originalPrice * (1 - offer.bulkPercent / 100);
            } else if (offer.applyMode === 'bulkAmount' && offer.bulkAmount) {
              calculatedPrice = Math.max(0, originalPrice - offer.bulkAmount);
            }
          }

          // Use the best price (lowest) if multiple offers apply
          if (appliesToProduct && calculatedPrice < effectivePrice) {
            effectivePrice = calculatedPrice;
            hasOffer = true;
            offerDiscount = originalPrice - effectivePrice;
            offerPercent = Math.round((offerDiscount / originalPrice) * 100);
            
            applicableOffers.push({
              id: offer._id,
              title: offer.title,
              discount: offerDiscount,
              percent: offerPercent,
              applyMode: offer.applyMode
            });
          }
        }

        return {
          _id: product._id,
          originalPrice,
          effectivePrice: Math.round(effectivePrice * 100) / 100, // Round to 2 decimal places
          hasOffer,
          offerDiscount: hasOffer ? Math.round(offerDiscount * 100) / 100 : undefined,
          offerPercent: hasOffer ? offerPercent : undefined,
          applicableOffers: hasOffer ? applicableOffers : undefined
        };
      });

      return productsWithOffers;
    } catch (error) {
      console.error('Error calculating effective prices:', error);
      // Return products with original prices if calculation fails
      return products.map(product => ({
        _id: product._id || product.id,
        originalPrice: product.price,
        effectivePrice: product.price,
        hasOffer: false
      }));
    }
  }

  /**
   * Apply offer pricing to a single product
   * @param product - Product object
   * @param branchId - Optional branch ID
   * @param userLocation - Optional user location
   * @returns Product with effective pricing
   */
  static async applyOfferPricing(
    product: any,
    branchId?: string | null,
    userLocation?: { lat: number; lng: number }
  ): Promise<any> {
    const [productWithOffer] = await this.calculateEffectivePrices(
      [product],
      branchId,
      userLocation
    );

    return {
      ...product,
      originalPrice: productWithOffer.originalPrice,
      effectivePrice: productWithOffer.effectivePrice,
      offerPrice: productWithOffer.hasOffer ? productWithOffer.effectivePrice : product.offerPrice,
      hasOffer: productWithOffer.hasOffer,
      offerDiscount: productWithOffer.offerDiscount,
      offerPercent: productWithOffer.offerPercent,
      applicableOffers: productWithOffer.applicableOffers
    };
  }

  /**
   * Apply offer pricing to an array of products
   * @param products - Array of product objects
   * @param branchId - Optional branch ID
   * @param userLocation - Optional user location
   * @returns Products with effective pricing
   */
  static async applyOfferPricingToProducts(
    products: any[],
    branchId?: string | null,
    userLocation?: { lat: number; lng: number }
  ): Promise<any[]> {
    const productsWithOffers = await this.calculateEffectivePrices(
      products,
      branchId,
      userLocation
    );

    return products.map((product, index) => {
      const offerData = productsWithOffers[index];
      
      return {
        ...product,
        originalPrice: offerData.originalPrice,
        effectivePrice: offerData.effectivePrice,
        offerPrice: offerData.hasOffer ? offerData.effectivePrice : product.offerPrice,
        hasOffer: offerData.hasOffer,
        offerDiscount: offerData.offerDiscount,
        offerPercent: offerData.offerPercent,
        applicableOffers: offerData.applicableOffers
      };
    });
  }
}

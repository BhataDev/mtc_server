import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { OfferCampaign } from './offer.model';
import { Product } from '../products/product.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { CreateOfferDto, UpdateOfferDto } from './offer.validation';

export class OfferController {
  // Public methods for client-user (no authentication required)
  static async getPublicActiveOffers(req: Request, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      
      const offers = await OfferCampaign.find({
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
      })
        .populate('items.product', 'title modelNumber price images isActive')
        .sort({ createdAt: -1 })
        .lean();

      // Filter out offers with inactive products and ensure products are active
      const activeOffers = offers.filter(offer => {
        if (!offer.items || offer.items.length === 0) return false;
        
        // Check if all products in the offer are active
        const hasActiveProducts = offer.items.some(item => {
          const product = item.product as any;
          return product && product.isActive !== false;
        });
        
        return hasActiveProducts;
      });

      res.json({
        ok: true,
        data: activeOffers
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Comprehensive offer resolution with advanced filtering, geo-targeting, and stacking logic
   * @param req - Request with query params: lat, lng, cityName, branchId, cartProductIds
   * @param res - Response with resolved offers
   */
  static async resolveRelevantOffers(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        lat, 
        lng, 
        cityName, 
        branchId: queryBranchId, 
        cartProductIds 
      } = req.query;
      
      const now = new Date();
      
      // Import required models
      const { Branch } = require('../branches/branch.model');
      const { Product } = require('../products/product.model');
      
      // Parse cart product IDs if provided
      let cartProducts: any[] = [];
      let cartCategoryIds: mongoose.Types.ObjectId[] = [];
      
      if (cartProductIds) {
        const productIdArray = Array.isArray(cartProductIds) 
          ? cartProductIds 
          : (cartProductIds as string).split(',');
          
        cartProducts = await Product.find({
          _id: { $in: productIdArray }
        }).select('_id category subcategory');
        
        // Extract unique category IDs from cart products
        cartCategoryIds = [...new Set(cartProducts.map(p => p.category))];
      }
      
      // Determine user's location context
      let userBranchId = queryBranchId;
      let userCity = cityName;
      let userCoordinates: number[] | null = null;
      
      // If coordinates provided, use them
      if (lat && lng) {
        userCoordinates = [Number(lng), Number(lat)]; // MongoDB uses [lng, lat] format
        
        // Find nearest branch if not provided
        if (!userBranchId) {
          const branches = await Branch.find({ isActive: true });
          
          if (branches.length > 0) {
            let nearestBranch: any = null;
            let minDistance = Infinity;
            
            branches.forEach((branch: any) => {
              if (branch.location && branch.location.coordinates) {
                const [branchLng, branchLat] = branch.location.coordinates;
                const distance = Math.sqrt(
                  Math.pow(Number(lat) - branchLat, 2) + 
                  Math.pow(Number(lng) - branchLng, 2)
                );
                
                if (distance < minDistance) {
                  minDistance = distance;
                  nearestBranch = branch;
                }
              }
            });
            
            if (nearestBranch) {
              userBranchId = nearestBranch._id;
              userCity = userCity || nearestBranch.city;
            }
          }
        }
      }
      
      // If branch ID provided but no city, get city from branch
      if (userBranchId && !userCity) {
        const branch = await Branch.findById(userBranchId);
        if (branch) {
          userCity = branch.city;
          if (!userCoordinates && branch.location && branch.location.coordinates) {
            userCoordinates = branch.location.coordinates;
          }
        }
      }
      
      // Build the base query for active offers within date range
      const baseQuery: any = {
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
      
      // Build location-based filter conditions
      const locationConditions: any[] = [];
      
      // 1. Branch-specific offers
      if (userBranchId) {
        locationConditions.push({
          $or: [
            { branches: userBranchId },
            { branch: userBranchId } // Legacy support
          ]
        });
      }
      
      // 2. City-specific offers
      if (userCity) {
        locationConditions.push({
          cities: userCity
        });
      }
      
      // 3. Geo-based offers (will be handled separately for complex geo queries)
      
      // 4. Global offers (no location restrictions)
      locationConditions.push({
        $and: [
          { $or: [{ branches: { $exists: false } }, { branches: { $size: 0 } }] },
          { $or: [{ cities: { $exists: false } }, { cities: { $size: 0 } }] },
          { geo: { $exists: false } },
          { branch: null } // Legacy support
        ]
      });
      
      // Add location conditions to base query
      if (locationConditions.length > 0) {
        baseQuery.$and.push({ $or: locationConditions });
      }
      
      // Execute the main query
      let offers = await OfferCampaign.find(baseQuery)
        .populate('items.product', 'title modelNumber price images isActive category')
        .populate('branches', 'name')
        .populate('categoryIds', 'name')
        .populate('productIds', 'title')
        .lean();
      
      // Handle geo-based filtering for Point and Polygon types
      if (userCoordinates) {
        // Find offers with geo restrictions
        const geoOffers = await OfferCampaign.find({
          ...baseQuery,
          'geo.type': { $exists: true }
        }).lean();
        
        for (const offer of geoOffers) {
          if (offer.geo) {
            let includeOffer = false;
            
            if (offer.geo.type === 'Point' && offer.geo.radiusMeters) {
              // Calculate distance for Point type
              const [offerLng, offerLat] = offer.geo.coordinates as number[];
              const distance = OfferController.calculateDistance(
                userCoordinates[1], userCoordinates[0],
                offerLat, offerLng
              );
              
              if (distance <= offer.geo.radiusMeters) {
                includeOffer = true;
              }
            } else if (offer.geo.type === 'Polygon') {
              // Use MongoDB's $geoWithin for polygon check
              const pointInPolygon = await OfferCampaign.findOne({
                _id: offer._id,
                'geo.coordinates': {
                  $geoWithin: {
                    $geometry: {
                      type: 'Point',
                      coordinates: userCoordinates
                    }
                  }
                }
              });
              
              if (pointInPolygon) {
                includeOffer = true;
              }
            }
            
            if (includeOffer && !offers.find(o => o._id.toString() === offer._id.toString())) {
              // Populate the offer before adding
              const populatedOffer = await OfferCampaign.findById(offer._id)
                .populate('items.product', 'title modelNumber price images isActive category')
                .populate('branches', 'name')
                .populate('categoryIds', 'name')
                .populate('productIds', 'title')
                .lean();
              
              if (populatedOffer) {
                offers.push(populatedOffer);
              }
            }
          }
        }
      }
      
      // Filter out offers with inactive products
      offers = offers.filter(offer => {
        if (!offer.items || offer.items.length === 0) return false;
        
        const hasActiveProducts = offer.items.some(item => {
          const product = item.product as any;
          return product && product.isActive !== false;
        });
        
        return hasActiveProducts;
      });
      
      // Score offers based on relevance to cart (if cart products provided)
      if (cartProducts.length > 0) {
        offers = offers.map(offer => {
          let relevanceScore = 0;
          
          // Check if offer products match cart products
          const offerProductIds = offer.items.map(item => 
            (item.product as any)._id.toString()
          );
          
          const matchingProducts = cartProducts.filter(cp => 
            offerProductIds.includes(cp._id.toString())
          ).length;
          
          relevanceScore += matchingProducts * 10; // High weight for direct product matches
          
          // Check if offer applies to cart categories
          if (offer.categoryIds && offer.categoryIds.length > 0) {
            const offerCategoryIds = offer.categoryIds.map(c => 
              (c as any)._id ? (c as any)._id.toString() : c.toString()
            );
            
            const matchingCategories = cartCategoryIds.filter(ccId => 
              offerCategoryIds.includes(ccId.toString())
            ).length;
            
            relevanceScore += matchingCategories * 5; // Medium weight for category matches
          }
          
          // Check if offer has specific product IDs that match cart
          if (offer.productIds && offer.productIds.length > 0) {
            const offerSpecificProductIds = offer.productIds.map(p => 
              (p as any)._id ? (p as any)._id.toString() : p.toString()
            );
            
            const matchingSpecificProducts = cartProducts.filter(cp => 
              offerSpecificProductIds.includes(cp._id.toString())
            ).length;
            
            relevanceScore += matchingSpecificProducts * 8; // High weight for specific product matches
          }
          
          return { ...offer, relevanceScore };
        });
      }
      
      // Sort offers by priority (desc), then by relevance (if cart provided), then by dates
      offers.sort((a: any, b: any) => {
        // First by priority
        if (a.priority !== b.priority) {
          return (b.priority || 0) - (a.priority || 0);
        }
        
        // Then by relevance score (if available)
        if (a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
          if (a.relevanceScore !== b.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
        }
        
        // Then by start date (earlier first)
        if (a.startsAt && b.startsAt) {
          return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
        }
        
        // Then by end date (sooner ending first)
        if (a.endsAt && b.endsAt) {
          return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
        }
        
        return 0;
      });
      
      // Apply stacking logic
      const appliedOffers: any[] = [];
      const productOfferMap = new Map<string, any>(); // Track which offer applies to which product
      
      for (const offer of offers) {
        if (offer.stackable) {
          // Stackable offers can always be added
          appliedOffers.push(offer);
          
          // Track products this offer applies to
          for (const item of offer.items) {
            const productId = (item.product as any)._id.toString();
            if (!productOfferMap.has(productId)) {
              productOfferMap.set(productId, []);
            }
            productOfferMap.get(productId).push(offer);
          }
        } else {
          // Non-stackable offer - check if we can apply it
          let canApply = true;
          
          for (const item of offer.items) {
            const productId = (item.product as any)._id.toString();
            const existingOffers = productOfferMap.get(productId) || [];
            
            // Check if there's already a non-stackable offer with equal or higher priority
            const hasBlockingOffer = existingOffers.some((existingOffer: any) => 
              !existingOffer.stackable && existingOffer.priority >= offer.priority
            );
            
            if (hasBlockingOffer) {
              canApply = false;
              break;
            }
          }
          
          if (canApply) {
            appliedOffers.push(offer);
            
            // Track products and remove lower priority stackable offers if needed
            for (const item of offer.items) {
              const productId = (item.product as any)._id.toString();
              productOfferMap.set(productId, [offer]); // Non-stackable replaces others for this product
            }
          }
        }
      }
      
      // Remove relevanceScore from final output
      const finalOffers = appliedOffers.map(({ relevanceScore, ...offer }) => offer);
      
      res.json({
        ok: true,
        data: {
          offers: finalOffers,
          metadata: {
            userBranchId,
            userCity,
            userCoordinates,
            totalOffersFound: offers.length,
            appliedOffersCount: finalOffers.length,
            hasLocationContext: !!(userBranchId || userCity || userCoordinates),
            cartProductsConsidered: cartProducts.length
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }
  
  // Helper function to calculate distance between two points (in meters)
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  // Get offers based on user's location (nearest branch)
  static async getLocationBasedOffers(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lng } = req.query;
      const now = new Date();
      
      // Import Branch model
      const { Branch } = require('../branches/branch.model');
      
      let branchId = null;
      
      // If location is provided, find nearest branch
      if (lat && lng) {
        const branches = await Branch.find({ isActive: true });
        
        if (branches.length > 0) {
          // Find nearest branch using simple distance calculation
          let nearestBranch: any = null;
          let minDistance = Infinity;
          
          branches.forEach((branch: any) => {
            if (branch.location && branch.location.coordinates) {
              const [branchLng, branchLat] = branch.location.coordinates;
              // Simple distance calculation (not accurate for large distances but good enough for city-level)
              const distance = Math.sqrt(
                Math.pow(Number(lat) - branchLat, 2) + 
                Math.pow(Number(lng) - branchLng, 2)
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                nearestBranch = branch;
              }
            }
          });
          
          if (nearestBranch) {
            branchId = nearestBranch._id;
          }
        }
      }
      
      // Fetch offers: global offers + branch-specific offers if branch found
      const query: any = {
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
      
      // If we found a nearest branch, get both global and branch-specific offers
      if (branchId) {
        query.$and.push({
          $or: [
            { branch: null }, // Global offers
            { branch: branchId } // Branch-specific offers
          ]
        });
      } else {
        // Only global offers if no branch found
        query.branch = null;
      }
      
      const offers = await OfferCampaign.find(query)
        .populate('items.product', 'title modelNumber price images isActive')
        .populate('branch', 'name')
        .sort({ createdAt: -1 })
        .lean();
      
      // Filter out offers with inactive products
      const activeOffers = offers.filter(offer => {
        if (!offer.items || offer.items.length === 0) return false;
        
        const hasActiveProducts = offer.items.some(item => {
          const product = item.product as any;
          return product && product.isActive !== false;
        });
        
        return hasActiveProducts;
      });
      
      res.json({
        ok: true,
        data: activeOffers,
        nearestBranch: branchId ? await Branch.findById(branchId).select('name') : null
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPublicOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const now = new Date();

      const offer = await OfferCampaign.findOne({
        _id: id,
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
      })
        .populate('items.product', 'title modelNumber price images isActive')
        .lean();

      if (!offer) {
        throw new AppError('Offer not found or not active', 404, 'NOT_FOUND');
      }

      res.json({
        ok: true,
        data: offer
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to check for product conflicts in offers (branch-aware)
  static async checkProductConflicts(productIds: string[], excludeOfferId?: string, targetBranch?: string | null) {
    const now = new Date();
    
    const query: any = {
      isActive: true,
      'items.product': { $in: productIds.map(id => new mongoose.Types.ObjectId(id)) },
      $or: [
        { startsAt: null },
        { startsAt: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { endsAt: null },
            { endsAt: { $gte: now } }
          ]
        }
      ]
    };

    // Branch-aware conflict checking
    if (targetBranch) {
      // For branch-specific offers, check conflicts with:
      // 1. Global offers (branch: null)
      // 2. Same branch offers
      query.$and.push({
        $or: [
          { branch: null }, // Global offers
          { branch: new mongoose.Types.ObjectId(targetBranch) } // Same branch offers
        ]
      });
    } else {
      // For global offers, check conflicts with:
      // 1. Other global offers (branch: null)
      // 2. All branch-specific offers (since global affects all branches)
      // This means global offers conflict with everything
    }

    if (excludeOfferId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeOfferId) };
    }

    const conflictingOffers = await OfferCampaign.find(query)
      .populate('items.product', 'title')
      .lean();

    if (conflictingOffers.length > 0) {
      const conflictDetails = conflictingOffers.map(offer => {
        const conflictingProducts = offer.items
          .filter(item => productIds.includes((item.product as any)._id.toString()))
          .map(item => (item.product as any).title);
        
        return {
          offerTitle: offer.title,
          products: conflictingProducts
        };
      });

      return conflictDetails;
    }

    return null;
  }

  static async getAllOffers(req: Request, res: Response, next: NextFunction) {
    try {
      const { scope, isActive } = req.query;
      const query: any = {};

      // Filter by scope based on user role
      if (req.user!.role === 'admin') {
        // Admin sees all offers
        if (scope === 'global') {
          query.branch = null;
        } else if (scope === 'branch') {
          query.branch = { $ne: null };
        }
        // Otherwise, show all
      } else if (req.user!.role === 'branch') {
        // Branch sees global offers and their own offers
        query.$or = [
          { branch: null },
          { branch: req.user!.branchId }
        ];
      }

      if (isActive !== undefined) {
        query.isActive = isActive === 'true';
      }

      const offers = await OfferCampaign.find(query)
        .populate('items.product', 'title modelNumber price')
        .populate('branch', 'name')
        .populate('createdBy', 'username role')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        ok: true,
        data: offers
      });
    } catch (error) {
      next(error);
    }
  }

  static async getOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const offer = await OfferCampaign.findById(id)
        .populate('items.product', 'title modelNumber price images')
        .populate('branch', 'name')
        .populate('createdBy', 'username role')
        .lean();

      if (!offer) {
        throw new AppError('Offer campaign not found', 404, 'NOT_FOUND');
      }

      // Check access permissions
      if (req.user!.role === 'branch' && offer.branch && 
          !offer.branch._id.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      res.json({
        ok: true,
        data: offer
      });
    } catch (error) {
      next(error);
    }
  }

  static async createOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, startsAt, endsAt, applyMode, bulkPercent, bulkAmount, items, branch }: CreateOfferDto = req.body;

      // Validate products exist if items are provided
      if (items && items.length > 0) {
        const productIds = items.map((item: any) => item.product);
        const products = await Product.find({ _id: { $in: productIds } });
        
        if (products.length !== productIds.length) {
          throw new AppError('One or more products not found', 404, 'PRODUCTS_NOT_FOUND');
        }

        // Check for product conflicts with existing active offers (branch-aware)
        const targetBranch = req.user!.role === 'branch' ? req.user!.branchId : (branch || null);
        const conflicts = await OfferController.checkProductConflicts(productIds, undefined, targetBranch);
        if (conflicts) {
          const conflictMessage = conflicts.map(conflict => 
            `"${conflict.offerTitle}" already includes: ${conflict.products.join(', ')}`
          ).join('; ');
          
          throw new AppError(
            `Product conflict detected. ${conflictMessage}. Please remove these products from existing offers first.`,
            400,
            'PRODUCT_CONFLICT'
          );
        }
      }

      // Validate bulk settings based on apply mode
      if (applyMode === 'bulkPercent' && !bulkPercent) {
        throw new AppError('Bulk percent is required for bulkPercent mode', 400, 'BULK_PERCENT_REQUIRED');
      }
      
      if (applyMode === 'bulkAmount' && !bulkAmount) {
        throw new AppError('Bulk amount is required for bulkAmount mode', 400, 'BULK_AMOUNT_REQUIRED');
      }

      const offer = new OfferCampaign({
        title,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        applyMode,
        bulkPercent: applyMode === 'bulkPercent' ? bulkPercent : null,
        bulkAmount: applyMode === 'bulkAmount' ? bulkAmount : null,
        items: items ? items.map(item => ({
          product: new mongoose.Types.ObjectId(item.product),
          offerPrice: item.offerPrice,
          percent: item.percent
        })) : [],
        createdBy: req.user!.id,
        createdRole: req.user!.role,
        branch: req.user!.role === 'branch' ? req.user!.branchId : (branch ? new mongoose.Types.ObjectId(branch) : undefined),
        isActive: true
      });

      await offer.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'OfferCampaign',
        entityId: (offer as any)._id.toString(),
        action: 'create',
        metadata: { 
          offerTitle: offer.title,
          scope: offer.branch ? 'branch' : 'global'
        },
        req
      });

      // Get populated offer
      const populatedOffer = await OfferCampaign.findById(offer._id)
        .populate('items.product', 'title modelNumber price')
        .populate('branch', 'name')
        .populate('createdBy', 'username role');

      // Broadcast based on scope
      if (offer.branch) {
        SocketService.broadcastToBranch(offer.branch.toString(), 'offer.created', populatedOffer);
      } else {
        SocketService.broadcastToAll('offer.created', populatedOffer);
      }

      res.status(201).json({
        ok: true,
        data: populatedOffer
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData: UpdateOfferDto = req.body;

      const offer = await OfferCampaign.findById(id);

      if (!offer) {
        throw new AppError('Offer campaign not found', 404, 'NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && offer.branch && 
          !offer.branch.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const oldOffer = offer.toObject();

      // Update fields
      if (updateData.title !== undefined) offer.title = updateData.title;
      if (updateData.startsAt !== undefined) offer.startsAt = updateData.startsAt ? new Date(updateData.startsAt) : undefined;
      if (updateData.endsAt !== undefined) offer.endsAt = updateData.endsAt ? new Date(updateData.endsAt) : undefined;
      if (updateData.isActive !== undefined) offer.isActive = updateData.isActive;
      
      // Update branch (only for admin users)
      if (req.user!.role === 'admin' && updateData.branch !== undefined) {
        offer.branch = updateData.branch ? new mongoose.Types.ObjectId(updateData.branch) : undefined;
      }
      if (updateData.applyMode !== undefined) {
        offer.applyMode = updateData.applyMode;
        
        // Reset bulk fields based on new mode
        if (updateData.applyMode === 'bulkPercent') {
          offer.bulkPercent = updateData.bulkPercent || offer.bulkPercent;
          offer.bulkAmount = undefined;
        } else if (updateData.applyMode === 'bulkAmount') {
          offer.bulkAmount = updateData.bulkAmount || offer.bulkAmount;
          offer.bulkPercent = undefined;
        } else {
          offer.bulkPercent = undefined;
          offer.bulkAmount = undefined;
        }
      }
      if (updateData.items !== undefined) {
        // Check for product conflicts with existing active offers (excluding current offer, branch-aware)
        const productIds = updateData.items.map((item: any) => item.product);
        const targetBranch = req.user!.role === 'admin' && updateData.branch !== undefined ? 
          updateData.branch : 
          (req.user!.role === 'branch' ? req.user!.branchId : offer.branch?.toString());
        const conflicts = await OfferController.checkProductConflicts(productIds, id, targetBranch);
        if (conflicts) {
          const conflictMessage = conflicts.map(conflict => 
            `"${conflict.offerTitle}" already includes: ${conflict.products.join(', ')}`
          ).join('; ');
          
          throw new AppError(
            `Product conflict detected. ${conflictMessage}. Please remove these products from existing offers first.`,
            400,
            'PRODUCT_CONFLICT'
          );
        }

        // Convert string product IDs to ObjectIds
        offer.items = updateData.items.map(item => ({
          product: new mongoose.Types.ObjectId(item.product),
          offerPrice: item.offerPrice,
          percent: item.percent
        }));
      }

      offer.updatedBy = req.user!.id as any;
      await offer.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldOffer, offer);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'OfferCampaign',
        entityId: (offer as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Get populated offer
      const populatedOffer = await OfferCampaign.findById(offer._id)
        .populate('items.product', 'title modelNumber price')
        .populate('branch', 'name')
        .populate('createdBy', 'username role');

      // Broadcast based on scope
      if (offer.branch) {
        SocketService.broadcastToBranch(offer.branch.toString(), 'offer.updated', populatedOffer);
      } else {
        SocketService.broadcastToAll('offer.updated', populatedOffer);
      }

      res.json({
        ok: true,
        data: populatedOffer
      });
    } catch (error) {
      next(error);
    }
  }

  static async extendOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { endsAt } = req.body;

      const offer = await OfferCampaign.findById(id);

      if (!offer) {
        throw new AppError('Offer campaign not found', 404, 'NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && offer.branch && 
          !offer.branch.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      const newEndDate = new Date(endsAt);
      
      // Validate new end date is after current date
      if (newEndDate <= new Date()) {
        throw new AppError('End date must be in the future', 400, 'INVALID_END_DATE');
      }

      offer.endsAt = newEndDate;
      offer.updatedBy = req.user!.id as any;
      await offer.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'OfferCampaign',
        entityId: (offer as any)._id.toString(),
        action: 'update',
        metadata: { action: 'extended', newEndDate },
        req
      });

      // Broadcast based on scope
      if (offer.branch) {
        SocketService.broadcastToBranch(offer.branch.toString(), 'offer.updated', offer);
      } else {
        SocketService.broadcastToAll('offer.updated', offer);
      }

      res.json({
        ok: true,
        data: offer
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleOfferStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const offer = await OfferCampaign.findById(id);

      if (!offer) {
        throw new AppError('Offer campaign not found', 404, 'NOT_FOUND');
      }

      // Check permissions
      if (req.user!.role === 'branch' && offer.branch && 
          !offer.branch.equals(req.user!.branchId)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      offer.isActive = isActive;
      offer.updatedBy = req.user!.id as any;
      await offer.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'OfferCampaign',
        entityId: (offer as any)._id.toString(),
        action: 'update',
        metadata: { action: isActive ? 'activated' : 'deactivated' },
        req
      });

      // Broadcast based on scope
      if (offer.branch) {
        SocketService.broadcastToBranch(offer.branch.toString(), 'offer.updated', offer);
      } else {
        SocketService.broadcastToAll('offer.updated', offer);
      }

      res.json({
        ok: true,
        data: offer
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteOffer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const offer = await OfferCampaign.findById(id);

      if (!offer) {
        throw new AppError('Offer campaign not found', 404, 'NOT_FOUND');
      }

      // Check permissions - only the creator or admin can delete
      if (req.user!.role === 'branch' && 
          (!offer.createdBy.equals(req.user!.id) || (offer.branch && !offer.branch.equals(req.user!.branchId)))) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }

      await offer.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'OfferCampaign',
        entityId: (offer as any)._id.toString(),
        action: 'delete',
        metadata: { offerTitle: offer.title },
        req
      });

      // Broadcast deletion based on scope
      const deleteEvent = { id: offer._id };
      if (offer.branch) {
        SocketService.broadcastToBranch(offer.branch.toString(), 'offer.deleted', deleteEvent);
      } else {
        SocketService.broadcastToAll('offer.deleted', deleteEvent);
      }

      res.json({
        ok: true,
        data: {
          message: 'Offer campaign deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

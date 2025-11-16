import { Request, Response, NextFunction } from 'express';
import { Product, generateProductId } from './product.model';
import { Category } from '../categories/category.model';
import { Subcategory } from '../subcategories/subcategory.model';
import { Brand } from '../brands/brand.model';
import { AppError } from '../../middlewares/error.middleware';
import { AuditService } from '../audit/audit.service';
import { SocketService } from '../../sockets/socket.service';
import { StorageFactory } from '../../utils/storage/storage.factory';
import { CreateProductDto, UpdateProductDto, ProductQueryDto } from './product.validation';
import { OfferService } from '../offers/offer.service';

export class ProductController {
  static async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const query: ProductQueryDto = req.query as any;
      const filter: any = {};

      // Build filter
      if (query.category) filter.category = query.category;
      if (query.subcategory) filter.subcategory = query.subcategory;
      if (query.brand) filter.brand = query.brand;
      if (query.isOwn !== undefined) filter.isOwn = query.isOwn === 'true';
      if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

      // Price range filter
      if (query.minPrice || query.maxPrice) {
        filter.price = {};
        if (query.minPrice) filter.price.$gte = parseFloat(query.minPrice);
        if (query.maxPrice) filter.price.$lte = parseFloat(query.maxPrice);
      }

      // Text search
      if (query.q) {
        filter.$text = { $search: query.q };
      }

      // Pagination
      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '20');
      const skip = (page - 1) * limit;

      const [products, total] = await Promise.all([
        Product.find(filter)
          .populate('category', 'name')
          .populate('subcategory', 'name')
          .populate('brand', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter)
      ]);

      // Apply offer pricing to products
      const { branchId, lat, lng } = req.query;
      const userLocation = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
      const productsWithOffers = await OfferService.applyOfferPricingToProducts(
        products,
        branchId as string,
        userLocation
      );

      res.json({
        ok: true,
        data: {
          products: productsWithOffers,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id)
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .lean();

      if (!product) {
        throw new AppError('Product not found', 404, 'NOT_FOUND');
      }

      // Apply offer pricing to the product
      const { branchId, lat, lng } = req.query;
      const userLocation = lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;
      const productWithOffer = await OfferService.applyOfferPricing(
        product,
        branchId as string,
        userLocation
      );

      res.json({
        ok: true,
        data: productWithOffer
      });
    } catch (error) {
      next(error);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateProductDto = req.body;

      // Verify category, subcategory, and brand exist and match
      const [category, subcategory, brand] = await Promise.all([
        Category.findById(data.category),
        Subcategory.findById(data.subcategory),
        data.brand ? Brand.findById(data.brand) : null
      ]);

      if (!category) {
        throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
      }

      if (!subcategory) {
        throw new AppError('Subcategory not found', 404, 'SUBCATEGORY_NOT_FOUND');
      }

      if (!subcategory.category.equals((category as any)._id)) {
        throw new AppError('Subcategory does not belong to the specified category', 400, 'CATEGORY_MISMATCH');
      }

      if (data.brand && !brand) {
        throw new AppError('Brand not found', 404, 'BRAND_NOT_FOUND');
      }

      // Handle Cloudinary image uploads
      let images = data.images || [];
      
      if ((req as any).cloudinaryResults && Array.isArray((req as any).cloudinaryResults)) {
        images = (req as any).cloudinaryResults.map((result: any) => result.url || result);
      }

      // Validate offer price
      if (data.offerPrice && data.offerPrice >= data.price) {
        throw new AppError('Offer price must be less than regular price', 400, 'INVALID_OFFER_PRICE');
      }

      // Generate product ID based on subcategory
      const productId = await generateProductId(subcategory.name);

      const product = new Product({
        ...data,
        productId,
        images,
        createdBy: req.user!.id,
        isActive: true
      });

      await product.save();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Product',
        entityId: (product as any)._id.toString(),
        action: 'create',
        metadata: { 
          productTitle: product.title,
          modelNumber: product.modelNumber 
        },
        req
      });

      // Broadcast to all connected clients
      const populatedProduct = await Product.findById(product._id)
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name');
      
      SocketService.broadcastToAll('product.created', populatedProduct);

      res.status(201).json({
        ok: true,
        data: populatedProduct
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data: UpdateProductDto = req.body;

      const product = await Product.findById(id);

      if (!product) {
        throw new AppError('Product not found', 404, 'NOT_FOUND');
      }

      const oldProduct = product.toObject();

      // If category, subcategory, or brand is being updated, verify they exist
      if (data.category || data.subcategory || data.brand !== undefined) {
        const categoryId = data.category || product.category.toString();
        const subcategoryId = data.subcategory || product.subcategory.toString();

        const [category, subcategory, brand] = await Promise.all([
          Category.findById(categoryId),
          Subcategory.findById(subcategoryId),
          data.brand ? Brand.findById(data.brand) : null
        ]);

        if (!category) {
          throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
        }

        if (!subcategory) {
          throw new AppError('Subcategory not found', 404, 'SUBCATEGORY_NOT_FOUND');
        }

        if (!subcategory.category.equals((category as any)._id)) {
          throw new AppError('Subcategory does not belong to the specified category', 400, 'CATEGORY_MISMATCH');
        }

        if (data.brand && !brand) {
          throw new AppError('Brand not found', 404, 'BRAND_NOT_FOUND');
        }

        product.category = category._id as any;
        product.subcategory = subcategory._id as any;
        if (data.brand !== undefined) {
          product.brand = data.brand ? brand!._id as any : undefined;
        }
      }

      // Handle Cloudinary image uploads
      if ((req as any).cloudinaryResults && Array.isArray((req as any).cloudinaryResults) && (req as any).cloudinaryResults.length > 0) {
        const storage = StorageFactory.getStorage();
        
        // Delete old images if replacing
        if (product.images && product.images.length > 0) {
          const nonPlaceholderImages = product.images.filter(img => !img.includes('placeholder'));
          if (nonPlaceholderImages.length > 0) {
            await storage.deleteMany(nonPlaceholderImages);
          }
        }
        
        product.images = (req as any).cloudinaryResults.map((result: any) => result.url || result);
      } else if (data.images && data.images.length > 0) {
        // Only update images if new images are provided
        product.images = data.images;
      }
      // If no new images are provided, keep existing images

      // Update other fields
      if (data.title !== undefined) product.title = data.title;
      if (data.modelNumber !== undefined) product.modelNumber = data.modelNumber;
      if (data.price !== undefined) product.price = data.price;
      if (data.offerPrice !== undefined) product.offerPrice = data.offerPrice || undefined;
      if (data.isOwn !== undefined) product.isOwn = data.isOwn;
      if (data.colors !== undefined) product.colors = data.colors;
      if (data.isActive !== undefined) product.isActive = data.isActive;

      // Validate offer price
      if (product.offerPrice && product.offerPrice >= product.price) {
        throw new AppError('Offer price must be less than regular price', 400, 'INVALID_OFFER_PRICE');
      }

      product.updatedBy = req.user!.id as any;
      await product.save();

      // Create audit log
      const diff = AuditService.calculateDiff(oldProduct, product);
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Product',
        entityId: (product as any)._id.toString(),
        action: 'update',
        diff,
        req
      });

      // Get populated product
      const populatedProduct = await Product.findById(product._id)
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name');

      // Broadcast update
      SocketService.broadcastToAll('product.updated', populatedProduct);

      res.json({
        ok: true,
        data: populatedProduct
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);

      if (!product) {
        throw new AppError('Product not found', 404, 'NOT_FOUND');
      }

      // Delete images
      if (product.images && product.images.length > 0) {
        const storage = StorageFactory.getStorage();
        const nonPlaceholderImages = product.images.filter(img => !img.includes('placeholder'));
        if (nonPlaceholderImages.length > 0) {
          await storage.deleteMany(nonPlaceholderImages);
        }
      }

      await product.deleteOne();

      // Create audit log
      await AuditService.create({
        actorUser: req.user!.id,
        actorRole: req.user!.role,
        entity: 'Product',
        entityId: (product as any)._id.toString(),
        action: 'delete',
        metadata: { 
          productTitle: product.title,
          modelNumber: product.modelNumber 
        },
        req
      });

      // Broadcast deletion
      SocketService.broadcastToAll('product.deleted', { id: product._id });

      res.json({
        ok: true,
        data: {
          message: 'Product deleted successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const history = await AuditService.getEntityHistory('Product', id);

      res.json({
        ok: true,
        data: history
      });
    } catch (error) {
      next(error);
    }
  }
}

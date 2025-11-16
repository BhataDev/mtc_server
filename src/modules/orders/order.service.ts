import { Order, IOrder, IOrderItem, IShippingAddress } from './order.model';
import { Product } from '../products/product.model';
import { Customer } from '../customers/customer.model';
import { OfferService } from '../offers/offer.service';
import { AddressService } from '../customers/address.service';
import { BranchAssignmentService } from '../../services/branch-assignment.service';
import mongoose from 'mongoose';

export interface CreateOrderData {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: IShippingAddress;
  paymentMethod: 'mada' | 'emkan' | 'cod';
  subtotal: number;
  shipping: number;
  total: number;
  notes?: string;
  saveInfo?: boolean;
  customerIpAddress?: string; // Customer's IP address for branch assignment
  clientLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }; // Optional: Browser geolocation data
}

export interface UpdateOrderStatusData {
  status?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'on_the_way' | 'delivered' | 'cancelled';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  trackingNumber?: string;
  estimatedDelivery?: Date;
  notes?: string;
}

class OrderService {
  async createOrder(orderData: CreateOrderData): Promise<IOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate customer exists
      const customer = await Customer.findById(orderData.customerId).session(session);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Validate and fetch product details
      const orderItems: IOrderItem[] = [];
      let calculatedSubtotal = 0;

      for (const item of orderData.items) {
        const product = await Product.findById(item.productId).session(session);
        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Apply current offer pricing using OfferService
        const productWithOffer = await OfferService.applyOfferPricing(product.toObject());
        const price = productWithOffer.offerPrice || productWithOffer.price;
        const subtotal = price * item.quantity;
        calculatedSubtotal += subtotal;

        console.log('Item calculation:', {
          productId: item.productId,
          title: product.title,
          regularPrice: product.price,
          staticOfferPrice: product.offerPrice,
          dynamicOfferPrice: productWithOffer.offerPrice,
          effectivePrice: productWithOffer.effectivePrice,
          finalPrice: price,
          hasOffer: productWithOffer.hasOffer,
          quantity: item.quantity,
          itemSubtotal: subtotal,
          runningTotal: calculatedSubtotal
        });


        orderItems.push({
          product: product._id as mongoose.Types.ObjectId,
          title: product.title,
          price: product.price,
          offerPrice: productWithOffer.offerPrice,
          quantity: item.quantity,
          subtotal: subtotal,
          image: product.images?.[0] || ''
        });
      }

      // Validate totals
      console.log('Order validation:', {
        calculatedSubtotal,
        frontendSubtotal: orderData.subtotal,
        difference: Math.abs(calculatedSubtotal - orderData.subtotal)
      });
      
      if (Math.abs(calculatedSubtotal - orderData.subtotal) > 0.01) {
        throw new Error('Subtotal mismatch');
      }

      if (Math.abs((calculatedSubtotal + orderData.shipping) - orderData.total) > 0.01) {
        throw new Error('Total amount mismatch');
      }

      // Validate shipping address based on VAT registration
      const { shippingAddress } = orderData;
      
      if (shippingAddress.vatRegistered) {
        // VAT registered company validation
        const requiredCompanyFields = ['companyName', 'phone', 'crNumber', 'vatNumber', 'address', 'buildingNumber', 'district', 'postalCode'];
        for (const field of requiredCompanyFields) {
          if (!shippingAddress[field as keyof IShippingAddress]) {
            throw new Error(`${field} is required for VAT registered companies`);
          }
        }
      } else {
        // Individual/Non-VAT validation
        const requiredIndividualFields = ['firstName', 'lastName', 'phone', 'address', 'buildingNumber', 'district'];
        for (const field of requiredIndividualFields) {
          if (!shippingAddress[field as keyof IShippingAddress]) {
            throw new Error(`${field} is required for individual customers`);
          }
        }
        // Email is required for individuals (not for VAT companies)
        if (!shippingAddress.email) {
          throw new Error('email is required for individual customers');
        }
      }

      // Find nearest branch based on customer location
      let assignedBranch = null;
      let customerLocation = null;
      let locationSource = 'none';
      
      // Priority 1: Use client-side geolocation if provided
      if (orderData.clientLocation) {
        console.log(`📱 Using client-side geolocation:`, orderData.clientLocation);
        locationSource = 'client';
        customerLocation = {
          type: 'Point',
          coordinates: [orderData.clientLocation.longitude, orderData.clientLocation.latitude]
        };
        
        // Find branch using client location with increased max distance
        let branchAssignment = await BranchAssignmentService.findNearestBranchByCoordinates(
          orderData.clientLocation.longitude,
          orderData.clientLocation.latitude,
          10000 // Increased from 100km to 500km
        );
        
        // Fallback to manual calculation if geospatial query fails
        if (!branchAssignment) {
          console.log('⚠️ Geospatial query failed, using manual calculation fallback');
          branchAssignment = await BranchAssignmentService.findNearestBranchManual(
            orderData.clientLocation.longitude,
            orderData.clientLocation.latitude
          );
        }
        
        if (branchAssignment) {
          assignedBranch = branchAssignment._id;
          console.log(`✅ Order assigned to branch: ${branchAssignment.name}`);
        } else {
          console.log('❌ No branches found within search radius');
        }
      }
      // Priority 2: Fall back to IP-based geolocation
      else if (orderData.customerIpAddress) {
        console.log(`🏢 Assigning branch for IP: ${orderData.customerIpAddress}`);
        locationSource = 'ip';
        const branchAssignment = await BranchAssignmentService.findNearestBranchByIP(orderData.customerIpAddress);
        
        if (branchAssignment) {
          assignedBranch = branchAssignment.branch._id;
          customerLocation = {
            type: 'Point',
            coordinates: [branchAssignment.customerLocation.longitude, branchAssignment.customerLocation.latitude]
          };
          console.log(`✅ Order assigned to branch: ${branchAssignment.branch.name} (${branchAssignment.distance.toFixed(2)} km away)`);
          console.log(`📍 Customer location saved:`, customerLocation);
        } else {
          console.log('⚠️ Could not assign branch, order will be unassigned');
          console.log('⚠️ Customer location will be null');
        }
      } else {
        console.log('⚠️ No location data provided (no client location or IP address)');
        console.log('⚠️ Customer location will be null');
      }
      
      console.log(`📍 Location source: ${locationSource}, Customer location:`, customerLocation);
      console.log(`🏢 Assigned branch ID: ${assignedBranch || 'null'}`);

      // Generate order number
      const orderCount = await Order.countDocuments().session(session);
      const orderNumber = `MTC${String(orderCount + 1).padStart(6, '0')}`;

      // Create order
      const order = new Order({
        orderNumber: orderNumber,
        customer: orderData.customerId,
        branch: assignedBranch,
        items: orderItems,
        shippingAddress: orderData.shippingAddress,
        paymentMethod: orderData.paymentMethod,
        subtotal: orderData.subtotal,
        shipping: orderData.shipping,
        total: orderData.total,
        notes: orderData.notes,
        customerIpAddress: orderData.customerIpAddress,
        customerLocation: customerLocation
      });

      const savedOrder = await order.save({ session });

      // Save address if requested
      if (orderData.saveInfo) {
        console.log('Attempting to save address for customer:', orderData.customerId);
        console.log('Address data:', {
          firstName: orderData.shippingAddress.firstName,
          lastName: orderData.shippingAddress.lastName,
          vatRegistered: orderData.shippingAddress.vatRegistered
        });
        try {
          const savedAddress = await AddressService.saveAddress(orderData.customerId, {
            firstName: orderData.shippingAddress.firstName,
            lastName: orderData.shippingAddress.lastName,
            email: orderData.shippingAddress.email,
            phone: orderData.shippingAddress.phone,
            companyName: orderData.shippingAddress.companyName,
            address: orderData.shippingAddress.address,
            apartment: orderData.shippingAddress.apartment,
            district: orderData.shippingAddress.district,
            buildingNumber: orderData.shippingAddress.buildingNumber,
            secondaryNumber: orderData.shippingAddress.secondaryNumber,
            postalCode: orderData.shippingAddress.postalCode || '',
            crNumber: orderData.shippingAddress.crNumber,
            vatNumber: orderData.shippingAddress.vatNumber,
            vatRegistered: orderData.shippingAddress.vatRegistered,
            addressLabel: orderData.shippingAddress.vatRegistered ? 'Company Address' : 'Home Address'
          });
          console.log('Address saved successfully:', savedAddress);
        } catch (addressError) {
          console.error('Failed to save address:', addressError);
          // Don't fail the order if address saving fails
        }
      } else {
        console.log('saveInfo is false, not saving address');
      }

      await session.commitTransaction();

      // Populate customer and product details
      const populatedOrder = await this.getOrderById((savedOrder._id as mongoose.Types.ObjectId).toString());
      if (!populatedOrder) {
        throw new Error('Failed to retrieve created order');
      }
      return populatedOrder;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getOrderById(orderId: string): Promise<IOrder | null> {
    return await Order.findById(orderId)
      .populate('customer', 'name email phone')
      .populate('branch', 'name addressText phone')
      .populate('items.product', 'title images price offerPrice')
      .exec();
  }

  async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
    return await Order.findOne({ orderNumber })
      .populate('customer', 'name email phone')
      .populate('branch', 'name addressText phone')
      .populate('items.product', 'title images price offerPrice')
      .exec();
  }

  async getCustomerOrders(
    customerId: string, 
    page: number = 1, 
    limit: number = 10,
    status?: string
  ): Promise<{ orders: IOrder[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const filter: any = { customer: customerId };
    
    if (status) {
      filter.status = status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('branch', 'name addressText phone')
        .populate('items.product', 'title images price offerPrice')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(filter)
    ]);

    return {
      orders,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string
  ): Promise<{ orders: IOrder[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email phone')
        .populate('branch', 'name addressText phone')
        .populate('items.product', 'title images price offerPrice')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(filter)
    ]);

    return {
      orders,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getBranchOrders(
    branchId: string,
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string
  ): Promise<{ orders: IOrder[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const filter: any = { branch: branchId };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.firstName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.lastName': { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email phone')
        .populate('branch', 'name addressText phone location')
        .populate('items.product', 'title images price offerPrice')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Order.countDocuments(filter)
    ]);

    return {
      orders,
      total,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateOrderStatus(orderId: string, updateData: UpdateOrderStatusData): Promise<IOrder | null> {
    const updateFields: any = { ...updateData };
    
    // Set deliveredAt when status changes to delivered
    if (updateData.status === 'delivered' && !updateFields.deliveredAt) {
      updateFields.deliveredAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      updateFields,
      { new: true, runValidators: true }
    )
      .populate('customer', 'name email phone')
      .populate('items.product', 'title images price offerPrice')
      .exec();

    return order;
  }

  async reverseOrderStatus(orderId: string): Promise<IOrder | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Define status progression and reverse mapping
    const statusProgression = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusProgression.indexOf(order.status);

    // Cannot reverse if at the beginning or if cancelled
    if (currentIndex <= 0 || order.status === 'cancelled') {
      throw new Error(`Cannot reverse status from ${order.status}`);
    }

    // Get previous status
    const previousStatus = statusProgression[currentIndex - 1];

    return await this.updateOrderStatus(orderId, {
      status: previousStatus as any
    });
  }

  async cancelOrder(orderId: string, reason?: string): Promise<IOrder | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (['delivered', 'cancelled'].includes(order.status)) {
      throw new Error('Cannot cancel this order');
    }

    return await this.updateOrderStatus(orderId, {
      status: 'cancelled',
      notes: reason ? `Cancelled: ${reason}` : 'Order cancelled'
    });
  }

  async getOrderStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    totalRevenue: number;
  }> {
    const [stats, revenue] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: { status: { $ne: 'cancelled' } }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' }
          }
        }
      ])
    ]);

    const statusCounts = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});

    return {
      total: stats.reduce((sum, stat) => sum + stat.count, 0),
      pending: statusCounts.pending || 0,
      processing: statusCounts.processing || 0,
      shipped: statusCounts.shipped || 0,
      delivered: statusCounts.delivered || 0,
      cancelled: statusCounts.cancelled || 0,
      totalRevenue: revenue[0]?.totalRevenue || 0
    };
  }
}

export const orderService = new OrderService();

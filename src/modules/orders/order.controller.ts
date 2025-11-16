import { Request, Response } from 'express';
import { orderService, CreateOrderData, UpdateOrderStatusData } from './order.service';

class OrderController {
  // Create a new order
  createOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const {
        items,
        shippingAddress,
        paymentMethod,
        subtotal,
        shipping,
        total,
        notes,
        saveInfo,
        clientLocation // Optional: Browser geolocation data
      } = req.body;

      // Validate required fields
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Order items are required'
        });
        return;
      }

      if (!shippingAddress) {
        res.status(400).json({
          success: false,
          message: 'Shipping address is required'
        });
        return;
      }

      // Note: Detailed address validation is handled in the service layer based on VAT registration

      if (!paymentMethod || !['mada', 'emkan', 'cod'].includes(paymentMethod)) {
        res.status(400).json({
          success: false,
          message: 'Valid payment method is required'
        });
        return;
      }

      if (typeof subtotal !== 'number' || typeof shipping !== 'number' || typeof total !== 'number') {
        res.status(400).json({
          success: false,
          message: 'Valid pricing information is required'
        });
        return;
      }

      // Extract customer IP address from request
      const customerIpAddress = this.getClientIP(req);
      console.log(`📍 Customer IP for order: ${customerIpAddress}`);

      const orderData: CreateOrderData = {
        customerId,
        items: items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        shippingAddress,
        paymentMethod,
        subtotal,
        shipping,
        total,
        notes,
        saveInfo,
        customerIpAddress,
        clientLocation // Include browser geolocation if provided
      };

      const order = await orderService.createOrder(orderData);

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error: any) {
      console.error('Create order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create order'
      });
    }
  }

  // Get order by ID
  getOrderById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const customerId = req.user?.id;
      const userRole = req.user?.role;

      const order = await orderService.getOrderById(orderId);
      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if user has permission to view this order
      if (userRole !== 'admin' && order.customer.toString() !== customerId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      console.error('Get order error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order'
      });
    }
  }

  // Get order by order number
  getOrderByNumber = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderNumber } = req.params;
      const customerId = req.user?.id;
      const userRole = req.user?.role;

      const order = await orderService.getOrderByNumber(orderNumber);
      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check if user has permission to view this order
      if (userRole !== 'admin' && order.customer.toString() !== customerId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      console.error('Get order by number error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order'
      });
    }
  }

  // Get customer's orders
  getCustomerOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const customerId = req.user?.id;
      if (!customerId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;

      const result = await orderService.getCustomerOrders(customerId, page, limit, status);

      res.json({
        success: true,
        data: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error: any) {
      console.error('Get customer orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }
  }

  // Get all orders (Admin only)
  getAllOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const result = await orderService.getAllOrders(page, limit, status, search);

      res.json({
        success: true,
        data: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error: any) {
      console.error('Get all orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }
  }

  // Get orders for a specific branch (Branch admin or Super admin)
  getBranchOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const branchId = req.params.branchId;
      const userRole = req.user?.role;
      const userBranchId = req.user?.branchId;

      if (!branchId) {
        res.status(400).json({
          success: false,
          message: 'Branch ID is required'
        });
        return;
      }

      // Authorization: Branch admins can only see their own branch's orders
      if (userRole === 'branch' && userBranchId !== branchId) {
        res.status(403).json({
          success: false,
          message: 'You can only view orders for your assigned branch'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const result = await orderService.getBranchOrders(branchId, page, limit, status, search);

      res.json({
        success: true,
        data: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error: any) {
      console.error('Get branch orders error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch branch orders'
      });
    }
  }

  // Update order status (Admin or Branch Admin)
  updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const updateData: UpdateOrderStatusData = req.body;
      const userRole = req.user?.role;
      const userBranchId = req.user?.branchId;

      // Fetch order to check authorization
      const existingOrder = await orderService.getOrderById(orderId);
      if (!existingOrder) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Authorization: Branch admins can only update orders in their branch
      if (userRole === 'branch' && userBranchId) {
        const orderBranchId = (existingOrder.branch as any)?._id?.toString() || existingOrder.branch?.toString();
        if (orderBranchId !== userBranchId) {
          res.status(403).json({
            success: false,
            message: 'You can only update orders in your assigned branch'
          });
          return;
        }
      }

      const order = await orderService.updateOrderStatus(orderId, updateData);
      if (!order) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Order updated successfully',
        data: order
      });
    } catch (error: any) {
      console.error('Update order status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update order'
      });
    }
  }

  // Reverse order status (Admin or Branch Admin)
  reverseOrderStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const userRole = req.user?.role;
      const userBranchId = req.user?.branchId;

      // Fetch order to check authorization
      const existingOrder = await orderService.getOrderById(orderId);
      if (!existingOrder) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Authorization: Branch admins can only reverse orders in their branch
      if (userRole === 'branch' && userBranchId) {
        const orderBranchId = (existingOrder.branch as any)?._id?.toString() || existingOrder.branch?.toString();
        if (orderBranchId !== userBranchId) {
          res.status(403).json({
            success: false,
            message: 'You can only reverse orders in your assigned branch'
          });
          return;
        }
      }

      const order = await orderService.reverseOrderStatus(orderId);

      res.json({
        success: true,
        message: 'Order status reversed successfully',
        data: order
      });
    } catch (error: any) {
      console.error('Reverse order status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reverse order status'
      });
    }
  }

  // Cancel order
  cancelOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const customerId = req.user?.id;
      const userRole = req.user?.role;

      // First check if order exists and user has permission
      const existingOrder = await orderService.getOrderById(orderId);
      if (!existingOrder) {
        res.status(404).json({
          success: false,
          message: 'Order not found'
        });
        return;
      }

      // Check permission - extract customer ID properly
      const customerIdToCheck = (existingOrder.customer as any)?._id?.toString() || existingOrder.customer?.toString();
        
      if (userRole !== 'admin' && customerIdToCheck !== customerId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }

      const order = await orderService.cancelOrder(orderId, reason);

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: order
      });
    } catch (error: any) {
      console.error('Cancel order error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel order'
      });
    }
  }

  // Get order statistics (Admin only)
  getOrderStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await orderService.getOrderStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Get order stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch order statistics'
      });
    }
  }

  // Helper method to extract client IP address
  private getClientIP(req: Request): string {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIP = req.headers['x-real-ip'] as string;
    const cfConnectingIP = req.headers['cf-connecting-ip'] as string; // Cloudflare
    
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    if (cfConnectingIP) {
      return cfConnectingIP;
    }
    
    // Fallback to connection remote address
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           (req.connection as any)?.socket?.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }
}

export const orderController = new OrderController();

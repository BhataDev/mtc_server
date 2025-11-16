import { Router } from 'express';
import { orderController } from '../modules/orders/order.controller';
import { requireAuth, requireAdmin, requireCustomer, requireAdminOrBranch } from '../middlewares/auth.middleware';

const router = Router();

// Customer routes - require authentication and customer role
router.post('/', requireAuth, requireCustomer, orderController.createOrder);
router.get('/my-orders', requireAuth, requireCustomer, orderController.getCustomerOrders);
router.get('/my-orders/:orderId', requireAuth, requireCustomer, orderController.getOrderById);
router.get('/track/:orderNumber', requireAuth, requireCustomer, orderController.getOrderByNumber);
router.put('/cancel/:orderId', requireAuth, requireCustomer, orderController.cancelOrder);

// Branch admin routes - require authentication and admin or branch role
router.get('/branch/:branchId', requireAuth, requireAdminOrBranch, orderController.getBranchOrders);

// Admin routes - require authentication and admin role
router.get('/admin/all', requireAuth, requireAdmin, orderController.getAllOrders);
router.get('/admin/stats', requireAuth, requireAdmin, orderController.getOrderStats);
router.get('/admin/:orderId', requireAuth, requireAdmin, orderController.getOrderById);

// Status update - allow both admin and branch admins
router.put('/admin/:orderId/status', requireAuth, requireAdminOrBranch, orderController.updateOrderStatus);

// Reverse status - allow both admin and branch admins
router.put('/admin/:orderId/reverse-status', requireAuth, requireAdminOrBranch, orderController.reverseOrderStatus);

// Cancel order - admin only
router.put('/admin/cancel/:orderId', requireAuth, requireAdmin, orderController.cancelOrder);

export default router;

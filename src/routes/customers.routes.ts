import { Router } from 'express';
import { 
  getAllCustomers, 
  getCustomer, 
  updateCustomerStatus, 
  deleteCustomer,
  getCustomerStats 
} from '../modules/customers/customer.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// All routes require admin authentication
router.use(requireAuth);
router.use(requireAdmin);

// Customer management routes
router.get('/', getAllCustomers);
router.get('/stats', getCustomerStats);
router.get('/:id', getCustomer);
router.patch('/:id/status', updateCustomerStatus);
router.delete('/:id', deleteCustomer);

export default router;

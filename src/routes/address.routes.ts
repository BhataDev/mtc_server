import { Router } from 'express';
import { AddressController } from '../modules/customers/address.controller';
import { requireAuth, requireCustomer } from '../middlewares/auth.middleware';

const router = Router();

// All address routes require authentication and customer role
router.use(requireAuth);
router.use(requireCustomer);

// Address routes
router.get('/', AddressController.getAddresses);
router.post('/', AddressController.saveAddress);
router.put('/:addressId', AddressController.updateAddress);
router.delete('/:addressId', AddressController.deleteAddress);
router.put('/:id/default', requireAuth, requireCustomer, AddressController.setDefaultAddress);
router.delete('/duplicates', requireAuth, requireCustomer, AddressController.removeDuplicates);

export default router;

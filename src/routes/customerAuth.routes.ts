import { Router } from 'express';
import { CustomerAuthController } from '../modules/customers/customer.auth.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { customerLoginSchema, customerSignupSchema, googleIdTokenSchema } from '../modules/customers/customer.validation';
import { requireAuth, requireCustomer } from '../middlewares/auth.middleware';

const router = Router();

// Public
router.post('/signup', validateBody(customerSignupSchema), CustomerAuthController.signup);
router.post('/login', validateBody(customerLoginSchema), CustomerAuthController.login);
router.post('/google', validateBody(googleIdTokenSchema), CustomerAuthController.google);

// Protected
router.get('/me', requireAuth, requireCustomer, CustomerAuthController.me);

export default router;

import { Router } from 'express';
import { AuthController } from '../auth/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { loginSchema } from '../auth/auth.validation';

const router = Router();

// Public routes
router.post('/login', validateBody(loginSchema), AuthController.login); // General login (backward compatibility)
router.post('/admin/login', validateBody(loginSchema), AuthController.adminLogin); // Admin-specific login
router.post('/branch/login', validateBody(loginSchema), AuthController.branchLogin); // Branch-specific login

// Temporary fix endpoint (remove in production)
router.post('/fix-branch-password', AuthController.fixBranchPassword);

// Protected routes
router.get('/me', requireAuth, AuthController.getCurrentUser);

export default router;

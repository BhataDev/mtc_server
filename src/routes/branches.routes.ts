import { Router } from 'express';
import { BranchController } from '../modules/branches/branch.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import {
  createBranchSchema,
  updateBranchSchema,
  resetPasswordSchema,
  updateStatusSchema
} from '../modules/branches/branch.validation';

const router = Router();

// All routes require authentication and admin role
router.use(requireAuth, requireAdmin);

// Branch management
router.get('/', BranchController.getAllBranches);
router.get('/:id', BranchController.getBranch);
router.post('/', validateBody(createBranchSchema), BranchController.createBranch);
router.put('/:id', validateBody(updateBranchSchema), BranchController.updateBranch);
router.delete('/:id', BranchController.deleteBranch);
router.post('/:id/reset-password', validateBody(resetPasswordSchema), BranchController.resetBranchPassword);
router.patch('/:id/status', validateBody(updateStatusSchema), BranchController.updateBranchStatus);

// Public endpoint for finding nearest branch (no auth required)
router.get('/nearest/location', BranchController.getNearestBranch);

export default router;

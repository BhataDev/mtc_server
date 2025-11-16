import { Router } from 'express';
import { SettingsController } from '../modules/settings/settings.controller';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { updateSettingsSchema } from '../modules/settings/settings.validation';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get settings (any authenticated user can view)
router.get('/', SettingsController.getSettings);

// Update settings (admin only)
router.put('/', requireAdmin, validateBody(updateSettingsSchema), SettingsController.updateSettings);

export default router;
